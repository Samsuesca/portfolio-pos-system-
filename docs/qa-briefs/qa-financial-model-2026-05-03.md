# QA Report — Módulo Modelo Financiero

**Date:** 2026-05-03 14:11 (Colombia)
**Mode:** UI (Chrome DevTools MCP)
**Module:** financial-model
**Platform:** Tauri desktop app — http://localhost:5171
**Backend:** http://localhost:8001 (docker, up 47h)
**Auth user:** Samuel (superusuario)
**Tester:** qa-agent (Claude Code internal)

---

## Summary

| Categoría | Total | Pasó | Falló |
|---|---|---|---|
| Login + nav | 2 | 2 | 0 |
| 7 paneles antiguos | 7 | 7 | 0 |
| Sub-panel Escenarios — flujo nuevo | 6 | 5 | 1 |
| Console + Network | 2 | 2 | 0 |
| **Total** | **17** | **16** | **1** (arreglado) |

**Resultado:** ✅ PASS con 1 bug encontrado y **arreglado en la misma sesión**. El módulo está listo para PR.

---

## Pre-condiciones encontradas

- Vite dev server estaba corriendo con cache stale ("Outdated Optimize Dep" 504s) que rompía el lazy import de `Accounting.tsx`. Resuelto matando el proceso viejo y arrancando con `npm run dev -- --force` (re-optimización forzada). **Esto NO es un bug del módulo** — es comportamiento estándar de Vite cuando se agregan archivos nuevos con dependencies optimizadas. Documentado para futura referencia.

## Tests ejecutados

### 1. Login + navegación a /accounting ✅

- Login `Samuel/Samuel2741` redirige a `/dashboard` con role "Superusuario"
- Click sidebar → "Contabilidad" carga `/accounting`
- 6 tabs visibles: Resumen, Gastos, Operaciones, CxC/CxP, Planificación, **Modelo Financiero**

### 2. Tab "Modelo Financiero" — 8 sub-paneles ✅

Todos cargan datos reales sin errores:

| Sub-panel | Estado | Datos verificados |
|---|---|---|
| Indicadores | ✅ | 17 KPIs (margen bruto 68.6%, ROA -65.3%, EBITDA -$19.8M, etc.) |
| Rentabilidad | ✅ | Bar chart + tabla por colegio (11 colegios, total $109.4M ingresos) |
| Tendencias | ✅ | Chart 13 meses (May 25 – May 26) con 3 anomalías z-score detectadas |
| Presupuesto | ✅ | Header "Presupuesto vs Real" + botón "Nuevo Presupuesto" |
| Proyección caja | ✅ | Saldo $13.2M, runway 2.3 meses, 3 escenarios (opt/exp/pes), tabla 10 períodos |
| **Escenarios (NUEVO)** | ✅ | Ver sección 3 |
| Alertas | ✅ | 1 crítica visible: "Cash runway corto" (1.5 meses) |
| Resumen | ✅ | Resumen ejecutivo Mayo 2026 con KPIs, alertas, proyección |

### 3. Sub-panel "Escenarios" (lo nuevo) ✅

**Estructura:**
- 2 sub-tabs: "Nueva proyección" / "Escenarios guardados"
- 4 botones de preset: Sin formalización (BASELINE), A, B (RECOMENDADO), C (PREMIUM)
- Formulario con 8 secciones colapsables: Período, Ingresos, COGS+Fijos, Personal, Sucursales, Deudas, Formalización, Macro
- Botón "Calcular proyección"

**Test E2E con Escenario B:**

1. Click preset "Escenario B" → assumptions cargados:
   - Nombre: "Proyección UCR — Escenario B" ✅
   - 12 meses, inicia mayo 2026 ✅
   - Estacionalidad UCR: ene 2.33, feb 1.95, abr-may 0.58, jul 1.17 ✅
   - 2 deudas (préstamos informales $19M total) ✅
   - Capa B: 11 one-time + 5 recurrentes ✅ (matches `financial-impact.md` exactamente)

2. Click "Calcular proyección" → `POST /global/accounting/projections/run?persist=true` → **200 OK**

