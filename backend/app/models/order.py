"""
Custom Orders Models (Encargos)
"""
from datetime import datetime, date
from sqlalchemy import String, DateTime, Date, Numeric, Integer, Text, ForeignKey, UniqueConstraint, CheckConstraint, Enum as SQLEnum, Computed, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
import uuid
import enum

from app.db.base import Base
from app.models.sale import SaleSource, ChangeType, ChangeStatus  # Reuse enums
from app.utils.timezone import get_colombia_now_naive


class OrderStatus(str, enum.Enum):
    """Order status"""
    PENDING = "pending"
    IN_PRODUCTION = "in_production"
    READY = "ready"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"


class OrderItemStatus(str, enum.Enum):
    """Individual order item status - allows independent tracking per item"""
    PENDING = "pending"
    IN_PRODUCTION = "in_production"
    READY = "ready"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"


class DeliveryType(str, enum.Enum):
    """Tipo de entrega del pedido"""
    PICKUP = "pickup"      # Retiro en tienda
    DELIVERY = "delivery"  # Domicilio


class PaymentProofStatus(str, enum.Enum):
    """Estado del comprobante de pago"""
    PENDING = "pending"      # Pendiente de revisión
    APPROVED = "approved"    # Aprobado/Verificado
    REJECTED = "rejected"    # Rechazado


class Order(Base):
    """Custom orders with personalized measurements"""
    __tablename__ = "orders"
    __table_args__ = (
        UniqueConstraint('school_id', 'code', name='uq_school_order_code'),
        CheckConstraint('total > 0', name='chk_order_total_positive'),
        CheckConstraint('paid_amount >= 0', name='chk_order_paid_positive'),
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

    code: Mapped[str] = mapped_column(String(30), nullable=False)  # Auto-generated: ENC-2024-0001
    client_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("clients.id", ondelete="RESTRICT"),
        nullable=False
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=True  # Allow NULL for web portal orders
    )

    order_date: Mapped[datetime] = mapped_column(DateTime, default=get_colombia_now_naive, nullable=False)
    delivery_date: Mapped[date | None] = mapped_column(Date)
    expected_delivery_days: Mapped[int] = mapped_column(Integer, default=7, nullable=False)

    subtotal: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    tax: Mapped[float] = mapped_column(Numeric(10, 2), default=0, nullable=False)
    total: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    paid_amount: Mapped[float] = mapped_column(Numeric(10, 2), default=0, nullable=False)
    # balance computed automatically as (total - paid_amount)
    balance: Mapped[float] = mapped_column(
        Numeric(10, 2),
        Computed("total - paid_amount"),
        nullable=False
    )

    # Cash change tracking (only for cash payments)
    amount_received: Mapped[float | None] = mapped_column(
        Numeric(10, 2), nullable=True,
        comment="Physical amount received from customer (cash only)"
    )
    change_given: Mapped[float | None] = mapped_column(
        Numeric(10, 2), nullable=True,
        comment="Change returned to customer (cash only)"
    )

    status: Mapped[OrderStatus] = mapped_column(
        SQLEnum(OrderStatus, name="order_status_enum"),
        default=OrderStatus.PENDING,
        nullable=False
    )

    # Source/origin of the order (who/where created it) - uses values (lowercase in DB)
    source: Mapped[SaleSource] = mapped_column(
        SQLEnum(SaleSource, name="sale_source_enum", create_type=False, values_callable=lambda x: [e.value for e in x]),
        default=SaleSource.DESKTOP_APP,
        nullable=False
    )

    # Custom measurements (for Yombers, tailored garments, etc.)
    custom_measurements: Mapped[dict | None] = mapped_column(JSONB)
    # Example:
    # {
    #     "delantero": 40,
    #     "trasero": 42,
    #     "espalda": 35,
    #     "cintura": 28,
    #     "largo": 75
    # }

    notes: Mapped[str | None] = mapped_column(Text)

    # Payment proof for web orders (manual verification)
    payment_proof_url: Mapped[str | None] = mapped_column(String(500))
    payment_proof_status: Mapped[PaymentProofStatus | None] = mapped_column(
        SQLEnum(PaymentProofStatus, name="payment_proof_status_enum", values_callable=lambda x: [e.value for e in x]),
        nullable=True  # NULL si no hay comprobante subido
    )
    payment_notes: Mapped[str | None] = mapped_column(Text)  # Client notes about payment

    # Delivery information
    delivery_type: Mapped[DeliveryType] = mapped_column(
        SQLEnum(DeliveryType, name="delivery_type_enum", values_callable=lambda x: [e.value for e in x]),
        default=DeliveryType.PICKUP,
        nullable=False
    )

    # Delivery address (solo para domicilios)
    delivery_address: Mapped[str | None] = mapped_column(String(300))  # Dirección completa
    delivery_neighborhood: Mapped[str | None] = mapped_column(String(100))  # Barrio
    delivery_city: Mapped[str | None] = mapped_column(String(100))  # Ciudad
    delivery_references: Mapped[str | None] = mapped_column(Text)  # Indicaciones adicionales

    # Zona de envío y costo
    delivery_zone_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("delivery_zones.id", ondelete="SET NULL"),
        nullable=True
    )
    delivery_fee: Mapped[float] = mapped_column(Numeric(10, 2), default=0, nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=get_colombia_now_naive, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=get_colombia_now_naive,
        onupdate=get_colombia_now_naive,
        nullable=False
    )

    # Relationships
    school: Mapped["School"] = relationship(back_populates="orders")
    client: Mapped["Client"] = relationship(back_populates="orders")
    user: Mapped["User"] = relationship()
    items: Mapped[list["OrderItem"]] = relationship(
        back_populates="order",
        cascade="all, delete-orphan"
    )
    transactions: Mapped[list["Transaction"]] = relationship(
        back_populates="order",
        cascade="all, delete-orphan"
    )
    changes: Mapped[list["OrderChange"]] = relationship(
        back_populates="order",
        cascade="all, delete-orphan"
    )
    delivery_zone: Mapped["DeliveryZone | None"] = relationship()

    def __repr__(self) -> str:
        return f"<Order(code='{self.code}', total={self.total}, status='{self.status}')>"


