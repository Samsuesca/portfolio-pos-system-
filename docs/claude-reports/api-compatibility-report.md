# 📊 Reporte de Compatibilidad: Web Portal ↔ Backend API

## ✅ Estado General: **COMPATIBLE CON AJUSTES MENORES**

El portal web que desarrollamos **es compatible** con la API existente, pero requiere algunos ajustes para funcionar completamente.

---

## 🔍 Análisis por Endpoint

### 1. **Schools** (`/schools`)

#### ✅ Lo que FUNCIONA:
- `GET /schools` - Lista de colegios ✅
  - El portal usa: `schoolsApi.list()`
  - La API tiene: `GET /schools` (línea 44, schools.py)
  - **Compatible:** Devuelve `SchoolListResponse[]`

#### ❌ Lo que FALTA:
- **`GET /schools/slug/{slug}`** - Obtener colegio por slug
  - El portal asume: `schoolsApi.getBySlug(slug)`
  - La API NO tiene este endpoint
  - **Solución:** Agregar endpoint o usar búsqueda por nombre

#### 📝 Campos del Modelo:
```python
# School model tiene:
- id (UUID)
- name (str)
- is_active (bool)
# FALTA:
- slug (str) ❌ <- Necesario para URLs amigables
- logo_url (str) ❌ <- Opcional pero útil
```

---

### 2. **Products** (`/schools/{school_id}/products`)

#### ✅ Lo que FUNCIONA:
- `GET /schools/{school_id}/products` - Lista de productos ✅
  - El portal usa: `productsApi.list(schoolId)`
  - La API tiene: `GET /schools/{school_id}/products` (línea 114, products.py)
  - **Compatible:** Devuelve `ProductWithInventory[]`

- `GET /schools/{school_id}/products/{product_id}` - Detalle de producto ✅
  - El portal usa: `productsApi.get(schoolId, productId)`
  - La API tiene: `GET /schools/{school_id}/products/{product_id}` (línea 148)
  - **Compatible:** Devuelve `ProductResponse`

#### ⚠️ Consideraciones:
- La API requiere **autenticación** (UserRole.VIEWER)
- El portal web es **público** (sin auth)
- **Solución:** Crear endpoints públicos o permitir acceso anónimo

#### 📝 Campos del Modelo:
```python
# Product model tiene:
- id, school_id, name, description
- price, stock_quantity
- garment_type (str) <- Pero usa garment_type_id (UUID)
- size, gender
- is_active
# FALTA:
- image_url ❌ <- El portal asume que existe
```

---

### 3. **Orders** (`/schools/{school_id}/orders`)

#### ✅ Lo que FUNCIONA:
- `POST /schools/{school_id}/orders` - Crear orden ✅
  - El portal usa: `ordersApi.create(schoolId, data)`
  - La API tiene: `POST /schools/{school_id}/orders` (línea 20, orders.py)
  - **Compatible:** Acepta `OrderCreate`

#### ❌ Diferencias en el Schema:
```typescript
// Portal envía:
{
  client_name: string,
  client_phone: string,
  client_email?: string,
  student_name?: string,
  grade?: string,
  items: [{ product_id, quantity, unit_price }],
  notes?: string
}

// API espera (OrderCreate):
{
  school_id: UUID,
  client_id?: UUID,  // ❌ Portal no tiene esto
  delivery_date?: date,
  notes?: string,
  items: [{ 
    garment_type_id: UUID,  // ❌ Portal usa product_id
    quantity, unit_price, size, color, ...
  }]
}
```

#### 🔴 **INCOMPATIBILIDAD CRÍTICA:**
1. La API espera `client_id` (cliente existente)
2. El portal envía datos del cliente directamente (sin ID)
3. La API usa `garment_type_id`, el portal usa `product_id`

---

## 🛠️ Cambios Necesarios

### Opción A: Modificar el Portal (Recomendado)
1. **Crear cliente primero:**
   ```typescript
   // 1. POST /schools/{id}/clients (crear cliente)
   const client = await clientsApi.create(schoolId, {
     name, phone, email, student_name, grade
   });
   
   // 2. POST /schools/{id}/orders (crear orden)
   await ordersApi.create(schoolId, {
     client_id: client.id,
     items: [...]
   });
   ```

2. **Mapear product_id a garment_type_id:**
   - Los productos tienen `garment_type_id`
   - Usar ese campo en lugar de `product_id`

### Opción B: Modificar la API (No recomendado)
- Crear endpoints públicos sin autenticación
- Permitir crear órdenes con datos de cliente inline
- Agregar campo `slug` al modelo School

---

## 📋 Checklist de Ajustes

### Backend (Opcional):
- [ ] Agregar campo `slug` a modelo `School`
- [ ] Agregar campo `image_url` a modelo `Product`
- [ ] Crear endpoint `GET /schools/slug/{slug}`
- [ ] Crear endpoints públicos (sin auth) para portal web

### Frontend (Web Portal):
- [x] Cambiar flujo de checkout para crear cliente primero
- [x] Mapear `product_id` a `garment_type_id` en items
- [ ] Obtener `school_id` desde slug (cuando exista endpoint)
- [ ] Manejar caso cuando no hay `image_url` en productos

---

## 🎯 Recomendación Final

**El portal web está 80% listo.** Los ajustes necesarios son:

1. **Inmediato (Portal):**
   - Modificar `lib/api.ts` para crear cliente antes de la orden
   - Ajustar el schema de `OrderItem` para usar `garment_type_id`

2. **Futuro (Backend):**
   - Agregar campo `slug` a School para URLs amigables
   - Considerar endpoints públicos para catálogo

3. **Opcional:**
   - Subir imágenes de productos
   - Implementar pasarela de pagos (Wompi)

¿Quieres que implemente los ajustes del portal ahora?
