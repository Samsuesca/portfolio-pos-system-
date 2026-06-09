"""
Unit tests de la contabilidad del ciclo de vida del contrato B2B (Fase B3).

Fija las invariantes contables del SPEC (I1–I12) ejercitando ContractService
directamente sobre ``db_session`` (Postgres de test). El anticipo es PASIVO
(2110), no ingreso; el ingreso se reconoce SOLO en la entrega; la partida
permanece balanceada.

Helpers de medición:
- ``_cash_total`` suma los saldos de las cuentas líquidas (1101/1102/1103/1104).
- ``_liability_balance`` lee el saldo de 2110.
- ``_pnl`` agrega income/expense de ``transactions`` excluyendo ``receivables``
  (realización de CxC, no ingreso devengado) — espeja el tratamiento de ventas.
"""
from datetime import timedelta
from decimal import Decimal
from uuid import uuid4

import pytest
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.accounting import (
    AccPaymentMethod,
    AccountsReceivable,
    BalanceAccount,
    Transaction,
    TransactionType,
)
from app.models.b2b import (
    B2BClient,
    B2BSegment,
    Contract,
    ContractStatus,
    ContractMilestone,
    MilestoneStatus,
)
from app.services.contract import ContractService
from app.services.contract.accounting import ANTICIPOS_CODE
from app.utils.timezone import get_colombia_date


LIQUID_CODES = ("1101", "1102", "1103", "1104")


# ---------------------------------------------------------------------------
# Fixtures / helpers
# ---------------------------------------------------------------------------


@pytest.fixture
async def b2b_cash_client(db_session: AsyncSession) -> B2BClient:
    """Cliente B2B de CONTADO (payment_terms_days = 0)."""
    record = B2BClient(
        id=uuid4(),
        legal_name="Contado Corp SAS",
        tax_id=f"900{uuid4().hex[:6]}",
        segment=B2BSegment.CORPORATE,
        payment_terms_days=0,
    )
    db_session.add(record)
    await db_session.flush()
    return record


@pytest.fixture
async def b2b_credit_client(db_session: AsyncSession) -> B2BClient:
    """Cliente B2B a CRÉDITO (payment_terms_days = 45)."""
    record = B2BClient(
        id=uuid4(),
        legal_name="Crédito Corp SAS",
        tax_id=f"900{uuid4().hex[:6]}",
        segment=B2BSegment.CORPORATE,
        payment_terms_days=45,
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
    has_milestones: bool = False,
) -> Contract:
    contract = Contract(
        id=uuid4(),
        b2b_client_id=client.id,
        contract_number=f"CTR-TEST-{uuid4().hex[:6]}",
        status=ContractStatus.PENDING_DEPOSIT,
        total=total,
        deposit_amount=deposit,
        balance_amount=total - deposit,
        has_milestones=has_milestones,
    )
    db_session.add(contract)
    await db_session.flush()
    return contract


async def _cash_total(db_session: AsyncSession) -> Decimal:
    result = await db_session.execute(
        select(func.coalesce(func.sum(BalanceAccount.balance), 0)).where(
            BalanceAccount.school_id.is_(None),
            BalanceAccount.code.in_(LIQUID_CODES),
        )
    )
    return Decimal(str(result.scalar_one()))


async def _liability_balance(db_session: AsyncSession) -> Decimal:
    result = await db_session.execute(
        select(BalanceAccount.balance).where(
            BalanceAccount.school_id.is_(None),
            BalanceAccount.code == ANTICIPOS_CODE,
        )
    )
    value = result.scalar_one_or_none()
    return Decimal(str(value)) if value is not None else Decimal("0")


async def _pnl(db_session: AsyncSession) -> dict[str, Decimal]:
    """Income/expense devengado: excluye category='receivables' (realización CxC)."""
    income = await db_session.execute(
        select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            Transaction.type == TransactionType.INCOME,
            func.coalesce(Transaction.category, "") != "receivables",
        )
    )
    expense = await db_session.execute(
        select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            Transaction.type == TransactionType.EXPENSE,
        )
    )
    return {
        "income": Decimal(str(income.scalar_one())),
        "expense": Decimal(str(expense.scalar_one())),
    }


