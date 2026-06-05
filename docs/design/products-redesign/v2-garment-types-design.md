# Design Director v2 — Motor de Productos: Fusión Tipos + Variantes

> **Sesión:** 2026-06-04  
> **Alcance:** Rediseño del tab "Tipos de Prenda" y su conexión con Productos.  
> **Decisión de arquitectura:** Fusionar Tipos de Prenda con "Productos por Colegio" en una única vista de árbol (Type → Variants), eliminando el tab separado.  
> **Complementa:** `PROPUESTA.md` (Catálogo Studio macro) — esta propuesta detalla la capa de gestión de tipos que la propuesta original no abordó.

---

## El veredicto

La separación actual en tabs refleja el **modelo de datos interno** (`garment_types` ≠ `products`), no el **modelo mental del usuario**. Para Consuelo, "Camisa Polo del Colegio Comfama Talla 10" es una sola cosa. En el sistema actual son cuatro: un tipo (`garment_type`), un producto (`product`), un inventario (`inventory`), y una galería (`garment_type_images`). Gestionarlos requiere 4 tabs y 3+ modales.

La fusión elimina ese delta mental. El usuario ve lo que existe: grupos de producto con sus variantes.

---

## Arquitectura propuesta: Vista Árbol Unificada

### Antes (tabs separados)

```
[Productos Colegio] [Productos Globales] [Tipos de Prenda] [Análisis Costos]
         ↓                                      ↓
    Tabla de filas-SKU                  Tabla plana de tipos
    (sin imágenes, sin tipo visible)    (sin filtros, sin variantes)
         ↕ (salto de tab para conectar)
```

### Después (árbol unificado)

```
[Catálogo Colegio] [Productos Globales] [Análisis Costos]
         ↓
    Árbol: Tipo de Prenda → Variantes (expandible inline)
    Filtros siempre visibles: [Buscar] [Categoría ▼] [Estado ▼] [Origen ▼]
```

---

## Estructura de la vista árbol

### Fila de Tipo (primer nivel)

```
[▶] [📷 img] Camisa Polo  [Diario]  [Se fabrica]  5 variantes  Stock: 48u  [$32K–$45K]  [+ Variante]  [⋮]
```

Campos visibles en la fila del tipo:
- **Chevron** expand/collapse (▶/▼)
- **Thumbnail** — imagen principal del tipo (o placeholder)
- **Nombre** del tipo
- **Badge categoría** — Diario / Deportivo / Accesorios / Sin categoría
- **Badge origen** — "Se fabrica" (amber) / "Se compra" (emerald)
- **Conteo variantes** — `N variantes`
- **Stock total** de todas las variantes
- **Rango de precio** — `$32K – $45K`
- **Botón [+ Variante]** — abre ProductModal con `garment_type_id` pre-seleccionado
- **Menú contextual [⋮]** — Editar tipo, Ver costos, Desactivar

### Sub-fila de Variante (segundo nivel, visible al expandir)

```
  ├─ UCR-CAM-001  Talla 8   Azul  $45.000   ▓▓▓▓░ 42%   12u  ✓ Web  [✏]  [≡]  [🗑]
  ├─ UCR-CAM-002  Talla 10  Azul  $45.000   ▓▓▓▓░ 42%   8u   ✓ Web  [✏]  [≡]  [🗑]
  ├─ UCR-CAM-003  Talla 12  Azul  $45.000   ▓▓▓▓░ 42%   2u   ⚠     [✏]  [≡]  [🗑]
  └─ [+ Agregar talla]
```

Campos en la sub-fila:
- **Código** del producto (monospace, clickable)
- **Talla** — text pequeño
- **Color** — texto + swatch de color (circle de 12px)
- **Precio** — tabular-nums
- **Margen** — barra de 5 segmentos + porcentaje (solo si `canViewCosts`)
- **Stock** — número + indicador visual (verde/amarillo/rojo)
- **Badge web** — `✓ Web` (si visible en portal) o `○` (si oculto)
- **Acciones hover** — Editar, Ajustar inventario, Ver historial, Eliminar

---

## Filtros del tab

Siempre visibles (no behind a toggle), en una barra horizontal sobre el árbol:

```
[🔍 Buscar tipo o variante...]  [Categoría ▼]  [Estado ▼]  [Origen ▼]  [Colegio ▼]
                                                                              [× Limpiar]
```

### Comportamiento de filtros

- **Búsqueda**: filtra en tiempo real (debounce 200ms) tanto sobre nombre del tipo como sobre código/nombre/talla de variantes. Si una variante hace match, el tipo padre se muestra auto-expandido.
- **Categoría**: Todos / Uniforme Diario / Uniforme Deportivo / Accesorios
- **Estado**: Todos / Activos / Inactivos
- **Origen**: Todos / Se fabrica / Se compra
- **Colegio**: dropdown (visible solo si `availableSchools.length > 1`)

### Indicador de filtro activo

