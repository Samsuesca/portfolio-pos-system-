# Dimensión 6 — Comercial (Relación con clientes y contraparte contractual)

> **Última actualización:** 2026-05-04
> **Owner:** Carmen Consuelo Ríos Cartagena (titular) + Angel Suesca (operación + dev) + (pendiente) Asesor mercantil
> **Criticidad global:** 🟠 ALTA
> **% Formalización estimado:** 10%
> **Fuentes documentales:** auditoría de código sobre branch `main` (2026-05-04) + DB `uniformes_prod_snapshot` (last_sale 2026-05-01).

---

## Resumen ejecutivo

UCR opera tres canales comerciales con perfiles legales radicalmente distintos y **sin documentación de soporte adecuada en ninguno**:

| Canal | % de ventas 2026 (proxy) | Marco principal | Cobertura legal actual |
|-------|--------------------------|-----------------|------------------------|
| B2C **presencial** (mostrador en Bello) | ~65% | Estatuto del Consumidor (Ley 1480/2011) | Mínima — solo factura/recibo, sin política escrita |
| B2C **online** (web-portal `yourdomain.com`) | ~30% | Estatuto Consumidor + Ley 527/1999 (e-commerce) + Decreto 587/2016 (retracto a distancia) | **Cero** — sin T&C, sin aviso de retracto, sin política de devolución |
| B2B (cotización restaurante $9M en curso, futuros colegios institucionales) | ~5%, target 30% | Código de Comercio + libertad contractual | **Cero contratos marco** |

A futuro (v3.2 oct 2026): un cuarto canal — **B2B SaaS** con clientes institucionales — que requiere T&C completamente distintos (servicios continuos, SLA, propiedad de datos, terminación, indemnidades). Hoy inexistentes.

**Riesgo concreto:** la primera reclamación formal de un cliente B2C online ante la SIC por incumplimiento de garantía o falta de aviso de retracto puede acabar en sanción de hasta **2.000 SMMLV (~$2.840M COP)** + obligación de devolver dinero + publicación de la sanción.

> **⭐ Nota estratégica (2026-05-22): el B2B contractual es un pilar de negocio, no un "gap".** El canal B2B (~5% hoy, target 30%) dejó de ser un pendiente contractual aislado y pasó a ser el **tercer pilar de crecimiento de UCR** (junto a sucursales y SaaS), porque es el **flujo real de caja mes a mes** que rompe la estacionalidad escolar. Su modelo de negocio completo — segmentos (restaurantes, dotación corporativa Art. 230 CST, equipos deportivos, eventos, institucional), modelo de datos (cotizaciones/contratos/anticipos), tratamiento contable de anticipos como pasivo, e integración con el Modelo Financiero como stream contracalendario — está documentado en [`v3/v3-branch-architecture/b2b-contracts-model.md`](../v3-branch-architecture/b2b-contracts-model.md). Los Gaps 6.6 y 6.7 de este documento son la **dimensión comercial/legal** de ese pilar (contrato marco, política de crédito, cotización formal numerada).

---

## Marco normativo aplicable

| Norma | Aplicación a UCR |
|-------|------------------|
| **Ley 1480 de 2011** (Estatuto del Consumidor) | Núcleo del régimen B2C. Garantía legal mínima 1 año, info veraz, sin cláusulas abusivas |
| **Decreto 587 de 2016** | Reglamenta venta a distancia y derecho de retracto (5 días hábiles) |
| **Ley 527 de 1999** | Mensaje de datos, firma electrónica, validez del comercio electrónico |
| **Decreto 1499 de 2014** y **Decreto 1369 de 2014** | Información mínima para venta a distancia |
| **Resolución SIC 4999 de 2024** | Plazos y forma de retracto |
| Ley 256 de 1996 | Competencia desleal — relevante si UCR usa marcas de colegios sin autorización |
| Decisión 486 CAN + Ley 1455 de 2011 | Marcas (`Uniformes Consuelo Ríos` como signo distintivo) |
| Código de Comercio Art. 822 y ss. | Contratos mercantiles entre comerciantes (B2B) |
| Ley 1564 de 2012 (CGP) Art. 422 | Proceso ejecutivo — relevante para cobro de cartera B2B |
| Ley 1266 de 2008 | Habeas data financiero — al reportar deudores a centrales de riesgo |