async def _b2b_income(db_session: AsyncSession, contract: Contract) -> Decimal:
    result = await db_session.execute(
        select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            Transaction.type == TransactionType.INCOME,
            Transaction.reference_code == contract.contract_number,
            Transaction.category == "b2b",
        )
    )
    return Decimal(str(result.scalar_one()))


async def _txn_count(
    db_session: AsyncSession, contract: Contract, ttype: TransactionType
) -> int:
    result = await db_session.execute(
        select(func.count(Transaction.id)).where(
            Transaction.type == ttype,
            Transaction.reference_code == contract.contract_number,
        )
    )
    return int(result.scalar_one())


# ---------------------------------------------------------------------------
# I1 / I2 / I5 — Anticipo: pasivo == efectivo, sin ingreso
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_deposit_creates_liability_not_income(
    db_session: AsyncSession, b2b_cash_client: B2BClient
):
    service = ContractService(db_session)
    contract = await _make_contract(
        db_session, b2b_cash_client, total=Decimal("1000000"), deposit=Decimal("400000")
    )
    D = Decimal("400000.00")

    cash_before = await _cash_total(db_session)
    liab_before = await _liability_balance(db_session)
    pnl_before = await _pnl(db_session)

    await service.register_deposit(
        contract.id, payment_method=AccPaymentMethod.CASH, user_id=None
    )

    cash_after = await _cash_total(db_session)
    liab_after = await _liability_balance(db_session)
    pnl_after = await _pnl(db_session)

    # I1: caja y pasivo suben el mismo monto (partida balanceada)
    assert cash_after - cash_before == D
    assert liab_after - liab_before == D
    assert (cash_after - cash_before) == (liab_after - liab_before)

    # I1: el anticipo NO es ingreso → 0 transacciones INCOME por el contrato
    assert await _txn_count(db_session, contract, TransactionType.INCOME) == 0

    # I5: P&L no inflado
    assert pnl_after["income"] == pnl_before["income"]
    assert pnl_after["expense"] == pnl_before["expense"]

    # estado actualizado
    assert contract.status == ContractStatus.IN_PRODUCTION
    assert contract.deposit_received_at is not None


