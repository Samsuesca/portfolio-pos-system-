# Dimensión 3 — Contable

> **Última actualización:** 2026-05-02
> **Owner:** Angel Suesca + (pendiente) Contador público colegiado
> **Criticidad global:** 🔴 ALTA
> **% Formalización estimado:** 15%

---

## Resumen ejecutivo

UCR está clasificado como **Grupo NIIF 2 (PYMES)** según certificado de Cámara de Comercio de Medellín 2025. Esto genera obligaciones contables formales que **son independientes del régimen tributario** y aplican simplemente por ser comerciante inscrito.

El sistema técnico actual (UCR v2.9.0) tiene módulos contables parciales (`balance_accounts`, `balance_entries`, `expenses`, `accounts_receivable`, `accounts_payable`) pero **no produce estados financieros bajo NIIF para PYMES** ni los libros oficiales completos exigidos por el Código de Comercio.

---

## Marco normativo aplicable

| Norma | Aplicación |
|-------|------------|
| Código de Comercio Art. 19, 48, 49 | Obligación de llevar contabilidad regular para todo comerciante inscrito |
| Decreto Único 2420 de 2015 | Marco técnico contable colombiano |
| Decreto 2420/2015 Anexo 2 | NIIF para PYMES (Grupo 2) — aplicable a UCR |
| Resolución 1607 de 2018 (Supersociedades) | Requisitos mínimos de revelación |
| Art. 654 ET | Sanción por irregularidades en libros y soportes |
| Art. 655 ET | Sanción por no llevar libros |

---

## Estado actual

### Clasificación
- **Grupo NIIF 2 (PYMES).**
- Persona Natural comerciante inscrita en CC Medellín 2025.
- **Obligado** a llevar contabilidad regular bajo NIIF para PYMES.

### Hallazgos de la base de datos (2026-05-02, prod_snapshot fresh)

> Análisis usando la lógica de `app/services/patrimony.py::PatrimonyService.get_global_patrimony_summary()` que es la fuente de verdad del sistema. Mi cálculo inicial fue incompleto (omitía inventario, AR, AP, pending expenses).

**Balance General según lógica del sistema:**

| Concepto | Valor |
|----------|-------|
| **ACTIVOS** | |
| Cash & Bank (Caja Mayor + Menor + Banco + Nequi) | $12.08M |
| Inventario valuado (qty × COALESCE(cost, price × 0.80)) | **$49.20M** |
| Cuentas por cobrar (no pagadas) | $11.10M |
| Activos fijos (máquinas costura, computador, equipos — net_value) | $17.13M |
| Activos intangibles | $0 |
| **Total activos** | **$89.52M** |
| **PASIVOS (solo `is_active = true`)** | |
| Cuentas por pagar | $0 |
| Gastos pendientes | $0 |
| Deudas (préstamos + TC) | $0 (todas marcadas inactivas) |
| **Total pasivos** | **$0** |
| **PATRIMONIO NETO** | **+$89.52M COP** ✅ |

### Pasivos inactivos confirmados como pagados (Caso 1)

| Cuenta | Balance | Estado |
|--------|---------|--------|
| Prestamo Cristina | $39.00M | **PAGADA** |
| Préstamo (×3) | $10/10/7M | **PAGADAS** |
| Prestamo (×4) | $3/3/3/2M | **PAGADAS** |
| Tarjeta de Credito Computador | $0.89M | **PAGADA** |
| **Total histórico saldado** | **$77.89M** | |

Confirmado por owner 2026-05-02: las 9 cuentas con `is_active = false` corresponden a deudas ya saldadas y archivadas históricamente. Buena trayectoria de pago.

### Pasivos NUEVOS no registrados en el sistema

> **Hallazgo 2026-05-02:** existen 2 préstamos vigentes que aún no están en `balance_accounts`. Riesgo de balance contable subreportado.

