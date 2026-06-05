# Plan de Mejora: app-desktop-pos v2

Score actual: 48/100 | Target: 85/100 | Gap: -37 pts

**Fecha:** 2026-04-12
**Basado en:** Auditoria POS Chrome Extension v1

---

## Resumen de Gaps por Categoria (mayor a menor)

| Categoria | Score | Target | Gap | Prioridad |
|-----------|-------|--------|-----|-----------|
| keyboard-shortcuts | 1.0 | 8.0 | -7.0 | P0 |
| receipt-printing | 2.0 | 9.0 | -7.0 | P0 |
| speed-efficiency | 3.0 | 9.0 | -6.0 | P1-P2 |
| product-search | 4.0 | 9.0 | -5.0 | P1 |
| error-handling | 5.0 | 8.0 | -3.0 | P0 |
| cart-management | 5.0 | 8.0 | -3.0 | P1 |
| post-sale-flow | 6.0 | 8.0 | -2.0 | P0 |
| payment-flow | 7.0 | 9.0 | -2.0 | P0 |
| change-return | 7.0 | 8.0 | -1.0 | P1 |
| multi-payment | 8.0 | 8.0 | 0.0 | achieved |

---

## P0 — Quick Wins (< 2 horas c/u, impacto directo en score)

### P0.1 — Keyboard Shortcuts con react-hotkeys-hook (keyboard-shortcuts: 1→6, speed-efficiency: 3→4)

**Problema:** Cero atajos de teclado. No hay libreria de hotkeys instalada. Solo 5 archivos usan `onKeyDown` y ninguno en componentes POS.

**Fix:**

1. Instalar `react-hotkeys-hook`:
   ```bash
   cd frontend && npm install react-hotkeys-hook
   ```

2. Crear hook `frontend/src/hooks/usePOSHotkeys.ts` con atajos globales:
   - `F2` → Navegar a Sales + abrir SaleModal (Nueva Venta)
   - `F3` → Focus en busqueda del ProductGroupSelector (si esta abierto)
   - `F4` → Focus en ClientSelector
   - `F5` → Focus en selector de colegio
   - `Escape` → Cerrar modal activo
   - `Ctrl+Enter` → Submit del formulario de venta
   - `Ctrl+P` → Agregar linea de pago (dividir)

3. Integrar en `frontend/src/components/SaleModal.tsx`:
   - Importar `useHotkeys` de `react-hotkeys-hook`
   - Registrar handlers dentro del componente (lineas ~42-100)
   - `Escape` → `onClose()` (linea 633)
   - `Ctrl+Enter` → trigger `handleSubmit` si form es valido (linea 830)

4. Integrar atajos globales en `frontend/src/pages/Sales.tsx`:
   - `F2` → `setIsModalOpen(true)` (linea 35)
   - Solo activo cuando SaleModal NO esta abierto

5. Mostrar barra de atajos en footer del SaleModal:
   - Agregar `<div>` debajo del boton "Crear Venta" (linea ~842):
     ```
     Esc: Cancelar | Ctrl+Enter: Crear | F3: Buscar producto
     ```

**Archivos afectados:**
- `frontend/package.json` (nueva dependencia)
- `frontend/src/hooks/usePOSHotkeys.ts` (nuevo)
- `frontend/src/components/SaleModal.tsx` (lineas ~42, ~842)
- `frontend/src/pages/Sales.tsx` (linea ~35)

---

### P0.2 — Payment Method Buttons (payment-flow: 7→8.5)

**Problema:** PaymentMethodSelector usa `<select>` dropdown HTML nativo. El usuario debe hacer click, buscar en lista, y seleccionar. Los metodos de pago deberian ser botones visibles con iconos.

**Fix:**

Refactorizar `frontend/src/components/PaymentMethodSelector.tsx` (84 lineas):

- Cambiar de `<select>` (linea 59) a grid de botones toggle
- Cada boton: icono + label + estado activo/inactivo
- Mapeo de iconos:
  - cash → Banknote (lucide)
  - nequi → Smartphone
  - transfer → ArrowRightLeft
  - card → CreditCard
  - credit → FileText
