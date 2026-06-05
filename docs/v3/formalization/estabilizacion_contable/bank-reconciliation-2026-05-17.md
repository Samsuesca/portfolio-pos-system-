# Diagnóstico de Conciliación Bancaria

Generado: 2026-05-17T13:49:03-05:00 (Colombia)

## Archivos importados

| Banco | Periodo | Origen | Movs | Apertura | Cierre | Abonos | Cargos |
|---|---|---|---:|---:|---:|---:|---:|
| Bancolombia | 2025-12-31 → 2026-03-31 | xlsx | 397 | $628,121.91 | $8,879,125.87 | $34,889,576.33 | $26,638,572.37 |
| Nequi | 2026-01-01 → 2026-01-31 | pdf | 245 | $254,063.12 | $3,335,027.20 | $14,709,909.07 | $11,628,944.99 |
| Nequi | 2026-02-01 → 2026-02-28 | pdf | 181 | $3,335,027.20 | $3,046,834.60 | $10,400,139.42 | $10,688,332.02 |
| Nequi | 2026-03-01 → 2026-03-31 | pdf | 103 | $3,046,834.60 | $364,789.88 | $4,435,181.78 | $7,117,226.50 |
| Nequi | 2026-04-01 → 2026-04-30 | pdf | 84 | $364,789.88 | $448,613.26 | $2,410,105.45 | $2,326,282.07 |

## Resumen por cuenta

| Banco | Movs totales | Conciliados internos | Conciliados sistema | Sin conciliar |
|---|---:|---:|---:|---:|
| Bancolombia (54089567338) | 397 | 7 | 172 | 218 |
| Nequi (3001234567) | 613 | 7 | 182 | 424 |

## Distribución por categoría (auto)

| Categoría | N movs | Total abonos | Total cargos |
|---|---:|---:|---:|
| `needs_manual_review` | 203 | $13,917,271.51 | $-16,620,934.00 |
| `unknown` | 179 | $14,635,000.00 | $-22,313,990.00 |
| `sale_qr` | 178 | $21,387,500.00 | $0.00 |
| `bank_fee` | 162 | $0.00 | $-220,215.45 |
| `financial_income` | 77 | $1,464.54 | $0.00 |
| `transfer_external_via_nequi` | 74 | $8,152,500.00 | $-3,927,000.00 |
| `internal_transfer` | 50 | $5,345,150.00 | $-1,735,150.00 |
| `supplier_payment` | 43 | $0.00 | $-5,834,000.00 |
| `owner_drawing_candidate` | 20 | $2,026.00 | $-5,052,705.50 |
| `alteration_payment_candidate` | 14 | $1,638,000.00 | $0.00 |
| `cash_deposit` | 6 | $1,766,000.00 | $0.00 |
| `credit_card_payment` | 4 | $0.00 | $-2,695,363.00 |

## Transferencias internas detectadas

**Total pares:** 7

| Fecha out | Banco out | Descripción out | Monto | Fecha in | Banco in | Δ días |
|---|---|---|---:|---|---|---:|
| 2026-01-03 | Bancolombia | TRANSFERENCIAS A NEQUI | $90,000.00 | 2026-01-05 | Nequi | 2 |
| 2026-01-14 | Bancolombia | TRANSFERENCIAS A NEQUI | $384,150.00 | 2026-01-14 | Nequi | 0 |
| 2026-01-15 | Bancolombia | TRANSFERENCIA CTA SUC VIRTUAL | $50,000.00 | 2026-01-16 | Nequi | 1 |
| 2026-01-25 | Nequi | Para WILSON JAVIER SUESCA | $40,000.00 | 2026-01-27 | Bancolombia | 2 |
| 2026-03-22 | Bancolombia | TRANSFERENCIAS A NEQUI | $156,000.00 | 2026-03-22 | Nequi | 0 |
| 2026-03-29 | Bancolombia | TRANSFERENCIAS A NEQUI | $700,000.00 | 2026-03-29 | Nequi | 0 |
| 2026-03-30 | Bancolombia | TRANSFERENCIAS A NEQUI | $20,000.00 | 2026-04-01 | Nequi | 2 |

## Conciliación contra balance_entries del sistema

- Total matches: **354** (exactos 20, alta 307, fuzzy 27)


## Top 30 movimientos SIN match (gaps)

> Transacciones del banco que NO tienen contraparte en el sistema. Son candidatas a ser asientos faltantes en la app, gastos personales, o ingresos no registrados.