| Préstamo | Capital | Interés mensual | **Tasa efectiva anual** | Característica |
|----------|---------|-----------------|--------------------------|----------------|
| Préstamo 1 | $12.000.000 | $300.000 | **~34.5% E.A.** | Cerca del límite usura |
| Préstamo 2 | $7.000.000 | $250.000 | **~52.4% E.A.** ⚠️ | **Usura** (>1.5× IBC ~26-28%) |
| **Total** | **$19.000.000** | **$550.000/mes** | **~40% E.A. promedio** | Prestamistas informales |

**Costo financiero anual: $6.6M COP** = ~4% del ingreso anual proyectado.

**Acción urgente:**
1. Registrar ambos préstamos en `balance_accounts` con `account_type = LIABILITY_LONG` (o CURRENT según plazo) e `is_active = true`.
2. Documentar contratos / pagarés de respaldo. Si no hay contrato escrito, redactar uno con prestamista para defensa ante DIAN.
3. Crear `expense_category = "intereses_financieros"` y registrar pagos mensuales como gasto deducible.

### Oportunidad estratégica: Refinanciamiento bancario post-SAS

Esto es **uno de los wins más grandes de toda la formalización**:

**Hoy** — $19M financiado al ~40% E.A. promedio = $6.6M/año en intereses.

**Tras SAS + 12 meses operación documentada** (EEFF firmados, CC al día, parafiscales al día):
- Acceso a línea de capital de trabajo bancaria PYME: ~15-22% E.A.
- Tasa típica para SAS PYME consolidada: ~18% E.A.

**Ahorro proyectado:**
- Diferencia 22 puntos sobre $19M = **$4.2M/año de ahorro**.
- Durante 2 años: $8.4M, equivalente a ~25-50% del costo total de formalización Escenario B.

**Recomendación:** incluir en el `ROADMAP.md` integrado como hito **F-7 (Q4 2026)**: "Refinanciar préstamos informales con línea bancaria post-SAS".

### Patrimonio neto recalculado (con ajustes)

Tras ajustes de:
- Inventario sobreestimado (sistema usa `price × 0.80` cuando falta cost real, pero margen real es mejor → cost real menor → inventario menor).
- Cuentas por cobrar sobreestimadas (migración v3 depurará incobrables / duplicados).
- Pasivos nuevos no registrados ($19M).

| Concepto | Sistema | Ajustado |
|----------|---------|----------|
| Cash & Bank | $12.08M | $12.08M |
| Inventario | $49.20M | ~$35-40M |
| Cuentas por cobrar | $11.10M | ~$5-7M |
| Activos fijos | $17.13M | $17.13M |
| **Total activos** | $89.52M | **~$70-77M** |
| Pasivos vigentes (nuevos préstamos) | $0 | $19.0M |
| **Patrimonio neto ajustado** | $89.52M | **~$51-58M COP** ✅ |

**Sigue muy positivo.** La formalización Escenario B ($32-47M año 1) es perfectamente financiable. Las migraciones v3 que ya están en marcha resolverán la sobreestimación de inventario y AR, dejando un balance más conservador y defensible.

### Margen real subestimado (lectura positiva del sistema)

Cuando un producto no tiene `cost` capturado, el sistema asume `cost = price × 0.80` (margen 20%). Si el margen real del negocio es mayor (típico en confección custom: 35-45%), esto significa:

- **Cost real es menor** → inventario reportado está sobreestimado.
- **Pero por la misma razón, la utilidad bruta por venta es mayor** de lo que muestra el P&L del sistema.

**Implicación para el modelo financiero:** una vez termine la migración v3 con costos reales capturados (ya en marcha por el owner), los EEFF mostrarán:
- Balance más conservador (inventario menor).
- P&L con utilidad bruta mayor.
- Mejor narrativa para DIAN, B2B y compradores SaaS.

### Inventario es el activo más grande ($49.2M, 55% del total)

Lógico para retail de uniformes con stock por colegio × tallas. **Pero:**
- El sistema valúa `quantity × COALESCE(product.cost, product.price × 0.80)`.
- Si muchos productos no tienen `cost` capturado, se usa 80% del precio como proxy → puede sobreestimar.
- Para EEFF NIIF defensibles: capturar `cost` real de TODOS los productos es prerequisito.