@pytest.mark.asyncio
async def test_anticipos_account_is_liability_current_global(
    db_session: AsyncSession, b2b_cash_client: B2BClient
):
    service = ContractService(db_session)
    contract = await _make_contract(
        db_session, b2b_cash_client, total=Decimal("500000"), deposit=Decimal("250000")
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
    from app.models.accounting import AccountType

    # I2: pasivo corriente, global, con saldo positivo sin violar el sign-constraint
    assert account.account_type == AccountType.LIABILITY_CURRENT
    assert account.code == ANTICIPOS_CODE
    assert account.school_id is None
    assert account.balance == Decimal("250000.00")


# ---------------------------------------------------------------------------
# I3 — Entrega total contado: ingreso == total, pasivo se cierra
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_full_delivery_cash_recognizes_total_income_and_closes_liability(
    db_session: AsyncSession, b2b_cash_client: B2BClient
):
    service = ContractService(db_session)
    T = Decimal("1000000")
    D = Decimal("400000")
    B = T - D
    contract = await _make_contract(
        db_session, b2b_cash_client, total=T, deposit=D
    )
    deliver_date = get_colombia_date()

    await service.register_deposit(
        contract.id, payment_method=AccPaymentMethod.CASH, user_id=None
    )

    cash_after_deposit = await _cash_total(db_session)
    liab_after_deposit = await _liability_balance(db_session)
    pnl_after_deposit = await _pnl(db_session)
    assert pnl_after_deposit["income"] == Decimal("0")  # snapshot antes de entrega

    await service.deliver_contract(
        contract.id,
        delivery_date=deliver_date,
        settlement_method=AccPaymentMethod.CASH,
        user_id=None,
    )

    # I3: ingreso b2b reconocido == total (D vía a1 CREDIT + B vía a2 contado)
    assert await _b2b_income(db_session, contract) == Decimal("1000000.00")

    # pasivo cerrado: baja D respecto al post-depósito → 0
    liab_after_delivery = await _liability_balance(db_session)
    assert liab_after_delivery - liab_after_deposit == -D
    assert liab_after_delivery == Decimal("0.00")

    # solo entra el saldo de contado; el anticipo NO re-entra
    cash_after_delivery = await _cash_total(db_session)
    assert cash_after_delivery - cash_after_deposit == B

    # P&L total reconocido en la entrega
    pnl_after_delivery = await _pnl(db_session)
    assert pnl_after_delivery["income"] == T

    # INCOME fechado en la entrega
    result = await db_session.execute(
        select(Transaction.transaction_date).where(
            Transaction.reference_code == contract.contract_number,
            Transaction.type == TransactionType.INCOME,
        ).limit(1)
    )
    assert result.scalar_one() == deliver_date

    assert contract.status == ContractStatus.DELIVERED
    assert contract.delivered_at is not None


# ---------------------------------------------------------------------------
# I4 — Entrega a crédito: saldo → CxC con due_date correcta
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_credit_delivery_creates_receivable_with_terms_due_date(
    db_session: AsyncSession, b2b_credit_client: B2BClient
):
    service = ContractService(db_session)
    T = Decimal("2000000")
    D = Decimal("600000")
    B = T - D
    contract = await _make_contract(
        db_session, b2b_credit_client, total=T, deposit=D
    )
    deliver_date = get_colombia_date()

    await service.register_deposit(
        contract.id, payment_method=AccPaymentMethod.TRANSFER, user_id=None
    )
    cash_after_deposit = await _cash_total(db_session)

    await service.deliver_contract(
        contract.id, delivery_date=deliver_date, user_id=None
    )

    # CxC del saldo con b2b_client_id, sin school/client, due_date = entrega + 45
    result = await db_session.execute(
        select(AccountsReceivable).where(
            AccountsReceivable.b2b_client_id == b2b_credit_client.id,
            AccountsReceivable.is_paid == False,  # noqa: E712
        )
    )
    ar = result.scalar_one()
    assert ar.amount == B
    assert ar.school_id is None
    assert ar.client_id is None
    assert ar.invoice_date == deliver_date
    assert ar.due_date == deliver_date + timedelta(days=45)

    # nada de caja entra en la entrega (el saldo es CxC)
    cash_after_delivery = await _cash_total(db_session)
    assert cash_after_delivery - cash_after_deposit == Decimal("0")

    # ingreso devengado == total igualmente
    assert await _b2b_income(db_session, contract) == T


# ---------------------------------------------------------------------------
# I7 — Cobro de saldo: mueve AR → caja, NO re-reconoce ingreso
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_balance_payment_moves_ar_to_cash_without_pnl_double_count(
    db_session: AsyncSession, b2b_credit_client: B2BClient
):
    service = ContractService(db_session)
    T = Decimal("2000000")
    D = Decimal("600000")
    B = T - D
    contract = await _make_contract(
        db_session, b2b_credit_client, total=T, deposit=D
    )

    await service.register_deposit(
        contract.id, payment_method=AccPaymentMethod.TRANSFER, user_id=None
    )
    await service.deliver_contract(contract.id, user_id=None)

    pnl_before = await _pnl(db_session)
    cash_before = await _cash_total(db_session)

    receivable = await service.record_balance_payment(
        contract, amount=B, payment_method=AccPaymentMethod.CASH, user_id=None
    )

    # AR saldada
    assert receivable.amount_paid == B
    assert receivable.is_paid is True

    # caja sube por el cobro
    cash_after = await _cash_total(db_session)
    assert cash_after - cash_before == B

    # P&L devengado NO sube (cobro categorizado 'receivables', excluido del P&L)
    pnl_after = await _pnl(db_session)
    assert pnl_after["income"] == pnl_before["income"]


# ---------------------------------------------------------------------------
# I8 / I9 — Cancelación
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_cancel_refund_reverses_both_legs(
    db_session: AsyncSession, b2b_cash_client: B2BClient
):
    service = ContractService(db_session)
    D = Decimal("400000")
    contract = await _make_contract(
        db_session, b2b_cash_client, total=Decimal("1000000"), deposit=D
    )

    await service.register_deposit(
        contract.id, payment_method=AccPaymentMethod.CASH, user_id=None
    )
    cash_after_deposit = await _cash_total(db_session)
    liab_after_deposit = await _liability_balance(db_session)
    pnl_after_deposit = await _pnl(db_session)

    await service.cancel_contract(contract.id, retain_deposit=False, user_id=None)

    # I8: ambas patas revertidas (caja y pasivo bajan D)
    assert await _cash_total(db_session) - cash_after_deposit == -D
    assert await _liability_balance(db_session) - liab_after_deposit == -D
    # P&L sin cambios (el anticipo nunca fue ingreso)
    pnl_after_cancel = await _pnl(db_session)
    assert pnl_after_cancel["income"] == pnl_after_deposit["income"]
    assert contract.status == ContractStatus.CANCELLED


@pytest.mark.asyncio
async def test_cancel_retain_deposit_realizes_income(
    db_session: AsyncSession, b2b_cash_client: B2BClient
):
    service = ContractService(db_session)
    D = Decimal("400000")
    contract = await _make_contract(
        db_session, b2b_cash_client, total=Decimal("1000000"), deposit=D
    )

    await service.register_deposit(
        contract.id, payment_method=AccPaymentMethod.CASH, user_id=None
    )
    cash_after_deposit = await _cash_total(db_session)
    liab_after_deposit = await _liability_balance(db_session)

    await service.cancel_contract(contract.id, retain_deposit=True, user_id=None)

    # I9: pasivo baja D y se reconoce ingreso por penalidad
    assert await _liability_balance(db_session) - liab_after_deposit == -D
    penalty = await db_session.execute(
        select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            Transaction.type == TransactionType.INCOME,
            Transaction.category == "b2b_penalty",
            Transaction.reference_code == contract.contract_number,
        )
    )
    assert Decimal(str(penalty.scalar_one())) == D
    # la caja conserva el efectivo del anticipo
    assert await _cash_total(db_session) - cash_after_deposit == Decimal("0")
    assert contract.status == ContractStatus.CANCELLED


