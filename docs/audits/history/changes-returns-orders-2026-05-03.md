# Audit: Cambios, devoluciones, encargos y cuentas por cobrar

**Fecha:** 2026-05-03
**Alcance:** backend (sale_changes, order_changes, accounting flows) contra DB de desarrollo (snapshot ~marzo 2026 desde producción)
**Método:** análisis estático del código + auditoría sobre datos reales (`uniformes-postgres` Docker, 5432, 295 órdenes / 1507 ventas / 27 order_changes / 41 sale_changes)
**Auditor:** Claude (sesión interactiva con Angel)

---

## TL;DR — Resumen ejecutivo

El sistema de cambios y devoluciones tiene **brechas estructurales** entre tres dimensiones que deberían estar coordinadas y no lo están:

1. **Lifecycle físico del item** (`item_status` + `reserved_from_stock`) — el código solo maneja correctamente el caso de items reservados desde stock; los items en producción o ya hechos custom quedan huérfanos sin registro al cambiarse
2. **Estado contable del encargo/venta** (`paid_amount`, `total`, receivable) — los cambios mutan unas dimensiones pero no las otras, generando saldos a favor invisibles, ventas con totales inflados y receivables desincronizados
3. **Identidad de los códigos** — `orders.code` no tiene UNIQUE constraint y se duplica sistemáticamente

**Veredicto:** la lógica actual es funcional para el camino feliz (cambio de talla con stock disponible), pero **el 53% de los cambios reales aprobados en producción cae fuera de ese camino** y queda con artefactos sin remediar.

**Pérdidas identificables verificables:** ~$96k en saldos a favor invisibles + ~$80k en stock no recuperado + 4k en cuenta contable mal asignada = **~$180k**. Pérdidas latentes (prendas huérfanas sin contabilizar): subtotal acumulado ~$580k que necesita decisión gerencial.

Hay **8 findings CRITICAL/HIGH** que justifican refactor del flujo completo de aprobación de cambios. El plan acordado es: **(a) tracking de errores en cuentas x cobrar y estados** ya iniciado para migración manual posterior, **(b) corregir la lógica para hacerla robusta hacia adelante** (este documento es la referencia).

---

## 1. Universo auditado

| Tabla | Total | Detalle |
|-------|-------|---------|
| `orders` | 295 | 199 entregados, 20 cancelados |
| `sales` | 1507 | 1490 completadas, 17 canceladas |
| `order_changes` | 27 | 19 aprobados, 8 pendientes (1 con order_id asociado) |
| `sale_changes` | 41 | 29 aprobados, 12 pendientes (1 `pending_stock`) |

Distribución por tipo:
- **sale_changes**: `size_change` (35), `product_change` (5). **Cero RETURN, cero DEFECT** en data real
- **order_changes**: `size_change` (21), `product_change` (3), `return` (3)

---

## 2. Tabla de findings priorizada

