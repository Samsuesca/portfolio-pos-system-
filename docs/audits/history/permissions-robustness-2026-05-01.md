# Audit: Robustez del Sistema de Permisos (post-overhaul)

**Fecha:** 2026-05-01
**Alcance:** backend FastAPI + 3 frontends (Tauri desktop, Next.js admin, Expo mobile) + audit trail + tests
**Método:** análisis estático READ-ONLY sobre `main` (post-overhaul de 5 fases). Cualquier claim que requiera DB live se marca explícitamente.
**Auditor:** Claude (delegación a 3 agentes paralelos: backend / frontend / audit-trail+tests)

---

## TL;DR — Resumen ejecutivo

El overhaul de 5 fases está **estructuralmente sano** pero tiene **fugas críticas** en los caminos de mutación de roles que viven fuera de `school_users.py`. Los componentes principales (registry endpoint, cache compartido, migración de `permissions_version`, hook `usePermissionsRefresh`) existen y funcionan en el camino feliz, pero:

- **3 caminos de mutación de permisos NO bumpean `permissions_version`** → frontend nunca recibe la señal de refresh tras esos cambios.
- **2 de las 3 plataformas frontend (admin-portal, mobile) NO tienen `usePermissionsRefresh` montado** → contrato Phase 2B roto en 2/3 de la superficie.
- **`global_roles.py` (entire file) NO tiene audit logging** → cambios que afectan a TODOS los colegios son invisibles.
- **`invalidate_permission_cache(school_id=...)` accidentalmente flushea TODO el cache** (regresión de performance, no de seguridad).
- **4 permission codes referenciados en `require_permission(...)` NO existen en el registry** → ADMIN no puede usarlos, frontend no los ve.
- **Phase 2B (refresh hook) y Phase 3 (audit integration con rutas) tienen 0 tests integrados.**

**Veredicto v3.0.0:** **NO LISTO** para deploy desde el lado de permisos. Hay **3 findings CRITICAL** y **5 HIGH** que deben cerrarse antes de salir a prod. Detalle abajo.

---

## 1. Tabla de findings priorizada

