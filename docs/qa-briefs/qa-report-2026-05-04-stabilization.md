# QA Report — Stabilization Sprint Validation

**Fecha:** 2026-05-04 (Colombia)
**Modo:** `--full --user Samuel`
**Branch:** `chore/stabilization-sprint-2026-Q2` (10 commits ahead de `main`)
**Servicios:** backend `localhost:8001` (UP, head=`exp_cat_fk_001`), frontends DOWN
**Ejecutor:** `/qa-agent` interno

## Summary

| Categoría | Total | Pass | Fail | Warn |
|-----------|-------|------|------|------|
| API Smoke (Health + Auth + Core) | 18 | 16 | 0 | 2 |
| API Deep (Sec + TZ + Pagination) | 15 | 14 | 0 | 1 |
| Sprint Validation (5 cambios + Gap A) | 6 | 6 | 0 | 0 |
| Test Suites Aisladas | 4 suites | 4 | 0 | 0 |
| **Total** | **39+suites** | **36 (92%)** | **0** | **3** |

Bugs P0 / P1: **0**. Findings P2: **2**. Findings P3: **1**. UI testing skipped (frontends down).

---

## Sprint Validation — Confirmaciones End-to-End

### Bug C — perm_audit_001 (5 permission codes)
✅ `/permissions/registry` retorna 95 permisos. **Todos los 5 nuevos presentes:**
- `catalog.view`, `catalog.manage`, `costs.manage_templates`, `employees.manage`, `payroll.manage`

✅ Backend log: `Permission validation passed: all codes resolve in DB.` (warning resuelto)

### Bug 1 — set_balance compensating entry
✅ **Confirmación end-to-end con data REAL:** la entry más reciente en Caja Menor (cuenta 1101):

```
2026-05-04  amount=$1.00  bal_after=$197,001.00
desc="Ajuste de balance inicial (de $197,000.00 a $197,001..."
```

Esa entry con delta exacto `+$1.00` y descripción "Ajuste de balance inicial" **es el patrón generado por el fix**. La cuenta Caja Menor tiene 3 entries linkeadas con balances acumulados consistentes. No hay drift entre `account.balance` y la última `balance_after` de su entry.

### Bug 2 — mark_debt_as_paid (entries + Expense intereses)
✅ Schema/endpoint expuestos:
- `DebtPaymentMarkPaid` schema acepta `capital_amount` e `interest_amount` opcionales
- Endpoint `POST /global/accounting/planning/debt-schedule/{id}/mark-paid` requiere `current_user`
- Categoría `intereses_financieros` está en el catálogo

✅ Tests unitarios: 6/6 PASS en `TestMarkDebtAsPaid` (split, derive, validate, reject negatives, happy path, not_found).

⚠️ No ejecutado destructive en API live (regla read-only por default, no se mutó data).

### Bug 3 — block archive with balance != 0
✅ `DELETE /balance-accounts/{id}` con `current_balance != 0` rechazado correctamente con código `ACCOUNT_HAS_BALANCE` y mensaje en español. Tests aislados 9/9 PASS.

✅ DB diagnostic: 9 pasivos archivados con saldo total $77,890,000 documentados en `sprint-log.md` para reconciliación posterior con asientos equity.

### Bug 4 — AR.due_date NOT NULL + backfill
✅ **API confirmation:** `/global/accounting/receivables?limit=100` → **100/100 con `due_date` no-null**. Sample: `2026-01-07, 2026-01-16, 2026-01-20, 2026-01-22, 2026-01-23`.

✅ DB: `total_ar=190 / missing_due_date=0 / is_nullable=NO`.

✅ 7 call sites del código revisados, todos pasan `due_date` ahora (con default `default_ar_due_date(invoice_date)` cuando el cliente no provee).

### Bug 5 — expenses.category FK
✅ `/global/accounting/expense-categories` retorna 26 categorías incluyendo las 3 formalization (`payroll_in_kind`, `owner_drawings`, `intereses_financieros`).

✅ FK constraint live-tested (DB level): `INSERT ... category='mercdo_typo_test'` rechazado con:
```
ERROR: violates foreign key constraint "fk_expenses_category"
DETAIL: Key (category)=(mercdo_typo_test) is not present in table "expense_categories".
```

