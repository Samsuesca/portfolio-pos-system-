# Track Exacto de Movimientos Bancarios

Generado: 2026-05-17T13:49:03-05:00 (Colombia)

> Trazabilidad granular: cada movimiento clasificado por categoría y por status de conciliación contra `balance_entries` del sistema. Detalle completo en `bank-transactions-detail-<date>.csv`.

## Cobertura por banco y mes

| Banco | Mes | Total | Conciliado sistema | Pair interno | Sin match |
|---|---|---:|---:|---:|---:|
| Bancolombia | 2026-01 | 195 | 94 (50%) | 4 | 97 |
| Bancolombia | 2026-02 | 122 | 57 (47%) | 0 | 65 |
| Bancolombia | 2026-03 | 80 | 21 (30%) | 3 | 56 |
| Nequi | 2026-01 | 245 | 74 (32%) | 4 | 167 |
| Nequi | 2026-02 | 181 | 66 (36%) | 0 | 115 |
| Nequi | 2026-03 | 103 | 23 (24%) | 2 | 78 |
| Nequi | 2026-04 | 84 | 19 (24%) | 1 | 64 |

## Categorías × Estado de conciliación

| Categoría | Match sistema | Pair interno | Sin match | Total | Σ signed |
|---|---:|---:|---:|---:|---:|
| `needs_manual_review` | 0 | 0 | 203 | 203 | $-2,703,662.49 |
| `unknown` | 177 | 2 | 0 | 179 | $-7,678,990.00 |
| `sale_qr` | 121 | 0 | 57 | 178 | $21,387,500.00 |
| `bank_fee` | 0 | 0 | 162 | 162 | $-220,215.45 |
| `financial_income` | 0 | 0 | 77 | 77 | $1,464.54 |
| `transfer_external_via_nequi` | 0 | 0 | 74 | 74 | $4,225,500.00 |
| `internal_transfer` | 39 | 11 | 0 | 50 | $3,610,000.00 |
| `supplier_payment` | 9 | 1 | 33 | 43 | $-5,834,000.00 |
| `owner_drawing_candidate` | 2 | 0 | 18 | 20 | $-5,050,679.50 |
| `alteration_payment_candidate` | 4 | 0 | 10 | 14 | $1,638,000.00 |
| `cash_deposit` | 1 | 0 | 5 | 6 | $1,766,000.00 |
| `credit_card_payment` | 1 | 0 | 3 | 4 | $-2,695,363.00 |

## Top 50 movimientos `needs_manual_review`

> Sin categorizar automáticamente y sin match en el sistema. Estos son los que requieren ojo humano para clasificar.

