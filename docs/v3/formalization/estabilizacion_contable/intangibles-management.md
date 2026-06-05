# Gestión de Activos Intangibles e Inversiones — UCR

> **Última actualización:** 2026-05-24
> **Owner:** Angel Suesca + (pendiente) Contador público colegiado + (pendiente) Asesor de propiedad intelectual
> **Relación con otras dimensiones:** profundiza [01-legal-corporativo.md](../01-legal-corporativo.md) (aporte en especie SAS), [03-contable.md](../03-contable.md) (registro NIIF), [06-comercial.md](../06-comercial.md) (marca y clientela), [08-tecnologico.md](../08-tecnologico.md) (PI del software), [equipo/equipo-roadmap-2026.md](../equipo/equipo-roadmap-2026.md) (avalúo plataforma para grant a Angel)
> **Estado:** v1 propuesta — pendiente validar con contador NIIF y abogado SAS.

---

## 1. Por qué este documento existe

UCR opera hoy sobre activos intangibles que **no están reconocidos contablemente**: la plataforma de software UCR, la marca y el dominio, la base de datos de clientes, el conocimiento operacional que vive en Consuelo, los contratos B2B en formación, y la pipeline SaaS. Estos activos son la **mayor parte del valor real del negocio** cuando se proyecta hacia v3.1 (segunda sucursal) y v3.2 (comercialización del software).

La consecuencia de no documentarlos es triple:

1. **El balance de la futura SAS subestima sustancialmente su patrimonio.** Si el avalúo de los aportes en especie (Consuelo aportando el negocio + Angel aportando la plataforma) no está respaldado por una metodología defendible, el cap table propuesto en [equipo-roadmap-2026.md §2](../equipo/equipo-roadmap-2026.md) queda en el aire — son rangos, no cifras firmables.

2. **La inversión continua en los intangibles se pierde como gasto operativo.** Cada hora de desarrollo, cada honorario de PI, cada registro de marca — todo eso construye valor duradero que hoy se imputa al período. Sin una política de capitalización, el P&L lee como "esto cuesta sin construir nada" y la SAS arranca subcapitalizada.

3. **Sin avalúo y sin registro formal, Angel no tiene base defendible para reclamar su % del cap table.** La conversación familiar de equity se vuelve subjetiva en lugar de basada en evidencia documental. Lo mismo ocurre con la dilución que acepte Consuelo desde su 100% pre-SAS.

Este documento define **qué se reconoce como intangible, cómo se mide, cómo se amortiza, cómo se registra cada inversión que aumenta su valor, y qué avalúos son bloqueantes** para la constitución de la SAS.

---

## 2. Marco normativo

| Norma | Aplicación a UCR |
|-------|------------------|
| **NIIF para PYMES Sección 18** — Activos Intangibles distintos de la Plusvalía | Reconocimiento, medición, amortización y revelación |
| NIIF para PYMES Sección 19 — Combinaciones de Negocio y Plusvalía | Plusvalía adquirida (no aplica hoy; aplicaría si UCR adquiere otro negocio) |
| **Decreto 2420 de 2015** + Decreto 2496 de 2015 | Marco técnico NIIF PYMES Grupo 2 obligatorio para UCR |
| **Estatuto Tributario Arts. 74, 74-1, 142, 143-1** | Tratamiento fiscal de intangibles: amortización deducible solo bajo condiciones específicas |
| Ley 23 de 1982 + Decisión 351 CAN | Protección por derecho de autor del software (cruzado con [08-tecnologico.md](../08-tecnologico.md)) |
| Decisión 486 CAN | Marca, modelo de utilidad (software no es patentable) |
| Ley 256 de 1996 | Secreto empresarial / trade secrets — protección sin necesidad de registro |
| **Art. 319 ET** | Régimen de neutralidad fiscal en aportes en especie a sociedades nacionales — relevante para el aporte de la plataforma a la SAS |

> **Nota crítica:** NIIF y fiscal **divergen significativamente** en intangibles. Un intangible reconocido contablemente puede no ser amortizable fiscalmente, y viceversa. Ambos registros deben llevarse en paralelo. La conciliación es decisión del contador.

