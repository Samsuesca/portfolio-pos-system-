# Sesión de Conciliación Contable — Consuelo Ríos

> **Fecha propuesta:** _agendar_ (2–2.5h, presencial o video)
> **Participantes:** Consuelo Ríos (Owner) + Angel Suesca (CTO)
> **Objetivo:** cerrar los ítems contables que bloquean el deploy v3 a producción, decidiendo caso por caso con datos del sistema enfrente.
> **Output esperado:** decisiones firmadas (✓ en cada casilla del doc) que habiliten los scripts de estabilización a aplicarse en prod.
> **Hallazgo crítico (2026-05-24):** en uno de los puntos de venta se opera **línea paralela de perfumería/belleza/aseo** que el sistema actual no modela (sistema asume solo uniformes). Esto reframea buena parte del desfase contable y agrega un bloque nuevo (Bloque 0) que es **pre-requisito** de todos los demás.

---

## Por qué esta sesión

El sistema lleva 6 meses operando y la migración a la versión v3 está lista en código, pero **no se puede subir a producción mientras la contabilidad tenga huecos sin explicar**. Hay $65M en movimientos históricos que el sistema no puede catalogar solo — necesitan tu decisión, Consuelo.

Cada bloque abajo te muestra:
1. **El hueco específico** (con datos reales que ya están en el sistema).
2. **Las opciones** posibles para resolverlo.
3. **Una casilla** para marcar tu decisión.
4. **El impacto** contable de cada decisión.

No hay decisiones "correctas" — hay decisiones consistentes. Lo importante es que queden registradas para que el sistema y la futura contadora puedan defenderlas ante DIAN.

---

## Resumen de lo que vas a decidir (lo que está en juego)

| Bloque | Tema | Monto en juego | Tu decisión hoy |
|---|---|---:|---|
| **0** | **Línea perfumería/belleza** (segundo negocio no modelado) | ~$7M ventas + $5M compras detectadas | ⏳ **Pre-requisito de todo lo demás** |
| 1 | Préstamo Cristina Ríos — pagos no rastreados | $19M | ✅ Ya decidido (vigente) — solo confirmar |
| 2 | Ajuste Nequi del 5-ene-2026 ($20M → $10) | $20M | ⏳ Pendiente |
| 3 | Discrepancia de $21.6M entre saldo "real" y entries | $21.6M | ⏳ Pendiente (probablemente parcialmente explicado por Bloque 0) |
| 4 | 20 compras en YANBAL, ESIKA y TEMU | ~$5M | ⏳ Re-evaluar bajo lente "inventario beauty" |
| 5 | 114 transacciones de mercado/ocio/comida/viáticos | ~$7.4M | ⏳ Pendiente (por bloques) |
| 6 | 7 transferencias entre Bancolombia ↔ Nequi | $3.6M | ⏳ Pendiente (confirmación) |
| | **TOTAL** | **~$83M** | |

---

## Bloque 0 — Línea Perfumería/Belleza (segundo negocio no modelado)

### Lo que pasó (hallazgo 2026-05-24)

En **uno de los puntos de venta** se opera una **segunda línea de negocio** que el sistema actual NO modela: perfumería, productos de belleza, aseo personal. Consuelo maneja esta línea directamente (no las vendedoras del sistema). El sistema fue diseñado solo para uniformes — multi-tenant por colegio — y nunca contempló productos sueltos.

**Consecuencia contable:**
- Las **compras de inventario** de esta línea (YANBAL, ESIKA, TEMU, etc.) SÍ pasan por Banco/Nequi → el sistema las "ve" pero las cataloga mal (como `owner_drawing_candidate`, asumiendo que son personales).
- Las **ventas** de esta línea entran al cash flow (Nequi QR, efectivo, transferencias) → el sistema las recibe en `balance_entries` pero **no tienen contraparte en `sales`** porque sales solo registra ventas de productos del catálogo de uniformes.
- Resultado: los saldos bancarios reflejan flujo neto de ambas líneas, pero el P&L y el inventario solo cuentan uniformes → **discrepancia estructural permanente**.

### Estimación inicial (datos reales del bank reconciliation ene–abr 2026)