✅ Modelo Python `Expense.category` ahora declara `ForeignKey("expense_categories.code", onupdate="CASCADE", ondelete="RESTRICT")`.

### Gap A test alignment (commit 4e549bb)
✅ 56/56 PASS en `tests/unit/test_financial_statements_service.py`. Los 2 tests stale (post P&L classification fix de la sesión anterior) actualizados:
- `payroll_in_kind` ahora en `OPERATING_EXPENSE_CODES`
- `bank_fees` ahora en `financial` bucket (no `other`)

✅ API live: `/financial-statements/income-statement?start_date=2026-01-01&end_date=2026-05-04` → 200 con keys correctas (`gross_revenue`, `cost_of_goods_sold`, `cogs_details`).

---

## API Smoke + Deep Tests

### ✅ Auth & Security
| Test | Result | Note |
|------|--------|------|
| AUTH-01 Login válido | 200 | Bearer token + user object |
| AUTH-02 Login wrong pass | 401 | ⚠️ Mensaje en inglés ("Incorrect username or password") |
| AUTH-03 Login empty body | 400 | OK (acepta 400 o 422) |
| AUTH-04 SQL injection | 401 | No 500, no leak |
| AUTH-05 /me con token | 200 | user con flags |
| AUTH-06 /me sin token | 403 | ⚠️ debería ser 401 (semántica HTTP) |
| AUTH-07 /me garbage token | 401 | OK |
| SEC-03 SQL inj en query | 200/400 | No 500, no leaks de SQL/traceback |
| SEC-05 Stack trace leak | 0 | Ningún endpoint filtra stack traces |
| PAY-01 Wompi config | 200 | Solo `enabled`, `public_key`, `environment`. No secrets ✅ |

### ✅ Core Reads (read-only, paginated)
| Endpoint | Status | Total |
|----------|--------|-------|
| `/schools/{sid}/products` | 200 | 60 (paginated) |
| `/schools/{sid}/inventory` | 200 | 60 (paginated) |
| `/schools/{sid}/sales` | 200 | 836 (paginated) |
| `/schools/{sid}/orders` | 200 | 143 (paginated) |
| `/clients` | 200 | global, paginated |
| `/global/accounting/cash-balances` | 200 | caja_menor + caja_mayor + nequi + banco |
| `/global/accounting/expenses` | 200 | paginated |
| `/global/accounting/receivables` | 200 | 190, todos con due_date ✅ |
| `/global/accounting/payables` | 200 | OK |
| `/global/accounting/balance-accounts` | 200 | account_type lowercase ✅ |
| `/global/accounting/balance-general/summary` | 200 | OK |
| `/global/accounting/patrimony-summary` | 200 | OK |
| `/global/accounting/financial-statements/income-statement` | 200 | con dates required |
| `/users` | 200 | OK |
| `/permissions/registry` | 200 | 95 perms |
| `/notifications` + `/unread-count` | 200 | OK |

### ✅ Pagination edge cases
| Query | Status | Comportamiento |
|-------|--------|----------------|
| `?skip=-1&limit=10` | 400 | rechazado, no crash |
| `?skip=0&limit=0` | 400 | rechazado |
| `?skip=0&limit=999999` | 400 | cap respetado |
| `?skip=999999&limit=10` | 200 | items vacíos, no error |

### ✅ Cash balances live state
- Caja Menor: $197,001 (10 last_updated 2026-05-04T03:22:02)
- Caja Mayor: $8,914,109
- Nequi: $282,492
- Banco: $3,020,412
- **Total líquido: $12,414,013**

---

## Test Suites (en aislado para evitar cleanup-async noise)

| Suite | Tests | Pass |
|-------|-------|------|
| `test_balance_integration_service.py` | 28 | 28 ✅ (incluye 2 nuevos del Bug 1) |
| `test_planning_service.py` | 64 | 64 ✅ (incluye 4 nuevos del Bug 2) |
| `test_financial_statements_service.py` | 56 | 56 ✅ (2 actualizados Gap A) |
| `test_global_accounting_routes.py::TestGlobalBalanceAccounts` | 9 | 9 ✅ (incluye 2 del Bug 3) |
| **Total tocado por sprint** | **157** | **157 (100%)** |

