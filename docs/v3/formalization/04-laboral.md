# Dimensión 4 — Laboral

> **Última actualización:** 2026-05-02
> **Owner:** Angel Suesca + (pendiente) Asesor laboral
> **Criticidad global:** 🔴 CRÍTICA
> **% Formalización estimado:** 5%

---

## Resumen ejecutivo
UCR opera con 5 personas, de las cuales **3 no tienen afiliación a seguridad social** (Felipe, Salomé, Santiago). Bajo régimen de Persona Natural, cualquier accidente laboral, demanda o auditoría UGPP compromete patrimonio personal del titular.

La formalización laboral debe priorizarse **antes** que la implementación de FE DIAN, por la magnitud del riesgo y por bloquear la entrada al mercado B2B.

---

## Estado actual

### Cuadro de personal (mayo 2026)

| Persona | Rol | Vínculo familiar | SS afiliado | Cómo paga |
|---------|-----|------------------|-------------|-----------|
| Angel Suesca | Owner / desarrollador | — | Sí | Por otro trabajo formal (no por UCR) |
| Consuelo Ríos | Operación cara visible | Madre | Sí | Como independiente |
| Felipe Suesca | Operación | Hermano | **NO** | — |
| Salomé F | Operación | Cuñada | **NO** | — |
| Santiago Mazo | Operación | — | **NO** | — |

### Personal proyectado (jun 2026, v3.1)

- +1 trabajadores para segunda sucursal en otro municipio.
- Total proyectado: 1 personas.

### Trabajo tercerizado

- Modistas, costureras, mensajería (estimado, pendiente verificar alcance real).
- Estado de contratos / órdenes de servicios: desconocido.

### Vinculación contractual

- **Ningún contrato laboral escrito.**
- **Ningún contrato civil/comercial de prestación de servicios escrito** (terceros).
- Operación informal de facto.

### Nómina electrónica

- No implementada.
- Obligatoria desde 2021 para todos los empleadores (Resolución DIAN 013 de 2021), con cronograma de gradualidad ya completado.

### SST (Seguridad y Salud en el Trabajo)

- Sistema SG-SST no implementado.
- No hay matriz de riesgos laborales documentada.
- No hay COPASST (Comité Paritario) ni reglamento interno.

---

## Gaps identificados

### Gap 4.1 — Elusión de aportes a seguridad social 🔴

**Marco legal:**
- Ley 100 de 1993 (Salud y Pensión).
- Decreto 1295 de 1994 (ARL).
- Ley 21 de 1982 (Caja Compensación, ICBF, SENA).
- Art. 313 Código Penal: omisión de agente retenedor o recaudador (pena 4-9 años + multa).
- Art. 314 ET: sanciones administrativas por elusión de aportes.

**Riesgo cuantificado:**

Aportes patronales no pagados (estimado por trabajador a SMMLV $1.4M):

| Concepto | Tarifa | Mensual |
|----------|--------|---------|
| Salud (empleador) | 8.5% | $119.000 |
| Pensión (empleador) | 12% | $168.000 |
| ARL (riesgo I) | 0.522% | $7.300 |
| Caja Compensación | 4% | $56.000 |
| ICBF | 3% | $42.000 |
| SENA | 2% | $28.000 |
| **Total patrono** | **~30%** | **~$420.000** |

> *Nota:* Empresas con menos de 10 empleados que aportan al régimen contributivo tienen exención del 8.5% salud + 3% ICBF + 2% SENA bajo Ley 1607 de 2012 si IBC <10 SMMLV. Aplicable mientras se cumpla la condición. Reduce aporte a ~16% mensual.

**Estimación pasivo oculto** (3 empleados sin afiliar × $420k × 18 meses = jun 2025 a may 2026):
- Aportes principales no pagados: **~$22.7M COP**.
- Sanción UGPP típica (60%): **~$13.6M COP**.
- Intereses moratorios: ~$2-3M.
- **Total potencial: $35M – $45M COP.**

