# Arquitectura Contable Global

Sistema contable de Uniformes System: **un solo balance** para todo el negocio. Los colegios son fuentes de ingreso, no entidades contables separadas.

---

## TL;DR

- **Una sola Caja, un solo Banco, un solo balance**.
- `BalanceAccount` y `BalanceEntry` son globales (`school_id = NULL`).
- `Expense`, `AccountsReceivable`, `AccountsPayable`, `Transaction`, `DailyCashRegister` tienen `school_id` opcional — solo para filtros/reportes.
- **Caja Menor**: pool global con liquidacion bajo constraint de monto por rol.
- **Cost Breakdown**: `unit_cost` snapshot al momento de la venta para preservar margen historico.
- **AP/AR full**: pagos parciales, vencimientos, conciliacion con balance entries.
- Endpoints globales: `/api/v1/global/accounting/*` (con caveat — ver "Migracion Global Incompleta").

---

## Concepto Clave

```
                       ┌──────────────────────────────────┐
                       │    "Uniformes Consuelo Rios"     │
                       │    UN SOLO BALANCE GENERAL       │
                       └────────────────┬─────────────────┘
                                        │
                ┌───────────────────────┼───────────────────────┐
                │                       │                       │
        ┌───────▼───────┐       ┌───────▼───────┐       ┌──────▼────────┐
        │  Caja (asset) │       │ Banco (asset) │       │ Caja Menor    │
        │  (cash)       │       │ (transfer/    │       │ (poco efectivo│
        │               │       │  nequi/card)  │       │  liquidable)  │
        └───────┬───────┘       └───────┬───────┘       └──────┬────────┘
                │                       │                      │
                ▼                       ▼                      ▼
        ┌────────────────────────────────────────────────────────┐
        │  BalanceEntries (debit/credit) — auditoria de cada     │
        │  movimiento. Cada venta/gasto/pago genera entries.     │
        └────────────────────────────────────────────────────────┘

   Ventas Caracas │ Ventas Pinal │ Ventas Pumarejo  ←  son CATEGORIAS
                                                       de ingreso, no
                                                       cajas separadas.
```

---

## Modelo de Datos

### `BalanceAccount` (cuentas contables)

```python
class BalanceAccount(Base):
    id: UUID
    code: str               # "1010" (Caja), "1110" (Banco)
    name: str               # "Caja", "Banco Bancolombia"
    account_type: AccountType
    current_balance: Decimal
    is_system: bool         # cuentas no borrables (Caja, Banco, Caja Menor)
    is_active: bool
    school_id: UUID | None  # SIEMPRE NULL en cuentas operativas
```

### `AccountType` enum

```python
class AccountType(str, Enum):
    asset_current   = "asset_current"      # Caja, Banco, Caja Menor, AR
    asset_fixed     = "asset_fixed"        # Equipos, vehiculos
    liability_current = "liability_current" # Proveedores corto plazo, AP
    liability_long  = "liability_long"     # Deudas largas
    equity          = "equity"             # Patrimonio
    income          = "income"             # Categorias de ingreso (ventas Caracas, etc.)
    expense         = "expense"            # Categorias de gasto
```

> **Importante**: valores en **minuscula**. `account_type = "asset_current"`, NO `"ASSET_CURRENT"`. Convencion legacy.

### `BalanceEntry` (movimientos)

```python
class BalanceEntry(Base):
    id: UUID
    account_id: UUID            # FK BalanceAccount
    entry_type: str             # "debit" | "credit"
    amount: Decimal
    balance_after: Decimal      # snapshot post-movimiento
    description: str
    transaction_id: UUID | None # vincula al evento de negocio
    sale_id, expense_id, payment_id: UUID | None
    school_id: UUID | None      # opcional, solo para reportes
    created_at: datetime
    created_by: UUID            # actor
```

Cada movimiento que toca un balance account crea un `BalanceEntry` con el `balance_after` calculado en el momento. Esto permite reconstruir el saldo a cualquier fecha sin recomputar todo.

### Cuentas por defecto

| Codigo | Nombre | Tipo | Proposito |
|---|---|---|---|
| 1010 | Caja | asset_current | Efectivo fisico tienda |
| 1110 | Banco | asset_current | Cuenta bancaria principal (Wompi va aqui) |
| 1020 | Caja Menor | asset_current | Liquidez para gastos chicos |
| 1310 | CxC Clientes | asset_current | Receivables agregadas |
| 2110 | CxP Proveedores | liability_current | Payables agregadas |

Ademas se crean automaticamente cuentas de **ingreso** por colegio:

| Codigo | Nombre |
|---|---|
| 4101 | Ventas Caracas |
| 4102 | Ventas Pinal |
| 4103 | Ventas Pumarejo |

