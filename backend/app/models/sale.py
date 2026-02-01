"""
Sales Transaction Models
"""
from datetime import datetime
from sqlalchemy import String, DateTime, Numeric, Text, ForeignKey, UniqueConstraint, CheckConstraint, Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
import uuid
import enum

from app.db.base import Base
from app.utils.timezone import get_colombia_now_naive


class PaymentMethod(str, enum.Enum):
    """Payment methods"""
    CASH = "cash"
    NEQUI = "nequi"
    TRANSFER = "transfer"
    CARD = "card"
    CREDIT = "credit"


class SaleStatus(str, enum.Enum):
    """Sale status"""
    PENDING = "pending"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class SaleSource(str, enum.Enum):
    """Source/origin of the sale"""
    DESKTOP_APP = "desktop_app"  # Desktop POS application (Tauri)
    WEB_PORTAL = "web_portal"    # Web portal (customer self-service)
    API = "api"                  # Direct API integration
    ADMIN_PORTAL = "admin_portal"  # Admin portal (backoffice)


class Sale(Base):
    """
    Sales transactions

    Note: Total = sum of item prices (no tax applied)
    The business model does not require IVA/tax for now
    """
    __tablename__ = "sales"
    __table_args__ = (
        UniqueConstraint('school_id', 'code', name='uq_school_sale_code'),
        CheckConstraint('total > 0', name='chk_sale_total_positive'),
        CheckConstraint('paid_amount >= 0', name='chk_sale_paid_positive'),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    school_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("schools.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    code: Mapped[str] = mapped_column(String(30), nullable=False)  # Auto-generated: VNT-2024-0001
    client_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("clients.id", ondelete="SET NULL")
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False
    )

    sale_date: Mapped[datetime] = mapped_column(DateTime, default=get_colombia_now_naive, nullable=False)
    total: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    paid_amount: Mapped[float] = mapped_column(Numeric(10, 2), default=0, nullable=False)
    payment_method: Mapped[PaymentMethod | None] = mapped_column(
        SQLEnum(PaymentMethod, name="payment_method_enum")
    )

    status: Mapped[SaleStatus] = mapped_column(
        SQLEnum(SaleStatus, name="sale_status_enum"),
        default=SaleStatus.COMPLETED,
        nullable=False
    )

    # Source/origin of the sale (who/where created it) - uses values (lowercase in DB)
    source: Mapped[SaleSource] = mapped_column(
        SQLEnum(SaleSource, name="sale_source_enum", values_callable=lambda x: [e.value for e in x]),
        default=SaleSource.DESKTOP_APP,
        nullable=False
    )

    # Historical sales (migration) - do NOT affect inventory
    is_historical: Mapped[bool] = mapped_column(default=False, nullable=False)

    notes: Mapped[str | None] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=get_colombia_now_naive, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=get_colombia_now_naive,
        onupdate=get_colombia_now_naive,
        nullable=False
    )

    # Relationships
    school: Mapped["School"] = relationship(back_populates="sales")
    client: Mapped["Client | None"] = relationship(back_populates="sales")
    user: Mapped["User"] = relationship()
    items: Mapped[list["SaleItem"]] = relationship(
        back_populates="sale",
        cascade="all, delete-orphan"
    )
    transactions: Mapped[list["Transaction"]] = relationship(
        back_populates="sale",
        cascade="all, delete-orphan"
    )
    payments: Mapped[list["SalePayment"]] = relationship(
        back_populates="sale",
        cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Sale(code='{self.code}', total={self.total}, status='{self.status}')>"


class SaleItem(Base):
    """Detail of products per sale"""
    __tablename__ = "sale_items"
    __table_args__ = (
        CheckConstraint('quantity > 0', name='chk_sale_item_quantity_positive'),
        CheckConstraint('unit_price >= 0', name='chk_sale_item_price_positive'),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    sale_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("sales.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    # For school products
    product_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("products.id", ondelete="RESTRICT"),
        nullable=True,
        index=True
    )
    # For global products (shared inventory)
    global_product_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("global_products.id", ondelete="RESTRICT"),
        nullable=True,
        index=True
    )
    is_global_product: Mapped[bool] = mapped_column(default=False, nullable=False)

    quantity: Mapped[int] = mapped_column(nullable=False)
    unit_price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)  # Price at time of sale
    subtotal: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    discount: Mapped[float] = mapped_column(Numeric(10, 2), default=0, nullable=False)

    # Relationships
    sale: Mapped["Sale"] = relationship(back_populates="items")
    product: Mapped["Product | None"] = relationship(back_populates="sale_items")
    global_product: Mapped["GlobalProduct | None"] = relationship()
    changes_as_original: Mapped[list["SaleChange"]] = relationship(
        back_populates="original_item",
        foreign_keys="SaleChange.original_item_id"
    )

    def __repr__(self) -> str:
        return f"<SaleItem(sale_id='{self.sale_id}', product_id='{self.product_id}', quantity={self.quantity})>"


