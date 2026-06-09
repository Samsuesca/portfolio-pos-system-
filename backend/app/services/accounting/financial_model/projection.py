"""
ProjectionService — Multi-month financial projection (P&L + cash flow).

Genera proyecciones mes a mes a partir de assumptions:
- Revenue × estacionalidad × crecimiento
- COGS según margen target
- Costos fijos + payroll + hiring_plan
- Capa de formalización (one-time + recurring)
- Nueva sucursal con revenue ramp
- Cronograma de deudas (intereses + capital)
- Cash flow acumulado con flag de mes negativo

Persiste en `financial_projections` para auditoría y comparativa de escenarios.
"""
from decimal import Decimal
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.financial_model import FinancialProjection
from app.utils.timezone import get_colombia_now_naive

if TYPE_CHECKING:
    from app.schemas.financial_model import (
        ProjectionAssumptions,
        ProjectionMonth,
        ProjectionRunResponse,
        ProjectionSummary,
    )


MONTH_NAMES_ES = {
    1: "Enero", 2: "Febrero", 3: "Marzo", 4: "Abril",
    5: "Mayo", 6: "Junio", 7: "Julio", 8: "Agosto",
    9: "Septiembre", 10: "Octubre", 11: "Noviembre", 12: "Diciembre",
}


class ProjectionService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def run_projection(
        self,
        assumptions: "ProjectionAssumptions",
        created_by: UUID | None = None,
        persist: bool = True,
    ) -> "ProjectionRunResponse":
        """Compute monthly projections and optionally persist to DB."""
        from app.schemas.financial_model import (
            ProjectionMonth,
            ProjectionRunResponse,
            ProjectionSummary,
        )

        months_data: list[ProjectionMonth] = []
        cumulative_cash = Decimal(str(assumptions.initial_cash))
        min_cash = cumulative_cash

        # Inflation factor (compounding monthly from annual)
        monthly_inflation = Decimal(str((1 + assumptions.inflation_annual) ** (1 / 12) - 1))

        for offset in range(assumptions.months):
            year, month = self._add_months(
                assumptions.start_year, assumptions.start_month, offset
            )
            month_proj = self._compute_month(
                offset=offset,
                year=year,
                month=month,
                assumptions=assumptions,
                monthly_inflation=monthly_inflation,
                cumulative_cash_in=cumulative_cash,
            )
            cumulative_cash = month_proj.cumulative_cash
            min_cash = min(min_cash, cumulative_cash)
            months_data.append(month_proj)

        summary = self._build_summary(months_data, min_cash, assumptions)

        response = ProjectionRunResponse(
            id=None,
            name=assumptions.name,
            assumptions=assumptions,
            months=months_data,
            summary=summary,
            generated_at=get_colombia_now_naive(),
        )

        if persist:
            row = FinancialProjection(
                name=assumptions.name,
                scenario_label=(
                    assumptions.formalization_layer.scenario_label
                    if assumptions.formalization_layer else None
                ),
                months_count=assumptions.months,
                start_year=assumptions.start_year,
                start_month=assumptions.start_month,
                assumptions=assumptions.model_dump(mode="json"),
                results=[m.model_dump(mode="json") for m in months_data],
                summary=summary.model_dump(mode="json"),
                created_by=created_by,
            )
            self.db.add(row)
            await self.db.flush()
            response.id = row.id

        return response

    def _compute_month(
        self,
        offset: int,
        year: int,
        month: int,
        assumptions: "ProjectionAssumptions",
        monthly_inflation: Decimal,
        cumulative_cash_in: Decimal,
    ) -> "ProjectionMonth":
        from app.schemas.financial_model import ProjectionMonth

        # 1. Revenue: base × seasonality × growth × inflation
        seasonality = Decimal(str(assumptions.seasonality.get(month, 1.0)))
        growth_factor = (Decimal("1") + Decimal(str(assumptions.growth_rate_monthly))) ** offset
        inflation_factor = (Decimal("1") + monthly_inflation) ** offset

        revenue = (
            Decimal(str(assumptions.base_revenue_monthly))
            * seasonality
            * growth_factor
            * inflation_factor
        )

        # New branches contribute additional revenue from their opening month
        for branch in assumptions.new_branches:
            if offset >= branch.month_offset:
                idx = offset - branch.month_offset
                if branch.revenue_ramp:
                    if idx < len(branch.revenue_ramp):
                        revenue += Decimal(str(branch.revenue_ramp[idx]))
                    else:
                        revenue += Decimal(str(branch.revenue_ramp[-1]))
                else:
                    # No ramp = same as base from day 1, scaled by seasonality
                    revenue += (
                        Decimal(str(assumptions.base_revenue_monthly))
                        * seasonality
                        * Decimal("0.6")  # conservative ramp default
                    )

        # 2. COGS — retail usa cogs_pct; el B2B trae su propio margen y NO se
        # multiplica por la estacionalidad escolar (timing contracalendario).
        retail_revenue = revenue
        retail_cogs = retail_revenue * Decimal(str(assumptions.cogs_pct))
        b2b_revenue, b2b_cogs, b2b_cash_in = self._compute_b2b_month(
            assumptions, year, month, offset
        )
        revenue = retail_revenue + b2b_revenue
        cogs = retail_cogs + b2b_cogs
        gross_profit = revenue - cogs
        gross_margin_pct = float((gross_profit / revenue * 100) if revenue > 0 else Decimal("0"))

        # 3. Fixed costs (with inflation)
        fixed_costs = Decimal(str(assumptions.fixed_costs_monthly)) * inflation_factor
        for branch in assumptions.new_branches:
            if offset >= branch.month_offset:
                fixed_costs += Decimal(str(branch.fixed_costs_monthly)) * inflation_factor

        # 4. Payroll: base + hires up to this month + new branches payroll
        payroll = Decimal(str(assumptions.payroll_monthly_base)) * inflation_factor
        headcount_base = self._estimate_base_headcount(assumptions.payroll_monthly_base)
        new_hires = 0
        for hire in assumptions.hiring_plan:
            if offset < hire.month_offset:
                continue
            if hire.end_month_offset is not None and offset > hire.end_month_offset:
                continue
            hire_cost = Decimal(str(hire.monthly_salary)) * (
                Decimal("1") + Decimal(str(hire.parafiscales_pct))
            )
            payroll += hire_cost * inflation_factor
            new_hires += 1
        for branch in assumptions.new_branches:
            if offset >= branch.month_offset:
                payroll += Decimal(str(branch.payroll_monthly)) * inflation_factor

        # 5. Formalization layer
        formalization_one_time = Decimal("0")
        formalization_recurring = Decimal("0")
        if assumptions.formalization_layer:
            for ot in assumptions.formalization_layer.one_time_costs:
                if ot.month_offset == offset:
                    formalization_one_time += Decimal(str(ot.amount))
            for rec in assumptions.formalization_layer.recurring_costs:
                if (
                    offset >= rec.starts_month_offset
                    and (rec.ends_month_offset is None or offset <= rec.ends_month_offset)
                ):
                    formalization_recurring += Decimal(str(rec.amount_monthly))

        total_opex = fixed_costs + payroll + formalization_one_time + formalization_recurring
        operating_profit = gross_profit - total_opex
        operating_margin_pct = float(
            (operating_profit / revenue * 100) if revenue > 0 else Decimal("0")
        )

        # 6. Debt: interest expense (P&L) + capital payments (cash but not P&L)
        interest_expense = Decimal("0")
        debt_capital_payment = Decimal("0")
        for debt in assumptions.debts:
            if offset < debt.starts_month_offset:
                continue
            term = debt.term_months
            relative_offset = offset - debt.starts_month_offset
            if term is not None and relative_offset >= term:
                continue
            interest_expense += Decimal(str(debt.interest_portion_monthly))
            debt_capital_payment += Decimal(str(debt.capital_portion_monthly))

        net_profit = operating_profit - interest_expense
        net_margin_pct = float((net_profit / revenue * 100) if revenue > 0 else Decimal("0"))

        # 7. Cash flow — retail cobra ~al instante; el B2B aporta su caja propia
        # (anticipo + saldo a crédito diferido) calculada en _compute_b2b_month.
        cash_inflow = retail_revenue + b2b_cash_in
        cash_outflow = (
            cogs + fixed_costs + payroll + formalization_one_time + formalization_recurring
            + interest_expense + debt_capital_payment
        )
        net_cash_flow = cash_inflow - cash_outflow
        cumulative_cash = cumulative_cash_in + net_cash_flow

        # 8. Headcount
        headcount = headcount_base + new_hires
        for branch in assumptions.new_branches:
            if offset >= branch.month_offset:
                # Estimar 2 personas por sucursal nueva (simplificación)
                headcount += 2

        return ProjectionMonth(
            year=year,
            month=month,
            period_label=f"{MONTH_NAMES_ES[month]} {year}",
            revenue=revenue.quantize(Decimal("0.01")),
            cogs=cogs.quantize(Decimal("0.01")),
            gross_profit=gross_profit.quantize(Decimal("0.01")),
            gross_margin_pct=round(gross_margin_pct, 2),
            b2b_revenue=b2b_revenue.quantize(Decimal("0.01")),
            fixed_costs=fixed_costs.quantize(Decimal("0.01")),
            payroll=payroll.quantize(Decimal("0.01")),
            formalization_cost_one_time=formalization_one_time.quantize(Decimal("0.01")),
            formalization_cost_recurring=formalization_recurring.quantize(Decimal("0.01")),
            total_opex=total_opex.quantize(Decimal("0.01")),
            operating_profit=operating_profit.quantize(Decimal("0.01")),
            operating_margin_pct=round(operating_margin_pct, 2),
            interest_expense=interest_expense.quantize(Decimal("0.01")),
            debt_capital_payment=debt_capital_payment.quantize(Decimal("0.01")),
            net_profit=net_profit.quantize(Decimal("0.01")),
            net_margin_pct=round(net_margin_pct, 2),
            cash_inflow=cash_inflow.quantize(Decimal("0.01")),
            cash_outflow=cash_outflow.quantize(Decimal("0.01")),
            net_cash_flow=net_cash_flow.quantize(Decimal("0.01")),
            cumulative_cash=cumulative_cash.quantize(Decimal("0.01")),
            headcount=headcount,
            below_breakeven=(operating_profit < 0),
            cash_negative=(cumulative_cash < 0),
        )

    @staticmethod
    def _is_b2b_cycle_month(first_cycle_month: int, cycles_per_year: int, month: int) -> bool:
        """True si `month` (1-12) es un mes de ciclo del contrato recurrente."""
        if cycles_per_year <= 0:
            return False
        interval = max(1, 12 // cycles_per_year)
        return any(
            ((first_cycle_month - 1 + k * interval) % 12) + 1 == month
            for k in range(cycles_per_year)
        )

    def _compute_b2b_month(
        self,
        assumptions: "ProjectionAssumptions",
        year: int,
        month: int,
        offset: int,
    ) -> tuple[Decimal, Decimal, Decimal]:
        """Aporte B2B del mes: (revenue, cogs, cash_in).

        Reglas (del modelo de negocio B2B):
        - Contracalendario: NO se multiplica por la estacionalidad escolar.
        - Margen propio por contrato (no el cogs_pct retail).
        - Ingreso (P&L) en el mes del ciclo/entrega; el saldo a crédito difiere
          su CAJA `payment_terms_days` (≈ meses) después del ciclo.
        - One-shots ponderados por probabilidad en el escenario base.
        """
        pipeline = getattr(assumptions, "b2b_pipeline", None)
        if not pipeline:
            return Decimal("0"), Decimal("0"), Decimal("0")

        revenue = Decimal("0")
        cogs = Decimal("0")
        cash_in = Decimal("0")

        for rc in pipeline.recurring_contracts:
            amount = Decimal(str(rc.amount_per_cycle))
            margin = Decimal(str(rc.gross_margin_pct))
            deposit_pct = Decimal(str(rc.deposit_pct))
            terms_months = max(0, round(rc.payment_terms_days / 30))

            if self._is_b2b_cycle_month(rc.first_cycle_month, rc.cycles_per_year, month):
                revenue += amount
                cogs += amount * (Decimal("1") - margin)
                cash_in += amount * deposit_pct  # anticipo entra al instante
                if terms_months == 0:
                    cash_in += amount * (Decimal("1") - deposit_pct)
            # Saldo a crédito de un ciclo anterior que cae a caja este mes.
            if terms_months > 0 and offset - terms_months >= 0:
                origin_month = ((month - 1 - terms_months) % 12) + 1
                if self._is_b2b_cycle_month(rc.first_cycle_month, rc.cycles_per_year, origin_month):
                    cash_in += amount * (Decimal("1") - deposit_pct)

        for os in pipeline.one_shot_pipeline:
            if os.expected_month_offset == offset:
                weighted = Decimal(str(os.amount)) * Decimal(str(os.probability))
                margin = Decimal(str(os.gross_margin_pct))
                revenue += weighted
                cogs += weighted * (Decimal("1") - margin)
                cash_in += weighted  # evento: contado a la entrega

        nca = pipeline.new_client_acquisition
        if nca and offset >= nca.ramp_start_month_offset:
            monthly = Decimal(str(nca.contracts_per_quarter)) / Decimal("3")
            amount = monthly * Decimal(str(nca.avg_contract_value))
            margin = Decimal(str(nca.avg_gross_margin_pct))
            revenue += amount
            cogs += amount * (Decimal("1") - margin)
            cash_in += amount

        return (
            revenue.quantize(Decimal("0.01")),
            cogs.quantize(Decimal("0.01")),
            cash_in.quantize(Decimal("0.01")),
        )

    def _build_summary(
        self,
        months: list["ProjectionMonth"],
        min_cash: Decimal,
        assumptions: "ProjectionAssumptions",
    ) -> "ProjectionSummary":
        from app.schemas.financial_model import ProjectionSummary

        total_revenue = sum((m.revenue for m in months), Decimal("0"))
        total_cogs = sum((m.cogs for m in months), Decimal("0"))
        total_gross_profit = sum((m.gross_profit for m in months), Decimal("0"))
        total_b2b_revenue = sum((m.b2b_revenue for m in months), Decimal("0"))
        total_opex = sum((m.total_opex for m in months), Decimal("0"))
        total_form_one_time = sum((m.formalization_cost_one_time for m in months), Decimal("0"))
        total_form_recurring = sum((m.formalization_cost_recurring for m in months), Decimal("0"))
        total_op_profit = sum((m.operating_profit for m in months), Decimal("0"))
        total_interest = sum((m.interest_expense for m in months), Decimal("0"))
        total_debt_capital = sum((m.debt_capital_payment for m in months), Decimal("0"))
        total_net_profit = sum((m.net_profit for m in months), Decimal("0"))

        n = len(months) or 1
        avg_gm_pct = total_gross_profit / total_revenue * 100 if total_revenue > 0 else Decimal("0")
        avg_op_pct = total_op_profit / total_revenue * 100 if total_revenue > 0 else Decimal("0")
        avg_net_pct = total_net_profit / total_revenue * 100 if total_revenue > 0 else Decimal("0")

        avg_monthly_fixed = (
            sum((m.fixed_costs + m.payroll + m.formalization_cost_recurring for m in months), Decimal("0"))
            / Decimal(n)
        )
        avg_gm_pct_decimal = avg_gm_pct / Decimal("100")
        breakeven_revenue_monthly = (
            avg_monthly_fixed / avg_gm_pct_decimal if avg_gm_pct_decimal > 0 else Decimal("0")
        )

        return ProjectionSummary(
            total_revenue=total_revenue.quantize(Decimal("0.01")),
            total_cogs=total_cogs.quantize(Decimal("0.01")),
            total_gross_profit=total_gross_profit.quantize(Decimal("0.01")),
            avg_gross_margin_pct=round(float(avg_gm_pct), 2),
            total_b2b_revenue=total_b2b_revenue.quantize(Decimal("0.01")),
            b2b_revenue_pct=round(
                float(total_b2b_revenue / total_revenue * 100) if total_revenue > 0 else 0.0, 2
            ),
            total_opex=total_opex.quantize(Decimal("0.01")),
            total_formalization_one_time=total_form_one_time.quantize(Decimal("0.01")),
            total_formalization_recurring=total_form_recurring.quantize(Decimal("0.01")),
            total_operating_profit=total_op_profit.quantize(Decimal("0.01")),
            avg_operating_margin_pct=round(float(avg_op_pct), 2),
            total_interest_expense=total_interest.quantize(Decimal("0.01")),
            total_debt_capital_paid=total_debt_capital.quantize(Decimal("0.01")),
            total_net_profit=total_net_profit.quantize(Decimal("0.01")),
            avg_net_margin_pct=round(float(avg_net_pct), 2),
            ending_cash=months[-1].cumulative_cash if months else Decimal("0"),
            min_cash=min_cash.quantize(Decimal("0.01")),
            months_cash_negative=sum(1 for m in months if m.cash_negative),
            months_below_breakeven=sum(1 for m in months if m.below_breakeven),
            breakeven_revenue_monthly_avg=breakeven_revenue_monthly.quantize(Decimal("0.01")),
        )

    @staticmethod
    def _add_months(year: int, month: int, offset: int) -> tuple[int, int]:
        total = (year * 12 + (month - 1)) + offset
        return (total // 12, (total % 12) + 1)

    @staticmethod
    def _estimate_base_headcount(payroll_monthly_base: Decimal) -> int:
        """Rough estimate based on SMMLV+parafiscales ~$1.8M per person."""
        if payroll_monthly_base <= 0:
            return 0
        return max(1, int(Decimal(str(payroll_monthly_base)) // Decimal("1800000")))

    async def list_projections(
        self,
        limit: int = 20,
        scenario: str | None = None,
    ) -> list[FinancialProjection]:
        stmt = select(FinancialProjection).order_by(FinancialProjection.created_at.desc()).limit(limit)
        if scenario:
            stmt = stmt.where(FinancialProjection.scenario_label == scenario)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_projection(self, projection_id: UUID) -> FinancialProjection | None:
        result = await self.db.execute(
            select(FinancialProjection).where(FinancialProjection.id == projection_id)
        )
        return result.scalar_one_or_none()

    async def delete_projection(self, projection_id: UUID) -> bool:
        proj = await self.get_projection(projection_id)
        if not proj:
            return False
        await self.db.delete(proj)
        await self.db.flush()
        return True
