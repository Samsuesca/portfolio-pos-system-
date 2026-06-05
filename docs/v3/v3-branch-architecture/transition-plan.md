# Plan de Transicion — Branch → B2B → Organization → SaaS

> **Version:** 1.2
> **Fecha original:** 2026-04-13
> **Revisiones:** 1.1 (2026-05-22) track B2B agregado · 1.2 (2026-05-24) timeline corregido tras Sprint Q2
> **Horizonte:** Abril 2026 — Marzo 2027 (shifted ~2 meses respecto al plan original)

---

## Estado real al 2026-05-24 (lo que efectivamente paso)

| Fase originalmente para | Estado real |
|-------------------------|-------------|
| v3.0.0 PROD — Abril 2026 | ⏸️ **Diferido.** Codigo mergeado en `main` (`9cb0913`), prod sigue v2.9.0. Sin ventana asignada. Ver [v3-release-scope.md](./v3-release-scope.md) y [ROADMAP formalizacion Track A](../formalization/ROADMAP.md). |
| v3.1.0 DEV — Mayo 2026 | ❌ No iniciado. Bloqueado por Fase 0. |
| v3.1.0 PROD — Junio 2026 | ❌ Depende de v3.1.0 dev y de Fase 0 deployed. Realista: jul-ago 2026. |
| v3.2.0 DEV — Jul-Ago 2026 | ❌ No iniciado. Diseño hecho. Realista: ago-sep 2026. |
| v3.2.0 PROD — Sep-Oct 2026 | ❌ Realista: nov-dic 2026. |
| B2B B0 (doc + FE DIAN) | ✅ **Hecho** via Alegra externo (2026-05-16). Pendiente: integrar Alegra a backend UCR. |
| B2B B1-B5 (codigo) | ❌ No iniciado. Sin cambios. |

**Causa raiz del atraso:** el Sprint Q2 (LUN 4 → SAB 9 may) planeo cerrar Fase 0 en 6 dias y se extendio a 20+ dias por scope expandido (pnpm migration, mobile MVP, Alegra DIAN, formalizacion 8-dim, bank reconciliation, equipo bitacoras). El trabajo es valioso y mergeado, pero el deploy nunca disparo. Detalle en [sprint-log.md](../formalization/sprint-log.md) y [ROADMAP formalizacion](../formalization/ROADMAP.md).

---

## Timeline general (revisado 2026-05-24)

```
Abr-May 2026     Jun           Jul-Ago        Sep-Oct        Nov-Dic         Ene-Feb 2027
──────────────────────────────────────────────────────────────────────────────────────────
│ v3.0.0 DEV  │  v3.0.0 PROD  │ v3.1.0 DEV  │ v3.1.0 PROD │ v3.2.0 DEV   │ v3.2.0 PROD │
│ (HECHO en  │  (deploy ya   │  Branches    │  Sucursal    │  Organization │  Vendible    │
│  main)      │   deferido a  │  + Financial │  Nueva Live  │  + SaaS prep  │  ~feb 2027   │
│  ⏸️ deploy   │   ventana     │  Model MVP   │              │  + White-lbl  │              │
│  pendiente  │   por agendar │              │              │               │              │
──────────────────────────────────────────────────────────────────────────────────────────
│ B2B TRACK (B0 ya activo externamente; codigo entrelazado con v3.1/v3.2) ──────────────►
│   B0 ✅      │ Integrar     │ B1 datos    │ B2 cotiz.   │ B3 contratos │ B4 MF + B5  │
│   Alegra    │ Alegra a     │ B2B clients │              │ + anticipos  │ institucional│
│   (ext)     │ backend UCR  │             │              │              │              │
──────────────────────────────────────────────────────────────────────────────────────────
```

> **El track B2B corre en paralelo** a los releases de version, no como una version aparte. Su fase B0 (soporte documental + FE DIAN) **ya esta activa via Alegra externo desde 2026-05-16** y desbloquea el contrato del restaurante (~$9M). La siguiente prioridad B2B es integrar la API de Alegra al backend UCR para emitir facturas desde el sistema. Las fases B1–B5 (codigo) se entrelazan con v3.1 (cada contrato es por sucursal) y v3.2 (B2B es un stream del modelo financiero). Detalle completo en [b2b-contracts-model.md](./b2b-contracts-model.md).

