# Inventario Maestro de Procedimientos Faltantes — UCR

> **Última actualización:** 2026-05-24
> **Owner:** Angel Suesca
> **Propósito:** consolidar en un único catálogo todos los procedimientos, políticas, plantillas y runbooks que están documentados como faltantes en las 8 dimensiones de formalización ([01-legal-corporativo.md](../01-legal-corporativo.md) → [08-tecnologico.md](../08-tecnologico.md)) y dar trazabilidad a su construcción.
> **Estado:** v1 — catálogo inicial, pendiente priorización + asignación de owners.

---

## 1. Por qué este inventario existe

Las 8 dimensiones de formalización ya identifican gaps individuales con detalle, pero los **procedimientos** (documentos vivos que codifican cómo se hacen las cosas) están dispersos como una sub-tarea dentro de cada gap. Cuando llegue el momento de operar la SAS, abrir la segunda sucursal, o vender el software como SaaS, la pregunta del cliente/auditor/empleado nuevo va a ser **"¿dónde está documentado?"** — y la respuesta tiene que ser un link, no una conversación con Angel o Consuelo.

Hoy ese link no existe para casi nada. Este inventario:

1. **Consolida** todos los procedimientos faltantes en un único catálogo navegable.
2. **Clasifica** por tipo (gobernanza / operacional / SOP de tienda / política / runbook / plantilla / contrato).
3. **Prioriza** según urgencia (cruzando criticidad del gap padre + dependencias bloqueantes).
4. **Asigna ubicación target** dónde vivirá el documento cuando se escriba (en este repo, formalización vs. operaciones).
5. **Identifica owners y prerequisitos** (contador, abogado, asesor laboral, etc.) — sin los cuales la mayoría no se puede escribir solo desde dentro.
6. **Trackea estado** (no iniciado / borrador / revisión / activo / desactualizado).

Es la herramienta de gestión para no perder el hilo en la maratón de formalización. La meta no es escribir todos los procedimientos esta semana — es saber **qué falta, en qué orden, y quién lo bloquea**, para ejecutarlo trimestre a trimestre.

---

## 2. Estructura de carpetas propuesta

Toda la documentación procedimental que se genere a partir de este inventario debe vivir bajo `docs/v3/formalization/` (que ya es el centro de mando de la formalización) con la siguiente subdivisión:

```
docs/v3/formalization/
├── 01-legal-corporativo.md         (ya existe — diagnóstico)
├── 02-tributario.md                (ya existe)
├── ... 03..08
│
├── governance/                     (NUEVA — políticas y contratos)
│   ├── README.md
│   ├── politica-tratamiento-datos.md
│   ├── aviso-privacidad.md
│   ├── politica-retencion-datos.md
│   ├── procedimiento-derechos-titular.md
│   ├── politica-contable.md
│   ├── politica-control-acceso-repo.md
│   ├── politica-secretos-rotacion.md
│   ├── politica-actualizacion-dependencias.md
│   ├── politica-uso-marcas-escolares.md
│   ├── contratos/
│   │   ├── plantilla-contrato-laboral-termino-fijo.md
│   │   ├── plantilla-contrato-laboral-indefinido.md
│   │   ├── plantilla-contrato-modistas-prestacion-servicios.md
│   │   ├── plantilla-nda-empleados.md
│   │   ├── plantilla-nda-contractors.md
│   │   ├── plantilla-no-competencia.md
│   │   ├── plantilla-cesion-derechos-patrimoniales-software.md
│   │   ├── plantilla-contrato-marco-b2b.md
│   │   ├── plantilla-cotizacion-b2b.md
│   │   ├── plantilla-eula-saas.md
│   │   ├── plantilla-dpa-cliente-saas.md
│   │   └── plantilla-dpa-encargado-tratamiento.md
│   └── terminos/
│       ├── tyc-b2c-online.md
│       ├── politica-devoluciones-cambios.md
│       ├── politica-garantias.md
│       ├── politica-envios-plazos-entrega.md
│       └── aviso-retracto.md
│
├── operaciones/                    (NUEVA — SOPs y runbooks)
│   ├── README.md
│   ├── tienda/
│   │   ├── sop-venta-mostrador.md
│   │   ├── sop-devolucion-cambio.md
│   │   ├── sop-cierre-caja-diario.md
│   │   ├── sop-arqueo-caja.md
│   │   ├── sop-cierre-semanal.md
│   │   ├── sop-conteo-inventario-fisico.md
│   │   ├── sop-recepcion-mercancia-proveedor.md
│   │   ├── sop-atencion-quejas-pqrs.md
│   │   ├── manual-atencion-cliente.md
│   │   ├── directorio-proveedores.md
│   │   └── calendario-operativo-anual.md
│   ├── deployment/
│   │   ├── runbook-deploy-produccion.md
│   │   ├── runbook-rollback.md
│   │   ├── checklist-pre-deploy.md
│   │   └── runbook-actualizacion-dependencias.md
│   ├── backup/
│   │   ├── runbook-backup-automatizado.md
│   │   ├── runbook-restore-disaster.md
│   │   ├── plan-disaster-recovery.md
│   │   └── runbook-rotacion-claves-gpg.md
│   ├── seguridad/
│   │   ├── runbook-incidente-seguridad.md
│   │   ├── runbook-incidente-privacidad.md
│   │   ├── politica-control-acceso-fisico.md
│   │   ├── politica-retencion-audit-log.md
│   │   └── inventario-secretos.md
│   ├── sg-sst/
│   │   ├── politica-sg-sst.md
│   │   ├── matriz-peligros-riesgos.md
│   │   ├── plan-emergencias.md
│   │   └── procedimiento-accidente-laboral.md
│   └── digital-assets/
│       └── inventario-activos-digitales.md
│
├── estabilizacion_contable/        (ya existe)
├── estabilizacion_financiera/      (ya existe)
├── estabilizacion_operacional/     (ESTA carpeta — inventario + control)
│   └── procedimientos-inventario-maestro.md  (este archivo)
└── equipo/                         (ya existe)
```

