# Plan: Mejoras del Sistema de Uniformes

## Resumen General

Este plan cubre múltiples mejoras del sistema:
1. **Catálogo Web** - Agrupar productos por tipo de prenda + optimización móvil (COMPLETADO)
2. **Ordenamiento de Colegios** - Orden personalizado en portal web (COMPLETADO)
3. **Fix Error 422** - Endpoint de reportes financieros (COMPLETADO)
4. **Mejora Manejo de Errores UI** - Productos y Colegios (COMPLETADO)
5. **Mejora Flujo de Ventas** - Selección múltiple + Yomber agrupado (COMPLETADO)
6. **Dashboard + Encargos + Pagos Múltiples** - Mejoras del dashboard, flujo encargos, pagos parciales en ventas (NUEVO - Parte 8)

---

# Parte 6: Mejora del Manejo de Errores en UI (Productos y Colegios)

## Problema Identificado

Los componentes de creación/edición de productos y colegios en la app Tauri tienen problemas de manejo de errores que causan que la app colapse o no muestre mensajes claros.

### Prioridades (según usuario):
1. **Crear productos** - Errores frecuentes
2. **Editar productos** - Errores frecuentes
3. **Crear colegios** - Errores frecuentes

### Enfoque: **Mensajes inline mejorados** (sin Toast global)

---

## Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| `frontend/src/utils/api-client.js` | Agregar `extractErrorMessage()` centralizada |
| `frontend/src/components/ProductModal.js` | Validaciones + manejo de errores mejorado |
| `frontend/src/components/GlobalProductModal.js` | Validaciones + manejo de errores mejorado |
| `frontend/src/pages/Products.js` | Validar schoolId + confirmación delete |
| `frontend/src/pages/Admin.js` | Validaciones colegios + mensajes claros |

---

## Implementación Detallada

### 6.1 Mejorar api-client.js

Agregar función helper para extraer mensajes de error legibles:

```javascript
// Agregar al final del archivo
export function extractErrorMessage(err) {
  // Errores de validación Pydantic (array)
  if (err?.response?.data?.detail && Array.isArray(err.response.data.detail)) {
    return err.response.data.detail
      .map(e => {
        const field = e.loc?.[e.loc.length - 1] || 'Campo';
        return `${field}: ${e.msg}`;
      })
      .join('\n');
  }

  // Error string del backend
  if (typeof err?.response?.data?.detail === 'string') {
    return err.response.data.detail;
  }

  // Errores HTTP conocidos
  const status = err?.response?.status;
  const httpErrors = {
    400: 'Datos inválidos. Revisa los campos.',
    401: 'Sesión expirada. Inicia sesión nuevamente.',
    403: 'No tienes permisos para esta acción.',
    404: 'El recurso no fue encontrado.',
    409: 'Ya existe un registro con estos datos.',
    422: 'Error de validación. Revisa los campos.',
    500: 'Error del servidor. Intenta de nuevo.',
  };
  if (status && httpErrors[status]) {
    return httpErrors[status];
  }

  // Error de red
  if (err?.message?.includes('fetch') || err?.message?.includes('network')) {
    return 'Error de conexión. Verifica tu internet.';
  }

  return err?.message || 'Error desconocido. Intenta de nuevo.';
}
```

### 6.2 Mejorar ProductModal.js

```javascript
// Importar
import { extractErrorMessage } from '../utils/api-client';

// En handleSubmit, agregar validaciones al inicio:
const handleSubmit = async (e) => {
  e.preventDefault();
  setError(null);

  // === VALIDACIONES FRONTEND ===
  if (!schoolId) {
    setError('⚠️ Debes seleccionar un colegio primero');
    return;
  }
  if (!formData.garment_type_id) {
    setError('⚠️ Selecciona un tipo de prenda');
    return;
  }
  if (!formData.name?.trim()) {
    setError('⚠️ El nombre del producto es requerido');
    return;
  }
  if (!formData.size?.trim()) {
    setError('⚠️ La talla es requerida');
    return;
  }
  const price = parseFloat(formData.price);
  if (isNaN(price) || price <= 0) {
    setError('⚠️ El precio debe ser un número mayor a 0');
    return;
  }

  setLoading(true);
  try {
    const data = { ...formData, price };
    if (product) {
      await productService.updateProduct(schoolId, product.id, data);
    } else {
      await productService.createProduct(schoolId, data);
    }
    onSuccess();
    onClose();
  } catch (err) {
    console.error('Error saving product:', err);
    setError(extractErrorMessage(err));
  } finally {
    setLoading(false);
  }
};

// Mejorar el componente de error visual:
{error && (
  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
    <p className="text-red-700 text-sm whitespace-pre-line">{error}</p>
  </div>
)}
```

### 6.3 Mejorar GlobalProductModal.js

Mismo patrón que ProductModal:
- Validaciones frontend antes del API call
- Usar `extractErrorMessage()` en catch
- Mejorar visualización del error

### 6.4 Mejorar Products.js

```javascript
// Agregar estado para confirmación de delete
const [deleteConfirm, setDeleteConfirm] = useState({ open: false, product: null, schoolId: null });

// Función para iniciar delete
const handleDeleteClick = (product, schoolId) => {
  if (!schoolId) {
    setError('⚠️ No se puede eliminar: colegio no identificado');
    return;
  }
  setDeleteConfirm({ open: true, product, schoolId });
};

// Función para confirmar delete
const handleDeleteConfirm = async () => {
  const { product, schoolId } = deleteConfirm;
  try {
    await productService.deleteProduct(schoolId, product.id);
    await loadProducts();
    setDeleteConfirm({ open: false, product: null, schoolId: null });
  } catch (err) {
    setError(extractErrorMessage(err));
    setDeleteConfirm({ open: false, product: null, schoolId: null });
  }
};

// Modal de confirmación (agregar al JSX):
{deleteConfirm.open && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
    <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
      <h3 className="text-lg font-bold text-gray-900 mb-2">¿Eliminar producto?</h3>
      <p className="text-gray-600 mb-4">
        Se eliminará <strong>{deleteConfirm.product?.name}</strong>
        (Talla {deleteConfirm.product?.size}). Esta acción no se puede deshacer.
      </p>
      <div className="flex gap-3 justify-end">
        <button
          onClick={() => setDeleteConfirm({ open: false, product: null, schoolId: null })}
          className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
        >
          Cancelar
        </button>
        <button
          onClick={handleDeleteConfirm}
          className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg"
        >
          Eliminar
        </button>
      </div>
    </div>
  </div>
)}
```

### 6.5 Mejorar Admin.js (Colegios)

```javascript
// Agregar función de validación
const validateSchoolForm = () => {
  if (!schoolForm.code?.trim()) {
    return '⚠️ El código del colegio es requerido';
  }
  if (schoolForm.code.length < 2) {
    return '⚠️ El código debe tener al menos 2 caracteres';
  }
  if (!schoolForm.name?.trim()) {
    return '⚠️ El nombre del colegio es requerido';
  }
  if (schoolForm.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(schoolForm.email)) {
    return '⚠️ El email no tiene un formato válido';
  }
  if (schoolForm.phone && !/^[\d\s\-\+\(\)]{7,}$/.test(schoolForm.phone)) {
    return '⚠️ El teléfono no tiene un formato válido';
  }
  return null;
};

// En handleSaveSchool:
const handleSaveSchool = async () => {
  setError(null);

  const validationError = validateSchoolForm();
  if (validationError) {
    setError(validationError);
    return;
  }

  setSubmitting(true);
  try {
    if (editingSchool) {
      await schoolService.updateSchool(editingSchool.id, schoolForm);
    } else {
      await schoolService.createSchool(schoolForm);
    }
    await loadSchools();
    setShowSchoolModal(false);
    resetSchoolForm();
  } catch (err) {
    console.error('Error saving school:', err);
    setError(extractErrorMessage(err));
  } finally {
    setSubmitting(false);
  }
};
```

---

## Orden de Implementación

1. **api-client.js** - Agregar `extractErrorMessage()` (base para todo)
2. **ProductModal.js** - Validaciones y manejo de errores
3. **GlobalProductModal.js** - Mismo patrón
4. **Products.js** - Confirmación delete + validaciones schoolId
5. **Admin.js** - Validaciones colegios

---

## Testing

Probar estos escenarios:

| Escenario | Resultado Esperado |
|-----------|-------------------|
| Crear producto sin colegio | Error inline: "Debes seleccionar un colegio" |
| Crear producto sin nombre | Error inline: "El nombre es requerido" |
| Crear producto con precio 0 | Error inline: "El precio debe ser mayor a 0" |
| Eliminar producto | Modal de confirmación antes de eliminar |
| Crear colegio sin código | Error inline: "El código es requerido" |
| Crear colegio con email inválido | Error inline: "El email no tiene formato válido" |
| Error de red (desconectar) | Error inline: "Error de conexión" |
| Error 409 (duplicado) | Error inline: "Ya existe un registro con estos datos" |

---

## Verificación

- [ ] La app NO colapsa con ningún error
- [ ] Todos los errores muestran mensaje claro en español
- [ ] Las validaciones ocurren ANTES de enviar al servidor
- [ ] El botón de eliminar producto pide confirmación
- [ ] Los estados de loading funcionan correctamente

---

# Partes Anteriores (Completadas)

## Parte 1: Agrupar Productos por Tipo de Prenda (COMPLETADO)

---

## Parte 1: Agrupar Productos por Tipo de Prenda

### Concepto

Actualmente: Se muestran múltiples tarjetas para el mismo producto (una por talla)
- "Camiseta Escolar - Talla 2" → tarjeta
- "Camiseta Escolar - Talla 4" → tarjeta
- "Camiseta Escolar - Talla 6" → tarjeta

**Nuevo diseño**: Una sola tarjeta "Camiseta Escolar" con selector de tallas integrado

### Implementación

#### 1.1 Crear tipo `ProductGroup`

**Archivo:** `web-portal/lib/types.ts` (nuevo)

```typescript
interface ProductVariant {
  id: string;
  size: string;
  price: number;
  stock: number;
  isOrder: boolean; // sin stock = encargo
}

interface ProductGroup {
  garmentTypeId: string;
  name: string;              // "Camiseta Escolar"
  basePrice: number;         // precio mínimo del grupo
  maxPrice: number;          // precio máximo (para mostrar rango si difieren)
  images: GarmentTypeImage[];
  primaryImageUrl: string | null;
  variants: ProductVariant[];
  school: School;
  isYomber: boolean;
}
```

#### 1.2 Función para agrupar productos

**Archivo:** `web-portal/lib/utils.ts`

```typescript
function groupProductsByGarmentType(products: Product[], school: School): ProductGroup[] {
  const groups = new Map<string, ProductGroup>();

  products.forEach(product => {
    const key = product.garment_type_id;

    if (!groups.has(key)) {
      groups.set(key, {
        garmentTypeId: key,
        name: getBaseName(product.name), // "Camiseta Escolar" sin "Talla X"
        basePrice: product.price,
        maxPrice: product.price,
        images: product.garment_type_images || [],
        primaryImageUrl: product.garment_type_primary_image_url,
        variants: [],
        school,
        isYomber: product.name.toLowerCase().includes('yomber')
      });
    }

    const group = groups.get(key)!;
    group.variants.push({
      id: product.id,
      size: product.size,
      price: product.price,
      stock: product.stock ?? product.inventory_quantity ?? 0,
      isOrder: (product.stock ?? product.inventory_quantity ?? 0) === 0
    });

    // Actualizar rango de precios
    group.basePrice = Math.min(group.basePrice, product.price);
    group.maxPrice = Math.max(group.maxPrice, product.price);
  });

  // Ordenar variantes por talla
  groups.forEach(group => {
    group.variants.sort((a, b) => compareSizes(a.size, b.size));
  });

  return Array.from(groups.values());
}

// Ordenar tallas: 2, 4, 6, 8... XS, S, M, L, XL...
function compareSizes(a: string, b: string): number {
  const numA = parseInt(a);
  const numB = parseInt(b);
  if (!isNaN(numA) && !isNaN(numB)) return numA - numB;

  const order = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL'];
  return order.indexOf(a.toUpperCase()) - order.indexOf(b.toUpperCase());
}

// Extraer nombre base sin talla
function getBaseName(name: string): string {
  return name
    .replace(/\s*-?\s*(talla\s*)?\d+\s*$/i, '')  // "Camiseta Talla 4" → "Camiseta"
    .replace(/\s*-?\s*T\d+(-T\d+)?\s*$/i, '')    // "Zapatos T27-T34" → "Zapatos"
    .trim();
}
```

#### 1.3 Nuevo componente `ProductGroupCard`

**Archivo:** `web-portal/components/ProductGroupCard.tsx` (nuevo)

