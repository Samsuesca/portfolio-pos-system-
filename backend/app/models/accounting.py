"""
Accounting Models - Transactions, Expenses, and Cash Flow
"""
from datetime import datetime, date
from decimal import Decimal
from sqlalchemy import String, Boolean, DateTime, Date, Numeric, Text, ForeignKey, Enum as SQLEnum, CheckConstraint, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
import uuid
import enum

from app.db.base import Base
from app.utils.timezone import get_colombia_now_naive, get_colombia_date


class TransactionType(str, enum.Enum):
    """Types of financial transactions"""
    INCOME = "income"           # Ingresos (ventas, abonos)
    EXPENSE = "expense"         # Gastos (arriendo, servicios, etc.)
    TRANSFER = "transfer"       # Transferencias entre cuentas


class AccPaymentMethod(str, enum.Enum):
    """Payment methods for accounting transactions (extended)"""
    CASH = "cash"               # Efectivo → Caja Menor
    NEQUI = "nequi"             # Nequi → Cuenta Nequi
    TRANSFER = "transfer"       # Transferencia bancaria → Banco
    CARD = "card"               # Tarjeta débito/crédito → Banco
    CREDIT = "credit"           # Crédito (fiado) → CxC
    OTHER = "other"             # Otro


class ExpenseCategory(str, enum.Enum):
    """Categories for expenses (legacy enum - kept for backwards compatibility)"""
    RENT = "rent"                       # Arriendo
    UTILITIES = "utilities"             # Servicios públicos
    PAYROLL = "payroll"                 # Nómina/Salarios
    SUPPLIES = "supplies"               # Insumos/Materiales
    INVENTORY = "inventory"             # Compra de inventario
    TRANSPORT = "transport"             # Transporte
    MAINTENANCE = "maintenance"         # Mantenimiento
    MARKETING = "marketing"             # Publicidad/Marketing
    TAXES = "taxes"                     # Impuestos
    BANK_FEES = "bank_fees"             # Comisiones bancarias
    OTHER = "other"                     # Otros


class ExpenseCategoryModel(Base):
    """
    Expense categories - GLOBAL (not per school).

    Allows users to create, edit, and manage expense categories.
    System categories (is_system=True) cannot be deleted.
    """
    __tablename__ = "expense_categories"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )

    # Category details
    code: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        nullable=False,
        index=True,
        comment="Unique code for the category (e.g., 'rent', 'utilities')"
    )
    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        comment="Display name (e.g., 'Arriendo', 'Servicios Públicos')"
    )
    description: Mapped[str | None] = mapped_column(
        String(255),
        comment="Optional description of the category"
    )
    color: Mapped[str] = mapped_column(
        String(7),
        nullable=False,
        default="#9CA3AF",
        comment="Hex color for UI display (e.g., '#EF4444')"
    )
    icon: Mapped[str | None] = mapped_column(
        String(50),
        comment="Optional icon name (e.g., 'home', 'zap')"
    )

    # Flags
    is_system: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        comment="System categories cannot be deleted"
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
        comment="Soft delete flag"
    )

    # Display order
    display_order: Mapped[int] = mapped_column(
        default=0,
        nullable=False,
        comment="Order in dropdowns/lists"
    )

    # Audit
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=get_colombia_now_naive,
        nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=get_colombia_now_naive,
        onupdate=get_colombia_now_naive,
        nullable=False
    )

    def __repr__(self) -> str:
        return f"<ExpenseCategoryModel({self.code}: {self.name})>"


