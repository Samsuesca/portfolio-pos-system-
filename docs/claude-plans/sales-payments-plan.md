# Plan: Sales Payments, Product Creation & TypeScript Fixes

## Resumen de Hallazgos

### 1. Tabla `sales_payments` - Estado Actual

**Ubicacion:** `backend/app/models/sale.py:282-327`

La tabla `SalePayment` permite multiples pagos por venta (pagos parciales). Cada registro tiene:
- `sale_id` (FK a sales)
- `amount` (monto del pago)
- `payment_method` (CASH, NEQUI, TRANSFER, CARD, CREDIT)
- `transaction_id` (opcional, link a contabilidad)

**Flujo actual de ventas-contabilidad (`backend/app/services/sale.py:230-312`):**
1. Se crea la venta con items
2. Si `sale_data.payments` existe → crea `SalePayment` records y procesa contabilidad
3. Si solo `sale.payment_method` existe → procesa contabilidad directamente
4. Para cada pago NO-CREDIT → crea `Transaction` y actualiza `BalanceAccount`
5. Para pagos CREDIT → crea `AccountsReceivable`

**BUG IDENTIFICADO:** Si no se proporciona ni `payments` ni `payment_method`, la venta se crea sin ningun registro contable. El schema actual (`backend/app/schemas/sale.py:103-108`) solo valida que no se usen ambos, pero NO requiere al menos uno.

### 2. Creacion de Productos - Limitaciones Actuales

**Problema:** El `ProductModal` requiere seleccionar un `garment_type_id` de tipos existentes. No hay opcion para crear nuevos tipos desde el modal.

**Tab "Tipos de Prenda":** Solo visible para SUPERUSER (`Products.tsx:642`), lo que bloquea a usuarios ADMIN.

---

## Tareas a Implementar

### Parte A: Correccion y Prevencion de Ventas sin Pago

#### A1. Agregar validacion en schema para requerir metodo de pago
**Archivo:** `backend/app/schemas/sale.py`

Modificar el `model_validator` en `SaleCreate` para:
```python
@model_validator(mode='after')
def validate_payment_fields(self):
    if self.payments and self.payment_method:
        raise ValueError("Use either 'payment_method' or 'payments', not both")
    if not self.payments and not self.payment_method and not self.is_historical:
        raise ValueError("Se requiere 'payment_method' o 'payments' para ventas no historicas")
    return self
```

#### A2. Crear endpoint para agregar pago a venta existente
**Archivo:** `backend/app/api/routes/sales.py`

Nuevo endpoint: `POST /schools/{school_id}/sales/{sale_id}/payments`

Schema de entrada:
```python
class AddPaymentToSale(BaseSchema):
    amount: Decimal
    payment_method: PaymentMethod
    notes: str | None = None
    apply_accounting: bool = True  # Si crear transaccion contable
```

Logica:
1. Verificar que la venta existe y pertenece al colegio
2. Crear registro `SalePayment`
3. Si `apply_accounting=True` y metodo != CREDIT:
   - Crear `Transaction`
   - Aplicar a `BalanceAccount` via `BalanceIntegrationService`
4. Si metodo == CREDIT:
   - Crear/actualizar `AccountsReceivable`

#### A3. Agregar metodo al servicio de ventas
**Archivo:** `backend/app/services/sale.py`

```python
async def add_payment_to_sale(
    self,
    sale_id: UUID,
    payment_data: AddPaymentToSale,
    user_id: UUID
) -> SalePayment:
    # Implementacion
```

---

### Parte B: Creacion de Productos con Tipos de Prenda Inline

#### B1. Crear QuickGarmentTypeModal componente
**Archivo nuevo:** `frontend/src/components/QuickGarmentTypeModal.tsx`

Modal simplificado con campos minimos:
- Nombre (requerido)
- Categoria (dropdown: uniforme_formal, uniforme_deportivo, accesorios, calzado)
- Descripcion (opcional)

#### B2. Modificar ProductModal para incluir creacion inline
**Archivo:** `frontend/src/components/ProductModal.tsx`

Cambios:
1. Agregar state para controlar `QuickGarmentTypeModal`
2. Agregar boton "+" junto al dropdown de tipos
3. Al crear un nuevo tipo, seleccionarlo automaticamente en el dropdown
4. Recargar lista de tipos despues de crear

UI propuesta:
```tsx
<div className="flex gap-2">
  <select ... className="flex-1">
    {/* opciones */}
  </select>
  <button
    type="button"
    onClick={() => setShowQuickTypeModal(true)}
    className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg"
    title="Crear nuevo tipo de prenda"
  >
    <Plus className="w-5 h-5" />
  </button>
</div>
```