Badge en el botón de filtros + chip de "Limpiar" visible cuando hay filtros activos. El árbol muestra cuántos tipos/variantes coincidieron: `"Mostrando 3 de 12 tipos"`.

---

## Nuevos datos requeridos del backend

Para que el árbol funcione, el endpoint de tipos necesita devolver datos de resumen. El endpoint actual devuelve solo campos del modelo `GarmentType`.

### Opción A: Extender el endpoint existente

```
GET /schools/{school_id}/garment-types?with_stats=true
→ Response incluye por cada tipo:
  {
    ...GarmentTypeResponse,
    product_count: int,
    total_stock: int,
    min_price: Decimal | null,
    max_price: Decimal | null,
    has_images: bool,
  }
```

Esto requiere una LEFT JOIN con `products` + `inventory` en el servicio. El costo de la query es mínimo (una subquery o CTE por tipo, no N+1).

### Opción B: Endpoint de stats separado

```
GET /schools/{school_id}/garment-types/stats
→ { [garment_type_id]: { product_count, total_stock, min_price, max_price, has_images } }
```

Y cargar los tipos base por separado. Más clean para cachear.

**Recomendación: Opción A** — una sola llamada, menos código frontend.

### Carga de variantes (lazy)

Cuando el usuario expande un tipo, hacer:
```
GET /products?school_id=<id>&garment_type_id=<type_id>&with_stock=true
```

Este endpoint ya existe. Se carga solo al primer expand (caché local en el componente). Un spinner en el chevron mientras carga.

---

## Eliminación del tab "Tipos de Prenda"

Con esta arquitectura:
- El tab `garment-types` desaparece del `ProductsTabs`
- El toggle School/Global de `GarmentTypesTab` desaparece
- El estado `showGlobalTypes` en `useProductsData` ya no es necesario
- Los tipos globales siguen gestionables desde su propio tab "Productos Globales" (que ya tiene el toggle)

**Cambio en la barra de tabs:**

```
Antes: [Colegio] [Global] [Tipos Prenda] [Análisis Costos]
Después: [Catálogo Colegio] [Productos Globales] [Análisis Costos]
```

El tab "Catálogo Colegio" carga la vista árbol con los tipos como primer nivel.

---

## Flujos de trabajo optimizados

### Flujo 1: Agregar una nueva talla a un tipo existente

**Antes (6 pasos):**
1. Tab "Tipos de Prenda" → encontrar el tipo (sin filtro)
2. Confirmar que es el tipo correcto (sin conteo de variantes visible)
3. Tab "Productos Colegio" → filtrar por tipo
4. Botón "Nuevo Producto"
5. Seleccionar tipo en dropdown
6. Completar formulario

**Después (3 pasos):**
1. Tab "Catálogo Colegio" → buscar tipo (con filtro)
2. Expandir tipo → ver variantes existentes
3. `[+ Variante]` en la fila del tipo → formulario con tipo pre-seleccionado

### Flujo 2: Editar características del tipo (bordado, medidas, fotos)

**Antes (4 pasos):**
1. Tab "Tipos de Prenda"
2. Encontrar el tipo (sin búsqueda)
3. Click "Editar" → modal
4. Guardar → volver a ubicar el tipo

**Después (2 pasos):**
1. Búsqueda en filtro → tipo aparece
2. Menú [⋮] → "Editar tipo" → modal (igual al actual)

### Flujo 3: Ver qué variantes tiene un tipo antes de editarlo

**Antes:** No hay forma directa. Tienes que ir a Productos y filtrar por tipo.

**Después:** Chevron ▶ → sub-filas visibles instantáneamente.

---

## Diseño del estado vacío (árbol sin tipos)

```
┌────────────────────────────────────────────────────┐
│                                                    │
│   [🏷️ icono tag grande]                            │
│                                                    │
│   Sin tipos de prenda configurados                 │
│                                                    │
│   Los tipos definen qué clase de prenda es cada    │
│   producto (Camisa, Pantalón, Zapatos, etc.) y     │
│   sus características de fabricación.              │
│                                                    │
│   [+ Crear primer tipo de prenda]                  │
│                                                    │
└────────────────────────────────────────────────────┘
```

---

## Diseño del estado vacío (tipo sin variantes, expandido)

```
├─ [▼] Camisa Polo  [Diario]  [Se fabrica]  0 variantes
│
│   ┌──────────────────────────────────────────────────┐
│   │ Este tipo no tiene variantes aún.                │
│   │ Agrega la primera talla/color para que aparezca  │
│   │ en el catálogo web.                              │
│   │                                                  │
│   │  [+ Agregar primera variante]                    │
│   └──────────────────────────────────────────────────┘
```

---

## Impacto en archivos existentes

### Archivos que cambian

