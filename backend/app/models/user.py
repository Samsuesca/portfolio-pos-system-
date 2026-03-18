"""
User and Authentication Models
"""
from datetime import datetime
from sqlalchemy import String, Boolean, DateTime, ForeignKey, Enum as SQLEnum, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.telegram_subscription import TelegramAlertSubscription
import uuid
import enum

from app.db.base import Base
from app.utils.timezone import get_colombia_now_naive


class UserRole(str, enum.Enum):
    """
    User roles in the system (hierarchical, highest to lowest)

    Permissions by role:
    - OWNER: Full access + user management + school settings
    - ADMIN: Full business data (sales, inventory, accounting, reports)
    - SELLER: Create/read sales, read inventory, manage clients/orders
    - VIEWER: Read-only access to sales, inventory, clients

    Note: DEVELOPER access is controlled via is_superuser flag.
    Superusers bypass all role checks and can access/modify anything.
    """
    OWNER = "owner"        # Propietario - full access + user mgmt
    ADMIN = "admin"        # Administrador - business data access
    SELLER = "seller"      # Vendedor - sales, clients, orders
    VIEWER = "viewer"      # Solo lectura - read only


class User(Base):
    """System users (sellers, administrators, etc.)"""
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str | None] = mapped_column(String(255))

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_superuser: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

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
    last_login: Mapped[datetime | None] = mapped_column(DateTime)

    # Telegram integration
    telegram_chat_id: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Relationships
    telegram_subscriptions: Mapped[list["TelegramAlertSubscription"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )
    school_roles: Mapped[list["UserSchoolRole"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<User(username='{self.username}', email='{self.email}')>"


class UserSchoolRole(Base):
    """
    Many-to-many relationship: users can have roles in multiple schools.

    Users can have either:
    - A system role (role field): viewer, seller, admin, owner
    - A custom role (custom_role_id): school-specific custom role

    Permission overrides can grant or revoke specific permissions on top of the role.
    """
    __tablename__ = "user_school_roles"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False
    )
    school_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("schools.id", ondelete="CASCADE"),
        nullable=False
    )

    # System role (viewer, seller, admin, owner) - can be NULL if using custom_role_id
    role: Mapped[UserRole | None] = mapped_column(
        SQLEnum(UserRole, name="user_role_enum"),
        nullable=True
    )

    # Custom role reference - can be NULL if using system role
    custom_role_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("custom_roles.id", ondelete="SET NULL"),
        nullable=True
    )

    # Permission overrides: {"grant": ["perm.code"], "revoke": ["perm.code"]}
    permission_overrides: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    # Whether this is the user's primary school
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=get_colombia_now_naive,
        nullable=False
    )

    # Relationships
    user: Mapped["User"] = relationship(back_populates="school_roles")
    school: Mapped["School"] = relationship(back_populates="user_roles")
    custom_role: Mapped["CustomRole"] = relationship()

    __table_args__ = (
        # At least one of role or custom_role_id must be set
        CheckConstraint(
            '(role IS NOT NULL) OR (custom_role_id IS NOT NULL)',
            name='ck_user_school_role_has_role'
        ),
    )

    def __repr__(self) -> str:
        return f"<UserSchoolRole(user_id='{self.user_id}', school_id='{self.school_id}', role='{self.role}')>"


class EmailVerificationToken(Base):
    """Token for email change verification"""
    __tablename__ = "email_verification_tokens"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False
    )
    new_email: Mapped[str] = mapped_column(String(255), nullable=False)
    token: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=get_colombia_now_naive,
        nullable=False
    )

    # Relationships
    user: Mapped["User"] = relationship()

    def __repr__(self) -> str:
        return f"<EmailVerificationToken(user_id='{self.user_id}', new_email='{self.new_email}')>"


# Import to resolve forward references
from app.models.permission import CustomRole
