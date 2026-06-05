# Formalización del Negocio — Uniformes Consuelo Ríos

> **Estado:** En descubrimiento
> **Iniciado:** 2026-05-02
> **Owner:** Angel Samuel Suesca Ríos
> **Naturaleza:** Documento vivo. Evoluciona en paralelo al roadmap técnico (v3.0 → v3.2).

---

## Por qué este documento existe

El sistema técnico (UCR v2.9.0 en producción, v3.x en desarrollo) ha evolucionado más rápido que la formalización legal, tributaria, contable y operativa del negocio. Esta carpeta cierra ese gap de manera **sistemática y trazable**, no como un trámite aislado sino como un eje continuo del negocio.

El objetivo: que la empresa pueda crecer (nuevas sucursales, comercializar el software, contratar empleados y proveer contratistas, atender auditorías DIAN) sin sorpresas legales, fiscales o operativas.

---

## Las 8 dimensiones

| # | Dimensión | Documento | Criticidad | % Formal |
|---|-----------|-----------|------------|----------|
| 1 | Legal y corporativo | [01-legal-corporativo.md](01-legal-corporativo.md) | TBD | TBD |
| 2 | Tributario | [02-tributario.md](02-tributario.md) | TBD | TBD |
| 3 | Contable | [03-contable.md](03-contable.md) | TBD | TBD |
| 4 | Laboral | [04-laboral.md](04-laboral.md) | TBD | TBD |
| 5 | Datos personales | [05-datos-personales.md](05-datos-personales.md) | 🔴 ALTA | 5% |
| 6 | Comercial | [06-comercial.md](06-comercial.md) | 🟠 ALTA | 10% |
| 7 | Operacional | [07-operacional.md](07-operacional.md) | 🟠 ALTA | 25% |
| 8 | Tecnológico | [08-tecnologico.md](08-tecnologico.md) | 🟠 ALTA (🔴 si v3.2) | 20% |

> Cada `% Formal` se calcula en función de los ítems críticos cerrados sobre el total identificado en cada dimensión.

---

## Cómo usar este documento

1. **Discovery:** Cada dimensión inicia con una sesión de preguntas (ver `discovery/`).
2. **Estado actual:** Documentar qué existe hoy (con evidencia: documentos, screenshots, contratos).
3. **Gaps:** Identificar qué falta vs. lo legalmente exigido o lo operativamente sano.
4. **Roadmap:** Priorizar por criticidad y dependencia. Conectar con releases técnicos.
5. **Ejecución:** Acciones con responsable, fecha y costo estimado.
6. **Auditoría:** Revisión trimestral del % de formalización.

---

## Conexión con el roadmap técnico

La formalización **no puede ser ortogonal** al desarrollo técnico, porque cada hito de negocio impone requisitos:

| Release técnico | Hito de negocio | Requisito de formalización |
|-----------------|-----------------|----------------------------|
| v3.0 (abr 2026) | Producción consolidada | Facturación electrónica DIAN al día, kardex NIIF |
| v3.1 (jun 2026) | Nuevas sucursales | RIT por sucursal, contratos arriendos, registros mercantiles |
| v3.2 (oct 2026) | Comercialización software | Contratos SaaS, propiedad intelectual, T&C, política privacidad |

Ver [ROADMAP.md](ROADMAP.md) para el plan integrado.

---

## Sesiones de Discovery

| Fecha | Sesión | Dimensiones cubiertas |
|-------|--------|------------------------|
| 2026-05-02 | [Sesión 01 — Inicio](discovery/2026-05-02-sesion-01.md) | Legal, Tributario, Laboral, Contable (foundational) |

---

## Pilar B2B (contratos / cotizaciones) — flujo real del negocio

La formalización tiene un **driver de negocio explícito** más allá del cumplimiento: habilitar la venta **B2B por contratos** (uniformes empresariales, dotación legal Art. 230 CST, equipos deportivos, eventos, institucional). Es el **tercer pilar de crecimiento de UCR** (junto a sucursales y SaaS) y el que genera el flujo de caja recurrente que rompe la estacionalidad escolar. Varias dimensiones de esta carpeta son prerequisitos de ese pilar:

- **Tributario (02):** FE DIAN operativa (bloqueante — el cliente B2B necesita factura para deducir) + probable cruce a responsable de IVA (la dotación corporativa grava, a diferencia del uniforme escolar excluido).
- **Comercial (06):** contrato marco B2B, política de crédito, cotización formal numerada (Gaps 6.6/6.7).
- **Legal (01):** SAS + RUP para el segmento institucional/licitaciones.