class Transaction(Base):
    """
    Financial transaction record.

    Every money movement (income or expense) is recorded here.
    Sales automatically create income transactions.
    """
    __tablename__ = "transactions"
    __table_args__ = (
        CheckConstraint('amount > 0', name='chk_transaction_amount_positive'),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    # school_id is nullable for global transactions
    # NULL = global transaction (business-wide)
    # UUID = school-specific transaction (for reports)
    school_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("schools.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )

    # Transaction details
    type: Mapped[TransactionType] = mapped_column(
        SQLEnum(TransactionType, name="transaction_type_enum"),
        nullable=False,
        index=True
    )
    amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False
    )
    payment_method: Mapped[AccPaymentMethod] = mapped_column(
        SQLEnum(AccPaymentMethod, name="acc_payment_method_enum"),
        nullable=False
    )

    # Description and categorization
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    category: Mapped[str | None] = mapped_column(String(100))  # For expenses
    reference_code: Mapped[str | None] = mapped_column(String(100))  # VNT-2025-0001, etc.

    # Date tracking
    transaction_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)

    # Optional relations to source records
    sale_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("sales.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    order_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("orders.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    expense_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("expenses.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    alteration_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("alterations.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )

    # Balance account integration
    # Links transaction to the balance account it affects (Caja, Banco, etc.)
    balance_account_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("balance_accounts.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    # For TRANSFER type: destination account
    transfer_to_account_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("balance_accounts.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )

    # Audit
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=get_colombia_now_naive,
        nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=get_colombia_now_naive,
        onupdate=get_colombia_now_naive,
        nullable=False
    )

    # Relationships
    school: Mapped["School | None"] = relationship(back_populates="transactions")
    sale: Mapped["Sale | None"] = relationship(back_populates="transactions")
    order: Mapped["Order | None"] = relationship(back_populates="transactions")
    expense: Mapped["Expense | None"] = relationship(back_populates="transaction")
    alteration: Mapped["Alteration | None"] = relationship()
    created_by_user: Mapped["User | None"] = relationship()
    # Balance account relationships
    balance_account: Mapped["BalanceAccount | None"] = relationship(
        foreign_keys=[balance_account_id]
    )
    transfer_to_account: Mapped["BalanceAccount | None"] = relationship(
        foreign_keys=[transfer_to_account_id]
    )

    def __repr__(self) -> str:
        return f"<Transaction({self.type.value}: ${self.amount} on {self.transaction_date})>"


class Expense(Base):
    """
    Expense record for business costs.

    Each expense can have one or more transactions (e.g., partial payments).
    """
    __tablename__ = "expenses"
    __table_args__ = (
        CheckConstraint('amount > 0', name='chk_expense_amount_positive'),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    # school_id is nullable for global expenses
    # NULL = global expense (business-wide, e.g., utilities, rent)
    # UUID = school-specific expense (for reports)
    school_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("schools.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )

    # Expense details
    # Note: category is now a string to support dynamic categories from expense_categories table.
    # The category code references expense_categories.code
    category: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True
    )
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)

    # Payment tracking
    amount_paid: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        default=Decimal("0"),
        nullable=False
    )
    is_paid: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Dates
    expense_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    due_date: Mapped[date | None] = mapped_column(Date)  # For recurring/scheduled expenses

    # Additional info
    vendor: Mapped[str | None] = mapped_column(String(255))  # Proveedor
    receipt_number: Mapped[str | None] = mapped_column(String(100))  # Número de factura
    notes: Mapped[str | None] = mapped_column(Text)

    # Recurring expense config
    is_recurring: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    recurring_period: Mapped[str | None] = mapped_column(String(20))  # monthly, weekly, yearly

    # Link to fixed expense template (if generated from one)
    fixed_expense_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("fixed_expenses.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )

    # Audit
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=get_colombia_now_naive,
        nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=get_colombia_now_naive,
        onupdate=get_colombia_now_naive,
        nullable=False
    )

    # Payment info (filled when expense is paid)
    payment_method: Mapped[str | None] = mapped_column(String(20))  # cash, nequi, transfer, etc
    payment_account_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("balance_accounts.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    paid_at: Mapped[datetime | None] = mapped_column(DateTime)

    # Relationships
    school: Mapped["School | None"] = relationship(back_populates="expenses")
    transaction: Mapped["Transaction | None"] = relationship(
        back_populates="expense",
        uselist=False
    )
    created_by_user: Mapped["User | None"] = relationship()
    payment_account: Mapped["BalanceAccount | None"] = relationship(
        foreign_keys=[payment_account_id]
    )
    fixed_expense_template: Mapped["FixedExpense | None"] = relationship(
        back_populates="generated_expenses"
    )
    adjustments: Mapped[list["ExpenseAdjustment"]] = relationship(
        back_populates="expense",
        cascade="all, delete-orphan",
        order_by="ExpenseAdjustment.adjusted_at.desc()"
    )

    @property
    def balance(self) -> Decimal:
        """Remaining balance to pay"""
        return self.amount - self.amount_paid

    def __repr__(self) -> str:
        return f"<Expense({self.category}: ${self.amount} on {self.expense_date})>"


class DailyCashRegister(Base):
    """
    Daily cash register summary.

    Tracks opening/closing balance and daily totals.
    """
    __tablename__ = "daily_cash_registers"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    # school_id is nullable for global cash register
    # NULL = global register (business-wide, one per day)
    # UUID = school-specific register (optional)
    school_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("schools.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )

    # Date
    register_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)

    # Balances
    opening_balance: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        default=Decimal("0"),
        nullable=False
    )
    closing_balance: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))

    # Daily totals (calculated)
    total_income: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        default=Decimal("0"),
        nullable=False
    )
    total_expenses: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        default=Decimal("0"),
        nullable=False
    )

    # Breakdown by payment method
    cash_income: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        default=Decimal("0"),
        nullable=False
    )
    transfer_income: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        default=Decimal("0"),
        nullable=False
    )
    card_income: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        default=Decimal("0"),
        nullable=False
    )
    credit_sales: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        default=Decimal("0"),
        nullable=False
    )

    # Status
    is_closed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime)
    closed_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )

    notes: Mapped[str | None] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=get_colombia_now_naive,
        nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=get_colombia_now_naive,
        onupdate=get_colombia_now_naive,
        nullable=False
    )

    # Relationships
    school: Mapped["School | None"] = relationship(back_populates="cash_registers")

    @property
    def net_flow(self) -> Decimal:
        """Net cash flow for the day"""
        return self.total_income - self.total_expenses

    def __repr__(self) -> str:
        return f"<DailyCashRegister({self.register_date}: Income=${self.total_income}, Expenses=${self.total_expenses})>"


