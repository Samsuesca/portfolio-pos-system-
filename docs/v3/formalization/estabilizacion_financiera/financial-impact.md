# Impacto Financiero de la Formalización

> **Última actualización:** 2026-05-02
> **Estado:** Modelo inicial — pendiente validar con contador
> **Conecta con:** [docs/v3-branch-architecture/financial-model-design.md](../v3-branch-architecture/financial-model-design.md) — `ProjectionService.assumptions`

---

## Resumen ejecutivo

Este documento cuantifica el costo total de formalizar UCR en tres escenarios, con desglose mensual para 12 meses. Sirve como input para el modelo financiero existente (`docs/v3-branch-architecture/financial-model-design.md`) y como insumo para decisiones de caja (¿necesitamos financiamiento? ¿podemos ir más rápido o más despacio?).

**Cifras top-line (Escenario B — Formalización Completa, 12 meses):**

| Concepto | Año 1 |
|----------|-------|
| Costos one-time (constitución, asesores, regularización) | ~$10M – $15M |
| Costos recurring (contador, FE, aportes, nómina electrónica) | ~$22M – $32M |
| **Total año 1** | **~$32M – $47M COP** |
| Comparado con ingresos proyectados 2026 ($150M-$180M, ventas + encargos + arreglos) | **18% – 31%** |

> **Corrección 2026-05-02:** ingresos reales 2026 son ~$150-180M COP (no $85M como estimé inicialmente). UCR factura por 3 fuentes — ventas mostrador, encargos personalizados, arreglos. Encargos representan 27% y arreglos 4% del ingreso. Esto **convierte el Escenario B en perfectamente viable sin necesidad de financiamiento puente**.
>
> **Año 2+ será ~15%-20% del ingreso** (recurring puro sin one-time).

---

## Catálogo de costos identificados

### One-time (pagos únicos)

| Item | Categoría | Estimado mín | Estimado máx | Cuándo |
|------|-----------|--------------|--------------|--------|
| Asesoría legal redacción estatutos SAS | Legal | $500k | $1.5M | Mes 1-2 |
| Constitución SAS en CC Medellín | Legal | $700k | $1.2M | Mes 2 |
| Notarización + impuesto registro | Legal | $300k | $600k | Mes 2 |
| Asesor laboral diagnóstico inicial | Laboral | $1.0M | $3.0M | Mes 1 |
| Contador público - arranque y reconstrucción contable | Contable | $1.0M | $3.0M | Mes 1-2 |
| Consultor tributario - regularización DIAN 2025-2026 | Tributario | $500k | $1.5M | Mes 1-2 |
| Sanciones DIAN regularización (Art. 640 reducción 50%) | Tributario | $1.5M | $3.0M | Mes 2-3 |
| Pasivo laboral regularización (negociado, no auditoría) | Laboral | $3.0M | $10.0M | Mes 3-6 (escalonado) |
| Setup proveedor FE DIAN (Alegra/Siigo/Factus) | Tributario | $0 | $300k | Mes 2 |
| Resolución numeración DIAN | Tributario | $0 | $0 | Mes 2 |
| Desarrollo integración FE con UCR | Tecnológico | (interno) | (interno) | Mes 2-3 |
| Política contable + libros oficiales 2025 | Contable | Incluido contador | — | Mes 2-3 |
| **TOTAL ONE-TIME** | | **$8.5M** | **$24.1M** | |

### Recurring (mensual / anual)

| Item | Categoría | Mín mensual | Máx mensual | Mín anual | Máx anual |
|------|-----------|-------------|-------------|-----------|-----------|
| Contador público externo (revisión mensual + cierre anual prorrateado) | Contable | $400k | $700k | $4.8M | $8.4M |
| Proveedor facturación electrónica DIAN | Tributario | $50k | $200k | $600k | $2.4M |
| Proveedor nómina electrónica DIAN | Laboral | $30k | $80k | $360k | $960k |
| Aportes patronales SS - 5 trabajadores formalizados (estimado SMMLV) | Laboral | $1.6M | $2.6M | $19.2M | $31.2M |
| ARL solamente (si se afilia parcialmente como F1) | Laboral | $36k | $36k | $432k | $432k |
| Asesor laboral mensual | Laboral | $0 | $500k | $0 | $6.0M |
| Software contable adicional (si requerido) | Contable | $0 | $300k | $0 | $3.6M |
| Renovación CC anual | Legal | — | — | $300k | $800k |
| **TOTAL RECURRING — formalización completa** | | **~$2.1M** | **~$4.4M** | **~$25M** | **~$53M** |

