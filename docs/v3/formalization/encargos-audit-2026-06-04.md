# Acta de Auditoría Forense de Encargos Obsoletos — UCR v3 (GATE 0)

> **Sesión:** interactiva, owner Angel + Claude (copiloto forense).
> **Fecha:** 2026-06-04
> **Estado:** ✅ **CERRADA — 25/25 casos decididos por el owner.** Lista para la sesión de implementación (`order_audit_overrides` + asientos).
> **Output:** documento de decisiones aprobadas. NO es código. NO toca producción.

---

## 0. Restricción dura

NO se puede cambiar `orders.status` ni el estado público que ve el cliente/vendedora (son encargos de meses; cambiarlos dispara notificaciones y reclamos). La realidad contable se registrará **silenciosamente** en una futura tabla `order_audit_overrides` + asientos contables — en **otra sesión**. Esta sesión solo **decide caso por caso**.

---

## 1. Fuente y data de trabajo

| Aspecto | Valor |
|---|---|
| Xlsx fuente (autoritativo) | `documentos/Conciliaciones:Auditorias/TRACKEOS ENCARGOS.xlsx` (25 filas, R2–R26) |
| DB de trabajo | `uniformes_prod_snapshot` (read-only) |
| Provenance del snapshot | **Refrescado desde prod hoy 2026-06-04** (`refresh_prod_snapshot.sh`) |
| Head Alembic | `fe_invoicing_001` (= head real de prod; el doc previo decía `v3_school_global_gt_excl_001`, prod ya avanzó una migración) |
| last_sale en snapshot | 2026-06-04 |

---

## 2. Hallazgos estructurales (afectan el match y la futura implementación)

1. **Códigos prefijados con colegio.** En v3 el código de encargo se volvió globalmente único anteponiendo el `school.code`: el `ENC-2026-0058` del xlsx es `PINAL-001-ENC-2026-0058` en la DB. El match correcto es `<SCHOOL_CODE>-<código xlsx>`. El mismo número (`ENC-2026-0042`) existe en varios colegios como encargos distintos.

2. **`balance_entries.reference` NO está prefijado.** Los anticipos se guardan con `reference = 'ENC-2026-0058'` (sin colegio) → **ambiguo entre colegios**. Ej: la referencia `ENC-2026-0058` tiene un anticipo de $47.000 (Caracas/Jeisy Retrepo) y otro de $3.000 (Pinal/Santi Mazo). Atribuir un anticipo a un encargo específico exige cruzar por **monto = `orders.paid_amount`**, no solo por referencia. *(Ver `encargos-audit-bugs.md`.)*

3. **No existe `orders.payment_status` ni `ready_at`.** El estado de pago se deriva de `balance` (`paid_amount`/`total`). El backfill §4.7 sí pobló `delivered_at` (presente en el snapshot fresco) → sirve para validar las afirmaciones "ya entregué".

4. **Esquema real relevante:** `orders(total, paid_amount, balance, status[enum: PENDING/IN_PRODUCTION/READY/DELIVERED/CANCELLED], order_date, delivery_date, delivered_at, notes)`; `accounts_receivable(amount, amount_paid, is_paid, is_overdue, due_date, order_id)`; `payment_transactions` = **solo Wompi** (pagos online), los pagos en efectivo viven en `paid_amount` + `balance_entries`.

---

## 3. Reconciliación autoritativa de los 25 casos (data fresca 2026-06-04)

**Total reportado por la vendedora: $2.362.000** (la memoria decía ~$2.56M — corregido). **24 de 25 cuadran exacto** entre "CUANTO DEBE" (vendedora) y `balance` (DB); 1 con Δ de $1.