> **Criterio de partición governance vs operaciones:** `governance/` contiene **políticas, contratos, plantillas y documentos legales** que regulan la relación de UCR con personas (empleados, clientes, terceros). `operaciones/` contiene **runbooks ejecutables y manuales de trabajo** — el "cómo se hace" día a día. La frontera no siempre es nítida (SG-SST tiene componentes de ambos); en caso de duda, se prioriza dónde lo va a buscar el lector que lo necesita.

---

## 3. Convenciones de los procedimientos

Todo procedimiento escrito a partir de este inventario debe seguir las siguientes convenciones para que el conjunto sea navegable, mantenible y defendible ante un auditor externo:

### Frontmatter mínimo

```markdown
# Título del Procedimiento

> **Versión:** vX.Y
> **Última actualización:** YYYY-MM-DD
> **Owner:** [persona responsable]
> **Vigencia:** activo / borrador / desactualizado / archivado
> **Aplica a:** [roles / áreas / módulos]
> **Marco normativo:** [leyes, decretos, NIIF aplicables]
> **Documentos relacionados:** [links a otros procedimientos / dimensiones]
> **Frecuencia de revisión:** [mensual / trimestral / anual / por evento]
```

### Estructura sugerida

1. **Propósito** — qué problema resuelve.
2. **Alcance** — qué cubre y qué NO cubre.
3. **Roles y responsabilidades** — quién hace qué.
4. **Procedimiento detallado** — pasos numerados, idealmente con screenshots o ejemplos.
5. **Excepciones y casos especiales.**
6. **Indicadores / evidencia de cumplimiento.**
7. **Historial de cambios** — versión, fecha, autor, motivo.

### Reglas de mantenimiento

- **Quien escribe** es típicamente el owner del proceso. Quien **revisa** debe ser un par o superior con visión transversal.
- **Versión activa siempre en `main`.** Borradores en branches o en `formalization/borradores/` si es necesario antes de validar con asesor externo.
- **Cambios sustantivos** requieren bump de versión mayor + revisión por owner del dominio y, cuando aplique, por contador/abogado/asesor.
- **Cambios menores** (typos, rephrasing) bump menor sin revisión externa.
- **Procedimiento que no se revisa en 12 meses** se marca como `desactualizado` automáticamente hasta que se valide o archive.
- **Privacidad:** documentos con plantillas de contratos pueden ser internos. Políticas públicas (T&C, Aviso de Privacidad) deben publicarse en sitios públicos cuando aplique.

### Convención de naming

- `kebab-case-descriptivo.md`
- Categoría como prefijo solo si añade claridad: `sop-`, `runbook-`, `plantilla-`, `politica-`, `aviso-`, `manual-`.
- Versionado en frontmatter, no en filename — la última versión vive siempre en el mismo archivo, el histórico va en git.

---

## 4. Catálogo maestro

### Leyenda de columnas

- **Prioridad:** 🔴 bloqueante / urgente · 🟠 importante / habilitador estratégico · 🟡 higiene / mejora continua.
- **Categoría:** governance (política, contrato, plantilla) · operacional (SOP, runbook, manual).
- **Estado:** ❌ no iniciado · 📝 borrador · 👀 en revisión · ✅ activo · ♻️ desactualizado.
- **Bloqueado por:** prerrequisitos externos (asesor laboral, abogado SAS, contador, etc.) — si no se resuelve, el documento no avanza.

### Dimensión 1 — Legal Corporativo