@pytest.mark.asyncio
async def test_cancel_pending_deposit_no_entries(
    db_session: AsyncSession, b2b_cash_client: B2BClient
):
    service = ContractService(db_session)
    contract = await _make_contract(
        db_session, b2b_cash_client, total=Decimal("500000"), deposit=Decimal("250000")
    )
    cash_before = await _cash_total(db_session)
    liab_before = await _liability_balance(db_session)

    await service.cancel_contract(contract.id, retain_deposit=False, user_id=None)

    assert await _cash_total(db_session) == cash_before
    assert await _liability_balance(db_session) == liab_before
    assert contract.status == ContractStatus.CANCELLED


# ---------------------------------------------------------------------------
# I6 — Hitos: prorrateo suma exacto
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_milestones_prorate_deposit_to_exact_cents(
    db_session: AsyncSession, b2b_cash_client: B2BClient
):
    service = ContractService(db_session)
    # total con división no exacta para forzar residuo de redondeo
    T = Decimal("1000000")
    D = Decimal("333333")  # prorrateo no exacto
    contract = await _make_contract(
        db_session, b2b_cash_client, total=T, deposit=D, has_milestones=True
    )
    # 3 hitos que suman el total
    amounts = [Decimal("333333"), Decimal("333333"), Decimal("333334")]
    ms_ids = []
    for i, amt in enumerate(amounts, start=1):
        m = ContractMilestone(
            id=uuid4(),
            contract_id=contract.id,
            sequence=i,
            description=f"Hito {i}",
            amount=amt,
            status=MilestoneStatus.PENDING,
        )
        db_session.add(m)
        ms_ids.append(m.id)
    await db_session.flush()

    await service.register_deposit(
        contract.id, payment_method=AccPaymentMethod.CASH, user_id=None
    )
    liab_after_deposit = await _liability_balance(db_session)
    assert liab_after_deposit == D.quantize(Decimal("0.01"))

    for mid in ms_ids:
        await service.deliver_milestone(
            contract.id, mid, settlement_method=AccPaymentMethod.CASH, user_id=None
        )

    # I6: Σ reversas del pasivo == deposit exacto → 2110 vuelve a 0
    assert await _liability_balance(db_session) == Decimal("0.00")

    # Σ ingreso b2b == total
    assert await _b2b_income(db_session, contract) == T.quantize(Decimal("0.01"))

    # todos los hitos entregados, contrato DELIVERED
    result = await db_session.execute(
        select(ContractMilestone).where(ContractMilestone.contract_id == contract.id)
    )
    for m in result.scalars().all():
        assert m.status == MilestoneStatus.DELIVERED
        assert m.delivered_at is not None
    assert contract.status == ContractStatus.DELIVERED