| # | Código (prefijado) | Cliente | Debe (xlsx) | Saldo DB | Estado | Pagado/Total | Entregado | Match |
|---|---|---|---:|---:|---|---|---|:---:|
| 1 | PINAL-001-ENC-2026-0058 | Santi Mazo | 10.000 | 10.000 | READY | 3k/13k | — | ✅ |
| 2 | CARACAS-001-ENC-2026-0131 | JUCUM | 303.000 | 303.000 | READY | 0/303k | — | ✅ |
| 3 | CARACAS-001-ENC-2026-0128 | Cristina Giraldo | 130.000 | 130.000 | DELIVERED | 0/130k | 2026-03-11 | ✅ |
| 4 | PUMAREJO-001-ENC-2026-0042 | Camila Hernández | 66.000 | 66.000 | READY | 10k/76k | — | ✅ |
| 5 | CARACAS-001-ENC-2026-0124 | Gustavo Aguirre | 15.000 | 15.000 | DELIVERED | 50k/65k | 2026-02-22 | ✅ |
| 6 | PINAL-001-ENC-2026-0048 | Danelys Verdugo | 21.000 | 21.000 | DELIVERED | 25k/46k | 2026-02-27 | ✅ |
| 7 | PUMAREJO-001-ENC-2026-0036 | Laura Gallego | 103.000 | 103.000 | READY | 0/103k | — | ✅ |
| 8 | PINAL-001-ENC-2026-0057 | Yuliza Tabares | 58.000 | 57.999 | READY | 1/58k | — | ⚠️ Δ$1 |
| 9 | CARACAS-001-ENC-2026-0121 | Dahiana Rodriguez | 137.000 | 137.000 | READY | 0/137k | — | ✅ |
| 10 | PINAL-001-ENC-2026-0042 | Alejandra Ferraro | 42.000 | 42.000 | READY | 20k/62k | — | ✅ |
| 11 | PINAL-001-ENC-2026-0040 | Wilmar Guevara | 55.000 | 55.000 | DELIVERED | 50k/105k | 2026-03-12 | ✅ |
| 12 | PINAL-001-ENC-2026-0039 | Luis Manuel Robledo | 1.000 | 1.000 | DELIVERED | 105k/106k | 2026-03-12 | ✅ |
| 13 | CARACAS-001-ENC-2026-0118 | JUCUM | 848.000 | 848.000 | DELIVERED | 0/848k | 2026-02-13 | ✅ |
| 14 | PUMAREJO-001-ENC-2026-0025 | Orfa Cartagena | 32.000 | 32.000 | DELIVERED | 50k/82k | 2026-03-12 | ✅ |
| 15 | CARACAS-001-ENC-2026-0106 | Adriana Giraldo | 90.000 | 90.000 | READY | 0/90k | — | ✅ |
| 16 | CARACAS-001-ENC-2026-0099 | Dayana Mosquera | 14.000 | 14.000 | READY | 31k/45k | — | ✅ |
| 17 | CARACAS-001-ENC-2026-0096 | Jennifer Ibarguen | 96.000 | 96.000 | READY | 96k/192k | — | ✅ |
| 18 | CARACAS-001-ENC-2026-0094 | Luz Mary Mma | 20.000 | 20.000 | READY | 124k/144k | — | ✅ |
| 19 | CARACAS-001-ENC-2026-0093 | Laura Orozco | 48.000 | 48.000 | READY | 0/48k | — | ✅ |
| 20 | CARACAS-001-ENC-2026-0091 | Johana Guerra | 42.000 | 42.000 | READY | 100k/142k | — | ✅ |
| 21 | CARACAS-001-ENC-2026-0078 | Karenny Castillo | 1.000 | 1.000 | READY | 44k/45k | — | ✅ |
| 22 | CARACAS-001-ENC-2026-0072 | Sebastian Guzman | 45.000 | 45.000 | DELIVERED | 0/45k | 2026-02-14 | ✅ |
| 23 | PUMAREJO-001-ENC-2026-0015 | Carolina Loaiza | 99.000 | 99.000 | READY | 0/99k | — | ✅ |
| 24 | CONFAMA-001-ENC-2026-0018 | Geraldine Ramirez | 47.000 | 47.000 | READY | 100k/147k | — | ✅ |
| 25 | CONFAMA-001-ENC-2026-0007 | Geraldine Ramirez | 39.000 | 39.000 | READY | 50k/89k | — | ✅ |

**Reparto:** 8 `DELIVERED` con saldo ($1.147.000, entregados sin registrar pago) · 17 `READY` con saldo ($1.215.000). **JUCUM concentra $1.151.000 = 49%** (casos 2 + 13).

**Leyenda decisión:** `A` pago retroactivo · `B` contactar cliente · `C` incobrable · `D` cancelar · `E` cuadrar con otro · `F` escalar owner · `G` PENDIENTE_EXTERNAL.

---

## 4. Casos

<!-- Se llena incrementalmente. Cada caso espera aprobación del owner antes de avanzar. -->

### Caso 1: PINAL-001-ENC-2026-0058 — Santi Mazo

**Institución:** El Pinal · **Monto reportado vendedora:** $10.000 · **Pattern hint:** Tipo A (pago retroactivo simple)

#### Explicación vendedora (literal)
> "ya pago, pero no registraron el pago"

#### Estado en DB (snapshot 2026-06-04)

