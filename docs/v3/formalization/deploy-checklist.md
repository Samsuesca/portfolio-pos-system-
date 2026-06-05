# Deploy v3 a Producción — Checklist Estricto

> **Versión:** 1.2 (2026-05-30 — log de ejecución del deploy parcial; §4.3 + §4.7 aplicados en prod)
> **Owner:** Angel Suesca
> **Estado de prod:** v3 desplegado el 28-may (commit `ba9b30d`, head `v3_school_global_gt_excl_001`). Schema, templates de costo, catálogo v3, fotos y GTs JDLCP en prod. **Pendiente:** estabilización contable §4.4 (HOLD owner).
> **Propósito:** lista exhaustiva y ordenada de TODO lo que debe correrse en el VPS para llevar prod a v3.0.0 con paridad funcional respecto a la DB dev actual.

---

## 0. Log de ejecución (estado real prod vs checklist)

> Verificado contra VPS 104.156.247.226 el **2026-05-30**. El deploy real (28-may) quedó **2 migraciones por delante** de lo que este doc esperaba (`reports_cov_002`): el head real es `v3_school_global_gt_excl_001`. La cadena confirma que `reports_cov_001/002` son ancestros aplicados.

| § | Paso | Estado prod | Fecha |
|---|------|-------------|-------|
| 3 | `alembic upgrade head` → `v3_school_global_gt_excl_001` | ✅ aplicado | 28-may |
| 3 | `reports_cov_002` (3 permisos `reports.*`) | ✅ aplicado (ancestro del head) | 28-may |
| 4.1 | `seed_team.py` | ✅ (8 users, 45 roles) | 28-may |
| 4.2 | `update_team_emails.py` | ✅ | 28-may |
| — | Seed `cost_component_templates` (604 templates) | ✅ | 28-may |
| — | Catálogo v3 Title Case + soft-deletes + `school_global_gt_exclusions` (3) | ✅ | 28-may |
| — | `seed_jdlcp_new_gts.py` (3 GTs JDLCP con productos) | ✅ ya tenía productos (10/11/10) | 28-may |
| — | `load_catalog_images_may28.py` (`garment_type_images`) | ✅ fotos cargadas | 28-may |
| **4.7** | **`backfill_reports_timestamps.py --commit`** (212 orders + 215 alterations) | ✅ **aplicado** | **30-may** |
| **4.3** | **`import_costs_from_xlsx.py --commit`** (2448 components, 436 productos) | ✅ **aplicado** | **30-may** |
| 4.4 | `apply_stabilization_data_corrections.py` (239 bank entries + AP Cristina $19M) | 🟠 **HOLD** — bloqueado por sesión conciliación Consuelo | — |

**Backups de seguridad tomados:** `pre_v3_deploy_20260528_183311.sql` (deploy original), `pre_scripts_v3_20260530_0225.sql` (pre §4.3/§4.7).

**Por qué §4.4 sigue en HOLD (decisión 30-may):** el dry-run en prod calculó balances finales (`Banco 1,966,800.45`, `Nequi 120,354.64`) que **no coinciden** con los documentados en §4.4 (`1,813,800.45` / `191,354.64`) — prod arrancó de saldos distintos a dev. Riesgo de double-count si el saldo actual de prod ya fue conciliado contra el extracto real. Además el script crea un vendor nuevo `Cristina Rios` mientras ya existe `Cristina Londono` (sin AP) → posible duplicado. Ambos puntos se resuelven en la sesión de conciliación con Consuelo antes de commitear.

---

## TL;DR

El deploy v3 no es solo `alembic upgrade head`. Requiere correr **N scripts de datos** que históricamente se aplicaron manualmente en dev y nunca quedaron como código deployable. Este doc los enumera.

**Reglas inviolables:**
- Backup pre-deploy obligatorio (en `/opt/backups/`).
- Ventana sin operación crítica (sábado madrugada o domingo temprano).
- Rollback documentado y probado antes de iniciar (sección 7).
- Cada paso es **idempotente**: re-ejecutar no rompe nada.
- Cualquier paso marcado 🔴 NO TIENE script listo — bloquea el deploy hasta que se escriba.

---

## 1. Pre-vuelo (1-2 días antes)

