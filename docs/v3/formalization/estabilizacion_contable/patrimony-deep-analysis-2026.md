# Análisis profundo del Patrimonio UCR — Enero a Mayo 2026

> **Fecha del análisis:** 2026-05-03
> **Fuente:** `uniformes_prod_snapshot` (refresh hoy)
> **Período cubierto:** 2026-01-01 → 2026-05-03 (4 meses + 3 días)
> **Propósito:** entender cómo el sistema procesa los datos de patrimonio y detectar anomalías de captura/integridad.

---

## Resumen ejecutivo de hallazgos

| Hallazgo | Severidad | Implicación |
|----------|-----------|-------------|
| **$21.6M de discrepancia entre `balance_accounts.balance` y suma de `balance_entries`** | 🔴 CRÍTICA | Los `set_balance` (ajustes manuales) NO crean entries compensatorias → caja "real" no es trazable |
| **Préstamos saldados con flujo de caja parcial** ($39M deuda Cristina vs $20M flujo registrado) | 🔴 ALTA | Hay $19M de pagos no rastreados en el sistema, o la deuda se "perdonó" sin documentar |
| **Categoría `deuda` con $30.1M YTD, concentrada en febrero ($28.7M)** | 🟠 ALTA | Pagos de capital reportados como gasto operativo, distorsionando P&L (corregido en Fix Gap A) |
| **Estacionalidad real ultra-fuerte** (abril es 12% de enero) | 🟢 INFO | Volumen 2026: $122.9M con 80% concentrado en ene-feb. Confirma estacionalidad escolar |
| **57 cuentas por cobrar SIN fecha de vencimiento** ($6.8M pendiente) | 🟠 MEDIA | Imposibilita aging report DSO y proyección de cobranza |
| **Inventario al 60% con costo real, 40% estimado** | 🟠 MEDIA | $16.6M del balance es estimación, no real (sobreestima patrimonio si margen real >20%) |
| **Sistema arrancó digitalizado el 14-ene-2026** con 13 máquinas + 8 préstamos en bloque | 🟢 INFO | "Balance de apertura" sin asiento contable de equity contrapartida → Gap B confirmado |
| **Anomalía Nequi: ajuste -$19.99M el 5 enero** ("de $20M a $10") | 🔴 CRÍTICA | $20M desaparecidos contablemente sin explicación clara |

---

## 1. Cómo el sistema procesa el patrimonio

### Modelo conceptual

El sistema mantiene 3 tablas principales:

```
balance_accounts     ← cuentas patrimoniales (Caja, Banco, Préstamos, Activos Fijos)
  ├─ balance         ← saldo CURRENT (denormalizado para queries rápidas)
  └─ is_active       ← flag para "archivar" sin eliminar

balance_entries      ← asientos individuales (cada movimiento)
  ├─ amount          ← signed (positivo=ingreso, negativo=egreso)
  ├─ entry_type      ← 'income' | 'expense' (mayoría NULL hoy)
  └─ description     ← texto libre

expenses             ← gastos operativos (categorizados)
  ├─ category        ← rent, utilities, payroll, deuda, mercado, etc.
  ├─ payment_account_id  ← FK a balance_accounts (de qué cuenta sale el dinero)
  └─ amount_paid     ← parcial vs total
```

### Cómo debería funcionar (flujo correcto de doble partida)

```
USUARIO crea expense $300k de "intereses_financieros":
  1. INSERT en expenses: category, amount, payment_account_id
  2. INSERT en balance_entries: account_id = payment_account_id, amount = -300k
  3. UPDATE balance_accounts: balance -= 300k (cuenta de pago)
  4. (P&L pickup): el expense aparece en gastos del período
```

### Cómo funciona en realidad — Gap detectado

El paso **2 y 3 conviven con un endpoint paralelo `/set-balance`** que actualiza `balance_accounts.balance` **sin crear `balance_entries` compensatorias**. Resultado:

```
SUM(balance_entries) por cuenta  ≠  balance_accounts.balance
                  ↑                              ↑
       reconstrucción histórica         saldo "real" según UI
```

