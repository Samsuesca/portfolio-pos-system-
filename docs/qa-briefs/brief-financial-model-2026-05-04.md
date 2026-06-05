# QA Brief — Modelo Financiero (UCR)

**Para:** Claude Chrome Extension (validador externo, blind test)
**Generado:** 2026-05-04 por qa-agent interno
**Sistema bajo prueba:** Uniformes Consuelo Ríos — `localhost:5171` (Vite dev) o `https://yourdomain.com` (prod)
**Backend:** `localhost:8001` (dev) / `https://yourdomain.com/api/v1` (prod)

---

## Contexto del producto

UCR es un sistema de gestión multi-tenant para una empresa colombiana de uniformes escolares. El **Modelo Financiero** es el módulo donde la dueña (Consuelo Ríos) y el gerente analizan la salud del negocio. Vive en `/accounting → tab "Modelo Financiero"` y agrupa **8 sub-paneles**:

1. **Indicadores** — 17 KPIs financieros (márgenes, liquidez, ROA, EBITDA, etc.)
2. **Rentabilidad** — Margen por colegio (11 colegios) + bar chart
3. **Tendencias** — 13 meses de ingresos/gastos/utilidad + detección de anomalías z-score
4. **Presupuesto** — Presupuesto vs Real
5. **Proyección caja** — Cash forecast 4 semanas + 6 meses con escenarios opt/exp/pes
6. **Escenarios** — *NUEVO 2026-05* — proyecciones multi-mes formalization-aware (presets A/B/C)
7. **Alertas** — Alertas de salud financiera (cash runway, etc.)
8. **Resumen** — Resumen ejecutivo del mes (PDF-printable)

El módulo es **crítico**: lo usa la dueña para tomar decisiones de financiación, contratación y formalización tributaria.

---

## Acceso

- **URL:** http://localhost:5171/accounting (dev) — pídele al usuario que confirme el entorno
- **Login:** el usuario te dará credenciales (no las pongas tú)
- **Ruta directa:** después de login, ir a sidebar → **Contabilidad** → tab **Modelo Financiero**

> ⚠️ Es un sistema en producción. **Modo READ-ONLY**: NO crees, edites, ni elimines presupuestos o proyecciones. Si una acción te pide confirmar, **cancela**.

---

## Tareas de testing

### Tarea 1 — Primer impresión y consistencia visual (10 min)

Recorre los 8 sub-paneles UNA vez (sin interactuar más allá de cambiar de tab). En cada uno responde:

1. ¿La pantalla se ve completa o queda blanca/rota? (especial atención a **Presupuesto** — sospecho empty state pobre).
2. ¿Los números se ven coherentes a primera vista o hay valores "raros" (999, scientific notation, negativos sin explicación)?
3. ¿Los gráficos renderizan o quedan vacíos/cortados?
4. ¿Los textos de UI están en español? ¿Algún botón o tooltip en inglés?

### Tarea 2 — Comparar runway entre paneles (5 min) — CRÍTICO

El "cash runway" (meses que dura la caja) aparece en **al menos 4 lugares**:

| Lugar | Esperado |
|---|---|
| Panel CFO Dashboard (`/cfo`) | un valor en meses |
| Tab Modelo Financiero → **Proyección caja** | "RUNWAY: X meses" |
| Tab Modelo Financiero → **Alertas** | "el efectivo durará aprox. X meses" |
| Tab Modelo Financiero → **Resumen** | "Runway estimado: X meses" |

**Anota cada valor**. Si los 4 difieren, repórtalo como **Major** (es lo que detectó el QA interno: 1.2 / 2.0 / 2.3 meses entre paneles).

### Tarea 3 — Indicadores: detectar valores centinela (5 min)

En el sub-panel **Indicadores**, busca valores que parezcan **bugs de cálculo**:

1. **Liquidez Corriente / Prueba Ácida = 999.00** — 999 suele ser un valor centinela cuando hay división por cero (pasivos = 0). Verifica que la mayoría de KPIs tienen valores razonables.
2. **Rotación de CxP = 43971599.99** — 43 millones de veces al año es físicamente imposible. Otra división por casi cero.
3. **ROA = -98.8%** — un negocio con activos $112M y EBITDA -$29M anual no debería dar -98% ROA. Cuestiona el cálculo.
4. **Punto de Equilibrio = $0** — el breakeven NUNCA puede ser $0 con costos fijos $1.1M+. Sospecha de bug.

Repórtalo así: "El KPI **X** muestra **Y**, lo cual es matemáticamente sospechoso. Sugiero verificar el divisor / contexto."

### Tarea 4 — Sub-panel Escenarios (10 min)

Este es el más nuevo. Pasos:

1. Click en sub-tab **Escenarios**.
2. Verifica que se ven **4 botones de preset**: Sin formalización (BASELINE), Escenario A, Escenario B (RECOMENDADO), Escenario C (PREMIUM).
3. Click **Escenario B**. Verifica que el formulario se actualiza:
   - Nombre cambia a "Proyección UCR — Escenario B"
   - Sección "Capa de formalización" muestra "Esc. B · 11 one-time + 5 recurrentes"
   - Sección "Deudas" muestra "2 obligaciones"