| # | Acción | Comando / Doc |
|---|--------|--------------|
| 1.1 | Regenerar snapshot prod en dev y validar migraciones limpias | `./backend/scripts/reset_dev_from_prod.sh` (ver [db-snapshot-workflow.md](db-snapshot-workflow.md)) |
| 1.2 | Confirmar `alembic heads` en backend == `reports_cov_002` (única head; si hay dos, algo se quedó atrás en algún branch) | `cd backend && source venv/bin/activate && alembic heads` |
| 1.3 | Correr full suite de tests backend | `cd backend && pytest -v` (objetivo: 0 fallos en módulos contables, payroll, products, sales) |
| 1.4 | Correr smoke frontend (login + ventas + accounting + cfo) | manual en `frontend/` con `npm run tauri:dev` |
| 1.5 | Validar que los scripts de §3 corren en dev sin errores y son idempotentes | re-ejecutar cada uno dos veces; `diff` de DB debe ser vacío en la segunda |
| 1.6 | Confirmar ventana con equipo (Consuelo/Felipe sin operación) | mensaje WhatsApp/Telegram, mínimo 24h previas |
| 1.7 | Decidir orden reclasificaciones masivas (pre vs post deploy) | ver §5 — bloqueante |

---

## 2. Backup en producción (T-0:15)

```bash
ssh root@104.156.247.226
cd /var/www/uniformes-system-v2

# Backup full DB con timestamp
PROD_PW=$(grep DATABASE_URL backend/.env | sed -E 's|.*://[^:]+:([^@]+)@.*|\1|')
TIMESTAMP=$(date +%Y%m%d_%H%M)
PGPASSWORD=$PROD_PW pg_dump -h localhost -U uniformes_user \
    --no-owner --no-acl uniformes_db \
    > /opt/backups/pre_v3_deploy_${TIMESTAMP}.sql

# Verificar tamaño razonable (>1MB)
ls -lh /opt/backups/pre_v3_deploy_${TIMESTAMP}.sql

# Copiar el path a un buffer mental — lo necesitas en §7
```

---

## 3. Migraciones de schema (T-0:00)

```bash
# Aún en /var/www/uniformes-system-v2 en el VPS
git fetch origin
git checkout main && git pull origin main
git log -1 --oneline  # confirmar commit esperado

cd backend && source venv/bin/activate

# Dependencias (revisa diff manualmente — supply-chain guard)
git diff HEAD@{1} HEAD -- requirements.txt
pip install -r requirements.txt --upgrade

# Preview SQL de migraciones (NO ejecuta, solo inspecciona)
alembic upgrade head --sql > /tmp/migration_preview_${TIMESTAMP}.sql
less /tmp/migration_preview_${TIMESTAMP}.sql

# Aplicar
alembic upgrade head

# Verificar head
alembic current  # debe imprimir reports_cov_002
```

**Migraciones que mueven data (alta vigilancia):**
- `unify_step2_copy_global_data`
- `unify_step3_remap_fks`
- `unify_step4_drop_global_columns`
- `vendor_norm_b_populate`
- `u5v6w7x8y9z0_format_client_names_title_case`
- `inv_reserved_qty` (backfill desde pending orders)
- `ar_due_date_001` (backfill due_date NULL → created_at + 30d)
- `v3_design_cleanup_001` (remap masivo de FKs)
- `reports_cov_002` (seed 3 permisos: `reports.orders`, `reports.alterations`, `reports.cost_visibility` + assignment a roles `admin` y `owner`)

**Migraciones aditivas sin data (bajo riesgo):**
- `reports_cov_001` (agrega `orders.delivered_at` y `alterations.ready_at` como nullable + índices). Nullable por diseño; el backfill es paso aparte (§4.7).

---

## 4. Seeds y data scripts (T-0:05)

Orden estricto — cada uno tiene dependencias del anterior.

### 4.1 ✅ `seed_team.py` — Equipo Fase 1

```bash
cd backend && source venv/bin/activate

# Dry-run primero (verifica diff)
venv/bin/python -m scripts.seed_team

# Commit si el diff es esperado
venv/bin/python -m scripts.seed_team --commit
```

