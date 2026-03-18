# Uniformes System - Web Portal

Portal publico para clientes de **Uniformes Consuelo Rios**. Permite explorar catalogos por colegio, cotizar uniformes, realizar pedidos y pagar online.

**URL Produccion:** https://yourdomain.com

## Getting Started

### Prerequisites
- Node.js 18.18+
- Backend corriendo en `http://localhost:8000`

### Installation

```bash
cd web-portal
npm install
cp .env.example .env.local  # Configurar variables de entorno
```

### Development

```bash
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000).

### Scripts disponibles

```bash
npm run dev            # Servidor de desarrollo
npm run build          # Build de produccion
npm run start          # Iniciar servidor de produccion
npm run lint           # Ejecutar ESLint
npm test               # Tests en modo watch
npm run test:run       # Tests una sola vez
npm run test:coverage  # Reporte de cobertura
```

## Tech Stack

| Capa | Tecnologia | Version |
|------|------------|---------|
| Framework | Next.js (App Router) | 16 |
| UI | React | 19 |
| Styling | Tailwind CSS | v4 |
| Estado | Zustand | 5 |
| HTTP | Axios + native fetch (SSR) | - |
| Iconos | Lucide React | - |
| PDF | jsPDF + html2canvas | - |
| Testing | Vitest + Testing Library | - |
| TypeScript | strict mode | 5.x |

## Project Structure

```
web-portal/
├── app/
│   ├── layout.tsx                # Root layout (fonts, metadata, title template)
│   ├── page.tsx                  # Home — selector de colegios
│   ├── not-found.tsx             # 404 global
│   ├── globals.css               # Estilos globales (Tailwind v4)
│   ├── [school_slug]/            # Rutas dinamicas por colegio
│   │   ├── page.tsx              # Catalogo de productos (SSR + generateMetadata)
│   │   ├── cart/                 # Cotizacion / carrito
│   │   ├── checkout/             # Finalizar pedido (3 pasos)
│   │   └── not-found.tsx         # 404 colegio no encontrado
│   ├── encargos-personalizados/  # Pedidos a medida
│   ├── soporte/                  # Centro de soporte + PQRS
│   ├── registro/                 # Registro de cuenta (verificacion email)
│   ├── recuperar-password/       # Recuperar contrasena
│   ├── mi-cuenta/                # Historial de pedidos (auth required)
│   ├── pago/                     # Metodos de pago (Nequi, Bancolombia)
│   │   └── resultado/            # Resultado de pago Wompi
│   ├── activar-cuenta/[token]/   # Activacion de cuenta
│   └── api/                      # API routes (proxy al backend)
│       ├── contacts/             # Envio de formularios PQRS
│       └── orders/               # Upload comprobantes de pago
├── components/                   # ~15 componentes React
│   ├── HomePageClient.tsx        # Home: auth, busqueda, grid colegios
│   ├── CatalogClient.tsx         # Catalogo: filtros, productos, carrito
│   ├── ProductGroupCard.tsx      # Card de producto con precio
│   ├── ProductImageOptimized.tsx  # Image con blur placeholder + fallback
│   ├── ProductImageGallery.tsx   # Galeria multi-imagen
│   ├── Footer.tsx                # Footer dinamico (business info)
│   └── ui/                       # Toast, componentes base
├── lib/
│   ├── api.ts                    # Axios clients (public + auth)
│   ├── serverApi.ts              # Server-side fetch con Next.js cache
│   ├── store.ts                  # Zustand store (carrito)
│   ├── clientAuth.ts             # Auth de clientes (login, ordenes)
│   ├── types.ts                  # Interfaces TypeScript
│   ├── utils.ts                  # Helpers (formatNumber, etc.)
│   └── __tests__/                # Tests unitarios
└── public/                       # Assets estaticos (logo, favicon)
```

## API Integration

El portal se conecta al backend FastAPI.

- **Base URL dev:** `http://localhost:8000/api/v1`
- **Base URL prod:** `https://api.yourdomain.com/api/v1`

### Endpoints principales

| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| GET | `/schools` | Lista de colegios activos |
| GET | `/schools/slug/{slug}` | Colegio por slug |
| GET | `/schools/{id}/products` | Productos del colegio |
| GET | `/global/products` | Productos globales |
| POST | `/portal/clients/register` | Registro de cliente |
| POST | `/api/orders/create` | Crear pedido |
| GET | `/business-info` | Info del negocio (footer) |

### Autenticacion

- **Catalogo publico:** Token `public-viewer` automatico (server-side)
- **Operaciones de cliente:** JWT tras login con email/password
- **Retry automatico:** Si token expira, se renueva y reintenta

## Design System

- **Fonts:** Outfit (headings), Inter (body), JetBrains Mono (mono)
- **Brand color:** Gold/amber (`brand-500` = #B8860B)
- **Surfaces:** Stone palette (stone-100 a stone-900)
- **Componentes:** Rounded-xl, shadows suaves, transiciones 200ms

## Payments

- **Wompi:** Gateway principal (tarjeta, Nequi, PSE, Bancolombia)
- **Manual:** Transferencia bancaria + subir comprobante
- **Resultado:** `/pago/resultado?id=REF` verifica estado via API
