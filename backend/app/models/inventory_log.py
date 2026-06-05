"""
Inventory Log Model - Audit trail for inventory movements

Similar to BalanceEntry for accounting, this tracks all inventory changes
for full auditability and historical tracking.
"""
from datetime import datetime, date
from sqlalchemy import String, Boolean, DateTime, Date, Integer, ForeignKey, Text, Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
import uuid
import enum

from app.db.base import Base
from app.utils.timezone import get_colombia_now_naive


class InventoryMovementType(str, enum.Enum):
    """Types of inventory movements"""
    SALE = "sale"                    # Direct sale (stock out)
    SALE_CANCEL = "sale_cancel"      # Sale cancellation (stock in)
    ORDER_RESERVE = "order_reserve"  # Reserved for order (stock out)
    ORDER_CANCEL = "order_cancel"    # Order cancellation (stock in)
    ORDER_DELIVER = "order_deliver"  # Order delivery (stock out, if not reserved)
    CHANGE_RETURN = "change_return"  # Return from sale change (stock in)
    CHANGE_OUT = "change_out"        # Exchange for sale change (stock out)
    ADJUSTMENT_IN = "adjustment_in"  # Positive adjustment (stock in)
    ADJUSTMENT_OUT = "adjustment_out"  # Negative adjustment (stock out)
    PURCHASE = "purchase"            # Stock purchase (stock in)
    INITIAL = "initial"              # Initial stock setup


class InventoryLog(Base):
    """
    Inventory movement log - records all stock changes for audit purposes.

    Similar to BalanceEntry for accounting, each inventory change creates
    a log entry with the delta and resulting balance.
    """
    __tablename__ = "inventory_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )

    inventory_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("inventory.id", ondelete="CASCADE"),
        nullable=True,
        index=True
    )

    # Multi-tenant support
    school_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("schools.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )

    # Movement details
    movement_type: Mapped[InventoryMovementType] = mapped_column(
        SQLEnum(
            InventoryMovementType,
            name="inventory_movement_type_enum",
            values_callable=lambda x: [e.value for e in x]
        ),
        nullable=False,
        index=True
    )
    movement_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        index=True
    )

    # Quantity change and resulting balance
    quantity_delta: Mapped[int] = mapped_column(
        Integer,
        nullable=False
    )  # Positive for stock in, negative for stock out
    quantity_after: Mapped[int] = mapped_column(
        Integer,
        nullable=False
    )  # Stock level after this movement

    # Description and reference
    description: Mapped[str] = mapped_column(
        String(500),
        nullable=False
    )
    reference: Mapped[str | None] = mapped_column(
        String(100)
    )  # e.g. CARACAS-001-VNT-2026-0001, CARACAS-001-ENC-2026-0001

    # Source document references
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
    sale_change_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("sale_changes.id", ondelete="SET NULL"),
        nullable=True
    )

    # Audit fields
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=get_colombia_now_naive,
        nullable=False
    )

    # Relationships
    inventory: Mapped["Inventory | None"] = relationship(
        "Inventory",
        foreign_keys=[inventory_id]
    )
    school: Mapped["School | None"] = relationship(
        "School",
        foreign_keys=[school_id]
    )
    sale: Mapped["Sale | None"] = relationship(
        "Sale",
        foreign_keys=[sale_id]
    )
    order: Mapped["Order | None"] = relationship(
        "Order",
        foreign_keys=[order_id]
    )
    sale_change: Mapped["SaleChange | None"] = relationship(
        "SaleChange",
        foreign_keys=[sale_change_id]
    )
    created_by_user: Mapped["User | None"] = relationship(
        "User",
        foreign_keys=[created_by]
    )

    def __repr__(self) -> str:
        return f"<InventoryLog(type='{self.movement_type.value}', delta={self.quantity_delta}, after={self.quantity_after})>"


class FailedInventoryLog(Base):
    """Dead-letter queue para inventory_logs que no pudieron persistirse.

    Cuando `InventoryLogService.create_log_with_retry` agota sus 3 intentos
    contra la tabla principal, escribe aqui para preservar la auditoria.
    Un cron worker (`inventory_log_dlq_worker`) reprocesa periodicamente
    los rows con `resolved=false`. Al re-insertar exitosamente, marca
    `resolved=true` y guarda el `resolved_log_id` apuntando al InventoryLog
    final.

    `movement_type` se persiste como string (no enum) porque las migraciones
    del enum no necesitan replicarse aqui — la DLQ es transitoria y el
    valor se valida al re-insertar.
    """
    __tablename__ = "failed_inventory_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    inventory_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    school_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    movement_type: Mapped[str] = mapped_column(String(50), nullable=False)
    movement_date: Mapped[date] = mapped_column(Date, nullable=False)
    quantity_delta: Mapped[int] = mapped_column(Integer, nullable=False)
    quantity_after: Mapped[int] = mapped_column(Integer, nullable=False)
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    reference: Mapped[str | None] = mapped_column(String(100))

    sale_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    order_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    sale_change_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)

    original_created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    failed_at: Mapped[datetime] = mapped_column(DateTime, default=get_colombia_now_naive, nullable=False)
    error_message: Mapped[str] = mapped_column(Text, nullable=False)
    retry_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_retry_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    resolved: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    resolved_log_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)

    def __repr__(self) -> str:
        status = "resolved" if self.resolved else "pending"
        return f"<FailedInventoryLog(type='{self.movement_type}', delta={self.quantity_delta}, {status})>"
