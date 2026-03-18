"""
Delivery Zone Model - Zonas de envío con tarifas
"""
from datetime import datetime
from decimal import Decimal
from sqlalchemy import String, DateTime, Numeric, Integer, Text, Boolean
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
import uuid

from app.db.base import Base
from app.utils.timezone import get_colombia_now_naive


class DeliveryZone(Base):
    """Zonas de envío para domicilios"""
    __tablename__ = "delivery_zones"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )

    # Nombre de la zona (ej: "Zona Norte", "Centro", "Chapinero")
    name: Mapped[str] = mapped_column(String(100), nullable=False)

    # Descripción con barrios incluidos, referencias, etc.
    description: Mapped[str | None] = mapped_column(Text)

    # Tarifa de envío para esta zona
    delivery_fee: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        default=0,
        nullable=False
    )

    # Tiempo estimado de entrega en días hábiles
    estimated_days: Mapped[int] = mapped_column(
        Integer,
        default=1,
        nullable=False
    )

    # Si la zona está activa para selección
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False
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

    def __repr__(self) -> str:
        return f"<DeliveryZone(name='{self.name}', fee={self.delivery_fee})>"
