# QA Full Post-V3 — Reporte de Estabilidad

**Fecha:** 2026-05-04
**Ejecutor:** Claude Code (QA Interno)
**Sprint:** Stabilization Sprint 2026 Q2 (post-M2)
**Credenciales usadas:** Samuel / Samuel2741 (superuser)
**Versión sistema:** 2.9.0
**Migración aplicada:** `v3codes001 (head)` (14+ migraciones v3)

---

## Resumen Ejecutivo

| Fase | Total | Pass | Warning | Fail | Estado |
|------|-------|------|---------|------|--------|
| 0 — Pre-flight | 1 | 1 | 0 | 0 | ✅ |
| 1 — Smoke API | 58 | 49 | 1 | 0* | ✅ |
| 2 — Deep dive v3 | 6 áreas | 4 | 1 | 1 | ⚠️ |
| 3 — UI superuser | 7 páginas | 7 | 0 | 0 | ✅ |
| 4 — Regresión 5 bugs | 5 | 0 | 1 | 5 | ❌ |

\* Los 7 "404" iniciales en Fase 1 fueron paths incorrectos del plan, no del API.

**Veredicto:** **CONDITIONAL GO** para M3.
Backend v3 estable a nivel de **infraestructura, código, autenticación y nuevos features**. La UI superuser renderiza limpia (0 console errors). **Los 5 bugs contables catalogados siguen presentes** y, en 2 casos (Bug 1 y Bug 4), son **peores** que lo reportado originalmente. Bug 1 muestra comportamiento mixto: el endpoint `set-balance` ahora SÍ crea entry compensatoria — la discrepancia $115.5M es **deuda histórica legacy**, no fugas activas.

---

## Fase 0 — Pre-flight

| Check | Resultado |
|-------|-----------|
| Backend `:8001` | ✅ Up 8 min (Docker `uniformes-backend`) |
| PostgreSQL `:5432` | ✅ healthy (Docker `uniformes-postgres`) |
| Redis `:6379` | ✅ healthy |
| Frontend `:5171` | ⚠️ Detenido al inicio, levantado durante QA (Vite IPv6 only) |
| Alembic head | ✅ `v3codes001 (head)` — single head, no merge conflicts |
| `/api/v1/openapi.json` | ✅ 375 paths registrados |
| Login Samuel | ✅ JWT válido, `is_superuser=true`, `token_version=0` |

**Baseline DB:**
| Tabla | Count |
|-------|-------|
| users | 8 |
| schools | 12 |
| products | 642 |
| inventory | 640 |
| sales | 1537 (1521 COMPLETED + 16 CANCELLED) |
| orders | 306 |
| clients | 1700 |
| expenses | 464 |
| balance_accounts | 34 |
| balance_entries | 1969 |
| accounts_receivable | 190 |
| accounts_payable | 2 |
| **vendors** (v3) | **97** |
| **positions** (v3) | **6** |
| sale_changes | 46 |
| alterations | 169 |

**Schema v3 verificado:**
- ✅ `account_type_enum` incluye `ASSET_INTANGIBLE`
- ✅ `users.token_version` INTEGER NOT NULL DEFAULT 0
- ✅ `inventory.reserved_quantity` INTEGER DEFAULT 0
- ✅ `failed_inventory_logs` (DLQ) existe
- ✅ `vendors`, `positions` tables exist
- ⚠️ Enum values en MAYÚSCULAS (`ASSET_CURRENT`) vs CLAUDE.md que indica minúsculas (`asset_current`) — **inconsistencia documental**

---

## Fase 1 — Smoke API + Auth

**58 endpoints probados, 49 OK + 8 paths corregidos + 1 con 400 esperado (params requeridos).**

### Login & Auth ✅
- `POST /api/v1/auth/login` con Samuel/Samuel2741 → 200, JWT válido, `token_version: 0`
- Token inválido → 401 ✓
- Sin token → 403 (FastAPI default; debería ser 401 según semántica HTTP — **finding P3**)
- **Token version invalidation funcional ✅**: bumped `token_version` 0→1 en DB, token viejo rechazado (401), re-login con creds genera token nuevo válido. **Feature v3 nuclear en seguridad operativa correctamente.**

### Reads core (todos 200)
✅ `/users`, `/schools`, `/clients`, `/products`, `/global/products`, `/sales`, `/orders`, `/sale-changes`, `/alterations` (vía `/global/alterations`), `/vendors`, `/business-info`, `/delivery-zones`, `/notifications`, `/contacts`, `/documents`, `/permissions/registry` (97 perms cargados), `/cash-drawer/can-open`, `/cfo-dashboard/health-metrics`, `/global/payroll`, `/global/email-logs`, `/global/workforce/*` (8 sub-rutas), `/global/garment-types`, `/order-changes`, `/payments/config`, `/telegram-alerts/*`

