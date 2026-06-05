# Conciliación Pendiente — v3

> **Estado:** EN PAUSA / HOLD
> **Fecha:** 2026-05-29
> **Naturaleza:** sesión de base de datos pura (no de código ni UI)
> **Bloquea:** cierre de v3 al 100% conciliado

---

## 1. Resumen ejecutivo

v3 **ya está en producción** (VPS `104.156.247.226`, commit `ba9b30d` del 28-may; head Alembic `v3_school_global_gt_excl_001`). El cuerpo estructural de la versión —schema unificado, catálogo, costos por desglose, hardening contable, reports coverage— está desplegado y corriendo. Los scripts de datos **§4.3** (import de costos: 2.448 components en 436 productos) y **§4.7** (backfill de timestamps `delivered_at`/`ready_at`) se aplicaron a prod el **30-may**.

Lo único que falta para declarar la versión **conciliada al 100%** son **dos conciliaciones de datos**, ambas **EN PAUSA**:

| Conciliación | Alcance | Estado | Gate de desbloqueo |
|---|---|---|---|
| **Contable** (§4.4) | 239 bank entries + AP Cristina $19M + 7 bloques (~$83M) | HOLD | Sesión de conciliación con Consuelo (decisiones de owner) |
| **Encargos** (orders) | 25 casos huérfanos ($2,362M) — GATE 0 | ✅ **RESUELTO Y DESPLEGADO A PROD 2026-06-04 (v3.1.0)** — overrides aplicados, $524K caja materializada | Sesión forense corrida + arreglo en prod; ver `formalization/encargos-audit-2026-06-04.md` |

Ambas son **trabajo de conciliación contra la DB de producción**, no de código ni de interfaz. El código que las materializa ya está escrito y probado en *dry-run*; lo que falta son **decisiones del owner** que crucen los datos del sistema contra **múltiples fuentes externas** (extractos bancarios, PDFs Nequi, xlsx, facturas, evidencia por encargo). No hay deploy de software pendiente: **esto es lo único que separa a v3 de estar conciliado al 100%**.

---

## 2. Conciliación contable (§4.4 / sesión Consuelo)

### 2.1 Qué comprende

La estabilización contable §4.4 abarca los asientos y reclasificaciones que llevan el patrimonio a un estado defensible. Se estructura en bloques con montos documentados:

| Bloque | Concepto | Monto / Volumen | Estado |
|---|---|---|---|
| Fase 1 | Bank entries faltantes (`bank_fee` + `financial_income`) | 239 entries (162 `bank_fee` = −$220.215,45 · 77 `financial_income` = +$1.464,54) | HOLD — no aplicados a prod |
| Fase 2 / Bloque 1 | AP Préstamo Cristina | $19M (residual vigente) | HOLD — solo en dev, no en prod |
| Bloque 2 | Ajuste Nequi $20M → $10 (5-ene-2026) | sin contrapartida contable | sin decidir |
| Bloque 3 | Discrepancia balance vs entries (`set_balance` históricos) | $21,6M | sin decidir — bloqueado por audit Q2 Bancolombia |
| Bloque 4 | Compras YANBAL / ESIKA / TEMU (`owner_drawing_candidate`) | 20 compras ~$5,05M | sin clasificar 1-a-1 |
| Bloque 5 | Gastos mercado/ocio/comida/viáticos | 114 transacciones ~$7,43M | sin reclasificar |
| Bloque 6 | Transferencias internas BC ↔ Nequi | 7 pares (~$1,44M confirmadas / ~$3,6M reportado) | sin marcar — falta script |
| Bloque 0 | Línea perfumería/belleza (2do negocio no modelado) | reframea el $21,6M | decisión de modelado pendiente |

**Total en juego en la sesión:** ~$83M en 7 bloques de decisión.

El script que aplica las Fases 1 y 2 es `backend/scripts/apply_stabilization_data_corrections.py` (§4.4), **idempotente** (idempotencia vía `reference=BANK-…`), que lee directamente el markdown `formalization/estabilizacion_contable/bank-migration-plan-2026-05-17.md` con los 239 INSERTs y sus `account_id` reales (Banco `0a566699…`, Nequi `d4a62c38…`).

### 2.2 Por qué está en HOLD

El *dry-run* en producción **no cuadra** con los balances documentados en el plan, lo que abre riesgo de **double-count**:

| Cuenta | Balance final dry-run (prod) | Balance documentado (plan) | Δ |
|---|---|---|---|
| Banco | **1.966.800,45** | 1.813.800,45 | +153.000,00 |
| Nequi | **120.354,64** | 191.354,64 | −71.000,00 |

Prod arrancó de **saldos distintos a dev** (probablemente ya conciliados contra extracto real), de modo que aplicar las 239 entries sobre esos saldos podría duplicar movimientos ya contabilizados. **No se puede `--commit` hasta confirmar que el saldo actual de prod NO fue ya conciliado contra el extracto real.**

Riesgo adicional de **vendor duplicado**: el script crea un proveedor **`Cristina Rios`** para la AP de $19M, mientras en prod ya existe **`Cristina Londono`** (sin AP). Hay que decidir si son la misma persona y de-duplicar **antes** de `--commit`.

### 2.3 Qué decisiones del owner la desbloquean

| # | Decisión | Default sugerido |
|---|---|---|
| Bloque 0 | Timing/tratamiento de la línea perfumería (pre-requisito conceptual de Bloques 3 y 4) | modelar como `business_line` (implementación ~3-5 días, no ejecutada) |
| Bloque 1 | Soporte documental Cristina (recibo/pagaré/WhatsApp), fecha límite, intereses | ya decidido vigente; soporte es no-bloqueante |
| Bloque 2 | Hipótesis Nequi $20M → $10: (a) `equity_capital` / (b) `owner_drawing` / (c) `expense` / (d) `system_correction` / (e) otra | (a) conservador |
| Bloque 3 | Opción a/b/c/d para discrepancia $21,6M (mes crítico: enero 2026) | reframeado por Bloque 0 |
| Bloque 4 | Marcar cada compra B (beauty inventario) / P (personal) / R (reembolsable) | B tras hallazgo Bloque 0 |
| Bloque 5 | Regla R1/R2/R3/R4 + top 20 P/N | R3 (mixto por subcategoría) |
| Bloque 6 | Confirmar que las 7 transferencias son entre cuentas propias → `transfer_internal` | — |

> **Firma:** la tabla final de decisiones (iniciales por bloque) se firma el día de la sesión. Hasta entonces, `sesion-conciliacion-consuelo.md` y la presentación son **borrador**.

---

## 3. Conciliación de encargos (orders)

> ✅ **CORRIDA, FIRMADA Y DESPLEGADA A PROD 2026-06-04 (v3.1.0).** Acta: [`formalization/encargos-audit-2026-06-04.md`](formalization/encargos-audit-2026-06-04.md) (25/25 casos). Bugs: [`formalization/encargos-audit-bugs.md`](formalization/encargos-audit-bugs.md). Total real **$2.362.000** (no $2,56M). Resolución: $524K pago retroactivo · $135K saldos fantasma · $147K cancelados · $2K castigo · **$1.554.000 CxC legítima** (JUCUM $1.151M ratificado cobrable). **Arreglo `order_audit_overrides` ya implementado y aplicado en prod** (commit `81019aa`, $524K materializados). Lo de abajo describe la metodología de la sesión (ya ejecutada).

### 3.1 Qué comprende

Conforme a [`formalization/prompts/encargos-audit-session-prompt.md`](formalization/prompts/encargos-audit-session-prompt.md), es una **sesión forense interactiva** (owner Angel + Consuelo + Claude) que decide **caso por caso** sobre los **25 encargos anómalos ($2.362.000)** reportados por la vendedora. Es el **GATE 0** del deploy: el owner exige resolverlo para subir versión estable.

- **No toca** `orders.status` público.
- Produce un **acta de decisiones** (`encargos-audit-2026-05-XX.md`) con una resolución aprobada por caso: pago retroactivo / incobrable / cancelación / cuadre cruzado / pendiente-external.
- El acta se materializa luego (sesión separada) en una tabla **`order_audit_overrides`** + migración + endpoint admin + `LEFT JOIN` de overrides en reportes (P&L, AR aging) + script de asientos.

**Casos especiales Tipo F** (decisión personal del owner, no delegable):

| Caso | Cliente | Monto | Nota |
|---|---|---|---|
| ENC-2026-0118 | JUCUM | $848K | >$200K, no decidir solo |
| ENC-2026-0128 | Cristina Giraldo | $130K | verificar relación con préstamo Cristina $19M (cruce con conciliación contable) |

