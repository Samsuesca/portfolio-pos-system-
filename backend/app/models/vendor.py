"""
Vendor Models - Normalized vendor/supplier catalog
"""
from datetime import datetime
from sqlalchemy import String, Boolean, DateTime, Text, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
import uuid
import enum

from app.db.base import Base
from app.utils.timezone import get_colombia_now_naive


class VendorType(str, enum.Enum):
    PERSON = "person"
    BUSINESS = "business"
    INTERNAL = "internal"


class Vendor(Base):
    __tablename__ = "vendors"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    normalized_name: Mapped[str] = mapped_column(
        String(255), nullable=False, unique=True, index=True
    )

    type: Mapped[VendorType] = mapped_column(
        SQLEnum(
            VendorType,
            values_callable=lambda obj: [e.value for e in obj],
            name="vendor_type_enum",
            create_constraint=False,
            native_enum=False,
        ),
        default=VendorType.PERSON,
        nullable=False
    )

    phone: Mapped[str | None] = mapped_column(String(50))
    email: Mapped[str | None] = mapped_column(String(255))
    notes: Mapped[str | None] = mapped_column(Text)

    is_system: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

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
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=get_colombia_now_naive,
        onupdate=get_colombia_now_naive,
        nullable=False
    )

    def __repr__(self) -> str:
        return f"<Vendor(name='{self.name}', type='{self.type}')>"