class OrderItem(Base):
    """Detail of products per order (encargos personalizados)"""
    __tablename__ = "order_items"
    __table_args__ = (
        CheckConstraint('quantity > 0', name='chk_order_item_quantity_positive'),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("orders.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    school_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("schools.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    # For school products - garment_type_id references garment_types
    garment_type_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("garment_types.id", ondelete="RESTRICT"),
        nullable=True,  # Nullable because global products use global_garment_type_id
        index=True
    )
    # For global products - global_garment_type_id references global_garment_types
    global_garment_type_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("global_garment_types.id", ondelete="RESTRICT"),
        nullable=True,
        index=True
    )
    # product_id is optional - only set when order is fulfilled from inventory
    product_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("products.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    # For global products (shared inventory)
    global_product_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("global_products.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    is_global_product: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    quantity: Mapped[int] = mapped_column(nullable=False)
    unit_price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    subtotal: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)

    # Custom order specifications
    size: Mapped[str | None] = mapped_column(String(10))
    color: Mapped[str | None] = mapped_column(String(50))
    gender: Mapped[str | None] = mapped_column(String(10))  # unisex, male, female
    custom_measurements: Mapped[dict | None] = mapped_column(JSONB)
    embroidery_text: Mapped[str | None] = mapped_column(String(100))
    notes: Mapped[str | None] = mapped_column(Text)

    # Individual item status - allows independent tracking per item
    item_status: Mapped[OrderItemStatus] = mapped_column(
        SQLEnum(OrderItemStatus, name="order_item_status_enum", create_type=False, values_callable=lambda x: [e.value for e in x]),
        default=OrderItemStatus.PENDING,
        nullable=False,
        index=True
    )
    status_updated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # Stock reservation tracking - for "pisar" (reserve) functionality
    reserved_from_stock: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    quantity_reserved: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Relationships
    order: Mapped["Order"] = relationship(back_populates="items")
    garment_type: Mapped["GarmentType | None"] = relationship()
    global_garment_type: Mapped["GlobalGarmentType | None"] = relationship()
    product: Mapped["Product | None"] = relationship(back_populates="order_items")
    global_product: Mapped["GlobalProduct | None"] = relationship()
    changes_as_original: Mapped[list["OrderChange"]] = relationship(
        back_populates="original_item",
        foreign_keys="OrderChange.original_item_id"
    )

    def __repr__(self) -> str:
        return f"<OrderItem(order_id='{self.order_id}', product_id='{self.product_id}', quantity={self.quantity})>"


class OrderChange(Base):
    """Product changes and returns for orders (encargos)"""
    __tablename__ = "order_changes"
    __table_args__ = (
        CheckConstraint('returned_quantity > 0', name='chk_order_change_returned_qty_positive'),
        CheckConstraint('new_quantity >= 0', name='chk_order_change_new_qty_positive'),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("orders.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    original_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("order_items.id", ondelete="RESTRICT"),
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
        SQLEnum(ChangeType, name="change_type_enum", create_type=False, values_callable=lambda x: [e.value for e in x]),
        nullable=False
    )
    change_date: Mapped[datetime] = mapped_column(DateTime, default=get_colombia_now_naive, nullable=False)

    # Original product returned
    returned_quantity: Mapped[int] = mapped_column(nullable=False)

    # New product (if applicable, None for pure returns)
    new_product_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("products.id", ondelete="RESTRICT")
    )
    new_global_product_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("global_products.id", ondelete="RESTRICT")
    )
    is_new_global_product: Mapped[bool] = mapped_column(default=False, nullable=False)

    new_quantity: Mapped[int] = mapped_column(default=0, nullable=False)
    new_unit_price: Mapped[float | None] = mapped_column(Numeric(10, 2))

    # Order-specific: new item specifications
    new_size: Mapped[str | None] = mapped_column(String(10))
    new_color: Mapped[str | None] = mapped_column(String(50))
    new_custom_measurements: Mapped[dict | None] = mapped_column(JSONB)
    new_embroidery_text: Mapped[str | None] = mapped_column(String(100))

    # Financial adjustment
    price_adjustment: Mapped[float] = mapped_column(
        Numeric(10, 2),
        default=0,
        nullable=False
    )  # Positive = customer pays more, Negative = refund

    # Status and notes
    status: Mapped[ChangeStatus] = mapped_column(
        SQLEnum(ChangeStatus, name="change_status_enum", create_type=False, values_callable=lambda x: [e.value for e in x]),
        default=ChangeStatus.PENDING,
        nullable=False
    )
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    rejection_reason: Mapped[str | None] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=get_colombia_now_naive, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=get_colombia_now_naive,
        onupdate=get_colombia_now_naive,
        nullable=False
    )

    # Relationships
    order: Mapped["Order"] = relationship(back_populates="changes")
    original_item: Mapped["OrderItem"] = relationship(
        back_populates="changes_as_original",
        foreign_keys=[original_item_id]
    )
    new_product: Mapped["Product | None"] = relationship()
    new_global_product: Mapped["GlobalProduct | None"] = relationship()
    user: Mapped["User"] = relationship()

    def __repr__(self) -> str:
        return f"<OrderChange(order_id='{self.order_id}', type='{self.change_type}', status='{self.status}')>"
