# Modelo Financiero UCR — Diseno

> **Version:** 1.0
> **Fecha:** 2026-04-13
> **Inspiracion:** OndaFin (~/Documents/03_Proyectos/Codigo/finance_manager/)
> **Target:** v3.2.0 (Jul-Ago 2026)

---

## Contexto

UCR tiene contabilidad operativa (gastos, CxC, CxP, caja, cierre diario) pero carece de:
- P&L real por periodo/sucursal/colegio
- Analisis de margenes por producto
- Proyecciones de flujo de caja
- KPIs de negocio (ticket promedio, rotacion inventario, break-even)
- Dashboard financiero ejecutivo
- Modelo de proyecciones para decision-making y para venta del software

> **Tres streams de ingreso, no uno.** El modelo financiero debe proyectar **tres lineas de negocio con timing distinto**, no solo el retail escolar:
> 1. **Escolar (B2C):** estacional segun calendario escolar (pico ene-feb, valle abr-jun/sep-nov).
> 2. **B2B contratos:** contracalendario — contratos empresariales/dotacion/eventos que NO siguen el calendario escolar. Es el flujo real mes a mes que rompe la estacionalidad. Ver [b2b-contracts-model.md](./b2b-contracts-model.md).
> 3. **SaaS (v3.2):** recurrente lineal (subscripcion).
>
> Si el motor solo modela el stream escolar, **subestima el flujo real y exagera la caida de caja en los valles**. El bloque `b2b_pipeline` (ver "Assumptions Schema") corrige esto.

OndaFin tiene un modelo financiero maduro con transacciones como fuente de verdad, snapshots periodicos, journal entries de doble partida, y un motor de proyecciones SaaS de 80+ parametros. Este documento adapta los patrones aplicables al contexto de retail de uniformes.

---

## Patrones de OndaFin Replicables en UCR

| Patron OndaFin | Adaptacion UCR |
|----------------|----------------|
| Transaction como source of truth + balance denormalizado | Ya existe en UCR (balance_entries + balance_accounts.current_balance) |
| AccountingPeriod + FinancialSnapshot | Replicar exacto — cierre mensual con JSONB inmutable |
| JournalEntry + JournalEntryLine (doble partida) | Opcional pero recomendado para auditabilidad |
| ReportsService (GROUP BY con case()) | Replicar para P&L por branch/school/periodo |
| Budget con alert_threshold y rollover | Replicar para presupuestos por sucursal |
| calculate_projections() con MonthData | Adaptar: inputs de retail, no SaaS |
| calculate_sensitivity() (matrices) | Adaptar: precio × volumen → margen |
| AI Insights (reglas, no LLM) | Adaptar: alertas de inventario, margen, branch performance |
| Export XLSX/PDF (openpyxl + reportlab) | Replicar para reportes ejecutivos |

### Patrones NO Aplicables
- Subscription/Plan/MRR/ARR → UCR es retail, no SaaS (excepto para el propio negocio de venta del software)
- Referral/Ambassador programs
- Personal finance categories (Alimentacion, Entretenimiento)
- FX rate cache (UCR opera solo en COP)
- Credit card instalment splitting
- Family group sharing

---

## Modelo de Datos Financiero

### Nuevas Tablas