#### B3. Hacer visible tab "Tipos de Prenda" para ADMIN
**Archivo:** `frontend/src/pages/Products.tsx`

Cambiar condicion de visibilidad:
```tsx
// Antes: {isSuperuser && (...)}
// Despues:
{(isSuperuser || isAdmin) && (
  <button onClick={() => setActiveTab('garment-types')} ...>
    Tipos de Prenda
  </button>
)}
```

---

## Archivos a Modificar

### Backend
| Archivo | Cambio |
|---------|--------|
| `backend/app/schemas/sale.py` | Agregar validacion requerida de pago |
| `backend/app/services/sale.py` | Agregar metodo `add_payment_to_sale` |
| `backend/app/api/routes/sales.py` | Agregar endpoint POST payments |

### Frontend
| Archivo | Cambio |
|---------|--------|
| `frontend/src/components/QuickGarmentTypeModal.tsx` | Crear nuevo componente |
| `frontend/src/components/ProductModal.tsx` | Integrar boton + modal inline |
| `frontend/src/pages/Products.tsx` | Mostrar tab para ADMIN |

---

## Orden de Implementacion

1. **Backend - Validacion schema** (previene futuras ventas sin pago)
2. **Backend - Endpoint add payment** (permite corregir ventas existentes)
3. **Frontend - QuickGarmentTypeModal** (componente reutilizable)
4. **Frontend - ProductModal** (integrar creacion inline)
5. **Frontend - Products.tsx** (visibilidad tab para ADMIN)

---

## Notas Adicionales

- El endpoint de agregar pago debe considerar ventas que ya tengan pagos parciales (validar que el total no exceda el monto de la venta)
- El `QuickGarmentTypeModal` usara el mismo `productService.createGarmentType()` existente
- Se mantiene compatibilidad hacia atras: ventas historicas (`is_historical=True`) no requieren metodo de pago

---

## Parte C: Correccion de Errores TypeScript Pre-existentes

### C1. Eliminar imports no utilizados

| Archivo | Imports a eliminar |
|---------|-------------------|
| `ContactDetailModal.tsx:13` | `Clock` |
| `CurrencyInput.tsx:40` | `parseToNumber` |
| `Layout.tsx:8` | `getRoleBadgeColor` |
| `OrderModal.tsx:129,137,331` | `catalogGarmentTypes`, `filteredCatalogProducts`, `handleAddCatalogItem` |
| `PaymentVerificationModal.tsx:8` | `Check` |
| `ProductGroupCard.tsx:9,11` | `AlertTriangle`, `getVariantsForSize` |
| `ProductSelectorModal.tsx:15,487,587` | `ShoppingCart`, `isGlobal` (x2) |
| `SaleModal.tsx:296,802` | `handleProductSelect`, `index` |
| `ContactsManagement.tsx:10,11` | `Filter`, `CheckCircle`, `XCircle` |
| `Documents.tsx:7,192` | `useCallback`, `doc` |
| `OrderDetail.tsx:7` | `Printer` |
| `Orders.tsx:15,434,446` | `PaymentVerificationModal`, `handleApprovePayment`, `handleRejectPayment` |
| `WebOrders.tsx:32` | `Store` |

### C2. Corregir incompatibilidad apiClient vs AxiosResponse

**Problema:** `apiClient` retorna `{ data, status }` pero servicios esperan `AxiosResponse` completo.

**Archivos afectados:**
- `contactService.ts:59,69,85,94`
- `paymentAccountService.ts:57,65,73,81,89`

**Solucion:** Cambiar tipado de `AxiosResponse<T>` a tipo correcto:
```typescript
// Antes:
const response: AxiosResponse<Contact> = await apiClient.get(...)

// Despues:
const response = await apiClient.get<Contact>(...)
```

### C3. Corregir tipos `unknown` en servicios

**Archivos:**
- `deliveryZoneService.ts:41,49,57,65`

**Solucion:** Agregar type assertion o usar genericos:
```typescript
// Antes:
return response.data;  // unknown

// Despues:
return response.data as DeliveryZone[];
```

### C4. Corregir propiedad `.stock` en ProductSelectorModal

**Archivo:** `ProductSelectorModal.tsx:140,142,489,589`

**Problema:** `Product | GlobalProduct` - GlobalProduct no tiene `.stock`

**Solucion:** Agregar verificacion de tipo:
```typescript
// Usar optional chaining o type guard
const stock = 'stock' in product ? product.stock : 0;
```

### C5. Corregir propiedad `.client` en OrderDetail

**Archivo:** `OrderDetail.tsx:272,342`

**Problema:** `OrderWithItems` no incluye `client`

**Solucion:** Actualizar interface `OrderWithItems` en `types/api.ts` o usar propiedad correcta.

