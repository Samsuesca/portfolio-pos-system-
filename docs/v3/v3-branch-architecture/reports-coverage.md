# Reports Coverage — Arquitectura v3

> **Estado:** Fases 1-5 implementadas (2026-05-24). Vive junto a
> [`financial-model-design.md`](./financial-model-design.md),
> [`b2b-contracts-model.md`](./b2b-contracts-model.md) y
> [`branch-architecture.md`](./branch-architecture.md). Documenta el módulo
> `/reports` como pieza arquitectónica de primera clase en v3.

## Contexto

El módulo `/reports` (frontend `frontend/src/pages/Reports.tsx` + endpoints
`backend/app/api/routes/global_reports.py`) estaba sesgado hacia Ventas:
4 de 7 tabs hablaban de ventas, Encargos no aparecía como tab dedicado,
y Arreglos tenía un bug donde el summary ignoraba el filtro de fecha.
El audit de Mayo 2026 además detectó:

- **Bugs R1/R2/R3** (resueltos en commit `1ab192b`): COGS usando `Product.cost`
  actual en vez de `SaleItem.unit_cost` snapshot; reportes agregando por
  `Sale.payment_method` ignorando `SalePayment` (split payments); Nequi
  omitido en el desglose diario.
- **Bug 9**: AlterationsSummary no aceptaba filtros de fecha.
- **Bug 12**: 3 implementaciones paralelas de "revenue por colegio" que
  divergían entre sí.
- **Hotfix histórico** (commit `adcb943`): 27 query sites sumaban ventas
  migradas (`Sale.is_historical=True`) en agregados de dashboard y reportes.

Esta iniciativa eleva Reports a iniciativa arquitectónica formal con
cobertura paritaria de los 3 streams de revenue (Ventas, Encargos,
Arreglos), un servicio unificado (`RevenueStreamService`), y hooks
listos para B2B (post-v3.0.0) y sucursales (v3.1).

## Pilares de la implementación

### 1. Tres streams cubiertos con paridad

| Stream | Tab dedicado | Endpoints | Profitability | Top lists |
|---|---|---|---|---|
| Ventas | ✅ Ventas | 5 endpoints `/sales/*` | ✅ unit_cost snapshot | ✅ products + clients |
| Encargos | ✅ Encargos (nuevo) | 7 endpoints `/orders/*` | ✅ unit_cost snapshot | ✅ products + clients + status funnel + cumplimiento |
| Arreglos | ✅ Arreglos (mejorado) | 3 endpoints `/alterations/*` | n/a (servicio puro) | ✅ tipos + response time |

### 2. RevenueStreamService unificado

[`backend/app/services/revenue_streams.py`](../../../backend/app/services/revenue_streams.py).
Strategy pattern donde cada stream tiene un calculator concreto
(`SalesStreamCalculator`, `OrdersStreamCalculator`,
`AlterationsStreamCalculator`) registrado en `RevenueStreamService.__init__`.
Agregar B2B o SaaS es **una clase + una entrada en el registry**, cero
cambios en endpoints o schemas.

```
RevenueStreamService
  ├─ SalesStreamCalculator       (revenue = sum(SaleItem.subtotal))
  ├─ OrdersStreamCalculator      (accrual: Order.delivered_at | cash: Transaction.amount)
  ├─ AlterationsStreamCalculator (cash: AlterationPayment.amount | accrual: Alteration.cost)
  ├─ B2BContractsStreamCalculator [STUB Fase 4 — registrado, retorna 0+note]
  └─ SAAS                        [reservado, sin calculator todavía]
```

**Invariante crítico:** `sum(streams[*].revenue) == totals.revenue` para
cualquier filtro. Validado por test
`tests/api/test_reports_streams_accuracy.py::TestStreamsSummaryInvariants`.

### 3. Single source of truth para COGS

[`backend/app/services/_cogs_resolver.py`](../../../backend/app/services/_cogs_resolver.py).
Helper compartido que expone la expresión SQL `CASE` del fallback chain:

```python
unit_cost (snapshot at sale time)
  → product.cost (current catalog)
    → unit_price * 0.80 (estimate)
```