### Mezcla de finanzas personales / negocio (CRÍTICO)

Análisis de `expenses` 2026 detectó categorías y descripciones inequívocamente personales registradas como gastos del negocio:

| Categoría | Movimientos | Total 2026 (al 2 may) | Tipo |
|-----------|-------------|------------------------|------|
| `mercado` | 60+ | $2.92M | Personal (alimentación hogar) |
| `ocio` | 35+ | $1.65M | Personal (entretenimiento) |
| `viaticos` | 5 | $0.21M | Mixto (probablemente personal) |
| `comida` | 3 | $0.06M | Personal |
| **Total claramente personal** | **100+** | **$4.92M (4.9% del gasto total)** | |

Descripciones literales encontradas:
- "papel blanqueador toallas"
- "varios, aseo, cosas de casa"
- "D1 queso jamon arroz"
- "carne del perro"
- "pollo y bagett"
- "pan y quesito podrido"

**Implicaciones:**
- **DIAN auditoría:** estos gastos se rechazarían como deducibles, aumentando renta gravable.
- **NIIF imposibilidad:** EEFF no son confiables sin reclasificación.
- **SAS futura imposible** sin separación previa. Una SAS exige cuenta bancaria propia y separación contable estricta.
- **Crédito bancario:** posible si se aclara estado de pasivos inactivos.
- **B2B / Licitaciones:** viable con balance reclasificado limpio.

**Mezcla finanzas personales / negocio (CRÍTICO):**

Análisis de `expenses` 2026 detectó categorías y descripciones inequívocamente personales registradas como gastos del negocio:

| Categoría | Movimientos | Total 2026 | Tipo |
|-----------|-------------|------------|------|
| `mercado` | 54 | $2.69M | Personal (alimentación hogar) |
| `ocio` | 33 | $1.55M | Personal (entretenimiento) |
| `viaticos` | 5 | $0.21M | Mixto (probablemente personal) |
| `comida` | 3 | $0.06M | Personal |
| **Total claramente personal** | **95** | **$4.51M** | **4.7% del total gasto** |

Descripciones literales encontradas que confirman:
- "papel blanqueador toallas"
- "varios, aseo, cosas de casa"
- "D1 queso jamon arroz"
- "carne del perro"
- "pollo y bagett"
- "pan y quesito podrido"

**Implicaciones:**
- **DIAN auditoría:** estos gastos se rechazarían como deducibles, aumentando renta gravable.
- **NIIF imposibilidad:** EEFF no son confiables sin reclasificación.
- **SAS futura imposible** sin separación previa. Una SAS exige cuenta bancaria propia y separación contable estricta.
- **Crédito bancario inviable:** patrimonio negativo + mezcla = rechazo automático.
- **B2B / Licitaciones:** no calificas con balance actual.

### Contabilidad real
- No hay libros oficiales formales (Diario, Mayor y Balances, Inventarios y Balances).
- No hay estados financieros NIIF firmados por contador público.
- No hay política contable documentada.
- No hay plan único de cuentas (PUC) adaptado a NIIF para PYMES.
- No hay contador público colegiado vinculado al negocio.

### Sistema UCR (módulos disponibles)

Lo que ya existe en el código:
- `balance_accounts` (cuentas contables tipo Caja, Banco, etc. con `account_type` enum minúsculas).
- `balance_entries` (movimientos contra cuentas).
- `expenses` (gastos con vendor, categoría, monto).
- `accounts_receivable` y `accounts_payable` (CxC, CxP).
- `transactions` (transacciones generales).
- `daily_cash_registers` (cierre de caja diario).
- `payment_transactions` (pagos Wompi).
- `cost_components` y unit_cost snapshots.
- Estados financieros parciales en `services/financial_statements.py`.