**Atenuantes disponibles:**
- Programa de regularización voluntaria UGPP (cuando esté abierto): permite pagar aportes con sanciones reducidas.
- Si se vincula a empleados con contrato formal y se paga retroactivo de común acuerdo, no hay litigio.

**Acción inmediata:**
1. Asesor laboral (abogado o consultora). Costo: $1M–$3M para diagnóstico + plan.
2. Definir formato de vinculación por persona (laboral fijo, indefinido, prestación servicios).
3. Afiliar inmediatamente a EPS, AFP, ARL, Caja, ICBF, SENA (ARL puede empezar día 0).
4. Negociar con cada empleado el contrato formal (puede haber resistencia por net pay menor).
5. Plan de regularización con UGPP si aplica.

### Alternativa puente — Afiliación como independientes (Decreto 723 de 2013 + Decreto 1563 de 2016)

**Contexto:** mientras no haya contrato laboral formal (ej. fase pre-SAS), el trabajador puede afiliarse a SS como **independiente voluntario**. UCR le transfiere mensualmente el monto necesario como auxilio.

**Ventajas:**
- Cubre el riesgo de accidente laboral (ARL) sin requerir contrato laboral.
- Mantiene flexibilidad operativa durante transición.
- Costo más bajo (UCR no paga prestaciones aún).

**Costos por persona/mes (a SMMLV ~$1.4M IBC):**

| Concepto | Tarifa | Mensual |
|----------|--------|---------|
| ARL como independiente (riesgo I) | 0.522% | ~$7.300 |
| EPS como independiente | 12.5% | ~$175.000 |
| AFP como independiente | 16% | ~$224.000 |
| **Total por persona** | **~28.5%** | **~$406.000** |

**Solo ARL (mínimo viable):** $7.300/persona/mes × 5 = **$36.500/mes total**.

**ARL + EPS + AFP completo:** $406k/persona × 3 personas (Felipe, Salomé, Santiago) = **$1.22M/mes**.

> Comparado con $520k/mes/persona si UCR formaliza como empleador con prestaciones, esta es ~22% más barata pero cubre los riesgos críticos de salud, pensión y accidente.

**Cómo se ejecuta operativamente:**
1. Cada trabajador se afilia individualmente a EPS, AFP, ARL en cualquier oficina (Sura, Colmédica, Medellín tiene varias opciones).
2. UCR le transfiere mensual el monto necesario como "auxilio para SS" (registrar en `expenses` categoría `auxilios_ss`, no como `payroll`).
3. El trabajador paga las afiliaciones desde su cuenta.
4. Conservar comprobantes para defensa ante UGPP si llega.

**Limitaciones:**
- No reemplaza prestaciones laborales (cesantías, primas, vacaciones).
- Si la relación tiene subordinación + horario + exclusividad, judicialmente se puede declarar **contrato realidad** y exigir prestaciones retroactivas.
- Es **transición**, no destino final. La meta sigue siendo SAS + contratos formales (Fase F4 del plan).

---

### Cotización B2B activa — implicación laboral

> **Nota agregada 2026-05-02:** existe cotización en curso con un restaurante por ~$9M COP. Esto activa una urgencia adicional:

- Cliente B2B formal exige proveedor con paz y salvo parafiscales (certificado de aportes a SS al día).
- Si UCR no afilia a sus trabajadores, el restaurante (cliente) puede ser **solidariamente responsable** por aportes no pagados (Art. 34 Ley 100). Algunos clientes corporativos exigen certificado de pagos como condición de pago.
- **Conclusión:** el contrato del restaurante puede acelerar la decisión de afiliar formalmente, aunque sea como independientes (mínimo viable).

---

### Gap 4.2 — Sin contratos escritos 🔴