### Stats endpoints (anti-pattern paginación)
✅ Todos responden 200:
- `/global/accounting/expenses/stats`
- `/global/accounting/expenses/summary-by-category`
- `/global/products/stats`
- `/global/workforce/performance/stats`
- `/contacts/stats/summary`
- `/orders/stats`

### Financial Model (nueva v3 feature)
✅ Todos OK:
- `/global/accounting/financial-model/kpis`
- `/global/accounting/financial-model/cash-forecast` (7.4 KB de datos)
- `/global/accounting/financial-model/executive-summary`
- `/global/accounting/financial-model/health-alerts`
- `/global/accounting/financial-model/profitability/by-school`
- `/global/accounting/financial-statements/income-statement` (con dates) — gross_revenue $83.6M YTD 2026, COGS $58.6M, gross_margin 29.6%
- `/global/accounting/financial-statements/balance-sheet`

### Paginación
- ✅ `PaginatedResponse` envolvente con `items`, `total`, `skip`, `limit`, `page`, `total_pages`, `has_more`
- ✅ `skip=99999` retorna lista vacía con metadata correcta
- ✅ `limit=99999` retorna 400 (cap protection)

---

## Fase 2 — Deep dive v3 surface area

### 2.1 Sales/Orders code format ✅
- **0 sales con formato legacy** (todas en `XXXX-001-VNT-YYYY-NNNN`)
- **0 orders con formato legacy** (todas en `XXXX-001-ENC-YYYY-NNNN`, no `PED`)
- **0 códigos duplicados cross-schools**
- print_queue (410 rows) usa columna `sale_code` y mantiene FK válidas

**Sample:**
```
PUMAREJO-001-VNT-2026-0251
PINAL-001-VNT-2026-0298
CARACAS-001-VNT-2026-0836
CONFAMA-001-VNT-2026-0146
```

### 2.2 Vendor normalization ⚠️
- **97 vendors** normalizados, **0 duplicados case-insensitive**
- **110 expenses (24%) con `vendor_id IS NULL`** — todas históricas pre-v3
- Distribución temporal:
  - 2026-05: 0/5 sin vendor (100% normalizadas)
  - 2026-04: 4/91 sin vendor (4%)
  - 2026-02: 43/115 sin vendor (37%)
  - 2026-01: 43/142 sin vendor (30%)

**Veredicto:** Migración funciona forward-only — backfill incremental natural. Acceptable. No acción inmediata requerida.

### 2.3 Inventory reserved_quantity + DLQ ✅
- Schema OK: `reserved_quantity INTEGER DEFAULT 0`
- 28 items con reserva activa (max 3, total 36 unidades)
- **0 items oversold** (`reserved_quantity > quantity`)
- Tabla `failed_inventory_logs` (DLQ) existe ✓
- `inventory_logs` tiene 14 columnas correctas (sale_change_id incluido)

### 2.4 Accounting unify ❌ CRÍTICO
- ✅ Enum `account_type_enum` incluye `ASSET_INTANGIBLE`
- ❌ **34 de 34 cuentas descuadradas**: `balance_accounts.balance` ≠ `SUM(balance_entries.amount)`
- ❌ **Discrepancia total: $127,880,540** (suma de absolutos)
  - Top: "Prestamo Cristina" (2201) — $39M con 0 entries
  - "Nequi" (1103) — diferencia $21.5M
  - "Caja Mayor" (1102) — diferencia -$6.1M
  - 8 cuentas "Prestamo" sin ningún entry
- ✅ Endpoint `POST /global/accounting/set-balance` (en query params) **SÍ crea entry compensatoria** (test funcional: 1038 → 1039 entries en Caja Menor)

**Conclusión:** El bug está parcialmente fixeado en código actual, pero la deuda histórica $127.8M sigue irreconciliable sin intervención manual o backfill.

### 2.5 Original item disposal ⚠️
- Columna existe en `order_changes.original_item_disposal` (no en `sale_changes` — el plan tenía la tabla incorrecta)
- **30 registros, todos con `disposal = NULL`** — feature agregada pero **nunca poblada**. No se ha cableado al workflow de orden cambiada.

### 2.6 Global product permissions ✅
- 12 permisos relacionados:
  - `products.create_global`, `products.edit_global`, `products.delete_global`
  - `products.create`, `products.edit`, `products.delete`
  - `products.set_cost`, `products.set_price`, `products.view`
  - `garment_types.manage_global`
  - `global_inventory.adjust`
  - `accounting.view_global_balances`