Lo que **NO existe**:
- Generación de **Balance General NIIF** completo.
- **Estado de Resultados** con clasificación NIIF (ingresos ordinarios, costo de ventas, gastos administración, gastos ventas, otros ingresos/gastos, resultado integral).
- **Estado de Cambios en el Patrimonio**.
- **Estado de Flujos de Efectivo** (método directo o indirecto).
- **Notas a los estados financieros** (estructura mínima 30+ notas según NIIF para PYMES).
- **Libro Diario y Mayor oficiales** exportables.
- **Conciliación bancaria** automatizada (recibo del extracto y match con balance_entries).
- **Kardex valuado** con método PEPS o promedio ponderado (NIIF para PYMES sección 13).
- **Política contable** documentada y aprobada.

---

## Gaps identificados

### Gap 3.0 — Mezcla de finanzas personales con negocio 🔴

**Marco:**
- Código de Comercio Art. 49: "el comerciante debe conformar su contabilidad, libros, registros contables, inventarios y estados financieros en general, a las disposiciones de este Código y demás normas".
- NIIF para PYMES sección 2: principio de **entidad económica** — la información financiera debe presentar a la entidad como independiente del propietario.
- Art. 107 ET: solo son deducibles los gastos con **relación de causalidad, necesidad y proporcionalidad** con la renta. Gastos personales NO son deducibles.

**Estado actual (verificado en DB):**
- $4.51M en gastos 2026 (4.7%) son inequívocamente personales (mercado, ocio, comida hogar).
- Balance General presenta patrimonio negativo $-47.5M por mezcla con préstamos personales.
- No hay cuenta bancaria a nombre del negocio (UCR opera sobre cuenta personal de Consuelo Ríos).
- Wompi probablemente abona en cuenta personal de CR.

**Acción crítica (prerequisito de todo):**

1. **Abrir cuenta bancaria a nombre del negocio.**
   - Como PN: cuenta a nombre de Consuelo Ríos identificada como "establecimiento de comercio UCR" (Banco Davivienda, Bancolombia y otros permiten cuentas para comerciantes PN).
   - Idealmente cuando se constituya SAS: cuenta corriente a nombre de SAS con NIT propio.
   - Migrar webhook Wompi a la nueva cuenta (cambio en `payment_provider_settings`).

2. **Reclasificar gastos históricos.**
   - Contador revisa expenses 2025-2026 y separa: negocio vs personal.
   - Personal pasa a "retiros del propietario" (cuenta de patrimonio).
   - Negocio queda como gasto deducible.
   - Estimación trabajo: 1-2 semanas de contador. Costo adicional: $1M-$2M.

3. **Reclasificar préstamos.**
   - "Prestamo Cristina $39M" y otros: identificar cuáles son del negocio vs personales del propietario.
   - Personales: salen del balance (no son pasivo del negocio).
   - Si son del negocio: documentar con contratos, tasas, plazos.

4. **Definir esquema de retiros de utilidades.**
   - Como PN: retiros del propietario contabilizan como reducción de patrimonio (no como gasto).
   - Como SAS: dividendos formales después de utilidad después de impuestos.
   - Necesario por NIIF y para acceder a cualquier crédito.

5. **Política contable explícita** para futuro: cualquier gasto de Consuelo o Angel personal NO se registra en UCR.

**Riesgo cuantificado por NO hacer esto:**
- DIAN cruza Wompi vs declarado: si determina que ingresos están subreportados o gastos sobreestimados, sanción Art. 647 ET (sanción por inexactitud) **= 100% del mayor valor a pagar**.
- En tu caso: $4.5M gastos personales rechazados → impuesto adicional ~$54k (Régimen Simple 1.2%) + sanción 100% ~$54k. Por año.
- Multiplicado por años no declarados (2025-2026): $200k-$300k.
- **NIIF defensible imposible** sin esta reclasificación.

---

### Gap 3.1 — Sin libros de contabilidad oficiales 🔴