Y categorias de **gasto**: Servicios, Salarios, Insumos, Renta, etc. (definidas via `expense_categories`).

---

## Endpoints Globales

```
GET    /api/v1/global/accounting/cash-balances             # Caja + Banco + Caja Menor
GET    /api/v1/global/accounting/balance-accounts          # Listado de cuentas
POST   /api/v1/global/accounting/balance-accounts          # Crear cuenta
PATCH  /api/v1/global/accounting/balance-accounts/{id}
DELETE /api/v1/global/accounting/balance-accounts/{id}
GET    /api/v1/global/accounting/expenses                  # Gastos del negocio
POST   /api/v1/global/accounting/expenses                  # Crear gasto
POST   /api/v1/global/accounting/expenses/{id}/pay         # Pagar gasto
GET    /api/v1/global/accounting/receivables               # CxC
POST   /api/v1/global/accounting/receivables
POST   /api/v1/global/accounting/receivables/{id}/payments # Cobro parcial
GET    /api/v1/global/accounting/payables                  # CxP
POST   /api/v1/global/accounting/payables
GET    /api/v1/global/accounting/transactions
GET    /api/v1/global/accounting/balance-general
```

> **Caveat**: parte de la logica vive bajo `prefix=/schools/{school_id}/accounting/*` aunque internamente delega a las funciones globales. Ver siguiente seccion.

### Migracion Global Incompleta (2026-05-02)

El archivo [`backend/app/api/routes/accounting.py`](../../backend/app/api/routes/accounting.py) sigue montado bajo `/schools/{school_id}/accounting/*` aunque sus servicios:

- `BalanceIntegrationService.get_cash_balances` ignora explicitamente `school_id` (comentario literal en el codigo).
- `get_caja_menor_balance`, `liquidate_caja_menor` operan sobre cuentas globales.
- `initialize_default_accounts` redirige al flujo global.

Las URLs **mienten sobre el scope** — se mantienen por compatibilidad con frontend antiguo. La migracion a `/global/accounting/*` esta planeada pero pendiente. Hay un parallel `routes/global_accounting.py` con endpoints "correctos" (probablemente duplicados).

> **Reglas de oro hasta cerrar la migracion**:
> 1. Para codigo nuevo en frontend, usar `globalAccountingService.ts` y los endpoints `/global/accounting/*`.
> 2. NO confiar en que `school_id` filtra cuando esta bajo `/schools/{school_id}/accounting/*` — verificar el servicio.
> 3. NO agregar mas endpoints bajo el prefix viejo.

---

## Caja Menor

Cuenta especial para mantener efectivo liquido para gastos del dia (cafe, mensajeria, papeleria). Se "alimenta" desde Caja o Banco y se "liquida" cuando se llena.

### Operaciones

| Operacion | Endpoint | Permiso | Constraint |
|---|---|---|---|
| Ver balance | `GET /caja-menor/balance` | `accounting.view_caja_menor` | — |
| Ver flujo del dia | `GET /caja-menor/summary` | `accounting.view_caja_menor` | — |
| Liquidar (transferir excedente a Caja/Banco) | `POST /caja-menor/liquidate` | `accounting.liquidate_caja_menor` | ADMIN: max $5M, sin aprobacion. OWNER: ilimitado |
| Editar config (limites) | `PUT /caja-menor/config` | `accounting.edit_caja_menor_config` | ADMIN: max $2M |
| Ver historial | `GET /caja-menor/liquidations` | `accounting.view_liquidation_history` | — |

### Constraints (definidos en `SYSTEM_ROLE_CONSTRAINTS`)

```python
"accounting.liquidate_caja_menor": {
    UserRole.ADMIN: {"max_amount": Decimal("5000000"), "requires_approval": False},
    UserRole.OWNER: {"max_amount": None, "requires_approval": False},
},
"accounting.edit_caja_menor_config": {
    UserRole.ADMIN: {"max_amount": Decimal("2000000"), "requires_approval": False},
    UserRole.OWNER: {"max_amount": None},
},
```

Si un ADMIN intenta liquidar $6M, el endpoint usa `check_amount_constraint` y retorna 403 con razon "Monto maximo permitido: $5,000,000".

### Daily Cash Register

`daily_cash_registers` registra el flujo diario:

```python
{
  "id": ...,
  "date": "2026-05-02",
  "opening_balance": Decimal("100000"),    # con que se abre la caja
  "closing_balance": Decimal("450000"),    # con que se cierra
  "total_sales_cash": Decimal("400000"),
  "total_expenses": Decimal("50000"),
  "opened_by": user_id,
  "closed_by": user_id,
  "status": "open" | "closed"
}
```

Apertura: `accounting.open_register`. Cierre: `accounting.close_register`. Una sola caja diaria global (no por colegio).

---

## Integracion con Ventas