```sql
-- Periodos contables con cierre formal
CREATE TABLE accounting_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID REFERENCES branches(id),  -- NULL = consolidado
    year INT NOT NULL,
    month INT NOT NULL,
    status VARCHAR(20) DEFAULT 'open',  -- open | closed
    closed_at TIMESTAMP,
    closed_by UUID REFERENCES users(id),
    closing_snapshot_id UUID REFERENCES financial_snapshots(id),
    created_at TIMESTAMP NOT NULL,
    UNIQUE (branch_id, year, month)
);

-- Snapshots periodicos (inmutables tras cierre)
CREATE TABLE financial_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID REFERENCES branches(id),  -- NULL = consolidado
    snapshot_date DATE NOT NULL,
    snapshot_type VARCHAR(20) NOT NULL,  -- monthly | manual | closing
    is_immutable BOOLEAN DEFAULT FALSE,
    data JSONB NOT NULL,
    -- data schema:
    -- {
    --   "revenue": Decimal,
    --   "cogs": Decimal,
    --   "gross_profit": Decimal,
    --   "gross_margin_pct": Decimal,
    --   "operating_expenses": Decimal,
    --   "operating_profit": Decimal,
    --   "operating_margin_pct": Decimal,
    --   "inventory_value": Decimal,
    --   "accounts_receivable": Decimal,
    --   "accounts_payable": Decimal,
    --   "cash_balance": Decimal,
    --   "bank_balance": Decimal,
    --   "by_school": [
    --     {"school_id": UUID, "name": str, "revenue": Decimal, "cogs": Decimal, "margin_pct": Decimal}
    --   ],
    --   "by_product_family": [
    --     {"family": str, "revenue": Decimal, "cogs": Decimal, "units_sold": int}
    --   ],
    --   "kpis": {
    --     "avg_ticket": Decimal,
    --     "transactions_count": int,
    --     "inventory_turnover": Decimal,
    --     "days_sales_outstanding": Decimal,
    --     "days_payable_outstanding": Decimal
    --   }
    -- }
    created_at TIMESTAMP NOT NULL
);

-- Presupuestos por sucursal/categoria
CREATE TABLE budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID REFERENCES branches(id),  -- NULL = global
    expense_category_id UUID REFERENCES expense_categories(id),
    amount NUMERIC(14,2) NOT NULL,
    period VARCHAR(20) NOT NULL,  -- monthly | quarterly | yearly
    alert_threshold NUMERIC(3,2) DEFAULT 0.80,
    rollover BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL
);

-- Proyecciones (parametros + resultados)
CREATE TABLE financial_projections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID REFERENCES branches(id),  -- NULL = consolidado
    name VARCHAR(200) NOT NULL,
    assumptions JSONB NOT NULL,  -- inputs del modelo
    results JSONB NOT NULL,      -- output calculado
    projection_months INT DEFAULT 12,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP NOT NULL
);
```

### Tablas Existentes Aprovechadas

| Tabla | Rol en modelo financiero |
|-------|--------------------------|
| `sales` + `sale_items` | Revenue source of truth |
| `products` (unit_cost, sale_price) | COGS y margin per unit |
| `product_cost_components` | Cost breakdown detallado |
| `expenses` | OpEx por categoria |
| `fixed_expenses` | Costos fijos predecibles |
| `balance_accounts` + `balance_entries` | Cash/bank positions |
| `accounts_receivable` | DSO, cash flow timing |
| `accounts_payable` | DPO, cash outflow timing |
| `inventory` | Inventory valuation, turnover |
| `daily_cash_registers` | Daily cash flow actuals |

---

## Servicios de Calculo

### 1. FinancialStatementsService (ya existe, expandir)

```python
class FinancialStatementsService:
    async def get_pl(
        self,
        branch_id: UUID | None,  # None = consolidado
        period_start: date,
        period_end: date,
        group_by: str = "total"  # total | school | product_family
    ) -> ProfitAndLoss:
        """
        P&L:
        Revenue (ventas)
        - COGS (costo de productos vendidos, desde unit_cost o cost_components)
        = Gross Profit
        - Operating Expenses (gastos por categoria)
        = Operating Profit (EBIT)

        Desglosa por school o por familia de producto si se pide.
        """

    async def get_balance_sheet(
        self,
        branch_id: UUID | None,
        as_of: date
    ) -> BalanceSheet:
        """
        Activos:
          Caja + Banco (balance_accounts tipo asset_current)
          Inventario (sum de inventory.qty * product.unit_cost)
          CxC (accounts_receivable pendientes)
        Pasivos:
          CxP (accounts_payable pendientes)
        Patrimonio:
          Activos - Pasivos
        """

    async def get_cash_flow(
        self,
        branch_id: UUID | None,
        period_start: date,
        period_end: date,
        granularity: str = "monthly"  # daily | weekly | monthly
    ) -> CashFlowReport:
        """
        Inflows: pagos recibidos (sale_payments + AR collections)
        Outflows: gastos + pagos AP + nomina
        Net: inflow - outflow
        Running balance: opening + cumulative net
        """
```

### 2. KPIService (nuevo)

