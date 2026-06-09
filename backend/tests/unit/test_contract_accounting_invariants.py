"""
Invariantes contables del ciclo de vida del contrato B2B — suite afinada (Fase B3).

Complementa ``tests/unit/test_contract_accounting.py`` (que valida I1–I12 a nivel
AGREGADO: suma de cuentas líquidas y P&L global) ejercitando ``ContractService``
directamente sobre ``db_session`` y afirmando a nivel de CUENTA ESPECÍFICA:

  (1) Tras registrar anticipo, el saldo de 'Anticipos de Clientes' (2110) == monto
      del anticipo Y la cuenta de caja correcta (Caja Menor 1101 para efectivo,
      Banco 1104 para transferencia) subió EXACTAMENTE ese mismo monto. Se verifica
      además que el BalanceEntry de auditoría existe en ambas patas (partida doble).
  (2) NO se reconoció ingreso (0 filas Transaction INCOME) por el anticipo.
  (3) Tras entrega total: ingreso devengado == total entregado, el pasivo 2110 se
      debita de vuelta a 0, y (crédito) se crea CxC con b2b_client_id y
      due_date == invoice_date + payment_terms_days.
  (4) El income del P&L NO incluye el anticipo antes de la entrega.

El patrón es el de ``test_quotation_service.py``: servicio directo sobre la sesión
real, asserts antes del rollback de la fixture — evita el flake de multi-request.

Notación de cuentas (globales, school_id IS NULL):
  1101 Caja Menor (efectivo) · 1102 Caja Mayor · 1103 Nequi · 1104 Banco · 2110 Anticipos.
``register_deposit`` enruta el efectivo del anticipo por ``INCOME_ACCOUNT_MAP``:
cash → Caja Menor (1101), transfer/card → Banco (1104), nequi → Nequi (1103).
"""
from datetime import timedelta
from decimal import Decimal
from uuid import uuid4

import pytest
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.accounting import (
    AccountType,
    AccPaymentMethod,
    AccountsReceivable,
    BalanceAccount,
    BalanceEntry,
    Transaction,
    TransactionType,
)
from app.models.b2b import (
    B2BClient,
    B2BSegment,
    Contract,
    ContractStatus,
)
from app.services.contract import ContractService
from app.services.contract.accounting import ANTICIPOS_CODE
from app.utils.timezone import get_colombia_date


CAJA_MENOR_CODE = "1101"
BANCO_CODE = "1104"
NEQUI_CODE = "1103"


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
async def cash_client(db_session: AsyncSession) -> B2BClient:
    """Cliente B2B de CONTADO (payment_terms_days = 0)."""
    record = B2BClient(
        id=uuid4(),
        legal_name="Inv Dotaciones Contado SAS",
        tax_id=f"901{uuid4().hex[:6]}",
        segment=B2BSegment.CORPORATE,
        payment_terms_days=0,
    )
    db_session.add(record)
    await db_session.flush()
    return record


@pytest.fixture
async def credit_client(db_session: AsyncSession) -> B2BClient:
    """Cliente B2B a CRÉDITO (payment_terms_days = 30)."""
    record = B2BClient(
        id=uuid4(),
        legal_name="Hotel Crédito SAS",
        tax_id=f"901{uuid4().hex[:6]}",
        segment=B2BSegment.CORPORATE,
        payment_terms_days=30,
    )
    db_session.add(record)
    await db_session.flush()
    return record


async def _make_contract(
    db_session: AsyncSession,
    client: B2BClient,
    *,
    total: Decimal,
    deposit: Decimal,
) -> Contract:
    contract = Contract(
        id=uuid4(),
        b2b_client_id=client.id,
        contract_number=f"CTR-INV-{uuid4().hex[:6]}",
        status=ContractStatus.PENDING_DEPOSIT,
        total=total,
        deposit_amount=deposit,
        balance_amount=total - deposit,
        has_milestones=False,
    )
    db_session.add(contract)
    await db_session.flush()
    return contract


# ---------------------------------------------------------------------------
# Helpers de medición (a nivel de cuenta específica)
# ---------------------------------------------------------------------------


async def _account_balance(db_session: AsyncSession, code: str) -> Decimal:
    """Saldo de una cuenta global por código (0 si aún no existe)."""
    result = await db_session.execute(
        select(BalanceAccount.balance).where(
            BalanceAccount.school_id.is_(None),
            BalanceAccount.code == code,
        )
    )
    value = result.scalar_one_or_none()
    return Decimal(str(value)) if value is not None else Decimal("0")


