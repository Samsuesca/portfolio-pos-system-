# Dimensión 2 — Tributario

> **Última actualización:** 2026-05-04
> **Owner:** Carmen Consuelo Ríos Cartagena (titular, NIT 42779422-1) + Angel Suesca (operación) + (pendiente) Contador
> **Criticidad global:** 🔴 CRÍTICA
> **% Formalización estimado:** 15%
> **Fuente documental:** [RUT_2025.pdf](../../../documentos/Legal/RUT_2025.pdf) (formulario 141191028901, generado 2025-09-18)

---

## Resumen ejecutivo

Esta es la dimensión **más urgente** del proceso de formalización. Hay dos riesgos materiales en curso:
1. **Sin facturación electrónica** desde el inicio del negocio (sanciones por evento).
2. **Sin declaraciones presentadas** (sanciones de extemporaneidad acumuladas + intereses moratorios).

Ambas son **fixables** con presentación voluntaria y reducción de sanciones (Art. 640 ET), pero cada día que pasa aumenta el costo.

> **NOTA del owner:** por volumen es poco probable que las sanciones materiales sean significativas, pero la **facturación electrónica y la contabilidad formal son features urgentes** del sistema y del negocio (independiente del riesgo sancionatorio).

**Hallazgo 2026-05-04 (RUT verificado):** la titular **NO está en Régimen Simple** sino en **Régimen Ordinario** (responsabilidad 05) y es **No responsable de IVA** (responsabilidad 49). Esto cambia el alcance del plan: no aplica declaración SIMPLE bimestral ni IVA, pero sí declaración anual de renta persona natural (formulario 210), retefuente cuando aplique, ICA municipal en Bello, e información exógena si supera topes. La eventual migración a S.A.S (ver `01-legal-corporativo.md`) cambiaría nuevamente el régimen.

---

## Estado actual

### Régimen tributario (CONFIRMADO por RUT 2025)

| Campo RUT | Valor | Implicación |
|-----------|-------|-------------|
| Responsabilidad **05** | Impuesto de renta y complementarios — **régimen ordinario** | Declaración anual de renta persona natural (formulario 210). Tarifas progresivas Art. 241 ET sobre cédula general. |
| Responsabilidad **49** | **No responsable de IVA** | No factura ni declara IVA. **Riesgo:** si supera topes Art. 437 par. 3 ET (ingresos ≥ 3.500 UVT/año, contratos ≥ 3.500 UVT, etc.), debe pasar a responsable de IVA — verificar con ingresos reales del negocio. |
| Sin responsabilidad 04 | No está en Régimen Simple | Plazo de opción al SIMPLE para 2026 venció el 31-ene-2026 (Art. 909 ET). **Próxima ventana: noviembre 2026 para vigencia 2027.** |
| Dirección seccional | **Impuestos de Medellín** (código 11) | Trámites DIAN se gestionan ante esta seccional. |
| Domicilio fiscal | **Bello (Antioquia)** | ICA municipal aplica en **Bello**, no en Medellín. |
| Inicio actividad CIIU 4771 | **2025-07-01** | Fecha cierta desde la cual hay obligaciones formales (renta 2025 con corte 31-dic-2025; declaración con plazo en 2026 según calendario tributario por dos últimos dígitos NIT 22). |

> **Nota sobre migración a S.A.S:** si se constituye S.A.S (ver Gap 1.1), el régimen cambia automáticamente a **renta corporativa** (tarifa 35% 2026) y la sociedad puede o no ser responsable de IVA según actividad. Evaluar costo-beneficio con contador antes de constituir.

### Facturación electrónica
- **NO IMPLEMENTADA**.
- Sistema UCR emite recibos internos sin valor fiscal DIAN.
- Sin proveedor tecnológico contratado.
- Sin resolución de numeración solicitada.
- Aplica obligación: el régimen ordinario exige FE por Art. 616-1 ET aun siendo No responsable de IVA, salvo que la titular califique como **no obligada a facturar** (Art. 1.6.1.4.3 DUR 1625/2016 — personas naturales con ingresos < topes y otros requisitos). **Verificar con contador** si aplica esa excepción dada la realidad de ingresos del negocio. Aun así, los clientes B2B (caso restaurante en Gap 2.0) exigen FE para deducir el costo, así que la decisión de implementar FE no depende solo de la obligación legal sino de la viabilidad comercial.

