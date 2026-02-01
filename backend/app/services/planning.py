"""
Planning Service - Financial Planning and Projections

Provides:
- Sales seasonality analysis
- Cash flow projections
- Debt payment management
"""
from datetime import date, datetime
from dateutil.relativedelta import relativedelta
from decimal import Decimal
from uuid import UUID
from calendar import month_name as calendar_month_name
from sqlalchemy import select, func, extract, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.utils.timezone import get_colombia_date, get_colombia_now_naive
from app.models.accounting import (
    DebtPaymentSchedule,
    DebtPaymentStatus,
    BalanceAccount,
    AccountType,
)
from app.models.sale import Sale
from app.models.fixed_expense import FixedExpense
from app.services.balance_integration import BalanceIntegrationService, DEFAULT_ACCOUNTS


# Spanish month names
MONTH_NAMES_ES = {
    1: "Enero", 2: "Febrero", 3: "Marzo", 4: "Abril",
    5: "Mayo", 6: "Junio", 7: "Julio", 8: "Agosto",
    9: "Septiembre", 10: "Octubre", 11: "Noviembre", 12: "Diciembre"
}

# Seasonality patterns for uniform business
SEASONALITY_PATTERNS = [
    {"months": [1, 2], "period": "Enero-Febrero", "percentage": Decimal("80"), "behavior": "ALTA"},
    {"months": [7, 8], "period": "Julio-Agosto", "percentage": Decimal("15"), "behavior": "MEDIA"},
    {"months": [3, 4, 5, 6, 9, 10, 11, 12], "period": "Resto del año", "percentage": Decimal("5"), "behavior": "BAJA"},
]


