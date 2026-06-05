# v3.0.0 Release Scope — Cambios Pendientes de Deploy

> **Desde:** v2.9.0 (produccion actual al 2026-05-24)
> **Hacia:** v3.0.0
> **Estado:** ✅ **MERGEADO A `main`** (`9cb0913` el ~2026-05-10) tras el Sprint Q2. ⏸️ **DEPLOY A PROD DIFERIDO** — sin ventana asignada.
> **Fecha original del doc:** 2026-04-13
> **Ultima actualizacion:** 2026-05-24

---

## Estado real al 2026-05-24

- **Codigo en `main`:** scope v3.0.0 + Sprint Q2 (5 bugs, Gap A, pnpm 11, permission seed) consolidado en `9cb0913`. Encima de ese merge se sumaron 11 commits adicionales mayo 17 → mayo 24 (financial-model multi-fase, OAuth Google, alterations, equipo seed, design cleanup head, runbooks pnpm/deploy, **reports money accuracy** `1ab192b`, reorganizacion equipo `45c3a8e`). HEAD local **11 commits adelante de `origin/main`** — falta `git push`.
- **Working tree sin commitear:** Iniciativa 6 (permisos `inventory.view_cost`) e Iniciativa 8 (aislamiento de tests) pendientes de commit. Iniciativa 10 (Alegra DIAN) en working tree pero con gaps de wiring (config.py). Iniciativa 7 (reports money accuracy) **ya commiteada** en `1ab192b`. Adiciones grandes untracked: bank reconciliation, storefront `/v3-preview/`, formalizacion 8-dim reestructurada, audit prod, QA briefs, deployment runbooks.
- **Bloqueante humano (no codigo):** Iniciativa 11 — auditoria forense de los 25 encargos obsoletos (~$2.56M huerfanos, incluye JUCUM $848K). Prompt restaurado, sesion sin agendar. **El owner declaro 2026-05-24: sin esta consolidacion no se sube v3 a estable.** → tracked como GATE 0.
- **Bloqueante de infraestructura:** VPS produccion sigue en Node 20.19.6 sin pnpm. El workflow `cd.yml` ya migrado a pnpm revienta al ejecutar `pnpm install`. Pasos manuales (UNA SOLA VEZ) documentados en [`pnpm-deploy-runbook.md`](../../deployment/pnpm-deploy-runbook.md) → tracked como GATE 1.
- **DB dev:** alembic head `v3_design_cleanup_001`. 28 migraciones aplicadas sin perdida sobre data prod fresca (ver [sprint-log.md M2](../formalization/sprint-log.md)).
- **Produccion:** sigue en **v2.9.0**. No se ha tocado desde el sprint. Tiene los bugs de logica conocidos (set_balance silente, mark_debt_as_paid no atomico, archivado de pasivos con saldo, AR sin due_date, expense category sin FK) **+ 3 bloqueantes adicionales recien detectados via audit 2026-05-16** (slugs corruptos, primary_color NULL, catalogo CARACAS-001 vacio). Ver §"Bloqueantes de prod" abajo.
- **Ventana de deploy:** sin agendar. Pre-requisitos en Track A del [ROADMAP de formalizacion](../formalization/ROADMAP.md). Runbook tecnico ya redactado en [docs/deployment/DEPLOY-INSTRUCTIONS-2026-05-17.md](../../deployment/DEPLOY-INSTRUCTIONS-2026-05-17.md) (la fecha del nombre quedo congelada — el plan sigue siendo valido para cualquier sabado futuro).

---

## Resumen Ejecutivo

v3.0.0 es un release estructural que elimina deuda tecnica de duplicacion (tablas globales) y normaliza datos libres (vendors). Originalmente eran 3 iniciativas estructurales; el sprint Q2 sumo hardening contable encima, y entre 17-may y 24-may se acumularon 3 iniciativas adicionales en `main` post-merge + 3 mas todavia en working tree + un set grande de adiciones untracked que arrancaron como exploracion y ya son codigo/doc utilizable (Alegra DIAN, bank reconciliation, storefront v3-preview, formalizacion 8-dim, audit prod).

Total acumulado del scope efectivo de v3.0.0:
- **14 migraciones de DB** del scope original + cadena previa de costos (`d3e4f5g6h7i8`, `f5g6h7i8j9k0`) + cadena de hardening Q2 (`perm_audit_001`, `ar_due_date_001`, `exp_cat_fk_001`, `v3_design_cleanup_001`).
- **~250 archivos** del scope original + el delta del working tree (~3 modificados al 2026-05-24 02:55 + ~70 untracked).
- **11 iniciativas** numeradas:
  - 1-3: scope original (unificacion productos, normalizacion vendors, catalogo posiciones).
  - 4-5: Sprint Q2 (hardening contable, pnpm 11).
  - 6: permisos `inventory.view_cost` (working tree).
  - 7: reports money accuracy (commit `1ab192b`, sin push).
  - 8: aislamiento de tests con TRUNCATE+RESEED (working tree).
  - 9: sistema de costos por desglose (mergeado desde abril, nunca documentado aqui).
  - 10: FE DIAN via Alegra (scaffold offline + activacion externa lista).
  - **11: consolidacion encargos obsoletos (🔴 BLOQUEANTE — sin esto no hay deploy v3).**
- **Bloqueantes operativos** descubiertos via audit que NO se resuelven con codigo (data drift en prod: slugs, colores, catalogo CARACAS).

---

## Iniciativa 1: Unificacion de Tablas de Productos ✅ Mergeado, no deployed

### Problema
Existian 4 tablas paralelas para productos globales (`global_garment_types`, `global_garment_type_images`, `global_products`, `global_inventory`) duplicando la logica de las tablas por colegio. Esto causaba:
- Doble code path en cada servicio (school product vs global product)
- Campos redundantes: `global_product_id`, `is_global_product` en SaleItem, OrderItem, SaleChange, OrderChange, InventoryLog
- Queries mas complejos con UNION o logica condicional

### Solucion
Productos globales ahora viven en las mismas tablas (`garment_types`, `products`, `inventory`) con `school_id = NULL`. Partial indexes de PostgreSQL garantizan unicidad separada para filas globales y por colegio.

### Cadena de Migraciones (5 pasos, orden estricto)

| Paso | Migracion | Accion | Estado dev |
|------|-----------|--------|------------|
| 1 | `unify_step1_nullable_school_id` | `school_id` nullable + partial indexes en garment_types, products | ✅ |
| 2 | `unify_step2_copy_global_data` | Copia filas de `global_*` a tablas unificadas con `school_id=NULL` | ✅ |
| 3 | `unify_step3_remap_fks` | Remap FKs en order_items, sale_items, sale_changes, order_changes, inventory_log | ✅ |
| 4 | `unify_step4_drop_global_columns` | Drop columnas `global_*_id` / `is_global_product` de tablas dependientes | ✅ |
| 5 | `unify_step5_drop_global_tables` | Drop las 4 tablas globales | ✅ |

**Counts visibles tras `v3codes001` remap final (sobre data prod fresca):**
- sale_items remapped: **609**
- order_items product_id: **38** / garment_type_id: **38**
- sale_changes: **8** / order_changes: **2**
- cost_component_templates: **12** / product_cost_components: **0**
- inventory_logs: **483**

### Impacto en Codigo

**Backend — Eliminados:**
- `services/global_product.py` — eliminado completamente
- Modelos: `GlobalGarmentType`, `GlobalGarmentTypeImage`, `GlobalProduct`, `GlobalInventory`
- Imports y re-exports en `models/__init__.py`

**Backend — Modificados:**
- `services/product.py` — GarmentTypeService absorbe metodos globales (+518 lineas netas)
- `services/inventory.py` — queries nullable-school-aware (`IS NULL` para globales)
- `services/order/creation.py`, `changes.py`, `cancellation.py`, `reporting.py` — path unico sin bifurcacion global/school
- `services/sale/creation.py`, `changes.py`, `cancellation.py`, `queries.py` — idem
- `services/cost_component.py`, `services/patrimony.py`, `services/financial_statements.py` — queries unificados
- `services/inventory_log.py` — sin `global_inventory_id`

**Schemas modificados:**
- `schemas/sale.py` — `product_id` ahora NOT NULL, eliminados campos `global_*`/`is_global_product`, nuevo `is_global: bool` computado
- `schemas/order.py` — misma simplificacion

**Frontend:**
- `ProductModal.tsx` — refactor grande (471 lineas), modal unificado
- `GlobalProductModal.tsx` — simplificado
- `GarmentTypeModal.tsx` — maneja global y por-colegio en un solo modal
- Todas las paginas de Orders, Sales, Products — eliminan code paths de global products

### Riesgo Critico
`SaleItem.product_id` cambia de nullable a NOT NULL. La migracion de datos debe garantizar que no existan product_ids nulos antes del step 4.

> **Validado en dev:** el remap a `v3codes001` resolvio los 609 sale_items + 38 order_items sin dejar NULLs. Para el deploy a prod, repetir el query de verificacion sobre `uniformes_db` produccion antes de correr `unify_step4`.

---

## Iniciativa 2: Normalizacion de Vendors ✅ Mergeado, no deployed

### Problema
`Expense.vendor`, `FixedExpense.vendor`, y `AccountsPayable.vendor` eran campos `str` de texto libre. Esto causaba:
- Duplicados por typos ("Textiles ABC" vs "textiles abc" vs "TEXTILES ABC")
- Imposibilidad de reportar gastos por proveedor de forma confiable
- Sin historial unificado de relacion con proveedores

### Solucion
Nueva tabla `vendors` con `normalized_name` (unique, indexed). Todos los campos `vendor: str` migran a `vendor_id: UUID` FK.

### Cadena de Migraciones (3 pasos)

| Paso | Migracion | Accion | Estado dev |
|------|-----------|--------|------------|
| A | `vendor_norm_a_create_table` | Crea `vendors` + agrega `vendor_id` nullable FK en expenses, accounts_payable, fixed_expenses + permission `accounting.manage_vendors` | ✅ |
| B | `vendor_norm_b_populate` | Pobla `vendors` desde strings existentes en las 3 tablas | ✅ 97 vendors creados desde strings legacy |
| C | `vendor_norm_c_drop_columns` | Drop columnas `vendor: str` de las 3 tablas | ✅ |

### Nuevo Modulo Completo

**Backend:**
- `models/vendor.py` — Modelo Vendor (name, normalized_name, type enum, phone, email, is_system, is_active)
- `schemas/vendor.py` — VendorCreate, VendorUpdate, VendorResponse, VendorMergeRequest
- `services/accounting/vendors.py` — CRUD + fuzzy search + merge (reasigna FKs en bulk) + usage stats
- `api/routes/vendors.py` — REST API completa en `/vendors`

