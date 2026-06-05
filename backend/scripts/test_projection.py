"""
Test ProjectionService MVP con Escenario B (formalización completa) + datos UCR reales.

Inputs:
- Ingresos base mensual: $10M (promedio 2025 + ajuste por crecimiento real)
- Estacionalidad real UCR: enero/febrero pico, mayo-junio bajo
- COGS 62% (margen bruto 38% confirmado por sistema)
- Costos fijos $1.1M/mes (arriendo $800k + servicios $200k + internet $100k)
- Payroll base: 5 personas × SMMLV × 1.30 aportes = ~$9M/mes (post-formalización)
- Préstamos: 2 vigentes ($12M @ $300k/mes + $7M @ $250k/mes)
- Formalización Escenario B: $32-47M total año 1
- Caja inicial: $13M (cash actual del sistema)
- Nueva sucursal: mes 2 (junio 2026), arriendo $700k, payroll $2M, ramp gradual
"""
import asyncio
import json
import os
import sys
from datetime import datetime
from decimal import Decimal

sys.path.insert(0, "/app")

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from app.schemas.financial_model import (
    ProjectionAssumptions,
    ProjectionHire,
    ProjectionDebt,
    ProjectionNewBranch,
    FormalizationOneTimeCost,
    FormalizationRecurringCost,
    ProjectionFormalizationLayer,
)
from app.services.accounting.financial_model.projection import ProjectionService


def build_escenario_b() -> ProjectionAssumptions:
    """Escenario B — Formalización Completa, 12 meses desde mayo 2026."""
    return ProjectionAssumptions(
        name="Escenario B — Formalización Completa (UCR)",
        start_year=2026,
        start_month=5,  # mayo
        months=12,

        # Revenue base: ~$10M/mes neutral, ajustado por estacionalidad y nueva sucursal
        base_revenue_monthly=Decimal("10000000"),
        seasonality={
            1: 2.0, 2: 1.7, 3: 0.7, 4: 0.6,
            5: 0.5, 6: 0.6, 7: 1.0, 8: 0.8,
            9: 0.5, 10: 0.5, 11: 0.6, 12: 0.7,
        },
        growth_rate_monthly=0.015,  # 1.5% MoM growth orgánico

        cogs_pct=0.62,
        fixed_costs_monthly=Decimal("1100000"),  # arriendo + servicios + internet

        # Payroll formalizado post-SAS: 5 personas en SMMLV con aportes
        payroll_monthly_base=Decimal("9000000"),

        # No nuevas contrataciones por ahora (se modela vía new_branch)
        hiring_plan=[],

        # Sucursal 2 abre en jun 2026 (offset 1)
        new_branches=[
            ProjectionNewBranch(
                month_offset=1,
                name="Sucursal Otro Municipio",
                fixed_costs_monthly=Decimal("700000"),
                payroll_monthly=Decimal("3500000"),  # 2 personas + parafiscales
                revenue_ramp=[
                    Decimal("1500000"),  # mes 1 — apenas arrancando
                    Decimal("3000000"),
                    Decimal("4500000"),
                    Decimal("6000000"),
                    Decimal("7500000"),
                    Decimal("9000000"),  # estabilizada al 6to mes
                ],
            )
        ],

        # Préstamos vigentes
        debts=[
            ProjectionDebt(
                name="Préstamo 1",
                capital=Decimal("12000000"),
                monthly_payment=Decimal("300000"),
                interest_portion_monthly=Decimal("300000"),  # interest-only
                capital_portion_monthly=Decimal("0"),
                starts_month_offset=0,
            ),
            ProjectionDebt(
                name="Préstamo 2",
                capital=Decimal("7000000"),
                monthly_payment=Decimal("250000"),
                interest_portion_monthly=Decimal("250000"),  # interest-only
                capital_portion_monthly=Decimal("0"),
                starts_month_offset=0,
            ),
        ],

        # Formalización Escenario B
        formalization_layer=ProjectionFormalizationLayer(
            scenario_label="B",
            one_time_costs=[
                FormalizationOneTimeCost(month_offset=0, concept="contador_arranque", amount=Decimal("2000000")),
                FormalizationOneTimeCost(month_offset=0, concept="asesor_laboral_dx", amount=Decimal("2000000")),
                FormalizationOneTimeCost(month_offset=1, concept="constitucion_sas", amount=Decimal("1000000")),
                FormalizationOneTimeCost(month_offset=1, concept="regularizacion_dian", amount=Decimal("2000000")),
                FormalizationOneTimeCost(month_offset=1, concept="fe_setup", amount=Decimal("200000")),
                FormalizationOneTimeCost(month_offset=2, concept="pasivo_laboral_t1", amount=Decimal("2500000")),
                FormalizationOneTimeCost(month_offset=4, concept="pasivo_laboral_t2", amount=Decimal("2500000")),
                FormalizationOneTimeCost(month_offset=6, concept="pasivo_laboral_t3", amount=Decimal("2000000")),
                FormalizationOneTimeCost(month_offset=7, concept="cierre_contable_anual", amount=Decimal("1500000")),
                FormalizationOneTimeCost(month_offset=10, concept="renovacion_cc", amount=Decimal("500000")),
            ],
            recurring_costs=[
                FormalizationRecurringCost(concept="contador_externo", amount_monthly=Decimal("500000"), starts_month_offset=0),
                FormalizationRecurringCost(concept="fe_dian", amount_monthly=Decimal("120000"), starts_month_offset=1),
                FormalizationRecurringCost(concept="nomina_electronica", amount_monthly=Decimal("60000"), starts_month_offset=3),
                # Aportes patronales ya están en payroll_monthly_base (ya formalizado)
            ],
        ),

        inflation_annual=0.06,
        initial_cash=Decimal("13000000"),  # cash actual del sistema
    )


