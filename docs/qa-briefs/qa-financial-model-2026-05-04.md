# QA Report — Modelo Financiero (UCR)

**Date:** 2026-05-04 (Colombia)
**Mode:** `--full --module financial-model`
**Platform:** Backend `localhost:8001` + Desktop Vite `localhost:5171`
**Auth user:** samuel (superusuario)
**Tester:** qa-agent interno (Claude Code)
**Scope:** 8 endpoints `/financial-model/*`, 4 endpoints `/projections/*`, 8 sub-paneles UI + 1 ProjectionsPanel
**Branch:** `chore/stabilization-sprint-2026-Q2`
**Brief externo generado:** `docs/qa-briefs/brief-financial-model-2026-05-04.md`

---

## Summary

| Category | Total | Passed | Failed/Warning |
|----------|-------|--------|----------------|
| API smoke (auth + endpoints) | 14 | 14 | 0 |
| API deep — validación KPIs | 6 | 1 | 5 (validación laxa) |
| API deep — validación Profitability/Trends | 6 | 4 | 2 |
| API deep — validación Projections | 8 | 8 | 0 ✅ |
| API deep — auth boundaries | 4 | 4 | 0 ✅ |
| API deep — i18n errors | 2 | 1 | 1 (Pydantic en inglés) |
| UI — 8 sub-paneles cargan | 8 | 8 | 0 ✅ |
| UI — coherencia entre paneles | 5 | 1 | 4 |
| UI — console errors | 1 | 0 | 1 (intermitente) |
| Layer 8 — KPI semantics | 5 | 1 | 4 (valores centinela visibles) |
| **Total** | **59** | **42** | **17** |

**Resultado:** ⚠️ **PASA con observaciones serias** — Los componentes nuevos (Escenarios + ProjectionService) son sólidos; los **paneles antiguos arrastran bugs de cálculo de KPIs** que el módulo nunca debió heredar sin auditoría.

---

## Hallazgos por severidad

### P0 — Crítico (bloquea decisiones)

**Ninguno.** El módulo no causa pérdida de datos ni crashes. Los hallazgos altos son de **integridad de cálculo**, no de seguridad o disponibilidad.

---

### P1 — Mayor (afecta confianza en el dato)

#### P1-01 · Cash runway inconsistente entre 3 paneles del mismo módulo

| Panel | Valor reportado |
|---|---|
| Modelo Financiero → Alertas | **1.2 meses** ("Crítico") |
| Modelo Financiero → Proyección caja | **2.0 meses** ("RUNWAY") |
| Modelo Financiero → Resumen Ejecutivo | **2.0 meses** (proyección 3 meses) |
| CFO Dashboard (panel previo) | **2.3 meses** (en sesión anterior) |

Tres servicios distintos calculan runway con datos sutilmente diferentes. La dueña no sabe cuál creer. **Acción:** consolidar el cálculo en un solo helper backend (`runway_in_months()`) y consumir desde los 4 puntos.

#### P1-02 · Margen Operativo difiere 4× entre paneles por rango de tiempo no etiquetado

- KPIs (rango 6 meses): Margen Operativo = **-24.8%**
- Resumen Ejecutivo (rango 1 mes parcial — 4 días de mayo): Margen Operativo = **-90.8%**

Ambos cálculos son correctos en su rango, pero el label "Margen Operativo" sin contexto de período induce a creer que el negocio se desplomó. **Acción:** agregar etiqueta clara del período activo en cada KPI mostrado, o normalizar el rango entre los 2 paneles.

#### P1-03 · KPIs con valores centinela exhibidos como datos reales