| Concepto | Movs detectados | Monto |
|---|---:|---:|
| Ventas QR sin match en sistema (probable beauty) | 57 | **+$7.19M** |
| Compras YANBAL/ESIKA/TEMU (probable CMV beauty) | 20 | **-$5.05M** |
| Margen estimado bruto (4 meses) | | **+$2.14M** |
| % estimado vs uniformes (~$120M anual) | | **~7-10%** |

> Esto es **piso**, no techo. No incluye efectivo en caja, ni el `needs_manual_review` (203 movs, -$2.7M) que probablemente tiene una porción de la línea perfumería.

### Preguntas para Consuelo

**1. ¿Desde cuándo opera la línea perfumería en el punto de venta?**

[ ] Siempre, desde antes del sistema (incluye todo 2026 + histórico) ✓ _confirmado por Consuelo 2026-05-24_

[ ] Empezó en _________ (mes/año aprox)

**2. ¿En qué punto de venta específicamente?**

[ ] Tienda principal: ___________________________
[ ] La línea **puede extenderse** a otros puntos en el futuro ✓ _confirmado por Consuelo 2026-05-24_
[ ] Solo donde Consuelo trabaja directamente (no las vendedoras)

**3. ¿Qué productos componen la línea?** (marca todos los aplicables)

[ ] Perfumes (YANBAL, ESIKA, otros)
[ ] Cremas y cuidado facial
[ ] Maquillaje
[ ] Aseo personal (champú, jabones, etc.)
[ ] Bisutería / accesorios
[ ] Otros: _______________________________________________

**4. ¿Cómo se reciben los pagos de esta línea?**

[ ] Efectivo (no entra al banco)
[ ] Nequi QR (entra a Nequi como abono general)
[ ] Transferencia Bancolombia (entra a Banco)
[ ] Mezcla — estimación: ___% efectivo, ___% Nequi, ___% transferencia

**5. ¿Existe un control aparte de esta línea?** (Excel, cuaderno, otra app)

[ ] Sí, en: _______________________________________________
[ ] No, va "de memoria" y se reconcilia con caja al final del día.

### Decisión sobre modelado (Consuelo + Angel)

[x] **Opción elegida 2026-05-24: Crear segunda línea en el sistema (`business_line`).**
- Implementación: ver [v3-branch-architecture/business-line-model.md](v3-branch-architecture/business-line-model.md)
- Esfuerzo: ~3-5 días (migración + frontend + tests)
- **Decisión pendiente:** ¿pre o post deploy v3? Ver §"Próximos pasos".

### Impacto sobre los demás bloques

Esta decisión **reframea** los Bloques 3 y 4:

- **Bloque 3 (discrepancia $21.6M):** una parte material puede ser flujo de línea perfumería que el sistema no registró. Antes de aplicar un `equity_capital` correctivo de $21.6M, hay que estimar cuánto es atribuible a beauty.
- **Bloque 4 (YANBAL/ESIKA/TEMU $5M):** ya NO son candidatos a `owner_drawing` por default. Son **compras de inventario de la línea perfumería**. Solo confirmar si Consuelo identifica alguna excepción (compra personal real para uso propio).

---

## Bloque 1 — Préstamo Cristina Ríos (✅ DECISIÓN YA TOMADA)

### Lo que pasó

| Fecha | Acción | Monto |
|---|---|---:|
| 2025-12-16 | Cuenta "Préstamo Cristina" creada en el sistema | $39,000,000 |
| 2026-01-14 | Cuenta marcada como inactiva (con $39M intactos) | — |
| 2026-02-01 | Pago Nequi → "pago a cris... 1 de intereses 4 capital" | $4,000,000 |
| 2026-02-04 | Pago Banco → "Pago Cris" | $1,000,000 |
| 2026-02-04 | Pago Banco → "pago capital de cris a nombre de mariangel" | $2,000,000 |
| 2026-02-07 | Pago Caja Mayor → "pago a cristi segundo acuerdo" | $10,000,000 |
| 2026-02-12 | Pago Banco → "para cris" | $3,050,000 |
| | **TOTAL pagos rastreados** | **$20,050,000** |
| | **Residual sin rastrear** | **$18,950,000** |

