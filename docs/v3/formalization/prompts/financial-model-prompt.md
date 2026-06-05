# Prompt: Sesion de Implementacion del Modelo Financiero UCR

> **Uso:** Copiar este prompt al inicio de una sesion nueva de Claude Code para implementar el modelo financiero.
> **Prerequisito:** v3.1.0 desplegado (branches funcionando). Si branches no estan listas, las fases 1-3 del modelo se pueden implementar sin branch_id (se agrega despues).
> **Estimacion:** 2-3 sesiones de trabajo.

---

## Prompt

```
Contexto: Estoy construyendo el modelo financiero para UCR (uniformes-system-v2), un sistema de gestion de uniformes escolares con multiples sucursales. El sistema ya tiene contabilidad operativa (gastos, CxC, CxP, caja, cierre diario) pero necesita capacidades financieras profesionales.

Lee estos archivos antes de empezar:
1. docs/v3-branch-architecture/financial-model-design.md — diseno completo del modelo financiero
1b. docs/v3-branch-architecture/b2b-contracts-model.md — modelo de negocio B2B (tercer stream de ingreso, contracalendario)
2. docs/v3-branch-architecture/branch-architecture.md — arquitectura de sucursales (para entender branch_id)
3. backend/app/services/financial_statements.py — servicio existente de estados financieros
4. backend/app/models/accounting.py — modelos contables actuales
5. backend/app/services/accounting/ — servicios contables actuales

Referencia cruzada con OndaFin para patrones de implementacion:
6. ~/Documents/03_Proyectos/Codigo/finance_manager/backend/app/models/ — modelos financieros OndaFin
7. ~/Documents/03_Proyectos/Codigo/finance_manager/backend/app/services/reports.py — ReportsService (P&L, cash flow, balance sheet)
8. ~/Documents/03_Proyectos/Codigo/finance_manager/backend/app/services/dashboard.py — DashboardService (KPIs batch)
9. ~/Documents/03_Proyectos/Codigo/finance_manager/backend/app/services/financial_model.py — motor de proyecciones (MonthData, assumptions, sensitivity)
10. ~/Documents/03_Proyectos/Codigo/finance_manager/backend/app/services/budget.py — BudgetService (batch status)

Implementa en el siguiente orden (cada fase es un commit separado):

FASE 1: Tablas + Modelos
- Crear modelos SQLAlchemy: AccountingPeriod, FinancialSnapshot, Budget, FinancialProjection
- Crear migracion Alembic
- Crear schemas Pydantic para cada modelo
- NO crear journal entries por ahora (complejidad diferida)

FASE 2: P&L Service
- Expandir financial_statements.py con get_pl() que soporte:
  - Filtro por branch_id (None = consolidado)
  - Filtro por periodo (date range)
  - group_by: total | school | product_family
- Revenue = SUM(sale_items.quantity * sale_items.unit_price) filtrado por periodo
- COGS = SUM(sale_items.quantity * product.unit_cost) — usar cost_components si existen, fallback a unit_cost
- OpEx = SUM(expenses) por categoria, filtrado por periodo y branch
- Output: ProfitAndLoss schema con revenue, cogs, gross_profit, gross_margin_pct, opex by category, operating_profit, operating_margin_pct

FASE 3: KPI Service
- Crear services/kpi_service.py con get_kpis():
  - avg_ticket, units_per_transaction, gross_margin_pct
  - inventory_turnover (COGS / avg inventory value)
  - DSO (avg AR / daily revenue)
  - DPO (avg AP / daily COGS)
  - cash_conversion_cycle (DIO + DSO - DPO)
  - break_even_revenue (fixed_costs / gross_margin_pct)
  - revenue_per_school, revenue_per_branch
  - MoM growth
- Patron OndaFin: single batch query para minimizar round-trips a DB

FASE 4: Cash Flow Report
- Expandir financial_statements.py con get_cash_flow():
  - granularity: daily | weekly | monthly
  - inflows: sale_payments + AR collections
  - outflows: expenses + AP payments + payroll
  - net per period, running balance
  - Proyeccion simple: trending de ultimos 3 meses hacia adelante

FASE 5: Snapshots + Periods
- services/snapshot_service.py:
  - create_monthly_snapshot() — calcula P&L + balance sheet + KPIs, guarda en JSONB
  - close_period() — genera snapshot inmutable, marca periodo cerrado
- Regla: periodo cerrado impide crear/editar transactions, expenses, sales en ese rango

FASE 6: Budgets
- services/budget_service.py:
  - CRUD de budgets (por branch, por expense_category, por periodo)
  - get_all_statuses() — batch: budget vs actual spent, pct_used, alert
  - Patron OndaFin: single query para todos los budgets activos

FASE 7: API Routes
- routes/finance.py con todos los endpoints:
  - GET /finance/pl — P&L con filtros
  - GET /finance/kpis — KPIs del periodo
  - GET /finance/cash-flow — flujo de caja
  - GET /finance/snapshots — historico de snapshots
  - POST /finance/periods/{year}/{month}/close — cerrar periodo
  - CRUD /finance/budgets
  - GET /finance/budgets/status — estado de todos los budgets
- Permisos: finance.view (ADMIN+), finance.manage_periods (OWNER), finance.manage_budgets (ADMIN+)

FASE 8: Projections Engine
- services/projection_service.py:
  - calculate_projections(assumptions, months) → list[MonthProjection]
  - Inputs: branches con schools (students, penetration, avg_price, avg_cost), seasonality, expansion plan, inflation, hiring
  - IMPORTANTE — modelar TRES streams de ingreso con timing distinto (ver b2b-contracts-model.md):
    1. Escolar (B2C): estacional via seasonality
    2. B2B contratos: bloque assumptions.b2b_pipeline (recurring_contracts, one_shot_pipeline, new_client_acquisition). CONTRACALENDARIO — NO usa seasonality. Reconocer ingreso por entrega (no por anticipo); anticipo entra a caja, revenue al P&L en mes de entrega; saldo a credito genera CxC con payment_terms_days.
    3. SaaS: assumptions.saas_revenue (recurrente lineal)
  - Output por mes: revenue (desglosado b2c/b2b/saas), cogs, gross_profit, fixed_costs, variable_costs, operating_profit, cash_flow, cumulative_cash, break_even_flag
  - calculate_sensitivity() — 7 tablas (ver financial-model-design.md; tabla 7 = contratos B2B/trimestre x ticket → revenue B2B + suavizado de estacionalidad)
- CRUD de projections (guardar escenarios)
- API: POST /finance/projections/calculate, CRUD /finance/projections

FASE 9: Financial Alerts
- services/financial_alert_service.py:
  - Rule-based (NO LLM): margin_compression, inventory_slow_movers, stockout_risk, budget_overspend, ar_aging, ap_upcoming, branch_below_breakeven, revenue_decline, cash_runway
  - GET /finance/alerts — alertas activas

FASE 10: Frontend Dashboard
- pages/Finance.tsx — dashboard ejecutivo
- Componentes: RevenueCard, MarginCard, CashPositionCard, PLTrendChart, RevenueBranchChart, TopSchoolsTable, KPIGrid, AlertsList
- Sub-paginas: PLDetail, CashFlowPage, MarginsPage, ProjectionsPage, BudgetsPage, PeriodsPage
- Servicios: financeService.ts
- Store: useFinanceStore (periodo seleccionado, branch seleccionado)

Para cada fase:
1. Implementa backend (modelo + servicio + schema + tests)
2. Luego implementa frontend si aplica
3. Corre tests antes de pasar a la siguiente fase
4. Commit con mensaje descriptivo

Numeros reales de UCR para calibrar el modelo (aproximados):
- Revenue mensual temporada alta (ene-feb): ~15-20M COP
- Revenue mensual temporada baja (abr-jun): ~3-5M COP
- Margen bruto target: 35-45%
- Costos fijos mensuales por sucursal: ~3-4M COP (alquiler + servicios + nomina)
- Ticket promedio B2C: ~80,000-120,000 COP
- ~15 colegios activos actualmente
- ~8 empleados (vendedoras + admin)
- B2B: contrato del restaurante en curso ~9M COP; ticket B2B tipico $2M-$30M; margen B2B 35-42%; meta de mezcla subir B2B de ~5% a ~30% del revenue. Es contracalendario — suaviza los valles escolares (abr-jun, sep-nov).

Usa las utilidades de timezone del proyecto (app.utils.timezone) para todas las fechas.
Usa el patron de servicios async existente del proyecto.
Schemas Pydantic v2 con model_config.
Tests con pytest + fixtures de DB async.
```

---

## Notas para la Sesion

### Orden de prioridad si el tiempo es limitado
1. P&L (Fase 2) — base de todo, valor inmediato
2. KPIs + dashboard cards (Fase 3 + parcial Fase 10) — visibilidad
3. Cash flow (Fase 4) — liquidez
4. Projections engine (Fase 8) — diferenciador para venta del software
5. El resto es complementario

### Decisiones ya tomadas
- NO journal entries de doble partida por ahora (complejidad no justificada aun)
- Snapshots en JSONB (patron OndaFin probado en produccion)
- Alertas rule-based sin LLM (deterministas, sin costo variable)
- branch_id nullable en todo (consolidado vs por sucursal)
- Seasonality como multiplicador por mes (calendario escolar colombiano)

### Datos de referencia
- Temporada alta: Enero-Febrero (vuelta a clases)
- Temporada media: Julio-Agosto (mitad de ano, uniformes de reposicion)
- Temporada baja: Abril-Junio, Septiembre-Noviembre
- IVA: uniformes escolares excluidos de IVA en Colombia (Art. 424 E.T.)

---

[← Volver al indice](./README.md)
