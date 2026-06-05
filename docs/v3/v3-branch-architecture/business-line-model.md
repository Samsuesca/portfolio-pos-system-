# Modelo de Líneas de Negocio (`business_line`)

> **Versión:** 0.1 — Diseño propuesto
> **Fecha:** 2026-05-24
> **Autor:** Angel Suesca
> **Estado:** Diseño para discusión. NO implementado todavía.
> **Origen:** hallazgo 2026-05-24 — el negocio opera una segunda línea (perfumería/belleza/aseo) en uno de los puntos de venta que el sistema actual no modela. Ver [sesion-conciliacion-consuelo.md §Bloque 0](../sesion-conciliacion-consuelo.md#bloque-0--línea-perfumeríabelleza-segundo-negocio-no-modelado).

---

## TL;DR

El sistema actualmente asume **una sola línea de negocio: uniformes**, modelada como multi-tenant por colegio (`schools` table). Pero en realidad opera **al menos 2 líneas**:

1. **Uniformes** (core) — modelado, multi-tenant por colegio.
2. **Perfumería/belleza/aseo** (segunda línea) — NO modelado. Productos sueltos vendidos en uno de los puntos de venta, gestionados por Consuelo directamente.

Para que la contabilidad sea defendible ante DIAN y los reportes financieros reflejen la realidad, hay que **agregar un eje `business_line`** ortogonal al multi-tenant actual.

**Esfuerzo estimado:** ~3-5 días dev (migración + backend + frontend + tests).
**Decisión timing:** ¿pre o post deploy v3? Ver §"Timing y roadmap".

---

## El problema actual

```
sistema:                          realidad:
─────────                          ────────
schools (multi-tenant)            schools (multi-tenant)
  └── garment_types                 └── garment_types
        └── products                       └── products
              └── inventory                       └── inventory
              └── sales                           └── sales
                                  +
                                  beauty_line (no modelado)
                                    └── productos sueltos
                                          └── compras YANBAL/ESIKA/TEMU
                                          └── ventas QR Nequi sin contraparte
```

**Síntomas observables:**

- $5.05M en `bank_reconciliation` catalogados como `owner_drawing_candidate` (YANBAL/ESIKA/TEMU) que en realidad son **compras de inventario beauty**.
- $7.19M en `sale_qr` sin match en `sales` que probablemente son **ventas de la línea beauty**.
- $21.6M de discrepancia entre `balance_accounts.balance` y suma de `balance_entries` — una porción material es **flujo histórico neto de la línea beauty** que el sistema nunca registró.
- P&L de uniformes **inflado en gastos** (carga compras YANBAL) y **subestimado en ingresos** (no incluye ventas beauty).
- Inventario de la línea beauty: **no existe** en el sistema. Se gestiona "de memoria" o en Excel paralelo.

---

## Diseño propuesto

### Nuevo concepto: `business_line`

Un eje ortogonal al `school`, que clasifica el origen comercial de cualquier transacción del sistema.

**Líneas iniciales:**
- `uniformes` (default — todo el catálogo actual)
- `beauty` (perfumería/aseo/belleza — nuevo)

**Extensibilidad:** modelo permite agregar líneas futuras (`mochilas`, `útiles_escolares`, `eventos`, etc.) sin migración mayor.

### Modelo de datos

```python
# app/models/business_line.py (NUEVO)

class BusinessLine(Base):
    __tablename__ = "business_lines"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at, updated_at...
```

**Seed inicial:**
```python
BusinessLine(code="uniformes", name="Uniformes Escolares", sort_order=1)
BusinessLine(code="beauty", name="Perfumería y Belleza", sort_order=2)
```

### Tablas afectadas (FK `business_line_id`)

Las que llevan trazabilidad por línea:

| Tabla | Campo nuevo | Nullable | Default backfill |
|---|---|---|---|
| `products` | `business_line_id` | NOT NULL | `uniformes` (todo lo actual) |
| `garment_types` | `business_line_id` | NOT NULL | `uniformes` |
| `sales` | `business_line_id` | NOT NULL | `uniformes` (todo lo histórico) |
| `expenses` | `business_line_id` | NULLABLE | NULL (puede ser transversal) |
| `accounts_payable` | `business_line_id` | NULLABLE | NULL (Cristina, arriendos, etc. son transversales) |
| `accounts_receivable` | `business_line_id` | NULLABLE | NULL (CxC son por cliente, no por línea típicamente) |
| `balance_entries` | `business_line_id` | NULLABLE | NULL (las transferencias internas no son de una línea específica) |
| `inventory` | implícito vía `product.business_line_id` | — | — |

> **Nota crítica:** los `schools` NO llevan `business_line_id` porque un mismo colegio podría vender uniformes y, a futuro, otra cosa. La línea está en `garment_types`/`products`, no en el tenant.

### Catálogo separado para `beauty`

Los productos de la línea beauty **NO necesitan garment_type ni school**:

```python
# products tabla, schema actual:
class Product:
    school_id: UUID NOT NULL          # ← problema: beauty no aplica
    garment_type_id: UUID NOT NULL    # ← problema: beauty no aplica
    business_line_id: UUID NOT NULL   # ← nuevo
    ...
```

**Opción A (recomendada):** hacer `school_id` y `garment_type_id` **nullable** cuando `business_line.code != 'uniformes'`. Constraint:

```sql
CHECK (
    (business_line.code = 'uniformes' AND school_id IS NOT NULL AND garment_type_id IS NOT NULL)
    OR
    (business_line.code != 'uniformes' AND school_id IS NULL AND garment_type_id IS NULL)
);
```

**Opción B:** crear un school virtual "Productos Sueltos" y un garment_type virtual "Variado" para que beauty también encaje en el modelo actual. Más sucio pero requiere menos cambios.

**Opción C:** tabla separada `beauty_products` con su propio esquema (sin school/garment). Solución más limpia pero duplica lógica (inventario, ventas, COGS, costos).

Mi sugerencia: **A**. Es lo que el modelo de datos modernos haría (relaciones opcionales con check constraints).

### Frontend (Tauri + React)

Cambios mínimos viables:

1. **Selector de línea de negocio** en el header (junto al selector de colegio actual). Si línea = beauty, el selector de colegio se oculta.
2. **Nueva vista** `BeautyProductsTab` similar a `ProductsTab` pero sin school/garment_type.
3. **POS modal de venta:** agregar un toggle "Uniforme / Beauty" antes de cargar productos.
4. **Reportes `/cfo`:** filtros por business_line, KPIs separados por línea.
5. **`AccountingTab`:** los gastos/ingresos llevan badge de línea (o "Transversal").

### Reportes contables

| Reporte | Cambio |
|---|---|
| P&L | Columna por línea + total. `Revenue_uniformes`, `Revenue_beauty`, `COGS_uniformes`, `COGS_beauty`, etc. |
| Balance | Activos y pasivos por línea cuando aplique. Inventario separado. |
| Cash Flow | Mismo. |
| Margen bruto | Por línea (la línea beauty probablemente tiene margen distinto al de uniformes). |

---

## Migración alembic propuesta

```python
"""Add business_line support + backfill uniformes

Revision ID: bl_001_business_line
Revises: v3_design_cleanup_001
"""

def upgrade():
    # 1. Crear tabla business_lines
    op.create_table('business_lines', ...)

    # 2. Seed inicial (uniformes + beauty)
    op.execute("""
        INSERT INTO business_lines (id, code, name, sort_order, is_active)
        VALUES (gen_random_uuid(), 'uniformes', 'Uniformes Escolares', 1, true),
               (gen_random_uuid(), 'beauty', 'Perfumería y Belleza', 2, true)
    """)

    # 3. Agregar columna business_line_id a tablas afectadas
    for table in ['products', 'garment_types', 'sales', 'expenses', ...]:
        op.add_column(table, sa.Column('business_line_id', UUID, nullable=True))

    # 4. Backfill: todo lo existente → uniformes
    op.execute("""
        UPDATE products SET business_line_id =
            (SELECT id FROM business_lines WHERE code = 'uniformes')
    """)
    # ... idem para las demás tablas

    # 5. NOT NULL constraints en las tablas que aplica
    for table in ['products', 'garment_types', 'sales']:
        op.alter_column(table, 'business_line_id', nullable=False)

    # 6. FK constraints
    for table in [...]:
        op.create_foreign_key(...)

    # 7. Hacer school_id y garment_type_id nullable en products + check constraint
    op.alter_column('products', 'school_id', nullable=True)
    op.alter_column('products', 'garment_type_id', nullable=True)
    op.create_check_constraint(
        'ck_product_uniformes_required_tenant',
        'products',
        """(business_line_id IN (SELECT id FROM business_lines WHERE code = 'uniformes')
            AND school_id IS NOT NULL AND garment_type_id IS NOT NULL)
        OR
        (business_line_id NOT IN (SELECT id FROM business_lines WHERE code = 'uniformes'))"""
    )

def downgrade():
    # reverso, en orden inverso
    ...
```

**Estimación tiempo migración:** ~2 segundos sobre data de prod (las tablas son pequeñas).

---

## Estimación de esfuerzo

| Tarea | Tiempo |
|---|---|
| Migración alembic + tests | 0.5 día |
| Modelo SQLAlchemy + Pydantic schemas | 0.5 día |
| Service layer (CRUD business_lines, products beauty, sales beauty) | 1 día |
| Frontend selector + nueva vista BeautyProducts + ajustes POS | 1-1.5 días |
| Reportes con filtro por business_line | 1 día |
| Tests E2E + smoke | 0.5 día |
| **Total** | **4.5–5 días** |

---

## Timing y roadmap

3 opciones para decidir con el owner:

### Opción A: Bloquear deploy v3 hasta tener `business_line` listo

- **Cuándo:** ~1 semana adicional (deploy v3 se mueve a ~jun-02 en lugar de ~may-26)
- **Pros:**
  - Deploy a prod sale con el modelo "correcto" desde el día 1
  - Reconstrucción histórica del Bloque 3 (discrepancia $21.6M) puede separar bien beauty de uniformes
  - No hay que migrar dos veces
- **Contras:**
  - Atrasa todo el resto de mejoras de v3 (correcciones contables, costos, equipo, etc.)
  - Riesgo de scope creep (otros hallazgos pueden surgir)

### Opción B: Deploy v3 con uniformes solo → v3.1 con business_line

- **Cuándo:** v3 sale en ~may-26 (planeado). v3.1 con business_line ~2-3 semanas después.
- **Pros:**
  - Deploy v3 sale rápido con todas las mejoras contables/equipo/costos
  - Tiempo para iterar el diseño de business_line con feedback real de Consuelo
  - Bloque 3 (discrepancia $21.6M) se resuelve provisionalmente con `equity_capital` y se rehace bien en v3.1
- **Contras:**
  - 2-3 semanas de prod con la línea beauty aún sin trazabilidad
  - Migración v3.1 hace ajustes "encima" del estado de v3 (más complejo que migrar limpio)

### Opción C: Híbrida — deploy v3 + script de captura manual de beauty hasta v3.1

- **Cuándo:** igual que B (v3 ~may-26, v3.1 ~3 semanas después)
- **Pros:**
  - Consuelo puede empezar a registrar ventas beauty en un Excel template que **alimente automáticamente** las `balance_entries` con categoría `revenue_beauty` provisional
  - Cuando v3.1 implemente business_line, esos registros se migran a `sales` con `business_line=beauty` retroactivamente
- **Contras:**
  - Friction adicional para Consuelo durante ese período (Excel + sistema en paralelo)
  - Requiere ~1 día extra de dev para crear el template + script de import

---

## Decisiones pendientes (owner)

[ ] **Opción de timing:** A / B / C
[ ] **Opción de modelado interno:** A (school nullable) / B (school virtual) / C (tabla separada)
[ ] **Alcance inicial de la línea beauty:** ¿solo marcar revenue/expense, o también catálogo de productos con inventario y costos?
[ ] **Histórico:** ¿reconstruir el flujo beauty histórico (2026-01 → hoy) o solo arrancar el tracking desde el día de deploy?

---

## Referencias

- [sesion-conciliacion-consuelo.md §Bloque 0](../sesion-conciliacion-consuelo.md#bloque-0--línea-perfumeríabelleza-segundo-negocio-no-modelado) — origen del hallazgo
- [deploy-checklist.md](../formalization/deploy-checklist.md) — checklist v3 sin business_line
- [v3-release-scope.md](v3-release-scope.md) — alcance v3 actual
- [bank-track-summary-2026-05-17.md](../formalization/estabilizacion_contable/bank-track-summary-2026-05-17.md) — fuente de los $5M YANBAL/ESIKA + $7M sale_qr unmatched

---

## Próximo paso

Decisión owner sobre **timing (A/B/C)** y **modelado interno (A/B/C)**. Una vez decidido, este doc se vuelve la especificación implementable y se crea un branch `feature/business-line-model` (con autorización explícita del owner, dado la regla global de no crear branches).