| Campo | Valor |
|---|---|
| status | **READY** (no entregado) |
| total | $13.000 |
| paid_amount | $3.000 (anticipo 2026-03-19) |
| balance | **$10.000** (= lo que reporta la vendedora ✅) |
| order_date | 2026-03-19 |
| delivered_at | — (NULL) |
| Items | 1× **Correa** talla 14, $13.000 |
| AR | $10.000 pendiente, `is_paid=false`, vence 2026-04-18, "Saldo pendiente encargo" |
| Pagos Wompi | ninguno (pago en efectivo) |
| Balance entries | anticipo **$3.000** (2026-03-19) atribuible a Santi por monto; el $47.000 de la misma referencia es de otro cliente (Caracas) |
| Cliente — historial | venta `CARACAS-001-VNT-2026-0784` $50.000 **COMPLETED/pagada** (2026-03-01) + este encargo |
| Teléfono | 3218294403 |

#### Análisis
- **Consistencia explicación↔DB:** **parcial.** El saldo $10.000 calza exacto. Pero el encargo está `READY`, no `DELIVERED` — "ya pagó" no implica que lo recogió. La hipótesis de la vendedora es que el cliente abonó el saldo completo y no se registró.
- **¿Otros movimientos lo confirman?** Indirecto: Santi es cliente que **sí paga** (venta de $50.000 saldada el mismo mes). Respalda credibilidad, no prueba este pago.
- **¿Bug del sistema?** No. Error operativo de registro de pago en efectivo.
- **Red flags:** ninguno material. Monto bajo ($10K), cliente confiable, correa de $13K.

#### Decisión propuesta — **Confidence: MEDIA**

**Opción recomendada: A — Reconocer pago retroactivo.** Registrar el pago faltante de $10.000 (efectivo) y marcar el AR como pagado vía override. NO se toca `orders.status` (sigue READY hasta entrega real).

*Riesgo:* confiamos en el dicho de la vendedora sin recibo físico. Mitigado por monto bajo y perfil de pago del cliente. Alternativa conservadora si el owner prefiere prueba: **G (PENDIENTE_EXTERNAL)** — confirmar con un WhatsApp al 3218294403.

#### Asientos contables derivados (si se aplica A)
```
DEBITA:  Caja                         $10.000
ACREDITA: Cuentas por cobrar (AR)      $10.000
Concepto: "Override audit ENC-2026-0058: pago retroactivo saldo encargo Santi Mazo"
Fecha:    fecha de pago real (o today si se desconoce)
```
*(El ingreso/revenue ya se reconoció por accrual al crear el encargo; este asiento solo mueve AR → Caja, no re-reconoce ingreso.)*

#### Override fields (futuro `order_audit_overrides`)
```python
{
  "order_id": "fbabb0fc-4b1e-4746-96a9-9e9539422565",
  "real_status": "delivered",       # owner: SÍ fue entregado
  "real_paid_amount": 13000,        # 3000 + 10000
  "real_balance": 0,
  "audit_explanation": "Vendedora confirma entrega + pago completo no registrados; saldo $10k calza con balance DB.",
  "notify_client": false,           # CRÍTICO: no disparar email de entrega al cliente
  "external_evidence": null,
}
```

#### Decisión final del owner
- [x] **Aprobado con modificación (2026-06-04):** Opción **A** (pago retroactivo $10.000) **+ `real_status = delivered`** (sí fue entregado), con **`notify_client = false`** para no enviar email de entrega al cliente. `orders.status` público NO se toca.

---

> **PRINCIPIO DE SESIÓN (fijado en Caso 1):** cuando la vendedora afirma "entregué y pagué" y el monto calza con `balance`, el override registra `real_status=delivered` + `real_paid_amount=total` + `notify_client=false`. La entrega NO genera asiento contable adicional (el ingreso ya se acumuló por accrual); el único asiento es el del pago (Caja/CxC).

---

### Casos 2 + 13: JUCUM (Fundación) — análisis CONJUNTO · **Tipo F (escalado al owner)**

> Los dos encargos son de la misma fundación "Confesión Juventud Con Una Misión (JUCUM) en Medellín". Suman **$1.151.000 = 49% de toda la conciliación**. Ambos `paid_amount = $0`. Se deciden juntos. **NO decidir sin el owner** (>$200K + caso especial conocido: la vendedora anota *"el tema de la fundación JUCUM mi mamá me dijo q ya lo sabías"*).

#### Estado en DB (snapshot 2026-06-04)

| Encargo | Estado | Total | Pagado | Saldo | Creado | Entregado | Vence AR |
|---|---|---:|---:|---:|---|---|---|
| `…ENC-2026-0118` (caso 13) | **DELIVERED** | 848.000 | **0** | 848.000 | 2026-02-13 | 2026-02-13 | 2026-03-15 |
| `…ENC-2026-0131` (caso 2) | **READY** | 303.000 | **0** | 303.000 | 2026-03-07 | — | 2026-04-06 |