**Qué hace:** crea 5 positions canónicas (OWNER_CEO, CTO, LIDER_OP, MKT_CX, ANALISTA_FIN), actualiza 4 empleados existentes (Consuelo, Felipe, Santiago Mazo, Samuel) con posición + base_salary del roadmap Fase 1, crea a Salomé, vincula `employees.user_id` a cuentas de usuario. **Idempotente.**

**Verificación:**
```sql
SELECT full_name, position, base_salary, user_id
FROM employees
WHERE position IN ('Owner / CEO', 'CTO / Cofundador tech', 'Líder operativo',
                   'Marketing y Experiencia Cliente', 'Analista financiero')
ORDER BY base_salary DESC;
-- Esperado: 5 filas, todas con user_id NOT NULL excepto Salomé hasta que se rellene su cédula real
```

### 4.2 ✅ `update_team_emails.py` — Emails Google reales

```bash
venv/bin/python -m scripts.update_team_emails              # dry-run
venv/bin/python -m scripts.update_team_emails --commit
```

**Qué hace:** alinea emails (lowercase) y `full_name` de 5 usuarios (samuel, chelorios, felipe, salome, santimazo) con sus Gmail reales. **Pre-requisito** para que el auto-link de Google Sign-In funcione (matchea por email lowercase). **Idempotente.**

**Verificación:**
```sql
SELECT username, email, full_name FROM users
WHERE username IN ('samuel','chelorios','felipe','salome','santimazo')
ORDER BY username;
```

### 4.3 ✅ `import_costs_from_xlsx.py` — Costos por producto

```bash
# Pre-req: zip de costos disponible en el VPS o path conocido.
# Default lee documentos/Costos/COSTOS-20260516T232636Z-3-001.zip (491KB, 36 xlsx).

venv/bin/python -m scripts.import_costs_from_xlsx              # dry-run con zip default
venv/bin/python -m scripts.import_costs_from_xlsx --commit     # persiste
venv/bin/python -m scripts.import_costs_from_xlsx --commit \
    --source /path/a/zip_o_dir \
    --report /tmp/ucr-costos-report.md
```

