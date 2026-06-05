# Diagnóstico de Conciliación Bancaria

Generado: 2026-05-16T23:24:55-05:00 (Colombia)

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
| `unknown` | 450 | $30,190,271.51 | $-49,675,987.00 |
| `sale_qr` | 178 | $21,387,500.00 | $0.00 |
| `bank_fee` | 162 | $0.00 | $-220,215.45 |
| `internal_transfer` | 124 | $13,497,650.00 | $-5,662,150.00 |
| `financial_income` | 77 | $1,464.54 | $0.00 |
| `owner_drawing_candidate` | 13 | $2,026.00 | $-2,841,005.50 |
| `cash_deposit` | 6 | $1,766,000.00 | $0.00 |

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
| 2026-01-31 | Nequi | `unknown` | AND*** FEL*** CAR*** DAG*** | $-1,590,000.00 |
| 2026-02-04 | Bancolombia | `unknown` | PAGO SUC VIRT TC MASTER PESOS | $-1,171,565.00 |
| 2026-02-16 | Bancolombia | `unknown` | TRANSFERENCIA CTA SUC VIRTUAL | $-1,070,500.00 |
| 2026-03-06 | Bancolombia | `unknown` | PAGO SUC VIRT TC MASTER PESOS | $-1,041,598.00 |
| 2026-02-25 | Bancolombia | `cash_deposit` | CONSIGNACION CORRESPONSAL CB | $1,000,000.00 |
| 2026-01-21 | Nequi | `unknown` | Para WILSON JAVIER SUESCA | $-1,000,000.00 |
| 2026-01-21 | Nequi | `unknown` | Para WILSON JAVIER SUESCA | $-1,000,000.00 |
| 2026-03-25 | Bancolombia | `unknown` | TRANSFERENCIA CTA SUC VIRTUAL | $950,000.00 |
| 2026-03-03 | Nequi | `unknown` | AND*** FEL*** CAR*** DAG*** | $-934,700.00 |
| 2026-03-14 | Bancolombia | `unknown` | TRANSFERENCIA CTA SUC VIRTUAL | $-906,400.00 |
| 2026-03-11 | Nequi | `unknown` | Para HENRY HURTADO HIGUERA | $-900,000.00 |
| 2026-01-10 | Bancolombia | `unknown` | TRANSFERENCIA CTA SUC VIRTUAL | $-865,000.00 |
| 2026-03-29 | Nequi | `owner_drawing_candidate` | YANBAL | $-858,310.00 |
| 2026-02-12 | Nequi | `owner_drawing_candidate` | YANBAL | $-797,665.00 |
| 2026-01-25 | Nequi | `unknown` | Para JOSE MANUEL CETINA | $-700,000.00 |
| 2026-02-13 | Nequi | `unknown` | JOH*** FRE*** ARG*** RAM*** | $-688,000.00 |
| 2026-02-12 | Nequi | `unknown` | DAN*** VAL*** SUA*** | $-650,000.00 |
| 2026-03-12 | Nequi | `unknown` | DAN*** VAL*** SUA*** | $-650,000.00 |
| 2026-03-12 | Bancolombia | `unknown` | PAGO PSE ENLACE OPERATIVO S.A | $-519,800.00 |
| 2026-02-12 | Bancolombia | `unknown` | PAGO PSE ENLACE OPERATIVO S.A | $-519,500.00 |
| 2026-03-07 | Nequi | `unknown` | De LUISA FERNANDA SUAREZ | $501,000.00 |
| 2026-03-30 | Bancolombia | `unknown` | TRANSFERENCIA CTA SUC VIRTUAL | $-490,000.00 |
| 2026-01-06 | Bancolombia | `unknown` | TRANSFERENCIA CTA SUC VIRTUAL | $480,000.00 |
| 2026-03-03 | Nequi | `unknown` | JOH*** FRE*** ARG*** RAM*** | $-463,000.00 |
| 2026-02-03 | Bancolombia | `unknown` | TRANSFERENCIA CTA SUC VIRTUAL | $-456,000.00 |
| 2026-01-26 | Bancolombia | `cash_deposit` | CONSIGNACION CORRESPONSAL CB | $450,000.00 |
| 2026-01-05 | Bancolombia | `unknown` | TRANSFERENCIA CTA SUC VIRTUAL | $-432,000.00 |
| 2026-03-06 | Nequi | `owner_drawing_candidate` | YANBAL | $-382,825.00 |
| 2026-01-17 | Nequi | `owner_drawing_candidate` | YANBAL | $-370,362.50 |
| 2026-03-14 | Nequi | `unknown` | De JUAN ESTEBAN POLO | $368,000.00 |

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