**Contenido 0118 ($848K):** mayormente calzado — 4× Tennis Nike ($340K), 2× Zapatos goma ($175K), + sudaderas/camisetas/chompa escolares. Parece dotación completa (calzado + uniforme) de varios niños de la fundación.
**Contenido 0131 ($303K):** 3× Chompa gris L ($180K), 6× Blusa ($123K). Uniforme escolar.

**Sin anticipos:** 0 `balance_entries`, 0 pagos Wompi. Si entró dinero, fue 100% sin registrar.

#### Análisis
- El encargo 0118 se **entregó el 13-feb con $0 pagado**: $848K de mercancía (mucho Nike) salió a crédito puro a la fundación. El 0131 está listo, sin entregar, también sin pagar.
- La nota de la vendedora en 0131 dice "ya pagó pero no registraron"; pero **no hay rastro de pago** y la nota de 0118 remite a un acuerdo que el owner ya conoce → esto **no es un error de registro normal**, es un arreglo especial fundación↔negocio que solo el owner puede caracterizar.

#### Decisión final del owner (2026-06-04)

- [x] **0118 ($848K): CxC real — la fundación va a pagar.** Se mantiene como cuenta por cobrar.
- [x] **0131 ($303K): mismo trato → CxC real.** Se mantiene como cuenta por cobrar.

**Implicación contable: NINGÚN asiento ni override de pago.** El sistema **ya refleja la realidad**: 0118 `DELIVERED` con AR de $848K abierto, 0131 `READY` con AR de $303K abierto. La decisión confirma que estos **$1.151.000 son un activo cobrable legítimo, NO un encargo huérfano a castigar**. No se reconoce pago (no entró dinero) ni se castiga.

**Única acción recomendada (gestión de AR, fuera del override):** las dos AR están **vencidas** (0118 venció 2026-03-15, 0131 el 2026-04-06). Actualizar `due_date` a un plan de pago realista acordado con la fundación, para que no figuren como mora indefinida en el aging.

> **Nota de riesgo (no contable):** $848K de mercancía —mayormente Nike— entregada a crédito puro sin abono es una exposición real. Conviene formalizar el acuerdo de pago con la fundación. Documentado aquí para visibilidad del owner; no afecta los asientos.

---

## 5. Disposición propuesta de los 22 casos restantes

> Pre-clasificados por Claude con la data fresca + cruces de soporte. **Esperan aprobación del owner.** Los marcados 🔴 requieren decisión humana antes de cerrarse.

| # | Cliente | Saldo | Estado DB | Disposición propuesta | Conf. |
|---|---|---:|---|---|---|
| 5 | Gustavo Aguirre | 15.000 | DELIVERED | **A** pago retro (vendedora llamó, confirmó) | alta |
| 14 | Orfa Cartagena | 32.000 | DELIVERED | **A** pago retro (vendedora llamó, confirmó) | alta |
| 15 | Adriana Giraldo | 90.000 | READY | **A**+entregado (llamó, "llevó y pagó todo") | alta |
| 18 | Luz Mary Mma | 20.000 | READY | **A**+entregado (llamó, confirmó) | alta |
| 7 | Laura Gallego | 103.000 | READY | **A**+entregado (domicilio, la vendedora lo entregó, "sí entró el dinero") | alta |
| 6 | Danelys Verdugo | 21.000 | DELIVERED | **A** pago retro (no contesta, entregado → muy probable) | media |
| 11 | Wilmar Guevara | 55.000 | DELIVERED | **A** pago retro (no contesta, entregado → probable) | media |
| 19 | Laura Orozco | 48.000 | READY | **E** cancelar saldo fantasma (cambio talla; orig `VNT-0673` pagada $47K) + marcar entregado | alta |
| 22 | Sebastian Guzman | 45.000 | DELIVERED | **E** cancelar saldo fantasma (cambio talla; orig `VNT-0688` pagada $88K) | alta |
| 20 | Johana Guerra | 42.000 | READY | **E** cancelar saldo fantasma (cambió a Felix; `FELIX-…0003` pagado+entregado) | alta |
| 17 | Jennifer Ibarguen | 96.000 | READY | **A+D** reconocer 3 prendas entregadas+pagadas, **cancelar jean $48K** (no lo llevó) | media |
| 23 | Carolina Loaiza | 99.000 | READY | **D** cancelar (no necesitó el encargo, no lo llevó); devolver inventario | alta |
| 12 | Luis M. Robledo | 1.000 | DELIVERED | **C** castigar $1K (pérdida operativa, centavos) | alta |
| 21 | Karenny Castillo | 1.000 | READY | **C** limpiar saldo $1K — **sin AR** (no hay CxC que castigar) | alta |
| 16 | Dayana Mosquera | 14.000 | READY | **B** CxC real (abono parcial 31/45, no contesta, sin entregar) | media |
| 10 | Alejandra Ferraro | 42.000 | READY | **B** CxC real ("dice que viene y no viene"; abono 20/62) | media |
| 24 | Geraldine Ramirez | 47.000 | READY | **B** layaway activo (par con 25) — no es error | alta |
| 25 | Geraldine Ramirez | 39.000 | READY | **B** layaway activo (pagó $150K, lleva 2/5 prendas, sigue) | alta |
| 8 | Yuliza Tabares | 57.999 | READY | **B** CxC + limpiar bug $1 (Tipo H, "no tengo cómo explicar") | baja |
| 9 | Dahiana Rodriguez | 137.000 | READY | ✅ **B — CxC real** (owner) — se deja como cobrable vigente | — |
| 3 | Cristina Giraldo | 130.000 | DELIVERED | ✅ **A — reconocer pago** (owner); **NO** es la Cristina del préstamo $19M | — |
| 4 | Camila Hernández | 66.000 | READY | ✅ **B — CxC real $66K** (owner) — el $346K se reembolsó (resuelto) | — |