---

## Fase 0: v3.0.0 — Estabilizacion (originalmente abr 2026, real: en main desde may 2026, deploy ⏸️)

### Objetivo
Desplegar todos los cambios pendientes a produccion. Limpiar deuda tecnica antes de construir encima.

### Entregables

- [x] Commits organizados por iniciativa (unificacion, vendors, positions, payments)
- [x] 14 migraciones aplicadas en dev sobre data prod fresca sin errores (Sprint Q2 M2)
- [x] Tests backend pasando en modulos afectados (109+64 PASSED)
- [x] Frontend build limpio (con pnpm 11)
- [x] Hardening Sprint Q2: 5 bugs contables + Gap A equity + permission seed
- [ ] Smoke test **en produccion** (ventas, ordenes, gastos, CxP)
- [ ] Tag `v3.0.0` en git
- [ ] Audit score 100/100 (script `audit_data_quality_score.py` no escrito)
- [ ] Decision sobre reclasificaciones masivas pre/post deploy
- [ ] Ventana de deploy agendada

### Riesgos (revisados con experiencia del sprint)

| Riesgo | Mitigacion | Validado en dev |
|--------|------------|-----------------|
| SaleItem.product_id NULL en prod | Query de verificacion antes de migrar | ✅ 609 remapped sin NULLs en dev |
| Vendor strings no mapeados | `vendor_norm_b` valida coverage | ✅ 97 vendors creados sin huerfanos |
| Migraciones fuera de orden | Script de deploy con orden explicito | ✅ Cadena lineal validada en M2 |
| Bug `set_balance` historico ($21.6M trazabilidad) | Asiento equity correctivo post-deploy | ⏸️ pendiente bank reconciliation |
| Reclasificacion masiva durante deploy | Mover a scripts post-deploy idempotentes | ⏸️ decision pendiente owner |
| VPS sin pnpm 11 instalado | Pre-deploy runbook en `docs/deployment/` | ✅ runbook escrito |

### Estado real
- **Codigo:** completo en `main` desde `9cb0913` (~2026-05-10).
- **Deploy:** sin agendar.
- **Bloqueador:** owner debe decidir ventana + politica reclasificaciones.

---

## Fase 1A: v3.1.0-dev — Branch Infrastructure (originalmente may 2026, revisado: jul 2026)

> **Estado:** ❌ No iniciado. Depende de Fase 0 deployed en prod (sin ventana asignada). Realista arrancar julio 2026.

### Objetivo
Introducir `Branch` y `SchoolIdentity` en el modelo de datos. Migrar datos existentes a "Central". Backend funcional con filtros por sucursal.

### Entregables

**Migraciones:**
- [ ] Crear tabla `branches`
- [ ] Crear tabla `school_identities`
- [ ] Agregar `branch_id` a: schools, sales, orders
- [ ] Agregar `branch_id` a: daily_cash_registers, balance_accounts, transactions, expenses, accounts_receivable, accounts_payable
- [ ] Agregar `school_identity_id` a schools
- [ ] Agregar `branch_id` a user_school_roles
- [ ] Data migration: crear Branch "Central", asignar todo
- [ ] Data migration: crear SchoolIdentities desde nombres de colegios
- [ ] Hacer branch_id NOT NULL en schools, sales, orders

**Backend:**
- [ ] Modelo `Branch` + `SchoolIdentity` en SQLAlchemy
- [ ] `BranchService` — CRUD, listar branches accesibles por usuario
- [ ] `SchoolIdentityService` — CRUD, agrupar sedes
- [ ] Dependency `get_user_branch_ids` para inyeccion en routes
- [ ] Filtro `branch_id` en: SaleService, OrderService, AccountingService
- [ ] API routes: `/branches` (CRUD), `/school-identities` (CRUD)
- [ ] Permisos: `branches.view`, `branches.manage`, `branches.view_all` (admin central)
- [ ] Tests unitarios para BranchService, filtros por branch

**Frontend:**
- [ ] `BranchSelector` en header (Layout.tsx)
- [ ] `useBranchStore` — Zustand store con branch actual
- [ ] Servicios API: `branchService.ts`
- [ ] Todos los queries de listado incluyen `branch_id` cuando aplica
- [ ] Settings: administracion de sucursales

