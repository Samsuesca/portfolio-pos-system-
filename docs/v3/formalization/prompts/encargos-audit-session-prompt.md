# Prompt: Auditoría Forense Interactiva de Encargos Obsoletos (UCR v3 — M3)

> **Para sesión nueva e interactiva.** No es para automatizar. Es para que tú (Angel, el owner) y Claude discutan los 25 casos uno por uno y cierres decisiones. Self-contained — pégame este prompt en sesión limpia de Claude Code en el repo `uniformes-system-v2`.

---

## 1. Por qué existe esta sesión

UCR tiene **25 encargos con anomalías reportadas por la vendedora** (Diana, o quien sea): mayoría "ya pagaron pero no registraron pago" o "ya entregaron sin marcar entregado". Total reportado: ~$2.5M (incluyendo un caso JUCUM de $848K).

**Restricción dura**: NO se puede cambiar `orders.status` ni `payment_status` en producción — son encargos viejos (meses), cambiarlos dispararía notificaciones a clientes y generaría confusión / reclamos / llamadas. La solución debe ser **interna y silenciosa**: una tabla `order_audit_overrides` que registra la realidad contable sin tocar el estado público que ve el cliente o la vendedora.

**Pero antes de tocar tablas**, necesitamos **decidir caso por caso**:
- ¿Qué pasó realmente?
- ¿La data en DB es consistente con la explicación de la vendedora?
- ¿La decisión es: reconocer pago retroactivo, castigar como incobrable, esperar respuesta del cliente, escalar al owner para llamada, o cancelar?
- ¿Qué entries contables se derivan?

**El output de esta sesión NO es código.** Es un **documento de decisiones aprobadas** (markdown) que después alimenta otra sesión que sí implementa el override y los asientos contables.

> **Lo que NO es este task**: NO es implementar el override system. NO es modificar producción. NO es importar costos. NO es decidir solo — es discutir con el owner.

---

## 2. Modo de operación: INTERACTIVO

Claude actúa como **copiloto forense**, no como agente autónomo. Para cada caso:

1. Muestra la explicación textual del xlsx.
2. Consulta `uniformes_prod_snapshot` (read-only) para sacar el estado real.
3. Pinta los hallazgos en un bloque estructurado (ver §6 template).
4. Propone una decisión + razón + confidence.
5. **PARA y espera al owner.** No avanza al caso siguiente sin OK explícito.

Si el owner dice "todos los de tipo X igual" durante la sesión, Claude puede batch-procesar ese tipo a partir de ese punto — pero **muestra el plan batch primero** y espera OK.

Si el caso requiere data externa (WhatsApp del cliente, recibo físico, llamada), **márcalo como `PENDIENTE_EXTERNAL`** y sigue al siguiente.

---

## 3. Inputs

### Xlsx fuente (autoritativo de los 25 casos)
`documentos/Conciliaciones:Auditorias/TRACKEOS ENCARGOS.xlsx`

**Columnas**: `INSTITUCION | (vacío) | CLIENTE | CUANTO DEBE | EXPLICACION`

**Datos parseados** (ya verificado en sesión previa, 25 filas en Hoja 1, R2-R26):
- IDs formato `ENC-2026-NNNNDesktop` (el sufijo "Desktop" indica origen — quitar para query).
- Montos en formato `XMIL` (e.g. `10MIL` = $10,000, `848MIL` = $848,000). Convertir.
- Explicaciones en español natural, a veces verbose.

### DB de trabajo
- **Read-only**: `uniformes_prod_snapshot` (refrescado hoy desde producción, head alembic `a4b5c6d7e8f9`).
- **Container**: `uniformes-postgres` (puerto 5432).
- **Credenciales**: `uniformes_user` / ver `backend/.env`.
- Acceso: `docker exec -it uniformes-postgres psql -U uniformes_user -d uniformes_prod_snapshot`