Modelo de negocio y diseño técnico completos en [`v3/v3-branch-architecture/b2b-contracts-model.md`](../v3-branch-architecture/b2b-contracts-model.md).

---

## Sub-carpetas de estabilización

| Carpeta | Propósito |
|---------|-----------|
| [equipo/](equipo/) | Roadmap de formalización del equipo (3 tracks: Owner, Cofundador tech, Joven) + bitácoras individuales + plan de equity para SAS |
| [estabilizacion_contable/](estabilizacion_contable/) | Reconciliación contable, plan de migración híbrida, análisis de patrimonio, conciliación bancaria multi-banco y política de activos intangibles |
| [estabilizacion_financiera/](estabilizacion_financiera/) | Modelo financiero, impacto monetario, proyecciones y estado actual del modelo financiero en la app |
| [estabilizacion_operacional/](estabilizacion_operacional/) | Inventario maestro de procedimientos faltantes (governance + operacional) cross-cutting de las 8 dimensiones |

---

## Documentos relacionados

- [Modelo de Negocio B2B](../v3-branch-architecture/b2b-contracts-model.md) — Tercer pilar de crecimiento: contratos/cotizaciones empresariales. Segmentos, modelo de datos, tratamiento contable de anticipos, integración con el Modelo Financiero como stream contracalendario.
- [equipo/equipo-roadmap-2026.md](equipo/equipo-roadmap-2026.md) — Roadmap de formalización del equipo: 3 fases de compensación, cap table indicativo SAS, modelo 40h operación + 8h estudio.
- [estabilizacion_contable/intangibles-management.md](estabilizacion_contable/intangibles-management.md) — Política de reconocimiento, medición, amortización y registro de inversiones en activos intangibles (plataforma UCR, marca, etc.). Bloqueante para constitución SAS.
- [estabilizacion_operacional/procedimientos-inventario-maestro.md](estabilizacion_operacional/procedimientos-inventario-maestro.md) — Catálogo único de procedimientos faltantes consolidados de 01-08.md, con prioridad, owner, ubicación target y estado.
- [estabilizacion_contable/migration-plan-hybrid.md](estabilizacion_contable/migration-plan-hybrid.md) — Reclasificación de gastos históricos (`mercado`/`ocio` → `payroll_in_kind`/`owner_drawings`).
- [estabilizacion_contable/patrimony-deep-analysis-2026.md](estabilizacion_contable/patrimony-deep-analysis-2026.md) — Forensic mes a mes contra prod_snapshot. Detecta $21M discrepancia balance vs entries, $19M refinanciado en pago a Cristina (confirmado por owner), anomalías de captura.
- [estabilizacion_contable/bank-reconciliation-2026-05-17.md](estabilizacion_contable/bank-reconciliation-2026-05-17.md) — Reconciliación multi-banco (Bancolombia + Nequi) 1010 transacciones; entradas aplicadas en dev.
- [estabilizacion_financiera/financial-impact.md](estabilizacion_financiera/financial-impact.md) — Cuantificación monetaria total, 3 escenarios, cash flow 12 meses, schema para `ProjectionService`.
- [estabilizacion_financiera/financial-model-current-state.md](estabilizacion_financiera/financial-model-current-state.md) — Qué está implementado vs diseñado, P&L ejecutado en dev, gaps de configuración y plan de fixes.
- [db-snapshot-workflow.md](db-snapshot-workflow.md) — Cómo trabajar contra data fresh de prod (`uniformes_prod_snapshot`) sin tocar dev.

## Prompts para sesiones dedicadas

- [Estabilización forense del sistema contable](prompts/stabilization-session-prompt.md) — Sesión completa para auditar, reconciliar y estabilizar la contabilidad de UCR. Incluye 8 objetivos, 5 bugs catalogados, criterios de "estabilizado".
- [UI completa del Modelo Financiero en Tauri](prompts/financial-model-ui-prompt.md) — Sesión para construir la UI del modelo financiero con permisos granulares. Restaura el FinancialModelTab huérfano + nueva tab de Proyecciones.
- [Aplicar v3 sobre data real de prod](prompts/v3-migration-on-prod-data-prompt.md) — Sesión Milestone 2: aplicar las 14 migraciones v3 contra data fresh de prod, debugear si fallan unify_step2/step3.

## Roadmap maestro

- [ROADMAP.md](ROADMAP.md) — Plan completo del sprint con 5 milestones (M1-M5), cronograma 2 semanas, comandos exactos, criterios de hecho, plan de rollback.
