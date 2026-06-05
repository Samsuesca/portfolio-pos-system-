# Modelo Financiero — UI (Tauri/React)

> Última actualización: 2026-05-04
> Stack: React 18, TypeScript estricto, recharts 3.x, Tailwind v4
> Ruta: `/accounting` → tab **Modelo Financiero**

---

## 1. Resumen

El módulo "Modelo Financiero" agrupa ocho sub-paneles dentro del tab principal
de Contabilidad. Siete son del modelo financiero histórico (KPIs, rentabilidad,
tendencias, presupuesto, proyección de caja corta, alertas, resumen ejecutivo)
y el octavo es **Escenarios**, una nueva sub-sección de proyecciones
multi-mes formalization-aware que consume los endpoints
`/global/accounting/projections/*` creados en mayo 2026.

Diagrama:

```
/accounting
└── tab "Modelo Financiero"   (gated por reports.financial)
    └── FinancialModelTab.tsx
        ├── Indicadores      (KPIDashboard)
        ├── Rentabilidad     (ProfitabilityPanel)
        ├── Tendencias       (TrendsPanel)
        ├── Presupuesto      (BudgetPanel)
        ├── Proyección caja  (CashForecastPanel)  — corta, semanas/meses
        ├── Escenarios       (ProjectionsPanel)   — NUEVO, multi-mes
        ├── Alertas          (AlertsPanel)
        └── Resumen          (ExecutiveSummaryPanel)
```

---

## 2. Sub-panel "Escenarios" (Proyecciones)

### 2.1 Estructura

Archivos en `frontend/src/components/accounting/financial-model/projections/`:

| Archivo | Rol |
|---|---|
| `ProjectionsPanel.tsx` | Orquestador. Dos sub-tabs: "Nueva proyección" / "Escenarios guardados". Maneja state + fetch + permisos. |
| `ProjectionForm.tsx` | Formulario con presets + secciones colapsables (período, ingresos, COGS, costos fijos, personal, sucursales, deudas, formalización, macro). |
| `ProjectionResults.tsx` | Render del resultado: cards de resumen, charts (recharts), tabla mes a mes. |
| `ProjectionsList.tsx` | Lista de escenarios guardados, comparativo lado-a-lado de hasta 3 escenarios. |
| `projectionPresets.ts` | Preset builders para Escenarios A/B/C + baseline. Datos calibrados con `docs/formalization/financial-impact.md`. |

Servicio: `frontend/src/services/projectionService.ts` — espejo TypeScript de
los schemas Pydantic (`backend/app/schemas/financial_model.py` Module 8).

### 2.2 Permisos

| Acción | Permiso requerido |
|---|---|
| Ver tab "Modelo Financiero" | `reports.financial` |
| Ver paneles 1-7 | `reports.financial` (ya existía) |
| Ver sub-panel "Escenarios" | `reports.financial` |
| Correr proyección | `reports.financial` |
| Guardar proyección | `reports.financial` (controlado por checkbox `persist`) |
| Eliminar proyección | `reports.financial` |

El backend ya gatea estos cuatro endpoints con
`require_global_permission("reports.financial")`. La UI valida el mismo permiso
antes de habilitar el botón "Calcular proyección" y antes de mostrar el botón
de eliminar. Si el usuario no tiene el permiso, ve un banner amarillo
indicando "Acceso restringido" en lugar del panel.

> **Nota:** No se introdujeron permisos backend nuevos (`financial_model.*`)
> para evitar romper compatibilidad con roles existentes. Si en el futuro se
> quiere granularidad mayor (ej: separar `view` de `run`), agregar los nuevos
> permisos en `backend/app/services/permission.py` y actualizar el wiring.

### 2.3 Endpoints consumidos

| Verbo | Endpoint | Service method |
|---|---|---|
| POST | `/api/v1/global/accounting/projections/run?persist={bool}` | `runProjection()` |
| GET | `/api/v1/global/accounting/projections?limit&scenario` | `listProjections()` |
| GET | `/api/v1/global/accounting/projections/{id}` | `getProjection()` |
| DELETE | `/api/v1/global/accounting/projections/{id}` | `deleteProjection()` |

### 2.4 Presets

Cuatro escenarios cargables desde el formulario, calibrados con la mejor data
disponible al 2026-05-02:

- **Baseline** — operación actual sin capa de formalización (control).
- **Escenario A** — Mínimo viable legal. ARL + contador freelance + FE básico
  + regularización DIAN. Sin SAS. Año 1: ~$10M-$14M.
- **Escenario B** — Formalización completa (recomendado). SAS + contratos
  formales + FE/nómina DIAN + regularización completa. Año 1: ~$32M-$47M.
- **Escenario C** — B2B Premium. B + RUP + BASC/ISO + marca + asesoría legal
  de cabecera. Año 1: ~$50M-$80M.

Defaults compartidos por todos los presets:
- Inicio: mayo 2026 (`start_year=2026, start_month=5`)
- Horizonte: 12 meses
- Revenue base: $7.5M/mes con estacionalidad UCR (pico ene-feb ~2.3x, valle abr-jun ~0.6x)
- COGS: 62%
- Costos fijos: $1.1M/mes (arriendo + servicios + internet)
- Payroll base: $5.6M/mes (4 trabajadores SMMLV)
- Caja inicial: $12.08M (snapshot prod 2026-05-02)
- 2 préstamos informales activos: $19M capital, $550k/mes interés total

### 2.5 Validación

Backend: el script `backend/scripts/test_projection.py` corre **su propia
versión** del Escenario B (con sucursal nueva, payroll $9M, base revenue $10M)
contra dev DB y produce un ground-truth de referencia. **No es comparable byte-
a-byte con el preset frontend B**: ambos modelan el mismo escenario conceptual
pero usan inputs distintos. Para validar el cálculo backend con los mismos
assumptions del preset frontend, usar el flujo UI (capturado en
`docs/v3/formalization/screenshots/scenario-b-projection-2026-05-04.png`).

