# v3 — Hub canónico

> **Fuente de verdad de la versión v3.** Si vas a tocar algo de v3 (deploy, conciliación, roadmap, diseño), empieza aquí.
> Lectores: owner-dev (Angel) y Claude en sesiones futuras.

---

## Estado actual

| Aspecto | Valor |
|---------|-------|
| **v3 en producción** | Sí — desde el **28-may-2026** (commit `ba9b30d`) |
| **Head Alembic en prod** | `v3_school_global_gt_excl_001` |
| **Scripts de datos §4.3 + §4.7** | **Aplicados a prod el 30-may** (import costos: 2448 components / 436 productos; backfill timestamps de Encargos/Arreglos) |
| **Estabilización contable §4.4** | **EN PAUSA / HOLD** — 239 bank entries + AP Cristina $19M **NO** aplicados a prod |
| **Conciliación de Encargos (orders)** | **PENDIENTE** — GATE 0, 25 casos huérfanos (~$2.56M) |
| **VPS / dominio** | 104.156.247.226 · yourdomain.com |

**Resumen en una línea:** el cuerpo estructural de v3.0.0 (unificación de tablas globales, normalización de vendors, posiciones, hardening contable de 5 bugs + Gap A equity, costos por desglose, reports coverage, pnpm 11) **ya está en prod**. Lo único que falta para declarar v3 *conciliado al 100%* es trabajo de **DATOS**: dos conciliaciones pausadas (contable + encargos). Ver [Ruta a conciliación 100%](#ruta-a-conciliación-100).

---

## Mapa del directorio

| Ruta | Contiene | Estado |
|------|----------|--------|
| **`README.md`** (este) | Hub canónico de v3 | Vigente |
| **`CONCILIACION-PENDIENTE.md`** | Detalle operativo de las dos conciliaciones pausadas (contable + encargos) | Vigente *(se crea en paralelo)* |
| **`sesion-conciliacion-consuelo.md`** | Guion de la sesión presencial con la dueña: 7 bloques (~$83M) con casillas firmables. **Gate que desbloquea §4.4** | Vigente |
| **`presentacion-conciliacion-consuelo.html`** | Slides companion de la sesión (visual para Consuelo) | Vigente *(sincronizar con decisiones de la sesión)* |
| **`audit/`** | `PROD-AUDIT-2026-05-16.md` (auditoría pre-deploy) + capturas | **Histórico** — describe fixes pre-cutover ya pasados |
| **`design/`** | `business-facts.md` (hechos de negocio desde DB) · `storefront-v3-handoff.md` (handoff Claude Design → Next.js) | Vigente (storefront es trabajo abierto, no conciliación) |
| **`v3-branch-architecture/`** | Scope y arquitectura: `v3-release-scope.md`, `reports-coverage.md`, `transition-plan.md` + diseños forward-looking (`business-line-model`, `b2b-contracts-model`, `branch-architecture`, `financial-model-design`) | Mixto — ver tabla detallada abajo |
| **`formalization/`** | 8 dimensiones de formalización (`01..08`), `ROADMAP.md`, `deploy-checklist.md`, `README.md`, bitácoras + subcarpetas | Mixto — ver abajo |
| **`formalization/estabilizacion_contable/`** | Núcleo documental de la **conciliación contable**: diagnósticos bancarios, plan de 239 INSERTs, análisis forense del patrimonio | Vigente (varios `-05-16` están **obsoletos**, ver abajo) |
| **`formalization/estabilizacion_financiera/`** | Impacto de formalización, estado del modelo financiero, plan del importer de costos | Mixto (varios **históricos** post-deploy) |
| **`formalization/estabilizacion_operacional/`** | Inventario maestro de SOPs/runbooks/contratos faltantes | Vigente — ortogonal a la conciliación |
| **`formalization/prompts/`** | 7 prompts reutilizables (sesiones forenses + migraciones) | Mixto — plantillas vigentes + históricos ya ejecutados |
| **`formalization/equipo/`** | Roadmap de compensación 3 fases + presentación v3-launch | Plantilla (post-deploy) |
| **`formalization/discovery/`** | Sesiones de discovery foundational que alimentaron las 8 dimensiones | **Histórico** |
| **`formalization/screenshots/`** | Capturas del modelo financiero (KPIs, proyecciones) | Referencia |
| **`logs/`** | Outputs efímeros de MCP (Chrome DevTools / Puppeteer) de auditorías | **Obsoleto** — descartable |

### Detalle: `formalization/` (raíz y subdirs)

| Doc | Rol | Estado |
|-----|-----|--------|
| [`deploy-checklist.md`](formalization/deploy-checklist.md) | **Fuente de verdad operativa del deploy** (v1.2 con log de ejecución real prod 28/30-may). Marca qué scripts corrieron y cuál sigue en HOLD | **Vigente** |
| [`ROADMAP.md`](formalization/ROADMAP.md) | Plan Q2-Q3 + gates de deploy (GATE 0 encargos, GATE 1 runtime VPS) | **Histórico** (retrospectiva congelada al 24-may; aún dice prod en v2.9.0) |
| [`README.md`](formalization/README.md) | Índice de las 8 dimensiones de formalización | Vigente (navegacional) |
| [`sprint-log.md`](formalization/sprint-log.md) | Bitácora del sprint Q2 (M1-M5) con rollbacks por milestone | **Histórico** (M4/M5 marcados diferidos cuando ya se ejecutaron) |
| [`db-snapshot-workflow.md`](formalization/db-snapshot-workflow.md) | Cómo resetear DB dev con data fresca de prod + `alembic upgrade head` | Vigente *(head de referencia desactualizado vs prod)* |
| `01-legal-corporativo` … `08-tecnologico` | Las 8 dimensiones (legal, tributario, contable, laboral, datos, comercial, operacional, tecnológico) | Vigentes (`03-contable.md` ancla la conciliación) |
| `estabilizacion_contable/bank-*-2026-05-17.*` | Diagnóstico v2, plan de 239 entries, track-summary, CSV de detalle | **Vigentes** (fuente de §4.4) |
| `estabilizacion_contable/bank-*-2026-05-16.md` | Diagnóstico v1 y fixes v1 | **Obsoletos** (superados por la versión 17-may) |
| `estabilizacion_contable/patrimony-deep-analysis-2026.md` | Análisis forense: origen del $21.6M, $19M Cristina, Nequi $20M | **Vigente** |
| `estabilizacion_contable/migration-plan-hybrid.md` · `intangibles-management.md` | Diseño de reclasificación de gastos + política NIIF intangibles | Vigentes (diseño, no implementado) |
| `estabilizacion_financiera/financial-impact.md` · `financial-model-design.md` | Costos de formalizar + diseño del modelo | Vigentes |
| `estabilizacion_financiera/financial-model-current-state.md` · `costs-importer-plan-revised.md` | Estado del modelo + plan del importer | **Históricos** (describen tareas ya ejecutadas) |

### Detalle: `v3-branch-architecture/`

| Doc | Rol | Estado |
|-----|-----|--------|
| [`README.md`](v3-branch-architecture/README.md) | Índice de los 3 pilares de crecimiento | Vigente |
| [`v3-release-scope.md`](v3-branch-architecture/v3-release-scope.md) | Maestro 75KB con las 11 iniciativas + GATES | **Histórico** (dice "DEPLOY DIFERIDO" — ya se deployó el 28-may) |
| [`reports-coverage.md`](v3-branch-architecture/reports-coverage.md) | Arquitectura del módulo /reports (3 streams) | **Histórico** (fases 1-5 + backfill ya en prod) |
| `business-line-model.md` · `b2b-contracts-model.md` · `branch-architecture.md` · `financial-model-design.md` · `transition-plan.md` | Diseños forward-looking (perfumería, B2B, sucursales, modelo financiero) | Vigentes — **roadmap post-v3, NO código en curso** |

---

## Estado de estabilización v3

### Ya estable y desplegado (no tocar)

- **Schema v3** en prod (head `v3_school_global_gt_excl_001`): unificación de tablas globales, normalización de vendors, posiciones, `reserved_qty`, `token_version`, title-case.
- **Hardening contable Q2**: 5 bugs cerrados + Gap A (equity opening balance). P&L corregido de falsa pérdida a utilidad real.
- **Costos por desglose (§4.3)**: 2448 components en 436 productos importados a prod el **30-may**.
- **Backfill de timestamps (§4.7)**: `delivered_at` / `ready_at` de Encargos y Arreglos poblados en prod el **30-may** (métricas de lead time pre-deploy son **aproximadas**).
- **Reports coverage**: 3 streams (Ventas / Encargos / Arreglos) con `_cogs_resolver` único; stub B2B y `branch_id` no-op listos para v3.1.
- **pnpm 11**: 4 sub-repos migrados con supply-chain hardening.
- **Web-portal**: catálogo, galería con thumbnails, GoogleLogin gateado (commits hasta `ba9b30d`).

### Falta para 100% conciliado/estable (todo de DATOS)

| Pendiente | Bloqueado por | Doc |
|-----------|---------------|-----|
| **§4.4 contable**: 239 bank entries + AP Cristina $19M a prod | Sesión Consuelo + discrepancia de balances dry-run | [deploy-checklist §4.4](formalization/deploy-checklist.md) |
| **GATE 0 encargos**: 25 casos huérfanos (~$2.56M) + tabla `order_audit_overrides` | Sesión forense nunca corrida | [CONCILIACION-PENDIENTE.md](CONCILIACION-PENDIENTE.md) |
| **§4.5** decisiones owner: 20 owner_drawings (~$5.05M), reclasificación masiva mercado/ocio (~$4.92M), Nequi $20M, equity correctivo $21.6M, 7 transfers internas (~$3.6M, falta script de marcado) | Sesión Consuelo (bloques 2-6) | [sesion-conciliacion-consuelo.md](sesion-conciliacion-consuelo.md) |
| **Línea perfumería/belleza** (`business_line`, ~4.5-5 días dev) | Decisión de timing (de facto diferido a v3.1) | [v3-branch-architecture/business-line-model.md](v3-branch-architecture/business-line-model.md) |
| **§4.8** `audit_data_quality_score.py` (objetivo 100/100, cron diario) | Script no escrito | [deploy-checklist §4.8](formalization/deploy-checklist.md) |
| **Smoke completo §6/§6.3** (reports coverage, invariante `sum(streams)==total`) | Post-§4.4 | [deploy-checklist §6](formalization/deploy-checklist.md) |

---

## Ruta a conciliación 100%

Hay **dos conciliaciones en PAUSA**. Mientras no cierren, v3 está *deployado* pero **no conciliado**.

> Detalle completo y operativo en **[CONCILIACION-PENDIENTE.md](CONCILIACION-PENDIENTE.md)**.

### 1. Conciliación contable (§4.4) — HOLD

**Por qué está pausada:**
- El dry-run en prod arrojó balances finales **distintos** a los documentados (Banco `1,966,800.45` / Nequi `120,354.64` reales vs `1,813,800.45` / `191,354.64` del plan). Prod arrancó de saldos ya conciliados contra extracto real → **riesgo de double-count** si se commitean los 239 entries a ciegas.
- El script crea un vendor **`Cristina Rios`** que puede **duplicar** `Cristina Londoño` ya existente.
- Es una **sesión de DB pura** que debe cruzarse con múltiples fuentes externas (extractos Bancolombia, PDFs Nequi password-protected, xlsx, facturas Alegra).

**Qué se necesita para cerrarla:**
1. Realizar la **sesión con Consuelo** y firmar los 7 bloques (~$83M) → [`sesion-conciliacion-consuelo.md`](sesion-conciliacion-consuelo.md). **Bloque 0 (perfumería) es pre-requisito conceptual** de los bloques 3 y 4.
2. Resolver la discrepancia de balances del dry-run (confirmar que prod no fue ya conciliado → evitar double-count).
3. De-duplicar el vendor Cristina antes de `--commit`.
4. Conseguir el **extracto Bancolombia de abril 2026** (hoy el desfase de -$7.7M se mide solo al 31-mar) para desbloquear el equity correctivo del $21.6M.
5. Aplicar a prod via `apply_stabilization_data_corrections.py --commit` y verificar `COUNT(BANK-%) = 239`.

### 2. Conciliación de Encargos (orders, GATE 0) — PENDIENTE

**Por qué está pausada:** la sesión forense de los 25 casos anómalos (~$2.56M) **nunca se corrió**; el owner exige cerrarla antes de declarar versión estable. Incluye casos Tipo F no delegables: **ENC-2026-0118 JUCUM $848K** y **ENC-2026-0128 Cristina Giraldo $130K** (verificar si cruza con el préstamo Cristina $19M).

**Qué se necesita para cerrarla:**
1. Correr la sesión forense (xlsx `TRACKEOS ENCARGOS.xlsx` vs `prod_snapshot` read-only) → acta de decisiones caso por caso, sin tocar `orders.status` público.
2. Implementar la materialización silenciosa: tabla `order_audit_overrides` + migración + endpoint admin + `LEFT JOIN` en P&L/AR aging + script de asientos.
3. Decidir personalmente los casos Tipo F.

Plantilla de la sesión: [`formalization/prompts/encargos-audit-session-prompt.md`](formalization/prompts/encargos-audit-session-prompt.md).

---

## Cómo evolucionar v3

| Necesito… | Va aquí |
|-----------|---------|
| **Scope** (qué entró, las 11 iniciativas, los gates) | [`v3-branch-architecture/v3-release-scope.md`](v3-branch-architecture/v3-release-scope.md) *(histórico, pero hoja de ruta de datos pendientes)* |
| **Roadmap** (Q2-Q3, pilares post-v3) | [`formalization/ROADMAP.md`](formalization/ROADMAP.md) y [`v3-branch-architecture/README.md`](v3-branch-architecture/README.md) |
| **Deploy** (qué corrió, qué falta, rollback) | [`formalization/deploy-checklist.md`](formalization/deploy-checklist.md) — **fuente de verdad operativa** |
| **Conciliación pendiente** | [`CONCILIACION-PENDIENTE.md`](CONCILIACION-PENDIENTE.md) |
| **Diseño storefront** | [`design/storefront-v3-handoff.md`](design/storefront-v3-handoff.md) |
| **Próximos pilares** (sucursales, B2B, SaaS) | `v3-branch-architecture/{branch-architecture,b2b-contracts-model,business-line-model}.md` |

### Convención: actualizar docs al cerrar cada paso

- Al cerrar un paso del **deploy-checklist**, marcar las casillas en el doc.
- Cuando **§4.4 quede aplicado a prod**, mover `deploy-checklist.md` → `deploy-v3-completed-<fecha>.md` (ver §10 Mantenimiento del checklist).
- Cuando cierre una conciliación, actualizar el **bloque de estado** de este README y de `CONCILIACION-PENDIENTE.md`.
- Al evolucionar un diseño forward-looking a código, mover su doc de "roadmap" a registro de implementación y enlazarlo desde aquí.

---

## Docs HISTÓRICOS — no confundir con trabajo pendiente

> Estos describen algo **ya hecho** (deploy, ensayos, sprints cerrados). Léelos como registro, **no como TODO**. Si listan tareas "pendientes", la mayoría **ya se ejecutaron** entre el 28 y 30-may.

| Doc | Por qué es histórico |
|-----|----------------------|
| `v3-branch-architecture/v3-release-scope.md` | Dice "DEPLOY DIFERIDO"; v3 ya se deployó el 28-may |
| `v3-branch-architecture/reports-coverage.md` | Fases 1-5 + backfill §4.7 ya en prod |
| `formalization/ROADMAP.md` | Retrospectiva congelada al 24-may; aún dice prod v2.9.0 |
| `formalization/sprint-log.md` | M4/M5 marcados "diferidos" cuando ya se ejecutaron |
| `formalization/estabilizacion_financiera/financial-model-current-state.md` | Gap A / Bug 2 listados pendientes, ya cerrados en hardening Q2 |
| `formalization/estabilizacion_financiera/costs-importer-plan-revised.md` | Plan del importer; el import §4.3 ya corrió en prod |
| `formalization/prompts/v3-migration-on-prod-data-prompt.md` | Ensayo de migración en dev/spike, ya consumido |
| `formalization/prompts/costs-importer-prompt.md` | Construcción del importer, ya aplicado |
| `formalization/discovery/2026-05-02-sesion-01.md` | Discovery foundational que alimentó las 8 dimensiones |
| `audit/PROD-AUDIT-2026-05-16.md` | Auditoría pre-deploy; fixes ya pasados (re-verificar prod si hay duda) |

**Obsoletos / descartables:** `formalization/estabilizacion_contable/bank-*-2026-05-16.md` (superados por la versión 17-may) · `logs/*.log` y `logs/*.json` (outputs efímeros de MCP).
