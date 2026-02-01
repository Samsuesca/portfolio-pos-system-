# 🔄 Sistema de Cambios y Devoluciones - Interfaz de Usuario

**Versión**: 2.0.0
**Fecha**: 2025-10-20
**Estado**: Implementado ✅

---

## 📋 Descripción General

Sistema completo de interfaz de usuario para gestionar cambios y devoluciones de productos vendidos. Permite a vendedores solicitar cambios y a administradores aprobarlos o rechazarlos con ajuste automático de inventario.

---

## 🏗️ Arquitectura Frontend

### Componentes Implementados

#### 1. **SaleChangeModal.tsx**
**Ubicación**: `frontend/src/components/SaleChangeModal.tsx`
**Propósito**: Modal para crear solicitudes de cambio/devolución
**Características**:
- Selección de tipo de cambio (talla, producto, devolución, defecto)
- Selección de producto original de la venta
- Control de cantidades con validación
- Selección de producto nuevo (con stock en tiempo real)
- Campo de motivo/notas
- Validación completa antes de enviar

**Props**:
```typescript
interface SaleChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  schoolId: string;
  saleId: string;
  saleItems: SaleItem[];
}
```

**Tipos de Cambio Soportados**:
- `size_change`: Cambio de Talla (ej: T14 → T16)
- `product_change`: Cambio de Producto (ej: Camisa → Pantalón)
- `return`: Devolución sin reemplazo (reembolso)
- `defect`: Producto Defectuoso

#### 2. **SaleChanges.tsx**
**Ubicación**: `frontend/src/pages/SaleChanges.tsx`
**Propósito**: Página administrativa para gestionar todas las solicitudes
**Características**:
- Dashboard con estadísticas (pendientes, aprobadas, rechazadas)
- Tabla completa de todas las solicitudes
- Filtros por estado y tipo
- Botones de aprobar/rechazar para cambios pendientes
- Link directo a la venta original
- Confirmaciones antes de acciones destructivas

**Acciones Administrativas**:
- **Aprobar**: Cambia estado a APPROVED y ajusta inventario automáticamente
- **Rechazar**: Cambia estado a REJECTED sin afectar inventario, requiere motivo

#### 3. **SaleDetail.tsx (Modificado)**
**Ubicación**: `frontend/src/pages/SaleDetail.tsx`
**Modificaciones**:
- Botón "Cambio/Devolución" en header (color naranja)
- Sección "Historial de Cambios y Devoluciones"
- Integración del SaleChangeModal
- Carga automática de cambios al ver la venta

---

## 🎨 Diseño e Interfaz

### Paleta de Colores por Estado

| Estado     | Color de Fondo | Color de Texto | Icono       |
|-----------|----------------|----------------|-------------|
| PENDING   | Amarillo claro | Amarillo oscuro| Clock ⏰    |
| APPROVED  | Verde claro    | Verde oscuro   | CheckCircle ✅ |
| REJECTED  | Rojo claro     | Rojo oscuro    | XCircle ❌   |

### Iconografía

- **RefreshCw**: Cambios/Devoluciones (general)
- **Clock**: Estado pendiente
- **CheckCircle**: Estado aprobado / Botón aprobar
- **XCircle**: Estado rechazado / Botón rechazar
- **Eye**: Ver detalle de venta
- **AlertCircle**: Mensajes de error

---

## 🔌 Integración con API

### Service Layer

**Archivo**: `frontend/src/services/saleChangeService.ts`

**Métodos**:

```typescript
// Crear nueva solicitud de cambio
async createChange(
  schoolId: string,
  saleId: string,
  data: SaleChangeCreate
): Promise<SaleChange>

// Obtener cambios de una venta específica
async getSaleChanges(
  schoolId: string,
  saleId: string
): Promise<SaleChangeListItem[]>

// Aprobar cambio (ADMIN)
async approveChange(
  schoolId: string,
  saleId: string,
  changeId: string
): Promise<SaleChange>

// Rechazar cambio (ADMIN)
async rejectChange(
  schoolId: string,
  saleId: string,
  changeId: string,
  rejectionReason: string
): Promise<SaleChange>
```

### Endpoints Utilizados

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST   | `/schools/{id}/sales/{id}/changes` | Crear cambio |
| GET    | `/schools/{id}/sales/{id}/changes` | Listar cambios de venta |
| PATCH  | `/schools/{id}/sales/{id}/changes/{id}/approve` | Aprobar |
| PATCH  | `/schools/{id}/sales/{id}/changes/{id}/reject` | Rechazar |

---

## 📊 Tipos TypeScript

**Archivo**: `frontend/src/types/api.ts`

```typescript
export type ChangeType = 'size_change' | 'product_change' | 'return' | 'defect';
export type ChangeStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface SaleChange {
  id: string;
  sale_id: string;
  original_item_id: string;
  new_product_id: string | null;
  change_type: ChangeType;
  status: ChangeStatus;
  returned_quantity: number;
  new_quantity: number;
  price_adjustment: number;
  reason: string | null;
  rejection_reason: string | null;
  change_date: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface SaleChangeCreate {
  original_item_id: string;
  new_product_id?: string;
  change_type: ChangeType;
  returned_quantity: number;
  new_quantity?: number;
  reason?: string;
}

export interface SaleChangeListItem {
  id: string;
  sale_id: string;
  sale_code: string;
  change_type: ChangeType;
  status: ChangeStatus;
  returned_quantity: number;
  new_quantity: number;
  price_adjustment: number;
  change_date: string;
  reason: string | null;
}
```

