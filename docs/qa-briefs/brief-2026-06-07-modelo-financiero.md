# Code Review + QA — Modelo Financiero

> **Fecha:** 2026-06-07 · **Rama:** `main` · **Auditor:** Claude (code-review + qa-agent)
> **Alcance:** feature completa del modelo financiero + Panel CFO (~6.200 LOC)
> **Entorno QA:** local Docker (`:8001` API, `:5171` UI), login `samuel` (superusuario)

---

## 1. Resumen ejecutivo

Auditoría profesional (arquitectura, seguridad, performance, testing, calidad) + QA en vivo (API por `curl` y UI por Chrome DevTools) del **modelo financiero** de uniformes-system-v2: el paquete `financial_model/` (backend), los 8 paneles + `projections/` (frontend), el Panel CFO, sus 3 services y tests.

**Veredicto inicial: 59.5 / 80.** Buena ingeniería de base (auth blindada, patrón `safe_ratio`→`None`, disciplina `Decimal`) socavada por **tres fuentes de verdad divergentes** que ya producían números contradictorios al usuario. Todas corregidas en este sprint.

| Categoría | Score | Peso | Ponderado |
|-----------|------|------|-----------|
| Security | 9/10 | 3× | 27 |
| Architecture | 6.5/10 | 2× | 13 |
| Performance | 6/10 | 1× | 6 |
| Testing | 6.5/10 | 1× | 6.5 |
| Code Quality | 7/10 | 1× | 7 |
| **TOTAL** | | | **59.5 / 80** |

**Metodología:** 3 agentes estáticos en paralelo (backend / frontend / arquitectura) + 1 workflow multi-agente para el finding #10 + pase personal de corrección financiera + 13 endpoints probados en vivo + 3 pantallas navegadas en Chrome. Hallazgos clave **triangulados y confirmados en datos reales**.

---

## 2. Hallazgos

### 🔴 Críticos

1. **Runway: dos fuentes de verdad contradictorias.** Panel CFO mostraba "38 días" (burn = gastos fijos + nómina) mientras Proyección caja mostraba "3.3 meses" (burn neto canónico) para el mismo negocio — divergencia 2.6× en el KPI de liquidez más importante. **Confirmado en vivo** (`cash-forecast.runway_months=3.28` vs `cfo.cash_runway_days=38`). → **CORREGIDO** (commit `9258fbc`).

2. **COGS divergente.** `kpis._get_cogs` calculaba `quantity * coalesce(Product.cost,0)` sin el resolver compartido ni filtro de estado, mientras `profitability.py` y `financial_statements` usan `_cogs_resolver` + `COMPLETED`/no-histórico → el Margen Bruto del KPI dashboard ≠ Rentabilidad ≠ Estado de Resultados. 191 productos sin costo contaban COGS=0 (margen inflado). → **CORREGIDO** (commit `c71e909`).

3. **BudgetPanel: `NaN` persistido + errores silenciados.** `Number(e.target.value)` con guard `<= 0` (que `NaN` evade) → presupuesto corrupto en BD; `catch {}` vacíos en crear/eliminar → sin feedback al usuario. → **CORREGIDO** (commit `4138b4f`).

### ⚠️ Advertencias

4. **`net_margin` ≡ `operating_margin` siempre** (no se modelan impuestos/intereses) pero con umbrales distintos → dos tarjetas con el mismo número y distinto color. **Confirmado en vivo** (idénticos a 26 decimales). → **CORREGIDO** (`c71e909`).
5. **EBITDA sumaba depreciación ACUMULADA** (saldo de balance) a una utilidad de período → sobreestimación latente. → **CORREGIDO** (`c71e909`).
6. **Tendencia de Margen Bruto siempre plana** (`_compute_margin_trend` aplicaba un único `cogs_ratio` del período a todos los meses). → **CORREGIDO** (`c71e909`): ahora real mes a mes.
7. **N+1 queries:** series mensuales de KPIs (hasta 48) y trends (hasta ~80), budget-vs-actual (1/budget). → **CORREGIDO** KPIs (`c71e909`) y trends (`92124c5`); budgets diferido (N bajo + riesgo `school_id=None`).
8. **`budget-vs-actual.period_type` sin validar** (`str` libre → `bogus` devolvía 200). → **CORREGIDO** (`913857e`): `Literal`, ahora 400.
9. **`cfo_dashboard.py` reimplementaba el dominio inline** (runway, burn, alertas, health) ignorando el paquete + resucitaba el centinela `999`. → **PARCIAL**: runway y deuda ya migrados a la fuente canónica (`9258fbc`, `2cdb1ed`); extracción a `CFODashboardService` pendiente (P2).
10. **Deuda/activos ignoraban CxP/CxC/inventario** → CFO "Deuda $0", KPI "Ratio Endeudamiento 0.00" pese a $19.4M en pasivos. → **CORREGIDO** (`2cdb1ed`): ambos consumen `PatrimonyService` (balance canónico). Verificado en vivo: CFO Deuda $19.435.000, debt_ratio 0.25.

### 💡 Sugerencias (pendientes / P2)

