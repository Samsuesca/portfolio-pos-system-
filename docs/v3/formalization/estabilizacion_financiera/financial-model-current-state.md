# Estado actual del Modelo Financiero en la app UCR

> **Última actualización:** 2026-05-02
> **Ejecución:** `docker exec uniformes-backend python scripts/run_financial_model.py` contra dev (uniformes_db, snapshot ~13 abr)

---

## Resumen ejecutivo

El sistema **YA TIENE el modelo financiero implementado** (P&L, Balance Sheet, Patrimonio, CFO Dashboard, Planning con cash projection y debt schedule). Lo que está mal es:

1. **Calidad del dato contable** — categorías mal usadas, gastos personales mezclados con negocio.
2. **Configuración de clasificación** — whitelist de categorías no contempla las que el negocio realmente usa.
3. **Equity sin registrar** — balance no cuadra ($127M de diferencia) por falta de capital aportado.

Una vez arreglados estos tres puntos, **el modelo financiero existente es suficiente** para casi todo lo que necesitas. No requiere reescribir nada — requiere data quality y configuración.

---

## Lo que está implementado y funciona

### Servicios backend operativos

| Servicio | Estado | Comentario |
|----------|--------|------------|
| `PatrimonyService.get_global_patrimony_summary()` | ✅ Funciona | Genera resumen completo con activos, pasivos, patrimonio. Usa lógica correcta. |
| `FinancialStatementsService.get_income_statement()` | ✅ Funciona | P&L con revenue, COGS, gross profit, OpEx, other expenses, net income. **Pero clasificación de categorías está mal configurada.** |
| `FinancialStatementsService.get_balance_sheet()` | ⚠️ Funciona pero no cuadra | Balance correcto en activos/pasivos, pero **equity falta** (capital aportado = 0). Diferencia $127M. |

### Endpoints REST disponibles (`/global/accounting/`)

| Endpoint | Propósito |
|----------|-----------|
| `/cash-balances` | Saldos Caja, Banco, Nequi |
| `/balance-general/summary` y `/detailed` | Balance general con desglose |
| `/patrimony/summary` y `/patrimony-summary` | Patrimonio consolidado global |
| `/cash-flow` | Flujo de caja por período |
| `/financial-statements/income-statement` | P&L |
| `/financial-statements/balance-sheet` | Balance General |
| `/financial-statements/periods` | Períodos contables |
| `/financial-snapshots` (CRUD) | Snapshots inmutables |
| `/transfers` | Transferencias entre cuentas |
| `/planning/dashboard` | Dashboard de planning |
| `/planning/sales-seasonality` | Estacionalidad de ventas |
| `/planning/cash-projection` | Proyección de caja |
| `/planning/debt-schedule` | Cronograma de deudas |
| `/planning/generate-pending-interest` | **Generar intereses pendientes** ← justo lo que necesitas para los $19M de préstamos |
| `/planning/import-liabilities` | Importar pasivos |

### Frontend operativo

- **`/cfo` — CFO Dashboard:** health score 0-100, liquidez, deuda, DSCR, cash runway, payroll cost, alertas críticas/advertencia, breakdown por categoría.
- `/accounting` — Panel contable.
- `/reports` — Reportes operativos.

---

## P&L ejecutado YTD 2026 (data dev al 13 abr)

```
Ingresos brutos:             $80,696,000
  Descuentos/devoluciones:      -$342,000
Ingresos netos:              $80,354,000  (745 ventas)

Costo de ventas (COGS):      $49,707,900   (cobertura 69.1% — 30.9% estimado al 80%)
─────────────────────────────────────────
UTILIDAD BRUTA:              $30,646,100   (38.1%) ✅

Gastos operativos:           $54,543,768   ← problema acá
  rent                        $5,496,000
  utilities                   $2,405,868
  payroll                     $6,540,900
  supplies                      $742,800
  transport                     $319,500
  maintenance                   $195,000
  marketing                     $355,000
  ── Subtotal ops reales:    $16,055,068 ✅
  deuda                      $30,137,200  ⚠️ NO es gasto, son pagos de capital
  prestamos                   $3,641,000  ⚠️ Mezclado: tarjetas, adelantos, gastos
  mercado                     $2,687,900  ⚠️ Personal (alimentación)
  ocio                        $1,553,200  ⚠️ Personal (entretenimiento)
  viaticos                      $212,000  ⚠️ Personal
  comida                         $57,400  ⚠️ Personal
  descuento                     $200,000  ⚠️ Ya restado del revenue
  ── Distorsión:             $38,488,700  ⚠️

UTILIDAD OPERATIVA:         -$23,897,668  (-29.7%)  ❌ Falsa pérdida

Otros gastos:                 $5,234,630
  bank_fees                     $184,300
  other                       $4,935,430  ⚠️ Categoría comodín
  taxes                         $114,900

UTILIDAD NETA:              -$29,132,298  (-36.3%)  ❌ Falsa pérdida
```