| Ref | Procedimiento | Categoría | Prioridad | Ubicación target | Owner | Bloqueado por | Estado |
|-----|----------------|------------|------------|--------------------|-------|----------------|---------|
| [Gap 1.1](../01-legal-corporativo.md) | Plan de transición a SAS — acta de constitución, estatutos, cláusulas ESOP | governance | 🔴 | `governance/plan-transicion-sas.md` | Angel + abogado SAS | Abogado SAS identificado · avalúos AV1/AV2 (ver [intangibles-management.md](../estabilizacion_contable/intangibles-management.md)) | ❌ |
| [Gap 1.2](../01-legal-corporativo.md) | Procedimiento de actualización RUT (CIIU secundarios, establecimientos) | operacional | 🟡 | `operaciones/runbook-actualizacion-rut.md` | Angel + contador | Contador identificado | ❌ |
| [Gap 1.3](../01-legal-corporativo.md) | Plan formal segundo local — checklist legal, tributario, operacional | governance | 🟠 | `governance/plan-segundo-local.md` | Consuelo + Angel | Decisión de ubicación + timing v3.1 | ❌ |
| [Gap 1.4](../01-legal-corporativo.md) | Procedimiento de inscripción de establecimientos en RUT | operacional | 🟡 | `operaciones/runbook-inscripcion-establecimientos.md` | Angel + contador | Resolución Gap 1.3 | ❌ |

### Dimensión 2 — Tributario

| Ref | Procedimiento | Categoría | Prioridad | Ubicación target | Owner | Bloqueado por | Estado |
|-----|----------------|------------|------------|--------------------|-------|----------------|---------|
| [Gap 2.0/2.1](../02-tributario.md) | Procedimiento de emisión de factura electrónica DIAN | operacional | 🔴 | `operaciones/runbook-emision-fe-dian.md` | Angel + contador | FE DIAN activa vía Alegra (ya resuelto) — integrar en UCR backend | 📝 |
| [Gap 2.2](../02-tributario.md) | Calendario y procedimiento de declaraciones DIAN (renta, IVA si aplica, retenciones) | operacional | 🔴 | `operaciones/runbook-declaraciones-dian.md` | Contador + Angel | Contador identificado | ❌ |
| [Gap 2.4](../02-tributario.md) | Procedimiento de conciliación de retención en la fuente Wompi | operacional | 🟠 | `operaciones/runbook-conciliacion-retencion-wompi.md` | Contador + Angel | Contador identificado | ❌ |
| [Gap 2.5](../02-tributario.md) | Procedimiento ICA y RIT Bello | operacional | 🟡 | `operaciones/runbook-ica-rit-bello.md` | Contador + Angel | Contador identificado · consulta Alcaldía Bello | ❌ |

### Dimensión 3 — Contable

| Ref | Procedimiento | Categoría | Prioridad | Ubicación target | Owner | Bloqueado por | Estado |
|-----|----------------|------------|------------|--------------------|-------|----------------|---------|
| [Gap 3.3](../03-contable.md) | **Política contable general NIIF para PYMES** | governance | 🔴 | `governance/politica-contable.md` | Contador + Angel | Contador identificado | ❌ |
| [Gap 3.3 / intangibles](../estabilizacion_contable/intangibles-management.md) | Política de activos intangibles (sub-sección de política contable) | governance | 🔴 | `estabilizacion_contable/intangibles-management.md` | Contador + Angel | Contador identificado | ✅ (v1 escrita 2026-05-24) |
| [Gap 3.0](../03-contable.md) | Procedimiento de separación finanzas personales vs negocio | operacional | 🔴 | `operaciones/sop-separacion-finanzas-negocio.md` | Consuelo + Angel | Cuenta bancaria del negocio abierta (ya en progreso) | 📝 |
| [Gap 3.4](../03-contable.md) | Procedimiento de kardex valuado (PEPS o promedio ponderado) | operacional | 🟠 | `operaciones/runbook-kardex-niif.md` | Contador + Angel | Decisión método PEPS vs promedio | ❌ |
| [Gap 3.5](../03-contable.md) | Procedimiento de conciliación bancaria automatizada | operacional | 🟠 | `operaciones/runbook-conciliacion-bancaria.md` | Angel + contador | Bank reconciliation system v1 (parcialmente resuelto) — formalizar como SOP | 📝 |
| [Gap 3.6](../03-contable.md) | Procedimiento de generación de estados financieros NIIF (BG, ER, ECP, EFE, Notas) | operacional | 🟠 | `operaciones/runbook-generacion-eeff-niif.md` | Contador + Angel | Política contable aprobada · decisión Alegra/Siigo/UCR | ❌ |
| Implícito Gap 3.2 | Procedimiento de cierre contable mensual | operacional | 🔴 | `operaciones/runbook-cierre-mensual.md` | Contador + Angel | Contador identificado | ❌ |

### Dimensión 4 — Laboral