**Totales por disposición (propuesta):** A pago-retro ≈ **$236K** (5,14,15,18,7) + $76K inferidos (6,11) · E cancelar-fantasma ≈ **$135K** (19,22,20) · D cancelar ≈ **$99K** (23) + jean $48K (17) · C castigar ≈ **$2K** (12,21) · B CxC-real/layaway ≈ **$337K** (16,10,24,25,8,9 + parte de 17) · 🔴 escalado ≈ **$333K** (3,4,9).

---

## 6. Bloques por caso (detalle)

### Grupo A — Pago retroactivo (vendedora confirmó por llamada) · **principio Caso 1**

**Caso 5 · `CARACAS-001-ENC-2026-0124` · Gustavo Aguirre · $15.000**
> "Lo llamé, me contestó. ya se le entregó y ya pagó, no se le registró el pago"
- DB: DELIVERED 2026-02-22, pagado 50k/65k, saldo $15k ✅. → **A**: registrar pago $15.000. Asiento `Caja 15.000 / CxC 15.000`. Conf. **alta** (confirmado por llamada).
- [ ] Owner aprueba A

**Caso 14 · `PUMAREJO-001-ENC-2026-0025` · Orfa Cartagena · $32.000**
> "la llamé, ya se le entregó. se marcó como entregado. pero no se registró pago"
- DB: DELIVERED 2026-03-12, pagado 50k/82k, saldo $32k ✅. → **A**: `Caja 32.000 / CxC 32.000`. Conf. **alta**.
- [ ] Owner aprueba A

**Caso 15 · `CARACAS-001-ENC-2026-0106` · Adriana Giraldo · $90.000**
> "la llamé, llevó y pagó todo lo registrado bajo su nombre… este encargo se les olvidó registrar pago y marcar entregado"
- DB: READY, pagado 0/90k, saldo $90k ✅. → **A + entregado** (`real_status=delivered`, `notify_client=false`): `Caja 90.000 / CxC 90.000`. Conf. **alta**.
- [ ] Owner aprueba A+entregado

**Caso 18 · `CARACAS-001-ENC-2026-0094` · Luz Mary Mma · $20.000**
> "la llamé y me explicó q sí las llevó. Y sí las pagó. entonces no se registró entrega ni pago"
- DB: READY, pagado 124k/144k, saldo $20k ✅. → **A + entregado**: `Caja 20.000 / CxC 20.000`. Conf. **alta**.
- [ ] Owner aprueba A+entregado

**Caso 7 · `PUMAREJO-001-ENC-2026-0036` · Laura Gallego · $103.000**
> "fue un domicilio q ni se registró el pago ni se cambió el estado. llamé a la clienta, me recordó, se lo entregué yo. el error fue mío, pero sí entró el dinero."
- DB: READY, pagado 0/103k, saldo $103k ✅, notas="Domicilio", 2 items. → **A + entregado**: `Caja 103.000 / CxC 103.000`. Conf. **alta** (la vendedora lo entregó personalmente).
- [ ] Owner aprueba A+entregado

### Grupo A' — Pago retroactivo inferido (entregado pero vendedora NO contactó al cliente)

**Caso 6 · `PINAL-001-ENC-2026-0048` · Danelys Verdugo · $21.000**
> "no contesta, como ya está entregado es muy probable q no se haya registrado el pago"
- DB: DELIVERED 2026-02-27, pagado 25k/46k, saldo $21k ✅. → **A** (inferido) o **B** (llamar primero). Conf. **media**.
- [ ] Owner: A reconocer · [ ] B contactar primero