---

## 3. Inventario de intangibles UCR (estado 2026-05)

### Identificados

| # | Intangible | Origen | Titular actual | Estado contable | Reconocimiento NIIF posible |
|---|------------|--------|----------------|------------------|------------------------------|
| **I1** | Plataforma de software UCR (backend FastAPI + frontend Tauri + web/admin portals Next.js + mobile Expo) | Desarrollo interno por Angel desde 2025 | Angel Suesca (copyright en `LICENSE`) | No reconocido | **Sí**, vía Sección 18 — generado internamente, fase de desarrollo |
| **I2** | Marca "Uniformes Consuelo Ríos" + dominio `yourdomain.com` | Operación desde 2016 | Consuelo (sin registro SIC) | No reconocido | **Sí**, una vez registrada formalmente — ver [06-comercial.md Gap 6.5](../06-comercial.md) |
| **I3** | Base de datos de clientes (PII + historial de compras desde 2025) | Operación 2016–actual | Negocio (Consuelo PN) | No reconocido | **No** — Sección 18.34(b) prohíbe reconocer cartera de clientes generada internamente |
| **I4** | Conocimiento operacional tácito de Consuelo | Experiencia 2016–actual | Consuelo (tácito) | No reconocido | **No** — knowledge tácito no es separable. Se materializa solo cuando se documenta en SOPs |
| **I5** | Cost breakdown system + modelo financiero + reglas de descuento + sistema de permisos granulares | Desarrollo 2026 | Angel + UCR | No reconocido | **Sí**, como módulos de I1 |
| **I6** | Contratos B2B + pipeline (cotización restaurante $9M, futuros colegios institucionales) | Comercial 2026+ | UCR | No reconocido | **No** — derechos contractuales en formación no califican; se reconocen al cierre del contrato |
| **I7** | Pipeline SaaS v3.2 (prospectos clientes del software) | Comercial pendiente oct-2026+ | UCR | No reconocido | **No** — expectativa, no derecho |
| **I8** | Trade secrets (lógica de algoritmos, fórmulas de precios, configuración interna) | Desarrollo Angel | Angel | No reconocido | **No** se reconoce en balance, **sí** se protege legalmente vía NDA + control de acceso |

### Brecha estructural

**Ningún intangible está reconocido hoy en el balance de UCR**. Esto es **técnicamente correcto** mientras opera como Persona Natural sin proceso de avalúo formal — pero es **estratégicamente insostenible** porque:

- Al constituir la SAS, los aportes en especie de Consuelo (negocio existente) y Angel (plataforma) **deben avaluarse y registrarse** como contrapartida a las acciones emitidas. Sin avalúo, no hay acta de constitución firmable.
- Al proyectar v3.2, los inversionistas o clientes SaaS preguntarán por la valoración del activo subyacente. Sin trazabilidad contable y avalúo respaldado, no hay respuesta defendible.
- En caso de eventual disputa familiar sobre el cap table, el documento de avalúo es la única defensa objetiva.

---

## 4. Política de reconocimiento

Para que un desembolso o construcción se reconozca como intangible (en lugar de gasto del período), debe cumplir **simultáneamente** los cuatro criterios de NIIF para PYMES Sección 18.4:

1. **Identificabilidad** — el activo es separable (se puede vender, ceder, licenciar, etc.) o surge de derechos contractuales o legales. Software con copyright y marca registrada — sí. Knowledge tácito en la cabeza de Consuelo — no, hasta que esté documentado, separable y transferible.
2. **Control** — UCR tiene capacidad de obtener los beneficios económicos futuros y de restringir el acceso de terceros. Esto implica que la **cesión de derechos patrimoniales Angel → UCR/SAS** ([08-tecnologico.md Gap 8.2](../08-tecnologico.md)) debe firmarse **antes** de que la plataforma pueda reconocerse en el balance de la SAS. Sin cesión, UCR no controla el activo (lo controla Angel como autor).
3. **Beneficios económicos futuros probables** — ingresos por venta, ahorro de costos, o ventaja comercial. Para la plataforma UCR: uso operativo + base para v3.1 + base para v3.2 SaaS.
4. **Costo medible con fiabilidad** — registros de inversión auditables (horas, facturas, honorarios).