| # | Severity | Área | File:line | Descripción |
|---|---|---|---|---|
| 1 | **CRITICAL** | bump_permissions_version | `backend/app/api/routes/users.py:241-274, 277-313, 316-343` | `add_user_school_role`, `update_user_school_role`, `remove_user_school_role` (superuser-only) llaman directamente a `UserService` sin bumpear `permissions_version` ni invalidar cache. Solo el path OWNER en `school_users.py` lo hace. Resultado: cambios de roles vía superuser dejan al usuario afectado con permisos stale en frontend hasta 60s. |
| 2 | **CRITICAL** | bump_permissions_version | `backend/app/api/routes/custom_roles.py:407-510, 521-568` | `update_custom_role` y `delete_custom_role` muta permisos efectivos de TODOS los usuarios con ese rol pero NO bumpean `permissions_version` de ninguno. Solo invalidan cache (mal — ver finding #4). Frontends polling `/auth/permissions-refresh` retornan `current` indefinidamente tras un cambio de custom role. |
| 3 | **CRITICAL** | bump + audit + cache | `backend/app/api/routes/global_roles.py:132-207, 286-366, 377-417` | `create/update/delete_global_custom_role` NO llaman `bump_permissions_version`, NO llaman `invalidate_permission_cache`, NO loguean a `audit_service`. Cambios cross-school silenciosos sin trazabilidad ni invalidación. |
| 4 | **CRITICAL** | Frontend Phase 2B coverage | `admin-portal/`, `mobile/` (ausencia de `usePermissionsRefresh.*`) | El hook solo está montado en `frontend/src/components/Layout.tsx:157`. Admin-portal y mobile NO consumen `/auth/permissions-refresh`. Un usuario al que se le revocan permisos debe re-login para que la UI lo refleje. Backend bloquea correctamente, pero la UI sigue mostrando opciones — UX rota y contrato Phase 2B incumplido en 2/3 plataformas. |
| 5 | **HIGH** | Cache invalidation semantics | `backend/app/services/permission_cache.py:71-90` + `custom_roles.py:471` | `invalidate(school_id=<x>)` (sin `user_id`) cae al branch `else` y limpia **TODO** el cache. Cada edición de cualquier custom role flushea cache de todos los usuarios en todos los colegios. Errs safe pero perf regression severa. La API no tiene un modo "by school" real. |
| 6 | **HIGH** | Audit no captura overrides | `backend/app/api/routes/school_users.py:491-510` | Cuando `update_user_role` muta `permission_overrides` (capa per-user grant/revoke), `_bump_and_invalidate` corre, pero `audit_service.log` solo registra `data_before/after` con `role` + `custom_role_id`. El diff de overrides es invisible. **Privilege escalations vía grant directo no se auditan.** |
| 7 | **HIGH** | Manual permission check ignora custom roles | `backend/app/api/routes/business_settings.py:48-86` | `update_business_info` checa permisos contra `SYSTEM_ROLE_PERMISSIONS` only — TODO explícito en línea 75. Un usuario con custom role que tiene `settings.edit_business_info` es denegado. Reemplazar con `Depends(require_global_permission("settings.edit_business_info"))`. |
| 8 | **HIGH** | Cross-school endpoints sin guard | `backend/app/api/routes/sales.py:41-498`, `backend/app/api/routes/orders.py:49-179` (+3 más) | `list_all_sales`, `get_sale_global`, `list_all_sale_changes`, `list_all_orders`, etc. solo filtran por `user_school_ids`. Un usuario sin `sales.view`/`orders.view` puede ver TODO en sus colegios vía cross-school endpoint, bypaseando el guard del per-school endpoint. **ACL inconsistente entre paths a la misma data.** |
| 9 | **HIGH** | Multi-worker cache coherency | `backend/app/services/permission_cache.py:1-91` | El cache es un dict de módulo Python. Con >1 worker uvicorn, `invalidate()` solo limpia el worker que atendió la mutación. Los demás sirven stale hasta TTL (60s). Combinado con findings #1/#2/#3, la revocación en tiempo real **no tiene garantías**. *Needs runtime verification del worker count en prod.* |
| 10 | **HIGH** | ETag round-trip roto end-to-end | `backend/app/api/routes/permission_registry.py:118-119` + 3 frontends | Backend setea `ETag: "<version>"` pero NO inspecciona `If-None-Match` (no hay path 304). Frontends hacen `apiClient.get('/permissions/registry')` sin headers. Resultado: cada login re-descarga full payload. ETag es decorativo. |
| 11 | **MEDIUM** | Permission codes huérfanos | `backend/app/services/permission.py:23-84` vs rutas | 4 codes en `require_permission(...)` ausentes de cualquier system role en `SYSTEM_ROLE_PERMISSIONS`: `accounting.adjust_expense` (`global_accounting.py:2321,2414,2492`), `employees.manage` (`employees.py:30+`), `payroll.manage` (`payroll.py:32-293`, 10 sites), `settings.manage_garment_types` (`products.py:501`). Existen en seed (`alembic/versions/b8d918cf1a56_add_granular_permissions.py:80,113`) → OWNER+superuser pueden, ADMIN/SELLER no. Frontend tampoco los ve en registry. |
| 12 | **MEDIUM** | No startup validation | `backend/app/main.py:91-125` | Nada valida que cada `require_permission("x.y")` exista en DB ni en `SYSTEM_ROLE_PERMISSIONS`. Typo `acouting.view` deploya y silentemente 403ea a todos excepto superuser. |
| 13 | **MEDIUM** | Custom roles create/delete sin audit | `backend/app/api/routes/custom_roles.py:257-327, 521-568` | Solo `update_custom_role` loguea (`:459-469`). Create y delete son silenciosos. |
| 14 | **MEDIUM** | Admin endpoints sin audit | `backend/app/api/routes/users.py:241,283,322,406,451,504` | `add_user_school_role`, `update_user_school_role`, `remove_user_school_role`, `admin_reset_password`, `admin_change_email`, `admin_set_superuser` NO emiten `audit_service.log`. **`admin_set_superuser` es el cambio de privilegio de mayor impacto en el sistema y es invisible.** |
| 15 | **MEDIUM** | Mobile sin RequirePermission | `mobile/` (no existe el componente) | Existe en desktop y admin-portal, no en mobile. Mobile usa checks ad-hoc por screen. Phase 4 pendiente para mobile. |
| 16 | **MEDIUM** | Schema check-constraint vs SET NULL | `backend/app/models/user.py:126-155` | `custom_role_id` tiene `ondelete="SET NULL"` pero check `(role IS NOT NULL) OR (custom_role_id IS NOT NULL)`. Row con `(NULL, custom_role_id)` y custom_role borrado vía SQL crudo viola check. La ruta lo bloquea con `user_count`, pero ops manuales son inseguros. *Needs runtime verification.* |
| 17 | **LOW** | No backoff en usePermissionsRefresh | `frontend/src/hooks/usePermissionsRefresh.ts:24-33` | Polling cada 60s sin backoff. `checkPermissionsRefresh` swallows errors retornando `null`. En outage del backend hammeas cada minuto. |
| 18 | **LOW** | Custom role drop silencioso | `backend/app/api/routes/custom_roles.py:599-612` | `_update_role_permissions` hace `if perm.code not in perm_map: continue`. Endpoint retorna 200 con role creado, permisos silentemente droppeados si código mal escrito. Debería retornar 400 con lista de unknown codes. |
| 19 | **LOW** | permission_overrides no validado contra registry | `backend/app/api/routes/school_users.py:491-495` | `grant`/`revoke` aceptan `list[str]` arbitrario. Typos no-op silenciosos (ej: querer grantear `sales.cancel` y tipear `sales.canc`). |
| 20 | **LOW** | Orphan custom_role → set() vacío silencioso | `backend/app/services/permission.py:179-202` | Si `custom_role_id` apunta a row borrada vía SQL crudo, `get_user_permissions` retorna `set()`. No 500, pero tampoco log de diagnóstico. Frontend ve "user has no permissions" sin razón visible. |
| 21 | **LOW** | Race: bump-then-invalidate-then-commit | `backend/app/api/routes/school_users.py:379, 511, 606` | Patrón: `audit_service.log(...) → _bump_and_invalidate(...) → db.commit()`. Invalidate antes de commit → request concurrente puede repoblar cache con estado pre-commit. Mínimo en single-worker; amplía ventana stale en multi-worker. *Needs runtime verification.* |
| 22 | **LOW** | AuditLog sin request_id ni school_id FK | `backend/app/models/audit_log.py:101-105` | `school_id` indexed pero sin FK → orphans posibles. Sin `request_id` para correlacionar con structured logs. Sin `target_user_id` distinto de `resource_id`. |

---

## 2. Snippets SQL para verificar audit_log en prod

```sql
-- 2.1 Conteo de eventos por action_type en últimas 48h (Colombia tz)
SELECT
    action,
    resource_type,
    COUNT(*) AS events,
    COUNT(DISTINCT actor_id) AS distinct_actors,
    MIN(created_at) AS first_seen,
    MAX(created_at) AS last_seen
FROM audit_logs
WHERE created_at >= (NOW() AT TIME ZONE 'America/Bogota') - INTERVAL '48 hours'
GROUP BY action, resource_type
ORDER BY events DESC;

-- 2.2 Orphans: actor_id presente pero usuario ya no existe.
-- Debe ser 0 si ON DELETE SET NULL funciona. Non-zero = bug.
SELECT
    al.id          AS audit_log_id,
    al.actor_id    AS missing_actor_id,
    al.action,
    al.created_at
FROM audit_logs al
LEFT JOIN users u ON u.id = al.actor_id
WHERE al.actor_id IS NOT NULL
  AND u.id IS NULL
ORDER BY al.created_at DESC
LIMIT 100;

-- 2.3 Orphans de school_id (sin FK enforced)
SELECT
    al.id            AS audit_log_id,
    al.school_id     AS missing_school_id,
    al.action,
    COUNT(*) OVER (PARTITION BY al.school_id) AS rows_with_this_school
FROM audit_logs al
LEFT JOIN schools s ON s.id = al.school_id
WHERE al.school_id IS NOT NULL
  AND s.id IS NULL
ORDER BY al.created_at DESC
LIMIT 100;

-- 2.4 Gaps: días sin ningún evento en últimos 30 días
WITH calendar AS (
    SELECT generate_series(
        (CURRENT_DATE - INTERVAL '30 days')::date,
        CURRENT_DATE,
        INTERVAL '1 day'
    )::date AS day
),
daily AS (
    SELECT
        (created_at AT TIME ZONE 'America/Bogota')::date AS day,
        COUNT(*) AS events
    FROM audit_logs
    WHERE created_at >= NOW() - INTERVAL '31 days'
    GROUP BY 1
)
SELECT
    c.day,
    COALESCE(d.events, 0) AS events,
    EXTRACT(DOW FROM c.day) AS day_of_week
FROM calendar c
LEFT JOIN daily d ON d.day = c.day
WHERE COALESCE(d.events, 0) = 0
ORDER BY c.day DESC;

-- 2.5 Verificar que la migración permissions_version corrió
SELECT
    permissions_version,
    COUNT(*) AS users
FROM users
GROUP BY permissions_version
ORDER BY users DESC
LIMIT 10;
-- Si error "column does not exist" → migración no corrió.
-- Si todos en 0 → la columna existe pero nadie ha bumped (sospechoso).
```

---

## 3. Tests faltantes para 100% de las 5 fases

**Estado actual de los tests del backend:** 139/139 pasan (`pytest tests/security tests/test_permissions* -v`).

| Fase | Descripción | Cobertura actual | Tests faltantes propuestos |
|---|---|---|---|
| **0A** | `GET /permissions/registry` HTTP layer | Parcial — `test_permission_dependencies.py::TestPermissionRegistry` (5 tests) cubre el builder helper, NO el endpoint HTTP | `test_registry_endpoint_returns_200_no_auth`, `test_registry_endpoint_sets_etag_and_cache_control`, `test_registry_endpoint_returns_304_on_matching_etag` |
| **0B** | Frontend permissionRegistryService | Existe en git status untracked: `frontend/src/services/__tests__/permissionRegistryService.test.ts` | Commit pendiente. Replicar para admin-portal y mobile. |
| **1** | Migración a `require_permission` | Parcial — 16 tests unit-level en `test_permission_dependencies.py` | `test_sales_route_returns_403_for_user_without_sales_view`, `test_orders_global_endpoint_enforces_orders_view` (cierra finding #8) |
| **1C** | Legacy deps removed | Implícito — no hay regression test | `test_no_legacy_dependencies_in_routes` (grep CI: `require_school_access`, `require_any_school_admin`, `can_*` deben ser 0 matches) |
| **2A** | Shared TTL cache | Sólida — `test_permission_cache.py` (19 tests) | Agregar `test_invalidate_by_school_only_clears_school_keys` (cierra finding #5) |
| **2B** | `permissions_version` + refresh hook | **0 tests** | `test_bump_permissions_version_increments_counter`, `test_permissions_refresh_returns_204_when_versions_match`, `test_permissions_refresh_returns_payload_when_diverge`, `test_users_admin_endpoints_bump_version` (cierra finding #1), `test_custom_role_update_bumps_all_assigned_users` (cierra finding #2), `test_global_role_update_bumps_all_users` (cierra finding #3) |
| **3** | AuditService integration con rutas | Parcial — `test_audit_service.py` (19 service-level), 0 integration tests | `test_invite_user_writes_audit_log`, `test_update_role_writes_before_after_to_audit`, `test_remove_user_writes_data_before`, `test_custom_role_update_logs_permission_diff`, `test_admin_set_superuser_writes_audit` (cierra finding #14), `test_global_role_create_writes_audit` (cierra finding #3) |

**Tests prioritarios (orden de ejecución):**
1. Phase 2B suite completa (cierra 3 CRITICAL).
2. Phase 3 integration tests (cierra audit gaps en CRITICAL #3 y MEDIUM #14).
3. Phase 1C regression guard (previene re-introducción de legacy deps).
4. Phase 0A HTTP-level tests (cierra ETag round-trip de finding #10).

---

## 4. Recomendación: ¿v3.0.0 listo para deploy desde el lado de permisos?

### **NO. Bloqueadores:**

#### Hard blockers (deben cerrarse antes de v3.0.0):
1. **Mover `bump_permissions_version` + cache invalidate a las service methods** (`UserService.add_school_role`, `update_school_role`, `remove_school_role`) en lugar de tenerlo solo en `school_users.py:_bump_and_invalidate`. Esto cierra findings #1, #2, #3 de un solo cambio.
2. **Auditar `global_roles.py` completo** — actualmente CERO observabilidad sobre cambios cross-school.
3. **Implementar `usePermissionsRefresh` en admin-portal y mobile** — el contrato Phase 2B no se sostiene con 1/3 de cobertura.
4. **Fix `permission_cache.invalidate(school_id=...)`** — implementar scan real por sufijo `:<school_id>` o eliminar el parámetro.
5. **Reemplazar manual permission check en `business_settings.py:48-86`** con `Depends(require_global_permission(...))`.
6. **Añadir guards a cross-school endpoints en `sales.py` y `orders.py`** (HIGH #8) — ACL debe ser consistente entre `/sales/{id}` y `/schools/{school_id}/sales/{id}`.

#### Soft blockers (recomendado pero no bloqueante):
7. **Añadir validador de startup** que walkea routers y asegura que cada permission code existe en DB y en al menos un system role. Cierra finding #11 (4 codes huérfanos) + #12 (typos silenciosos).
8. **Auditar admin endpoints en `users.py`** (especialmente `admin_set_superuser`).
9. **Tests de Phase 2B y Phase 3 integration** antes de declarar GA.
10. **Implementar `RequirePermission` en mobile** (Phase 4).

#### Nice-to-have (post v3.0.0):
- Reemplazar permission_cache por Redis-backed cache para multi-worker coherency (finding #9).
- Añadir `request_id`, `school_id` FK, `target_user_id` al `AuditLog` model.
- Implementar If-None-Match en backend + frontends (cierra finding #10 con bonus de bandwidth saving).
- Validar `permission_overrides` contra el registry al grant/revoke (finding #19).

### Estimación de esfuerzo para hard blockers
Aproximada, por bloqueador:
- #1 (mover bump a services): 2-4h (cambio de 3 services + tests).
- #2 (audit global_roles): 1-2h (decorador `@audit_action` ya existe en `audit_decorator.py:27` sin uso → aplicar).
- #3 (frontend Phase 2B en 2 plataformas): 4-6h por plataforma.
- #4 (cache invalidation by school): 1-2h.
- #5 (business_settings refactor): 30min.
- #6 (cross-school guards): 2-3h (8+ endpoints).

**Total estimado:** ~16-24h de trabajo focused. Razonable cerrarlo en 2-3 días antes del cutover a v3.0.0.

---

## 5. Notas adicionales (positivos del audit)

- **Legacy dependencies completamente removidos.** Grep por `require_school_access`, `require_any_school_admin`, `can_manage_users`, `can_access_accounting`, `can_modify_inventory`, `can_create_sales`, `can_delete_records` retorna 0 matches en todo el repo. Phase 1C cumplido.
- **Migración `permissions_version` está en chain.** `c2d3e4f5g6h7_add_permissions_version_to_users.py` con `server_default="0"` (safe para rows existentes), downgrade limpio, chain continúa con `d3e4f5g6h7i8`.
- **Naming consistency cross-platform.** Las 3 plataformas usan los mismos permission codes (`<domain>.<action>`). Verificado por grep de `hasPermission(...)` en frontend / admin-portal / mobile. Sin divergencias semánticas.
- **`usePermissions` no tiene `SYSTEM_ROLE_PERMISSIONS` hardcoded** en ninguna plataforma. Registry es source of truth en las 3.
- **Tests existentes pasan al 100%.** 139/139 en `tests/security` + `tests/unit/test_permission*` + `tests/unit/test_audit_service.py`.
- **`AuditService.log` está bien diseñado.** Truncado correcto de user_agent (500 chars), schemas claros. El gap es de call sites, no del servicio.
- **Decorator `@audit_action` ya existe** (`backend/app/utils/audit_decorator.py:27`) sin uso — ofrece bajo costo de adopción para cerrar audit gaps de Section 2.

---

## 6. Top 3 acciones inmediatas

1. **Refactor `bump_permissions_version` a la capa de servicio** — un solo cambio cierra 3 CRITICAL.
2. **Añadir `audit_service.log` a `global_roles.py` y `users.py` admin endpoints** — usa el `@audit_action` decorator existente.
3. **Implementar `usePermissionsRefresh` en admin-portal y mobile** — copy-paste del hook desktop, montar en raíz.

Cerradas estas 3, el sistema queda en estado deployable. El resto se puede hacer post-v3.0.0.

---

**Archivos referenciados (rutas absolutas):**

Backend:
- `/Users/angelsamuelsuescarios/Documents/03_Proyectos/Codigo/uniformes-system-v2/backend/app/services/permission.py`
- `/Users/angelsamuelsuescarios/Documents/03_Proyectos/Codigo/uniformes-system-v2/backend/app/services/permission_cache.py`
- `/Users/angelsamuelsuescarios/Documents/03_Proyectos/Codigo/uniformes-system-v2/backend/app/services/user.py`
- `/Users/angelsamuelsuescarios/Documents/03_Proyectos/Codigo/uniformes-system-v2/backend/app/services/audit.py`
- `/Users/angelsamuelsuescarios/Documents/03_Proyectos/Codigo/uniformes-system-v2/backend/app/api/routes/school_users.py`
- `/Users/angelsamuelsuescarios/Documents/03_Proyectos/Codigo/uniformes-system-v2/backend/app/api/routes/custom_roles.py`
- `/Users/angelsamuelsuescarios/Documents/03_Proyectos/Codigo/uniformes-system-v2/backend/app/api/routes/global_roles.py`
- `/Users/angelsamuelsuescarios/Documents/03_Proyectos/Codigo/uniformes-system-v2/backend/app/api/routes/users.py`
- `/Users/angelsamuelsuescarios/Documents/03_Proyectos/Codigo/uniformes-system-v2/backend/app/api/routes/sales.py`
- `/Users/angelsamuelsuescarios/Documents/03_Proyectos/Codigo/uniformes-system-v2/backend/app/api/routes/orders.py`
- `/Users/angelsamuelsuescarios/Documents/03_Proyectos/Codigo/uniformes-system-v2/backend/app/api/routes/business_settings.py`
- `/Users/angelsamuelsuescarios/Documents/03_Proyectos/Codigo/uniformes-system-v2/backend/app/api/routes/permission_registry.py`
- `/Users/angelsamuelsuescarios/Documents/03_Proyectos/Codigo/uniformes-system-v2/backend/app/models/audit_log.py`
- `/Users/angelsamuelsuescarios/Documents/03_Proyectos/Codigo/uniformes-system-v2/backend/app/models/user.py`
- `/Users/angelsamuelsuescarios/Documents/03_Proyectos/Codigo/uniformes-system-v2/backend/app/utils/audit_decorator.py`
- `/Users/angelsamuelsuescarios/Documents/03_Proyectos/Codigo/uniformes-system-v2/backend/alembic/versions/c2d3e4f5g6h7_add_permissions_version_to_users.py`
- `/Users/angelsamuelsuescarios/Documents/03_Proyectos/Codigo/uniformes-system-v2/backend/alembic/versions/b8d918cf1a56_add_granular_permissions.py`

Frontend:
- `/Users/angelsamuelsuescarios/Documents/03_Proyectos/Codigo/uniformes-system-v2/frontend/src/services/permissionRegistryService.ts`
- `/Users/angelsamuelsuescarios/Documents/03_Proyectos/Codigo/uniformes-system-v2/frontend/src/hooks/usePermissions.ts`
- `/Users/angelsamuelsuescarios/Documents/03_Proyectos/Codigo/uniformes-system-v2/frontend/src/hooks/usePermissionsRefresh.ts`
- `/Users/angelsamuelsuescarios/Documents/03_Proyectos/Codigo/uniformes-system-v2/frontend/src/components/RequirePermission.tsx`
- `/Users/angelsamuelsuescarios/Documents/03_Proyectos/Codigo/uniformes-system-v2/frontend/src/components/Layout.tsx`
- `/Users/angelsamuelsuescarios/Documents/03_Proyectos/Codigo/uniformes-system-v2/admin-portal/lib/services/permissionRegistryService.ts`
- `/Users/angelsamuelsuescarios/Documents/03_Proyectos/Codigo/uniformes-system-v2/admin-portal/lib/hooks/usePermissions.ts`
- `/Users/angelsamuelsuescarios/Documents/03_Proyectos/Codigo/uniformes-system-v2/admin-portal/components/RequirePermission.tsx`
- `/Users/angelsamuelsuescarios/Documents/03_Proyectos/Codigo/uniformes-system-v2/mobile/src/services/permissionRegistryService.ts`
- `/Users/angelsamuelsuescarios/Documents/03_Proyectos/Codigo/uniformes-system-v2/mobile/src/hooks/usePermissions.ts`

Tests:
- `/Users/angelsamuelsuescarios/Documents/03_Proyectos/Codigo/uniformes-system-v2/backend/tests/security/test_permission_security.py`
- `/Users/angelsamuelsuescarios/Documents/03_Proyectos/Codigo/uniformes-system-v2/backend/tests/unit/test_permission_cache.py`
- `/Users/angelsamuelsuescarios/Documents/03_Proyectos/Codigo/uniformes-system-v2/backend/tests/unit/test_permission_dependencies.py`
- `/Users/angelsamuelsuescarios/Documents/03_Proyectos/Codigo/uniformes-system-v2/backend/tests/unit/test_permission_service.py`
- `/Users/angelsamuelsuescarios/Documents/03_Proyectos/Codigo/uniformes-system-v2/backend/tests/unit/test_audit_service.py`
