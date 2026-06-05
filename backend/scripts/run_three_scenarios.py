"""
Corre 3 escenarios del ProjectionService y compara summaries.

Escenarios:
  A — Minimo Viable Legal: ARL solo para informales, sin SAS, sin sucursal nueva
  B — Escalonado: SAS post-pico ene-feb 2027, sucursal mes 9, payroll formal gradual
  C — Con credito puente: B agresivo + linea de credito $50M en mes 1
"""
import asyncio
import os
import sys
from datetime import date
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


# Comun a los 3: estacionalidad realista UCR
SEASONALITY_UCR = {
    1: 2.0, 2: 1.7, 3: 0.7, 4: 0.6,
    5: 0.5, 6: 0.6, 7: 1.0, 8: 0.8,
    9: 0.5, 10: 0.5, 11: 0.6, 12: 0.7,
}

# Base mensual ajustada para que anualizado ≈ $150-180M
BASE_REVENUE = Decimal("13000000")

# Deudas existentes (igual en todos los escenarios)
DEBTS_EXISTING = [
    ProjectionDebt(
        name="Prestamo 1 informal",
        capital=Decimal("12000000"),
        monthly_payment=Decimal("300000"),
        interest_portion_monthly=Decimal("300000"),
        capital_portion_monthly=Decimal("0"),
        starts_month_offset=0,
    ),
    ProjectionDebt(
        name="Prestamo 2 informal",
        capital=Decimal("7000000"),
        monthly_payment=Decimal("250000"),
        interest_portion_monthly=Decimal("250000"),
        capital_portion_monthly=Decimal("0"),
        starts_month_offset=0,
    ),
]


def escenario_A() -> ProjectionAssumptions:
    """Minimo Viable: ARL solo, sin SAS, sin sucursal, contador freelance basico."""
    return ProjectionAssumptions(
        name="Escenario A — Minimo Viable Legal",
        start_year=2026, start_month=5, months=12,
        base_revenue_monthly=BASE_REVENUE,
        seasonality=SEASONALITY_UCR,
        growth_rate_monthly=0.01,
        cogs_pct=0.62,
        fixed_costs_monthly=Decimal("1100000"),
        # Payroll informal mantenido (3 personas no afiliadas + auxilios)
        payroll_monthly_base=Decimal("3000000"),
        hiring_plan=[],
        new_branches=[],  # Sin sucursal nueva
        debts=DEBTS_EXISTING,
        formalization_layer=ProjectionFormalizationLayer(
            scenario_label="A",
            one_time_costs=[
                FormalizationOneTimeCost(month_offset=0, concept="contador_freelance_arranque", amount=Decimal("1000000")),
                FormalizationOneTimeCost(month_offset=1, concept="regularizacion_dian_minimo", amount=Decimal("1500000")),
                FormalizationOneTimeCost(month_offset=1, concept="fe_setup", amount=Decimal("100000")),
                FormalizationOneTimeCost(month_offset=7, concept="cierre_anual", amount=Decimal("1000000")),
                FormalizationOneTimeCost(month_offset=10, concept="renovacion_cc", amount=Decimal("400000")),
            ],
            recurring_costs=[
                FormalizationRecurringCost(concept="contador_freelance", amount_monthly=Decimal("250000"), starts_month_offset=0),
                FormalizationRecurringCost(concept="fe_factus", amount_monthly=Decimal("60000"), starts_month_offset=1),
                # ARL 5 personas como independientes
                FormalizationRecurringCost(concept="arl_independientes", amount_monthly=Decimal("36000"), starts_month_offset=0),
            ],
        ),
        inflation_annual=0.06,
        initial_cash=Decimal("13000000"),
    )