### Decisión por categoría

| Categoría | ¿Reconocer en balance NIIF? | Justificación |
|-----------|------------------------------|----------------|
| Software desarrollado internamente, fase de desarrollo | **Sí** | Sección 18.14 — costos directamente atribuibles tras demostrar viabilidad técnica y comercial. Para UCR: aplica desde el primer release operativo en producción (negocio real corriendo sobre él) |
| Software desarrollado internamente, fase de investigación | **No** (gasto) | Sección 18.13 — antes de tener una versión funcional, todo va a P&L |
| Software adquirido a terceros | **Sí**, al costo de adquisición | Sección 18.10 |
| Marca registrada en SIC | **Sí**, al costo de registro + costos directos | Sección 18.10 |
| Marca usada sin registrar | **No reconocer** hasta registro formal | Sin derecho legal exclusivo defendible |
| Base de clientes generada internamente | **No reconocer** | Sección 18.34(b) — explícitamente prohibido |
| Base de clientes adquirida | **Sí** | Solo aplica si UCR compra otro negocio |
| Conocimiento operacional documentado en SOPs | **No reconocer como intangible separado** | Forma parte del valor del negocio en marcha (going concern), no es separable y vendible por sí solo. Su valor se refleja en utilidad recurrente, no en activos del balance |
| Trade secrets | **No reconocer** en balance | Pero **sí proteger** vía NDA + control de acceso (cruzado con [08-tecnologico.md Gap 8.6, 8.8](../08-tecnologico.md)) |
| Licencia de software adquirida (uso operativo) | **Sí**, al costo, si la vida útil es > 1 año | Sección 18.10 |

---

## 5. Política de medición inicial

### Software desarrollado internamente (I1 — plataforma UCR)

Costos **capitalizables** según Sección 18.15:

1. Costo directo de personal asignado al desarrollo (horas × tarifa de mercado defendible).
2. Honorarios profesionales atribuibles directamente al desarrollo (asesoría técnica, abogado de PI, agente marcario para registro DNDA).
3. Costo de licencias de herramientas usadas **exclusivamente** para el desarrollo (no las licencias dual-use operativas).
4. Costos de pruebas dedicadas a validar funcionalidad antes del uso en producción.
5. Capitalizable **únicamente** desde el momento en que se cumplen los criterios de la Sección 18.16: viabilidad técnica, intención de uso, capacidad de uso, evidencia de beneficios económicos futuros, capacidad de medir costos confiablemente.

Costos **NO capitalizables** (van a P&L como gasto):

- Costos administrativos generales no atribuibles directamente.
- Capacitación del personal (excepto que cree un activo separable, lo cual casi nunca aplica).
- Costos de la fase de investigación (todo lo anterior a tener una versión funcional).
- Mantenimiento de software ya en producción (bug fixes, refactor, soporte).
- Costos preoperativos del propio negocio.

### Metodología propuesta — avalúo retrospectivo de la plataforma UCR a 2026-05

Para que el aporte de Angel a la SAS tenga base auditable, el avalúo retrospectivo debe construirse con triangulación de tres métodos y luego conciliarse:

**Método A — costo histórico reconstruido**

1. Reconstruir cronograma de desarrollo desde primer commit en `uniformes-system-v2` hasta release v2.x estable.
2. Estimar horas dedicadas por Angel: `git log --author="Angel"` + estimación por sesión + factor de no-commit (diseño, debugging local, sesiones con Claude Code) × 1.3–1.5.
3. Aplicar tarifa de mercado para CTO / full-stack senior en Colombia 2026: rango referencia **$80,000 – $150,000 / hora**, definir cifra exacta con respaldo de encuestas salariales 2026.
4. Sumar honorarios externos pagados (si los hubo).
5. Restar costos no capitalizables (mantenimiento post-release, bug fixes, refactor).
6. Documentar avalúo y soportes en `formalization/estabilizacion_contable/intangibles-avaluo-plataforma-ucr.md` (por crear como parte del roadmap §10).

