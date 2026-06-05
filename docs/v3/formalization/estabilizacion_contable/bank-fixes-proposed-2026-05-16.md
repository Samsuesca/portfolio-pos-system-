# Fixes Propuestos para Conciliación Bancaria

Generado: 2026-05-16T23:24:55-05:00 (Colombia)

> Lista accionable derivada del diagnóstico. Cada item es una **propuesta** que requiere review y aprobación antes de aplicar.

## 1. Asientos faltantes en el sistema

Movimientos del banco sin contraparte en `balance_entries`. Propuesta: crear entry retroactivo en la cuenta del sistema.

- **Bancolombia**: 206 movs no registrados. Abonos faltantes $14,105,076.33, cargos faltantes $-9,359,522.37.
- **Nequi**: 362 movs no registrados. Abonos faltantes $10,132,685.72, cargos faltantes $-18,846,794.58.

## 2. Crear categorías en el sistema

Categorías que el sistema no rastrea como tales:

- **`bank_fee`** (4x1000, gravámenes, cuotas manejo) — actualmente estos cargos quedan sin clasificación. Crear como `ExpenseCategory.BANK_FEES`.
- **`financial_income`** (intereses ganados de cuentas de ahorro) — actualmente no se reconoce ingreso financiero. Crear como cuenta `INCOME.FINANCIAL`.

## 3. Marcar transferencias internas (7 pares)

Pares BC↔Nequi detectados automáticamente. En el sistema, cada par debe ser **1 sola operación** que mueve plata entre dos `balance_accounts` propias (no debe contar como ingreso ni gasto). Ver detalle completo en diagnóstico.

## 4. Reconciliar diferencias de saldo cuenta-banco

Ver tabla 'Comparación saldos' del diagnóstico. La diferencia representa el monto histórico que el sistema no rastreó. Posibles causas:

- Movimientos antes del periodo cargado (fixes pendientes)
- Errores de captura por vendedoras (no registraron ventas)
- Gastos personales pagados con cuenta del negocio
- Bug del sistema (`set_balance` no genera entry compensatoria)

## 5. Revisar `owner_drawing_candidate` (13 movs)

Movimientos con keywords típicos de gasto personal (YANBAL, TEMU, etc.). Decisión por movimiento:

- **(a) Gasto personal**: crear entry como `owner_drawing` (reduce patrimonio del propietario).
- **(b) Gasto operativo**: crear entry como `expense` con categoría adecuada.
- **(c) Reembolsable**: marcar como CxC contra el propietario.

**Lista completa**:

| Fecha | Descripción | Monto |
|---|---|---:|
| 2026-03-29 | YANBAL | $-858,310.00 |
| 2026-02-12 | YANBAL | $-797,665.00 |
| 2026-03-06 | YANBAL | $-382,825.00 |
| 2026-01-17 | YANBAL | $-370,362.50 |
| 2026-01-24 | TEMU | $-65,302.00 |
| 2026-02-14 | TEMU | $-65,090.00 |
| 2026-04-09 | TEMU | $-60,343.00 |
| 2026-03-05 | TEMU | $-60,276.00 |
| 2026-03-07 | TEMU | $-59,107.00 |
| 2026-01-05 | TEMU | $-50,941.00 |
| 2026-03-18 | Temucom | $-38,275.00 |
| 2026-04-18 | TEMU | $-32,509.00 |
| 2026-03-22 | Recarga desde: TEMU | $2,026.00 |