**Frontend:**
- `components/accounting/VendorCombobox.tsx` — autocomplete con cache de 5 min, busqueda debounced, creacion inline
- `services/vendorService.ts` — API client
- `hooks/useVendors.ts` — cache module-level con refresh

**Impacto transversal:**
- ~25 componentes de contabilidad migrados de `vendor: string` a `vendor_id + VendorCombobox`
- `payroll_service.py` — usa `VendorService.get_or_create` para vendor interno "Empleados - Nomina Consolidada"

### Riesgo Critico
`AccountsPayable.vendor_id` es NOT NULL tras la migracion. Todos los registros existentes deben tener vendor asignado antes del step C.

> **Validado en dev:** `vendor_norm_b` poblo 97 vendors sin huerfanos. Repetir validacion sobre data de prod del dia del deploy.

---

## Iniciativa 3: Catalogo de Posiciones ✅ Mergeado, no deployed

### Alcance
Nuevo modulo menor para estandarizar cargos/posiciones de empleados.

**Backend:**
- `models/payroll.py` — nuevo modelo `Position` (code, name, description, sort_order)
- `services/position.py` — CRUD
- `api/routes/catalog.py` — REST en `/global/catalog/positions`
- Permisos: `catalog.view` (VIEWER+), `catalog.manage` (ADMIN+) — **seedados en `perm_audit_001`** (ver Sprint Q2)

**Frontend:**
- `pages/settings/ManagePositionsModal.tsx`
- `services/catalogService.ts`

---

## Iniciativa 4 (agregada por Sprint Q2): Hardening contable ✅ Mergeado, no deployed

Mergeada al scope de v3.0.0 via `9cb0913`. Cinco bugs criticos de logica contable + Gap A + permisos.

| Item | Commit | Detalle |
|------|--------|---------|
| Bug 1 — `set_balance` compensating entry | `443f4b7` | Toda mutacion de `account.balance` ahora emite BalanceEntry. 13 puntos de mutacion auditados. |
| Bug 2 — `mark_debt_as_paid` atomico | `4840784` | Crea 3 entries (AR reduction, cash out, interest expense) atomicamente. Opcional split capital/interest. |
| Bug 3 — Archive guard balance accounts | `153379f` | Bloquea archivar cuentas con saldo != 0 (politica estricta, sin bypass). |
| Bug 4 — AR `due_date` NOT NULL | `01d607b` | Migracion `ar_due_date_001` backfilea 163 AR + NOT NULL + helper `default_ar_due_date`. |
| Bug 5 — FK `expenses.category` | `550e6a3` | Migracion `exp_cat_fk_001` agrega FK a `expense_categories.code` con ON UPDATE CASCADE / ON DELETE RESTRICT. |
| Gap A — Equity opening balance | `4e549bb` (+ analisis previo) | Reconstruido desde legacy data, assertions alineadas, financial statements consistentes. |
| Permission audit | `b69b187` + `perm_audit_001` | 5 permission codes faltantes seedados (`catalog.view`, `catalog.manage`, `costs.manage_templates`, `employees.manage`, `payroll.manage`). |
| Stale tests realineados | `4e549bb` | `test_financial_statements_service.py` arreglado tras Gap A. |

Migraciones agregadas a la cadena: `perm_audit_001` → `ar_due_date_001` → `exp_cat_fk_001` (head queda en `v3_design_cleanup_001`, declarado committed head via `c537b09`).

### Commits adicionales 17-may → 24-may (encima del merge `9cb0913`, aun NO en `origin/main`)

| Commit | Subject | Detalle |
|--------|---------|---------|
| `c537b09` | `chore(db): add v3 design cleanup migration as committed head` | Fija `v3_design_cleanup_001` como head registrado en la rama. |
| `1dd2ca6` | `docs(deployment): add pnpm first-deploy runbook` | [`docs/deployment/pnpm-deploy-runbook.md`](../../deployment/pnpm-deploy-runbook.md). Pre-requisito de cualquier deploy v3. |
| `fec055f` | `build: route tauri and release scripts through pnpm` | Cierra la migracion pnpm tocando los scripts Rust/Tauri (faltaba esta pieza). |
| `70807f8` | `ci: migrate workflows from npm to pnpm 11` | GitHub Actions usa pnpm 11. |
| `e9cd204` | `fix(alterations): use max+1 for code generation and add client name/phone to search` | Bug de generacion de codigo + UX search en arreglos. |
| `d907c3f` | `feat(financial-model): add multi-phase payroll scenarios with end_month_offset` | Escenarios de payroll multi-fase con offset de fin (cierre por etapas del equipo). |
| `255f931` | `docs(formalization): add equipo roadmap + 5 bitacoras` | Roadmap del equipo + 5 bitacoras (Owner/Cofounder/Joven). |
| `d0a897c` | `feat(payroll): seed equipo core with user account links` | Seed idempotente que vincula payroll → user accounts del equipo core. |
| `8387b89` | `fix(auth): normalize email to lowercase and add Google OAuth prod runbook` | Login normaliza email + [`docs/deployment/google-oauth-prod-runbook.md`](../../deployment/google-oauth-prod-runbook.md). OAuth queda listo para activarse cuando se decida. |
| `1ab192b` | `fix(reports): use unit_cost snapshot, split-payment breakdown, include Nequi` | Iniciativa 7 — 3 bugs reales de plata en reports (ver §Iniciativa 7). |
| `45c3a8e` | `docs(formalization): move equipo to subfolder + integrate real Platzi paths for Felipe and Salome` | Reorganiza `equipo/` y suma rutas Platzi reales en bitacoras. |

> **Accion pendiente:** `git push origin main` para subir estos 11 commits. Solo despues los pre-requisitos de deploy son auditables contra `origin/main`.

---

## Iniciativa 5 (agregada por Sprint Q2): pnpm 11 migration ✅ Mergeado, no deployed

| Sub-repo | Commit |
|----------|--------|
| admin-portal | `8850474` |
| web-portal | `e42ea52` |
| frontend (Tauri) | `9a54f69` |
| mobile (Expo) | `d6a82b1` |
| CI workflows | `70807f8` |
| Tauri/release scripts | `fec055f` |
| Deploy runbook | `1dd2ca6` |

Supply-chain hardening incluido (lockfile verification, audit pre-install). 1237/1237 tests OK.

**Implicacion para deploy v3:** el VPS de prod necesita Node 22 + pnpm 11 instalados antes del deploy. Sin esto el workflow `cd.yml` revienta apenas ejecuta `pnpm install`. Esta dependencia se gestiona como **GATE 1** en los Prerequisitos abajo (no aqui, para evitar duplicacion). Runbook autoritativo: [`docs/deployment/pnpm-deploy-runbook.md`](../../deployment/pnpm-deploy-runbook.md).

---

## Iniciativa 6: Permisos de visibilidad de costos ⏳ En working tree

Cambio backend + frontend para que `Product.cost` (y los breakdowns) solo se entreguen al usuario que tiene `inventory.view_cost` — global o por colegio. Hoy todos los roles ven el costo, lo que filtra margen al equipo de tienda y al portal admin.

**Backend modificado (sin commit):**
- [`backend/app/api/routes/products.py`](../../../backend/app/api/routes/products.py) — `list_all_products` y `list_products_for_school` consultan `PermissionService.has_permission(..., "inventory.view_cost")` (global y por colegio respectivamente) y blanquean `cost` cuando no procede.
- [`backend/app/api/routes/global_products.py`](../../../backend/app/api/routes/global_products.py) — `list_global_products` mismo patron (global). Ademas `get_global_products_stats` ahora acepta `scope=global|school|all` con `UserSchoolIds` para alternar el agregado.
- [`backend/app/api/routes/global_reports.py`](../../../backend/app/api/routes/global_reports.py) — afectado por la Iniciativa 7 (ver abajo), pero comparte la dependencia `UserSchoolIds`.
- [`backend/app/schemas/product.py`](../../../backend/app/schemas/product.py) — `ProductListResponse` agrega `cost: Decimal | None = None` y `cost_type: str | None = None` (para que la UI distinga `manufactured` vs `purchased`).

**Frontend modificado (sin commit):**
- [`frontend/src/components/accounting/ProductCostManager.tsx`](../../../frontend/src/components/accounting/ProductCostManager.tsx) (refactor +/- 362 lineas) — hub de costos. Manufacturados editan via "Ver desglose" (modal); comprados (zapatos/medias/jeans) mantienen entrada manual.
- [`frontend/src/components/accounting/CostBreakdownModal.tsx`](../../../frontend/src/components/accounting/CostBreakdownModal.tsx) — **nuevo componente** (untracked), barrel export en [`accounting/index.ts`](../../../frontend/src/components/accounting/index.ts).
- [`frontend/src/components/accounting/CostBreakdownEditor.tsx`](../../../frontend/src/components/accounting/CostBreakdownEditor.tsx) — fix N+1: cargar breakdowns en paralelo con `Promise.all` (era loop secuencial por producto).
- [`frontend/src/pages/products/*`](../../../frontend/src/pages/products/) — `useProductsData.ts`, `ProductsTable.tsx`, `ProductsTabs.tsx`, etc., ajustan render para el campo `cost` opcional.
- [`frontend/src/services/productService.ts`](../../../frontend/src/services/productService.ts), [`types/api.ts`](../../../frontend/src/types/api.ts) — typing actualizado.

**Riesgo de merge:** ya hay tests modificados ([`backend/tests/api/test_products_routes.py`](../../../backend/tests/api/test_products_routes.py), [`test_stats_endpoints.py`](../../../backend/tests/api/test_stats_endpoints.py)) que asumen el nuevo contrato. No commitear el codigo sin commitear los tests al mismo tiempo.

---

## Iniciativa 7: Reports — money accuracy (split payments + Nequi omitido) ✅ Commiteado (`1ab192b`), no deployed

Tres bugs reales de plata en reports, **ya commiteados** en `1ab192b` (2026-05-24 02:47). Documentados a fondo en la docstring del commit y en el test de regresion. Pendiente: pushear a `origin/main`.