**Método B — costo de reemplazo de mercado**

1. Solicitar 2-3 cotizaciones a casas de desarrollo colombianas para construir "un sistema equivalente" (POS multi-tenant + accounting global + portal padres + admin portal + mobile + integraciones Wompi/Alegra/Telegram).
2. Rango esperado en mercado 2026: **$80M – $250M** dependiendo de alcance exacto y experiencia del proveedor.
3. Documentar las cotizaciones como soporte.

**Método C — valor presente de flujos esperados (DCF)**

1. Proyectar flujos incrementales que habilita la plataforma: eficiencia operativa actual + ingresos esperados v3.1 + ingresos esperados v3.2.
2. Tasa de descuento defendible: WACC PYME Colombia 2026 ~18-22% nominal.
3. Horizonte: 5 años + valor terminal conservador.
4. Es el método más subjetivo pero el único que captura el potencial de v3.2.

**Conciliación obligatoria**

Si los tres métodos divergen más de 50% entre sí, se aplica criterio conservador (típicamente el menor) y se documenta la decisión con su justificación. Para cifras > $50M se recomienda **avalúo por tercero independiente certificado**.

### Marca y dominio (I2)

Costo capitalizable inicial:

- Tasas oficiales de registro en SIC (rango referencia **$1M – $2M** dependiendo de número de clases solicitadas).
- Honorarios del agente de propiedad industrial.
- Costos directos del estudio de antecedentes marcarios.
- Costo de dominio acumulado + renovaciones futuras (factura registrar/Cloudflare).

**No capitalizable:** publicidad, marketing, costos de construcción de awareness — son gasto del período aunque construyan valor de marca económicamente. NIIF lo excluye explícitamente.

### Aportes en especie a la SAS — caso especial

Cuando Angel aporta la plataforma y Consuelo aporta el negocio existente como contrapartida a las acciones, el **costo de adquisición del intangible para la SAS** es el valor razonable acordado en el acta de constitución, **NO** el costo histórico del aportante. Esto exige:

1. **Avalúo independiente** — idealmente tercero neutral, especialmente para mitigar el conflicto potencial madre-hijo en la dilución.
2. **Acta de constitución** que detalle por activo: descripción, valor asignado, número de acciones recibidas en contrapartida.
3. **Cesión formal de derechos patrimoniales** Angel → SAS firmada en la misma diligencia notarial ([08-tecnologico.md Gap 8.2](../08-tecnologico.md)).

> **Implicación tributaria pendiente:** el aporte en especie de un activo intangible puede generar **renta gravable para Angel** por la diferencia entre valor asignado y costo fiscal del activo en cabeza de Angel (cercano a cero porque lo desarrolló él internamente). El **Art. 319 ET** ofrece un régimen de **neutralidad fiscal** si el aporte se estructura adecuadamente (la SAS recibe el activo con el mismo costo fiscal del aportante, sin reconocer utilidad gravable hasta la enajenación posterior). **Decisión a validar con contador antes de firmar acta** — el ahorro fiscal puede ser significativo.

---

## 6. Política de amortización

### Vida útil estimada

| Intangible | Vida útil NIIF propuesta | Justificación | Vida útil fiscal alineable |
|------------|----------------------------|----------------|------------------------------|
| Plataforma UCR (I1) | **5 años** | Horizonte tecnológico del stack actual + refactor mayor previsto para v3.2 SaaS (que reinicia parcialmente la base) | Art. 142-143 ET |
| Marca registrada (I2) | **10 años** inicial, renovable | Período de protección legal de marca en Colombia (renovable indefinidamente) | Art. 142 ET |
| Licencias de software adquiridas | Plazo contractual | Estándar | Art. 142 ET |
| Cualquier intangible con vida útil no medible confiablemente | **10 años por defecto** | Sección 18.20 | — |

**Caso especial — vida útil indefinida:** si la marca se renueva consistentemente y genera flujos sostenidos, su vida útil puede declararse indefinida. En ese caso NIIF Sección 18.19(c) **prohíbe amortizarla** y exige test anual de deterioro. Decisión a tomar con contador.

### Método

