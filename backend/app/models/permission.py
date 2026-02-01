"""
Permission and Role Models for Granular Access Control

This module implements a flexible permission system that allows:
- Granular permissions (e.g., "sales.cancel", "inventory.view_cost")
- Custom roles that can be created per school
- Permission overrides for individual users
"""
from datetime import datetime
from decimal import Decimal
from sqlalchemy import String, Boolean, DateTime, ForeignKey, Integer, Numeric, Text, UniqueConstraint, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
import uuid

from app.db.base import Base
from app.utils.timezone import get_colombia_now_naive


class Permission(Base):
    """
    Catalog of available permissions in the system.

    Permissions follow a category.action pattern:
    - sales.view, sales.create, sales.cancel
    - inventory.view, inventory.view_cost, inventory.adjust
    - users.view, users.invite, users.edit_role
    """
    __tablename__ = "permissions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    code: Mapped[str] = mapped_column(
        String(100),
        unique=True,
        index=True,
        nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    category: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True
    )
    is_sensitive: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=get_colombia_now_naive,
        nullable=False
    )

    def __repr__(self) -> str:
        return f"<Permission(code='{self.code}')>"


class CustomRole(Base):
    """
    Custom roles that can be created per school.

    System roles (viewer, seller, admin, owner) have is_system=True and school_id=NULL.
    School-specific custom roles have is_system=False and a school_id.
    """
    __tablename__ = "custom_roles"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    school_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("schools.id", ondelete="CASCADE"),
        nullable=True,
        index=True
    )
    code: Mapped[str] = mapped_column(String(50), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    color: Mapped[str | None] = mapped_column(String(7))  # Hex color e.g. #10B981
    icon: Mapped[str | None] = mapped_column(String(50))  # Lucide icon name
    priority: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
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

    # Relationships
    school: Mapped["School"] = relationship(back_populates="custom_roles")
    permissions: Mapped[list["RolePermission"]] = relationship(
        back_populates="role",
        cascade="all, delete-orphan"
    )

    __table_args__ = (
        UniqueConstraint('school_id', 'code', name='uq_custom_role_school_code'),
    )

    def __repr__(self) -> str:
        return f"<CustomRole(code='{self.code}', school_id='{self.school_id}')>"


class RolePermission(Base):
    """
    Many-to-many relationship between CustomRole and Permission.

    Includes optional constraints for parameterized permissions:
    - max_discount_percent: Maximum discount a role can apply
    - max_amount: Maximum amount for certain operations (e.g., expense creation)
    - requires_approval: Whether the action requires approval from a higher role
    """
    __tablename__ = "role_permissions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    role_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("custom_roles.id", ondelete="CASCADE"),
        nullable=False
    )
    permission_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("permissions.id", ondelete="CASCADE"),
        nullable=False
    )

    # Optional constraints for parameterized permissions
    max_discount_percent: Mapped[int | None] = mapped_column(Integer)
    max_amount: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    requires_approval: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    max_daily_count: Mapped[int | None] = mapped_column(Integer)

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=get_colombia_now_naive,
        nullable=False
    )

    # Relationships
    role: Mapped["CustomRole"] = relationship(back_populates="permissions")
    permission: Mapped["Permission"] = relationship()

    __table_args__ = (
        UniqueConstraint('role_id', 'permission_id', name='uq_role_permission'),
    )

    def __repr__(self) -> str:
        return f"<RolePermission(role_id='{self.role_id}', permission_id='{self.permission_id}')>"


# Import School here to avoid circular imports
from app.models.school import School