| Bug | Endpoint | Sintoma |
|-----|----------|---------|
| R1 | `/global/reports/profitability/by-school` | COGS calculado con `Product.cost` actual e ignora `SaleItem.unit_cost` (snapshot al momento de la venta). Margenes historicos se movian retroactivamente al actualizar costos. **Fix:** misma cadena de fallback de `FinancialStatementsService._calculate_cogs` (`SaleItem.unit_cost` → `Product.cost` → `unit_price * 0.80`). |
| R2 | `/global/reports/sales/summary` | Agrega por `Sale.payment_method`. Una venta cash 50k + transfer 30k se reporta 80k bajo un solo metodo (POS desktop ya soporta split via `SalePayment`, pero reports lo ignoraba). **Fix:** `_payment_breakdown_subquery()` con UNION ALL entre `SalePayment` rows reales y `Sale.payment_method + Sale.total` via `~exists()` para legacy. `sum(by_method) == total_revenue` ahora cuadra incluso con split. |
| R3 | `/schools/{school_id}/reports/sales/daily` | Enumera cash/transfer/card/credit explicitamente y **omitia Nequi**. Un dia con Nequi mostraba `total_revenue != sum(subtotales)`. **Fix:** reescrito en SQL aggregations con la misma subquery + dict `sales_by_payment` extensible. Status filter aplicado en SQL (antes cargaba todo a memoria). |

**Archivos del commit:**
- [`backend/app/api/routes/global_reports.py`](../../../backend/app/api/routes/global_reports.py) +209 lineas — `_payment_breakdown_subquery()`.
- [`backend/app/services/reports.py`](../../../backend/app/services/reports.py) +137 lineas — reescritura de `get_daily_sales`.
- [`backend/tests/api/test_reports_money_accuracy.py`](../../../backend/tests/api/test_reports_money_accuracy.py) +298 lineas — 3 tests HTTP con fixtures reales. Los 3 fallan en codigo anterior.

> **Update 2026-05-24:** ampliada y extendida por la **Iniciativa Reports Coverage Expansion** (ver abajo). Los bugs R1/R2/R3 quedan cerrados; la cobertura del modulo de Reports se eleva a iniciativa arquitectonica de primera clase con cobertura paritaria de los 3 streams de revenue (Sales/Orders/Alterations) y hooks listos para B2B y v3.1 sucursales.

---

## Iniciativa 7B: Reports Coverage Expansion ✅ Commiteado (`06cb7d7` → `d1371f8`), no deployed

Cobertura completa del modulo `/reports` para los 3 streams operativos (Sales, Orders, Alterations) + servicio unificado `RevenueStreamService` + tab "Resumen" 360 ejecutivo + preparacion B2B (Fase 4) y branches v3.1 (Fase 5). **Plan completo:** [`docs/v3/v3-branch-architecture/reports-coverage.md`](./reports-coverage.md).

| Fase | Deliverable | Commit | LOC |
|------|-------------|--------|-----|
| 1.1 | Migracion `orders.delivered_at` + `alterations.ready_at` + hooks `update_status` | `06cb7d7` | +96 |
| 1.2 | Helper compartido `_cogs_resolver.py` + refactor 3 servicios | `e7306d2` | +119 |
| 1.3-1.5 | Backend Encargos: `schemas/reports.py` (nuevo) + `OrderAnalyticsMixin` + 7 endpoints + permisos (`reports.orders`, `reports.alterations`, `reports.cost_visibility`) | `4ac742d` | +1133 |
| 1.6 | Tests `test_reports_orders_accuracy.py` + fix PostgreSQL date arithmetic | `28452e2` | +475 |
| Hotfix | **Excluir ventas historicas (`Sale.is_historical=True`) en 27 query sites** — dashboard, reportes, P&L, profitability. Bug encontrado en validacion post-deploy: el dashboard sumaba ventas migradas pre-sistema. | `adcb943` | 5 files, 27 sites |
| 1 FE | `OrdersReport.tsx` + tab Encargos + 9 metodos en `reportsService.ts` | `e685c8e` | +795 |
| 2 BE | `AlterationsSummary` con filtros de fecha (cierra Bug 9) + nuevos endpoints `/alterations/response-time` y `/alterations/top-types` + schemas | `a5acea5` | +465 |
| 2 FE | `AlterationsReport.tsx` mejorado con widgets de tiempo de respuesta + top tipos + `alterationService.getSummary(filters)` | `b7f6765` | +285 |
| 3 BE | **`RevenueStreamService`** (Strategy pattern) + 3 endpoints `/revenue/streams-*` + tests con invariante `sum(streams) == totals` | `739ca0e` | +1367 |
| 3 FE | `OverviewReport.tsx` (tab Resumen 360) + default tab + persistencia localStorage | `d1371f8` | +600 |
| 4 | **B2B stub** — `B2BContractsStreamCalculator` registrado en `RevenueStreamService.__init__` retorna `{revenue: 0, note: 'not_yet_implemented'}`. Test pasante. Incluido en commit `739ca0e`. | (en 3 BE) | — |
| 5 | **Branch param prep** — `branch_id: UUID \| None = None` wired no-op en cada endpoint y calculator. Un dia se activa con una linea por calculator. Incluido en commits 1 y 3. | (en 1 + 3) | — |

**Bugs cerrados:**
- ✅ R1/R2/R3 (los 3 bugs de Iniciativa 7 — split payments, Nequi, unit_cost)
- ✅ Bug 9 (Alterations summary sin filtro de fecha)
- ✅ Bug 12 (3 implementaciones paralelas de revenue por colegio)
- ✅ Hotfix historico (ventas migradas sumando en agregados)

**Total:** ~5400 LOC en 11 commits. Tests verde (~85 tests pasan, modulo flake conocido del fixture `_reset_database`).

---

## Iniciativa 8: Aislamiento real de tests (post Bug 5 FK) ⏳ En working tree

Bug 5 (FK `expenses.category → expense_categories.code`) destapo que `conftest.py` no aislaba tests: rutas invocadas via `api_client` commitean en sus propias sesiones, asi que rollback del `db_session` del test no las deshace. El siguiente test corre contra basura del anterior.

**Cambio en [`backend/tests/conftest.py`](../../../backend/tests/conftest.py):**
- `EXPENSE_CATEGORY_SEED` — tupla canonica de 20 categorias (`rent`, `payroll`, `prod_fabric`, `payroll_in_kind`, `owner_drawings`, `intereses_financieros`, `discounts`, etc.) que espeja lo que las migraciones siembran en prod. Sin ella, cualquier insert de `Expense` revienta el FK del Bug 5.
- `_reset_database(engine)` — corre `TRUNCATE ... CASCADE` + `RESTART IDENTITY` sobre todas las tablas y vuelve a sembrar el catalogo. Se ejecuta despues de cada test que usa `db_session`. Usa conexion `NullPool` separada para evitar interferencia con estado `idle in transaction`.

**Tests nuevos (untracked) que dependen de este aislamiento:**
- [`backend/tests/integration/test_stabilization_constraints.py`](../../../backend/tests/integration/test_stabilization_constraints.py) — Bug 4 (AR sin `due_date` → `IntegrityError`) y Bug 5 (categoria fuera del catalogo → `IntegrityError`) verificados a nivel Postgres. 4 tests.
- [`backend/tests/api/test_reports_money_accuracy.py`](../../../backend/tests/api/test_reports_money_accuracy.py) — ya commiteado con `1ab192b`.
- [`backend/tests/unit/test_financial_statements_service.py`](../../../backend/tests/unit/test_financial_statements_service.py) — modificado para alinearse con Gap A + el reset.

---

## Iniciativa 9: Sistema de Costos por Desglose (cost breakdown) ✅ Mergeado, no deployed

> Este modulo lleva en `main` desde abril pero **nunca fue documentado en este scope**. Es uno de los pilares contables de v3.0.0: habilita COGS reales (no estimados), margenes por producto, y permite que el modelo financiero (Iniciativa de v3.2) tenga datos confiables sobre los que proyectar.

### Problema que resolvio

`Product.cost` era un escalar que se podia editar a mano. Tres consecuencias:

1. **Sin trazabilidad de como se construye:** un costo de $18.000 no decia si era "tela $8k + confeccion $6k + bordado $4k" o un guess. No habia auditoria de cambios.
2. **Margenes historicos se movian retroactivamente:** actualizar `Product.cost` cambiaba los margenes de ventas pasadas (reportes hacian `quantity * cost_actual`). Iniciativa 7 fix lo cierra finalmente.
3. **COGS estimados:** sin cost capturado, los estados financieros usaban `unit_price * 0.80` como proxy — error tipico del 5-15% sobre margen.

### Solucion

Dos tablas nuevas + un campo discriminador en `GarmentType` + snapshot de costo en `SaleItem`/`OrderItem`.

**Modelos** ([`backend/app/models/product.py`](../../../backend/app/models/product.py)):
- `GarmentType.cost_type: str` (default `manufactured`) — discriminador `manufactured` vs `purchased`.
  - `manufactured`: costo viene de la suma de sus componentes (fuente de verdad). UI muestra "Ver desglose".
  - `purchased`: costo entra a mano (zapatos, medias, jeans, blusas — no se producen en taller). UI muestra input directo.
- `CostComponentTemplate` (tabla `cost_component_templates`): plantilla por `GarmentType` con `name`, `code`, `is_variable` (true = monto puede variar por talla/lote), `display_order`. Cascade delete con el `GarmentType`.
- `ProductCostComponent` (tabla `product_cost_components`): el valor concreto que un `Product` tiene asignado a un `CostComponentTemplate`. `amount` + `notes`. Cascade delete con el `Product`.

**Snapshot de costo al momento de la venta** ([`backend/app/models/sale.py`](../../../backend/app/models/sale.py)):
- `SaleItem.unit_cost: Decimal | None` — snapshot de `Product.cost` al cerrar la venta. Lo siembra `SaleService.create_sale` linea 102.
- `OrderItem.unit_cost: Decimal | None` — idem para encargos.

### Cadena de migraciones (orden estricto)

| Paso | Migracion | Accion |
|------|-----------|--------|
| 1 | `d3e4f5g6h7i8_add_unit_cost_to_sale_and_order_items.py` (abr 2026) | Agrega `unit_cost` nullable a `sale_items` y `order_items`. |
| 2 | `f5g6h7i8j9k0_add_cost_breakdown_system.py` (abr 2026) | Agrega `cost_type` a `garment_types` (y al difunto `global_garment_types`), crea `cost_component_templates` + `product_cost_components`, y siembra templates por defecto. |

**Templates default sembrados (por tipo de prenda):**
- Con bordado: Tela (variable), Confeccion, Bordado, Cuellos/Puños, Marquillas, Bolsas, Hilos (variable), Otros.
- Sin bordado: Tela (variable), Confeccion, Marquillas, Bolsas, Hilos (variable), Otros.
- Globales marcados `purchased`: Zapatos Goma, Tennis Nike Blanco/Negro, Medias, Medias Tobilleras, Jean, Blusa, Boxer, Camisillas, Correa, Top, Bicicleteros.

