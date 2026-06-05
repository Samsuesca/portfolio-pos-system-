# Equipo UCR — Roadmap de formalización + equity 2026

> **Última actualización:** 2026-05-16
> **Owner:** Angel Suesca
> **Relación con otras dimensiones:** extiende [04-laboral.md](04-laboral.md), instrumenta [migration-plan-hybrid.md](migration-plan-hybrid.md) y se conecta con [financial-impact.md](financial-impact.md).
> **Estado:** v1 propuesta — pendiente validar con asesor laboral y abogado SAS.

---

## 1. Por qué este documento existe

Hoy UCR opera con un equipo de 5 personas pero **no hay separación entre las finanzas del negocio y las finanzas familiares**. Las categorías `mercado`, `comida`, `ocio`, `viáticos` y `préstamos` que aparecen en `expenses` son, en su mayoría, compensación en especie informal a Consuelo, Felipe, Salomé y Santiago: alimentación, arriendo, transporte, gasto personal. El [plan híbrido](migration-plan-hybrid.md) ya los reclasifica contablemente como `payroll_in_kind` u `owner_drawings`, pero esa es solo la mitad del trabajo. La otra mitad es **convertir esa realidad en una nómina formal con contratos, aportes y un plan de carrera**.

Este documento define **cómo** se hace esa transición para cada persona, qué se espera de ellos en habilidades y responsabilidades, y cómo el negocio reconoce el aporte de quienes hoy son talento joven en formación mediante un **camino explícito hacia participación accionaria en la SAS**.

La hipótesis estratégica es: si vamos a abrir segunda sucursal (v3.1, jun 2026) y comercializar el software (v3.2, oct 2026), el equipo actual es el equipo pionero. Su formación no es un costo opcional, es la palanca que determina si el negocio escala con su gente o tiene que reemplazarla.

---

## 2. Cuadro de personas y track asignado

| Persona | Vínculo | Rol actual (informal) | Rol target post-formalización | Track |
|---------|---------|------------------------|--------------------------------|-------|
| Consuelo Ríos | Dueña actual del negocio | Owner, operación, cara visible | CEO + Founder de la SAS | **Owner** |
| Angel Suesca | Hijo, desarrollo del sistema | Tech + dirección estratégica | CTO + cofundador tech | **Cofundador tech** |
| Felipe Suesca | Hermano (de Angel) | Operación general + documentación informal (`documentos/Catalogo`, `documentos/Costos`) | Líder operativo **+ Documentador estructurado del negocio** (rumbo gerente sucursal) | **Joven A** |
| Salomé F | Pareja de Felipe | Operación general | Marketing + experiencia cliente | **Joven B** |
| Santiago Mazo | No familiar (1er año Economía) | Operación general | Analista financiero junior | **Joven C** |

Los **3 tracks distintos** son:

- **Owner** (Consuelo): es la dueña actual del negocio. Pre-SAS opera como Persona Natural y el negocio está a su nombre. Post-SAS aporta el negocio existente (marca, clientes, inventario, goodwill) como capital en especie a cambio de acciones; mantiene control mayoritario. Salario de founder desde día 1 de la SAS. **No entra en el modelo de bitácora de estudio**; su contribución crítica adicional es **transferir conocimiento tácito a Felipe** (mancuerna documentación) para que él lo institucionalice en docs estructurados del repo.
- **Cofundador tech** (Angel): no es dueño hoy. La constitución de la SAS reconoce su aporte técnico (plataforma UCR como activo intangible) y su dirección estratégica con un **grant de equity desde día 1**, sin sujeción al trigger de estabilidad que aplica a los Jóvenes. Sí tiene vesting (estándar founder: 4 años, sin cliff o cliff corto, backdated a la fecha de inicio de contribución técnica). Salario simbólico o cero mientras mantenga su trabajo externo formal; trigger de salario completo si decide dedicarse full-time a UCR.
- **Joven** (Felipe, Salomé, Santiago): salario base + 8h/sem de estudio reconocidas + camino a equity con cliff de 12 meses, vesting 4 años, activación condicionada a estabilidad financiera de la SAS.