**Marco legal:**
- Código de Comercio Art. 49: libros obligatorios.
- Art. 654 ET: sanción por irregularidades en libros (0.5% del mayor entre patrimonio líquido o ingresos netos, hasta 20.000 UVT).
- Art. 655 ET: sanción por no llevar libros (0.5%, hasta 20.000 UVT, también).

**Riesgo cuantificado UCR:**
- Ingresos 2025: $40.6M → sanción ~$200k.
- Ingresos 2026 estimado: $85M → sanción ~$425k.
- Acumulado potencial: ~$625k anuales.

**Acción:**
1. Junto con contador, generar libros desde fecha de inicio formal (2025).
2. Pueden ser electrónicos (Excel firmado, PDF firmado, software contable).
3. No requieren registro en CC desde la simplificación normativa.

---

### Gap 3.2 — Sin estados financieros NIIF para PYMES 🔴

**Marco legal:**
- Decreto 2420/2015 Anexo 2 — NIIF para PYMES.
- Cierre obligatorio 31 de diciembre cada año.
- Estados firmados por contador público (Ley 43 de 1990).

**Componentes mínimos para Grupo 2:**
- Estado de Situación Financiera (Balance General).
- Estado de Resultado Integral (Estado de Resultados).
- Estado de Cambios en el Patrimonio.
- Estado de Flujos de Efectivo.
- Notas (mínimo 30+ revelaciones obligatorias).

**Riesgo:**
- Sin estados financieros, **no se puede aplicar a B2B / licitaciones**.
- Para v3.2 (vender SaaS), los clientes corporativos pedirán estados financieros como parte del due diligence.
- Auditoría DIAN: imposible defender posiciones sin contabilidad formal.

**Acción:**
1. Contador genera estados financieros 2025 con corte 31 de diciembre.
2. A partir de 2026, mantener cierre mensual + cierre anual auditable.
3. Conectar con sistema UCR: extracción mensual de data → contador procesa → consolidación.

---

### Gap 3.3 — Sin política contable documentada 🟠

**Marco:**
- NIIF para PYMES sección 10 — Políticas, estimaciones y errores.
- Toda PYME debe tener política contable escrita que defina:
  - Reconocimiento y medición de cada partida (inventarios, propiedad planta y equipo, ingresos, etc.).
  - Métodos elegidos cuando NIIF da opciones (costo histórico vs revaluado, PEPS vs promedio).
  - Supuestos significativos.

**Acción:**
1. Contador redacta política contable adaptada a UCR (sector retail / confección).
2. Aprueba propietario (Angel) por escrito.
3. Se anexa a estados financieros como parte de notas.

---

### Gap 3.4 — Sin kardex valuado bajo NIIF 🟠

**Marco:**
- NIIF para PYMES sección 13 — Inventarios.
- Métodos permitidos: PEPS o Promedio Ponderado. **LIFO no está permitido.**
- Costo de inventario incluye: precio compra + impuestos no recuperables + transporte + costos directos.
- Valor neto realizable comparado con costo (lo menor).

**Estado UCR:**
- Hay `cost_components` y `unit_cost` snapshots (bueno).
- COGS fallback chain implementado.
- Pero **no hay reporte oficial de kardex valuado por SKU/talla** que cumpla NIIF.

**Acción:**
1. Definir método con contador (recomendable: Promedio Ponderado por simplicidad).
2. Generar reporte kardex desde `inventory_log` + `cost_components` + ventas.
3. Documentar en política contable.

> **Tech debt referenciado:** [Inventory Latent Issues](../../../../.claude/projects/-Users-angelsamuelsuescarios-Documents-03-Proyectos-Codigo-uniformes-system-v2/memory/inventory_latent_issues.md) impacta la confiabilidad del kardex (oversell race, log bypassed). Resolver estos antes de exigir kardex valuado oficial.

---

### Gap 3.5 — Sin conciliación bancaria automatizada 🟠

**Marco:**
- NIIF para PYMES exige reconciliación de efectivo y equivalentes.
- Práctica contable estándar: conciliar mensualmente extracto bancario con saldo contable.