### NO usar
- `uniformes_db` (DB de dev con migraciones v3 — no representa la realidad de prod hoy).
- Producción remota (NO SSH para esto).

---

## 4. Lista de los 25 casos (resumen ejecutivo)

| # | ID | Institución | Cliente | Debe | Patrón |
|---|----|-------------|---------|------|--------|
| 1 | ENC-2026-0058 | Pinal | Santi Mazo | $10K | pago no registrado |
| 2 | ENC-2026-0131 | Caracas | JUCUM | $303K | pago no registrado (fundación) |
| 3 | ENC-2026-0128 | Caracas | Cristina Giraldo | $130K | pago no registrado (jomber requiere pago) |
| 4 | ENC-2026-0042 | Pumarejo | Camila Hernández | $66K | complejo: 3 encargos misma prenda, cancelados, contradicciones |
| 5 | ENC-2026-0124 | Caracas | Gustavo Aguirre | $15K | confirmado entregado y pagado, no registrado |
| 6 | ENC-2026-0048 | Pinal | Danelys Verdugo | $21K | no contesta, entregado pero pago probablemente no registrado |
| 7 | ENC-2026-0036 | Pumarejo | Laura Gallego | $103K | domicilio: ni pago ni estado, vendedora confirmó entrega |
| 8 | ENC-2026-0057 | Pinal | Yuliza Tabares | $58K | varias compras, no contesta, sin explicación clara |
| 9 | ENC-2026-0121 | Caracas | Dahiana Rodriguez | $137K | domicilio por Angelo, sin pago ni estado |
| 10 | ENC-2026-0042 | Pinal | Alejandra Ferraro | $42K | promete ir, no aparece |
| 11 | ENC-2026-0040 | Pinal | Wilmar Guevara | $55K | entregado, pago no registrado |
| 12 | ENC-2026-0039 | Pinal | Luis Manuel Robledo | $1K | debe $1K, ni aparece en CxC/CxP |
| 13 | ENC-2026-0118 | Caracas | JUCUM | $848K | **CASO MAYOR** — fundación, conocido por owner |
| 14 | ENC-2026-0025 | Pumarejo | Orfa Cartagena | $32K | entregado, pago no registrado |
| 15 | ENC-2026-0106 | Caracas | Adriana Giraldo | $90K | múltiples movimientos, vendedora dice "se les olvidó" |
| 16 | ENC-2026-0099 | Caracas | Dayana Mosquera | $14K | sin entrega ni pago |
| 17 | ENC-2026-0096 | Caracas | Jennifer Ibarguen | $96K | abono parcial sin jean, complejo |
| 18 | ENC-2026-0094 | Caracas | Luz Mary Mma | $20K | confirmado entrega y pago, no registrado |
| 19 | ENC-2026-0093 | Caracas | Laura Orozco | $48K | cambio de prenda, ver descripción del encargo |
| 20 | ENC-2026-0091 | Caracas | Johana Guerra | $42K | cambio caracas → felix henao |
| 21 | ENC-2026-0078 | Caracas | Karenny Castillo | $1K | debe $1K, no aparece en CxC/CxP |
| 22 | ENC-2026-0072 | Caracas | Sebastian Guzman | $45K | cambio de prenda, ver descripción |
| 23 | ENC-2026-0015 | Pumarejo | Carolina Loaiza | $99K | cliente no necesitó el encargo |
| 24 | ENC-2026-0018 | Comfama | Geraldine Ramirez | $47K | parcial, par con caso 25 |
| 25 | ENC-2026-0007 | Comfama | Geraldine Ramirez | $39K | par con caso 24 — cuadrar entre ambos |

**Total reportado**: aproximadamente $2,558,000 (a confirmar sumando).

### Pre-clasificación de patrones (Claude debe validar/refinar al ejecutar)

