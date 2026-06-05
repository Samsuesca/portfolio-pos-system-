# Dimensión 1 — Legal y Corporativo

> **Última actualización:** 2026-05-04
> **Owner:** Carmen Consuelo Ríos Cartagena (titular RUT) + Angel Suesca (operación / desarrollo)
> **Criticidad global:** 🟠 ALTA
> **% Formalización estimado:** 40%
> **Fuente documental:** [RUT_2025.pdf](../../../documentos/Legal/RUT_2025.pdf) (formulario 141191028901, generado 2025-09-18)

---

## Estado actual

### Datos del RUT (verificados con documento oficial)

| Campo | Valor |
|-------|-------|
| **NIT** | 42779422-1 (DV 1) |
| **Titular** | RIOS CARTAGENA CARMEN CONSUELO |
| **Tipo contribuyente** | Persona natural o sucesión ilíquida (código 02) |
| **Documento** | Cédula de Ciudadanía 42779422 |
| **Lugar de expedición CC** | Itagüí, Antioquia, Colombia |
| **Domicilio fiscal** | CR 56 A 66 89, Barrio Hato Nuevo, **Bello (Antioquia)** |
| **Dirección seccional DIAN** | Impuestos de Medellín (código 11) |
| **Correo registrado** | chelorios74@hotmail.com |
| **Teléfonos** | 3001234567 / 3122766306 |
| **CIIU principal (46)** | **4771** — Comercio al por menor de prendas de vestir y sus accesorios |
| **Fecha inicio actividad principal** | **2025-07-01** |
| **CIIU secundario (48)** | No registrado |
| **Otras actividades (50)** | No registradas |
| **Responsabilidades (53)** | **05** — Impuesto de renta y complementarios régimen **ordinario**<br>**49** — No responsable de IVA |
| **Establecimientos (52)** | No registrados en el RUT (campo vacío) |
| **Usuarios aduaneros / exportadores** | Ninguno |

> **Lectura clave:** la titular del negocio es Carmen Consuelo Ríos. Angel Suesca opera el sistema y conduce la formalización pero **no es titular ni representante legal**. Cualquier acción legal-tributaria debe ejecutarse a nombre de la titular o vía poder.

### Figura legal
- **Persona Natural** (no constituida como sociedad).
- Responsabilidad **ilimitada**: el patrimonio personal del titular responde por el negocio.
- Implicación clave: una sanción DIAN, una demanda de cliente, o un accidente laboral pueden afectar bienes personales de Carmen Consuelo.

### Cámara de Comercio
- Inscrita como Persona Natural en **Cámara de Comercio de Medellín para Antioquia** desde **2025** (cubre Bello al ser parte del Valle de Aburrá).
- **Clasificación NIIF: Grupo 2** (PYMES) — confirmado en certificado de Cámara.
- Renovada en 2026.
- **Pendiente de verificar:** que la matrícula del establecimiento de comercio del local en Bello esté registrada en cámara y reflejada en el RUT (campo 52 está vacío).

### Actividad económica (CIIU)
- **CIIU 4771** — Comercio al por menor de prendas de vestir y sus accesorios. Fecha de inicio según RUT: **2025-07-01**.
- Sin actividad secundaria registrada (campo 48/49 vacío).

### Establecimientos
- 1 local físico actualmente operativo en **Bello (Antioquia)**.
- El RUT **no tiene registrado el establecimiento** (campo 52 = vacío). Verificar si la matrícula mercantil del establecimiento está en Cámara y, en ese caso, actualizar el RUT para incluirlo.
- Apertura próxima de segundo local en otro municipio (target v3.1, jun 2026).

---

## Gaps identificados

### Gap 1.1 — Riesgo patrimonial por persona natural ante expansión 🟠

**Problema:** El plan de expansión incluye:
- Nueva sucursal en otro municipio (jun 2026).
- Comercialización del software UCR a terceros (oct 2026).
- Contratación formal de empleados.

Bajo persona natural, cualquier contingencia compromete el patrimonio personal sin separación legal.

**Recomendación:** Migrar a **S.A.S** antes de la apertura del segundo local. Costos referenciales 2026:
- Cámara de Comercio (constitución): ~$700.000 - $1.200.000 según activos.
- Asesoría legal redacción estatutos: ~$500.000 - $1.500.000.
- Total aproximado: $1.5M - $3M COP.

**Beneficios:**
- Responsabilidad limitada al aporte de los socios.
- Estructura clara para incorporar inversionistas o socios en v3.2.
- Mejor frente a clientes corporativos B2B (colegios grandes, futuros clientes SaaS).
- Optimización tributaria potencial (renta corporativa vs. renta persona natural).

