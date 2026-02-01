# Arquitectura del Sistema

Documentacion del diseno tecnico de Uniformes System v2.0.

---

## Contenido

| Documento | Descripcion |
|-----------|-------------|
| [system-overview.md](./system-overview.md) | Vision general de la arquitectura |
| [database-schema.md](./database-schema.md) | Esquema de base de datos PostgreSQL |
| [accounting-architecture.md](./accounting-architecture.md) | Sistema contable global |
| [multi-tenant-design.md](./multi-tenant-design.md) | Diseno multi-tenant (colegios) |
| [sale-changes-backend.md](./sale-changes-backend.md) | API de cambios y devoluciones |
| [sale-changes-frontend.md](./sale-changes-frontend.md) | UI de cambios y devoluciones |

---

## Resumen de Arquitectura

### Stack Tecnologico

**Backend:**
- Python 3.10+ / FastAPI 0.104.1
- SQLAlchemy 2.0 (async) / PostgreSQL 15
- Alembic (migraciones)

**Frontend Desktop (Tauri):**
- React 18 + TypeScript
- Tailwind CSS
- Zustand (estado)

**Portal Web (Next.js):**
- Next.js 14 (App Router)
- React 19 + TypeScript

### Patron Multi-Tenant

- Cada colegio es un tenant independiente
- `school_id` en tablas operacionales
- Contabilidad es GLOBAL (del negocio, no por colegio)

### Componentes Principales

```
┌─────────────────┐     ┌─────────────────┐
│  Tauri Desktop  │     │   Web Portal    │
│   (Vendedores)  │     │    (Padres)     │
└────────┬────────┘     └────────┬────────┘
         │                       │
         └───────────┬───────────┘
                     │
              ┌──────▼──────┐
              │  FastAPI    │
              │  Backend    │
              └──────┬──────┘
                     │
              ┌──────▼──────┐
              │ PostgreSQL  │
              └─────────────┘
```

---

[← Volver al indice](../README.md)