class PlanningService:
    """
    Service for financial planning and projections.

    Responsibilities:
    - Analyze sales seasonality
    - Project cash flow
    - Manage debt payments
    """

    def __init__(self, db: AsyncSession):
        self.db = db
        self.balance_service = BalanceIntegrationService(db)

    # ============================================
    # Debt Payment Management
    # ============================================

    async def get_debt_payments(
        self,
        status: str | None = None,
        start_date: date | None = None,
        end_date: date | None = None,
        limit: int = 100,
        offset: int = 0
    ) -> dict:
        """
        Get debt payments with filtering.

        Returns dict with items, totals, and next due payment.
        """
        query = select(DebtPaymentSchedule)

        if status:
            query = query.where(DebtPaymentSchedule.status == status)
        if start_date:
            query = query.where(DebtPaymentSchedule.due_date >= start_date)
        if end_date:
            query = query.where(DebtPaymentSchedule.due_date <= end_date)

        # Count total
        count_query = select(func.count(DebtPaymentSchedule.id))
        if status:
            count_query = count_query.where(DebtPaymentSchedule.status == status)
        total_result = await self.db.execute(count_query)
        total = total_result.scalar() or 0

        # Get items
        query = query.order_by(DebtPaymentSchedule.due_date.asc())
        query = query.offset(offset).limit(limit)
        result = await self.db.execute(query)
        items = result.scalars().all()

        # Calculate totals
        pending_query = select(func.sum(DebtPaymentSchedule.amount)).where(
            DebtPaymentSchedule.status == DebtPaymentStatus.PENDING
        )
        pending_result = await self.db.execute(pending_query)
        pending_total = pending_result.scalar() or Decimal("0")

        overdue_query = select(func.sum(DebtPaymentSchedule.amount)).where(
            DebtPaymentSchedule.status == DebtPaymentStatus.OVERDUE
        )
        overdue_result = await self.db.execute(overdue_query)
        overdue_total = overdue_result.scalar() or Decimal("0")

        # Get next due payment
        next_due_query = select(DebtPaymentSchedule).where(
            DebtPaymentSchedule.status == DebtPaymentStatus.PENDING,
            DebtPaymentSchedule.due_date >= get_colombia_date()
        ).order_by(DebtPaymentSchedule.due_date.asc()).limit(1)
        next_due_result = await self.db.execute(next_due_query)
        next_due = next_due_result.scalar_one_or_none()

        return {
            "items": [self._format_debt_payment(p) for p in items],
            "total": total,
            "pending_total": pending_total,
            "overdue_total": overdue_total,
            "next_due": self._format_debt_payment(next_due) if next_due else None
        }

    async def create_debt_payment(
        self,
        data: dict,
        created_by: UUID | None = None
    ) -> DebtPaymentSchedule:
        """Create a new debt payment schedule."""
        payment = DebtPaymentSchedule(
            description=data["description"],
            creditor=data.get("creditor"),
            amount=data["amount"],
            due_date=data["due_date"],
            is_recurring=data.get("is_recurring", False),
            recurrence_day=data.get("recurrence_day"),
            category=data.get("category"),
            notes=data.get("notes"),
            balance_account_id=data.get("balance_account_id"),
            accounts_payable_id=data.get("accounts_payable_id"),
            status=DebtPaymentStatus.PENDING,
            created_by=created_by
        )
        self.db.add(payment)
        await self.db.flush()
        return payment

    async def update_debt_payment(
        self,
        payment_id: UUID,
        data: dict
    ) -> DebtPaymentSchedule | None:
        """Update a debt payment."""
        result = await self.db.execute(
            select(DebtPaymentSchedule).where(DebtPaymentSchedule.id == payment_id)
        )
        payment = result.scalar_one_or_none()

        if not payment:
            return None

        for field, value in data.items():
            if value is not None and hasattr(payment, field):
                setattr(payment, field, value)

        payment.updated_at = get_colombia_now_naive()
        await self.db.flush()
        return payment

    async def mark_debt_as_paid(
        self,
        payment_id: UUID,
        paid_date: date,
        paid_amount: Decimal,
        payment_method: str,
        payment_account_id: UUID
    ) -> DebtPaymentSchedule | None:
        """Mark a debt payment as paid."""
        result = await self.db.execute(
            select(DebtPaymentSchedule).where(DebtPaymentSchedule.id == payment_id)
        )
        payment = result.scalar_one_or_none()

        if not payment:
            return None

        payment.status = DebtPaymentStatus.PAID
        payment.paid_date = paid_date
        payment.paid_amount = paid_amount
        payment.payment_method = payment_method
        payment.payment_account_id = payment_account_id
        payment.updated_at = get_colombia_now_naive()

        await self.db.flush()
        return payment

    async def delete_debt_payment(self, payment_id: UUID) -> bool:
        """Delete a debt payment (only if pending)."""
        result = await self.db.execute(
            select(DebtPaymentSchedule).where(DebtPaymentSchedule.id == payment_id)
        )
        payment = result.scalar_one_or_none()

        if not payment or payment.status != DebtPaymentStatus.PENDING:
            return False

        await self.db.delete(payment)
        await self.db.flush()
        return True

    async def update_overdue_payments(self) -> int:
        """Update status of overdue payments. Returns count updated."""
        today = get_colombia_date()
        result = await self.db.execute(
            select(DebtPaymentSchedule).where(
                DebtPaymentSchedule.status == DebtPaymentStatus.PENDING,
                DebtPaymentSchedule.due_date < today
            )
        )
        overdue_payments = result.scalars().all()

        for payment in overdue_payments:
            payment.status = DebtPaymentStatus.OVERDUE
            payment.updated_at = get_colombia_now_naive()

        await self.db.flush()
        return len(overdue_payments)

    def _format_debt_payment(self, payment: DebtPaymentSchedule) -> dict:
        """Format debt payment for response."""
        today = get_colombia_date()
        days_until_due = (payment.due_date - today).days

        return {
            "id": str(payment.id),
            "description": payment.description,
            "creditor": payment.creditor,
            "amount": payment.amount,
            "due_date": payment.due_date.isoformat(),
            "is_recurring": payment.is_recurring,
            "recurrence_day": payment.recurrence_day,
            "status": payment.status.value if hasattr(payment.status, 'value') else payment.status,
            "paid_date": payment.paid_date.isoformat() if payment.paid_date else None,
            "paid_amount": payment.paid_amount,
            "payment_method": payment.payment_method,
            "payment_account_id": str(payment.payment_account_id) if payment.payment_account_id else None,
            "balance_account_id": str(payment.balance_account_id) if payment.balance_account_id else None,
            "accounts_payable_id": str(payment.accounts_payable_id) if payment.accounts_payable_id else None,
            "category": payment.category,
            "notes": payment.notes,
            "created_by": str(payment.created_by) if payment.created_by else None,
            "created_at": payment.created_at.isoformat(),
            "updated_at": payment.updated_at.isoformat(),
            "days_until_due": days_until_due
        }

    # ============================================
    # Interest Payment Generation
    # ============================================

    async def generate_interest_payments(
        self,
        liability: BalanceAccount,
        from_date: date,
        to_date: date,
        created_by: UUID | None = None
    ) -> list[DebtPaymentSchedule]:
        """
        Generate monthly interest-only payments for a liability (bullet loan model).
        Capital is paid at due_date. Interest = balance * (rate/100) / 12 each month.
        Skips months that already have an interest payment for this liability.
        """
        if not liability.interest_rate or liability.interest_rate <= 0:
            return []

        # Tasa mensual: balance * rate / 100 (la tasa registrada es mensual)
        monthly_interest = float(liability.balance) * float(liability.interest_rate) / 100
        monthly_interest = round(monthly_interest, 2)

        if monthly_interest <= 0:
            return []

        payment_day = min(liability.due_date.day, 28) if liability.due_date else 15
        creditor = liability.creditor

        # Find existing interest payments for this liability to avoid duplicates
        existing_result = await self.db.execute(
            select(
                extract('year', DebtPaymentSchedule.due_date),
                extract('month', DebtPaymentSchedule.due_date)
            ).where(
                DebtPaymentSchedule.balance_account_id == liability.id,
                DebtPaymentSchedule.category == "interest",
                DebtPaymentSchedule.status != DebtPaymentStatus.CANCELLED
            )
        )
        existing_months = {(int(row[0]), int(row[1])) for row in existing_result.all()}

        created_payments = []
        current = date(from_date.year, from_date.month, 1)
        end = date(to_date.year, to_date.month, 1)

        while current <= end:
            year_month = (current.year, current.month)
            if year_month not in existing_months:
                # Calculate actual payment date for this month
                from calendar import monthrange
                max_day = monthrange(current.year, current.month)[1]
                actual_day = min(payment_day, max_day)
                payment_date = date(current.year, current.month, actual_day)

                month_name = MONTH_NAMES_ES.get(current.month, str(current.month))
                payment = DebtPaymentSchedule(
                    description=f"Intereses {month_name} - {liability.name}",
                    creditor=creditor,
                    amount=monthly_interest,
                    due_date=payment_date,
                    is_recurring=True,
                    recurrence_day=min(payment_day, 28),
                    category="interest",
                    notes=f"Interés mensual: {liability.interest_rate}% sobre ${float(liability.balance):,.0f}",
                    balance_account_id=liability.id,
                    status=DebtPaymentStatus.PENDING,
                    created_by=created_by
                )
                self.db.add(payment)
                created_payments.append(payment)

            current = current + relativedelta(months=1)

        if created_payments:
            await self.db.flush()

        return created_payments

    async def generate_all_pending_interest(
        self,
        created_by: UUID | None = None
    ) -> list[dict]:
        """
        For all active LIABILITY_LONG accounts with interest_rate > 0,
        generate missing interest payments from today until due_date.
        If due_date has passed but debt is still active, generate 1 month ahead.
        """
        today = get_colombia_date()

        result = await self.db.execute(
            select(BalanceAccount).where(
                BalanceAccount.account_type == AccountType.LIABILITY_LONG,
                BalanceAccount.is_active == True,
                BalanceAccount.interest_rate.isnot(None),
                BalanceAccount.interest_rate > 0,
                BalanceAccount.balance > 0
            )
        )
        liabilities = result.scalars().all()

        all_generated = []
        for liability in liabilities:
            if liability.due_date and liability.due_date >= today:
                to_date = liability.due_date
            else:
                # Debt past due but still active: generate 1 month ahead
                to_date = today + relativedelta(months=1)

            payments = await self.generate_interest_payments(
                liability=liability,
                from_date=today,
                to_date=to_date,
                created_by=created_by
            )
            for p in payments:
                all_generated.append({
                    "liability_name": liability.name,
                    "description": p.description,
                    "amount": float(p.amount),
                    "due_date": p.due_date.isoformat()
                })

        return all_generated

    # ============================================
    # Sales Seasonality Analysis
    # ============================================

    async def get_sales_seasonality(
        self,
        start_year: int | None = None,
        end_year: int | None = None
    ) -> dict:
        """
        Analyze sales by month/year to identify seasonality patterns.

        Returns monthly data, yearly totals, and identified patterns.
        """
        today = get_colombia_date()
        if end_year is None:
            end_year = today.year
        if start_year is None:
            start_year = end_year - 3  # Last 3-4 years

        # Query sales grouped by year and month
        query = select(
            extract('year', Sale.sale_date).label('year'),
            extract('month', Sale.sale_date).label('month'),
            func.sum(Sale.total).label('total_sales'),
            func.count(Sale.id).label('sales_count')
        ).where(
            extract('year', Sale.sale_date) >= start_year,
            extract('year', Sale.sale_date) <= end_year,
            Sale.status != 'cancelled'
        ).group_by(
            extract('year', Sale.sale_date),
            extract('month', Sale.sale_date)
        ).order_by(
            extract('year', Sale.sale_date),
            extract('month', Sale.sale_date)
        )

        result = await self.db.execute(query)
        rows = result.all()

        # Process data
        monthly_data = []
        yearly_totals: dict[int, Decimal] = {}

        for row in rows:
            year = int(row.year)
            month = int(row.month)
            total_sales = row.total_sales or Decimal("0")
            sales_count = row.sales_count or 0

            monthly_data.append({
                "year": year,
                "month": month,
                "month_name": MONTH_NAMES_ES.get(month, str(month)),
                "total_sales": total_sales,
                "sales_count": sales_count,
                "average_sale": total_sales / sales_count if sales_count > 0 else Decimal("0")
            })

            if year not in yearly_totals:
                yearly_totals[year] = Decimal("0")
            yearly_totals[year] += total_sales

        # Calculate growth rates
        growth_rates = {}
        sorted_years = sorted(yearly_totals.keys())
        for i in range(1, len(sorted_years)):
            prev_year = sorted_years[i - 1]
            curr_year = sorted_years[i]
            if yearly_totals[prev_year] > 0:
                growth = ((yearly_totals[curr_year] - yearly_totals[prev_year]) / yearly_totals[prev_year]) * 100
                growth_rates[f"{prev_year}-{curr_year}"] = round(growth, 1)

        # Build patterns
        patterns = [
            {
                "period": p["period"],
                "percentage": p["percentage"],
                "behavior": p["behavior"]
            }
            for p in SEASONALITY_PATTERNS
        ]

        return {
            "monthly_data": monthly_data,
            "yearly_totals": {str(k): v for k, v in yearly_totals.items()},
            "patterns": patterns,
            "growth_rates": growth_rates,
            "disclaimer": "Datos históricos aproximados - migración en proceso"
        }

    # ============================================
    # Cash Flow Projection
    # ============================================

    async def get_cash_projection(
        self,
        months: int = 6,
        growth_factor: Decimal = Decimal("1.20"),
        liquidity_threshold: Decimal = Decimal("5000000"),
        include_receivables: bool = True
    ) -> dict:
        """
        Project cash flow for the next N months.

        Uses:
        - Historical sales patterns with growth factor
        - Fixed expenses
        - Scheduled debt payments
        - Current liquidity
        """
        today = get_colombia_date()
        current_year = today.year
        current_month = today.month

        # Get current liquidity
        current_liquidity = await self._get_current_liquidity()

        # Get fixed expenses monthly total
        fixed_expenses_monthly = await self._get_fixed_expenses_monthly()

        # Get historical sales by month (average of previous years)
        historical_sales = await self._get_historical_monthly_sales()

        # Get scheduled debt payments
        debt_payments = await self._get_upcoming_debt_payments(months)

        # Build projections
        projections = []
        running_balance = current_liquidity
        total_income = Decimal("0")
        total_expenses = Decimal("0")
        total_debt = Decimal("0")
        months_below_threshold = []
        upcoming_debt_list = []

        for i in range(months):
            # Calculate target month
            target_date = today + relativedelta(months=i)
            target_year = target_date.year
            target_month = target_date.month

            # Project sales based on historical data
            projected_sales = self._project_monthly_sales(
                target_month, historical_sales, growth_factor
            )

            # Get debt payments for this month
            month_debt = sum(
                dp["amount"] for dp in debt_payments
                if dp["due_date"].year == target_year and dp["due_date"].month == target_month
            )

            # Calculate totals
            projected_income = projected_sales
            projected_expenses = fixed_expenses_monthly + month_debt

            net_flow = projected_income - projected_expenses
            opening_balance = running_balance
            closing_balance = running_balance + net_flow
            running_balance = closing_balance

            # Check alerts
            is_below_threshold = closing_balance < liquidity_threshold
            has_debt_due = month_debt > 0

            alert_message = None
            if is_below_threshold:
                months_below_threshold.append(MONTH_NAMES_ES.get(target_month, str(target_month)))
                alert_message = f"Saldo proyectado por debajo del umbral de ${liquidity_threshold:,.0f}"

            projections.append({
                "year": target_year,
                "month": target_month,
                "month_name": MONTH_NAMES_ES.get(target_month, str(target_month)),
                "projected_sales": projected_sales,
                "projected_income": projected_income,
                "fixed_expenses": fixed_expenses_monthly,
                "debt_payments": month_debt,
                "projected_expenses": projected_expenses,
                "net_flow": net_flow,
                "opening_balance": opening_balance,
                "closing_balance": closing_balance,
                "is_below_threshold": is_below_threshold,
                "has_debt_due": has_debt_due,
                "alert_message": alert_message
            })

            total_income += projected_income
            total_expenses += projected_expenses
            total_debt += month_debt

            # Collect upcoming debt payments
            for dp in debt_payments:
                if dp["due_date"].year == target_year and dp["due_date"].month == target_month:
                    if dp not in upcoming_debt_list:
                        upcoming_debt_list.append(dp)

        return {
            "projections": projections,
            "current_liquidity": current_liquidity,
            "projected_end_balance": running_balance,
            "total_projected_income": total_income,
            "total_projected_expenses": total_expenses,
            "total_debt_payments": total_debt,
            "growth_factor": growth_factor,
            "liquidity_threshold": liquidity_threshold,
            "months_below_threshold": months_below_threshold,
            "upcoming_debt_payments": upcoming_debt_list,
            "disclaimer": "Proyección basada en datos históricos aproximados"
        }

    async def _get_current_liquidity(self) -> Decimal:
        """Get total current liquidity (all cash accounts)."""
        accounts_map = await self.balance_service.get_or_create_global_accounts()

        total = Decimal("0")
        for account_key in ["caja_menor", "caja_mayor", "nequi", "banco"]:
            account_id = accounts_map.get(account_key)
            if account_id:
                result = await self.db.execute(
                    select(BalanceAccount.balance).where(BalanceAccount.id == account_id)
                )
                balance = result.scalar()
                if balance:
                    total += balance

        return total

    async def _get_fixed_expenses_monthly(self) -> Decimal:
        """Get total monthly fixed expenses."""
        result = await self.db.execute(
            select(func.sum(FixedExpense.amount)).where(
                FixedExpense.is_active == True,
                FixedExpense.frequency == 'monthly'
            )
        )
        monthly = result.scalar() or Decimal("0")

        # Add yearly expenses divided by 12
        result_yearly = await self.db.execute(
            select(func.sum(FixedExpense.amount)).where(
                FixedExpense.is_active == True,
                FixedExpense.frequency == 'yearly'
            )
        )
        yearly = result_yearly.scalar() or Decimal("0")

        return monthly + (yearly / 12)

    async def _get_historical_monthly_sales(self) -> dict[int, Decimal]:
        """Get average historical sales by month."""
        query = select(
            extract('month', Sale.sale_date).label('month'),
            func.avg(Sale.total).label('avg_total'),
            func.count(Sale.id).label('count')
        ).where(
            Sale.status != 'cancelled'
        ).group_by(
            extract('month', Sale.sale_date)
        )

        result = await self.db.execute(query)
        rows = result.all()

        return {
            int(row.month): (row.avg_total or Decimal("0")) * (row.count or 1)
            for row in rows
        }

    async def _get_upcoming_debt_payments(self, months: int) -> list[dict]:
        """Get debt payments for the next N months."""
        today = get_colombia_date()
        end_date = today + relativedelta(months=months)

        result = await self.db.execute(
            select(DebtPaymentSchedule).where(
                DebtPaymentSchedule.status.in_([DebtPaymentStatus.PENDING, DebtPaymentStatus.OVERDUE]),
                DebtPaymentSchedule.due_date <= end_date
            ).order_by(DebtPaymentSchedule.due_date.asc())
        )
        payments = result.scalars().all()

        return [
            {
                "id": str(p.id),
                "description": p.description,
                "amount": p.amount,
                "due_date": p.due_date,
                "status": p.status.value if hasattr(p.status, 'value') else p.status
            }
            for p in payments
        ]

    def _project_monthly_sales(
        self,
        month: int,
        historical_sales: dict[int, Decimal],
        growth_factor: Decimal
    ) -> Decimal:
        """Project sales for a month based on historical data and growth factor."""
        # Get historical average for this month
        historical = historical_sales.get(month, Decimal("0"))

        # If no historical data, use seasonality patterns to estimate
        if historical == 0:
            # Use average of all months as base
            if historical_sales:
                avg_monthly = sum(historical_sales.values()) / len(historical_sales)
            else:
                avg_monthly = Decimal("1000000")  # Default fallback

            # Apply seasonality factor
            for pattern in SEASONALITY_PATTERNS:
                if month in pattern["months"]:
                    # Calculate proportion of this season
                    months_in_pattern = len(pattern["months"])
                    season_share = pattern["percentage"] / Decimal("100")
                    monthly_share = season_share / months_in_pattern
                    historical = avg_monthly * 12 * monthly_share
                    break

        # Apply growth factor
        return historical * growth_factor

    # ============================================
    # Planning Dashboard
    # ============================================

    async def get_planning_dashboard(self) -> dict:
        """Get combined planning dashboard data."""
        today = get_colombia_date()
        current_month = today.month

        # Determine current season
        current_season = "BAJA"
        season_message = "Temporada baja - Mantener reservas"
        for pattern in SEASONALITY_PATTERNS:
            if current_month in pattern["months"]:
                current_season = pattern["behavior"]
                if current_season == "ALTA":
                    season_message = "Temporada alta - Maximizar ventas"
                elif current_season == "MEDIA":
                    season_message = "Temporada media - Preparar inventario"
                break

        # Get current liquidity
        current_liquidity = await self._get_current_liquidity()

        # Get fixed expenses
        fixed_monthly = await self._get_fixed_expenses_monthly()

        # Get pending debt total
        pending_result = await self.db.execute(
            select(func.sum(DebtPaymentSchedule.amount)).where(
                DebtPaymentSchedule.status == DebtPaymentStatus.PENDING
            )
        )
        pending_debt = pending_result.scalar() or Decimal("0")

        # Get next debt payment
        next_debt_result = await self.db.execute(
            select(DebtPaymentSchedule).where(
                DebtPaymentSchedule.status == DebtPaymentStatus.PENDING,
                DebtPaymentSchedule.due_date >= today
            ).order_by(DebtPaymentSchedule.due_date.asc()).limit(1)
        )
        next_debt = next_debt_result.scalar_one_or_none()

        # Quick projection (3 months)
        projection = await self.get_cash_projection(months=3)

        return {
            "current_liquidity": current_liquidity,
            "current_date": today.isoformat(),
            "fixed_expenses_monthly": fixed_monthly,
            "pending_debt_total": pending_debt,
            "next_debt_payment": self._format_debt_payment(next_debt) if next_debt else None,
            "quick_projection": projection["projections"],
            "current_season": current_season,
            "season_message": season_message
        }