**Costo de no hacerlo:** Cualquier sanción significativa o demanda puede implicar pérdida de bienes personales.

---

### Gap 1.2 — CIIU único limita facturación B2B 🟡

**Problema:** Solo registrado CIIU 4771 (comercio al detal) — confirmado en RUT 2025 (campo 46, sin secundaria en 48). Si vende a colegios mediante contratos institucionales o a clientes corporativos (caso restaurante en cotización, ver `02-tributario.md` Gap 2.0), podría aplicar también:
- **4642** — Comercio al por mayor de prendas de vestir.
- **1410** — Confección de prendas de vestir (si hay maquila/producción propia).

**Recomendación:** Evaluar con contador en próxima ronda. Adicionar en próxima actualización RUT (gratuito vía MUISCA) y notificar a Cámara. Mismo trámite puede aprovecharse para registrar el establecimiento de comercio en el campo 52 del RUT.

---

### Gap 1.3 — Segundo local en otro municipio sin plan formal 🟡

**Problema:** Sin marco legal-tributario claro para apertura.

**Acciones requeridas (orden cronológico):**
1. Definir si el segundo local será del **mismo titular** (Carmen Consuelo Ríos persona natural / futura S.A.S) o entidad distinta.
2. Inscribir matrícula de establecimiento de comercio en cámara correspondiente.
3. Inscribir en RIT del nuevo municipio (ICA dual: Bello + nuevo municipio).
4. Modelar en el sistema UCR como `Branch` separado con `school_id` propio (ya planificado en `docs/v3-branch-architecture/branch-architecture.md`).
5. Considerar contratos de arrendamiento, registros de empleados, cesión de inventario.

---

### Gap 1.4 — Establecimientos no registrados en RUT 🟡

**Problema:** El campo 52 del RUT 2025 (Número de establecimientos) está vacío y no hay establecimientos detallados. Esto puede ser inconsistente con la realidad operativa (hay un local activo en Bello) y con la matrícula mercantil de Cámara.

**Acciones:**
1. Verificar en certificado de Cámara de Comercio si el establecimiento de comercio del local en Bello está matriculado.
2. Si está matriculado en Cámara pero no en RUT: actualizar RUT vía MUISCA (gratuito) reportando el establecimiento.
3. Si no está matriculado en ninguno: hacerlo en Cámara primero, luego reflejarlo en RUT.
4. Repetir el trámite cuando se abra el segundo local.

---

**Documento de referencia:** [RUT_2025.pdf](../../../documentos/Legal/RUT_2025.pdf) — formulario 141191028901, generado 2025-09-18.

---

## Roadmap de cierre

| ID | Acción | Prioridad | Plazo objetivo | Costo estimado | Dependencia |
|----|--------|-----------|----------------|----------------|-------------|
| L1 | Decidir constitución S.A.S | 🟠 | <60 días | $1.5M–$3M | Decisión estratégica de la titular |
| L2 | Evaluar adicionar CIIU 4642/1410 en RUT | 🟡 | <90 días | $0 (MUISCA) | L1 |
| L3 | Verificar / registrar establecimiento(s) en RUT (campo 52) | 🟡 | <60 días | $0 | Cert. Cámara |
| L4 | Plan formal apertura segundo local (jurídico + tributario) | 🟠 | Antes de jun 2026 | TBD | L1 (idealmente como S.A.S) |
| L5 | Constitución S.A.S (si decidida) | 🟠 | Antes de v3.1 (jun 2026) | $1.5M–$3M | L1 |

---

## Conexión con releases técnicos

| Release | Implicación legal |
|---------|-------------------|
| v3.0 (abr 2026) | Mantener persona natural es viable temporalmente, pero **debe resolverse lo antes posible. |
| v3.1 (jun 2026) | Idealmente operar como S.A.S. Multi-branch debe tener marco legal coherente. |
| v3.2 (oct 2026) | Imprescindible S.A.S para vender SaaS — los contratos B2B con clientes empresariales requieren persona jurídica. |

---

## Decisiones pendientes del owner

- [ ] ¿Migrar a S.A.S? Si sí, ¿quiénes son los socios y con qué participación? (Carmen Consuelo como única socia o incorporar a Angel u otros).
- [ ] ¿El segundo local opera bajo la misma figura o se crea entidad separada?
- [ ] ¿Hay socio capitalista para el segundo local o financiamiento propio?
- [ ] ¿Se otorga poder a Angel Suesca para gestionar trámites DIAN/Cámara en nombre de la titular, o cada trámite lo firma ella personalmente?