### C6. Corregir funcion formatDateTimeSpanish

**Archivos:** `ContactDetailModal.tsx:174,233`, `ContactsManagement.tsx:315`

**Problema:** Funcion espera `string` pero recibe `Date`

**Solucion A:** Cambiar llamada:
```typescript
formatDateTimeSpanish(contact.created_at)  // ya es string del API
```

**Solucion B:** Actualizar funcion para aceptar `Date | string`

### C7. Agregar soporte responseType a apiClient (opcional)

**Archivo:** `documentService.ts:180,189`

**Problema:** `apiClient` no soporta `responseType: 'blob'`

**Solucion:** Agregar opcion `responseType` al apiClient o usar fetch nativo para downloads.

---

## Orden de Implementacion Actualizado

### Fase 1: Backend (YA COMPLETADO)
1. ~~Validacion schema de pago~~
2. ~~Endpoint add payment~~
3. ~~Metodo servicio~~

### Fase 2: Frontend - Features (YA COMPLETADO)
4. ~~QuickGarmentTypeModal~~
5. ~~ProductModal con boton +~~
6. ~~Tab visible para ADMIN~~

### Fase 3: Frontend - TypeScript Fixes (COMPLETADO)
7. ~~Eliminar imports no usados (C1)~~
8. ~~Corregir tipado servicios (C2, C3)~~
9. ~~Corregir acceso a propiedades (C4, C5)~~
10. ~~Corregir formatDateTimeSpanish (C6)~~
11. ~~Soporte responseType (C7)~~

---

## Parte D: BUGS DE PAGOS IDENTIFICADOS (NUEVA INVESTIGACION)

### Investigacion Realizada: 2026-01-08

Se identificaron varios bugs que pueden causar que ventas se registren sin pagos o sin impacto contable:

### D1. Bug en Backend - Validacion de Array Vacio

**Archivo:** `backend/app/services/sale.py` (linea 247-259)

**Problema:** Si `payments` es un array vacio `[]` y `payment_method` es `None`, la logica contable no procesa nada:

```python
if sale_data.payments:  # [] es falsy - no entra
    for payment_data in sale_data.payments:
        payments_to_process.append(...)
elif sale.payment_method:  # None - no entra
    payments_to_process.append(...)

# payments_to_process queda vacio, no se crea Transaction
```

**Solucion:** Agregar validacion explicita despues de construir `payments_to_process`:
```python
if not payments_to_process and not is_historical:
    raise ValueError("No hay pagos validos para procesar")
```

### D2. Bug en Frontend - Filtrado de Pagos con Amount=0

**Archivo:** `frontend/src/components/SaleModal.tsx` (linea 489-495)

**Problema:** El filtrado elimina pagos con amount=0:
```typescript
const paymentsData: SalePaymentCreate[] = payments
  .filter(p => p.amount > 0)  // Si amount=0, se filtra
  .map(p => ({...}));
```

Si TODOS los pagos tienen `amount = 0`, el array queda vacio y la venta se crea sin pagos.

**Estado Actual de Validacion (linea 445-456):**
```typescript
// Validate payments sum equals total
if (totalPayments !== total) {
  setError(...);
  return;
}

// Validate at least one payment has amount > 0
if (payments.every(p => p.amount <= 0)) {
  setError('Debes ingresar al menos un pago');
  return;
}
```

**Problema:** La segunda validacion depende de que el usuario haya interactuado con los campos. Si el auto-fill fallo, puede no detectarse.

### D3. Bug en Frontend - Auto-fill Limitado

**Archivo:** `frontend/src/components/SaleModal.tsx` (linea 270-275)

**Problema:** El auto-fill solo funciona UNA VEZ bajo condiciones especificas:
```typescript
useEffect(() => {
  const total = calculateTotal();
  if (payments.length === 1 && payments[0].amount === 0 && total > 0) {
    setPayments([{ ...payments[0], amount: total }]);
  }
}, [items]);
```

**Escenario Fallido:**
1. Usuario agrega items → total = 500, pago auto-fill a 500 ✓
2. Usuario elimina items → total = 300
3. Pago sigue en 500 (no se actualiza)
4. Validacion rechaza por `totalPayments (500) !== total (300)`

**Pero si:**
1. Usuario SOLO agrega items pero NO modifica el campo de pago
2. Y el useEffect no se dispara por alguna razon...
3. El pago queda en 0 y la validacion deberia rechazar

---

## Solucion Propuesta - Parte D

### D1. Fix Backend (PRIORIDAD ALTA)
**Archivo:** `backend/app/services/sale.py`