**Marco legal:**
- CST Art. 39 - 47: aunque el contrato puede ser verbal, se presume a término indefinido y se exigen condiciones mínimas.
- En caso de demanda laboral, sin contrato escrito el empleado puede reclamar:
  - Salario integral (a lo que dijo recibir).
  - Auxilio de cesantías (8.33% anual).
  - Intereses sobre cesantías (12% anual).
  - Prima de servicios (8.33% anual).
  - Vacaciones (4.17% anual).
  - Dotación cada 4 meses (3 mudas/año si <2 SMMLV).
  - Subsidio de transporte (si <2 SMMLV).

**Riesgo cuantificado por empleado/año a SMMLV:**

| Concepto | Anual |
|----------|-------|
| Cesantías | ~$1.4M |
| Intereses cesantías | ~$170k |
| Prima de servicios | ~$1.4M |
| Vacaciones | ~$700k |
| Subsidio transporte | ~$2.0M |
| Dotación | ~$300k |
| **Total prestaciones** | **~$6M/año** |

Si Felipe/Salomé/Santiago demandaran retroactivamente: $6M × 1.5 años × 3 empleados = **~$27M COP**, además de salarios reclamados y indemnizaciones.

**Acción:**
1. Redactar contratos individuales (cada uno con su perfil).
2. Definir salario formal (puede haber acuerdo de salario nominal + auxilios).
3. Establecer fecha de inicio formal del contrato (no necesariamente la fecha real de inicio del trabajo informal — riesgo legal a evaluar con asesor).

---

### Gap 4.3 — Sin nómina electrónica DIAN 🔴

**Marco legal:**
- Resolución DIAN 013 de 2021 — obligatoria para todos los empleadores con cronograma gradual ya finalizado.
- Sanción Art. 651 ET: 5% de los pagos al empleado por documento omitido.

**Acción:**
- Una vez vinculados los empleados, configurar nómina electrónica con proveedor (Alegra, Siigo, Nominapp, Zenpli — varios incluyen FE + nómina en mismo paquete).
- Costo adicional típico: $30k–$80k mensual.
- Integración con backend UCR vía API (servicio futuro).

---

### Gap 4.4 — Sin SG-SST 🟠

**Marco legal:**
- Decreto 1072 de 2015, Resolución 0312 de 2019: Sistema de Gestión de Seguridad y Salud en el Trabajo obligatorio para todas las empresas.
- Estándares mínimos según número de trabajadores y nivel de riesgo.
- Para UCR (5-7 trabajadores, riesgo I-II): aplicable estándar reducido.

**Mínimos exigidos:**
- Política SST escrita.
- Matriz de identificación de peligros y valoración de riesgos.
- Plan anual de trabajo SST.
- Capacitación inducción.
- Reporte de accidentes a la ARL.
- COPASST o vigía de SST (según número empleados).

**Sanción incumplimiento:** Resolución 0312 — multas de 1 a 1000 SMMLV (~$1.4M–$1.4MM) según gravedad.

**Acción:**
- Una vez afiliados a ARL, ellos generalmente proveen plantillas y acompañamiento gratuito para SG-SST.
- Designar responsable interno (puede ser Angel o Consuelo).
- Implementar gradualmente en 90 días.

---

### Gap 4.5 — Trabajo tercerizado sin contratos 🟡

**Acción:**
1. Inventariar terceros recurrentes (modistas, costureras, mensajería).
2. Para cada uno, decidir:
   - Contrato de prestación de servicios (independientes).
   - Vinculación laboral (si hay subordinación + horario + exclusividad → riesgo de declaración judicial de relación laboral).
3. Pago a independientes exige verificar afiliación a SS (Decreto 1273 de 2018: el contratante debe verificar).

---

### Gap 4.6 — Plan de personal segunda sucursal 🟡

**Acción:**
- Antes de jun 2026, definir:
  - Cargos requeridos.
  - Salarios objetivo.
  - Tipo de contrato (idealmente término fijo inicial 3-6 meses).
  - Política de selección.