| Ref | Procedimiento | Categoría | Prioridad | Ubicación target | Owner | Bloqueado por | Estado |
|-----|----------------|------------|------------|--------------------|-------|----------------|---------|
| [Gap 4.1](../04-laboral.md) | Plan de regularización de aportes UGPP (voluntario) | governance | 🔴 | `governance/plan-regularizacion-ugpp.md` | Angel + asesor laboral | Asesor laboral identificado | ❌ |
| [Gap 4.1](../04-laboral.md) | Procedimiento de afiliación EPS/AFP/ARL para Jóvenes | operacional | 🔴 | `operaciones/sop-afiliacion-ss-jovenes.md` | Angel | Decisión Fase 1 [equipo-roadmap-2026.md](../equipo/equipo-roadmap-2026.md) | 📝 |
| [Gap 4.2](../04-laboral.md) | Plantilla contrato laboral término fijo + indefinido | governance / contrato | 🔴 | `governance/contratos/plantilla-contrato-laboral-*.md` | Asesor laboral | Asesor laboral identificado | ❌ |
| [Gap 4.2](../04-laboral.md) | Carta de intención Fase 1 (compensación informal documentada) | governance / contrato | 🔴 | `governance/contratos/plantilla-carta-intencion-fase1.md` | Angel + asesor laboral | Asesor laboral identificado | ❌ |
| [Gap 4.3](../04-laboral.md) | Procedimiento de nómina electrónica DIAN | operacional | 🔴 | `operaciones/runbook-nomina-electronica.md` | Contador + Angel | Proveedor de nómina seleccionado (Alegra Nómina / Siigo / Nominapp) | ❌ |
| [Gap 4.4](../04-laboral.md) | Política y matriz SG-SST para PYME | governance | 🟠 | `operaciones/sg-sst/politica-sg-sst.md` + matriz | Asesor SG-SST + Consuelo | Asesor SG-SST identificado | ❌ |
| [Gap 4.5](../04-laboral.md) | Plantilla contrato de prestación de servicios (modistas) | governance / contrato | 🟡 | `governance/contratos/plantilla-contrato-modistas-prestacion-servicios.md` | Asesor laboral | Asesor laboral identificado | ❌ |
| [Gap 4.6](../04-laboral.md) | Plan de personal segunda sucursal | governance | 🟡 | `governance/plan-personal-segundo-local.md` | Angel + Consuelo | Resolución Gap 1.3 | ❌ |

### Dimensión 5 — Datos Personales

| Ref | Procedimiento | Categoría | Prioridad | Ubicación target | Owner | Bloqueado por | Estado |
|-----|----------------|------------|------------|--------------------|-------|----------------|---------|
| [Gap 5.1](../05-datos-personales.md) | Procedimiento de consentimiento del tutor para datos de menores | governance | 🔴 | `governance/procedimiento-consentimiento-menores.md` | Angel + asesor habeas data | Asesor habeas data identificado | ❌ |
| [Gap 5.2](../05-datos-personales.md) | **Política de Tratamiento de Datos Personales** | governance | 🔴 | `governance/politica-tratamiento-datos.md` | Angel + asesor habeas data | Asesor habeas data identificado · publicar en web-portal | ❌ |
| [Gap 5.3](../05-datos-personales.md) | **Aviso de Privacidad** (mostrar en captura) | governance | 🔴 | `governance/aviso-privacidad.md` | Angel + asesor habeas data | Asesor habeas data identificado · integrar en frontend (Tauri, web-portal, admin-portal, mobile) | ❌ |
| [Gap 5.4](../05-datos-personales.md) | Procedimiento de inscripción RNBD | operacional | 🟠 | `operaciones/runbook-rnbd.md` | Angel | Política y Aviso aprobados | ❌ |
| [Gap 5.5](../05-datos-personales.md) | Plantilla DPA con encargados (Wompi, Alegra, Resend, Vultr, Telegram) | governance / contrato | 🟠 | `governance/contratos/plantilla-dpa-encargado-tratamiento.md` | Asesor habeas data | Asesor habeas data identificado | ❌ |
| [Gap 5.7](../05-datos-personales.md) | Procedimiento de derechos del titular (consulta, rectificación, supresión) | operacional | 🟡 | `governance/procedimiento-derechos-titular.md` | Angel + asesor | Asesor habeas data identificado · canal de contacto habilitado | ❌ |
| [Gap 5.8](../05-datos-personales.md) | Política de retención y eliminación de datos | governance | 🟡 | `governance/politica-retencion-datos.md` | Angel + asesor | Política tratamiento aprobada · diseño job anonimización menores | ❌ |
| Cruz [05 notas](../05-datos-personales.md) | Procedimiento de respuesta a incidentes de privacidad | operacional | 🟡 | `operaciones/seguridad/runbook-incidente-privacidad.md` | Angel + asesor | Política tratamiento aprobada | ❌ |

### Dimensión 6 — Comercial

