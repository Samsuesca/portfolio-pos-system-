# v3 Branch Architecture — Plan Estrategico

> **Estado:** En planificacion
> **Fecha inicio:** 2026-04-13
> **Ultima actualizacion:** 2026-05-22 (B2B elevado a tercer pilar)
> **Contexto:** Tres pilares de crecimiento — sucursales nuevas + **contratos B2B** + comercializacion del software

---

## Indice

| Documento | Descripcion | Estado |
|-----------|-------------|--------|
| [v3.0.0 Release Scope](./v3-release-scope.md) | Cambios pendientes v2.9.0 → v3.0.0 | Completo |
| [Branch Architecture](./branch-architecture.md) | Diseno de sucursales, modelo de datos, migracion | Completo |
| [**B2B Contracts Model**](./b2b-contracts-model.md) | **Modelo de negocio B2B (contratos/cotizaciones empresariales, equipos, eventos) — tercer pilar** | **Completo (scope)** |
| [Transition Plan](./transition-plan.md) | Plan de transicion por fases (Branch → B2B → Organization → SaaS) | Completo |
| [Financial Model](./financial-model-design.md) | Modelo financiero UCR (inspirado en OndaFin) | Completo |
| [Financial Model Prompt](./financial-model-prompt.md) | Prompt para sesion de implementacion del modelo financiero | Completo |
| [**Reports Coverage**](./reports-coverage.md) | **Modulo de Reportes: 3 streams unificados (Sales/Orders/Alterations), RevenueStreamService, hooks B2B + v3.1 branches** | **Implementado Fases 1-5 (2026-05-24)** |

---

## Vision General — Tres Pilares de Crecimiento

UCR crece en **tres pilares simultaneos**, todos posteriores a estabilizar v3.0.0 en produccion. Cada uno tiene un timing y un perfil de flujo distinto, y los tres alimentan el Modelo Financiero:

### Pilar 1: Sucursales (~2 meses — target Junio 2026)
Nueva sucursal fisica con colegios propios, inventario separado, contabilidad por sucursal, y administradores por ubicacion. La central agrega toda la informacion. Expande el **piso** del negocio (retail escolar).

### Pilar 2: Contratos B2B (post-estabilizacion v3.0.0 — flujo real mes a mes)
Venta por **contratos y cotizaciones** a otros negocios: uniformes empresariales, dotacion legal (Art. 230 CST), equipos deportivos, ropa para eventos, e institucional/licitaciones. **Rompe la estacionalidad escolar** y genera el flujo de caja recurrente y de alto ticket que sostiene el negocio entre temporadas. Ver [b2b-contracts-model.md](./b2b-contracts-model.md).

> **Por que es el flujo real:** el negocio escolar concentra ingresos en 4 meses (ene-feb, jul-ago) y opera en valle el resto del ano, mientras los costos fijos corren los 12. El B2B es **contracalendario** (los contratos no siguen el calendario escolar), carga el taller en los valles y produce recurrencia contractual — la fuente de predictibilidad del flujo. Arranca con el contrato del restaurante (~$9M en curso).

### Pilar 3: Comercializacion del software (vendible Oct 2026, target temporada 2027)
- **Modelo A**: Venta self-hosted + consultoria (instancia propia por cliente)
- **Modelo B**: SaaS bajo UCR (multi-tenant, mismo software, subscripcion/volumen)

Apuesta de **escala** de mayor plazo y riesgo.

### Prerequisito comun: v3.0.0
Estabilizar los cambios actuales (unificacion de tablas globales, normalizacion de vendors, catalogo de posiciones) antes de iniciar cualquiera de los tres pilares.

---

[← Volver al indice](../README.md)