---

## 🚀 Flujo de Usuario

### Para Vendedores (Crear Solicitud)

1. **Navegar a Detalle de Venta**
   - Ir a "Ventas" → Seleccionar una venta

2. **Abrir Modal de Cambio**
   - Clic en botón "Cambio/Devolución" (naranja)

3. **Completar Formulario**
   - Seleccionar tipo de cambio
   - Elegir producto original a devolver
   - Especificar cantidad a devolver
   - Si NO es devolución:
     - Seleccionar producto nuevo
     - Especificar cantidad nueva
   - Agregar motivo (opcional)

4. **Enviar Solicitud**
   - Clic en "Crear Solicitud"
   - El sistema valida y crea el cambio con estado PENDING
   - Modal se cierra y aparece en historial

### Para Administradores (Gestionar Solicitudes)

1. **Navegar a Gestión de Cambios**
   - Sidebar → "Cambios/Devoluciones"

2. **Revisar Dashboard**
   - Ver estadísticas: pendientes, aprobadas, rechazadas
   - Usar filtros para encontrar solicitudes específicas

3. **Aprobar Cambio**
   - Localizar cambio PENDING
   - Clic en botón verde (CheckCircle)
   - Confirmar en diálogo
   - Sistema:
     - Cambia estado a APPROVED
     - Ajusta inventario (+devuelto, -nuevo)
     - Recarga tabla

4. **Rechazar Cambio**
   - Localizar cambio PENDING
   - Clic en botón rojo (XCircle)
   - Ingresar motivo del rechazo (obligatorio)
   - Confirmar
   - Sistema:
     - Cambia estado a REJECTED
     - NO afecta inventario
     - Guarda motivo de rechazo

---

## ✅ Validaciones Implementadas

### En el Modal de Solicitud

- ✅ Producto original debe estar en la venta
- ✅ Cantidad a devolver no puede exceder cantidad vendida
- ✅ Producto nuevo requerido si tipo NO es "return"
- ✅ Producto nuevo debe tener stock disponible
- ✅ Cantidades deben ser números positivos
- ✅ Validación de campos requeridos antes de enviar

### En la Aprobación (Backend)

- ✅ Stock del producto nuevo suficiente
- ✅ Cambio debe estar en estado PENDING
- ✅ Usuario debe tener permisos de ADMIN
- ✅ Validación de integridad de datos

---

## 🎯 Casos de Uso Cubiertos

### Caso 1: Cambio de Talla Simple
**Escenario**: Cliente compró T14 pero necesita T16

1. Vendedor abre venta
2. Solicita cambio tipo "size_change"
3. Original: Camisa Polo Azul T14 (qty: 1)
4. Nuevo: Camisa Polo Azul T16 (qty: 1)
5. Admin aprueba
6. **Resultado**: Stock T14 +1, Stock T16 -1, price_adjustment = 0

### Caso 2: Cambio de Producto
**Escenario**: Cliente quiere cambiar camisa por pantalón

1. Vendedor solicita cambio tipo "product_change"
2. Original: Camisa Polo ($40.000)
3. Nuevo: Pantalón ($60.000)
4. Admin aprueba
5. **Resultado**: Stock camisa +1, stock pantalón -1, price_adjustment = +$20.000

### Caso 3: Devolución Completa
**Escenario**: Cliente quiere reembolso

1. Vendedor solicita cambio tipo "return"
2. Original: Camisa Polo ($40.000, qty: 2)
3. No selecciona producto nuevo
4. Admin aprueba
5. **Resultado**: Stock camisa +2, price_adjustment = -$80.000 (reembolso)

### Caso 4: Producto Defectuoso
**Escenario**: Producto con falla de fábrica

1. Vendedor solicita cambio tipo "defect"
2. Motivo: "Costura despegada en manga derecha"
3. Original: Camisa ($40.000)
4. Nuevo: Camisa misma talla ($40.000)
5. Admin aprueba
6. **Resultado**: Stock +1/-1, price_adjustment = 0

### Caso 5: Rechazo de Solicitud
**Escenario**: Cliente excede política de cambios

1. Vendedor crea solicitud
2. Admin revisa
3. Admin rechaza con motivo: "Fuera del período de garantía (30 días)"
4. **Resultado**: Estado REJECTED, sin cambios en inventario

---

## 🔐 Permisos y Seguridad

### Roles

| Acción              | VIEWER | SELLER | ADMIN | SUPERUSER |
|---------------------|--------|--------|-------|-----------|
| Ver cambios         | ✅     | ✅     | ✅    | ✅        |
| Crear solicitud     | ❌     | ✅     | ✅    | ✅        |
| Aprobar/Rechazar    | ❌     | ❌     | ✅    | ✅        |

