# Sprint Log — Stabilization Sprint 2026 Q2

> **Branch:** `chore/stabilization-sprint-2026-Q2`
> **Cronograma:** LUN 4 may → SÁB 9 may 2026 (6 días)
> **Owner:** Angel Samuel Suesca Ríos
> **Plan maestro:** [ROADMAP.md](ROADMAP.md)

Documento vivo. Cada milestone agrega su entrada con: qué se hizo, qué quedó dónde, comando de rollback. No es post-mortem, es bitácora en vivo.

---

## M1 — Setup del entorno de trabajo

**Cuándo:** LUN 4 may 2026, ~02:00–02:15 (UTC-5)
**Sesión:** [9027bf2b…41541fc963c1](../../../../.claude/projects/-Users-angelsamuelsuescarios-Documents-03-Proyectos-Codigo-uniformes-system-v2/9027bf2b-ab90-4674-b7a6-41541fc963c1.jsonl)

### Acciones ejecutadas

| # | Paso | Resultado |
|---|------|-----------|
| M1.1 | Commit reorganización `docs/formalization/` → `docs/v3/formalization/` + drop `docs/development/git-workflow.md` + `.gitignore` (replace `ListasPrecios/`/`ListaPrecios/` → `documentos/`) | `e52d1c3` (26 files, +664/-933) |
| M1.2 | Push de 131 commits acumulados a `origin/main` | `79b201f..e52d1c3` — 3362 objetos transferidos, 2069 deltas resueltos |
| M1.3 | Crear branch `chore/stabilization-sprint-2026-Q2` desde `main@e52d1c3` | Branch local activa |
| M1.4 | Backup pre-sprint de `uniformes_db` (estado dev pre-mezcla con prod) | `~/Documents/03_Proyectos/Codigo/ucr-backups/dev_pre_sprint_20260504_0204.sql` (4.7MB, 71 tablas, 27,447 líneas) |
| M1.5 | Refresh de `uniformes_prod_snapshot` desde producción vía SSH+`pg_dump` | Dump en `/tmp/ucr-snapshots/prod_20260504_0206.sql` (5.0MB) — last_sale: 2026-05-03 |
| M1.6 | `DROP DATABASE uniformes_db WITH (FORCE)` + `CREATE` + restore desde dump prod | Dev DB ahora con data prod fresh (20MB) — alembic head: `a4b5c6d7e8f9` (pre-v3) |

### Estado pre-M1 vs post-M1

| Item | Pre-M1 | Post-M1 |
|------|--------|---------|
| `origin/main` HEAD | `79b201f` | `e52d1c3` (131 commits ahead → 0) |
| Branch local activa | `main` | `chore/stabilization-sprint-2026-Q2` |
| `uniformes_db` schema head | `merge_stab_001_unify_heads` (v3 mergeado) | `a4b5c6d7e8f9` (estado prod) |
| `uniformes_db` data | dev sintética/desactualizada | data prod hasta 2026-05-03 (1,537 ventas, 306 órdenes, 169 alterations, 464 expenses, 1,969 balance_entries) |
| `uniformes_prod_snapshot` | versión vieja | refrescado al 2026-05-04 02:06 |
| Backend container | corriendo | apagado intencionalmente (espera v3, falla queries hasta M2) |

### Snapshot de DBs en Docker

```
 datname                 | size
-------------------------+---------
 uniformes_db            | 20 MB   ← data prod fresh, schema pre-v3
 uniformes_prod_snapshot | 20 MB   ← misma data, read-only para análisis
 uniformes_test          | 7785 kB ← intacto
```

### Plan de rollback de M1

Si M2 explota irrecuperablemente y queremos volver al estado pre-sprint:

```bash
# 1. Drop dev DB corrupta
docker exec uniformes-postgres psql -U uniformes_user -d postgres \
  -c "DROP DATABASE uniformes_db WITH (FORCE);"

# 2. Recrear vacía
docker exec uniformes-postgres psql -U uniformes_user -d postgres \
  -c "CREATE DATABASE uniformes_db;"

# 3. Restore backup pre-sprint
cat ~/Documents/03_Proyectos/Codigo/ucr-backups/dev_pre_sprint_20260504_0204.sql \
  | docker exec -i uniformes-postgres psql -U uniformes_user -d uniformes_db

# 4. Volver a main si la branch del sprint es inservible
git checkout main
git branch -D chore/stabilization-sprint-2026-Q2  # solo si decisión es aborto total
```

Estado tras rollback: dev vuelve a `merge_stab_001_unify_heads` con data sintética. Producción nunca se tocó.

### Decisiones registradas

- **Backend apagado deliberadamente.** Levantarlo ahora produce errores (modelos esperan tablas/columnas v3). Se reactiva en M2 después de `alembic upgrade head` exitoso.
- **`uniformes_test` no se tocó.** Los tests de pytest siguen contra él; M3 puede correr suite sin que la data del sprint contamine.
- **Trabajo paralelo del owner respetado.** Las nuevas dimensiones `05-datos-personales.md` y `06-comercial.md` (fuera del scope sprint) quedan untracked esperando commit del owner.

### Pendientes para M2

1. Ejecutar `cd backend && alembic upgrade head` desde la branch del sprint.
2. Si falla `unify_step2`/`unify_step3` (los pasos pesados de `unify_units` con data real), debugear con agente `alembic-master` en background.
3. Validar que el backend levante sin errores tras la migración.
4. Smoke test de endpoints críticos (`/health`, `/me`, `/global/accounting/*`).

---

## M2 — Aplicar v3 sobre data prod fresh

**Cuándo:** LUN 4 may 2026, 02:55:26 → 02:55:28 (UTC-5) — duración real: **2 segundos**

### Acciones ejecutadas

| # | Paso | Resultado |
|---|------|-----------|
| M2.1 | Backup adicional del estado de partida (data prod, schema pre-v3) | `~/Documents/03_Proyectos/Codigo/ucr-backups/m2_pre_upgrade_20260504_0253.sql` (4.7MB) |
| M2.2 | Dry-run con `alembic upgrade head --sql` para detectar issues offline | Falló por bug conocido en `b4f40f2b4bc1_add_debt_payment_schedule.py` (usa `result.fetchone()` que es `None` en modo offline). No bloquea online. |
| M2.3 | `docker exec uniformes-backend alembic upgrade head` real | exit=0, head=`v3codes001` |
| M2.4 | `docker restart uniformes-backend` para recargar con schema fresco | "Application startup complete" + Telegram digest + InventoryLog DLQ workers running |
| M2.5 | Smoke test `/api/v1/openapi.json` | OpenAPI 3.1 válido, API operativa |

### Migraciones aplicadas (28 en total)

Cadena lineal desde `a4b5c6d7e8f9` (prod) hasta `v3codes001` (head). Las pesadas con data:

- `unify_step1` → nullable + partial indexes
- `unify_step2` → copy global data into unified tables
- `unify_step3` → remap FKs (sin output explícito, ejecutó silencioso)
- `vendor_norm_a/b/c` → tabla vendors poblada con 97 registros desde strings legacy
- `inv_reserved_qty` → backfill desde pending orders
- `v3codes001` → remap final con counts visibles:
  - sale_items remapped: **609**
  - order_items product_id: **38**
  - order_items garment_type_id: **38**
  - sale_changes: **8**
  - order_changes: **2**
  - cost_component_templates: **12**
  - product_cost_components: **0**
  - inventory_logs: **483**

### Estado pre-M2 vs post-M2

| Métrica | Pre-M2 | Post-M2 |
|---------|--------|---------|
| alembic_head | `a4b5c6d7e8f9` | `v3codes001` ✅ |
| size | 20 MB | 22 MB (+índices/tablas v3) |
| sales | 1,537 | 1,537 ✅ |
| orders | 306 | 306 ✅ |
| alterations | 169 | 169 ✅ |
| expenses | 464 | 464 ✅ |
| balance_entries | 1,969 | 1,969 ✅ |
| vendors (nueva tabla) | — | 97 |
| financial_projections (nueva) | — | 0 |
| failed_inventory_logs (DLQ nueva) | — | 0 |