**Línea recta**. La Sección 18.22 lo permite por defecto cuando el patrón de consumo no es identificable confiablemente — que es el caso típico en software interno.

### Valor residual

**Cero**, excepto cuando exista compromiso vinculante de un tercero de comprar el activo al final de su vida útil. No aplica hoy para UCR.

### Test de deterioro

Anual y/o cuando haya indicios. Indicios típicos:

- Pérdida significativa de mercado o de clientela.
- Cambio tecnológico que vuelve obsoleta una parte material de la plataforma.
- Pérdida de derechos legales (cancelación de marca, demanda exitosa contra el copyright).
- Cambio adverso en el entorno regulatorio (DIAN, SIC).

Si el monto recuperable (mayor entre valor de uso y valor razonable menos costos de venta) es inferior al valor en libros, se ajusta a la baja con cargo a resultados.

---

## 7. Registro de inversiones — libro auxiliar going-forward

Desde **2026-05-24** en adelante, toda inversión susceptible de aumentar el valor de un intangible se registra en este libro auxiliar. El contador valida cada entrada antes de capitalizarla en el sistema contable.

### Plantilla del registro

| # | Fecha | Intangible afectado | Descripción de la inversión | Monto COP | Tipo (capitaliza / gasto) | Soporte documental | Responsable | Aprobación contador |
|---|-------|---------------------|------------------------------|-----------|-----------------------------|--------------------|-------------|----------------------|
| `[ID]` | `YYYY-MM-DD` | `I1 / I2 / ...` | `[texto]` | `$ X` | `cap / gasto` | `[link a factura, commit, acta]` | `[persona]` | `[sí / pendiente / no — razón]` |

### Categorías típicas y su tratamiento

| Tipo de inversión | Tratamiento por defecto | Notas |
|-------------------|--------------------------|-------|
| Horas de Angel desarrollando feature **nueva** en plataforma | **Capitalizable contra I1** | Requiere registro de horas auditable + commits asociados |
| Bug fix o refactor de feature existente | **Gasto** (mantenimiento) | Sección 18.27 — no extiende vida útil |
| Migración técnica que extiende vida útil sustancialmente (ej: pgvector → multi-tenant) | **Capitalizable parcialmente** | Decisión del contador caso a caso |
| Capacitación de equipo en Platzi / Claude (bono de estudio Joven) | **Gasto operativo** | NO crea intangible — aumenta capacidad operativa, no activos separables. Refleja en payroll |
| Registro de marca en SIC | **Capitalizable contra I2** | Incluye honorarios agente + tasas oficiales |
| Renovación anual de dominio | **Capitalizable contra I2** si la marca está activa, sino gasto | Si la marca cae, el dominio se desactiva contablemente |
| Honorarios de asesor de PI por registro DNDA del software | **Capitalizable contra I1** | Construye el control legal del activo |
| Honorarios de contador por implementación de NIIF | **Gasto del período** | Es costo de la operación contable, no del activo |
| Licencias de herramientas exclusivas para desarrollo (CI/CD privado, monitoring dedicado) | **Capitalizable contra I1** | Solo si uso exclusivo en desarrollo, no operación |
| Licencias dual-use (Claude Pro/Max, GitHub Copilot) | **Gasto** | Mixed use — va completo a P&L |
| Inversión en SOPs de Consuelo (plan transferencia conocimiento) | **Gasto** | No crea intangible separable; su valor reside en el going concern |
| Honorarios del valuador independiente para AV1/AV2 | **Capitalizable parcialmente** | La parte atribuible a I1 capitaliza contra I1; la atribuible a I2 contra I2; la parte general (acta SAS) va a constitución de la sociedad |

---

## 8. Avalúos pendientes — bloqueos para constitución SAS