```python
# backend/app/services/sale/creation.py — pseudocodigo
async def create_sale(...):
    # 1. Crear venta + items
    sale = Sale(...)
    db.add(sale)

    # 2. Snapshot unit_cost por item (cost breakdown)
    for item in items:
        item.unit_cost = await cost_service.snapshot_cost(item.product_id)

    # 3. Mapear payment_method → cuenta de balance
    if sale.payment_method == "cash":
        target_account = caja_account
    elif sale.payment_method in ("nequi", "transfer", "card"):
        target_account = banco_account
    elif sale.payment_method == "credit":
        # Crea AccountsReceivable, NO toca caja
        await receivable_service.create_from_sale(sale)
        return  # sin balance entry

    # 4. Crear BalanceEntry de credito en la cuenta de ingreso del colegio
    income_account = await get_income_account(sale.school_id)
    await balance_service.add_entry(
        account=income_account, entry_type="credit", amount=sale.total
    )

    # 5. Crear BalanceEntry de debito en Caja/Banco
    await balance_service.add_entry(
        account=target_account, entry_type="debit", amount=sale.total
    )

    # 6. Telegram alert (fire-and-forget)
    fire_and_forget_routed_alert("sale_created", ..., school_id=sale.school_id)
```

> **Reversion**: cuando se cancela una venta, las entries se revierten via `transactions.record(...)` con flag `force_income_map=True` para sustraer del income en lugar del expense.

---

## Cost Breakdown — Snapshots de Costo

Cada `SaleItem.unit_cost` se setea al momento de la venta y nunca se recalcula. Esto preserva el margen historico aunque los componentes cambien despues.

```python
# Resolucion en cascada (ver cost-breakdown-system.md)
unit_cost = sum(ProductCostComponent.amount where product_id=X) \
            or product.cost \
            or Decimal("0")
```

> Detalle: [cost-breakdown-system.md](./cost-breakdown-system.md).

---

## Accounts Receivable (CxC)

### Modelo

```python
class AccountsReceivable(Base):
    id: UUID
    client_id: UUID
    sale_id: UUID | None        # vinculo con venta a credito
    school_id: UUID | None      # opcional, solo para filtros
    amount: Decimal
    paid_amount: Decimal
    remaining: Decimal          # property: amount - paid_amount
    due_date: date | None
    status: ARStatus            # pending | partial | paid | overdue
    notes: str | None
    created_at, updated_at
```

### Flujo

1. **Creacion** (automatica desde venta a credito o manual desde admin):
   - `AccountsReceivable.amount = sale.total`
   - Status: `pending`
   - NO se crea BalanceEntry — la venta no entro a caja todavia.

2. **Cobro parcial** (`POST /receivables/{id}/payments`):
   - Crea fila en `receivable_payments` con monto + metodo + balance account destino.
   - Crea BalanceEntry en Caja/Banco.
   - Actualiza `paid_amount`. Si `paid_amount >= amount` → status `paid`.

3. **Cobro total**: igual al parcial, en una sola operacion.

4. **Vencimiento**: scheduler diario marca como `overdue` cuando `due_date < hoy AND status != paid`. Dispara Telegram `reminder_overdue_receivables` (admin-restricted).

---

## Accounts Payable (CxP)

Espejo de CxC pero del lado de **lo que el negocio debe** (proveedores, servicios).

```python
class AccountsPayable(Base):
    id: UUID
    vendor_id: UUID
    amount: Decimal
    paid_amount: Decimal
    due_date: date | None
    status: APStatus            # pending | partial | paid | overdue
    notes: str | None
    school_id: UUID | None      # opcional
```

### Flujo de pago

```
POST /payables/{id}/payments
  → debita Caja o Banco (BalanceEntry tipo debit en cuenta asset, credit en liability)
  → fila en payable_payments con metodo y referencia
  → actualiza paid_amount
  → si paid_amount = amount → status `paid`
```

---

## Gastos (Expenses)

```python
class Expense(Base):
    id: UUID
    category_id: UUID            # FK expense_categories
    vendor_id: UUID | None
    amount: Decimal
    description: str
    payment_method: str | None
    paid_account_id: UUID | None # cuenta desde donde se pago
    paid_at: datetime | None
    status: ExpenseStatus        # pending | paid
    school_id: UUID | None       # opcional, solo para filtros
    created_at: datetime
    created_by: UUID
```

### Flujo (mayo 2026)

> **Importante**: el flujo actual NO debita la cuenta al crear el gasto. El debito ocurre solo cuando se llama explicitamente a `pay_expense`. Esto significa que crear un gasto en `pending` no afecta el balance — es solo un registro de "cosa por pagar".

1. **Crear gasto** (`POST /expenses`):
   - Inserta fila con status `pending`.
   - Telegram alert `expense_created` (admin-restricted).
   - **NO** crea BalanceEntry.