### Pattern Consuelo ↔ Felipe — institucionalización del conocimiento

Consuelo tiene el conocimiento tácito del negocio (proveedores, clientes históricos, procesos no escritos, criterios para decisiones que nunca fueron documentadas). Felipe es el **receptor formal** de esa transferencia y el responsable de convertirla en documentación estructurada que viva en el repo, alimentando las tres carpetas de estabilización:

- [`estabilizacion_operacional/`](../estabilizacion_operacional/) — SOPs de tienda, runbooks, manuales de proceso, glosario maestro.
- [`estabilizacion_contable/`](../estabilizacion_contable/) — procedimientos contables, reconciliación bancaria, manejo de intangibles.
- [`estabilizacion_financiera/`](../estabilizacion_financiera/) — procesos del modelo financiero, costeo por producto, importación de costos.

Felipe ya viene trabajando este frente de manera informal: [`documentos/Catalogo/`](../../../../documentos/Catalogo) (organización de la página web, guías de tallas) y [`documentos/Costos/`](../../../../documentos/Costos) (excel, scripts, imágenes). El siguiente paso es **migrarlo al sistema oficial del repo** con plantilla estándar e índice maestro, y a partir de ahí producir SOPs nuevos en sesiones regulares con Consuelo. Su ruta Platzi personalizada (Claude AI ✓, Claude Code 39%, Fundamentos LLMs, Prompt Engineering, Terminal, Fundamentos Ing. Software, Generación de Imágenes con IA) está pensada para que use IA como **copiloto** y produzca documentación de alta calidad en menos tiempo, sin sacrificar la comprensión.

El gobierno de la documentación vive en [`estabilizacion_operacional/procedimientos-inventario-maestro.md`](../estabilizacion_operacional/procedimientos-inventario-maestro.md): Felipe lo mantiene actualizado mensualmente con el estado de cada procedimiento (borrador / en revisión / activo).

**Estado actual (pre-SAS, 2026-05):** Consuelo Ríos posee **100%** del negocio. El RUT, la matrícula mercantil y los activos están a su nombre. Cualquier reparto a partir de aquí es **dilución acordada por ella** a cambio del aporte tangible de Angel (plataforma UCR + dirección estratégica) y de la reserva de ESOP para retener al equipo.

**Cap table indicativo post-SAS** (sumas pendientes de validar con abogado y avalúo formal del negocio + del software):

| Stakeholder | Rango referencia | Origen del equity |
|-------------|------------------|---------------------|
| Consuelo (Owner) | 55-70% | Aporte del negocio existente como capital en especie |
| Angel (CTO) | 20-35% | Aporte de la plataforma tecnológica UCR + dirección estratégica |
| Pool ESOP (Jóvenes) | 10-20% | Reservado del cap table para grants Fase 3 |
| **Total** | **100%** | |

> Los rangos son intencionalmente amplios. La cifra exacta requiere: (a) avalúo del negocio actual (auditoría de activos, clientes, marca, EBITDA proyectado), (b) avalúo del software UCR como activo intangible (líneas de código, tiempo invertido, valor de reemplazo), (c) conversación honesta madre-hijo sobre lo que cada uno considera justo, (d) revisión con abogado SAS.

---

## 3. Modelo de compensación en 3 fases

### Fase 1 — Auxilios formalizados (FASE INTERMEDIA — hoy → constitución SAS)

> **Fase explícitamente transitoria.** Cubre el período entre la situación actual (informalidad) y la constitución de la SAS. Es de **bajo costo y bajo riesgo legal acotado**, pero **no es destino final**: solo es válida mientras se ejecuta el plan de SAS + contratos formales. Si se extiende más de 6 meses sin avance, se acumula riesgo de "contrato realidad" (CST Art. 23).

**Duración estimada:** mayo–septiembre 2026 (mientras se constituye la SAS y se redactan contratos formales).

**Cómo funciona:**