Agregar despues de linea 259 (despues de construir payments_to_process):
```python
# Validar que hay pagos para procesar
if not payments_to_process and not is_historical and sale.total > Decimal("0"):
    raise ValueError(
        "No se proporcionaron pagos validos. Use 'payments' con montos > 0 "
        "o especifique 'payment_method'"
    )
```

### D2. Fix Frontend - Validacion Mejorada
**Archivo:** `frontend/src/components/SaleModal.tsx`

En `handleSubmit`, agregar validacion explicita antes de construir saleData:
```typescript
// Validar que hay pagos con monto > 0
const validPayments = payments.filter(p => p.amount > 0);
if (validPayments.length === 0) {
  setError('Debes agregar al menos un pago con monto mayor a 0');
  return;
}
```

### D3. Fix Frontend - Auto-fill Mejorado
**Archivo:** `frontend/src/components/SaleModal.tsx`

Mejorar el useEffect para ser mas robusto:
```typescript
useEffect(() => {
  const total = calculateTotal();
  // Auto-fill si solo hay un pago y:
  // - El monto es 0 (inicial)
  // - O el monto no coincide con el total (items cambiaron)
  if (payments.length === 1 && total > 0) {
    const currentPayment = payments[0];
    if (currentPayment.amount === 0 || currentPayment.amount !== total) {
      setPayments([{ ...currentPayment, amount: total }]);
    }
  }
}, [items]); // Recalcular cuando items cambian
```

---

## Archivos a Modificar - Parte D

| Archivo | Cambio |
|---------|--------|
| `backend/app/services/sale.py` | Agregar validacion de payments_to_process vacio |
| `frontend/src/components/SaleModal.tsx` | Mejorar validacion y auto-fill de pagos |

---

## Orden de Implementacion - Parte D

1. **Backend Fix (D1)** - Previene creacion de ventas sin pago a nivel de servicio
2. **Frontend Validacion (D2)** - Mejor UX con mensajes claros
3. **Frontend Auto-fill (D3)** - Reduce friccion del usuario

---

## Estado Actual del Sistema

| Componente | Estado | Problema |
|------------|--------|----------|
| Schema Validacion | ✅ Correcto | `validate_payment_fields` funciona |
| Endpoint add_payment | ✅ Correcto | Permite agregar pagos a ventas existentes |
| Service create_sale | ⚠️ Bug | No valida si `payments_to_process` queda vacio |
| Frontend Validacion | ⚠️ Debil | No valida explicitamente pagos > 0 antes de submit |
| Frontend Auto-fill | ⚠️ Limitado | Solo funciona una vez |
| **UI para agregar pagos** | ❌ **FALTA** | No hay forma de agregar pagos desde la UI |

---

## Parte E: UI para Agregar Pagos a Ventas Existentes

### Situacion Actual

**Backend:** ✅ Endpoint listo `POST /schools/{school_id}/sales/{sale_id}/payments`

**Frontend:** ❌ Falta implementar:
1. Metodo en `saleService.ts`
2. Modal para agregar pago
3. Boton en vista de detalle de venta

### E1. Agregar metodo al servicio frontend

**Archivo:** `frontend/src/services/saleService.ts`

```typescript
/**
 * Add payment to existing sale (admin only)
 */
async addPaymentToSale(
  schoolId: string,
  saleId: string,
  paymentData: {
    amount: number;
    payment_method: string;
    notes?: string;
    apply_accounting?: boolean;
  }
): Promise<SalePayment> {
  const response = await apiClient.post<SalePayment>(
    `/schools/${schoolId}/sales/${saleId}/payments`,
    paymentData
  );
  return response.data;
}
```

### E2. Crear componente AddPaymentModal

**Archivo nuevo:** `frontend/src/components/AddPaymentModal.tsx`

Modal con:
- Campo de monto (requerido, > 0)
- Selector de metodo de pago (cash, nequi, transfer, card, credit)
- Campo de notas (opcional)
- Toggle para aplicar contabilidad (default: true)
- Botones Cancelar / Agregar Pago

Props:
```typescript
interface AddPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  saleId: string;
  schoolId: string;
  maxAmount?: number; // Saldo pendiente de la venta
}
```

### E3. Agregar boton en SaleDetail

**Archivo:** `frontend/src/pages/SaleDetail.tsx`

Agregar boton "Agregar Pago" junto a los botones existentes:

```typescript
{/* Mostrar si hay saldo pendiente */}
{sale.balance > 0 && (
  <button
    onClick={() => setIsPaymentModalOpen(true)}
    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center transition"
  >
    <DollarSign className="w-5 h-5 mr-2" />
    Agregar Pago
  </button>
)}
```

### E4. Mostrar historial de pagos en SaleDetail

Agregar seccion que muestre todos los pagos de una venta:

