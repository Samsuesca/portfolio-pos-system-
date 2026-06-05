# Prompt — Sesión: UI completa del Modelo Financiero en Tauri

> **Para usar en sesión nueva** de Claude Code.
> **Working dir:** `/Users/angelsamuelsuescarios/Documents/03_Proyectos/Codigo/uniformes-system-v2`

---

## Contexto del proyecto

**UCR — Uniformes Consuelo Ríos.** Sistema multi-tenant en producción
(yourdomain.com). Stack: FastAPI backend + Tauri/React frontend +
PostgreSQL. Branch del sprint actual: `chore/stabilization-sprint-2026-Q2`
(rama autorizada del sprint mayo 2026 — ver ROADMAP.md). Esta sesión NO bloquea
el sprint principal y puede correr en paralelo. Lee CLAUDE.md raíz para
convenciones (timezone Colombia, AccountType minúsculas, contabilidad GLOBAL, etc.).

## Background — Lee primero

1. `docs/formalization/financial-model-current-state.md` — qué existe en backend,
   qué falta, gaps detectados.
2. `docs/formalization/financial-impact.md` — los 3 escenarios A/B/C y schema
   `formalization_layer` que entra al ProjectionService.
3. `docs/formalization/projection-scenarios-results.md` — resultados de las 3
   proyecciones ejecutadas. Insight central: ningún escenario obvio es viable
   sin crecimiento B2B + escalonado.
4. `docs/v3-branch-architecture/financial-model-design.md` — diseño original con
   layout del dashboard.
5. `backend/app/services/accounting/financial_model/projection.py` — servicio
   nuevo (creado 2026-05-02) que calcula proyecciones multi-mes con escenarios.
6. `backend/app/schemas/financial_model.py` — schemas Pydantic, especialmente
   `ProjectionAssumptions`, `ProjectionMonth`, `ProjectionRunResponse`.

## Estado actual de la UI

- Existe `frontend/src/pages/CFODashboard.tsx` (ruta `/cfo`) con health score,
  liquidez, deuda, runway, alertas. Funciona.
- Existe `frontend/src/pages/Accounting.tsx` con 5 tabs (resumen, gastos,
  operaciones, CxC/CxP, planificación).
- **`frontend/src/components/accounting/financial-model/`** tiene 8 componentes
  huérfanos (1,313 LOC: FinancialModelTab + 7 paneles: KPI, Profitability,
  Trends, Budget, CashForecast, Alerts, ExecutiveSummary). Fueron desconectados
  accidentalmente en commit `0003295` del 13 abr ("vendor normalization").
- Hay 4 endpoints REST nuevos sin UI: `POST/GET/DELETE
  /api/v1/global/accounting/projections/*` (creados 2026-05-02).
- Servicio frontend existente: `frontend/src/services/financialModelService.ts`
  (301 LOC) cubre KPIs/profitability/trends/budgets/forecasts/alerts pero NO
  proyecciones.

## Objetivo

Construir la UI completa del modelo financiero en Tauri/React con permisos
granulares, integrando:

1. **Restaurar FinancialModelTab** desconectado en commit 0003295 (quick win).
2. **Nueva sección Proyecciones** que consume los endpoints
   `/global/accounting/projections/*` (formulario de assumptions, ejecución,
   comparación de escenarios A/B/C).
3. **Permisos granulares** vía sistema existente (ver `usePermissions` hook,
   `require_global_permission` en backend).

## Requisitos funcionales

### Bloque 1 — Restaurar lo desconectado (1 hora)

- En `frontend/src/pages/Accounting.tsx` agregar de vuelta el tab
  `financial_model` (mismas 2 líneas eliminadas en commit 0003295).
- Importar `FinancialModelTab` desde
  `components/accounting/financial-model/FinancialModelTab.tsx`.
- Verificar que los 7 paneles cargan correctamente contra los endpoints actuales.
- Si algún panel rompe (los endpoints pudieron haber cambiado), arreglar el
  fetch.

### Bloque 2 — Nueva tab "Proyecciones" (1-2 días)

Crear `frontend/src/components/accounting/projections/`:

- `ProjectionsTab.tsx` — orchestrator con sub-tabs: "Nueva proyección" /
  "Escenarios guardados".