### Tu decisión (24-may-2026)

> ✅ **Confirmado: los $19M residuales son una deuda VIGENTE con Cristina** (no condonada, no perdonada).

**Impacto contable:** Ya se creó en el sistema:
- Proveedor "Cristina Ríos" (tipo PERSON, lender personal)
- Cuenta por Pagar de $19,000,000, sin fecha de vencimiento, marcada como `financial_debt`
- Categoría correcta para reportar en P&L (no es gasto operativo)

### Lo que falta clarificar (opcional, no bloqueante)

[ ] ¿Hay un documento de respaldo (recibo, pagaré, mensaje WhatsApp) que confirme los $19M? → guardar copia en `documentos/Finanzas/Acuerdos/` para que cuando llegue contadora tenga soporte.

[ ] ¿Cuál es la **fecha límite de pago** acordada con Cristina, si existe?
- [ ] Sin fecha (deuda abierta)
- [ ] Pagar antes de _________ (fecha:)
- [ ] Pago mensual de $_________ a partir de _________

[ ] ¿Hay **intereses** acordados?
- [ ] Sin intereses
- [ ] _____% mensual / anual

---

## Bloque 2 — Ajuste Nequi 5-ene-2026 ($20M → $10)

### Lo que pasó

El 5 de enero de 2026, el saldo de Nequi en el sistema **saltó de ~$20M a $10** en un solo ajuste manual, **sin un movimiento contable que lo explique**. No hay registro de a dónde fueron esos $20M.

### Hipótesis posibles

> Marca la que mejor describe lo que recuerdes, Consuelo:

[ ] **(a) Saldo legacy "soltado":** Los $20M eran saldo histórico mal cargado al sistema desde antes. El ajuste los corrigió hacia el saldo real que tenía Nequi en ese momento ($10). → registrar como `equity_capital — Saldo apertura no rastreado`.

[ ] **(b) Transferencia a una cuenta personal:** Los $20M se movieron a una cuenta tuya o de la familia (Bancolombia personal, otra Nequi, efectivo). → registrar como `owner_drawing — Retiro propietario`.

[ ] **(c) Pago grande que no se registró:** Los $20M se usaron para pagar algo del negocio (proveedor, deuda, inversión) y la transacción nunca se digitó. → registrar como `expense — Categoría: __________` (especificar).

[ ] **(d) Error de digitación:** Alguien escribió mal el saldo (puso $20M cuando eran $20K, o algo así). El sistema lo corrigió sin pista. → registrar como `system_correction — error histórico`.

[ ] **(e) Otra explicación:** _______________________________________________

### Si Consuelo no recuerda

**Default que aplica el sistema:** opción (a) — `equity_capital — Saldo apertura no rastreado`. Es la opción más conservadora desde el punto de vista DIAN (no inventa gastos ni retiros), pero "esconde" la trazabilidad. **Decidir explícitamente es siempre mejor que aceptar el default.**

### Impacto

Sea cual sea la decisión, el ajuste de $20M deja de ser un "hueco" y se vuelve trazable. P&L y Balance se ajustan según la categoría elegida.

---

## Bloque 3 — Discrepancia $21.6M en saldos (3 ajustes históricos)

### Lo que pasó

Cuando el sistema suma todas las entradas y salidas registradas (`balance_entries`) de Caja Menor + Caja Mayor + Banco + Nequi, da un total. Pero cuando ese total se compara con el **saldo "real" que el sistema reporta** (`balance_accounts.balance`), hay una diferencia de **$21.6M** que no se puede explicar movimiento por movimiento.

### Origen

Son **3 ajustes manuales históricos** que alguien (probablemente tú o quien manejaba el sistema antes) hizo usando el botón "ajustar saldo" en lugar de registrar una transacción real. El sistema cambió el saldo pero **no creó la transacción de respaldo**.

### Composición estimada