```bash
# Ground-truth del script (versión con sucursal nueva)
docker exec uniformes-backend python scripts/test_projection.py
```

Verificación visual ejecutada 2026-05-04 con el preset frontend B exacto:

| Métrica | Preset B (frontend) | Backend response (UI) |
|---|---|---|
| `total_revenue` | — | $92,739,826 |
| `total_net_profit` | — | -$97,998,606 |
| `ending_cash` | — | -$85,918,606 |
| `months_cash_negative` | — | 11 |
| `total_formaliz_one_time` | $17,150,000 (suma manual) | $17,150,000 ✓ |
| `total_formaliz_recurring` | $26,902,000 (suma manual) | $26,902,000 ✓ |

Console: 0 errores / 0 warnings durante el flujo end-to-end.

Frontend tests (92 tests, cobertura: service 100% líneas, componentes ≥85%):

```bash
npm run test -- src/services/__tests__/projectionService.test.ts \
                src/components/accounting/financial-model/projections/__tests__/
```

Cobertura por archivo (medida 2026-05-04 con `vitest --coverage`):

| Archivo | % Líneas | % Branches |
|---|---|---|
| `services/projectionService.ts` | 100% | 100% |
| `projections/projectionPresets.ts` | 100% | 100% |
| `projections/ProjectionsList.tsx` | 100% | 95% |
| `projections/ProjectionResults.tsx` | 99% | 88% |
| `projections/ProjectionsPanel.tsx` | 99.6% | 82% |
| `projections/ProjectionForm.tsx` | 85% | 98% |

---

## 3. Cómo agregar un nuevo sub-panel al modelo financiero

1. Crear el componente en `components/accounting/financial-model/<nombre>.tsx`.
2. Agregarlo al `index.ts` del barrel.
3. En `FinancialModelTab.tsx`:
   - Añadir entrada al union `SubTab`.
   - Añadir entrada a `SUB_TABS` con icon de lucide-react.
   - Si el panel maneja su propio fetch (como `ProjectionsPanel`), agregar
     early-return en `loadTabData` y renderizar el panel fuera del bloque
     `{!loading && !error && (...)}`.
   - Si el panel consume datos via `financialModelService`, añadir el case
     correspondiente en `loadTabData` y un `useState` para el data.

---

## 4. Cómo extender el formulario de proyecciones

Sección típica: input numérico/texto + sub-array opcional editable.

Ejemplo: agregar sección "Activos fijos a comprar":

1. En `frontend/src/services/projectionService.ts` añadir el campo a
   `ProjectionAssumptions` (debe coincidir con el schema Pydantic en
   `backend/app/schemas/financial_model.py`).
2. En `projectionPresets.ts` agregar el campo en `BASELINE` (default) y en
   `buildEmptyAssumptions()`.
3. En `ProjectionForm.tsx`:
   - Importar el icon adecuado de lucide-react.
   - Añadir un `<Section icon={X} title="Activos fijos">` con sub-arrays
     editables siguiendo el patrón `hiring_plan` / `debts`.

Para que el cálculo backend respete el nuevo campo, primero hay que
extender `ProjectionService._compute_month()` en
`backend/app/services/accounting/financial_model/projection.py`.

---

## 5. Modificar permisos requeridos

El gating es de un solo punto: `usePermissions().hasPermission('reports.financial')`.
Si decides separar permisos:

- Backend: agregar nuevos permisos en `backend/app/services/permission.py`
  (lista `ALL_PERMISSIONS`) y wirear cada endpoint con
  `require_global_permission("nuevo.permiso")`.
- Frontend: en `ProjectionsPanel.tsx`:
  ```tsx
  const canRun = hasPermission('financial_model.run_projection');
  const canDelete = hasPermission('financial_model.delete_projection');
  const canView = hasPermission('reports.financial');
  ```

---

## 6. Limitaciones conocidas (v1)

- **Revenue ramp para sucursales nuevas no es editable en UI**: se usa el ramp
  conservador del backend (60% del base × estacionalidad). Para personalizar
  hay que editar el JSON manualmente.
- **No hay export XLSX/PDF**: el módulo es 100% interactivo; un usuario que
  quiera llevarlo al contador debe usar screenshot o copy-paste de la tabla.
  El permiso `reports.export` queda reservado para esta iteración futura.
- **Comparativo limitado a 3 escenarios** lado-a-lado por restricciones de
  ancho de tabla. Si necesitas más, exporta cada uno individualmente.
- **Verificación visual end-to-end ejecutada 2026-05-04** con preset Escenario
  B contra dev DB (cash inicial $12.08M, snapshot prod). Login → /accounting →
  Modelo Financiero → Escenarios → preset B → Calcular. La suma manual de los
  costos del preset B coincide byte a byte con la respuesta del backend (one-
  time $17.15M, recurring $26.902M). Screenshot full-page en
  `docs/v3/formalization/screenshots/scenario-b-projection-2026-05-04.png`.
  Console limpio. Verificación de los presets A y C pendiente como
  follow-up manual.

---

## 7. Referencias cruzadas

- `docs/formalization/financial-impact.md` — escenarios A/B/C, costos detallados.
- `docs/formalization/financial-model-current-state.md` — gaps del modelo previo.
- `docs/v3-branch-architecture/financial-model-design.md` — diseño original.
- `backend/app/schemas/financial_model.py` (Module 8) — schemas Pydantic.
- `backend/app/services/accounting/financial_model/projection.py` — cálculo.
- `backend/scripts/test_projection.py` — ground-truth Escenario B.