# ============================================
# Balance General Models (Assets, Liabilities, Equity)
# ============================================

class AccountType(str, enum.Enum):
    """Types of accounting accounts"""
    # Activos
    ASSET_CURRENT = "asset_current"           # Activo Corriente (efectivo, cuentas por cobrar, inventario)
    ASSET_FIXED = "asset_fixed"               # Activo Fijo (equipos, muebles, maquinaria)
    ASSET_INTANGIBLE = "asset_intangible"     # Activo Intangible (software, licencias, patentes, marcas)
    ASSET_OTHER = "asset_other"               # Otros Activos

    # Pasivos
    LIABILITY_CURRENT = "liability_current"   # Pasivo Corriente (cuentas por pagar, deudas corto plazo)
    LIABILITY_LONG = "liability_long"         # Pasivo a Largo Plazo (préstamos, hipotecas)
    LIABILITY_OTHER = "liability_other"       # Otros Pasivos

    # Patrimonio
    EQUITY_CAPITAL = "equity_capital"         # Capital
    EQUITY_RETAINED = "equity_retained"       # Utilidades Retenidas
    EQUITY_OTHER = "equity_other"             # Otro Patrimonio


class BalanceAccount(Base):
    """
    Balance sheet accounts - For tracking assets, liabilities, and equity.

    This allows manual entry of balance sheet items that aren't tracked
    automatically by sales/expenses (like equipment, loans, capital).
    """
    __tablename__ = "balance_accounts"
    __table_args__ = (
        CheckConstraint("balance >= 0 OR account_type::text LIKE 'LIABILITY%' OR account_type::text LIKE 'EQUITY%'",
                        name='chk_balance_account_sign'),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    # school_id is nullable for global accounts
    # NULL = global account (business-wide, e.g., Caja, Banco)
    # UUID = school-specific account (optional)
    school_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("schools.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )

    # Account details
    account_type: Mapped[AccountType] = mapped_column(
        SQLEnum(AccountType, name="account_type_enum"),
        nullable=False,
        index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    code: Mapped[str | None] = mapped_column(String(50))  # Optional accounting code

    # Current balance
    balance: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        default=Decimal("0"),
        nullable=False
    )

    # For depreciable assets
    original_value: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    accumulated_depreciation: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    useful_life_years: Mapped[int | None] = mapped_column()

    # For debts/loans
    interest_rate: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))  # Annual %
    due_date: Mapped[date | None] = mapped_column(Date)
    creditor: Mapped[str | None] = mapped_column(String(255))  # Who we owe

    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Audit
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=get_colombia_now_naive,
        nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=get_colombia_now_naive,
        onupdate=get_colombia_now_naive,
        nullable=False
    )

    # Relationships
    school: Mapped["School | None"] = relationship()
    entries: Mapped[list["BalanceEntry"]] = relationship(
        back_populates="account",
        cascade="all, delete-orphan"
    )

    @property
    def net_value(self) -> Decimal:
        """Net value (for depreciable assets: original - depreciation)"""
        if self.original_value and self.accumulated_depreciation:
            return self.original_value - self.accumulated_depreciation
        return self.balance

    def __repr__(self) -> str:
        return f"<BalanceAccount({self.account_type.value}: {self.name} = ${self.balance})>"