| Ref | Procedimiento | Categoría | Prioridad | Ubicación target | Owner | Bloqueado por | Estado |
|-----|----------------|------------|------------|--------------------|-------|----------------|---------|
| [Gap 6.1](../06-comercial.md) | **Términos y Condiciones B2C online** (web-portal) | governance | 🔴 | `governance/terminos/tyc-b2c-online.md` | Angel + abogado comercial | Abogado identificado · publicar en web-portal | ❌ |
| [Gap 6.2](../06-comercial.md) | **Política de devoluciones, cambios y garantías** (Ley 1480) | governance | 🔴 | `governance/terminos/politica-devoluciones-cambios.md` + `politica-garantias.md` | Angel + abogado | Abogado identificado · alineación con SOP de devolución tienda | ❌ |
| [Gap 6.3](../06-comercial.md) | Aviso y procedimiento de retracto (Decreto 587/2016) | governance | 🔴 | `governance/terminos/aviso-retracto.md` | Angel + abogado | Abogado · integrar en checkout web-portal | ❌ |
| [Gap 6.4](../06-comercial.md) | Política de plazos de entrega definidos | governance | 🟠 | `governance/terminos/politica-envios-plazos-entrega.md` | Angel + Consuelo | Análisis de tiempos reales de despacho | ❌ |
| [Gap 6.5](../06-comercial.md) | Procedimiento de registro de marca en SIC | operacional | 🟡 | `operaciones/runbook-registro-marca.md` | Agente PI + Angel | Decisión marca a registrar (UCR vs Consuelo Ríos) · agente identificado | ❌ |
| [Gap 6.6](../06-comercial.md) | **Plantilla contrato marco B2B** (colegios, empresas, restaurantes) | governance / contrato | 🟠 | `governance/contratos/plantilla-contrato-marco-b2b.md` | Abogado comercial + Angel | Abogado identificado | ❌ |
| [Gap 6.7](../06-comercial.md) | Plantilla cotización B2B + condiciones generales | governance / plantilla | 🔴 | `governance/contratos/plantilla-cotizacion-b2b.md` | Angel + Consuelo + abogado | Caso restaurante cierra sin contrato si no se prioriza | ❌ |
| [Gap 6.8](../06-comercial.md) | **EULA / Términos de uso SaaS** | governance | 🟠 | `governance/contratos/plantilla-eula-saas.md` | Abogado de tecnología + Angel | Decisión licencia [08-tecnologico.md Gap 8.1](../08-tecnologico.md) · arquitectura SaaS lista | ❌ |
| [Gap 6.8](../06-comercial.md) | DPA cliente SaaS (cuando UCR es encargado) | governance / contrato | 🟠 | `governance/contratos/plantilla-dpa-cliente-saas.md` | Abogado de tecnología + Angel | EULA SaaS · arquitectura multi-tenant `business_id` lista | ❌ |
| [Gap 6.9](../06-comercial.md) | Sistema y procedimiento PQRS | operacional | 🟡 | `operaciones/tienda/sop-atencion-quejas-pqrs.md` | Consuelo + Angel | Canal habilitado (formulario web-portal + email) | ❌ |
| [Gap 6.10](../06-comercial.md) | Política de uso de marcas escolares | governance | 🟡 | `governance/politica-uso-marcas-escolares.md` | Abogado de PI + Angel | Inventario de marcas escolares en uso · revisión de cada licencia o autorización | ❌ |

### Dimensión 7 — Operacional