```typescript
{/* Pagos de la venta */}
{sale.payments && sale.payments.length > 0 && (
  <div className="mt-6">
    <h3>Pagos Registrados</h3>
    <table>
      <thead>
        <tr>
          <th>Fecha</th>
          <th>Metodo</th>
          <th>Monto</th>
          <th>Notas</th>
        </tr>
      </thead>
      <tbody>
        {sale.payments.map(payment => (...))}
      </tbody>
    </table>
  </div>
)}
```

---

## Archivos a Modificar - Parte E

| Archivo | Cambio |
|---------|--------|
| `frontend/src/services/saleService.ts` | Agregar metodo `addPaymentToSale` |
| `frontend/src/components/AddPaymentModal.tsx` | **CREAR** modal para agregar pagos |
| `frontend/src/pages/SaleDetail.tsx` | Agregar boton + historial de pagos |
| `frontend/src/types/api.ts` | Agregar tipo `SalePayment` si no existe |

---

## Orden de Implementacion Final

### Prioridad 1: Prevenir ventas sin pagos
1. **D1** - Backend: Validacion de payments_to_process vacio
2. **D2** - Frontend: Validacion mejorada en SaleModal
3. **D3** - Frontend: Auto-fill mejorado

### Prioridad 2: Corregir ventas existentes
4. **E1** - saleService: metodo addPaymentToSale
5. **E2** - AddPaymentModal: componente nuevo
6. **E3** - SaleDetail: boton "Agregar Pago"
7. **E4** - SaleDetail: historial de pagos

---

## Archivos a Modificar - TypeScript Fixes

| Archivo | Tipo de Fix |
|---------|-------------|
| `ContactDetailModal.tsx` | Eliminar import + fix Date |
| `CurrencyInput.tsx` | Eliminar variable |
| `Layout.tsx` | Eliminar import |
| `OrderModal.tsx` | Eliminar imports/variables |
| `PaymentVerificationModal.tsx` | Eliminar import |
| `ProductGroupCard.tsx` | Eliminar imports |
| `ProductSelectorModal.tsx` | Eliminar imports + fix .stock |
| `SaleModal.tsx` | Eliminar variables |
| `ContactsManagement.tsx` | Eliminar imports + fix Date |
| `Documents.tsx` | Eliminar imports |
| `OrderDetail.tsx` | Eliminar import + fix .client |
| `Orders.tsx` | Eliminar imports/variables |
| `WebOrders.tsx` | Eliminar import |
| `contactService.ts` | Fix tipado AxiosResponse |
| `paymentAccountService.ts` | Fix tipado AxiosResponse |
| `deliveryZoneService.ts` | Fix tipo unknown |

---

## Parte F: Mejoras de Visibilidad y Eliminacion de Dependencias del Selector de Colegios

### Investigacion Realizada: 2026-01-08

Se identificaron problemas criticos de UX donde informacion importante no se muestra, y el selector de colegios bloquea el acceso a datos.

---

### F1. PROBLEMA CRITICO: SaleDetail no carga si selector no coincide

**Archivo:** `frontend/src/pages/SaleDetail.tsx` (linea 89)

**Flujo problematico:**
1. Usuario ve lista de ventas de TODOS los colegios (endpoint multi-school `/sales`)
2. Usuario cambia selector de colegio para filtrar
3. Usuario hace clic en venta de OTRO colegio
4. SaleDetail usa `currentSchool?.id` del selector (INCORRECTO)
5. Backend rechaza porque `schoolId` no coincide con la venta

**Solucion:** Obtener `school_id` DE LA VENTA, no del selector

```typescript
// ANTES (linea 89, 108):
const schoolId = currentSchool?.id || '';
const saleData = await saleService.getSaleWithItems(schoolId, saleId);

// DESPUES:
// 1. Primero obtener la venta con endpoint multi-school
const saleBasic = await saleService.getSaleById(saleId); // /sales/{saleId}
const schoolId = saleBasic.school_id;

// 2. Luego cargar detalles con el schoolId correcto
const saleData = await saleService.getSaleWithItems(schoolId, saleId);
```

---

### F2. PROBLEMA: OrderDetail tiene el mismo problema

**Archivo:** `frontend/src/pages/OrderDetail.tsx`

**Situacion:** OrderDetail tambien depende de `currentSchool` o parametros de URL.

**Solucion similar:** Obtener `school_id` del encargo primero.

---

### F3. Encargos NO muestran metodo de pago

**Archivo:** `frontend/src/pages/Orders.tsx`

**Estado actual:** La tabla de encargos NO tiene columna de metodo de pago.

**Campos que SI muestra:**
- Codigo, Colegio, Cliente, Estado, Entrega, Total, Saldo, Items, Comprobante