### Validación de Acceso

- Todas las rutas protegidas requieren autenticación JWT
- `schoolId` validado en cada request
- Usuario debe tener acceso al colegio específico
- Acciones administrativas verifican rol ADMIN+

---

## 📱 Rutas Frontend

| Ruta                  | Componente      | Descripción                    |
|-----------------------|-----------------|--------------------------------|
| `/sales/:saleId`      | SaleDetail      | Ver venta + solicitar cambio   |
| `/sale-changes`       | SaleChanges     | Gestionar todas las solicitudes|

**Navegación**:
- Sidebar → "Cambios/Devoluciones" (icono RefreshCw)
- Desde SaleDetail → Botón "Cambio/Devolución"
- Desde SaleChanges → Link en código de venta

---

## 🎨 Componentes UI Reutilizables

### Badges de Estado

```tsx
<span className={`px-2 py-1 inline-flex items-center gap-1 text-xs font-semibold rounded-full ${getChangeStatusColor(status)}`}>
  {getChangeStatusIcon(status)}
  {status}
</span>
```

### Tabla Responsiva

- Scroll horizontal en móviles
- Columnas: Venta, Fecha, Tipo, Cantidades, Ajuste, Estado, Motivo, Acciones
- Hover effect en filas
- Loading spinner durante operaciones

### Filtros

- Dropdown de estado (Todos/Pendientes/Aprobadas/Rechazadas)
- Dropdown de tipo (Todos/Cambio de Talla/etc.)
- Filtrado en tiempo real (cliente-side)

---

## 🐛 Manejo de Errores

### Mensajes de Error Comunes

| Error | Mensaje | Acción |
|-------|---------|--------|
| Stock insuficiente | "No hay suficiente stock del producto nuevo" | Revisar inventario |
| Cambio no encontrado | "Error al cargar las solicitudes de cambio" | Verificar ID |
| Sin permisos | "No tienes permisos para esta acción" | Verificar rol |
| Validación fallida | "Selecciona el producto a cambiar/devolver" | Completar campos |

### Estados de Error

- Error en carga: Banner rojo con opción "Reintentar"
- Error en formulario: Alert en modal con descripción
- Error en acción: Alert temporal + recarga de datos

---

## 📊 Indicadores Visuales

### Dashboard Stats

```tsx
<div className="grid grid-cols-3 gap-4">
  <StatCard
    label="Pendientes"
    count={pendingCount}
    color="yellow"
    icon={Clock}
  />
  <StatCard
    label="Aprobadas"
    count={approvedCount}
    color="green"
    icon={CheckCircle}
  />
  <StatCard
    label="Rechazadas"
    count={rejectedCount}
    color="red"
    icon={XCircle}
  />
</div>
```

### Ajuste de Precio

- **Positivo** (cliente debe pagar): Texto verde
- **Negativo** (reembolso): Texto rojo
- **Cero**: Texto normal

---

## 🧪 Testing Recomendado

### Test de Integración

1. Crear venta con múltiples productos
2. Solicitar cambio de cada tipo
3. Verificar que aparecen en admin
4. Aprobar algunos, rechazar otros
5. Verificar ajustes de inventario
6. Verificar historial actualizado

### Test de Validación

1. Intentar devolver más de lo vendido (debe fallar)
2. Intentar cambiar por producto sin stock (debe mostrar advertencia)
3. Intentar aprobar sin ser admin (debe negar)
4. Intentar rechazar sin motivo (debe pedir motivo)

### Test de UI

1. Modal responsive en diferentes tamaños
2. Tabla con scroll horizontal en móvil
3. Filtros funcionan correctamente
4. Loading states visibles
5. Confirmaciones aparecen

---

## 📝 Notas de Implementación

### Decisiones de Diseño

1. **Modal vs Página Completa**: Modal elegido para cambios porque mantiene contexto de la venta
2. **Confirmaciones**: Usamos `confirm()` nativo por simplicidad, podría mejorarse con modal custom
3. **Filtros**: Cliente-side porque dataset pequeño, migrar a server-side si crece
4. **Recarga**: Recargamos toda la lista tras aprobar/rechazar para garantizar datos frescos

### Mejoras Futuras

- [ ] Modal de confirmación personalizado (más elegante)
- [ ] Paginación en tabla de cambios
- [ ] Búsqueda por código de venta
- [ ] Notificaciones en tiempo real (WebSocket)
- [ ] Histórico de cambios en perfil de cliente
- [ ] Reportes de cambios por período
- [ ] Exportación a Excel/PDF

---

## 🔗 Referencias

- **Backend Docs**: [docs/SALE_CHANGES.md](./SALE_CHANGES.md)
- **Database Schema**: [docs/DATABASE.md](./DATABASE.md)
- **API Endpoints**: [backend/app/api/routes/sale_changes.py](../backend/app/api/routes/sale_changes.py)
- **Service Layer**: [backend/app/services/sale_change.py](../backend/app/services/sale_change.py)

---

**Implementado por**: Claude AI & Angel Samuel Suesca
**Fecha de implementación**: 2025-10-20
**Versión del sistema**: 2.0.0-dev