def fmt(x):
    return f"${float(x):>14,.0f}"


async def main():
    db_url = os.getenv("DATABASE_URL", "postgresql+asyncpg://uniformes_user:dev_password@postgres:5432/uniformes_db")
    engine = create_async_engine(db_url, echo=False)
    AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with AsyncSessionLocal() as db:
        service = ProjectionService(db)
        assumptions = build_escenario_b()
        result = await service.run_projection(assumptions, persist=True)
        await db.commit()

    print(f"=== {result.name} ===")
    print(f"Período: {result.assumptions.start_year}-{result.assumptions.start_month:02d} → {result.assumptions.months} meses")
    print(f"ID de proyección: {result.id}")
    print()
    print(f"{'Mes':12s} {'Revenue':>15s} {'GP':>15s} {'OpEx':>15s} {'OpProfit':>15s} {'NetCash':>15s} {'CumCash':>15s}  Flags")
    print("-" * 130)
    for m in result.months:
        flags = []
        if m.below_breakeven: flags.append("BE-")
        if m.cash_negative: flags.append("CASH-")
        flags_str = " ".join(flags)
        print(f"{m.period_label:12s} {fmt(m.revenue)} {fmt(m.gross_profit)} {fmt(m.total_opex)} {fmt(m.operating_profit)} {fmt(m.net_cash_flow)} {fmt(m.cumulative_cash)}  {flags_str}")
    print()
    s = result.summary
    print("=== RESUMEN 12 MESES ===")
    print(f"  Total revenue:           {fmt(s.total_revenue)}")
    print(f"  Total COGS:              {fmt(s.total_cogs)}")
    print(f"  Total gross profit:      {fmt(s.total_gross_profit)}  ({s.avg_gross_margin_pct:.1f}%)")
    print(f"  Total OpEx:              {fmt(s.total_opex)}")
    print(f"    Formalización 1-time:  {fmt(s.total_formalization_one_time)}")
    print(f"    Formalización recur.:  {fmt(s.total_formalization_recurring)}")
    print(f"  Operating profit:        {fmt(s.total_operating_profit)}  ({s.avg_operating_margin_pct:.1f}%)")
    print(f"  Interest expense:        {fmt(s.total_interest_expense)}")
    print(f"  Capital de deuda pagado: {fmt(s.total_debt_capital_paid)}")
    print(f"  NET PROFIT:              {fmt(s.total_net_profit)}  ({s.avg_net_margin_pct:.1f}%)")
    print(f"  Caja final:              {fmt(s.ending_cash)}")
    print(f"  Caja mínima del período: {fmt(s.min_cash)}")
    print(f"  Meses con caja negativa: {s.months_cash_negative}")
    print(f"  Meses bajo breakeven:    {s.months_below_breakeven}")
    print(f"  Breakeven mensual:       {fmt(s.breakeven_revenue_monthly_avg)}")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