1. Cada persona joven se afilia a EPS, AFP, ARL como **independiente voluntario** (esquema del Decreto 723/2013 ya documentado en [04-laboral §Alternativa puente](04-laboral.md)). UCR le transfiere mensualmente el monto necesario.
2. El gasto deja de imputarse a `mercado`/`comida`/`ocio`. Se categoriza como `auxilios_ss` y `payroll_in_kind` formalizado.
3. Se firma una **carta de intención** (no contrato laboral aún) que documenta: monto mensual transferido, propósito (compensación por horas trabajadas + estudio), no constituye relación laboral subordinada todavía, compromiso bilateral de pasar a contrato formal una vez constituida la SAS.
4. Consuelo entra directo a esquema de founder salary (no aplica esta fase puente).

**Composición del paquete mensual por persona (Joven, cifras 2026 oficiales):**

| Concepto | Monto referencia | Categoría contable |
|----------|------------------|---------------------|
| Salario base (40h/sem operación) | $1,750,905 (1 SMMLV 2026) | `payroll_in_kind` (sin contrato aún) |
| Bono de estudio (8h/sem, condicionado a evidencia) | $300,000 | `payroll_in_kind` → `training_allowance` |
| Auxilio alimentación (acuerdo informal) | $200,000 | `payroll_in_kind` → `food_allowance` |
| Auxilio transporte (referencia legal post-contrato) | $249,095 | `payroll_in_kind` → `transport_allowance` |
| Aporte SS como independiente — IBC 1 SMMLV — 28.5% (EPS 12.5% + AFP 16% + ARL 0.522%) | $499,008 | `auxilios_ss` |
| **Bruto mensual por persona — Fase 1** | **~$2,999,008** (~$3.0M) | |

**Total Fase 1, 3 Jóvenes:** ~$9.0M/mes.

> Los montos exactos por persona se definen en cada bitácora individual ([bitacoras/](bitacoras/)) y deben confirmarse con el owner antes de aplicar.

### Fase 2 — Contrato laboral formal en la SAS (post-constitución)

**Duración estimada:** desde constitución SAS (target ~sep–oct 2026) hasta cumplir el primer año de estabilidad financiera (trigger Fase 3).

**Cómo funciona:**

1. SAS asume el rol de empleador. Sustitución patronal desde PN (no es automática; requiere proceso con asesor laboral).
2. Cada persona firma **contrato individual** (término fijo inicial 6 meses, renovable a indefinido tras periodo de prueba), con perfil del cargo derivado de su bitácora.
3. Nómina electrónica DIAN activa (gap LAB5 en 04-laboral) con proveedor (Alegra Nómina, Siigo, Nominapp).
4. Prestaciones legales completas: cesantías (8.33%), intereses (12% anual s/cesantías), prima (8.33%), vacaciones (4.17%), dotación trimestral (Ley 11/1984 para trabajadores <2 SMMLV).
5. SG-SST básico operativo (gap LAB6).
6. Bono de estudio se mantiene atado a evidencia mensual.

**Cost-to-company por empleado SMMLV 2026 en una SAS microempresa (cifras validadas):**

La SAS es persona jurídica contribuyente de renta, por lo cual aplica la **exoneración del Art. 114-1 ET** (introducida por Ley 1607/2012, recogida por Ley 1819/2016): para empleados con IBC < 10 SMMLV, **exenta el aporte a salud empleador (8.5%) + SENA (2%) + ICBF (3%)**. La Caja de Compensación (4%) NO está exenta — siempre se paga.