**Caso 11 · `PINAL-001-ENC-2026-0040` · Wilmar Guevara · $55.000**
> "no contesta, parece ser que no se registró el pago ya que todo está marcado como entregado"
- DB: DELIVERED 2026-03-12, pagado 50k/105k, saldo $55k ✅. → **A** (inferido) o **B**. Conf. **media**.
- [ ] Owner: A reconocer · [ ] B contactar primero

### Grupo E — Saldos fantasma por cambio de prenda/colegio (verificados contra venta original)

**Caso 19 · `CARACAS-001-ENC-2026-0093` · Laura Orozco · $48.000**
> notas DB: "Encargo automático por cambio de venta VNT-2026-0673. Motivo: la talla 12 era muy pequeña"
- Venta original `VNT-2026-0673`: **COMPLETED, $47.000 pagada 100%**. El saldo $48k del encargo es **fantasma** (la clienta ya pagó el original; solo cambió de talla). → **E**: cancelar saldo fantasma, marcar entregado, `notify_client=false`. Δ real ≈ $1k (48-47), despreciable. Conf. **alta**.
- [ ] Owner aprueba E

**Caso 22 · `CARACAS-001-ENC-2026-0072` · Sebastian Guzman · $45.000**
> notas DB: "Encargo automático por cambio de venta VNT-2026-0688. Motivo: cambio de talla"
- Venta original `VNT-2026-0688`: **COMPLETED, $88.000 pagada 100%**. Saldo $45k **fantasma** (ítem ya pagado en la venta original). Encargo ya DELIVERED. → **E**: cancelar saldo fantasma. Conf. **alta**.
- [ ] Owner aprueba E

**Caso 20 · `CARACAS-001-ENC-2026-0091` · Johana Guerra · $42.000**
> "cambio de caracas a felix henao"
- Encargo Caracas: READY, pagado 100k/142k. Encargo destino `FELIX-001-ENC-2026-0003`: **DELIVERED, $135.000 pagado 100%**. El abono de Caracas migró al de Felix (que está saldado y entregado). Saldo $42k de Caracas es **fantasma**. → **E**: cancelar/cuadrar el saldo Caracas contra el de Felix. Conf. **alta**.
- [ ] Owner aprueba E

### Grupo D — Cancelaciones / no llevó la mercancía

**Caso 23 · `PUMAREJO-001-ENC-2026-0015` · Carolina Loaiza · $99.000**
> "la llamé y me explicó q no necesitó el encargo. entonces ni lo llevó"
- DB: READY, pagado 0/99k, 2 items. → **D**: cancelar encargo, devolver inventario, **no reconocer ingreso**. Reversa del accrual: `Ingreso/Revenue 99.000 / CxC 99.000` (anula la CxC y el ingreso acumulado). Conf. **alta**.
- [ ] Owner aprueba D

**Caso 17 · `CARACAS-001-ENC-2026-0096` · Jennifer Ibarguen · $96.000** (híbrido A+D)
> "quedó con saldo porque no llevó el blue jean… dio el abono y luego el restante de las otras 3 prendas sin el jean. la llamé y confirmó todo"
- DB: READY, total $192k, pagado 96k, saldo $96k. Items: Camiseta $44k (delivered), Chompa $54k (delivered), Sudadera $46k (delivered), **Jean $48k (ready, no lo llevó)**. Historial: venta `VNT-0568` $108k pagada.
- Realidad: pagó+recibió las 3 prendas ($144k); el jean ($48k) no lo llevó. → **A** reconocer pago de las 3 entregadas (registrar +$48k para cubrirlas) **+ D** cancelar el jean ($48k). Resultado: saldo → $0. Conf. **media** (confirmado por llamada).
- [ ] Owner aprueba A+D (reconocer 3 entregadas, cancelar jean)

### Grupo C — Centavos (write-off / limpieza)

**Caso 12 · `PINAL-001-ENC-2026-0039` · Luis M. Robledo · $1.000** → DELIVERED, pagado 105k/106k. **C** castigar $1k pérdida operativa. Conf. alta. · [ ] Owner aprueba
**Caso 21 · `CARACAS-001-ENC-2026-0078` · Karenny Castillo · $1.000** → READY, pagado 44k/45k, **0 registros AR** (confirma "ni aparece en CxC/CxP"). **C** limpiar saldo $1k, no hay CxC que castigar. Conf. alta. · [ ] Owner aprueba

### Grupo B — CxC real / pendientes genuinos / layaway (NO son errores; el sistema ya los refleja)