class BalanceEntry(Base):
    """
    Journal entries for balance accounts - tracks changes over time.

    Every change to a balance account creates an entry for audit trail.
    """
    __tablename__ = "balance_entries"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("balance_accounts.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    # school_id is nullable for global entries
    # NULL = global entry (business-wide)
    # UUID = school-specific entry (optional)
    school_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("schools.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )

    # Entry details
    entry_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)  # Positive or negative
    balance_after: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)  # Balance after this entry

    description: Mapped[str] = mapped_column(String(500), nullable=False)
    reference: Mapped[str | None] = mapped_column(String(100))  # Invoice #, receipt, etc.

    # Audit
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=get_colombia_now_naive,
        nullable=False
    )

    # Relationships
    account: Mapped["BalanceAccount"] = relationship(back_populates="entries")
    school: Mapped["School | None"] = relationship()

    def __repr__(self) -> str:
        return f"<BalanceEntry({self.entry_date}: ${self.amount} -> Balance: ${self.balance_after})>"


class AccountsReceivable(Base):
    """
    Accounts receivable - Money owed TO the business by clients.

    Tracked separately from sales to allow more detailed management.
    """
    __tablename__ = "accounts_receivable"
    __table_args__ = (
        CheckConstraint('amount > 0', name='chk_ar_amount_positive'),
        CheckConstraint('amount_paid >= 0', name='chk_ar_paid_positive'),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    # school_id is nullable for global receivables
    # NULL = global receivable (business-wide)
    # UUID = school-specific receivable (from client of that school)
    school_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("schools.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    client_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("clients.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    sale_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("sales.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    order_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("orders.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )

    # Receivable details
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    amount_paid: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        default=Decimal("0"),
        nullable=False
    )

    description: Mapped[str] = mapped_column(String(500), nullable=False)
    due_date: Mapped[date | None] = mapped_column(Date)
    invoice_date: Mapped[date] = mapped_column(Date, nullable=False)

    # Status
    is_paid: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_overdue: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    notes: Mapped[str | None] = mapped_column(Text)

    # Audit
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=get_colombia_now_naive,
        nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=get_colombia_now_naive,
        onupdate=get_colombia_now_naive,
        nullable=False
    )

    # Relationships
    school: Mapped["School | None"] = relationship()
    client: Mapped["Client | None"] = relationship()
    sale: Mapped["Sale | None"] = relationship()
    order: Mapped["Order | None"] = relationship()

    @property
    def balance(self) -> Decimal:
        """Remaining balance to collect"""
        return self.amount - self.amount_paid

    def __repr__(self) -> str:
        return f"<AccountsReceivable(${self.amount} - Paid: ${self.amount_paid})>"


class AdjustmentReason(str, enum.Enum):
    """Reasons for expense adjustments"""
    AMOUNT_CORRECTION = "amount_correction"       # Corrección de monto
    ACCOUNT_CORRECTION = "account_correction"     # Corrección de cuenta contable
    BOTH_CORRECTION = "both_correction"           # Corrección de monto y cuenta
    ERROR_REVERSAL = "error_reversal"             # Reversión completa por error
    PARTIAL_REFUND = "partial_refund"             # Reembolso parcial


