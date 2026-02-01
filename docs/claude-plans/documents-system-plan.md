# Plan: Suite de Documentos Empresariales (Mini Gestor de Archivos)

## Análisis del Servidor

| Métrica | Valor |
|---------|-------|
| Disco total | 23 GB |
| Usado | 11 GB (49%) |
| **Disponible** | **12 GB** |
| Uploads actuales | 28 MB |

### Espacio Reservado: 2 GB

- ~400 PDFs (5MB c/u) o ~2000 imágenes (1MB c/u)
- Servidor se mantiene bajo 60% de uso

---

## Decisiones del Usuario

- **Espacio**: 2 GB
- **Permisos**: Solo Superusuarios (CRUD completo)
- **Versionado**: No, sobrescribir archivo al actualizar
- **Categorías**: Dinámicas (mini gestor de archivos con carpetas)

---

## Arquitectura Propuesta

### 1. Backend

#### 1.1 Modelo `DocumentFolder` (Carpetas/Categorías dinámicas)
```
Tabla: document_folders
- id: UUID (PK)
- name: string (nombre de la carpeta)
- description: string (opcional)
- color: string (color para UI, ej: #3B82F6)
- icon: string (nombre de icono, ej: folder, legal, price)
- parent_id: UUID (FK self, nullable - para subcarpetas)
- order_index: integer (orden de visualización)
- created_by: UUID (FK users)
- created_at: datetime
- updated_at: datetime
```

#### 1.2 Modelo `BusinessDocument`
```
Tabla: business_documents
- id: UUID (PK)
- folder_id: UUID (FK document_folders, nullable - raíz si null)
- name: string (nombre del documento)
- description: string (opcional)
- file_path: string (ruta en servidor)
- original_filename: string (nombre original del archivo)
- file_size: integer (bytes)
- mime_type: string (application/pdf, image/png, etc.)
- is_active: boolean (soft delete)
- created_by: UUID (FK users)
- created_at: datetime
- updated_at: datetime
```

#### 1.3 Endpoints API - Carpetas
```
POST   /documents/folders           - Crear carpeta
GET    /documents/folders           - Listar carpetas (árbol)
PUT    /documents/folders/{id}      - Actualizar carpeta
DELETE /documents/folders/{id}      - Eliminar carpeta (si vacía)
```

#### 1.4 Endpoints API - Documentos
```
POST   /documents                   - Subir documento (multipart/form-data)
GET    /documents                   - Listar documentos (con filtro por folder_id)
GET    /documents/{id}              - Obtener metadata
GET    /documents/{id}/download     - Descargar archivo
PUT    /documents/{id}              - Actualizar metadata o reemplazar archivo
DELETE /documents/{id}              - Eliminar documento (soft delete)
GET    /documents/stats             - Estadísticas (espacio usado, conteo)
```

#### 1.5 Permisos
- **Solo Superusuarios**: CRUD completo (carpetas y documentos)
- **Otros usuarios**: Sin acceso a esta sección

### 2. Frontend (Tauri)

#### 2.1 Página `Documents.tsx` (Mini Gestor de Archivos)
- **Panel izquierdo**: Árbol de carpetas (sidebar)
- **Panel derecho**: Grid de documentos de la carpeta seleccionada
- **Header**: Breadcrumb de navegación + búsqueda
- **Acciones**: Crear carpeta, Subir archivo, Descargar, Eliminar
- **Barra de estado**: Espacio usado / 2GB

#### 2.2 Componentes
- `FolderTree.tsx` - Árbol de carpetas navegable
- `FolderModal.tsx` - Modal crear/editar carpeta
- `DocumentGrid.tsx` - Grid de documentos con preview
- `DocumentUploadModal.tsx` - Modal de upload con drag & drop
- `DocumentPreview.tsx` - Preview de PDF/imagen
- `StorageIndicator.tsx` - Indicador de espacio usado

#### 2.3 Servicio
- `documentService.ts` - CRUD carpetas + documentos + upload/download

### 3. Almacenamiento

```
/var/www/uniformes-system-v2/uploads/
└── documents/
    └── {uuid}.{ext}   # Archivos nombrados por UUID
```

Los archivos se guardan con nombre UUID para evitar colisiones. La estructura de carpetas es virtual (en BD).

---

## Archivos a Crear/Modificar

### Backend (crear)
1. `backend/app/models/document.py` - Modelos DocumentFolder y BusinessDocument
2. `backend/app/schemas/document.py` - Schemas Pydantic
3. `backend/app/services/document.py` - Lógica de negocio
4. `backend/app/api/routes/documents.py` - Endpoints REST
5. `backend/alembic/versions/xxx_add_documents_tables.py` - Migración