3. Resultado renderizado:
   - **8 summary cards** (Ingresos $92.7M, Util. neta -$98.0M, Caja final -$85.9M, 11 meses caja negativa, etc.)
   - **3 charts recharts** (Ingresos×COGS×OpEx×Util.neta apilado, Caja acumulada con threshold $0, OpEx breakdown)
   - **Tabla mes-a-mes con 12 filas** (Mayo 2026 → Abril 2027) con flags ⚠ (bajo breakeven) y ✕ (caja negativa)
   - **Capa de formalización**: one-time $17.15M, recurrentes $26.9M

4. Tab "Escenarios guardados":
   - Lista mi proyección recién creada (top, ID `e9b71c22…`) + 4 anteriores del usuario
   - Filtros A/B/C/custom funcionan
   - Comparativo lado-a-lado: seleccionar 2 checkboxes muestra tabla con highlight verde (mejor) / rojo (peor)
   - Comparé mi B vs un Escenario A guardado → claramente A es más viable (caja final +$3M vs B -$86M, 2 vs 11 meses negativos)

### 4. Console errors y network ✅

**Console:**
- 2 warnings React Router (`v7_startTransition`, `v7_relativeSplatPath`) — preexistentes, no relacionados
- 1 error 404: `/vite.svg` — asset default de Vite, no impacta funcionalidad
- **0 errores del módulo Modelo Financiero**

**Network (48 XHR/fetch):**
- Todas 200 OK
- POST `/projections/run?persist=true` → 200 ✅
- GET `/projections?limit=50` → 200 ✅
- 7 endpoints `/financial-model/*` → 200 ✅

---

## Bugs encontrados

### Auditoría completa de coerción Decimal → number

Tras encontrar el bug del "Total formalización" hice una auditoría exhaustiva de **TODOS** los lugares donde código TS opera sobre campos `Decimal` del backend (que JSON-serializa como strings). Hallazgos:

| Operación JS | Comportamiento con string | Riesgo |
|---|---|---|
| `<`, `>`, `<=`, `>=` | Coerciona automáticamente | OK |
| `Math.round/max/min` | Coerciona | OK |
| `.toFixed(N)` | **Crash** (no existe en string) | Solo afecta `avg_*` que son float real, no Decimal |
| `+` (suma aritmética) | **Concatena** strings | **BUG: Total formalización** |
| `===` (strict equality) | Siempre falso entre str y num | **BUG LATENTE: highlight verde/rojo del comparativo** |

**Bug latente confirmado**: en `ProjectionsList.tsx:318-321`, el highlight verde (mejor) / rojo (peor) del comparativo usaba:
```jsx
const best = Math.max(...values);   // → number (e.g. -9961531)
if (v === best)                     // v es "-9961531.00" (string) → siempre false
```
**Resultado: el comparativo NUNCA aplicaba colores correctamente.** En el QA inicial no lo detecté visualmente porque sólo confirmé que los datos aparecían (no las clases CSS).

### Fix raíz aplicado en `projectionService.ts`

En lugar de remendar componente por componente, hice **coerción al deserializar la respuesta** del backend:

```typescript
const SUMMARY_DECIMAL_FIELDS = [...] as const;  // 13 campos Decimal del summary
const MONTH_DECIMAL_FIELDS = [...] as const;    // 16 campos Decimal del mes

function coerceFields<T, K extends keyof T>(obj: T, fields: readonly K[]): T {
  const out = { ...obj };
  for (const f of fields) {
    if (typeof out[f] === 'string') (out as Record<K, unknown>)[f] = Number(out[f]) as T[K];
  }
  return out;
}

// Aplicado en runProjection(), listProjections(), getProjection()
return coerceRunResponse(response.data);
```

**Beneficios del fix raíz:**
1. Honra los tipos TS declarados (`number`, no `string`).
2. Arregla el bug latente del comparativo automáticamente — sin tocar `ProjectionsList.tsx`.
3. Permitió **revertir** el fix puntual de `ProjectionResults.tsx` (ahora innecesario).
4. Blinda contra futuros bugs si alguien agrega `+`, `===`, `.toFixed()` en otros componentes.

### Verificación post-fix raíz

**Total formalización**: $44.052.000 ✅ (antes $0)