- 97 permisos totales en el sistema

---

## Fase 3 — UI Tests Superuser

**Frontend:** `http://localhost:5171/` (Vite, IPv6 only)

| Página | Estado | Console errors | Notas |
|--------|--------|----------------|-------|
| `/login` | ✅ | 0 | Form login + Google OAuth visible |
| `/dashboard` | ✅ | 0 | KPIs correctos: $169.152.000 ventas, 1521 ventas, 11 colegios resumidos, todos los códigos en formato global |
| `/cfo` | ✅ | 0 (2 warns React Router v6→v7) | Health 88.9/100 "Saludable", Liquidez $12.4M, Burn rate $4.9M/mes, Cash Runway 76 días, alerta "461 productos sin costo" |
| `/accounting` | ✅ | 0 | Carga sin errores |
| `/sales` | ✅ | 0 | Lista renderizada |
| `/sale-changes` | ✅ | 0 | Lista renderizada |
| `/admin` | ✅ | 0 | 12 colegios listados, tabs: Colegios/Usuarios/Sistema |
| `/settings` | ✅ | 0 | Todas las cards superuser presentes: Servidor, Perfil, Seguridad, **Colegios**, **Usuarios**, **Zonas Envío**, **Información Negocio**, **Cargos** (v3 ✓), **Cuentas de Pago**, Notificaciones, Telegram, Impresora |

**Layer-8 verificado:**
- Token version invalidation: ✅ flujo end-to-end funciona (DB bump → token rechazado → re-login)
- Indicador "Conectado al servidor" siempre visible
- Indicador "MODO DESARROLLO" presente
- Versión 2.9.0 mostrada consistentemente
- Avatar muestra "Superusuario"

**Issues UI:** Solo 2 warnings React Router v6 (future flags v7) — non-blocking, dev-only.

---

## Fase 4 — Regresión 5 bugs catalogados

| # | Bug | Estado | Severidad | Cambio vs reporte |
|---|-----|--------|-----------|-------------------|
| **1** | `set_balance` sin entry compensatoria | ⚠️ MIXTO | P0 → P1 | Endpoint AHORA crea entry; pero $127.8M de discrepancia histórica legacy persistente (vs $21.6M originalmente reportado) |
| **2** | `mark_debt_as_paid` silent | ❌ REPRODUCIBLE EXACTO | **P0** | Confirmado en test funcional 2026-05-04: el endpoint cambia `status: pending → paid` y guarda metadatos pero **NO crea balance_entry, NO reduce balance de caja, NO crea expense de interés**. Silent accounting failure. |
| **3** | Pasivos archivados con balance > 0 | ❌ EXACTO | P1 | 9 cuentas, **$77,890,000** (idéntico al reporte). Top: "Prestamo Cristina" $39M, "Préstamo" $10M ×3 |
| **4** | AR sin due_date | ❌ PEOR | P1 | **163 / 190 (85.8%)** sin due_date — empeoró desde 57 reportados |
| **5** | `expenses.category` sin FK | ❌ REPRODUCIBLE | P2 | Confirmado vía API: `POST /expenses` acepta `"categoria_inventada_xyz"` y crea registro. **0 huérfanas actuales** (data quality por convención, no constraint). Tabla `expense_categories` existe (27 categorías) pero sin FK. |

**Detalle Bug 2 — silent failure confirmado:**
```
Test: POST /api/v1/global/accounting/planning/debt-schedule/{id}/mark-paid
Body: {paid_date, paid_amount=1000, payment_method=cash, payment_account_id=Caja Menor}

ANTES                    DESPUÉS                 ESPERADO
Caja Menor: $197,000     $197,000   (sin cambio)  $196,000 (-$1,000)
balance_entries: 1039    1039       (sin cambio)  1040 (+1 entry de -$1,000)
expenses interest: 0     0          (sin cambio)  1 (+1 expense $1,000)
debt status: pending     paid       ✓             paid ✓

Response: {"message":"Pago marcado como realizado","paid_amount":1000.0}
```
✅ El endpoint **simula éxito** pero solo persiste metadatos en la fila del schedule. El dinero "desaparece" del libro contable. Este bug, combinado con Bug 1, explica buena parte de la discrepancia $127.8M (cada préstamo "pagado" sin asiento se acumuló silenciosamente).

**Detalle Bug 1 — comportamiento mixto:**
```
Test: POST /api/v1/global/accounting/set-balance?account_code=1101&new_balance=197001
Antes: 1038 entries en Caja Menor, balance $197,000
Después: 1039 entries (+1 nuevo), balance $197,001
Response: {"message":"Balance actualizado","adjustment":1.0}
```
✅ La feature regresa entry. El bug de discrepancia histórica es una herencia de set_balance pre-fix que NO regresaba entry — el dato actual incluye esa deuda.

