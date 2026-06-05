# Plan de remediación — Sistema de permisos post-overhaul (v3.0.0)

**Fecha:** 2026-05-01
**Audit base:** `docs/audits/history/permissions-robustness-2026-05-01.md`
**Target:** v3.0.0 deployment-ready desde permisos
**Estimación:** ~30h dev focused. Timeline realista 3-4 días hábiles (1 dev) o 2-3 días (2 devs).

---

## Context

El sistema de permisos pasó por un overhaul de 5 fases entre 2026-04-10 y 2026-04-13 (registry endpoint, 200 endpoints migrados a `require_permission`, cache compartido, `permissions_version` + refresh hook, AuditService integrado). El audit del 2026-05-01 reveló **3 CRITICAL + 7 HIGH** que bloquean v3.0.0:

- 3 caminos de mutación de roles (`users.py` admin, `custom_roles.update/delete`, `global_roles.*`) no llaman `bump_permissions_version` → frontend nunca recibe señal de refresh.
- 2 de 3 frontends (admin-portal, mobile) no consumen `/auth/permissions-refresh` → contrato Phase 2B roto en 2/3 superficie.
- `global_roles.py` entero sin audit logging → cambios cross-school invisibles.
- `invalidate_permission_cache(school_id=...)` flushea todo el cache (perf regression).
- 4 permission codes referenciados en routes pero ausentes de `SYSTEM_ROLE_PERMISSIONS` → ADMIN no puede usarlos.
- Cross-school endpoints en `sales.py`/`orders.py` sin guard `require_permission`.
- `business_settings.py` ignora custom roles (manual check).

Este plan cierra los blockers con cambios mínimos invasivos, cero downtime, y rollback en `git revert`. Sin migraciones nuevas de DB en el camino crítico.

---

## Tabla resumen de fases

| Fase | Objetivo | Findings | Horas | Bloqueantes |
|------|----------|----------|-------|-------------|
| **0** | Pre-flight: branch, snapshot DB, baseline | — | 1 | — |
| **1** | Refactor `bump+invalidate` a service layer | #1, #2, #3 (parcial) | 4 | Fase 0 |
| **2** | Audit logging en `global_roles.py` y `users.py` admin | #3, #14 | 3 | Fase 1 |
| **3** | Fix `invalidate(school_id=...)` con scan real | #5 | 2 | Fase 1 |
| **4** | `business_settings.py` → `require_global_permission` | #7 | 0.5 | Paralelizable |
| **5** | Cross-school endpoints — guards `require_permission` | #8 | 3 | Paralelizable |
| **6** | `usePermissionsRefresh` en admin-portal y mobile | #4 | 5 | Paralelizable |
| **7** | Tests Phase 2B + Phase 3 integration | valida 1-6 | 6 | Fase 1, 2 |
| **8** | Audit `permission_overrides` diff + valida codes | #6, #19 | 2 | Fase 2 |
| **9** | Startup validator: codes huérfanos + typos | #11, #12 | 2 | Independiente |
| **10** | Deploy a producción (canary + monitor) | — | 2 | Todo verde |
| **11 (post-v3)** | Backlog: Redis, ETag round-trip, etc. | #9, #10, #15-22 | 16-24 | Sprint+1/+2 |

**Camino crítico:** `0 → 1 → 7 → 10`. Fases 3-6, 9 paralelizables después de Fase 1.

---

## Diagrama de dependencias

```
Fase 0 (pre-flight)
  └─> Fase 1 (refactor bump→service layer)
        ├─> Fase 2 (audit global_roles + users.admin)
        │     └─> Fase 8 (overrides diff + code validation)
        ├─> Fase 3 (cache invalidate by_school)
        └─> Fase 7 (tests Phase 2B + 3) ◄── BLOQUEA deploy
                 ▲
                 └── valida Fase 1, 2, 3, 6

Fase 4 (business_settings)         ─┐
Fase 5 (cross-school guards)       ─┼─ paralelizables, sin deps
Fase 6 (frontends refresh hook)    ─┤
Fase 9 (startup validator)         ─┘

Fase 10 (deploy) requiere: Fases 1-9 verdes
```

---

## Fase 0 — Pre-flight (1h)

**Tareas:**
- `git checkout -b feature/permissions-hardening-v3` desde `main`. PRs incrementales hacia `develop` por fase.
- `pytest backend/tests/security backend/tests/unit/test_permission_*.py backend/tests/unit/test_audit_service.py -v` → guardar baseline (audit afirma 139/139).
- Snapshot schema prod: `pg_dump --schema-only` → `~/.claude/snapshots/permissions-prod-2026-05-01.sql`.
- Verificar `permissions_version` aplicado en prod: `SELECT permissions_version FROM users LIMIT 1`. Si error → bloqueante.
- Confirmar conteo workers uvicorn en prod: `ps aux | grep uvicorn | wc -l` (informa Fase 11 Redis).

