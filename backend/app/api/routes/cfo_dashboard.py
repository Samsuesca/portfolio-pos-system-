"""
CFO Dashboard API Routes - Executive financial health metrics
"""
from datetime import date, timedelta
from decimal import Decimal
from fastapi import APIRouter, Depends

from app.utils.timezone import get_colombia_date
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import DatabaseSession, CurrentUser, require_any_school_admin
from app.models.accounting import (
    BalanceAccount, AccountType, Expense
)
from app.models.product import Product
from app.models.fixed_expense import FixedExpense
from app.services.payroll_service import payroll_service


router = APIRouter(prefix="/cfo-dashboard", tags=["CFO Dashboard"])


@router.get(
    "/health-metrics",
    summary="Get CFO financial health metrics",
    description="Returns comprehensive financial health indicators for executive decision-making",
    dependencies=[Depends(require_any_school_admin)]
)
async def get_health_metrics(
    db: DatabaseSession,
    current_user: CurrentUser,
):
    """
    Get comprehensive CFO dashboard metrics:
    - Cash runway (days until cash = 0)
    - Debt service coverage ratio
    - Payroll coverage status
    - Data quality score
    - Urgent alerts count
    """
    today = get_colombia_date()

    # ========== 1. CASH BALANCES ==========
    # Get current cash and bank balances
    cash_stmt = select(
        func.coalesce(func.sum(BalanceAccount.balance), 0)
    ).where(
        BalanceAccount.account_type == AccountType.ASSET_CURRENT,
        BalanceAccount.is_active == True
    )
    cash_result = await db.execute(cash_stmt)
    total_liquidity = Decimal(str(cash_result.scalar_one() or 0))

    # ========== 2. DEBT METRICS ==========
    # Total debt (long-term liabilities)
    debt_stmt = select(
        func.coalesce(func.sum(BalanceAccount.balance), 0)
    ).where(
        BalanceAccount.account_type == AccountType.LIABILITY_LONG,
        BalanceAccount.is_active == True
    )
    debt_result = await db.execute(debt_stmt)
    total_debt = Decimal(str(debt_result.scalar_one() or 0))

    # Debt due in next 30 days
    thirty_days = today + timedelta(days=30)
    upcoming_debt_stmt = select(
        func.coalesce(func.sum(BalanceAccount.balance), 0)
    ).where(
        BalanceAccount.account_type == AccountType.LIABILITY_LONG,
        BalanceAccount.is_active == True,
        BalanceAccount.due_date <= thirty_days
    )
    upcoming_debt_result = await db.execute(upcoming_debt_stmt)
    debt_due_30_days = Decimal(str(upcoming_debt_result.scalar_one() or 0))

    # Overdue debt
    overdue_debt_stmt = select(
        func.coalesce(func.sum(BalanceAccount.balance), 0)
    ).where(
        BalanceAccount.account_type == AccountType.LIABILITY_LONG,
        BalanceAccount.is_active == True,
        BalanceAccount.due_date < today
    )
    overdue_debt_result = await db.execute(overdue_debt_stmt)
    overdue_debt = Decimal(str(overdue_debt_result.scalar_one() or 0))

    # ========== 3. PAYROLL METRICS ==========
    payroll_summary = await payroll_service.get_payroll_summary(db)
    monthly_payroll = Decimal(str(payroll_summary.get("total_monthly_payroll", 0)))

    # Payroll coverage: can we cover next payroll?
    payroll_coverage_ratio = (
        float(total_liquidity / monthly_payroll) if monthly_payroll > 0 else 999
    )
    can_cover_payroll = total_liquidity >= monthly_payroll

    # ========== 4. DATA QUALITY METRICS ==========
    # Products with vs without cost
    products_with_cost_stmt = select(
        func.count(Product.id)
    ).where(
        Product.cost.isnot(None),
        Product.cost > 0
    )
    products_with_cost_result = await db.execute(products_with_cost_stmt)
    products_with_cost = products_with_cost_result.scalar_one() or 0

    products_without_cost_stmt = select(
        func.count(Product.id)
    ).where(
        (Product.cost.is_(None)) | (Product.cost == 0)
    )
    products_without_cost_result = await db.execute(products_without_cost_stmt)
    products_without_cost = products_without_cost_result.scalar_one() or 0

    total_products = products_with_cost + products_without_cost
    data_quality_score = (
        round((products_with_cost / total_products) * 100, 1)
        if total_products > 0 else 0
    )

    # ========== 5. PENDING EXPENSES ==========
    pending_expenses_stmt = select(
        func.coalesce(func.sum(Expense.amount), 0)
    ).where(
        Expense.is_paid == False
    )
    pending_expenses_result = await db.execute(pending_expenses_stmt)
    pending_expenses = Decimal(str(pending_expenses_result.scalar_one() or 0))

    # ========== 6. MONTHLY FIXED EXPENSES PROJECTION ==========
    fixed_expenses_stmt = select(
        func.coalesce(func.sum(FixedExpense.amount), 0)
    ).where(
        FixedExpense.is_active == True
    )
    fixed_expenses_result = await db.execute(fixed_expenses_stmt)
    monthly_fixed_expenses = Decimal(str(fixed_expenses_result.scalar_one() or 0))

    # ========== 7. CASH RUNWAY CALCULATION ==========
    # Monthly burn rate = fixed expenses + payroll
    monthly_burn_rate = monthly_fixed_expenses + monthly_payroll
    daily_burn_rate = monthly_burn_rate / Decimal("30") if monthly_burn_rate > 0 else Decimal("0")

    # Cash runway in days
    cash_runway_days = (
        int(total_liquidity / daily_burn_rate) if daily_burn_rate > 0 else 999
    )

    # ========== 8. DEBT SERVICE COVERAGE RATIO ==========
    # DSCR = Available Cash / Debt Payments Due (30 days)
    debt_service_coverage = (
        float(total_liquidity / debt_due_30_days) if debt_due_30_days > 0 else 999
    )

    # ========== 9. ALERTS COUNT ==========
    alerts = []

    # Alert: Overdue debt
    if overdue_debt > 0:
        alerts.append({
            "type": "critical",
            "category": "debt",
            "message": f"Deuda vencida: ${overdue_debt:,.0f}",
            "amount": float(overdue_debt)
        })

    # Alert: Debt due within 7 days
    seven_days = today + timedelta(days=7)
    urgent_debt_stmt = select(
        func.coalesce(func.sum(BalanceAccount.balance), 0)
    ).where(
        BalanceAccount.account_type == AccountType.LIABILITY_LONG,
        BalanceAccount.is_active == True,
        BalanceAccount.due_date <= seven_days,
        BalanceAccount.due_date >= today
    )
    urgent_debt_result = await db.execute(urgent_debt_stmt)
    urgent_debt = Decimal(str(urgent_debt_result.scalar_one() or 0))

    if urgent_debt > 0:
        alerts.append({
            "type": "warning",
            "category": "debt",
            "message": f"Deuda vence en 7 dias: ${urgent_debt:,.0f}",
            "amount": float(urgent_debt)
        })

    # Alert: Low cash runway
    if cash_runway_days < 30:
        alerts.append({
            "type": "critical" if cash_runway_days < 15 else "warning",
            "category": "liquidity",
            "message": f"Runway: {cash_runway_days} dias",
            "amount": cash_runway_days
        })

    # Alert: Cannot cover payroll
    if not can_cover_payroll:
        alerts.append({
            "type": "critical",
            "category": "payroll",
            "message": f"Liquidez insuficiente para nomina",
            "amount": float(monthly_payroll - total_liquidity)
        })

    # Alert: Low data quality
    if data_quality_score < 50:
        alerts.append({
            "type": "warning",
            "category": "data_quality",
            "message": f"{products_without_cost} productos sin costo asignado",
            "amount": products_without_cost
        })

    return {
        "as_of": today.isoformat(),
        "liquidity": {
            "total": float(total_liquidity),
            "currency": "COP"
        },
        "debt": {
            "total": float(total_debt),
            "overdue": float(overdue_debt),
            "due_30_days": float(debt_due_30_days),
            "debt_service_coverage_ratio": round(debt_service_coverage, 2)
        },
        "payroll": {
            "monthly_estimate": float(monthly_payroll),
            "employees": payroll_summary.get("active_employees", 0),
            "coverage_ratio": round(payroll_coverage_ratio, 2),
            "can_cover": can_cover_payroll,
            "integrated_with_fixed_expenses": payroll_summary.get("fixed_expense_integration") is not None
        },
        "operations": {
            "monthly_fixed_expenses": float(monthly_fixed_expenses),
            "pending_expenses": float(pending_expenses),
            "monthly_burn_rate": float(monthly_burn_rate),
            "cash_runway_days": cash_runway_days
        },
        "data_quality": {
            "score": data_quality_score,
            "products_with_cost": products_with_cost,
            "products_without_cost": products_without_cost
        },
        "alerts": {
            "critical_count": len([a for a in alerts if a["type"] == "critical"]),
            "warning_count": len([a for a in alerts if a["type"] == "warning"]),
            "items": alerts
        },
        "health_status": _calculate_health_status(
            debt_service_coverage,
            payroll_coverage_ratio,
            cash_runway_days,
            data_quality_score,
            len([a for a in alerts if a["type"] == "critical"])
        )
    }