- Mantener la misma interfaz de props (`value`, `onChange`, `includeCredit`, etc.)
- Cuando `accentColor='green'` → boton activo usa bg-green-100 border-green-500
- Layout: `grid grid-cols-2 sm:grid-cols-3 gap-2`
- Atajos de teclado: `Alt+1` a `Alt+5` (integrar con react-hotkeys-hook si ya instalado)

**Archivos afectados:**
- `frontend/src/components/PaymentMethodSelector.tsx` (rewrite completo, 84 lineas)

---

### P0.3 — Receipt Print Button en SuccessModal (receipt-printing: 2→5, post-sale-flow: 6→7.5)

**Problema:** El auditor reporto "No se encontro opcion de impresion de recibo". Pero el codigo SI tiene:
- `ReceiptModal.tsx` con PDF generation (jsPDF)
- `ReceiptPrintButton.tsx` con boton de impresion
- `thermalPrinterService.ts` para impresora termica
- `SuccessModal.tsx` ya tiene boton "Imprimir Recibo" pero SOLO se muestra si `thermalPrinterService.isPrinterConfigured()` (linea 107)
- `SaleDetail.tsx` tiene botones de PDF + Thermal (lineas 425-451)

**Fix:**

1. En `frontend/src/components/SaleModal/SuccessModal.tsx` linea 105-129:
   - Agregar boton "Descargar PDF" que SIEMPRE se muestre (no depende de printer config)
   - El boton abre ReceiptModal para la venta creada, o navega a SaleDetail
   - Mantener boton thermal existente condicionado a config
   - Agregar boton "Ver Venta" que navega a `/sales/{saleId}`

2. En `frontend/src/components/SaleModal/SuccessModal.tsx`:
   - Agregar props: `onNavigateToSale?: (saleId: string) => void`
   - Agregar boton "Ver Detalle" por cada venta en results (lineas 70-90)

**Archivos afectados:**
- `frontend/src/components/SaleModal/SuccessModal.tsx` (lineas 105-129)
- `frontend/src/components/SaleModal/types.ts` (si necesita nuevo tipo)

---

### P0.4 — Error Boundary Global (error-handling: 5→7)

**Problema:** No hay `ErrorBoundary` en ningun componente. Si un componente hijo lanza un error no capturado, toda la app se cae en pantalla blanca. Grep confirma 0 archivos con "ErrorBoundary".

**Fix:**

1. Crear `frontend/src/components/ErrorBoundary.tsx`:
   - Class component (ErrorBoundary requiere class component en React)
   - `componentDidCatch` → loguear error
   - Render fallback: mensaje amigable en espanol + boton "Reintentar" (reload) + boton "Ir al inicio"
   - Props: `fallback?: ReactNode`, `onError?: (error: Error) => void`

2. Envolver rutas principales en `frontend/src/App.tsx` (o router config):
   - Wrap de cada Route con ErrorBoundary
   - Especialmente critico para: SaleDetail, Sales, Orders

3. Envolver SaleModal internamente:
   - En `SaleModal.tsx` linea 607, envolver el contenido del modal con ErrorBoundary

**Archivos afectados:**
- `frontend/src/components/ErrorBoundary.tsx` (nuevo, ~60 lineas)
- `frontend/src/App.tsx` o router principal (agregar wraps)
- `frontend/src/components/SaleModal.tsx` (linea ~607)

---

## P1 — Mejoras Medianas (2-4 horas c/u)

### P1.1 — Fuzzy Search en ProductGroupSelector (product-search: 4→7)

**Problema:** La busqueda actual (linea 176-184 de ProductGroupSelector.tsx) usa `String.includes()` — match exacto. Buscar "falda" no encuentra "Jardinera". No hay sinonimos, no hay fuzzy matching.

**Fix:**

1. Instalar `fuse.js`:
   ```bash
   cd frontend && npm install fuse.js
   ```

2. Crear mapa de sinonimos `frontend/src/utils/productSynonyms.ts`:
   ```typescript
   export const PRODUCT_SYNONYMS: Record<string, string[]> = {
     'jardinera': ['falda', 'jumper'],
     'chompa': ['saco', 'buzo', 'chaqueta', 'sudadera'],
     'camiseta': ['camisa', 'polo', 'playera'],
     'pantalon': ['jean', 'jogger'],
     'medias': ['calcetines', 'calcetas'],
     // etc.
   };
   ```

