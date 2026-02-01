# Sistema de Cambios y Devoluciones

Sistema completo para gestionar cambios de productos ya vendidos, con ajuste automático de inventario y contabilidad.

## Tabla de Contenidos

- [Conceptos Básicos](#conceptos-básicos)
- [Tipos de Cambios](#tipos-de-cambios)
- [Flujo de Trabajo](#flujo-de-trabajo)
- [API Endpoints](#api-endpoints)
- [Modelo de Datos](#modelo-de-datos)
- [Lógica de Negocio](#lógica-de-negocio)
- [Ejemplos de Uso](#ejemplos-de-uso)

## Conceptos Básicos

### ¿Qué es un cambio?

Un **cambio** es una solicitud para reemplazar o devolver un producto que ya fue vendido. El sistema gestiona el ciclo completo:

1. Crear solicitud de cambio
2. Validar disponibilidad
3. Aprobar/rechazar
4. Ajustar inventario automáticamente
5. Registrar ajuste contable

### Estados de un cambio

- **`PENDING`**: Creado, pendiente de aprobación
- **`APPROVED`**: Aprobado, inventario ajustado
- **`REJECTED`**: Rechazado, sin cambios en inventario

## Tipos de Cambios

### 1. Cambio de Talla (`size_change`)

**Caso de uso**: Cliente necesita diferente talla del mismo producto.

**Ejemplo**:
- **Original**: Camisa Polo Talla 14 ($40,000)
- **Nuevo**: Camisa Polo Talla 16 ($42,000)
- **Ajuste**: +$2,000 (cliente paga diferencia)

### 2. Cambio de Producto (`product_change`)

**Caso de uso**: Cliente quiere cambiar a un producto completamente diferente.

**Ejemplo**:
- **Original**: Pantalón Azul ($50,000)
- **Nuevo**: Falda Gris ($45,000)
- **Ajuste**: -$5,000 (reembolso para cliente)

### 3. Devolución (`return`)

**Caso de uso**: Cliente devuelve producto sin reemplazo.

**Ejemplo**:
- **Original**: Chaqueta ($80,000)
- **Nuevo**: -ninguno-
- **Ajuste**: -$80,000 (reembolso completo)

### 4. Defecto (`defect`)

**Caso de uso**: Producto tiene defecto, se reemplaza por uno nuevo.

**Ejemplo**:
- **Original**: Camisa con defecto ($40,000)
- **Nuevo**: Camisa nueva ($40,000)
- **Ajuste**: $0 (sin cargo)

## Flujo de Trabajo

```
┌─────────────────┐
│   VENDEDOR      │
│ Crea solicitud  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   SISTEMA       │
│ Valida stock    │
│ Calcula precio  │
│ Estado: PENDING │
└────────┬────────┘
         │
         ▼
┌─────────────────────┐
│   ADMINISTRADOR     │
│ Revisa y aprueba    │
│ o rechaza           │
└────────┬────────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌────────┐ ┌──────────┐
│APROBADO│ │RECHAZADO │
│        │ │          │
│Ajusta  │ │Sin cambio│
│inventory│ │          │
└────────┘ └──────────┘
```

## API Endpoints

### 1. Crear Cambio

```http
POST /api/v1/schools/{school_id}/sales/{sale_id}/changes
Authorization: Bearer {token}
```

**Request Body**:
```json
{
  "change_type": "size_change",
  "original_item_id": "550e8400-e29b-41d4-a716-446655440000",
  "new_product_id": "660e8400-e29b-41d4-a716-446655440000",
  "returned_quantity": 1,
  "new_quantity": 1,
  "reason": "Cliente necesita talla más grande"
}
```

**Response** (201 Created):
```json
{
  "id": "770e8400-e29b-41d4-a716-446655440000",
  "sale_id": "880e8400-e29b-41d4-a716-446655440000",
  "change_type": "size_change",
  "status": "pending",
  "returned_quantity": 1,
  "new_quantity": 1,
  "price_adjustment": 2000.00,
  "reason": "Cliente necesita talla más grande",
  "created_at": "2025-01-20T10:30:00Z"
}
```

**Permisos**: `SELLER` o superior

---

### 2. Listar Cambios de una Venta

```http
GET /api/v1/schools/{school_id}/sales/{sale_id}/changes
Authorization: Bearer {token}
```

**Response** (200 OK):
```json
[
  {
    "id": "770e8400-e29b-41d4-a716-446655440000",
    "sale_code": "VNT-2025-0001",
    "change_type": "size_change",
    "status": "approved",
    "returned_quantity": 1,
    "new_quantity": 1,
    "price_adjustment": 2000.00,
    "change_date": "2025-01-20T10:30:00Z",
    "reason": "Cliente necesita talla más grande"
  }
]
```

**Permisos**: `VIEWER` o superior

---

### 3. Aprobar Cambio

```http
PATCH /api/v1/schools/{school_id}/sales/{sale_id}/changes/{change_id}/approve
Authorization: Bearer {token}
```

**Response** (200 OK):
```json
{
  "id": "770e8400-e29b-41d4-a716-446655440000",
  "status": "approved",
  "price_adjustment": 2000.00,
  "updated_at": "2025-01-20T11:00:00Z"
}
```

**Efectos**:
1. ✅ Devuelve producto original al inventario (+1)
2. ✅ Deduce producto nuevo del inventario (-1)
3. ✅ Actualiza estado a `APPROVED`
4. ✅ Registra ajustes con notas de auditoría

**Permisos**: `ADMIN` o superior

---

### 4. Rechazar Cambio

```http
PATCH /api/v1/schools/{school_id}/sales/{sale_id}/changes/{change_id}/reject
Authorization: Bearer {token}
```

**Request Body**:
```json
{
  "status": "rejected",
  "rejection_reason": "Stock insuficiente del producto solicitado"
}
```

**Response** (200 OK):
```json
{
  "id": "770e8400-e29b-41d4-a716-446655440000",
  "status": "rejected",
  "rejection_reason": "Stock insuficiente del producto solicitado",
  "updated_at": "2025-01-20T11:00:00Z"
}
```

**Efectos**:
- Sin cambios en inventario
- Estado cambia a `REJECTED`

**Permisos**: `ADMIN` o superior

## Modelo de Datos

### Tabla: `sale_changes`

```sql
CREATE TABLE sale_changes (
    id UUID PRIMARY KEY,
    sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    original_item_id UUID NOT NULL REFERENCES sale_items(id) ON DELETE RESTRICT,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,

    -- Tipo y estado
    change_type change_type_enum NOT NULL,  -- size_change, product_change, return, defect
    status change_status_enum NOT NULL DEFAULT 'pending',  -- pending, approved, rejected
    change_date TIMESTAMP NOT NULL DEFAULT NOW(),

    -- Producto devuelto
    returned_quantity INTEGER NOT NULL CHECK (returned_quantity > 0),

    -- Producto nuevo (opcional para returns)
    new_product_id UUID REFERENCES products(id) ON DELETE RESTRICT,
    new_quantity INTEGER NOT NULL DEFAULT 0 CHECK (new_quantity >= 0),
    new_unit_price NUMERIC(10, 2),

    -- Ajuste financiero
    price_adjustment NUMERIC(10, 2) NOT NULL DEFAULT 0,

    -- Notas
    reason TEXT NOT NULL,
    rejection_reason TEXT,

    -- Auditoría
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX ix_sale_changes_sale_id ON sale_changes(sale_id);
CREATE INDEX ix_sale_changes_status ON sale_changes(status);
CREATE INDEX ix_sale_changes_change_date ON sale_changes(change_date);
```

### Enums

```sql
CREATE TYPE change_type_enum AS ENUM ('size_change', 'product_change', 'return', 'defect');
CREATE TYPE change_status_enum AS ENUM ('pending', 'approved', 'rejected');
```

## Lógica de Negocio

### Validaciones al Crear

1. **Venta debe existir** y pertenecer al colegio
2. **Venta no puede estar cancelada**
3. **Item original debe existir** en la venta
4. **Cantidad devuelta** ≤ cantidad original
5. **Para cambios (no returns)**: Producto nuevo requerido
6. **Para returns**: No puede tener producto nuevo
7. **Stock disponible** del producto nuevo

### Cálculo de Ajuste de Precio

```python
# Para cambios (size_change, product_change, defect)
price_adjustment = (new_price * new_qty) - (original_price * returned_qty)

# Para returns
price_adjustment = -(original_price * returned_qty)  # Reembolso
```

### Ajustes de Inventario

Al **aprobar** un cambio:

```python
# 1. Devolver producto original
inventory.adjust_stock(
    product_id=original_product_id,
    quantity=+returned_quantity,
    note=f"Devolución - Cambio #{change_id}"
)

# 2. Entregar producto nuevo (si aplica)
if new_product_id:
    inventory.adjust_stock(
        product_id=new_product_id,
        quantity=-new_quantity,
        note=f"Entrega - Cambio #{change_id}"
    )
```

## Ejemplos de Uso

### Caso 1: Cambio de Talla (Precio Mayor)

**Escenario**: Cliente compró Camisa T14 ($40,000) pero necesita T16 ($42,000)

```bash
# 1. Vendedor crea solicitud
curl -X POST http://localhost:8000/api/v1/schools/{school_id}/sales/{sale_id}/changes \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "change_type": "size_change",
    "original_item_id": "item-t14-uuid",
    "new_product_id": "product-t16-uuid",
    "returned_quantity": 1,
    "new_quantity": 1,
    "reason": "Cliente necesita talla más grande"
  }'

# Sistema responde:
{
  "id": "change-uuid",
  "status": "pending",
  "price_adjustment": 2000.00  # Cliente debe pagar $2,000 adicionales
}

# 2. Admin aprueba
curl -X PATCH http://localhost:8000/api/v1/schools/{school_id}/sales/{sale_id}/changes/{change_id}/approve \
  -H "Authorization: Bearer {admin_token}"

# Sistema ejecuta:
# ✅ Inventario T14: +1
# ✅ Inventario T16: -1
# ✅ Estado: APPROVED
```

**Resultado**:
- Cliente recibe T16
- Paga $2,000 adicionales
- Inventario actualizado automáticamente

---

### Caso 2: Devolución Completa

**Escenario**: Cliente devuelve Chaqueta ($80,000) sin reemplazo

```bash
# 1. Crear devolución
curl -X POST http://localhost:8000/api/v1/schools/{school_id}/sales/{sale_id}/changes \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "change_type": "return",
    "original_item_id": "item-chaqueta-uuid",
    "returned_quantity": 1,
    "new_quantity": 0,
    "reason": "Cliente no quedó satisfecho con el producto"
  }'

# Sistema responde:
{
  "id": "change-uuid",
  "status": "pending",
  "price_adjustment": -80000.00  # Reembolso de $80,000
}

# 2. Admin aprueba
curl -X PATCH .../approve

# Sistema ejecuta:
# ✅ Inventario Chaqueta: +1
# ✅ Sin deducción de inventario (no hay producto nuevo)
# ✅ Ajuste contable: -$80,000
```

**Resultado**:
- Cliente recibe reembolso de $80,000
- Chaqueta vuelve al inventario

---

### Caso 3: Cambio por Defecto (Sin Cargo)

**Escenario**: Camisa tiene defecto de fabricación

```bash
curl -X POST http://localhost:8000/api/v1/schools/{school_id}/sales/{sale_id}/changes \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "change_type": "defect",
    "original_item_id": "item-camisa-defecto-uuid",
    "new_product_id": "producto-camisa-nueva-uuid",
    "returned_quantity": 1,
    "new_quantity": 1,
    "reason": "Producto con defecto en costura"
  }'

# Sistema responde:
{
  "price_adjustment": 0.00  # Sin cargo adicional (mismo precio)
}
```

**Resultado**:
- Cliente recibe camisa nueva
- Sin ajuste de precio
- Inventario actualizado

---

## Reportes y Auditoría

### Consultar Historial de Cambios

```sql
-- Cambios por período
SELECT
    c.id,
    s.code AS sale_code,
    c.change_type,
    c.status,
    c.price_adjustment,
    u.username AS processed_by,
    c.change_date
FROM sale_changes c
JOIN sales s ON c.sale_id = s.id
JOIN users u ON c.user_id = u.id
WHERE c.change_date BETWEEN '2025-01-01' AND '2025-01-31'
    AND s.school_id = 'school-uuid'
ORDER BY c.change_date DESC;
```

### Calcular Impacto Financiero

```sql
-- Suma de ajustes por tipo
SELECT
    change_type,
    COUNT(*) AS total_changes,
    SUM(price_adjustment) AS total_adjustment
FROM sale_changes
WHERE status = 'approved'
    AND sale_id IN (SELECT id FROM sales WHERE school_id = 'school-uuid')
GROUP BY change_type;
```

---

## Mejores Prácticas

### Para Vendedores

1. ✅ Siempre verificar disponibilidad del producto nuevo antes de crear solicitud
2. ✅ Incluir razón clara y descriptiva
3. ✅ Confirmar con el cliente antes de procesar

### Para Administradores

1. ✅ Revisar stock disponible antes de aprobar
2. ✅ Verificar que el ajuste de precio sea correcto
3. ✅ Proporcionar razón de rechazo clara cuando sea necesario
4. ✅ Monitorear tendencias de cambios para identificar problemas de calidad

### Para Desarrolladores

1. ✅ Siempre usar transacciones al aprobar cambios
2. ✅ Verificar stock NUEVAMENTE antes de confirmar (por si cambió entre creación y aprobación)
3. ✅ Registrar ajustes de inventario con notas claras para auditoría
4. ✅ Manejar errores de concurrencia (ej: dos admins aprueban al mismo tiempo)

---

## Próximas Mejoras

- [ ] **Notificaciones**: Email/SMS cuando cambio es aprobado/rechazado
- [ ] **Límites**: Políticas de cambio (ej: solo 1 cambio por venta, máximo 30 días)
- [ ] **Reportes**: Dashboard de cambios por producto, cliente, razón
- [ ] **Workflow multi-step**: Requieren múltiples aprobaciones para valores altos
- [ ] **Integración contable**: Crear asientos contables automáticos

---

## Soporte

Para preguntas sobre el sistema de cambios:
- Consultar API Docs: http://localhost:8000/docs
- Revisar código: `backend/app/services/sale.py` (métodos de cambios)
- Abrir issue en GitHub
