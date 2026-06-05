# Diseño Multi-Tenant

Multi-tenancy de Uniformes System: un solo sistema sirve a varios colegios con aislamiento operacional pero contabilidad y configuracion compartidas.

---

## Concepto

Cada **colegio** es un tenant. El aislamiento es **operacional** (productos, ventas, clientes, inventario, ordenes son por colegio) pero **no financiero** (la dueña ve UN balance, UNA caja, UN banco para todo el negocio).

### Por que asi (no full multi-tenant ni full single-tenant)

- **Full single-tenant** dejaba duplicar productos/inventario entre colegios → confuso para la dueña.
- **Full multi-tenant con DBs separadas** complicaba la contabilidad consolidada.
- **El compromiso**: `school_id` en tablas operacionales, NULL/opcional en contabilidad.

---

## Modelo de Datos

### Tabla raiz: `schools`

```sql
CREATE TABLE schools (
    id          UUID PRIMARY KEY,
    name        VARCHAR NOT NULL,
    slug        VARCHAR UNIQUE NOT NULL,    -- usado en URL del web-portal
    address     VARCHAR,
    phone       VARCHAR,
    email       VARCHAR,
    is_active   BOOLEAN DEFAULT true,
    created_at  TIMESTAMP,
    updated_at  TIMESTAMP
);
```

### Tablas con `school_id` (operacional, aisladas por tenant)

| Tabla | Notas |
|---|---|
| `products` | Productos especificos del colegio |
| `garment_types` | Tipos de prenda (polo, falda, pantalon...) |
| `inventory` | Stock por talla |
| `clients` | Clientes registrados al hacer ventas/pedidos |
| `sales`, `sale_items` | Ventas presenciales |
| `sale_changes` | Cambios y devoluciones |
| `orders`, `order_items` | Pedidos personalizados |
| `web_orders` | Pedidos del portal de padres |
| `alterations` | Arreglos de prendas |

### Tablas globales (sin `school_id`, o NULL)

| Tabla | Razon |
|---|---|
| `users` | Mismo usuario opera en multiples colegios |
| `user_school_roles` | M2M: rol del usuario en cada colegio |
| `permissions`, `custom_roles`, `role_permissions` | Sistema de permisos |
| `audit_logs` | Auditoria global |
| `balance_accounts`, `balance_entries` | Caja/Banco son del negocio |
| `expenses`, `accounts_payable`, `accounts_receivable` | `school_id` opcional para filtros/reportes |
| `transactions` | `school_id` opcional para origen del ingreso |
| `daily_cash_registers` | Una caja diaria para todo el negocio |
| `global_products` | Catalogo cross-school (zapatos, medias, jeans, blusas) |
| `global_inventory` | Stock de los globales |
| `payment_transactions` | Wompi — el dinero entra a la cuenta unica del negocio |
| `telegram_alert_subscriptions` | Suscripciones por usuario |

> **Detalle contable**: [accounting-architecture.md](./accounting-architecture.md).

---

## Productos Globales

Algunos articulos se venden en todos los colegios y comparten stock:

- **Zapatos** (escolares estandar)
- **Medias** (blancas)
- **Jeans**
- **Blusas/camisas blancas basicas**

Estos viven en `global_products` + `global_inventory`. Las ventas y pedidos detectan el tipo de producto y usan la tabla correcta:

```python
if item.product_id is not None:
    # Producto del colegio (school-scoped)
    product = await get_product(item.product_id)
    inventory = await get_inventory(product_id=product.id, size=item.size)
else:
    # Producto global
    product = await get_global_product(item.global_product_id)
    inventory = await get_global_inventory(global_product_id=product.id, size=item.size)
```

> Migracion del web-portal a global products: ver memoria del proyecto, "Global Products Web Portal Fix".

---

## Patron de Endpoints

### School-scoped

```
GET    /api/v1/schools/{school_id}/products
POST   /api/v1/schools/{school_id}/sales
GET    /api/v1/schools/{school_id}/clients
POST   /api/v1/schools/{school_id}/orders
GET    /api/v1/schools/{school_id}/inventory
```