| KPI | Valor mostrado | Causa probable | Riesgo |
|---|---|---|---|
| Liquidez Corriente | **999.00** | divide-by-zero (pasivos = $0) | Dueña cree que su liquidez es excelente, ignorando los $19M en préstamos informales no registrados |
| Prueba Ácida | **999.00** | mismo | mismo |
| Rotación de CxP | **43,971,599.99 veces/año** | activos / casi-cero AP | Imposible físicamente. Erosiona credibilidad de toda la pantalla |
| Punto de Equilibrio | **$0** | falla en el cálculo o costos fijos no incluidos | El breakeven matemáticamente NO puede ser $0 si hay costos fijos > 0 |
| ROA | **-98.8%** | numerador anualizado mal o denominador subestimado | Sugiere pérdida del 98% del valor de activos cada año, lo cual es falso |
| ROE | **0.0% (status: critical)** | equity = $0 (gap B documentado) | Síntoma del bug de equity no registrada |

**Acción:** estos KPIs deben mostrar `—` o un mensaje "datos insuficientes" cuando el divisor es 0 o cuando el cálculo cae en un edge case. Ver `Gap B` en `docs/v3/formalization/financial-model-current-state.md`.

#### P1-04 · Mensajes de error Pydantic en inglés (CLAUDE.md exige español)

```json
POST /api/v1/global/accounting/projections/run
Body: {}
→ 400
{
  "detail": [
    {"loc":["body","name"], "msg":"Field required", "type":"missing", "input":{}},
    {"loc":["body","start_year"], "msg":"Field required", "type":"missing", ...}
  ]
}
```

Los `detail` custom 404 sí están en español ("Proyección no encontrada"), pero los validation errors auto-generados por Pydantic salen en inglés. **Acción:** configurar `Pydantic` con `error_msg_templates` en español o un middleware que traduzca los códigos `missing`, `value_error`, etc.

#### P1-05 · Panel Rentabilidad muestra "Gastos $0" para todos los colegios

Ingresos y Costo se calculan correctamente por colegio, pero la columna "Gastos" siempre muestra $0. Sin embargo el dashboard de Resumen Contable muestra "Gastos Totales $102.685.468" — los gastos existen pero no se atribuyen a colegios. **Acción:** decidir política de atribución (proporcional a revenue? por categoría? sin atribución y dejar la columna fuera) y ajustar `ProfitabilityService`.

---

### P2 — Menor (UX confusa, workaround posible)

#### P2-01 · Endpoint `/kpis` acepta `period` inválido sin validación

```
GET /financial-model/kpis?period=2026-13     → 200 (silencioso, usa default)
GET /financial-model/kpis?period=invalid     → 200 (kpis=[])
GET /financial-model/kpis?period=9999-99     → 200
GET /financial-model/kpis?period=             → 200
```

El frontend no muestra que el filtro fue ignorado. **Comparación**: `/projections/run` valida estrictamente todos los inputs (months [1,36], start_month [1,12], cogs_pct [0,1], etc.) con 400 en cada caso. La inconsistencia es interna al mismo módulo. **Acción:** alinear `/kpis` con el patrón estricto de Projections.

#### P2-02 · Endpoint `/projections?scenario=` no valida enum

```
GET /projections?scenario=Z         → 200 (lista vacía silenciosa)
GET /projections?scenario=<script>  → 200 (escapado correctamente, pero acepta input basura)
```

No hay riesgo de SQLi (SQLAlchemy parametriza), pero la API acepta cualquier string. **Acción:** validar `scenario` contra enum `["A","B","C","custom"]`.

#### P2-03 · Profitability acepta rango de fechas invertido (end < start)

```
GET /profitability/by-school?start_date=2026-12-31&end_date=2026-01-01 → 200 (totales=$0)
```

**Acción:** validar `end >= start` en el query schema.

#### P2-04 · Panel Presupuesto: empty state ausente

Cuando no hay presupuestos definidos, la pantalla muestra solo el header "Presupuesto vs Real" + botón "Nuevo Presupuesto". Parece pantalla rota. **Acción:** componente empty state con copy "Aún no has definido presupuestos. Crea el primero con el botón superior."