class ChangeStatus(str, enum.Enum):
    """Change request status"""
    PENDING = "pending"
    PENDING_STOCK = "pending_stock"  # Waiting for stock (has associated order)
    APPROVED = "approved"
    REJECTED = "rejected"


class ChangeType(str, enum.Enum):
    """Type of change"""
    SIZE_CHANGE = "size_change"  # Cambio de talla
    PRODUCT_CHANGE = "product_change"  # Cambio de producto
    RETURN = "return"  # Devolución sin reemplazo
    DEFECT = "defect"  # Cambio por defecto


class SaleChange(Base):
    """Product changes and returns for sales"""
    __tablename__ = "sale_changes"
    __table_args__ = (
        CheckConstraint('returned_quantity > 0', name='chk_change_returned_qty_positive'),
        CheckConstraint('new_quantity >= 0', name='chk_change_new_qty_positive'),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    sale_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("sales.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    original_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("sale_items.id", ondelete="RESTRICT"),
        nullable=False,
        index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False
    )

    # Change details
    change_type: Mapped[ChangeType] = mapped_column(
        SQLEnum(ChangeType, name="change_type_enum", values_callable=lambda x: [e.value for e in x]),
        nullable=False
    )
    change_date: Mapped[datetime] = mapped_column(DateTime, default=get_colombia_now_naive, nullable=False)

    # Original product returned
    returned_quantity: Mapped[int] = mapped_column(nullable=False)

    # New product (if applicable, None for pure returns)
    # For school products
    new_product_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("products.id", ondelete="RESTRICT")
    )
    # For global products (shared inventory)
    new_global_product_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("global_products.id", ondelete="RESTRICT")
    )
    is_new_global_product: Mapped[bool] = mapped_column(default=False, nullable=False)

    new_quantity: Mapped[int] = mapped_column(default=0, nullable=False)
    new_unit_price: Mapped[float | None] = mapped_column(Numeric(10, 2))

    # Financial adjustment
    price_adjustment: Mapped[float] = mapped_column(
        Numeric(10, 2),
        default=0,
        nullable=False
    )  # Positive = customer pays more, Negative = refund

    # Status and notes
    status: Mapped[ChangeStatus] = mapped_column(
        SQLEnum(ChangeStatus, name="change_status_enum", values_callable=lambda x: [e.value for e in x]),
        default=ChangeStatus.PENDING,
        nullable=False
    )
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    rejection_reason: Mapped[str | None] = mapped_column(Text)

    # Associated order (when stock not available, create order for the new product)
    order_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("orders.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )

    created_at: Mapped[datetime] = mapped_column(DateTime, default=get_colombia_now_naive, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=get_colombia_now_naive,
        onupdate=get_colombia_now_naive,
        nullable=False
    )

    # Relationships
    sale: Mapped["Sale"] = relationship()
    original_item: Mapped["SaleItem"] = relationship(
        back_populates="changes_as_original",
        foreign_keys=[original_item_id]
    )
    new_product: Mapped["Product | None"] = relationship()
    new_global_product: Mapped["GlobalProduct | None"] = relationship()
    user: Mapped["User"] = relationship()
    order: Mapped["Order | None"] = relationship(foreign_keys=[order_id])

    def __repr__(self) -> str:
        return f"<SaleChange(sale_id='{self.sale_id}', type='{self.change_type}', status='{self.status}')>"


class SalePayment(Base):
    """
    Individual payment for a sale.
    Allows multiple payment methods per sale (partial payments).
    Example: 50,000 in cash + 30,000 in transfer = 80,000 total sale
    """
    __tablename__ = "sale_payments"
    __table_args__ = (
        CheckConstraint('amount > 0', name='chk_sale_payment_amount_positive'),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    sale_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("sales.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    payment_method: Mapped[PaymentMethod] = mapped_column(
        SQLEnum(PaymentMethod, name="payment_method_enum", create_type=False),
        nullable=False
    )
    notes: Mapped[str | None] = mapped_column(Text)

    # Cash change tracking (only applicable for cash payments)
    amount_received: Mapped[float | None] = mapped_column(
        Numeric(10, 2), nullable=True,
        comment="Physical amount received from customer (cash only)"
    )
    change_given: Mapped[float | None] = mapped_column(
        Numeric(10, 2), nullable=True,
        comment="Change returned to customer (cash only)"
    )

    # Optional link to accounting transaction
    transaction_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("transactions.id", ondelete="SET NULL"),
        nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(DateTime, default=get_colombia_now_naive, nullable=False)

    # Relationships
    sale: Mapped["Sale"] = relationship(back_populates="payments")
    transaction: Mapped["Transaction | None"] = relationship()

    def __repr__(self) -> str:
        return f"<SalePayment(sale_id='{self.sale_id}', amount={self.amount}, method='{self.payment_method}')>"