- `ProjectionForm.tsx` — formulario con secciones colapsables (acordeón):
  - Período (start_year, start_month, months 1-36).
  - Revenue (base mensual, estacionalidad por mes con sliders/inputs, growth %).
  - COGS (% sobre revenue).
  - Costos fijos (mensual).
  - Personal (payroll base + lista de hires con rol/salario/mes).
  - Sucursales nuevas (lista con mes, costos fijos, payroll, revenue ramp).
  - Deudas (lista con capital, cuota mensual, % interés vs % capital, mes inicio).
  - Capa de formalización (one-time costs por mes + recurring costs).
  - Macro (inflación anual, caja inicial).
  - Botón "Calcular" → `POST /global/accounting/projections/run`.
- `ProjectionResults.tsx`:
  - Tabla mes a mes con columnas: período | revenue | gross profit | OpEx |
    op profit | interest | net profit | net cash flow | cumulative cash | flags
    (breakeven-, cash-).
  - Cards de summary (totales, márgenes promedios, breakeven mensual, caja
    final, meses negativos).
  - Gráficos (recharts):
    - Revenue × COGS × Net Profit (área apilada).
    - Cumulative cash (línea con threshold $0).
    - Breakdown OpEx (barras apiladas: fixed + payroll + formalization).
- `ProjectionsList.tsx` — lista de escenarios guardados con compare side-by-side
  (seleccionar 2-3 para comparar summaries).
- `ProjectionPresets.tsx` — botones para cargar Escenarios A/B/C predefinidos.

### Bloque 3 — Frontend service (0.5 días)

Crear `frontend/src/services/projectionService.ts` con:

- `runProjection(assumptions)`.
- `listProjections(scenario?)`.
- `getProjection(id)`.
- `deleteProjection(id)`.
- TypeScript interfaces espejo de `ProjectionAssumptions`, `ProjectionMonth`,
  `ProjectionSummary`.

### Bloque 4 — Permisos granulares (0.5 días)

- Backend: agregar permisos `financial_model.view`, `financial_model.run_projection`,
  `financial_model.manage_budgets`, `financial_model.export` en
  `app/services/permission_registry.py`.
- Frontend: usar `usePermissions()` hook para condicionar visibilidad de tabs y
  botones de acción.
- Wire endpoints con `require_global_permission(...)` correspondiente.

### Bloque 5 — Quality checks

- Tests Vitest del nuevo `projectionService.ts` (mock fetch).
- Verificación visual: levantar dev y correr Escenario B contra dev DB.
- Lint TypeScript estricto (no `any`).
- Documentar en `docs/development/financial-model-ui.md` cómo usar.

## Restricciones técnicas

- **No tocar el backend del ProjectionService** (ya está funcional; tests via
  `docker exec uniformes-backend python scripts/test_projection.py`).
- **No tocar el sistema de permisos cardinal** salvo agregar permisos nuevos
  vía registry.
- Usar componentes UI existentes del proyecto (Tailwind v4 + Radix).
- **Conventional commits SIN emojis**. Co-Author NUNCA.
- Mensajes de UI siempre en español.
- Timezone Colombia (`utils/formatting.ts` tiene `getColombiaDateString`).

## Entregables

1. Tab "Modelo Financiero" restaurado en `/accounting` con los 7 paneles
   antiguos funcionando.
2. Sub-página "Proyecciones" dentro del Modelo Financiero con formulario
   completo + resultados + comparativo de escenarios.
3. `projectionService.ts` con tests.
4. Permisos `financial_model.*` registrados y wired.
5. Captura visual de la UI con Escenario B corriendo.
6. PR con descripción enlazando a este prompt y a los docs de formalización.

## Definición de "hecho"

- Usuario puede entrar a `/accounting` → tab "Modelo Financiero" → ver KPIs,
  profitability, trends, budgets, forecast, alerts, executive summary, **y
  proyecciones**.
- Usuario sin permiso `financial_model.run_projection` ve los datos pero el
  botón "Calcular nueva proyección" está deshabilitado.
- Escenario B con assumptions de `docs/formalization/financial-impact.md`
  produce el mismo output que el script
  `docker exec uniformes-backend python scripts/test_projection.py`.
- Cero TypeScript errors, cero warnings de console en runtime.