### Globales (configuracion + contabilidad)

```
GET    /api/v1/users
GET    /api/v1/global/products
POST   /api/v1/global/products/{product_id}/inventory/adjust
GET    /api/v1/global/accounting/cash-balances
GET    /api/v1/global/accounting/expenses
GET    /api/v1/permissions/registry
```

### Cross-school (datos agregados filtrados por permiso)

```python
@router.get("/global/sales/summary")
async def cross_school_summary(
    school_ids: list[UUID] = Depends(
        get_user_school_ids_with_permission("sales.view_all_sellers")
    ),
):
    if not school_ids:
        return {"data": []}
    # consulta filtrada por los school_ids autorizados
    ...
```

`get_user_school_ids_with_permission` retorna solo los colegios donde el usuario tiene el permiso especifico — evita filtraciones cross-tenant.

---

## Selector de Colegio (Frontend)

En desktop y mobile, el usuario que tiene rol en multiples colegios elige uno como contexto activo:

```typescript
// schoolStore.ts (Zustand)
{
  currentSchool: School | null
  availableSchools: School[]
  setCurrentSchool(school): void
}
```

### Donde aplica el selector

- **Operacional** (productos, ventas, inventario, clientes, pedidos): el `currentSchool.id` se inyecta como path param o header en cada llamada.
- **NO aplica a contabilidad**: la vista de Caja/Banco/Gastos es siempre global, ignora el selector.
- **NO aplica a configuracion del usuario**: cambiar tu propia password, gestionar suscripciones Telegram, etc.

> **Anti-patron historico**: hubo una epoca donde la contabilidad filtraba por `currentSchool.id` y mostraba "Caja de Caracas" / "Caja de Pinal" — esto era falso (la caja es UNA) y confundia a la dueña. Eliminado.

---

## Control de Acceso por Colegio

### Modelo

```sql
CREATE TABLE user_school_roles (
    id              UUID PRIMARY KEY,
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    school_id       UUID REFERENCES schools(id) ON DELETE CASCADE,

    -- O un rol del sistema:
    role            user_role_enum,                    -- owner | admin | seller | viewer

    -- O un custom role:
    custom_role_id  UUID REFERENCES custom_roles(id),

    -- Overrides individuales:
    permission_overrides JSONB,    -- {"grant": [...], "revoke": [...]}

    is_primary      BOOLEAN DEFAULT false,
    created_at      TIMESTAMP,

    CONSTRAINT ck_user_school_role_has_role
        CHECK (role IS NOT NULL OR custom_role_id IS NOT NULL)
);
```

Un usuario puede tener:
- **Rol distinto en cada colegio**: ADMIN en Caracas, SELLER en Pinal.
- **System role en uno y custom role en otro**.
- **Overrides puntuales** que agregan o quitan permisos especificos.

### Roles del sistema (jerarquia)

| Nivel | Rol | Para quien |
|---|---|---|
| 4 | **OWNER** | Dueña del negocio (Consuelo) |
| 3 | **ADMIN** | Administradores de tienda (full operacional + accounting) |
| 2 | **SELLER** | Vendedoras (ventas, clientes, ordenes; descuentos hasta 10%) |
| 1 | **VIEWER** | Auditoria/contadora externa, solo lectura |

### Custom Roles

Creados por OWNER/superuser **por colegio**: combinan permisos arbitrarios + constraints (`max_amount`, `requires_approval`, `max_discount_percent`, `max_daily_count`).

Ejemplo: rol "Cajera" que puede abrir caja, registrar ventas en efectivo, pero no editar productos ni ver reportes financieros.

```json
POST /api/v1/schools/{school_id}/custom-roles
{
  "code": "cashier",
  "name": "Cajera",
  "permissions": [
    { "code": "sales.view" },
    { "code": "sales.create" },
    { "code": "accounting.open_register" },
    { "code": "accounting.close_register" },
    { "code": "sales.apply_discount", "max_discount_percent": 5 }
  ]
}
```