```tsx
interface ProductGroupCardProps {
  group: ProductGroup;
  onAddToCart: (productId: string, isOrder: boolean) => void;
  onOpenDetail: () => void;
}

export default function ProductGroupCard({ group, onAddToCart, onOpenDetail }: ProductGroupCardProps) {
  const [selectedSize, setSelectedSize] = useState<string | null>(null);

  const selectedVariant = group.variants.find(v => v.size === selectedSize);
  const hasStock = selectedVariant ? selectedVariant.stock > 0 : group.variants.some(v => v.stock > 0);

  return (
    <div className="bg-white rounded-xl border overflow-hidden hover:shadow-lg transition-all">
      {/* Imagen con next/image */}
      <div onClick={onOpenDetail} className="cursor-pointer">
        <ProductImageOptimized
          images={group.images}
          primaryImageUrl={group.primaryImageUrl}
          productName={group.name}
        />
      </div>

      <div className="p-4">
        <h3 className="font-semibold text-primary font-display mb-2">{group.name}</h3>

        {/* Selector de Tallas */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {group.variants.map(variant => (
            <button
              key={variant.id}
              onClick={() => setSelectedSize(variant.size)}
              className={`px-2.5 py-1 text-xs rounded-md border transition-all ${
                selectedSize === variant.size
                  ? 'bg-brand-600 text-white border-brand-600'
                  : variant.stock > 0
                    ? 'bg-white text-gray-700 border-gray-200 hover:border-brand-400'
                    : 'bg-orange-50 text-orange-600 border-orange-200 hover:border-orange-400'
              }`}
            >
              {variant.size}
              {variant.stock === 0 && !selectedSize && (
                <span className="ml-1 text-[10px]">📦</span>
              )}
            </button>
          ))}
        </div>

        {/* Info de stock cuando hay talla seleccionada */}
        {selectedVariant && (
          <p className={`text-xs mb-2 ${selectedVariant.stock > 0 ? 'text-green-600' : 'text-orange-500'}`}>
            {selectedVariant.stock > 0
              ? `✓ Disponible (${selectedVariant.stock} unid.)`
              : '📦 Disponible por encargo'}
          </p>
        )}

        {/* Precio */}
        <div className="flex items-center justify-between">
          <span className="text-xl font-bold text-brand-600">
            ${formatNumber(selectedVariant?.price ?? group.basePrice)}
            {!selectedVariant && group.basePrice !== group.maxPrice && (
              <span className="text-sm text-gray-400 ml-1">
                - ${formatNumber(group.maxPrice)}
              </span>
            )}
          </span>

          {/* Botón de agregar */}
          <button
            onClick={() => {
              if (!selectedVariant) {
                // Si no hay talla seleccionada, seleccionar primera disponible
                const first = group.variants.find(v => v.stock > 0) || group.variants[0];
                setSelectedSize(first.size);
                return;
              }
              onAddToCart(selectedVariant.id, selectedVariant.isOrder);
            }}
            disabled={group.isYomber}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              group.isYomber
                ? 'bg-purple-600 text-white'
                : !selectedSize
                  ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  : selectedVariant?.stock > 0
                    ? 'bg-brand-600 text-white hover:bg-brand-700'
                    : 'bg-orange-500 text-white hover:bg-orange-600'
            }`}
          >
            {group.isYomber
              ? 'Consultar'
              : !selectedSize
                ? 'Seleccionar talla'
                : selectedVariant?.stock > 0
                  ? 'Agregar'
                  : 'Encargar'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

#### 1.4 Modificar página del catálogo

**Archivo:** `web-portal/app/[school_slug]/page.tsx`

Cambios:
1. Importar `groupProductsByGarmentType` y `ProductGroupCard`
2. Crear estado para grupos: `const [productGroups, setProductGroups] = useState<ProductGroup[]>([]);`
3. En `loadAllProducts`, después de cargar productos:
   ```typescript
   const groups = groupProductsByGarmentType([...schoolProducts, ...globalProducts], schoolData);
   setProductGroups(groups);
   ```
4. Reemplazar el grid de productos individuales por grupos:
   ```tsx
   <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
     {productGroups.map(group => (
       <ProductGroupCard
         key={group.garmentTypeId}
         group={group}
         onAddToCart={handleAddToCartById}
         onOpenDetail={() => handleGroupClick(group)}
       />
     ))}
   </div>
   ```

#### 1.5 Modal de detalle con selector de tallas

**Archivo:** `web-portal/components/ProductDetailModal.tsx`

Modificar para recibir `ProductGroup` en lugar de `Product`:
- Mostrar galería de imágenes (ya existe)
- Agregar selector de tallas más grande
- Mostrar stock por talla seleccionada
- Botón de agregar con talla pre-seleccionada

---

## Parte 2: Optimización de Imágenes para Móvil

### 2.1 Reemplazar `<img>` por `next/image`

**Archivo:** `web-portal/components/ProductImageOptimized.tsx` (nuevo)

```tsx
import Image from 'next/image';

interface Props {
  images?: GarmentTypeImage[];
  primaryImageUrl?: string | null;
  productName: string;
  priority?: boolean; // para above-the-fold
}

export default function ProductImageOptimized({ images, primaryImageUrl, productName, priority = false }: Props) {
  const imageUrl = images?.[0]?.image_url || primaryImageUrl;

  if (!imageUrl) {
    return (
      <div className="aspect-square bg-gradient-to-br from-brand-50 to-surface-100 flex items-center justify-center">
        <span className="text-5xl">{getProductEmoji(productName)}</span>
      </div>
    );
  }

  const fullUrl = imageUrl.startsWith('http')
    ? imageUrl
    : `${API_BASE_URL}${imageUrl}`;

  return (
    <div className="aspect-square relative bg-surface-100">
      <Image
        src={fullUrl}
        alt={productName}
        fill
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
        className="object-cover"
        loading={priority ? 'eager' : 'lazy'}
        priority={priority}
        placeholder="blur"
        blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDABQODxIPDRQSEBIXFRQYHjIhHhwcHj0sLiQySUBMS0dARkVQWnNiUFVtVkVGZIhlbXd7gYKBTmCNl4x9lnN+gXz/2wBDARUXFx4aHjshITt8U0ZTfHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHz/wAARCAAIAAoDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAAAAUG/8QAHxAAAgICAgMBAAAAAAAAAAAAAQIDBAAFERITITFB/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBEQCEAwA/AMvLqddbsVmlaIIiqFVXkPJOT/cYxgf/2Q=="
      />
    </div>
  );
}
```

### 2.2 Configurar dominios de imágenes en Next.js

**Archivo:** `web-portal/next.config.js`

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'api.yourdomain.com',
        pathname: '/uploads/**',
      },
    ],
    // Optimización automática
    deviceSizes: [320, 420, 640, 768, 1024, 1280],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
  },
}

module.exports = nextConfig
```

### 2.3 Lazy loading para productos fuera de viewport

Next.js Image con `loading="lazy"` (por defecto) maneja esto automáticamente.

Para el grid de productos, usar Intersection Observer para cargar grupos en lotes:

**Archivo:** `web-portal/hooks/useInfiniteProducts.ts` (opcional, si hay muchos productos)

```typescript
// Cargar productos en lotes de 12 a medida que el usuario hace scroll
export function useInfiniteProducts(allGroups: ProductGroup[]) {
  const [visibleCount, setVisibleCount] = useState(12);
  const loaderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        setVisibleCount(prev => Math.min(prev + 12, allGroups.length));
      }
    });

    if (loaderRef.current) observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [allGroups.length]);

  return {
    visibleGroups: allGroups.slice(0, visibleCount),
    loaderRef,
    hasMore: visibleCount < allGroups.length
  };
}
```

### 2.4 Mejoras CSS para móvil

**Archivo:** `web-portal/app/globals.css`

```css
/* Optimizar scroll en móviles */
@media (max-width: 640px) {
  .product-grid {
    scroll-snap-type: y proximity;
  }

  .product-card {
    scroll-snap-align: start;
  }
}

/* Prevenir layout shift */
.aspect-square {
  aspect-ratio: 1;
  contain: layout;
}
```

---

## Archivos a Crear/Modificar

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `web-portal/lib/types.ts` | Crear | Tipos ProductGroup, ProductVariant |
| `web-portal/lib/utils.ts` | Modificar | Agregar groupProductsByGarmentType, compareSizes |
| `web-portal/components/ProductGroupCard.tsx` | Crear | Tarjeta con selector de tallas |
| `web-portal/components/ProductImageOptimized.tsx` | Crear | Imagen con next/image |
| `web-portal/app/[school_slug]/page.tsx` | Modificar | Usar grupos en vez de productos individuales |
| `web-portal/components/ProductDetailModal.tsx` | Modificar | Soportar ProductGroup con selector de tallas |
| `web-portal/next.config.js` | Modificar | Configurar dominios de imágenes |
| `web-portal/app/globals.css` | Modificar | Optimizaciones móvil |

---

## Orden de Implementación

### Fase 1: Optimización de Imágenes (rápido, impacto inmediato)
1. Configurar `next.config.js` con dominios de imágenes
2. Crear `ProductImageOptimized.tsx` con next/image
3. Reemplazar imágenes en `ProductImageGallery.tsx`
4. Probar en móvil

### Fase 2: Agrupación de Productos
1. Crear tipos en `lib/types.ts`
2. Implementar `groupProductsByGarmentType` en `lib/utils.ts`
3. Crear `ProductGroupCard.tsx`
4. Modificar `page.tsx` para usar grupos
5. Actualizar `ProductDetailModal.tsx`

### Fase 3: Deploy y Verificación
1. Build local: `npm run build`
2. Probar en móvil con throttling de red
3. Deploy al servidor
4. Verificar en dispositivos reales

---

---

## Parte 3: Ordenamiento de Colegios en el Portal

### Objetivo

Mostrar los colegios en el selector/landing en un orden específico:
1. Caracas
2. Pumarejo
3. Pinal
4. CONFAMA

Con opción de configurar el orden desde el admin (Tauri app).

### Implementación

#### 3.1 Backend: Agregar campo `display_order` a Schools

**Archivo:** `backend/app/models/tenant.py`

```python
class School(Base):
    # ... campos existentes ...
    display_order: Mapped[int] = mapped_column(Integer, default=100, nullable=False)
```

**Migración Alembic:**
```sql
ALTER TABLE schools ADD COLUMN display_order INTEGER DEFAULT 100 NOT NULL;

-- Establecer orden inicial
UPDATE schools SET display_order = 1 WHERE slug = 'caracas' OR name ILIKE '%caracas%';
UPDATE schools SET display_order = 2 WHERE slug = 'pumarejo' OR name ILIKE '%pumarejo%';
UPDATE schools SET display_order = 3 WHERE slug = 'pinal' OR name ILIKE '%pinal%';
UPDATE schools SET display_order = 4 WHERE slug = 'confama' OR name ILIKE '%confama%';
```

#### 3.2 Backend: Endpoint para actualizar orden

**Archivo:** `backend/app/api/routes/schools.py`

```python
@router.put("/schools/reorder", dependencies=[Depends(require_superuser)])
async def reorder_schools(
    order: list[dict],  # [{"id": "uuid", "display_order": 1}, ...]
    db: DatabaseSession
):
    """Reordenar colegios (superuser only)"""
    for item in order:
        school = await db.get(School, item["id"])
        if school:
            school.display_order = item["display_order"]
    await db.commit()
    return {"status": "ok"}
```

#### 3.3 Backend: Ordenar colegios en listado

**Archivo:** `backend/app/api/routes/schools.py`

Modificar endpoint de listar colegios:
```python
@router.get("/schools")
async def list_schools(db: DatabaseSession):
    result = await db.execute(
        select(School)
        .where(School.is_active == True)
        .order_by(School.display_order, School.name)  # ← Agregar orden
    )
    return result.scalars().all()
```

#### 3.4 Frontend Admin: UI para reordenar colegios

**Archivo:** `frontend/src/pages/Settings.tsx` o nuevo `frontend/src/pages/SchoolsAdmin.tsx`

Agregar sección "Orden de Colegios" con:
- Lista draggable de colegios
- Botón guardar que llama a `/schools/reorder`

```tsx
// Componente simple con drag-and-drop
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';

