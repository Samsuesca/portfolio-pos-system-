# Sistema de Alertas Telegram

Notificaciones en tiempo real al equipo via Telegram Bot API. Routing por suscripcion individual + chat de grupo, restricciones por rol, cooldown anti-spam, dual mode (async/sync) para SQLAlchemy event listeners.

---

## Vision rapida

- **Bot oficial** envia mensajes a un chat de grupo y a chats individuales de cada usuario que se haya vinculado.
- **18 tipos de alertas** organizadas en tres familias: reactivas, proactivas (recordatorios), sistema.
- **Cada usuario se suscribe** solo a las alertas que le interesan; defaults sensatos por rol.
- **Restricted-to-admin alerts**: ciertas alertas financieras se filtran defensivamente — solo OWNER/ADMIN/superuser las reciben aunque otros se hayan suscrito.
- **Cooldown 5 min** por `alert_type` para evitar inundar el chat.
- **Fire-and-forget** desde cualquier handler async o thread sync.

---

## Modelo de Datos

### Tabla `telegram_alert_subscriptions`

```python
# backend/app/models/telegram_subscription.py
class TelegramAlertSubscription(Base):
    user_id: UUID                       # FK users
    alert_type: TelegramAlertType       # enum (ver abajo)
    is_active: bool = True
    created_at: datetime

    UNIQUE(user_id, alert_type)
```

### Linking en `users.telegram_chat_id`

El campo `User.telegram_chat_id` (string) es el chat 1:1 entre el bot y el usuario. Sin este campo el usuario nunca recibe alertas individuales (aunque tenga subscriptions activas).

---

## Tipos de Alertas (`TelegramAlertType` enum)

### Reactivas (disparadas por acciones de negocio)

| Tipo | Cuando se dispara | Restringida a admin |
|---|---|---|
| `sale_created` | Nueva venta registrada | No |
| `web_order_created` | Pedido nuevo desde web-portal | No |
| `order_status_changed` | Cambio de estado de pedido | No |
| `low_stock` | Producto cruza umbral `min_stock_alert` | No |
| `expense_created` | Gasto nuevo | **Si** |
| `expense_paid` | Gasto pagado | **Si** |
| `wompi_payment` | Confirmacion de pago Wompi | No |
| `pqrs_received` | Reclamo/sugerencia de cliente | No |
| `attendance_alert` | Empleado fuera de horario | **Si** |
| `cash_drawer_access` | Apertura manual de caja | **Si** |

### Proactivas (disparadas por scheduler)

| Tipo | Cadencia | Restringida a admin |
|---|---|---|
| `reminder_close_cash` | Diario, fin de jornada | No |
| `reminder_pending_expenses` | Diario, mañana | **Si** |
| `reminder_overdue_receivables` | Diario | **Si** |
| `reminder_orders_ready` | Cada vez que orden pasa a `ready` | No |
| `reminder_weekly_summary` | Lunes 8 AM | **Si** |

### Sistema

| Tipo | Cuando | Restringida a admin |
|---|---|---|
| `system_health` | DB caida, disco/memoria altos | **Si** |
| `daily_digest` | Resumen diario completo (9 PM) | **Si** |
| `daily_digest_seller` | Resumen diario para vendedoras | No |

> **Fuente de verdad**: `RESTRICTED_TO_ADMIN_ALERTS` en [`backend/app/models/telegram_subscription.py:50-60`](../../backend/app/models/telegram_subscription.py).

---

## Defaults por Rol

Al vincular Telegram, el sistema crea suscripciones automaticamente segun el rol del usuario. Ver `DEFAULT_SUBSCRIPTIONS_BY_ROLE` en [`telegram_subscription.py:64-95`](../../backend/app/models/telegram_subscription.py).

| Rol | Recibe por default |
|---|---|
| OWNER / Superuser | **Todas** las alertas |
| ADMIN | Reactivas + proactivas (excepto `daily_digest_seller`) |
| SELLER | Reactivas operacionales + `daily_digest_seller` |
| VIEWER | Solo `daily_digest_seller` |

