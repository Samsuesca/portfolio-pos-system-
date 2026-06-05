# Branch Architecture — Diseno de Sucursales

> **Version:** 1.0
> **Fecha:** 2026-04-13
> **Estado:** Propuesta aprobada conceptualmente, pendiente implementacion
> **Prerequisito:** v3.0.0 desplegado y estable

---

## Contexto de Negocio

UCR operara multiples sucursales fisicas. Cada sucursal maneja un conjunto de colegios que puede solaparse con los de otra sucursal (ej: Colegio San Jose en Sucursal Centro, y Colegio San Jose Sede Norte en Sucursal Norte). A pesar de ser el mismo colegio, los precios, costos e inventario difieren por sucursal.

```
UCR (negocio)
├── Sucursal Centro (tienda actual)
│   ├── Colegio A — precios/costos/inventario propios
│   ├── Colegio B
│   └── Colegio C
│
└── Sucursal Norte (nueva, ~Jun 2026)
    ├── Colegio A.1 (sede de A) — precios/costos DIFERENTES a A
    └── Colegio D
```

**Requerimientos clave:**
1. Inventario fisico separado por sucursal
2. Contabilidad separada por sucursal (caja, gastos, CxC, CxP)
3. Vista central/agregada para la administracion
4. Usuarios asignados a sucursal(es) con roles por ubicacion
5. Precios y costos pueden diferir para el mismo colegio en diferentes sucursales
6. Un colegio en dos sucursales puede agruparse para reportes consolidados

---

## Modelo de Datos

### Nuevas Tablas

```sql
-- Identidad del colegio real (agrupa sedes)
CREATE TABLE school_identities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,          -- "Colegio San Jose"
    logo_url VARCHAR(500),
    city VARCHAR(100),
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL
);

-- Sucursal fisica
CREATE TABLE branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,          -- "Sucursal Centro"
    code VARCHAR(50) UNIQUE NOT NULL,    -- "CENTRO"
    address TEXT,
    city VARCHAR(100),
    phone VARCHAR(50),
    is_headquarters BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL
);
```

### Modificaciones a Tablas Existentes

```sql
-- schools: agregar branch_id y school_identity_id
ALTER TABLE schools ADD COLUMN branch_id UUID REFERENCES branches(id);
ALTER TABLE schools ADD COLUMN school_identity_id UUID REFERENCES school_identities(id);

-- Cada school record = "colegio en sucursal" (ya funciona asi conceptualmente)
-- school_identity_id permite agrupar sedes del mismo colegio

-- sales: agregar branch_id (redundante pero necesario para queries eficientes)
ALTER TABLE sales ADD COLUMN branch_id UUID REFERENCES branches(id);

-- orders: idem
ALTER TABLE orders ADD COLUMN branch_id UUID REFERENCES branches(id);

-- daily_cash_registers: contabilidad por sucursal
ALTER TABLE daily_cash_registers ADD COLUMN branch_id UUID REFERENCES branches(id);

-- balance_accounts: cuentas por sucursal
ALTER TABLE balance_accounts ADD COLUMN branch_id UUID REFERENCES branches(id);

-- transactions: trazabilidad por sucursal
ALTER TABLE transactions ADD COLUMN branch_id UUID REFERENCES branches(id);

-- expenses: gastos por sucursal
ALTER TABLE expenses ADD COLUMN branch_id UUID REFERENCES branches(id);

-- accounts_receivable, accounts_payable: por sucursal
ALTER TABLE accounts_receivable ADD COLUMN branch_id UUID REFERENCES branches(id);
ALTER TABLE accounts_payable ADD COLUMN branch_id UUID REFERENCES branches(id);

-- user_school_roles: agregar dimension de sucursal
ALTER TABLE user_school_roles ADD COLUMN branch_id UUID REFERENCES branches(id);
-- branch_id = NULL → acceso a todas las sucursales (admin central)
```

### Diagrama de Relaciones