Importado por:
- `app/services/financial_statements.py` (P&L)
- `app/api/routes/global_reports.py` (sales profitability)
- `app/services/accounting/financial_model/profitability.py`
- `app/services/order/analytics.py` (orders profitability — Fase 1)
- `app/services/revenue_streams.py` (cada stream calculator)

Cierra Bug 12: las 5 implementaciones que antes divergían ahora consumen
una única expresión.

### 4. Permission model

Tres permisos nuevos agregados en `EXTRA_REGISTRY_PERMISSIONS`
(`app/services/permission.py`):

| Permiso | Default | Función |
|---|---|---|
| `reports.orders` | ADMIN | Gates los endpoints operacionales de `/orders/*` |
| `reports.alterations` | ADMIN | Gates los endpoints de `/alterations/*` (period revenue) |
| `reports.cost_visibility` | ADMIN (sensitive) | Cuando ausente, los endpoints de profitability/streams enmascaran `cogs`, `gross_profit`, `gross_margin` como `null`. Análogo a `inventory.view_cost` |

### 5. Branch awareness (preparación v3.1)

Cada endpoint y cada calculator acepta `branch_id: UUID | None = None`
como parámetro. Hoy es no-op (ignorado en las queries). Cuando v3.1
mergee con la tabla `Branch` y los FKs en tablas transaccionales:

- Update único en cada calculator: agregar
  `if filters.branch_id: query = query.where(Model.branch_id == filters.branch_id)`
- Cero cambio en endpoints, schemas, ni URLs
- El frontend ya recibe el parámetro y solo necesita un dropdown

Ver `branch-architecture.md` para el roadmap de la tabla.

## Endpoints completos

### Encargos (Fase 1)

| Endpoint | Permission | Response |
|---|---|---|
| `GET /global/reports/orders/summary` | `reports.orders` | `OrdersSummary` |
| `GET /global/reports/orders/status-funnel` | `reports.orders` | `OrdersStatusFunnel` |
| `GET /global/reports/orders/on-time-delivery` | `reports.orders` | `OrdersOnTimeDelivery` |
| `GET /global/reports/orders/cumplimiento` | `reports.orders` | `list[OrdersCumplimientoRow]` |
| `GET /global/reports/orders/top-products` | `reports.orders` | `list[OrdersTopProduct]` |
| `GET /global/reports/orders/top-clients` | `reports.orders` | `list[OrdersTopClient]` |
| `GET /global/reports/orders/profitability/by-school` | `reports.financial` (+ `reports.cost_visibility` para columnas COGS) | `OrdersProfitabilityResponse` |

### Arreglos (Fase 2)

| Endpoint | Permission | Response |
|---|---|---|
| `GET /global/reports/alterations/summary` | `reports.alterations` (+ `alterations.view_revenue` para columnas financieras) | `AlterationsSummary` (extendido con campos `*_in_period`) |
| `GET /global/reports/alterations/response-time` | `reports.alterations` | `AlterationsResponseTime` |
| `GET /global/reports/alterations/top-types` | `reports.alterations` | `list[AlterationsTopType]` |

### Streams unificados (Fase 3)

| Endpoint | Permission | Response |
|---|---|---|
| `GET /global/reports/revenue/streams-summary` | `reports.financial` | `StreamSummary` |
| `GET /global/reports/revenue/streams-monthly` | `reports.financial` | `StreamMonthlyReport` |
| `GET /global/reports/revenue/streams-by-school` | `reports.financial` | `StreamsBreakdownBySchool` |

Todos aceptan `start_date`, `end_date`, `school_id?`, `branch_id?`
(no-op), y donde aplica `basis?=accrual` (`cash` | `accrual`),
`streams?[]` para subset selection.

## Esquema de datos

### Migraciones nuevas (Fase 1.1)

`alembic/versions/reports_cov_001_delivered_ready_at.py`:
- `orders.delivered_at TIMESTAMP NULL` (set por `OrderStatusMixin.update_status` cuando transición → DELIVERED)
- `alterations.ready_at TIMESTAMP NULL` (set por `AlterationService.update`/`update_status` cuando transición → READY)
- Índices en ambas columnas para queries de lead time