| Fecha | Banco | Categoría | Descripción | Monto |
|---|---|---|---|---:|
| 2026-02-05 | Bancolombia | `transfer_external_via_nequi` | TRANSFERENCIAS A NEQUI | $-2,000,000.00 |
| 2026-01-31 | Nequi | `needs_manual_review` | AND*** FEL*** CAR*** DAG*** | $-1,590,000.00 |
| 2026-02-04 | Bancolombia | `credit_card_payment` | PAGO SUC VIRT TC MASTER PESOS | $-1,171,565.00 |
| 2026-02-16 | Bancolombia | `needs_manual_review` | TRANSFERENCIA CTA SUC VIRTUAL | $-1,070,500.00 |
| 2026-03-06 | Bancolombia | `credit_card_payment` | PAGO SUC VIRT TC MASTER PESOS | $-1,041,598.00 |
| 2026-02-25 | Bancolombia | `cash_deposit` | CONSIGNACION CORRESPONSAL CB | $1,000,000.00 |
| 2026-01-21 | Nequi | `supplier_payment` | Para WILSON JAVIER SUESCA | $-1,000,000.00 |
| 2026-01-21 | Nequi | `supplier_payment` | Para WILSON JAVIER SUESCA | $-1,000,000.00 |
| 2026-03-25 | Bancolombia | `needs_manual_review` | TRANSFERENCIA CTA SUC VIRTUAL | $950,000.00 |
| 2026-03-03 | Nequi | `needs_manual_review` | AND*** FEL*** CAR*** DAG*** | $-934,700.00 |
| 2026-03-14 | Bancolombia | `needs_manual_review` | TRANSFERENCIA CTA SUC VIRTUAL | $-906,400.00 |
| 2026-03-11 | Nequi | `needs_manual_review` | Para HENRY HURTADO HIGUERA | $-900,000.00 |
| 2026-01-10 | Bancolombia | `needs_manual_review` | TRANSFERENCIA CTA SUC VIRTUAL | $-865,000.00 |
| 2026-03-29 | Nequi | `owner_drawing_candidate` | YANBAL | $-858,310.00 |
| 2026-01-26 | Bancolombia | `transfer_external_via_nequi` | TRANSFERENCIA DESDE NEQUI | $800,000.00 |
| 2026-03-27 | Bancolombia | `transfer_external_via_nequi` | TRANSFERENCIAS A NEQUI | $-800,000.00 |
| 2026-02-12 | Nequi | `owner_drawing_candidate` | YANBAL | $-797,665.00 |
| 2026-01-25 | Nequi | `supplier_payment` | Para JOSE MANUEL CETINA | $-700,000.00 |
| 2026-02-13 | Nequi | `needs_manual_review` | JOH*** FRE*** ARG*** RAM*** | $-688,000.00 |
| 2026-02-12 | Nequi | `needs_manual_review` | DAN*** VAL*** SUA*** | $-650,000.00 |
| 2026-03-12 | Nequi | `needs_manual_review` | DAN*** VAL*** SUA*** | $-650,000.00 |
| 2026-03-04 | Bancolombia | `transfer_external_via_nequi` | TRANSFERENCIA DESDE NEQUI | $600,000.00 |
| 2026-01-06 | Bancolombia | `transfer_external_via_nequi` | TRANSFERENCIAS A NEQUI | $-550,000.00 |
| 2026-03-25 | Bancolombia | `transfer_external_via_nequi` | TRANSFERENCIA DESDE NEQUI | $550,000.00 |
| 2026-03-12 | Bancolombia | `needs_manual_review` | PAGO PSE ENLACE OPERATIVO S.A | $-519,800.00 |
| 2026-02-12 | Bancolombia | `needs_manual_review` | PAGO PSE ENLACE OPERATIVO S.A | $-519,500.00 |
| 2026-03-07 | Nequi | `needs_manual_review` | De LUISA FERNANDA SUAREZ | $501,000.00 |
| 2026-02-25 | Bancolombia | `transfer_external_via_nequi` | TRANSFERENCIA DESDE NEQUI | $500,000.00 |
| 2026-03-30 | Bancolombia | `needs_manual_review` | TRANSFERENCIA CTA SUC VIRTUAL | $-490,000.00 |
| 2026-01-06 | Bancolombia | `needs_manual_review` | TRANSFERENCIA CTA SUC VIRTUAL | $480,000.00 |

## Comparación saldos: sistema vs banco real

> Saldo del sistema = `balance_accounts.balance` en prod_snapshot al momento del refresh. Saldo banco = cierre del último extracto cargado.

| Cuenta | Sistema (DB) | Banco (último cierre) | Diferencia | Periodo banco |
|---|---:|---:|---:|---|
| Bancolombia | $1,181,414.00 | $8,879,125.87 | $-7,697,711.87 | 2026-03-31 |
| Nequi | $391,492.00 | $448,613.26 | $-57,121.26 | 2026-04-30 |

## Categorías sin tracking sistemático

> Tipos de movimientos que el banco genera regularmente pero el sistema no rastrea como categoría dedicada. Insight: confirma la observación del owner que **no hubo control de intereses ni 4x1000**.

- **`bank_fee`**: 162 movimientos, total $-220,215.45
- **`financial_income`**: 77 movimientos, total $1,464.54