3. Refactorizar filtrado en `ProductGroupSelector.tsx` lineas 172-204:
   - Reemplazar `filteredGroups` useMemo con Fuse.js
   - Configurar: `threshold: 0.4`, keys: `['garmentTypeName', 'variants.color', 'variants.productCode']`
   - Pre-expandir query con sinonimos antes de buscar
   - Si el query matchea un sinonimo, incluir el grupo del garment type correspondiente

4. Auto-focus en campo de busqueda al abrir el modal:
   - En `ProductGroupSelector.tsx` linea 321, agregar `ref` + `useEffect` para focus automatico
   - Integrar con F3 hotkey del P0.1

**Archivos afectados:**
- `frontend/package.json` (nueva dependencia fuse.js)
- `frontend/src/utils/productSynonyms.ts` (nuevo)
- `frontend/src/components/ProductGroupSelector.tsx` (lineas 172-204, 321)

---

### P1.2 — Cart Inline Quantity Edit + Persistent Catalog (cart-management: 5→7, speed-efficiency: 3→5)

**Problema:** El carrito (`ItemsList.tsx`) solo permite eliminar items con trash icon. No se puede editar cantidad inline. Agregar un segundo producto requiere reabrir el catalogo modal.

**Fix A — Inline Quantity Edit:**

En `frontend/src/components/SaleModal/ItemsList.tsx` lineas 60-97:
- Agregar botones `[-]` `[cantidad]` `[+]` al lado de cada item
- Agregar prop `onUpdateQuantity: (index: number, quantity: number) => void`
- El campo de cantidad debe ser editable (input type number, min=1)
- En `SaleModal.tsx`, agregar handler `handleUpdateItemQuantity`

**Fix B — ProductGroupSelector Persistence:**

El ProductGroupSelector ya permite agregar multiples productos sin cerrarse (lineas 207-228, `addedProducts` Map). El issue es que `onSelect` se llama por cada producto y el modal NO se cierra automaticamente. El boton "Listo" cierra el modal.

VERIFICAR: El reporte dice "Cada producto adicional requiere reabrir el catalogo" pero el codigo muestra que el modal se mantiene abierto y tiene contador de productos agregados. El auditor pudo haber confundido esto. Si es asi, el fix es:
- Hacer mas visible el flujo de "agregar multiples" con indicador visual mas prominente
- Agregar animacion/feedback cuando un producto se agrega (toast o highlight)

**Archivos afectados:**
- `frontend/src/components/SaleModal/ItemsList.tsx` (lineas 60-97, nueva prop)
- `frontend/src/components/SaleModal.tsx` (nuevo handler)

---

### P1.3 — School Selector Searchable (product-search: +0.5, speed-efficiency: +0.5)

**Problema:** El selector de colegio en SaleModal (linea 656) es un `<select>` HTML nativo sin busqueda. Con 11+ colegios y nombres largos, pierde eficiencia.

**Fix:**

Reemplazar el `<select>` nativo en `SaleModal.tsx` lineas 656-666 con un componente searchable dropdown. Opciones:

1. Reusar patron de `ClientSelector.tsx` (que ya tiene busqueda con debounce)
2. Crear `SearchableSelect` generico reutilizable
3. Minimo: agregar input de busqueda encima del dropdown que filtra opciones

Implementacion minima: en lugar del `<select>`, usar un combobox con:
- Input de texto que filtra
- Dropdown de opciones filtradas
- Colegios "frecuentes" (ultimos 3 usados) arriba de la lista

**Archivos afectados:**
- `frontend/src/components/SaleModal.tsx` (lineas 650-670)
- Posible nuevo componente `frontend/src/components/SearchableSchoolSelect.tsx`

---

## P2 — Cambios Estructurales (> 4 horas, posible refactor)

### P2.1 — Layout de Panel Dividido sin Modales (speed-efficiency: 5→8, cart-management: 7→8.5)

**Problema:** El flujo actual es modal-based: Sales.tsx abre SaleModal (z-50) que abre ProductGroupSelector (z-50 nested). Esto genera: modales anidados, scroll obligatorio en un formulario largo, y separacion visual entre catalogo y carrito.