**Campos que FALTAN:**
- Metodo de pago (advance_payment_method o ultimo pago)
- Historial de pagos

**Backend:** El modelo `Order` tiene `advance_payment_method` pero no se devuelve en `OrderListItem`.

---

### F4. OrderDetail NO muestra historial de pagos

**Archivo:** `frontend/src/pages/OrderDetail.tsx`

**Estado actual:**
- Muestra total, pagado, saldo pendiente
- Tiene boton "Registrar Pago" que abre modal
- NO muestra historial de pagos realizados
- NO muestra metodo de pago del anticipo

**Solucion:** Agregar seccion "Historial de Pagos" similar a SaleDetail.

---

### F5. Backend: OrderListItem no incluye payment info

**Archivo:** `backend/app/schemas/order.py`

**Estado actual de OrderListResponse:**
```python
class OrderListResponse(BaseSchema):
    id, code, status, client_name, student_name
    delivery_date, total, balance
    items_count, user_id, user_name
    school_id, school_name
    items_delivered, items_total
    payment_proof_url
    delivery_type, delivery_fee, delivery_address
    # FALTA: payment_method, payments
```

---

## Plan de Implementacion - Parte F

### F1. Fix SaleDetail - Independizar del selector

**Archivo:** `frontend/src/pages/SaleDetail.tsx`

1. Cambiar flujo de carga:
   ```typescript
   const loadSaleDetail = async () => {
     // Paso 1: Obtener venta con endpoint multi-school
     const saleBasic = await saleService.getSaleById(saleId!);
     const schoolId = saleBasic.school_id;

     // Paso 2: Cargar detalles completos
     const saleData = await saleService.getSaleWithItems(schoolId, saleId!);
     // ... resto del codigo
   };
   ```

2. Eliminar dependencia de `currentSchool` para la carga inicial

3. Mantener `currentSchool` solo como fallback para crear cambios/devoluciones

### F2. Fix OrderDetail - Independizar del selector

**Archivo:** `frontend/src/pages/OrderDetail.tsx`

Mismo patron que F1:
1. Obtener orden con endpoint multi-school primero
2. Extraer `school_id` de la orden
3. Usar ese `school_id` para cargas subsiguientes

### F3. Agregar metodo de pago a lista de encargos

**Backend:** `backend/app/api/routes/orders.py` y `backend/app/schemas/order.py`

1. Agregar campo `advance_payment_method` a `OrderListResponse`
2. Modificar endpoint `list_all_orders` para incluir el campo

**Frontend:** `frontend/src/pages/Orders.tsx`

1. Agregar columna "Metodo Pago" a la tabla
2. Mostrar `advance_payment_method` traducido al espanol

### F4. Agregar historial de pagos a OrderDetail

**Backend:** Verificar si existe endpoint para obtener pagos de orden

**Frontend:** `frontend/src/pages/OrderDetail.tsx`

1. Agregar seccion "Historial de Pagos" despues de la card de pagos
2. Mostrar tabla con: Fecha, Metodo, Monto, Referencia
3. Similar a la implementacion en SaleDetail

### F5. Mostrar metodo de pago del anticipo en OrderDetail

**Archivo:** `frontend/src/pages/OrderDetail.tsx`

En la card de "Pagos", agregar:
```tsx
<div>
  <span className="text-sm text-gray-500">Metodo anticipo:</span>
  <span>{getPaymentMethodText(order.advance_payment_method)}</span>
</div>
```

---

## Archivos a Modificar - Parte F

### Frontend
| Archivo | Cambio |
|---------|--------|
| `frontend/src/pages/SaleDetail.tsx` | Obtener school_id de la venta, no del selector |
| `frontend/src/pages/OrderDetail.tsx` | Obtener school_id del encargo + agregar historial pagos |
| `frontend/src/pages/Orders.tsx` | Agregar columna metodo de pago |

### Backend
| Archivo | Cambio |
|---------|--------|
| `backend/app/schemas/order.py` | Agregar `advance_payment_method` a `OrderListResponse` |
| `backend/app/api/routes/orders.py` | Incluir campo en respuesta de lista |

---

## Orden de Implementacion - Parte F

### Prioridad 1: Eliminar bloqueo del selector
1. **F1** - SaleDetail: Independizar del selector de colegios
2. **F2** - OrderDetail: Independizar del selector de colegios

### Prioridad 2: Mejorar visibilidad de pagos en encargos
3. **F5** - Backend: Agregar `advance_payment_method` a OrderListResponse
4. **F3** - Orders.tsx: Agregar columna metodo de pago
5. **F4** - OrderDetail: Agregar historial de pagos

---

## Resumen de Problemas Identificados

