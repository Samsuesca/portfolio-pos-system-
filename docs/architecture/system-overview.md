# Vision General del Sistema

Arquitectura de Uniformes System v2.0.

---

## Descripcion

Sistema de gestion de uniformes profesional con arquitectura multi-tenant, disenado para manejar inventario, ventas, encargos personalizados y contabilidad global del negocio.

---

## Componentes Principales

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENTES                                  │
├─────────────────┬─────────────────┬─────────────────────────────┤
│  Tauri Desktop  │   Web Portal    │      Admin Portal           │
│  (Vendedores)   │   (Padres)      │    (Superusuarios)          │
│  React + TS     │   Next.js 14    │      Next.js 16             │
└────────┬────────┴────────┬────────┴─────────────┬───────────────┘
         │                 │                      │
         └─────────────────┼──────────────────────┘
                           │
                    ┌──────▼──────┐
                    │   Nginx     │
                    │  (Reverse   │
                    │   Proxy)    │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │  FastAPI    │
                    │  Backend    │
                    │  (Python)   │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
       ┌──────▼──────┐ ┌───▼───┐ ┌──────▼──────┐
       │ PostgreSQL  │ │ Redis │ │   Resend    │
       │    (DB)     │ │(Cache)│ │  (Email)    │
       └─────────────┘ └───────┘ └─────────────┘
```

---

## Stack Tecnologico

### Backend

| Componente | Tecnologia |
|------------|------------|
| Framework | FastAPI 0.104.1 |
| Lenguaje | Python 3.10+ |
| ORM | SQLAlchemy 2.0 (async) |
| Base de Datos | PostgreSQL 15 |
| Migraciones | Alembic |
| Validacion | Pydantic v2 |
| Cache | Redis |
| Email | Resend |

### Frontend Desktop (Tauri)

| Componente | Tecnologia |
|------------|------------|
| Framework | Tauri 2.x |
| UI | React 18 |
| Lenguaje | TypeScript |
| Estilos | Tailwind CSS |
| Estado | Zustand |
| HTTP | Axios |
| Build | Vite |

### Portal Web

| Componente | Tecnologia |
|------------|------------|
| Framework | Next.js 14 (App Router) |
| UI | React 19 |
| Lenguaje | TypeScript |
| Estilos | Tailwind CSS v4 |
| Estado | Zustand |

### Infraestructura

| Componente | Tecnologia |
|------------|------------|
| Servidor | VPS Vultr |
| OS | Ubuntu 22.04 |
| Web Server | Nginx |
| SSL | Let's Encrypt |
| Proceso | Systemd |

---

## Estructura del Proyecto

```
uniformes-system-v2/
├── backend/              # API FastAPI
│   ├── app/
│   │   ├── api/routes/   # Endpoints
│   │   ├── models/       # SQLAlchemy models
│   │   ├── services/     # Logica de negocio
│   │   └── schemas/      # Pydantic schemas
│   └── alembic/          # Migraciones
│
├── frontend/             # App Tauri (desktop)
│   ├── src/
│   │   ├── pages/        # Vistas principales
│   │   ├── components/   # Componentes React
│   │   ├── services/     # Clientes API
│   │   └── stores/       # Estado Zustand
│   └── src-tauri/        # Codigo Rust
│
├── web-portal/           # Portal Next.js (padres)
│   └── app/
│       └── [school_slug]/ # Rutas dinamicas
│
├── admin-portal/         # Portal admin Next.js
│
└── docs/                 # Documentacion
```

---

## Flujos Principales

### Flujo de Venta

```
Usuario → Selecciona Productos → Agrega al Carrito
    → Selecciona Cliente → Elige Metodo de Pago
    → Confirma → Actualiza Inventario
    → Registra en Contabilidad → Genera Recibo
```

### Flujo de Pedido Web

```
Padre → Navega Catalogo → Agrega al Carrito
    → Checkout → Verificacion Telefono
    → Pedido Creado → Notificacion a Vendedor
    → Vendedor Confirma → Prepara Pedido
    → Convierte a Venta → Entrega
```

---

## Caracteristicas Principales

1. **Multi-Tenant**: Multiples colegios en un solo sistema
2. **Contabilidad Global**: Un negocio, una caja, un banco
3. **Multiplataforma**: Windows, macOS, Linux, Web
4. **Tiempo Real**: Actualizacion de inventario instantanea
5. **Offline Ready**: App desktop funciona sin internet (parcial)

---

[← Volver al indice](./README.md)