### Dependencias
- v3.0.0 desplegado (tablas unificadas, vendors normalizados)

---

## Fase 1B: v3.1.0-dev — Contabilidad por Sucursal (originalmente may 2026, revisado: jul-ago 2026)

> **Estado:** ❌ No iniciado.

### Objetivo
Cada sucursal opera su propia caja, gastos, y cuentas. La central ve todo consolidado.

### Entregables

**Backend:**
- [ ] `DailyCashRegisterService` — filtro por branch_id
- [ ] `BalanceAccountService` — cuentas por sucursal (Caja Centro, Caja Norte, Banco General)
- [ ] `ExpenseService` — gastos scoped por branch
- [ ] `AccountsReceivableService` / `AccountsPayableService` — por branch
- [ ] `TransactionService` — branch context en cada transaccion
- [ ] Reportes consolidados: P&L por branch, comparativo entre sucursales
- [ ] Dashboard central: saldos agregados con drill-down por sucursal

**Frontend:**
- [ ] Panel de contabilidad filtra por sucursal seleccionada
- [ ] Cierre de caja muestra sucursal activa
- [ ] Reportes: selector "Todas / Sucursal X / Sucursal Y"
- [ ] Dashboard central con cards por sucursal

### Tests
- [ ] Tests con fixture de 2 branches y datos aislados
- [ ] Verificar que branch A no ve datos de branch B
- [ ] Verificar que admin central ve todo

---

## Fase 1C: v3.1.0 — Deploy Sucursal Nueva (originalmente jun 2026, revisado: sep-oct 2026)

> **Estado:** ❌ No iniciado. La expansion a nueva sucursal sigue siendo objetivo del owner pero la implementacion tecnica esta detras de Fase 0 + 1A + 1B.

### Objetivo
Onboarding de la sucursal nueva. Sistema en produccion con 2 sucursales.

### Entregables
- [ ] Crear Branch "Norte" (o nombre real) en produccion
- [ ] Crear SchoolIdentity para colegios compartidos
- [ ] Crear registros School nuevos para colegios de la nueva sucursal
- [ ] Cargar productos, precios, costos para cada school nuevo
- [ ] Crear usuarios (admin sucursal, vendedoras)
- [ ] Crear balance_accounts para nueva sucursal (Caja Norte)
- [ ] Inventario inicial cargado
- [ ] Capacitacion a equipo de nueva sucursal
- [ ] Tag `v3.1.0`

---

## Fase 2A: v3.2.0-dev — Organization + White-label (originalmente jul-ago 2026, revisado: oct-nov 2026)

> **Estado:** ❌ No iniciado. Diseño completo en este doc.

### Objetivo
Abstraer UCR como una Organization. Eliminar hardcoding. Preparar para multi-tenant.

### Entregables

**Migraciones:**
- [ ] Crear tabla `organizations`
- [ ] Agregar `organization_id` a branches
- [ ] Data migration: crear Organization "UCR", vincular branches
- [ ] Hacer organization_id NOT NULL en branches

**Backend:**
- [ ] Modelo `Organization` (name, slug, logo_url, domain, config JSONB, plan_type, is_active)
- [ ] Middleware de tenant: `get_current_organization` dependency
- [ ] Filtro organization_id en todos los queries (via branch.organization_id)
- [ ] `Organization.config` JSONB schema:
  ```json
  {
    "business_name": "Uniformes Consuelo Rios",
    "logo_url": "/static/logo.png",
    "primary_color": "#1a365d",
    "domain": "yourdomain.com",
    "modules_enabled": ["wompi", "telegram", "payroll", "web_portal"],
    "max_branches": 5,
    "max_users": 20,
    "features": {
      "cost_breakdown": true,
      "financial_model": true,
      "custom_roles": true
    }
  }
  ```
- [ ] Reemplazar hardcoding: nombre del negocio, logo, colores → Organization.config
- [ ] Feature flags: `require_module("wompi")` dependency
- [ ] Tests multi-tenant: 2 organizations, datos aislados

**Frontend:**
- [ ] Branding dinamico: nombre, logo, colores desde API `/organization/config`
- [ ] Modulos condicionales: mostrar/ocultar features segun config
- [ ] Settings de organizacion (solo owner)

---

## Fase 2B: v3.2.0-dev — Modelo Financiero (originalmente jul-ago 2026, revisado: parcialmente HECHO)