| Mes | Caja Menor | Caja Mayor | Banco | Nequi | Total mes |
|-----|-----------:|-----------:|------:|------:|----------:|
| 2026-01 | +$7.20M | +$16.17M | +$13.48M | -$15.21M | +$21.64M |
| 2026-02 | +$0.41M | +$13.20M | +$6.15M | -$17.77M | +$1.99M |
| 2026-03 | +$0.78M | +$13.22M | +$7.03M | -$21.29M | -$0.26M |

El **mes crítico es enero 2026** (los otros meses básicamente cuadran).

### Pregunta para ti, Consuelo

> ¿Recuerdas qué saldo "ajustaste manualmente" en enero 2026? ¿Por qué lo hiciste?

[ ] **Saldo Caja Menor:** ajusté a $_________ porque _______________________________

[ ] **Saldo Caja Mayor:** ajusté a $_________ porque _______________________________

[ ] **Saldo Banco:** ajusté a $_________ porque _______________________________

[ ] **Saldo Nequi:** ajusté a $_________ porque _______________________________

[ ] No recuerdo / no fui yo / esto pasó antes de que yo manejara el sistema.

### Decisión final (después de discutir las preguntas anteriores)

> **Nota tras hallazgo Bloque 0:** una porción de esta discrepancia es probablemente el **flujo neto histórico de la línea perfumería** que el sistema nunca registró. Si la línea opera desde antes del sistema (confirmado), parte del $21.6M es la "deuda histórica" del sistema con esa línea. La descomposición ideal sería:
>
> 1. Estimar `equity_beauty_historical` = flujo neto perfumería desde origen hasta hoy.
> 2. Estimar `equity_owner_drawings_historical` = retiros de la propietaria.
> 3. El residual sería el verdadero `set_balance` sin trazabilidad.

[ ] **(a) Reconstruir desde extractos bancarios + estimación línea beauty** — usar los extractos de dic-2025/ene-2026 para encontrar el saldo verdadero, separar el flujo de la línea perfumería (con base en YANBAL/ESIKA/TEMU + sale_qr unmatched), y generar 3 entries compensatorias distintas. **Más limpio pero más trabajo.**

[ ] **(b) Aceptar la discrepancia como `equity_capital — Saldo apertura no rastreado`** — registrar $21.6M en una sola entry de equity. Implementar línea beauty en el sistema **a futuro**, sin reconstrucción histórica. _Pros:_ desbloquea deploy. _Contras:_ pierde la oportunidad de explicar bien.

[ ] **(c) Bloquear hasta tener extractos dic-2025 + tener línea beauty operando** — no aplicar ningún ajuste hasta poder reconstruir con datos limpios y con el nuevo modelo de `business_line` implementado. Más limpio pero atrasa el deploy v3 ~2 semanas.

[ ] **(d) Híbrida: aplicar `equity_capital` provisional hoy + reconstruir post-deploy** — registrar el $21.6M provisionalmente como `equity_capital — pendiente reconstrucción` para desbloquear deploy v3, y reconstruir con detalle (incluyendo separación de línea beauty) en v3.1 una vez el modelo de `business_line` esté operativo.

---

## Bloque 4 — Compras en YANBAL, ESIKA y TEMU (20 transacciones)

> **Reframeado tras Bloque 0:** estas compras son ahora **candidatas a inventario de la línea perfumería**, no a `owner_drawings` por default. Solo marcar como personal (P) si Consuelo confirma que fue compra de uso propio que no fue a vender.

### Lo que pasó

El sistema detectó 20 movimientos bancarios con nombres de marcas típicas de productos de belleza. Inicialmente se asumieron como compras personales (`owner_drawing_candidate`), pero el hallazgo del Bloque 0 sugiere que son **CMV (Costo de Mercancía Vendida) de la línea perfumería** que se vende en el punto de venta.

### Lista completa

> **Default tras hallazgo Bloque 0:** marca **B** (inventario línea beauty). Solo usa **P** (personal) si recuerdas que esa compra específica fue para uso propio, no para revender en el punto de venta. **R** (reembolsable) si fue por error con tarjeta empresa.