### Logica del servicio ([`backend/app/services/cost_component.py`](../../../backend/app/services/cost_component.py), 279 lineas)

- `get_breakdown(product_id)`: retorna componentes + `total_cost` + `margin_percent` + flag `has_estimates` (true si algun componente tiene `is_variable=true`).
- `upsert_breakdown(product_id, components)`: upsert por `(product_id, template_id)`, despues llama `_recalculate_product_cost()`.
- `bulk_apply_component(garment_type_id, code, amount, size_deltas)`: actualiza un componente (ej. "Tela") para **todos** los productos de un `GarmentType` activo, con `size_deltas` opcional para variar por talla (`{"sizes": ["XL", "XXL"], "delta": 500}`).
- `_recalculate_product_cost(product_id)`: `Product.cost = sum(ProductCostComponent.amount)`. Single source of truth.

### COGS pipeline ([`backend/app/services/financial_statements.py:_calculate_cogs`](../../../backend/app/services/financial_statements.py))

Fallback chain documentada en docstring de `_calculate_cogs`:

```
1. SaleItem.unit_cost  ← snapshot al momento de la venta (lo bueno)
2. Product.cost         ← costo actual del producto (segundo mejor)
3. unit_price * 0.80    ← estimacion (margen 20% asumido)
```

Reporta:
- `total`, `from_actual_cost`, `from_estimated_cost`
- `items_with_actual_cost`, `items_with_estimated_cost`
- `cogs_coverage_percent` = items con cost real / total items
- Disclaimer en P&L si `cogs_coverage_percent < 100%`

### API ([`backend/app/api/routes/cost_components.py`](../../../backend/app/api/routes/cost_components.py), 322 lineas)

Permisos por accion:
- `GET .../cost-templates` → `inventory.view_cost`
- `POST/PUT/DELETE .../cost-templates` → `costs.manage_templates`
- `GET .../products/{id}/cost-breakdown` → `inventory.view_cost`
- `PUT .../products/{id}/cost-breakdown` → `costs.manage_templates`
- `POST .../garment-types/{id}/bulk-apply-component` → `costs.manage_templates`

> Recordatorio: `costs.manage_templates` se seedo via `perm_audit_001` en el Sprint Q2 (era uno de los 5 codes faltantes).

### Frontend

- [`frontend/src/components/accounting/CostBreakdownEditor.tsx`](../../../frontend/src/components/accounting/CostBreakdownEditor.tsx) — grid por talla x componente. Fix N+1 en working tree (Promise.all paralelo).
- [`frontend/src/components/accounting/CostBreakdownModal.tsx`](../../../frontend/src/components/accounting/CostBreakdownModal.tsx) — modal por producto. **Untracked**, ver Iniciativa 6.
- [`frontend/src/components/accounting/ProductCostManager.tsx`](../../../frontend/src/components/accounting/ProductCostManager.tsx) — hub de costos: manufactured edita via modal, purchased input directo. Refactor en working tree.

### Deuda tecnica viva (a cerrar antes o despues del deploy v3)

| # | Pendiente | Doc / prompt |
|---|-----------|--------------|
| C1 | **608 productos sin `Product.cost`** poblado (la mayoria escolares de colegios donde Consuelo nunca capturo el desglose). Sin esto, COGS coverage queda <100% para esos colegios. | [`prompts/costs-importer-prompt.md`](../formalization/prompts/costs-importer-prompt.md), plan revisado en [`estabilizacion_financiera/costs-importer-plan-revised.md`](../formalization/estabilizacion_financiera/costs-importer-plan-revised.md). Captura manuscritos del taller. |
| C2 | Recalcular `unit_cost` para sale_items / order_items historicos donde `unit_cost IS NULL` (snapshot retroactivo). | Sin doc todavia. Decision pendiente: ¿se llena con `Product.cost` actual o se deja NULL y el fallback chain de `_calculate_cogs` lo cubre? |
| C3 | Convencion de `is_variable=true` sin validar — UI no marca diferente los componentes variables ni los registra como rangos. | Posible mejora v3.1. |

---

## Iniciativa 10: Facturacion Electronica DIAN (Alegra) ⚠️ Scaffold offline, integracion incompleta

> **Status externo:** FE DIAN **activa en produccion via panel de Alegra desde 2026-05-16**. Resolucion DIAN `18764109873979` (FE 1-50000, vigencia 24m), CUFE valido en primera emision real via API curl (FE-2, $50.000 a Consumidor Final). Memoria: [`electronic_invoicing_active`](../../../../.claude/projects/-Users-angelsamuelsuescarios-Documents-03-Proyectos-Codigo-uniformes-system-v2/memory/electronic_invoicing_active.md), [`alegra_api_integration_notes`](../../../../.claude/projects/-Users-angelsamuelsuescarios-Documents-03-Proyectos-Codigo-uniformes-system-v2/memory/alegra_api_integration_notes.md).
>
> **Status en UCR backend:** servicio escrito, **no cableado**. Sin endpoint, sin UI, y con un gap real de configuracion que impide que corra hoy (ver "Bloqueantes tecnicos" abajo).

### Habilitacion externa (lo que ya esta hecho)

| Capa | Estado |
|------|--------|
| Cuenta DIAN como facturador electronico | ✅ Activa produccion |
| Cuenta Alegra (empresa "Uniformes Consuelo Rios") | ✅ Activa, plan pago |
| Asociacion Alegra ↔ DIAN (FE + Documento Soporte) | ✅ Activa para FE de venta y para DS de proveedores |
| Set de pruebas DIAN | ✅ Passed |
| Resolucion DIAN (numeracion FE 1-50000, 24 meses) | ✅ Autorizada |
| Emision manual via panel Alegra | ✅ FE-1 consumida por el wizard |
| Emision via API REST de Alegra (curl) | ✅ FE-2 emitida con CUFE valido el 2026-05-16 |

Identificador comercial: NIT `42779422-1` (Carmen Consuelo Rios Cartagena, persona natural, **no responsable de IVA**, seccional Medellin). Prefijo `FE`. Email DIAN del buzon de notificaciones: `contact@example.com`. Software ID `1289a9e0-0c46-455d-8eed-80ba9e2bfa51`.

> Implicacion practica: el restaurante ($9M en curso) **ya puede facturarse hoy** desde el panel de Alegra. La integracion en UCR es para que el equipo no salga del POS a hacerlo manualmente.

### Codigo en el repo (untracked al 2026-05-24)

**[`backend/app/services/alegra.py`](../../../backend/app/services/alegra.py)** (307 lineas) — cliente HTTPX completo:

- Auth HTTP Basic con `base64(email:token)`.
- `list_number_templates()` — lista resoluciones.
- `find_contact_by_identification` + `create_contact` + `resolve_contact(sale_client)` — find-or-create por identificacion. Fallback `Consumidor Final` con NIT generico `222222222222` para ventas sin client.
- `find_item_by_reference` + `create_item` + `resolve_item(product, unit_price)` — find-or-create por `product.code`. UNSPSC `53101502` por default (evita warning FAZ09 de DIAN).
- `emit_invoice(sale)` — POST `/invoices` con `stamp.generateStamp=true`. Mapeo `PaymentMethod` UCR → `(paymentForm, paymentMethod)` Alegra (`CASH/TRANSFER/DEBIT-CARD/CREDIT`).
- `get_invoice_files(invoice_id)` — GET `?fields=pdf,xml,attachedDocument` para recuperar URLs descargables.
- Maneja descuentos a nivel item (precio neto = `unit_price - discount/quantity`).
- Maneja la peculiaridad de que DIAN exige `date` = fecha actual (codigo 3051 si pasada) — preserva fecha real de la venta en `anotation`.

**[`backend/scripts/test_alegra_invoice.py`](../../../backend/scripts/test_alegra_invoice.py)** (241 lineas) — CLI:
- `--check-config` — valida settings cargados.
- `--list-templates` — lista resoluciones disponibles.
- `--list-sales [--limit N]` — lista N ventas recientes elegibles para emitir.
- `--sale-id <uuid>` — emite la FE para esa venta.

### Bloqueantes tecnicos (no se puede mergear como esta)

1. **Settings no declarados en `config.py`.** El servicio referencia `settings.ALEGRA_EMAIL`, `settings.ALEGRA_TOKEN`, `settings.ALEGRA_NUMBER_TEMPLATE_ID`, `settings.alegra_base_url`. El `.env` los tiene cargados pero [`backend/app/core/config.py`](../../../backend/app/core/config.py) **no los declara** y la clase Settings usa `extra = "ignore"`. Resultado: cualquier import del servicio falla con `AttributeError` apenas se invoca. **Hay que agregar al Settings:**
   ```python
   ALEGRA_ENABLED: bool = False
   ALEGRA_ENVIRONMENT: Literal["sandbox", "production"] = "sandbox"
   ALEGRA_EMAIL: str = ""
   ALEGRA_TOKEN: str = ""
   ALEGRA_NUMBER_TEMPLATE_ID: int | None = None
   ALEGRA_ISSUER_NIT: str = ""

   @property
   def alegra_base_url(self) -> str:
       return "https://api.alegra.com/api/v1"  # mismo host para sandbox y prod
   ```

2. **Token comprometido.** `ALEGRA_TOKEN=895f4364136e1b2e00c2` fue compartido en chat (ver memoria `electronic_invoicing_active`). Cualquiera con ese token factura/cancela en prod. **Rotar en panel Alegra antes de exponer cualquier endpoint.**

3. **No hay router montado.** No existe `backend/app/api/routes/electronic_invoicing.py` ni similar. Sin endpoint, el frontend no tiene boton. La integracion vive como utility CLI.

4. **No hay persistencia del enlace UCR ↔ Alegra.** Falta agregar a `Sale` (o tabla auxiliar `electronic_invoice`):
   - `alegra_invoice_id: int | None`
   - `alegra_invoice_number: str | None` (ej. `FE-2`)
   - `alegra_cufe: str | None`
   - `alegra_emitted_at: datetime | None`
   - `alegra_pdf_url: str | None` / `alegra_xml_url: str | None`
   - `alegra_status: enum` (NOT_EMITTED, EMITTED, REJECTED, CREDIT_NOTED)

5. **Nota credito automatica al cancelar venta:** sin implementar. Hoy una cancelacion de venta no llama Alegra → divergencia en libros DIAN.

6. **Documento Soporte automatico al registrar gasto:** sin implementar. Habilitado en la cuenta pero no integrado. Sirve para deducir compras a costureras informales.

7. **Idempotencia:** `emit_invoice` no chequea si la venta ya tiene `alegra_invoice_id` — re-emitiria. Necesario tras (4).