Si quieres saber qué pasó en febrero, no puedes confiar en sumar entries — falta lo que se ajustó manualmente.

---

## 2. Línea de tiempo: cómo apareció el patrimonio en el sistema

### 2025-12-16 — Pre-arranque
- **`Prestamo Cristina`** $39.000.000 → cargado al sistema 1 mes antes del go-live de la digitalización.
- Es el único pasivo creado en 2025. Probablemente data de carga preparatoria.

### 2026-01-06 — Primera deuda corriente
- **`Tarjeta de Credito Computador`** $890.000 → única deuda corriente.

### 2026-01-14 — **EL DÍA DEL "BALANCE DE APERTURA"**

Este es el día más importante del año contable. En un solo bloque se registraron:

**8 préstamos largo plazo** ($38.000.000 total):
- 2× $10M, $7M, 4× $3M, $2M (codes 2202-2208).

**13 máquinas y equipos** ($14.500.000 total):
- Plana Siruba $800k, Plana Yemsi $700k, Plana 20U $1.2M
- 2× Fileteadora ($2.4M), 2× Recubridora Kansay ($1.8M)
- 2× Bordadora Disney ($2.6M), Cortadora $500k, Plancha $400k
- Troqueladora $800k, Estanterías $1.2M, Mesa de corte $200k
- 2× Vitrinas ($550k), Celular Vivo $700k, Guías $500k.

**Lo que NO se registró ese día:**
- Cuenta de equity (capital aportado). Sin esa contrapartida, **el balance contable nunca cuadró desde el día 1**.

### 2026-01-27 — Pequeñas adiciones
- `Cajon Monedero` $165k.
- `Impresora Jaltech` $265k.

### 2026-03-24 — **DÍA DEL ARCHIVADO MASIVO DE DEUDAS**
- Se desactivaron en bloque (`is_active = false`) **8 préstamos + 1 tarjeta de crédito**.
- Total archivado: **$77.890.000**.
- Ver gap: el archivado fue 24 de marzo, pero los pagos reales (al menos los registrados) fueron en **febrero**. Hay un gap de ~6 semanas entre "pago" y "archivado".

---

## 3. Flujo de caja real mes a mes (saldos de cierre)

> **Nota:** estos saldos son la **suma de `balance_entries`** (reconstrucción histórica). Difieren del balance actual por ajustes manuales no rastreables.

| Mes | Caja Menor | Caja Mayor | Banco | Nequi | Total |
|-----|-----------:|-----------:|------:|------:|------:|
| 2026-01 | $7.20M | $16.17M | $13.48M | -$15.21M | **$21.64M** |
| 2026-02 | $0.41M | $13.20M | $6.15M | -$17.77M | **$1.99M** |
| 2026-03 | $0.78M | $13.22M | $7.03M | -$21.29M | **-$0.26M** |
| 2026-04 | -$0.01M | $14.63M | -$0.70M | -$21.41M | **-$7.49M** |
| 2026-05 | $0.08M | $15.09M | -$1.97M | -$21.57M | **-$8.36M** |

**vs balance actual reportado** por el sistema:

| Cuenta | Balance actual | Suma entries | **Diferencia no rastreada** |
|--------|---------------:|-------------:|----------------------------:|
| Nequi | $19.5k | -$21.57M | **$21.59M** ⚠️ |
| Caja Mayor | $8.91M | $15.09M | -$6.17M |
| Banco | $3.02M | -$1.97M | $4.99M |
| Caja Menor | $197k | $83k | $114k |
| **TOTAL** | **$12.15M** | **-$8.36M** | **$20.51M** ⚠️ |

**Interpretación:** **$20.5M se "movieron" en las cuentas sin que el sistema los registre como movimientos individuales.** Esto es producto del endpoint `/set-balance` que sobrescribe `balance_accounts.balance` directamente.

### El caso Nequi (el más extremo)

