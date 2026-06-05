# Arquitectura del Sistema

Documentacion del diseño tecnico de **Uniformes System v2**.

---

## Indice

### Vision general

| Documento | Descripcion |
|-----------|-------------|
| [system-overview.md](./system-overview.md) | Componentes, stack, subsistemas, flujos end-to-end |

### Subsistemas

| Documento | Descripcion |
|-----------|-------------|
| [multi-tenant-design.md](./multi-tenant-design.md) | Diseño multi-tenant (colegios) — operacional vs global, productos globales |
| [permission-system.md](./permission-system.md) | Roles, permisos granulares, constraints, cache, audit trail |
| [accounting-architecture.md](./accounting-architecture.md) | Sistema contable global — caja unica, Caja Menor, AP/AR, integracion ventas |
| [cost-breakdown-system.md](./cost-breakdown-system.md) | Costos por componente, snapshots `unit_cost`, fallback chain |
| [payment-system.md](./payment-system.md) | Pasarela Wompi — sesiones, webhooks, integracion contable |
| [telegram-alerts-system.md](./telegram-alerts-system.md) | Alertas, suscripciones, routing por rol, daily digest |
| [logging-and-observability.md](./logging-and-observability.md) | structlog, ASGI middleware, request_id, VultrUI |
| [mobile-app-architecture.md](./mobile-app-architecture.md) | App Expo SDK 54 para vendedoras en terreno |

### Flujos especificos

| Documento | Descripcion |
|-----------|-------------|
| [sale-changes-backend.md](./sale-changes-backend.md) | API de cambios y devoluciones |
| [sale-changes-frontend.md](./sale-changes-frontend.md) | UI de cambios y devoluciones |

### Roadmap

| Documento | Descripcion |
|-----------|-------------|
| [../v3-branch-architecture/](../v3-branch-architecture/) | Plan de evolucion v3 (multi-branch + commercializacion) |

---

## Resumen rapido

### Stack

- **Backend**: FastAPI (Python 3.10+), SQLAlchemy 2.0 async, PostgreSQL 15, Redis, Pydantic v2, Alembic.
- **Auth**: PyJWT + bcrypt (sin python-jose ni passlib).
- **Logging**: structlog + ASGI middleware con request_id.
- **Frontend Desktop**: Tauri 2.x + React 18 + TS + Tailwind + Zustand (vendedoras).
- **Mobile**: Expo SDK 54 + React Native 0.81 + expo-router v6 (vendedoras en terreno).
- **Portal Web Padres**: Next.js 14 (App Router) + React 19 + Tailwind v4.
- **Portal Admin**: Next.js 16 (superusuarios).
- **Integraciones**: Wompi (pagos), Resend (email), Telegram Bot API (alertas).

### Patron multi-tenant

- `school_id` en tablas operacionales (productos, ventas, ordenes, clientes, inventario).
- **Contabilidad es GLOBAL** — una sola caja y una sola cuenta bancaria. `school_id` es opcional en tablas contables.
- Permisos evaluados por colegio (`UserSchoolRole` con system role o custom role + overrides).

### Diagrama compacto

```
┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
│  Tauri   │  │  Mobile  │  │WebPortal │  │AdminPortl│
│ Desktop  │  │  (Expo)  │  │ (Next14) │  │ (Next16) │
└────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘
     └─────────────┴───────┬─────┴─────────────┘
                           ▼
                    ┌──────────────┐
                    │   FastAPI    │ ← structlog + permission registry
                    └──┬────────┬──┘
                       │        │
                ┌──────▼──┐  ┌──▼─────┐
                │ Postgres│  │ Redis  │
                └─────────┘  └────────┘
                       │
              ┌────────┴────────┬────────────┐
              ▼                 ▼            ▼
           Wompi            Resend      Telegram
```

### Roles del sistema

| Rol | Nivel | Para quien |
|---|---|---|
| OWNER | 4 | Dueña — full access + user mgmt |
| ADMIN | 3 | Administradores — datos de negocio completos |
| SELLER | 2 | Vendedoras — ventas, clientes, ordenes |
| VIEWER | 1 | Solo lectura (auditoria/contadora externa) |

> Detalle granular en [permission-system.md](./permission-system.md).

---

## Como navegar la documentacion del proyecto

| Carpeta | Cuando ir aqui |
|---|---|
| [`/docs/architecture/`](./) | Diseño tecnico, decisiones arquitectonicas |
| [`/docs/deployment/`](../deployment/) | Como deployar a produccion |
| [`/docs/development/`](../development/) | Setup local, debugging, troubleshooting |
| [`/docs/test/`](../test/) | Testing strategy, coverage, fixtures |
| [`/docs/user-guide/`](../user-guide/) | Manual de usuario final |
| [`/docs/audits/`](../audits/) | Tracking de auditorias externas |
| [`/docs/v3-branch-architecture/`](../v3-branch-architecture/) | Roadmap de evolucion v3 |

---

[← Volver al indice general](../README.md)

---

*Ultima actualizacion: 2026-05-02 | Version: 2.0.0*
