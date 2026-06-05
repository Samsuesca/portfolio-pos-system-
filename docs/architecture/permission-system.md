# Sistema de Permisos

Arquitectura del control de acceso granular de Uniformes System v2 — modelo, roles, permisos, constraints, cache, invalidacion y audit trail.

> **Estado**: Production-ready. Endurecido en el branch `feature/permissions-hardening-v3` (mayo 2026, commits `3e37b91` → `5f3b186`). Cubre 21 hallazgos de auditoria interna (#1, #2, #3, #5, #7, #13, #14, #21).

---

## TL;DR

- **Multi-tenant** (los permisos se evaluan por `school_id`).
- **Cuatro roles del sistema** jerarquicos: `OWNER` > `ADMIN` > `SELLER` > `VIEWER`.
- **Permisos granulares** estilo `categoria.accion` (e.g. `sales.cancel`, `inventory.view_cost`).
- **Roles personalizados por colegio** (`custom_roles`) que combinan permisos arbitrariamente.
- **Overrides por usuario** via JSONB `permission_overrides = {"grant": [...], "revoke": [...]}`.
- **Constraints parametrizados** sobre permisos sensibles (`max_amount`, `requires_approval`, `max_discount_percent`, `max_daily_count`).
- **Superuser bypass** (`is_superuser=True`) — ignora todo el sistema de permisos.
- **Cache TTL 60s** con invalidacion post-commit y bump de `permissions_version`.
- **Audit trail** en `audit_logs` para cambios de roles, permisos, balance, supusuario y otras acciones sensibles.
- **Permission Registry** (`GET /api/v1/permissions/registry`) — single source of truth para el frontend.

---

## Modelo Conceptual

### Capas de evaluacion (orden)

Cuando se pregunta "¿puede el usuario U realizar la accion P en el colegio S?", el sistema responde resolviendo en este orden:

```
1. ¿U.is_superuser? → SI: bypass total (true sin tocar nada).
2. Buscar UserSchoolRole(user=U, school=S).
   No existe → false.
3. Capa A — Origen del set base de permisos:
   3a. role (system role): SYSTEM_ROLE_PERMISSIONS[role]
       OWNER → todos los permisos.
   3b. custom_role_id: union de RolePermission asociadas.
4. Capa B — Aplicar overrides (JSONB):
   permissions_overrides.grant   → union
   permissions_overrides.revoke  → diferencia
5. ¿P en el set resultante? → resultado final.
```

**Invariantes**:

- `UserSchoolRole` exige `role IS NOT NULL OR custom_role_id IS NOT NULL` (constraint `ck_user_school_role_has_role`).
- Un usuario puede tener roles distintos en colegios distintos.
- Los overrides solo aplican al colegio especifico (no son globales).
- Los superusers no necesitan entry en `user_school_roles`; aparecen como `OWNER` en cualquier colegio.

### Diagrama de capas

```
┌─────────────────────────────────────────────────────────────┐
│ Pregunta: ¿user U puede ejecutar permission_code P en S?    │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
                  ┌────────────────┐
                  │ is_superuser?  │ ───► YES ► return True
                  └────────┬───────┘
                           │ NO
                           ▼
              ┌────────────────────────────┐
              │  UserSchoolRole(U, S)?      │
              └────────────┬───────────────┘
                           ▼
        ┌──────────────────┴──────────────────┐
        │  role enum                custom_role_id │
        │  ┌────────────┐         ┌──────────────┐ │
        │  │ SYSTEM_ROLE│         │ RolePermission│ │
        │  │_PERMISSIONS│         │  (M2M table) │ │
        │  └─────┬──────┘         └──────┬───────┘ │
        │        ▼                       ▼         │
        │   set base permisos      set base permisos│
        └──────────────────┬─────────────────────┘
                           ▼
                  ┌────────────────────┐
                  │ permission_overrides │  (JSONB)
                  │ + grant   union     │
                  │ - revoke  diff      │
                  └─────────┬──────────┘
                            ▼
                   ┌─────────────────┐
                   │  P en el set?   │  ─► True / False
                   └─────────────────┘
```

---

## Catalogo de Roles del Sistema

Definidos en `backend/app/models/user.py` (`UserRole` enum) y poblados en `backend/app/services/permission.py` (`SYSTEM_ROLE_PERMISSIONS`).

| Rol | Nivel | Para quien | Permisos clave |
|-----|-------|------------|----------------|
| **OWNER** | 4 | Dueña del negocio (Consuelo) | TODOS — sin restricciones, sin requires_approval |
| **ADMIN** | 3 | Administradores de tienda | Ventas/inventario/contabilidad/reportes/payroll completos. `max_discount=25%`. Liquidar Caja Menor hasta $5M. |
| **SELLER** | 2 | Vendedoras | Crear ventas/clientes/ordenes, abrir caja, ver caja menor. `max_discount=10%`. |
| **VIEWER** | 1 | Solo lectura (auditoria, contadora externa) | Ver ventas, productos, clientes, ordenes, inventario, dashboard. |

> **Detalle completo**: `SYSTEM_ROLE_PERMISSIONS` en [`backend/app/services/permission.py:23-90`](../../backend/app/services/permission.py).

### Jerarquia (`ROLE_HIERARCHY`)

```python
# backend/app/api/dependencies.py:31-36
{
    UserRole.VIEWER: 1,
    UserRole.SELLER: 2,
    UserRole.ADMIN: 3,
    UserRole.OWNER: 4,
}
```

La jerarquia se usa solo en endpoints legacy. **El sistema actual prefiere checks granulares de permisos**, no comparaciones por nivel.

### Roles especiales

- **Superuser** (`User.is_superuser=True`): bypass total. Reservado para desarrollador (suescapsam@gmail.com). Se otorga via Tinker/SQL — NO via UI.
- **`OWNER` vs Superuser**: ambos tienen acceso total dentro de su scope. El superuser opera cross-tenant; el OWNER solo en sus schools.

---

## Convencion de Permission Codes

Patron: **`categoria.accion`** (snake_case).

```
sales.view              ← lectura
sales.create            ← crear
sales.cancel            ← cancelar (sensible)
sales.apply_discount    ← con constraint max_discount_percent
sales.view_cost         ← acceso a campos sensibles del schema
sales.view_all_sellers  ← agregaciones cross-seller
inventory.adjust        ← mutacion sensible
accounting.liquidate_caja_menor   ← con constraint max_amount + approval
global_inventory.adjust ← scope global (no requiere school_id)
```

### Categorias actuales (mayo 2026)

`sales`, `products`, `clients`, `orders`, `inventory`, `changes`, `alterations`, `reports`, `accounting`, `cash_drawer`, `users`, `catalog`, `costs`, `workforce`, `employees`, `payroll`, `settings`, `global_inventory`.

### Permission catalog

La tabla `permissions` contiene el universo de codes validos. La poblacion inicial vive en migraciones Alembic. Para agregar un permiso nuevo: ver "Como agregar un permiso" mas abajo.

---

## Constraints Parametrizados

Algunos permisos llevan **parametros** asociados al rol. Definidos en `SYSTEM_ROLE_CONSTRAINTS` ([`permission.py:103-130`](../../backend/app/services/permission.py)) para roles del sistema y en columnas de `role_permissions` para custom roles.

| Constraint | Tipo | Donde aplica | Ejemplo |
|---|---|---|---|
| `max_discount_percent` | int (0-100) | `sales.apply_discount` | SELLER tope 10%, ADMIN 25%, OWNER 100% |
| `max_amount` | Decimal | `accounting.*` | ADMIN puede liquidar Caja Menor hasta $5M |
| `requires_approval` | bool | varios | ADMIN puede ajustar balance pero `requires_approval=true` |
| `max_daily_count` | int | `cash_drawer.open` | ADMIN max 20 aperturas/dia |

### `check_amount_constraint`

Para flujos transaccionales con monto (gastos, transferencias, liquidacion), usar:

```python
allowed, needs_approval, reason = await permission_service.check_amount_constraint(
    user.id, school_id, "accounting.liquidate_caja_menor", Decimal("3000000")
)
# allowed=True, needs_approval=False → procede
# allowed=True, needs_approval=True  → solicitar codigo de aprobacion
# allowed=False                      → 403 con `reason`
```

> Implementacion en [`permission.py:335-377`](../../backend/app/services/permission.py).

---

## API de Dependencias FastAPI

Todas viven en `backend/app/api/dependencies.py`. Cada factory **etiqueta** la closure resultante con `__permission_code__` (o `__permission_codes__`) para el startup validator.

### Por scope

#### School-scoped — `require_permission(code)`

El endpoint **debe** declarar `school_id: UUID` (path o query). Caso comun en rutas operacionales.

```python
@router.post("/schools/{school_id}/sales/{sale_id}/cancel")
async def cancel_sale(
    school_id: UUID,
    sale_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser,
    _: None = Depends(require_permission("sales.cancel")),
):
    ...
```

#### Global — `require_global_permission(code)`

Usado cuando NO existe `school_id` en el endpoint. El usuario pasa si tiene el permiso en **al menos un colegio** (sistema, custom o override).

```python
@router.post("/global/products/{product_id}/inventory/adjust")
async def adjust_global_inventory(
    product_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser,
    _: None = Depends(require_global_permission("global_inventory.adjust")),
):
    ...
```

#### Cualquiera de N — `require_any_permission(*codes)`

Endpoints que sirven a varios permisos (e.g. dashboards).

```python
@router.get("/schools/{school_id}/reports")
async def get_reports(
    school_id: UUID,
    _: None = Depends(require_any_permission("reports.sales", "reports.inventory")),
):
    ...
```

### Con constraints

`require_permission_with_constraints(code)` y `require_global_permission_with_constraints(code)`. Ademas de validar el permiso, **retornan un dict** con los limites del usuario:

```python
@router.post("/schools/{school_id}/caja-menor/liquidate")
async def liquidate(
    school_id: UUID,
    data: LiquidateRequest,
    constraints: dict = Depends(
        require_permission_with_constraints("accounting.liquidate_caja_menor")
    ),
):
    if constraints["max_amount"] and data.amount > constraints["max_amount"]:
        raise HTTPException(403, "Monto excede limite")
    if constraints["requires_approval"] and not data.approval_code:
        raise HTTPException(403, "Requiere codigo de aprobacion")
```

### Por rol

`require_owner_or_superuser()` — sigue existiendo para gestion de usuarios a nivel school (un OWNER administra usuarios de su tienda sin necesitar ser superuser). Usar **solo** cuando el permiso granular no aplica.

`require_superuser()` — para cosas verdaderamente cross-tenant del sistema (e.g. crear schools, gestionar global_roles).

### Filtros de scope

`get_user_school_ids_with_permission(code)` — dependency factory que retorna **la lista de school IDs donde el usuario tiene el permiso**. Util para endpoints cross-school que devuelven datos agregados:

```python
@router.get("/global/sales/summary")
async def cross_school_summary(
    school_ids: list[UUID] = Depends(
        get_user_school_ids_with_permission("sales.view_all_sellers")
    ),
):
    if not school_ids:
        return {"data": []}
    ...
```

---

## Permission Registry — Single Source of Truth para el Frontend

Endpoint: `GET /api/v1/permissions/registry`. Auth requerida. Cacheable (`Cache-Control: public, max-age=3600`, `ETag`).

### Payload

```jsonc
{
  "version": "a1b2c3d4e5f6...",   // sha256 hash de los datos
  "permissions": [
    { "code": "sales.cancel", "category": "sales", "name": "Sales Cancel", "is_sensitive": false, "description": null }
  ],
  "system_roles": {
    "owner":  null,                // null = todos los permisos
    "admin":  ["sales.view", "sales.cancel", ...],
    "seller": [...],
    "viewer": [...]
  },
  "role_constraints": {
    "sales.apply_discount": {
      "admin":  { "max_discount_percent": 25 },
      "seller": { "max_discount_percent": 10 }
    },
    "accounting.liquidate_caja_menor": {
      "admin": { "max_amount": 5000000.0, "requires_approval": false }
    }
  },
  "role_max_discount": { "owner": 100, "admin": 25, "seller": 10, "viewer": 0 }
}
```

### Por que existe

Antes el frontend mantenia copias hardcoded de `SYSTEM_ROLE_PERMISSIONS`. Cualquier permiso nuevo requeria actualizar 3 sitios (backend, desktop, web). El registry colapsa todo a una sola fuente.

### Como lo consume el frontend

- Fetch al iniciar sesion + cache local indexado por `version`.
- Si la respuesta del registry trae `version` distinto al que tiene en cache → refetch.
- Endpoints como `GET /users/me/permissions/version` permiten al frontend detectar invalidaciones (cambio de rol, asignacion de custom role, etc.) y refetch sin esperar al TTL del cache.

> Implementacion en [`backend/app/api/routes/permission_registry.py`](../../backend/app/api/routes/permission_registry.py).

---

## Cache de Permisos

### Estrategia

In-memory con TTL de 60 segundos por entry. Implementado en [`backend/app/services/permission_cache.py`](../../backend/app/services/permission_cache.py).

```
Key 1 (permisos efectivos):  user_id:school_id            → set[str]
Key 2 (constraints):          user_id:school_id:perm_code  → dict
```

Limite duro de 1000 entries por cache. Eviction lazy de expirados al insertar cuando se llena.

### Invalidation rules

| Llamada | Efecto |
|---|---|
| `invalidate(user_id, school_id)` | Drop entry exacta + todos los constraints de ese par. |
| `invalidate(user_id=...)` | Drop todas las entries del usuario en cualquier school. |
| `invalidate(school_id=...)` | Drop entries de ese school para cualquier usuario. |
| `invalidate()` | Flush total (uso administrativo). |

> **Bug fix mayo 2026**: Antes `invalidate(school_id=...)` borraba el cache completo por un suffix-match defectuoso. Corregido en commit `3e37b91`. Ver tests en `tests/unit/test_permission_cache.py`.

### Multi-worker

El cache es **por proceso**. En produccion (single uvicorn worker) esto es suficiente. Si se escala a multi-worker el cache debe migrar a Redis pub/sub — `PermissionInvalidator` esta diseñado para ese cambio sin tocar las rutas (ver siguiente seccion).

---

## PermissionInvalidator — Coordinacion Post-Commit

Toda mutacion que afecta los permisos efectivos de un usuario **debe pasar por** [`PermissionInvalidator`](../../backend/app/services/permission_invalidation.py). Garantiza tres invariantes criticas:

1. **`User.permissions_version` bumpea dentro de la transaccion** (junto al cambio de rol/permission/override).
2. **Cache invalida DESPUES del `db.commit()`**, nunca antes.
3. **Punto unico de extension** para Redis pub/sub multi-worker.

### Por que importa el orden

Si invalidas el cache **antes** del commit y otro worker pregunta por los permisos del usuario en ese microsegundo, **repuebla el cache con los permisos viejos** (porque la transaccion aun no commiteo). Cuando finalmente commitea, el cache queda en estado inconsistente y solo se cura cuando expira (60s mas tarde).

Este bug (finding #21 de la auditoria) se cerro en `3e37b91` moviendo `flush_cache_after_commit()` a despues del commit.

### Patron de uso

```python
from app.services.permission_invalidation import PermissionInvalidator

@router.put("/users/{user_id}/role")
async def update_role(
    user_id: UUID,
    school_id: UUID,
    data: RoleUpdate,
    db: DatabaseSession,
    request: Request,
    current_user: CurrentUser,
    _: None = Depends(require_owner_or_superuser()),
):
    invalidator = PermissionInvalidator(db)

    # 1. Mutar el rol
    await user_service.update_school_role(user_id, school_id, data.role)

    # 2. Bump version (dentro de la txn)
    await invalidator.bump_user(user_id, school_id)

    # 3. Audit log (dentro de la txn)
    await audit_service.log(
        actor_id=current_user.id,
        action=AuditAction.ROLE_CHANGE,
        resource_type="user",
        resource_id=str(user_id),
        data_before={"role": old_role.value},
        data_after={"role": data.role.value},
        request=request,
    )

    # 4. Commit
    await db.commit()

    # 5. Flush cache (POST-commit)
    invalidator.flush_cache_after_commit()
```

### `bump_users_by_custom_role(custom_role_id)`

Cuando se modifica un `custom_role`, **todos los usuarios asignados a ese rol** ven su set de permisos cambiar. El invalidator hace bulk-update de `permissions_version` y registra los pares `(user_id, school_id)` para flush post-commit.

```python
await invalidator.bump_users_by_custom_role(custom_role_id)
# ...db.commit()
invalidator.flush_cache_after_commit()
```

---

## Audit Trail

Tabla `audit_logs` (global, no por colegio). Modelo en [`backend/app/models/audit_log.py`](../../backend/app/models/audit_log.py).

### Acciones registradas (`AuditAction` enum)

**User & Role**: `ROLE_CHANGE`, `USER_DEACTIVATE`, `USER_ACTIVATE`, `PERMISSION_CHANGE`, `SUPERUSER_CHANGE`, `PASSWORD_RESET`, `EMAIL_CHANGE`.

**Financiero**: `BALANCE_ADJUSTMENT`, `EXPENSE_DELETE`, `EXPENSE_MODIFY`, `TRANSFER_CREATE`.

**Ventas**: `SALE_CANCEL`, `SALE_MODIFY`, `SALE_REFUND`.

**Otros**: `ORDER_CANCEL`, `ORDER_STATUS_CHANGE`, `RECORD_DELETE`, `CLIENT_DELETE`, `PRODUCT_DELETE`, `CONFIG_CHANGE`, `SCHOOL_MODIFY`, `PAYROLL_APPROVE`, `PAYROLL_MODIFY`.

### Campos clave

| Campo | Uso |
|---|---|
| `actor_id` | Usuario que ejecuto la accion (NULL si fue del sistema) |
| `action` | `AuditAction` enum |
| `resource_type` / `resource_id` | Recurso afectado (e.g. `user` / `<uuid>`) |
| `data_before` / `data_after` | Snapshots JSONB para diff. **Nunca** incluir password hashes ni secrets. |
| `ip_address` / `user_agent` | Contexto de la request |
| `school_id` | Si aplica, para filtros |
| `created_at` | Timezone Colombia (UTC-5) |

### Que SI auditar

- Cambios de rol, asignacion a custom_role, modificacion de overrides.
- Otorgar/revocar superuser.
- Reset de password, cambio de email.
- Eliminacion de records criticos (clients, products).
- Ajustes manuales de balance, eliminacion/modificacion de gastos, transferencias entre cuentas.
- Cancelacion de ventas/ordenes.
- Aprobacion de payroll.

### Que NO incluir en `data_before` / `data_after`

- Password hashes.
- Tokens JWT.
- Datos personales sensibles (cedula, direccion completa) — usar `resource_id`.
- Secrets de integracion (Wompi keys, Telegram bot token).

---

## Frontend: Refresh Hooks

El desktop y el web-portal mantienen un cache local del set de permisos del usuario actual (poblado desde `/users/me/permissions` y `/permissions/registry`).

### Mecanismo de invalidacion

1. **`User.permissions_version`** se bumpea cada vez que cambian los permisos del usuario.
2. El frontend hace polling ligero a `/users/me/permissions/version` (o lo recibe en cada response via header `X-Permissions-Version`).
3. Si la version local difiere de la servidor → refetch del set completo.

### Quien dispara el bump

Toda mutacion via `PermissionInvalidator`:

- Endpoints de `users.py` (admin add/update/remove school role, set superuser, reset password).
- `custom_roles.py` (create/update/delete — bumpea TODOS los usuarios asignados al rol).
- `global_roles.py` (mismo patron).
- `school_users.py` (refactorizado en `3e37b91` para usar el invalidator).

---

## Startup Validator

Al arrancar la app, [`validate_permission_registry`](../../backend/app/utils/permission_validator.py) recorre todas las rutas registradas en FastAPI, extrae los codes referenciados por las factories `require_*` (via `__permission_code__` tag), y valida que **cada code exista en la tabla `permissions`** de la DB.

Si encuentra typos o codes huerfanos:

- **Desarrollo**: log de warning, app inicia.
- **Produccion**: `RuntimeError` que aborta el arranque.

Esto previene el bug donde un endpoint con `require_permission("acouting.view")` (typo) silenciosamente devuelve 403 a todos los no-superusers en produccion.

---

## Anti-Patrones (NO HACER)

### Mezclar codes en frontend

```typescript
// MAL — duplica la fuente de verdad
const ADMIN_PERMISSIONS = ["sales.view", "sales.create", ...];
if (ADMIN_PERMISSIONS.includes(perm)) { ... }
```

```typescript
// BIEN — desde el registry
const { permissions } = useAuth();
if (permissions.has("sales.create")) { ... }
```

### Bypass por jerarquia

```python
# MAL — viola el principio de granularidad
if user_role.role in (UserRole.ADMIN, UserRole.OWNER):
    allow()
```

```python
# BIEN
_: None = Depends(require_permission("sales.cancel"))
```

### Invalidar cache antes del commit

```python
# MAL — race window con otros workers
permission_cache.invalidate(user_id=u, school_id=s)
await db.commit()
```

```python
# BIEN — usar PermissionInvalidator
invalidator = PermissionInvalidator(db)
await invalidator.bump_user(u, s)
await db.commit()
invalidator.flush_cache_after_commit()
```

### Hardcodear permisos legacy en endpoints

```python
# MAL — ignora custom roles y overrides
if not (user.is_superuser or user_role.role == UserRole.OWNER):
    raise HTTPException(403)
```

```python
# BIEN
_: None = Depends(require_global_permission("settings.edit_business_info"))
```

(Esto era exactamente el bug en `business_settings.py` corregido en `3e37b91` Fase 4.)

---

## Como Agregar un Permiso Nuevo

1. **Definir el code**: `categoria.accion`, snake_case.
2. **Migracion Alembic** insertando el row en `permissions`:
   ```python
   op.execute("""
       INSERT INTO permissions (id, code, name, category, is_sensitive, created_at)
       VALUES (gen_random_uuid(), 'inventory.bulk_adjust', 'Inventory Bulk Adjust',
               'inventory', true, NOW())
   """)
   ```
3. **Asignarlo a roles del sistema** modificando `SYSTEM_ROLE_PERMISSIONS` en [`backend/app/services/permission.py`](../../backend/app/services/permission.py).
4. **Si lleva constraints**: agregar entry en `SYSTEM_ROLE_CONSTRAINTS`.
5. **Usar en la ruta**: `_: None = Depends(require_permission("inventory.bulk_adjust"))`.
6. **Actualizar tests** que validen el flujo end-to-end (rechazo VIEWER, aceptacion ADMIN, etc.).
7. **El frontend lo recoge automaticamente** via `/permissions/registry` — no requiere cambios manuales.

> **Importante**: el startup validator detectara el code en las rutas y exigira que exista en DB. Sin la migracion, la app no arranca en produccion.

---

## Como Crear un Custom Role

API: `POST /api/v1/schools/{school_id}/custom-roles` (requiere `OWNER` o superuser).

```json
{
  "code": "cashier",
  "name": "Cajera",
  "description": "Solo abre caja y registra ventas en efectivo",
  "color": "#10B981",
  "icon": "cash",
  "permissions": [
    { "code": "sales.view" },
    { "code": "sales.create" },
    { "code": "accounting.open_register" },
    { "code": "accounting.close_register" },
    { "code": "sales.apply_discount", "max_discount_percent": 5 }
  ]
}
```

El response devuelve el `custom_role_id` que luego se asigna a usuarios via `PUT /schools/{school_id}/users/{user_id}/role` con `{ "custom_role_id": "<uuid>" }`.

---

## Tablas Involucradas

| Tabla | Proposito | Scope |
|---|---|---|
| `users` | Usuarios + flag `is_superuser` + `permissions_version` | Global |
| `user_school_roles` | Rol del usuario en cada colegio (system o custom) + overrides JSONB | Por colegio |
| `permissions` | Catalogo de codes validos | Global |
| `custom_roles` | Roles personalizados (school_id NULL = system role) | Por colegio o global |
| `role_permissions` | M2M custom_roles ↔ permissions + constraints | - |
| `audit_logs` | Trazabilidad de acciones sensibles | Global |

---

## Roadmap

- **Multi-worker cache** via Redis pub/sub (cuando se escale el backend).
- **Permission groups** (templates) para crear custom roles mas rapido.
- **UI de management de overrides** por usuario (hoy se gestiona via API directa).
- **Audit log viewer** integrado en admin-portal con filtros por actor/recurso/fecha.

---

## Referencias

| Documento / Codigo | Descripcion |
|---|---|
| [`backend/app/api/dependencies.py`](../../backend/app/api/dependencies.py) | Factories `require_*` y type aliases |
| [`backend/app/services/permission.py`](../../backend/app/services/permission.py) | `PermissionService`, `SYSTEM_ROLE_PERMISSIONS`, constraints |
| [`backend/app/services/permission_cache.py`](../../backend/app/services/permission_cache.py) | Cache TTL + invalidation |
| [`backend/app/services/permission_invalidation.py`](../../backend/app/services/permission_invalidation.py) | `PermissionInvalidator` (post-commit flush) |
| [`backend/app/models/permission.py`](../../backend/app/models/permission.py) | `Permission`, `CustomRole`, `RolePermission` |
| [`backend/app/models/audit_log.py`](../../backend/app/models/audit_log.py) | `AuditLog`, `AuditAction` enum |
| [`backend/app/api/routes/permission_registry.py`](../../backend/app/api/routes/permission_registry.py) | Registry endpoint |
| [`backend/app/utils/permission_validator.py`](../../backend/app/utils/permission_validator.py) | Startup validator |
| [`docs/v3-branch-architecture/`](../v3-branch-architecture/) | Plan de evolucion v3 |

---

[← Volver al indice](./README.md)

---

*Ultima actualizacion: 2026-05-02 | Version: 1.0.0*