| Bloque | Concepto | Cálculo | Mensual (COP) |
|--------|----------|---------|---------------|
| **Devengado del trabajador** | | | |
| | Salario SMMLV 2026 | Decreto 0159/2026 | $1,750,905 |
| | Auxilio transporte | Decreto 1470/2025 | $249,095 |
| | **Subtotal devengado** | | **$2,000,000** |
| **Aportes patronales (SAS persona jurídica)** | | | |
| | Salud empleador 8.5% | **EXENTO** Art. 114-1 ET (<10 SMMLV) | $0 |
| | Pensión empleador 12% | 12% × $1,750,905 | $210,109 |
| | ARL Clase I 0.522% | 0.522% × $1,750,905 | $9,140 |
| | Caja de Compensación 4% | 4% × $1,750,905 (NO exento) | $70,036 |
| | ICBF 3% | **EXENTO** Art. 114-1 ET | $0 |
| | SENA 2% | **EXENTO** Art. 114-1 ET | $0 |
| | **Subtotal aportes patronales** | 16.522% del IBC | **$289,285** |
| **Prestaciones sociales (provisión mensual)** | | | |
| | Cesantías 8.33% | 8.33% × $2,000,000 | $166,600 |
| | Intereses sobre cesantías 12% anual | ~1% × cesantías acumuladas / 12 | $1,667 |
| | Prima de servicios 8.33% | 8.33% × $2,000,000 | $166,600 |
| | Vacaciones 4.17% | 4.17% × $1,750,905 | $73,013 |
| | **Subtotal prestaciones** | | **$407,880** |
| **Otros costos asociados** | | | |
| | Dotación trimestral (Ley 11/1984, <2 SMMLV) | 3 mudas/año × ~$200k / 12 | $50,000 |
| | Nómina electrónica DIAN (proveedor) | Tarifa típica | $40,000 |
| | **Subtotal otros** | | **$90,000** |
| | | | |
| | **TOTAL COST-TO-COMPANY** | | **$2,787,165** |

> Cifra coincidente con el rango ~$2.8M/mes reportado en fuentes públicas para 2026 (variaciones por dotación más alta o cargas no incluidas suben a $2.82M). Fuentes citadas al final del documento.

**Bono de estudio se mantiene a $300k/mes** como compensación extralegal condicionada — no entra en IBC ni genera aportes adicionales si se documenta como bonificación no salarial (Art. 128 CST), pero requiere cláusula expresa en el contrato. A confirmar con asesor laboral.

**Total mensual cost-to-company Fase 2 por persona (Joven):**

- Cost-to-company SMMLV formal: $2,787,165
- Bono de estudio extralegal: $300,000
- **Total: ~$3,087,165 (~$3.1M) por persona**.

**Total Fase 2, 3 Jóvenes:** ~$9.3M/mes.

### Comparativo Fase 1 vs Fase 2 (por persona Joven)

| Concepto | Fase 1 (intermedia) | Fase 2 (post-SAS) | Δ |
|----------|----------------------|---------------------|----|
| Compensación al trabajador (devengado + bono + auxilios) | $2,500,000 | $2,300,000 (devengado + bono) | -$200k |
| Aportes SS y patronales | $499,008 (independiente) | $289,285 (patronal con exoneración) | -$210k |
| Prestaciones sociales | $0 | $407,880 | +$408k |
| Dotación + nómina electrónica | $0 | $90,000 | +$90k |
| **Cost-to-company UCR** | **~$3,000,000** | **~$3,087,165** | **+$87k (~3%)** |
| Riesgo legal del modelo | Medio (riesgo "contrato realidad") | Bajo | -- |
| Cobertura del trabajador | Parcial (SS sí, prestaciones no) | Completa | -- |

**Hallazgo clave:** la diferencia de costo entre Fase 1 (intermedia) y Fase 2 (formal) es marginal (~3%). La razón es la **exoneración Art. 114-1 ET** que aplica en SAS pero no para independiente. **No hay ahorro real** en quedarse en Fase 1 más allá del corto plazo; sí hay riesgo creciente. Esto refuerza que la SAS debe constituirse cuanto antes.

### Fase 3 — Activación de equity (post-estabilidad SAS)

**Trigger de activación:** la SAS cumple **3 meses consecutivos** con todos los siguientes:

- Runway (caja / gasto promedio mensual) > 6 meses.
- P&L mensual positivo (margen neto > 0%).
- Todas las obligaciones DIAN, UGPP y municipales al día.
- Estados financieros firmados por contador del trimestre anterior.

Mientras no se cumpla el trigger, **no se otorga equity** — solo se mantiene la promesa documentada y los meses cuentan retroactivamente para el cliff una vez activado.

**Estructura del plan (framework, sin números — owner los completa con abogado):**