**Caso 16 · `CARACAS-001-ENC-2026-0099` · Dayana Mosquera · $14.000** → READY, abono 31k/45k, no contesta, sin entregar. Pedido legítimo en curso. **B** mantener CxC. · [ ] Owner
**Caso 10 · `PINAL-001-ENC-2026-0042` · Alejandra Ferraro · $42.000** → READY, abono 20k/62k, "dice que viene y no viene". **B** CxC real; revisar a N días → eventual cancelación. · [ ] Owner
**Casos 24+25 · `CONFAMA-001-ENC-2026-0018/0007` · Geraldine Ramirez · $47.000 + $39.000** → 5 prendas en 2 encargos, pagó $150k, lleva 2 (Sudadera+Chompa, $103k entregados), irá llevando el resto "pa lo que le alcanza". **Layaway activo, no error.** **B** dejar como está; se autoresuelve. · [ ] Owner
**Caso 8 · `PINAL-001-ENC-2026-0057` · Yuliza Tabares · $57.999** → READY, Tipo H ("varias compras bajo confama, no tengo cómo explicar"). **B** CxC + limpiar bug $1 (`BUG-ENC-02`). Conf. baja. · [ ] Owner

### Grupo 🔴 — Escalados (requieren decisión del owner)

**Caso 9 · `CARACAS-001-ENC-2026-0121` · Dahiana Rodriguez · $137.000**
> "se lo entregaron en domicilio, no fui yo, debió ser Angelo, no le dieron ni entregado ni registraron el pago"
- DB: READY, pagado 0/137k, "Domicilio", 2 items. Clienta confirma que **lo recibió** (domicilio por Angelo), pero **el pago no está claro**. Monto alto. → 🔴 decisión owner: **A** (si Angelo confirma que cobró) vs **B** (contactar/confirmar con Angelo).
- [ ] Owner decide

**Caso 3 · `CARACAS-001-ENC-2026-0128` · Cristina Giraldo · $130.000** · **Tipo F**
> "ya pagó, pero no registraron el pago (es un jomber, y los jomber no se hacen sin el pago)"
- DB: DELIVERED 2026-03-11, pagado 0/130k, saldo $130k. La lógica del negocio (jomber se hace solo prepagado) **apoya** que sí pagó → **A**. PERO está pre-marcado Tipo F por posible relación con el **préstamo Cristina $19M** ([[cristina-loan-19m-vigente]]). Apellido "Giraldo" ≠ "Rios"/"Londoño" del préstamo → probablemente personas distintas, pero el owner confirma.
- [ ] Owner: A (reconocer pago) · [ ] ¿misma Cristina del préstamo? sí/no

**Caso 4 · `PUMAREJO-001-ENC-2026-0042` · Camila Hernández · $66.000**
> "no contesta… misma prenda bajo pedido web ENC-0038 (con comprobante) y ENC-0037 (mismas prendas), ambos cancelados, lo cual no tiene sentido ya que hay un pago y el único activo es el de $66K"
- DB: `ENC-0037` web **CANCELLED $346k pagado $0** · `ENC-0038` web **CANCELLED $346k pagado $346k (100%)** · `ENC-0042` READY $76k pagado $10k saldo $66k.
- **RESUELTO por rastreo de `balance_entries`:** el $346.000 **NO está atrapado** → se pagó (+346.000 el 2026-03-11) y se **reembolsó completo** (−346.000 el 2026-04-10, nota *"Cancelación encargo ENC-2026-0038 - es el mismo bololo que acabé de cancelar"*). **Neto cero.** Eran dos órdenes web duplicadas (mismas 7 prendas) que ya se cancelaron+reembolsaron. El AR quedó mal (`is_paid=true`) → ver `BUG-ENC-03`.
- El único activo real es `ENC-0042`: **1 Chompa, saldo $66.000** = CxC legítima.

#### Decisión final del owner (2026-06-04)
- [x] **B — CxC real $66.000.** El lío del $346k está resuelto (reembolsado). Sin override de pago; el saldo $66k es una cuenta por cobrar viva legítima (1 Chompa, READY).

---

## 7. Cierre — Ledger de decisiones y balance contable (firmado 2026-06-04)

### 7.1 Decisión final por caso (25/25)

