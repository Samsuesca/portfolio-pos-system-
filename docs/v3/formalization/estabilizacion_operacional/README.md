# Estabilización Operacional — UCR

> **Última actualización:** 2026-05-24
> **Owner:** Angel Suesca

---

## Propósito

Esta carpeta consolida la **construcción sistemática de la documentación procedimental** que falta para que UCR pueda operar como empresa formal: SOPs de tienda, runbooks operativos, políticas de gobernanza, plantillas contractuales y manuales de gestión.

No es una carpeta de diagnóstico (esos viven en `01-08.md` de la raíz de `formalization/`). Es una carpeta de **ejecución y trazabilidad**: aquí se administra el catálogo de procedimientos faltantes, se prioriza su escritura, y se da seguimiento al estado de cada uno.

---

## Estructura

| Documento | Función |
|-----------|---------|
| [procedimientos-inventario-maestro.md](procedimientos-inventario-maestro.md) | Catálogo único de todos los procedimientos faltantes (consolidación cross-cutting de 01-08.md) con prioridad, owner, ubicación target y estado |

Cuando los procedimientos se vayan escribiendo, vivirán en las carpetas hermanas:

- `formalization/governance/` — políticas, contratos, plantillas, T&C, EULA, DPA, NDAs.
- `formalization/operaciones/` — SOPs de tienda, runbooks de deployment, backup, seguridad, SG-SST, inventario de activos digitales.

Ambas se crean a medida que se escribe el primer documento que las habita. La estructura está definida en [procedimientos-inventario-maestro.md §2](procedimientos-inventario-maestro.md).

---

## Cómo usar esta carpeta

1. **Antes de empezar cualquier tarea de formalización procedimental**, revisar el inventario maestro para no duplicar trabajo y para confirmar la ubicación target del nuevo documento.
2. **Al iniciar un procedimiento**, actualizar la fila correspondiente en el inventario a estado `📝 borrador`.
3. **Al completar v1**, mover a `👀 en revisión` con fecha de envío al asesor/revisor.
4. **Al aprobar**, marcar `✅ activo` con la fecha de vigencia.
5. **Cada 90 días** ejecutar revisión integral del inventario.

---

## Relación con otras carpetas

- [estabilizacion_contable/](../estabilizacion_contable/) — estabilización financiera contable (reconciliación bancaria, patrimonio, plan híbrido, intangibles).
- [estabilizacion_financiera/](../estabilizacion_financiera/) — modelo financiero, proyecciones, impacto monetario.
- [equipo/](../equipo/) — roadmap de formalización del equipo y bitácoras individuales.
- [01-08.md](../) — diagnóstico por dimensión; este `estabilizacion_operacional/` es la fase de **ejecución** de los gaps identificados allí.
