"""
School (Tenant) Models
"""
from datetime import datetime
from sqlalchemy import String, Boolean, DateTime, Text, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
import uuid

from app.db.base import Base
from app.utils.timezone import get_colombia_now_naive


class School(Base):
    """Schools/Institutions (Multi-tenant entities)"""
    __tablename__ = "schools"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    code: Mapped[str] = mapped_column(String(20), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    logo_url: Mapped[str | None] = mapped_column(String(500))
    primary_color: Mapped[str | None] = mapped_column(String(7))  # #003366
    secondary_color: Mapped[str | None] = mapped_column(String(7))  # #FFD700

    # Contact information
    address: Mapped[str | None] = mapped_column(Text)
    phone: Mapped[str | None] = mapped_column(String(20))
    email: Mapped[str | None] = mapped_column(String(255))

    # Configuration (JSON field for flexible settings)
    settings: Mapped[dict | None] = mapped_column(
        JSONB,
        default=dict,
        nullable=False,
        server_default="{}"
    )
    # Example settings:
    # {
    #     "currency": "COP",
    #     "tax_rate": 19,
    #     "commission_per_garment": 5000,
    #     "allow_credit_sales": true,
    #     "max_credit_days": 30
    # }

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Display order for web portal (lower = first)
    display_order: Mapped[int] = mapped_column(Integer, default=100, nullable=False)

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
    user_roles: Mapped[list["UserSchoolRole"]] = relationship(
        back_populates="school",
        cascade="all, delete-orphan"
    )
    garment_types: Mapped[list["GarmentType"]] = relationship(
        back_populates="school",
        cascade="all, delete-orphan"
    )
    products: Mapped[list["Product"]] = relationship(
        back_populates="school",
        cascade="all, delete-orphan"
    )
    clients: Mapped[list["Client"]] = relationship(
        back_populates="school",
        cascade="all, delete-orphan"
    )
    sales: Mapped[list["Sale"]] = relationship(
        back_populates="school",
        cascade="all, delete-orphan"
    )
    orders: Mapped[list["Order"]] = relationship(
        back_populates="school",
        cascade="all, delete-orphan"
    )
    contacts: Mapped[list["Contact"]] = relationship(
        back_populates="school",
        cascade="all, delete-orphan"
    )

    # Accounting relationships
    transactions: Mapped[list["Transaction"]] = relationship(
        back_populates="school",
        cascade="all, delete-orphan"
    )
    expenses: Mapped[list["Expense"]] = relationship(
        back_populates="school",
        cascade="all, delete-orphan"
    )
    cash_registers: Mapped[list["DailyCashRegister"]] = relationship(
        back_populates="school",
        cascade="all, delete-orphan"
    )

    # Custom roles for this school
    custom_roles: Mapped[list["CustomRole"]] = relationship(
        back_populates="school",
        cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<School(code='{self.code}', name='{self.name}')>"