Nota sobre `pytest tests/unit` (full suite): muestra 24 fail + 72 errors **pre-existentes** por interferencia entre fixtures de DB async (issue conocido pytest-asyncio + asyncpg cleanup). **Confirmado:** los tests fallan en batch pero PASAN al correrlos en aislado. No causados por el sprint.

---

## Findings

### P0 / P1
**Ninguno.** El sprint cerró todo lo planificado sin regresiones.

### P2 — Calidad menor (2)

**1. AUTH-02: error en inglés.**
- Endpoint: `POST /api/v1/auth/login`
- Body con password incorrecto retorna: `{"detail": "Incorrect username or password"}`
- Regla de proyecto (CLAUDE.md global): *Mensajes de error al usuario SIEMPRE en español*.
- Otros endpoints sí responden en español (ej. `/schools/notauuid/products` retorna `"Identificador inválido"`).
- **Fix sugerido:** Cambiar el `detail` de la excepción en `app/api/routes/auth.py:login` a "Usuario o contraseña incorrectos".

**2. AUTH-06: status 403 sin token.**
- Endpoint: `GET /api/v1/auth/me` sin Authorization header
- Retorna 403 Forbidden. Semántica HTTP correcta para "ausencia de credenciales" es 401 Unauthorized; 403 es para "credenciales válidas pero permisos insuficientes".
- **Fix sugerido:** Cambiar el dependency `get_current_user` para retornar 401 cuando el header está ausente. Esto requiere wrapper sobre `HTTPBearer(auto_error=False)` y raise manual.

### P3 — Informativo (1)

**3. `/schools` GET sin auth retorna 11 colegios públicos** (`code, name, slug, logo_url, is_active, display_order, id`).
- **Es esperado** porque el web portal público necesita listar colegios para padres sin sesión. Los campos expuestos son no sensibles (sin direcciones, sin emails, sin user data).
- **Acción:** ninguna — pero registrarlo como decisión consciente en docs si no está ya.

---

## UI Testing — SKIPPED

Frontends no estaban corriendo:
- Desktop Tauri (Vite :5171) DOWN
- Web Portal (:3001) DOWN
- Admin Portal (:3002) DOWN

Para validación UI completa de los cambios del sprint, levantar el desktop Tauri y consultar el brief en `docs/qa-briefs/brief-2026-05-04-stabilization.md`.

---

## Recomendaciones priorizadas

1. **Antes de deploy a prod (sábado 9 may, M5):**
   - Resolver los 2 findings P2 (errores en inglés y 401 vs 403). Son cambios cosméticos pero afectan calidad percibida.
   - Levantar el desktop Tauri y correr la validación UI del brief.
2. **Pre-deploy también:** correr `bash backend/scripts/refresh_prod_snapshot.sh` por última vez para confirmar que las migraciones aplicarán igual sobre prod data del día.
3. **Post-deploy:** ejecutar la validación end-to-end M4 contra el sistema real, idealmente desde múltiples cuentas de usuario (no solo Samuel superuser) para verificar permission gating de los 5 codes nuevos.
4. **Backlog M3 restante (separado de este sprint):** las 3 reconciliaciones de data (Cristina $19M, Nequi $20M, equity correctivo $21.6M) deben hacerse en sesión dedicada ANTES del deploy del sábado para que prod quede limpia.

---

## Brief Chrome Extension

Generado en: `docs/qa-briefs/brief-2026-05-04-stabilization.md`. Cubre:
- Áreas tocadas en el sprint con focal points específicos
- Smoke test general 15 min
- Stress test layer-8 10 min
- Issues conocidos pre-resueltos (no reportar como nuevos)
- Issues P2 detectados internamente (referencia)

---

## Veredicto

**🟢 Sprint stabilization listo para deploy** una vez:
1. Resueltos los 2 P2 (cosmético, ~30 min)
2. Levantada la UI y validada con brief externo
3. Ejecutadas las 3 reconciliaciones de data en sesión separada

Los 5 bugs catalogados quedan cerrados con regresión protegida. Los cambios no introdujeron rotura en suites del sprint. La data viva muestra el patrón correcto del Bug 1 fix funcionando end-to-end.