| Ref | Procedimiento | Categoría | Prioridad | Ubicación target | Owner | Bloqueado por | Estado |
|-----|----------------|------------|------------|--------------------|-------|----------------|---------|
| [Gap 7.1](../07-operacional.md) | **Runbook de backup automatizado cifrado offsite** | operacional | 🔴 | `operaciones/backup/runbook-backup-automatizado.md` | Angel | Bucket offsite habilitado (S3/B2/R2) · clave GPG generada · cron en VPS | ❌ |
| [Gap 7.1](../07-operacional.md) | Runbook de restore (validar backup periódicamente) | operacional | 🔴 | `operaciones/backup/runbook-restore-disaster.md` | Angel | Runbook de backup activo | ❌ |
| [Gap 7.2](../07-operacional.md) | **Plan de Disaster Recovery** (RTO/RPO definidos) | governance / operacional | 🟠 | `operaciones/backup/plan-disaster-recovery.md` | Angel | Backup automatizado activo · análisis de RTO/RPO con Consuelo | ❌ |
| [Gap 7.3](../07-operacional.md) | Mitigación bus factor — runbooks + delegación de accesos | operacional | 🟠 | `operaciones/seguridad/inventario-secretos.md` + runbooks por servicio | Angel + Consuelo | Gestor de secretos elegido (1Password / Bitwarden) | ❌ |
| [Gap 7.4](../07-operacional.md) | **Manual de operación de tienda** (sub-conjunto de SOPs) | operacional | 🟠 | `operaciones/tienda/sop-*` + `manual-atencion-cliente.md` | Consuelo + Angel | Plan transferencia conocimiento Consuelo ([consuelo.md](../equipo/bitacoras/consuelo.md)) ya tiene secuencia mes 1–6 | 📝 |
| [Gap 7.4](../07-operacional.md) | SOP venta mostrador | operacional | 🟠 | `operaciones/tienda/sop-venta-mostrador.md` | Consuelo + Felipe | Plan transferencia Consuelo mes 2 | ❌ |
| [Gap 7.4](../07-operacional.md) | SOP devolución y cambio | operacional | 🟠 | `operaciones/tienda/sop-devolucion-cambio.md` | Consuelo + Felipe | Política de devoluciones aprobada (Gap 6.2) | ❌ |
| [Gap 7.4](../07-operacional.md) | SOP cierre de caja diario + arqueo | operacional | 🟠 | `operaciones/tienda/sop-cierre-caja-diario.md` + `sop-arqueo-caja.md` | Consuelo + Santiago | Plan transferencia Consuelo mes 3 | ❌ |
| [Gap 7.4](../07-operacional.md) | SOP cierre semanal | operacional | 🟠 | `operaciones/tienda/sop-cierre-semanal.md` | Consuelo + Santiago | SOP cierre diario activo | ❌ |
| [Gap 7.4](../07-operacional.md) | SOP conteo inventario físico | operacional | 🟠 | `operaciones/tienda/sop-conteo-inventario-fisico.md` | Consuelo + Felipe | — | ❌ |
| [Gap 7.4](../07-operacional.md) | SOP recepción de mercancía de proveedor | operacional | 🟠 | `operaciones/tienda/sop-recepcion-mercancia-proveedor.md` | Consuelo + Felipe | Directorio de proveedores | ❌ |
| [Gap 7.4](../07-operacional.md) | Directorio de proveedores estructurado | operacional | 🟡 | `operaciones/tienda/directorio-proveedores.md` | Consuelo | Plan transferencia Consuelo mes 4 | ❌ |
| [Gap 7.4](../07-operacional.md) | Manual de atención al cliente (tono, casos típicos, política) | operacional | 🟡 | `operaciones/tienda/manual-atencion-cliente.md` | Consuelo + Salomé | Plan transferencia Consuelo mes 5 | ❌ |
| [Gap 7.4](../07-operacional.md) | Calendario operativo anual | operacional | 🟡 | `operaciones/tienda/calendario-operativo-anual.md` | Consuelo | Plan transferencia Consuelo mes 6 | ❌ |
| [Gap 7.5](../07-operacional.md) | Política de control de acceso físico (llaves, alarma, cámaras) | governance | 🟡 | `operaciones/seguridad/politica-control-acceso-fisico.md` | Consuelo + Felipe | Inventario actual de accesos | ❌ |
| [Gap 7.6](../07-operacional.md) | Política de gestión y rotación de secretos | governance / operacional | 🟡 | `governance/politica-secretos-rotacion.md` + `operaciones/seguridad/inventario-secretos.md` | Angel | Gestor de secretos elegido | ❌ |
| [Gap 7.7](../07-operacional.md) | Política de retención de audit log + manejo de PII en logs | governance | 🟡 | `governance/politica-retencion-audit-log.md` | Angel + asesor habeas data | Asesor habeas data · alineación con [Gap 5.6, 5.8](../05-datos-personales.md) | ❌ |
| [Gap 7.8](../07-operacional.md) | Procedimientos SG-SST para PYME (matriz de riesgos, plan emergencias, accidente laboral) | governance / operacional | 🟠 | `operaciones/sg-sst/*` | Asesor SG-SST + Consuelo | Asesor SG-SST identificado | ❌ |
| [Gap 7.9](../07-operacional.md) | Runbook de deploy a producción + checklist pre-deploy | operacional | 🟡 | `operaciones/deployment/runbook-deploy-produccion.md` + `checklist-pre-deploy.md` | Angel | CI/CD básico montado (GitHub Actions) | ❌ |
| [Gap 7.9](../07-operacional.md) | Runbook de rollback | operacional | 🟡 | `operaciones/deployment/runbook-rollback.md` | Angel | Runbook de deploy activo | ❌ |
| [Gap 7.10](../07-operacional.md) | Política de actualización de dependencias (incluye revisión supply chain) | governance | 🟡 | `governance/politica-actualizacion-dependencias.md` | Angel | — | ❌ |

### Dimensión 8 — Tecnológico