### Decisiones pendientes para el deploy v3

- ¿Iniciativa 10 entra a v3.0.0 o se aplaza a v3.0.1?
  - **Pro entra:** la habilitacion externa ya esta — exposer el endpoint cierra el loop y elimina trabajo manual del equipo.
  - **Contra entra:** requiere mover (1)–(4) antes de cualquier merge. Es minimo 1-2 sesiones dedicadas.
- ¿Activar en `production` o quedarse en `sandbox` el primer mes post-deploy para validar?
- ¿Quien manualmente emite la FE del restaurante mientras tanto? (panel Alegra, hasta integrar).

### Documentacion relacionada

- Memoria [`electronic_invoicing_active`](../../../../.claude/projects/-Users-angelsamuelsuescarios-Documents-03-Proyectos-Codigo-uniformes-system-v2/memory/electronic_invoicing_active.md) — milestone 2026-05-16, datos persistentes (resolucion, software ID, PIN), pendientes operativos.
- Memoria [`alegra_api_integration_notes`](../../../../.claude/projects/-Users-angelsamuelsuescarios-Documents-03-Proyectos-Codigo-uniformes-system-v2/memory/alegra_api_integration_notes.md) — gotchas del payload: `inventory.unit="unit"`, `paymentForm`+`paymentMethod` ambos requeridos, `stamp.generateStamp`, `?fields=pdf,xml` para descargas, status `STAMPED_AND_ACCEPTED_WITH_OBSERVATIONS` cuenta como exito.
- [`formalization/02-tributario.md`](../formalization/02-tributario.md) — dimension tributaria (Gap 2.1 FE cerrado por esta iniciativa).
- [`formalization/06-comercial.md`](../formalization/06-comercial.md) — pilar B2B, FE bloqueante para venta corporativa.

---

## Iniciativa 11: Consolidacion de Encargos Obsoletos 🔴 BLOQUEANTE para v3.0.0

> **Decision del owner (2026-05-24):** sin esta consolidacion **no hay deploy v3**. Es prerequisito duro, no diferible.

### Por que es bloqueante

UCR tiene **25 encargos con anomalias contables sin resolver** acumulados en prod. Total ~$2.558.000 en pagos huerfanos o entregas no registradas. Si se deploya v3 con esta data sucia:

1. **AR sobre-reportados:** pagos ya recibidos pero no registrados siguen apareciendo como deuda → CxC inflados → balance de apertura del primer mes post-deploy distorsionado.
2. **Inventario inconsistente:** encargos "entregados sin marcar" mantienen reservas que ya no son reales → stock disponible mal calculado en POS.
3. **El modelo financiero v3.2 hereda basura:** sin esto, las proyecciones y P&L del Iniciativa de modelo financiero leen sobre AR contaminadas.
4. **Bug 4 (Iniciativa 4) corrigio la estructura pero no la data:** AR `due_date` ahora NOT NULL + backfilled, pero los 25 casos siguen con monto y status reportando una realidad falsa.

### Inventario de los 25 casos

Fuente autoritativa: `documentos/Conciliaciones:Auditorias/TRACKEOS ENCARGOS.xlsx` (Hoja 1, R2-R26).

**Distribucion por patron (pre-clasificacion):**

| Tipo | Patron | Casos | Monto ~ | Decision tipica |
|------|--------|-------|---------|-----------------|
| A | Pago retroactivo simple (cliente confirmo pago + entrega, no se registro) | 5, 11, 14, 18 | ~$120K | `payment_transaction` backdated + AR pagada via override |
| B | Entrega no registrada con pago pendiente real | 6, 7, 8, 9 | ~$320K | Contactar cliente o castigar como incobrable post-N dias |
| C | Cambios de prenda mal cuadrados | 19, 20, 22 | ~$135K | Mirar descripcion, contrastar con sale relacionada |
| D | Multi-encargo del mismo cliente que se cuadran entre si | 17, 24, 25 | ~$185K | Analisis conjunto |
| E | Cliente no llevo la mercancia | 23 | $99K | Cancelar + devolver inventario |
| F | **Casos especiales conocidos** | 3, 13 | **$978K** | **Decision humana del owner — incluye JUCUM $848K + Cristina Giraldo $130K** |
| G | Centavos perdidos ($1K) | 12, 21 | $2K | Castigar como perdida operativa |
| H | No contesta + sin contexto | 8 | $58K | PENDIENTE hasta llamar o N dias |

**Casos mayores que requieren decision humana antes del deploy:**

- **Caso 13: ENC-2026-0118 — JUCUM (Caracas) — $848.000.** Fundacion, conocido por el owner. Sin doc/contrato. Decision: ¿reconocer como cuenta por cobrar B2B real con plan de pago, castigar como incobrable, o esperar respuesta de la contraparte?
- **Caso 3: ENC-2026-0128 — Cristina Giraldo (Caracas) — $130.000.** Posible relacion con el refinanciamiento Cristina $19M que esta pendiente como otro track. Decision: ¿es el mismo Cristina del prestamo o cliente independiente?

### Solucion definida (sin implementar)

**Restriccion dura:** prohibido cambiar `orders.status` ni `payment_status` en prod. Son encargos viejos (meses) — cambiarlos disparara notificaciones a clientes y reclamos.

**Diseño:** tabla shadow `order_audit_overrides` ligada a `orders.id`:

```sql
CREATE TABLE order_audit_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
    real_status VARCHAR(20) NOT NULL,
    real_payment_status VARCHAR(20) NOT NULL,
    real_paid_amount NUMERIC(10,2),
    audit_explanation TEXT NOT NULL,
    auditor_user_id UUID NOT NULL REFERENCES users(id),
    audited_at TIMESTAMP NOT NULL DEFAULT get_colombia_now_naive(),
    notify_client BOOLEAN NOT NULL DEFAULT FALSE,
    external_evidence TEXT  -- ruta a WhatsApp/foto/recibo fisico si aplica
);
```

Reportes contables (P&L, AR aging, dashboard de cobros) hacen `LEFT JOIN order_audit_overrides` y muestran `real_*` si existe, fallback a `orders.*` si no. El cliente y la vendedora siguen viendo `orders.*` publico — el override es invisible para ellos.

### Workflow en 2 sesiones (orden obligatorio)

**Sesion A — Auditoria forense interactiva** (esta es la pendiente).
- Prompt: [`docs/v3/formalization/prompts/encargos-audit-session-prompt.md`](../formalization/prompts/encargos-audit-session-prompt.md) — **356 lineas, restaurado 2026-05-24**.
- Owner + Claude discuten los 25 casos uno por uno contra `uniformes_prod_snapshot` (read-only).
- Stop gates obligatorios: pausa tras caso 1, tras caso 5, en cualquier monto > $200K, y siempre en casos Tipo F (JUCUM, Cristina).
- **Output:** `docs/v3/formalization/encargos-audit-2026-05-XX.md` con los 25 casos cerrados (decision + asientos contables derivados) + `docs/v3/formalization/encargos-audit-bugs.md` con bugs sistematicos descubiertos durante la auditoria.
- **Tiempo estimado:** 3-6 horas. Si pasa de 6h, sesion 2 para pendientes.
- **NO escribe codigo, NO toca DB, NO commitea durante la sesion.**

**Sesion B — Implementacion** (encadenada a la A).
1. Migracion alembic para `order_audit_overrides`.
2. Modelo + schema + servicio.
3. Endpoint admin para visualizar overrides (`/global/admin/order-overrides`).
4. Modificar reportes (P&L, AR aging, cash position) para `LEFT JOIN overrides`.
5. Script idempotente que aplica los asientos contables del acta de la Sesion A.
6. Audit que `orders.status` publico NO cambio en ninguna fila.
7. Tests de regresion + commit + decision: ¿corre en dev y se incluye en el deploy v3, o se corre como step post-deploy contra prod?

### Estado al 2026-05-24

| Pieza | Status |
|-------|--------|
| Prompt de sesion A | ✅ Restaurado (`docs/v3/formalization/prompts/encargos-audit-session-prompt.md`, 356 lineas) |
| `uniformes_prod_snapshot` read-only refrescable | ✅ Disponible (workflow [`refresh_prod_snapshot.sh`](../formalization/db-snapshot-workflow.md)) |
| xlsx fuente con los 25 casos | ✅ En `documentos/Conciliaciones:Auditorias/TRACKEOS ENCARGOS.xlsx` |
| **Sesion A ejecutada** | ❌ Nunca corrida. Owner pendiente de agendarla. |
| Acta de decisiones (los 25 casos cerrados) | ❌ No existe |
| Modelo `OrderAuditOverride` | ❌ No existe |
| Migracion alembic | ❌ No existe |
| Endpoint admin | ❌ No existe |
| Asientos contables aplicados | ❌ No |

### Por que NO se ataco antes

El sprint Q2 priorizo los 3 frentes M3 que mas leverage tenian dia 1: bugs contables 1-5 + Gap A (codigo, automatico), pnpm migration (paralelo, no requeria owner), formalizacion 8-dim (background). La sesion de encargos requiere **decisiones humanas caso por caso** (3-6 horas continuas con el owner) y se quedo sin slot. Se reconoce explicitamente como debt en [ROADMAP §"Lecciones del Sprint Q2"](../formalization/ROADMAP.md): *"Background agents ayudaron, pero no compensaron decisiones humanas requeridas."*

---

## Adiciones en working tree (untracked) — hijos de v3.0.0

Codigo y documentacion que vive en el repo pero no esta bajo `git add`. Algunas piezas son utilizables hoy (Alegra invoice generator, bank reconciliation CLI); otras son rediseño activo (v3-preview storefront). **Decision pendiente para cada una: commitear como parte de v3.0.0, diferir a v3.1, o dejar fuera de scope.**

### Backend

> El servicio Alegra (`backend/app/services/alegra.py`) y su CLI estan en working tree pero **viven como Iniciativa 10** porque son una pieza grande con decisiones propias. Aqui solo se listan adiciones menores.

| Archivo | Tipo | Notas |
|---------|------|-------|
| [`backend/scripts/bank_reconciliation/`](../../../backend/scripts/bank_reconciliation/) | Modulo (~15 archivos) | CLI completa: `loader.py`, `parsers/` (Bancolombia XLSX + Nequi PDF password-protected), `matchers/` (balance_entry, internal_transfer), `categorizer.py`, `migration_plan.py`, `report.py`, `apply_migration.py`. 1010 transacciones analizadas, 239 entries aplicadas en dev (idempotente). |
| [`backend/scripts/reset_dev_from_prod.sh`](../../../backend/scripts/reset_dev_from_prod.sh) | Script ops | Reemplaza `uniformes_db` con dump fresh de prod + `alembic upgrade head`. Referenciado por el [workflow oficial](../formalization/db-snapshot-workflow.md). Backup automatico previo. |
| [`backend/tests/integration/test_stabilization_constraints.py`](../../../backend/tests/integration/test_stabilization_constraints.py) | Tests (Iniciativa 8) | Ver arriba. |