### 3.2 Qué datos de DB se cruzan y contra qué

| Dato de DB (read-only) | Se cruza contra |
|---|---|
| `orders`, `order_items` | `TRACKEOS ENCARGOS.xlsx` (columnas `INSTITUCION` / `CLIENTE` / `CUANTO DEBE` / `EXPLICACION`) |
| `accounts_receivable`, `payment_transactions` | evidencia externa por encargo (WhatsApp, recibos, confirmación de la vendedora Diana, llamadas) |
| `sales`, `sale_changes` | 57 `sale_qr` sin match (~$7,19M, probable línea perfumería) |

El snapshot de referencia es `uniformes_prod_snapshot` (read-only, refrescable). **Pendiente verificar** que su head Alembic esté alineado con el head real de prod post-deploy (`v3_school_global_gt_excl_001`); el prompt referencia `a4b5c6d7e8f9`. El backfill de timestamps §4.7 ya está en prod, pero **la conciliación de montos sigue abierta**.

---

## 4. Fuentes a cruzar

La sesión de DB debe reconciliar el sistema contra **todas** estas fuentes externas:

| Fuente | Detalle | Usada por |
|---|---|---|
| Extracto Bancolombia (xlsx) | Cuenta ahorros `54089567338`, periodo 2025-12-31 → **2026-03-31**. **Falta abril 2026** (por eso la diferencia de saldo se mide al 31-mar) | Bloque 3, balances §4.4 |
| PDFs Nequi (password) | `3001234567`, 4 PDFs mensuales (ene–abr 2026), protegidos con `BANK_PDF_PASSWORD` (originales pueden no estar en prod → el script lee el markdown ya parseado) | Fase 1, Bloque 2 |
| Bancolombia XLSX (parser v1) | 1.010 transacciones del bank reconciliation system | clasificación granular |
| `bank-transactions-detail-2026-05-17.csv` | Dataset granular (145KB) de 1.010 movimientos clasificados por categoría y status | clasificación 1-a-1 manual |
| 36 xlsx manuscritos de costos | `COSTOS-…zip` (hermano del owner) | §4.3 (ya aplicado a prod) |
| Facturas Alegra (FE DIAN) | Resolución `18764109873979` | integración B0.5 (pendiente unir a backend UCR) |
| `bank-migration-plan-2026-05-17.md` | 239 INSERTs `bank_fee` + `financial_income` | fuente directa §4.4 Fase 1 |
| Compras YANBAL / ESIKA / TEMU | 20 movimientos bancarios (~$5,05M) | Bloque 4 (inventario beauty vs personal) |
| Ventas QR sin match | 57 movs, +$7,19M (probable beauty) | contraparte faltante en `sales` / encargos |
| `needs_manual_review` (bank recon) | 203 movs, −$2,7M (+ 179 `unknown`, −$7,68M) | clasificación humana pendiente |
| Soporte legal Cristina | Recibo / pagaré / WhatsApp del préstamo $19M | respaldo AP ante DIAN |
| `TRACKEOS ENCARGOS.xlsx` | 25 encargos huérfanos (JUCUM $848K, Cristina Giraldo $130K) | GATE 0 encargos |
| `prod_snapshot` vs `balance_entries` | Análisis forense mes a mes (`patrimony-deep-analysis-2026.md`) | discrepancia $21,6M |

---

## 5. Naturaleza de la sesión

Es **conciliación contra la DB de producción**, no desarrollo:

- **Sesión de DB pura.** No hay cambios de código ni de UI pendientes para ejecutarla. El motor —`apply_stabilization_data_corrections.py` (§4.4)— **ya está escrito y probado en dry-run** sobre prod.
- **Idempotente.** Las Fases 1 y 2 usan `reference=BANK-…` como llave de idempotencia; re-correr no duplica. Verificación esperada: `COUNT(reference LIKE 'BANK-%') = 239` (hoy da **0** en prod porque el script está en HOLD).
- **Bloqueada solo por decisiones del owner.** No por un bug ni por un build. Los inputs faltantes son humanos: las decisiones de los 7 bloques (~$83M) y las resoluciones de los 25 encargos, cruzando las fuentes de §4.
- **Multi-fuente.** Su valor está en cruzar el sistema contra extractos, PDFs, xlsx y evidencia externa hasta que cada movimiento tenga contrapartida defensible.