| # | Fecha | Marca | Monto | Marcar |
|---|---|---|---:|---|
| 1 | 2026-03-29 | YANBAL | $-858,310 | [ ] B · [ ] P · [ ] R |
| 2 | 2026-02-12 | YANBAL | $-797,665 | [ ] B · [ ] P · [ ] R |
| 3 | 2026-02-19 | ESIKA | $-433,370 | [ ] B · [ ] P · [ ] R |
| 4 | 2026-03-06 | YANBAL | $-382,825 | [ ] B · [ ] P · [ ] R |
| 5 | 2026-01-17 | YANBAL | $-370,362 | [ ] B · [ ] P · [ ] R |
| 6 | 2026-01-04 | ESIKA | $-358,733 | [ ] B · [ ] P · [ ] R |
| 7 | 2026-03-20 | ESIKA | $-340,160 | [ ] B · [ ] P · [ ] R |
| 8 | 2026-01-21 | ESIKA | $-324,331 | [ ] B · [ ] P · [ ] R |
| 9 | 2026-04-09 | ESIKA | $-282,712 | [ ] B · [ ] P · [ ] R |
| 10 | 2026-04-27 | ESIKA | $-270,950 | [ ] B · [ ] P · [ ] R |
| 11 | 2026-02-05 | ESIKA | $-201,444 | [ ] B · [ ] P · [ ] R |
| 12 | 2026-01-24 | TEMU | $-65,302 | [ ] B · [ ] P · [ ] R |
| 13 | 2026-02-14 | TEMU | $-65,090 | [ ] B · [ ] P · [ ] R |
| 14 | 2026-04-09 | TEMU | $-60,343 | [ ] B · [ ] P · [ ] R |
| 15 | 2026-03-05 | TEMU | $-60,276 | [ ] B · [ ] P · [ ] R |
| 16 | 2026-03-07 | TEMU | $-59,107 | [ ] B · [ ] P · [ ] R |
| 17 | 2026-01-05 | TEMU | $-50,941 | [ ] B · [ ] P · [ ] R |
| 18 | 2026-03-18 | Temucom | $-38,275 | [ ] B · [ ] P · [ ] R |
| 19 | 2026-04-18 | TEMU | $-32,509 | [ ] B · [ ] P · [ ] R |
| 20 | 2026-03-22 | TEMU (recarga) | +$2,026 | [ ] B · [ ] P · [ ] R |

### Reglas de cada categoría

- **B (Beauty/inventario):** se registra como compra de inventario de la línea perfumería. Cuando se implementen las `business_lines` en el sistema, estas compras quedan asociadas a `business_line=beauty`. Es CMV cuando se venda.
- **P (Personal):** se registra como `owner_drawing` (retiro de la propietaria). No es gasto del negocio. Reduce patrimonio.
- **R (Reembolsable):** se registra como CxC (cuenta por cobrar) contra ti. Lo más limpio si te equivocaste de tarjeta.

### Resumen esperado

Si Consuelo marca casi todo como **B** (lo más probable dada la magnitud detectada), entonces:
- ~$5M dejan de aparecer como retiros de propietario
- Pasan a registrarse como inventario beauty (activo del negocio)
- El P&L de uniformes deja de cargar este gasto mal etiquetado
- La línea perfumería empieza a tener trazabilidad de costos

---

## Bloque 5 — Gastos mercado / ocio / comida / viáticos (114 transacciones, $7.4M)

### Lo que pasó

El sistema tiene **114 gastos** catalogados en estas 4 categorías. Mirando las descripciones, **muchos parecen personales/familiares** ("cena mis hijos", "almuerzo de cumple", "carne", "verdura"). Necesitamos separar **personal vs negocio** para que el P&L del negocio refleje lo que realmente es operativo.

### Resumen por categoría

| Categoría | Cantidad | Total |
|---|---:|---:|
| mercado | 68 | $5,455,401 |
| ocio | 38 | $1,706,200 |
| viaticos | 5 | $212,000 |
| comida | 3 | $57,400 |
| **TOTAL** | **114** | **$7,431,001** |

### Top 20 (las más grandes — revisar primero)

> Marca cada fila con **P** (personal) o **N** (negocio).