| Fecha | Banco | Descripción | Monto |
|---|---|---|---:|
| 2026-01-31 | Nequi | AND*** FEL*** CAR*** DAG*** | $-1,590,000.00 |
| 2026-02-16 | Bancolombia | TRANSFERENCIA CTA SUC VIRTUAL | $-1,070,500.00 |
| 2026-03-25 | Bancolombia | TRANSFERENCIA CTA SUC VIRTUAL | $950,000.00 |
| 2026-03-03 | Nequi | AND*** FEL*** CAR*** DAG*** | $-934,700.00 |
| 2026-03-14 | Bancolombia | TRANSFERENCIA CTA SUC VIRTUAL | $-906,400.00 |
| 2026-03-11 | Nequi | Para HENRY HURTADO HIGUERA | $-900,000.00 |
| 2026-01-10 | Bancolombia | TRANSFERENCIA CTA SUC VIRTUAL | $-865,000.00 |
| 2026-02-13 | Nequi | JOH*** FRE*** ARG*** RAM*** | $-688,000.00 |
| 2026-02-12 | Nequi | DAN*** VAL*** SUA*** | $-650,000.00 |
| 2026-03-12 | Nequi | DAN*** VAL*** SUA*** | $-650,000.00 |
| 2026-03-12 | Bancolombia | PAGO PSE ENLACE OPERATIVO S.A | $-519,800.00 |
| 2026-02-12 | Bancolombia | PAGO PSE ENLACE OPERATIVO S.A | $-519,500.00 |
| 2026-03-07 | Nequi | De LUISA FERNANDA SUAREZ | $501,000.00 |
| 2026-03-30 | Bancolombia | TRANSFERENCIA CTA SUC VIRTUAL | $-490,000.00 |
| 2026-01-06 | Bancolombia | TRANSFERENCIA CTA SUC VIRTUAL | $480,000.00 |
| 2026-03-03 | Nequi | JOH*** FRE*** ARG*** RAM*** | $-463,000.00 |
| 2026-02-03 | Bancolombia | TRANSFERENCIA CTA SUC VIRTUAL | $-456,000.00 |
| 2026-01-05 | Bancolombia | TRANSFERENCIA CTA SUC VIRTUAL | $-432,000.00 |
| 2026-03-14 | Nequi | De JUAN ESTEBAN POLO | $368,000.00 |
| 2026-02-16 | Bancolombia | TRANSFERENCIA CTA SUC VIRTUAL | $362,000.00 |
| 2026-02-24 | Nequi | INVERSIONES EL CONRO SAS | $-352,000.00 |
| 2026-01-19 | Bancolombia | TRANSFERENCIA CTA SUC VIRTUAL | $348,000.00 |
| 2026-02-21 | Nequi | De NICOL CAMILA NARVAEZ | $346,000.00 |
| 2026-03-26 | Bancolombia | TRANSFERENCIA CTA SUC VIRTUAL | $-339,000.00 |
| 2026-01-30 | Nequi | Para GUILLERMO ANTONIO | $-300,000.00 |
| 2026-03-12 | Nequi | Retiro en corresponsales | $-300,000.00 |
| 2026-01-18 | Bancolombia | TRANSFERENCIA CTA SUC VIRTUAL | $296,000.00 |
| 2026-01-06 | Nequi | PAGO FACTURA EPM | $-293,423.00 |
| 2026-04-10 | Nequi | De GERALDINE JARAMILLO | $286,000.00 |
| 2026-02-26 | Nequi | RECIBI POR BRE-B DE: JAVIER | $274,000.00 |
| 2026-01-09 | Nequi | ERI*** JOH*** PIN*** RAI*** | $-270,000.00 |
| 2026-01-03 | Bancolombia | TRANSFERENCIA CTA SUC VIRTUAL | $263,000.00 |
| 2026-01-03 | Bancolombia | TRANSFERENCIA CTA SUC VIRTUAL | $254,000.00 |
| 2026-01-05 | Bancolombia | TRANSFERENCIA CTA SUC VIRTUAL | $-250,000.00 |
| 2026-01-20 | Bancolombia | TRANSFERENCIA CTA SUC VIRTUAL | $250,000.00 |
| 2026-03-24 | Bancolombia | TRANSFERENCIA CTA SUC VIRTUAL | $250,000.00 |
| 2026-01-20 | Nequi | De PAOLA ANDREA VELEZ | $250,000.00 |
| 2026-03-05 | Nequi | De YESMITH ADRIANA VEGA | $247,000.00 |
| 2026-01-05 | Bancolombia | TRANSFERENCIA CTA SUC VIRTUAL | $-245,000.00 |
| 2026-03-30 | Bancolombia | TRANSFERENCIA CTA SUC VIRTUAL | $-230,000.00 |
| 2026-02-09 | Nequi | De LUZ EDILIA JARAMILLO | $230,000.00 |
| 2026-03-02 | Nequi | De ISABEL CRISTINA RIOS | $229,000.00 |
| 2026-02-26 | Nequi | De JAVIER SANTIAGO SUESCA | $226,000.00 |
| 2026-01-21 | Nequi | De LUIS FERNANDO BEDOYA | $222,000.00 |
| 2026-02-08 | Bancolombia | TRANSFERENCIA CTA SUC VIRTUAL | $220,000.00 |
| 2026-01-25 | Bancolombia | TRANSFERENCIA CTA SUC VIRTUAL | $208,000.00 |
| 2026-01-23 | Nequi | De GLORIA PARRA GANAN | $205,000.00 |
| 2026-04-17 | Nequi | RETIRO EN CAJERO | $-200,000.00 |
| 2026-01-30 | Nequi | WIL*** D*** JES*** GRA*** ZAP*** | $-200,000.00 |
| 2026-01-24 | Bancolombia | TRANSFERENCIA CTA SUC VIRTUAL | $197,000.00 |

## Contrapartes recurrentes (candidatos a proveedores/clientes)

> Nombres que aparecen ≥3 veces en transacciones sin conciliar. Indica relación de negocio recurrente — vale la pena catalogarlos.

| Contraparte (raw) | N apariciones | Total signed | Cuentas |
|---|---:|---:|---|
| MONICA YULIANA RAMOS | 3 | $278,000.00 | NEQUI_3001234567 |
| DUVAN VICENTE VERGARA | 2 | $-66,000.00 | NEQUI_3001234567 |
| WILSON FELIPE SUESCA | 3 | $56,000.00 | NEQUI_3001234567 |
| ANDRES GARCIA | 2 | $-55,000.00 | NEQUI_3001234567 |
| CLAUDIA MARIA CARDONA | 2 | $0.00 | NEQUI_3001234567 |