#### P2-05 · Resumen Ejecutivo no etiqueta mes parcial

"Mayo 2026" muestra `INGRESOS $580.000 (-92.7%)` cuando van solo 4 días del mes. La dueña podría leer pánico. **Acción:** label "Mes parcial: 4 de 31 días transcurridos. Comparativo no completo."

#### P2-06 · Cobertura de Deuda = 0.45 con status `critical` cuando deuda registrada = $0

Si pasivos = $0, la cobertura de deuda no debería evaluarse (no hay deuda que cubrir). El status `critical` con valor 0.45 es contradictorio. **Acción:** condicionar evaluación a `pasivos > 0`, sino mostrar `—` con tooltip "no hay deuda registrada".

#### P2-07 · Double fetch de endpoints en dev

Cada endpoint del módulo se llama 2 veces consecutivas:
- `kpis?months=6` → reqid 648 + 649
- Otros endpoints idem

Probable React StrictMode dev. **No bug en prod** pero ineficiencia que merece quedar documentada.

---

### P3 — Cosmético (no afecta función)

- **P3-01** — Bar chart Rentabilidad trunca nombres ("Institución Edu...", "Jardín Gota De..."). Tooltip al hover debería mostrar el nombre completo.
- **P3-02** — KPI `gross_margin.value` expone Decimal con 28 dígitos (`62.56971669473154776523249204`). Wire size innecesario; el frontend formatea a `62.6%`.
- **P3-03** — `breakeven.value` = `"0E+28"` en notación científica de Decimal. Raro de leer.
- **P3-04** — Trends marca enero/febrero como anomalías z-score `pico` cuando es estacionalidad conocida del negocio escolar. Falsos positivos. Considerar awareness estacional.
- **P3-05** — Resumen Ejecutivo "+92.7%" en utilidad neta negativa: "+92.7% UTILIDAD NETA -$407.000" se lee como contradicción.
- **P3-06** — Top 3 Colegios muestra solo 2 entradas (#1 y #2) en mayo 2026. Falta el #3 con valor $0.
- **P3-07** — Polling agresivo de `/notifications/unread-count` (~2s interval). En prod genera carga innecesaria. Fuera de scope del módulo pero observable.

---

## Lo que SÍ funciona impecablemente ✅

1. **Auth + permisos** — `reports.financial` se aplica correctamente. Sin token → 403, token inválido → 401, token válido → 200.
2. **Validación de Projection /run** — rechaza con 400 todo input aberrante: `months=0`, `months=999`, `start_month=13`, `base_revenue<0`, `cogs_pct=2.5`, `cogs_pct=-0.5`, body vacío. **Mejor que el resto del módulo.**
3. **Validación de Projection list/detail** — `limit=0` y `limit=999999` rechazados con 400; UUID malformado → 400; UUID inexistente → 404 con mensaje en español.
4. **Network end-to-end** — los 8 endpoints `/financial-model/*` y los 4 `/projections/*` retornan 200 en navegación real.
5. **Sub-panel Escenarios** — cargas presets, calcula, renderiza summary cards + 3 charts + tabla mes-a-mes con flags. Verificado byte-a-byte vs suma manual del preset (ver `qa-financial-model-2026-05-03.md`).
6. **Coerción Decimal** — el frontend convierte strings Decimal del backend a numbers correctamente (cubierto por 11 unit tests del `projectionService`).
7. **Tabla mes a mes con flags** — los flags ⚠ (below_breakeven) y ✕ (cash_negative) se renderizan correctamente en cada fila.

---

## Layer 8 — Pruebas de comportamiento humano

Pónte como Consuelo (dueña, no técnica). Resultado:

| Pregunta de negocio | Respuesta del sistema | ¿Suficiente? |
|---|---|---|
| "¿Cuánto dinero tendré en 3 meses?" | Proyección caja muestra mes a mes con runway 2.0 meses | ⚠️ No deja claro si "runway 2 meses" significa "tendré $0 en 2 meses" o "puedo aguantar 2 meses sin ingresos" |
| "¿Qué pasa si me formalizo?" | Sub-panel Escenarios con presets A/B/C → calcula impacto | ✅ Sí, con buena UI |
| "¿Cuál es mi colegio más rentable?" | Panel Rentabilidad ordena por Margen $ | ⚠️ Pero "Margen %" no resta gastos, distorsiona |
| "¿Por qué cobertura de deuda dice 0.45 critical si yo no tengo deuda?" | El sistema no le dice — solo muestra el número rojo | ❌ Confunde más que ayuda |
| "¿Bajar gastos o subir ingresos primero?" | Alertas dice "Urgente: busque formas de reducir gastos o aumentar ingresos" | ❌ Genérico, no accionable |

---

## Recomendaciones priorizadas

1. **(P1) Consolidar `cash_runway` en un único helper** y consumir desde los 4 puntos del UI (CFO Dashboard, Proyección caja, Alertas, Resumen Ejecutivo).
2. **(P1) Manejar divisor cero en KPIs**: Liquidez, Prueba Ácida, Rotación CxP, ROA, ROE deben mostrar `—` con tooltip explicativo cuando el cálculo cae en edge case. Eliminar el centinela 999.
3. **(P1) Auditar fórmula del Punto de Equilibrio** — no puede dar $0 con costos fijos > 0.
4. **(P1) Atribución de gastos por colegio** o eliminar columna "Gastos" del panel Rentabilidad.
5. **(P1) Pydantic errors en español** — middleware o `error_msg_templates` global.
6. **(P2) Validación estricta en /kpis** — alinear con `/projections/run`.
7. **(P2) Empty state en panel Presupuesto** + label de período parcial en Resumen Ejecutivo.
8. **(P2) Deshabilitar evaluación de Cobertura de Deuda cuando pasivos = $0**.
9. **(P3) Limpiar precision Decimal** en wire format.
10. **(Out of scope)** Reducir polling de `/notifications/unread-count`.

---

## Comandos para reproducir hallazgos

```bash
# P1-03 — KPIs con valores centinela
TOKEN=$(curl -s -X POST http://localhost:8001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"samuel","password":"<password>"}' | jq -r '.token.access_token')

curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:8001/api/v1/global/accounting/financial-model/kpis | \
  jq '.kpis[] | select(.key | test("liquid|acid|ap_turnover|roa|breakeven"))
       | {key, formatted_value, status}'

# P2-01 — Validación laxa en /kpis
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8001/api/v1/global/accounting/financial-model/kpis?period=2026-13"
# → 200 OK con period rolling default

# P1-04 — Pydantic error en inglés
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{}' \
  http://localhost:8001/api/v1/global/accounting/projections/run | jq '.detail[0]'
# → "msg":"Field required" (en inglés)
```

---

## Brief externo

**Generado:** `docs/qa-briefs/brief-financial-model-2026-05-04.md`

Pasarlo a Claude Chrome Extension para validación blind. El brief instruye 7 tareas (~50 min total) e incluye los 10 hallazgos clave para que el validador externo confirme/descarte sin sesgo del repo.

---

## Estado del módulo

**Veredicto:** El módulo está **funcionalmente operativo** y la **arquitectura nueva (Escenarios + ProjectionService) es sólida**. Los problemas son **legacy de cálculo en los KPIs antiguos** que el equipo conocía parcialmente (gap A, B, C en `financial-model-current-state.md`). No se debe bloquear el sprint actual por esto, pero **antes de presentarle el módulo a un externo (cliente SaaS futuro o stakeholder)** se deben resolver al menos los P1-01, P1-03 y P1-05.

**Calificación profesional:** **6.5/10** (sería 8.5/10 sin los KPIs centinela; pulido visual y UX por encima del promedio del sistema).