### Declaraciones
- **NO PRESENTADAS** (al día de hoy, 2026-05-04).
- Período en riesgo: desde **2025-07-01** (inicio CIIU 4771 según RUT) hasta hoy.
- Plazos vencidos / próximos:
  - **Declaración de renta 2025** (formulario 210): vence en 2026 según calendario DIAN por dos últimos dígitos NIT (NIT termina en 22 → grupo intermedio, plazos típicamente entre agosto y septiembre 2026; **aún en plazo si se actúa en mayo**, no extemporánea todavía).
  - **Retefuente mensual** (formulario 350): solo si la titular es agente retenedor — verificar; persona natural no comerciante no lo es por defecto.
  - **ICA Bello**: anual, con anticipos según volumen. Plazos vencidos no cuantificados.
  - **Información exógena DIAN** (Resolución anual): aplica si superó topes 2024 — para 2025 los topes se evalúan con corte 31-dic-2025.

> **Buena noticia:** dado que el inicio formal de actividad fue 2025-07-01 y la declaración de renta 2025 aún no vence en su plazo ordinario, **es posible llegar al cierre fiscal 2025 sin extemporaneidad** si se actúa antes del vencimiento del plazo asignado por NIT. Esto reduce drásticamente el cuantum de sanciones del Gap 2.2.

### Retenciones
- Wompi practica retenciones por cada transacción y abona neto al día hábil siguiente.
- Certificados de retención de Wompi no recolectados ni acreditados.
- Estado autorretenedor: **no aplica** por defecto a persona natural no comerciante en régimen ordinario; requiere acto administrativo DIAN específico para serlo.

### ICA
- Estado RIT **municipio de Bello**: desconocido. Verificar inscripción.
- Al estar en régimen ordinario (no Simple), ICA se declara y paga directamente al municipio de Bello según calendario local. Si abre segundo local en otro municipio, aplica ICA dual (Bello + nuevo municipio) con prorrateo de ingresos.

---

## Gaps identificados

### Gap 2.0 — Cotización B2B en curso convierte FE en bloqueante inmediato 🔴 URGENTE

**Contexto añadido 2026-05-02:** existe cotización activa con restaurante por ~$9M COP. Sin facturación electrónica DIAN, este contrato:
- Es probable que se pierda (cliente formal no acepta recibos internos).
- Si se cierra sin FE, el restaurante no puede deducir el costo y exigirá descuento equivalente.
- Genera riesgo solidario en parafiscales (Art. 34 Ley 100) si no hay certificado de aportes.

**Acción urgente:** acelerar el plan de FE de "T5–T7 en 90 días" a **30 días máximo**, antes de cerrar el contrato del restaurante.

**Camino crítico (priorizar):**
1. Día 1-3: Seleccionar proveedor (Alegra recomendado por velocidad de integración).
2. Día 3-7: Solicitar resolución numeración DIAN.
3. Día 7-21: Integrar API con backend UCR (servicio nuevo `electronic_invoicing.py` o similar).
4. Día 21-30: Pruebas en ambiente DIAN de habilitación + paso a producción.

> **Riesgo del plazo agresivo:** si el contrato del restaurante cierra antes del día 30, hay alternativa puente: **un contador profesional puede emitir factura electrónica desde su software** (Alegra del contador) para esa primera venta como excepción mientras UCR completa su propia integración. Costo: el contador puede cobrar $50k–$200k por la factura.

---

### Gap 2.1 — Facturación electrónica no implementada 🔴

**Marco legal:**
- Resolución DIAN 042 de 2020 y modificatorias.
- Art. 616-1 ET: obligatoriedad para todos los responsables, incluido régimen simple.
- Art. 652-1 ET: sanción por no facturar.

**Riesgo cuantificado:**
- Sanción base: 1% del valor no facturado por evento.
- Tope: 950 UVT (~$45M COP en 2026) por evento.
- Si DIAN audita ventas históricas (cruce con Wompi, bancos, contratos), la sanción puede aplicarse a cada venta no facturada.

**Acciones:**
1. **Seleccionar proveedor tecnológico autorizado.** Comparativa preliminar:

   | Proveedor | Costo mensual | API REST | Ideal para |
   |-----------|---------------|----------|------------|
   | **Alegra** | ~$50k–$120k | Sí, robusta | Pequeños comercios, rápida integración |
   | **Siigo** | ~$100k–$300k | Sí | Empresas medianas con contador interno |
   | **Factus** | ~$30k–$80k | Sí | Económico, foco FE pura |
   | **ColFactura** | ~$50k–$150k | Sí | Estable, larga trayectoria |
   | **The Factory HKA** | ~$80k–$200k | Sí | Volúmenes altos |