**Cero pérdida de filas en tablas existentes.** Las 3 tablas nuevas v3 fueron creadas y `vendors` se pobló automáticamente por `vendor_norm_b`.

### Deuda detectada en startup

Backend logueó al arrancar:

> `Permission validation warning: Permission codes referenciados en rutas pero ausentes en DB (posible typo o seed faltante): ['catalog.manage', 'catalog.view', 'costs.manage_templates', 'employees.manage', 'payroll.manage']`

5 permission codes están en decoradores `require_permission(...)` de rutas pero no existen en la tabla `permissions`. **No bloquea M2** (no rompe arranque), pero usuarios sin superuser que peguen esos endpoints recibirían error indefinido. Resolver en M3 actualizando el seed de permissions.

### Plan de rollback de M2

```bash
# 1. Drop dev DB con migraciones aplicadas
docker exec uniformes-postgres psql -U uniformes_user -d postgres \
  -c "DROP DATABASE uniformes_db WITH (FORCE);"
docker exec uniformes-postgres psql -U uniformes_user -d postgres \
  -c "CREATE DATABASE uniformes_db;"

# 2. Restore al punto de partida de M2 (prod fresh sin v3)
cat ~/Documents/03_Proyectos/Codigo/ucr-backups/m2_pre_upgrade_20260504_0253.sql \
  | docker exec -i uniformes-postgres psql -U uniformes_user -d uniformes_db
```

Tras rollback: dev queda con data prod hasta 2026-05-03 + alembic head `a4b5c6d7e8f9`. Equivalente al estado post-M1, pre-M2.

### Pendientes para M3

1. Atacar los 5 bugs catalogados en [stabilization-session-prompt.md](prompts/stabilization-session-prompt.md):
   - `set_balance` no genera entry compensatoria ($21.6M trazabilidad perdida)
   - `mark_debt_as_paid` silent (no separa capital/interés)
   - Archivado de pasivos con balance > 0
   - AR sin `due_date`
   - `expenses.category` sin FK
2. Agregar los 5 permission codes faltantes al seed (deuda detectada arriba).
3. Reclasificación masiva de gastos (mercado/ocio → payroll_in_kind/owner_drawings).
4. Asientos de equity para refinanciamiento Cristina.
5. Reconciliación de ajuste Nequi $20M (pendiente owner).

---

## M3 — Estabilización contable

> Comprende: limpieza de deuda detectada en M2, fix de los 5 bugs catalogados de contabilidad, reclasificación masiva de gastos, asientos de equity para refinanciamiento Cristina, reconciliación de Nequi $20M.

### M3.deuda — `perm_audit_001`: 5 permission codes faltantes en seed (2026-05-04)

Resolución de la deuda detectada por el startup audit en M2.

- Migración `perm_audit_001` (down_revision=`v3codes001`).
- Inserta 5 codes en `permissions` + asigna a system roles consistente con `SYSTEM_ROLE_PERMISSIONS`:

  | code | category | is_sensitive | roles |
  |------|----------|--------------|-------|
  | `catalog.view` | catalog | no | viewer, seller, admin, owner |
  | `catalog.manage` | catalog | no | admin, owner |
  | `costs.manage_templates` | costs | no | admin, owner |
  | `employees.manage` | employees | no | admin, owner |
  | `payroll.manage` | payroll | **sí** | admin, owner |

- Idempotente (`SELECT ... WHERE code` antes de insertar) y reversible.
- Tras restart: backend log dice `Permission validation passed: all codes resolve in DB.` (warning eliminado).

### M3.bug1 — `set_balance` no generaba entry compensatoria (2026-05-04)

Auditoría de los 13 puntos donde se muta `account.balance` en el código:

| Punto | Estado pre-fix |
|-------|----------------|
| `global_accounting.py:initialize_global_accounts` (endpoint) | 🔴 Mutaba `caja.balance = X` y `banco.balance = X` directo |
| `balance_integration.py:initialize_global_accounts` (service) | 🟡 Cuenta existente: asignaba balance directo; entry solo si `initial_balance != 0` (caso edge: re-llamar con 0 wipea sin trazabilidad) |
| `global_accounting.py:set_global_account_balance` | ✅ Genera entry |
| `balance_integration.py:apply_transaction_to_balance` | ✅ |
| `balance_integration.py:apply_transfer` | ✅ ambos lados |
| `balance_integration.py:record_expense_payment*` | ✅ |
| `balance_integration.py:record_income` | ✅ |
| `balance_accounts.py:BalanceEntryService.create_entry` | ✅ |
| `patrimony.py:set_initial_balance` | ✅ delta-based |
| `cash_register.py` liquidación caja menor | ✅ ambos lados |

**Fix aplicado:**

1. `balance_integration.py:initialize_global_accounts`: para cuentas existentes, calcular `delta = new - current`, mutar balance + emitir `BalanceEntry(amount=delta, balance_after=new, reference="INICIAL")` SOLO si `delta != 0`. Patrón ya validado en `patrimony.set_initial_balance`.
2. `global_accounting.py:initialize_global_accounts` (endpoint): eliminar la doble lógica de mutación directa, delegar todo al service que ya maneja el flujo auditado.

**Tests:**
- 2 tests existentes (`test_creates_accounts_with_initial_balances`, `test_updates_existing_account_balances`) siguen pasando.
- 2 tests nuevos de regresión:
  - `test_existing_account_balance_change_emits_compensating_entry`: cuenta con balance 500_000 → 750_000 emite entry con `amount=250_000`, `balance_after=750_000`, `reference="INICIAL"`.
  - `test_existing_account_no_change_emits_no_entry`: cuenta con balance 500_000 → 500_000 no emite spam.
- 4/4 PASSED en `pytest tests/unit/test_balance_integration_service.py::TestInitializeGlobalAccounts`.

**Lo que NO arregla (por scope):** los $21.6M históricos en producción ya fueron asignados por la versión vieja sin entry. Eso queda para reconciliación manual en M3.bug2+ (los siguientes bugs de la lista) cuando se cuadre el balance real vs entries con un asiento de equity correctivo.

### M3.bug2 — `mark_debt_as_paid` silent (2026-05-04)

`PlanningService.mark_debt_as_paid` solo cambiaba `status`/`paid_*` en la fila del schedule. **No creaba `BalanceEntry`, no reducía la cuenta de pago, no reducía el pasivo asociado, y no registraba intereses como gasto.** Resultado en producción: deudas marcadas como pagadas con cero impacto contable trazable.

**Diseño del fix (decisión consciente):** mantener el modelo `DebtPaymentSchedule` sin migración (no separa capital/interés a nivel de schema todavía), y exponer el split como **parámetros opcionales del método y el endpoint**. Política de derivación:

- Si no se pasa nada → `capital = paid_amount`, `interest = 0` (compat con clientes existentes).
- Si se pasa solo `interest_amount` → capital se deriva como `paid_amount - interest`.
- Si se pasa solo `capital_amount` → interés se deriva como `paid_amount - capital`.
- Si se pasan ambos → deben sumar exactamente `paid_amount` (else `ValueError → 400`).
- Ambos `>= 0`.

**Comportamiento ahora correcto:**
1. **Cuenta de pago (cash/bank)** se reduce por `paid_amount` con `BalanceEntry(amount=-paid_amount, balance_after=new, reference=PAGO-DEUDA-{id})`. Lock con `with_for_update()`.
2. **Pasivo asociado** (si `payment.balance_account_id` está seteado) se reduce solo por `capital_amount` con su propio `BalanceEntry`. Capital amount se asienta contra el pasivo, no contra el cash.
3. **Intereses** se registran como `Expense(category="intereses_financieros", amount=interest_amount, is_paid=True, payment_account_id=payment_account_id, paid_at=now)`. La categoría `intereses_financieros` ya existe en el enum desde `exp_cat_002`.
4. La fila del schedule queda con `status=PAID`, `paid_amount`, etc. Como antes.