| Archivo | Cambio |
|---------|--------|
| `ProductsTabs.tsx` | Eliminar tab `garment-types`, renombrar `school` → `catalog` o `school-catalog` |
| `Products.tsx` | Eliminar bloque `{data.activeTab === 'garment-types' && <GarmentTypesTab ...>}` |
| `useProductsData.ts` | Eliminar `showGlobalTypes`, `setShowGlobalTypes`, simplificar `handleTabChange` |
| `ProductsFilters.tsx` | El bloque `activeTab !== 'garment-types'` ya no existe — siempre visible en el tab activo |
| `types.ts` | Remover `'garment-types'` de `TabType` |

### Archivos nuevos

| Archivo | Descripción |
|---------|-------------|
| `SchoolCatalogTab.tsx` | Nueva vista árbol (reemplaza GarmentTypesTab) |
| `GarmentTypeRow.tsx` | Fila expandible del tipo con chevron, stats, acciones |
| `ProductVariantRow.tsx` | Sub-fila de variante con stock, margen, acciones |
| `CatalogFilters.tsx` | Barra de filtros específica del tab catálogo |
| `useGarmentTypeVariants.ts` | Hook de carga lazy de variantes por tipo |

### Archivos eliminados

| Archivo | Motivo |
|---------|--------|
| `GarmentTypesTab.tsx` | Reemplazado por `SchoolCatalogTab.tsx` |

---

## Roadmap de implementación

### Sprint 1 — Prerequisitos (no rompe nada) — ~1 día

1. **Fix P1 del code review** — `handleTabChange` resetea todos los filtros
2. **Fix P1 del code review** — badge de conteo correcto en tab "Tipos de Prenda"
3. **Extender el schema de respuesta** `GarmentTypeResponse` con `product_count`, `total_stock`, `min_price`, `max_price`, `has_images` (backend: LEFT JOIN, ~3h)
4. **Actualizar `productService.getAllGarmentTypes`** para soportar `with_stats=true`

### Sprint 2 — Componentes del árbol — ~3 días

5. **`GarmentTypeRow.tsx`** — fila de tipo con stats, chevron animado, acciones (no incluye sub-filas aún)
6. **`ProductVariantRow.tsx`** — sub-fila de variante (reusar estructura de `ProductsTable`)
7. **`useGarmentTypeVariants.ts`** — hook lazy: `loadVariantsForType(typeId)`, cache local
8. **`SchoolCatalogTab.tsx`** — arma el árbol con expand/collapse, integra ambos componentes

### Sprint 3 — Filtros + Fusión — ~2 días

9. **`CatalogFilters.tsx`** — barra de filtros con búsqueda, categoría, estado, origen
10. **Integrar filtros** en `SchoolCatalogTab` — comportamiento de expansión automática cuando hay match en variante
11. **Migrar tab** — renombrar `school` en `ProductsTabs`, eliminar `garment-types`
12. **Limpiar `useProductsData`** — remover `showGlobalTypes`, simplificar

### Sprint 4 — Polish — ~1 día

13. Empty states correctos (tipo sin variantes, catálogo vacío)
14. Estados de loading con skeleton (tipo row + variante row)
15. Animaciones de expand/collapse (`max-height` transition)
16. Pruebas de regresión con roles distintos (admin, vendedora, viewer)

**Estimado total: ~7 días de frontend + ~0.5 días backend**

---

## Notas de implementación

### Expand/collapse

Usar `useState<Set<string>>` de IDs expandidos en `SchoolCatalogTab`. Al expandir por primera vez → llamar `loadVariantsForType(typeId)` que guarda en un `Record<string, Product[]>`.

```typescript
const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set());
const [variantsByType, setVariantsByType] = useState<Record<string, Product[]>>({});
const [loadingVariants, setLoadingVariants] = useState<Set<string>>(new Set());

const handleToggleType = async (typeId: string) => {
  if (expandedTypes.has(typeId)) {
    setExpandedTypes(prev => { const s = new Set(prev); s.delete(typeId); return s; });
    return;
  }
  setExpandedTypes(prev => new Set([...prev, typeId]));
  if (!variantsByType[typeId]) {
    setLoadingVariants(prev => new Set([...prev, typeId]));
    try {
      const variants = await productService.getAllProducts({ garment_type_id: typeId, school_id: schoolFilter || undefined, with_stock: true });
      setVariantsByType(prev => ({ ...prev, [typeId]: variants.items }));
    } finally {
      setLoadingVariants(prev => { const s = new Set(prev); s.delete(typeId); return s; });
    }
  }
};
```

### Búsqueda que expande tipos automáticamente

Cuando `searchTerm` no está vacío y un tipo tiene variantes que coinciden con el término de búsqueda → el tipo se expande automáticamente y las filas que no coinciden se dimean (opacity 40%).

### Badge del tab unificado

```tsx
// Antes
{garmentTypesCount + globalGarmentTypesCount}

// Después — muestra "12 tipos · 87 variantes" o simplemente el conteo de tipos
{garmentTypesCount} tipos
```

---

*Propuesta generada: 2026-06-04 | Complementa: PROPUESTA.md (Catálogo Studio v1)*
