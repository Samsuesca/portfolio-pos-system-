"""
Contract Accounting Mixin — el corazón de la Fase B3.

Reconoce contablemente el ciclo de vida de un contrato B2B made-to-order
respetando que **el anticipo es un PASIVO (ingreso diferido), no ingreso**,
dentro de una contabilidad GLOBAL de partida balanceada (una caja, una cuenta
de banco). Reutiliza los servicios contables existentes:

- ``BalanceEntryService.create_entry`` para las patas manuales (caja del
  anticipo y pasivo 2110). OJO: ``create_entry`` NO lockea la cuenta, así que
  aquí se lee la cuenta ``with_for_update`` antes de delegar (evita lost-update
  bajo concurrencia, igual que ``apply_transaction_to_balance``).
- ``TransactionService.record`` para reconocer INGRESO (entrega) y COGS. El
  anticipo NUNCA pasa por ``record`` (inflaría el P&L por producto no entregado).

Cuenta de pasivo:
- 2110 "Anticipos de Clientes" (LIABILITY_CURRENT, school_id=NULL).
  ``_get_or_create_anticipos_account`` la crea de forma idempotente (defensivo
  para tests que construyen el schema desde metadata sin correr la migración).

GOTCHA crítico: ``account_type`` se persiste en MAYÚSCULAS
('LIABILITY_CURRENT'); el ``CheckConstraint chk_balance_account_sign`` exime al
pasivo de la regla ``balance >= 0`` (``account_type::text LIKE 'LIABILITY%'``).
SQLAlchemy mapea ``AccountType.LIABILITY_CURRENT`` → 'LIABILITY_CURRENT' solo.
"""
from datetime import date, timedelta
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.accounting import (
    AccountType,
    AccPaymentMethod,
    AccountsReceivable,
    BalanceAccount,
    BalanceEntry,
    Expense,
    ExpenseCategory,
    TransactionType,
)
from app.models.b2b import Contract
from app.services.balance_integration import (
    DEFAULT_ACCOUNTS,
    INCOME_ACCOUNT_MAP,
)
from app.utils.timezone import get_colombia_date


ANTICIPOS_CODE = "2110"
ANTICIPOS_NAME = "Anticipos de Clientes"

_CENT = Decimal("0.01")


def _q(amount: Decimal) -> Decimal:
    """Cuantiza a centavos (2 decimales)."""
    return amount.quantize(_CENT)