async def _income_total(db_session: AsyncSession) -> Decimal:
    """Income devengado del P&L: excluye category='receivables' (realización CxC)."""
    result = await db_session.execute(
        select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            Transaction.type == TransactionType.INCOME,
            func.coalesce(Transaction.category, "") != "receivables",
        )
    )
    return Decimal(str(result.scalar_one()))


async def _b2b_income(db_session: AsyncSession, contract: Contract) -> Decimal:
    result = await db_session.execute(
        select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            Transaction.type == TransactionType.INCOME,
            Transaction.reference_code == contract.contract_number,
            Transaction.category == "b2b",
        )
    )
    return Decimal(str(result.scalar_one()))


async def _income_txn_count(db_session: AsyncSession, contract: Contract) -> int:
    result = await db_session.execute(
        select(func.count(Transaction.id)).where(
            Transaction.type == TransactionType.INCOME,
            Transaction.reference_code == contract.contract_number,
        )
    )
    return int(result.scalar_one())


async def _entry_sum_on_account(
    db_session: AsyncSession, code: str, reference: str
) -> Decimal:
    """Suma firmada de los BalanceEntry de auditoría de una cuenta para una referencia."""
    result = await db_session.execute(
        select(func.coalesce(func.sum(BalanceEntry.amount), 0))
        .join(BalanceAccount, BalanceEntry.account_id == BalanceAccount.id)
        .where(
            BalanceAccount.code == code,
            BalanceAccount.school_id.is_(None),
            BalanceEntry.reference == reference,
        )
    )
    return Decimal(str(result.scalar_one()))


# ===========================================================================
# (1) + (2) Anticipo: pasivo 2110 == caja específica, sin ingreso
# ===========================================================================


@pytest.mark.asyncio
async def test_deposit_cash_lands_in_caja_menor_and_liability_equal(
    db_session: AsyncSession, cash_client: B2BClient
):
    """(1) Anticipo en efectivo: 2110 sube D y Caja Menor (1101) sube D — exacto.

    A nivel de cuenta específica: el efectivo del anticipo en CASH va a Caja Menor,
    no a Banco/Nequi, y el pasivo 2110 espeja el mismo monto (partida balanceada).
    """
    service = ContractService(db_session)
    D = Decimal("400000.00")
    contract = await _make_contract(
        db_session, cash_client, total=Decimal("1000000"), deposit=D
    )

    caja_before = await _account_balance(db_session, CAJA_MENOR_CODE)
    banco_before = await _account_balance(db_session, BANCO_CODE)
    liab_before = await _account_balance(db_session, ANTICIPOS_CODE)

    await service.register_deposit(
        contract.id, payment_method=AccPaymentMethod.CASH, user_id=None
    )

    caja_after = await _account_balance(db_session, CAJA_MENOR_CODE)
    banco_after = await _account_balance(db_session, BANCO_CODE)
    liab_after = await _account_balance(db_session, ANTICIPOS_CODE)

    # el efectivo aterriza en Caja Menor, no en Banco
    assert caja_after - caja_before == D
    assert banco_after - banco_before == Decimal("0")
    # el pasivo 2110 sube el mismo monto (partida balanceada: ΔCaja == Δ2110)
    assert liab_after - liab_before == D
    assert (caja_after - caja_before) == (liab_after - liab_before)


@pytest.mark.asyncio
async def test_deposit_transfer_lands_in_banco_not_caja(
    db_session: AsyncSession, cash_client: B2BClient
):
    """(1) Anticipo por transferencia: el efecto va a Banco (1104), Caja Menor intacta."""
    service = ContractService(db_session)
    D = Decimal("750000.00")
    contract = await _make_contract(
        db_session, cash_client, total=Decimal("1500000"), deposit=D
    )

    caja_before = await _account_balance(db_session, CAJA_MENOR_CODE)
    banco_before = await _account_balance(db_session, BANCO_CODE)

    await service.register_deposit(
        contract.id, payment_method=AccPaymentMethod.TRANSFER, user_id=None
    )

    assert await _account_balance(db_session, BANCO_CODE) - banco_before == D
    assert await _account_balance(db_session, CAJA_MENOR_CODE) - caja_before == Decimal("0")
    assert await _account_balance(db_session, ANTICIPOS_CODE) == D