---

## 6. Qué se ejecuta cuando se desbloquee

Una vez firmadas las decisiones de los bloques y resuelto el riesgo de double-count + vendor duplicado:

### 6.1 Conciliación contable (§4.4)

```bash
# 1. Backup previo OBLIGATORIO de la DB de prod
pg_dump -U <user> uniformes_db > backup_pre_estabilizacion_$(date +%Y%m%d_%H%M%S).sql

# 2. Dry-run final contra los saldos reales de prod (re-verificar montos)
python backend/scripts/apply_stabilization_data_corrections.py

# 3. Aplicar (Fase 1: 239 bank entries + Fase 2: AP Cristina $19M)
python backend/scripts/apply_stabilization_data_corrections.py --commit

# 4. Verificar idempotencia / aplicación
#    COUNT(reference LIKE 'BANK-%')  ==  239
```

**Pasos del deploy-checklist asociados:**

- **§4.4** — aplicar las 239 bank entries + AP Cristina $19M (resolver antes el HOLD: balances dry-run vs documentados, y de-duplicar `Cristina Rios` / `Cristina Londono`).
- **§4.5** — resolver las 5 fases pendientes de decisiones owner: 20 `owner_drawings` (~$5,05M), reclasificación masiva mercado/ocio (~$4,92M), Nequi $20M, equity correctivo $21,6M, 7 internal transfers (~$3,6M — **falta escribir el script de marcado**).
- **§4.8** — `audit_data_quality_score.py` (script aún no escrito, objetivo 100/100; dejar como cron diario).
- **§6 / §6.3** — smoke completo + reports coverage tras §4.4 (invariante `sum(streams) == total`, orders accrual `!= 0`).
- **§10** — al cerrar el deploy, marcar casillas y mover `deploy-checklist.md` a `deploy-v3-completed-<fecha>.md`.

### 6.2 Conciliación de encargos (GATE 0)

1. Correr la sesión forense de los 25 casos contra `prod_snapshot` (alineado al head de prod).
2. Generar el acta `encargos-audit-2026-05-XX.md` con decisión aprobada por caso.
3. Decidir personalmente los casos Tipo F (JUCUM $848K, Cristina Giraldo $130K).
4. Implementar `order_audit_overrides` (migración + endpoint admin + `LEFT JOIN` en P&L/AR aging + script de asientos) y aplicar asientos **sin tocar** `orders.status` público.

---

## 7. Enlaces

| Documento | Ruta |
|---|---|
| Guion de sesión (7 bloques, ~$83M) | [`sesion-conciliacion-consuelo.md`](sesion-conciliacion-consuelo.md) |
| Presentación (slides) | [`presentacion-conciliacion-consuelo.html`](presentacion-conciliacion-consuelo.html) |
| Núcleo documental contable | [`formalization/estabilizacion_contable/`](formalization/estabilizacion_contable/) |
| → Plan de 239 INSERTs (fuente §4.4 Fase 1) | [`bank-migration-plan-2026-05-17.md`](formalization/estabilizacion_contable/bank-migration-plan-2026-05-17.md) |
| → Diagnóstico bancario v2 | [`bank-reconciliation-2026-05-17.md`](formalization/estabilizacion_contable/bank-reconciliation-2026-05-17.md) |
| → Trazabilidad granular | [`bank-track-summary-2026-05-17.md`](formalization/estabilizacion_contable/bank-track-summary-2026-05-17.md) |
| → CSV de detalle (1.010 movs) | [`bank-transactions-detail-2026-05-17.csv`](formalization/estabilizacion_contable/bank-transactions-detail-2026-05-17.csv) |
| → Análisis forense del patrimonio | [`patrimony-deep-analysis-2026.md`](formalization/estabilizacion_contable/patrimony-deep-analysis-2026.md) |
| → Plan de reclasificación (§4.5 #2) | [`migration-plan-hybrid.md`](formalization/estabilizacion_contable/migration-plan-hybrid.md) |
| Prompt de sesión forense de encargos | [`formalization/prompts/encargos-audit-session-prompt.md`](formalization/prompts/encargos-audit-session-prompt.md) |
| Checklist autoritativo del deploy (§4.4/§4.5) | [`formalization/deploy-checklist.md`](formalization/deploy-checklist.md) |
