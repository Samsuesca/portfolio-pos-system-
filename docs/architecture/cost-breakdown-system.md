# Sistema de Cost Breakdown

Costos de productos construidos por **componentes** (tela, hilo, mano de obra, overhead) en lugar de un costo unico opaco. Plantillas reutilizables por tipo de prenda + valores especificos por producto. Snapshots de `unit_cost` al momento de la venta para preservar margen historico.

---

## Por Que

El negocio necesita responder preguntas como "¿cual es el margen real del polo de Caracas medio?" **incluso si el costo de la tela cambio el mes pasado**. Tres requerimientos:

1. **Composicion explicita** — saber que el costo de un polo se compone de $4500 tela + $800 hilo + $5000 mano de obra + $700 empaque, no un opaco $11000.
2. **Plantillas por tipo de prenda** — un "polo" siempre tiene los mismos 4 componentes; una "falda" tiene otros. Definir una vez por `GarmentType` y reusar.
3. **Snapshot al vender** — la venta de hoy debe reflejar el margen del momento, no recalcular con costos futuros.

---

## Modelo de Datos

```
GarmentType (polo, falda, pantalon...)
   │
   │ 1:N
   ▼
CostComponentTemplate
   • code (e.g. "tela", "hilo", "mano_de_obra")
   • name
   • is_variable    ← true para items que cambian frecuente (tela)
   • display_order
   • is_active
   │
   │ 1:N (un template instanciado en muchos productos)
   ▼
ProductCostComponent
   • product_id
   • template_id
   • amount         ← valor real ($4500)
   • notes          ← contexto opcional
```

### Modelos SQLAlchemy

```python
# backend/app/models/product.py

class CostComponentTemplate(Base):
    __tablename__ = "cost_component_templates"
    id: UUID
    garment_type_id: UUID          # FK garment_types
    name: str
    code: str                      # snake_case, unique por garment_type
    is_variable: bool              # marca el componente como volatil
    display_order: int             # orden visual en UI
    is_active: bool                # soft-delete

class ProductCostComponent(Base):
    __tablename__ = "product_cost_components"
    id: UUID
    product_id: UUID               # FK products
    template_id: UUID              # FK cost_component_templates
    amount: Decimal(10, 2)
    notes: str | None
```

### Snapshot en Sale Item

```python
# backend/app/models/sale.py
class SaleItem(Base):
    unit_price: Decimal      # precio al momento de la venta
    unit_cost: Decimal|None  # costo snapshot al momento de la venta
    subtotal: Decimal
    discount: Decimal
```

`unit_cost` se setea al crear la venta y nunca se recalcula. La venta histórica preserva su margen aunque los componentes cambien después.

---

## Fallback Chain (COGS)

Cuando se vende un producto, el sistema decide `unit_cost` en este orden:

```
1. Sumar componentes activos del producto:
     unit_cost = Σ amounts where ProductCostComponent.product_id = X
   Si total > 0 → usar.

2. Sino, usar Product.cost (campo simple legado):
   Si Product.cost > 0 → usar.

3. Sino, usar 0 y marcar la venta para revision manual.
   Margen reportado = 100% (alarma visual en reportes).
```

Esto permite **convivencia** entre productos legados (con `Product.cost` simple) y productos nuevos con breakdown completo. La migracion es gradual.

---

## Servicios

### `CostComponentService`

[`backend/app/services/cost_component.py`](../../backend/app/services/cost_component.py).

#### Templates (por GarmentType)

| Metodo | Proposito |
|---|---|
| `get_templates(garment_type_id)` | Lista activos ordenados por `display_order` |
| `create_template(garment_type_id, name, code, is_variable, display_order)` | Nueva plantilla |
| `update_template(template_id, **kwargs)` | Modifica name/order/is_variable |
| `deactivate_template(template_id)` | Soft-delete (is_active=False) |

#### Breakdown (por Producto)

| Metodo | Proposito |
|---|---|
| `get_breakdown(product_id)` | Retorna dict con componentes + total + margin_percent + has_estimates |
| `upsert_breakdown(product_id, components)` | Crea/actualiza valores. Si template_id no existia → insert; si existia → update |
| `delete_component(component_id)` | Borra un componente individual |

#### Sincronizacion de `Product.cost`

Cuando cambia un breakdown, el servicio recalcula y persiste en `Product.cost` la suma de los componentes activos. Esto mantiene el campo legado coherente y permite que reports antiguos sigan funcionando.

> **Cuidado**: Si alguien edita `Product.cost` directamente desde otra ruta (e.g. ajuste manual via admin), el siguiente `upsert_breakdown` lo va a sobreescribir. La unica fuente de verdad para productos con breakdown es el set de componentes.

---

## API Endpoints

| Endpoint | Metodo | Permiso |
|---|---|---|
| `/api/v1/garment-types/{id}/cost-templates` | GET | `costs.manage_templates` o `inventory.view_cost` |
| `/api/v1/garment-types/{id}/cost-templates` | POST | `costs.manage_templates` |
| `/api/v1/cost-templates/{id}` | PATCH/DELETE | `costs.manage_templates` |
| `/api/v1/products/{id}/cost-breakdown` | GET | `inventory.view_cost` |
| `/api/v1/products/{id}/cost-breakdown` | PUT | `products.set_cost` |