| # | Severity | Área | File:line | Descripción |
|---|----------|------|-----------|-------------|
| 1 | **CRITICAL** | Validación advance_payment | `backend/app/services/order/creation.py:166` | `paid_amount = order_data.advance_payment or Decimal("0")` no valida que sea ≤ `total`. Vendedor digita 96k de anticipo en encargo de 48k, sistema acepta y queda con `balance` computed = -49k (saldo a favor invisible). Confirmado en `ENC-2026-0117` (49k excess), `ENC-2026-0028` (46k excess), `ENC-2026-0012` (1k excess). Total: $96k. |
| 2 | **CRITICAL** | Doble aplicación price_adjustment | `backend/app/services/order/changes.py:268-304` | Bloque A (`txn_service.record(EXPENSE)`) y Bloque B (`receivable.amount += price_adjustment`) corren simultáneamente sin lógica condicional. Cuando `paid_amount < total` y método ≠ `credit`, cliente recibe cash refund **Y** ve su deuda reducida. Pérdida directa al negocio. |
| 3 | **CRITICAL** | Items huérfanos sin tracking físico | `backend/app/services/order/changes.py:175-254` | `approve_order_change` solo libera stock si `reserved_from_stock=True`. Items con `item_status in (IN_PRODUCTION, READY)` y `reserved_from_stock=False` (production o made-to-order) se mutan en sitio: `product_id`, `size`, etc. quedan apuntando al producto nuevo, y la prenda física original (sudadera con escudo, talla específica) queda sin referencia en el sistema. **53% de cambios aprobados (10/19) cayeron en este caso en producción.** Subtotal acumulado de items afectados: ~$580k. |
| 4 | **CRITICAL** | Codes de encargo duplicados | `backend/app/services/order/creation.py` (generación de code) | 61 códigos `ENC-2026-XXXX` duplicados entre 2-7 veces (ej: `ENC-2026-0001` tiene 7 órdenes únicas). No hay `UNIQUE` constraint en `orders.code` ni race-safe generation. Rompe búsquedas, reportes y joins por code. |
| 5 | **HIGH** | Sale.total nunca se actualiza | `backend/app/services/sale/changes.py:282-407` | `approve_sale_change` no muta `Sale.total` ni `SaleItems`. Una venta con cambio aprobado de price_adjustment≠0 sigue reportando su total original. 22 ventas con `price_adjustment ≠ 0` acumulan $5k de revenue inflado. **Reportes de ingresos, COGS y márgenes son sistemáticamente erróneos.** |
| 6 | **HIGH** | Order.paid_amount desincronizado de receivable | `backend/app/services/order/changes.py:268-304` | `approve_order_change` recalcula `Order.subtotal/total` pero no toca `Order.paid_amount` cuando emite cash refund. Resultado: `Order.balance = total - paid_amount` queda inflado mientras la transacción de salida ya ocurrió. Inconsistencia interna. |
| 7 | **HIGH** | Encargos auto-creados sin link financiero | `backend/app/services/sale/changes.py:241-259` | `_create_change_with_order` (sale change con stock-out) settlea `price_adjustment` en cash inmediato y crea encargo nuevo con `paid_amount=0`. El "saldo a favor del cliente" generado por la venta original no se aplica al encargo nuevo. **2 casos detectados:** ENC-2026-0072 (delivered con paid=0!) y ENC-2026-0093. El primero salió por la puerta sin que se cobrara nada. |
| 8 | **HIGH** | EXPENSE de cambios en cuenta equivocada | `backend/app/services/order/changes.py:277`, `backend/app/services/sale/changes.py:226,360` | Las 3 funciones registran EXPENSE sin `force_income_map=True`. Los reembolsos hitean Caja Mayor (1102 — destino de gastos del negocio) en vez de Caja Menor (1101 — origen de los anticipos cash). Comparación: `cancel_order` y `cancel_sale` SÍ usan el flag (orden/cancellation.py:101, sale/cancellation.py:142). En data real: 4 EXPENSE por $4k cayeron en Caja Mayor, sesgando reportes de gastos operativos. |
| 9 | **HIGH** | No hay concepto de saldo a favor / customer credit | `backend/app/models/accounting.py:689` | `AccountsReceivable.amount` tiene `CHECK > 0` → imposible representar saldos negativos. No existe tabla `customer_credits`, columna en `clients`, ni patrón equivalente. Cuando un cambio genera saldo a favor, las únicas salidas son cash refund (Bug #2) o desincronización silenciosa (Bug #1). Imposible aplicar a otro encargo del mismo cliente. |
| 10 | **HIGH** | Truncamiento silencioso del refund en receivables | `backend/app/services/order/changes.py:299-301` | `receivable.amount = max(0, amount + price_adjustment)`. Si `price_adjustment > amount`, la diferencia se pierde sin registro: no genera saldo a favor, no se reembolsa, no se loguea. Cliente queda con crédito invisible. |
| 11 | **MEDIUM** | Items "purchased" no vuelven a inventario | `backend/app/services/order/changes.py:175-195` | El gating es `reserved_from_stock=True`, no `cost_type='purchased'`. Un Tennis Nike (purchased, no personalizado) cambiado por otra talla **no vuelve al stock** porque al crear el encargo el item entró sin `reserved_from_stock`. Es revendible pero el sistema no lo recupera. Detectado: `ENC-2026-0081` Tennis Nike $80k. |
| 12 | **MEDIUM** | item_status no participa en validación de cambio | `backend/app/services/order/changes.py:60` | Único check de estado: `if original_item.item_status == OrderItemStatus.CANCELLED: raise`. Items en cualquier otro estado (PENDING, IN_PRODUCTION, READY, DELIVERED) son mutables sin diferenciación, pero requieren tratamiento distinto: cancelar producción, registrar pérdida, gestionar prenda hecha, etc. |
| 13 | **MEDIUM** | Routing de Caja inconsistente entre versiones | data only — `transactions` tabla | Cambio de comportamiento aparente alrededor de 2026-03-13: EXPENSE de cambios pre-15-mar fueron a Caja Menor (1101), post-15-mar fueron a Caja Mayor (1102). Sugiere que alguien intentó "corregir" pero solo movió de un mapping incorrecto a otro distinto. **Datos actuales en prod tienen ambos mappings mezclados**: 13 EXPENSE en Caja Menor + 4 en Caja Mayor para misma categoría. |
| 14 | **MEDIUM** | Cero cobertura de tests para business logic | `backend/tests/unit/test_sale_service.py:394-450` | Únicos tests sobre `approve_*_change`: paths de error (not_found, already_approved, wrong_school). **Ningún test verifica el flujo de dinero, inventario o receivable durante una aprobación.** Explica cómo bugs #1-10 sobrevivieron. |
| 15 | **MEDIUM** | OrderChange muta OrderItem destruyendo trazabilidad | `backend/app/services/order/changes.py:206-221` | El item original se sobrescribe (`item.product_id = change.new_product_id`, etc.). Tras aprobar, el `original_item_id` del change apunta a un item que ya tiene los datos del producto NUEVO. Imposible reconstruir el estado anterior sin auditoría externa. SaleChange usa diseño distinto (registro paralelo, no mutación). |
| 16 | **MEDIUM** | unit_cost se mantiene tras cambio de producto | `backend/app/services/order/changes.py:206-221` | `OrderItem.unit_cost` se snapshotea al crear pero NO se actualiza al cambiar `product_id`. Tras un cambio de producto, el `unit_cost` apunta al costo del producto VIEJO con `product_id` del NUEVO → cálculo de margen invalidado. |
| 17 | **LOW** | Sale changes generaron cero RETURN/DEFECT en producción | data only | 41 sale_changes, 0 son `return` o `defect`. Los 4 tipos de cambio están implementados pero solo 2 se usan en práctica. Sugiere o que el flujo de devolución no es accesible desde la UI, o que vendedores resuelven devoluciones por fuera del sistema. *Needs UX verification.* |

---

## 3. Casos forenses concretos

### 3.1 ENC-2026-0117 — saldo a favor invisible $49k

```
Cronología:
2026-02-10  Encargo creado: 1 Sudadera talla 12, total=48,000
2026-02-10  Anticipo TRANSFER: 96,000 (vendedor digitó doble)
2026-02-13  Cambio aprobado: size_change, price_adjustment=-1,000
            EXPENSE CASH 1,000 a Caja Menor
2026-XX-XX  Encargo entregado

Estado final en DB:
  total = 47,000
  paid_amount = 96,000
  balance (computed) = -49,000
  receivables = 0 (ningún registro)

Cliente quedó con $49,000 de crédito invisible. El sistema no lo notifica,
no aparece en su perfil, no se puede aplicar a otro encargo.
```

### 3.2 ENC-2026-0072 — encargo entregado sin pago

```
Origen: sale change sobre VNT-2026-0688
  Venta original: 88,000 paid (completa)
  Cambio aprobado: size_change, price_adjustment=+1,000

_create_change_with_order ejecutó:
  - Cobro CASH 1,000 (el "+" del adjustment)
  - Creó ENC-2026-0072 con total=45,000, paid_amount=0
  - Creó receivable abierto por 45,000

Estado final:
  ENC-2026-0072.status = DELIVERED
  ENC-2026-0072.paid_amount = 0

Cliente recibió la prenda sin que se registre pago.
Probablemente pagó por fuera y nadie linkeó el pago al encargo.
Receivable sigue abierto en el sistema.
```

### 3.3 Caja Menor vs Caja Mayor — split temporal

```
Pre-15-mar-2026: 13 EXPENSE de cambios → Caja Menor (1101)
Post-15-mar-2026: 4 EXPENSE de cambios → Caja Mayor (1102)

Total mal asignado: $4,000 en Caja Mayor que son reembolsos a clientes,
no gastos operativos del negocio.
```

---

## 4. Snippets SQL para verificar en producción

```sql
-- 4.1 Encargos con paid_amount > total (saldos a favor invisibles)
SELECT code, status, total, paid_amount, (paid_amount - total) AS excess, balance
FROM orders
WHERE paid_amount > total AND status != 'CANCELLED'
ORDER BY (paid_amount - total) DESC;

-- 4.2 Encargos con balance ≠ suma de receivables abiertos
WITH recv_summary AS (
  SELECT order_id, SUM(amount - amount_paid) FILTER (WHERE NOT is_paid) AS open_balance
  FROM accounts_receivable WHERE order_id IS NOT NULL GROUP BY order_id
)
SELECT o.code, o.balance, COALESCE(r.open_balance, 0) AS recv_balance,
       (o.balance - COALESCE(r.open_balance, 0)) AS drift
FROM orders o
LEFT JOIN recv_summary r ON r.order_id = o.id
WHERE o.balance != COALESCE(r.open_balance, 0) AND o.status != 'CANCELLED'
ORDER BY ABS(o.balance - COALESCE(r.open_balance, 0)) DESC;

-- 4.3 Códigos de encargo duplicados
SELECT code, count(*), count(DISTINCT total) AS distinct_totals
FROM orders GROUP BY code HAVING count(*) > 1 ORDER BY count(*) DESC;

-- 4.4 Cambios aprobados sin liberar stock (proxy: items huérfanos)
SELECT oc.id, o.code, oc.change_type, oc.created_at::date,
       oi.size, gt.name, gt.cost_type, gt.requires_embroidery
FROM order_changes oc
JOIN orders o ON o.id = oc.order_id
JOIN order_items oi ON oi.id = oc.original_item_id
LEFT JOIN garment_types gt ON gt.id = oi.garment_type_id
WHERE oc.status = 'approved'
  AND NOT EXISTS (
    SELECT 1 FROM inventory_logs il
    WHERE il.order_id = oc.order_id
      AND il.movement_type::text = 'change_return'
      AND il.created_at BETWEEN oc.created_at - interval '5 minutes'
                            AND oc.created_at + interval '5 minutes'
  );

-- 4.5 EXPENSE de cambios por cuenta destino (verificar split temporal)
SELECT
  date_trunc('month', t.transaction_date) AS month,
  ba.code AS account_code, ba.name AS account_name,
  count(*), SUM(t.amount)
FROM transactions t
JOIN balance_accounts ba ON ba.id = t.balance_account_id
WHERE t.category IN ('order_changes', 'sale_changes') AND t.type = 'EXPENSE'
GROUP BY 1, 2, 3 ORDER BY 1, 2;

-- 4.6 Sale changes con encargo asociado (verificar que paid_amount no es 0 con DELIVERED)
SELECT sc.status, s.code AS sale_code, o.code AS new_order_code,
       o.total, o.paid_amount, o.balance, o.status AS order_status
FROM sale_changes sc
JOIN sales s ON s.id = sc.sale_id
JOIN orders o ON o.id = sc.order_id
WHERE sc.order_id IS NOT NULL;

-- 4.7 Receivables huérfanos (orden cerrada pero receivable abierto)
SELECT ar.id, ar.amount, ar.amount_paid, o.code, o.status, ar.created_at::date
FROM accounts_receivable ar
JOIN orders o ON o.id = ar.order_id
WHERE NOT ar.is_paid AND o.status IN ('DELIVERED', 'CANCELLED');
```

---

## 5. Modelo conceptual: 4 casos de cambio según estado físico

| Caso | `item_status` | `reserved_from_stock` | Significado físico | Comportamiento actual | Acción esperada |
|------|---------------|------------------------|-----------------------|------------------------|-----------------|
| **A** | READY/PENDING | True | Item desde inventario (catálogo) | ✓ Libera stock correctamente | Mantener |
| **B** | IN_PRODUCTION | False | Modista cosiendo prenda custom | ✗ Sólo muta el item, abandona producción silenciosa | Cancelar item original con flag explícito; opcionalmente registrar production_loss |
| **C** | READY | False | Made-to-order ya hecho en estantería | ✗ Item se sobrescribe, prenda física huérfana | Si purchased no-personalizado → devolver a inventario; si personalizada (con escudo, custom_meas) → registrar como pérdida o asignar a otro cliente |
| **D** | PENDING (split fulfillment) | True (parcial) | Combo stock + producción | ✗ Solo libera la parte de stock; producción se pierde | Tratar cada parte por separado (Caso A + Caso B) |

Distribución observada en data real (cambios aprobados):
- Caso A: 9 / 19 (47%) ✓
- Casos B/C/D combinados: 10 / 19 (53%) ✗ — todos caen en flujos rotos

Regla de negocio (según Angel):
- **Caso B:** trabajo abandonado no se contabiliza, simplemente cancelar el item. Trazabilidad sí importa
- **Caso C:** si la prenda no es personalizada (sin bordados ni medidas custom como yomber), volver al inventario de bodega de ventas normal. Si es personalizada, queda como pérdida explícita

---

## 6. Mapa de fixes por finding

| Finding | Tipo de fix | Archivos |
|---------|-------------|----------|
| #1 advance_payment | Validación nueva | `order/creation.py` |
| #2 doble aplicación | Lógica condicional | `order/changes.py` |
| #3 items huérfanos | Bloqueo + nuevo flujo | `order/changes.py` + nuevo schema field |
| #4 codes duplicados | Constraint + atomic gen | migration + `order/creation.py` |
| #5 Sale.total stale | Mutación nueva | `sale/changes.py` |
| #6 Order.paid_amount stale | Mutación nueva | `order/changes.py` |
| #7 encargo auto sin link | Pasar advance_payment | `sale/changes.py` |
| #8 EXPENSE Caja equivocada | Agregar `force_income_map=True` | `order/changes.py`, `sale/changes.py` (3 sitios) |
| #9 sin customer credit | Modelo nuevo | nueva tabla + service |
| #10 truncamiento silencioso | Registrar diferencia | `order/changes.py` |
| #11 purchased no vuelve | Cambiar gating | `order/changes.py` |
| #12 item_status sin gate | Validación nueva | `order/changes.py` (create + approve) |
| #13 Caja split temporal | Migración manual + fix #8 | acordado fuera de scope (track manual) |
| #14 sin tests | Nueva suite | `tests/unit/test_change_*.py` |
| #15 trazabilidad | Mantener original_*_snapshot | `OrderChange` schema |
| #16 unit_cost stale | Resnapshotear al aprobar | `order/changes.py` |
| #17 RETURN/DEFECT no usados | UX investigation | fuera de scope |

---

## 7. Plan acordado

1. **Tracking de errores en cuentas x cobrar y estados de encargos/devoluciones/pedidos web** — en curso (Angel) hacia migración manual posterior. Este documento provee los SQL snippets de §4 como insumo.
2. **Corrección de la lógica para hacerla robusta** — prioridad CRITICAL/HIGH del §2. **No remediar datos existentes en este paso.**
3. **Migración de remediación full manual** — posterior, fuera del scope de este documento.

---

## 8. Referencias

- Código auditado:
  - `backend/app/services/order/changes.py`
  - `backend/app/services/sale/changes.py`
  - `backend/app/services/order/creation.py`
  - `backend/app/services/order/cancellation.py`
  - `backend/app/services/sale/cancellation.py`
  - `backend/app/services/balance_integration.py`
  - `backend/app/services/accounting/transactions.py`
  - `backend/app/models/order.py`, `backend/app/models/sale.py`, `backend/app/models/accounting.py`
- Documentación previa: `docs/architecture/sale-changes-backend.md` (describe el camino feliz; no menciona los gaps de este audit)
- Snapshot de datos: `uniformes-postgres` Docker container, dump de prod ~marzo 2026