def _calculate_health_status(
    dscr: float,
    payroll_coverage: float,
    runway_days: int,
    data_quality: float,
    critical_alerts: int
) -> dict:
    """Calculate overall financial health status"""
    # Score each metric (0-100 scale)
    scores = {
        "debt_service": min(100, dscr * 50) if dscr < 2 else 100,  # DSCR >= 2 is healthy
        "payroll": min(100, payroll_coverage * 100) if payroll_coverage < 1 else 100,
        "runway": min(100, (runway_days / 90) * 100),  # 90 days = full score
        "data_quality": data_quality
    }

    # Weighted average (debt and payroll matter most)
    weights = {
        "debt_service": 0.35,
        "payroll": 0.30,
        "runway": 0.25,
        "data_quality": 0.10
    }

    overall_score = sum(
        scores[key] * weights[key]
        for key in scores
    )

    # Penalty for critical alerts
    overall_score = max(0, overall_score - (critical_alerts * 10))

    # Determine status
    if overall_score >= 80:
        status = "healthy"
        label = "Saludable"
        color = "green"
    elif overall_score >= 60:
        status = "caution"
        label = "Precaucion"
        color = "yellow"
    elif overall_score >= 40:
        status = "warning"
        label = "Advertencia"
        color = "orange"
    else:
        status = "critical"
        label = "Critico"
        color = "red"

    return {
        "status": status,
        "label": label,
        "color": color,
        "score": round(overall_score, 1),
        "breakdown": {
            key: round(scores[key], 1) for key in scores
        }
    }