| Problema | Severidad | Impacto |
|----------|-----------|---------|
| SaleDetail depende del selector | CRITICO | No se puede ver detalle si selector no coincide |
| OrderDetail depende del selector | CRITICO | Mismo problema |
| Orders no muestra metodo de pago | ALTA | Usuario no sabe como se pago |
| OrderDetail no muestra historial pagos | ALTA | No hay visibilidad de pagos parciales |
| OrderDetail no muestra metodo anticipo | MEDIA | Falta informacion del anticipo |

---

## Notas Tecnicas

### Endpoints Multi-School Disponibles

```
GET /sales/{saleId}          - Obtiene venta sin requerir school_id
GET /orders/{orderId}        - Obtiene orden sin requerir school_id (verificar)
```

### Patron Recomendado para Paginas de Detalle

```typescript
// 1. Obtener registro con endpoint multi-school
const record = await service.getById(recordId);

// 2. Extraer school_id del registro
const schoolId = record.school_id;

// 3. Usar school_id para operaciones que lo requieren
await service.getDetails(schoolId, recordId);
await service.addPayment(schoolId, recordId, data);
```

Este patron elimina la dependencia del selector global y permite acceder a cualquier registro independientemente del colegio seleccionado.

---

## Parte G: Campos Faltantes en UI - Analisis Completo

### Investigacion Realizada: 2026-01-08

Comparacion exhaustiva de campos disponibles en backend vs campos mostrados en UI.

---

### G1. VENTAS - Campos Faltantes

| Campo | Backend | Lista | Detalle | Accion |
|-------|---------|-------|---------|--------|
| paid_amount | ✓ | ✗ | ✓ | **AGREGAR a lista** - critico para ver saldo |
| items_count | ✓ | ✗ | ✓ | Agregar a lista (opcional) |

**Implementacion G1:**
- `frontend/src/pages/Sales.tsx`: Agregar columna "Pagado" o indicador visual de saldo pendiente

---

### G2. ENCARGOS - Campos Faltantes

| Campo | Backend | Lista | Detalle | Accion |
|-------|---------|-------|---------|--------|
| user_name | ✓ | ✗ | ✗ | **AGREGAR** - auditoria |
| advance_payment_method | ✓ | ✗ | ✗ | **AGREGAR** - metodo de pago |
| payments (historial) | ✓ | ✗ | ✗ | **AGREGAR** - historial completo |
| delivery_type | ✓ | ✓ | ✗ | **AGREGAR a detalle** |
| delivery_address | ✓ | ✓ | ✗ | **AGREGAR a detalle** |
| delivery_neighborhood | ✓ | ✓ | ✗ | **AGREGAR a detalle** |
| delivery_fee | ✓ | ✓ | ✗ | **AGREGAR a detalle** |
| needs_quotation | ✓ | ✓ | ✗ | AGREGAR a detalle |

**Implementacion G2:**

1. **Orders.tsx - Agregar columna metodo de pago:**
   ```tsx
   <th>Metodo Pago</th>
   ...
   <td>{getPaymentMethodText(order.advance_payment_method)}</td>
   ```

2. **OrderDetail.tsx - Agregar seccion de entrega:**
   ```tsx
   {/* Informacion de Entrega */}
   {order.delivery_type === 'DELIVERY' && (
     <div className="bg-blue-50 p-4 rounded-lg">
       <h3>Informacion de Entrega</h3>
       <p>Direccion: {order.delivery_address}</p>
       <p>Barrio: {order.delivery_neighborhood}</p>
       <p>Tarifa: ${order.delivery_fee}</p>
     </div>
   )}
   ```

3. **OrderDetail.tsx - Agregar historial de pagos:**
   Similar a SaleDetail, mostrar tabla con todos los pagos realizados.

---

### G3. CLIENTES - Campos Faltantes

| Campo | Backend | Lista | Detalle | Accion |
|-------|---------|-------|---------|--------|
| address | ✓ | ✗ | ✓ | Mostrar en modal de edicion |
| client_type | ✓ | ✗ | ✗ | **AGREGAR badge** REGULAR/WEB |
| student_count | ✓ | ✗ | ✗ | Mostrar si > 1 estudiante |

**Implementacion G3:**
- `frontend/src/pages/Clients.tsx`: Agregar badge de tipo de cliente

---

## Archivos a Modificar - Parte G

### Frontend
| Archivo | Cambios |
|---------|---------|
| `frontend/src/pages/Sales.tsx` | Agregar columna paid_amount o indicador saldo |
| `frontend/src/pages/Orders.tsx` | Agregar columna metodo de pago |
| `frontend/src/pages/OrderDetail.tsx` | Agregar: seccion entrega, historial pagos, metodo anticipo |
| `frontend/src/pages/Clients.tsx` | Agregar badge client_type |