El usuario puede ajustar despues desde Settings → Telegram.

---

## Routing: Como llega una alerta

### Punto de entrada

Toda emision de alerta pasa por dos funciones publicas en `backend/app/services/telegram.py`:

```python
# Para alertas globales (van solo al group chat):
fire_and_forget_alert(message, alert_type="general", cooldown=300)

# Para alertas con routing per-user:
fire_and_forget_routed_alert(alert_type, message, school_id=None)
```

### Pipeline `route_alert`

```
1. Send al group chat (siempre, si bot esta enabled).
2. Resolver TelegramAlertType desde el string. Si no matchea → exit.
3. Query: get_chat_ids_for_alert(alert_type, school_id)
   3a. Filtra subscriptions activas para ese alert_type.
   3b. Si alert_type esta en RESTRICTED_TO_ADMIN_ALERTS:
       → solo retorna chat_ids de superusers + users con OWNER/ADMIN
         en cualquier school (defense-in-depth).
   3c. Si school_id provisto: solo users con rol en ese school.
   3d. Excluye users sin telegram_chat_id.
4. Para cada chat_id !== group_chat_id: send.
```

### Modo dual (async + sync fallback)

`fire_and_forget_alert` soporta dos contextos:

- **Async (handlers FastAPI)**: agenda la alerta como `asyncio.task` no bloqueante.
- **Sync (SQLAlchemy event listeners en threads sin event loop)**: cae a `httpx.post` sincrono via `_send_sync`.

Esto importa porque algunos triggers (e.g. `low_stock` desde un `after_flush` listener) corren en threads sin event loop activo. Sin el fallback se perderian.

---

## Cooldown

Estructura en memoria del proceso:

```python
_cooldowns: dict[str, float] = {}  # alert_type → last_sent_monotonic
```

Default: **5 minutos por `alert_type`**. Se puede sobreescribir por llamada (`cooldown=0` para forzar).

**Limites**:

- Es por proceso. Si hay multi-worker (no es el caso hoy en produccion), cada worker tiene su propio cooldown — alertas se duplicarian.
- Es por `alert_type`, no por usuario. Si dos sucursales generan `low_stock` en 30s, solo la primera se envia.
- Para alertas routed (`route_alert`), el cooldown del group chat se setea con prefijo `routed_<type>` y `cooldown=0` para los individual sends — los individuales nunca se aplastan entre si por cooldown.

---

## API Endpoints

| Endpoint | Proposito | Permiso |
|---|---|---|
| `GET /api/v1/telegram-alerts/alert-types` | Lista de tipos disponibles + descripciones | Auth |
| `GET /api/v1/telegram-alerts/my-subscriptions` | Suscripciones del usuario actual | Auth |
| `PUT /api/v1/telegram-alerts/my-subscriptions/{type}` | Activar/desactivar una suscripcion | Auth |
| `POST /api/v1/telegram-alerts/link` | Vincular cuenta con un `chat_id` | Auth |
| `DELETE /api/v1/telegram-alerts/link` | Desvincular | Auth |
| `POST /api/v1/telegram-alerts/admin/test/{type}` | Disparar alerta de prueba | OWNER/superuser |

---

## Flujo de Vinculacion (UX)

1. Usuario abre Settings → Telegram → "Conectar".
2. Frontend muestra QR/deep-link al bot: `https://t.me/<bot_username>?start=<verification_code>`.
3. Usuario abre Telegram, presiona "Start".
4. Bot recibe `/start <verification_code>`, resuelve usuario, llama `link_telegram(user_id, chat_id)`.
5. Servicio crea defaults segun rol + setea `User.telegram_chat_id`.
6. Bot responde con confirmacion + lista de alertas suscritas.

> **Nota**: la implementacion del bot listener (que recibe `/start`) vive aparte; este sistema solo cubre el lado backend que envia mensajes y gestiona suscripciones.

---