@pytest.mark.asyncio
async def test_deposit_writes_audit_entries_on_both_legs(
    db_session: AsyncSession, cash_client: B2BClient
):
    """(1) Partida doble: hay BalanceEntry de auditoría en Caja Menor Y en 2110.

    La traza de auditoría (BalanceEntry) debe registrar ambas patas con la
    referencia del contrato, sumando +D en cada cuenta.
    """
    service = ContractService(db_session)
    D = Decimal("250000.00")
    contract = await _make_contract(
        db_session, cash_client, total=Decimal("500000"), deposit=D
    )
    ref = contract.contract_number

    await service.register_deposit(
        contract.id, payment_method=AccPaymentMethod.CASH, user_id=None
    )

    assert await _entry_sum_on_account(db_session, CAJA_MENOR_CODE, ref) == D
    assert await _entry_sum_on_account(db_session, ANTICIPOS_CODE, ref) == D


@pytest.mark.asyncio
async def test_deposit_records_zero_income_transactions(
    db_session: AsyncSession, cash_client: B2BClient
):
    """(2) El anticipo NO es ingreso: 0 filas Transaction INCOME por el contrato."""
    service = ContractService(db_session)
    contract = await _make_contract(
        db_session, cash_client, total=Decimal("1000000"), deposit=Decimal("400000")
    )

    await service.register_deposit(
        contract.id, payment_method=AccPaymentMethod.CASH, user_id=None
    )

    assert await _income_txn_count(db_session, contract) == 0
    assert await _b2b_income(db_session, contract) == Decimal("0")


@pytest.mark.asyncio
async def test_anticipos_account_is_liability_current_and_global(
    db_session: AsyncSession, cash_client: B2BClient
):
    """(1) La cuenta 2110 es LIABILITY_CURRENT, global, con saldo positivo permitido.

    El CheckConstraint chk_balance_account_sign exime al pasivo de balance>=0; que
    el saldo sea positivo sin IntegrityError lo confirma implícitamente (el flush
    del deposit habría reventado de lo contrario).
    """
    service = ContractService(db_session)
    contract = await _make_contract(
        db_session, cash_client, total=Decimal("600000"), deposit=Decimal("300000")
    )

    await service.register_deposit(
        contract.id, payment_method=AccPaymentMethod.CASH, user_id=None
    )

    result = await db_session.execute(
        select(BalanceAccount).where(
            BalanceAccount.code == ANTICIPOS_CODE,
            BalanceAccount.school_id.is_(None),
        )
    )
    account = result.scalar_one()
    assert account.account_type == AccountType.LIABILITY_CURRENT
    assert account.school_id is None
    assert account.balance == Decimal("300000.00")


# ===========================================================================
# (4) P&L no inflado por el anticipo (antes de entrega)
# ===========================================================================


@pytest.mark.asyncio
async def test_pnl_income_unchanged_after_deposit_before_delivery(
    db_session: AsyncSession, cash_client: B2BClient
):
    """(4) El income del P&L NO incluye el anticipo antes de la entrega."""
    service = ContractService(db_session)
    contract = await _make_contract(
        db_session, cash_client, total=Decimal("2000000"), deposit=Decimal("800000")
    )

    income_before = await _income_total(db_session)

    await service.register_deposit(
        contract.id, payment_method=AccPaymentMethod.CASH, user_id=None
    )

    income_after = await _income_total(db_session)
    # ni un peso de ingreso devengado por el producto no entregado
    assert income_after == income_before


# ===========================================================================
# (3) Entrega total: ingreso == total, pasivo se cierra, CxC a crédito
# ===========================================================================