class ContractAccountingMixin:
    """Mixin con los asientos contables del ciclo de vida del contrato."""

    db: AsyncSession  # Type hint for IDE support

    # ------------------------------------------------------------------
    # Cuenta de pasivo 2110 (Anticipos de Clientes)
    # ------------------------------------------------------------------

    async def _get_or_create_anticipos_account(
        self,
        created_by: UUID | None = None,
    ) -> BalanceAccount:
        """Get-or-create idempotente de la cuenta global 2110 (pasivo).

        Espeja ``get_or_create_global_accounts``: busca con ``with_for_update``
        y crea si falta. Funciona tanto con la migración de semilla aplicada
        como sin ella (tests con schema desde metadata).
        """
        # Advisory lock transaccional: serializa el get-or-create entre primeros
        # depósitos concurrentes cuando la cuenta aún no existe (el FOR UPDATE no
        # lockea filas inexistentes), evitando insertar 2110 dos veces.
        await self.db.execute(
            select(func.pg_advisory_xact_lock(func.hashtext("b2b_anticipos_2110")))
        )
        result = await self.db.execute(
            select(BalanceAccount)
            .where(
                BalanceAccount.code == ANTICIPOS_CODE,
                BalanceAccount.school_id.is_(None),
                BalanceAccount.is_active == True,  # noqa: E712
            )
            .with_for_update()
            .limit(1)
        )
        account = result.scalar_one_or_none()
        if account:
            return account

        account = BalanceAccount(
            school_id=None,
            account_type=AccountType.LIABILITY_CURRENT,
            name=ANTICIPOS_NAME,
            code=ANTICIPOS_CODE,
            description="Anticipos recibidos de clientes B2B (ingreso diferido)",
            balance=Decimal("0"),
            created_by=created_by,
            is_active=True,
        )
        self.db.add(account)
        await self.db.flush()
        return account

    # ------------------------------------------------------------------
    # Patas manuales (BalanceEntry directo con lock propio)
    # ------------------------------------------------------------------

    async def _post_account_entry(
        self,
        account: BalanceAccount,
        amount: Decimal,
        reference: str,
        description: str,
        entry_date: date,
        created_by: UUID | None = None,
    ) -> BalanceEntry:
        """Crea un BalanceEntry sobre una cuenta ya bloqueada y muta su saldo.

        ``amount`` con signo (positivo aumenta, negativo disminuye). El llamador
        debe haber leído ``account`` con ``with_for_update``.
        """
        new_balance = account.balance + amount
        entry = BalanceEntry(
            account_id=account.id,
            school_id=None,  # contabilidad B2B es global
            entry_date=entry_date,
            amount=amount,
            balance_after=new_balance,
            description=description,
            reference=reference,
            created_by=created_by,
        )
        self.db.add(entry)
        account.balance = new_balance
        await self.db.flush()
        return entry

    async def _get_cash_account_for_method(
        self,
        payment_method: AccPaymentMethod,
        created_by: UUID | None = None,
    ) -> BalanceAccount:
        """Resuelve la cuenta de caja/banco para un método de pago (con lock).

        Usa ``INCOME_ACCOUNT_MAP`` (cash→Caja Menor, nequi→Nequi,
        transfer/card→Banco). Crea las cuentas globales si faltan.
        """
        account_key = INCOME_ACCOUNT_MAP.get(payment_method)
        if account_key is None:
            raise ValueError(
                "El método de pago no afecta una cuenta de caja directamente"
            )
        account_code = DEFAULT_ACCOUNTS[account_key]["code"]

        result = await self.db.execute(
            select(BalanceAccount)
            .where(
                BalanceAccount.code == account_code,
                BalanceAccount.school_id.is_(None),
                BalanceAccount.is_active == True,  # noqa: E712
            )
            .with_for_update()
            .limit(1)
        )
        account = result.scalar_one_or_none()
        if account:
            return account

        # Crea las cuentas globales default y reintenta con lock.
        from app.services.balance_integration import BalanceIntegrationService

        integration = BalanceIntegrationService(self.db)
        await integration.get_or_create_global_accounts(created_by)
        result = await self.db.execute(
            select(BalanceAccount)
            .where(
                BalanceAccount.code == account_code,
                BalanceAccount.school_id.is_(None),
                BalanceAccount.is_active == True,  # noqa: E712
            )
            .with_for_update()
            .limit(1)
        )
        account = result.scalar_one_or_none()
        if not account:
            raise ValueError("No se pudo resolver la cuenta de caja")
        return account

    async def _post_cash_entry(
        self,
        payment_method: AccPaymentMethod,
        amount: Decimal,
        reference: str,
        description: str,
        entry_date: date,
        created_by: UUID | None = None,
    ) -> BalanceEntry:
        """Pata de caja directa (ASSET +/-) sin tocar `transactions` (P&L limpio)."""
        account = await self._get_cash_account_for_method(payment_method, created_by)
        return await self._post_account_entry(
            account, amount, reference, description, entry_date, created_by
        )

    async def _post_liability_entry(
        self,
        amount: Decimal,
        reference: str,
        description: str,
        entry_date: date,
        created_by: UUID | None = None,
    ) -> BalanceEntry:
        """Pata de pasivo sobre 2110 (LIABILITY +/-), con lock propio."""
        account = await self._get_or_create_anticipos_account(created_by)
        return await self._post_account_entry(
            account, amount, reference, description, entry_date, created_by
        )

    # ------------------------------------------------------------------
    # Reconocimiento de ingreso / COGS / CxC (vía servicios existentes)
    # ------------------------------------------------------------------

    async def _recognize_income(
        self,
        amount: Decimal,
        payment_method: AccPaymentMethod,
        reference: str,
        description: str,
        transaction_date: date,
        category: str = "b2b",
        created_by: UUID | None = None,
    ) -> None:
        """Reconoce INGRESO en el P&L vía TransactionService.record.

        - ``payment_method=CREDIT`` → impacta SOLO el P&L (no toca caja); se usa
          para la porción ya cubierta por el anticipo (la caja la mueve la
          reversa del pasivo) y para saldo a crédito.
        - ``payment_method`` no-credit → impacta P&L Y caja (saldo de contado).
        """
        if amount <= Decimal("0"):
            return
        from app.services.accounting.transactions import TransactionService

        txn_service = TransactionService(self.db)
        await txn_service.record(
            type=TransactionType.INCOME,
            amount=_q(amount),
            payment_method=payment_method,
            description=description,
            school_id=None,
            category=category,
            reference_code=reference,
            transaction_date=transaction_date,
            created_by=created_by,
        )

    async def _recognize_cogs(
        self,
        amount: Decimal,
        reference: str,
        description: str,
        expense_date: date,
        created_by: UUID | None = None,
    ) -> None:
        """Reconoce el COGS del lote como gasto en el P&L (sin desembolso de caja).

        Crea un Expense (categoría SUPPLIES) y una Transaction EXPENSE con
        ``payment_method=CREDIT`` para que el costo impacte el P&L sin restar de
        caja — la salida de efectivo fue la compra de insumos previa. Opcional:
        solo se invoca si ``amount > 0``.
        """
        if amount <= Decimal("0"):
            return
        from app.services.accounting.transactions import TransactionService

        expense = Expense(
            school_id=None,
            category=ExpenseCategory.SUPPLIES.value,  # FK → expense_categories.code
            description=description,
            amount=_q(amount),
            expense_date=expense_date,
            created_by=created_by,
        )
        self.db.add(expense)
        await self.db.flush()

        txn_service = TransactionService(self.db)
        await txn_service.record(
            type=TransactionType.EXPENSE,
            amount=_q(amount),
            payment_method=AccPaymentMethod.CREDIT,
            description=description,
            school_id=None,
            category="b2b_cogs",
            reference_code=reference,
            transaction_date=expense_date,
            expense_id=expense.id,
            created_by=created_by,
        )

    async def _create_b2b_receivable(
        self,
        contract: Contract,
        amount: Decimal,
        invoice_date: date,
        due_date: date,
        description: str,
        created_by: UUID | None = None,
    ) -> AccountsReceivable:
        """Crea la CxC del saldo a crédito con ``b2b_client_id`` poblado.

        Se instancia el modelo directo (patrón ``sale/creation.py``) porque el
        schema ``AccountsReceivableCreate`` no expone ``b2b_client_id`` y el
        servicio ``record_payment`` asume ``school_id`` no-nulo.
        """
        receivable = AccountsReceivable(
            school_id=None,
            client_id=None,
            sale_id=None,
            order_id=None,
            b2b_client_id=contract.b2b_client_id,
            amount=_q(amount),
            description=description,
            invoice_date=invoice_date,
            due_date=due_date,
            created_by=created_by,
        )
        self.db.add(receivable)
        await self.db.flush()
        return receivable

    # ------------------------------------------------------------------
    # Cobro del saldo (AR → caja, NO re-reconoce ingreso)
    # ------------------------------------------------------------------

    async def record_balance_payment(
        self,
        contract: Contract,
        amount: Decimal,
        payment_method: AccPaymentMethod,
        receivable_id: UUID | None = None,
        payment_date: date | None = None,
        user_id: UUID | None = None,
    ) -> AccountsReceivable:
        """Registra el cobro del saldo (CxC) de un contrato entregado a crédito.

        Mueve AR → caja. El ingreso del saldo YA se reconoció en la entrega
        (a2), así que se categoriza ``receivables`` (igual que el cobro de CxC
        de ventas a crédito) para NO doble-contar el P&L devengado.

        No reutiliza ``AccountsReceivableService.record_payment`` porque ese
        método exige ``school_id`` no-nulo y la CxC B2B es global.
        """
        amount = _q(amount)
        if amount <= Decimal("0"):
            raise ValueError("El monto del cobro debe ser mayor a 0")

        receivable = await self._resolve_open_receivable(contract, receivable_id)
        if not receivable:
            raise ValueError("No se encontró una cuenta por cobrar pendiente para este contrato")

        new_paid = receivable.amount_paid + amount
        if new_paid > receivable.amount:
            raise ValueError("El pago excede el monto pendiente")

        receivable.amount_paid = new_paid
        receivable.is_paid = new_paid >= receivable.amount

        from app.services.accounting.transactions import TransactionService

        txn_service = TransactionService(self.db)
        await txn_service.record(
            type=TransactionType.INCOME,
            amount=amount,
            payment_method=payment_method,
            description=f"Cobro saldo contrato {contract.contract_number}",
            school_id=None,
            category="receivables",
            reference_code=contract.contract_number,
            transaction_date=payment_date or get_colombia_date(),
            created_by=user_id,
        )
        await self.db.flush()
        return receivable

    async def _resolve_open_receivable(
        self,
        contract: Contract,
        receivable_id: UUID | None,
    ) -> AccountsReceivable | None:
        """Resuelve la CxC objetivo: por id explícito o la abierta del contrato.

        En ambos caminos se lockea la fila (``with_for_update``) para serializar
        cobros concurrentes del mismo saldo. El fallback filtra por
        ``contract_number`` (la CxC lleva el número en su descripción) para NO
        aplicar el cobro a la CxC de OTRO contrato del mismo cliente.
        """
        if receivable_id is not None:
            result = await self.db.execute(
                select(AccountsReceivable)
                .where(
                    AccountsReceivable.id == receivable_id,
                    AccountsReceivable.b2b_client_id == contract.b2b_client_id,
                )
                .with_for_update()
            )
            return result.scalar_one_or_none()

        result = await self.db.execute(
            select(AccountsReceivable)
            .where(
                AccountsReceivable.b2b_client_id == contract.b2b_client_id,
                AccountsReceivable.is_paid == False,  # noqa: E712
                AccountsReceivable.description.like(f"%{contract.contract_number}%"),
            )
            .order_by(AccountsReceivable.invoice_date.asc())
            .limit(1)
            .with_for_update()
        )
        return result.scalar_one_or_none()

    async def _has_open_receivables(self, contract: Contract) -> bool:
        """True si el contrato (vía b2b_client) tiene CxC abiertas con su número."""
        result = await self.db.execute(
            select(AccountsReceivable.id).where(
                AccountsReceivable.b2b_client_id == contract.b2b_client_id,
                AccountsReceivable.is_paid == False,  # noqa: E712
                AccountsReceivable.description.like(f"%{contract.contract_number}%"),
            )
        )
        return result.first() is not None

    async def _outstanding_balance(self, contract: Contract) -> Decimal:
        """Saldo REALMENTE por cobrar = Σ(amount - amount_paid) de las CxC ABIERTAS
        que referencian el número del contrato.

        Es 0 para contratos de contado (el saldo se liquidó en caja en la entrega,
        sin CxC) y para los ya cobrados. NO confundir con ``balance_amount``, que
        es el saldo CONTRACTUAL estático (total - anticipo) y nunca se decrementa.
        El frontend usa esto para decidir si mostrar "Cobrar saldo".
        """
        result = await self.db.execute(
            select(
                func.coalesce(
                    func.sum(AccountsReceivable.amount - AccountsReceivable.amount_paid),
                    0,
                )
            ).where(
                AccountsReceivable.b2b_client_id == contract.b2b_client_id,
                AccountsReceivable.is_paid == False,  # noqa: E712
                AccountsReceivable.description.like(f"%{contract.contract_number}%"),
            )
        )
        return Decimal(str(result.scalar_one()))

    @staticmethod
    def _credit_due_date(invoice_date: date, payment_terms_days: int) -> date:
        """due_date = invoice_date + payment_terms_days (NO el default de 30)."""
        return invoice_date + timedelta(days=payment_terms_days)