```
                    ┌─────────────────────┐
                    │  school_identities   │
                    │  (Colegio real)      │
                    └──────────┬──────────┘
                               │ 1:N
                               ▼
┌──────────┐  1:N   ┌─────────────────────┐
│ branches  │───────→│     schools          │
│ (sucursal)│        │  (colegio-en-sucursal│
└──────────┘        │   con sus precios,   │
     │               │   productos, inv.)   │
     │               └──────────┬──────────┘
     │                          │
     │               ┌──────────┼──────────┐
     │               │          │          │
     │               ▼          ▼          ▼
     │          products   inventory    sales
     │         (por school) (por school) (por school
     │                                   + branch_id)
     │
     │         ┌─────────────────────────────────┐
     └────────→│  Contabilidad (branch_id)       │
               │  daily_cash_registers            │
               │  balance_accounts                │
               │  transactions                    │
               │  expenses                        │
               │  accounts_receivable/payable     │
               └─────────────────────────────────┘
```

### Scoping de branch_id

El `branch_id` sigue el mismo patron dual que `school_id`:

| Valor | Significado |
|-------|-------------|
| `NULL` | Global / consolidado (admin central, gastos corporativos) |
| `UUID` | Pertenece a esa sucursal especifica |

Esto permite que:
- Un gasto corporativo (alquiler de bodega central) tenga `branch_id = NULL`
- Un gasto operativo (alquiler Sucursal Norte) tenga `branch_id = UUID`
- Los reportes consoliden por `branch_id IS NOT NULL` o filtren por UUID

---

## Patron de Acceso: UserBranchScope

### Resolucion de acceso

```python
# Dependency injection — resuelve branches accesibles por el usuario
async def get_user_branch_ids(
    current_user: User,
    db: AsyncSession
) -> list[UUID] | None:
    """
    Retorna lista de branch_ids accesibles por el usuario.
    None = acceso a TODAS las sucursales (admin central).
    """
    roles = await db.execute(
        select(UserSchoolRole.branch_id)
        .where(UserSchoolRole.user_id == current_user.id)
        .distinct()
    )
    branch_ids = [r for r in roles.scalars().all()]

    # Si alguno es None, el usuario tiene acceso central
    if None in branch_ids:
        return None  # sin filtro

    return branch_ids
```

### Filtrado en queries

```python
# En servicios — filtro por branch
stmt = select(Sale).where(Sale.school_id.in_(user_school_ids))

# Con branch scope
if user_branch_ids is not None:
    stmt = stmt.where(Sale.branch_id.in_(user_branch_ids))
```

### Jerarquia de permisos

```
Admin Central (branch_id = NULL en UserSchoolRole):
  → Ve TODAS las sucursales
  → Puede ver reportes consolidados
  → Gestiona configuracion global

Admin Sucursal (branch_id = UUID):
  → Ve SOLO su sucursal
  → Gestiona caja, inventario, ventas de su sucursal
  → Contabilidad local (gastos, CxC, CxP de su sucursal)

Vendedor (branch_id = UUID):
  → Opera en su sucursal asignada
  → Ventas, ordenes, consulta de inventario local
```

---

## Inventario por Sucursal

El inventario ya esta scoped por `school_id`. Como cada `school` pertenece a un `branch`, el inventario queda automaticamente separado por sucursal:

```
Sucursal Centro:
  └── Colegio A (school_id = X):
        └── Producto "Falda Talla 10" → Inventory(school_id=X, qty=25)

Sucursal Norte:
  └── Colegio A.1 (school_id = Y):
        └── Producto "Falda Talla 10" → Inventory(school_id=Y, qty=12)
```

No se necesita `branch_id` en `inventory` — la relacion `school.branch_id` es suficiente. Para reportes de inventario por sucursal, se hace JOIN con school.

---

## Contabilidad por Sucursal

### Caja Diaria

Cada sucursal cierra su propia caja:

```python
# Cierre de caja por sucursal
DailyCashRegister(
    branch_id=branch_uuid,    # sucursal especifica
    school_id=None,            # o por colegio si se requiere
    date=get_colombia_date(),
    ...
)
```

### Balance Accounts

Cada sucursal puede tener sus propias cuentas:

```
Caja Sucursal Centro    → branch_id = centro_uuid
Caja Sucursal Norte     → branch_id = norte_uuid
Banco General           → branch_id = NULL (consolidado)
```

### Reportes Consolidados

