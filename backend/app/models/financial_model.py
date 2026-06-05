"""
Financial Model Models - Budget + FinancialProjection
"""
from datetime import datetime, date
from decimal import Decimal
from sqlalchemy import String, DateTime, Date, Numeric, Text, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
import uuid

from app.db.base import Base
from app.utils.timezone import get_colombia_now_naive


class Budget(Base):
    """
    Budget entries for financial planning.

    Stores budgeted amounts by category and period for comparison
    against actual figures.
    """
    __tablename__ = "budgets"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )

    # Period definition
    period_type: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        index=True,
        comment="monthly, quarterly, or annual"
    )
    period_start: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        index=True
    )
    period_end: Mapped[date] = mapped_column(
        Date,
        nullable=False
    )

    # Budget details
    category: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        index=True,
        comment="revenue, or expense category code"
    )
    school_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("schools.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    budgeted_amount: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        nullable=False
    )
    notes: Mapped[str | None] = mapped_column(Text)

    # Audit
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True
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
    school: Mapped["School | None"] = relationship()
    created_by_user: Mapped["User | None"] = relationship()

    def __repr__(self) -> str:
        return f"<Budget({self.category}: ${self.budgeted_amount} for {self.period_start})>"


class FinancialProjection(Base):
    """
    Multi-month financial projection (P&L + cash flow).

    Stores both the inputs (assumptions) and outputs (results) as JSONB
    for flexibility. Each projection is a snapshot in time — to update,
    create a new row.
    """
    __tablename__ = "financial_projections"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    scenario_label: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
        comment="A | B | C | custom",
    )
    months_count: Mapped[int] = mapped_column(Integer, nullable=False)
    start_year: Mapped[int] = mapped_column(Integer, nullable=False)
    start_month: Mapped[int] = mapped_column(Integer, nullable=False)

    assumptions: Mapped[dict] = mapped_column(JSONB, nullable=False)
    results: Mapped[dict] = mapped_column(JSONB, nullable=False)
    summary: Mapped[dict] = mapped_column(JSONB, nullable=False)

    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=get_colombia_now_naive,
        nullable=False,
        index=True,
    )

    created_by_user: Mapped["User | None"] = relationship()

    def __repr__(self) -> str:
        return f"<FinancialProjection({self.name}, {self.months_count}m, {self.scenario_label})>"