> **Aclaración crítica:** los aportes patronales NO son un costo nuevo del negocio — son obligaciones que ya existían y se eludían. Su pago formaliza una operación ya existente. La pregunta correcta no es "¿cuánto más vamos a pagar?" sino "¿cuánta exposición a sanciones eliminamos?".

---

## Tres Escenarios

### Escenario A — Mínimo Viable Legal (lo barato y suficiente)

**Objetivo:** cubrir riesgos críticos sin sobrecostos. Operación informal de facto pero con seguros básicos puestos.

**Acciones incluidas:**
- ✅ ARL para los 5 (riesgo de accidente cubierto).
- ✅ Felipe, Salomé, Santiago se afilian a EPS+AFP como **independientes** (UCR les da el dinero como "auxilio de afiliación").
- ✅ Contador freelance básico ($200k/mes) + cierre anual ($1M).
- ✅ FE proveedor económico (Factus ~$50k/mes) + integración con UCR.
- ✅ Regularización DIAN (declaraciones SIMPLE 2025-2026 con beneficio Art. 640).
- ❌ Sin SAS (sigue PN).
- ❌ Sin contratos laborales formales.
- ❌ Sin nómina electrónica.

**Cuándo aplica:** si el modelo financiero indica que NO hay caja para formalización completa este año, pero quieres dormir tranquilo.

**Costo total año 1:** **~$10M – $14M COP**.

**Riesgos residuales:**
- UGPP puede iniciar revisión de oficio (riesgo medio-bajo si los pagos se hacen vía auxilios).
- B2B sigue bloqueado (no SAS, sin EEFF firmados, sin paz y salvo parafiscales completo).
- v3.2 SaaS: imposible vender desde PN.

---

### Escenario B — Formalización Completa (recomendado)

**Objetivo:** quedar 100% formal antes de v3.1 (junio 2026), preparado para B2B y v3.2.

**Acciones incluidas:**
- ✅ Constitución SAS antes de junio 2026.
- ✅ Contador externo ($500k/mes + cierre anual $2M).
- ✅ FE DIAN con proveedor robusto (Siigo o Alegra ~$120k/mes).
- ✅ Nómina electrónica DIAN ($60k/mes).
- ✅ 5 trabajadores formalizados con contratos en SAS (salario + 40% auxilios).
- ✅ SG-SST básico (gratis con ARL, tiempo invertido).
- ✅ Política contable, libros oficiales, EEFF firmados anualmente.
- ✅ Regularización DIAN + UGPP voluntaria.

**Cuándo aplica:** si el modelo indica que SÍ hay caja (o si se consigue financiamiento puente).

**Costo total año 1:** **~$32M – $47M COP**.
**Costo año 2 (recurring puro):** **~$25M – $32M COP**.

**Beneficios:**
- B2B desbloqueado.
- v3.2 SaaS viable (ya hay SAS y EEFF para vender).
- Cero exposición a sanciones acumuladas.
- Apertura segunda sucursal arranca limpia.

---

### Escenario C — B2B Ready Premium (acelerado)

**Objetivo:** además de B, conseguir certificaciones y posicionamiento para licitaciones públicas/privadas.

**Acciones adicionales sobre B:**
- ✅ Registro RUP (si quieres vender al Estado).
- ✅ Certificación BASC o ISO 9001 (calidad para clientes corporativos exigentes).
- ✅ Asesor comercial B2B + diseño de propuestas formales.
- ✅ Web portal con T&C profesionales + marca registrada.
- ✅ Contador full-time externo ($800k/mes).
- ✅ Equipo legal de cabecera (~$500k retainer mensual).
- ✅ Marca registrada en Superintendencia.

**Cuándo aplica:** si el modelo financiero proyecta venta B2B significativa en 2026-2027 (licitaciones, clientes corporativos grandes).