| Ref | Procedimiento | Categoría | Prioridad | Ubicación target | Owner | Bloqueado por | Estado |
|-----|----------------|------------|------------|--------------------|-------|----------------|---------|
| [Gap 8.1](../08-tecnologico.md) | Decisión y procedimiento de cambio de licencia del repositorio (MIT → propietaria/BSL/open-core) | governance | 🔴 | `governance/politica-licencia-software.md` + nuevo `LICENSE` | Angel + abogado de PI | Abogado de PI identificado · decisión de modelo | ❌ |
| [Gap 8.2](../08-tecnologico.md) | **Plantilla y acuerdo de cesión de derechos patrimoniales** Angel → UCR/SAS | governance / contrato | 🔴 | `governance/contratos/plantilla-cesion-derechos-patrimoniales-software.md` | Abogado de PI + Angel | Abogado de PI identificado · avalúo I1 ([intangibles-management.md](../estabilizacion_contable/intangibles-management.md)) | ❌ |
| [Gap 8.3](../08-tecnologico.md) | Plan de refactorización arquitectónica multi-tenant `business_id` | governance / técnico | 🔴 | `governance/plan-refactor-saas-multitenant.md` (cruzado con `docs/architecture/`) | Angel | Decisión v3.2 confirmada · diseño técnico aprobado | 📝 |
| [Gap 8.4](../08-tecnologico.md) | Inventario de activos digitales (dominios, hostings, servicios SaaS, redes) | operacional | 🟠 | `operaciones/digital-assets/inventario-activos-digitales.md` | Angel | — | ❌ |
| [Gap 8.5](../08-tecnologico.md) | Procedimiento de registro DNDA del software | operacional | 🟡 | `operaciones/runbook-registro-dnda.md` | Angel + asesor PI | Cesión Gap 8.2 firmada · avalúo I1 | ❌ |
| [Gap 8.6](../08-tecnologico.md) | Plantilla NDA + No competencia (empleados, contractors) | governance / contrato | 🟠 | `governance/contratos/plantilla-nda-*.md` + `plantilla-no-competencia.md` | Asesor laboral + abogado de PI | Asesores identificados | ❌ |
| [Gap 8.7](../08-tecnologico.md) | Política de control de acceso al repositorio (branch protection, 2FA, code review) | governance | 🟡 | `governance/politica-control-acceso-repo.md` | Angel | — | ❌ |
| [Gap 8.8](../08-tecnologico.md) | Estrategia de protección de trade secrets + inventario | governance | 🟡 | `governance/estrategia-trade-secrets.md` | Angel + abogado de PI | Inventario formal de secretos (cruzado con I8 [intangibles-management.md](../estabilizacion_contable/intangibles-management.md)) | ❌ |
| [Gap 8.9](../08-tecnologico.md) | Auditoría y política de compatibilidad de licencias de dependencias | governance / operacional | 🟡 | `governance/politica-actualizacion-dependencias.md` + auditoría inicial | Angel | Decisión de licencia Gap 8.1 (define qué licencias entrantes son compatibles) | ❌ |

---

## 5. Priorización ejecutable

### Sprint inmediato (próximos 30 días)

Los siguientes documentos son los que más riesgo desbloquean (jurídico, operacional, contable) y/o son prerrequisito de la SAS. **Si no se inicia ninguno otro, estos sí**.

| Orden | Documento | Justificación |
|-------|------------|----------------|
| 1 | Runbook de backup automatizado cifrado offsite ([Gap 7.1](../07-operacional.md)) | Riesgo de pérdida total de datos hoy; **el más urgente operacionalmente**. |
| 2 | Política contable general NIIF ([Gap 3.3](../03-contable.md)) | Sin política, los cierres mensuales no son defendibles. Habilita reconocimiento de intangibles (parte ya escrita). |
| 3 | Plantilla carta de intención Fase 1 ([Gap 4.2](../04-laboral.md), [equipo-roadmap-2026.md EQ2](../equipo/equipo-roadmap-2026.md)) | Mitiga riesgo "contrato realidad" día a día. Bloquea EQ2 del roadmap de equipo. |
| 4 | Plantilla cotización B2B + condiciones ([Gap 6.7](../06-comercial.md)) | Caso restaurante $9M corre el riesgo de cerrarse sin marco si no existe la plantilla. |
| 5 | Inventario de activos digitales ([Gap 8.4](../08-tecnologico.md)) | Sin esto, el bus factor de Angel sigue siendo absoluto; si pasa algo, la operación se pierde. |

### Sprint trimestral (30–90 días)

| Orden | Documento | Justificación |
|-------|------------|----------------|
| 6 | Plantilla cesión derechos patrimoniales Angel → SAS ([Gap 8.2](../08-tecnologico.md)) | Habilita reconocimiento de I1 en balance SAS y constitución legal. Depende de abogado PI. |
| 7 | Política de Tratamiento de Datos Personales + Aviso de Privacidad ([Gap 5.2, 5.3](../05-datos-personales.md)) | Cumplimiento Ley 1581 — riesgo de sanción SIC creciente. Bloquea v3.2 (clientes SaaS preguntan). |
| 8 | Plantillas contratos laborales (término fijo + indefinido) ([Gap 4.2](../04-laboral.md)) | Habilita Fase 2 post-SAS de [equipo-roadmap-2026.md](../equipo/equipo-roadmap-2026.md). |
| 9 | T&C B2C online + Política devoluciones + Aviso de retracto ([Gap 6.1, 6.2, 6.3](../06-comercial.md)) | Riesgo Estatuto Consumidor con web-portal en producción. |
| 10 | SOPs tienda priorizados (venta, devolución, cierre caja) — secuencia Consuelo mes 2–3 | Habilita formación de Felipe y mitiga bus factor operativo. |

### Sprint semestral (3–6 meses)

| Orden | Documento | Justificación |
|-------|------------|----------------|
| 11 | Plan de Disaster Recovery completo | Habilitador comercial v3.2 (clientes SaaS preguntan RTO/RPO). |
| 12 | SG-SST PYME (política + matriz + plan emergencias) | Visita Mintrabajo, segundo local. |
| 13 | EULA SaaS + DPA cliente SaaS | Habilitador comercial directo v3.2. |
| 14 | Contrato marco B2B | Habilitador del tercer pilar B2B. |
| 15 | Manual de atención al cliente + calendario operativo anual | Cierre del paquete de transferencia de conocimiento Consuelo. |

