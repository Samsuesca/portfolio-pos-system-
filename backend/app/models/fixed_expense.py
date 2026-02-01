"""
Fixed Expense Models - Recurring/Periodic Expense Templates
"""
from datetime import datetime, date
from decimal import Decimal
from sqlalchemy import String, Boolean, DateTime, Date, Numeric, Text, ForeignKey, Enum as SQLEnum, Integer, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSON
import uuid
import enum

from app.db.base import Base
from app.models.accounting import ExpenseCategory
from app.utils.timezone import get_colombia_now_naive, get_colombia_date


class FixedExpenseType(str, enum.Enum):
    """Types of fixed expenses based on value predictability"""
    EXACT = "exact"          # Fixed value (Internet, Rent)
    VARIABLE = "variable"    # Variable value within range (Utilities, Servers)


class ExpenseFrequency(str, enum.Enum):
    """LEGACY: Frequency of expense generation. Use RecurrenceFrequency for new records."""
    WEEKLY = "weekly"
    BIWEEKLY = "biweekly"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    YEARLY = "yearly"


class RecurrenceFrequency(str, enum.Enum):
    """Base frequency unit for advanced recurrence system"""
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    YEARLY = "yearly"


class WeekDay(str, enum.Enum):
    """Days of the week for recurrence"""
    MONDAY = "monday"
    TUESDAY = "tuesday"
    WEDNESDAY = "wednesday"
    THURSDAY = "thursday"
    FRIDAY = "friday"
    SATURDAY = "saturday"
    SUNDAY = "sunday"


class MonthDayType(str, enum.Enum):
    """Special day types for monthly recurrence"""
    SPECIFIC = "specific"       # Specific day (1-31)
    LAST_DAY = "last_day"       # Last day of month
    FIRST_WEEKDAY = "first_weekday"    # First business day
    LAST_WEEKDAY = "last_weekday"      # Last business day


class FixedExpense(Base):
    """
    Fixed expense template for recurring/periodic expenses.

    This model acts as a template to automatically generate Expense records
    at specified intervals. Supports both exact-value expenses (like rent)
    and variable expenses (like utilities) with min/max ranges.
    """
    __tablename__ = "fixed_expenses"
    __table_args__ = (
        CheckConstraint('amount > 0', name='chk_fixed_expense_amount_positive'),
        CheckConstraint(
            'expense_type != \'variable\' OR (min_amount IS NOT NULL AND max_amount IS NOT NULL)',
            name='chk_variable_expense_has_range'
        ),
        CheckConstraint(
            'min_amount IS NULL OR max_amount IS NULL OR min_amount <= max_amount',
            name='chk_expense_range_valid'
        ),
        CheckConstraint(
            'day_of_month IS NULL OR (day_of_month >= 1 AND day_of_month <= 31)',
            name='chk_day_of_month_valid'
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )

    # Basic info
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)

    # Category (same as Expense model)
    category: Mapped[ExpenseCategory] = mapped_column(
        SQLEnum(
            ExpenseCategory,
            name="expense_category_enum",
            values_callable=lambda x: [e.value for e in x],
            create_constraint=False
        ),
        nullable=False,
        index=True
    )

    # Expense type (exact or variable)
    expense_type: Mapped[FixedExpenseType] = mapped_column(
        SQLEnum(
            FixedExpenseType,
            name="fixed_expense_type_enum",
            values_callable=lambda x: [e.value for e in x],
            create_constraint=False
        ),
        nullable=False,
        default=FixedExpenseType.EXACT
    )

    # Amount configuration
    amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False
    )
    # For variable expenses: expected range
    min_amount: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    max_amount: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))

    # === LEGACY: Simple frequency (maintained for backward compatibility) ===
    frequency: Mapped[ExpenseFrequency | None] = mapped_column(
        SQLEnum(
            ExpenseFrequency,
            name="expense_frequency_enum",
            values_callable=lambda x: [e.value for e in x],
            create_constraint=False
        ),
        nullable=True,  # Now nullable for new records using advanced system
        default=ExpenseFrequency.MONTHLY
    )
    # Day of month for monthly expenses (1-31)
    day_of_month: Mapped[int | None] = mapped_column(Integer)

    # === NEW: Advanced Recurrence System (Google Calendar style) ===
    recurrence_frequency: Mapped[RecurrenceFrequency | None] = mapped_column(
        SQLEnum(
            RecurrenceFrequency,
            name="recurrence_frequency_enum",
            values_callable=lambda x: [e.value for e in x],
            create_constraint=False
        ),
        nullable=True,
        index=True
    )

    # Interval: "every N units" (e.g., every 2 weeks)
    recurrence_interval: Mapped[int | None] = mapped_column(
        Integer,
        default=1
    )

    # Weekdays for weekly recurrence (stored as JSON array: ["monday", "wednesday"])
    recurrence_weekdays: Mapped[list | None] = mapped_column(
        JSON,
        nullable=True
    )

    # Days of month (stored as JSON array: [1, 15] or [-1] for last day)
    recurrence_month_days: Mapped[list | None] = mapped_column(
        JSON,
        nullable=True
    )

    # Special day type for monthly recurrence
    recurrence_month_day_type: Mapped[MonthDayType | None] = mapped_column(
        SQLEnum(
            MonthDayType,
            name="month_day_type_enum",
            values_callable=lambda x: [e.value for e in x],
            create_constraint=False
        ),
        nullable=True
    )

    # Months for yearly recurrence (JSON array: [1, 6] = January and June)
    recurrence_months: Mapped[list | None] = mapped_column(
        JSON,
        nullable=True
    )

    # Recurrence limits
    recurrence_start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    recurrence_end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    recurrence_max_occurrences: Mapped[int | None] = mapped_column(Integer, nullable=True)
    recurrence_occurrences_generated: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Auto-generation settings
    auto_generate: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False
    )
    # Next date when expense should be generated
    next_generation_date: Mapped[date | None] = mapped_column(Date)
    # Last date when expense was generated
    last_generated_date: Mapped[date | None] = mapped_column(Date)

    # Vendor/Provider info
    vendor: Mapped[str | None] = mapped_column(String(255))

    # Status
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False
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
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=get_colombia_now_naive,
        onupdate=get_colombia_now_naive,
        nullable=False
    )

    # Relationships
    created_by_user: Mapped["User | None"] = relationship()
    generated_expenses: Mapped[list["Expense"]] = relationship(
        back_populates="fixed_expense_template"
    )

    # === Helper Properties ===
    @property
    def uses_new_recurrence(self) -> bool:
        """Check if this expense uses the new recurrence system"""
        return self.recurrence_frequency is not None

    @property
    def is_expired(self) -> bool:
        """Check if recurrence has expired"""
        if self.recurrence_end_date and get_colombia_date() > self.recurrence_end_date:
            return True
        if self.recurrence_max_occurrences:
            if self.recurrence_occurrences_generated >= self.recurrence_max_occurrences:
                return True
        return False

    def __repr__(self) -> str:
        freq = self.recurrence_frequency.value if self.recurrence_frequency else (
            self.frequency.value if self.frequency else "unknown"
        )
        return f"<FixedExpense({self.name}: ${self.amount} {freq})>"