**Costo total año 1:** **~$50M – $80M COP**.

---

## Cash Flow mensual — Escenario B (recomendado)

> Asumiendo mes 1 = mayo 2026.

| Mes | Concepto | One-time | Recurring | Total mes |
|-----|----------|----------|-----------|-----------|
| M1 (may) | Contador inicial + asesor laboral + diagnóstico tributario | $3.0M | $0.5M (ARL ya) | **$3.5M** |
| M2 (jun) | SAS constitución + FE setup + regularización DIAN sanciones | $5.0M | $1.0M | **$6.0M** |
| M3 (jul) | Pasivo laboral regularización tramo 1 + integración FE | $2.0M | $1.5M | **$3.5M** |
| M4 (ago) | Contratos formales SAS + nómina electrónica setup | $1.0M | $2.5M (aportes formales arrancan) | **$3.5M** |
| M5 (sep) | Pasivo laboral regularización tramo 2 | $2.0M | $2.5M | **$4.5M** |
| M6 (oct) | — | $0 | $2.5M | **$2.5M** |
| M7 (nov) | Pasivo laboral regularización tramo 3 (final) | $2.0M | $2.5M | **$4.5M** |
| M8 (dic) | Cierre contable anual (extra) | $1.5M | $2.5M | **$4.0M** |
| M9 (ene) | — | $0 | $2.5M | **$2.5M** |
| M10 (feb) | — | $0 | $2.5M | **$2.5M** |
| M11 (mar) | Renovación CC | $0.5M | $2.5M | **$3.0M** |
| M12 (abr) | — | $0 | $2.5M | **$2.5M** |
| **TOTAL** | | **$17.0M** | **$24.5M** | **$41.5M** |

> Esta es la versión "todo se hace" en escenario B. El monto total ($41.5M) está dentro del rango estimado $32M-$47M.

---

## Estacionalidad y disponibilidad de caja

UCR tiene fuerte estacionalidad escolar (enero-febrero pico, mayo-junio bajo, julio-agosto medio-alto). Cruzando con el cash flow de formalización:

```
Mes    Ingresos UCR (estim)    Costos formalización    Caja neta formalización
M1 may $4.5M (bajo)             $3.5M                   +$1.0M
M2 jun $5.0M (bajo)             $6.0M                   -$1.0M ⚠ déficit
M3 jul $9.0M (medio)            $3.5M                   +$5.5M
M4 ago $7.0M (medio)            $3.5M                   +$3.5M
M5 sep $5.0M (bajo)             $4.5M                   +$0.5M
M6 oct $5.5M (bajo)             $2.5M                   +$3.0M
M7 nov $5.0M (bajo)             $4.5M                   +$0.5M
M8 dic $7.0M (medio)            $4.0M                   +$3.0M
M9 ene $18M (PICO)              $2.5M                   +$15.5M
M10feb $15M (PICO)              $2.5M                   +$12.5M
M11mar $7.0M (medio-pos pico)   $3.0M                   +$4.0M
M12abr $4.5M (bajo)             $2.5M                   +$2.0M
```

**Hallazgo crítico:** el mes de **junio 2026** muestra déficit (~$1M) si todo se ejecuta en cronograma agresivo. Soluciones:
- **A:** Aplazar constitución SAS a julio (post-pico mid-year).
- **B:** Anticipar parte del cash en enero 2026 (pico) usando reservas.
- **C:** Línea de crédito puente $5M (cubre junio + colchón).

---

## Schema JSON para `ProjectionService.assumptions` existente

Este schema se enchufa directo en `docs/v3-branch-architecture/financial-model-design.md` sección "Modelo de Proyeccion: Inputs Especificos UCR".