- **Tipo A — Pago retroactivo simple** (cliente confirmó pago y entrega, no se registró): casos 5, 11, 14, 18 (~$120K). Decisión típica: crear entry de pago retroactivo + marcar AR como pagada via override.
- **Tipo B — Entrega no registrada con pago pendiente real**: casos 6, 9, 7, 8 (~$320K). Decisión: contactar cliente o asumir incobrable post-N días.
- **Tipo C — Cambios de prenda mal cuadrados**: casos 19, 20, 22 (~$135K). Decisión: requiere mirar descripción del encargo, contrastar con sale relacionada.
- **Tipo D — Multi-encargo del mismo cliente que se cuadran entre sí**: casos 24-25 (Geraldine Ramirez), eventualmente 17 (Jennifer Ibarguen abono parcial). Decisión: análisis conjunto.
- **Tipo E — Cliente no llevó la mercancía**: caso 23 (Carolina Loaiza). Decisión: cancelar encargo, devolver inventario si aplica, no reconocer revenue.
- **Tipo F — Casos especiales conocidos**: 13 (JUCUM $848K), 3 (Cristina Giraldo $130K — ¿relación con préstamo refinanciado?). Estos requieren input directo del owner.
- **Tipo G — Centavos perdidos** ($1K): casos 12, 21. Decisión: castigar como pérdida operativa, no vale la pena tracking.
- **Tipo H — No contesta + sin contexto**: caso 8 (Yuliza Tabares — "no tengo cómo explicar"). Decisión: pendiente hasta llamar o N días.

---

## 5. SQL helpers (pre-armados, copiar/pegar y modificar el ID)

### 5.1 Estado completo de un encargo

```sql
\set encargo_code 'ENC-2026-0058'

SELECT
  o.id, o.code, o.status, o.payment_status,
  o.total, o.total_paid,
  o.created_at, o.delivered_at,
  o.notes,
  s.name as school, s.code as school_code,
  c.full_name as client, c.document_number, c.phone
FROM orders o
LEFT JOIN schools s ON o.school_id = s.id
LEFT JOIN clients c ON o.client_id = c.id
WHERE o.code = :'encargo_code';
```

### 5.2 Items del encargo

```sql
SELECT
  oi.id, oi.quantity, oi.size, oi.unit_price, oi.subtotal,
  p.name as product_name,
  gt.name as garment
FROM order_items oi
JOIN products p ON oi.product_id = p.id
JOIN garment_types gt ON p.garment_type_id = gt.id
WHERE oi.order_id = (SELECT id FROM orders WHERE code = :'encargo_code');
```

### 5.3 AR/AP relacionados al encargo

```sql
-- AR (cuentas por cobrar)
SELECT id, amount, paid_amount, status, due_date, description, created_at
FROM accounts_receivable
WHERE order_id = (SELECT id FROM orders WHERE code = :'encargo_code')
   OR description ILIKE '%' || :'encargo_code' || '%';
```

### 5.4 Pagos registrados sobre el encargo

```sql
SELECT id, amount, payment_method, reference, status, created_at
FROM payment_transactions
WHERE reference ILIKE '%' || :'encargo_code' || '%'
ORDER BY created_at DESC;
```

### 5.5 Entries contables que mencionan el encargo

```sql
SELECT entry_date, amount, description, reference
FROM balance_entries
WHERE reference = :'encargo_code'
   OR description ILIKE '%' || :'encargo_code' || '%'
ORDER BY entry_date;
```

### 5.6 Historial completo del cliente (todos sus encargos + ventas)

```sql
WITH client AS (
  SELECT client_id FROM orders WHERE code = :'encargo_code'
)
SELECT 'order' as type, code, status, payment_status, total, created_at
FROM orders WHERE client_id = (SELECT client_id FROM client)
UNION ALL
SELECT 'sale' as type, code, NULL as status, NULL as payment_status, total_amount, created_at
FROM sales WHERE client_id = (SELECT client_id FROM client)
ORDER BY created_at DESC;
```

### 5.7 Cambios/devoluciones que referencien el encargo