**Endpoint:** `POST /api/v1/global/accounting/planning/debt-schedule/{id}/mark-paid` ahora recibe `current_user` (para `created_by` en las entries y el expense), captura `ValueError` del service y lo traduce a HTTP 400.

**Schema:** `DebtPaymentMarkPaid` agrega dos campos opcionales `capital_amount`/`interest_amount` (`Decimal | None`, `ge=0`).

**Tests:**
- 1 test happy_path original adaptado al nuevo mocking (`setup_execute_returns` con returns secuenciales: payment + cash account).
- 4 tests nuevos:
  - `test_split_capital_and_interest`: split explícito → 2 BalanceEntry (cash + liability) + 1 Expense con la categoría correcta.
  - `test_one_side_derives_the_other`: solo `interest_amount` → capital se infiere y se aplica al pasivo correctamente.
  - `test_split_must_sum_to_paid`: 400k + 50k != 500k → `ValueError`.
  - `test_negative_amounts_rejected`: capital negativo → `ValueError`.
- 6/6 PASSED en `tests/unit/test_planning_service.py::TestMarkDebtAsPaid`. Suite completa: 64/64 PASSED.

**Lo que NO arregla:** las deudas marcadas como pagadas en producción con la versión vieja están en estado `paid` sin entries asociadas. Eso requiere reconciliación manual con asientos de equity correctivos (M3 Bug 8 — equity correctivo $21.6M, junto con los demás).

### M3.bug3 — Archivado de balance_accounts con saldo != 0 (2026-05-04)

`DELETE /api/v1/global/accounting/balance-accounts/{id}` simplemente hacía `account.is_active = False` sin validar `balance`. Resultado en producción: **9 pasivos viejos archivados con saldo total de $77.89M oculto** de los reportes que filtran por `is_active=true`, pero contablemente vivos en la DB.

**Lista detectada en `uniformes_db` (post-M2):**

| code | name | creditor | balance |
|------|------|----------|---------|
| 2201 | Prestamo Cristina | — | $39,000,000 |
| 2204 | Prestamo | Maria Cristina | $10,000,000 |
| 2205 | Préstamo | Maria C | $10,000,000 |
| 2208 | Préstamo | Grupo Corporativo | $7,000,000 |
| 2203 | Prestamo | Maria Lopez | $3,000,000 |
| 2202 | Prestamo | Elizabet | $3,000,000 |
| 2207 | Préstamo | Daniel | $3,000,000 |
| 2206 | Prestamo | Maria C | $2,000,000 |
| 2101 | Tarjeta de Credito Computador | Tarjeta Bancolombia | $890,000 |
| **TOTAL** | | | **$77,890,000** |

(Nota: `2201` $39M es la deuda Cristina que el owner confirmó como refinanciada — $20M pagados + $19M trasladados a `2204+2208` por valor $17M y a `2206` por $2M. El residual y la duplicidad aparente con `2205` quedan para reconciliación M3.cristina con asientos equity.)

**Fix aplicado al endpoint** (`backend/app/api/routes/global_accounting.py:delete_global_balance_account`):

```python
if account.balance != Decimal("0"):
    raise HTTPException(
        status_code=400,
        detail={
            "code": "ACCOUNT_HAS_BALANCE",
            "message": f"No se puede archivar '{account.name}' porque su saldo es ${account.balance:,.2f}. Liquide la cuenta o reasigne el saldo (refinanciamiento, transferencia, ajuste de equity) antes de archivar.",
            "current_balance": float(account.balance),
        },
    )
```

Política: estricta. No hay flag de bypass. Caso refinanciamiento (Cristina) se resuelve aparte con asientos contables formales en M3.cristina, no por archivado silencioso.