| Fecha | Categoría | Descripción | Monto | Marcar |
|---|---|---|---:|---|
| 2026-05-22 | mercado | D1 PAPel y varios | $1,500,001 | [ ] P · [ ] N |
| 2026-04-06 | mercado | carne y ruas | $250,000 | [ ] P · [ ] N |
| 2026-05-08 | mercado | verdura y carne | $247,500 | [ ] P · [ ] N |
| 2026-02-06 | mercado | carne | $223,000 | [ ] P · [ ] N |
| 2026-05-22 | mercado | carne bello | $220,000 | [ ] P · [ ] N |
| 2026-01-21 | ocio | cena mis hijos | $160,000 | [ ] P · [ ] N |
| 2026-04-08 | mercado | varios, aseo, cosas de casa | $160,000 | [ ] P · [ ] N |
| 2026-03-31 | ocio | almuerzo de cumple de esteban | $160,000 | [ ] P · [ ] N |
| 2026-05-14 | mercado | arroz d1 lechuga | $135,000 | [ ] P · [ ] N |
| 2026-02-02 | mercado | mercado del d1 | $131,000 | [ ] P · [ ] N |
| 2026-02-21 | ocio | costillas, caldo desayuno | $130,000 | [ ] P · [ ] N |
| 2026-01-07 | ocio | almuerzo de cumple | $108,000 | [ ] P · [ ] N |
| 2026-02-07 | mercado | huevos 37 verdura 74500 | $107,500 | [ ] P · [ ] N |
| 2026-05-02 | mercado | d1 + tienda + carne + podridos | $107,000 | [ ] P · [ ] N |
| 2026-05-08 | mercado | or para santy | $101,000 | [ ] P · [ ] N |
| 2026-01-15 | mercado | mercado de D1 | $100,000 | [ ] P · [ ] N |
| 2026-03-03 | mercado | D1 mercado y almuerzo | $100,000 | [ ] P · [ ] N |
| 2026-05-08 | mercado | d1 y pezuña y tienda | $100,000 | [ ] P · [ ] N |
| 2026-04-09 | ocio | arepas malucas, cierre | $100,000 | [ ] P · [ ] N |
| 2026-01-17 | viaticos | almuerzo viaticos | $90,000 | [ ] P · [ ] N |

### Las 94 restantes (montos menores a $90K)

**Propuesta para no eternizar la sesión:** marcar por **regla general** y solo revisar excepciones.

Marca la regla que aplica a las 94 restantes:

[ ] **(R1) Todo personal** — si dice "mercado", "almuerzo", "cena", "fruta", "carne", "pollo", "verdura" → 100% personal. Re-clasificar todo a `owner_drawings — Mercado familia`.

[ ] **(R2) Todo negocio** — el negocio asume el costo de mercado del equipo. Mantener como `mercado` pero re-etiquetar a `payroll_in_kind — Alimentación equipo` (es legal como remuneración en especie si está documentado).

[ ] **(R3) Mixto, decidir por subcategoría:**
- [ ] Viáticos (5 tx, $212K) → todo negocio (es transporte/comida del equipo en jornadas largas).
- [ ] Comida en horario de trabajo → negocio (`payroll_in_kind`).
- [ ] Mercado D1 → personal (`owner_drawings`).
- [ ] Ocio (cenas, cumpleaños, "mecato") → personal.

[ ] **(R4) Revisar las 94 una por una** (toma 30-45 min más, pero queda perfecto).

### Impacto

Si marca **R1** (todo personal): el P&L del negocio "mejora" ~$7.4M (ya no es gasto operativo). Eso aumenta la utilidad reportada pero reduce el patrimonio (sale por equity).

Si marca **R2** (todo negocio como `payroll_in_kind`): el P&L queda igual, pero la categoría es correcta y deducible.

Mi sugerencia (Angel): **R3** es la más realista y defensible ante DIAN.

---

## Bloque 6 — 7 transferencias internas Bancolombia ↔ Nequi

### Lo que pasó

El sistema detectó **7 pares de transferencias** donde tú movías plata de una cuenta tuya a otra cuenta tuya (BC → Nequi o viceversa). El problema: cada par está registrado como **2 transacciones separadas** (una salida y una entrada), lo que infla artificialmente los ingresos y gastos.

### Los 7 pares