| ID | Avalúo | Plazo target | Owner | Bloquea a |
|----|--------|----------------|-------|------------|
| **AV1** | Plataforma UCR (I1) — triangulación métodos A + B + C | <60 días | Angel + contador + valuador | Constitución SAS, [equipo-roadmap-2026.md cap table](../equipo/equipo-roadmap-2026.md), [08-tecnologico.md Gap 8.2](../08-tecnologico.md) |
| **AV2** | Negocio en marcha de Consuelo — marca + clientela + EBITDA proyectado + inventario + goodwill operativo | <60 días | Consuelo + contador + valuador (idealmente el mismo de AV1) | Constitución SAS, dilución consentida desde 100% pre-SAS |
| **AV3** | Sumas independientes AV1 + AV2 reconciliadas en propuesta de cap table — validación legal y fiscal | <75 días, tras AV1 + AV2 | Angel + abogado SAS | Acta de constitución |

### Recomendación operativa

Considerar contratar **un único valuador independiente** para AV1 + AV2 simultáneamente. Beneficios:

- **Metodología consistente** entre los dos aportes.
- **Neutralidad** en la conversación madre-hijo sobre dilución.
- **Defensibilidad ante terceros** — DIAN si pregunta sobre el aporte en especie, futuros inversionistas si surge oportunidad, eventual auditor externo.

Costo referencia para avalúo profesional intermedio: **$5M – $15M COP**. Es inversión que evita disputas futuras y soporta cifras del cap table durante años.

---

## 9. Conexión con otras dimensiones

- **[01-legal-corporativo.md Gap 1.1](../01-legal-corporativo.md)** — la constitución de la SAS depende de tener AV1, AV2 y AV3 listos. Sin avalúo no hay acta firmable.
- **[03-contable.md Gap 3.3](../03-contable.md)** — la política contable de UCR debe incorporar esta política de intangibles como sección dedicada antes del primer cierre NIIF.
- **[06-comercial.md Gap 6.5](../06-comercial.md)** — el registro de marca en SIC es prerrequisito para reconocer I2 contablemente. Trabajar en paralelo: pre-constitución para que la marca entre al balance de la SAS desde día 1.
- **[08-tecnologico.md Gaps 8.1, 8.2, 8.5](../08-tecnologico.md)** — cambio de licencia, cesión Angel→UCR/SAS, y registro DNDA habilitan el control legal sobre I1 y son condición para reconocerlo como activo de la SAS.
- **[equipo/equipo-roadmap-2026.md §2](../equipo/equipo-roadmap-2026.md)** — el rango 20–35% para Angel sale directamente de AV1 / (AV1 + AV2 + ESOP). Hasta tener avalúo, el rango es referencia conversacional, no número firmable.
- **[estabilizacion_contable/migration-plan-hybrid.md](./migration-plan-hybrid.md)** — los `payroll_in_kind` y `owner_drawings` reclasificados allí son gastos del período, **no** inversiones en intangibles. Distinguir claramente al cierre mensual para no contaminar la capitalización de I1 con compensación de equipo.
- **[estabilizacion_financiera/financial-impact.md](../estabilizacion_financiera/financial-impact.md)** — el impacto del registro de intangibles en el balance modifica indicadores patrimoniales (más activos, más patrimonio si el aporte se hace contra capital social). El modelo financiero debe absorber este cambio una vez ejecutados los avalúos.

---

## 10. Roadmap de implementación

| ID | Acción | Plazo | Owner | Depende de |
|----|--------|-------|-------|-------------|
| **INT1** | Confirmar contador NIIF que valide esta política | <14 días | Angel | — |
| **INT2** | Validar política completa con contador y ajustar criterios por categoría | <30 días | Angel + contador | INT1 |
| **INT3** | Identificar valuador independiente para AV1+AV2 (idealmente mismo profesional) | <30 días | Angel + Consuelo | — |
| **INT4** | Reconstruir cronograma + horas Angel para AV1 método costo histórico | <45 días | Angel | INT2 |
| **INT5** | Solicitar 2–3 cotizaciones de mercado para AV1 método B | <45 días | Angel | — |
| **INT6** | Ejecutar AV1 y AV2 con valuador (triangulación de métodos) | <60 días | Valuador | INT3, INT4, INT5 |
| **INT7** | Reconciliar AV1+AV2 en propuesta de cap table SAS | <75 días | Angel + abogado SAS | INT6 |
| **INT8** | Iniciar registro de inversiones en libro auxiliar (going-forward) | Inmediato | Angel + contable | INT2 |
| **INT9** | Habilitar reconocimiento NIIF en sistema contable (Alegra / Siigo / UCR según decisión) | <90 días | Contador + Angel | INT2, [03-contable.md decisión Alegra/Siigo/UCR](../03-contable.md) |
| **INT10** | Acta de constitución SAS con avalúos respaldados + aplicación Art. 319 ET | Coordinado con [01-legal-corporativo.md](../01-legal-corporativo.md) | Abogado SAS | INT7, [08-tecnologico.md Gap 8.2](../08-tecnologico.md) |