function SchoolsOrderSection() {
  const [schools, setSchools] = useState<School[]>([]);

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const items = Array.from(schools);
    const [reordered] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reordered);

    // Actualizar orden
    const newOrder = items.map((s, idx) => ({ id: s.id, display_order: idx + 1 }));
    schoolService.reorder(newOrder);
    setSchools(items);
  };

  return (
    <div className="bg-white rounded-lg p-6 shadow">
      <h3 className="text-lg font-semibold mb-4">Orden de Colegios en Portal Web</h3>
      <p className="text-sm text-gray-500 mb-4">
        Arrastra para reordenar. El primer colegio aparecerá primero en el selector.
      </p>
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="schools">
          {(provided) => (
            <ul {...provided.droppableProps} ref={provided.innerRef}>
              {schools.map((school, index) => (
                <Draggable key={school.id} draggableId={school.id} index={index}>
                  {(provided) => (
                    <li
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                      className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg mb-2"
                    >
                      <GripVertical className="w-5 h-5 text-gray-400" />
                      <span className="font-medium">{index + 1}.</span>
                      <span>{school.name}</span>
                    </li>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </ul>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  );
}
```

#### 3.5 Web Portal: Usar orden del backend

**Archivo:** `web-portal/app/page.tsx` (landing con selector de colegios)

El frontend ya debería recibir los colegios ordenados desde el backend.
Solo verificar que se respete el orden:

```typescript
// Los colegios ya vienen ordenados del API
const schools = await schoolsApi.list(); // Ya ordenados por display_order
```

### Archivos adicionales a modificar

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `backend/app/models/tenant.py` | Modificar | Agregar campo display_order |
| `backend/alembic/versions/xxx_add_school_order.py` | Crear | Migración |
| `backend/app/api/routes/schools.py` | Modificar | Ordenar listado, agregar endpoint reorder |
| `frontend/src/pages/Settings.tsx` | Modificar | Agregar sección de orden de colegios |
| `frontend/src/services/schoolService.ts` | Modificar | Agregar método reorder |

---

## Orden de Implementación Actualizado

### Fase 1: Optimización de Imágenes (rápido, impacto inmediato)
1. Configurar `next.config.js` con dominios de imágenes
2. Crear `ProductImageOptimized.tsx` con next/image
3. Reemplazar imágenes en componentes
4. Probar en móvil

### Fase 2: Ordenamiento de Colegios
1. Agregar campo `display_order` a modelo School
2. Crear migración y ejecutar en servidor
3. Modificar endpoint de listado para ordenar
4. Agregar endpoint `/schools/reorder`
5. Crear UI en admin para reordenar
6. Establecer orden inicial: Caracas → Pumarejo → Pinal → CONFAMA

### Fase 3: Agrupación de Productos
1. Crear tipos en `lib/types.ts`
2. Implementar `groupProductsByGarmentType`
3. Crear `ProductGroupCard.tsx`
4. Modificar `page.tsx` para usar grupos
5. Actualizar `ProductDetailModal.tsx`

### Fase 4: Deploy y Verificación
1. Build local y tests
2. Deploy al servidor
3. Verificar en dispositivos móviles

---

## Verificación Post-Implementación (Fases 1-3)

1. **Móvil**: Abrir catálogo en celular, verificar que imágenes cargan rápido
2. **Grupos**: Verificar que productos se agrupan correctamente por tipo
3. **Tallas**: Seleccionar talla, verificar que muestra stock correcto
4. **Carrito**: Agregar producto con talla, verificar que llega correctamente
5. **Yomber**: Verificar que productos Yomber muestran "Consultar"
6. **Orden colegios**: Verificar que el selector muestra Caracas → Pumarejo → Pinal → CONFAMA
7. **Admin**: Verificar que se puede reordenar colegios desde Settings

---

## Parte 4: Reestructuración de Datos - Separar Productos por Color

### Problema Actual

El agrupamiento por `garment_type_id` mezcla productos de diferentes colores que deberían mostrarse separados:

1. **Caracas Chompa**: 22 productos (11 Azul + 11 Gris) comparten el MISMO `garment_type_id`
2. **CONFAMA**: Camiseta, Chompa, Sudadera tienen 4 colores (Amarillo, Azul, Fuxia, Morado) mezclados
3. **Tennis Nike**: Blanco y Negro comparten el MISMO `global_garment_type_id`

### Solución: Separar por Color a Nivel de `garment_type`

Cada combinación tipo+color debe tener su PROPIO `garment_type_id`:
- "Chompa Azul" → garment_type separado
- "Chompa Gris" → garment_type separado

### 4.1 Reestructuración de Caracas

**Estado actual:**
- 1 garment_type "Chompa" (id: cd358cf9-5c3b-4723-ba52-25d717b282aa)
- 22 productos: 11 Azul + 11 Gris

**Estado deseado:**
- garment_type "Chompa Azul" (NUEVO)
- garment_type "Chompa Gris" (NUEVO)
- Productos reasignados a su respectivo garment_type

**SQL para ejecutar:**
```sql
-- 1. Crear nuevos garment_types para Caracas
INSERT INTO garment_types (id, school_id, name, description, is_active, created_at, updated_at)
SELECT gen_random_uuid(), school_id, 'Chompa Azul', 'Chompa escolar color azul', true, NOW(), NOW()
FROM garment_types WHERE id = 'cd358cf9-5c3b-4723-ba52-25d717b282aa';

INSERT INTO garment_types (id, school_id, name, description, is_active, created_at, updated_at)
SELECT gen_random_uuid(), school_id, 'Chompa Gris', 'Chompa escolar color gris', true, NOW(), NOW()
FROM garment_types WHERE id = 'cd358cf9-5c3b-4723-ba52-25d717b282aa';

-- 2. Reasignar productos a los nuevos garment_types
UPDATE products p
SET garment_type_id = (SELECT id FROM garment_types WHERE name = 'Chompa Azul' AND school_id = p.school_id)
WHERE garment_type_id = 'cd358cf9-5c3b-4723-ba52-25d717b282aa' AND color = 'Azul';

UPDATE products p
SET garment_type_id = (SELECT id FROM garment_types WHERE name = 'Chompa Gris' AND school_id = p.school_id)
WHERE garment_type_id = 'cd358cf9-5c3b-4723-ba52-25d717b282aa' AND color = 'Gris';

-- 3. Eliminar garment_type original "Chompa" (ahora vacío)
DELETE FROM garment_types WHERE id = 'cd358cf9-5c3b-4723-ba52-25d717b282aa';
```

### 4.2 Reestructuración de CONFAMA

**Estado actual:**
- Camiseta: 12 productos (3 tallas × 4 colores)
- Chompa: 12 productos (3 tallas × 4 colores)
- Sudadera: 12 productos (3 tallas × 4 colores)

**Estado deseado:**
- Camiseta Amarilla, Camiseta Azul, Camiseta Fuxia, Camiseta Morada
- Chompa Amarilla, Chompa Azul, Chompa Fuxia, Chompa Morada
- Sudadera Amarilla, Sudadera Azul, Sudadera Fuxia, Sudadera Morada

**SQL:**
```sql
-- Crear garment_types para cada color de CONFAMA
DO $$
DECLARE
    confama_id UUID := '45a33bc8-a732-4208-b99f-91f100077114';
    colors TEXT[] := ARRAY['Amarillo', 'Azul', 'Fuxia', 'Morado'];
    prendas TEXT[] := ARRAY['Camiseta', 'Chompa', 'Sudadera'];
    color_name TEXT;
    prenda_name TEXT;
    old_gt_id UUID;
    new_gt_id UUID;
BEGIN
    FOREACH prenda_name IN ARRAY prendas LOOP
        -- Obtener ID del garment_type original
        SELECT id INTO old_gt_id FROM garment_types
        WHERE school_id = confama_id AND name = prenda_name;

        FOREACH color_name IN ARRAY colors LOOP
            -- Crear nuevo garment_type
            new_gt_id := gen_random_uuid();
            INSERT INTO garment_types (id, school_id, name, description, is_active, created_at, updated_at)
            VALUES (new_gt_id, confama_id, prenda_name || ' ' || color_name,
                    prenda_name || ' escolar color ' || color_name, true, NOW(), NOW());

            -- Reasignar productos
            UPDATE products
            SET garment_type_id = new_gt_id
            WHERE garment_type_id = old_gt_id AND color = color_name;
        END LOOP;

        -- Eliminar garment_type original
        DELETE FROM garment_types WHERE id = old_gt_id;
    END LOOP;
END $$;
```

### 4.3 Reestructuración de Productos Globales

#### 4.3.1 Tennis Nike (Separar por color)

**Estado actual:**
- 1 global_garment_type "Tennis Nike"
- 6 productos: 3 Blanco + 3 Negro (T27-T34, T35-T39, T40-T44)

**Estado deseado:**
- "Tennis Nike Blanco" con tallas individuales: 27, 28, 29, 30, 31, 32, 33, 34
- "Tennis Nike Negro" con tallas individuales: 27, 28, 29, 30, 31, 32, 33, 34
- (Y tallas 35-44 también desglosadas)

**SQL:**
```sql
-- 1. Crear global_garment_types separados por color
INSERT INTO global_garment_types (id, name, description, is_active, created_at, updated_at)
VALUES
    (gen_random_uuid(), 'Tennis Nike Blanco', 'Tennis Nike color blanco', true, NOW(), NOW()),
    (gen_random_uuid(), 'Tennis Nike Negro', 'Tennis Nike color negro', true, NOW(), NOW());

-- 2. Eliminar productos agrupados existentes y crear desglosados
-- (Ver script completo en siguiente sección)

-- 3. Eliminar global_garment_type original
DELETE FROM global_garment_types WHERE name = 'Tennis Nike';
```

#### 4.3.2 Blusa (Agregar todas las tallas)

**Estado actual:**
- 2 productos: "Blusa Niña" ($17,000), "Blusa Mujer" ($20,000)

**Estado deseado:**
- Tallas numéricas (4,6,8,10,12,14,16): $17,000 cada una
- Tallas letras (S,M,L,XL,XXL): $20,000 cada una

**SQL:**
```sql
-- Eliminar productos actuales
DELETE FROM global_products WHERE garment_type_id = '36639e03-ee1c-4248-94df-403068b8d34b';

-- Crear productos con todas las tallas
INSERT INTO global_products (id, garment_type_id, code, name, size, price, is_active, created_at, updated_at)
SELECT
    gen_random_uuid(),
    '36639e03-ee1c-4248-94df-403068b8d34b',
    'GLB-BLU-' || LPAD(ROW_NUMBER() OVER()::TEXT, 3, '0'),
    'Blusa',
    size,
    CASE WHEN size IN ('S', 'M', 'L', 'XL', 'XXL') THEN 20000 ELSE 17000 END,
    true,
    NOW(),
    NOW()
FROM unnest(ARRAY['4', '6', '8', '10', '12', '14', '16', 'S', 'M', 'L', 'XL', 'XXL']) AS size;
```

#### 4.3.3 Jean (Agregar todas las tallas)

**Estado actual:**
- 2 productos: "Jean Niño" ($43,000), "Jean Hombre" ($45,000)

**Estado deseado:**
- Tallas 4-16: $40,000 cada una
- Tallas 28-42: $45,000 cada una

**SQL:**
```sql
DELETE FROM global_products WHERE garment_type_id = '956455c4-8fe2-4726-8306-5b668a0d804b';

INSERT INTO global_products (id, garment_type_id, code, name, size, price, is_active, created_at, updated_at)
SELECT
    gen_random_uuid(),
    '956455c4-8fe2-4726-8306-5b668a0d804b',
    'GLB-JEA-' || LPAD(ROW_NUMBER() OVER()::TEXT, 3, '0'),
    'Jean',
    size,
    CASE
        WHEN size::int <= 16 THEN 40000
        ELSE 45000
    END,
    true,
    NOW(),
    NOW()
FROM unnest(ARRAY['4', '6', '8', '10', '12', '14', '16', '28', '30', '32', '34', '36', '38', '40', '42']) AS size;
```

#### 4.3.4 Medias Natalia (Agregar tallas)

**Estado actual:**
- 1 producto: "Medias Natalia" talla "Única" ($12,000)

**Estado deseado:**
- Tallas: 4-6, 6-8, 8-10, 9-11, 10-12 a $12,000 cada una

**SQL:**
```sql
DELETE FROM global_products WHERE code = 'GLB-MED-001';

INSERT INTO global_products (id, garment_type_id, code, name, size, price, is_active, created_at, updated_at)
SELECT
    gen_random_uuid(),
    '8bed1b8a-74aa-4547-b4e9-00d66df8d359',
    'GLB-MED-NAT-' || LPAD(ROW_NUMBER() OVER()::TEXT, 2, '0'),
    'Medias Natalia',
    size,
    12000,
    true,
    NOW(),
    NOW()
FROM unnest(ARRAY['4-6', '6-8', '8-10', '9-11', '10-12']) AS size;
```

#### 4.3.5 Zapatos de Goma (Desglosar tallas)

**Estado actual:**
- 3 productos con rangos: T27-T34, T35-T39, T40-T44

**Estado deseado:**
- Tallas individuales: 27, 28, 29, ..., 44
- Precios según rango actual

**SQL:**
```sql
-- Eliminar productos agrupados
DELETE FROM global_products WHERE garment_type_id = 'd57c4c0c-0ec5-4daa-88ac-fd45a66b3361';

-- Crear productos con tallas individuales
INSERT INTO global_products (id, garment_type_id, code, name, size, price, is_active, created_at, updated_at)
SELECT
    gen_random_uuid(),
    'd57c4c0c-0ec5-4daa-88ac-fd45a66b3361',
    'GLB-ZAP-' || LPAD(ROW_NUMBER() OVER()::TEXT, 3, '0'),
    'Zapatos Goma',
    size::TEXT,
    CASE
        WHEN size BETWEEN 27 AND 34 THEN 80000
        WHEN size BETWEEN 35 AND 39 THEN 85000
        ELSE 90000
    END,
    true,
    NOW(),
    NOW()
FROM generate_series(27, 44) AS size;
```

### 4.4 Script Completo de Migración

El script completo debe ejecutarse en orden:

1. Crear nuevos garment_types (Caracas, CONFAMA)
2. Reasignar productos existentes
3. Eliminar garment_types originales
4. Crear nuevos global_garment_types (Tennis por color)
5. Recrear global_products con tallas desglosadas
6. Eliminar global_garment_types originales

### 4.5 Actualizar Imágenes

Después de crear los nuevos garment_types, hay que:
1. Copiar/asignar las imágenes existentes a los nuevos tipos
2. O subir nuevas imágenes específicas por color

```sql
-- Copiar imágenes del garment_type original a los nuevos
INSERT INTO garment_type_images (id, garment_type_id, image_url, is_primary, display_order, created_at, updated_at)
SELECT
    gen_random_uuid(),
    new_gt.id,
    old_img.image_url,
    old_img.is_primary,
    old_img.display_order,
    NOW(),
    NOW()
FROM garment_type_images old_img
JOIN garment_types new_gt ON new_gt.name LIKE '%Chompa%'
WHERE old_img.garment_type_id = 'cd358cf9-5c3b-4723-ba52-25d717b282aa';
```

---

## Resumen de Cambios en Base de Datos

### Caracas
| Antes | Después |
|-------|---------|
| 1 Chompa (22 productos) | Chompa Azul (11 productos) |
| | Chompa Gris (11 productos) |

### CONFAMA
| Antes | Después |
|-------|---------|
| 1 Camiseta (12 productos) | 4 Camisetas por color (3 cada una) |
| 1 Chompa (12 productos) | 4 Chompas por color (3 cada una) |
| 1 Sudadera (12 productos) | 4 Sudaderas por color (3 cada una) |

### Productos Globales
| Tipo | Antes | Después |
|------|-------|---------|
| Tennis Nike | 1 tipo, 6 productos agrupados | 2 tipos (Blanco/Negro), ~36 productos |
| Blusa | 2 productos (Niña/Mujer) | 12 productos (tallas individuales) |
| Jean | 2 productos (Niño/Hombre) | 15 productos (tallas individuales) |
| Medias Natalia | 1 producto (Única) | 5 productos (tallas individuales) |
| Zapatos Goma | 3 productos (rangos) | 18 productos (tallas individuales) |

---

## Orden de Ejecución Parte 4

1. **Backup**: Hacer backup de la base de datos antes de ejecutar
2. **Caracas**: Ejecutar script de reestructuración (Chompa Azul + Chompa Gris)
3. **CONFAMA**: Ejecutar script de reestructuración (12 nuevos garment_types)
4. **Globales**: Ejecutar scripts para cada tipo:
   - Tennis Nike: Separar en Blanco/Negro con tallas 27-44 individuales
   - Blusa: 12 productos (tallas 4-16 a $17k, S-XXL a $20k)
   - Jean: 15 productos (tallas 4-16 a $40k, 28-42 a $45k)
   - Medias Natalia: 5 productos ($12k cada una)
   - Zapatos Goma: 18 productos (tallas 27-44)
5. **Imágenes**: Reasignar imágenes a nuevos tipos
6. **Verificar**: Probar en web portal que se muestran correctamente
7. **Limpiar**: Eliminar datos huérfanos si los hay

---

## Confirmaciones del Usuario

- **Medias Natalia**: $12,000 para todas las tallas (4-6, 6-8, 8-10, 9-11, 10-12)
- **Tennis Nike**: Tallas individuales 27-44 (no rangos)
- **CONFAMA**: Mismas tallas (2, 4, 6) para todos los colores

---

## NOTA IMPORTANTE: Esta es una tarea de DATOS

Las Partes 1-3 del plan ya fueron implementadas y desplegadas.

**La Parte 4 NO requiere cambios de código** - solo ejecutar scripts SQL para reestructurar los datos en la base de datos de producción.

El frontend ya agrupa por `garment_type_id`, por lo que al separar los tipos de prenda por color en la base de datos, automáticamente se mostrarán separados en el catálogo.

---

## Parte 5: Fix Error 422 en Endpoint de Reportes Financieros

### Problema Identificado

Al abrir la pestaña "Financiero" en la página de Reportes, se produce un error 422 (Unprocessable Entity) en el endpoint:
```
GET /api/v1/global/accounting/expenses/summary-by-category
```

### Causa Raíz

**Conflicto de orden de rutas en FastAPI**. El error muestra:
```json
{
  "detail": [{
    "type": "uuid_parsing",
    "loc": ["path", "expense_id"],
    "msg": "Input should be a valid UUID...",
    "input": "summary-by-category"
  }]
}
```

Esto ocurre porque en `global_accounting.py`:
- Línea 741: `/expenses/{expense_id}` (GET)
- Línea 1530: `/expenses/summary-by-category` (GET)

La ruta `/expenses/{expense_id}` está registrada **ANTES** de `/expenses/summary-by-category`. FastAPI procesa las rutas en orden, y cuando llega `/expenses/summary-by-category`, la primera ruta la captura porque `summary-by-category` coincide con el parámetro `{expense_id}`.

### Solución

Mover el endpoint `/expenses/summary-by-category` **ANTES** de `/expenses/{expense_id}` en el archivo.

### Archivo a Modificar

**`backend/app/api/routes/global_accounting.py`**

### Cambios Específicos

1. **Mover las líneas 1529-1591** (endpoint `get_expenses_summary_by_category`)
2. **Ubicarlas ANTES de la línea 741** (endpoint `get_global_expense`)

El orden correcto de rutas debe ser:
```python
# Rutas con path fijo PRIMERO
@router.get("/expenses")                      # Línea ~618
@router.post("/expenses")                     # Línea ~656
@router.get("/expenses/pending")              # Línea ~703
@router.get("/expenses/summary-by-category")  # MOVER AQUÍ (antes era línea 1530)

# Rutas con parámetros DESPUÉS
@router.get("/expenses/{expense_id}")         # Línea ~741
@router.put("/expenses/{expense_id}")         # Línea ~768
@router.post("/expenses/{expense_id}/pay")    # Línea ~804
```

### Pasos de Implementación

1. Copiar el bloque de código del endpoint `get_expenses_summary_by_category` (líneas 1529-1591)
2. Pegarlo después del endpoint `/expenses/pending` (antes de línea 741)
3. Eliminar el bloque original (que ahora estaría duplicado al final)
4. Reiniciar el servicio: `systemctl restart uniformes-api`
5. Probar en la UI que la pestaña Financiero carga correctamente

### Verificación

Después del fix, el endpoint debe responder correctamente:
```bash
curl -s 'http://localhost:8000/api/v1/global/accounting/expenses/summary-by-category?start_date=2026-01-01&end_date=2026-01-05' \
  -H "Authorization: Bearer $TOKEN"
# Debe retornar: [{...categoría...}, ...]
```

### Endpoints Adicionales a Verificar

También existe `/cash-flow` (línea 1594) que podría tener el mismo problema si hubiera una ruta con parámetro conflictiva. Revisar que no haya conflictos similares.

---

# Parte 7: Mejora del Flujo de Ventas - Selección Múltiple + Yomber Agrupado

## Problema Identificado

El flujo actual de registro de ventas tiene dos problemas principales:

### Problema 1: Modal se Cierra Después de Cada Selección

**Ubicación del problema**: `SaleModal.js` línea 194
```javascript
setProductSelectorOpen(false); // Cierra automáticamente
```

**Impacto**: Para ventas grandes (ej: 15 productos diferentes), el usuario debe:
1. Click en "Buscar y agregar productos"
2. Seleccionar talla
3. Seleccionar cantidad
4. Click "Agregar"
5. **Modal se cierra** ← Problema
6. Repetir pasos 1-5 para cada producto

### Problema 2: Productos Yomber Usan Modal Incorrecto (OrderModal)

En `OrderModal.tsx`, la pestaña **Yomber** usa `ProductSelectorModal` (línea 1173-1186) que muestra productos individuales (una tarjeta por talla), mientras que la pestaña **Catálogo** usa `ProductGroupSelector` (línea 1159-1170) que muestra productos agrupados con selector de tallas.

**Situación actual**:
- Catálogo → `ProductGroupSelector` ✅ (agrupado, correcto)
- Yomber → `ProductSelectorModal` ❌ (no agrupado, muchas tarjetas)

**Solución**: Cambiar Yomber para usar `ProductGroupSelector` igual que Catálogo.

---

## Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| `frontend/src/components/SaleModal.tsx` | NO cerrar modal automáticamente + botón "Listo" |
| `frontend/src/components/ProductGroupSelector.tsx` | Modo multi-selección + feedback visual + soporte Yomber |
| `frontend/src/components/ProductGroupCard.tsx` | Feedback visual de "agregado" |
| `frontend/src/components/OrderModal.tsx` | Cambiar Yomber de ProductSelectorModal a ProductGroupSelector |

---

## Implementación Detallada

### 7.1 Modificar SaleModal.tsx - No Cerrar Automáticamente

**Cambio principal**: El `ProductGroupSelector` NO se debe cerrar después de cada producto.

```typescript
// ANTES (línea ~194)
const handleProductSelectorSelect = (...) => {
  // ... agregar producto
  setProductSelectorOpen(false); // ← ELIMINAR
};

// DESPUÉS
const handleProductSelectorSelect = (...) => {
  // ... agregar producto
  // NO cerrar - el usuario decide cuándo terminar
};
```

**Agregar botón "Listo" en ProductGroupSelector**:
- Botón sticky en la parte inferior
- Muestra contador: "X productos agregados"
- Al hacer click cierra el selector

### 7.2 Modificar ProductGroupSelector.tsx - Feedback Visual

**Nuevos estados**:
```typescript
const [addedProducts, setAddedProducts] = useState<Map<string, number>>(new Map());
// Key: productId, Value: cantidad agregada en esta sesión
```

**Modificar `onSelect` callback**:
```typescript
const handleVariantSelect = (variant, quantity) => {
  // Actualizar mapa de agregados para feedback visual
  setAddedProducts(prev => {
    const newMap = new Map(prev);
    const current = newMap.get(variant.productId) || 0;
    newMap.set(variant.productId, current + quantity);
    return newMap;
  });

  // Llamar callback padre
  onSelect(product, quantity, isGlobal);
};
```

**UI del Footer**:
```tsx
{/* Footer sticky con resumen y botón Listo */}
<div className="sticky bottom-0 bg-white border-t p-4 flex justify-between items-center">
  <div className="text-sm text-gray-600">
    {addedProducts.size > 0 ? (
      <span className="text-green-600 font-medium">
        ✓ {addedProducts.size} producto(s) agregados
      </span>
    ) : (
      <span>Selecciona productos para agregar</span>
    )}
  </div>
  <button
    onClick={onClose}
    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
  >
    Listo
  </button>
</div>
```

### 7.3 Modificar ProductGroupCard.tsx - Indicador de Agregado

**Mostrar badge cuando se agrega**:
```tsx
// Props adicional
interface ProductGroupCardProps {
  // ... existentes
  addedQuantity?: number; // Cantidad agregada en esta sesión
}

// En el render, mostrar badge si hay cantidad agregada
{addedQuantity > 0 && (
  <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full">
    +{addedQuantity} agregados
  </div>
)}
```

**Animación de confirmación**:
```tsx
// Al agregar, mostrar feedback temporal
const [showAdded, setShowAdded] = useState(false);

const handleAddClick = () => {
  // ... lógica existente
  setShowAdded(true);
  setTimeout(() => setShowAdded(false), 1500);
};

// En render
{showAdded && (
  <div className="absolute inset-0 bg-green-100/80 flex items-center justify-center rounded-lg">
    <span className="text-green-700 font-medium">✓ Agregado</span>
  </div>
)}
```

---

## Flujo Mejorado (Después de Implementación)

### Escenario: Venta de 10 productos diferentes

1. Usuario click en "Buscar y agregar productos"
2. Se abre `ProductGroupSelector` (modal)
3. Usuario selecciona "Camiseta" → talla 4 → cantidad 2 → "Agregar"
4. **Feedback**: Badge verde "✓ Agregado", contador en footer "+1 producto"
5. **Modal permanece abierto** ← Mejora
6. Usuario selecciona "Chompa" → talla 6 → cantidad 1 → "Agregar"
7. **Feedback**: Badge verde, contador "+2 productos"
8. ... continúa agregando
9. Usuario click "Listo"
10. Modal se cierra, todos los productos en el carrito

---

## Consideraciones Adicionales

### 7.4 Modificar OrderModal.tsx - Yomber con ProductGroupSelector

**Cambio principal**: Reemplazar `ProductSelectorModal` por `ProductGroupSelector` para Yomber.

**Líneas a modificar** (1172-1186):
```tsx
// ANTES - ProductSelectorModal (muestra tarjetas individuales)
{yomberProductSelectorOpen && (
  <ProductSelectorModal
    isOpen={yomberProductSelectorOpen}
    onClose={() => setYomberProductSelectorOpen(false)}
    onSelect={handleYomberProductSelect}
    schoolId={selectedSchoolId}
    filterByStock="all"
    allowGlobalProducts={false}
    includeProductIds={yomberProducts.map(p => p.id)}
    ...
  />
)}

// DESPUÉS - ProductGroupSelector (muestra tarjetas agrupadas)
<ProductGroupSelector
  isOpen={yomberProductSelectorOpen}
  onClose={() => setYomberProductSelectorOpen(false)}
  onSelect={handleYomberProductSelect}
  schoolId={selectedSchoolId}
  filterByStock="all"
  includeGarmentTypeIds={yomberGarmentTypeIds}  // Solo mostrar tipos Yomber
  title="Seleccionar Producto Yomber"
  emptyMessage="No hay productos Yomber configurados"
/>
```

**Agregar prop `includeGarmentTypeIds`** a ProductGroupSelector:
- Inverso de `excludeGarmentTypeIds`
- Filtra para SOLO mostrar los tipos especificados

### Productos Yomber en Ventas (SaleModal)

**Decisión**: Ocultar productos Yomber del selector de ventas.

El `ProductGroupSelector` en SaleModal ya usa `excludeGarmentTypeIds` (probablemente vacío). Se debe pasar los IDs de tipos Yomber para excluirlos:

```tsx
// En SaleModal, obtener IDs de tipos Yomber
const yomberGarmentTypeIds = useMemo(() => {
  return garmentTypes
    .filter(gt => gt.has_custom_measurements)
    .map(gt => gt.id);
}, [garmentTypes]);

// Pasar al ProductGroupSelector
<ProductGroupSelector
  ...
  excludeGarmentTypeIds={yomberGarmentTypeIds}  // Ocultar Yomber
/>
```

Esto es más simple que redirigir y evita confusión - los Yomber solo se agregan desde OrderModal.

### Sobre el Agrupamiento Existente

El agrupamiento de productos YA EXISTE y funciona:
- `groupProductsByGarmentType()` en `productGrouping.ts`
- `ProductGroupCard` ya muestra selector de tallas

El problema NO es el agrupamiento, sino:
1. El cierre automático del modal (SaleModal)
2. La falta de feedback visual al agregar
3. Yomber en OrderModal usa el modal incorrecto (ProductSelectorModal)

---

## Testing

### SaleModal - Selección Múltiple
| Escenario | Resultado Esperado |
|-----------|-------------------|
| Agregar 1 producto y click "Listo" | Producto en carrito, selector cerrado |
| Agregar 5 productos seguidos | Selector abierto, contador muestra 5, todos en carrito |
| Agregar mismo producto 2 veces | Cantidad se suma (no duplica línea) |
| Click "Listo" sin agregar nada | Selector se cierra normalmente |
| Buscar Yomber en ventas | NO aparecen (están ocultos) |

### OrderModal - Yomber Agrupado
| Escenario | Resultado Esperado |
|-----------|-------------------|
| Abrir selector Yomber | Muestra tarjetas agrupadas (no una por talla) |
| Seleccionar talla de Yomber | Muestra talla seleccionada, pide medidas |
| Agregar Yomber con medidas | Se agrega correctamente a la lista |

---

## Orden de Implementación

1. **ProductGroupSelector.tsx** - Agregar prop `includeGarmentTypeIds`, estado `addedProducts`, footer con contador y botón "Listo"
2. **ProductGroupCard.tsx** - Agregar feedback visual de "agregado" (badge + animación)
3. **SaleModal.tsx** - Eliminar cierre automático + excluir tipos Yomber del selector
4. **OrderModal.tsx** - Cambiar Yomber de ProductSelectorModal a ProductGroupSelector

---

## Verificación Post-Implementación

1. **SaleModal**: Crear venta con 10+ productos sin reabrir selector
2. **Contador**: Verificar que muestra cantidad de productos agregados en footer
3. **Feedback**: Verificar badge verde "✓ Agregado" en tarjetas
4. **Yomber oculto**: Verificar que productos Yomber NO aparecen en selector de ventas
5. **OrderModal Yomber**: Productos Yomber agrupados con selector de tallas
6. **Total**: Verificar que el total se actualiza en tiempo real en SaleModal

---

# Parte 8: Dashboard Mejorado + Flujo Encargos + Pagos Múltiples en Ventas

## Resumen

Esta parte cubre tres mejoras solicitadas por el usuario:

1. **Dashboard Mejorado** - Fixes y personalización
2. **Flujo de Encargos** - Documentación (email NO requerido)
3. **Pagos Múltiples en Ventas** - Similar a encargos (anticipos)

---

## 8.1 Dashboard GLOBAL (No Depende del Selector de Colegios)

### Nuevo Concepto

El Dashboard debe ser **GLOBAL** y mostrar estadísticas **acumuladas de TODOS los colegios** del usuario, sin depender del selector de colegios del header.

### Cambios Requeridos

#### 1. Backend: Nuevo Endpoint Global

**Archivo a crear/modificar**: `backend/app/api/routes/dashboard.py`

```python
@router.get("/global/dashboard/stats")
async def get_global_dashboard_stats(
    db: DatabaseSession,
    current_user: CurrentUser
):
    """
    Estadísticas globales acumuladas de TODOS los colegios.
    No depende de school_id - suma todo.
    """
    # Obtener colegios del usuario (o todos si es superuser)
    user_school_ids = await get_user_school_ids(db, current_user)

    # Ventas totales (cantidad)
    total_sales = await db.execute(
        select(func.count(Sale.id))
        .where(Sale.school_id.in_(user_school_ids))
    )

    # Ventas del mes (monto)
    month_start = datetime.now().replace(day=1, hour=0, minute=0)
    sales_amount_month = await db.execute(
        select(func.sum(Sale.total_amount))
        .where(Sale.school_id.in_(user_school_ids))
        .where(Sale.created_at >= month_start)
    )

    # Encargos totales
    total_orders = await db.execute(
        select(func.count(Order.id))
        .where(Order.school_id.in_(user_school_ids))
    )

    # Encargos pendientes
    pending_orders = await db.execute(
        select(func.count(Order.id))
        .where(Order.school_id.in_(user_school_ids))
        .where(Order.status.in_(['pending', 'in_production']))
    )

    # Clientes totales
    total_clients = await db.execute(
        select(func.count(Client.id.distinct()))
        .where(Client.school_id.in_(user_school_ids))
    )

    # Productos totales
    total_products = await db.execute(
        select(func.count(Product.id))
        .where(Product.school_id.in_(user_school_ids))
    )

    # Resumen por colegio
    schools_summary = []
    for school_id in user_school_ids:
        school = await db.get(School, school_id)
        school_sales = await db.execute(
            select(func.count(Sale.id), func.sum(Sale.total_amount))
            .where(Sale.school_id == school_id)
            .where(Sale.created_at >= month_start)
        )
        school_orders = await db.execute(
            select(func.count(Order.id))
            .where(Order.school_id == school_id)
            .where(Order.status.in_(['pending', 'in_production']))
        )

        sales_count, sales_amount = school_sales.first()
        schools_summary.append({
            "school_id": str(school_id),
            "school_name": school.name,
            "sales_count": sales_count or 0,
            "sales_amount": sales_amount or 0,
            "pending_orders": school_orders.scalar() or 0
        })

    return {
        "totals": {
            "total_sales": total_sales.scalar() or 0,
            "sales_amount_month": sales_amount_month.scalar() or 0,
            "total_orders": total_orders.scalar() or 0,
            "pending_orders": pending_orders.scalar() or 0,
            "total_clients": total_clients.scalar() or 0,
            "total_products": total_products.scalar() or 0
        },
        "schools_summary": schools_summary
    }
```

#### 2. Frontend: Dashboard NO usa schoolId

**Archivo**: `frontend/src/pages/Dashboard.tsx`

**Cambios principales**:

```tsx
// ANTES - Dependía del selector de colegios
const { selectedSchoolId } = useSchoolStore();
useEffect(() => {
  if (selectedSchoolId) {
    loadStats(selectedSchoolId);
  }
}, [selectedSchoolId]);

// DESPUÉS - Carga global sin schoolId
useEffect(() => {
  loadGlobalStats();  // Sin parámetro schoolId
}, []);

const loadGlobalStats = async () => {
  const response = await dashboardService.getGlobalStats();
  setStats(response);
};
```

**Nueva UI del Dashboard**:

```tsx
{/* Tarjetas de Resumen GLOBAL */}
<div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
  <StatCard
    title="Ventas Totales"
    value={stats.totals.total_sales}  // Sin $
    icon={<ShoppingBag />}
  />
  <StatCard
    title="Ventas del Mes"
    value={formatCurrency(stats.totals.sales_amount_month)}
    icon={<DollarSign />}
  />
  <StatCard
    title="Encargos Pendientes"
    value={stats.totals.pending_orders}
    icon={<Package />}
    color="orange"
  />
  <StatCard
    title="Clientes"
    value={stats.totals.total_clients}
    icon={<Users />}
  />
</div>

{/* Tabla de Resumen por Colegio */}
<div className="bg-white rounded-xl shadow p-6">
  <h3 className="text-lg font-semibold mb-4">Resumen por Colegio</h3>
  <table className="w-full">
    <thead>
      <tr className="text-left text-gray-500 text-sm">
        <th>Colegio</th>
        <th className="text-right">Ventas (mes)</th>
        <th className="text-right">Monto Ventas</th>
        <th className="text-right">Encargos Pend.</th>
      </tr>
    </thead>
    <tbody>
      {stats.schools_summary.map(school => (
        <tr key={school.school_id} className="border-t">
          <td className="py-3 font-medium">{school.school_name}</td>
          <td className="text-right">{school.sales_count}</td>
          <td className="text-right">{formatCurrency(school.sales_amount)}</td>
          <td className="text-right">
            <span className={school.pending_orders > 0 ? 'text-orange-600 font-medium' : ''}>
              {school.pending_orders}
            </span>
          </td>
        </tr>
      ))}
    </tbody>
  </table>
</div>
```

#### 3. Service: Dashboard Global

**Archivo**: `frontend/src/services/dashboardService.ts`

```typescript
// NUEVO método
async getGlobalStats(): Promise<GlobalDashboardStats> {
  const response = await apiClient.get('/global/dashboard/stats');
  return response.data;
}

interface GlobalDashboardStats {
  totals: {
    total_sales: number;
    sales_amount_month: number;
    total_orders: number;
    pending_orders: number;
    total_clients: number;
    total_products: number;
  };
  schools_summary: Array<{
    school_id: string;
    school_name: string;
    sales_count: number;
    sales_amount: number;
    pending_orders: number;
  }>;
}
```

### Bugs a Corregir

| Problema | Solución |
|----------|----------|
| "Ventas" muestra "$" | Usar número plain, no `formatCurrency()` |
| "Encargos" siempre 0 | Nuevo endpoint global retorna `total_orders` |
| Depende del selector | Dashboard usa endpoint `/global/dashboard/stats` sin schoolId |

---

## 8.2 Verificación por Email en Encargos Internos

### Nuevo Requisito

Cuando se crea un encargo desde la UI interna (app Tauri), se debe:

1. **Requerir email del cliente**
2. **Enviar código de verificación** (como el portal web)
3. **Cliente se registra** con contraseña
4. **Cliente puede ver estado** de sus encargos en el portal web

### Flujo Actual del Portal Web (Referencia)

El portal web tiene un flujo de verificación completo:

```
1. POST /api/v1/portal/clients/verify-email/send
   - Input: { email, name }
   - Genera código 6 dígitos
   - Almacena en: email_verification_codes[email] = (code, expiry)
   - Envía email con código
   - Expira en 10 minutos

2. POST /api/v1/portal/clients/verify-email/confirm
   - Input: { email, code }
   - Valida código
   - Marca email como verificado: verified_emails[email] = expiry
   - Válido por 30 minutos para completar registro

3. POST /api/v1/portal/clients/register
   - Input: { name, email, password, phone, students }
   - Crea cliente con is_verified=true
   - Retorna client_id

4. POST /api/v1/portal/orders/create
   - Crea orden asociada al cliente
```

### Implementación para UI Interna

#### Opción A: Simplificada (Recomendada)

El empleado crea el encargo y el sistema envía email de bienvenida con link para:
- Establecer contraseña
- Ver estado del encargo

**Cambios necesarios**:

1. **OrderModal.tsx** - Requerir email obligatorio
2. **Backend** - Nuevo endpoint para enviar invitación
3. **Backend** - Endpoint de reset/set password
4. **Web Portal** - Página de activación de cuenta

#### Flujo Propuesto:

```
UI INTERNA (OrderModal):
1. Empleado ingresa datos del cliente incluyendo EMAIL (obligatorio)
2. Empleado crea el encargo normalmente
3. Backend crea Order + Client (si no existe)
4. Backend envía email de bienvenida con link único

EMAIL AL CLIENTE:
"Hola [nombre],
Tu encargo #ENC-2025-XXX ha sido registrado.
Para ver el estado de tu pedido, activa tu cuenta:
[LINK: https://yourdomain.com/activar-cuenta?token=XXXXX]"

WEB PORTAL:
1. Cliente hace click en el link
2. Página de activar cuenta: establece contraseña
3. Cliente puede hacer login y ver sus encargos en /mi-cuenta
```

### Archivos a Modificar

#### 1. OrderModal.tsx - Email Obligatorio

**Archivo**: `frontend/src/components/OrderModal.tsx`

```tsx
// Validación al crear orden
const validateOrder = () => {
  if (!selectedClient?.email) {
    setError('⚠️ El cliente debe tener email para recibir notificaciones');
    return false;
  }
  // ... otras validaciones
};

// En el formulario de nuevo cliente
<div className="mb-4">
  <label className="block text-sm font-medium mb-1">
    Email <span className="text-red-500">*</span>
  </label>
  <input
    type="email"
    required
    value={newClientEmail}
    onChange={(e) => setNewClientEmail(e.target.value)}
    className="w-full px-3 py-2 border rounded-lg"
    placeholder="correo@ejemplo.com"
  />
  <p className="text-xs text-gray-500 mt-1">
    El cliente recibirá un email para ver el estado de su encargo
  </p>
</div>
```

#### 2. Backend: Endpoint de Invitación

**Archivo**: `backend/app/api/routes/orders.py`

```python
@router.post("/schools/{school_id}/orders", response_model=OrderResponse)
async def create_order(
    school_id: UUID,
    data: OrderCreate,
    db: DatabaseSession,
    current_user: CurrentUser
):
    # ... crear orden existente ...

    # NUEVO: Si es encargo interno y cliente tiene email
    if data.source == "internal" and client.email:
        # Generar token de activación
        activation_token = generate_activation_token()
        client.activation_token = activation_token
        client.activation_token_expires = datetime.utcnow() + timedelta(days=7)

        # Enviar email de bienvenida
        await send_order_welcome_email(
            email=client.email,
            client_name=client.name,
            order_code=order.code,
            activation_token=activation_token
        )

    return order
```

#### 3. Backend: Servicio de Email

**Archivo**: `backend/app/services/email.py`

```python
async def send_order_welcome_email(
    email: str,
    client_name: str,
    order_code: str,
    activation_token: str
):
    """Envía email de bienvenida cuando se crea encargo interno"""
    activation_url = f"{settings.PORTAL_URL}/activar-cuenta?token={activation_token}"

    html_content = f"""
    <h2>Hola {client_name},</h2>
    <p>Tu encargo <strong>{order_code}</strong> ha sido registrado exitosamente.</p>
    <p>Para ver el estado de tu pedido y recibir actualizaciones, activa tu cuenta:</p>
    <p>
      <a href="{activation_url}" style="...">
        Activar Mi Cuenta
      </a>
    </p>
    <p>Este link es válido por 7 días.</p>
    <p>Uniformes Consuelo Ríos</p>
    """

    await send_email(
        to=email,
        subject=f"Tu Encargo {order_code} - Activa tu cuenta",
        html_content=html_content
    )
```

#### 4. Web Portal: Página de Activación

**Archivo a crear**: `web-portal/app/activar-cuenta/page.tsx`

```tsx
export default function ActivarCuentaPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState<'loading' | 'form' | 'success' | 'error'>('loading');

  useEffect(() => {
    // Validar token
    validateToken(token);
  }, [token]);

  const handleActivate = async () => {
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    const response = await fetch('/api/v1/portal/clients/activate', {
      method: 'POST',
      body: JSON.stringify({ token, password })
    });

    if (response.ok) {
      setStatus('success');
      // Redirect a login o auto-login
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      {status === 'form' && (
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-md">
          <h1 className="text-2xl font-bold mb-4">Activa tu Cuenta</h1>
          <p className="text-gray-600 mb-6">
            Crea una contraseña para acceder al portal y ver el estado de tus encargos.
          </p>
          <input
            type="password"
            placeholder="Nueva contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 border rounded-lg mb-3"
          />
          <input
            type="password"
            placeholder="Confirmar contraseña"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full px-4 py-3 border rounded-lg mb-4"
          />
          <button
            onClick={handleActivate}
            className="w-full bg-brand-600 text-white py-3 rounded-lg"
          >
            Activar Cuenta
          </button>
        </div>
      )}

      {status === 'success' && (
        <div className="text-center">
          <h2 className="text-2xl font-bold text-green-600 mb-4">¡Cuenta Activada!</h2>
          <p>Ahora puedes ver el estado de tus encargos.</p>
          <Link href="/login">Iniciar Sesión</Link>
        </div>
      )}
    </div>
  );
}
```

#### 5. Backend: Endpoint de Activación

**Archivo**: `backend/app/api/routes/clients.py`

```python
@web_router.post("/clients/activate")
async def activate_client_account(
    data: ActivateAccountRequest,
    db: DatabaseSession
):
    """
    Activa cuenta de cliente con token de invitación.
    POST /api/v1/portal/clients/activate
    """
    # Buscar cliente por token
    client = await db.execute(
        select(Client).where(
            Client.activation_token == data.token,
            Client.activation_token_expires > datetime.utcnow()
        )
    )
    client = client.scalar_one_or_none()

    if not client:
        raise HTTPException(400, "Token inválido o expirado")

    # Establecer contraseña y activar
    client.password_hash = hash_password(data.password)
    client.is_verified = True
    client.activation_token = None
    client.activation_token_expires = None
    client.client_type = ClientType.WEB  # Ahora puede usar portal

    await db.commit()

    return {"message": "Cuenta activada exitosamente", "email": client.email}
```

#### 6. Modelo Client - Nuevos Campos

**Archivo**: `backend/app/models/client.py`

```python
class Client(Base):
    # ... campos existentes ...

    # NUEVOS campos para activación
    activation_token: Mapped[str | None] = mapped_column(String(100), nullable=True)
    activation_token_expires: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
```

### Resumen del Flujo

```
┌─────────────────────────────────────────────────────────┐
│ UI INTERNA (Empleado)                                    │
├─────────────────────────────────────────────────────────┤
│ 1. Abre OrderModal                                       │
│ 2. Selecciona/crea cliente con EMAIL obligatorio        │
│ 3. Agrega productos                                      │
│ 4. Guarda encargo                                        │
│    └─ Backend envía email de bienvenida automáticamente │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│ EMAIL AL CLIENTE                                         │
├─────────────────────────────────────────────────────────┤
│ "Tu encargo ENC-2025-XXX fue registrado.                │
│  Activa tu cuenta para ver el estado:                   │
│  [LINK de activación]"                                  │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│ WEB PORTAL (/activar-cuenta)                            │
├─────────────────────────────────────────────────────────┤
│ 1. Cliente hace click en link                           │
│ 2. Establece contraseña                                 │
│ 3. Cuenta activada → puede hacer login                  │
│ 4. Ve estado de encargos en /mi-cuenta                  │
└─────────────────────────────────────────────────────────┘
```

### Archivos a Modificar/Crear

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `frontend/src/components/OrderModal.tsx` | Modificar | Email obligatorio |
| `backend/app/models/client.py` | Modificar | Agregar activation_token |
| `backend/app/api/routes/orders.py` | Modificar | Enviar email al crear |
| `backend/app/services/email.py` | Modificar | Agregar send_order_welcome_email |
| `backend/app/api/routes/clients.py` | Modificar | Agregar endpoint /activate |
| `web-portal/app/activar-cuenta/page.tsx` | **CREAR** | Página de activación |
| `backend/alembic/versions/xxx_client_activation.py` | **CREAR** | Migración nuevos campos |

---

## 8.3 Pagos Múltiples en Ventas

### Problema

Actualmente las ventas tienen UN SOLO método de pago:

```python
# Sale model
payment_method: Mapped[str]  # 'cash', 'nequi', 'transfer', etc.
```

El usuario necesita registrar pagos mixtos como:
- $50,000 en efectivo
- $30,000 en transferencia

### Solución: Tabla `sale_payments`

Similar a cómo funcionan los encargos con `OrderPayment`.

### Archivos a Crear/Modificar

#### 1. Nuevo Modelo: `backend/app/models/sale_payment.py`

```python
from sqlalchemy import String, Integer, ForeignKey, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base
from uuid import UUID
from datetime import datetime

class SalePayment(Base):
    __tablename__ = "sale_payments"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    sale_id: Mapped[UUID] = mapped_column(ForeignKey("sales.id", ondelete="CASCADE"))
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    payment_method: Mapped[str] = mapped_column(String(50), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    transaction_id: Mapped[UUID | None] = mapped_column(ForeignKey("transactions.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    sale: Mapped["Sale"] = relationship(back_populates="payments")
    transaction: Mapped["Transaction"] = relationship()
```

#### 2. Actualizar Modelo Sale: `backend/app/models/sale.py`

```python
# Agregar relationship
payments: Mapped[list["SalePayment"]] = relationship(
    "SalePayment", back_populates="sale", cascade="all, delete-orphan"
)

# MANTENER payment_method para backwards compatibility (puede ser null para ventas nuevas)
payment_method: Mapped[str | None]  # Cambiar a nullable
```

#### 3. Schema: `backend/app/schemas/sale.py`

```python
class SalePaymentCreate(BaseModel):
    amount: int
    payment_method: str  # 'cash', 'nequi', 'transfer', 'card'
    notes: str | None = None

class SaleCreate(BaseModel):
    # ... campos existentes ...
    payment_method: str | None = None  # Deprecated, usar payments
    payments: list[SalePaymentCreate] | None = None  # NUEVO

class SalePaymentResponse(BaseModel):
    id: UUID
    amount: int
    payment_method: str
    notes: str | None
    created_at: datetime

class SaleResponse(BaseModel):
    # ... campos existentes ...
    payments: list[SalePaymentResponse] = []
```

#### 4. Service: `backend/app/services/sale.py`

```python
async def create_sale(self, data: SaleCreate, school_id: UUID) -> Sale:
    # ... lógica existente ...

    # Crear pagos
    if data.payments:
        for payment_data in data.payments:
            payment = SalePayment(
                sale_id=sale.id,
                amount=payment_data.amount,
                payment_method=payment_data.payment_method,
                notes=payment_data.notes
            )
            self.db.add(payment)

            # Crear transacción para cada pago
            await self._create_payment_transaction(payment, sale)
    elif data.payment_method:
        # Backwards compatibility: crear un solo pago
        payment = SalePayment(
            sale_id=sale.id,
            amount=sale.total_amount,
            payment_method=data.payment_method
        )
        self.db.add(payment)
```

#### 5. Migración Alembic

```python
def upgrade():
    op.create_table(
        'sale_payments',
        sa.Column('id', sa.UUID(), primary_key=True),
        sa.Column('sale_id', sa.UUID(), sa.ForeignKey('sales.id', ondelete='CASCADE')),
        sa.Column('amount', sa.Integer(), nullable=False),
        sa.Column('payment_method', sa.String(50), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('transaction_id', sa.UUID(), sa.ForeignKey('transactions.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(), default=datetime.utcnow),
    )

    # Hacer payment_method nullable en sales
    op.alter_column('sales', 'payment_method', nullable=True)
```

#### 6. Frontend: `frontend/src/components/SaleModal.tsx`

**Estado actual** (líneas 78-79):
```tsx
const [paymentMethod, setPaymentMethod] = useState('cash');
```

**Cambio a**:
```tsx
interface PaymentLine {
  id: string;
  amount: number;
  payment_method: string;
}

const [payments, setPayments] = useState<PaymentLine[]>([
  { id: '1', amount: 0, payment_method: 'cash' }
]);
```

**Nueva UI**:
```tsx
{/* Sección de Pagos */}
<div className="border-t pt-4 mt-4">
  <div className="flex justify-between items-center mb-3">
    <h4 className="font-medium">Métodos de Pago</h4>
    <button
      type="button"
      onClick={addPaymentLine}
      className="text-sm text-blue-600 hover:text-blue-700"
    >
      + Agregar método
    </button>
  </div>

  {payments.map((payment, idx) => (
    <div key={payment.id} className="flex gap-3 mb-2">
      <input
        type="number"
        value={payment.amount}
        onChange={(e) => updatePaymentAmount(idx, e.target.value)}
        className="w-32 px-3 py-2 border rounded-lg"
        placeholder="Monto"
      />
      <select
        value={payment.payment_method}
        onChange={(e) => updatePaymentMethod(idx, e.target.value)}
        className="flex-1 px-3 py-2 border rounded-lg"
      >
        <option value="cash">Efectivo</option>
        <option value="nequi">Nequi</option>
        <option value="transfer">Transferencia</option>
        <option value="card">Tarjeta</option>
      </select>
      {payments.length > 1 && (
        <button onClick={() => removePaymentLine(idx)} className="text-red-500">
          ×
        </button>
      )}
    </div>
  ))}

  {/* Validación: suma debe igual al total */}
  {totalPayments !== totalSale && (
    <p className="text-red-500 text-sm mt-2">
      La suma de pagos (${formatNumber(totalPayments)}) no coincide con el total (${formatNumber(totalSale)})
    </p>
  )}
</div>
```

#### 7. Service Frontend: `frontend/src/services/saleService.ts`

```typescript
interface CreateSalePayload {
  // ... campos existentes ...
  payments: Array<{
    amount: number;
    payment_method: string;
    notes?: string;
  }>;
}

async createSale(schoolId: string, data: CreateSalePayload) {
  return apiClient.post(`/schools/${schoolId}/sales`, data);
}
```

---

## Orden de Implementación Parte 8

### Prioridad 1: Dashboard GLOBAL (impacto alto)
1. `backend/app/api/routes/dashboard.py` - **CREAR** endpoint `/global/dashboard/stats`
2. `frontend/src/services/dashboardService.ts` - Agregar `getGlobalStats()`
3. `frontend/src/pages/Dashboard.tsx` - Reescribir para usar endpoint global

### Prioridad 2: Pagos Múltiples en Ventas
1. `backend/app/models/sale_payment.py` - **CREAR** modelo SalePayment
2. `backend/alembic/versions/xxx_sale_payments.py` - **CREAR** migración
3. `backend/app/models/sale.py` - Agregar relationship payments
4. `backend/app/schemas/sale.py` - Agregar SalePaymentCreate/Response
5. `backend/app/services/sale.py` - Soportar múltiples pagos
6. `frontend/src/components/SaleModal.tsx` - UI para múltiples pagos
7. `frontend/src/services/saleService.ts` - Enviar array de pagos

### Prioridad 3: Verificación Email en Encargos (requiere más trabajo)
1. `backend/app/models/client.py` - Agregar activation_token fields
2. `backend/alembic/versions/xxx_client_activation.py` - **CREAR** migración
3. `frontend/src/components/OrderModal.tsx` - Email obligatorio
4. `backend/app/api/routes/orders.py` - Enviar email al crear encargo
5. `backend/app/services/email.py` - Agregar send_order_welcome_email
6. `backend/app/api/routes/clients.py` - Agregar endpoint /activate
7. `web-portal/app/activar-cuenta/page.tsx` - **CREAR** página activación

---

## Resumen de Archivos a Modificar/Crear

### Dashboard Global
| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `backend/app/api/routes/dashboard.py` | **CREAR** | Endpoint global sin schoolId |
| `frontend/src/services/dashboardService.ts` | Modificar | getGlobalStats() |
| `frontend/src/pages/Dashboard.tsx` | Modificar | UI global con tabla por colegio |

### Pagos Múltiples
| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `backend/app/models/sale_payment.py` | **CREAR** | Nuevo modelo |
| `backend/app/models/sale.py` | Modificar | Relationship payments |
| `backend/app/schemas/sale.py` | Modificar | SalePaymentCreate/Response |
| `backend/app/services/sale.py` | Modificar | Soportar múltiples pagos |
| `backend/alembic/versions/xxx_sale_payments.py` | **CREAR** | Migración |
| `frontend/src/components/SaleModal.tsx` | Modificar | UI pagos múltiples |
| `frontend/src/services/saleService.ts` | Modificar | Enviar array pagos |

### Verificación Email Encargos
| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `frontend/src/components/OrderModal.tsx` | Modificar | Email obligatorio |
| `backend/app/models/client.py` | Modificar | activation_token fields |
| `backend/app/api/routes/orders.py` | Modificar | Enviar email al crear |
| `backend/app/services/email.py` | Modificar | send_order_welcome_email |
| `backend/app/api/routes/clients.py` | Modificar | Endpoint /activate |
| `web-portal/app/activar-cuenta/page.tsx` | **CREAR** | Página activación |
| `backend/alembic/versions/xxx_client_activation.py` | **CREAR** | Migración |

---

## Testing Parte 8

### Dashboard Global
| Escenario | Resultado Esperado |
|-----------|-------------------|
| Ver Dashboard sin seleccionar colegio | Muestra totales de TODOS los colegios |
| Tabla por colegio | Muestra ventas, monto y encargos por cada colegio |
| "Ventas Totales" | Número sin signo "$" |
| "Encargos Pendientes" | Número real (suma de todos los colegios) |
| Usuario con 1 colegio | Muestra solo ese colegio en tabla |
| Superuser | Muestra todos los colegios activos |

### Pagos Múltiples
| Escenario | Resultado Esperado |
|-----------|-------------------|
| Crear venta con 1 pago | Funciona como antes |
| Crear venta con 2 pagos | Se registran ambos pagos |
| Pagos no suman total | Error de validación antes de guardar |
| Ver detalle venta | Muestra desglose de pagos |
| Agregar línea de pago | Nuevo campo de monto y método aparece |
| Eliminar línea de pago | Línea se elimina, recalcula total |

### Verificación Email Encargos
| Escenario | Resultado Esperado |
|-----------|-------------------|
| Crear encargo sin email | Error: "El cliente debe tener email" |
| Crear encargo con email | Encargo creado + email enviado |
| Email recibido | Contiene link de activación válido |
| Click link activación | Página para establecer contraseña |
| Activar cuenta | Cliente puede hacer login en portal web |
| Ver /mi-cuenta | Cliente ve su encargo con estado |

---

## Verificación Final

### Dashboard
- [ ] Dashboard NO depende del selector de colegios
- [ ] Totales son suma de TODOS los colegios del usuario
- [ ] Tabla de resumen muestra cada colegio con métricas
- [ ] "Ventas" muestra número, no dinero
- [ ] "Encargos Pendientes" muestra número real

### Pagos Múltiples
- [ ] Se puede crear venta con múltiples métodos de pago
- [ ] La suma de pagos debe igualar el total (validación)
- [ ] Transacciones se crean por cada pago
- [ ] Ventas antiguas siguen funcionando (backwards compatible)
- [ ] UI permite agregar/quitar líneas de pago

### Verificación Email
- [ ] Email es OBLIGATORIO al crear encargo
- [ ] Email de bienvenida se envía automáticamente
- [ ] Link de activación funciona
- [ ] Cliente puede establecer contraseña
- [ ] Cliente puede ver encargos en /mi-cuenta

---

# Parte 9: Mejora de Filtros del Catálogo Web (Mobile-First)

## Problema Identificado

Los filtros actuales del catálogo web son:
1. **Demasiado ruidosos** - Múltiples filas de botones grandes
2. **Ocupan mucho espacio** - 4-5 filas antes del contenido
3. **No optimizados para móvil** - Botones px-4 py-2, gap-4

### Estructura Actual (líneas 429-635 en page.tsx)

```
┌─────────────────────────────────────────┐
│ [Búsqueda grande py-3]                  │  ← 429-456
│ [Filtros Avanzados] [Buscar Global]     │  ← 459-485
│ [Historial búsquedas]                   │  ← 488-502
├─────────────────────────────────────────┤
│ [Panel Filtros Avanzados]               │  ← 505-576
├─────────────────────────────────────────┤
│ [Icon] Categoría: [Todos] [Camisas]...  │  ← 580-602
├─────────────────────────────────────────┤
│ [Icon] Talla: [Todas] [2] [4] [6]...    │  ← 604-635
├─────────────────────────────────────────┤
│           PRODUCTOS                     │  ← Muy abajo!
└─────────────────────────────────────────┘
```

## Solución: Diseño Compacto

### Nueva Estructura

```
┌─────────────────────────────────────────┐
│ [🔍 Buscar...          ] [⚙️]           │  ← Compacto
├─────────────────────────────────────────┤
│ •Todos Camisas Chompas... │ Talla ▼    │  ← Una sola fila
├─────────────────────────────────────────┤
│           PRODUCTOS                     │  ← Contenido arriba!
└─────────────────────────────────────────┘
```

---

## Archivo a Modificar

**`web-portal/app/[school_slug]/page.tsx`**

---

## Cambios Específicos

### 9.1 Compactar Input de Búsqueda (línea 436)

```tsx
// ANTES
className="w-full pl-12 pr-12 py-3 text-base border..."

// DESPUÉS
className="w-full pl-10 pr-10 py-2 text-sm border..."
```

### 9.2 Mover Botón Filtros Junto a Búsqueda

```tsx
// Nueva estructura de búsqueda
<div className="flex gap-2">
  <div className="relative flex-1">
    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
    <input
      className="w-full pl-9 pr-9 py-2 text-sm border rounded-lg..."
      placeholder="Buscar productos..."
    />
  </div>
  <button
    onClick={() => setShowFilters(!showFilters)}
    className="p-2 border rounded-lg hover:bg-gray-50 relative"
  >
    <SlidersHorizontal className="w-4 h-4" />
    {hasActiveFilters && (
      <span className="absolute -top-1 -right-1 w-3 h-3 bg-brand-600 rounded-full" />
    )}
  </button>
</div>
```

### 9.3 Combinar Categorías + Tallas en Una Fila (reemplazar líneas 580-635)

```tsx
// Nueva sección compacta de filtros
<div className="bg-white border-b">
  <div className="max-w-7xl mx-auto px-4 py-2">
    <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
      {/* Chips de categoría compactos */}
      {categories.map(cat => (
        <button
          key={cat}
          onClick={() => setFilter(cat)}
          className={`px-3 py-1 text-xs font-medium rounded-full whitespace-nowrap ${
            filter === cat
              ? 'bg-brand-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {cat === 'all' ? 'Todos' : cat}
        </button>
      ))}

      {/* Separador */}
      {sizes.length > 0 && (
        <div className="w-px h-5 bg-gray-300 flex-shrink-0 mx-1" />
      )}

      {/* Dropdown de tallas */}
      {sizes.length > 0 && (
        <div className="relative">
          <button
            onClick={() => setShowSizeDropdown(!showSizeDropdown)}
            className={`px-3 py-1 text-xs font-medium rounded-full whitespace-nowrap flex items-center gap-1 ${
              sizeFilter !== 'all'
                ? 'bg-brand-600 text-white'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            {sizeFilter === 'all' ? 'Talla' : `T. ${sizeFilter}`}
            <ChevronDown className="w-3 h-3" />
          </button>

          {showSizeDropdown && (
            <div className="absolute top-full mt-1 left-0 bg-white rounded-lg shadow-lg border py-1 z-20 min-w-[100px] max-h-48 overflow-y-auto">
              <button
                onClick={() => { setSizeFilter('all'); setShowSizeDropdown(false); }}
                className="w-full px-3 py-1.5 text-xs text-left hover:bg-gray-100"
              >
                Todas las tallas
              </button>
              {sizes.map(size => (
                <button
                  key={size}
                  onClick={() => { setSizeFilter(size); setShowSizeDropdown(false); }}
                  className={`w-full px-3 py-1.5 text-xs text-left hover:bg-gray-100 ${
                    sizeFilter === size ? 'bg-brand-50 text-brand-600' : ''
                  }`}
                >
                  Talla {size}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  </div>
</div>
```

### 9.4 Filtros Avanzados como Drawer Móvil

```tsx
// Drawer para móvil (reemplaza panel inline)
{showFilters && (
  <>
    {/* Overlay móvil */}
    <div
      className="fixed inset-0 bg-black/40 z-40 md:hidden"
      onClick={() => setShowFilters(false)}
    />

    {/* Drawer desde abajo (móvil) */}
    <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-xl z-50 md:hidden">
      <div className="p-4 max-h-[60vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-gray-900">Filtros</h3>
          <button onClick={() => setShowFilters(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Rango de precio */}
        {priceStats && (
          <div className="mb-4">
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Precio: ${priceRange[0].toLocaleString()} - ${priceRange[1].toLocaleString()}
            </label>
            <input type="range" ... />
          </div>
        )}

        {/* Solo en stock */}
        <label className="flex items-center gap-2 mb-4">
          <input type="checkbox" checked={showInStock} onChange={...} />
          <span className="text-sm">Solo productos en stock</span>
        </label>

        {/* Buscar global */}
        <label className="flex items-center gap-2 mb-4">
          <input type="checkbox" checked={globalSearch} onChange={...} />
          <span className="text-sm">Buscar en todos los colegios</span>
        </label>

        {/* Botones */}
        <div className="flex gap-2 pt-2 border-t">
          <button
            onClick={clearAllFilters}
            className="flex-1 py-2 text-sm text-gray-600 border rounded-lg"
          >
            Limpiar
          </button>
          <button
            onClick={() => setShowFilters(false)}
            className="flex-1 py-2 text-sm bg-brand-600 text-white rounded-lg"
          >
            Aplicar
          </button>
        </div>
      </div>
    </div>

    {/* Panel desktop (mantener similar al actual pero más compacto) */}
    <div className="hidden md:block max-w-7xl mx-auto px-4 py-3">
      {/* Contenido actual simplificado */}
    </div>
  </>
)}
```

### 9.5 Ocultar Historial (mostrar solo al enfocar)

```tsx
// Agregar estado
const [searchFocused, setSearchFocused] = useState(false);

// Input con onFocus/onBlur
<input
  onFocus={() => setSearchFocused(true)}
  onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
  ...
/>

// Historial como dropdown
{searchFocused && !searchQuery && searchHistory.length > 0 && (
  <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border z-20">
    <div className="p-2 text-xs text-gray-500">Búsquedas recientes</div>
    {searchHistory.slice(0, 5).map((q, i) => (
      <button
        key={i}
        onMouseDown={() => setSearchQuery(q)}
        className="w-full px-3 py-2 text-sm text-left hover:bg-gray-50 flex items-center gap-2"
      >
        <Clock className="w-3 h-3 text-gray-400" />
        {q}
      </button>
    ))}
  </div>
)}
```

### 9.6 Nuevo Estado Necesario

```tsx
// Agregar al inicio del componente
const [showSizeDropdown, setShowSizeDropdown] = useState(false);
const [searchFocused, setSearchFocused] = useState(false);

// Calcular si hay filtros activos
const hasActiveFilters = filter !== 'all' || sizeFilter !== 'all' || showInStock ||
  (priceStats && (priceRange[0] !== priceStats.min_price || priceRange[1] !== priceStats.max_price));
```

---

## CSS Adicional (globals.css)

```css
/* Ocultar scrollbar pero mantener scroll */
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
```

---

## Resumen de Cambios

| Elemento | Antes | Después |
|----------|-------|---------|
| Input búsqueda | `py-3 text-base` | `py-2 text-sm` |
| Botones filtro | `px-4 py-2` | `px-3 py-1` |
| Filas filtros | 4 filas separadas | 1 fila compacta |
| Tallas | Fila horizontal | Dropdown |
| Filtros avanzados | Panel expandido | Drawer móvil |
| Historial | Siempre visible | Dropdown al enfocar |
| Indicador activos | Ninguno | Punto en botón |

---

## Orden de Implementación

1. Agregar CSS `.scrollbar-hide`
2. Agregar nuevos estados (`showSizeDropdown`, `searchFocused`, `hasActiveFilters`)
3. Compactar búsqueda + mover botón filtros
4. Crear fila única de chips + dropdown tallas
5. Convertir filtros avanzados en drawer móvil
6. Mover historial a dropdown
7. Eliminar filas separadas antiguas (categorías y tallas)

---

## Testing

| Escenario | Esperado |
|-----------|----------|
| Móvil - Abrir catálogo | Filtros compactos, productos visibles rápido |
| Móvil - Click filtros | Drawer desde abajo |
| Desktop - Ver catálogo | Chips inline, dropdown tallas |
| Seleccionar categoría | Chip se activa |
| Seleccionar talla | Dropdown muestra "T. 4" |
| Filtros activos | Punto indicador en botón |
| Buscar | Historial en dropdown al enfocar |

---

# Parte 10: Mejoras de Contabilidad - Gastos Editables, CxC y Fallback de Caja

## Resumen

Tres mejoras solicitadas para el módulo de contabilidad:

1. **Gastos Pendientes Editables** - Agregar UI para editar gastos (todos los campos si no hay pagos parciales)
2. **Fix Cobro de CxC** - Corregir bug que llama a método inexistente `record_income_payment()`
3. **Fallback Caja Menor → Caja Mayor** - Preguntar al usuario si quiere usar Caja Mayor cuando Caja Menor no alcanza

---

## 10.1 Gastos Pendientes Editables

### Problema

El backend tiene endpoint PATCH `/global/accounting/expenses/{id}` pero el frontend NO tiene UI para editar gastos.

### Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| `frontend/src/pages/Accounting.js` | Agregar botón editar + modal + handlers |

### Implementación

1. Agregar estados: `editingExpense`, `showEditExpenseModal`
2. Agregar botón "Editar" (icono Pencil) junto a botón "Pagar" en widget de gastos
3. Handler `handleEditExpense`: valida que no tenga pagos parciales, carga datos en form
4. Handler `handleUpdateExpense`: llama a `updateGlobalExpense`, recarga lista
5. Modificar modal existente para soportar modo edición (título dinámico, botón dinámico)

---

## 10.2 Fix Cobro de Cuentas por Cobrar

### Problema

En `global_accounting.py` línea ~1504, se llama a `record_income_payment()` que NO existe.

### Archivo a Modificar

| Archivo | Cambios |
|---------|---------|
| `backend/app/api/routes/global_accounting.py` | Cambiar `record_income_payment` → `record_income` |

### Implementación

Buscar en endpoint `pay_global_receivable` (~línea 1452) y cambiar:

```python
# ANTES
await balance_service.record_income_payment(...)

# DESPUÉS
await balance_service.record_income(...)
```

---

## 10.3 Fallback Caja Menor → Caja Mayor

### Problema

Cuando Caja Menor no tiene saldo suficiente para pagar gasto en efectivo, el sistema falla.

### Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| `backend/app/api/routes/global_accounting.py` | Nuevo endpoint `check-balance`, modificar `pay` para fallback |
| `backend/app/schemas/accounting.py` | Agregar `use_fallback` a `ExpensePayment` |
| `backend/app/services/balance_integration.py` | Agregar `record_expense_payment_from_account()` |
| `frontend/src/pages/Accounting.js` | Modal confirmación fallback |
| `frontend/src/services/globalAccountingService.js` | Agregar `checkExpenseBalance()` |

### Implementación Backend

1. **Nuevo endpoint** `POST /expenses/check-balance`:
   - Recibe `{amount, payment_method}`
   - Si es CASH, verifica Caja Menor y Caja Mayor
   - Retorna `{can_pay, source, source_balance, fallback_available, fallback_source, fallback_balance}`

2. **Modificar schema** `ExpensePayment`:
   - Agregar `use_fallback: bool = False`

3. **Nuevo método** `record_expense_payment_from_account(amount, account_key, description)`:
   - Permite especificar cuenta directamente ("caja_mayor")
   - Descuenta de esa cuenta específica

4. **Modificar** `pay_global_expense`:
   - Si `use_fallback=True` y `payment_method=CASH`, usar Caja Mayor

### Implementación Frontend

1. **Estados**: `showCashFallbackModal`, `pendingExpensePayment`, `cashBalances`

2. **Modificar** `handlePayExpense`:
   - Si método es "cash", llamar `checkExpenseBalance` primero
   - Si `insufficient && fallback_available`, mostrar modal
   - Si `!can_pay`, mostrar error con saldos

3. **Modal de confirmación**:
   - Muestra monto, saldo Caja Menor (rojo), saldo Caja Mayor (verde)
   - Botones: "Cancelar" / "Usar Caja Mayor"
   - Al confirmar, llama `payGlobalExpense` con `use_fallback=true`

---

## Orden de Implementación

1. Fix CxC (cambiar método) - 5 min
2. Backend fallback (endpoint + schema + método) - 15 min
3. Frontend editar gastos - 20 min
4. Frontend fallback caja - 15 min
5. Testing

---

## Testing

| Escenario | Esperado |
|-----------|----------|
| Editar gasto sin pagos | Modal abre, se guardan cambios |
| Editar gasto con pago parcial | Error: "No se puede editar" |
| Cobrar CxC en efectivo | Caja Menor incrementa |
| Pagar gasto, Caja Menor alcanza | Pago normal |
| Pagar gasto, Caja Menor NO alcanza | Modal pregunta → Caja Mayor disminuye |
| Ninguna caja alcanza | Error con saldos disponibles |

---

# Parte 11: Sistema de Borradores para Ventas y Encargos

## Resumen

Implementar un sistema que permita a los vendedores:
1. **Pausar/minimizar** una venta o encargo en proceso
2. **Tener múltiples borradores** simultáneos (máximo 5)
3. **Retomar** cualquier borrador cuando lo necesiten
4. **Cancelar/eliminar** borradores que ya no se necesiten
5. **Alerta al cerrar** el navegador si hay borradores pendientes

---

## Arquitectura de la Solución

### Componentes Principales

```
┌─────────────────────────────────────────────────────────┐
│  LAYOUT (Layout.js)                                      │
├─────────────────────────────────────────────────────────┤
│  TOP BAR                                                 │
├─────────────────────────────────────────────────────────┤
│  DRAFTS BAR (nuevo) - Solo visible si hay borradores    │
│  [📋 Venta - $45,000 ×] [📦 Encargo - 3 items ×] [+]   │
├─────────────────────────────────────────────────────────┤
│  MAIN CONTENT (pages)                                    │
└─────────────────────────────────────────────────────────┘
```

### Flujo de Datos

```
                    ┌─────────────────┐
                    │   draftStore    │ (Zustand - memoria)
                    │  (max 5 drafts) │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  SaleModal   │    │  OrderModal  │    │  DraftsBar   │
│  (minimiza)  │    │  (minimiza)  │    │  (restaura)  │
└──────────────┘    └──────────────┘    └──────────────┘
```

---

## Archivos a Crear/Modificar

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `frontend/src/stores/draftStore.ts` | **CREAR** | Store Zustand para borradores |
| `frontend/src/components/DraftsBar.tsx` | **CREAR** | Barra de borradores minimizados |
| `frontend/src/components/Layout.js` | Modificar | Agregar DraftsBar + beforeunload |
| `frontend/src/components/SaleModal.js` | Modificar | Botón minimizar + restaurar estado |
| `frontend/src/components/OrderModal.js` | Modificar | Botón minimizar + restaurar estado |
| `frontend/src/pages/Sales.js` | Modificar | Pasar draftId a SaleModal |
| `frontend/src/pages/Orders.js` | Modificar | Pasar draftId a OrderModal |

---

## Implementación Detallada

### 11.1 Crear draftStore.ts

**Archivo:** `frontend/src/stores/draftStore.ts`

```typescript
import { create } from 'zustand';

// Tipos de borrador
export type DraftType = 'sale' | 'order';

// Estado de un item en el carrito (común para ventas y encargos)
interface DraftItem {
  tempId: string;
  productId?: string;
  productName: string;
  size: string;
  quantity: number;
  unitPrice: number;
  isGlobal?: boolean;
  schoolId?: string;
  schoolName?: string;
  // Para encargos custom/yomber
  orderType?: 'catalog' | 'yomber' | 'custom';
  measurements?: Record<string, number>;
  embroideryText?: string;
  color?: string;
  notes?: string;
}

// Borrador de Venta
interface SaleDraft {
  id: string;
  type: 'sale';
  createdAt: string;
  updatedAt: string;
  schoolId: string;
  clientId: string;
  clientName?: string;
  notes: string;
  isHistorical: boolean;
  historicalDate?: string;
  items: DraftItem[];
  payments: Array<{
    id: string;
    amount: number;
    paymentMethod: string;
  }>;
  total: number;
}

// Borrador de Encargo
interface OrderDraft {
  id: string;
  type: 'order';
  createdAt: string;
  updatedAt: string;
  schoolId: string;
  clientId: string;
  clientName?: string;
  clientEmail?: string;
  deliveryDate: string;
  notes: string;
  advancePayment: number;
  advancePaymentMethod: string;
  activeTab: 'catalog' | 'yomber' | 'custom';
  items: DraftItem[];
  total: number;
}

export type Draft = SaleDraft | OrderDraft;

interface DraftStore {
  drafts: Draft[];
  activeDraftId: string | null;

  // Actions
  addDraft: (draft: Omit<Draft, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updateDraft: (id: string, updates: Partial<Draft>) => void;
  removeDraft: (id: string) => void;
  getDraft: (id: string) => Draft | undefined;
  setActiveDraft: (id: string | null) => void;
  clearAllDrafts: () => void;

  // Computed
  hasDrafts: () => boolean;
  getDraftCount: () => number;
  canAddDraft: () => boolean;
}

const MAX_DRAFTS = 5;

export const useDraftStore = create<DraftStore>((set, get) => ({
  drafts: [],
  activeDraftId: null,

  addDraft: (draftData) => {
    const { drafts } = get();

    // Verificar límite
    if (drafts.length >= MAX_DRAFTS) {
      throw new Error(`Máximo ${MAX_DRAFTS} borradores permitidos`);
    }

    const id = `draft-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    const newDraft: Draft = {
      ...draftData,
      id,
      createdAt: now,
      updatedAt: now,
    } as Draft;

    set({ drafts: [...drafts, newDraft] });
    return id;
  },

  updateDraft: (id, updates) => {
    set(state => ({
      drafts: state.drafts.map(d =>
        d.id === id
          ? { ...d, ...updates, updatedAt: new Date().toISOString() }
          : d
      )
    }));
  },

  removeDraft: (id) => {
    set(state => ({
      drafts: state.drafts.filter(d => d.id !== id),
      activeDraftId: state.activeDraftId === id ? null : state.activeDraftId
    }));
  },

  getDraft: (id) => {
    return get().drafts.find(d => d.id === id);
  },

  setActiveDraft: (id) => {
    set({ activeDraftId: id });
  },

  clearAllDrafts: () => {
    set({ drafts: [], activeDraftId: null });
  },

  hasDrafts: () => get().drafts.length > 0,
  getDraftCount: () => get().drafts.length,
  canAddDraft: () => get().drafts.length < MAX_DRAFTS,
}));
```

### 11.2 Crear DraftsBar.tsx

**Archivo:** `frontend/src/components/DraftsBar.tsx`

```tsx
import React from 'react';
import { ShoppingCart, Package, X, Plus } from 'lucide-react';
import { useDraftStore, Draft } from '../stores/draftStore';

interface DraftsBarProps {
  onOpenSale: (draftId: string) => void;
  onOpenOrder: (draftId: string) => void;
  onNewSale: () => void;
  onNewOrder: () => void;
}

export function DraftsBar({ onOpenSale, onOpenOrder, onNewSale, onNewOrder }: DraftsBarProps) {
  const { drafts, removeDraft, canAddDraft, activeDraftId } = useDraftStore();

  if (drafts.length === 0) return null;

  const formatDraftLabel = (draft: Draft) => {
    if (draft.type === 'sale') {
      const itemCount = draft.items.length;
      return `Venta - ${itemCount} item${itemCount !== 1 ? 's' : ''} - $${draft.total.toLocaleString()}`;
    } else {
      const itemCount = draft.items.length;
      return `Encargo - ${itemCount} item${itemCount !== 1 ? 's' : ''}`;
    }
  };

  const handleClick = (draft: Draft) => {
    if (draft.type === 'sale') {
      onOpenSale(draft.id);
    } else {
      onOpenOrder(draft.id);
    }
  };

  const handleRemove = (e: React.MouseEvent, draftId: string) => {
    e.stopPropagation();
    if (confirm('¿Eliminar este borrador? Se perderán los datos.')) {
      removeDraft(draftId);
    }
  };

  return (
    <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-b border-blue-200 px-4 py-2">
      <div className="max-w-7xl mx-auto flex items-center gap-2 overflow-x-auto">
        <span className="text-xs font-medium text-gray-500 whitespace-nowrap mr-2">
          Borradores ({drafts.length}/5):
        </span>

        {drafts.map(draft => (
          <button
            key={draft.id}
            onClick={() => handleClick(draft)}
            className={`
              flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium
              transition-all whitespace-nowrap group
              ${activeDraftId === draft.id
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-white text-gray-700 border border-gray-200 hover:border-blue-400 hover:shadow'
              }
            `}
          >
            {draft.type === 'sale' ? (
              <ShoppingCart className="w-4 h-4" />
            ) : (
              <Package className="w-4 h-4" />
            )}
            <span className="max-w-[150px] truncate">
              {formatDraftLabel(draft)}
            </span>
            <button
              onClick={(e) => handleRemove(e, draft.id)}
              className={`
                ml-1 p-0.5 rounded-full transition-colors
                ${activeDraftId === draft.id
                  ? 'hover:bg-blue-500'
                  : 'hover:bg-red-100 hover:text-red-600'
                }
              `}
            >
              <X className="w-3 h-3" />
            </button>
          </button>
        ))}

        {/* Botones para nuevo borrador */}
        {canAddDraft() && (
          <div className="flex items-center gap-1 ml-2 pl-2 border-l border-gray-300">
            <button
              onClick={onNewSale}
              className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:bg-blue-100 rounded"
              title="Nueva venta"
            >
              <Plus className="w-3 h-3" />
              <ShoppingCart className="w-3 h-3" />
            </button>
            <button
              onClick={onNewOrder}
              className="flex items-center gap-1 px-2 py-1 text-xs text-purple-600 hover:bg-purple-100 rounded"
              title="Nuevo encargo"
            >
              <Plus className="w-3 h-3" />
              <Package className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

### 11.3 Modificar Layout.js

**Archivo:** `frontend/src/components/Layout.js`

Agregar:
1. Importar DraftsBar y useDraftStore
2. Estado para controlar modales de venta/encargo
3. Hook `beforeunload` para alertar al cerrar
4. Renderizar DraftsBar debajo del top bar

```javascript
// Agregar imports
import { DraftsBar } from './DraftsBar';
import { useDraftStore } from '../stores/draftStore';
import { SaleModal } from './SaleModal';
import { OrderModal } from './OrderModal';

// Dentro del componente Layout:
const { hasDrafts, drafts } = useDraftStore();
const [saleModalOpen, setSaleModalOpen] = useState(false);
const [orderModalOpen, setOrderModalOpen] = useState(false);
const [activeDraftId, setActiveDraftId] = useState<string | null>(null);

// Hook beforeunload - alertar si hay borradores
useEffect(() => {
  const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    if (hasDrafts()) {
      e.preventDefault();
      e.returnValue = 'Tienes borradores sin guardar. ¿Estás seguro de salir?';
      return e.returnValue;
    }
  };

  window.addEventListener('beforeunload', handleBeforeUnload);
  return () => window.removeEventListener('beforeunload', handleBeforeUnload);
}, [hasDrafts]);

// Handlers para abrir modales desde DraftsBar
const handleOpenSaleDraft = (draftId: string) => {
  setActiveDraftId(draftId);
  setSaleModalOpen(true);
};

const handleOpenOrderDraft = (draftId: string) => {
  setActiveDraftId(draftId);
  setOrderModalOpen(true);
};

// En el JSX, después del top bar:
{hasDrafts() && (
  <DraftsBar
    onOpenSale={handleOpenSaleDraft}
    onOpenOrder={handleOpenOrderDraft}
    onNewSale={() => { setActiveDraftId(null); setSaleModalOpen(true); }}
    onNewOrder={() => { setActiveDraftId(null); setOrderModalOpen(true); }}
  />
)}

// Modales globales (al final del componente)
<SaleModal
  isOpen={saleModalOpen}
  onClose={() => setSaleModalOpen(false)}
  onSuccess={() => { /* refresh data */ }}
  draftId={activeDraftId}
/>
<OrderModal
  isOpen={orderModalOpen}
  onClose={() => setOrderModalOpen(false)}
  onSuccess={() => { /* refresh data */ }}
  draftId={activeDraftId}
/>
```

### 11.4 Modificar SaleModal.js

**Cambios principales:**

1. Recibir prop `draftId` opcional
2. Agregar botón "Minimizar" en el header del modal
3. Restaurar estado desde draft si existe
4. Guardar a draft al minimizar (en lugar de perder datos)
5. NO llamar resetForm al minimizar

```javascript
// Props adicionales
interface SaleModalProps {
  // ... existentes
  draftId?: string | null;  // NUEVO
}

// Imports adicionales
import { useDraftStore } from '../stores/draftStore';

// Dentro del componente:
const { addDraft, updateDraft, getDraft, removeDraft, setActiveDraft } = useDraftStore();

// Efecto para restaurar desde draft
useEffect(() => {
  if (isOpen && draftId) {
    const draft = getDraft(draftId);
    if (draft && draft.type === 'sale') {
      // Restaurar estado desde el borrador
      setSelectedSchoolId(draft.schoolId);
      setFormData({
        client_id: draft.clientId,
        notes: draft.notes,
        is_historical: draft.isHistorical,
        // ... etc
      });
      setItems(draft.items);
      setPayments(draft.payments);
      setActiveDraft(draftId);
    }
  } else if (isOpen && !draftId) {
    // Nueva venta - resetear
    resetForm();
  }
}, [isOpen, draftId]);

// Handler para minimizar
const handleMinimize = () => {
  // Calcular total
  const total = items.reduce((sum, i) => sum + (i.quantity * i.unitPrice), 0);

  const draftData = {
    type: 'sale' as const,
    schoolId: selectedSchoolId,
    clientId: formData.client_id,
    notes: formData.notes,
    isHistorical: formData.is_historical,
    items: items,
    payments: payments,
    total: total,
  };

  if (draftId) {
    // Actualizar borrador existente
    updateDraft(draftId, draftData);
  } else if (items.length > 0) {
    // Crear nuevo borrador solo si hay items
    addDraft(draftData);
  }

  setActiveDraft(null);
  onClose(); // Cerrar sin resetear
};

// Handler para guardar exitosamente
const handleSuccess = () => {
  // Si era un borrador, eliminarlo
  if (draftId) {
    removeDraft(draftId);
  }
  resetForm();
  onSuccess();
  onClose();
};

// En el header del modal, agregar botón minimizar:
<div className="flex items-center gap-2">
  {items.length > 0 && (
    <button
      onClick={handleMinimize}
      className="p-2 hover:bg-gray-100 rounded-lg text-gray-500"
      title="Minimizar y guardar borrador"
    >
      <Minimize2 className="w-5 h-5" />
    </button>
  )}
  <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
    <X className="w-5 h-5" />
  </button>
</div>
```

### 11.5 Modificar OrderModal.js

**Cambios similares a SaleModal:**

1. Recibir prop `draftId`
2. Botón "Minimizar"
3. Restaurar desde draft
4. Guardar a draft al minimizar

```javascript
// El patrón es idéntico a SaleModal pero con los campos de Order:
const draftData = {
  type: 'order' as const,
  schoolId: selectedSchoolId,
  clientId: clientId,
  clientEmail: selectedClientEmail,
  deliveryDate: deliveryDate,
  notes: notes,
  advancePayment: advancePayment,
  advancePaymentMethod: advancePaymentMethod,
  activeTab: activeTab,
  items: items,
  total: items.reduce((sum, i) => sum + (i.quantity * i.unitPrice), 0),
};
```

### 11.6 Modificar Sales.js y Orders.js

**Simplificar** - ya no manejan el modal directamente, solo pasan datos iniciales:

```javascript
// Sales.js - Simplificado
// El modal ahora está en Layout.js
// Solo necesita trigger para abrir modal nuevo

const handleNewSale = () => {
  // Emitir evento o usar context para abrir modal en Layout
  // O mantener modal local pero sin draftId
};
```

**Alternativa:** Mantener los modales en las páginas pero compartir el draftStore.

---

## UI del Modal con Minimizar

```
┌────────────────────────────────────────────────┐
│ Nueva Venta                    [_] [×]         │  ← [_] = Minimizar
├────────────────────────────────────────────────┤
│                                                │
│  ... contenido del modal ...                   │
│                                                │
└────────────────────────────────────────────────┘
```

---

## Orden de Implementación

1. **Crear draftStore.ts** - Store Zustand con tipos y acciones
2. **Crear DraftsBar.tsx** - Componente de UI para borradores
3. **Modificar SaleModal.js** - Agregar minimizar + restaurar
4. **Modificar OrderModal.js** - Agregar minimizar + restaurar
5. **Modificar Layout.js** - Integrar DraftsBar + beforeunload
6. **Testing manual** - Probar flujos completos

---

## Testing

| Escenario | Resultado Esperado |
|-----------|-------------------|
| Crear venta, agregar items, minimizar | Aparece en DraftsBar |
| Click en borrador | Modal abre con datos restaurados |
| Completar venta desde borrador | Borrador se elimina |
| Minimizar encargo con medidas Yomber | Medidas se preservan |
| Cerrar navegador con borradores | Alerta de confirmación |
| Intentar crear 6to borrador | Error: máximo 5 |
| Click X en borrador | Confirma y elimina |
| Crear venta vacía y cerrar | NO crea borrador |

---

## Consideraciones Técnicas

### Persistencia

Los borradores se mantienen **solo en memoria** (Zustand sin persist). Esto significa:
- Se pierden al recargar la página
- La alerta `beforeunload` avisa al usuario
- Si se quiere persistencia, agregar middleware `persist` a Zustand

### Performance

- Máximo 5 borradores limita uso de memoria
- Items almacenan solo datos esenciales (no objetos completos)
- DraftsBar usa `truncate` para nombres largos

### UX

- Borrador activo se destaca visualmente
- Confirmación antes de eliminar
- Iconos distintivos para venta vs encargo
- Contador visible (3/5)

---

## Verificación Final

- [ ] Se pueden crear hasta 5 borradores
- [ ] Minimizar guarda el estado completo
- [ ] Click en borrador restaura datos
- [ ] Completar venta/encargo elimina borrador
- [ ] X en borrador pide confirmación
- [ ] Cerrar navegador con borradores muestra alerta
- [ ] Items, pagos y medidas se preservan
- [ ] Modales funcionan igual cuando no hay draft