class ExpenseAdjustment(Base):
    """
    Expense adjustment record for rollbacks and corrections.

    Tracks changes to paid expenses including:
    - Amount corrections (partial or full)
    - Account corrections (moving payment between accounts)
    - Complete reversals (undoing the entire payment)
    - Partial refunds

    Each adjustment creates compensatory BalanceEntries to maintain
    accounting integrity.
    """
    __tablename__ = "expense_adjustments"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    expense_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("expenses.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    # Adjustment details
    reason: Mapped[AdjustmentReason] = mapped_column(
        SQLEnum(
            AdjustmentReason,
            name="adjustment_reason_enum",
            values_callable=lambda x: [e.value for e in x],
            create_constraint=False
        ),
        nullable=False
    )
    description: Mapped[str] = mapped_column(String(500), nullable=False)

    # Previous values (before adjustment)
    previous_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    previous_amount_paid: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    previous_payment_method: Mapped[str | None] = mapped_column(String(20))
    previous_payment_account_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("balance_accounts.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )

    # New values (after adjustment)
    new_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    new_amount_paid: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    new_payment_method: Mapped[str | None] = mapped_column(String(20))
    new_payment_account_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("balance_accounts.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )

    # Delta (net change in payment)
    adjustment_delta: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
        comment="Net change in amount_paid (positive = refund to account, negative = additional payment)"
    )

    # Balance entry references (for audit trail)
    # These entries are the compensatory movements created by this adjustment
    refund_entry_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("balance_entries.id", ondelete="SET NULL"),
        nullable=True,
        comment="Balance entry for refund/reversal (positive entry)",
        index=True
    )
    new_payment_entry_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("balance_entries.id", ondelete="SET NULL"),
        nullable=True,
        comment="Balance entry for new payment (negative entry, account correction)",
        index=True
    )

    # Audit
    adjusted_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    adjusted_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=get_colombia_now_naive,
        nullable=False
    )

    # Relationships
    expense: Mapped["Expense"] = relationship(back_populates="adjustments")
    previous_payment_account: Mapped["BalanceAccount | None"] = relationship(
        foreign_keys=[previous_payment_account_id]
    )
    new_payment_account: Mapped["BalanceAccount | None"] = relationship(
        foreign_keys=[new_payment_account_id]
    )
    refund_entry: Mapped["BalanceEntry | None"] = relationship(
        foreign_keys=[refund_entry_id]
    )
    new_payment_entry: Mapped["BalanceEntry | None"] = relationship(
        foreign_keys=[new_payment_entry_id]
    )
    adjusted_by_user: Mapped["User | None"] = relationship()

    def __repr__(self) -> str:
        return f"<ExpenseAdjustment({self.reason.value}: ${self.previous_amount_paid} -> ${self.new_amount_paid})>"


class AccountsPayable(Base):
    """
    Accounts payable - Money owed BY the business to suppliers/creditors.

    For tracking what the business owes (separate from regular expenses).
    """
    __tablename__ = "accounts_payable"
    __table_args__ = (
        CheckConstraint('amount > 0', name='chk_ap_amount_positive'),
        CheckConstraint('amount_paid >= 0', name='chk_ap_paid_positive'),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    # school_id is nullable for global payables
    # NULL = global payable (business-wide, e.g., suppliers)
    # UUID = school-specific payable (optional)
    school_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("schools.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )

    # Payable details
    vendor: Mapped[str] = mapped_column(String(255), nullable=False)  # Supplier/creditor name
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    amount_paid: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        default=Decimal("0"),
        nullable=False
    )

    description: Mapped[str] = mapped_column(String(500), nullable=False)
    category: Mapped[str | None] = mapped_column(String(100))  # inventory, services, etc.
    invoice_number: Mapped[str | None] = mapped_column(String(100))
    invoice_date: Mapped[date] = mapped_column(Date, nullable=False)
    due_date: Mapped[date | None] = mapped_column(Date)

    # Status
    is_paid: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_overdue: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    notes: Mapped[str | None] = mapped_column(Text)

    # Audit
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=get_colombia_now_naive,
        nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=get_colombia_now_naive,
        onupdate=get_colombia_now_naive,
        nullable=False
    )

    # Relationships
    school: Mapped["School | None"] = relationship()

    @property
    def balance(self) -> Decimal:
        """Remaining balance to pay"""
        return self.amount - self.amount_paid

    def __repr__(self) -> str:
        return f"<AccountsPayable({self.vendor}: ${self.amount} - Paid: ${self.amount_paid})>"


class DebtPaymentStatus(str, enum.Enum):
    """Status of scheduled debt payments"""
    PENDING = "pending"       # Pago pendiente
    PAID = "paid"             # Pagado
    OVERDUE = "overdue"       # Vencido sin pagar
    CANCELLED = "cancelled"   # Cancelado