### Superusuario

`User.is_superuser=True` ignora **todo** el sistema de permisos y opera cross-tenant. Reservado para el desarrollador. Otorgar via SQL/Tinker, NO via UI. Ver [permission-system.md](./permission-system.md) para el detalle.

---

## Aislamiento — Que Garantiza y Que No

### Garantiza

- Una vendedora en Pinal NO ve productos/clientes/ventas/ordenes/inventario de Caracas.
- Las queries siempre llevan `WHERE school_id = X` cuando aplica (servicios `SchoolIsolatedService` lo enforce).
- Los permisos se evaluan **por colegio** — un ADMIN en Caracas con SELLER en Pinal puede aprobar cambios en Caracas pero no en Pinal.

### NO garantiza (intencional)

- Aislamiento financiero: la dueña ve consolidado.
- Aislamiento de configuracion del sistema: usuarios, roles, permisos son globales.
- Productos globales (`global_products`): se ven en todos los colegios.

### NO garantiza (gap a cerrar)

- Algunos endpoints de contabilidad **estan montados bajo `/schools/{school_id}/accounting/*`** aunque el servicio internamente delegue a la version global e ignore `school_id`. Las URLs mienten sobre el scope. Ver memoria "Accounting Routes Global Migration Incomplete".
- Algunos endpoints sensibles tienen bypass por scope incompleto (ver findings de payments.py — cross-tenant enumeration).

---

## Portal Web por Colegio

El portal de padres usa el `slug` del colegio en la URL:

```
https://yourdomain.com/caracas    → Catalogo del colegio Caracas
https://yourdomain.com/pinal      → Catalogo Pinal
https://yourdomain.com/pumarejo   → Catalogo Pumarejo
```

### Resolucion del slug → school_id

Middleware Next.js extrae el slug del segment dinamico `[school_slug]` y lo resuelve via `GET /api/v1/schools?slug=caracas` antes de hidratar la pagina. El cliente del portal queda con el `school_id` en contexto y todas las llamadas posteriores lo incluyen.

### Productos visibles

```
catalogo = products WHERE school_id = X AND is_active = true
        UNION
        global_products WHERE is_active = true
```

Los globales aparecen en todos los catalogos pero solo se contabilizan una vez (un solo stock).

---

## Colegios en Produccion

| Colegio | Slug | Estado |
|---|---|---|
| Caracas | `caracas` | Activo |
| Pinal | `pinal` | Activo |
| Pumarejo | `pumarejo` | Activo |

Otros colegios pueden agregarse en `INSERT INTO schools` + asignacion de roles a los usuarios + carga de catalogo. No requiere cambios de codigo.

---

## Roadmap (v3 — Multi-Branch)

El plan v3 (ver [`docs/v3-branch-architecture/`](../v3-branch-architecture/)) introduce **branches** (sucursales fisicas) como segundo eje multi-tenant:

```
Branch (sucursal fisica) → tiene caja propia, inventario propio
   │
   ├── opera N Schools (colegios)
```

Esto cambia la realidad financiera: cada branch tendra su Caja y su Banco propio. El nivel "global" actual se mueve a "por branch", y el negocio total es la suma de los branches.

Ver el plan completo en `docs/v3-branch-architecture/`.

---

## Referencias

| Documento | Path |
|---|---|
| Sistema de permisos | [permission-system.md](./permission-system.md) |
| Contabilidad | [accounting-architecture.md](./accounting-architecture.md) |
| Roadmap v3 | [`docs/v3-branch-architecture/`](../v3-branch-architecture/) |
| Modelos | [`backend/app/models/school.py`](../../backend/app/models/school.py), [`user.py`](../../backend/app/models/user.py) |

---

[← Volver al indice](./README.md)

---

*Ultima actualizacion: 2026-05-02 | Version: 2.0.0*