- `projection.py:90` `datetime.utcnow()` → `get_colombia_now_naive` (regla TZ).
- `_math.py` `date.today()` defaults → `get_colombia_date` (latente).
- Mensajes en inglés: `"Budget not found"`, mensaje de delete de budget.
- `/kpis` acepta `period` pero no lo usa (parámetro muerto).
- **Frontend:** `CFODashboard.tsx:105` `toLocaleTimeString` sin `timeZone:'America/Bogota'`; `formatMoney` duplicado en 5 paneles (riesgo `$NaN`, usar `formatCurrency` central); `any` en catches/formatters Recharts; sin `React.lazy` en paneles con Recharts; `console.error` en prod.

### ✅ Fortalezas confirmadas

- **Auth blindada:** `require_global_permission("reports.financial")` a nivel de router; 403 sin token en todos los probados; sin fuga cross-tenant.
- **Cero `Infinity`/`NaN`** en 13 endpoints ni en la UI: patrón `safe_ratio`→`None`→`"—"` con `tooltip_unavailable` end-to-end.
- **`_runway.py` y `_cogs_resolver.py`:** consolidaciones ejemplares (ahora adoptadas en todos lados).
- Disciplina `Decimal` para dinero; validación de inputs (Literals, rango de fechas → 400 ES, parseo UUIDs); `projectionService.ts` coacciona `Decimal→number` en el boundary con type-safety ejemplar.
- Consola limpia (solo warnings de React Router v7); buenos estados loading/error/empty.

---

## 3. QA en vivo

### API (13 endpoints)
- **Happy path:** 13/13 → 200, sin `Infinity/NaN` en ningún payload.
- **Auth:** 4/4 sin token → 403.
- **Validación:** rechaza entradas malas (como **400**, no 422 — desvía de `api-design.md` y de los comentarios de las rutas; cosmético/global, documentado).
- **Probe de consistencia cross-source (clave):** demostró en vivo las divergencias de runway (98d vs 38d), `net≡operating` (idénticos), y deuda (0 vs $19.4M) — todas corregidas después.

### UI (Chrome DevTools)
- Pantallas navegadas: KPIs (Indicadores), Proyección caja, Panel CFO.
- Confirmado visualmente: `—`/"Sin datos suficientes" sin `NaN%`; runway unificado (99 días == 3.3 meses tras el fix); deuda real $19.4M tras el fix.
- Consola sin errores (solo React Router v7 future-flags).
- Capturas en `docs/qa-briefs/fm-screens/` (`fm-01-kpis`, `fm-02-proyeccion-caja-runway`, `fm-03-panel-cfo-runway38` [antes], `fm-04-panel-cfo-runway99-AFTER`).

---

## 4. Fixes aplicados (commits en `main`)

| Commit | Finding(s) | Archivo(s) |
|--------|-----------|-----------|
| `c71e909` | #2, #4, #5, #6, #7a | `financial_model/kpis.py` |
| `92124c5` | #7b | `financial_model/trends.py` |
| `9258fbc` | #1 | `routes/cfo_dashboard.py` |
| `913857e` | #8 | `routes/financial_model.py` |
| `4138b4f` | #3 | `financial-model/BudgetPanel.tsx` |
| `2cdb1ed` | #10 | `kpis.py` + `routes/cfo_dashboard.py` |

**Verificación:** todos confirmados en vivo (API + UI). Tests unitarios de KPIs (24) y, en runs estables previos, las suites de financial-model/CFO/runway pasaban. Al cierre, la suite API estaba roja por una **sesión paralela editando `conftest.py`/`main.py`/`auth.py`** + flakiness pre-existente de asyncpg ("different loop" en `get_current_user`) — **probado no atribuible a estos cambios** (con los cambios stasheados los tests fallan igual/peor; los tests de KPIs que fallan mockean `KPIService`).

---

## 5. Notas de comportamiento (sin sorpresas para el dueño)

- **El health score del CFO NO bajó** tras incluir la deuda real, y es correcto: contando todos los activos ($76.6M incl. inventario + CxC), el apalancamiento real es bajo (debt_ratio 0.25). La deuda es ahora **visible** ($19.4M), pero el negocio está bien capitalizado. El DSCR sigue en 999 porque el préstamo Cristina (CxP $19M) **no tiene fecha de vencimiento** → nada vence en 30 días. Si se desea que el *score* penalice el peso de deuda (no solo mostrarlo), es un cambio de fórmula aparte.
- **"Liquidez Disponible" (CFO) se mantiene como efectivo** (caja+banco); los KPIs `current_ratio`/`acid_test`/`working_capital` sí usan los activos corrientes canónicos (efectivo+inventario+CxC).

---

## 6. Pendiente (P2)

- **#9** extraer `CFODashboardService` (mover lógica inline de la ruta al paquete).
- **Polish frontend:** TZ en `CFODashboard.tsx`, consolidar `formatMoney`→`formatCurrency`, quitar `any`, `React.lazy` en paneles Recharts, `console.error`.
- **#7c** batch de actuals en `budget-vs-actual` (N bajo; cuidado con semántica `school_id=None`).
- **Suite API:** correr en limpio cuando la sesión paralela libere `conftest.py`/`main.py`/`auth.py`.
- **Deuda de la suite:** aislamiento cross-file de tests API (≈16 errors al batchear varios `tests/api/*` juntos; pasan individualmente).
