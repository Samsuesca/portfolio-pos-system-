# Vision General del Sistema

Arquitectura de **Uniformes System v2** — sistema multi-tenant en produccion para Uniformes Consuelo Rios.

> **Estado**: Production-ready. URL: https://yourdomain.com · VPS Vultr (104.156.247.226). Branch productivo: `main`.

---

## Que es

Plataforma integral para gestionar el negocio de uniformes escolares: **inventario**, **ventas presenciales y online**, **encargos personalizados**, **alteraciones**, **contabilidad global**, **caja menor**, **integracion con Wompi** para pagos online, **alertas en Telegram** al equipo, y **portal para padres** que les permite consultar el catalogo, ordenar y pagar.

**Lo distintivo**:

- **Multi-tenant**: un solo backend sirve a varios colegios (Caracas, Pinal, Pumarejo) sin cross-contamination de datos operacionales.
- **Contabilidad global**: la dueña ve UNA caja y UNA cuenta bancaria — los colegios son fuentes de ingreso, no entidades contables separadas.
- **Multi-cliente**: app desktop (vendedoras), portal web (padres), portal admin (superusuarios), app movil (vendedoras en terreno).
- **Permisos granulares**: 70+ permission codes con roles del sistema, custom roles por colegio y overrides por usuario.

---

## Componentes

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                CLIENTES                                  │
├──────────────┬──────────────┬──────────────────┬───────────────────────┤
│ Tauri Desktop│  Mobile App  │   Web Portal     │   Admin Portal        │
│ (Vendedoras) │ (Vendedoras  │   (Padres)       │  (Superusuarios)      │
│ React + TS   │  en terreno) │   Next.js 14     │   Next.js 16          │
│ Tauri 2.x    │  Expo SDK 54 │   App Router     │                       │
└──────┬───────┴──────┬───────┴────────┬─────────┴────────┬──────────────┘
       │              │                │                  │
       └──────────────┴────────┬───────┴──────────────────┘
                               │
                        ┌──────▼──────┐
                        │   Nginx     │ ← TLS, reverse proxy, rate-limit
                        └──────┬──────┘
                               │
                        ┌──────▼──────┐
                        │  FastAPI    │ ← Async, structlog, ASGI middleware
                        │  Backend    │   Permission registry + audit trail
                        └──┬───────┬──┘
                           │       │
              ┌────────────┘       └─────────────┐
              │                                  │
       ┌──────▼──────┐                  ┌────────▼────────┐
       │ PostgreSQL 15│                  │  Redis (cache)  │
       │  + Alembic   │                  └─────────────────┘
       └──────────────┘
                           │
       ┌───────────────────┼───────────────────┬──────────────┐
       │                   │                   │              │