**Fix:** Crear una pagina dedicada `/pos` con layout de dos paneles:

```
┌──────────────────────┬──────────────────────────┐
│ CATALOGO (izquierda) │ CARRITO (derecha)        │
│ - Busqueda           │ - Items con qty edit     │
│ - Filtro categoria   │ - Total                  │
│ - Grid de productos  │ - Metodos de pago        │
│ - Click → agrega     │ - Boton COBRAR           │
└──────────────────────┴──────────────────────────┘
```

Esto es un **refactor mayor** que implica:
1. Nueva pagina `frontend/src/pages/POS.tsx` (~300-400 lineas)
2. Reusar componentes existentes: ProductGroupCard, PaymentsSection, ItemsList
3. NO eliminar SaleModal — mantener para flujo legacy/non-POS
4. Agregar ruta `/pos` al router
5. El catalogo es persistente (no modal) — click en producto agrega directamente al carrito
6. Barra de estado inferior: ventas del dia, ultima venta, total

**Riesgo:** Alto. Cambio de paradigma UI. Requiere testing extensivo.

**Archivos afectados:**
- `frontend/src/pages/POS.tsx` (nuevo, ~400 lineas)
- `frontend/src/App.tsx` (nueva ruta)
- Reusar: ProductGroupCard, PaymentsSection, ItemsList, PaymentMethodSelector

---

### P2.2 — Kits/Paquetes de Uniforme (product-search: 7→9, speed-efficiency: +2)

**Problema:** No existe el concepto de "uniforme completo" como paquete. Cada prenda se agrega individualmente. El modelo `Product` no tiene campos de kit.

**Fix (frontend-only, sin cambio de modelo):**

1. Crear `frontend/src/config/uniformKits.ts`:
   ```typescript
   interface UniformKit {
     name: string;
     schoolId: string;
     garmentTypeNames: string[]; // ['Camiseta Escolar', 'Pantalon', 'Medias']
   }
   ```
   Kits definidos por colegio, referenciando garment types por nombre.

2. En ProductGroupSelector o en SaleModal, agregar seccion "Kits Rapidos":
   - Mostrar kits disponibles para el colegio seleccionado
   - Click en kit → agrega todos los garment types del kit al catalogo con pre-seleccion
   - El usuario solo necesita seleccionar talla para cada prenda

**NOTA:** Esto es una aproximacion frontend-only. El fix completo requiere modelo backend (ProductKit, KitItem) + migration + endpoints. Se recomienda como fase 2.

**Archivos afectados:**
- `frontend/src/config/uniformKits.ts` (nuevo)
- `frontend/src/components/SaleModal.tsx` o nueva pagina POS

---

## Impacto Estimado

| Fase | Score Estimado | Delta |
|------|---------------|-------|
| Estado actual | 48 | -- |
| P0 completado | ~65 | +17 |
| P0 + P1 completado | ~76 | +28 |
| P0 + P1 + P2 completado | ~85 | +37 |

### Desglose por categoria post-P0:

| Categoria | Actual | Post-P0 | Meta |
|-----------|--------|---------|------|
| keyboard-shortcuts | 1.0 | ~6.0 | 8.0 |
| receipt-printing | 2.0 | ~5.0 | 9.0 |
| payment-flow | 7.0 | ~8.5 | 9.0 |
| error-handling | 5.0 | ~7.0 | 8.0 |
| post-sale-flow | 6.0 | ~7.5 | 8.0 |
| speed-efficiency | 3.0 | ~4.0 | 9.0 |

---

## Orden de Ejecucion Recomendado

1. **P0.1** — Keyboard Shortcuts (mayor gap, quick win visible)
2. **P0.2** — Payment Buttons (fix visual rapido)
3. **P0.4** — ErrorBoundary (proteccion critica)
4. **P0.3** — Receipt en SuccessModal (corregir percepcion del auditor)
5. **P1.1** — Fuzzy Search (impacto alto en UX)
6. **P1.2** — Cart Inline Edit (mejora incremental)
7. **P1.3** — School Selector Searchable (polish)
8. **P2.1** — Panel Dividido POS (refactor mayor — evaluar timing)
9. **P2.2** — Uniform Kits (requiere decision backend)