**Backfill:** NULL para datos históricos. Reports excluyen filas NULL del
avg de tiempo (nunca aproximan con `updated_at`). Los KPIs de lead time
y response time son confiables solo desde fecha de deploy.

### Schemas Pydantic nuevos

[`backend/app/schemas/reports.py`](../../../backend/app/schemas/reports.py) (módulo nuevo):

- Orders: `OrdersSummary`, `OrdersStatusCounts`, `OrdersStatusFunnel`,
  `OrdersOnTimeDelivery`, `OrdersCumplimientoRow`,
  `OrdersProfitabilityRow`, `OrdersProfitabilityResponse`,
  `OrdersTopProduct`, `OrdersTopClient`
- Alterations: `AlterationsResponseTime`, `AlterationsTopType`,
  `AlterationsOverdueRow` (forward-declared)
- Streams: `RevenueStreamId`, `RevenueBasis`, `StreamBreakdown`,
  `StreamSummary`, `StreamMonthlyPoint`, `StreamMonthlyReport`,
  `StreamsSchoolBreakdownRow`, `StreamsBreakdownBySchool`

Antes de Fase 1, los endpoints de reports retornaban dicts crudos —
violación de `api-design.md`. Este módulo es la fuente canónica.

## Frontend

### Estructura de tabs

Default landing tab: **Resumen** (Fase 3), persistido en
`localStorage('reports.activeTab')` para que muscle memory gane después
de la primera visita.

```
[Resumen*] [Ventas] [Encargos] [Rentabilidad] [Financiero Global]
[Log de Movimientos] [Arreglos] [Mov. Inventario] [Análisis Mensual]
```

### Componentes nuevos

- `OverviewReport.tsx` — tab Resumen 360 con 3 stream cards + totales
  + tabla por colegio + toggle accrual/cash
- `OrdersReport.tsx` — tab Encargos con 6 KPIs + funnel + cumplimiento
  + top products/clients

### Patrón de servicios

`frontend/src/services/reportsService.ts` extendido con 9 métodos nuevos
+ tipos TypeScript que mirroran los schemas Pydantic. Pattern
consistente: cada método toma `GlobalReportFilters` y retorna una
Promise tipada.

## Estado de implementación

| Fase | Deliverable | Commits | Estado |
|---|---|---|---|
| **1.1** | Migración `delivered_at`/`ready_at` + hooks status | `06cb7d7` | ✅ |
| **1.2** | `_cogs_resolver` helper + refactor 3 servicios | `e7306d2` | ✅ |
| **1.3-1.5** | Backend Orders (schemas + mixin + 7 endpoints + permisos) | `4ac742d` | ✅ |
| **1.6** | Tests `test_reports_orders_accuracy.py` + fix SQL date arithmetic | `28452e2` | ✅ |
| **Hotfix** | Excluir ventas históricas en 27 query sites | `adcb943` | ✅ |
| **1 FE** | OrdersReport.tsx + tab Encargos | `e685c8e` | ✅ |
| **2 BE** | Alterations summary date-aware + response-time + top-types | `a5acea5` | ✅ |
| **2 FE** | AlterationsReport mejorado + alterationService extendido | `b7f6765` | ✅ |
| **3 BE** | `RevenueStreamService` + 3 endpoints unificados + tests | `739ca0e` | ✅ |
| **3 FE** | OverviewReport.tsx + tab Resumen + default landing | `d1371f8` | ✅ |
| **4** | B2B stub (`B2BContractsStreamCalculator` registrado) | (incluido en `739ca0e`) | ✅ |
| **5** | Branch param wired no-op | (incluido en Fase 1+3) | ✅ |
| **6** | Docs v3 (este documento + actualizaciones) | (en curso) | 🔄 |

Bugs cerrados como side-effect:

- ✅ Bug R1 (COGS con `Product.cost` actual) — fix en `1ab192b`
- ✅ Bug R2 (split payments collapsados) — fix en `1ab192b`
- ✅ Bug R3 (Nequi omitido en daily sales) — fix en `1ab192b`
- ✅ Bug 9 (Alterations summary sin filtro fecha) — fix en `a5acea5`
- ✅ Bug 12 (3 implementaciones de revenue por colegio) — dedup en `e7306d2`
- ✅ Hotfix histórico (ventas migradas en agregados) — fix en `adcb943`

## Backfill Checklist — Histórico de timestamps

> Procedimiento obligatorio antes del primer deploy de la rama Reports
> Coverage a producción. Resuelve el P0 detectado por QA 2026-05-24:
> sin backfill, el tab Resumen muestra $0 en Encargos accrual (~$23M
> invisibles) y los widgets de tiempo de respuesta de Arreglos
> retornan `null`.

### Contexto

La migración `reports_cov_001` añadió `orders.delivered_at` y
`alterations.ready_at` como nullable. Los hooks en `update_status`
poblan estas columnas solo en transiciones de status **nuevas**. Las
filas históricas (toda data pre-deploy) quedan NULL → ausentes de
agregaciones accrual y de KPIs de tiempo.