┌──────▼──────┐    ┌───────▼────────┐    ┌─────▼──────┐  ┌────▼─────┐
│   Wompi     │    │    Resend      │    │ Telegram   │  │ VultrUI  │
│  (pagos)    │    │   (emails)     │    │  Bot API   │  │  (logs)  │
└─────────────┘    └────────────────┘    └────────────┘  └──────────┘
```

---

## Stack

### Backend

| Componente | Tecnologia |
|---|---|
| Framework | FastAPI (Python 3.10+) |
| ORM | SQLAlchemy 2.0 (async) |
| Validacion | Pydantic v2 |
| DB | PostgreSQL 15 |
| Migraciones | Alembic |
| Cache | Redis + cache in-memory (permisos) |
| Auth | PyJWT + bcrypt (sin python-jose ni passlib) |
| Logging | structlog + ASGI middleware (request_id, client_ip) |
| Email | Resend |
| Pagos | Wompi |
| Mensajeria | Telegram Bot API |

### Frontend Desktop (`frontend/`)

Tauri 2.x + React 18 + TypeScript + Vite + Tailwind CSS + Zustand. Para vendedoras de planta — funciona offline parcialmente.

### Mobile App (`mobile/`)

Expo SDK 54 + React Native 0.81 + expo-router v6 + NativeWind. MVP para vendedoras en terreno: auth, ventas CRUD, clientes, inventario, ordenes. EAS workflows configurados para builds iOS/Android.

### Portal Web Padres (`web-portal/`)

Next.js 14 (App Router) + React 19 + Tailwind v4 + Zustand. Rutas dinamicas `[school_slug]`. Soporta productos globales (zapatos, medias, jeans, blusas) cross-school.

### Portal Admin (`admin-portal/`)

Next.js 16 — solo accesible por superusuarios. Gestion de schools, usuarios, custom roles, modelo financiero.

### Infraestructura

| Capa | Tecnologia |
|---|---|
| Servidor | VPS Vultr (Ubuntu 22.04) |
| Web Server | Nginx + Let's Encrypt |
| Proceso backend | systemd (`uniformes-api.service`) |
| Frontend desktop | Build firmado, distribucion manual |
| Mobile | EAS builds, distribucion via TestFlight / APK directo |

---

## Estructura del Repo

```
uniformes-system-v2/
├── backend/              # API FastAPI
│   ├── app/
│   │   ├── api/routes/   # 40+ archivos de endpoints
│   │   ├── core/         # config, auth, logging
│   │   ├── middleware/   # request_context (structlog)
│   │   ├── models/       # SQLAlchemy models
│   │   ├── services/     # Logica de negocio
│   │   ├── schemas/      # Pydantic schemas
│   │   └── utils/        # timezone, permission_validator
│   ├── alembic/          # Migraciones
│   └── tests/            # 280+ tests (unit + integration)
│
├── frontend/             # App Tauri (desktop, vendedoras)
│   ├── src/              # React + TS
│   └── src-tauri/        # Wrapper Rust
│
├── mobile/               # App Expo (vendedoras en terreno)
│   └── app/              # expo-router screens
│
├── web-portal/           # Next.js 14 (padres)
│   └── app/[school_slug]/
│
├── admin-portal/         # Next.js 16 (superusuarios)
│
├── shared/               # Tipos / utilidades compartidas
├── docs/                 # Documentacion (ver indice)
├── scripts/              # Backup, deploy, audit-tracker
└── docker/               # Compose para desarrollo
```

---

## Subsistemas Clave

### 1. Multi-Tenancy

- `school_id` en tablas operacionales (productos, ventas, ordenes, clientes, inventario).
- **Excepcion**: contabilidad es global (ver siguiente seccion).
- Permisos se evaluan por colegio (`UserSchoolRole` M2M).

> **Detalle**: [multi-tenant-design.md](./multi-tenant-design.md)

### 2. Contabilidad Global

- Una sola Caja y una sola cuenta bancaria para todo el negocio.
- `school_id` es opcional en tablas contables (solo para reportes/filtros).
- Endpoints globales: `/api/v1/global/accounting/*`.

> **Detalle**: [accounting-architecture.md](./accounting-architecture.md)

### 3. Sistema de Permisos

- 4 roles del sistema (OWNER, ADMIN, SELLER, VIEWER) + custom roles por colegio.
- 70+ permission codes granulares estilo `categoria.accion`.
- Constraints parametrizados (`max_amount`, `requires_approval`, `max_discount_percent`).
- Cache TTL 60s con invalidacion post-commit (`PermissionInvalidator`).
- Audit trail en `audit_logs`.

> **Detalle**: [permission-system.md](./permission-system.md)

### 4. Pagos Online (Wompi)

- Sesiones con firma de integridad SHA-256.
- Webhook para confirmacion (`POST /payments/webhooks/wompi`).
- Estado en tabla `payment_transactions` (PENDING, APPROVED, DECLINED, VOIDED, ERROR).
- Mapeo automatico al sistema contable (Wompi → cuenta Banco).

> **Detalle**: [payment-system.md](./payment-system.md)

### 5. Cambios y Devoluciones

- Vendedora solicita → admin aprueba/rechaza.
- Calculo automatico de ajuste de precio + reversion de inventario.

> **Detalle**: [sale-changes-backend.md](./sale-changes-backend.md) · [sale-changes-frontend.md](./sale-changes-frontend.md)

### 6. Alertas Telegram

- Suscripciones por usuario (`telegram_alert_subscriptions`).
- Tipos: reactivas (venta cancelada, gasto creado), proactivas (low_stock), sistema (db_down, disk_high), digest diario.
- Routing por permiso — un usuario solo recibe alertas para las que tiene visibilidad.

### 7. Logging Estructurado

- `structlog` + ASGI middleware.
- Cada request lleva `request_id`, `client_ip`, `user_id` en el contexto.
- Filtro de scanner traffic. Logs JSON consumidos por VultrUI Log Explorer.

### 8. Caja Menor

- Apertura/cierre diario por vendedora.
- Liquidacion con constraint de monto por rol.
- `daily_cash_registers` registra el flujo.

### 9. Cost Breakdown

- Costos de productos por componentes (material, mano de obra, overhead).
- `unit_cost` snapshot al momento de la venta para preservar margen historico.
- Fallback chain a COGS cuando no hay breakdown.

---

## Flujos Principales

### Venta presencial

```
Vendedora abre caja → Selecciona productos → Cliente
  → Metodo de pago (cash/nequi/transfer/card/credit)
  → Aplica descuento (sujeto a max_discount_percent del rol)
  → Confirma → Inventario decrece → Balance entry contable
  → Genera recibo → Telegram alert (opcional)
```

### Venta online (web-portal)

```
Padre navega catalogo → Carrito → Checkout
  → Verificacion telefono (OTP via SMS)
  → Pedido creado (status=pending) → Reserva inventario
  → Pago online via Wompi (sesion con integrity hash)
  → Webhook confirma → Status=paid → Contabilidad automatica
  → Telegram alert al admin → Vendedora prepara
  → Convierte a sale → Entrega
```

### Ajuste de inventario sensible

```
Admin inicia ajuste → Pasa require_permission("inventory.adjust")
  → Si es ADMIN con max_amount: check_amount_constraint()
  → Si requires_approval: solicita codigo de aprobacion
  → Aplica → audit_logs registra before/after + IP/UA
  → PermissionInvalidator NO aplica (permisos no cambian)
```

---

## Caracteristicas Distintivas

1. **Multi-tenant operacional + contabilidad global** — modelo hibrido que refleja el negocio real.
2. **Permisos granulares con constraints** — un SELLER puede aplicar descuentos pero solo hasta 10%.
3. **Multi-cliente en producto unico** — cuatro frontends compartiendo un solo backend.
4. **Audit trail integrado** — toda accion sensible (rol, balance, supusuario) queda trazada.
5. **Permission registry como single source of truth** — cero duplicacion de codes en frontend.
6. **Cache de permisos coherente** — invalidacion post-commit + version bumping.
7. **Pasarela de pagos en produccion** — Wompi end-to-end con webhooks verificados por firma.

---

## Referencias

| Documento | Descripcion |
|---|---|
| [permission-system.md](./permission-system.md) | Roles, permisos granulares, cache, audit |
| [multi-tenant-design.md](./multi-tenant-design.md) | School-scoped vs global |
| [accounting-architecture.md](./accounting-architecture.md) | Sistema contable global |
| [payment-system.md](./payment-system.md) | Wompi end-to-end |
| [sale-changes-backend.md](./sale-changes-backend.md) | API de cambios |
| [sale-changes-frontend.md](./sale-changes-frontend.md) | UI de cambios |
| [v3-branch-architecture/](../v3-branch-architecture/) | Plan de evolucion v3 |

---

[← Volver al indice](./README.md)

---

*Ultima actualizacion: 2026-05-02 | Version: 2.0.0*
