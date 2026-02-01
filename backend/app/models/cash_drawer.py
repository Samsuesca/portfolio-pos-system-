"""
Cash Drawer Access Control Models

Also used as a generic approval code system for operations
that require supervisor authorization (liquidations, balance adjustments, etc.)
"""
from datetime import datetime
from sqlalchemy import String, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
import uuid

from app.db.base import Base
from app.utils.timezone import get_colombia_now_naive


class DrawerAccessCode(Base):
    """
    Access code for cash drawer opening and other operations requiring approval.

    Used when a user needs authorization for sensitive operations:
    - cash_drawer: Open the physical cash drawer
    - liquidation: Liquidate caja menor above max_amount
    - balance_adjustment: Adjust account balance above max_amount
    """
    __tablename__ = "drawer_access_codes"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    code: Mapped[str] = mapped_column(String(6), nullable=False, index=True)
    requested_by_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    operation_type: Mapped[str | None] = mapped_column(String(50), default="cash_drawer")
    metadata_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=get_colombia_now_naive,
        nullable=False
    )

    # Relationships
    requested_by: Mapped["User"] = relationship()

    def __repr__(self) -> str:
        return f"<DrawerAccessCode(code='{self.code}', requested_by_id='{self.requested_by_id}')>"

    @property
    def is_expired(self) -> bool:
        """Check if the code has expired"""
        return get_colombia_now_naive() > self.expires_at

    @property
    def is_used(self) -> bool:
        """Check if the code has been used"""
        return self.used_at is not None

    @property
    def is_valid(self) -> bool:
        """Check if the code is still valid (not expired and not used)"""
        return not self.is_expired and not self.is_used


# Import to resolve forward references
from app.models.user import User