El plan original priorizó correctness ("no aproximar con
`updated_at`") sobre visibilidad. En la práctica, el costo es muy
alto: el dueño del negocio pierde la vista histórica entera del
Resumen tab hasta acumular ~6 meses de transiciones nuevas. Decisión
revisada: aplicar backfill con `updated_at` y documentar la
aproximación.

### Script

`backend/scripts/backfill_reports_timestamps.py` — idempotente,
dry-run por default, reversible con `--revert`.

### Checklist (DEV antes que PROD)

#### 1. Pre-flight

- [ ] Backend levantado con la migración `reports_cov_001` aplicada:
      `venv/bin/python -m alembic current` muestra `reports_cov_002` o
      posterior
- [ ] Tests pasando en local: `pytest tests/api/test_reports_*.py`
- [ ] Snapshot de la DB tomado:
      `pg_dump uniformes_db > backup_pre_backfill_$(date +%F).sql`

#### 2. Dry-run

```bash
cd backend
venv/bin/python -m scripts.backfill_reports_timestamps
```

Verifica el output:
- ¿El conteo de "Orders DELIVERED missing" coincide con tu expectativa?
- ¿El "revenue invisible" cuadra con lo que el QA reportó para tu DB?
- ¿Alterations missing es similar a la suma de READY + DELIVERED legacy?

#### 3. Aplicar (irreversible en data real)

```bash
venv/bin/python -m scripts.backfill_reports_timestamps --commit
```

Output esperado: bloque "AFTER" con `missing: 0`.

#### 4. Verificación post-backfill

Comprobar que los reportes ahora muestran data accrual:

```bash
TOKEN=<auth_token_admin>
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8001/api/v1/global/reports/revenue/streams-summary?start_date=2026-01-01&end_date=2026-12-31&basis=accrual" \
  | python3 -m json.tool | grep -A2 '"orders"'
```

Debe mostrar `orders.revenue > 0`. Antes del backfill mostraba `$0`.

Para arreglos:

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8001/api/v1/global/reports/alterations/response-time?start_date=2026-01-01&end_date=2026-12-31" \
  | python3 -m json.tool
```

Debe mostrar `avg_received_to_ready_days` ≠ null.

#### 5. UI smoke test

- [ ] Navegar a `/reports/resumen` (default tab)
- [ ] Cambiar basis a "Devengado" — la card "Encargos" muestra revenue
      acumulado, no $0
- [ ] Navegar a `/reports/arreglos` — el widget "Tiempo de respuesta"
      muestra valores en lugar de "—"

#### 6. Comunicación

- [ ] Anunciar al equipo: "Las métricas de lead time y response time
      sobre data anterior al deploy son aproximadas (basadas en
      `updated_at`, no en el timestamp exacto de la transición de
      status). Los rows nuevos tienen el timestamp exacto."
- [ ] Actualizar `sprint-log.md` con el commit hash que aplicó el
      backfill.

### Procedimiento en PROD

Mismo flujo. Diferencias clave:

1. **Backup completo de la DB** antes del paso 3, no solo el snapshot
   pre_backfill — incluyendo blobs y restore-tested:
   ```bash
   ssh root@<VPS> "pg_dump uniformes_prod > /tmp/backup_$(date +%F-%H%M).sql"
   ```

2. **Ventana de mantenimiento** corta (~2 min): el UPDATE escanea
   `orders` y `alterations` completos. En producción son < 10K rows
   combinadas, así que está bien.

3. **Verificar antes de cerrar la ventana**:
   - Spot-check 3 órdenes recientes DELIVERED — `delivered_at` debe
     ser ≤ `updated_at` (puede ser igual o menor si `updated_at` fue
     re-tocado después de la entrega).
   - El widget Resumen muestra Encargos ≠ $0.

### Revertir (solo en DEV)

Si el backfill produce datos ridículos en algún edge case:

```bash
venv/bin/python -m scripts.backfill_reports_timestamps --revert --commit
```

Pone todos los `delivered_at` y `ready_at` de vuelta en NULL. NO usar
en producción — perderías todos los timestamps reales que los hooks
han poblado desde el deploy.

### Mejoras futuras (no bloqueantes)

- **Heurística más fina para Orders**: usar `MAX(OrderItem.status_updated_at)
  WHERE item_status = DELIVERED` como timestamp más cercano a la
  entrega real. `OrderItem.status_updated_at` existe en el modelo
  (`backend/app/models/order.py:251`) y es más resistente a ediciones
  posteriores que `Order.updated_at`. Pendiente: confirmar que el
  hook que setea ese campo lo hace en cada transición de
  item_status.

- **Indicador visual** en la UI: cuando una métrica de tiempo usa
  data backfilled (vs. nativa), mostrar un asterisco + tooltip
  "Aproximado para registros pre-2026-05-24". Requiere agregar un
  campo `data_quality` al response del endpoint y filtrarlo en el
  frontend.

---

## Próximos pasos (post-v3.0.0)

1. **B2B implementation real**: cuando la tabla `b2b_contracts` aterrice,
   reemplazar `B2BContractsStreamCalculator` (stub) con la implementación
   que respete la lógica anticipo → revenue al milestone. Endpoints y
   schemas no se tocan.

2. **v3.1 Branch activation**: cuando `Branch` mergee, agregar la
   condición `if filters.branch_id: ...` en cada calculator. Frontend
   habilita el dropdown que hoy está stubbed disabled.

3. **Monthly COGS para Orders**: el cálculo de COGS por mes en
   `OrdersStreamCalculator.monthly_series` está intencionalmente omitido
   (sería una query por mes y degradaría el endpoint). Cuando el modelo
   financiero requiera margen mensual por stream, agregar una segunda
   query agregada por month_trunc.

4. **Performance**: si `streams-monthly` con rango > 12 meses se vuelve
   lento, agregar caching (Redis) para periods cerrados (> 1 mes atrás).
   Sin urgencia hasta que se observe latencia real.

5. **Alterations branch-scoping**: hoy alteraciones no se segmentan por
   colegio (taller centralizado). Si v3.1 introduce talleres por
   sucursal, agregar `branch_id` al modelo `Alteration` y reactivar el
   filtro en el calculator.

## Referencias

- [`docs/v3/v3-branch-architecture/financial-model-design.md`](./financial-model-design.md)
  — diseño del modelo financiero que consume `RevenueStreamService`
- [`docs/v3/v3-branch-architecture/b2b-contracts-model.md`](./b2b-contracts-model.md)
  — modelo B2B futuro (cómo el stub se convierte en implementación real)
- [`docs/v3/v3-branch-architecture/branch-architecture.md`](./branch-architecture.md)
  — diseño de sucursales (cómo se activa `branch_id`)
- [`docs/v3/v3-branch-architecture/v3-release-scope.md`](./v3-release-scope.md)
  — Iniciativa 9: Reports Coverage Expansion
- Plan original: `~/.claude/plans/profundiza-en-un-plan-serialized-frog.md`