> Codigos de permiso definidos en [permission-system.md](./permission-system.md).

---

## Flag `is_variable`

Marca componentes cuyo `amount` se espera cambie con frecuencia (ej. tela, fluctuaciones de precio).

**Efecto en UI**:
- Badge visual en el editor (`CostBreakdownEditor`).
- En el response de `get_breakdown`, `has_estimates=true` si **al menos un componente** del producto es variable.
- Reports de margen marcan esos productos con asterisco para indicar que el costo es **estimacion**, no firme.

**Efecto en negocio**:
- Sirve como recordatorio para revisar mensualmente.
- No afecta el calculo: el `amount` actual sigue siendo el que se usa para `unit_cost` snapshot al vender.

---

## Reports

### Margen por producto

```sql
SELECT p.id, p.name, p.price, COALESCE(SUM(pcc.amount), p.cost, 0) AS unit_cost,
       (p.price - COALESCE(SUM(pcc.amount), p.cost, 0)) / p.price AS margin
FROM products p
LEFT JOIN product_cost_components pcc ON pcc.product_id = p.id
GROUP BY p.id;
```

### Margen historico (lo que importa para finanzas)

Usa `SaleItem.unit_cost` del snapshot, no recalcula desde componentes actuales:

```sql
SELECT DATE(s.created_at), SUM(si.subtotal - si.unit_cost * si.quantity) AS gross_margin
FROM sales s
JOIN sale_items si ON si.sale_id = s.id
WHERE s.status = 'completed'
GROUP BY 1;
```

Esto es lo que la dueña ve en el dashboard. Es **inmune** a cambios de costo posteriores.

---

## UI: `CostBreakdownEditor`

Componente desktop (`frontend/src/components/CostBreakdownEditor.tsx`):

- Lista todos los templates activos del `GarmentType` del producto.
- Para cada template muestra un input numerico precargado con el `ProductCostComponent.amount` actual (o vacio si no existe).
- Total dinamico al pie + margen calculado vs `Product.price`.
- Flag visual `is_variable` con icono de aviso.
- Boton "Save" → `PUT /products/{id}/cost-breakdown` con array de `{template_id, amount, notes}`.

Validaciones:
- `amount >= 0`.
- Margen advertido si negativo.
- Aviso si templates activos no estan llenos (puede ser intencional, pero no por descuido).

---

## Anti-Patrones

### Recalcular margen desde componentes en reports historicos

```sql
-- MAL: si la tela subio en abril, las ventas de marzo aparecen menos rentables
SELECT s.created_at, p.price - SUM(pcc.amount) AS margin
FROM sales s ... JOIN product_cost_components pcc ...
```

```sql
-- BIEN: usar el snapshot
SELECT s.created_at, si.unit_price - si.unit_cost AS margin
FROM sale_items si ...
```

### Editar `Product.cost` directamente

```python
# MAL — el siguiente upsert_breakdown lo machaca
product.cost = Decimal("12000")
await db.commit()
```

```python
# BIEN — actualizar componentes y dejar que el servicio sincronice
await cost_component_service.upsert_breakdown(product_id, [
    {"template_id": tela_id, "amount": Decimal("5000")},
    {"template_id": hilo_id, "amount": Decimal("1000")},
    ...
])
```

### Snapshot mutable

`SaleItem.unit_cost` debe ser inmutable post-creacion. Si necesitas "corregir" el margen historico (e.g. detectaste que un costo estaba mal cargado al momento de la venta), abrir un ajuste contable explicito (en `accounting`) — NO mutar el snapshot. La auditoria depende de eso.

---

## Roadmap

- **Cost components con unidades** (kg, metros) en vez de monto fijo, para calculos automaticos cuando varia la cantidad por talla.
- **Historial de cambios de templates**: tabla de auditoria que registre cuando un componente cambio de precio, para reconstruir margen estimado en futuras ventas.
- **Bulk recosting**: cuando cambia un componente clave (e.g. "tela base" sube 10%), poder propagar a todos los productos del garment_type con un solo UPDATE.
- **Cost forecasting**: con `is_variable` historico, predecir costo del proximo trimestre.

---

## Referencias

| Codigo | Path |
|---|---|
| Servicio | [`backend/app/services/cost_component.py`](../../backend/app/services/cost_component.py) |
| Modelos | [`backend/app/models/product.py`](../../backend/app/models/product.py) (CostComponentTemplate, ProductCostComponent) |
| Schemas | [`backend/app/schemas/cost_component.py`](../../backend/app/schemas/cost_component.py) |
| Routes | [`backend/app/api/routes/cost_components.py`](../../backend/app/api/routes/cost_components.py) |
| Snapshot | [`backend/app/models/sale.py`](../../backend/app/models/sale.py) (SaleItem.unit_cost) |
| Editor UI | `frontend/src/components/CostBreakdownEditor.tsx` |

---

[← Volver al indice](./README.md)

---

*Ultima actualizacion: 2026-05-02 | Version: 1.0.0*