**Criterios de aceptación:** baseline 139/139 verde + snapshot guardado + `permissions_version` confirmado en prod.

---

## Fase 1 — Refactor `bump_permissions_version` + invalidación a service layer (4h)

**Cierra:** #1, #2, #3 (parcial). Centraliza invalidación en un único punto, post-commit.

### Diseño

Nuevo módulo: `backend/app/services/permission_invalidation.py` con clase `PermissionInvalidator`. Toda mutación que afecta permisos efectivos pasa por aquí. Garantiza:
1. `permissions_version` bumpea dentro del transaction.
2. `permission_cache` invalida **después de commit** (cierra race finding #21).
3. Punto único para extender a Redis pub/sub en Fase 11.

```python
# backend/app/services/permission_invalidation.py
class PermissionInvalidator:
    def __init__(self, db: AsyncSession):
        self.db = db
        self._post_commit_users: list[tuple[UUID, UUID | None]] = []

    async def bump_user(self, user_id: UUID, school_id: UUID | None = None) -> None:
        await self.db.execute(
            update(User).where(User.id == user_id)
            .values(permissions_version=User.permissions_version + 1)
        )
        self._post_commit_users.append((user_id, school_id))

    async def bump_users_by_custom_role(self, custom_role_id: UUID) -> int:
        rows = await self.db.execute(
            select(UserSchoolRole.user_id, UserSchoolRole.school_id)
            .where(UserSchoolRole.custom_role_id == custom_role_id)
        )
        pairs = list(rows.fetchall())
        if not pairs:
            return 0
        user_ids = list({uid for uid, _ in pairs})
        await self.db.execute(
            update(User).where(User.id.in_(user_ids))
            .values(permissions_version=User.permissions_version + 1)
        )
        for uid, sid in pairs:
            self._post_commit_users.append((uid, sid))
        return len(user_ids)

    def flush_cache_after_commit(self) -> None:
        for user_id, school_id in self._post_commit_users:
            cache_invalidate(user_id=user_id, school_id=school_id)
        self._post_commit_users.clear()
```

### Archivos a modificar

- **Nuevo:** `backend/app/services/permission_invalidation.py` (~50 líneas).
- `backend/app/services/user.py:322-445` — `add/update/remove_school_role` aceptan `invalidator: PermissionInvalidator | None = None` opcional.
- `backend/app/api/routes/users.py:241-343` — `add/update/remove_user_school_role` (3 endpoints) usan invalidator + `flush_cache_after_commit()` post-commit.
- `backend/app/api/routes/custom_roles.py:407-510, 521-568` — `update_custom_role`/`delete_custom_role` reemplazan `invalidate_permission_cache(school_id=...)` por `invalidator.bump_users_by_custom_role(role_id)`.
- `backend/app/api/routes/global_roles.py:286-417` — `update_global_custom_role`/`delete_global_custom_role` mismo patrón.
- `backend/app/api/routes/school_users.py:35-39, 379, 511, 606` — reemplazar `_bump_and_invalidate` con `PermissionInvalidator`. Mover invalidación a post-commit.

### Tests

Nuevo `backend/tests/unit/test_permission_invalidation.py`:
- `test_bump_user_increments_version_in_db`
- `test_bump_users_by_custom_role_affects_only_assignees`
- `test_flush_cache_after_commit_clears_entries`
- `test_invalidator_does_not_flush_before_commit`

Nuevo `backend/tests/api/test_users_admin_routes.py` (verificar si ya existe):
- `test_add_user_school_role_bumps_target_version`
- `test_update_user_school_role_bumps_version`
- `test_remove_user_school_role_bumps_version`

Nuevo `backend/tests/api/test_custom_roles_routes.py`:
- `test_update_custom_role_bumps_all_assigned_users`
- `test_delete_custom_role_with_zero_users_no_bump`

### Criterios de aceptación

- Tests nuevos verdes (4 + 5 = 9).
- Grep no encuentra `cache_invalidate(...)` ni `bump_permissions_version(...)` directos en `app/api/routes/*.py` excepto vía `PermissionInvalidator`.
- Manual: `POST /users/{u}/schools/{s}/role` (superuser) → query SQL confirma `permissions_version + 1`.

### Riesgos

- Callers no auditados de `UserService.add_school_role` (seeds/tests). **Mitigación:** parámetro opcional `invalidator=None` mantiene retrocompat. Grep antes de cambiar firma.
- Bulk `update User WHERE id IN (...)` con muchos users en un custom_role. **Mitigación:** WHERE id IN usa índice PK. Cardinality realista (decenas). Si crece, mover a job async.

### Backwards compatibility

API pública sin cambios. Service kwargs son opcionales. Cliente Tauri sin impacto (server-side only).

### Rollback

`git revert` del PR. Sin migraciones DB. TTL de 60s absorbe inconsistencias transitorias.

---

## Fase 2 — Audit logging en `global_roles.py` y `users.py` admin endpoints (3h)

**Cierra:** #3 (audit), #14, #13.

### Archivos a modificar

**1. `backend/app/api/routes/global_roles.py`** — añadir `audit_service.log` en:
- `create_global_custom_role:132-207` — post-flush, pre-commit. `data_after = {code, name, permissions: [p.code for p in request.permissions]}`.
- `update_global_custom_role:286-366` — capturar `old_permission_codes` antes de `_update_role_permissions`. `data_before/after` con diff.
- `delete_global_custom_role:377-417` — log antes de `db.delete(role)` con `data_before` completo.

**2. `backend/app/api/routes/users.py`** — añadir log en:
- `add_user_school_role:241-274` (HIGH PRIORITY: privilege grant via superuser).
- `update_user_school_role:283-313`.
- `remove_user_school_role:322-343`.
- `admin_reset_password:406-442` — descripción `"Password reset by admin"`. **NO loguear password ni hash.**
- `admin_change_email:451-495` — `data_before/after = {email}`.
- `admin_set_superuser:504-537` — **MÁS CRÍTICO**. `data_before/after = {is_superuser}`. Acción `SUPERUSER_CHANGE` (nuevo enum) o `PERMISSION_CHANGE` con descripción explícita.

**3. `backend/app/api/routes/custom_roles.py`** — completar audits faltantes:
- `create_custom_role:257-327` — log post-flush.
- `delete_custom_role:521-568` — log antes de delete con `data_before`.

**4. `backend/app/models/audit_log.py`** — verificar `AuditAction` enum. Probable agregar:
- `SUPERUSER_CHANGE = "superuser_change"`
- `PASSWORD_RESET = "password_reset"`
- `EMAIL_CHANGE = "email_change"`

Si no existen, añadir. Si existen como `PERMISSION_CHANGE` genérico, usar y diferenciar por `description` + `resource_type`.

**5. Inyectar `Request` en endpoints que no lo tenían** para que `audit_service.log` capture IP/UA.

### Migraciones DB

**Ninguna.** `audit_logs` ya soporta todos los campos.

### Tests

Nuevo `backend/tests/api/test_audit_integration.py` (~10 tests):
- `test_invite_user_writes_audit_log`
- `test_role_change_writes_before_after`
- `test_remove_user_writes_data_before`
- `test_admin_set_superuser_writes_audit` (CRITICAL — finding #14)
- `test_admin_reset_password_no_password_in_log` (regression: password NO en log)
- `test_global_role_create_writes_audit` (cierra #3)
- `test_global_role_update_writes_audit_with_permission_diff`
- `test_global_role_delete_writes_audit`
- `test_custom_role_create_writes_audit`
- `test_custom_role_delete_writes_audit`

### Criterios de aceptación

- 10/10 tests verdes.
- Manual: `PUT /users/{u}/superuser` → `SELECT * FROM audit_logs WHERE action='superuser_change' ORDER BY created_at DESC LIMIT 1` muestra el evento.

### Riesgos

- Loguear data sensible (passwords, tokens). **Mitigación:** code review explícito de cada `data_before/after`. Test `test_admin_reset_password_no_password_in_log` verifica.
- `audit_service.log` falla y rompe endpoint. **Mitigación:** mantener log dentro de la misma transaction; si falla, todo se rollback.

---

## Fase 3 — Fix `permission_cache.invalidate(school_id=...)` (2h)

**Cierra:** #5.

### Diagnóstico

`backend/app/services/permission_cache.py:71-90` branch `else` (cuando solo viene `school_id`) llama `_permission_cache.clear()` → flushea todo. Bug.

### Diseño

**Opción A — Scan por sufijo `:<school_id>`** (recomendada). Cero cambios en shape de keys. O(1000) por flush, aceptable para cardinality realista. Si performance se vuelve issue → Redis en Fase 11.

```python
# backend/app/services/permission_cache.py:71-90 (reemplazar)
def invalidate(user_id: UUID | None = None, school_id: UUID | None = None) -> None:
    if user_id and school_id:
        key = _cache_key(user_id, school_id)
        _permission_cache.pop(key, None)
        prefix = f"{user_id}:{school_id}:"
        for k in [k for k in _constraint_cache if k.startswith(prefix)]:
            del _constraint_cache[k]
    elif user_id:
        prefix = f"{user_id}:"
        for k in [k for k in _permission_cache if k.startswith(prefix)]:
            del _permission_cache[k]
        for k in [k for k in _constraint_cache if k.startswith(prefix)]:
            del _constraint_cache[k]
    elif school_id:
        suffix = f":{school_id}"
        for k in [k for k in _permission_cache if k.endswith(suffix)]:
            del _permission_cache[k]
        sid_str = str(school_id)
        for k in [k for k in _constraint_cache if ":" in k and k.split(":")[1] == sid_str]:
            del _constraint_cache[k]
    else:
        _permission_cache.clear()
        _constraint_cache.clear()
```

### Tests

Nuevos en `backend/tests/unit/test_permission_cache.py`:
- `test_invalidate_by_school_only_clears_school_keys` (4 entries × 2 schools, invalida 1 → solo borra ese)
- `test_invalidate_by_school_clears_constraint_cache_for_school`
- `test_invalidate_by_user_does_not_match_prefix_clash` (regresión)

### Criterios de aceptación

- 3/3 tests verdes. Editar custom_role en school A no flushea cache de school B.

---

## Fase 4 — `business_settings.py` → `require_global_permission` (0.5h)

**Cierra:** #7.

### Cambio

`backend/app/api/routes/business_settings.py:48-86` — reemplazar manual permission check con `Depends(require_global_permission("settings.edit_business_info"))`.

```python
# antes: ~30 líneas de check manual contra SYSTEM_ROLE_PERMISSIONS
# después:
@router.put("", ...)
async def update_business_info(
    updates: BusinessInfoUpdate,
    db: DatabaseSession,
    current_user: CurrentUser,
    _: None = Depends(require_global_permission("settings.edit_business_info")),
):
    service = BusinessSettingsService(db)
    result = await service.update_bulk(updates, updated_by=current_user.id)
    await db.commit()
    return result
```

Eliminar import `SYSTEM_ROLE_PERMISSIONS` y constante `PERMISSION_EDIT_BUSINESS_INFO`.

### Tests

`backend/tests/api/test_business_settings_routes.py`:
- `test_update_business_info_allows_owner` (sanity)
- `test_update_business_info_allows_custom_role_with_permission` (NUEVO, cierra el bug)
- `test_update_business_info_denies_user_without_permission`

---

## Fase 5 — Cross-school endpoints: guards `require_permission` (3h)

**Cierra:** #8.

### Diagnóstico verificado

`sales.py:41-498` (`list_all_sales`, `get_sale_global`, `list_all_sale_changes`) y `orders.py:49-179` (`list_all_orders`) solo filtran por `user_school_ids`. ACL inconsistente con per-school path.

### Tarea 5.1 (15 min) — discovery

Grep `user_school_ids: UserSchoolIds` en `app/api/routes/*.py`, filtrar los que NO tienen `Depends(require_permission(...))`.

### Diseño

Nuevo helper en `backend/app/api/dependencies.py`:

```python
def get_user_school_ids_with_permission(permission_code: str):
    async def _dep(
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ) -> list[UUID]:
        if current_user.is_superuser:
            return [r.school_id for r in current_user.school_roles]
        ps = PermissionService(db)
        result = []
        for r in current_user.school_roles:
            perms = await ps.get_user_permissions(current_user.id, r.school_id)
            if permission_code in perms:
                result.append(r.school_id)
        return result
    return _dep
```

Uso en endpoint:
```python
async def list_all_sales(
    db: DatabaseSession,
    current_user: CurrentUser,
    user_school_ids: list[UUID] = Depends(get_user_school_ids_with_permission("sales.view")),
    ...
):
    if not user_school_ids:
        return PaginatedResponse(...)  # empty
    # rest unchanged
```

### Endpoints a modificar (mínimo)

- `sales.py:48-165` `list_all_sales` → `sales.view`
- `sales.py:175-198` `get_sale_global` → `sales.view`
- `sales.py:326-419` `list_all_sale_changes` → `sales.view`
- `orders.py:56-176` `list_all_orders` → `orders.view`
- + los 3 adicionales que aparezcan en discovery

### Tests

`backend/tests/api/test_sales_routes.py`:
- `test_list_all_sales_filters_to_schools_with_sales_view` (user con perms en A pero no B → solo A)
- `test_list_all_sales_empty_for_user_without_sales_view`

Paralelo en `test_orders_routes.py`.

### Riesgos

- Frontend que asume listas no filtradas. **Mitigación:** es el comportamiento correcto; el bug es lo actual. Avisar a UX/añadir mensaje "no tienes permiso".
- N queries extra por request. **Mitigación:** cache de PermissionService ya existe; batch-fetch si crece.

---

## Fase 6 — `usePermissionsRefresh` en admin-portal y mobile (5h)

**Cierra:** #4.

### Decisión

**Copy-paste a cada plataforma para v3.0.0** (vs shared package). Storage diverge (localStorage vs AsyncStorage), api-client diverge. Monorepo workspace setup = 15h adicionales que no caben. Post-v3 evaluar `@uniformes/permissions-client`.

### Cambios

**1. `admin-portal/lib/services/permissionRegistryService.ts`** — añadir `checkPermissionsRefresh`:
```typescript
export async function checkPermissionsRefresh(currentVersion: number): Promise<PermissionsRefreshResponse | null> {
  try {
    const response = await apiClient.get<PermissionsRefreshResponse>(
      `/auth/permissions-refresh?version=${currentVersion}`
    );
    return response.data;
  } catch {
    return null;
  }
}
```

**2. Nuevo `admin-portal/lib/hooks/usePermissionsRefresh.ts`** — copia de `frontend/src/hooks/usePermissionsRefresh.ts` con import de `useAdminAuth`.

**3. Montar en admin-portal:** identificar `app/layout.tsx` o `<AppShell>` client-side wrapper. Hook necesita `'use client'`.

**4. Nuevo `mobile/src/services/permissionRegistryService.ts`** método `checkPermissionsRefresh`.

**5. Nuevo `mobile/src/hooks/usePermissionsRefresh.ts`** copia con `useAuthStore` mobile. **Atención:** mobile en background, setInterval pausa. Para v3 aceptar (refresh al próximo foreground); post-v3 añadir `AppState.addEventListener('change', ...)` para check inmediato en `active`.

**6. Montar en `mobile/app/_layout.tsx`** o `<AuthProvider>` (Expo Router v6).

### Tests (manual QA)

Tests unitarios del hook son delicados (timers, fake intervals). Para v3.0.0:
- Login admin-portal como user X → otro admin cambia su rol → en <60s la UI refleja sin re-login. `localStorage.permissions_version` incrementó.
- Igual en mobile. AsyncStorage persiste.

Post-v3: `jest.useFakeTimers` + mock `apiClient`.

### Criterios de aceptación

- Hooks montados y polling cada 60s a `/auth/permissions-refresh?version=N`.
- Manual QA pasa en las 3 plataformas.

### Riesgos

- Mobile en background no polling. **Impacto:** BAJO (TTL backend protege). Documentar como known issue post-v3.
- `updateUser({...})` no propaga `permissions_version` al persisted store. **Mitigación:** verificar en Zustand DevTools.

---

## Fase 7 — Tests Phase 2B + Phase 3 integration (6h)

**Cierra:** validación de Fases 1-6. Bloquea deploy hasta verde.

### Suites a crear

- `backend/tests/api/test_permissions_refresh.py` (~6 tests Phase 2B)
- `backend/tests/api/test_audit_integration.py` (~10 tests Phase 3)
- `backend/tests/security/test_no_legacy_deps.py` (regression guard Phase 1C)
- `backend/tests/api/test_permission_registry_endpoint.py` (~2 tests Phase 0A)

Tests específicos en Apéndice A.

### Criterios de aceptación

Total post-fase: 139 baseline + ~24 nuevos = ~163 tests verdes.

### Riesgos

- Fixtures complejos no existen. **Mitigación:** reusar `tests/conftest.py`, crear factories nuevas si faltan.
- Tests flaky por timing (TTL 60s). **Mitigación:** `cache.invalidate()` directo en setup/teardown.

---

## Fase 8 — Audit `permission_overrides` diff + valida codes (2h)

**Cierra:** #6, #19, #18.

### Cambios

**1. `school_users.py:491-510`** — capturar `old_overrides` antes de mutación, calcular diff, incluir en `data_after.overrides_diff`:
```python
overrides_diff = {
    "added_grants": list(set(new.get("grant", [])) - set(old.get("grant", []))),
    "removed_grants": list(set(old.get("grant", [])) - set(new.get("grant", []))),
    "added_revokes": list(set(new.get("revoke", [])) - set(old.get("revoke", []))),
    "removed_revokes": list(set(old.get("revoke", [])) - set(new.get("revoke", []))),
}
```

**2. Helper en `backend/app/services/permission.py`:**
```python
async def validate_permission_codes_exist(self, codes: list[str]) -> list[str]:
    if not codes:
        return []
    result = await self.db.execute(
        select(Permission.code).where(Permission.code.in_(codes))
    )
    valid = {r[0] for r in result.fetchall()}
    return [c for c in codes if c not in valid]
```

**3. En `school_users.py` antes de aplicar overrides:** validar codes, retornar 400 si hay unknowns.

**4. En `custom_roles.py:599-612` `_update_role_permissions`:** reemplazar `if perm.code not in perm_map: continue` por raise 400 con lista. **BREAKING:** rollout con feature flag `STRICT_PERMISSION_CODE_VALIDATION=false` por defecto, activar 1 semana después.

### Tests

- `test_update_user_role_logs_overrides_diff`
- `test_update_user_role_rejects_unknown_permission_codes`
- `test_create_custom_role_rejects_unknown_codes`

---

## Fase 9 — Startup validator: codes huérfanos + typos (2h)

**Cierra:** #11, #12.

### Diseño

Walker de `app.routes` en startup. Para cada `Route` extrae codes de `require_permission(...)`. Valida contra DB `permissions` table y `SYSTEM_ROLE_PERMISSIONS`. En prod (`ENV=production`) abort si hay errores; en dev solo warning.

### Cambios

**1. Modificar `dependencies.py` `require_permission` factory** — anexar `__permission_code__` al closure para introspection:
```python
def require_permission(code: str):
    async def _check(...): ...
    _check.__permission_code__ = code
    return _check
```

**2. Nuevo `backend/app/utils/permission_validator.py`** — walker + validación contra DB.

**3. Hook en `backend/app/main.py:91-125` startup event.**

**4. Acción derivada — fix codes huérfanos (#11):** añadir a `SYSTEM_ROLE_PERMISSIONS[UserRole.ADMIN]` los 4 codes:
- `accounting.adjust_expense`
- `employees.manage`
- `payroll.manage`
- `settings.manage_garment_types`

Invalidar cache de registry endpoint (`_cached_response = None, _cached_version = None`).

### Tests

- `test_validate_permissions_passes_for_known_codes`
- `test_validate_permissions_fails_for_typo_in_route`

### Criterios de aceptación

- Startup dev: 0 warnings.
- Typo `require_permission("foo.bar")` → prod RuntimeError claro.
- 4 codes huérfanos resuelven para ADMIN.

### Riesgos

- Walker no captura todos los `require_permission` (e.g. `dependencies=[Depends(...)]` vs signature `Depends()`). **Mitigación:** cubrir ambos patrones en `route.dependant.dependencies` y `route.dependencies`.
- Validator aborta prod por bug propio. **Mitigación:** wrappear en try/except global; solo abortar por errors retornados explícitamente.

---

## Fase 10 — Deploy a producción (2h activos + 24h monitoreo)

### Orden

```
[T-30 min] Backup DB:
           pg_dump uniformes > /backups/pre-permissions-hardening-$(date +%Y%m%d_%H%M%S).sql

[T-15 min] CI verde en feature/permissions-hardening-v3.

[T-0]      Merge feature → develop → main.

[T+5 min]  ssh root@104.156.247.226
           cd /opt/uniformes-system-v2
           git fetch && git checkout main && git pull
           (no migrations en este plan)

[T+10 min] docker compose build backend
           docker compose up -d --force-recreate backend

[T+12 min] docker compose logs --tail=200 backend | grep -i "permission"
           Esperar "Permission validation passed" (Fase 9). Si error, revertir.

[T+15 min] curl -I https://yourdomain.com/api/v1/permissions/registry
           (200 OK + ETag header).

[T+20 min] Deploy frontends:
           - Tauri: build release. Auto-updater.
           - admin-portal: vercel deploy o build + push.
           - mobile: EAS update (Expo OTA).

[T+30 min] Smoke tests manuales (checklist abajo).

[T+1h, +6h, +24h] SELECT action, COUNT(*) FROM audit_logs WHERE created_at > NOW() - INTERVAL '1 hour' GROUP BY action;
```

### Smoke tests T+30 min

- Login desktop superuser → cambiar rol de user test → SQL confirma `permissions_version + 1`.
- Login mobile como ese user → <60s UI refleja sin re-login.
- Login admin-portal idem.
- Custom role en school A → editar permisos → cache de school B intacto.
- Crear gasto/factura → flujos no-permisos sin regresión.
- `curl /permissions/registry` → 4 codes huérfanos aparecen bajo `system_roles.admin`.
- Snippet 2.1 audit (conteo por action_type) → tráfico audit_logs activo.

### Feature flag

`STRICT_PERMISSION_CODE_VALIDATION=false` por defecto. Activar 1 semana después tras revisar logs (Fase 8).

### Rollback

```bash
ssh root@104.156.247.226
cd /opt/uniformes-system-v2
git log --oneline -5
git checkout <previous-main-sha>
docker compose build backend
docker compose up -d --force-recreate backend
```

`permissions_version` column queda (no hay drop migrations). `audit_logs` intacta.

### Criterios de aceptación

- Smoke 7/7 verde.
- 24h sin spike 5xx ni 403 inusuales.
- Snippet 2.5 audit confirma `permissions_version` distribuido (no todos en 0).

---

## Fase 11 — Backlog post-v3.0.0

| Finding | Acción | Esfuerzo | Cuándo |
|---------|--------|----------|--------|
| #9 multi-worker cache coherency | Migrar `permission_cache.py` a Redis (puerto 6379 ya existente). Pub/sub cross-worker. | 8h | Sprint+1 |
| #10 ETag round-trip | Backend lee `If-None-Match` → 304. Frontends envían header. | 4h | Sprint+1 |
| #15 RequirePermission mobile | Componente equivalente a desktop/admin. Wrapper `Stack.Screen`. | 4h | Sprint+2 |
| #16 check-constraint vs SET NULL | Reemplazar SET NULL con NOT NULL o cambiar a CASCADE delete. | 2h + migración | Cuando haya ventana DB |
| #17 no backoff hook | Exponential backoff en errores. | 1h | Trivial |
| #20 orphan custom_role | `logger.warning` en `get_user_permissions`. | 0.5h | Trivial |
| #22 AuditLog model fields | Añadir `request_id`, `target_user_id`, FK `school_id`. | 3h + migración | Sprint+2 |

**Total backlog:** ~20-25h, distribuibles en 2 sprints.

---

## Distribución sugerida

### 1 dev senior, full-time

| Día | Mañana | Tarde |
|-----|--------|-------|
| **D1** | Fase 0 + Fase 1 (invalidator + service) | Fase 1 (routes) + Fase 4 |
| **D2** | Fase 2 (audit) | Fase 3 (cache) + Fase 8 |
| **D3** | Fase 5 + Fase 9 | Fase 6 (admin-portal) |
| **D4** | Fase 6 (mobile) | Fase 7 (tests integración) |
| **D5** | Fase 7 (terminar) | Fase 10 (deploy) + monitor |

### 2 devs

| Día | Dev A (backend) | Dev B (frontend + tests) |
|-----|-----------------|--------------------------|
| **D1** | Fase 0, 1, 4 | Fase 6 (admin-portal) |
| **D2** | Fase 2, 3, 8 | Fase 6 (mobile) + tests Phase 2B |
| **D3** | Fase 5, 9 | Fase 7 audit integration |
| **D4** | Code review + fixes | Fase 7 + manual QA |
| **D5** | Fase 10 deploy | Monitor + smoke |

**v3.0.0 ready desde permisos:** D5 EOD ideal. Realista con buffer: **D7-D8**.

---

## Verification

### Cómo validar end-to-end

1. **Tests automatizados:**
```bash
cd backend
pytest tests/security tests/unit/test_permission_*.py tests/unit/test_audit_service.py tests/api/test_permissions_refresh.py tests/api/test_audit_integration.py tests/api/test_users_admin_routes.py tests/api/test_custom_roles_routes.py tests/api/test_business_settings_routes.py tests/api/test_sales_routes.py tests/api/test_orders_routes.py -v
```
Esperado: ~163 tests verdes.

2. **Manual QA pre-deploy (staging):**
- Cambiar rol vía superuser → DB confirma `permissions_version + 1`.
- Edit custom role → todos los assigned users incrementan version.
- 3 frontends refrescan en <60s sin re-login.
- Cache de school A intacto cuando se edita custom role en school B.
- Audit log captura `admin_set_superuser`, `permission_overrides_diff`, `global_role_*`.
- Endpoint cross-school `/sales` filtra por `sales.view`.
- User con custom_role + `settings.edit_business_info` puede `PUT /business-info`.

3. **Post-deploy SQL verifications** (snippets 2.1-2.5 del audit + Apéndice B):
```sql
-- bumping ratio
SELECT permissions_version, COUNT(*) FROM users GROUP BY permissions_version;
-- audit traffic
SELECT action, COUNT(*) FROM audit_logs WHERE created_at > NOW() - INTERVAL '1 hour' GROUP BY action;
-- orphan codes en overrides (post-Fase 8 esperar 0)
SELECT jsonb_array_elements_text(usr.permission_overrides->'grant') AS code
FROM user_school_roles usr
WHERE jsonb_array_length(usr.permission_overrides->'grant') > 0
  AND code NOT IN (SELECT code FROM permissions);
```

---

## Apéndice A — Templates de tests críticos

### A.1 `backend/tests/unit/test_permission_invalidation.py`

```python
@pytest.mark.asyncio
async def test_bump_user_increments_version_in_db(db_session, user_factory):
    user = await user_factory()
    invalidator = PermissionInvalidator(db_session)
    await invalidator.bump_user(user.id)
    await db_session.commit()
    refreshed = await db_session.get(User, user.id)
    assert refreshed.permissions_version == user.permissions_version + 1


@pytest.mark.asyncio
async def test_bump_users_by_custom_role_affects_only_assignees(db_session, school, user_factory, custom_role_factory):
    role = await custom_role_factory(school=school)
    u1 = await user_factory(school=school, custom_role=role)
    u2 = await user_factory(school=school, custom_role=role)
    u3 = await user_factory(school=school, role="seller")
    initial = {u.id: u.permissions_version for u in [u1, u2, u3]}

    invalidator = PermissionInvalidator(db_session)
    affected = await invalidator.bump_users_by_custom_role(role.id)
    await db_session.commit()

    assert affected == 2
    for uid in [u1.id, u2.id]:
        u = await db_session.get(User, uid)
        assert u.permissions_version == initial[uid] + 1
    u3_refreshed = await db_session.get(User, u3.id)
    assert u3_refreshed.permissions_version == initial[u3.id]
```

### A.2 `backend/tests/security/test_no_legacy_deps.py`

```python
import re
from pathlib import Path

LEGACY_PATTERNS = [
    r'\brequire_school_access\s*\(',
    r'\brequire_any_school_admin\s*\(',
    r'\bcan_manage_users\s*\(',
    r'\bcan_access_accounting\s*\(',
    r'\bcan_modify_inventory\s*\(',
    r'\bcan_create_sales\s*\(',
    r'\bcan_delete_records\s*\(',
]

def test_no_legacy_dependencies_in_routes():
    backend_root = Path(__file__).resolve().parents[2]
    routes_dir = backend_root / "app" / "api" / "routes"
    violations = []
    for py_file in routes_dir.rglob("*.py"):
        content = py_file.read_text()
        for pattern in LEGACY_PATTERNS:
            for m in re.finditer(pattern, content):
                line_no = content[:m.start()].count("\n") + 1
                violations.append(f"{py_file.name}:{line_no} matches {pattern}")
    assert not violations, f"Legacy deps found:\n" + "\n".join(violations)
```

### A.3 `backend/tests/api/test_audit_integration.py` (skeleton)

```python
@pytest.mark.asyncio
async def test_admin_set_superuser_writes_audit_log(client, superuser_headers, target_user, db_session):
    response = await client.put(
        f"/api/v1/users/{target_user.id}/superuser",
        headers=superuser_headers,
        json={"is_superuser": True},
    )
    assert response.status_code == 200
    logs = (await db_session.execute(
        select(AuditLog).where(AuditLog.resource_id == str(target_user.id))
        .order_by(AuditLog.created_at.desc())
    )).scalars().all()
    assert len(logs) >= 1
    assert logs[0].data_before["is_superuser"] is False
    assert logs[0].data_after["is_superuser"] is True


@pytest.mark.asyncio
async def test_admin_reset_password_does_not_log_password(client, superuser_headers, target_user, db_session):
    new_password = "NewSecret_xyz_123!"
    await client.post(
        f"/api/v1/users/{target_user.id}/reset-password",
        headers=superuser_headers,
        json={"new_password": new_password},
    )
    logs = (await db_session.execute(
        select(AuditLog).where(AuditLog.resource_id == str(target_user.id))
    )).scalars().all()
    for log in logs:
        for blob in [log.data_before, log.data_after, log.description]:
            assert blob is None or new_password not in str(blob)
            assert blob is None or "$2b$" not in str(blob)
```

---

## Critical files reference

**Backend (modificar):**
- `backend/app/services/user.py` (kwarg invalidator)
- `backend/app/services/permission_cache.py` (fix invalidate by school)
- `backend/app/services/permission.py` (validate_permission_codes_exist + 4 codes a ADMIN)
- `backend/app/api/dependencies.py` (require_permission tag, get_user_school_ids_with_permission)
- `backend/app/api/routes/users.py` (admin endpoints: bump + audit)
- `backend/app/api/routes/custom_roles.py` (bump + audit)
- `backend/app/api/routes/global_roles.py` (bump + audit + cache)
- `backend/app/api/routes/school_users.py` (PermissionInvalidator + overrides_diff)
- `backend/app/api/routes/business_settings.py` (require_global_permission)
- `backend/app/api/routes/sales.py` (cross-school guards)
- `backend/app/api/routes/orders.py` (cross-school guards)
- `backend/app/main.py` (startup validator)
- `backend/app/models/audit_log.py` (enum nuevos action types si necesario)

**Backend (nuevos):**
- `backend/app/services/permission_invalidation.py`
- `backend/app/utils/permission_validator.py`
- `backend/tests/unit/test_permission_invalidation.py`
- `backend/tests/api/test_users_admin_routes.py` (verificar si existe)
- `backend/tests/api/test_custom_roles_routes.py`
- `backend/tests/api/test_audit_integration.py`
- `backend/tests/api/test_permissions_refresh.py`
- `backend/tests/api/test_permission_registry_endpoint.py`
- `backend/tests/security/test_no_legacy_deps.py`

**Frontend admin-portal (modificar/nuevos):**
- `admin-portal/lib/services/permissionRegistryService.ts` (añadir checkPermissionsRefresh)
- `admin-portal/lib/hooks/usePermissionsRefresh.ts` (NUEVO)
- `admin-portal/app/layout.tsx` o equivalente (montar hook)

**Frontend mobile (modificar/nuevos):**
- `mobile/src/services/permissionRegistryService.ts` (añadir checkPermissionsRefresh)
- `mobile/src/hooks/usePermissionsRefresh.ts` (NUEVO)
- `mobile/app/_layout.tsx` (montar hook)

**Reusables existentes (no duplicar):**
- `frontend/src/hooks/usePermissionsRefresh.ts` (template para copy)
- `frontend/src/services/permissionRegistryService.ts:104-113` (`checkPermissionsRefresh` template)
- `backend/app/api/dependencies.py` `require_permission`/`require_global_permission` (ya existen, reusar)
- `backend/app/utils/audit_decorator.py` `@audit_action` (existe sin uso, alternativa post-v3)
- `backend/app/services/audit.py` `audit_service.log` (reusar)