@pytest.mark.asyncio
async def test_full_delivery_cash_recognizes_total_and_zeroes_liability(
    db_session: AsyncSession, cash_client: B2BClient
):
    """(3) Entrega total de contado: ingreso devengado == total, 2110 → 0.

    Reconoce ingreso en la fecha de entrega; el pasivo del anticipo se debita de
    vuelta a 0 y solo el saldo de contado entra a caja (el anticipo NO re-entra).
    """
    service = ContractService(db_session)
    T = Decimal("1000000.00")
    D = Decimal("400000.00")
    B = T - D
    contract = await _make_contract(db_session, cash_client, total=T, deposit=D)
    deliver_date = get_colombia_date()

    await service.register_deposit(
        contract.id, payment_method=AccPaymentMethod.CASH, user_id=None
    )
    caja_after_deposit = await _account_balance(db_session, CAJA_MENOR_CODE)
    income_after_deposit = await _income_total(db_session)
    assert income_after_deposit == Decimal("0")  # snapshot antes de entrega

    await service.deliver_contract(
        contract.id,
        delivery_date=deliver_date,
        settlement_method=AccPaymentMethod.CASH,
        user_id=None,
    )

    # ingreso devengado del contrato == total
    assert await _b2b_income(db_session, contract) == T
    assert await _income_total(db_session) - income_after_deposit == T

    # pasivo 2110 cerrado a 0
    assert await _account_balance(db_session, ANTICIPOS_CODE) == Decimal("0.00")

    # solo el saldo de contado entra a caja; el anticipo no re-entra
    assert await _account_balance(db_session, CAJA_MENOR_CODE) - caja_after_deposit == B

    # el INCOME está fechado en la entrega
    result = await db_session.execute(
        select(Transaction.transaction_date).where(
            Transaction.reference_code == contract.contract_number,
            Transaction.type == TransactionType.INCOME,
        ).limit(1)
    )
    assert result.scalar_one() == deliver_date

    assert contract.status == ContractStatus.DELIVERED
    assert contract.delivered_at is not None


@pytest.mark.asyncio
async def test_credit_delivery_creates_receivable_with_b2b_client_and_terms_due_date(
    db_session: AsyncSession, credit_client: B2BClient
):
    """(3) Entrega a crédito: saldo → CxC con b2b_client_id y due_date = entrega + términos.

    due_date debe seguir los payment_terms_days del cliente (30), NO el default
    de 30 días genérico de AR — aquí coinciden a propósito en valor, pero el test
    también afirma que la CxC NO tiene school_id ni client_id (es B2B global).
    """
    service = ContractService(db_session)
    T = Decimal("3000000.00")
    D = Decimal("900000.00")
    B = T - D
    contract = await _make_contract(db_session, credit_client, total=T, deposit=D)
    deliver_date = get_colombia_date()

    await service.register_deposit(
        contract.id, payment_method=AccPaymentMethod.TRANSFER, user_id=None
    )
    banco_after_deposit = await _account_balance(db_session, BANCO_CODE)
    caja_after_deposit = await _account_balance(db_session, CAJA_MENOR_CODE)

    await service.deliver_contract(
        contract.id, delivery_date=deliver_date, user_id=None
    )

    # CxC del saldo con b2b_client_id poblado, sin school/client, due_date correcta
    result = await db_session.execute(
        select(AccountsReceivable).where(
            AccountsReceivable.b2b_client_id == credit_client.id,
            AccountsReceivable.is_paid == False,  # noqa: E712
        )
    )
    ar = result.scalar_one()
    assert ar.amount == B
    assert ar.b2b_client_id == credit_client.id
    assert ar.school_id is None
    assert ar.client_id is None
    assert ar.invoice_date == deliver_date
    assert ar.due_date == deliver_date + timedelta(days=credit_client.payment_terms_days)

    # nada de caja entra en la entrega a crédito (el saldo es CxC, no efectivo)
    assert await _account_balance(db_session, BANCO_CODE) == banco_after_deposit
    assert await _account_balance(db_session, CAJA_MENOR_CODE) == caja_after_deposit

    # ingreso devengado == total igualmente (anticipo aplicado + saldo a crédito)
    assert await _b2b_income(db_session, contract) == T

    # pasivo cerrado tras aplicar el anticipo a la entrega
    assert await _account_balance(db_session, ANTICIPOS_CODE) == Decimal("0.00")


@pytest.mark.asyncio
async def test_full_delivery_debits_liability_back_to_pre_deposit_level(
    db_session: AsyncSession, cash_client: B2BClient
):
    """(3) El pasivo 2110 vuelve EXACTAMENTE a su nivel previo al anticipo.

    Aísla el efecto neto sobre 2110 a través de todo el ciclo (deposit + delivery):
    debe ser 0 — el anticipo entró y salió del pasivo sin residuo.
    """
    service = ContractService(db_session)
    T = Decimal("1200000.00")
    D = Decimal("500000.00")
    contract = await _make_contract(db_session, cash_client, total=T, deposit=D)

    liab_before_anything = await _account_balance(db_session, ANTICIPOS_CODE)

    await service.register_deposit(
        contract.id, payment_method=AccPaymentMethod.CASH, user_id=None
    )
    assert await _account_balance(db_session, ANTICIPOS_CODE) - liab_before_anything == D

    await service.deliver_contract(
        contract.id, settlement_method=AccPaymentMethod.CASH, user_id=None
    )

    # efecto neto sobre el pasivo a lo largo del ciclo completo == 0
    assert await _account_balance(db_session, ANTICIPOS_CODE) == liab_before_anything