| Parámetro | Definición |
|-----------|-----------|
| Pool reservado en cap table | `[OWNER: definir]` — referencia ESOP típica 10-20% |
| Grant individual por persona | `[OWNER: definir por bitácora]` — referencia: Felipe ≥ Salomé ≥ Santiago |
| Cliff | 12 meses desde la fecha de activación (no desde fecha de ingreso). |
| Vesting | Lineal 4 años (25% al cliff + 1/48 mensual los 36 restantes). |
| Aceleración | Single trigger: si la SAS se vende, vesting acelerado al 100%. |
| Recompra (good leaver) | SAS puede recomprar shares vested al valor justo si la persona se retira amigablemente. |
| Pérdida (bad leaver) | Despido con justa causa o renuncia sin transición → unvested se cancela, vested se recompra a valor nominal. |
| Instrumento legal | Inicialmente carta de promesa (option agreement). Conversión a phantom shares o emisión real de acciones tras 1er ciclo completo. |

Esta estructura sigue el modelo de **employee stock option pool (ESOP)** adaptado a SAS colombiana. Requiere validación legal: en Colombia los planes de equity para empleados no tienen el mismo tratamiento fiscal que en EE.UU.; el abogado debe estructurarlo para minimizar impuestos al trabajador y al empleador.

---

## 4. Modelo de tiempo: 40 horas operación + 8 horas estudio

Cada Joven dedica:

- **40 h/semana** a operación de UCR (turnos de tienda, atención cliente, gestión de inventario, soporte a Consuelo, tareas asignadas según su bitácora).
- **8 h/semana** reconocidas como **tiempo formativo** — equivalente al "20% time" de Google. Pagadas vía bono de estudio condicionado a evidencia.

**Reglas del tiempo de estudio:**

1. Es tiempo **dentro o fuera del horario de tienda**, a acuerdo con cada persona. Lo importante es que se registre y se evidencie.
2. La inversión que ya hizo el negocio en **Platzi + Claude (Pro/Max)** es la herramienta principal. Otras (YouTube, Coursera, libros) son complementarias.
3. **Evidencia mensual mínima** para que el bono se pague íntegro:
   - 3 cursos Platzi completados con certificado (o 50% de avance en largos), **alineado a la ruta de su bitácora**.
   - 1 mini-proyecto aplicado al negocio (no teórico): aplicar lo aprendido a UCR. Documentado en la bitácora con commit, screenshot, documento o métrica.
   - 1 sesión de 30 min de revisión con Angel (puede ser asincrónica vía mensaje + grabación).
4. **Si no hay evidencia**, el bono se prorrate ese mes. No es castigo, es contrato: las horas se pagan cuando ocurren.
5. **Las 8 horas no se pueden migrar a operación.** Si la persona no tiene tiempo para estudiar, el problema es operativo (carga de trabajo) y se ajusta — no se compensa con más operación.

---

## 5. Bitácoras individuales

Cada persona tiene su archivo vivo en [bitacoras/](bitacoras/). Estructura:

1. **Perfil base** — fortalezas actuales, gaps identificados, motivaciones declaradas.
2. **Rol target** — descripción del cargo al que apunta su carrera dentro de UCR.
3. **Ruta de habilidades** — 4-6 áreas con sub-habilidades y nivel target a 12 meses (escala 1-5).
4. **Plan de estudio** — secuencia de cursos Platzi + recursos complementarios para los próximos 6 meses.
5. **Proyectos aplicados** — backlog de mini-proyectos para aplicar conocimiento al negocio.
6. **Compensación propuesta** — paquete mensual concreto en Fase 1, Fase 2, y promesa de equity en Fase 3.
7. **Registro mensual** — tabla viva donde se anota cada mes: cursos completados, proyectos entregados, bono pagado, ajustes acordados.
8. **Revisión semestral** — evaluación formal: nivel alcanzado vs target, decisión sobre ajuste salarial, activación o no de equity.

Las 5 bitácoras existentes:

- [consuelo.md](bitacoras/consuelo.md) — Owner / Founder. 100% del negocio pre-SAS; salario founder + transferencia de conocimiento.
- [angel.md](bitacoras/angel.md) — Cofundador tech / CTO. Grant de equity desde día 1 SAS; salario simbólico mientras mantenga trabajo externo.
- [felipe.md](bitacoras/felipe.md) — Líder operativo + documentador estructurado del negocio. Ruta Platzi de IA aplicada (Claude AI ✓, Claude Code 39%, LLMs, prompts, terminal, ing. software, generación de imágenes). Mancuerna con Consuelo: ella transfiere conocimiento, él lo institucionaliza en `estabilizacion_*`.
- [salome.md](bitacoras/salome.md) — Marketing + experiencia cliente. Ruta Platzi de 11 cursos diseñada por Angel (marketing digital, branding emocional, posicionamiento, IA aplicada a marketing/CX/imágenes, Gemini, diseño).
- [santiago.md](bitacoras/santiago.md) — Analista financiero junior.

Las bitácoras de Consuelo y Angel siguen un formato más reducido (no incluyen radar de habilidades ni plan de cursos Platzi): cubren rol, responsabilidades, compensación y registro de cumplimiento. Las tres bitácoras Joven sí incluyen el formato completo de 8 secciones.

---

## 6. Conexión con el plan financiero

Este modelo modifica significativamente los costos mensuales proyectados de UCR respecto a la estimación inicial de [financial-impact.md](financial-impact.md) (que asumía SMMLV 2025 = $1.42M y aportes ~$520k/empleado/mes con prestaciones). Las cifras 2026 reales son:

**Impacto mensual total Joven (3 personas, cifras 2026 validadas):**

| Fase | Cost-to-company por persona | Total 3 personas | Conexión P&L |
|------|------------------------------|------------------|---------------|
| Fase 1 (intermedia, hoy → SAS) | ~$3,000,000 | **~$9.0M/mes** | `payroll_in_kind` + `auxilios_ss` |
| Fase 2 (post-SAS, contrato formal) | ~$3,087,000 | **~$9.3M/mes** | `payroll` consolidado |
| Fase 3 (post-trigger) | + grant equity (no cash) | + dilución cap table | No es P&L, es balance |

Consuelo se costea aparte (founder salary): rango referencia $3.5M – $5.0M/mes según paquete acordado. Se documenta en su bitácora.

**Total nómina proyectada Fase 2** (Consuelo founder + 3 Jóvenes con bono de estudio): **~$12.8M – $14.3M/mes**. Esto requiere actualizar la asunción `payroll_monthly` del `ProjectionService` (hoy estima $10-15M/mes basado en SMMLV 2025 — está infraestimada).

**Recomendación:** revisar [financial-impact.md](financial-impact.md) y actualizar:
- Línea "Aportes patronales SS - 5 trabajadores formalizados (estimado SMMLV)" — el rango $1.6M-$2.6M/mes corresponde a 2025. Para 2026 con exoneración Art. 114-1 ET aplicada: ~$870k/mes (3 jóvenes × $289k) si SAS, ~$1.5M/mes (3 jóvenes × $499k) si todavía independientes.
- Línea "Renovación CC anual" — micromempresa Cámara Medellín tarifa reducida primer año post-Ley 590; verificar.

---

## 7. Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| Persona joven se va antes del cliff y la inversión en formación se pierde | Aceptarlo como costo. El cliff de 12m existe para alinear incentivos sin retener forzadamente. Documentar lo que aprenden en knowledge base interna mitiga la pérdida operativa. |
| Bono de estudio se convierte en salario disfrazado sin evidencia real | Evidencia mensual obligatoria + revisión 1-1 trimestral. Si 2 meses seguidos sin evidencia, se conversa y se ajusta el plan (no se mantiene el bono indefinidamente). |
| Felipe (hermano) + Salomé (cuñada) genera percepción de favoritismo familiar | Bitácora pública dentro del equipo + criterios objetivos de evaluación. Santi tiene exactamente el mismo framework, mismo derecho a equity. |
| Promesa de equity sin trigger nunca se cumple → frustración | El trigger debe ser realista. Si pasan 24 meses sin estabilidad SAS, owner re-negocia: o se da equity sin trigger, o se compensa con bono extraordinario, o se reconoce que la apuesta no funcionó. No se deja indefinido. |
| Asimetría de información: ellos no entienden qué es equity y cómo se valoriza | Sesión formativa explícita (parte de la bitácora) cuando se active la Fase 3. Idealmente con asesor externo neutral. |
| Contrato realidad: Felipe/Salomé/Santi demandan retroactivamente prestaciones desde 2024-2025 | La carta de intención de Fase 1 mitiga parcialmente. El plan UGPP voluntario (LAB4) cierra el riesgo en lo retroactivo. Conversación honesta con cada uno antes de firmar Fase 2. |
| Consuelo no se siente cómoda diluyendo su 100% pre-SAS al rango propuesto | La dilución NO es obligatoria. Conversación 1-1 (idealmente con asesor neutral) para que ella defina el % que considera justo. Si decide mantenerse en 80% y darle menos a Angel + menos al pool, es su derecho como dueña. El framework propone rangos; ella firma los números. |
| Angel y Consuelo no logran acordar el split madre-hijo | Asesor externo neutral (no familiar, no abogado del padre, idealmente alguien con experiencia en sucesiones empresariales) actúa de facilitador. Si no hay acuerdo, se pospone la constitución SAS hasta lograrlo — no se fuerza. |