```
2026-01-05: balance_entries muestra "Ajuste manual de Nequi (de $20.000.000 a $10.0)"
            → entry de -$19.999.990
            → PERO el saldo previo ($20M) nunca se registró como entry positiva
            → El sistema "asume" que había $20M (vino de set_balance previo)
```

Si reconstruimos Nequi desde 2026-01-01 sumando entries, da -$21.57M. El balance real es $19k. La diferencia ($21.6M) son **3 ajustes manuales históricos** que ajustaron Nequi sin entry de respaldo.

**Riesgo:** ante una auditoría DIAN, no puedes explicar movimiento por movimiento de tus cuentas. La trazabilidad está rota.

---

## 4. Reconciliación de pasivos (preocupante)

### Préstamo Cristina — caso emblemático

| Fecha | Acción | Monto |
|-------|--------|-------|
| 2025-12-16 | Cuenta `Prestamo Cristina` creada | $39.000.000 |
| 2026-01-14 | **Cuenta marcada `is_active = false`** | (saldo $39M intacto) |
| 2026-02-02 | Pago Nequi → "pago a cris... 1 de intereses 4 capital" | $4.000.000 |
| 2026-02-04 | Pago Banco → "Pago Cris" | $1.000.000 |
| 2026-02-04 | Pago Banco → "pago capital de cris a nombre de mariangel" | $2.000.000 |
| 2026-02-07 | Pago Caja Mayor → "pago a cristi segundo acuerdo" | $10.000.000 |
| 2026-02-12 | Pago Banco → "para cris" | $3.050.000 |
| **TOTAL pagos rastreados** | | **$20.050.000** |
| **Diferencia vs deuda original $39M** | | **$18.95M sin rastrear** |

**Tres explicaciones posibles:**
1. Pagos en efectivo no registrados (Caja Menor o "fuera del sistema").
2. **Refinanciamiento parcial:** $19M del Préstamo Cristina se transformaron en uno de los nuevos préstamos vigentes ($12M + $7M = $19M). La fecha calza si Cristina prestó "una segunda vez" tras saldo parcial.
3. **Condonación parcial.** Si fue una negociación con la prestamista.

> **Acción recomendada:** clarificar con Consuelo cuál fue la realidad. Documentar en formal note. Si fue refinanciamiento, las nuevas deudas $12M+$7M deberían tener relación contractual con la cancelación de Préstamo Cristina.

### Otros 8 préstamos viejos

Suma $38M, marcados `is_active = false` el 24 de marzo de 2026. Pagos rastreados en `balance_entries` con descripción "pago" en feb-mar:

```
2026-02-12: $3.075.000 — "elizabeth 3 millones de capital y 75 mil de 15 dias de interes"
2026-02-04: $1.590.000 — "pago de babara para camiseta caracas" (probablemente otro)
2026-02-13: $1.668.000 — "jean 12 por talla" (NO es deuda, es proveedor)
```

Y 11 expenses de febrero categoría `deuda` por $28.7M total. Estos sí parecen ser pagos de capital de los préstamos.

**$28.7M en febrero (categoría `deuda`) + $19M a Cristina = $47.7M** vs deuda total $77M → **gap de ~$30M también sin rastrear**.

---

## 5. Ingresos mes a mes — la realidad estacional

| Mes | Ventas | Encargos | Arreglos | **Facturado** | Cobrado |
|-----|-------:|---------:|---------:|--------------:|--------:|
| 2026-01 | $50.4M | $16.4M | $1.5M | **$68.3M** | $65.9M (96%) |
| 2026-02 | $21.1M | $12.9M | $0.5M | **$34.4M** | $31.3M (91%) |
| 2026-03 | $7.8M | $2.7M | $1.4M | **$11.9M** | $11.1M (94%) |
| 2026-04 | $5.8M | $0.9M | $1.3M | **$8.0M** | $7.7M (96%) |
| 2026-05 (3d) | $0.06M | $0.02M | $0.3M | **$0.4M** | $0.3M |

**Patrón observado:**
- **Enero +Febrero = $102.7M = 84% del ingreso YTD ($122.9M).**
- Marzo cae 65% vs feb. Abril cae 33% vs marzo.
- La estacionalidad escolar es **brutal**: el negocio gana lo de 8 meses en 2 meses.