### Backend (modificar)
6. `backend/app/main.py` - Registrar router de documentos

### Frontend (crear)
7. `frontend/src/pages/Documents.tsx` - Página gestor de archivos
8. `frontend/src/services/documentService.ts` - Servicio API
9. `frontend/src/components/documents/FolderTree.tsx` - Árbol carpetas
10. `frontend/src/components/documents/FolderModal.tsx` - Modal carpeta
11. `frontend/src/components/documents/DocumentGrid.tsx` - Grid documentos
12. `frontend/src/components/documents/DocumentUploadModal.tsx` - Modal upload
13. `frontend/src/types/document.ts` - Tipos TypeScript

### Frontend (modificar)
14. `frontend/src/App.tsx` - Agregar ruta /documents
15. `frontend/src/components/Layout.tsx` - Agregar "Documentos" al menú (solo si superuser)

---

## Validaciones de Seguridad

1. **Tipos permitidos**: PDF, PNG, JPG, JPEG, XLSX, XLS, DOCX, DOC
2. **Tamaño máximo por archivo**: 50 MB
3. **Espacio total máximo**: 2 GB (warning al 80% = 1.6GB)
4. **Nombres de archivo**: UUID + extensión original
5. **Permisos**: Verificar `is_superuser` en cada endpoint

---

## Flujo de Usuario (UI)

```
┌─────────────────────────────────────────────────────────────┐
│  📁 Documentos Empresariales           [🔍 Buscar...]      │
├─────────────────────────────────────────────────────────────┤
│ ┌──────────────┐  ┌────────────────────────────────────────┐│
│ │ 📁 Carpetas  │  │  📂 Documentos Legales                 ││
│ │              │  │  ─────────────────────────────────     ││
│ │ ▼ Legales    │  │  [+ Nueva carpeta] [⬆ Subir archivo]  ││
│ │   Contratos  │  │                                        ││
│ │   Permisos   │  │  ┌─────────┐ ┌─────────┐ ┌─────────┐  ││
│ │ ▼ Precios    │  │  │  📄     │ │  📄     │ │  🖼️     │  ││
│ │ ▼ QR Codes   │  │  │ RUT.pdf │ │Contrato │ │ Logo.png│  ││
│ │ ▼ Folletos   │  │  │ 2.3 MB  │ │ 1.1 MB  │ │ 340 KB  │  ││
│ │              │  │  └─────────┘ └─────────┘ └─────────┘  ││
│ │ [+ Carpeta]  │  │                                        ││
│ └──────────────┘  └────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────┤
│  Espacio: ████████░░ 1.2 GB / 2.0 GB (60%)                 │
└─────────────────────────────────────────────────────────────┘
```

---

## Orden de Implementación

1. **Migración BD** - Tablas document_folders y business_documents
2. **Modelos SQLAlchemy** - DocumentFolder y BusinessDocument
3. **Schemas Pydantic** - Create, Update, Response
4. **Servicio** - Lógica CRUD + manejo de archivos
5. **Endpoints API** - Router con endpoints de carpetas y documentos
6. **Registrar router** - main.py
7. **Tipos TypeScript** - Interfaces frontend
8. **Servicio frontend** - documentService.ts
9. **Componentes UI** - FolderTree, DocumentGrid, Modales
10. **Página Documents** - Integración completa
11. **Navegación** - Ruta y menú lateral
12. **Deploy** - Crear directorio en servidor y migrar

---

## FIX PENDIENTE: Upload de Documentos (Nginx)

### Problema Identificado
Los uploads de documentos fallan con `400 Bad Request` porque Nginx pierde el boundary del Content-Type multipart.

**Logs del servidor:**
```
📄 Document upload request: content-type=multipart/form-data  (SIN BOUNDARY!)
POST /api/v1/documents HTTP/1.0" 400 Bad Request
```

### Causa Raíz
La configuración actual de Nginx en `/etc/nginx/sites-enabled/uniformes` **no tiene las directivas necesarias para pasar correctamente requests multipart**.

### Solución: Actualizar Nginx Config

**Archivo:** `/etc/nginx/sites-enabled/uniformes`

**Agregar al bloque `location /` del API (api.yourdomain.com):**

```nginx
location / {
    # ... existing OPTIONS handling ...

    proxy_pass http://127.0.0.1:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    # NUEVO: Directivas para uploads multipart
    proxy_request_buffering off;  # No cachear body - crítico para multipart
    proxy_http_version 1.1;       # HTTP/1.1 para chunked uploads

    # Pass through CORS headers from FastAPI
    proxy_pass_header Access-Control-Allow-Origin;
    # ... rest of config ...
}
```

