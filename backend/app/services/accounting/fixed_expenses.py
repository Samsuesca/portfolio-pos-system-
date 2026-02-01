"""
Fixed Expense Service - Recurring/Periodic Expense Management

Manages fixed expense templates and generates Expense records from them.
"""
from uuid import UUID
from datetime import datetime, date
from decimal import Decimal
from calendar import monthrange
from dateutil.relativedelta import relativedelta
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.utils.timezone import get_colombia_date
from app.models.fixed_expense import (
    FixedExpense, FixedExpenseType, ExpenseFrequency,
    RecurrenceFrequency, WeekDay, MonthDayType
)
from app.models.accounting import Expense, ExpenseCategory
from app.schemas.fixed_expense import (
    FixedExpenseCreate,
    FixedExpenseUpdate,
    FixedExpenseListResponse,
    GenerateExpensesRequest,
    GenerateExpensesResponse,
    GeneratedExpenseInfo,
    PendingGenerationItem,
    PendingGenerationResponse,
)


class FixedExpenseService:
    """Service for Fixed Expense operations"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(
        self,
        data: FixedExpenseCreate,
        created_by: UUID | None = None
    ) -> FixedExpense:
        """Create a new fixed expense template"""
        # Determine if using new recurrence system
        uses_new_recurrence = data.recurrence_frequency is not None

        # Calculate next generation date if not provided
        next_date = data.next_generation_date
        if next_date is None and data.auto_generate:
            if uses_new_recurrence:
                next_date = self._calculate_next_generation_date_advanced(
                    data.recurrence_frequency,
                    data.recurrence_interval or 1,
                    data.recurrence_weekdays,
                    data.recurrence_month_days,
                    data.recurrence_month_day_type
                )
            else:
                next_date = self._calculate_next_generation_date(
                    data.frequency,
                    data.day_of_month
                )

        fixed_expense = FixedExpense(
            name=data.name,
            description=data.description,
            category=data.category,
            expense_type=data.expense_type,
            amount=data.amount,
            min_amount=data.min_amount,
            max_amount=data.max_amount,
            # Legacy fields
            frequency=data.frequency,
            day_of_month=data.day_of_month,
            # Advanced recurrence fields
            recurrence_frequency=data.recurrence_frequency,
            recurrence_interval=data.recurrence_interval,
            recurrence_weekdays=data.recurrence_weekdays,
            recurrence_month_days=data.recurrence_month_days,
            recurrence_month_day_type=data.recurrence_month_day_type,
            recurrence_months=data.recurrence_months,
            recurrence_start_date=data.recurrence_start_date,
            recurrence_end_date=data.recurrence_end_date,
            recurrence_max_occurrences=data.recurrence_max_occurrences,
            # Common fields
            auto_generate=data.auto_generate,
            next_generation_date=next_date,
            vendor=data.vendor,
            created_by=created_by
        )
        self.db.add(fixed_expense)
        await self.db.flush()
        await self.db.refresh(fixed_expense)
        return fixed_expense

    async def get(self, fixed_expense_id: UUID) -> FixedExpense | None:
        """Get a fixed expense by ID"""
        result = await self.db.execute(
            select(FixedExpense).where(FixedExpense.id == fixed_expense_id)
        )
        return result.scalar_one_or_none()

    async def get_multi(
        self,
        skip: int = 0,
        limit: int = 100,
        is_active: bool | None = None,
        category: ExpenseCategory | None = None
    ) -> list[FixedExpense]:
        """Get multiple fixed expenses with optional filters"""
        query = select(FixedExpense)

        if is_active is not None:
            query = query.where(FixedExpense.is_active == is_active)
        if category is not None:
            query = query.where(FixedExpense.category == category)

        query = query.order_by(FixedExpense.name).offset(skip).limit(limit)
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def update(
        self,
        fixed_expense_id: UUID,
        data: FixedExpenseUpdate
    ) -> FixedExpense | None:
        """Update a fixed expense template"""
        fixed_expense = await self.get(fixed_expense_id)
        if not fixed_expense:
            return None

        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(fixed_expense, field, value)

        # Recalculate next generation date if frequency or day changed
        if 'frequency' in update_data or 'day_of_month' in update_data:
            if fixed_expense.auto_generate:
                fixed_expense.next_generation_date = self._calculate_next_generation_date(
                    fixed_expense.frequency,
                    fixed_expense.day_of_month
                )

        await self.db.flush()
        await self.db.refresh(fixed_expense)
        return fixed_expense

    async def delete(self, fixed_expense_id: UUID) -> bool:
        """Soft delete a fixed expense (set is_active = False)"""
        fixed_expense = await self.get(fixed_expense_id)
        if not fixed_expense:
            return False

        fixed_expense.is_active = False
        await self.db.flush()
        return True

    async def get_pending_generation(self) -> PendingGenerationResponse:
        """Get all fixed expenses that are pending generation"""
        today = get_colombia_date()

        result = await self.db.execute(
            select(FixedExpense).where(
                FixedExpense.is_active == True,
                FixedExpense.auto_generate == True
            ).order_by(FixedExpense.next_generation_date.asc().nullslast())
        )
        fixed_expenses = result.scalars().all()

        items = []
        overdue_count = 0

        for fe in fixed_expenses:
            days_overdue = 0
            if fe.next_generation_date and fe.next_generation_date <= today:
                days_overdue = (today - fe.next_generation_date).days
                overdue_count += 1

            items.append(PendingGenerationItem(
                id=fe.id,
                name=fe.name,
                category=fe.category,
                expense_type=fe.expense_type,
                amount=fe.amount,
                min_amount=fe.min_amount,
                max_amount=fe.max_amount,
                frequency=fe.frequency,
                next_generation_date=fe.next_generation_date,
                last_generated_date=fe.last_generated_date,
                days_overdue=days_overdue
            ))

        return PendingGenerationResponse(
            pending_count=len([i for i in items if i.days_overdue >= 0 and i.next_generation_date and i.next_generation_date <= today]),
            overdue_count=overdue_count,
            items=items
        )

    async def generate_expenses(
        self,
        request: GenerateExpensesRequest,
        created_by: UUID | None = None
    ) -> GenerateExpensesResponse:
        """
        Generate Expense records from fixed expense templates.

        This creates pending Expense records that need to be paid manually.
        """
        today = get_colombia_date()
        target_date = request.target_date or today

        # Get fixed expenses to process
        query = select(FixedExpense).where(
            FixedExpense.is_active == True,
            FixedExpense.auto_generate == True
        )

        if request.fixed_expense_ids:
            query = query.where(FixedExpense.id.in_(request.fixed_expense_ids))
        else:
            # Only generate for those due
            query = query.where(
                FixedExpense.next_generation_date <= target_date
            )

        result = await self.db.execute(query)
        fixed_expenses = list(result.scalars().all())

        generated_expenses = []
        skipped_reasons = {}

        for fe in fixed_expenses:
            # Check if already generated for this period
            if await self._already_generated_for_period(fe, target_date):
                skipped_reasons[str(fe.id)] = f"Ya generado para el periodo actual"
                continue

            # Determine amount
            amount = fe.amount
            if request.override_amounts and str(fe.id) in request.override_amounts:
                amount = request.override_amounts[str(fe.id)]
            elif fe.expense_type == FixedExpenseType.VARIABLE:
                # For variable, keep the default amount (user can adjust later)
                amount = fe.amount

            # Calculate due date and period label based on recurrence type
            if fe.uses_new_recurrence:
                # Use advanced recurrence system
                due_date = self._calculate_due_date_advanced(fe, target_date)
                period_label = self._get_period_label_advanced(fe, target_date)
                recurring_period = fe.recurrence_frequency.value if fe.recurrence_frequency else 'monthly'
            else:
                # Use legacy frequency system
                due_date = self._calculate_due_date(fe.frequency, fe.day_of_month, target_date)
                period_label = self._get_period_label(fe.frequency, target_date)
                recurring_period = fe.frequency.value if fe.frequency else 'monthly'

            # Create the expense
            expense = Expense(
                school_id=None,  # Global expense
                category=fe.category,
                description=f"{fe.name} - {period_label}",
                amount=amount,
                expense_date=target_date,
                due_date=due_date,
                vendor=fe.vendor,
                is_recurring=True,
                recurring_period=recurring_period,
                fixed_expense_id=fe.id,
                created_by=created_by
            )
            self.db.add(expense)
            await self.db.flush()

            # Update fixed expense tracking
            fe.last_generated_date = target_date
            if fe.uses_new_recurrence:
                fe.next_generation_date = self._calculate_next_generation_date_advanced(
                    fe.recurrence_frequency,
                    fe.recurrence_interval or 1,
                    fe.recurrence_weekdays,
                    fe.recurrence_month_days,
                    fe.recurrence_month_day_type,
                    from_date=target_date
                )
                # Increment occurrences counter
                fe.recurrence_occurrences_generated = (fe.recurrence_occurrences_generated or 0) + 1
            else:
                fe.next_generation_date = self._calculate_next_generation_date(
                    fe.frequency,
                    fe.day_of_month,
                    from_date=target_date
                )

            generated_expenses.append(GeneratedExpenseInfo(
                fixed_expense_id=fe.id,
                fixed_expense_name=fe.name,
                expense_id=expense.id,
                amount=amount,
                expense_date=target_date,
                due_date=due_date
            ))

        await self.db.flush()

        return GenerateExpensesResponse(
            generated_count=len(generated_expenses),
            skipped_count=len(skipped_reasons),
            generated_expenses=generated_expenses,
            skipped_reasons=skipped_reasons
        )

    async def generate_single_expense(
        self,
        fixed_expense_id: UUID,
        amount: Decimal | None = None,
        expense_date: date | None = None,
        created_by: UUID | None = None
    ) -> Expense | None:
        """Generate a single expense from a fixed expense template"""
        fe = await self.get(fixed_expense_id)
        if not fe:
            return None

        target_date = expense_date or get_colombia_date()
        final_amount = amount or fe.amount

        due_date = self._calculate_due_date(fe.frequency, fe.day_of_month, target_date)

        expense = Expense(
            school_id=None,
            category=fe.category,
            description=f"{fe.name} - {self._get_period_label(fe.frequency, target_date)}",
            amount=final_amount,
            expense_date=target_date,
            due_date=due_date,
            vendor=fe.vendor,
            is_recurring=True,
            recurring_period=fe.frequency.value,
            fixed_expense_id=fe.id,
            created_by=created_by
        )
        self.db.add(expense)

        # Update tracking
        fe.last_generated_date = target_date
        fe.next_generation_date = self._calculate_next_generation_date(
            fe.frequency,
            fe.day_of_month,
            from_date=target_date
        )

        await self.db.flush()
        await self.db.refresh(expense)
        return expense

    async def get_generated_expenses(
        self,
        fixed_expense_id: UUID,
        limit: int = 12
    ) -> list[Expense]:
        """Get expenses generated from a fixed expense template"""
        result = await self.db.execute(
            select(Expense).where(
                Expense.fixed_expense_id == fixed_expense_id
            ).order_by(Expense.expense_date.desc()).limit(limit)
        )
        return list(result.scalars().all())

    async def get_stats(self, fixed_expense_id: UUID) -> dict:
        """Get statistics for a fixed expense"""
        result = await self.db.execute(
            select(
                func.count(Expense.id).label('total_generated'),
                func.coalesce(func.sum(Expense.amount), 0).label('total_amount')
            ).where(Expense.fixed_expense_id == fixed_expense_id)
        )
        row = result.one()
        return {
            "total_generated": row.total_generated,
            "total_amount_generated": Decimal(str(row.total_amount))
        }

    # ==================== Helper Methods ====================

    def _calculate_next_generation_date(
        self,
        frequency: ExpenseFrequency | None,
        day_of_month: int | None,
        from_date: date | None = None
    ) -> date:
        """Calculate the next date when expense should be generated (legacy system)"""
        today = from_date or get_colombia_date()

        if not frequency:
            return today + relativedelta(months=1)

        if frequency == ExpenseFrequency.WEEKLY:
            # Next week
            return today + relativedelta(weeks=1)

        elif frequency == ExpenseFrequency.BIWEEKLY:
            # Next 2 weeks
            return today + relativedelta(weeks=2)

        elif frequency == ExpenseFrequency.MONTHLY:
            # Next month on the specified day (or 1st if not specified)
            target_day = day_of_month or 1
            next_month = today + relativedelta(months=1)
            _, last_day = monthrange(next_month.year, next_month.month)
            actual_day = min(target_day, last_day)
            return date(next_month.year, next_month.month, actual_day)

        elif frequency == ExpenseFrequency.QUARTERLY:
            # Next quarter
            return today + relativedelta(months=3)

        elif frequency == ExpenseFrequency.YEARLY:
            # Next year
            return today + relativedelta(years=1)

        return today + relativedelta(months=1)

    def _calculate_next_generation_date_advanced(
        self,
        recurrence_frequency: RecurrenceFrequency | None,
        interval: int = 1,
        weekdays: list[WeekDay] | None = None,
        month_days: list[int] | None = None,
        month_day_type: MonthDayType | None = None,
        from_date: date | None = None
    ) -> date:
        """Calculate next generation date using advanced recurrence system"""
        today = from_date or get_colombia_date()

        if not recurrence_frequency:
            return today + relativedelta(days=1)

        if recurrence_frequency == RecurrenceFrequency.DAILY:
            return today + relativedelta(days=interval)

        elif recurrence_frequency == RecurrenceFrequency.WEEKLY:
            if weekdays:
                # Find next matching weekday
                weekday_map = {
                    WeekDay.MONDAY: 0, WeekDay.TUESDAY: 1, WeekDay.WEDNESDAY: 2,
                    WeekDay.THURSDAY: 3, WeekDay.FRIDAY: 4, WeekDay.SATURDAY: 5, WeekDay.SUNDAY: 6
                }
                target_days = sorted([weekday_map.get(d, 0) for d in weekdays])
                current_weekday = today.weekday()

                # Find next weekday in current week
                for target in target_days:
                    if target > current_weekday:
                        return today + relativedelta(days=(target - current_weekday))

                # Otherwise, go to first day of next interval
                days_until_monday = (7 - current_weekday) % 7 or 7
                next_week_start = today + relativedelta(days=days_until_monday)
                if interval > 1:
                    next_week_start += relativedelta(weeks=interval - 1)
                return next_week_start + relativedelta(days=target_days[0])
            else:
                return today + relativedelta(weeks=interval)

        elif recurrence_frequency == RecurrenceFrequency.MONTHLY:
            if month_day_type == MonthDayType.LAST_DAY:
                # Last day of next month
                next_month = today + relativedelta(months=interval)
                _, last_day = monthrange(next_month.year, next_month.month)
                return date(next_month.year, next_month.month, last_day)

            elif month_day_type == MonthDayType.FIRST_WEEKDAY:
                # First business day of next month
                next_month = today + relativedelta(months=interval)
                first_day = date(next_month.year, next_month.month, 1)
                # Skip weekends
                while first_day.weekday() >= 5:
                    first_day += relativedelta(days=1)
                return first_day

            elif month_day_type == MonthDayType.LAST_WEEKDAY:
                # Last business day of next month
                next_month = today + relativedelta(months=interval)
                _, last_day_num = monthrange(next_month.year, next_month.month)
                last_day = date(next_month.year, next_month.month, last_day_num)
                # Skip weekends
                while last_day.weekday() >= 5:
                    last_day -= relativedelta(days=1)
                return last_day

            elif month_days:
                # Specific days of month
                next_month = today + relativedelta(months=interval)
                _, last_day = monthrange(next_month.year, next_month.month)
                # Get first valid day from list
                target_day = min(month_days[0], last_day) if month_days else 1
                return date(next_month.year, next_month.month, target_day)

            else:
                return today + relativedelta(months=interval)

        elif recurrence_frequency == RecurrenceFrequency.YEARLY:
            return today + relativedelta(years=interval)

        return today + relativedelta(days=1)

    def _calculate_due_date(
        self,
        frequency: ExpenseFrequency,
        day_of_month: int | None,
        expense_date: date
    ) -> date:
        """Calculate the due date for an expense"""
        # Due date is typically end of the expense period
        if frequency == ExpenseFrequency.WEEKLY:
            return expense_date + relativedelta(days=7)
        elif frequency == ExpenseFrequency.BIWEEKLY:
            return expense_date + relativedelta(days=14)
        elif frequency == ExpenseFrequency.MONTHLY:
            # End of the month
            _, last_day = monthrange(expense_date.year, expense_date.month)
            return date(expense_date.year, expense_date.month, last_day)
        elif frequency == ExpenseFrequency.QUARTERLY:
            return expense_date + relativedelta(months=3)
        elif frequency == ExpenseFrequency.YEARLY:
            return expense_date + relativedelta(years=1)
        return expense_date + relativedelta(days=30)

    def _get_period_label(self, frequency: ExpenseFrequency | None, target_date: date) -> str:
        """Get a human-readable label for the period"""
        months_es = [
            "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
            "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
        ]

        if not frequency:
            return target_date.strftime('%Y-%m-%d')

        if frequency == ExpenseFrequency.MONTHLY:
            return f"{months_es[target_date.month - 1]} {target_date.year}"
        elif frequency == ExpenseFrequency.WEEKLY:
            return f"Semana {target_date.isocalendar()[1]} {target_date.year}"
        elif frequency == ExpenseFrequency.BIWEEKLY:
            fortnight = 1 if target_date.day <= 15 else 2
            return f"Quincena {fortnight} - {months_es[target_date.month - 1]} {target_date.year}"
        elif frequency == ExpenseFrequency.QUARTERLY:
            quarter = (target_date.month - 1) // 3 + 1
            return f"Q{quarter} {target_date.year}"
        elif frequency == ExpenseFrequency.YEARLY:
            return f"Año {target_date.year}"
        return f"{target_date.strftime('%Y-%m-%d')}"

    def _calculate_due_date_advanced(self, fe: FixedExpense, expense_date: date) -> date:
        """Calculate due date for advanced recurrence expenses"""
        if not fe.recurrence_frequency:
            return expense_date + relativedelta(days=30)

        interval = fe.recurrence_interval or 1

        if fe.recurrence_frequency == RecurrenceFrequency.DAILY:
            return expense_date + relativedelta(days=interval)
        elif fe.recurrence_frequency == RecurrenceFrequency.WEEKLY:
            return expense_date + relativedelta(weeks=interval)
        elif fe.recurrence_frequency == RecurrenceFrequency.MONTHLY:
            # End of month
            _, last_day = monthrange(expense_date.year, expense_date.month)
            return date(expense_date.year, expense_date.month, last_day)
        elif fe.recurrence_frequency == RecurrenceFrequency.YEARLY:
            return expense_date + relativedelta(years=interval)
        return expense_date + relativedelta(days=30)

    def _get_period_label_advanced(self, fe: FixedExpense, target_date: date) -> str:
        """Get human-readable label for advanced recurrence periods"""
        months_es = [
            "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
            "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
        ]
        days_es = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]

        if not fe.recurrence_frequency:
            return target_date.strftime('%Y-%m-%d')

        if fe.recurrence_frequency == RecurrenceFrequency.DAILY:
            return target_date.strftime('%d/%m/%Y')
        elif fe.recurrence_frequency == RecurrenceFrequency.WEEKLY:
            week_num = target_date.isocalendar()[1]
            day_name = days_es[target_date.weekday()]
            return f"{day_name} - Semana {week_num} {target_date.year}"
        elif fe.recurrence_frequency == RecurrenceFrequency.MONTHLY:
            return f"{months_es[target_date.month - 1]} {target_date.year}"
        elif fe.recurrence_frequency == RecurrenceFrequency.YEARLY:
            return f"Año {target_date.year}"
        return target_date.strftime('%Y-%m-%d')

    async def _already_generated_for_period(
        self,
        fixed_expense: FixedExpense,
        target_date: date
    ) -> bool:
        """Check if an expense was already generated for the current period"""
        # For advanced recurrence, check if generated on the same date
        if fixed_expense.uses_new_recurrence:
            if fixed_expense.recurrence_frequency == RecurrenceFrequency.DAILY:
                # Daily: check exact date
                period_start = target_date
                period_end = target_date
            elif fixed_expense.recurrence_frequency == RecurrenceFrequency.WEEKLY:
                # Weekly: check this week
                period_start = target_date - relativedelta(days=target_date.weekday())
                period_end = period_start + relativedelta(days=6)
            elif fixed_expense.recurrence_frequency == RecurrenceFrequency.MONTHLY:
                # Monthly: check this month
                period_start = target_date.replace(day=1)
                _, last_day = monthrange(target_date.year, target_date.month)
                period_end = target_date.replace(day=last_day)
            elif fixed_expense.recurrence_frequency == RecurrenceFrequency.YEARLY:
                # Yearly: check this year
                period_start = date(target_date.year, 1, 1)
                period_end = date(target_date.year, 12, 31)
            else:
                return False
        else:
            # Legacy frequency system
            if fixed_expense.frequency == ExpenseFrequency.MONTHLY:
                period_start = target_date.replace(day=1)
                _, last_day = monthrange(target_date.year, target_date.month)
                period_end = target_date.replace(day=last_day)
            elif fixed_expense.frequency == ExpenseFrequency.WEEKLY:
                # ISO week
                period_start = target_date - relativedelta(days=target_date.weekday())
                period_end = period_start + relativedelta(days=6)
            elif fixed_expense.frequency == ExpenseFrequency.BIWEEKLY:
                if target_date.day <= 15:
                    period_start = target_date.replace(day=1)
                    period_end = target_date.replace(day=15)
                else:
                    period_start = target_date.replace(day=16)
                    _, last_day = monthrange(target_date.year, target_date.month)
                    period_end = target_date.replace(day=last_day)
            elif fixed_expense.frequency == ExpenseFrequency.QUARTERLY:
                quarter = (target_date.month - 1) // 3
                period_start = date(target_date.year, quarter * 3 + 1, 1)
                period_end = period_start + relativedelta(months=3) - relativedelta(days=1)
            elif fixed_expense.frequency == ExpenseFrequency.YEARLY:
                period_start = date(target_date.year, 1, 1)
                period_end = date(target_date.year, 12, 31)
            else:
                return False

        # Check for existing expense in this period
        result = await self.db.execute(
            select(func.count(Expense.id)).where(
                Expense.fixed_expense_id == fixed_expense.id,
                Expense.expense_date >= period_start,
                Expense.expense_date <= period_end
            )
        )
        count = result.scalar_one()
        return count > 0