**Tests:**
- `test_delete_balance_account_success` actualizado: cuenta con `balance=0` → 204 (mismo flujo que antes pero con saldo cero, que era la asunción implícita del "happy path" original).
- Nuevo `test_delete_balance_account_with_balance_rejected`: cuenta con `balance=5_000_000` → 400 con `code=ACCOUNT_HAS_BALANCE`, `current_balance=5_000_000.0`, y verifica que la cuenta sigue `is_active=True` (no se archivó parcialmente).
- `test_delete_caja_not_allowed` no se tocó.
- 3/3 PASSED en `tests/api/test_global_accounting_routes.py -k "delete_balance or delete_caja"`.

### M3.bug4 — AR sin `due_date` (2026-05-04)

Estado real post-fresh data: **163 de 190 receivables con `due_date IS NULL`** (no 57 como decía la auditoría inicial; la data fresh de prod incrementó la población). Sin `due_date` poblado, los reportes de aging y la detección de overdue son ciegos.

**Fix en 3 capas:**

1. **Migración `ar_due_date_001`** (`down_revision=perm_audit_001`):
   - Backfill: `UPDATE accounts_receivable SET due_date = COALESCE(invoice_date, created_at::date) + INTERVAL '30 days' WHERE due_date IS NULL`. Idempotente.
   - `ALTER COLUMN due_date SET NOT NULL`.
   - Reversible (downgrade vuelve a nullable).
   - Aplicada: 190 AR / 0 con NULL / `is_nullable=NO`.

2. **Modelo** (`backend/app/models/accounting.py`): `due_date: Mapped[date]` (sin `| None`), `nullable=False`. Comment apunta al sprint y al helper que aporta el default a nivel de service.

3. **Default centralizado** en `backend/app/services/accounting/receivables.py`:
   ```python
   DEFAULT_AR_CREDIT_TERM_DAYS = 30
   def default_ar_due_date(invoice_date: date) -> date:
       return invoice_date + timedelta(days=DEFAULT_AR_CREDIT_TERM_DAYS)
   ```
   Aplicado en los 7 call sites donde se construye `AccountsReceivable` directamente, reemplazando los previos `due_date=None` literales y los casos donde `delivery_date` (nullable en Order) se pasaba sin fallback:

   | Archivo | Antes | Ahora |
   |--------|-------|-------|
   | `services/accounting/receivables.py:create_receivable` | `data.due_date` | `data.due_date or default_ar_due_date(data.invoice_date)` |
   | `api/routes/global_accounting.py:create_global_receivable` | `receivable_data.due_date` | idem |
   | `services/sale/payments.py:111` | `due_date=None` | `default_ar_due_date(invoice_date)` |
   | `services/sale/creation.py:241` | `due_date=None` | `default_ar_due_date(invoice_date)` |
   | `services/order/creation.py:262` | `order_data.delivery_date` | `delivery_date or default_ar_due_date(invoice)` |
   | `services/order/creation.py:589` | `order_data.delivery_date` | idem |
   | `services/order/changes.py:478` | `order.delivery_date` | `delivery_date or default_ar_due_date(invoice)` |
   | `services/sale/changes.py:467` | (no se pasaba) | `default_ar_due_date(invoice)` |

**Tests:** 109 PASSED en `tests/unit -k "receivable or planning or balance_integration"` (todo lo afectado, incluyendo los regression tests previos de M3.bug1 y M3.bug2). Smoke test live: backend sirviendo `GET /api/v1/notifications/unread-count → 200 7.4ms`.

**Side note observado al diagnosticar:** el enum `account_type_enum` en la DB tiene labels en MAYÚSCULAS (`LIABILITY_LONG`, `ASSET_CURRENT`...) pero el código usa lowercase (`liability_long`, `asset_current`...). Aparente mismatch entre código y DB; SQLAlchemy lo está manejando por mapping. Pendiente para revisar con `alembic-master` en M4 o como sub-bug si causa el side-effect.

### M3.bug5 — `expenses.category` sin FK (2026-05-04)

