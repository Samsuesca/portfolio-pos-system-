"""CFO Dashboard Service — métricas ejecutivas de salud financiera.

Extraído de `app/api/routes/cfo_dashboard.py` (antes ~320 líneas de lógica de
dominio inline en la ruta). Reusa las fuentes canónicas del modelo financiero:
- `PatrimonyService` para deuda/pasivos (mismo balance que Contabilidad),
- `compute_runway` para el runway neto (misma fuente que Proyección caja).

El runway, no la "burn rate fijos+nómina", define el cash runway, y la deuda
es el pasivo real completo (CxP + gastos pendientes + pasivos de balance).
"""
from datetime import timedelta
from decimal import Decimal

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.accounting import Expense, AccountsPayable
from app.models.product import Product
from app.models.fixed_expense import FixedExpense
from app.services.payroll_service import payroll_service
from app.services.patrimony import PatrimonyService
from app.services.accounting.financial_model._cash import current_cash_balance
from app.services.accounting.financial_model._runway import compute_runway
from app.utils.timezone import get_colombia_date

# Centinela "no aplica" (sin deuda a 30 días / sin nómina): se mantiene por
# compatibilidad con el frontend, que lo traduce a "Indefinido" / "N/A".
SENTINEL_NA = 999
DAYS_PER_MONTH = Decimal("30.4375")