| # | Fecha out | Origen | Monto | Fecha in | Destino | Gap |
|---|---|---|---:|---|---|---:|
| 1 | 2026-01-03 | Bancolombia | $90,000 | 2026-01-05 | Nequi | 2 días |
| 2 | 2026-01-14 | Bancolombia | $384,150 | 2026-01-14 | Nequi | 0 días |
| 3 | 2026-01-15 | Bancolombia | $50,000 | 2026-01-16 | Nequi | 1 día |
| 4 | 2026-01-25 | Nequi | $40,000 | 2026-01-27 | Bancolombia | 2 días |
| 5 | 2026-03-22 | Bancolombia | $156,000 | 2026-03-22 | Nequi | 0 días |
| 6 | 2026-03-29 | Bancolombia | $700,000 | 2026-03-29 | Nequi | 0 días |
| 7 | 2026-03-30 | Bancolombia | $20,000 | 2026-04-01 | Nequi | 2 días |
| | **TOTAL** | | **~$1,440,000** | | | |

> Nota: el monto de "los 7 pares" en reportes anteriores era $3.6M considerando movimientos más grandes. La lista de arriba es lo confirmado automáticamente; puede haber más pendientes de detectar.

### Pregunta para ti

[ ] **¿Confirmas que todos son transferencias entre tus propias cuentas** (no a terceros)?
- [ ] Sí, todos. → marcar como `transfer_internal` (no afectan P&L, solo mueven plata entre activos propios).
- [ ] No todos — revisar caso por caso:

| # | ¿A quién fue? | Naturaleza |
|---|---|---|
| __ | _______________ | [ ] Tercero (cliente/proveedor) [ ] Yo misma |

### Impacto

Marcar los 7 como `transfer_internal` **no cambia el saldo total** del negocio (la plata sigue siendo tuya), pero **limpia los reportes** porque deja de aparecer como "ingreso extra" y "gasto extra".

---

## Próximos pasos después de esta sesión

Una vez tengamos las decisiones de los 5 bloques anteriores:

1. **Angel ejecuta los scripts** (`apply_stabilization_data_corrections.py`, plus extensiones por las nuevas decisiones) sobre la DB de desarrollo. Toma ~30 min, idempotente y reversible.

2. **Revisión final con Consuelo** (30 min): abrir el dashboard `/cfo` y verificar que el P&L del 2026 se ve coherente con tu percepción del negocio.

3. **Deploy v3 a producción** (sábado madrugada, ~2h): sigue el [deploy-checklist.md](formalization/deploy-checklist.md) paso a paso. Si las decisiones se aplicaron limpio en dev, prod debe replicarlas sin sorpresas.

4. **Pasos opcionales post-deploy:**
   - Documentar los acuerdos (Cristina, próximos pagos) en `documentos/Finanzas/Acuerdos/`.
   - Agendar reunión inicial con la contadora con este doc como input.
   - Activar cron diario de audit score para monitorear si vuelve a aparecer drift.

---

## Resumen de decisiones (a llenar durante la sesión)

> Tabla para firmar al final. Consuelo confirma con su firma o iniciales que estas decisiones son las que ella tomó.

| Bloque | Decisión final | Iniciales |
|---|---|---|
| 0 — Línea perfumería | Modelar como `business_line` separada en el sistema. Timing pre/post deploy v3: _____ | _____ |
| 1 — Cristina $19M vigente | ✅ Confirmado deuda vigente | C.R. |
| 2 — Nequi $20M 5-ene | Marca elegida: _____ | _____ |
| 3 — Discrepancia $21.6M | Opción elegida: _____ (a/b/c/d) | _____ |
| 4 — YANBAL/ESIKA/TEMU | 20 filas: ___ B / ___ P / ___ R | _____ |
| 5 — Mercado/ocio | Regla elegida: _____ (R1/R2/R3/R4) | _____ |
| 6 — Internal transfers | Confirmado todos: SÍ/NO | _____ |

---

**Doc generado:** 2026-05-24
**Autor:** Angel Suesca (CTO)
**Para:** Consuelo Ríos (Owner)
**Estado:** Borrador para sesión presencial — actualizar con decisiones reales el día de la conciliación.