### Sprint anual y continuo

Resto del catálogo. Lo importante: ningún 🔴 o 🟠 puede llegar a 12 meses sin escribir. Si se acerca el plazo, escalar a sprint inmediato.

---

## 6. Plantillas comunes a desarrollar

Estos son meta-procedimientos: una vez escritos, **todos los procedimientos del catálogo los heredan**. Conviene escribirlos primero porque ahorran trabajo después.

| Plantilla | Ubicación | Uso |
|-----------|-----------|------|
| Plantilla genérica de SOP | `operaciones/_plantilla-sop.md` | Base para todos los SOP de tienda y operaciones |
| Plantilla genérica de runbook | `operaciones/_plantilla-runbook.md` | Base para runbooks de deployment, backup, incidentes |
| Plantilla genérica de política | `governance/_plantilla-politica.md` | Base para políticas (contable, retención, control acceso) |
| Plantilla genérica de contrato | `governance/contratos/_plantilla-contrato.md` | Base para contratos laborales, NDAs, B2B, SaaS |
| Plantilla de matriz de riesgos | `operaciones/sg-sst/_plantilla-matriz-riesgos.md` | Reutilizable para SG-SST + DR + seguridad informática |

---

## 7. Decisiones pendientes del owner

- [ ] **Estructura de carpetas** — ¿se confirma `governance/` + `operaciones/` bajo `formalization/`, o se prefiere mover SOPs operacionales a `docs/operations/` como sugiere [08-tecnologico.md Gap 8.4](../08-tecnologico.md)? Decidir antes de empezar a escribir.
- [ ] **Asesores externos a identificar** — antes de que muchas filas avancen, necesitamos: contador NIIF, asesor laboral, abogado SAS, abogado de propiedad intelectual, asesor habeas data, asesor SG-SST. Algunos pueden ser la misma persona (ej. abogado generalista cubre SAS + comercial). **Acción prioritaria:** mapear cuántos profesionales únicos se necesitan y empezar entrevistas.
- [ ] **Política de versionado y revisión** — ¿quién aprueba los procedimientos de gobernanza? ¿Angel solo, Angel + Consuelo, junta directiva post-SAS?
- [ ] **Visibilidad pública** — qué documentos viven en el repo privado vs. cuáles se publican (políticas de privacidad, T&C, EULA SaaS deben ser públicas y accesibles desde los productos). Definir flujo de publicación.
- [ ] **Cadencia de revisión del inventario** — propuesta: revisión mensual con cierre de sprint. Definir formato.
- [ ] **Definir umbrales SLA** — ¿qué hacer si un procedimiento 🔴 lleva > 60 días sin avanzar? ¿Escalamiento, externalización pagada, descalificación a 🟠?

---

## 8. Mantenimiento del inventario

Este inventario es **documento vivo**. Reglas:

- **Cuando se inicie un procedimiento**, cambiar su estado a 📝 y crear el archivo en la ubicación target.
- **Cuando se complete v1 de un procedimiento**, actualizar a 👀 (en revisión por owner/asesor) y agregar fecha.
- **Cuando se apruebe**, marcar ✅ activo con fecha de vigencia.
- **Cuando se identifique un procedimiento nuevo no listado**, agregar fila al catálogo (sección 4) con referencia al gap padre.
- **Cuando se resuelva un asesor o decisión bloqueante**, mover los procedimientos que dependía a "no bloqueado" y re-priorizar.
- **Cada 90 días**, revisión integral: ¿qué se escribió? ¿qué se desactualizó? ¿qué se redujo de prioridad?

---

## 9. Cruces con otros documentos clave

- [ROADMAP.md de formalización](../ROADMAP.md) — roadmap maestro general; este inventario es el detalle procedimental.
- [equipo/equipo-roadmap-2026.md](../equipo/equipo-roadmap-2026.md) — varios procedimientos bloquean acciones EQ del roadmap de equipo (carta intención Fase 1, contratos laborales, SOPs para Felipe).
- [estabilizacion_contable/intangibles-management.md](../estabilizacion_contable/intangibles-management.md) — define I1–I8 y avalúos AV1/AV2/AV3; varios procedimientos dependen de tener los avalúos para entrar a balance SAS.
- [estabilizacion_contable/migration-plan-hybrid.md](../estabilizacion_contable/migration-plan-hybrid.md) — la reclasificación contable depende de la política contable formal (procedimiento 3.3).
- [estabilizacion_financiera/financial-impact.md](../estabilizacion_financiera/financial-impact.md) — impacto financiero de cada decisión; lectura previa antes de aprobar prioridades.
- [docs/architecture/](../../architecture/) — los runbooks de deployment, backup, refactor SaaS deben referenciar la arquitectura actual.