class CFODashboardService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def _ap_due_sum(self, *conditions) -> Decimal:
        """Suma de cuentas por pagar abiertas (con due_date) que cumplen las
        condiciones de fecha dadas. amount_paid descuenta lo ya abonado."""
        ap_open = AccountsPayable.amount - AccountsPayable.amount_paid
        stmt = select(func.coalesce(func.sum(ap_open), 0)).where(
            AccountsPayable.is_paid == False,  # noqa: E712
            AccountsPayable.due_date.isnot(None),
            *conditions,
        )
        return Decimal(str((await self.db.execute(stmt)).scalar_one() or 0))

    async def get_health_metrics(self) -> dict:
        """Métricas integrales del Panel CFO: liquidez, deuda real, DSCR,
        cobertura de nómina, runway neto, calidad de datos y alertas."""
        today = get_colombia_date()

        # ===== 1. CASH BALANCES (liquidez disponible = efectivo) =====
        total_liquidity = await current_cash_balance(self.db)

        # ===== 2. DEBT METRICS (pasivo real completo, fuente canónica) =====
        patrimony = PatrimonyService(self.db)
        ap = await patrimony.get_global_accounts_payable()
        pending = await patrimony.get_global_pending_expenses()
        balance_debts = await patrimony.get_global_debts()
        total_debt = (
            Decimal(str(ap["total"]))
            + Decimal(str(pending["total"]))
            + Decimal(str(balance_debts["total"]))
        )

        # Vencimientos: desde cuentas por pagar (las que tienen due_date real).
        thirty_days = today + timedelta(days=30)
        debt_due_30_days = await self._ap_due_sum(AccountsPayable.due_date <= thirty_days)
        overdue_debt = await self._ap_due_sum(AccountsPayable.due_date < today)

        # ===== 3. PAYROLL METRICS =====
        payroll_summary = await payroll_service.get_payroll_summary(self.db)
        monthly_payroll = Decimal(str(payroll_summary.get("total_monthly_payroll", 0)))
        payroll_coverage_ratio = (
            float(total_liquidity / monthly_payroll) if monthly_payroll > 0 else SENTINEL_NA
        )
        can_cover_payroll = total_liquidity >= monthly_payroll

        # ===== 4. DATA QUALITY METRICS =====
        products_with_cost = (await self.db.execute(
            select(func.count(Product.id)).where(Product.cost.isnot(None), Product.cost > 0)
        )).scalar_one() or 0
        products_without_cost = (await self.db.execute(
            select(func.count(Product.id)).where((Product.cost.is_(None)) | (Product.cost == 0))
        )).scalar_one() or 0
        total_products = products_with_cost + products_without_cost
        data_quality_score = (
            round((products_with_cost / total_products) * 100, 1) if total_products > 0 else 0
        )

        # ===== 5. PENDING EXPENSES =====
        pending_expenses = Decimal(str((await self.db.execute(
            select(func.coalesce(func.sum(Expense.amount), 0)).where(Expense.is_paid == False)  # noqa: E712
        )).scalar_one() or 0))

        # ===== 6. MONTHLY FIXED EXPENSES =====
        monthly_fixed_expenses = Decimal(str((await self.db.execute(
            select(func.coalesce(func.sum(FixedExpense.amount), 0)).where(FixedExpense.is_active == True)  # noqa: E712
        )).scalar_one() or 0))

        # ===== 7. CASH RUNWAY (burn neto canónico; fijos+nómina es informativo) =====
        monthly_burn_rate = monthly_fixed_expenses + monthly_payroll
        runway_info = await compute_runway(self.db)
        runway_months = runway_info["runway_months"]
        cash_runway_days = (
            int(runway_months * DAYS_PER_MONTH) if runway_months is not None else SENTINEL_NA
        )

        # ===== 8. DEBT SERVICE COVERAGE RATIO =====
        debt_service_coverage = (
            float(total_liquidity / debt_due_30_days) if debt_due_30_days > 0 else SENTINEL_NA
        )

        # ===== 9. ALERTS =====
        alerts: list[dict] = []
        if overdue_debt > 0:
            alerts.append({
                "type": "critical", "category": "debt",
                "message": f"Deuda vencida: ${overdue_debt:,.0f}",
                "amount": float(overdue_debt),
            })

        seven_days = today + timedelta(days=7)
        urgent_debt = await self._ap_due_sum(
            AccountsPayable.due_date >= today,
            AccountsPayable.due_date <= seven_days,
        )
        if urgent_debt > 0:
            alerts.append({
                "type": "warning", "category": "debt",
                "message": f"Deuda vence en 7 dias: ${urgent_debt:,.0f}",
                "amount": float(urgent_debt),
            })

        if cash_runway_days < 30:
            alerts.append({
                "type": "critical" if cash_runway_days < 15 else "warning",
                "category": "liquidity",
                "message": f"Runway: {cash_runway_days} dias",
                "amount": cash_runway_days,
            })

        if not can_cover_payroll:
            alerts.append({
                "type": "critical", "category": "payroll",
                "message": "Liquidez insuficiente para nomina",
                "amount": float(monthly_payroll - total_liquidity),
            })

        if data_quality_score < 50:
            alerts.append({
                "type": "warning", "category": "data_quality",
                "message": f"{products_without_cost} productos sin costo asignado",
                "amount": products_without_cost,
            })

        return {
            "as_of": today.isoformat(),
            "liquidity": {"total": float(total_liquidity), "currency": "COP"},
            "debt": {
                "total": float(total_debt),
                "overdue": float(overdue_debt),
                "due_30_days": float(debt_due_30_days),
                "debt_service_coverage_ratio": round(debt_service_coverage, 2),
            },
            "payroll": {
                "monthly_estimate": float(monthly_payroll),
                "employees": payroll_summary.get("active_employees", 0),
                "coverage_ratio": round(payroll_coverage_ratio, 2),
                "can_cover": can_cover_payroll,
                "integrated_with_fixed_expenses": payroll_summary.get("fixed_expense_integration") is not None,
            },
            "operations": {
                "monthly_fixed_expenses": float(monthly_fixed_expenses),
                "pending_expenses": float(pending_expenses),
                "monthly_burn_rate": float(monthly_burn_rate),
                "cash_runway_days": cash_runway_days,
            },
            "data_quality": {
                "score": data_quality_score,
                "products_with_cost": products_with_cost,
                "products_without_cost": products_without_cost,
            },
            "alerts": {
                "critical_count": len([a for a in alerts if a["type"] == "critical"]),
                "warning_count": len([a for a in alerts if a["type"] == "warning"]),
                "items": alerts,
            },
            "health_status": self._calculate_health_status(
                debt_service_coverage,
                payroll_coverage_ratio,
                cash_runway_days,
                data_quality_score,
                len([a for a in alerts if a["type"] == "critical"]),
            ),
        }

    @staticmethod
    def _calculate_health_status(
        dscr: float,
        payroll_coverage: float,
        runway_days: int,
        data_quality: float,
        critical_alerts: int,
    ) -> dict:
        """Estado general de salud financiera (0-100 ponderado)."""
        scores = {
            "debt_service": min(100, dscr * 50) if dscr < 2 else 100,  # DSCR >= 2 sano
            "payroll": min(100, payroll_coverage * 100) if payroll_coverage < 1 else 100,
            "runway": min(100, (runway_days / 90) * 100),  # 90 días = score completo
            "data_quality": data_quality,
        }
        weights = {"debt_service": 0.35, "payroll": 0.30, "runway": 0.25, "data_quality": 0.10}
        overall_score = sum(scores[k] * weights[k] for k in scores)
        overall_score = max(0, overall_score - (critical_alerts * 10))

        if overall_score >= 80:
            status, label, color = "healthy", "Saludable", "green"
        elif overall_score >= 60:
            status, label, color = "caution", "Precaucion", "yellow"
        elif overall_score >= 40:
            status, label, color = "warning", "Advertencia", "orange"
        else:
            status, label, color = "critical", "Critico", "red"

        return {
            "status": status,
            "label": label,
            "color": color,
            "score": round(overall_score, 1),
            "breakdown": {k: round(scores[k], 1) for k in scores},
        }