### P&L ajustado (tras limpieza de categorías y mezcla personal)

```
Ingresos netos:              $80,354,000
COGS:                        $49,707,900
UTILIDAD BRUTA:              $30,646,100  (38.1%)

OpEx limpio:                $16,055,068   (sin deuda, prestamos, personal, descuento)
UTILIDAD OPERATIVA:          $14,591,032  (18.2%)  ✅

Otros gastos legítimos:        $299,200   (bank_fees + taxes)
"other" $4.9M                            (a revisar — categoría comodín)
UTILIDAD NETA estimada:     ~$10,000,000 (12-13%)  ✅ saludable
```

**Esto es la realidad del negocio:** ~$10M utilidad neta en 4 meses, proyectado anual ~$25-35M. Con margen neto 12-13% — saludable para retail con confección.

---

## Los tres gaps a cerrar

### Gap A — Configuración de categorías mal hecha 🔴

**Archivo:** `backend/app/services/financial_statements.py` líneas 40-59.

**Cambio necesario:** ampliar las constantes de clasificación.

```python
OPERATING_EXPENSE_CODES = {
    "rent", "utilities", "payroll", "supplies",
    "transport", "maintenance", "marketing",
}

OTHER_EXPENSE_CODES = {
    "taxes", "bank_fees", "other",
}

EXCLUDED_EXPENSE_CODES = {
    "inventory", "confeccion", "prod_fabric", "prod_tailoring",
    "prod_embroidery", "prod_accessories", "prod_other",
    # AGREGAR:
    "discounts", "descuento",  # ya restado del revenue
    "deuda",                    # pago de capital (reduce pasivo, no gasto)
    "mercado", "ocio", "comida", "viaticos",  # personales del propietario
    "prestamos",  # mezclado, requiere depuración previa
}

# Considerar agregar nueva categoría:
FINANCIAL_EXPENSE_CODES = {
    "intereses_financieros",
    "bank_fees",
}
```

**Impacto del fix:** P&L pasa de mostrar `-$29M pérdida` a `~$10M utilidad`, sin cambiar un dato real. Solo reclasifica.

**Plus:** se debe crear la nueva categoría `intereses_financieros` en el enum de `ExpenseCategory` para registrar los $550k/mes de los préstamos vigentes.

---

### Gap B — Equity / capital aportado sin registrar 🔴

**Síntoma:** `balance_sheet.is_balanced: false`, `balance_difference: $127M`.

**Causa:** la fórmula contable es `Activos = Pasivos + Patrimonio`. Hoy el sistema tiene activos $98M y pasivos $61k, pero no hay capital aportado registrado. El sistema solo registra `current_period_earnings` que es la utilidad del período.

**Solución:** registrar en `balance_accounts` (o nueva tabla `equity_accounts`) la cuenta de capital aportado por el propietario. Históricamente sería:

- Cuenta "Capital aportado por Consuelo Ríos" — todo lo que CR ha puesto al negocio (efectivo, máquinas, inventario inicial).
- Cuenta "Resultados acumulados" — utilidades retenidas de años anteriores.
- Cuenta "Resultado del período" — utilidad/pérdida del año en curso (lo que ya calcula).

Esto es contabilidad básica. Lo puede hacer un contador en una sesión.

---

### Gap C — Calidad del dato contable 🟠

Confirmado vía SQL contra prod_snapshot:
- 4.9% del gasto YTD son **personales** mezclados (mercado, ocio, comida, viaticos).
- 47-53% del inventario tiene **costo estimado** al 80% (no real).
- Categoría `other` $4.9M es **comodín** — falta clasificar.
- Cuentas `prestamos` y `deuda` están **mezcladas** — pagos de capital, intereses, tarjetas, adelantos a empleados, gastos personales conviven sin separación.

**Soluciones (ya documentadas en `03-contable.md`):**
- C0a: cuenta bancaria del negocio.
- C0b: reclasificar gastos personales históricos.
- Migración v3 (en marcha) corrige inventario y AR.

---

## Lo que SÍ falta implementar (vs financial-model-design.md)

Comparando con `docs/v3-branch-architecture/financial-model-design.md`:

| Componente diseñado | Estado actual |
|---------------------|---------------|
| AccountingPeriod + FinancialSnapshot | ✅ Implementado (`/financial-snapshots`, `/financial-statements/periods`) |
| ReportsService P&L | ✅ Implementado |
| Balance Sheet | ✅ Implementado (con bug de equity) |
| Cash Flow Report | ✅ Implementado (`/cash-flow`) |
| KPIService | ⚠️ Parcial — el CFO Dashboard tiene KPIs pero no hay servicio dedicado |
| **ProjectionService** (12-24 meses, escenarios) | ❌ **NO implementado** — el diseño lo tiene pero no hay código |
| BudgetService (presupuestos) | ❌ NO implementado |
| FinancialAlertService | ⚠️ Parcial (CFO Dashboard tiene alertas) |
| SnapshotService | ✅ Implementado |
| Dashboard ejecutivo (frontend) | ✅ CFODashboard.tsx (433 LOC) |
| Página `/finance/projections` | ❌ NO implementado |
| Página `/finance/budgets` | ❌ NO implementado |
| Página `/finance/sensitivity` | ❌ NO implementado |
| Export XLSX/PDF | ❌ NO implementado |