2. **Solicitar resolución de numeración DIAN** (consecutivos autorizados para FE y POS electrónico).
3. **Integrar el proveedor con el backend UCR.** Trabajo técnico estimado:
   - Cliente de API en `backend/app/services/electronic_invoicing.py`.
   - Webhook de validación DIAN.
   - Mapeo de datos UCR (Sale, SaleItem, Client) → estructura UBL del proveedor.
   - Almacenamiento de CUFE (Código Único de Factura Electrónica) y XML firmado.
   - Reenvío automático en caso de fallo de transmisión.
   - Estimación: 2-3 semanas de desarrollo.

4. **Plan de contingencia para ventas históricas:** decidir con contador si se reportan retroactivamente o se inicia FE desde fecha cero (reduce sanción si se acompaña de presentación voluntaria).

---

### Gap 2.2 — Declaraciones no presentadas 🔴

**Marco legal aplicable (Régimen Ordinario, persona natural, No responsable de IVA — confirmado por RUT 2025):**
- **Renta**: declaración anual persona natural, **formulario 210** (cédulas), plazo según calendario DIAN por dos últimos dígitos NIT. Para NIT 42779422 → últimos dos dígitos **22** → plazo típico agosto/septiembre 2026 para vigencia 2025.
- **IVA**: **NO aplica** mientras se mantenga responsabilidad 49 (No responsable). Vigilar topes Art. 437 par. 3 ET para no perder esa calidad.
- **Retefuente** (formulario 350): solo si la titular adquiere calidad de agente retenedor (Art. 368 ET). Persona natural no comerciante no lo es por defecto; persona natural comerciante con patrimonio o ingresos ≥ 30.000 UVT del año anterior **sí** lo es. Verificar con contador.
- **ICA Bello**: declaración anual + anticipos. Calendario municipal de Bello.
- **Información exógena DIAN** (Resolución 162 de 2023 y modificatorias): aplica si superó topes en el año gravable anterior.

**Riesgo cuantificado:**
- Sanción extemporaneidad (Art. 641 ET): 5% del impuesto a cargo por mes o fracción de retraso. Mínimo 10 UVT (~$470k 2026).
- Intereses moratorios (Art. 635 ET): tasa de usura mensual divulgada por Superfinanciera.
- Sanción por no declarar (Art. 643 ET): 20% del valor de los ingresos brutos, si DIAN profiere emplazamiento.
- Posible cierre del establecimiento (Art. 657 ET) por reincidencia.

**Atenuante disponible — Beneficio Art. 640 ET:**
- Reducción del 50% de la sanción si se presenta voluntariamente antes del emplazamiento, no se ha pagado nada y se cumplen requisitos.
- Reducción del 75% si se acoge a los términos especiales y paga el impuesto + sanción reducida.

**Acciones:**
1. **Contratar contador público colegiado.** Costo referencial mensual: $300k–$1M COP según volumen y complejidad. Para arranque (regularización + declaración renta 2025) podría requerir un costo adicional inicial de $1M–$3M.
2. **Reconstruir libro de ingresos y gastos** desde **2025-07-01** (fecha de inicio CIIU según RUT). El sistema UCR + extractos bancarios + Wompi da la data.
3. ~~Determinar régimen tributario correcto~~ → **RESUELTO**: régimen ordinario confirmado por RUT (responsabilidad 05). No requiere acción adicional salvo evaluar opción a SIMPLE para 2027 (ventana noviembre 2026).
4. **Presentar declaración de renta 2025 dentro del plazo ordinario** (agosto/septiembre 2026 según NIT). Esto evita extemporaneidad y no requiere sanción reducida.
5. **Verificar y regularizar ICA Bello** (años 2025 y anteriores si los hubiera).
6. **Determinar si aplica información exógena 2025** según topes vigentes.
7. **Cuantificar deuda tributaria total** (renta + ICA) y planear caja para el pago.

---

### Gap 2.3 — Régimen tributario ✅ RESUELTO (2026-05-04)

**Resultado de la consulta de RUT** (formulario 141191028901, generado 2025-09-18):

| Atributo | Valor |
|----------|-------|
| Estado RUT | Activo |
| Responsabilidades | 05 (renta ordinario), 49 (no responsable IVA) |
| CIIU principal | 4771 desde 2025-07-01 |
| CIIU secundario | Ninguno |
| Establecimientos | No registrados |
| Dirección seccional | Impuestos de Medellín |