---

## 8. Roadmap de ejecución

| ID | Acción | Plazo | Owner | Bloquea a |
|----|--------|-------|-------|------------|
| EQ1 | Conversación 1-1 con cada persona, presentar este documento y la bitácora propuesta | <14 días | Angel | EQ2 |
| EQ2 | Cada persona firma carta de intención Fase 1 (acepta paquete + bitácora + horas) | <30 días | Angel + 4 personas | EQ3 |
| EQ3 | Afiliación a EPS+AFP+ARL como independiente (Felipe, Salomé, Santi) | <30 días | Cada persona, costo asumido por UCR | LAB2 |
| EQ4 | Migrar gastos históricos `mercado`/`comida`/`ocio` aplicables a `payroll_in_kind`/`auxilios_ss` | <45 días | Angel | Cierre contable junio |
| EQ5 | Constitución SAS con cláusulas estatutarias que prevén pool ESOP | Antes de jun 2026 | Angel + abogado | LAB3, EQ6 |
| EQ6 | Firma de contratos laborales formales con cada Joven | <30 días post-SAS | Angel + asesor laboral | Fin de Fase 1 |
| EQ7 | Implementación nómina electrónica DIAN | <60 días post-SAS | Angel + proveedor | LAB5 |
| EQ8 | Primera revisión semestral del equipo (evaluar Fase 2 → trigger Fase 3) | 6 meses post-Fase 2 | Angel | Activación equity |
| EQ9 | Si trigger cumplido: firma de option agreements (Fase 3) | 12+ meses | Angel + abogado SAS | — |
| EQ10 | **Presentación formal al equipo** — v3 + roadmap + requerimientos. Disparada por deploy completo v3 + 1 semana estable. Ver [presentacion-equipo-v3-launch.md](presentacion-equipo-v3-launch.md). | Post-deploy v3 estable | Angel | EQ2 (cartas Fase 1 firmadas idealmente en esta reunión) |

---

## 9. Decisiones pendientes del owner

- [ ] **Salario Consuelo (Owner)**: rango target $3.5M–$5.0M/mes. Definir el monto exacto y si incluye participación en utilidades adicional al equity mayoritario que ya tiene.
- [ ] **Equity post-SAS de Consuelo (Owner)**: rango referencia 55-70%. La dilución desde 100% pre-SAS hacia este rango debe ser **decisión explícita y consentida** de ella, idealmente acompañada por asesor neutral.
- [ ] **Equity post-SAS de Angel (CTO)**: rango referencia 20-35%. Definir grant inicial + estructura de vesting (4 años, cliff opcional, posible backdating al inicio de la contribución técnica).
- [ ] **% del pool ESOP** en cap table de la SAS (referencia 10-20%, carve-out al constituirla).
- [ ] **Grants individuales** Year 1 del pool ESOP para Felipe, Salomé, Santiago.
- [ ] **Avalúo del negocio actual** (input para definir el % de Consuelo) y **avalúo de la plataforma UCR** (input para definir el % de Angel). Idealmente con tercero neutral.
- [ ] **Bono de estudio mensual exacto**: rango propuesto $200k-$400k por persona. Decidir si es uniforme o varía por seniority/rol.
- [ ] **Carta de intención Fase 1**: redactar plantilla (puede pedirse al asesor laboral o usar borrador con Claude y validar). Insumo crítico para EQ10.
- [ ] **Diseño de la presentación al equipo (EQ10)**: contenido del Bloque 1 (cambios de v3), formato (presencial 90 min recomendado), bitácoras impresas, agenda. Ver [presentacion-equipo-v3-launch.md](presentacion-equipo-v3-launch.md) §4 para checklist de artefactos previos.
- [ ] **Quién es el asesor laboral y el abogado SAS**: identificar antes de iniciar EQ5.
- [ ] **Política para los 2 nuevos empleados de la segunda sucursal**: ¿entran al mismo framework Joven? ¿O contrato fijo sin equity? Definir antes de jun 2026.