---

## Estado actual

### Inventario de documentos contractuales

| Documento | Existencia | Ubicación | Versión vigente |
|-----------|------------|-----------|-----------------|
| Términos y condiciones generales web-portal | ❌ No existe | — | — |
| Política de devoluciones y cambios B2C | ❌ No existe (verbal/discrecional) | — | — |
| Política de garantías (Art. 7-8 Ley 1480) | ❌ No existe | — | — |
| Política de envíos y plazos de entrega | ❌ No existe | — | — |
| Aviso de derecho de retracto en e-commerce | ❌ No existe | — | — |
| Contrato marco B2B (colegios, empresas) | ❌ No existe | — | — |
| Cotizaciones formales con número y vigencia | ⚠️ Parcial | Archivos sueltos por contrato | — |
| EULA / T&C SaaS (para v3.2) | ❌ No existe | — | — |
| Acuerdo de procesamiento de datos para clientes SaaS | ❌ No existe | — | — |

### Captura B2C presencial (mostrador)

- Venta directa con factura/recibo POS interno (no FE DIAN — ver `02-tributario.md`).
- Política de cambios actual: **discrecional**, basada en relación personal con la titular ("si trae el ticket y la prenda sin usar dentro de la primera semana, se cambia").
- Sin política escrita visible al cliente ni en el local ni en factura.
- Bajo Art. 7 Ley 1480, la garantía legal de 1 año aplica **aunque no esté escrita**.

### Captura B2C online (web-portal)

> Auditoría sobre [web-portal/app/[school_slug]/checkout/page.tsx](../../../web-portal/app/[school_slug]/checkout/page.tsx).

| Requisito legal | Estado en código |
|-----------------|------------------|
| Información clara del producto (precio, descripción, foto) | ✅ Cubierto |
| Datos del proveedor (NIT, dirección, contacto) | ⚠️ Parcial — no aparece en checkout |
| Costos de envío explícitos | ✅ `delivery_zones` con tarifa visible |
| **Plazo de entrega cierto** (Art. 26 EC) | ⚠️ Solo "El tiempo de entrega puede variar según disponibilidad" — **frase ambigua** |
| **Aceptación expresa de T&C** | ❌ No hay checkbox |
| **Aviso de derecho de retracto (5 días hábiles)** | ❌ No hay |
| **Procedimiento para retracto** | ❌ No documentado |
| Métodos de pago seguros | ✅ Wompi (PCI-DSS delegado) |
| Comprobante electrónico de la compra | ⚠️ Email de confirmación — no factura electrónica DIAN aún |
| Botón de PQRS | ✅ `/soporte` existe |
| Aviso de privacidad y consentimiento (cruzado dim. 5) | ❌ Ver `05-datos-personales.md` |

### Cambios y devoluciones — modelo del sistema

> Auditoría sobre [backend/app/models/sale.py](../../../backend/app/models/sale.py).

```python
class ChangeType(str, enum.Enum):
    SIZE_CHANGE = "size_change"
    PRODUCT_CHANGE = "product_change"
    # ❌ NO existe: DEFECT_WARRANTY, RETRACTO, REFUND_FULL
```

```python
class ChangeStatus(str, enum.Enum):
    PENDING, PENDING_STOCK, APPROVED, REJECTED, COMPLETED  # detalle parcial
```

**Implicación:** el sistema modela cambios "comerciales" (talla, producto) pero **no diferencia legal/tributariamente**:
- **Cambio voluntario por gusto** (no obligación legal).
- **Cambio por garantía legal** (Art. 7-8 Ley 1480 — costo absorbido por UCR sin descuento al cliente).
- **Retracto** (Art. 47 EC — devolución total de dinero, sin condicionar a estado del producto si está dentro de los 5 días hábiles desde recepción).

Esto importa porque la contabilización es distinta:
- Cambio voluntario → maneja stock como movimiento neutro.
- Devolución por garantía → si la prenda está defectuosa, se descarta del inventario, no vuelve a stock vendible.
- Retracto → reembolso completo sin descontar costos logísticos.

### Política de envíos y entrega

> Auditoría sobre [backend/app/models/order.py](../../../backend/app/models/order.py).