### Backend (si necesario)
| Archivo | Cambios |
|---------|---------|
| `backend/app/schemas/order.py` | Agregar `advance_payment_method` a OrderListResponse |
| `backend/app/api/routes/orders.py` | Incluir campo en respuesta |

---

## Orden de Implementacion Final - Parte F + G

### Fase 1: Eliminar Bloqueo del Selector (CRITICO)
1. **F1** - SaleDetail: Obtener school_id de la venta
2. **F2** - OrderDetail: Obtener school_id del encargo

### Fase 2: Visibilidad de Pagos en Encargos (ALTA)
3. **G2** - Backend: Agregar advance_payment_method a OrderListResponse
4. **G2** - Orders.tsx: Columna metodo de pago
5. **G2** - OrderDetail.tsx: Historial de pagos completo
6. **G2** - OrderDetail.tsx: Metodo de pago del anticipo

### Fase 3: Informacion de Entrega en OrderDetail (MEDIA)
7. **G2** - OrderDetail.tsx: Seccion de informacion de entrega

### Fase 4: Mejoras Adicionales (BAJA)
8. **G1** - Sales.tsx: Indicador de saldo pendiente
9. **G3** - Clients.tsx: Badge de tipo de cliente

---

## Resumen Ejecutivo

### Problemas Criticos a Resolver:
1. **SaleDetail/OrderDetail dependen del selector** → Imposible ver detalles si no coincide
2. **Encargos no muestran metodo de pago** → Usuario no sabe como se pago
3. **OrderDetail no muestra historial de pagos** → No hay visibilidad de pagos parciales

### Campos Importantes a Agregar:
- **Ventas Lista:** paid_amount (saldo pendiente visual)
- **Encargos Lista:** advance_payment_method
- **Encargos Detalle:** historial pagos, info entrega, metodo anticipo
- **Clientes Lista:** client_type badge

### Patron de Solucion:
```typescript
// Para paginas de detalle, obtener school_id DEL REGISTRO, no del selector
const record = await service.getById(recordId);  // Multi-school endpoint
const schoolId = record.school_id;               // Extraer del registro
// Usar schoolId correcto para operaciones subsiguientes
```

---

## Parte H: Productos Globales en OrderModal

### Problema Identificado: 2026-01-10

El modal de encargos (OrderModal) NO carga ni muestra productos globales, a diferencia de SaleModal que sí lo hace.

### Análisis Comparativo

| Aspecto | OrderModal | SaleModal |
|---------|-----------|-----------|
| Carga productos colegio | ✓ | ✓ |
| Carga productos globales | ✗ | ✓ |
| Estado `globalProducts` | ✗ | ✓ |
| `allowGlobalProducts={true}` | ✗ | ✓ |

### Archivos a Modificar

**Frontend:**
- `frontend/src/components/OrderModal.tsx`

### Cambios Requeridos

#### H1. Agregar estado para productos globales

```typescript
// Agregar después de línea ~140:
const [globalProducts, setGlobalProducts] = useState<GlobalProduct[]>([]);
```

#### H2. Cargar productos globales en loadData()

```typescript
// Modificar loadData() línea ~228-246:
const loadData = async (schoolIdToLoad?: string) => {
  const targetSchoolId = schoolIdToLoad || selectedSchoolId;
  if (!targetSchoolId) return;

  try {
    setLoadingData(true);
    const [garmentTypesData, productsData, globalProductsData] = await Promise.all([
      productService.getGarmentTypes(targetSchoolId),
      productService.getProducts(targetSchoolId),
      productService.getGlobalProducts(true),  // ← AGREGAR
    ]);
    setGarmentTypes(garmentTypesData);
    setProducts(productsData);
    setGlobalProducts(globalProductsData);  // ← AGREGAR
  } catch (err: any) {
    console.error('Error loading data:', err);
    setError('Error al cargar datos');
  } finally {
    setLoadingData(false);
  }
};
```

#### H3. Habilitar productos globales en ProductGroupSelector

```typescript
// En las instancias de ProductGroupSelector (líneas ~1282 y ~1295):
<ProductGroupSelector
  allowGlobalProducts={true}  // ← CAMBIAR de false a true
  globalProducts={globalProducts}  // ← AGREGAR
  ...
/>
```

#### H4. Agregar import de GlobalProduct

```typescript
// Agregar al inicio del archivo:
import type { GlobalProduct } from '../types/api';
```

### Notas

- El backend YA soporta productos globales en órdenes (modelo OrderItem tiene `global_product_id`)
- ProductGroupSelector ya tiene la lógica para mostrar tabs de productos globales
- Solo falta conectar OrderModal con los productos globales