### Web portal — storefront V3 (untracked, paralelo al deploy)

Rediseño completo del portal publico de clientes, expuesto en `/v3-preview/` hasta validar y promover a rutas reales. Aprovecha el design system entregado en `claudesing/` (extraido, no commiteado).

- [`web-portal/app/v3-preview/`](../../../web-portal/app/v3-preview/) — paginas Next.js (home, `[school_slug]`, `[school_slug]/[product_slug]`, `[school_slug]/cart`).
- [`web-portal/components/v3/`](../../../web-portal/components/v3/) — 10 componentes V3 (`HeaderV3`, `HeroV3`, `SchoolPickerV3`, `ProcessBandV3`, `CatalogClientV3`, `ProductCardV3`, `ProductDetailV3`, `CartPageV3`, `FooterV3`) + 5 primitivos (`Badge`, `Button`, `Card`, `Eyebrow`, `Input`).
- [`web-portal/lib/cn.ts`](../../../web-portal/lib/cn.ts) — utility nuevo.
- [`web-portal/public/v3/`](../../../web-portal/public/v3/) — assets (logo lockup, icon, Wompi).
- Diseño documentado en [`docs/v3/design/storefront-v3-handoff.md`](../design/storefront-v3-handoff.md) y [`docs/v3/design/business-facts.md`](../design/business-facts.md).

**Decision tomada (2026-05-04):** tipografia hibrida Fraunces (headlines) + Outfit (resto). Aprovechamiento parcial del bundle (estructuras y layouts si, copy inventado no). Datos reales desde DB, no mockup.

### Documentacion (untracked) — fase de estabilizacion

La carpeta `formalization/` se reestructuro entre 16-may y 24-may. Lo que antes vivia plano en la raiz se reorganizo en subcarpetas tematicas + se sumaron 4 dimensiones nuevas y un set de prompts para sesiones dedicadas.

**Movimientos (los archivos eliminados arriba en `git status` se mueven, no se borran):**

| Antes | Ahora |
|-------|-------|
| `formalization/bitacoras/{angel,consuelo,felipe,salome,santiago}.md` + README | `formalization/equipo/bitacoras/` |
| `formalization/equipo-roadmap-2026.md` | `formalization/equipo/equipo-roadmap-2026.md` |
| `formalization/financial-impact.md` | `formalization/estabilizacion_financiera/financial-impact.md` |
| `formalization/financial-model-current-state.md` | `formalization/estabilizacion_financiera/financial-model-current-state.md` |
| `formalization/migration-plan-hybrid.md` | `formalization/estabilizacion_contable/migration-plan-hybrid.md` |
| `formalization/patrimony-deep-analysis-2026.md` | `formalization/estabilizacion_contable/patrimony-deep-analysis-2026.md` |
| `formalization/projection-scenarios-results.md` | (eliminado — consolidado en `financial-impact.md`) |
| `v3-branch-architecture/financial-model-prompt.md` | `formalization/prompts/financial-model-prompt.md` |

**Documentos nuevos (untracked) en `formalization/`:**

| Archivo | Proposito |
|---------|-----------|
| [`05-datos-personales.md`](../formalization/05-datos-personales.md) | Dimension 5 — Habeas Data (Ley 1581). Criticidad ALTA, 5% formal. |
| [`06-comercial.md`](../formalization/06-comercial.md) | Dimension 6 — Relacion con clientes y contraparte contractual. Criticidad ALTA, 10% formal. |
| [`07-operacional.md`](../formalization/07-operacional.md) | Dimension 7 — Continuidad, procesos, riesgo operativo. Criticidad ALTA, 25% formal. |
| [`08-tecnologico.md`](../formalization/08-tecnologico.md) | Dimension 8 — Propiedad Intelectual del software. Criticidad ALTA (CRITICA si v3.2). |
| [`estabilizacion_contable/bank-reconciliation-2026-05-{16,17}.md`](../formalization/estabilizacion_contable/) | Reportes de reconciliacion multi-banco. |
| [`estabilizacion_contable/bank-track-summary-2026-05-17.md`](../formalization/estabilizacion_contable/bank-track-summary-2026-05-17.md) + `bank-transactions-detail-2026-05-17.csv` | Trazabilidad granular por movimiento. |
| [`estabilizacion_contable/bank-migration-plan-2026-05-17.md`](../formalization/estabilizacion_contable/bank-migration-plan-2026-05-17.md) | Plan de aplicacion (239 entries idempotentes). |
| [`estabilizacion_contable/bank-fixes-proposed-2026-05-{16,17}.md`](../formalization/estabilizacion_contable/) | Fixes contables propuestos a partir de la reconciliacion. |
| [`estabilizacion_contable/intangibles-management.md`](../formalization/estabilizacion_contable/intangibles-management.md) | Politica NIIF de activos intangibles (plataforma UCR, marca, BD clientes). Bloqueante para constitucion SAS. |
| [`estabilizacion_financiera/costs-importer-plan-revised.md`](../formalization/estabilizacion_financiera/costs-importer-plan-revised.md) | Plan de captura de costos para 608 productos sin `cost`. |
| [`estabilizacion_operacional/README.md`](../formalization/estabilizacion_operacional/) + `procedimientos-inventario-maestro.md` | Catalogo unico de procedimientos faltantes (SOPs, runbooks, governance). |
| [`equipo/equipo-roadmap-2026.md`](../formalization/equipo/equipo-roadmap-2026.md) + `bitacoras/*` | 3 tracks de formalizacion del equipo (Owner / Cofundador tech / Joven) + cap table indicativo SAS. |
| [`prompts/{costs-importer,encargos-audit,financial-model}-prompt.md`](../formalization/prompts/) | Prompts para sesiones dedicadas (parten de cero, self-contained). |

### V3 design + audit

- [`docs/v3/audit/PROD-AUDIT-2026-05-16.md`](../audit/PROD-AUDIT-2026-05-16.md) + 5 screenshots — auditoria full-page de prod vs dev. **3 bloqueantes** del cutover (ver §"Bloqueantes de prod"). 8 hallazgos cosmeticos resueltos por V3.
- [`docs/v3/design/storefront-v3-handoff.md`](../design/storefront-v3-handoff.md), [`docs/v3/design/business-facts.md`](../design/business-facts.md) — diseño del storefront V3 con decisiones de tipografia, datos reales contra DB, pendientes externos.
- `claudesing/` en raiz del repo — bundle del design system extraido. **No commiteado, decision pendiente** si se versiona o se mantiene fuera.

### QA briefs (untracked)

- [`docs/qa-briefs/qa-full-post-v3-2026-05-04.md`](../../qa-briefs/qa-full-post-v3-2026-05-04.md) — auditoria post-M2. CONDITIONAL GO. Backend v3 estable, UI superuser limpia, los 5 bugs originales aun presentes (corregidos despues por la cadena Bug 2-5 + Gap A).
- [`docs/qa-briefs/brief-2026-05-04-post-v3.md`](../../qa-briefs/brief-2026-05-04-post-v3.md), [`brief-2026-05-04-stabilization.md`](../../qa-briefs/brief-2026-05-04-stabilization.md), [`qa-report-2026-05-04-stabilization.md`](../../qa-briefs/qa-report-2026-05-04-stabilization.md) — set de briefs del 4 de mayo.
- [`docs/qa-briefs/brief-financial-model-2026-05-04.md`](../../qa-briefs/brief-financial-model-2026-05-04.md) + [`qa-financial-model-2026-05-04-post-fix.md`](../../qa-briefs/qa-financial-model-2026-05-04-post-fix.md) — QA del modelo financiero antes y despues del hardening. Score paso de 6.5 → 9.0 (commit `2c4a2ea`).
- [`docs/qa-briefs/catalog-stabilization-2026-05-24.md`](../../qa-briefs/catalog-stabilization-2026-05-24.md) + 5 PNG capturas — sesion de hoy. Estrategia: **TODOS los fixes del catalogo se hacen contra `uniformes_db` y se shippean junto con v3 deploy**. Cero cambios directos sobre prod v2.9.0. Renames canonicos definidos (`Yomber` → `Jumper`, `Interios` → `Interiores`, `Camisa basica` → `Camiseta blanca piel de durazno`, etc.) + convencion de capitalizacion (Primera letra mayuscula, resto minusculas).

### Deployment runbooks (untracked)

- [`docs/deployment/DEPLOY-INSTRUCTIONS-2026-05-17.md`](../../deployment/DEPLOY-INSTRUCTIONS-2026-05-17.md) — instrucciones paso a paso del deploy (15 minutos estimados). Plan tecnico sigue valido aunque la fecha del nombre quedo congelada.
- [`docs/deployment/PRE-DEPLOY-CHECKLIST-2026-05-17.md`](../../deployment/PRE-DEPLOY-CHECKLIST-2026-05-17.md) — checklist de readiness (mergeado, commits integrados, pnpm, bugs corregidos).

---

## Bloqueantes de prod detectados via audit (no resueltos por codigo)

Audit ejecutado 2026-05-16 via Chrome DevTools MCP contra `https://yourdomain.com` + cross-check con DB dev. Reporte completo en [PROD-AUDIT-2026-05-16.md](../audit/PROD-AUDIT-2026-05-16.md).