- Modelo soporta: pickup vs. delivery, `delivery_zones` con tarifa, `expected_delivery_days = 7` por defecto, `delivery_date` opcional.
- UI en `mi-cuenta/page.tsx` muestra "Fecha de entrega estimada".
- **Falta**: política escrita de qué pasa si UCR no cumple la fecha (ej. ¿descuento? ¿retracto automático?). Bajo Art. 26 EC, el incumplimiento da derecho a desistir y exigir reembolso.

### B2B — cotizaciones y contratos

- No existe módulo de cotización formal en el sistema (no hay tabla `quotations`).
- Las cotizaciones se hacen por fuera (correo, WhatsApp) — sin numeración, sin vigencia, sin condiciones de pago, sin penalización por incumplimiento.
- Caso actual: cotización con restaurante por **~$9M COP** (ver `02-tributario.md` Gap 2.0). Si se cierra, se cierra **sin contrato escrito**.

### Marca y propiedad intelectual comercial

- "Uniformes Consuelo Ríos" no aparece registrado como marca en SIC (verificar en https://sipi.sic.gov.co).
- Cada colegio cuyas prendas confecciona UCR tiene marca propia (escudo, nombre): **¿hay autorización de uso?** El uso de escudo escolar sin licencia puede ser infracción marcaria de la institución.
- El código fuente del sistema UCR está bajo licencia MIT (ver dimensión 8) — separado de la marca comercial.

### Atención al cliente — PQRS

- Página `/soporte` existe en web-portal.
- No hay SLA definido para respuestas (Art. 58 EC sugiere 15 días hábiles para PQR).
- No hay registro de PQRS (tabla `customer_complaints` o equivalente). Reclamaciones se manejan ad hoc en chats privados.

---

## Gaps identificados

### Gap 6.1 — Sin Términos y Condiciones B2C online 🔴

**Problema:** la SIC ha sancionado e-commerce sin T&C visibles incluso si la venta se completó sin reclamos. La sola omisión es infracción.

**Acción:**
1. Redactar T&C web-portal cubriendo: identificación del proveedor (NIT 42779422-1, Carmen Consuelo Ríos, dirección Bello, contacto), descripción del servicio, precios e impuestos, plazos de entrega, costos de envío, formas de pago, política de cambios y devoluciones, garantías legales, derecho de retracto, atención al cliente, ley aplicable (colombiana) y jurisdicción (Bello/Medellín).
2. Versionar (`v1`, fecha vigencia).
3. Publicar en `/terminos`.
4. Agregar checkbox de aceptación al final del checkout, con link al documento.
5. Persistir el consentimiento en `data_processing_consents` o nueva tabla `commercial_terms_acceptance` con `terms_version`, `timestamp`, `ip`.

---

### Gap 6.2 — Sin política de devoluciones, cambios y garantías 🔴

**Problema:** UCR opera con política verbal. Bajo Art. 7-8 Ley 1480, la garantía legal de **1 año** aplica aunque no se mencione, **pero** una política escrita protege a UCR limitando reclamaciones improcedentes y dándole términos claros.

**Acción:**
1. Política escrita que diferencie:
   - **Cambio comercial** (talla/color por preferencia): plazo definido (ej. 8 días con prenda sin uso, etiqueta intacta, factura). Costo: cliente paga diferencias.
   - **Garantía legal** (defecto de fabricación): 1 año desde la entrega, sin costo para el cliente, opciones reparación/reposición/reembolso.
   - **Retracto** (online): 5 días hábiles desde recepción, reembolso íntegro.
2. Mostrar en `/garantias` y enlazar desde productos del web-portal.
3. Extender `ChangeType` enum: añadir `DEFECT_WARRANTY` y `RETRACTO` para diferenciar contablemente y para reportes.

---

### Gap 6.3 — Aviso de retracto y procedimiento ausentes 🔴

**Problema:** Decreto 587/2016 exige aviso visible **antes y después** de la venta a distancia.

**Acción:**
1. Banner de retracto en checkout: "Tienes 5 días hábiles para arrepentirte sin justificación. Conoce cómo aquí".
2. Email post-compra con instructivo de retracto (`backend/app/services/email.py::send_order_confirmation_email`).
3. Endpoint `POST /api/v1/orders/{id}/retracto` con validación de plazo y workflow de reembolso.

---

### Gap 6.4 — Plazo de entrega ambiguo 🟠

**Problema:** "puede variar según disponibilidad" no es plazo cierto. Cliente puede desistir y reclamar reembolso por incumplimiento (Art. 26 EC).

**Acción:**
1. Definir SLA real por tipo de pedido:
   - Producto en stock: 2-3 días hábiles.
   - Encargo personalizado: tiempo de confección + envío (ej. 7-10 días hábiles).
2. Mostrar SLA específico en checkout antes del pago.
3. `expected_delivery_days` debe calcularse del producto, no quedar en default 7.

---

### Gap 6.5 — Marca no registrada 🟡

**Problema:** "Uniformes Consuelo Ríos" sin registro marcario es vulnerable a homonimia y a perder derecho preferente.

**Acción:**
1. Búsqueda de antecedentes en SIPI (gratis).
2. Si está libre, solicitar registro: clase 25 (prendas de vestir) + clase 35 (servicios de comercialización si v3.2 SaaS). Costo: ~$700.000 por clase + $150.000 por solicitud.
3. Si hay coexistencia, evaluar coexistencia o cambio de denominación comercial.

---

### Gap 6.6 — Sin contratos marco B2B 🟠 (habilitador del tercer pilar)

> **Contexto elevado:** este gap es la dimensión comercial/legal del **pilar B2B** (ver [`b2b-contracts-model.md`](../v3-branch-architecture/b2b-contracts-model.md)). No es solo "el restaurante": es el clausulado base de toda la línea de contratos empresariales/dotación/eventos que UCR quiere convertir en su flujo recurrente. Cerrarlo desbloquea el segmento que sostiene la caja entre temporadas escolares.

**Problema:** la cotización del restaurante y futuros contratos con colegios institucionales se cierran de palabra. Sin contrato no hay claridad sobre garantías, plazos de pago, penalidades por mora, indemnidades, foro y ley aplicables.

**Acción:**
1. Plantilla de **contrato marco de suministro** B2B (clausulado mínimo: objeto, vigencia, precios, entregables, plazos, garantías, sanciones, indemnidad, confidencialidad, terminación, ley aplicable, foro, datos personales).
2. Plantilla de **orden de compra/pedido** B2B con condiciones particulares por encargo.
3. Política de crédito B2B: límites, plazo de pago, intereses moratorios (no superiores a tasa de usura).
4. Para clientes institucionales (colegios públicos, fundaciones) revisar requerimientos adicionales: paz y salvo parafiscales, RUT al día, certificado de existencia y representación de Cámara, estados financieros (esto requiere primero tener los EEFF — ver `03-contable.md`).

---

### Gap 6.7 — Cotización del restaurante sin marco contractual 🔴 URGENTE

**Problema:** caso concreto de Gap 2.0 (`02-tributario.md`). Si se cierra hoy se cierra sin FE, sin contrato, sin condiciones de pago.

**Acción inmediata (en paralelo a integración FE):**
1. Cotización con número y vigencia (15-30 días).
2. Anexar plantilla de contrato (Gap 6.6 reducido) con términos: anticipo, saldo contra entrega, plazos, garantía, condiciones de cambio.
3. Si UCR aún no tiene FE al momento del cierre, opción puente: contador profesional emite factura desde su software (Alegra del contador) por la operación.

---

### Gap 6.8 — Falta T&C y EULA para SaaS v3.2 🟠

**Problema:** v3.2 (oct 2026) plantea vender el software UCR a otros negocios. Sin T&C SaaS no hay base contractual.

**Acción (anticipar a partir de jul 2026):**
1. **EULA / T&C SaaS** que incluya:
   - Licencia de uso (no propiedad), modalidades (mensual/anual), restricciones (no reventa, no ingeniería inversa).
   - Niveles de servicio (SLA): uptime objetivo, ventanas de mantenimiento, soporte.
   - Datos: propiedad del cliente, finalidad limitada al servicio, tratamiento conforme Ley 1581.
   - Backups y portabilidad: el cliente puede exportar sus datos en cualquier momento.
   - Terminación: causales, plazo, forma de devolución/eliminación de datos.
   - Limitación de responsabilidad y exclusiones.
   - Indemnidades cruzadas.
   - Modificaciones unilaterales y notificación.
   - Confidencialidad.
   - Ley aplicable (Colombia) y foro.
2. **Acuerdo de Procesamiento de Datos (DPA)** anexo, requerido bajo Decreto 1377 cuando UCR procesa datos en nombre del cliente SaaS.
3. **Acuerdo de Nivel de Servicio (SLA)** separado con métricas operativas.
4. Cruza con dimensión 8 (tecnológico) en lo relativo a propiedad intelectual del software y licenciamiento técnico.

---

### Gap 6.9 — Sin sistema de PQRS 🟡

**Problema:** Art. 58 EC y Decreto 1369/2014 exigen mecanismo formal de PQRS con plazo máximo de 15 días hábiles.

**Acción:**
1. Tabla nueva `customer_complaints` con campos: cliente, canal (web/whatsapp/presencial), tipo (queja, reclamo, sugerencia, garantía, retracto), fecha apertura, fecha respuesta, estado, respuesta.
2. Endpoint público `POST /api/v1/portal/complaints` y formulario en `/soporte`.
3. SLA interno con alerta Telegram a Carmen Consuelo si pasa de 10 días sin respuesta.
4. Reportes mensuales para detectar patrones (mismo defecto, mismo proveedor, etc.).

---

### Gap 6.10 — Uso de marcas escolares sin licencia 🟡

**Problema:** UCR confecciona prendas con escudos de colegios. Si no hay autorización escrita de cada institución, hay riesgo de infracción marcaria.

**Acción:**
1. Inventariar colegios cuyos uniformes se confeccionan (ya existe en tabla `schools`).
2. Solicitar autorización escrita a cada uno (carta, convenio o contrato).
3. Archivar en `documentos/Legal/convenios-colegios/` con fecha de vigencia.

---

## Roadmap de cierre

> **Lógica de priorización:** la urgencia 🔴 viene de **dos drivers**: (a) habilitar la cotización B2B en curso (restaurante $9M) y (b) cumplimiento mínimo del Estatuto del Consumidor en el canal online, donde la SIC sí supervisa proactivamente. La 🟠 prepara el terreno para v3.1 (multi-branch) y v3.2 (SaaS). La 🟡 es higiene comercial.

| ID | Acción | Prioridad | Driver | Plazo | Costo estimado | Dependencia |
|----|--------|-----------|--------|-------|----------------|-------------|
| C1 | Redactar y publicar T&C web-portal + checkbox aceptación + persistencia consent | 🔴 | Cumplimiento Ley 1480 + Decreto 587 | <30 días | $0–$1M | D1 (`05-datos-personales.md`) |
| C2 | Política escrita de devoluciones, cambios y garantías + página `/garantias` | 🔴 | Cumplimiento Art. 7-8 Ley 1480 | <30 días | $0–$500k | C1 |
| C3 | Aviso y procedimiento de retracto (banner, email, endpoint, workflow) | 🔴 | Cumplimiento Decreto 587 | <45 días | 3-5 días dev | C1, C2 |
| C4 | Extender `ChangeType` enum con `DEFECT_WARRANTY` y `RETRACTO`; migración Alembic | 🟠 | Diferenciación contable + reportería | <60 días | 2 días dev + migración | C2 |
| C5 | Calcular `expected_delivery_days` por producto y mostrar SLA real en checkout | 🟠 | Cumplimiento Art. 26 EC | <60 días | 2-3 días dev | — |
| C6 | Plantillas contractuales B2B (contrato marco, orden de compra, política de crédito) | 🟠 | Habilitar venta B2B (restaurante + colegios) | <60 días | $1M–$3M asesor | — |
| C7 | Cotización formal con condiciones para restaurante (caso concreto) | 🔴 | Negocio en curso, cierre inmediato | <14 días | Plantilla de C6 | C6 inicial |
| C8 | Búsqueda y solicitud de marca "Uniformes Consuelo Ríos" en SIC | 🟡 | Protección de signo distintivo | <90 días | $700k–$1.5M (1-2 clases) | — |
| C9 | EULA / T&C SaaS + DPA + SLA para v3.2 | 🟠 | Habilitador comercial v3.2 | jul-sep 2026 | $2M–$5M asesor | Dim. 8 + L1 (S.A.S) |
| C10 | Sistema de PQRS (`customer_complaints` + formulario `/soporte` + SLA + alertas) | 🟡 | Cumplimiento Art. 58 EC | <90 días | 4-5 días dev | — |
| C11 | Convenios escritos con cada colegio (autorización de uso de marca/escudo) | 🟡 | Mitigación riesgo marcario | <120 días | $0–$300k | — |
| C12 | Política de envíos detallada por zona (`/envios`) | 🟡 | Transparencia + reducir disputas | <60 días | 1 día dev + decisión | C5 |

---

## Conexión con releases técnicos

| Release | Requisito comercial | Driver |
|---------|---------------------|--------|
| v3.0 (abr 2026) | C1, C2, C3, C7 — operación legal mínima del canal online + cierre del B2B en curso | Cumplimiento Ley 1480 + negocio activo |
| v3.1 (jun 2026) | C4, C5, C6, C10 — apertura segundo local con contratos B2B y SLA reales | Habilitar expansión multi-branch |
| v3.2 (oct 2026) | C9 — T&C SaaS, DPA, SLA. C8 finalizado (marca registrada da credibilidad comercial) | Habilitador SaaS — sin esto el producto es invendible institucional |

> **Nota multi-tenant v3.2:** los T&C SaaS deben contemplar que cada cliente del SaaS (otro negocio) tendrá sus propios T&C con sus propios consumidores, y UCR no es responsable de esos contratos secundarios. Esto se gestiona con **clausulado de back-to-back** que deslinde responsabilidades.

---

## Pendientes de discovery (necesitan input del owner)

1. **Política actual de devoluciones**: ¿cuál es el criterio real con que se aceptan/rechazan cambios hoy? (días, condiciones de la prenda, requisito de factura, qué pasa con encargos personalizados — ¿se cambian?). Necesario para redactar política escrita coherente con la práctica.

2. **Casos históricos de garantía**: ¿algún caso de prenda defectuosa? ¿Cómo se manejó? ¿Cuántas reclamaciones recibe en promedio al mes?

3. **Reclamaciones formales recibidas**: ¿alguna PQRS por la SIC, asociación de consumidores, redes sociales? ¿Se registra en algún lado?

4. **Cotización restaurante**: ¿qué condiciones se acordaron de palabra (anticipo, plazo, garantía)? ¿Hay correos/WhatsApp con la conversación que sirvan de soporte para extraer el clausulado real?

5. **Convenios con colegios**: ¿hay alguna autorización escrita con algún colegio para usar su escudo/marca? ¿Cómo se accedió a las medidas y diseños de los uniformes (relación informal, contrato, autorización verbal)?

6. **Marca registrada**: ¿"Uniformes Consuelo Ríos" tiene algún registro local (DIAN, Cámara) que aplique como uso? ¿Hay variantes ("UCR", "Consuelo Ríos Uniformes") que también convenga registrar?

7. **Plazos reales de entrega**: ¿cuánto se demora un producto en stock vs. un encargo desde que el cliente paga? Datos para C5.

8. **Política de envíos**: zonas que se cubren actualmente, costos, qué pasa si la dirección está fuera de zona, retornos.

9. **Plan B2B**: además del restaurante, ¿hay leads concretos de colegios o empresas? ¿Volumen esperado? Esto define qué tan urgente es C6.

10. **SaaS v3.2 — modelo comercial**: ¿modalidad pensada (SaaS multi-tenant cobrado mensualmente, on-premise con licencia anual, mixto)? ¿Mercado objetivo (otros uniformes, retail similar, otros sectores)? Esto define la estructura de C9.

---

## Decisiones pendientes del owner

- [ ] Aprobar plazo de cambio comercial (recomendación: 8 días con producto sin uso y factura).
- [ ] Aprobar SLA de plazos de entrega por categoría.
- [ ] Decidir si contratar asesor mercantil para C6 y C9 o usar plantillas adaptadas.
- [ ] Decidir si registrar marca "Uniformes Consuelo Ríos" antes o después de constituir S.A.S.
- [ ] Definir punto de contacto para PQRS (correo, WhatsApp dedicado, persona responsable).
- [ ] Definir modalidad comercial del SaaS v3.2 (precio, segmento, modelo de despliegue).