> **Estado:** 🟢 **Parcialmente implementado en `main`.** El FinancialModelTab + ProjectionService + escenarios multi-fase de payroll + hardening de KPIs ya estan en `main` desde el Sprint Q2. Falta: P&L por branch (depende de Fase 1A), exportacion XLSX/PDF, y journal entries opcionales.

### Objetivo
Dashboard financiero ejecutivo comparable a OndaFin pero adaptado al negocio de uniformes.

### Entregables (ver [financial-model-design.md](./financial-model-design.md))
- [ ] Tablas: accounting_periods, financial_snapshots, journal_entries/lines (opcional)
- [ ] Servicio: P&L por periodo/branch/school (depende de v3.1)
- [x] Servicio: Margenes por producto/familia/colegio (en `FinancialStatementsService`)
- [x] Servicio: Proyeccion de flujo de caja (ProjectionService MVP)
- [x] Servicio: KPIs (ticket promedio, rotacion inventario, break-even por branch)
- [x] Servicio: Punto de equilibrio por sucursal (con divide-by-zero hardening)
- [x] Dashboard ejecutivo frontend (FinancialModelTab con 8 paneles)
- [ ] Exportacion XLSX/PDF

---

## Fase 2C: v3.2.0 — Comercializacion Ready (originalmente sep-oct 2026, revisado: ene-feb 2027)

> **Estado:** ❌ No iniciado. Depende de Fase 2A + maturity de Fase 1.

### Objetivo
Sistema vendible. Onboarding automatizado para Modelo B. Documentacion para Modelo A.

### Entregables

**Modelo B (SaaS):**
- [ ] Panel admin de tenants (crear organization, asignar plan)
- [ ] Onboarding flow: registrar negocio → crear organization → crear primer branch/school → invitar admin
- [ ] Planes y limites: free trial, basico, profesional
- [ ] Billing: integracion Wompi recurrente o manual
- [ ] Aislamiento de datos verificado (penetration test entre tenants)
- [ ] Landing page comercial

**Modelo A (Self-hosted):**
- [ ] Script de deployment automatizado (docker-compose + env vars)
- [ ] Documentacion de instalacion
- [ ] Guia de configuracion inicial
- [ ] Paquete de consultoria definido (alcance, precio, SLA)

---

## Track Paralelo: B2B Contratos (post-estabilizacion v3.0.0)

### Objetivo
Habilitar la venta por **contratos y cotizaciones** a otros negocios (restaurantes, empresas/dotacion legal, equipos deportivos, eventos, institucional). Es el pilar que **rompe la estacionalidad escolar** y genera el flujo de caja recurrente y de alto ticket. Ver diseno completo en [b2b-contracts-model.md](./b2b-contracts-model.md).

### Por que es un track paralelo (no una version)
El B2B no es un release de version; es una linea de negocio cuyo soporte tecnico se construye por fases que se entrelazan con v3.1 (cada contrato pertenece a una sucursal) y v3.2 (el B2B es un stream del modelo financiero). Su primera fase (B0) **no requiere codigo** y arranca de inmediato.

### Fases

| Fase | Entregable | Depende de | Prioridad | Estado |
|------|-----------|------------|-----------|--------|
| **B0 — Soporte documental + FE** | Plantilla de cotizacion numerada + contrato marco + politica de credito B2B. FE DIAN operativa. **Sin codigo.** Desbloquea el restaurante (~$9M) ya. | FE DIAN (`formalization/02-tributario.md` T7) | 🔴 Inmediato | ✅ **DONE 2026-05-16** via Alegra (resolucion 18764109873979) |
| **B0.5 — Integrar Alegra al backend** | API client de Alegra, emitir FE desde el sistema en lugar de manual | B0 done | 🟠 | ❌ No iniciado. `memory/alegra_api_integration_notes.md` tiene gotchas. |
| **B1 — Modelo de datos** | Tablas `b2b_clients`, `quotations`, `quotation_items`, `contracts`, `contract_milestones` + migraciones + permisos `b2b.*` | v3.0.0 deployed | 🟠 | ❌ |
| **B2 — Cotizaciones** | CRUD cotizaciones, PDF numerado, conversion a contrato, estados (draft→sent→accepted) | B1 | 🟠 | ❌ |
| **B3 — Contratos + anticipos** | Anticipo como **pasivo (ingreso diferido)**, saldo a credito (CxC con due_date), entrega, FE contra entrega | B2 | 🟠 | ❌ |
| **B4 — Integracion MF** | `ProjectionService` modela `b2b_pipeline` (contracalendario), KPIs B2B, alertas B2B, sensitivity tabla 7 | v3.2 modelo financiero | 🟠 | ❌ |
| **B5 — Hitos + institucional** | `contract_milestones`, soporte licitaciones (RUP, polizas) | B3 + SAS | 🟡 | ❌ |