| # | Hallazgo | Severidad | Resuelto por V3? |
|---|----------|-----------|------------------|
| B1 | **Slugs corruptos en `schools.slug` (5 de 11)**: `instituci-n-educativa-caracas`, `confama` (typo), `buen-comiezo` (typo), `hector-abad-gomes` (typo). Tildes mal escapadas + 3 typos. | **BLOQUEANTE** | Solo si se sincroniza dev → prod **antes** del cutover + redirects 301 en `next.config.ts`. |
| B2 | **`schools.primary_color = NULL` en prod (todos los 11 colegios)**. Dev tiene CARACAS-001 con `#1E3A8A`. | **BLOQUEANTE** | V3 SchoolPicker depende de color por colegio. Sin sync, fallback gris → se pierde 80% del valor visual del rediseño. |
| B3 | **CARACAS-001 catalogo vacio en prod**: dev dice 60 productos activos, prod renderiza solo los 11 globales. | **BLOQUEANTE** | Bug pre-existente que V3 no resuelve, solo expone. Hay que auditar prod DB y decidir migrar o investigar flag oculto. |
| B4 | Acentos omitidos en copy actual, tagline interno fugando, version visible en footer, orden de schools inconsistente | Cosmetico | ✓ V3 ya escribe con acentos, omite tagline interno, esconde version, ordena por `display_order`. |
| B5 | Categorias sucias (`accessories` vs `accesorios`) | Calidad | ✓ Migracion `v3_design_cleanup_001` (aplicada a dev, falta prod). |
| B6 | Capitalizacion inconsistente en garment_types (`camiseta` vs `Camiseta`) + productos duplicados Comfama | Data dirty | Resuelto por el track de catalog stabilization (sesion 2026-05-24) — SQL idempotente listo en [catalog-stabilization-2026-05-24.md](../../qa-briefs/catalog-stabilization-2026-05-24.md) §2. |
| B7 | URLs antiguas (`/confama`, `/buen-comiezo`, `/instituci-n-*`) ya indexadas en Google | SEO | Requiere redirects 301 en `next.config.ts` deployeados **junto** con el sync de slugs. |

**Trabajo concreto pre-cutover (resumen):**

1. Snapshot/backup prod DB.
2. Diff dev⇄prod en `schools`, `products`, `business_settings` + generar SQL script idempotente de sync selectivo (slugs limpios + `primary_color` de CARACAS + migracion `v3_design_cleanup_001` + renames canonicos del catalog stabilization).
3. Auditar el catalogo CARACAS-001 prod (`SELECT COUNT(*) FROM products WHERE school_id = (SELECT id FROM schools WHERE code='CARACAS-001');`) y decidir migrar o investigar flag.
4. Agregar 6 redirects 301 en `web-portal/next.config.ts` (deploy junto con el sync, no antes).
5. Aplicar migracion `v3_design_cleanup_001` a prod.

---

## Otros Cambios en v3.0.0 (originales)

### Payment Accounts Admin
- `pages/PaymentAccounts.tsx` — pagina de gestion de metodos de pago para clientes web (Nequi, Daviplata, cuentas bancarias, QR)
- `components/PaymentAccountModal.tsx` — crear/editar cuentas
- `components/PaymentVerificationModal.tsx` — aprobar/rechazar comprobantes de pago del web-portal

### Config
- `backend/app/core/config.py` — agrega `GOOGLE_CLIENT_ID: str = ""` (preparacion OAuth) — **OAuth ya configurado en prod runbook**: `8387b89`
- `backend/app/main.py` — registra routers `catalog` y `vendors`
- Permisos nuevos en permission.py: `catalog.view`, `catalog.manage`, `accounting.manage_vendors`

### Migraciones Auxiliares
- `eca80d86c730_merge_school_slugs_and_sale_payment_.py` — merge head
- `pos1t10n5_add_positions_table.py` — tabla positions
- `sal3paym3nt_migrate_sale_payment_method_legacy.py` — migracion legacy payment methods
- `v3_design_cleanup_001_v3_design_cleanup.py` — design cleanup (head actual `c537b09`)

---

## Estado del Working Tree (deprecated — ver "Estado real" arriba)

> Esta seccion describia el estado pre-sprint. Ya no es exacta: todo se commiteo en el sprint Q2 y se mergeo a `main` (`9cb0913`).

| Categoria | Cantidad original | Estado actual |
|-----------|-------------------|---------------|
| Archivos staged (nuevos) | 3 | ✅ commited |
| Archivos modificados (unstaged) | ~200 | ✅ commited via sprint Q2 |
| Archivos nuevos (untracked) | ~15 | ✅ commited |
| Migraciones pendientes | 9+ | ✅ 14 migraciones aplicadas en dev, en main, **no aplicadas en prod** |

### Orden de Commit (historico — ya ejecutado)

El orden original sugerido se respeto en el sprint Q2:

1. ✅ Merge head migration — `eca80d86c730`
2. ✅ Product unification (5 migraciones + modelos + servicios + schemas + frontend)
3. ✅ Vendor normalization (3 migraciones + modulo completo + frontend transversal)
4. ✅ Positions catalog (1 migracion + modulo + frontend)
5. ✅ Payment accounts/verification (frontend nuevo)
6. ✅ Sale payment method legacy migration
7. ✅ Config y permisos menores (+ `perm_audit_001`)
8. ✅ Sprint Q2: 5 bug fixes + Gap A + AR due_date + expense FK
9. ✅ pnpm 11 migration
10. ✅ v3 design cleanup

---

## Fuera de Scope de v3.0.0 (post-estabilizacion)

v3.0.0 es **deuda tecnica + normalizacion + hardening contable**, no features de negocio. Lo siguiente NO entra en este release y arranca solo despues de estabilizar v3.0.0 en prod:

| Iniciativa | Release/Track | Doc | Estado actual |
|------------|---------------|-----|---------------|
| Sucursales (branches, school identities) | v3.1.0 (~ahora ~jul-ago 2026, era jun) | [branch-architecture.md](./branch-architecture.md) | Diseno hecho, sin implementar |
| **Contratos B2B (cotizaciones, contratos, anticipos)** | **Track B2B paralelo (post-v3.0.0)** | [b2b-contracts-model.md](./b2b-contracts-model.md) | B0 (FE DIAN) ✅ activo via Alegra externa |
| Modelo financiero (P&L, KPIs, proyecciones) | v3.2.0 (~oct 2026) | [financial-model-design.md](./financial-model-design.md) | Tab implementado + escenarios multi-fase. Hardening Q2 hecho. |
| Organization + white-label + SaaS | v3.2.0 (~oct 2026) | [transition-plan.md](./transition-plan.md) | Diseno hecho, sin implementar |

> **Nota sobre B2B:** la fase B0 (FE DIAN) ya **se activo externamente** via Alegra el 2026-05-16 (resolucion 18764109873979). El restaurante (~$9M) ya puede facturarse hoy. Pendiente: integrar la API de Alegra al backend UCR para que las facturas se emitan desde el sistema, no manualmente. Ver `memory/alegra_api_integration_notes.md`.

> **Wompi:** live en prod desde 2026-03-18 (anterior a v3). Ya no es "futuro".

---

## Prerequisitos para Deploy a Produccion (vigentes)

Validar antes de agendar la ventana. **Lista actualizada al 2026-05-24** — sumar los nuevos checks que surgieron post-merge:

### 🔴 GATE 0 — Consolidacion de Encargos (BLOQUEANTE absoluto)

> **Sin estos 9 items cerrados, no se ejecuta ninguno de los pasos siguientes. Decision del owner 2026-05-24: "no se puede subir version estable sin esa consolidacion".**

- [ ] **Sesion A — Auditoria forense** ejecutada con el prompt [`encargos-audit-session-prompt.md`](../formalization/prompts/encargos-audit-session-prompt.md) (356 lineas, restaurado).
- [ ] `uniformes_prod_snapshot` refrescado al dia de la sesion (no usar dumps viejos — los pagos pueden haber cambiado).
- [ ] **Acta de decisiones** generada en `docs/v3/formalization/encargos-audit-2026-05-XX.md` con los 25 casos cerrados (decision + asientos contables).
- [ ] **Casos Tipo F (JUCUM $848K + Cristina Giraldo $130K) decididos personalmente por el owner**, no delegados a Claude. Decision documentada con la razon.
- [ ] Bugs sistematicos descubiertos durante la sesion catalogados en `docs/v3/formalization/encargos-audit-bugs.md`.
- [ ] **Sesion B — Implementacion** ejecutada: migracion `order_audit_overrides`, modelo, endpoint admin, reportes con LEFT JOIN, script de asientos.
- [ ] Tests de regresion: `orders.status` publico NO cambio en ninguna fila (audit query incluida en suite).
- [ ] Asientos contables del acta aplicados en dev → cuadrar Balance + AR aging + P&L con la nueva realidad.
- [ ] Decision: ¿script de asientos corre en dev y se incluye en el deploy v3, o se ejecuta como step post-deploy contra prod? (Documentar en el runbook de deploy).

> Tiempo estimado total: **Sesion A 3-6h + Sesion B 1-2 sesiones de codigo + validacion** = 1 semana realista. Programar antes de cualquier otra cosa del deploy.

---

### 🔴 GATE 1 — Runtime del VPS pnpm-ready (BLOQUEANTE absoluto)

> **Sin estos pasos ejecutados en el VPS, el deploy revienta apenas el workflow `cd.yml` ejecute `pnpm install`. Decision del owner: centralizar este check aqui en vez de en el bloque "Infraestructura" — es bloqueante de la misma severidad que GATE 0.**

**Contexto:** la migracion pnpm 11 (Iniciativa 5) borro todos los `package-lock.json`. El VPS produccion corre Node 20.19.6 sin pnpm. Sin upgrade previo:

- `pnpm install` falla (comando inexistente).
- `npm ci` falla (ya no hay `package-lock.json`).
- `npm install` "funciona" pero hace resolucion en frio sin lockfile (riesgo supply-chain).
- Los `package.json` exigen `engines.node >=22` → upgrade obligatorio.

**Topologia real de prod a tener en mente** (verificada 2026-05-17, ver [pnpm-deploy-runbook.md §Topologia](../../deployment/pnpm-deploy-runbook.md)):
- Backend `uniformes-api` via systemd (no Docker), Python venv.
- web-portal + admin-portal via PM2 (`next start`, puertos 3000/3001).
- Tauri frontend NO se compila en VPS (binarios desde CI/macOS).

**Pasos manuales (UNA SOLA VEZ, antes de cualquier deploy v3):**