def escenario_B_escalonado() -> ProjectionAssumptions:
    """B Escalonado: SAS en mes 9 (post-pico), sucursal mes 11, payroll formal gradual."""
    return ProjectionAssumptions(
        name="Escenario B Escalonado — SAS post-pico, sucursal Q1 2027",
        start_year=2026, start_month=5, months=12,
        base_revenue_monthly=BASE_REVENUE,
        seasonality=SEASONALITY_UCR,
        growth_rate_monthly=0.015,
        cogs_pct=0.60,  # leve mejora margen al formalizar inventario
        fixed_costs_monthly=Decimal("1100000"),
        # Payroll: empieza informal $3M, sube cuando se formaliza (mes 9)
        # Modelado vía hiring_plan: en mes 9 contrata 5 personas formales (reemplaza informal)
        payroll_monthly_base=Decimal("3000000"),
        hiring_plan=[
            # Mes 9 (febrero 2027 post-pico): formalizar 3 trabajadores no familiares
            ProjectionHire(month_offset=9, role="vendedora 1 (Felipe formalizado)", monthly_salary=Decimal("1450000"), parafiscales_pct=Decimal("0.30")),
            ProjectionHire(month_offset=9, role="vendedora 2 (Salome formalizada)", monthly_salary=Decimal("1450000"), parafiscales_pct=Decimal("0.30")),
            ProjectionHire(month_offset=9, role="vendedor 3 (Santiago formalizado)", monthly_salary=Decimal("1450000"), parafiscales_pct=Decimal("0.30")),
        ],
        # Sucursal nueva mes 11 (abril 2027), arranca con personal formal
        new_branches=[
            ProjectionNewBranch(
                month_offset=11,
                name="Sucursal Otro Municipio",
                fixed_costs_monthly=Decimal("700000"),
                payroll_monthly=Decimal("3800000"),  # 2 personas formales con aportes
                revenue_ramp=[Decimal("1000000")],  # solo 1 mes proyectado
            ),
        ],
        debts=DEBTS_EXISTING,
        formalization_layer=ProjectionFormalizationLayer(
            scenario_label="B",
            one_time_costs=[
                # Fase 1 (mes 0-3): contador, asesor laboral, FE
                FormalizationOneTimeCost(month_offset=0, concept="contador_arranque", amount=Decimal("1500000")),
                FormalizationOneTimeCost(month_offset=0, concept="asesor_laboral_dx", amount=Decimal("1500000")),
                FormalizationOneTimeCost(month_offset=1, concept="regularizacion_dian", amount=Decimal("2000000")),
                FormalizationOneTimeCost(month_offset=1, concept="fe_setup", amount=Decimal("200000")),
                # Fase 2 (mes 4-6): pago tramos pasivo laboral negociado
                FormalizationOneTimeCost(month_offset=4, concept="pasivo_laboral_t1", amount=Decimal("2000000")),
                FormalizationOneTimeCost(month_offset=6, concept="pasivo_laboral_t2", amount=Decimal("2000000")),
                # Fase 3 (mes 8-9): SAS justo despues del pico ene-feb
                FormalizationOneTimeCost(month_offset=8, concept="cierre_contable_anual", amount=Decimal("1500000")),
                FormalizationOneTimeCost(month_offset=9, concept="constitucion_sas", amount=Decimal("2500000")),
                # Fase 4 (mes 11): apertura sucursal
                FormalizationOneTimeCost(month_offset=11, concept="adecuacion_sucursal_2", amount=Decimal("3000000")),
                # Renovaciones
                FormalizationOneTimeCost(month_offset=10, concept="renovacion_cc", amount=Decimal("500000")),
            ],
            recurring_costs=[
                FormalizationRecurringCost(concept="contador_externo", amount_monthly=Decimal("400000"), starts_month_offset=0),
                FormalizationRecurringCost(concept="fe_alegra", amount_monthly=Decimal("100000"), starts_month_offset=1),
                # ARL informales primer 8 meses
                FormalizationRecurringCost(concept="arl_independientes", amount_monthly=Decimal("36000"), starts_month_offset=0, ends_month_offset=8),
                # Nomina electronica desde mes 9 (cuando se formaliza)
                FormalizationRecurringCost(concept="nomina_electronica", amount_monthly=Decimal("60000"), starts_month_offset=9),
            ],
        ),
        inflation_annual=0.06,
        initial_cash=Decimal("13000000"),
    )