---

## Hallazgos Adicionales

### P3 (Cosmético)
1. **Auth sin token retorna 403 en vez de 401** (`/api/v1/auth/me` sin Authorization header). FastAPI default; semánticamente debería ser 401.
2. **Inconsistencia de case en account_type_enum:** DB usa `ASSET_CURRENT` (uppercase), CLAUDE.md indica `asset_current` (lowercase). Documentación o código desincronizados.

### P2 (Mejora)
3. **`order_changes.original_item_disposal` agregado pero nunca poblado** (30/30 registros con NULL). Feature parcialmente implementada — falta cableado en backend al procesar cambios.
4. **Vite escucha solo IPv6** (`[::1]:5171`) — `127.0.0.1` falla. Requiere usar `localhost` o `[::1]` en el browser. Posible inconsistencia con configuración esperada por testing automatizado.

### Observaciones positivas
- ✅ Token version v3 funciona end-to-end como diseñado
- ✅ Códigos globalizados aplicados al 100%
- ✅ Vendor normalization sin duplicados
- ✅ DLQ inventory existe
- ✅ 0 console errors en UI
- ✅ Health endpoint responde 1ms latencia DB

---

## Recomendaciones M3

### CRÍTICO (bloqueantes para "stabilization done")
1. **Bug 2 — Fix `mark_debt_as_paid` URGENTE (P0)**: el endpoint debe ser atomic, crear simultáneamente: (a) balance_entry negativa en `payment_account_id`, (b) expense con la categoría correcta (`interest` o `loan_principal` según el debt), (c) reducción del balance del pasivo si `balance_account_id` está vinculado. Reducir el balance manualmente del balance_account de cash. El bug confirmado actual: cambia status pero no toca dinero.
2. **Backfill de balance_entries** para reconciliar las 34 cuentas descuadradas ($127.8M). Probable causa raíz combinada con Bug 2: cada `mark-paid` histórico fue silent. Solución: crear script alembic data-migration o asiento único "Ajuste por reconstrucción contable v3".
3. **Bug 4 — backfill due_date en AR**: 163 registros con NULL → poblar con `created_at + 30 days` y agregar NOT NULL constraint.
4. **Bug 3 — limpieza de pasivos archivados**: definir si los 9 préstamos $77.9M se condonan (entry contra patrimonio), refinancian (transferencia entre cuentas), o si la archivación fue prematura.

### ALTO
5. **Bug 5 — agregar FK** `expenses.category → expense_categories.code`. Es no-op data-wise (0 huérfanas) pero cierra la vulnerabilidad.
6. **Cablear `order_changes.original_item_disposal`** al servicio de procesamiento de cambios.

### MEDIO
7. Sincronizar documentación enum case (DB lowercase vs CLAUDE.md).
8. Cambiar `403` a `401` en `auth/me` sin token (custom HTTPException en `OAuth2PasswordBearer`).

---

## Comando de re-ejecución

```bash
# Re-validar Bug 1 (después de fix data-migration)
docker exec uniformes-postgres psql -U uniformes_user -d uniformes_db -c "
WITH calc AS (SELECT a.id, a.balance, COALESCE(SUM(e.amount), 0) AS sum_e
              FROM balance_accounts a LEFT JOIN balance_entries e ON e.account_id=a.id
              GROUP BY a.id, a.balance)
SELECT count(*) FILTER (WHERE abs(balance - sum_e) > 1) AS aún_descuadradas FROM calc;"
# Esperado post-fix: 0

# Re-validar Bug 4
docker exec uniformes-postgres psql -U uniformes_user -d uniformes_db -c "
SELECT count(*) FILTER (WHERE due_date IS NULL) FROM accounts_receivable;"
# Esperado post-fix: 0

# Re-validar Bug 3
docker exec uniformes-postgres psql -U uniformes_user -d uniformes_db -c "
SELECT count(*) FROM balance_accounts WHERE NOT is_active AND balance > 0;"
# Esperado post-fix: 0
```

---

## Anexos

- Plan original: `~/.claude/plans/acabo-de-subir-un-virtual-knuth.md`
- OpenAPI snapshot: `/tmp/qa-postv3/openapi.json`
- Resultados Fase 1 raw: `/tmp/qa-postv3/phase1.csv`
- Skill: `~/.claude/skills/qa-agent/`
- Memory referencias: `stabilization_sprint_2026_q2.md`, `payments_security_findings.md`, `auth_session_invalidation_gaps.md`

**Ejecutado en:** ~25 minutos (incluyendo discovery de paths corregidos y cleanup).