```json
{
  "formalization_layer": {
    "scenario": "B",
    "start_month": 5,
    "start_year": 2026,
    "one_time_costs": [
      {"month": 1, "concept": "asesor_legal_sas", "amount_min": 500000, "amount_max": 1500000},
      {"month": 1, "concept": "contador_arranque", "amount_min": 1000000, "amount_max": 3000000},
      {"month": 1, "concept": "asesor_laboral_dx", "amount_min": 1000000, "amount_max": 3000000},
      {"month": 2, "concept": "constitucion_sas", "amount_min": 700000, "amount_max": 1200000},
      {"month": 2, "concept": "regularizacion_dian", "amount_min": 1500000, "amount_max": 3000000},
      {"month": 2, "concept": "fe_setup", "amount_min": 0, "amount_max": 300000},
      {"month": 3, "concept": "pasivo_laboral_t1", "amount_min": 1000000, "amount_max": 3500000},
      {"month": 5, "concept": "pasivo_laboral_t2", "amount_min": 1000000, "amount_max": 3500000},
      {"month": 7, "concept": "pasivo_laboral_t3", "amount_min": 1000000, "amount_max": 3000000},
      {"month": 8, "concept": "cierre_contable_anual", "amount_min": 1000000, "amount_max": 2500000},
      {"month": 11, "concept": "renovacion_cc", "amount_min": 300000, "amount_max": 800000}
    ],
    "recurring_costs_monthly": [
      {"concept": "contador_externo", "amount_min": 400000, "amount_max": 700000, "starts_month": 1},
      {"concept": "fe_dian", "amount_min": 50000, "amount_max": 200000, "starts_month": 2},
      {"concept": "nomina_electronica", "amount_min": 30000, "amount_max": 80000, "starts_month": 4},
      {"concept": "arl_5_personas", "amount_min": 36000, "amount_max": 36000, "starts_month": 1},
      {"concept": "aportes_patronales_3_empleados", "amount_min": 1500000, "amount_max": 2500000, "starts_month": 4}
    ]
  }
}
```

Para integrar en `ProjectionService.calculate_projections()`:
- Añadir `formalization_layer` en `assumptions`.
- En el loop por mes, sumar one-time del mes (si aplica) + recurring activo (si starts_month <= mes actual).
- Reflejar en output como `monthly.formalization_cost` (nueva categoría OpEx).

---

## Datos reales recolectados (2026-05-02)

### Confirmados por el owner

| Dato | Valor confirmado |
|------|------------------|
| Salarios actuales de los 4 trabajadores | SMMLV ($1.4M/mes c/u, asumido 2026) |
| Arriendo local actual | $800.000/mes |
| Servicios públicos | $200.000/mes |
| Internet | $100.000/mes |
| **Total fixed cost local actual** | **$1.100.000/mes** |
| Cotización B2B en curso | Restaurante, ~$9.000.000 (primer contrato del pilar B2B) |
| Esquema de retiro de utilidades | **NO EXISTE** — finanzas mezcladas con personal |

> **Nota estratégica (2026-05-22): el B2B no es un contrato suelto, es un pilar de ingresos.** El contrato del restaurante (~$9M) es el primero de la línea **B2B contractual** (uniformes empresariales, dotación legal, equipos, eventos, institucional) que UCR está formalizando como **tercer pilar de crecimiento** y como **el flujo real de caja mes a mes** que rompe la estacionalidad escolar. El modelo financiero debe proyectarlo como **stream separado y contracalendario** (no multiplicado por la estacionalidad escolar). Modelo de negocio y schema de `ProjectionService.assumptions.b2b_pipeline` en [`v3/v3-branch-architecture/b2b-contracts-model.md`](../v3-branch-architecture/b2b-contracts-model.md).

### Verificados directamente en DB del sistema (2026-05-02, prod_snapshot fresh)

> Calculado con la lógica de `PatrimonyService.get_global_patrimony_summary` (la del sistema), no con SQL ingenuo.

| Concepto | Sistema (cruda) | **Ajustada (post-correcciones)** |
|----------|----------------|-----------------------------------|
| Cash & Bank consolidado | $12.08M | $12.08M |
| Inventario valuado | $49.20M | ~$35-40M (sobreestimado por margin fallback) |
| Cuentas por cobrar | $11.10M | ~$5-7M (migración v3 corregirá) |
| Activos fijos (net_value) | $17.13M | $17.13M |
| Activos intangibles | $0 | $0 |
| **Total activos** | $89.52M | **~$70-77M** |
| Pasivos antiguos `is_active=false` | excluidos | confirmados pagados (Caso 1) ✅ |
| **Pasivos nuevos no registrados** | $0 | **$19.0M** (2 préstamos informales) |
| **Patrimonio neto** | $89.52M | **~$51-58M COP** ✅ positivo |
| Gastos personales mezclados YTD 2026 | $4.92M | sin cambio (4.9% del gasto total) |

