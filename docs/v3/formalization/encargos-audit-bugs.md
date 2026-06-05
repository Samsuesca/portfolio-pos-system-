# Bugs descubiertos durante la Auditoría Forense de Encargos

> Hallazgos técnicos detectados al cruzar el xlsx contra `uniformes_prod_snapshot` (2026-06-04).
> Alimentan la fix-list de M3. No se corrigen en la sesión forense.

---

## BUG-ENC-01 — `balance_entries.reference` no incluye el prefijo de colegio

**Severidad:** media (integridad contable / trazabilidad)

`orders.code` se prefija con el colegio en v3 (`PINAL-001-ENC-2026-0058`), pero los anticipos en `balance_entries` se siguen guardando con la referencia **sin prefijo** (`reference = 'ENC-2026-0058'`). Como el número de encargo se repite entre colegios, **una misma referencia apunta a anticipos de clientes distintos**.

Ejemplo real:
| reference | entry_date | amount | cliente real |
|---|---|---:|---|
| ENC-2026-0058 | 2026-01-28 | 47.000 | Jeisy Retrepo (Caracas) |
| ENC-2026-0058 | 2026-03-19 | 3.000 | Santi Mazo (Pinal) |

**Impacto:** atribuir un anticipo a un encargo exige cruzar por `amount = orders.paid_amount`, no por referencia. El futuro script de asientos del override debe usar el **código prefijado** y no confiar en `reference`.

**Fix sugerido:** al generar el asiento de anticipo, escribir `reference = <código prefijado>`; opcional: migración de back-population para las referencias históricas.

---

## BUG-ENC-02 — Pago espurio de $1 en PINAL-001-ENC-2026-0057 (Yuliza Tabares)

**Severidad:** baja (dato sucio)

`paid_amount = 1` sobre un total de `58.000` → `balance = 57.999`. Es el único caso de los 25 que no cuadra exacto contra el reporte de la vendedora ($58.000). Parece un pago fat-finger / de prueba de $1.

**Impacto:** distorsiona el saldo en $1 y el reporte de "debe". Trivial en monto, pero indica que el flujo de registro de pago no valida montos mínimos.

**Acción en la auditoría:** tratar el saldo real como $58.000 al decidir el caso 8; marcar el $1 para limpieza.

---

## BUG-ENC-03 — AR no se anula al cancelar+reembolsar un encargo

**Severidad:** media (los reportes de CxC sobre-cuentan activos falsos)

Caso real (Camila Hernández, Pumarejo): el encargo web `ENC-2026-0038` fue **cancelado** y su pago de **$346.000 reembolsado** (`balance_entries`: +346.000 el 2026-03-11, −346.000 el 2026-04-10, nota "Cancelación encargo ENC-2026-0038"). Sin embargo su registro en `accounts_receivable` quedó **`is_paid=true`, `amount=346.000`, `amount_paid=346.000`** — como si fuera una cobranza viva. Lo mismo en el duplicado `ENC-2026-0037`.

**Impacto:** el aging / total de CxC cuenta $692.000 ($346K × 2) de receivables fantasma sobre dos órdenes canceladas. Confundió a la propia vendedora ("hay un pago que no tiene sentido"). El ledger de caja (`balance_entries`) **sí** está correcto (neto cero); la inconsistencia vive en la tabla `accounts_receivable`.

**Fix sugerido:** al cancelar un encargo, marcar/anular sus `accounts_receivable` asociadas (estado `cancelled` o `amount=0`), no dejarlas `is_paid=true`. Auditar cuántas AR huérfanas hay sobre `orders.status='CANCELLED'`.

---