def escenario_C_con_credito() -> ProjectionAssumptions:
    """B agresivo + linea de credito puente $50M para resolver caja."""
    base = escenario_B_escalonado()
    base.name = "Escenario C — B Escalonado + Credito Puente $50M"
    # Sumar capital inicial via "credito puente"
    base.initial_cash = Decimal("13000000") + Decimal("50000000")
    # Agregar deuda nueva del credito (banca formal, tasa razonable)
    # $50M @ 22% E.A. simple = ~1.83% mensual = ~$915k/mes intereses-only
    base.debts = list(DEBTS_EXISTING) + [
        ProjectionDebt(
            name="Credito puente bancario",
            capital=Decimal("50000000"),
            monthly_payment=Decimal("915000"),
            interest_portion_monthly=Decimal("915000"),
            capital_portion_monthly=Decimal("0"),
            starts_month_offset=1,
            term_months=24,  # se paga en 2 anos
        ),
    ]
    return base


def fmt_short(x):
    val = float(x)
    if abs(val) >= 1_000_000:
        return f"${val/1_000_000:>6.1f}M"
    elif abs(val) >= 1_000:
        return f"${val/1_000:>6.0f}k"
    return f"${val:>7.0f}"


async def main():
    db_url = os.getenv("DATABASE_URL", "postgresql+asyncpg://uniformes_user:dev_password@postgres:5432/uniformes_db")
    engine = create_async_engine(db_url, echo=False)
    AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    scenarios = [
        ("A", escenario_A()),
        ("B-esc", escenario_B_escalonado()),
        ("C-cred", escenario_C_con_credito()),
    ]

    results = []
    async with AsyncSessionLocal() as db:
        service = ProjectionService(db)
        for label, ass in scenarios:
            r = await service.run_projection(ass, persist=True)
            results.append((label, r))
        await db.commit()

    print("=" * 100)
    print("COMPARATIVA DE 3 ESCENARIOS — UCR Formalizacion (12 meses, mayo 2026 - abril 2027)")
    print("=" * 100)

    # Evolucion mes a mes — cumulative_cash
    print()
    print("EVOLUCION DE CAJA ACUMULADA (cumulative_cash):")
    print(f"  {'Mes':12s} | {'Esc A':>10s} | {'Esc B-esc':>10s} | {'Esc C-cred':>10s}")
    print("  " + "-" * 54)
    for i in range(12):
        labels = []
        for sc_label, r in results:
            m = r.months[i]
            labels.append(fmt_short(m.cumulative_cash))
        period = results[0][1].months[i].period_label
        print(f"  {period:12s} | {labels[0]:>10s} | {labels[1]:>10s} | {labels[2]:>10s}")

    print()
    print("=" * 100)
    print("RESUMEN POR ESCENARIO:")
    print("=" * 100)

    for sc_label, r in results:
        s = r.summary
        print()
        print(f"--- {sc_label}: {r.name} ---")
        print(f"  Total revenue 12m:        {fmt_short(s.total_revenue):>12s}")
        print(f"  Total OpEx:               {fmt_short(s.total_opex):>12s}")
        print(f"    Formalizacion 1-time:   {fmt_short(s.total_formalization_one_time):>12s}")
        print(f"    Formalizacion recur.:   {fmt_short(s.total_formalization_recurring):>12s}")
        print(f"  Operating profit:         {fmt_short(s.total_operating_profit):>12s} ({s.avg_operating_margin_pct:>5.1f}%)")
        print(f"  Interest expense:         {fmt_short(s.total_interest_expense):>12s}")
        print(f"  NET PROFIT:               {fmt_short(s.total_net_profit):>12s} ({s.avg_net_margin_pct:>5.1f}%)")
        print(f"  Caja final:               {fmt_short(s.ending_cash):>12s}")
        print(f"  Caja minima:              {fmt_short(s.min_cash):>12s}")
        print(f"  Meses caja negativa:      {s.months_cash_negative}/12")
        print(f"  Meses bajo breakeven:     {s.months_below_breakeven}/12")
        print(f"  Breakeven mensual:        {fmt_short(s.breakeven_revenue_monthly_avg):>12s}")
        print(f"  ID DB:                    {r.id}")

    print()
    print("=" * 100)
    print("VEREDICTO RAPIDO:")
    print("=" * 100)
    for sc_label, r in results:
        s = r.summary
        viable = "VIABLE" if (s.min_cash >= 0 and s.total_net_profit > 0) else "NO VIABLE (caja negativa o perdidas)"
        print(f"  {sc_label}: {viable} — caja final {fmt_short(s.ending_cash)}, profit {fmt_short(s.total_net_profit)}")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
