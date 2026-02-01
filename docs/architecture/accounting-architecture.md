# Arquitectura Contable Global

Diseno del sistema de contabilidad de Uniformes System.

---

## Concepto Clave

La contabilidad es del **NEGOCIO**, no por colegio.

El negocio "Uniformes Consuelo Rios" tiene:
- **UNA SOLA Caja** (efectivo fisico en la tienda)
- **UNA SOLA cuenta bancaria**
- **UN SOLO balance general**
- **Gastos compartidos** (luz, agua, salarios, proveedores)

Los colegios son **fuentes de ingreso** - categorias para saber de donde viene el dinero, pero todo va a la misma caja/banco.

---

## Modelo de Datos

### school_id en Contabilidad

| Modelo | school_id | Razon |
|--------|-----------|-------|
| `BalanceAccount` | NULL (global) | Caja y Banco son del negocio |
| `BalanceEntry` | NULL (global) | Entradas de auditoria globales |
| `Expense` | OPCIONAL | Mayoria globales, algunos por colegio |
| `AccountsPayable` | OPCIONAL | Proveedores del negocio |
| `AccountsReceivable` | OPCIONAL | CxC pueden filtrar por origen |
| `Transaction` | OPCIONAL | Para saber origen de ingreso |
| `DailyCashRegister` | NULL (global) | Una caja diaria para todo |

---

## Tipos de Cuenta (AccountType)

```python
class AccountType(str, Enum):
    asset_current = "asset_current"      # Activo Corriente (Caja, Banco)
    asset_fixed = "asset_fixed"          # Activo Fijo (Equipos, Maquinaria)
    liability_current = "liability_current"  # Pasivo Corriente
    liability_long = "liability_long"    # Pasivo Largo Plazo
    equity = "equity"                    # Patrimonio
    income = "income"                    # Ingresos
    expense = "expense"                  # Gastos
```

**IMPORTANTE**: Los valores son en **minuscula** (`asset_fixed`, no `ASSET_FIXED`).

---

## Endpoints Globales

Los endpoints contables NO requieren school_id en la URL:

```
GET  /api/v1/global/accounting/cash-balances      # Saldos Caja y Banco
GET  /api/v1/global/accounting/expenses           # Gastos del negocio
POST /api/v1/global/accounting/expenses           # Crear gasto
GET  /api/v1/global/accounting/receivables-payables  # CxC y CxP
POST /api/v1/global/accounting/receivables        # Crear CxC
POST /api/v1/global/accounting/payables           # Crear CxP
GET  /api/v1/global/accounting/balance-accounts   # Cuentas contables
POST /api/v1/global/accounting/balance-accounts   # Crear cuenta
```

---

## Integracion con Ventas

Cuando se completa una venta, el sistema automaticamente:

### Pago en Efectivo
1. Aumenta saldo de cuenta "Caja"
2. Crea BalanceEntry de debito
3. Registra Transaction

### Pago Nequi/Transferencia/Tarjeta
1. Aumenta saldo de cuenta "Banco"
2. Crea BalanceEntry de debito
3. Registra Transaction

### Pago a Credito
1. Crea AccountsReceivable
2. NO afecta Caja ni Banco
3. Al cobrar, se registra ingreso

---

## Servicios Frontend

### globalAccountingService.ts

```typescript
// Saldos de caja y banco
getCashBalances(): Promise<CashBalancesResponse>

// Gastos
getExpenses(params): Promise<PaginatedResponse<Expense>>
createExpense(data): Promise<Expense>

// CxC y CxP
getReceivablesPayables(): Promise<ReceivablesPayablesResponse>
createReceivable(data): Promise<AccountsReceivable>
createPayable(data): Promise<AccountsPayable>

// Cuentas de balance
getBalanceAccounts(params): Promise<BalanceAccount[]>
createBalanceAccount(data): Promise<BalanceAccount>
updateBalanceAccount(id, data): Promise<BalanceAccount>
deleteBalanceAccount(id): Promise<void>
```

---

## Cuentas por Defecto

El sistema requiere al menos estas cuentas:

| Nombre | Tipo | Proposito |
|--------|------|-----------|
| Caja | asset_current | Efectivo fisico |
| Banco | asset_current | Cuenta bancaria |

---

## Notas para Desarrollo

1. **NUNCA** hacer contabilidad dependiente del selector de colegio del header
2. Usar `globalAccountingService` para operaciones contables
3. Los endpoints son `/global/accounting/*` (sin school_id en URL)
4. `school_id` es OPCIONAL en gastos, CxC, CxP - solo para filtrar/reportes

---

[← Volver al indice](./README.md)