**También aumentar `client_max_body_size` a 50M:**
```nginx
client_max_body_size 50M;  # Cambiar de 10M a 50M
```

### Comandos para Aplicar Fix

```bash
# 1. Editar config
sudo nano /etc/nginx/sites-enabled/uniformes

# 2. Verificar sintaxis
sudo nginx -t

# 3. Recargar Nginx
sudo systemctl reload nginx
```

### Estado Actual del Código

| Componente | Estado | Notas |
|------------|--------|-------|
| Backend API | ✅ OK | FastAPI recibe multipart correctamente |
| Document Service | ✅ OK | Validación y guardado funciona |
| Frontend api-client | ✅ OK | XMLHttpRequest con FormData |
| documentService.ts | ✅ OK | Envía FormData sin Content-Type manual |
| **Nginx Config** | ❌ PENDIENTE | Falta `proxy_request_buffering off` |

---

# Plan: Sistema de Recibos (Impresión + Email)

## Estado Actual

### Lo que YA existe:
| Funcionalidad | Ventas | Órdenes |
|---------------|--------|---------|
| Generación HTML recibo | ✅ SaleDetail.tsx | ❌ No existe |
| Botón "Imprimir" | ✅ Guarda archivo HTML | ❌ No existe |
| Estilos @media print | ✅ CSS incluido | ❌ No existe |
| Endpoint API recibo | ❌ No existe | ❌ No existe |
| Envío por email | ❌ No existe | ❌ No existe |

### Servicio de Email existente:
- **Proveedor**: Resend (resend.dev)
- **Límite gratuito**: 3,000 emails/mes
- **Funciones actuales**: Verificación, bienvenida, activación, reset password
- **Config**: `RESEND_API_KEY` en backend/app/core/config.py

---

## Decisiones del Usuario

1. **Hardware**: Presupuesto medio (~$150-200 USD) → **Epson TM-T20III** recomendada
2. **Email automático**: Sí, enviar recibo al crear encargo (tanto app desktop como portal web)
3. **Copia al negocio**: No, solo al cliente
4. **Portal Web**: El sistema debe funcionar igual para pedidos del portal web

---

## Hardware Recomendado para Impresión Térmica

### Opción 1: Impresora Térmica USB (Recomendada)
| Modelo | Ancho | Precio Aprox | Conexión |
|--------|-------|--------------|----------|
| Epson TM-T20III | 80mm | $180-250 USD | USB |
| Xprinter XP-58 | 58mm | $30-50 USD | USB |
| Star TSP143III | 80mm | $200-280 USD | USB/Bluetooth |

**Pros**:
- Compatible con Windows/macOS
- Impresión directa desde navegador (window.print)
- No requiere drivers especiales para web
- Papel térmico económico (~$3-5 por rollo)

**Cons**:
- Ancho limitado (80mm = ~42 caracteres)
- Diseño debe ser simple

### Opción 2: Impresora Láser/Inkjet Normal
- Cualquier impresora instalada en el sistema
- Recibo en hoja completa o media carta
- Más profesional pero más lento/costoso

### Recomendación Final (según presupuesto)
**Epson TM-T20III (80mm USB)** - ~$180-220 USD
- Marca líder en POS, muy confiable
- Compatible con Tauri via window.print()
- Velocidad: 200mm/s
- Corte automático de papel
- Drivers nativos Windows/macOS
- Garantía y soporte en Colombia

**Dónde comprar en Colombia:**
- MercadoLibre: "Epson TM-T20III"
- Tiendas POS: Syscom, DynaSys, etc.

---

## Arquitectura Propuesta

### 1. Backend - Generación de Recibos

#### 1.1 Nuevo servicio: `receipt.py`
```python
# backend/app/services/receipt.py

class ReceiptService:
    async def generate_sale_receipt_html(sale_id) -> str
    async def generate_order_receipt_html(order_id) -> str
    async def send_receipt_email(order_id, email) -> bool
```

#### 1.2 Templates HTML para recibos
```
backend/app/templates/
├── receipt_sale.html      # Recibo de venta
├── receipt_order.html     # Recibo de encargo
└── email_receipt.html     # Template email con recibo
```

#### 1.3 Nuevos endpoints
```
GET  /sales/{sale_id}/receipt          # HTML recibo venta
GET  /orders/{order_id}/receipt        # HTML recibo encargo
POST /orders/{order_id}/send-receipt   # Enviar recibo por email
```

### 2. Frontend - Mejoras de Impresión

#### 2.1 Componente `ReceiptPrintButton.tsx`
- Abre nueva ventana con recibo
- Ejecuta window.print() automático
- Cierra ventana después de imprimir

