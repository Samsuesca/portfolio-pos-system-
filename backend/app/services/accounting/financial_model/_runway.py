"""Cálculo único de cash runway compartido por forecast, alerts y
executive_summary.

Antes había 3 cálculos divergentes (forecast extrapolaba 12 semanas × 4.33,
alerts tomaba 3 meses directos), lo que producía 1.2 meses en Alertas vs
2.0 en Proyección caja. Esta inconsistencia erosiona la confianza del
usuario porque el "mismo" KPI cambia según en qué tab lo mire.

Convención adoptada: **3 meses calendario hacia atrás como ventana**.
Más estable que semanas (no afectado por meses con 5 viernes) y
representa "lo que el negocio gastó/ingresó en el trimestre reciente".
"""
from __future__ import annotations

from decimal import Decimal
from datetime import date

from dateutil.relativedelta import relativedelta
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.accounting import (
    Expense,
    Transaction,
    TransactionType,
)
from app.services.accounting.financial_model._cash import current_cash_balance
from app.services.accounting.financial_model._math import safe_ratio
from app.utils.timezone import get_colombia_date

ZERO = Decimal("0")
DEFAULT_BURN_WINDOW_MONTHS = 3


def calculate_cash_runway(
    cash_balance: Decimal | None,
    avg_monthly_burn: Decimal | None,
) -> Decimal | None:
    """Single source of truth para runway en meses.

    - Devuelve `None` cuando el negocio es rentable (`burn <= 0`) o cuando
      faltan datos. El frontend muestra `—` o "negocio rentable" según
      contexto en lugar de un centinela tipo `999`.
    - Usa `safe_ratio` internamente para protegerse de divisor 0.
    """
    if cash_balance is None or avg_monthly_burn is None:
        return None
    if avg_monthly_burn <= ZERO:
        return None  # rentable, no hay quema
    return safe_ratio(cash_balance, avg_monthly_burn)


async def get_current_cash_balance(db: AsyncSession) -> Decimal:
    """Saldo actual de activos corrientes (caja + banco + Nequi).

    Delega en la fuente canónica ``_cash.current_cash_balance``; se conserva
    este wrapper por los consumidores que ya lo importan.
    """
    return await current_cash_balance(db)


async def get_avg_monthly_burn(
    db: AsyncSession,
    months: int = DEFAULT_BURN_WINDOW_MONTHS,
    today: date | None = None,
) -> Decimal:
    """Quema mensual promedio = gastos - ingresos en los últimos `months`
    meses. Devuelve ZERO si el negocio fue rentable en la ventana
    (caller debe interpretar como "sin quema, runway no aplica")."""
    today = today or get_colombia_date()
    start = today - relativedelta(months=months)

    income_stmt = select(func.coalesce(func.sum(Transaction.amount), ZERO)).where(
        Transaction.type == TransactionType.INCOME,
        Transaction.transaction_date >= start,
        Transaction.transaction_date <= today,
    )
    expense_stmt = select(func.coalesce(func.sum(Expense.amount), ZERO)).where(
        Expense.is_active == True,  # noqa: E712
        Expense.expense_date >= start,
        Expense.expense_date <= today,
    )

    income_total = Decimal(str((await db.execute(income_stmt)).scalar()))
    expense_total = Decimal(str((await db.execute(expense_stmt)).scalar()))

    avg_monthly_income = safe_ratio(income_total, Decimal(str(months))) or ZERO
    avg_monthly_expenses = safe_ratio(expense_total, Decimal(str(months))) or ZERO
    return avg_monthly_expenses - avg_monthly_income


async def compute_runway(
    db: AsyncSession,
    months_window: int = DEFAULT_BURN_WINDOW_MONTHS,
) -> dict:
    """Punto único de cálculo. Devuelve un dict con todos los inputs
    intermedios para que los consumers no recalculen."""
    cash_balance = await get_current_cash_balance(db)
    avg_monthly_burn = await get_avg_monthly_burn(db, months=months_window)
    runway = calculate_cash_runway(cash_balance, avg_monthly_burn)
    return {
        "cash_balance": cash_balance,
        "avg_monthly_burn": avg_monthly_burn,
        "runway_months": runway,
        "is_profitable": avg_monthly_burn <= ZERO,
        "window_months": months_window,
    }