- [ ] SSH a `root@104.156.247.226`.
- [ ] **Upgrade Node 20 → 22 LTS** (apt reemplaza `/usr/bin/node` in-place, los procesos PM2 vivos NO se caen):
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
   sudo apt-get install -y nodejs
   node -v   # esperado: v22.x
   ```
- [ ] **Habilitar pnpm via corepack** (despues del upgrade — Node 22 trae corepack mas nuevo):
   ```bash
   sudo corepack enable pnpm
   sudo corepack prepare pnpm@11.1.2 --activate
   pnpm -v   # esperado: 11.1.2
   which pnpm   # esperado: /usr/local/bin/pnpm (PM2 corre como root)
   ```
- [ ] **Aplicar Node 22 a los portales vivos** (blip de ~2-3s por portal, Nginx puede dar 502 ese instante — agendar en ventana de baja operacion):
   ```bash
   pm2 restart uniformes-web && pm2 restart uniformes-admin
   ```
- [ ] **Verificar que un proceso PM2 reiniciado reporta Node 22**, no Node 20 (el binario ya estaba en memoria con la version vieja):
   ```bash
   pm2 describe uniformes-web | grep "node version"
   ```
- [ ] **NO borrar `node_modules` en este gate.** La limpieza va atomica en el deploy (Paso 1 / 1-bis del runbook), nunca como paso adelantado — `next start` carga modulos en runtime y borrarlo deja una ventana donde cualquier `pm2 restart` tumba el portal con `MODULE_NOT_FOUND`.
- [ ] **Decidir politica de PM2 start command:** mantener `npm start` (sigue funcionando, `npm start` solo ejecuta `next start` sin reinstalar) **o** recrear procesos para que arranquen via `pnpm start` para consistencia. Si recrear, runbook §Paso 1 tiene los comandos `pm2 delete ... && pm2 start pnpm --name ... -- start && pm2 save`.
- [ ] **Confirmar `DEPLOY_ENABLED=true`** en GitHub repo-variables si se va a usar deploy automatizado via tag (`cd.yml` ya migrado a pnpm).
- [ ] Smoke contra el VPS antes del deploy real: el siguiente `pnpm install --frozen-lockfile` en `web-portal/` y `admin-portal/` debe resolver sin red blocking ni `ERR_PNPM_NO_LOCKFILE`.

> **Runbook autoritativo:** [`docs/deployment/pnpm-deploy-runbook.md`](../../deployment/pnpm-deploy-runbook.md) — fuente unica de verdad. Si este GATE y el runbook divergen, el runbook gana y se actualiza este GATE.

---

### Codigo

- [x] Sprint Q2 mergeado a `main` (`9cb0913`).
- [x] Iniciativa 7 (reports money accuracy) commiteada (`1ab192b`).
- [ ] **11 commits post-merge pusheados a `origin/main`** (HEAD local esta adelante). Sin `git push` el deploy lee codigo viejo.
- [ ] **Decidir si Iniciativas 6 (cost permission) y 8 (test isolation) entran a v3.0.0 o se difieren.** Si entran: commitear + push. Tocan endpoint publico de productos y aislamiento de tests, no se pueden mergear a medias.
- [ ] **Decidir si Iniciativa 10 (Alegra DIAN) entra a v3.0.0.** Si entra: cerrar los 7 bloqueantes tecnicos (settings en `config.py`, rotar token, agregar router, persistir enlace UCR↔Alegra, nota credito al cancelar, DS automatico al gastar, idempotencia). Minimo 1-2 sesiones dedicadas.
- [ ] **Decidir si Sistema de Costos (Iniciativa 9) deuda C1 (608 productos sin `cost`) se ataca antes o despues del deploy.** Sin ese trabajo, COGS coverage queda <100% para varios colegios y los reportes de margen muestran disclaimers.
- [ ] **Decidir si storefront v3-preview + bank reconciliation se commitean dentro de v3.0.0 o quedan untracked hasta v3.1.** El primero es rediseño activo del portal publico; el segundo es CLI ops independiente del runtime.
- [ ] **Decidir que se hace con `claudesing/`** en raiz (versionar o ignorar).

### Migraciones y data

- [x] Migraciones testeadas en orden contra data prod fresca (sprint Q2 M1 + M2).
- [x] Tests backend pasando en modulos afectados (109+64 PASSED en receivable/planning/balance_integration, tests anteriores al working tree actual).
- [ ] Suite completa pytest verde **despues** del cambio de `conftest._reset_database` (Iniciativa 8). Sin este check, el reset puede romper tests legacy que asumian estado sucio.
- [ ] Audit score 100/100 (script `audit_data_quality_score.py` **no escrito** todavia).
- [ ] Backup de DB produccion documentado y validado (script existe, validar fresco).
- [ ] Verificar que `SaleItem.product_id` no tiene NULLs en prod (query antes del deploy).
- [ ] Verificar que todos los `vendor` strings se mapean correctamente en prod del dia.

### Bloqueantes de prod (audit 2026-05-16) — no codigo, data drift

- [ ] **B1 — Slugs**: SQL script idempotente con 5 UPDATE de `schools.slug` (caracas, pumarejo, pinal, comfama, buen-comienzo, hector-abad-gomez) listo y revisado.
- [ ] **B2 — `primary_color`**: minimo `CARACAS-001 = '#1E3A8A'`. Idealmente Consuelo aporta los 10 restantes; fallback aceptado: gris en V3.0, poblar en V3.1.
- [ ] **B3 — Catalogo CARACAS-001**: `SELECT COUNT(*) FROM products WHERE school_id IN (SELECT id FROM schools WHERE code='CARACAS-001');` corrida en prod. Si es 0, plan de migracion. Si es 60 con `is_active=false`, marcar activos.
- [ ] **B6 — Catalogo**: SQL de catalog stabilization (renames + Title Case) probado en `uniformes_db` y empaquetado para correr en el deploy.
- [ ] **B7 — Redirects 301**: 6 entries agregadas a `web-portal/next.config.ts` (deploy junto con el sync, no antes).
- [ ] **`v3_design_cleanup_001`** se aplica a prod junto con el resto.

### Infraestructura

- [ ] Frontend build sin errores localmente en los 4 sub-repos con pnpm 11 (los del VPS estan en GATE 1).
- [ ] Reboot pendiente del kernel patched (CVE-2026-31431 mitigado, reboot diferido al deploy v3 — ver memory `vps_reboot_deferred_to_v3_deploy`). Aprovechar la misma ventana que GATE 1 si es factible.
- [ ] Ventana de deploy agendada (sabado o domingo temprano, baja operacion). **Debe ocurrir despues** de GATE 1 + GATE 0 cerrados.
- [ ] Plan de rollback validado contra commit actual de `main` (ver [DEPLOY-INSTRUCTIONS-2026-05-17.md](../../deployment/DEPLOY-INSTRUCTIONS-2026-05-17.md) §Rollback).

### Decisiones de owner

- [ ] Reclasificaciones masivas (gastos personales/negocio, Cristina $19M, Nequi $20M, equity correctivo $21.6M) van **antes** del deploy o **despues** con scripts post-deploy.
- [ ] Politica de OAuth Google: activar el flow `8387b89` en este deploy o diferirlo. Si activar, runbook completo en [google-oauth-prod-runbook.md](../../deployment/google-oauth-prod-runbook.md).
- [ ] **FE DIAN (Iniciativa 10):** dejar el panel Alegra manual (factura el restaurante a mano) vs. exponer endpoint en este deploy vs. arrancar v3.0.1 con el ciclo completo (emit + nota credito + DS + persistencia + idempotencia).
- [ ] **FE DIAN: rotar `ALEGRA_TOKEN`** que fue compartido en chat antes de cualquier integracion. Memoria `electronic_invoicing_active` tiene el token expuesto.
- [ ] **Sistema de Costos: 608 productos sin `cost`** — captura pre-deploy (mejora COGS desde el dia 0) vs. post-deploy con [`costs-importer-prompt.md`](../formalization/prompts/costs-importer-prompt.md).

---

## Referencias

### Plan y bitacoras

- [ROADMAP de formalizacion (nueva fase)](../formalization/ROADMAP.md) — Track A es el deploy v3, retrospectiva del sprint Q2 + plan vivo Q2-Q3.
- [Sprint log Q2](../formalization/sprint-log.md) — bitacora viva del trabajo que llego a v3.0.0.
- [Transition plan](./transition-plan.md) — fases v3.1, v3.2, B2B (timeline corregido +2 meses tras Sprint Q2).
- [b2b-contracts-model.md](./b2b-contracts-model.md) — B2B track (tercer pilar).
- [Financial model design](./financial-model-design.md) — diseño del modelo financiero v3.2 (escenarios multi-fase ya implementados).

### Operacion y deploy

- [DB snapshot workflow](../formalization/db-snapshot-workflow.md) — `reset_dev_from_prod.sh` para validar migraciones contra prod fresco.
- [Deploy instructions 2026-05-17](../../deployment/DEPLOY-INSTRUCTIONS-2026-05-17.md) — runbook tecnico, 15 minutos estimados.
- [Pre-deploy checklist 2026-05-17](../../deployment/PRE-DEPLOY-CHECKLIST-2026-05-17.md) — checklist de readiness.
- [pnpm deploy runbook](../../deployment/pnpm-deploy-runbook.md) — primer deploy con pnpm 11.
- [Google OAuth prod runbook](../../deployment/google-oauth-prod-runbook.md) — activacion opcional del OAuth.

### Auditoria, QA y diseño

- [PROD audit 2026-05-16](../audit/PROD-AUDIT-2026-05-16.md) — 3 bloqueantes + 8 cosmeticos. Bloqueante para cutover.
- [Catalog stabilization 2026-05-24](../../qa-briefs/catalog-stabilization-2026-05-24.md) — renames canonicos + Title Case + estrategia "todo en dev, shippea con v3".
- [QA full post-V3](../../qa-briefs/qa-full-post-v3-2026-05-04.md) — CONDITIONAL GO post-M2.
- [QA financial-model post-fix](../../qa-briefs/qa-financial-model-2026-05-04-post-fix.md) — score 6.5 → 9.0.
- [Storefront V3 handoff](../design/storefront-v3-handoff.md) — diseño del rediseño en `/v3-preview/`.
- [Business facts](../design/business-facts.md) — fuente unica para el storefront V3.

### Formalizacion (8 dimensiones + sub-tracks)

- [Formalizacion — README](../formalization/README.md) — indice de las 8 dimensiones + sub-carpetas.
- Dimensiones nuevas: [05-datos-personales](../formalization/05-datos-personales.md), [06-comercial](../formalization/06-comercial.md), [07-operacional](../formalization/07-operacional.md), [08-tecnologico](../formalization/08-tecnologico.md).
- [Equipo roadmap 2026](../formalization/equipo/equipo-roadmap-2026.md) + [bitacoras](../formalization/equipo/bitacoras/) — 5 bitacoras (Owner/Cofundador/Joven).
- [estabilizacion_contable/](../formalization/estabilizacion_contable/) — reconciliacion bancaria multi-banco, intangibles NIIF, plan de migracion hibrida, patrimony deep dive.
- [estabilizacion_financiera/](../formalization/estabilizacion_financiera/) — financial-impact, modelo financiero current state, costs-importer plan.
- [estabilizacion_operacional/](../formalization/estabilizacion_operacional/) — catalogo unico de procedimientos faltantes.
- [prompts/](../formalization/prompts/) — sesiones self-contained: stabilization, financial-model (UI + sesion completa), v3-migration-on-prod, costs-importer, encargos-audit.

---

[← Volver al indice](./README.md)