#### 2.2 Agregar a OrderDetail.tsx
- Botón "Imprimir Recibo" (igual que SaleDetail)
- Botón "Enviar por Email" (solo si cliente tiene email)

### 3. Flujo de Impresión

```
Usuario click "Imprimir"
       ↓
Frontend abre nueva ventana con URL:
  /api/v1/sales/{id}/receipt
       ↓
Backend genera HTML con estilos print
       ↓
Navegador muestra preview de impresión
       ↓
Usuario confirma → Imprime en térmica
```

### 4. Flujo de Email (Automático)

**Desde App Desktop (Orders):**
```
Usuario crea encargo con email del cliente
       ↓
POST /orders (crear encargo)
       ↓
Backend automáticamente:
  1. Crea el encargo en BD
  2. Si cliente tiene email → envía recibo
       ↓
Cliente recibe email con confirmación
```

**Desde Portal Web (WebOrders):**
```
Cliente completa pedido en portal web
       ↓
POST /web-orders (crear web order)
       ↓
Backend automáticamente:
  1. Crea el pedido en BD
  2. Envía email de confirmación con detalles
       ↓
Cliente recibe email con su pedido
```

**Email incluye:**
- Logo y nombre del negocio
- Código del encargo/pedido
- Lista de productos con precios
- Total a pagar
- Estado actual (Pendiente, Listo, etc.)
- Información de contacto/recogida
- Botón "Ver mi pedido" (opcional - link al portal)

---

## Template Recibo Térmico (80mm)

```
================================
   UNIFORMES CONSUELO RIOS
================================
Tel: 311-XXX-XXXX
Bogotá, Colombia

RECIBO DE VENTA #V-0001
Fecha: 07/01/2026 10:30 AM
--------------------------------
Cliente: María García
Estudiante: Juan García (5A)
--------------------------------

PRODUCTOS:
1x Camisa Blanca M      $45,000
2x Pantalón Azul 12     $80,000
                        --------
SUBTOTAL:               $125,000
DESCUENTO:                    $0
--------------------------------
TOTAL:                  $125,000
Pago: Efectivo
--------------------------------

¡Gracias por su compra!
Cambios dentro de 8 días con
recibo y producto sin uso.

================================
```

---

## Archivos a Crear/Modificar

### Backend (crear)
1. `backend/app/services/receipt.py` - Generación de recibos HTML
2. `backend/app/templates/receipt_sale.html` - Template impresión venta
3. `backend/app/templates/receipt_order.html` - Template impresión encargo
4. `backend/app/templates/email_order_confirmation.html` - Email confirmación encargo

### Backend (modificar)
5. `backend/app/api/routes/sales.py` - Endpoint GET /{id}/receipt
6. `backend/app/api/routes/orders.py` - Endpoints receipt + envío automático al crear
7. `backend/app/services/email.py` - Nueva función send_order_confirmation()
8. `backend/app/api/routes/orders.py` (web_router) - Envío automático para web orders

### Frontend Desktop (crear)
9. `frontend/src/components/ReceiptPrintButton.tsx` - Botón imprimir reutilizable

### Frontend Desktop (modificar)
10. `frontend/src/pages/OrderDetail.tsx` - Agregar botones recibo/reenviar email
11. `frontend/src/pages/SaleDetail.tsx` - Usar nuevo endpoint (simplificar código actual)

### Portal Web (modificar)
12. `web-portal/app/[school_slug]/confirmacion/page.tsx` - Página de confirmación post-pedido

---

## Orden de Implementación

1. **Templates HTML** - Diseño de recibos térmicos (80mm) y email
2. **Servicio receipt.py** - Lógica de generación de HTML
3. **Servicio email.py** - Nueva función `send_order_confirmation()`
4. **Endpoints API ventas** - GET /sales/{id}/receipt
5. **Endpoints API órdenes** - GET /orders/{id}/receipt + auto-email al crear
6. **Endpoints API web orders** - Auto-email al crear pedido web
7. **Frontend OrderDetail** - Agregar botones imprimir/reenviar
8. **Componente ReceiptPrintButton** - Reutilizable para ventas y órdenes
9. **Testing** - Probar impresión con Epson y envío de emails
10. **Deploy** - Subir cambios a producción

---

## Resumen de Funcionalidades

| Funcionalidad | Ventas | Órdenes (Desktop) | Web Orders |
|--------------|--------|-------------------|------------|
| Imprimir recibo | ✅ Botón | ✅ Botón | ❌ N/A |
| Email automático | ❌ No aplica | ✅ Al crear si hay email | ✅ Siempre |
| Reenviar email | ❌ No aplica | ✅ Botón manual | ❌ No por ahora |