**Conclusión:** la titular está en **Régimen Ordinario** y **No responsable de IVA**. No está acogida al SIMPLE.

**Decisión pendiente — Opción al SIMPLE para 2027:**
- El plazo para optar al SIMPLE 2026 venció el 31-ene-2026 (Art. 909 ET).
- Próxima ventana: **noviembre 2026 para vigencia 2027** (formulario 2593 o equivalente vigente).
- Evaluar con contador en septiembre/octubre 2026 si conviene migrar a SIMPLE 2027 vs. mantener ordinario o constituir S.A.S antes (ver Gap 1.1).
- **Si se constituye S.A.S antes de noviembre 2026**, la decisión Simple/Ordinario se traslada a la sociedad nueva y la persona natural deja de operar el negocio (cesa actividad, actualiza RUT con responsabilidad 41 — cesación).

---

### Gap 2.4 — Retenciones Wompi sin acreditar 🟠

**Acción:**
1. Solicitar a Wompi certificados de retención 2024, 2025, 2026 (parcial).
2. Acreditar el valor retenido en las declaraciones a presentar.
3. Configurar sistema UCR para almacenar `payment_transaction.retention_amount` y `payment_transaction.retention_certificate_url` (mejora técnica futura).

---

### Gap 2.5 — ICA y RIT (Bello) desconocidos 🟡

**Domicilio fiscal según RUT:** CR 56 A 66 89 BRR HATO NUEVO, **Bello (Antioquia)**. Por tanto el RIT aplicable es el del **municipio de Bello**.

**Acción:**
1. Verificar inscripción en RIT del **municipio de Bello** (Secretaría de Hacienda Municipal).
2. Si no está inscrito, hacerlo (gratuito).
3. Si está pero no ha declarado, regularizar (Bello también ofrece beneficios por presentación voluntaria; consultar acuerdo municipal vigente).
4. Para el segundo local en otro municipio: inscripción RIT en ese municipio antes de iniciar operaciones, y prorratear ingresos según Art. 343 ET y normas municipales.

---

## Roadmap de cierre

> **Lógica de priorización (revisada 2026-05-04):** dado el bajo volumen del negocio, el riesgo sancionatorio material es **bajo** (las sanciones se calculan sobre impuesto a cargo / ingresos brutos, que son modestos). Por eso la urgencia 🔴 **no se justifica por evitar multas** sino por:
> 1. **Habilitar venta B2B** (Gap 2.0 — cotización restaurante exige FE para deducir costo).
> 2. **Higiene operativa y contable**: imposible escalar a v3.1 (multi-branch) o v3.2 (SaaS) sin contabilidad y FE en orden.
> 3. **Aprovechar la ventana de plazo ordinario** de la declaración de renta 2025 (vence ago/sep 2026) — si se actúa ahora se evita extemporaneidad de facto, no porque la sanción sea grande sino porque cuesta lo mismo hacerlo bien que mal.
>
> Las prioridades 🔴 reflejan **bloqueos a oportunidades de negocio** (B2B, expansión), no temor a la DIAN. Las 🟠/🟡 son higiene tributaria que se puede ejecutar en paralelo sin urgencia punitiva.