### Riesgo de no documentarlo
Si el B2B no entra al modelo financiero como stream separado, el MF subestima el flujo real (solo proyecta retail escolar estacional) y exagera la caida de caja en los valles. Tambien se corre el riesgo de registrar anticipos como ingreso directo (inflando P&L de meses sin entrega) — el sistema v2.9.0 **no modela "Anticipos de clientes" como pasivo** (gap documentado en `b2b-contracts-model.md`).

### Dependencias cruzadas
- **FE DIAN** (`formalization/02-tributario.md` Gap 2.0): bloqueante comercial. El cliente B2B necesita la factura para deducir el costo.
- **IVA** (`formalization/02-tributario.md` Resp. 49): la dotacion corporativa **grava IVA** (a diferencia del uniforme escolar excluido). El B2B probablemente cruza a responsable de IVA. Validar con contador antes de contratos grandes.
- **Contratos marco B2B** (`formalization/06-comercial.md` Gap 6.6/6.7): clausulado, politica de credito, cotizacion numerada.
- **SAS** (`formalization/01-legal-corporativo.md`): requisito para el segmento institucional/licitaciones publicas.

---

## Resumen de Versiones (revisado 2026-05-24)

| Version | Contenido | Target original | Target revisado | Estado |
|---------|-----------|-----------------|-----------------|--------|
| v3.0.0 | Unificacion global tables, vendor normalization, positions, payments + 5 bugs contables + Gap A + pnpm 11 | Abril 2026 | **Deploy: por agendar** | ✅ Codigo en main, ⏸️ deploy diferido |
| v3.1.0 | Branches, school identities, contabilidad por sucursal | Junio 2026 | Jul-Ago 2026 (sucursal nueva: sep-oct) | ❌ No iniciado |
| v3.2.0 | Organization, white-label, modelo financiero, comercializacion | Octubre 2026 | Nov-Dic 2026 (vendible: feb 2027) | ❌ No iniciado (modelo financiero parcial ya en main) |
| **B2B track** | Contratos/cotizaciones (B0 documental → B5 institucional) — **paralelo** | B0 inmediato | B0 ✅ DONE; B0.5 Alegra integration siguiente | B0 ✅, resto ❌ |

---

## Migracion a Modelo Relacional Puro (Futuro, post-v3.2.0)

Una vez estabilizado el sistema con branches y organizations, es viable migrar `School` a un modelo relacional puro:

```sql
-- Nueva tabla junction (reemplaza school.branch_id + school.school_identity_id)
CREATE TABLE branch_schools (
    id UUID PRIMARY KEY,
    branch_id UUID NOT NULL REFERENCES branches(id),
    school_identity_id UUID NOT NULL REFERENCES school_identities(id),
    -- datos que hoy viven en schools
    name VARCHAR(200),        -- nombre display en esta sucursal
    slug VARCHAR(100),
    logo_url VARCHAR(500),
    is_active BOOLEAN,
    UNIQUE (branch_id, school_identity_id)
);

-- Remap: school_id en todas las tablas apunta a branch_schools.id
-- Es un refactor interno — mismas FKs, diferente tabla destino
```

**Riesgo:** Bajo. Es un rename + data migration. Todos los `school_id` FKs siguen apuntando al mismo concepto. Los queries no cambian (solo el nombre de la tabla en JOINs).

**Beneficio:** Modelo mas claro conceptualmente. `BranchSchool` es un nombre mas preciso que `School` para lo que la tabla realmente representa.

**Recomendacion:** Hacer esto como v3.3.0, despues de que el sistema este corriendo con multiples sucursales y tenants. No es urgente — es limpieza de modelo.

---

[← Volver al indice](./README.md)
