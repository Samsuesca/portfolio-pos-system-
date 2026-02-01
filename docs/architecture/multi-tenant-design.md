# Diseno Multi-Tenant

Arquitectura multi-tenant de Uniformes System.

---

## Concepto

Multi-tenant significa que **un solo sistema gestiona multiples colegios**. Cada colegio es un "tenant" o inquilino del sistema.

---

## Modelo de Datos

### Tabla Principal: schools

```sql
CREATE TABLE schools (
    id UUID PRIMARY KEY,
    name VARCHAR NOT NULL,
    slug VARCHAR UNIQUE NOT NULL,
    address VARCHAR,
    phone VARCHAR,
    email VARCHAR,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

### Tablas con school_id (Por Colegio)

| Tabla | Descripcion |
|-------|-------------|
| `products` | Productos especificos del colegio |
| `garment_types` | Tipos de prenda del colegio |
| `inventory` | Stock por producto/talla |
| `clients` | Clientes asociados al colegio |
| `sales` | Ventas del colegio |
| `orders` | Pedidos del colegio |
| `web_orders` | Pedidos web del colegio |

### Tablas Globales (Sin school_id)

| Tabla | Descripcion |
|-------|-------------|
| `users` | Usuarios del sistema |
| `balance_accounts` | Cuentas contables |
| `global_products` | Productos del negocio |
| `expenses` | Gastos (school_id opcional) |

---

## Patron de Endpoints

### Endpoints por Colegio

```
GET  /api/v1/schools/{school_id}/products
POST /api/v1/schools/{school_id}/products
GET  /api/v1/schools/{school_id}/sales
POST /api/v1/schools/{school_id}/sales
GET  /api/v1/schools/{school_id}/clients
```

### Endpoints Globales

```
GET  /api/v1/global/products
GET  /api/v1/global/accounting/cash-balances
GET  /api/v1/users
```

---

## Selector de Colegio

En el frontend, el selector de colegio en la barra superior:

1. Cambia el `schoolId` en el store de Zustand
2. Los servicios API incluyen el school_id en las peticiones
3. El backend filtra datos por school_id

```typescript
// schoolStore.ts
const useSchoolStore = create((set) => ({
  currentSchool: null,
  setCurrentSchool: (school) => set({ currentSchool: school }),
}));
```

---

## Control de Acceso

### Roles por Colegio

```sql
CREATE TABLE user_school_roles (
    user_id UUID REFERENCES users(id),
    school_id UUID REFERENCES schools(id),
    role VARCHAR NOT NULL, -- 'admin', 'seller'
    PRIMARY KEY (user_id, school_id)
);
```

Un usuario puede tener diferentes roles en diferentes colegios.

### Roles del Sistema

| Rol | Acceso |
|-----|--------|
| `superuser` | Todos los colegios, configuracion |
| `admin` | Un colegio, gestion completa |
| `seller` | Un colegio, solo ventas |

---

## Colegios Actuales

| Colegio | Slug |
|---------|------|
| Caracas | `caracas` |
| Pinal | `pinal` |
| Pumarejo | `pumarejo` |

---

## Portal Web por Colegio

El portal web usa el slug para rutas dinamicas:

```
https://uniformesconsuelo.com/caracas     → Catalogo Caracas
https://uniformesconsuelo.com/pinal       → Catalogo Pinal
https://uniformesconsuelo.com/pumarejo    → Catalogo Pumarejo
```

---

## Consideraciones

1. **Aislamiento**: Los datos de un colegio no son visibles desde otro
2. **Productos Globales**: Pueden compartirse entre colegios
3. **Contabilidad Global**: No depende del colegio seleccionado
4. **Usuarios Multi-Colegio**: Un vendedor puede trabajar en varios colegios

---

[← Volver al indice](./README.md)