**Comparativo verde/rojo (verificado vía `evaluate_script` inspeccionando classNames):**
- Utilidad neta total — B: 🔴 rojo (text-red-600) — A: 🟢 verde (text-emerald-700) ✅
- Caja final — B: 🔴 — A: 🟢 ✅
- Mín. caja — B: 🔴 — A: 🟢 ✅
- Meses caja negativa — B: 🔴 (11) — A: 🟢 (2) ✅
- Meses bajo breakeven — B: 🔴 (12) — A: 🟢 (9) ✅
- Breakeven mensual — B: 🔴 — A: 🟢 ✅
- Margen neto promedio — B: 🔴 — A: 🟢 ✅
- (Ingresos totales y costos formalización SIN highlight — esperado, no tienen `highlight` prop)

**Tests Vitest agregados**: 4 tests nuevos en `projectionService.test.ts` que verifican coerción de strings a números en `runProjection`, `listProjections`, `getProjection`, e incluyen el caso crítico de `===` para el highlight. **22/22 tests pasan.**

### P2 (original) — Total formalización mostraba $0

Bug arreglado en una primera iteración con un fix puntual en `ProjectionResults.tsx:177`, luego **revertido** en favor del fix raíz en `projectionService.ts`. El componente vuelve a usar `summary.total_formalization_one_time + summary.total_formalization_recurring` (sin `Number()` wrapper) porque ahora el service garantiza que sean `number`.

---

## Observaciones (no bugs)

### Spinbuttons con `aria-invalid="true"` en estacionalidad

El a11y tree reporta `invalid="true"` en los inputs de seasonality (Ene 2.33, Mar 0.91, etc). Causa: el componente `NumberField` setea `valuemax="0"` cuando no se pasa `max`, y a11y considera inválido cualquier valor > 0 con max=0. **No visible al usuario** (el render funciona) pero es ruido para screen readers. Fix futuro: pasar `max={undefined}` o un valor sentinel grande cuando no aplique.

### Resultado del Escenario B: caja muy negativa

El modelo muestra caja final de **-$85.9M** y 11 meses negativos para el Escenario B con `base_revenue_monthly=$7.5M` (default del preset). Esto es **correcto matemáticamente** dada la curva: ingresos anualizados ~$92.7M (con seasonality) vs OpEx $126.6M + intereses $6.6M. El doc `financial-impact.md` corrigió en la sección "Datos reales" que ingresos reales 2026 son $150-180M (no los $93M del preset conservador). El usuario deberá ajustar `base_revenue_monthly` a ~$12-15M para reflejar realidad antes de tomar decisiones — pero eso es trabajo de calibración, no bug de UI.

---

## Artefactos generados

- `docs/qa-briefs/qa-financial-model-2026-05-03.png` — Screenshot Escenario B (1.9 MB)
- `docs/qa-briefs/qa-financial-model-2026-05-03-comparativo-fix.png` — Screenshot comparativo con highlight verde/rojo funcionando (771 KB)
- `docs/qa-briefs/qa-financial-model-2026-05-03.md` — Este reporte
- 7 proyecciones quedaron persistidas en DB (`financial_projections` table) durante el QA — pueden borrarse si se quieren limpiar.

---

## Recommendations

1. **Mergear el PR** — módulo funcional, fix P2 incluido, fix raíz de coerción Decimal aplicado en service, TS strict limpio (0 errores), **22/22 unit tests pasan** (4 nuevos de coerción + 18 originales).
2. **(Follow-up sugerido)** Issue cosmético para los `aria-invalid` spurios en `NumberField` cuando no se pasa `max`.
3. Antes del merge, recordar que el branch tiene cambios pre-existentes en `backend/app/services/financial_statements.py` y otros archivos backend que **no son parte de este trabajo** — hablar con el usuario si deben quedar dentro o fuera del PR.

---

## Conclusion

🟢 **PASS — Módulo listo para PR**. Todos los flujos críticos funcionan, el endpoint de proyecciones devuelve 200 con datos correctos, los 7 paneles antiguos siguen operativos, y el único bug encontrado fue un bug menor de display que ya quedó arreglado y verificado.