### Costo financiero adicional confirmado (no estaba en el modelo)

| Préstamo | Capital | Interés mes | **Tasa anual** |
|----------|---------|-------------|----------------|
| Préstamo 1 | $12M | $300k | ~34.5% E.A. |
| Préstamo 2 | $7M | $250k | ~52.4% E.A. (usura) |
| **Total carga financiera mensual** | $19M | **$550k/mes = $6.6M/año** | promedio ~40% E.A. |

**Esto se debe sumar al Cash Flow mensual del Escenario B como egreso fijo.**

### Oportunidad estratégica: Refinanciamiento post-SAS

| Variable | Hoy | Post-SAS |
|----------|-----|----------|
| Tasa promedio | ~40% E.A. | ~18% E.A. (línea bancaria PYME) |
| Costo financiero anual sobre $19M | $6.6M | $3.4M |
| **Ahorro anual** | — | **$4.2M COP** |
| Ahorro 24 meses | — | **$8.4M COP** |

Esto solo cubre **25-50% del costo total** de Escenario B. Es decir: la formalización **se autofinancia** en buena parte por los ahorros de refinanciar la deuda informal.

### Implicación para el modelo financiero

- **Patrimonio neto ajustado ~$51-58M positivo** → formalización Escenario B es perfectamente financiable.
- **Migración v3 en marcha** corrige inventario y AR → balance final más conservador y defensible.
- **Margen real es mayor** que lo que muestra el P&L cuando faltan costos → utilidad bruta proyectada mayor.
- **Refinanciamiento bancario post-SAS** es una palanca financiera grande, debe entrar como hito explícito del roadmap.

### Pendientes (impactan ajustes finos al modelo)

1. Costo proyectado del segundo local (arriendo, garantías, adecuación).
2. Validación de la curva mensual de ventas 2026 vs estacionalidad asumida arriba.

---

## Costos adicionales descubiertos en este ejercicio

Tras revisar la DB, surgen costos no contemplados en el modelo inicial:

| Concepto | Estimado | Razón |
|----------|----------|-------|
| Reclasificación contable histórica (gastos personales 2025-2026) | $1M – $2M | Trabajo forensic del contador |
| Identificación y documentación de préstamos (negocio vs personal) | $500k – $1M | Reclasificación de pasivos |
| Apertura cuenta bancaria del negocio | $0 (saldo mínimo $50k–$200k) | Davivienda, Bancolombia, otros |
| Migración Wompi a nueva cuenta | Tiempo dev (1-2h) | Configuración |

**Impacto en escenario B:** sumar ~$2M-$3M one-time al rango original. Nuevo total año 1: **~$34M – $50M COP**.

---

## Próximos pasos recomendados

1. **Validar con contador real** los números de regularización DIAN y aportes UGPP (hay margen de error).
2. **Cotizar 2-3 contadores externos** para tener cifra real (~$300k vs ~$700k es 2.3x).
3. **Cotizar 2-3 proveedores FE DIAN** (Factus vs Alegra vs Siigo).
4. **Definir cuál escenario aplica** (A, B, o C) según caja disponible y apetito de riesgo.
5. **Conectar con `ProjectionService`** del modelo financiero v3 existente para correr proyección integrada.

---

## Observaciones para el cfo-strategist agent

Si se decide invocar al `cfo-strategist` agent para análisis profundo:
- Este documento es el input cuantificado de costos.
- El modelo financiero `docs/v3-branch-architecture/financial-model-design.md` es la arquitectura.
- La data histórica de ventas 2020-2026 está en el sistema (790 ventas en 2026 parcial).
- El roadmap técnico v3.0 → v3.2 condiciona los hitos.
- Output esperado: Excel con 12-24 meses de proyección integrada (ingresos × estacionalidad × formalización × expansión) en 3 escenarios.