```python
class KPIService:
    async def get_kpis(
        self,
        branch_id: UUID | None,
        period_start: date,
        period_end: date
    ) -> KPIDashboard:
        """
        Metricas:
        - avg_ticket: revenue / num_sales
        - units_per_transaction: total_items / num_sales
        - gross_margin_pct: gross_profit / revenue
        - inventory_turnover: cogs / avg_inventory_value
        - days_inventory_outstanding: 365 / inventory_turnover
        - days_sales_outstanding: avg_ar / (revenue / 365)
        - days_payable_outstanding: avg_ap / (cogs / 365)
        - cash_conversion_cycle: DIO + DSO - DPO
        - break_even_revenue: fixed_costs / gross_margin_pct
        - break_even_units: fixed_costs / avg_contribution_margin_per_unit
        - revenue_per_school: revenue grouped by school
        - revenue_per_branch: revenue grouped by branch
        - mom_growth: (this_month - last_month) / last_month
        # KPIs B2B (ver b2b-contracts-model.md)
        - revenue_mix_b2b_vs_b2c: % de revenue B2B vs B2C (meta: subir B2B de ~5% a ~30%)
        - b2b_pipeline_weighted: SUM(quotation.amount * probability) en estado sent/negotiation
        - b2b_quotation_conversion: accepted / sent
        - b2b_avg_ticket / b2b_avg_margin_pct
        - b2b_client_concentration: % del revenue B2B en top-3 clientes (alerta si > 60%)
        - revenue_coef_variation: coef. de variacion mensual del revenue total (mide cuanto el B2B aplana la estacionalidad)
        """
```

### 3. ProjectionService (nuevo)

```python
class ProjectionService:
    async def calculate_projections(
        self,
        assumptions: ProjectionAssumptions,
        months: int = 12
    ) -> list[MonthProjection]:
        """
        Modelo de proyeccion para negocio de uniformes:

        Inputs (assumptions):
          - branches: [{name, fixed_costs, schools: [{name, expected_students, avg_items_per_student, avg_price, avg_margin_pct}]}]
          - growth_rate_monthly: tasa de crecimiento mensual en estudiantes
          - seasonality: {1: 2.5, 2: 1.8, 3: 0.5, ...}  # multiplicador por mes (ene-feb = temporada alta)
          - new_branches: [{month: 3, fixed_costs: X, schools: [...]}]  # expansiones planificadas
          - inflation_rate_annual: ajuste de costos
          - hiring_plan: [{month: N, headcount: int, avg_salary: Decimal}]

        Output per month:
          - revenue (por branch, por school)
          - cogs
          - gross_profit, gross_margin_pct
          - fixed_costs (rent, utilities, salaries)
          - variable_costs (packaging, transport)
          - operating_profit
          - cash_inflow, cash_outflow, net_cash
          - cumulative_cash
          - break_even_flag
          - headcount, payroll_cost
        """
```

### 4. BudgetService (nuevo)

```python
class BudgetService:
    async def get_all_statuses(
        self,
        branch_id: UUID | None
    ) -> list[BudgetStatus]:
        """
        Para cada presupuesto activo:
        - budget.amount vs actual spent (SUM expenses WHERE category AND period)
        - pct_used
        - alert_triggered (pct_used > alert_threshold)
        - previous_period_comparison
        - rollover_balance (if rollover=True)
        Patron OndaFin: single query batch para todos los budgets.
        """
```

### 5. FinancialAlertService (nuevo)

```python
class FinancialAlertService:
    """Reglas deterministicas (sin LLM). Adaptacion de OndaFin AI Insights."""

    async def check_alerts(self, branch_id: UUID | None) -> list[FinancialAlert]:
        generators = [
            self._margin_compression,      # gross margin < threshold por school
            self._inventory_slow_movers,    # items sin rotacion > 90 dias
            self._inventory_stockout_risk,  # items bajo reorder point
            self._budget_overspend,         # presupuesto > 80%
            self._ar_aging,                 # CxC > 30/60/90 dias
            self._ap_upcoming,             # CxP proximo a vencer
            self._branch_below_breakeven,  # sucursal no cubre costos fijos
            self._revenue_decline,         # revenue MoM < -10%
            self._cash_runway,             # dias de cash disponible < threshold
            self._b2b_quotation_expiring,  # cotizacion B2B proxima a vencer sin respuesta
            self._b2b_client_concentration,# 1 cliente B2B > X% del revenue (riesgo dependencia)
            self._b2b_overdue_balance,     # saldo de contrato B2B vencido (riesgo cartera)
        ]
```

### 6. SnapshotService (nuevo)

```python
class SnapshotService:
    async def create_monthly_snapshot(
        self,
        branch_id: UUID | None,
        year: int,
        month: int
    ) -> FinancialSnapshot:
        """
        Calcula P&L, balance sheet, KPIs para el mes.
        Guarda en financial_snapshots como JSONB.
        Si el periodo esta cerrado, marca is_immutable=True.
        """

    async def close_period(
        self,
        branch_id: UUID | None,
        year: int,
        month: int,
        closed_by: UUID
    ) -> AccountingPeriod:
        """
        1. Genera snapshot inmutable
        2. Marca accounting_period como closed
        3. Impide modificaciones a transacciones del periodo
        """
```