2. **Pagar gasto** (`POST /expenses/{id}/pay`):
   - Crea BalanceEntry de credito en la cuenta origen (Caja/Banco/CajaMenor).
   - Crea BalanceEntry de debito en cuenta de gasto (categoria).
   - Marca como `paid`, setea `paid_at`, `paid_account_id`.
   - Telegram alert `expense_paid`.

> **Convivencia**: muchos gastos pequeños se crean ya como `paid` directamente. La distincion `pending → paid` se usa cuando hay tiempo entre la cuenta y el pago efectivo.

---

## Audit Trail

Las acciones contables sensibles se registran en `audit_logs`:

| Accion | Cuando |
|---|---|
| `BALANCE_ADJUSTMENT` | Ajuste manual de saldo (requires_approval, max_amount) |
| `EXPENSE_DELETE`, `EXPENSE_MODIFY` | Eliminacion/edicion post-creacion |
| `TRANSFER_CREATE` | Transferencia entre cuentas (Caja → Banco) |

Antes/Despues snapshots en JSONB. Ver [permission-system.md](./permission-system.md) para el detalle.

---

## Servicios Frontend

### `globalAccountingService.ts`

```typescript
getCashBalances(): Promise<CashBalancesResponse>
getCajaMenorBalance(): Promise<CajaMenorResponse>
getCajaMenorSummary(date?): Promise<CajaMenorSummaryResponse>
liquidateCajaMenor(data): Promise<LiquidationResponse>

getExpenses(params): Promise<PaginatedResponse<Expense>>
createExpense(data): Promise<Expense>
payExpense(id, data): Promise<Expense>

getReceivables(params): Promise<PaginatedResponse<AccountsReceivable>>
createReceivable(data): Promise<AccountsReceivable>
addReceivablePayment(id, data): Promise<ReceivablePayment>

getPayables(params): Promise<PaginatedResponse<AccountsPayable>>
createPayable(data): Promise<AccountsPayable>
addPayablePayment(id, data): Promise<PayablePayment>

getBalanceAccounts(params): Promise<BalanceAccount[]>
createBalanceAccount(data): Promise<BalanceAccount>
updateBalanceAccount(id, data): Promise<BalanceAccount>
deleteBalanceAccount(id): Promise<void>

getDailyFlow(date): Promise<DailyFlowResponse>
getBalanceGeneral(date?): Promise<BalanceGeneralResponse>
```

---

## Notas para Desarrollo

1. **NUNCA** hacer contabilidad dependiente del selector de colegio del header. La caja es UNA.
2. Usar `globalAccountingService` para frontend. Para backend, los servicios en `services/accounting/` son la fuente de verdad.
3. **Multi-pago**: una venta puede tener multiples payments (parte cash, parte nequi). El servicio maneja BalanceEntry por cada metodo.
4. **`unit_cost` snapshot**: NO mutar despues de crear la venta. Para correcciones contables, usar ajustes explicitos.
5. **Reversion de venta cancelada**: usar `transactions.record(force_income_map=True)`, NO crear BalanceEntries manuales.
6. **`school_id` opcional**: setearlo si la operacion tiene asociacion clara con un colegio (gasto especifico de un colegio, CxC de un padre de Caracas), de lo contrario NULL.

---

## Roadmap

- **Cerrar migracion global**: mover `routes/accounting.py` a `routes/global_accounting.py` con redirects/deprecation, eliminar el prefix `/schools/{school_id}/accounting`.
- **Multi-currency**: hoy todo es COP. Si se expande, agregar `currency` a `BalanceAccount` y rates table.
- **Reportes consolidados a nivel branch (v3)**: cuando existan branches, cada una tendra su Caja/Banco propios, y este nivel "global" se vuelve "por branch". Ver `docs/v3-branch-architecture/`.
- **Cierre contable mensual**: hoy el negocio cierra informalmente. Formalizar con bloqueo de fechas anteriores y reportes consolidados.

---

## Referencias

| Codigo | Path |
|---|---|
| Modelos | [`backend/app/models/accounting.py`](../../backend/app/models/accounting.py) |
| Servicios | [`backend/app/services/accounting/`](../../backend/app/services/accounting/) |
| Routes (legacy + global) | [`backend/app/api/routes/accounting.py`](../../backend/app/api/routes/accounting.py), [`global_accounting.py`](../../backend/app/api/routes/global_accounting.py) |
| Cost breakdown | [cost-breakdown-system.md](./cost-breakdown-system.md) |
| Permisos | [permission-system.md](./permission-system.md) |
| Wompi | [payment-system.md](./payment-system.md) |

---

[← Volver al indice](./README.md)

---

*Ultima actualizacion: 2026-05-02 | Version: 2.0.0*