class DebtPaymentSchedule(Base):
    """
    Scheduled debt payments for financial planning.

    Tracks upcoming debt payments (loan installments, supplier payments, etc.)
    to enable cash flow projections and financial planning.
    """
    __tablename__ = "debt_payment_schedule"
    __table_args__ = (
        CheckConstraint('amount > 0', name='chk_debt_amount_positive'),
        CheckConstraint('recurrence_day IS NULL OR (recurrence_day >= 1 AND recurrence_day <= 28)',
                        name='chk_recurrence_day_valid'),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )

    # Payment details
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    creditor: Mapped[str | None] = mapped_column(String(255))  # Who we owe
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    due_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)

    # Recurrence configuration
    is_recurring: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    recurrence_day: Mapped[int | None] = mapped_column()  # Day of month (1-28) for recurring payments

    # Status tracking
    status: Mapped[DebtPaymentStatus] = mapped_column(
        SQLEnum(
            DebtPaymentStatus,
            name="debt_payment_status_enum",
            values_callable=lambda x: [e.value for e in x],
            create_constraint=False
        ),
        default=DebtPaymentStatus.PENDING,
        nullable=False,
        index=True
    )

    # Payment tracking (when paid)
    paid_date: Mapped[date | None] = mapped_column(Date)
    paid_amount: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    payment_method: Mapped[str | None] = mapped_column(String(20))  # cash, nequi, transfer
    payment_account_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("balance_accounts.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )

    # Link to related records (optional)
    balance_account_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("balance_accounts.id", ondelete="SET NULL"),
        nullable=True,
        comment="Link to liability account if this payment is for a tracked debt",
        index=True
    )
    accounts_payable_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("accounts_payable.id", ondelete="SET NULL"),
        nullable=True,
        comment="Link to accounts payable if applicable",
        index=True
    )

    # Category for grouping in reports
    category: Mapped[str | None] = mapped_column(String(100))  # loan, supplier, taxes, etc.

    notes: Mapped[str | None] = mapped_column(Text)

    # Audit
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=get_colombia_now_naive,
        nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=get_colombia_now_naive,
        onupdate=get_colombia_now_naive,
        nullable=False
    )

    # Relationships
    payment_account: Mapped["BalanceAccount | None"] = relationship(
        foreign_keys=[payment_account_id]
    )
    balance_account: Mapped["BalanceAccount | None"] = relationship(
        foreign_keys=[balance_account_id]
    )
    accounts_payable: Mapped["AccountsPayable | None"] = relationship()
    created_by_user: Mapped["User | None"] = relationship()

    @property
    def is_overdue(self) -> bool:
        """Check if payment is overdue"""
        return self.status == DebtPaymentStatus.PENDING and self.due_date < get_colombia_date()

    @property
    def days_until_due(self) -> int:
        """Days until due date (negative if overdue)"""
        return (self.due_date - get_colombia_date()).days

    def __repr__(self) -> str:
        return f"<DebtPaymentSchedule({self.description}: ${self.amount} due {self.due_date})>"


class CajaMenorConfig(Base):
    """
    Configuration for Caja Menor auto-close behavior.

    Singleton table (only one active row). Controls:
    - base_amount: Amount to leave in Caja Menor after auto-close
    - auto_close_enabled: Whether automatic closing is enabled (future use)
    - auto_close_time: Time of day for auto-close in HH:MM format (future use)
    """
    __tablename__ = "caja_menor_config"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    base_amount: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        nullable=False,
        default=Decimal("400000")
    )
    auto_close_enabled: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False
    )
    auto_close_time: Mapped[str | None] = mapped_column(
        String(5),
        nullable=True
    )
    last_auto_close_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True
    )
    updated_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=get_colombia_now_naive,
        nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=get_colombia_now_naive,
        onupdate=get_colombia_now_naive,
        nullable=False
    )

    # Relationships
    updated_by_user: Mapped["User | None"] = relationship()

    def __repr__(self) -> str:
        return f"<CajaMenorConfig(base={self.base_amount}, auto={self.auto_close_enabled})>"


class FinancialSnapshot(Base):
    """
    Saved snapshots of financial statements (ER or BG).

    Allows viewing historical evolution by saving the full JSON response.
    """
    __tablename__ = "financial_snapshots"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )

    snapshot_type: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        index=True,
        comment="Type: 'balance_sheet' or 'income_statement'"
    )

    snapshot_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        index=True,
        comment="The as_of_date (BG) or period_end (ER)"
    )

    period_start: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
        comment="Period start date (ER only)"
    )

    period_end: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
        comment="Period end date (ER only)"
    )

    data: Mapped[dict] = mapped_column(
        JSON,
        nullable=False,
        comment="Full financial statement response as JSON"
    )

    notes: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
        comment="Optional user notes"
    )

    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=True,
        index=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=get_colombia_now_naive,
        nullable=False
    )

    # Relationships
    creator: Mapped["User | None"] = relationship(foreign_keys=[created_by])

    def __repr__(self) -> str:
        return f"<FinancialSnapshot(type={self.snapshot_type}, date={self.snapshot_date})>"