```sql
SELECT sc.*, s.code as sale_code
FROM sale_changes sc
LEFT JOIN sales s ON sc.sale_id = s.id
WHERE sc.notes ILIKE '%' || :'encargo_code' || '%'
   OR sc.original_order_id = (SELECT id FROM orders WHERE code = :'encargo_code');
```

---

## 6. Template por caso (Claude llena, owner aprueba)

Claude debe escribir cada caso en este formato. Ir acumulando en `docs/v3/formalization/encargos-audit-2026-05-16.md` (crear si no existe). Actualizar incrementalmente, NO al final.

```markdown
### Caso N: ENC-2026-XXXX — <Cliente>

**Institución**: <X>
**Monto reportado vendedora**: $X
**Pattern hint** (pre-clasificación): Tipo A/B/C/D/E/F/G/H

#### Explicación vendedora (literal del xlsx)

> "..."

#### Estado en DB (prod_snapshot)

| Campo | Valor |
|-------|-------|
| orders.status | confirmed / delivered / cancelled |
| orders.payment_status | pending / partial / paid |
| orders.total | $X |
| orders.total_paid | $Y |
| Items | N items, lista breve |
| AR record | sí ($X pendiente) / no |
| Pagos registrados | N pagos, total $Z |
| Balance entries | N entries que referencian este encargo |
| Cliente — otros encargos | M encargos (lista códigos) |
| Cliente — otras ventas | K ventas (lista códigos) |
| Cliente — total histórico | $W ventas + $V encargos |

#### Análisis

- **Consistencia explicación↔DB**: <consistente / divergente / verificar>
- **¿Otros movimientos del cliente confirman?**: <sí, en venta VNT-... / no, no hay más data>
- **¿Patrón de bug del sistema?**: <sí, ver más adelante / no, error operativo único>
- **Red flags**:
  - <e.g. monto en xlsx no calza con total del encargo>
  - <e.g. cliente sin teléfono registrado>

#### Decisión propuesta

**Confidence**: alta / media / baja

**Opción recomendada** (de las siguientes):
- [ ] **A: Reconocer pago retroactivo** — crear payment_transaction backdated al X-2026 + marcar AR pagada via override.
- [ ] **B: Contactar cliente** — pendiente llamada o WhatsApp, NO tocar nada por X días.
- [ ] **C: Castigar como incobrable** — escribir AR contra cuenta "Pérdidas operativas — cobros fallidos", reducir patrimonio.
- [ ] **D: Cancelar encargo** — sin notificar cliente; devolver inventario si aplica.
- [ ] **E: Cuadrar con otro encargo/venta** — referencia a caso K.
- [ ] **F: Escalar al owner** — requiere decisión humana (caso especial).
- [ ] **G: PENDIENTE_EXTERNAL** — data fuera del sistema (WhatsApp, recibo físico).

#### Asientos contables derivados (si la decisión se aplica)

```
DEBITA: <cuenta> $X
ACREDITA: <cuenta> $Y
Concepto: "Override audit ENC-2026-XXXX: <razón breve>"
Fecha: <fecha original del encargo o today>
```

#### Override fields (para futuro `order_audit_overrides`)

```python
order_audit_overrides.insert({
  "order_id": "<uuid>",
  "real_status": "delivered",  # o el que aplique
  "real_payment_status": "paid",
  "real_paid_amount": 15000,
  "audit_explanation": "<texto>",
  "auditor_user_id": "<angel uuid>",
  "audited_at": "2026-05-16T...",
  "notify_client": false,
  "external_evidence": null,  # o ruta a WhatsApp/foto
})
```

#### Decisión final del owner

- [ ] Aprobado tal como propuesto
- [ ] Aprobado con modificación: <qué cambia>
- [ ] Rechazado, mover a tipo: <X>
- [ ] PENDIENTE — razón: <qué falta>

---
```

---

## 7. Stop gates y reglas de batch

### Stop gates obligatorios