## Configuracion

```env
# .env (production)
TELEGRAM_BOT_TOKEN=123456:ABC...
TELEGRAM_CHAT_ID=-100123456789       # group chat (negativo = supergroup)
ENV=production                        # gate: el servicio se desactiva si no es production
```

El servicio chequea **al inicializar**:

```python
self._enabled = (
    settings.ENV == "production"
    and bool(settings.TELEGRAM_BOT_TOKEN and settings.TELEGRAM_CHAT_ID)
)
```

En desarrollo (`ENV != production`) toda llamada a `send_alert` es no-op silenciosa. **Si necesitas testear en dev**, setear `ENV=production` y un bot/chat de pruebas en `.env.local`.

---

## Telemetria

- **Logs**: cada envio exitoso → `INFO Telegram alert sent: <type>`. Cada fallo → `ERROR Telegram alert failed`.
- **Cooldown skip** → `DEBUG Telegram cooldown active for <type>`.
- **Disabled** → `DEBUG Telegram skipped: not configured`.
- Los logs van por structlog y aparecen en VultrUI Log Explorer (ver [logging-and-observability.md](./logging-and-observability.md)).

---

## Daily Digest

Dos digests diarios distintos, ambos disparados por scheduler:

### `daily_digest` (admin-restricted)

Para OWNER/ADMIN. Incluye: ventas del dia (cantidad + monto), top 3 productos, gastos pendientes, CxC overdue, low_stock count, ordenes pendientes, salud del sistema.

### `daily_digest_seller`

Para SELLER/VIEWER. Resumen del dia para la vendedora: sus ventas, sus comisiones (si aplica), pedidos asignados, alertas operacionales del colegio.

> Implementacion: `backend/app/services/telegram_digest.py`.

---

## Anti-patrones

### Llamar al bot directamente

```python
# MAL — bypassa cooldown, routing y defense-in-depth
await httpx.post("https://api.telegram.org/bot<TOKEN>/sendMessage", ...)
```

```python
# BIEN
fire_and_forget_routed_alert("low_stock", message, school_id=school.id)
```

### Olvidar `school_id` en alertas operacionales

Si la alerta tiene scope de colegio (low_stock de Pinal), pasar `school_id` para que solo los users con rol en Pinal la reciban. Sin `school_id` la alerta llega a todos los suscritos cross-school.

### Suscribir a un seller a `system_health`

El listado defensivo `RESTRICTED_TO_ADMIN_ALERTS` previene el envio aunque la subscription exista en DB. Pero crear la subscription dejando un row "muerto" es ruido en el modelo. La UI debe ocultar las restricted para roles no admin.

### Guardar `chat_id` sin verificacion

El `chat_id` solo debe setearse via `link_telegram` despues de que el bot recibe `/start <code>` con un codigo de verificacion vivo. Setearlo manualmente abre la puerta a hijack: cualquiera con el endpoint y un chat_id ajeno podria recibir las alertas de otro usuario.

---

## Referencias

| Codigo | Descripcion |
|---|---|
| [`backend/app/models/telegram_subscription.py`](../../backend/app/models/telegram_subscription.py) | Enum + tabla + restrictions |
| [`backend/app/services/telegram.py`](../../backend/app/services/telegram.py) | Servicio core, fire-and-forget, route_alert |
| [`backend/app/services/telegram_subscriptions.py`](../../backend/app/services/telegram_subscriptions.py) | CRUD de subscriptions, filtros por rol |
| [`backend/app/services/telegram_digest.py`](../../backend/app/services/telegram_digest.py) | Digests diarios |
| [`backend/app/services/telegram_messages.py`](../../backend/app/services/telegram_messages.py) | Templates HTML de mensajes |
| [`backend/app/api/routes/telegram_alerts.py`](../../backend/app/api/routes/telegram_alerts.py) | Endpoints |

---

[← Volver al indice](./README.md)

---

*Ultima actualizacion: 2026-05-02 | Version: 1.0.0*