---

## Bugs detectados

### Bug 1 — Cartesian product warning (CORREGIDO 2026-05-02)

`SAWarning: SELECT statement has a cartesian product between vendors and expenses`. Causa: `_get_other_expenses_details` seleccionaba `Expense.vendor` directamente cuando ahora es relationship (post-v3 vendor normalization). **Fix aplicado** en `financial_statements.py` usando outerjoin explícito a `Vendor`.

### Bug 2 — `mark_debt_as_paid` no genera asiento contable (PENDIENTE)

**Síntoma:** marcar una cuota como pagada no afecta caja, no crea gasto de intereses, no reduce el pasivo. Solo cambia el status del `DebtPaymentSchedule`.

**Impacto:** los usuarios terminan creando manualmente un `Expense` con categoría `deuda` o `prestamos` y todo va al P&L, distorsionando los EEFF.

**Flujo correcto que debería ejecutar:**

```python
async def mark_debt_as_paid(payment_id, paid_amount, payment_account_id):
    payment = await get_debt_payment_schedule(payment_id)
    liability = payment.balance_account

    # 1. Reducir caja
    await create_balance_entry(payment_account_id, amount=-paid_amount, ...)

    # 2. Bifurcar según tipo
    if payment.category == "interest":
        await create_expense("intereses_financieros", paid_amount, ...)
    elif payment.category == "capital":
        liability.balance -= paid_amount
    elif payment.category == "mixed":
        await create_expense("intereses_financieros", payment.interest_portion)
        liability.balance -= payment.capital_portion

    # 3. Archivar si llegó a 0
    if liability.balance <= 0:
        liability.is_active = False

    payment.status = PAID
```

**Prerequisitos:**
- Crear categoría `intereses_financieros` en `ExpenseCategory` enum.
- Definir si los $300k mensuales del Préstamo 1 son interest-only o mixed (decisión del owner según contrato).
- Migración de data histórica: revisar pagos existentes y reclasificar.

---

## Plan de acción priorizado

### Inmediato (esta semana)

1. **Fix Gap A** — actualizar `OPERATING_EXPENSE_CODES` y `EXCLUDED_EXPENSE_CODES` en `financial_statements.py`. 10 líneas de código. **El P&L reportado pasa de -$29M a ~$10M sin cambiar un dato.**
2. **Crear categoría `intereses_financieros`** en el enum `ExpenseCategory` para registrar los $550k/mes.
3. **Investigar y arreglar** SAWarning de cartesian product.

### Corto plazo (este mes)

4. **Fix Gap B** — agregar cuentas de equity en balance_accounts: "Capital aportado", "Resultados acumulados", "Resultado del período".
5. **Reclasificar histórico** — gastos personales mezclados → categoría owner_drawings o equivalente.
6. **Registrar los 2 préstamos vigentes** en balance_accounts con `is_active=true`.

### Mediano plazo (Q3 2026)

7. **Implementar ProjectionService** del diseño (12-24 meses, escenarios, sensitivity tables). Esto es lo que el `cfo-strategist` haría externamente — pero como parte de la app es activo vendible para v3.2 SaaS.
8. **BudgetService + alertas** según diseño.
9. **Export XLSX/PDF** estilo OndaFin.

### Para v3.2 (SaaS comercializable)

10. **Multi-tenant del modelo financiero** — cada cliente del SaaS tiene su propio `accounting_periods`, `financial_snapshots`, `budgets`, etc. con `organization_id`. Hoy todo es global UCR.

---

## Decisión sobre cfo-strategist

Dado que el modelo financiero **ya existe en la app** y los gaps son de configuración y data quality, **NO es necesario invocar al cfo-strategist** para producir un Excel externo de proyecciones inmediatas. La inversión correcta es:

1. **Cerrar Gap A y B** (semana actual) — 1 día de dev.
2. **Implementar ProjectionService faltante** (Q3 2026) — feature commercial para v3.2.
3. **Cuando ProjectionService esté listo**, la app misma genera las proyecciones que el cfo-strategist haría externamente, y son entregable de UCR a sus futuros clientes SaaS.

El cfo-strategist sigue siendo útil para:
- Análisis estratégico macro (decisión SAS, refinanciamiento, expansión).
- Validación de la lógica del ProjectionService cuando se implemente.
- Sensitivity analysis ad-hoc no soportado por la app.