1. **Después del caso 1**: muestra el formato completo al owner. Asegura que el detail level es adecuado. Si owner dice "menos detalle" o "más", calibra.
2. **Después de los primeros 5 casos**: pausa y resumen interino. ¿Hay patrón sistemático nuevo? ¿Vale ajustar la pre-clasificación?
3. **Cualquier caso con monto > $200K**: pausa, no proponer decisión solo. Owner decide.
4. **Casos especiales pre-marcados (Tipo F)**: nunca decidir solo. 
5. **Si descubres un bug** (e.g. `orders.total_paid` no coincide con la suma de pagos): para, documenta el bug separado en `docs/v3/formalization/encargos-audit-bugs.md`, sigue.

### Cuando se permite batch

Si owner explícitamente dice "todos los Tipo A igual" después de aprobar 2-3 ejemplos:
1. Claude muestra **plan batch** (qué casos, qué decisión por defecto, qué asiento).
2. Owner aprueba el plan.
3. Claude procesa el batch escribiendo bloques compactos (sin repetir todo el template, solo el delta).

---

## 8. Output esperado al cierre de sesión

1. **`docs/v3/formalization/encargos-audit-2026-05-16.md`** — los 25 casos analizados, con decisiones del owner marcadas.
2. **`docs/v3/formalization/encargos-audit-bugs.md`** — bugs descubiertos durante la auditoría (para alimentar M3 fix list).
3. **Resumen final** en el chat:
   - Total reconocido como pago retroactivo: $X
   - Total castigado como incobrable: $Y
   - Total cancelado (sin revenue): $Z
   - Casos PENDIENTE (contactar cliente): N
   - Bugs nuevos descubiertos: M
   - **Próximo paso**: sesión de implementación que crea tabla `order_audit_overrides`, aplica los asientos aprobados, y gatea por el discovery de M3.
4. **Sin código.** Esta sesión NO escribe migración, NO modifica DB, NO toca producción.

---

## 9. Reglas globales (NO violar)

- **NO tocar producción.** Solo SQL contra `uniformes_prod_snapshot` (read-only). Si por error apuntas a `uniformes_db` o peor a prod remota, PARA y reporta.
- **NO crear branches.** Trabajar sobre `chore/stabilization-sprint-2026-Q2`.
- **NO commitear durante la sesión** salvo que el owner pida explícitamente. El markdown se va llenando local.
- **NO instalar dependencias.** Lo que necesitas (psql via docker) ya está.
- **Mensajes y razonamientos en español.**
- **Fechas con `app.utils.timezone.get_colombia_now()`** si en algún momento generas timestamps en el doc.
- **NO inventar montos**, ni asumir que la vendedora tiene razón al 100% — siempre validar contra DB.
- **NO avanzar caso si el owner no aprobó el anterior** (salvo batch autorizado).

---

## 10. Tiempo esperado

- **Setup**: 15 min (leer xlsx, conectar DB, validar SQL helpers).
- **Por caso**: 5-15 min (dependiendo de complejidad).
- **Casos especiales (Tipo F)**: 20-40 min (discusión con owner).
- **Total**: 3-6 horas. Si pasa de 6h, **sesión 2** para los pendientes.

Si en la primera hora no has cerrado mínimo 3 casos completos con aprobación del owner, **para y reporta**: probablemente el setup del template o las queries no están bien calibrados.

---

## 11. Lo que se desencadena después (NO en esta sesión)

Esta sesión produce el **acta de decisiones**. La siguiente sesión:
1. Crea migración para `order_audit_overrides`.
2. Implementa endpoint admin para visualizar overrides.
3. Modifica reportes contables (P&L, AR aging) para LEFT JOIN overrides y mostrar la realidad audited cuando exista.
4. Crea script que aplica los asientos contables del acta.
5. Audita que `orders.status` público NO cambió.
6. Tests + commit + (eventualmente) deploy.

Esa es **otra sesión, con otro prompt**. No mezclar.