**Qué hace:** lee los 36 xlsx manuscritos transcritos (PowerShell+Excel COM, owner's brother), parsea las 4 hojas estructuradas (`Telas`, `Insumos`, `Consumo Tela`, `Total por Talla`), mapea conceptos a las 8 categorías canónicas (`fabric/tailoring/embroidery/collars_cuffs/labels/bags/thread/other`), resuelve schools+garment_types vía LIKE flexible (case-insensitive, maneja Yomber=Jumper, Camisa=Camiseta para HAG/JIGL, variantes de color en Comfama), y aplica:

- **Fabric** (variable por talla): amount calculado `(cm/100)*precio_metro/unidades`, prefiere E hardcoded si la dueña ajustó precio efectivo.
- **Collars/cuffs (RIB/sesgo/forro/cuello)**: flat o variable por talla según el xlsx.
- **Insumos agregados**: suma conceptos del mismo template (e.g., "Confeccion"+"Corte"→tailoring; "Marquilla logo"+"Talla c/u"→labels).
- **Bloques mixed-sizes** (Chompa Pumarejo: 6-16 + S-XXL): cierre numérico solo a tallas int; cierre letras solo a tallas S/M/L/XL/XXL.
- **Tallas "Pendiente"**: skip + anotación en gaps report (no insert con amount=0).
- **Jomber cross-school**: archivo `Jomber_*.xlsx` aplica a 3 schools (Pumarejo, Pinal, Caracas) → matchea `Jumper` en cada uno.

**Idempotente** vía clave natural `(product_id, template_id)`. Re-corridas devuelven `skipped=N inserted=0`.

**Verificación post-commit (línea base dev 2026-05-24):**
```sql
SELECT COUNT(*) FROM product_cost_components;
-- Esperado: ~2377 (puede crecer cuando se agreguen más xlsx al zip)
SELECT COUNT(DISTINCT product_id) FROM product_cost_components;
-- Esperado: ~425 productos con cost breakdown
SELECT COUNT(*) FROM cost_component_templates;
-- Esperado: ~597 (8 categorías × ~75 garment_types con costos)
```

**Conocidos que se saltean** (no son bugs, son fuentes reales):
- `Colegio_BuenComienzo_Delantal.xlsx`: BC no tiene `Delantal` en su catálogo aún.
- `Colegio_JDLCP_Camiseta_Diario.xlsx`: garment matchea pero JDLCP no tiene products creados para esa variante.

**Cuándo regenerar:** cada vez que el hermano del owner suba un xlsx nuevo o ajuste uno existente. Re-correr con `--commit` no daña los existentes (idempotente).

**Tests:** `pytest backend/tests/scripts/test_import_costs.py -v` — 32 tests (parser, mapeos, fixtures Comfama Camiseta + Pumarejo Chompa).

> **Histórico:** este script se escribió 2026-05-24 siguiendo [prompts/costs-importer-prompt.md](prompts/costs-importer-prompt.md) y [estabilizacion_financiera/costs-importer-plan-revised.md](estabilizacion_financiera/costs-importer-plan-revised.md). Antes existía solo como inyección manual en dev (2054 components) y se perdía con cada reset. Las UUIDs viejas del backup NO eran restaurables porque las templates fueron regeneradas por migraciones v3. El importer **reemplaza el estado anterior con datos limpios desde la fuente canónica**.

### 4.4 ✅ `apply_stabilization_data_corrections.py` — Fases auto-aprobadas

```bash
venv/bin/python -m scripts.apply_stabilization_data_corrections              # dry-run
venv/bin/python -m scripts.apply_stabilization_data_corrections --commit
venv/bin/python -m scripts.apply_stabilization_data_corrections --commit \
    --plan-path docs/v3/formalization/estabilizacion_contable/bank-migration-plan-2026-05-17.md
```

**Qué hace (2 fases idempotentes):**

**Fase 1 — Bank migration plan (239 entries, $-218,750.91):**
- Parsea los 239 INSERTs del markdown del plan (bank_fee + financial_income)
- Calcula `balance_after` cronológicamente por cuenta (Banco + Nequi)
- Inserta en `balance_entries` con idempotencia vía `reference=BANK-...`
- Actualiza `balance_accounts.balance` final

Equivalente al `scripts.bank_reconciliation.apply_migration` pero **NO requiere el SQLite intermedio** — lee directo el markdown. Esto es importante para deploy a prod, donde no hay garantía del SQLite ni de los PDFs Nequi originales.

**Fase 2 — AP Cristina Rios $19M vigente:**
- Decisión owner 2026-05-24: $39M deuda histórica, $20M pagado feb-2026, **$19M residual vigente**
- Crea vendor "Cristina Rios" (type=PERSON) si no existe
- Crea AP $19M con `category='financial_debt'`, sin due_date
- Idempotente vía `(vendor_id, description ILIKE '%Refinanciamiento Cristina%')`

**Verificación:**
```sql
SELECT COUNT(*) FROM balance_entries WHERE reference LIKE 'BANK-%';
-- Esperado: 239

SELECT v.name, ap.amount, ap.is_paid, ap.category
FROM accounts_payable ap JOIN vendors v ON v.id = ap.vendor_id
WHERE v.name = 'Cristina Rios';
-- Esperado: 1 fila — amount 19000000.00, is_paid=false, category=financial_debt

SELECT name, balance FROM balance_accounts WHERE id IN
    ('0a566699-57e2-4402-8294-c24f34d89a36', 'd4a62c38-7ddd-4194-a321-aedbdbcde911');
-- Banco esperado: 1813800.45 (post bank_fee + interest)
-- Nequi esperado: 191354.64
```

### 4.5 ⏸️ Fases pendientes — Decisiones owner bloqueadas

Documentadas pero **NO aplicadas** por `apply_stabilization_data_corrections.py`. Quedan como work explícito para post-deploy o sesión owner:

| # | Concepto | Monto | Razón bloqueo | Default si owner no decide |
|---|---|---|---|---|
| 1 | 20 owner_drawings (YANBAL/ESIKA/TEMU) | ~$5.05M | Clasificación 1-a-1 — algunos son personales, otros operativos | Se quedan como `unknown` en bank reconciliation |
| 2 | Reclasificación masiva mercado/ocio personal vs negocio | ~$4.92M (4.9% mezcla) | Owner debe revisar ~60 transacciones individualmente | P&L sigue mintiendo en 4.9% |
| 3 | Ajuste Nequi $20M → $10 del 5-ene-2026 | $20M | Pendiente clarificación con Consuelo | `equity_capital` "Saldo apertura no rastreado" |
| 4 | Equity correctivo `set_balance` histórico | $21.6M | Bloqueado por audit Q2 Bancolombia ($7.7M divergencia) | `equity_capital` "Saldo apertura no rastreado" |
| 5 | 7 internal transfers BC↔Nequi | ~$3.6M | Detectados automáticamente; falta script de marcado | Quedan como entries duplicadas (no-op contable real pero ruido en reports) |

**Para desbloquear:** ver sesión sugerida en deploy-checklist §5 — agendar 1-2h con Consuelo cubriendo los 4 ítems.

### 4.6 🟠 Bank reconciliation completa — Opcional pre-deploy

Si quieres regenerar el reporte de bank reconciliation desde cero (e.g., con extractos nuevos):

```bash
# Requiere password de PDFs Nequi
export BANK_PDF_PASSWORD="..."
venv/bin/python -m scripts.bank_reconciliation.cli all --password "$BANK_PDF_PASSWORD"
# Genera reports nuevos en /tmp/ucr-reconciliation/ y actualiza markdowns en
# docs/v3/formalization/estabilizacion_contable/bank-*.md
```

Solo necesario si los extractos cambiaron o se quiere período distinto. Para deploy estándar v3, los archivos `bank-migration-plan-2026-05-17.md` actuales son suficientes (la Fase 1 del §4.4 los lee directo).

### 4.7 ✅ `backfill_reports_timestamps.py` — Histórico de Encargos y Arreglos

```bash
# Dry-run primero (verifica conteos)
venv/bin/python -m scripts.backfill_reports_timestamps

# Aplicar
venv/bin/python -m scripts.backfill_reports_timestamps --commit
```

**Por qué es crítico (P0 del QA del 2026-05-24):** la migración
`reports_cov_001` añade `orders.delivered_at` y `alterations.ready_at`
como nullable. Los hooks en `update_status` poblan solo transiciones
NUEVAS. Sin backfill, en prod (con ~210 encargos DELIVERED y ~209
arreglos DELIVERED legacy):

- **Tab Resumen** muestra `Encargos = $0` en modo Devengado (default)
  → ~$23M de revenue invisibles. El owner pierde la vista histórica
  entera hasta que se acumulen ~6 meses de transiciones nuevas.
- **Widget "Tiempo de respuesta"** de Arreglos retorna `null`
  (avg, median) → cards vacías "—".
- **`/global/reports/revenue/streams-monthly`** (accrual) reporta
  cero encargos hasta el primer entregado post-deploy.

**Qué hace el script:**
```sql
-- Aproximación: usa updated_at como fecha "más cercana" a la entrega real.
UPDATE orders SET delivered_at = updated_at
 WHERE status = 'DELIVERED' AND delivered_at IS NULL;

UPDATE alterations SET ready_at = updated_at
 WHERE status IN ('READY', 'DELIVERED') AND ready_at IS NULL;
```

**Caveat documentado:** `updated_at` se sobreescribe en cada UPDATE del
row. Para un encargo entregado hace 6 meses pero cuyo `notes` se editó
ayer, el `delivered_at` backfilled = ayer → lead-time para esa fila es
0d (skewed). Revenue aggregation NO se ve afectado. Decisión revisada:
visibilidad sobre purity (el owner pierde menos con un lead-time
aproximado que con $0 en Encargos).

**Idempotente** (filtro `IS NULL` solo matchea filas faltantes).
**Reversible** vía `--revert` (solo dev — en prod perdería los
timestamps reales que los hooks poblan post-deploy).

**Procedimiento detallado:** [`docs/v3/v3-branch-architecture/reports-coverage.md`](../v3-branch-architecture/reports-coverage.md)
sección "Backfill Checklist".

**Verificación post-commit:**
```sql
-- Esperado: 0 missing en ambas tablas (todos los DELIVERED/READY tienen ts)
SELECT
  COUNT(*) FILTER (WHERE status = 'DELIVERED' AND delivered_at IS NULL) AS orders_missing,
  COUNT(*) FILTER (WHERE status = 'DELIVERED' AND delivered_at IS NOT NULL) AS orders_with_ts
FROM orders;

SELECT
  COUNT(*) FILTER (WHERE status IN ('ready','delivered') AND ready_at IS NULL) AS alt_missing,
  COUNT(*) FILTER (WHERE status IN ('ready','delivered') AND ready_at IS NOT NULL) AS alt_with_ts
FROM alterations;
```

Y endpoint check:
```bash
TOKEN="<admin_token>"
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://yourdomain.com/api/v1/global/reports/revenue/streams-summary?start_date=2026-01-01&end_date=2026-12-31&basis=accrual" \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print('orders revenue:', d['streams']['orders']['revenue'])"
# Esperado: NO cero (debe coincidir aproximadamente con basis=cash)
```

> **Ventana:** el UPDATE escanea `orders` (~310 rows en prod) y
> `alterations` (~216 rows) — < 2s de DB time. Cabe sin problema
> dentro de la misma ventana de deploy.

### 4.8 🔴 `audit_data_quality_score.py` — Sin script

```bash
# Cuando exista:
venv/bin/python -m scripts.audit_data_quality_score
# Esperado: 100/100
```

Diseñado como cron diario post-deploy. Hoy se hace ad-hoc vía SQL.

---

## 5. Decisión pre-deploy del owner (BLOQUEANTE)

Antes de agendar la ventana, owner debe responder:

| Pregunta | Default si no responde |
|----------|------------------------|
| ¿Reclasificación masiva va PRE o POST deploy? | POST (script no existe; deploy va con data sucia) |
| ¿Ajuste Nequi $20M → $10 con qué glosa? | `equity_capital` "Saldo de apertura no rastreado" |
| ¿Refinanciamiento Cristina con qué soporte legal? | Sin soporte → catalogar como `equity_capital` |
| ¿Salomé entra al deploy con cédula `SALOME-PENDIENTE`? | Sí (es ajustable post-deploy desde UI) |
| ¿Cuándo es la ventana? | Sábado 6am-8am Colombia (sin operación) |

---

## 6. Restart servicios + smoke (T+0:15)

```bash
systemctl restart uniformes-api
systemctl status uniformes-api  # debe estar active (running)

# Health check
curl -s https://yourdomain.com/api/v1/health
# Esperado: HTTP 200, payload con version v3.0.0

# Login real con cuenta admin
curl -s -X POST https://yourdomain.com/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"samuel","password":"<PWD>"}' | jq .access_token

# Smoke endpoints clave (con TOKEN del login)
TOKEN="..."
for path in /api/v1/schools /api/v1/users /api/v1/global/accounting/cash-balances \
            /api/v1/employees /api/v1/products/stats; do
    code=$(curl -s -o /dev/null -w "%{http_code}" \
        -H "Authorization: Bearer $TOKEN" \
        https://yourdomain.com$path)
    echo "$path → $code"
done
# Esperado: todos 200
```

### 6.3 Reports Coverage Expansion — smoke específico (Fase 1-3)

```bash
TOKEN="..."

# Endpoints nuevos (12) — deben responder 200
for path in \
    /api/v1/global/reports/orders/summary \
    /api/v1/global/reports/orders/status-funnel \
    /api/v1/global/reports/orders/on-time-delivery \
    /api/v1/global/reports/orders/cumplimiento \
    /api/v1/global/reports/orders/top-products \
    /api/v1/global/reports/orders/top-clients \
    /api/v1/global/reports/orders/profitability/by-school \
    /api/v1/global/reports/alterations/summary \
    /api/v1/global/reports/alterations/response-time \
    /api/v1/global/reports/alterations/top-types \
    /api/v1/global/reports/revenue/streams-summary \
    /api/v1/global/reports/revenue/streams-by-school; do
    code=$(curl -s -o /dev/null -w "%{http_code}" \
        -H "Authorization: Bearer $TOKEN" \
        "https://yourdomain.com$path")
    echo "$path → $code"
done

# Invariante crítica: sum(streams) == totals.revenue
curl -s -H "Authorization: Bearer $TOKEN" \
    "https://yourdomain.com/api/v1/global/reports/revenue/streams-summary?start_date=2026-01-01&end_date=2026-12-31" \
    | python3 -c "
import json, sys
d = json.load(sys.stdin)
total = float(d['totals']['revenue'])
s = sum(float(v['revenue']) for v in d['streams'].values())
print(f'sum: \${s:,.0f}  totals: \${total:,.0f}  diff: {abs(s-total):.2f}')
assert abs(s - total) < 0.01, 'INVARIANT BROKEN'
print('INVARIANT PASS')
"

# Backfill efectivo: orders accrual ≠ 0 (si backfill §4.7 corrió)
curl -s -H "Authorization: Bearer $TOKEN" \
    "https://yourdomain.com/api/v1/global/reports/revenue/streams-summary?start_date=2026-01-01&end_date=2026-12-31&basis=accrual" \
    | python3 -c "import json,sys; d=json.load(sys.stdin); rev=float(d['streams']['orders']['revenue']); print(f'orders accrual revenue: \${rev:,.0f}'); assert rev > 0, 'BACKFILL FALTANTE'"

# Validación de fechas invertidas → debe responder 400 con mensaje en español
curl -s -w "\n%{http_code}\n" -H "Authorization: Bearer $TOKEN" \
    "https://yourdomain.com/api/v1/global/reports/orders/summary?start_date=2026-12-31&end_date=2026-01-01"
# Esperado: 400 + detail "Rango de fechas invalido: ..."

# Permisos sembrados en DB (no debe haber warning en logs de boot)
journalctl -u uniformes-api -n 100 --no-pager | grep -i "Permission validation" | tail -3
# Esperado: ningún warning con 'reports.orders' o 'reports.alterations' o 'reports.cost_visibility'
```

**Frontend smoke:**
1. Login con usuario admin
2. Crear venta de prueba → verificar inventario decrementado
3. Crear gasto → verificar movimiento en balance
4. Abrir tab CFO → verificar P&L mensual carga
5. Abrir tab Empleados → verificar 5 nuevos cargos del seed
6. **Abrir `/reports` (default tab = Resumen 360):**
   - 3 stream cards renderizan con valores no-cero (Ventas/Encargos/Arreglos)
   - Tabla por colegio cuadra: `sum(filas) + alterations_revenue` == totals.total_revenue
   - Toggle Devengado ↔ Caja cambia el número de Encargos visiblemente
7. **Abrir `/reports/encargos`:** 6 KPI cards + funnel pintado + on-time-delivery % no-null
8. **Abrir `/reports/arreglos`:** cambiar preset de fecha → KPI cards se actualizan (Bug 9 cerrado), widget "Tiempo de respuesta" con valores numéricos (no "—")
9. Anular la venta de prueba

---

## 7. Rollback (si los smoke fallan)

```bash
systemctl stop uniformes-api

# Restaurar DB
PGPASSWORD=$PROD_PW dropdb -h localhost -U uniformes_user uniformes_db
PGPASSWORD=$PROD_PW createdb -h localhost -U uniformes_user uniformes_db
PGPASSWORD=$PROD_PW psql -h localhost -U uniformes_user uniformes_db \
    < /opt/backups/pre_v3_deploy_${TIMESTAMP}.sql

# Restaurar código
git reset --hard <commit-hash-pre-v3>   # anotar antes de iniciar

# Restaurar deps
cd backend && pip install -r requirements.txt

systemctl start uniformes-api
curl https://yourdomain.com/api/v1/health
```

**Anotar en bitácora:**
- Por qué falló (output de logs `journalctl -u uniformes-api -n 200`)
- Qué smoke específico falló
- Plan de remediación antes de retentar

---

## 8. Post-deploy (T+1h, T+24h)

| Cuando | Acción |
|--------|--------|
| T+1h | Revisar logs `journalctl -u uniformes-api -f` durante operación real. Verificar 0 errores 500. |
| T+1h | Confirmar con vendedora (Felipe) que pudo entrar y hacer una venta real. |
| T+24h | Revisar dashboard `/cfo` con data del día — saldos cuadran. |
| T+24h | Revisar Telegram alerts — confirmar que llegan (subscriptions intactas). |
| T+7d | Validar primer cierre semanal con nueva taxonomía de categorías. |

---

## 9. Estado de scripts (referencia rápida)

| Script | Path | Estado | Cubierto en deploy |
|--------|------|--------|---------------------|
| `seed_team.py` | `backend/scripts/seed_team.py` | ✅ Existe + idempotente | §4.1 |
| `update_team_emails.py` | `backend/scripts/update_team_emails.py` | ✅ Existe + idempotente | §4.2 |
| `import_costs_from_xlsx.py` | `backend/scripts/import_costs_from_xlsx.py` | ✅ Existe + idempotente + 32 tests · **aplicado prod 30-may** | §4.3 |
| `apply_stabilization_data_corrections.py` | `backend/scripts/apply_stabilization_data_corrections.py` | ✅ Existe + idempotente (Fase 1+2) · 🟠 HOLD owner | §4.4 |
| `bank_reconciliation` suite | `backend/scripts/bank_reconciliation/` | ✅ Existe (CLI completo, requiere extractos crudos) | §4.6 — opcional |
| `backfill_reports_timestamps.py` | `backend/scripts/backfill_reports_timestamps.py` | ✅ Existe + idempotente + reversible · **aplicado prod 30-may** | §4.7 — P0 post-migración `reports_cov_001` |
| `seed_jdlcp_new_gts.py` | `backend/scripts/seed_jdlcp_new_gts.py` | ✅ Existe + idempotente · prod ya tiene productos JDLCP | §0 — no estaba documentado (creado 28-may) |
| `load_catalog_images_may28.py` | `backend/scripts/load_catalog_images_may28.py` | ✅ Existe (mapping hardcoded) · fotos ya en prod | §0 — no estaba documentado (creado 28-may) |
| `audit_data_quality_score.py` | — | 🔴 No escrito | §4.8 — post-deploy, propuesto como cron |
| `reset_dev_from_prod.sh` | `backend/scripts/reset_dev_from_prod.sh` | ✅ Existe (solo dev) | §1.1 (pre-vuelo) |
| `refresh_prod_snapshot.sh` | `backend/scripts/refresh_prod_snapshot.sh` | ✅ Existe (solo dev legacy) | — |

**Pendientes que NO son scripts (decisiones owner — §4.5):**
- 20 owner_drawings 1-a-1 (~$5M)
- Reclasificación mercado/ocio personal vs negocio (~$5M, ~60 tx)
- Nequi $20M 5-ene-2026 (clarificar con Consuelo)
- Equity correctivo $21.6M (bloqueado por audit Q2)
- 7 internal transfers (~$3.6M, requiere script de marcado)

---

## 10. Mantenimiento de este doc

**Cuando se cierre el deploy v3:** marcar todas las casillas, anotar fecha y commit-hash deployado en la cabecera. Mover a `docs/v3/formalization/deploy-v3-completed-<fecha>.md` y crear `deploy-checklist.md` nuevo para la próxima release mayor (v3.1, v4...).

**Cuando se agreguen scripts nuevos** que el deploy requiera correr: agregarlos a la §4 y §9 en el mismo PR que introduce el script. Sin esa actualización, el deploy lo va a olvidar.

**Cuando se descubra un seed/script aplicado solo en dev** (como pasó con los costos): documentarlo aquí como deuda crítica y abrir issue para convertirlo en script deployable. **La regla de oro: si la DB dev tiene datos que la DB prod no tiene, o existe un script reproducible o es un bug del proceso.**

---

## Referencias

- [ROADMAP.md](ROADMAP.md) — plan vivo de fase Q2-Q3
- [db-snapshot-workflow.md](db-snapshot-workflow.md) — reset dev desde prod
- [sprint-log.md](sprint-log.md) — bitácora histórica M1-M3
- [prompts/v3-migration-on-prod-data-prompt.md](prompts/v3-migration-on-prod-data-prompt.md) — prompt original M2
- [prompts/costs-importer-prompt.md](prompts/costs-importer-prompt.md) — spec del importer §4.3
- [estabilizacion_contable/bank-migration-plan-2026-05-17.md](estabilizacion_contable/bank-migration-plan-2026-05-17.md) — bank entries §4.4
- [../v3-branch-architecture/reports-coverage.md](../v3-branch-architecture/reports-coverage.md) — Reports Coverage Expansion: arquitectura, endpoints, backfill checklist completo (§4.7)