---

## Dashboard Ejecutivo (Frontend)

### Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  Dashboard Financiero    Periodo: [Abril 2026 ▼]  Branch: [▼]  │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │ Revenue   │  │ Margen   │  │ Utilidad │  │ Cash     │        │
│  │ $12.5M    │  │ Bruto    │  │ Op.      │  │ Position │        │
│  │ +8% MoM   │  │ 42%      │  │ $2.1M    │  │ $8.3M    │        │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │
│                                                                  │
│  ┌─────────────────────────────┐ ┌─────────────────────────────┐│
│  │ Revenue por Sucursal (Bar)  │ │ Top Colegios por Revenue    ││
│  │ Centro: ████████ $8.2M      │ │ 1. Col A:    $3.1M  (25%)  ││
│  │ Norte:  █████    $4.3M      │ │ 2. Col B:    $2.4M  (19%)  ││
│  │                             │ │ 3. Col C:    $1.8M  (14%)  ││
│  └─────────────────────────────┘ └─────────────────────────────┘│
│                                                                  │
│  ┌─────────────────────────────┐ ┌─────────────────────────────┐│
│  │ P&L Trend (6 meses)        │ │ KPIs                        ││
│  │ AreaChart:                  │ │ Ticket Promedio: $85,000    ││
│  │ Revenue, COGS, Gross Profit │ │ Rotacion Inv:   4.2x       ││
│  │                             │ │ DSO:            18 dias     ││
│  │                             │ │ Break-even:     $6.8M/mes  ││
│  └─────────────────────────────┘ └─────────────────────────────┘│
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Alertas Financieras                                         ││
│  │ ⚠ Inventario bajo: Falda Col A Talla 12 (3 unidades)       ││
│  │ ⚠ Margen comprimido: Col D margen 28% (target 35%)         ││
│  │ ✓ Presupuesto nomina: 72% usado (dentro de meta)           ││
│  └─────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────┘
```

### Paginas

| Pagina | Contenido |
|--------|-----------|
| `/finance` | Dashboard ejecutivo (cards + charts + alertas) |
| `/finance/pl` | P&L detallado con drill-down por school/product family |
| `/finance/cash-flow` | Flujo de caja diario/semanal/mensual con proyeccion |
| `/finance/margins` | Analisis de margenes por producto/familia/colegio |
| `/finance/projections` | Modelo de proyecciones con escenarios |
| `/finance/budgets` | Presupuestos vs actuals con alertas |
| `/finance/periods` | Gestion de periodos contables (abrir/cerrar) |

---

## Modelo de Proyeccion: Inputs Especificos UCR

### Assumptions Schema

```json
{
  "base_period": {
    "year": 2026,
    "month": 1,
    "revenue": 12500000,
    "cogs": 7250000,
    "fixed_costs": 3200000,
    "variable_costs": 800000
  },
  "branches": [
    {
      "name": "Centro",
      "monthly_rent": 1500000,
      "utilities": 200000,
      "staff_cost": 2800000,
      "schools": [
        {
          "name": "Colegio A",
          "students_total": 800,
          "penetration_rate": 0.65,
          "avg_items_per_student": 3.2,
          "avg_unit_price": 45000,
          "avg_unit_cost": 26000,
          "growth_rate": 0.02
        }
      ]
    }
  ],
  "seasonality": {
    "1": 2.5, "2": 1.8, "3": 0.6, "4": 0.4,
    "5": 0.3, "6": 0.5, "7": 1.2, "8": 0.8,
    "9": 0.4, "10": 0.3, "11": 0.5, "12": 0.4
  },
  "expansion": [
    {
      "month": 3,
      "type": "new_branch",
      "name": "Norte",
      "monthly_rent": 1200000,
      "schools": [...]
    }
  ],
  "inflation_annual": 0.06,
  "hiring": [
    {"month": 3, "role": "vendedora", "salary": 1300000}
  ],
  "b2b_pipeline": {
    "recurring_contracts": [
      {
        "client_name": "Restaurante X",
        "segment": "restaurant",
        "amount_per_cycle": 9000000,
        "cycles_per_year": 2,
        "first_cycle_month": 6,
        "gross_margin_pct": 0.42,
        "deposit_pct": 0.50,
        "payment_terms_days": 0
      },
      {
        "client_name": "Empresa Y (dotacion legal)",
        "segment": "corporate",
        "amount_per_cycle": 6000000,
        "cycles_per_year": 3,
        "first_cycle_month": 4,
        "gross_margin_pct": 0.38,
        "deposit_pct": 0.40,
        "payment_terms_days": 30
      }
    ],
    "one_shot_pipeline": [
      {
        "client_name": "Evento maraton ciudad",
        "segment": "event",
        "amount": 18000000,
        "probability": 0.6,
        "expected_month": 9,
        "gross_margin_pct": 0.35
      }
    ],
    "new_client_acquisition": {
      "contracts_per_quarter": 1,
      "avg_contract_value": 7000000,
      "avg_gross_margin_pct": 0.40,
      "ramp_start_month": 7
    }
  },
  "saas_revenue": {
    "start_month": 7,
    "clients_by_month": [0, 0, 0, 0, 0, 0, 1, 1, 2, 2, 3, 3],
    "monthly_fee": 350000,
    "setup_fee": 500000
  }
}
```

### Reglas de calculo del stream B2B

El bloque `b2b_pipeline` se proyecta con timing **independiente de la `seasonality` escolar**:

1. **Reconocimiento de ingreso por entrega, no por anticipo.** El anticipo entra a **caja** (cash inflow) en el mes del deposito; el **ingreso (revenue) del P&L** se reconoce en el mes de entrega. Modelar ambos timings por separado — cash flow != P&L.
2. **COGS** = `amount * (1 - gross_margin_pct)`, reconocido junto al ingreso (matching).
3. **Saldo a credito** (`payment_terms_days > 0`): el cash inflow del saldo ocurre `payment_terms_days` despues de la entrega. Impacta DSO.
4. **Pipeline one-shot ponderado:** escenario base usa `amount * probability`; optimista `probability=1`; pesimista `probability=0`.
5. **Contracalendario:** el B2B NO se multiplica por la `seasonality`. Usa su propio `first_cycle_month` + `cycles_per_year` (recurrentes) o `expected_month` (one-shot).
6. **IVA:** la dotacion corporativa/eventos **grava IVA** (a diferencia del uniforme escolar excluido). Si el negocio es responsable de IVA, separar el IVA del ingreso. Ver `formalization/02-tributario.md`.

> Detalle del modelo de negocio, segmentos y tratamiento contable de anticipos en [b2b-contracts-model.md](./b2b-contracts-model.md).

### Sensitivity Tables

| Tabla | Eje X | Eje Y | Metrica |
|-------|-------|-------|---------|
| 1 | Precio promedio | Margen % | Utilidad mensual |
| 2 | Num estudiantes | Penetracion | Revenue mensual |
| 3 | Costos fijos | Margen bruto % | Break-even units |
| 4 | Num sucursales | Revenue por sucursal | Cash flow anual |
| 5 | Clientes SaaS | Fee mensual | Revenue SaaS anual |
| 6 | Estacionalidad peak | Off-peak multiplier | Cash runway minimo |
| 7 | Num contratos B2B/trimestre | Ticket promedio contrato | Revenue B2B anual + suavizado de estacionalidad (coef. variacion mensual del revenue total) |

---

## Exportacion

### XLSX (openpyxl, patron OndaFin)
- Hoja "P&L" — formato contable con totales, subtotales, margenes %
- Hoja "Cash Flow" — diario/mensual con graficos embebidos
- Hoja "KPIs" — tabla resumen por periodo
- Hoja "Por Sucursal" — comparativo branch vs branch
- Hoja "Proyecciones" — modelo completo con assumptions + outputs

### PDF (reportlab)
- Reporte ejecutivo 1-pager: cards KPI + P&L summary + cash position
- Reporte detallado: P&L + Balance + Cash Flow + Notas

---

## Implementacion Incremental

| Fase | Componente | Complejidad | Valor |
|------|-----------|-------------|-------|
| 1 | P&L por periodo/branch | Media | Alto — base de todo |
| 2 | KPIs + dashboard cards | Baja | Alto — visibilidad inmediata |
| 3 | Cash flow report | Media | Alto — decision de liquidez |
| 4 | Accounting periods + snapshots | Media | Medio — auditabilidad |
| 5 | Budgets + alerts | Media | Medio — control operativo |
| 6 | Projections engine | Alta | Alto — venta del software |
| 7 | XLSX/PDF export | Baja | Medio — presentacion |
| 8 | Sensitivity analysis | Media | Medio — decision estrategica |

---

[← Volver al indice](./README.md)