# ---------------------------------------------------------------------------
# COGS (entrega con costo) — opcional gated
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_delivery_with_cogs_records_expense_in_pnl(
    db_session: AsyncSession, b2b_cash_client: B2BClient
):
    service = ContractService(db_session)
    T = Decimal("1000000")
    D = Decimal("400000")
    cogs = Decimal("350000")
    contract = await _make_contract(db_session, b2b_cash_client, total=T, deposit=D)

    await service.register_deposit(
        contract.id, payment_method=AccPaymentMethod.CASH, user_id=None
    )
    cash_after_deposit = await _cash_total(db_session)
    pnl_before = await _pnl(db_session)

    await service.deliver_contract(
        contract.id,
        cogs_amount=cogs,
        settlement_method=AccPaymentMethod.CASH,
        user_id=None,
    )

    pnl_after = await _pnl(db_session)
    # COGS aparece como gasto en el P&L
    assert pnl_after["expense"] - pnl_before["expense"] == cogs
    # COGS NO desembolsa caja (EXPENSE con CREDIT); solo entra el saldo de contado
    assert await _cash_total(db_session) - cash_after_deposit == (T - D)


# ---------------------------------------------------------------------------
# I10 (servicio) — FSM bloquea deliver sobre pending_deposit
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_deliver_on_pending_deposit_raises(
    db_session: AsyncSession, b2b_cash_client: B2BClient
):
    service = ContractService(db_session)
    contract = await _make_contract(
        db_session, b2b_cash_client, total=Decimal("500000"), deposit=Decimal("250000")
    )
    with pytest.raises(ValueError, match="[Nn]o se puede entregar"):
        await service.deliver_contract(contract.id, user_id=None)


@pytest.mark.asyncio
async def test_deposit_on_delivered_raises(
    db_session: AsyncSession, b2b_cash_client: B2BClient
):
    service = ContractService(db_session)
    contract = await _make_contract(
        db_session, b2b_cash_client, total=Decimal("500000"), deposit=Decimal("250000")
    )
    await service.register_deposit(
        contract.id, payment_method=AccPaymentMethod.CASH, user_id=None
    )
    await service.deliver_contract(contract.id, user_id=None)
    with pytest.raises(ValueError, match="[Nn]o se puede registrar"):
        await service.register_deposit(
            contract.id, payment_method=AccPaymentMethod.CASH, user_id=None
        )