| Disposición | Casos | $ | Acción |
|---|---|---:|---|
| **A — Pago retroactivo** (reconocer Caja/CxC; entregado donde aplica, `notify_client=false`) | 1, 3, 5, 6, 7, 11, 14, 15, 18, + parte de 17 | **$524.000** | Registrar pago efectivo no contabilizado |
| **E — Cancelar saldo fantasma** (cambio ya pagado en venta origen) | 19, 20, 22 | **$135.000** | Anular CxC + reversar accrual duplicado |
| **D — Cancelar / no llevó** (sin ingreso) | 23, + jean de 17 | **$147.000** | Reversar accrual, devolver inventario |
| **C — Castigar centavos** | 12, 21 | **$2.000** | Pérdida operativa / limpiar |
| **B — CxC real / layaway** (legítimo, sin acción) | 2, 4, 8, 9, 10, 13, 16, 24, 25 | **$1.554.000** | Mantener como cobrable (incl. JUCUM $1.151M) |
| | **Total** | **$2.362.000** | ✅ cuadra con el reporte de la vendedora |

### 7.2 Impacto neto en los libros

- **Caja reconocida (entró sin registrar):** **+$524.000** → asientos `DEBITA Caja / ACREDITA CxC`. NO es ingreso nuevo (ya se acumuló por accrual); convierte CxC → Caja.
- **CxC depurada:** **$808.000** de receivables se limpian del aging — $524k cobrados + $135k fantasma + $147k cancelado + $2k castigado.
- **Reversa de ingreso (anti doble-conteo):** **−$284.000** → $135k (encargos-fantasma de cambio que duplicaban el ingreso de la venta original) + $147k (mercancía no entregada) + $2k (pérdida).
- **CxC legítima confirmada:** **$1.554.000** permanece como activo cobrable real (de los cuales **JUCUM = $1.151.000**, el 49%, ratificado como cobrable, no huérfano).

> **Lectura:** de los $2.362.000 reportados como "anómalos", **$808.000 (34%) se resuelven** (cobro / cancelación / castigo) y **$1.554.000 (66%) eran cuentas por cobrar legítimas** mal percibidas como huérfanas. Solo **$149.000** (E+D+C) representan pérdida/reversa real de ingreso; el resto es dinero que entró o que sigue siendo cobrable.

### 7.3 Implementación — ✅ DESPLEGADO A PROD (2026-06-04, v3.1.0)

> El arreglo está implementado, probado y **aplicado en producción** (commit `81019aa`, release v3.1.0): migración `order_audit_override_001` + script `--commit` → 25 overrides, **$524.000 caja materializada**, `orders.status` intacto, idempotente. AR pendiente prod $10.701.999 → $10.419.999 (−$282.000). Backup pre-deploy: VPS `/root/db_backups/uniformes_pre_encargos_20260604_235351.sql`. Artefactos:
> - Modelo `backend/app/models/order_audit_override.py` + migración `order_audit_override_001` (down_revision `catalog_order_001`; up/down/up OK).
> - Servicio `backend/app/services/order_audit.py` (`apply_override` idempotente + helpers de reporte).
> - Script `backend/scripts/apply_encargos_audit.py` (dry-run/`--commit`). Resultado en dev: **25/25 aplicados, $524.000 caja reconocida, `orders.status` intacto, idempotente** (re-run salta 25).
> - Reportes override-aware: AR pendiente (`global_accounting.py`) cae **−$282.000** (resueltos), revenue accrual excluye el fantasma entregado (−$45.000 doble-conteo). Endpoint `GET /api/v1/global/accounting/order-audit-overrides`.
> - Tests: `tests/unit/test_order_audit_service.py` (6/6 PASSED); 58 tests de accounting/reports existentes sin romper.
>
> **Despliegue a prod:** `alembic upgrade head` (aplica `catalog_order_001` + `order_audit_override_001`) → `python -m scripts.apply_encargos_audit` (dry-run) → `--commit`. Backup previo de la DB. Verificar `orders.status` de los 25 sin cambios.

**Reglas de diseño aplicadas (referencia):**

1. Crear `order_audit_overrides` (migración) con campos: `order_id, real_status, real_paid_amount, real_balance, audit_explanation, notify_client(=false), external_evidence, auditor_user_id, audited_at`.
2. **Identidad = código prefijado** (`<SCHOOL>-ENC-…`); para asientos de anticipo cruzar `balance_entries` por **monto**, no solo por `reference` (BUG-ENC-01).
3. Aplicar asientos del §7.1 (A: Caja/CxC; D/E: reversa ingreso/CxC; C: pérdida). **NO** tocar `orders.status` público; la realidad va solo en el override.
4. `LEFT JOIN` de overrides en P&L y AR aging para mostrar la realidad auditada.
5. Para JUCUM (B): actualizar `due_date` vencidas a un plan de pago realista (gestión de AR, no override).
6. Limpiar: bug $1 de Yuliza (caso 8) + AR fantasma de órdenes canceladas (BUG-ENC-03).
7. Verificar al final que `orders.status` público de los 25 NO cambió.

---