```python
# Vista central — todos los saldos
SELECT ba.name, ba.current_balance, b.name as branch_name
FROM balance_accounts ba
LEFT JOIN branches b ON ba.branch_id = b.id
ORDER BY b.name NULLS FIRST;  -- NULL = cuentas globales primero
```

---

## Precios y Costos por Sucursal

Los precios y costos viven en `Product` y `ProductCostComponent`, que estan scoped por `school_id`. Como "Colegio A en Sucursal Centro" y "Colegio A.1 en Sucursal Norte" son registros `School` diferentes, cada uno tiene sus propios productos con sus propios precios y costos.

**Ventaja:** No se necesita ningun cambio en el modelo de precios/costos. La separacion es natural.

**Para reportes consolidados** (ej: "cuanto vendimos del Colegio San Jose en TODAS las sucursales"):

```sql
SELECT si.name, SUM(s.total)
FROM sales s
JOIN schools sc ON s.school_id = sc.id
JOIN school_identities si ON sc.school_identity_id = si.id
GROUP BY si.name;
```

---

## Frontend: Selector de Sucursal

### Navegacion

```
┌─────────────────────────────────────────────┐
│  [Logo UCR]  Sucursal: [Centro ▼]  [User]  │
│              ────────────────────            │
│  Si admin central: selector con "Todas"     │
│  Si admin sucursal: fijo en su sucursal     │
│  Si vendedor: fijo en su sucursal           │
└─────────────────────────────────────────────┘
```

### Store

```typescript
interface BranchStore {
  branches: Branch[];
  currentBranch: Branch | null;  // null = vista consolidada
  setBranch: (branch: Branch | null) => void;
}

// Todos los servicios API incluyen branch context
const sales = await saleService.getAll(schoolId, {
  branch_id: currentBranch?.id  // filtro opcional
});
```

---

## Migracion de Datos (v2.9.0/v3.0.0 → v3.1.0 con Branches)

### Paso 1: Crear tablas
- `branches` — insertar "Central" como sede principal (`is_headquarters = true`)
- `school_identities` — crear una identidad por cada nombre unico de colegio

### Paso 2: Asignar datos existentes
```sql
-- Todos los schools existentes pertenecen a "Central"
UPDATE schools SET branch_id = (SELECT id FROM branches WHERE code = 'CENTRAL');

-- Crear identidades y vincular
INSERT INTO school_identities (id, name) SELECT gen_random_uuid(), name FROM schools;
UPDATE schools SET school_identity_id = si.id
FROM school_identities si WHERE schools.name = si.name;

-- Todas las ventas existentes son de "Central"
UPDATE sales SET branch_id = (SELECT id FROM branches WHERE code = 'CENTRAL');
UPDATE orders SET branch_id = (SELECT id FROM branches WHERE code = 'CENTRAL');

-- Contabilidad existente → Central
UPDATE daily_cash_registers SET branch_id = (SELECT id FROM branches WHERE code = 'CENTRAL')
WHERE branch_id IS NULL AND school_id IS NOT NULL;
-- Los registros puramente globales permanecen con branch_id = NULL
```

### Paso 3: Hacer NOT NULL donde corresponda
```sql
ALTER TABLE schools ALTER COLUMN branch_id SET NOT NULL;
ALTER TABLE sales ALTER COLUMN branch_id SET NOT NULL;
ALTER TABLE orders ALTER COLUMN branch_id SET NOT NULL;
```

---

## Compatibilidad con Comercializacion (Fase 2)

Este diseno es compatible con la capa `Organization` futura:

```sql
-- Fase 2: agregar organization_id a branches
ALTER TABLE branches ADD COLUMN organization_id UUID REFERENCES organizations(id);

-- Todos los branches existentes → Organization "UCR"
UPDATE branches SET organization_id = (SELECT id FROM organizations WHERE slug = 'ucr');
ALTER TABLE branches ALTER COLUMN organization_id SET NOT NULL;
```

El tenant boundary se mueve de `branch` a `organization`:
- **SaaS (Modelo B):** Cada negocio es una Organization. Ven solo sus branches/schools.
- **Self-hosted (Modelo A):** Una Organization, deployment propio.

---

[← Volver al indice](./README.md)