`expenses.category` era `varchar(50)` libre. Cualquier typo (e.g. `mercdo` en vez de `mercado`) terminaba en producción sin queja, fragmentando reportes y categorías.

**Estado pre-fix:**
- 24 categorías distintas en uso (`payroll`, `mercado`, `other`, `ocio`, ..., `descuento`).
- Todas resolvían en `expense_categories` por casualidad — la data viva estaba limpia.
- Sin FK ni constraint que lo proteja a futuro.

**Migración `exp_cat_fk_001`** (`down_rev=ar_due_date_001`):
1. Pre-flight: si quedara cualquier `expense.category` huérfano (`LEFT JOIN expense_categories WHERE code IS NULL`) la migración aborta con `RuntimeError` listando los códigos. Ninguno detectado.
2. Crea constraint `uq_expense_categories_code` (UNIQUE explícito; antes solo había unique index, lo cual algunas versiones de PG no aceptan como destino FK).
3. Crea FK `fk_expenses_category` con `ON UPDATE CASCADE ON DELETE RESTRICT`. Cascade permite renombrar un code (raro pero limpio); RESTRICT bloquea borrar una categoría con expenses asociados (impide huérfanos).
4. Idempotente (skip si la constraint UNIQUE ya existe).

**Modelo Python:** `Expense.category` ahora declara `ForeignKey("expense_categories.code", onupdate="CASCADE", ondelete="RESTRICT")` para que SQLAlchemy esté sincronizado con la DB.

**Verificación viva:**
```
INSERT INTO expenses (..., category='mercdo_typo_test', ...);
ERROR:  insert or update on table "expenses" violates foreign key constraint "fk_expenses_category"
DETAIL:  Key (category)=(mercdo_typo_test) is not present in table "expense_categories".
```

Backend booteo limpio, API sirviendo (`/api/v1/openapi.json` 200).

**Tests detectados como stale (no introducidos por Bug 5):** 2 tests en `tests/unit/test_financial_statements_service.py` fallan por cambios que hice en la sesión anterior (Gap A: `payroll_in_kind` agregado a `OPERATING_EXPENSE_CODES`, `bank_fees` movido de `other` a `financial`). Se arreglan en commit separado siguiente.

### M3 — Cierre parcial (~2026-05-16)

**Hecho efectivamente en el sprint:**

- ✅ Bug 1 → Bug 5: todos cerrados con tests de regresión (ver entradas arriba).
- ✅ `perm_audit_001`: 5 permission codes faltantes seedados.
- ✅ Gap A — equity opening balance reconstruction (commit `4e549bb` aligns stale assertions con el fix).
- ✅ Side-effect del enum `account_type_enum` MAYÚSCULAS vs lowercase: investigado, SQLAlchemy lo mapea, no rompe. Sin migración requerida.
- ✅ Tests stale en `test_financial_statements_service.py` arreglados (Gap A propagation: `payroll_in_kind` agregado a `OPERATING_EXPENSE_CODES`, `bank_fees` movido a `financial`).
- ✅ Branch `chore/stabilization-sprint-2026-Q2` mergeada a `main` con commit `9cb0913` ("Ready for production deployment").

**Pendientes M3 NO ejecutados (movidos al Track C de la nueva fase, ver [ROADMAP.md](ROADMAP.md)):**

| Pendiente | Razón del aplazamiento | Movido a |
|-----------|-----------------------|----------|
| Reclasificación masiva gastos `mercado`/`ocio` → `payroll_in_kind`/`owner_drawings` | Requiere decisión owner una a una; mejor abordar con `cfo-strategist` en session dedicada | Track C #1 |
| Asientos equity refinanciamiento Cristina ($19M) | Sin doc/contrato formal todavía | Track C #3 |
| Reconciliación Nequi $20M → $10 (5-ene) | Pendiente owner (clarificación con Consuelo) | Track C #4 |
| Asiento equity correctivo $21.6M (`set_balance` histórico) | Bloqueado por bank reconciliation track | Track C #2 |
| 4 audit scripts (balance, AR, expenses, data quality score) | No escritos. Auditoría ad-hoc por SQL mientras tanto | Track C #5 |
| Capture costs de 608 productos sin `cost` | Session dedicada con [`costs-importer-prompt.md`](prompts/costs-importer-prompt.md) | Track D |