**Implicación operativa:**
- Marzo-mayo es período de **supervivencia** con caja acumulada.
- Junio-agosto debería ser período de **inversión** (preparación, B2B).
- Cualquier costo fijo grande iniciado en feb-may sangra la caja.

---

## 6. Gastos mes a mes — patrones y anomalías

### Top 5 categorías por mes (sin contar producción)

| Mes | #1 | #2 | #3 | Total YTD-mes |
|-----|----|----|----|---------------|
| **Ene** | other $2.81M | payroll $1.76M | utilities $1.23M | $7.4M |
| **Feb** | **deuda $28.66M** ⚠️ | payroll $2.63M | mercado $0.70M | $33M |
| **Mar** | rent $1.50M | deuda $1.18M | payroll $1.53M | $5.5M |
| **Abr** | rent $3.38M | prestamos $1.93M | payroll $1.60M | $9M |

**Anomalías detectadas:**

1. **Febrero es atípico** — la categoría `deuda` $28.7M es **3.4× el ingreso bruto del mes**. Son pagos de capital de préstamos viejos (correcto descontar del P&L tras Fix Gap A, pero sí afecta caja real).

2. **Rent inconsistente:**
   - Ene: $620k (1 entry)
   - Feb: $650k (1 entry)
   - Mar: $1.50M (2 entries)
   - **Abr: $3.38M (6 entries)** ⚠️
   - Si arriendo es $800k/mes, $3.38M/mes implica que abril tiene pagos atrasados o son pagos múltiples (deposito, garantía, retroactivos).

3. **Categoría `other` enero $2.81M** — comodín sin clasificar. Requiere revisión.

4. **`prestamos` y `deuda` mezcladas** todo el año — patrón consistente de mala categorización (resuelto en Fix Gap A).

---

## 7. Cuentas por cobrar — situación crítica de calidad

| Estado | Cantidad | Saldo pendiente |
|--------|---------:|----------------:|
| Vencida >90 días | 3 | $218.000 |
| Vencida 30-90 días | 2 | $64.000 |
| Vencida <30 días | 2 | **$4.000.000** |
| **Sin fecha de vencimiento** | **57** | **$6.823.000** ⚠️ |
| **TOTAL pendiente** | **64** | **$11.105.000** |

**Hallazgos:**
- **$6.8M en 57 AR sin fecha** → no se puede calcular DSO ni proyectar cobranza.
- $4M vencidas <30d concentradas → urgente gestión de cobro.
- $282k vencidas >30d → candidatas a provisión por incobrabilidad.

**Proceso roto:** la creación de AR no exige `due_date`. Debería ser obligatorio para integridad del modelo.

---

## 8. Inventario — calidad de captura

```
Productos activos:        169
Unidades totales:        1.513
Con costo real:            905 (60%)
Con costo estimado:        608 (40%)
Valor con costo real:    $32.6M
Valor con estimación:    $16.6M  (price × 0.80)
TOTAL VALUADO:           $49.2M
```

**Riesgo:** los $16.6M estimados pueden estar mal en cualquier dirección:
- Si margen real es 35% (no 20% asumido por el sistema), inventario real ~$13.5M, **sobreestimación de $3.1M**.
- Si margen real es 10%, inventario real ~$18.6M, **subestimación de $2M**.

Para EEFF NIIF defensibles ante DIAN, el cost real de TODOS los productos activos debe estar capturado. Es el **bloqueador #1** del balance NIIF.

---

## 9. Reconstrucción del patrimonio mes a mes

Esta tabla intenta reconstruir el patrimonio al cierre de cada mes. **Limitación:** inventario y activos fijos son snapshot HOY (no históricos), por simplicidad.