---

## 10. Fuentes y normativa de referencia

### Cifras 2026 oficiales
- [Decreto 0159 de 2026](https://dapre.presidencia.gov.co/normativa/normativa/DECRETO%20No.%200159%20DEL%2019%20DE%20FEBRERO%20DE%202026.pdf) — Salario mínimo mensual 2026: **$1,750,905** (transitorio, en marco de proceso de nulidad). Confirmado por Decretos 1469 y 1470 originales de diciembre 2025.
- [Decreto 1470 de 2025 (Mintrabajo)](https://crconsultorescolombia.com/fijacion-del-auxilio-de-transporte-para-el-ano-2026-ministerio-del-trabajo-decreto-1470.php) — Auxilio de transporte 2026: **$249,095/mes**.
- [Resumen normativo 2026 — Holland & Knight](https://www.hklaw.com/en/insights/publications/2025/12/colombia-decreta-aumento-del-salario-minimo-y-auxilio-de-transporte) — Análisis técnico de incrementos 2026.

### Costo total empleador
- [El Colombiano — Costo SMMLV 2026 para empresas](https://www.elcolombiano.com/negocios/alza-salario-minimo-2026-colombia-costo-real-empresa-trabajador-ED32023997) — Cálculo independiente: ~$2,820,151/mes cost-to-company.
- [Mesfix — ¿Cuánto cuesta un empleado con SMMLV en 2026?](https://mesfix.com/blog/noticias-finanzas/salario-minimo-en-2026-en-colombia-cuanto-cuesta-a-las-empresas/) — Desglose de aportes y prestaciones 2026.
- [Sinergy Lowells — Salario mínimo 2026, costo con prestaciones](https://www.sinergylowells.com/post/salario-m%C3%ADnimo-2026-cu%C3%A1nto-cuesta-un-trabajador-con-prestaciones) — Confirmación del 68% de sobrecosto adicional al salario nominal.

### Exoneración de aportes parafiscales y salud
- [Art. 114-1 Estatuto Tributario](https://estatuto.co/114-1) — Exoneración a personas jurídicas contribuyentes de renta y personas naturales con ≥2 empleados, para trabajadores con IBC < 10 SMMLV: exentos del 8.5% salud empleador + 2% SENA + 3% ICBF. Caja Compensación 4% NO está exenta.
- [Ley 1607 de 2012 — Gestor Normativo Función Pública](https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=51040) — Norma original que introdujo la exoneración (luego recogida en Art. 114-1 ET por Ley 1819/2016).
- [Pluxee — ¿Cuándo aplica la exoneración?](https://www.pluxee.co/blog/exoneracion-aportes-parafiscales/) — Aplicación práctica para microempresas.

### Aportes como independiente (Fase 1)
- [04-laboral.md §Alternativa puente](04-laboral.md) — Documentación interna del esquema Decreto 723/2013 + Decreto 1563/2016, costos por persona/mes ~$406k (recalculado 2026 = ~$499k para 1 SMMLV).

### Prestaciones sociales y dotación
- CST Arts. 249 (cesantías), 250 (intereses cesantías 12%), 306 (prima de servicios), 186 (vacaciones).
- Ley 11 de 1984 — Dotación trimestral para empleados con remuneración < 2 SMMLV.
- Decreto 1072 de 2015 — SG-SST obligatorio.