# ---------------------------------------------------------------------------
# Idempotencia de las operaciones de dinero (regresión).
#
# `_assert_transition` admite el mismo-estado como noop (correcto para
# `update_status`). Las operaciones de dinero NO pueden reutilizar esa
# semántica: re-ejecutarlas sobre un contrato ya en el estado destino
# duplicaría asientos (doble anticipo, doble ingreso, doble reversa). Estas
# pruebas fijan que las precondiciones estrictas lo impiden Y que el dinero
# no se duplica.
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_double_deposit_blocked_keeps_liability_single(
    db_session: AsyncSession, cash_client: B2BClient
):
    service = ContractService(db_session)
    D = Decimal("300000.00")
    contract = await _make_contract(
        db_session, cash_client, total=Decimal("1000000.00"), deposit=D
    )
    base = await _account_balance(db_session, ANTICIPOS_CODE)
    await service.register_deposit(
        contract.id, payment_method=AccPaymentMethod.CASH, user_id=None
    )
    assert await _account_balance(db_session, ANTICIPOS_CODE) - base == D

    with pytest.raises(ValueError, match="[Nn]o se puede registrar"):
        await service.register_deposit(
            contract.id, payment_method=AccPaymentMethod.CASH, user_id=None
        )
    # El segundo anticipo NO se posteó: el pasivo sigue en +D, no +2D.
    assert await _account_balance(db_session, ANTICIPOS_CODE) - base == D


@pytest.mark.asyncio
async def test_deliver_twice_blocked_keeps_income_and_receivable_single(
    db_session: AsyncSession, credit_client: B2BClient
):
    service = ContractService(db_session)
    T = Decimal("1000000.00")
    contract = await _make_contract(
        db_session, credit_client, total=T, deposit=Decimal("300000.00")
    )
    await service.register_deposit(
        contract.id, payment_method=AccPaymentMethod.CASH, user_id=None
    )
    await service.deliver_contract(
        contract.id, settlement_method=AccPaymentMethod.CREDIT, user_id=None
    )
    income_once = await _b2b_income(db_session, contract)
    ar_once = (
        await db_session.execute(
            select(func.count())
            .select_from(AccountsReceivable)
            .where(AccountsReceivable.b2b_client_id == credit_client.id)
        )
    ).scalar_one()
    assert income_once == T

    with pytest.raises(ValueError, match="[Nn]o se puede entregar"):
        await service.deliver_contract(
            contract.id, settlement_method=AccPaymentMethod.CREDIT, user_id=None
        )
    # Ni el ingreso devengado ni la CxC se duplicaron.
    assert await _b2b_income(db_session, contract) == income_once
    ar_after = (
        await db_session.execute(
            select(func.count())
            .select_from(AccountsReceivable)
            .where(AccountsReceivable.b2b_client_id == credit_client.id)
        )
    ).scalar_one()
    assert ar_after == ar_once


@pytest.mark.asyncio
async def test_cancel_twice_blocked_no_double_reversal(
    db_session: AsyncSession, cash_client: B2BClient
):
    service = ContractService(db_session)
    D = Decimal("400000.00")
    contract = await _make_contract(
        db_session, cash_client, total=Decimal("900000.00"), deposit=D
    )
    base = await _account_balance(db_session, ANTICIPOS_CODE)
    await service.register_deposit(
        contract.id, payment_method=AccPaymentMethod.CASH, user_id=None
    )
    # Cancela con reembolso: reversa ambas patas → 2110 vuelve a la base.
    await service.cancel_contract(contract.id, retain_deposit=False, user_id=None)
    assert await _account_balance(db_session, ANTICIPOS_CODE) == base

    with pytest.raises(ValueError, match="[Nn]o se puede cancelar"):
        await service.cancel_contract(contract.id, retain_deposit=False, user_id=None)
    # La segunda cancelación NO reversó de nuevo (no dejó el pasivo en -D).
    assert await _account_balance(db_session, ANTICIPOS_CODE) == base
