"""
Client Models

Clients are GLOBAL - they can purchase from multiple schools.
Authentication is only required for web portal clients (client_type='web').
"""
from datetime import datetime
from sqlalchemy import String, Boolean, DateTime, Text, ForeignKey, UniqueConstraint, Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
import uuid
import enum

from app.db.base import Base
from app.utils.timezone import get_colombia_now_naive


class ClientType(str, enum.Enum):
    """Client type - determines authentication requirements"""
    REGULAR = "regular"  # Created by staff, no auth required
    WEB = "web"  # Self-registered via web portal, requires auth


class NotificationPreference(str, enum.Enum):
    """
    Client notification channel preference.

    AUTO: Default - use available channels (email if has email, whatsapp if has phone)
    EMAIL: Only email notifications
    WHATSAPP: Only WhatsApp notifications
    BOTH: Always send to both channels
    NONE: No notifications (opt-out)
    """
    AUTO = "auto"
    EMAIL = "email"
    WHATSAPP = "whatsapp"
    BOTH = "both"
    NONE = "none"


class Client(Base):
    """
    Global customer base (not tied to a single school).

    Client types:
    - REGULAR: Created by staff/sellers at point of sale, no authentication
    - WEB: Self-registered through web portal, requires email verification and password

    Note: Sales can also be made without a client (anonymous/hot sales).
    """
    __tablename__ = "clients"
    __table_args__ = (
        UniqueConstraint('code', name='uq_client_code'),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )

    # school_id is now optional (nullable) - kept for backwards compatibility
    # New clients don't need school_id, use client_students for student-school relationships
    school_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("schools.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )

    code: Mapped[str] = mapped_column(String(20), nullable=False)  # Auto-generated: CLI-0001
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(20))
    email: Mapped[str | None] = mapped_column(String(255), index=True)
    address: Mapped[str | None] = mapped_column(Text)

    # Legacy student information (kept for backwards compatibility)
    # New student info goes to client_students table
    student_name: Mapped[str | None] = mapped_column(String(255))
    student_grade: Mapped[str | None] = mapped_column(String(50))  # 3ro Primaria, 10mo

    # Client type and web authentication fields
    client_type: Mapped[ClientType] = mapped_column(
        SQLEnum(
            ClientType,
            name="client_type_enum",
            values_callable=lambda obj: [e.value for e in obj]
        ),
        default=ClientType.REGULAR,
        nullable=False
    )

    # Web authentication fields (only used when client_type='web')
    password_hash: Mapped[str | None] = mapped_column(String(255))
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    verification_token: Mapped[str | None] = mapped_column(String(255))
    verification_token_expires: Mapped[datetime | None] = mapped_column(DateTime)
    last_login: Mapped[datetime | None] = mapped_column(DateTime)

    notes: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Welcome email tracking (sent on first transaction)
    welcome_email_sent: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    welcome_email_sent_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # Notification preferences (for multi-channel: email + WhatsApp)
    notification_preference: Mapped[NotificationPreference] = mapped_column(
        SQLEnum(
            NotificationPreference,
            name="notification_preference_enum",
            values_callable=lambda obj: [e.value for e in obj]
        ),
        default=NotificationPreference.AUTO,
        nullable=False
    )
    whatsapp_opted_in: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=get_colombia_now_naive, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=get_colombia_now_naive,
        onupdate=get_colombia_now_naive,
        nullable=False
    )

    # Relationships
    school: Mapped["School | None"] = relationship(back_populates="clients")
    sales: Mapped[list["Sale"]] = relationship(back_populates="client")
    orders: Mapped[list["Order"]] = relationship(back_populates="client")
    students: Mapped[list["ClientStudent"]] = relationship(
        back_populates="client",
        cascade="all, delete-orphan"
    )
    contacts: Mapped[list["Contact"]] = relationship(back_populates="client")

    def __repr__(self) -> str:
        return f"<Client(code='{self.code}', name='{self.name}', type='{self.client_type}')>"

    @property
    def is_web_client(self) -> bool:
        """Check if this is a web portal client"""
        return self.client_type == ClientType.WEB

    @property
    def can_login(self) -> bool:
        """Check if client can login to web portal (WEB or REGULAR with password)"""
        return self.is_verified and self.password_hash is not None


class ClientStudent(Base):
    """
    Student-School relationship for a client.

    A client can have multiple students across different schools.
    Example: A parent with children in different schools.
    """
    __tablename__ = "client_students"
    __table_args__ = (
        UniqueConstraint('client_id', 'school_id', 'student_name', name='uq_client_school_student'),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    client_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("clients.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    school_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("schools.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    student_name: Mapped[str] = mapped_column(String(255), nullable=False)
    student_grade: Mapped[str | None] = mapped_column(String(50))  # 3ro Primaria, 10mo
    student_section: Mapped[str | None] = mapped_column(String(50))  # A, B, C
    notes: Mapped[str | None] = mapped_column(Text)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=get_colombia_now_naive, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=get_colombia_now_naive,
        onupdate=get_colombia_now_naive,
        nullable=False
    )

    # Relationships
    client: Mapped["Client"] = relationship(back_populates="students")
    school: Mapped["School"] = relationship()

    def __repr__(self) -> str:
        return f"<ClientStudent(client_id='{self.client_id}', student='{self.student_name}')>"