**Estado UCR:**
- Existe `balance_accounts` con saldos manuales.
- No hay ingestión automática de extractos bancarios.
- No hay matching algorítmico transacción-bancaria ↔ asiento contable.

**Acción:**
1. Corto plazo: contador hace conciliación mensual manual con extracto + libro de UCR.
2. Mediano plazo (v3.x): integrar API bancaria (algunos bancos colombianos exponen Open Banking) o ingestión de extracto OFX/CSV.

---

### Gap 3.6 — Sistema UCR no genera estados financieros NIIF 🟡

**Estado:**
- `services/financial_statements.py` existe pero produce vista parcial (no NIIF estricta).

**Recomendación:**
- En v3.x agregar:
  - Endpoint `/global/accounting/financial-statements?year=2026&period=annual`.
  - Genera los 4 estados + estructura mínima de notas en JSON.
  - Frontend con vista descargable PDF/Excel para entregar al contador.
- Contador valida y firma como representante.

---

## Roadmap de cierre

| ID | Acción | Prioridad | Plazo | Costo estimado | Bloquea a |
|----|--------|-----------|-------|----------------|-----------|
| C0a | Abrir cuenta bancaria del negocio | 🔴 | <14 días | $0 (apertura gratuita) + saldo mínimo | C0b, todo lo demás |
| C0b | Reclasificar gastos personales históricos | 🔴 | <60 días | $1M-$2M extra contador | C3, C4 |
| C0c | Reclasificar préstamos personales vs negocio | 🔴 | <60 días | Incluido en C0b | C3 |
| C0d | Definir política de retiros del propietario | 🔴 | <30 días | Incluido en C1 | C0b |
| C1 | Contratar contador público colegiado | 🔴 | <14 días | $1M-$3M dx + $300k-$700k/mes | Todos los demás |
| C2 | Definir política contable | 🔴 | <30 días | Incluido en C1 | C3, C5 |
| C3 | Generar estados financieros 2025 | 🔴 | <60 días | C1 | Licitaciones B2B, v3.2 |
| C4 | Generar libros oficiales 2025 | 🔴 | <60 días | C1 | Sanción Art. 654/655 ET |
| C5 | Definir método inventarios (PEPS o promedio) | 🟠 | <30 días | — | C7 |
| C6 | Conciliación bancaria mensual manual | 🟠 | Continuo desde C0a | Tiempo contador | — |
| C7 | Reporte kardex valuado NIIF | 🟠 | <90 días | desarrollo + C5 | Estados financieros |
| C8 | Sistema UCR genera estados NIIF | 🟡 | v3.x | desarrollo medio | Automatización |

---

## Conexión con releases técnicos

| Release | Acción contable habilitadora |
|---------|------------------------------|
| v3.0 (abr 2026) | C1, C2, C5 deben estar resueltos. C3 y C4 idealmente en curso. |
| v3.1 (jun 2026) | Multi-branch implica contabilidad por sucursal con consolidación central. Modelar `branch_id` en `balance_entries`, `expenses` (ya planeado en `docs/v3-branch-architecture/`). |
| v3.2 (oct 2026) | Multi-tenant SaaS implica contabilidad por organización. Cada cliente tiene su propio Grupo NIIF, su política, sus libros. Requiere `organization_id` en módulo accounting completo. |

---

## Decisiones pendientes del owner

- [ ] ¿Contador externo o interno? (Para tu volumen actual: externo, ~$500k/mes inicial).
- [ ] ¿Software contable separado o usar UCR como fuente única?
  - **Opción A:** UCR como ERP, contador exporta → Excel/Siigo/Alegra para libros oficiales.
  - **Opción B:** Migrar todo a Siigo/Alegra y UCR queda como front operativo.
  - **Recomendación:** Opción A inicialmente, evaluar B en v3.2 si hay mucho volumen.
- [ ] ¿Método valoración inventario: PEPS o Promedio Ponderado?
  - **Recomendación:** Promedio Ponderado para retail con muchos SKU/tallas.
