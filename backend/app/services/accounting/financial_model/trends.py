"""
Module 3: Trend Analysis Service
"""
from decimal import Decimal
from datetime import date, timedelta
from dateutil.relativedelta import relativedelta
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
import statistics

from app.models.accounting import (
    Transaction, TransactionType, Expense, BalanceAccount, AccountType
)
from app.utils.timezone import get_colombia_date

ZERO = Decimal("0")
HUNDRED = Decimal("100")
MONTH_NAMES_ES = [
    "", "Ene", "Feb", "Mar", "Abr", "May", "Jun",
    "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"
]


class TrendAnalysisService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_trends(
        self,
        metrics: list[str] | None = None,
        period: str = "monthly",
        start_date: date | None = None,
        end_date: date | None = None,
    ) -> dict:
        today = get_colombia_date()
        if not end_date:
            end_date = today
        if not start_date:
            start_date = today - relativedelta(months=12)

        if not metrics:
            metrics = ["revenue", "expenses", "profit", "cash_position"]

        series = []
        anomalies = []

        # Generate monthly periods
        periods = self._generate_periods(start_date, end_date)

        for metric in metrics:
            if metric == "revenue":
                data = await self._revenue_series(periods)
                series.append(self._build_series("revenue", "Ingresos", data, periods))
            elif metric == "expenses":
                data = await self._expense_series(periods)
                series.append(self._build_series("expenses", "Gastos", data, periods))
            elif metric == "profit":
                rev_data = await self._revenue_series(periods)
                exp_data = await self._expense_series(periods)
                profit_data = [r - e for r, e in zip(rev_data, exp_data)]
                series.append(self._build_series("profit", "Utilidad Neta", profit_data, periods))
            elif metric == "cash_position":
                data = await self._cash_position_series(periods)
                series.append(self._build_series("cash_position", "Posición de Caja", data, periods))

        # Detect anomalies
        for s in series:
            values = [float(d["value"]) for d in s["data"]]
            if len(values) >= 4:
                mean = statistics.mean(values)
                stdev = statistics.stdev(values) if len(values) > 1 else 0
                if stdev > 0:
                    for i, v in enumerate(values):
                        z_score = abs(v - mean) / stdev
                        if z_score > 2:
                            anomalies.append({
                                "metric": s["metric"],
                                "period": s["data"][i]["period"],
                                "value": Decimal(str(v)),
                                "z_score": round(z_score, 2),
                                "direction": "spike" if v > mean else "drop",
                            })

        return {
            "start_date": start_date,
            "end_date": end_date,
            "period": period,
            "series": series,
            "anomalies": anomalies,
        }

    def _generate_periods(self, start: date, end: date) -> list[tuple[date, date, str, str]]:
        periods = []
        current = start.replace(day=1)
        while current <= end:
            m_end = (current + relativedelta(months=1)) - timedelta(days=1)
            if m_end > end:
                m_end = end
            label = f"{MONTH_NAMES_ES[current.month]} {current.year}"
            periods.append((current, m_end, current.strftime("%Y-%m"), label))
            current = current + relativedelta(months=1)
        return periods

    async def _revenue_series(self, periods) -> list[Decimal]:
        result = []
        for start, end, _, _ in periods:
            stmt = select(func.coalesce(func.sum(Transaction.amount), 0)).where(
                Transaction.type == TransactionType.INCOME,
                Transaction.transaction_date >= start,
                Transaction.transaction_date <= end,
            )
            r = await self.db.execute(stmt)
            result.append(Decimal(str(r.scalar())))
        return result

    async def _expense_series(self, periods) -> list[Decimal]:
        result = []
        for start, end, _, _ in periods:
            stmt = select(func.coalesce(func.sum(Expense.amount), 0)).where(
                Expense.is_active == True,
                Expense.expense_date >= start,
                Expense.expense_date <= end,
            )
            r = await self.db.execute(stmt)
            result.append(Decimal(str(r.scalar())))
        return result

    async def _cash_position_series(self, periods) -> list[Decimal]:
        """Get cash balance at end of each period using transaction sums."""
        # Current balance
        stmt = select(func.coalesce(func.sum(BalanceAccount.balance), 0)).where(
            BalanceAccount.account_type == AccountType.ASSET_CURRENT,
            BalanceAccount.is_active == True,
        )
        r = await self.db.execute(stmt)
        current_balance = Decimal(str(r.scalar()))

        today = get_colombia_date()
        # Work backward from current balance
        result = []
        for start, end, _, _ in reversed(periods):
            if end >= today:
                result.append(current_balance)
            else:
                # Estimate balance at that point by subtracting subsequent net flows
                income_stmt = select(func.coalesce(func.sum(Transaction.amount), 0)).where(
                    Transaction.type == TransactionType.INCOME,
                    Transaction.transaction_date > end,
                    Transaction.transaction_date <= today,
                )
                inc_r = await self.db.execute(income_stmt)
                income_after = Decimal(str(inc_r.scalar()))

                exp_stmt = select(func.coalesce(func.sum(Transaction.amount), 0)).where(
                    Transaction.type == TransactionType.EXPENSE,
                    Transaction.transaction_date > end,
                    Transaction.transaction_date <= today,
                )
                exp_r = await self.db.execute(exp_stmt)
                expense_after = Decimal(str(exp_r.scalar()))

                balance_at_period = current_balance - income_after + expense_after
                result.append(balance_at_period)

        result.reverse()
        return result

    def _build_series(
        self, metric: str, label: str, data: list[Decimal], periods
    ) -> dict:
        data_points = []
        for i, (_, _, period_key, period_label) in enumerate(periods):
            data_points.append({
                "period": period_key,
                "period_label": period_label,
                "value": data[i] if i < len(data) else ZERO,
            })

        # Growth rate (last vs first)
        growth = None
        if len(data) >= 2 and data[0] > ZERO:
            growth = (data[-1] - data[0]) / data[0] * HUNDRED

        # Moving averages
        ma3 = self._moving_average(data, 3)
        ma6 = self._moving_average(data, 6)

        return {
            "metric": metric,
            "label": label,
            "data": data_points,
            "growth_rate": growth,
            "moving_avg_3m": ma3,
            "moving_avg_6m": ma6,
        }

    def _moving_average(self, data: list[Decimal], window: int) -> list[Decimal]:
        result = []
        for i in range(len(data)):
            if i < window - 1:
                result.append(ZERO)
            else:
                window_data = data[i - window + 1:i + 1]
                avg = sum(window_data) / len(window_data)
                result.append(avg)
        return result
