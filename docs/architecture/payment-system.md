# Sistema de Pagos — Wompi

Pasarela de pagos online integrada con Wompi para el web portal.

---

## Arquitectura

```
Cliente (Web Portal)          Backend (FastAPI)              Wompi
       │                            │                         │
       │  1. Crear pedido           │                         │
       ├───────────────────────────►│                         │
       │                            │                         │
       │  2. Crear sesion de pago   │                         │
       ├───────────────────────────►│                         │
       │                            │  (genera referencia,    │
       │                            │   firma de integridad)  │
       │  3. Redirect a checkout    │                         │
       ├──────────────────────────────────────────────────────►
       │                            │                         │
       │                            │  4. Webhook             │
       │                            │◄────────────────────────┤
       │                            │  (valida firma,         │
       │                            │   aplica contabilidad)  │
       │                            │                         │
       │  5. Redirect resultado     │                         │
       ◄──────────────────────────────────────────────────────┤
       │                            │                         │
       │  6. Polling estado         │                         │
       ├───────────────────────────►│                         │
```

---

## Endpoints

| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| GET | `/payments/config` | No | Configuracion publica (public_key, environment, enabled) |
| POST | `/payments/sessions` | No | Crear sesion de pago (genera referencia + firma) |
| POST | `/payments/webhooks/wompi` | No | Webhook de Wompi (valida firma HMAC) |
| GET | `/payments/status/{reference}` | No | Consultar estado de un pago |
| POST | `/payments/sync-pending` | No | Sincronizar todos los pagos pendientes |
| GET | `/payments/order/{order_id}` | Si | Listar transacciones de un pedido |

---

## Archivos clave

### Backend

| Archivo | Responsabilidad |
|---------|-----------------|
| `app/services/wompi.py` | Servicio completo: sesiones, webhooks, sincronizacion, contabilidad |
| `app/api/routes/payments.py` | Endpoints REST |
| `app/models/payment_transaction.py` | Modelo `payment_transactions` (referencia, monto, estado, fees) |
| `app/core/config.py` | Variables de entorno Wompi |

### Web Portal

| Archivo | Responsabilidad |
|---------|-----------------|
| `lib/api.ts` → `paymentsApi` | Cliente API (createSession, checkStatus, buildCheckoutUrl) |
| `app/pago/page.tsx` | Pagina informativa de pagos |
| `app/pago/resultado/page.tsx` | Pagina de resultado post-pago (polling de estado) |
| `app/mi-cuenta/page.tsx` | Boton "Pagar en Linea" por pedido |

---

## Flujo detallado

### 1. Creacion de sesion

El cliente hace click en "Pagar en Linea" en su cuenta. El backend:

1. Valida que el pedido existe y tiene saldo pendiente
2. Verifica que no haya transacciones PENDING duplicadas
3. Genera referencia unica: `WP-{order_code}-{timestamp}`
4. Convierte monto a centavos COP
5. Genera firma de integridad (SHA-256): `reference + amount + currency + integrity_key`
6. Crea registro `PaymentTransaction` con estado PENDING
7. Retorna datos para redirect a Wompi checkout

### 2. Checkout Wompi

El frontend redirige al cliente a `https://checkout.wompi.co/p/` con parametros:
- `public-key`, `currency=COP`, `amount-in-cents`, `reference`, `signature:integrity`, `redirect-url`

No hay widget embebido — es redirect completo al dominio de Wompi.

### 3. Webhook

Wompi envia POST a `/payments/webhooks/wompi` cuando el estado de la transaccion cambia. El backend:

1. Valida firma del webhook (SHA-256 de propiedades + timestamp + events_key)
2. Busca la `PaymentTransaction` por referencia
3. Verifica idempotencia (skip si ya procesada)
4. Si estado es APPROVED:
   - Actualiza `order.paid_amount` (capped al total)
   - Crea `Transaction` de tipo INCOME
   - Actualiza `AccountsReceivable` relacionada
   - Registra comision Wompi como `Expense`
   - Envia notificacion interna + alerta Telegram

### 4. Pagina de resultado

El cliente es redirigido a `/pago/resultado?ref={reference}`. La pagina:
- Consulta `/payments/status/{reference}` cada 5 segundos
- Muestra estado: aprobado (verde), rechazado (rojo), o pendiente (polling)
- Timeout de polling: 60 segundos

### 5. Sincronizacion

`/payments/sync-pending` consulta Wompi por cada transaccion PENDING y actualiza estados. Se llama automaticamente al cargar la pagina de cuenta del cliente.

---

## Modelo de datos

```sql
payment_transactions
├── id (UUID, PK)
├── reference (UNIQUE) — "WP-ENC-2026-0042-1710345600"
├── wompi_transaction_id — ID de Wompi
├── order_id (FK orders) — Pedido asociado
├── receivable_id (FK accounts_receivable) — CxC asociada
├── school_id (FK schools)
├── client_id (FK clients)
├── amount_in_cents (INT)
├── currency ("COP")
├── status (ENUM: PENDING, APPROVED, DECLINED, VOIDED, ERROR)
├── payment_method_type — CARD, PSE, NEQUI, etc.
├── wompi_response_data (JSONB) — Respuesta completa de Wompi
├── integrity_signature — Firma SHA-256 generada
├── wompi_fee_cents — Comision Wompi
├── wompi_fee_tax_cents — IVA sobre comision
├── accounting_applied (BOOL) — Guard de idempotencia
├── created_at, updated_at, completed_at
```

---

## Configuracion

Variables de entorno (`.env`):

```bash
WOMPI_ENABLED=true
WOMPI_ENVIRONMENT=sandbox          # o "production"
WOMPI_PUBLIC_KEY=pub_test_xxx      # o pub_prod_xxx
WOMPI_PRIVATE_KEY=prv_test_xxx     # o prv_prod_xxx
WOMPI_EVENTS_KEY=test_events_xxx   # Para validar webhooks
WOMPI_INTEGRITY_KEY=test_integrity_xxx  # Para firmas de checkout
WOMPI_REDIRECT_URL=https://yourdomain.com/pago/resultado
```

---

## Mapeo de metodos de pago

Todos los metodos de Wompi se mapean a `AccPaymentMethod.TRANSFER` en contabilidad:

| Wompi | Descripcion |
|-------|-------------|
| CARD | Tarjeta credito/debito |
| PSE | Transferencia bancaria PSE |
| NEQUI | Nequi |
| BANCOLOMBIA_TRANSFER | Transferencia Bancolombia |
| BANCOLOMBIA_COLLECT | Corresponsal Bancolombia |
| DAVIPLATA | Daviplata |
| BANCOLOMBIA_QR | QR Bancolombia |

---

## Cuentas del negocio (balance_accounts)

Las cuentas bancarias del negocio (Caja, Banco Bancolombia, Nequi) se gestionan via `balance_accounts` en el modulo contable. Gastos y transacciones referencian `balance_accounts.id` como `payment_account_id`.

La tabla legacy `payment_accounts` (que almacenaba datos bancarios para mostrar al cliente en transferencias manuales) fue eliminada — era redundante con `balance_accounts`.

---

## Historial

- **2026-03**: Wompi aprobado para produccion comercial
- **2026-04**: Eliminado sistema legacy de comprobantes de pago manual. Eliminada tabla `payment_accounts` (redundante con `balance_accounts`). Wompi es ahora el unico flujo de pago online.
- FUNCIONANDO EN PRODUCCION

---

[← Volver al indice](./README.md)