| Concepto | 2026-01 | 2026-02 | 2026-03 | 2026-04 | 2026-05 |
|----------|--------:|--------:|--------:|--------:|--------:|
| Caja+Banco+Nequi (entries) | $21.64M | $1.99M | -$0.26M | -$7.49M | -$8.36M |
| AR pendiente acumulada | $6.57M | $9.76M | $10.34M | $10.43M | $11.10M |
| Inventario (snapshot hoy) | ~$49.2M | ~$49.2M | ~$49.2M | ~$49.2M | $49.2M |
| Fixed assets | $14.5M | $14.5M | $14.5M | $14.5M | $17.13M |
| **TOTAL ACTIVOS aprox** | **$91.9M** | **$75.5M** | **$73.8M** | **$66.6M** | **$69.1M** |
| Pasivos vigentes | $77.9M | $77.9M | $0 (archivados) | $0 | $0 |
| **PATRIMONIO aprox** | **+$14M** | **-$2.4M** | **+$73.8M** | **+$66.6M** | **+$69.1M** |

**Interpretación:**
- **Salto de patrimonio entre feb y mar = $76M.** Eso fue cuando se desactivaron los pasivos viejos (24 mar). El patrimonio "se infló" sin un asiento de canje real correspondiente.
- **Patrimonio negativo en febrero (-$2.4M)** porque se pagaron $28.7M en deuda con flujos reales pero los pasivos seguían en libros activos.
- **El balance del sistema en realidad NO refleja el ciclo económico** — refleja la administración del archivado.

---

## 10. Anomalías y recomendaciones específicas

### A. Anomalías de captura (prioritarias)

1. **Ajuste Nequi 5-ene de $20M → $10:** investigar con Consuelo qué representó. Si fue saldo histórico que se "soltó", debe documentarse como `owner_drawings` o `equity_capital` adjustment, no como un "ajuste manual" sin contrapartida.

2. **Pagos a Cristina suman $20M, deuda original $39M:** clarificar el destino de los $19M faltantes (¿refinanciamiento? ¿condonación? ¿pagos en efectivo no registrados?). Documentar formalmente.

3. **57 AR sin `due_date`:** hacer obligatorio el campo. Reclasificar las 57 existentes con fecha estimada (creación + 30 días).

4. **Discrepancia $20.5M entre balance real y suma de entries:** auditar todos los `set_balance` históricos y crear entries compensatorias retroactivas para que la trazabilidad sea completa.

### B. Anomalías de proceso (mejoras al sistema)

5. **`set_balance` debe crear `balance_entry` automáticamente:** modificar el endpoint para que cualquier cambio en `balance_accounts.balance` genere su entry compensatoria automática con descripción "Ajuste manual por X".

6. **`mark_debt_as_paid` no genera asiento contable** (ya documentado en `financial-model-current-state.md`): cuando se marca pagada una cuota, debe crear: (a) entry negativa en cuenta de pago, (b) expense `intereses_financieros` por la porción de interés, (c) reducción del balance del LIABILITY si es porción capital.

7. **Archivado de pasivos sin reconciliación:** `is_active = false` debería verificar que el balance_account.balance == 0 antes de permitir archivado. O si se permite con balance > 0, debería crear automáticamente un asiento de "ajuste de pasivo" contra una cuenta de equity (perdón de deuda, condonación).

8. **`expense_categories` mal usadas:** los 4 meses muestran que `mercado`, `ocio`, `prestamos`, `deuda` se usan inconsistentemente. Tras Fix Gap A las dos primeras salen del P&L; falta migrar los datos a las categorías correctas (`payroll_in_kind`/`owner_drawings`/`intereses_financieros` según corresponda).

### C. Cosas a documentar formalmente

9. **Balance de apertura 14-ene-2026:** debería existir un documento contable formal que diga "al 14 de enero, Consuelo Ríos aporta al sistema digitalizado los siguientes activos y pasivos" con firma + fecha. Esto soporta el balance de apertura ante DIAN.

10. **Cuenta de equity faltante:** crear asiento de capital aportado equivalente al gap entre activos y pasivos del 14 de enero ($14.5M activos fijos + inventario al día + caja - $77.9M pasivos = aproximadamente -$50M). Si el balance al 14-ene era negativo, parte fue "deudas asumidas por la propietaria" — clasificable como préstamo de socio o como negativo del patrimonio.