---

## 11. Decisiones pendientes del owner

- [ ] **Contador NIIF a contratar** — pendiente identificar y validar con esta política (cruzado con [03-contable.md acción C1](../03-contable.md)).
- [ ] **Valuador independiente** — ¿uno solo para AV1+AV2, o cada uno por separado? Identificar referencias y solicitar cotización.
- [ ] **Tarifa de mercado para AV1 método A** — rango $80k–$150k/hora. Definir cifra exacta con respaldo (encuestas salariales 2026, benchmarks regionales).
- [ ] **Vida útil de la plataforma UCR (I1)** — 5 años propuesto. Alternativas: 3 años (conservador, refleja velocidad de cambio tecnológico) vs 7 años (optimista, asume estabilidad de stack). Impacto directo en gasto anual de amortización del balance SAS.
- [ ] **Aplicación Art. 319 ET (neutralidad fiscal) al aporte en especie** — validar con contador si conviene estructurar el aporte para diferir renta gravable de Angel.
- [ ] **Política de registro de marca:** ¿registrar a nombre de SAS al constituir, o registrar primero a nombre de Consuelo y luego ceder? Cruzado con [06-comercial.md Gap 6.5](../06-comercial.md).
- [ ] **Vida útil de la marca:** ¿indefinida (sin amortizar, test anual) o 10 años (amortizar lineal)? Implicación NIIF Sección 18.19(c).
- [ ] **Trade secrets — inventario formal** — listar explícitamente las lógicas de negocio diferenciadoras antes de tener visitantes externos al repo (cruzado con [08-tecnologico.md Gap 8.8](../08-tecnologico.md)).
- [ ] **Decisión sobre comunicación del cap table al equipo** — ¿los Jóvenes ven los rangos antes o después del avalúo? Implicación cultural y de expectativas.

---

## 12. Fuentes y referencias

### NIIF y contabilidad
- [NIIF para PYMES 2015 Sección 18](https://www.ifrs.org/issued-standards/ifrs-for-smes-standard/) — Activos intangibles distintos de la plusvalía.
- [Decreto 2420 de 2015](https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=78473) — Marco técnico NIIF Colombia.
- CTCP Concepto 271 de 2018 — Reconocimiento de software desarrollado internamente bajo NIIF PYMES.

### Tributario
- [Estatuto Tributario Art. 74, 74-1](https://estatuto.co/74) — Costo fiscal de intangibles.
- [Art. 142, 143-1 ET](https://estatuto.co/142) — Amortización fiscal de intangibles.
- [Art. 319 ET](https://estatuto.co/319) — Régimen de neutralidad fiscal en aportes a sociedades nacionales.

### Propiedad intelectual
- [Decisión 351 CAN](https://www.comunidadandina.org/StaticFiles/DocOf/DEC351.pdf) — Derecho de autor del software.
- Ley 23 de 1982 + Ley 1915 de 2018 — Derecho de autor colombiano.
- Decisión 486 CAN — Marca, modelo de utilidad.

### Cruzados internos
- [01-legal-corporativo.md](../01-legal-corporativo.md), [03-contable.md](../03-contable.md), [06-comercial.md](../06-comercial.md), [08-tecnologico.md](../08-tecnologico.md)
- [equipo/equipo-roadmap-2026.md](../equipo/equipo-roadmap-2026.md), [estabilizacion_contable/migration-plan-hybrid.md](./migration-plan-hybrid.md), [estabilizacion_contable/patrimony-deep-analysis-2026.md](./patrimony-deep-analysis-2026.md)