4. **Desmarca** el checkbox "Guardar proyección en historial" (importante — read-only mode).
5. Click **Calcular proyección**. Verifica:
   - Aparece spinner durante cálculo
   - Aparecen 8 summary cards
   - Aparecen 3 gráficos (Ingresos/COGS/OpEx, Caja acumulada, OpEx breakdown)
   - Aparece tabla mes-a-mes con 12 filas (Mayo 2026 → Abril 2027)
   - Algunos meses tienen flag ⚠ (bajo breakeven) y/o ✕ (caja negativa)
6. **Verifica matemática rápida**: ¿La sección "Capa de formalización" muestra **one-time $17.150.000 + recurrentes $26.902.000 = total $44.052.000**? Esos son los valores correctos del preset B.
7. Cambia a sub-tab **Escenarios guardados**. ¿Cargan las proyecciones previas? ¿Se pueden seleccionar 2-3 con checkboxes para ver un comparativo lado a lado?

### Tarea 5 — Stress de UI (5 min)

1. **Doble-click rápido en "Calcular proyección"**: ¿se previene el doble request o se corre 2 veces?
2. **Refresh (Cmd+R / F5) mid-cálculo**: ¿se preserva el resultado o se pierde?
3. **Back button del browser** desde Modelo Financiero a Resumen: ¿la app reacciona bien o queda con estado inconsistente?
4. **Cambia el zoom del browser a 50% y a 200%**: ¿el layout se mantiene legible?
5. **Resize la ventana a ancho mobile (~400px)**: ¿la app degrada elegantemente o se rompe? (es desktop primary, no se espera mobile-first, pero medir)

### Tarea 6 — Inspección del DevTools Console (3 min)

Abre DevTools del browser. En la pestaña **Console**:
- ¿Hay errores en rojo? (ignora warnings de React Router future flag, son inocuos)
- Busca específicamente: `ERR_SOCKET`, `Network request failed`, `TypeError`, `Cannot read property`

En la pestaña **Network** (filtra por `financial-model`):
- ¿Cada endpoint retorna 200?
- ¿Cuántas veces se llama cada endpoint? (sospecho double-fetch en dev)
- ¿Hay requests duplicadas innecesariamente?

### Tarea 7 — Layer 8 (10 min)

Pónte en el rol de **Consuelo Ríos** (no técnica, dueña del negocio). Sin instrucciones, intenta usar el módulo para responder estas preguntas:

| Pregunta de negocio | ¿La UI te lo responde claramente? |
|---|---|
| "¿Cuánto dinero voy a tener en 3 meses si sigo igual?" | |
| "¿Qué pasa si me formalizo? ¿Pierdo o gano plata?" | |
| "¿Cuál es mi colegio más rentable?" | |
| "¿Por qué me dice que no puedo cubrir mi deuda si yo sé que sí?" | |
| "¿Qué hago primero — bajar gastos o subir ingresos?" | |

Para cada pregunta: anota **dónde la encontraste**, **cuántos clicks tomó**, **qué tan clara fue la respuesta**.

---

## Formato de reporte que esperamos

Para cada hallazgo:

```markdown
### [Severidad] Título corto

**Dónde:** Tab > Sub-panel
**Pasos:**
1. ...
2. ...
**Esperado:** ...
**Actual:** ...
**Screenshot:** [adjunta si puedes]
**Severidad:** Critical / Major / Minor / Cosmetic
```

Severidades:
- **Critical** — bloquea uso, dato incorrecto que afecta decisiones, crash
- **Major** — flujo importante roto, KPI inconsistente entre paneles, mensaje en inglés
- **Minor** — UX confusa pero workaround existe
- **Cosmetic** — alineación, copy, padding

Al final del reporte, da una **calificación 1–10** del módulo y una recomendación: ¿es seguro que la dueña tome decisiones financieras con esto? ¿Qué deberían arreglar primero?

---

## Hallazgos del QA interno (para que verifiques o descartes)

El QA interno (Claude Code con acceso al repo) ya encontró estos. Tu rol es **confirmar independientemente** o demostrar que NO ocurren en tu sesión:

1. **P1** — Cash runway tiene 3 valores distintos en 3 paneles del mismo módulo (1.2 / 2.0 / 2.3 meses)
2. **P1** — Margen Operativo difiere 4× entre KPIs (-24.8%) y Resumen Ejecutivo (-90.8%) por rangos de tiempo distintos sin label claro
3. **P1** — Liquidez Corriente y Prueba Ácida = 999.00 (probable divide-by-zero capped)
4. **P1** — Rotación de CxP = 43.971.599,99 (otro overflow)
5. **P1** — Punto de Equilibrio = $0 (imposible con costos fijos > 0)
6. **P2** — `period=2026-13` (mes inválido) en KPI endpoint retorna 200 con default silencioso (validación laxa)
7. **P2** — Pydantic 422 errors en inglés ("Field required") — CLAUDE.md exige español
8. **P2** — Empty state ausente en panel Presupuesto (queda blank cuando no hay budgets)
9. **P2** — Panel Rentabilidad muestra "Gastos $0" para todos los colegios (bug de cálculo o feature ausente)
10. **P3** — Resumen Ejecutivo no aclara que "Mayo 2026" son solo 4 días del mes (genera pánico al ver -92.7%)

Si confirmas alguno, marca "Reproduzco". Si no se reproduce en tu sesión, marca "No reproduce" y describe lo que ves en su lugar.

---

**Buena cacería.** Reporta todo, incluso lo que parezca trivial. Las pequeñas inconsistencias en un panel financiero erosionan la confianza en el sistema completo.