---

## 11. Implicaciones para el modelo financiero (ProjectionService)

El análisis revela 3 cosas que afectan las proyecciones:

1. **El "patrimonio actual" reportado por el sistema sobreestima la posición real** porque incluye $20.5M de ajustes no rastreables y $16.6M de inventario estimado. **Patrimonio defensivo (descontando estos riesgos): ~$50-60M**, no $89-110M.

2. **La estacionalidad escolar es más extrema de lo asumido en el modelo.** Mis proyecciones usaban `seasonality = {1: 2.0, 2: 1.7, 3: 0.7, ...}`. La data real muestra que ene+feb representan 84% del año. Hay que ajustar a `{1: 5.6, 2: 2.9, 3: 1.0, 4: 0.7, ...}` con base mensual menor.

3. **La utilidad de los meses bajos (mar-may) es prácticamente cero o negativa**, según el flujo real. Cualquier costo formal nuevo (SAS, payroll formalizado) en estos meses **se paga con cash acumulado del pico**, no con ingresos del mes.

---

## 12. Plan de acción priorizado tras este análisis

### Inmediato (esta semana)
1. **Clarificar con Consuelo** (no con contador todavía) el caso del Préstamo Cristina ($19M de pagos faltantes) y el ajuste Nequi $20M → $10.
2. **Aplicar Fix bug `mark_debt_as_paid`** en código.
3. **Aplicar Fix bug `set_balance`** para que cree entries compensatorias.

### Corto plazo (este mes)
4. **Auditar las 57 AR sin fecha** y agregar `due_date`.
5. **Capturar costo real** de los 608 productos sin cost (40% del inventario).
6. **Reclasificar gastos personales históricos** vía script (mercado/ocio/comida/viaticos → owner_drawings con marca de "histórico pre-2026-05-03").

### Mediano plazo (Q3 2026)
7. **Crear cuentas de equity** (`Capital aportado`, `Resultados acumulados`, `Resultado del ejercicio`) y asentar el balance de apertura formal con un asiento contable retroactivo.
8. **Consolidar el ProjectionService** con la estacionalidad real y los datos depurados.
9. **Una vez con todo lo anterior**, considerar contratar un Contador Público para validar los EEFF y firmarlos.

---

## Apéndice — Comandos para reproducir este análisis

```bash
# Refrescar snapshot
./backend/scripts/refresh_prod_snapshot.sh

# Correr análisis SQL
docker exec uniformes-postgres psql -U uniformes_user \
  -d uniformes_prod_snapshot -f /tmp/analysis.sql \
  > /tmp/ucr-snapshots/patrimony_analysis_output.txt

# Saldos de cierre mensual (running balance)
docker exec uniformes-postgres psql -U uniformes_user \
  -d uniformes_prod_snapshot -c "
WITH monthly AS (
  SELECT ba.name, DATE_TRUNC('month', be.entry_date) AS mes,
         SUM(be.amount) AS movimiento_mes
  FROM balance_entries be JOIN balance_accounts ba ON ba.id = be.account_id
  WHERE ba.code IN ('1101','1102','1103','1104') GROUP BY 1, 2
)
SELECT TO_CHAR(mes, 'YYYY-MM'),
       SUM(SUM(movimiento_mes)) OVER (PARTITION BY name ORDER BY mes)
FROM monthly GROUP BY mes, name ORDER BY mes, name;"

# Reconciliación balance vs entries
docker exec uniformes-postgres psql -U uniformes_user \
  -d uniformes_prod_snapshot -c "
SELECT ba.name, ba.balance, COALESCE(SUM(be.amount), 0) as suma_entries,
       (ba.balance - COALESCE(SUM(be.amount), 0)) as diferencia
FROM balance_accounts ba
LEFT JOIN balance_entries be ON be.account_id = ba.id
WHERE ba.account_type::text = 'ASSET_CURRENT'
GROUP BY ba.id, ba.name, ba.balance;"
```