| ID | Acción | Prioridad | Driver de urgencia | Plazo | Costo estimado | Bloquea a |
|----|--------|-----------|--------------------|-------|----------------|-----------|
| T1 | ~~Consultar RUT~~ ✅ Resuelto 2026-05-04 con [RUT_2025.pdf](../../../documentos/Legal/RUT_2025.pdf) | — | — | — | $0 | — |
| T2 | Contratar contador público | 🔴 | Habilita T3, T4, T11; sin contador no hay control real | <7 días | $1M–$3M arranque + $300k–$1M/mes | T3, T4, T11 |
| T3 | Reconstruir ingresos/gastos desde 2025-07-01 | 🔴 | Insumo para T4 y para contabilidad operativa (negocio, no DIAN) | <30 días | Incluido en T2 | T4 |
| T4 | Presentar declaración renta 2025 (formulario 210) **dentro del plazo ordinario** | 🟠 | Plazo no vencido (ago/sep 2026 según NIT) → **no es urgente sancionatoriamente**, pero conviene anticipar para liberar foco | Antes del vencimiento por NIT | Impuesto a cargo, **sin sanción si en plazo** | Cierre fiscal 2025 limpio |
| T5 | Seleccionar proveedor FE | 🔴 | **Habilita venta B2B** (cotización restaurante, futuros colegios) | <30 días | Comparativa interna | T6, T7 |
| T6 | Solicitar resolución numeración DIAN (seccional Medellín) | 🔴 | Prerrequisito técnico para T7 | <45 días | $0 | T7 |
| T7 | Integrar FE con backend UCR | 🔴 | **Feature urgente del sistema** (independiente de DIAN) — sin esto v3.1/v3.2 no son viables comercialmente | <90 días | 2-3 semanas dev | v3.1, v3.2, B2B |
| T8 | Recolectar certificados retención Wompi | 🟡 | Solo para acreditar en T4. Bajo impacto monetario por volumen | <30 días | $0 | T4 |
| T9 | Verificar/regularizar RIT **municipio de Bello** | 🟡 | Higiene local, sanción municipal baja por volumen, pero requerido para abrir segundo local | <60 días | $0 | Apertura segundo local |
| T10 | Evaluar opción a SIMPLE para 2027 (decisión sep–oct 2026) | 🟡 | Decisión estratégica acoplada a S.A.S | nov 2026 | $0 | Decisión estratégica |
| T11 | Verificar topes 2025 para responsabilidad IVA (Art. 437 par. 3 ET) | 🟡 | Necesario para confirmar que la responsabilidad 49 sigue válida; volumen bajo sugiere que sí | <30 días | $0 | T4 |

**Camino crítico realista (orden de ejecución sugerido):**
1. **Semana 1**: T2 (contador) + T5 (proveedor FE) en paralelo — son independientes y desbloquean todo lo demás.
2. **Semanas 2–4**: T3 (contador) + T6 (numeración DIAN) + T11 (verificar IVA con contador) en paralelo.
3. **Semanas 4–12**: T7 (integración FE backend) + T8 + T9 en paralelo. T7 es el camino crítico real porque es trabajo de desarrollo.
4. **Mayo–septiembre 2026**: T4 (renta 2025) cuando el contador tenga la data lista. No exprimir.
5. **Septiembre–noviembre 2026**: T10 (decisión SIMPLE 2027 / S.A.S).

---

## Conexión con releases técnicos

| Release | Requisito tributario | Driver |
|---------|----------------------|--------|
| v3.0 (abr 2026) | T2, T3 idealmente en curso. T5, T6 iniciados. | Higiene operativa |
| v3.1 (jun 2026) | T7 (FE) **operativa para B2B**. T9 si abre local en otro municipio. | Habilitar venta B2B + multi-branch legal |
| v3.2 (oct 2026) | Sistema FE robusto y multi-tenant si se vende SaaS (cada cliente tendrá su propia resolución DIAN). | Comercialización SaaS |

> **Nota**: la columna "Requisito" no implica obligación legal sino **bloqueo de oportunidad**. v3.0 puede salir sin contabilidad perfecta; v3.1 sin FE pierde el segmento B2B; v3.2 sin FE multi-tenant es invendible.

---

## Hito crítico: facturación electrónica multi-tenant

Para v3.2 (comercialización SaaS), el módulo de FE no puede ser monolítico para UCR. Cada cliente del SaaS tendrá:
- Su propio RUT, NIT, resolución DIAN.
- Su propio convenio con el proveedor tecnológico (o uno compartido con sub-cuentas).
- Sus propias plantillas (logo, footer legal).

Diseño técnico requerido en v3.2:
- Tabla `tenant_invoicing_config` con: provider, api_key, resolution_number, range_from, range_to, expires_at, signature_certificate.
- Servicio de FE que enrute por tenant.

Documentar en `docs/v3-branch-architecture/` cuando se priorice.

---

## Decisiones pendientes del owner

- [ ] ¿Contador externo o interno? (Recomendación: externo al inicio, interno cuando volumen lo justifique).
- [ ] ¿Qué proveedor de FE? (Pendiente comparativa funcional + costos reales).
- [ ] ¿Reportar ventas históricas retroactivamente desde 2025-07-01 o iniciar FE desde fecha cero? (Definir con contador. La fecha de inicio de actividad según RUT es 2025-07-01, así que retroactivamente significa 2025-07-01 → hoy).
- [ ] ¿Optar por SIMPLE en noviembre 2026 (vigencia 2027) o mantenerse en ordinario? Depende de si se constituye S.A.S antes (Gap 1.1) y de proyección de ingresos.
- [ ] ¿Verificar si los ingresos 2025 superaron 3.500 UVT para confirmar que la responsabilidad 49 (No responsable IVA) sigue siendo correcta?