---

## M4 — Validación E2E ⏸️ DIFERIDO

**Estado:** **no ejecutado** según el plan original (VIE 8 may).

**Lo que sí se hizo (parcial):**

- Smoke tests ad-hoc durante M3: `/api/v1/openapi.json` 200, `/api/v1/notifications/unread-count` 7.4ms.
- Suite pytest en módulos afectados: 109 PASSED (receivable/planning/balance_integration) + 64 PASSED (planning service completo).
- Backend boot limpio tras cada bug fix.
- Frontend Vitest verde tras cada cambio en panels del modelo financiero.

**Lo que NO se hizo:**

- `audit_data_quality_score.py` (no existe — el script nunca se escribió).
- P&L mensual 5 meses con `is_balanced: true` en cada cierre.
- Balance Sheet `Activos = Pasivos + Patrimonio` verificado mes a mes.
- Comparativa antes/después documentada en `stabilization-report-YYYY-MM-DD.md`.
- Frontend smoke completo: CFO Dashboard + FinancialModelTab + ProjectionService end-to-end con data nueva.

**Cuándo se retoma:** pre-requisito de M5 (deploy). Ver Track A del [ROADMAP](ROADMAP.md) actualizado.

---

## M5 — Deploy v3 a producción ⏸️ DIFERIDO

**Estado:** **no ejecutado.** Producción sigue en **v2.9.0** con la data sucia original al 2026-05-24.

**Lo que sí pasó alrededor de la fecha planeada (9 may):**

- El branch del sprint se mergeó a `main` (`9cb0913` el 2026-05-10 aprox). Quedó técnicamente listo para deploy.
- En lugar de disparar el deploy se priorizaron tracks paralelos que tomaron las 2 semanas siguientes:
  - pnpm 11 migration en los 4 sub-repos.
  - Electronic Invoicing DIAN activado vía Alegra (2026-05-16).
  - Mobile app MVP scaffolded.
  - Bank reconciliation system v1 + análisis 1010 transacciones.
  - Formalización 8-dim discovery (6/8 dimensiones documentadas).
  - Catalog stabilization session HOY (2026-05-24).
  - Equipo bitácoras + payroll seed.
  - Financial model hardening (KPIs, validation, multi-phase payroll).

**Decisión retroactiva:** el aplazamiento fue **deliberado y razonable** dado el leverage estratégico de los tracks paralelos. Pero ya pasaron 15 días — Track A del ROADMAP nuevo debe agendar ventana concreta.

**Cuándo se retoma:** sin ventana asignada todavía. Pre-requisitos en Track A de [ROADMAP.md](ROADMAP.md) nueva fase.

**Plan técnico del deploy** (sigue válido, preservado en ROADMAP anexo "MILESTONE 5").

---

## Cierre del Sprint Q2

**Status formal:** **cerrado parcialmente el 2026-05-24.**

- ✅ M1, M2 completos al 100% según plan.
- ✅ M3 completo en los 5 bugs catalogados + Gap A + permisos. **Parcial** en los 7 sub-temas de reclasificación/equity correctivo/audit scripts (movidos a Track C de la nueva fase).
- ⏸️ M4 diferido.
- ⏸️ M5 diferido (prod sigue v2.9.0).

**Sprint branch:** `chore/stabilization-sprint-2026-Q2` mergeada a `main` (`9cb0913`). Branch local y remota pueden borrarse cuando se desee (no hay trabajo huérfano).

**Siguiente doc maestro:** [ROADMAP.md](ROADMAP.md) — sección "Nueva fase Q2-Q3 2026". Este sprint-log se conserva como referencia histórica; las próximas iteraciones documentarán en docs separados por track (deploy, formalización, etc.).