- Idealmente la segunda sucursal **arranque ya formal** (no hereda informalidad).

---

## Roadmap de cierre

| ID | Acción | Prioridad | Plazo | Costo estimado | Bloquea a |
|----|--------|-----------|-------|----------------|-----------|
| LAB1 | Contratar asesor laboral / abogado | 🔴 | <14 días | $1M–$3M dx + $300k–$1M/mes | LAB2-LAB6 |
| LAB2 | Afiliar 3 empleados sin SS (EPS, AFP, ARL, Caja) | 🔴 | <30 días | aportes corrientes | LAB3, LAB4 |
| LAB3 | Redactar contratos individuales | 🔴 | <30 días | LAB1 | Demanda / litigio |
| LAB4 | Plan regularización UGPP (si aplica) | 🔴 | <60 días | TBD según diagnóstico | Auditoría sorpresa |
| LAB5 | Implementar nómina electrónica DIAN | 🟠 | <60 días | $30k-$80k/mes | Sanción Art. 651 ET |
| LAB6 | Implementar SG-SST básico | 🟠 | <90 días | gratis con ARL | Sanción Res. 0312 |
| LAB7 | Inventario y formalización de terceros | 🟡 | <90 días | TBD | Riesgo solidaridad |
| LAB8 | Plan personal segunda sucursal | 🟡 | Antes jun 2026 | — | v3.1 |

---

## Conexión con releases técnicos

| Release | Implicación laboral |
|---------|---------------------|
| v3.0 (abr 2026) | Sin impacto técnico, pero LAB2-LAB3 deben ejecutarse en este horizonte. |
| v3.1 (jun 2026) | Nueva sucursal abre con personal formal desde día 1. SG-SST debe estar cubierto. |
| v3.2 (oct 2026) | Comercializar SaaS sin formalización laboral es altísimo riesgo (cualquier cliente corporativo audita esto en due diligence). |

---

## Conexión con módulo HR del backend

UCR tiene `hr` en código (verificar `backend/app/api/routes/hr.py` y modelos relacionados). Cuando se formalice el personal, evaluar:

- ¿El módulo HR existente puede registrar empleados, salarios, prestaciones?
- ¿Genera reportes para nómina electrónica (CSV exportable a proveedor)?
- ¿Maneja control de horarios / vacaciones / cesantías?
- ¿Integra con sistema de roles (`user_school_roles`) para que un empleado registrado en HR sea automáticamente usuario del sistema con permisos?

Esta integración técnica puede ser un proyecto v3.x y debería evaluarse junto con el plan de regularización laboral.

---

## Plan individualizado por persona

El detalle por persona (rol target, ruta de habilidades, plan de estudio, compensación por fase, camino a equity) se desarrolla en [equipo-roadmap-2026.md](equipo-roadmap-2026.md) y las bitácoras individuales en [bitacoras/](bitacoras/). Este documento (04-laboral) cubre el marco legal y los gaps regulatorios; el otro instrumenta la formalización persona a persona.

---

## Decisiones pendientes del owner

- [ ] ¿Quién es el asesor laboral? (recomendación: alguien especializado en pequeñas empresas, no corporativo).
- [ ] ¿Negociación con cada empleado: salario formal vs salario nominal + auxilios?
- [ ] ¿Felipe/Salomé/Santiago aceptan formalización? (Algunos pueden preferir mantener informalidad por temas tributarios personales).
- [ ] ¿Constitución S.A.S antes o después de formalizar empleados?
  - **Si S.A.S primero:** los contratos van a nombre de S.A.S (limpio).
  - **Si empleados primero:** después hay que sustituir patronal de PN a S.A.S (proceso adicional).
  - **Recomendación:** decidir constitución S.A.S YA y luego vincular empleados a la S.A.S.
- [ ] ¿Política para los 2 nuevos empleados de la segunda sucursal?
