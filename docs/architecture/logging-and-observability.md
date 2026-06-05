# Logging y Observabilidad

Sistema de logging estructurado con `structlog` + middleware ASGI que enriquece cada request con `request_id`, `client_ip`, y filtra trafico de scanners. Consumido por VultrUI Log Explorer en produccion.

---

## TL;DR

- **structlog** como capa de formato sobre stdlib `logging`. Codigo existente con `logger.info(...)` sigue funcionando — los `LogRecord` se interceptan y pasan por la pipeline de structlog.
- **JSON en produccion**, console-renderer en desarrollo.
- **Middleware ASGI** (`RequestContextMiddleware`) bindea `request_id` y `client_ip` a `structlog.contextvars` — todo log emitido durante esa request los lleva automaticamente.
- **Filtro de scanner traffic**: requests a `/.env`, `/wp-admin`, `*.php`, etc. se loggean en `DEBUG` para no contaminar produccion.
- **Header `X-Request-Id`** propagado en la respuesta para que el cliente pueda correlacionar.
- **Consumo**: VultrUI Log Explorer ingiere los JSON logs.

---

## Arquitectura

```
┌──────────────┐       ┌──────────────────────────────┐       ┌─────────────┐
│  HTTP req    │  ───► │ RequestContextMiddleware     │  ───► │   FastAPI   │
└──────────────┘       │  • genera request_id (uuid)  │       │  handlers   │
                       │  • extrae client_ip          │       └──────┬──────┘
                       │  • is_scanner?               │              │
                       │  • bind a contextvars        │              │ logger.info(...)
                       └──────────────┬───────────────┘              │
                                      │                              ▼
                                      │                   ┌────────────────────┐
                                      │                   │ stdlib logging     │
                                      │                   │  → ProcessorFormatter
                                      │                   │  → structlog pipe  │
                                      │                   └─────────┬──────────┘
                                      │                             │
                                      ▼                             ▼
                              ┌─────────────────┐           ┌────────────────┐
                              │ access log line │           │ stdout (JSON)  │
                              │ (DEBUG/INFO)    │           │   o console    │
                              └─────────────────┘           └───────┬────────┘
                                                                    │
                                                                    ▼
                                                       ┌────────────────────┐
                                                       │  VultrUI Log       │
                                                       │  Explorer (prod)   │
                                                       └────────────────────┘
```

---

## Setup (`backend/app/core/logging.py`)

### `setup_logging(log_level, log_format, env)`

Llamada una sola vez en `app/main.py` durante startup:

```python
setup_logging(
    log_level=settings.LOG_LEVEL,    # "INFO" en prod, "DEBUG" en dev
    log_format=settings.LOG_FORMAT,  # "auto" | "json" | "console"
    env=settings.ENV,                # "production" | "development"
)
```

`log_format="auto"` resuelve a JSON cuando `env=production`, a console renderer cuando es desarrollo.

### Pipeline de processors

```python
shared_processors = [
    structlog.contextvars.merge_contextvars,   # ← inyecta request_id, client_ip
    structlog.stdlib.add_log_level,
    structlog.stdlib.add_logger_name,
    structlog.processors.TimeStamper(fmt="iso"),
    structlog.processors.StackInfoRenderer(),
    structlog.processors.format_exc_info,
    structlog.processors.UnicodeDecoder(),
]
```

`merge_contextvars` es el que hace la magia: cada `bind_contextvars(...)` en el middleware queda colgado del contexto y se inyecta automaticamente en todos los logs subsecuentes durante esa request.

### Loggers

| Logger | Nivel | Proposito |
|---|---|---|
| `""` (root) | LOG_LEVEL | Application logs |
| `uvicorn` | LOG_LEVEL | Uvicorn startup/shutdown |
| `uvicorn.access` | WARNING | Logs de acceso de uvicorn (silenciado — los hace el middleware) |
| `uvicorn.error` | LOG_LEVEL | Errores de uvicorn |

Todos los loggers escriben a `stdout` con el handler `structured`. Logs van a journald via systemd y de ahi a VultrUI.

---

## Middleware: `RequestContextMiddleware`

Vive en [`backend/app/middleware/request_context.py`](../../backend/app/middleware/request_context.py). Es **el primer middleware** en la stack ASGI.

### Que hace por cada request

```python
1. Extrae headers (X-Request-Id, X-Real-IP, X-Forwarded-For, User-Agent).
2. request_id = X-Request-Id ?? uuid4().hex[:12]
3. client_ip = X-Real-IP ?? primer IP de X-Forwarded-For ?? scope.client[0]
4. is_scanner = match heuristico (ver siguiente seccion)
5. structlog.contextvars.bind_contextvars(request_id=, client_ip=)
6. Tracking de duracion (perf_counter).
7. Wrap el send para inyectar X-Request-Id en response headers.
8. Tras await self.app(...) → loguea access line con method/path/status/duration.
   Nivel: DEBUG si is_scanner else INFO.
9. clear_contextvars() (siempre, hasta en exception).
```

### Helpers publicos

```python
from app.middleware.request_context import get_client_ip, get_request_id

ip = get_client_ip()      # str | None — desde cualquier lugar dentro del request scope
rid = get_request_id()    # str | None
```

Util para audit logs y para incluir en mensajes de error que se envian al cliente.

---

## Filtro de Scanner Traffic

Heuristica de `_is_scanner_request(path, user_agent)`:

| Criterio | Ejemplos |
|---|---|
| Path comienza con prefijo conocido | `/.env`, `/.git`, `/wp-admin`, `/wp-login`, `/phpmyadmin`, `/actuator`, `/solr`, `/cgi-bin`, `/.aws`, `/xmlrpc.php`, `/telescope`, `/console`, `/HNAP1`, `/sdk`, ... |
| Path termina en extension sospechosa | `.php`, `.asp`, `.aspx`, `.jsp`, `.cgi` |
| Path contiene strings de explotacion | `allow_url_include`, `eval-stdin` |
| User-Agent matchea scanner conocido | `zgrab`, `masscan`, `nmap`, `nikto`, `sqlmap`, `gobuster`, `nuclei`, `httpx`, `censys`, `shodan`, ... |
| Sin User-Agent + path no `/api/` ni `/health` | Bot rudimentario |

**Efecto**: la access line se emite en `DEBUG` (filtrado en produccion) en lugar de `INFO`. Los scanners siguen llegando pero no contaminan los logs de negocio. La respuesta sigue siendo lo que el handler genere (404 o 405 tipicamente).

> **Importante**: el middleware NO bloquea los scanners — eso es trabajo de Nginx / fail2ban. Solo silencia su ruido en logs.

---

## Estructura del JSON Log

En produccion cada linea es un JSON parseado por VultrUI:

```json
{
  "event": "GET /api/v1/sales 200 142.3ms",
  "level": "info",
  "logger": "app.access",
  "timestamp": "2026-05-02T15:30:42.123456-05:00",
  "request_id": "a1b2c3d4e5f6",
  "client_ip": "186.84.12.45",
  "http_method": "GET",
  "http_path": "/api/v1/sales",
  "http_status": 200,
  "duration_ms": 142.3
}
```

Cualquier `logger.info("user logged in", user_id=u.id, school_id=s.id)` adentro del request agrega `request_id` y `client_ip` automaticamente — no hay que pasarlos manualmente.

---

## VultrUI Log Explorer

Consumidor externo (proyecto `VultrUI/services`) que ingiere los JSON logs y expone una UI con filtros:

- **Por `request_id`**: ver todos los logs de una request especifica (util para reproducir un bug que reporto un usuario).
- **Por `client_ip`**: detectar rate limiting / abuso.
- **Por `level`**: aislar errores recientes.
- **Por `http_status`**: ver todas las requests 5xx.
- **Por `http_path` regex**: actividad sobre un endpoint.

> **Estado**: el consumer esta en produccion. La integracion en backend esta lista pero **pendiente de redeploy** para activar el envio a VultrUI (segun memoria del proyecto).

---

## Como Loggear Bien

### Reglas

1. **Usar `structlog` en codigo nuevo**:
   ```python
   import structlog
   logger = structlog.get_logger()
   logger.info("sale.created", sale_id=str(s.id), total=float(s.total))
   ```
2. **Codigo legacy con `logging.getLogger(__name__)` sigue funcionando** — los logs pasan por el mismo pipeline gracias a `ProcessorFormatter`.
3. **Pasar contexto como kwargs**, no formatear en el message:
   ```python
   # MAL
   logger.info(f"sale {sale_id} created with total {total}")
   # BIEN
   logger.info("sale.created", sale_id=str(sale_id), total=float(total))
   ```
   Asi el campo es queryable en VultrUI.
4. **Eventos en formato `dominio.accion`**: `sale.created`, `payment.webhook_received`, `permission.changed`. Facilita filtrar.
5. **Nunca loggear secrets**: passwords, tokens JWT crudos, keys de Wompi, payloads completos de webhooks con firma.
6. **No usar `print()`** — solo logging.

### Niveles

| Nivel | Cuando usar |
|---|---|
| `DEBUG` | Detalles de implementacion, valores intermedios, scanner traffic |
| `INFO` | Eventos de negocio (sale created, login success, alert sent) |
| `WARNING` | Algo inusual pero recuperable (cooldown skip, fallback path activado, retry) |
| `ERROR` | Operacion fallo, requiere atencion. Va con stack trace si hay exception. |
| `CRITICAL` | Sistema en estado degradado severo (DB caida, disco lleno) |

---

## System Health Sampling

Trabajo continuo (`backend/app/services/monitoring.py`) que muestrea cada N segundos:

- DB connectivity (`SELECT 1`)
- Disco %, memoria %, swap %
- Conteo de requests 5xx en ultimos 5 min

Cuando un threshold se cruza, dispara alerta Telegram (`system_health` type) con cooldown agresivo.

> Detalle: [telegram-alerts-system.md](./telegram-alerts-system.md).

---

## Anti-patrones

### Loggear sin contexto

```python
# MAL — sin request_id no hay forma de correlacionar
logging.error("payment failed")
```

```python
# BIEN — el middleware ya bindea request_id, basta con logger normal
logger.error("payment.failed", payment_id=str(p.id), reason=str(e))
```

### Romper el contexto con threads sin propagar contextvars

Si lanzas trabajo a un thread (e.g. `asyncio.to_thread`) y dentro logueas, el `contextvars` NO se propaga automaticamente. Para preservarlo:

```python
ctx = structlog.contextvars.get_contextvars()

def work():
    structlog.contextvars.bind_contextvars(**ctx)
    logger.info("...")
    structlog.contextvars.clear_contextvars()
```

### Imprimir stack traces completos en respuestas

```python
# MAL — expone interna del backend al cliente
raise HTTPException(500, f"DB error: {repr(e)}")
```

```python
# BIEN
logger.exception("db.unexpected_error")
raise HTTPException(500, "Error interno. Contacte soporte.")
```

---

## Referencias

| Componente | Path |
|---|---|
| Setup global | [`backend/app/core/logging.py`](../../backend/app/core/logging.py) |
| Middleware | [`backend/app/middleware/request_context.py`](../../backend/app/middleware/request_context.py) |
| Health sampling | [`backend/app/services/monitoring.py`](../../backend/app/services/monitoring.py) |
| VultrUI consumer | `~/Documents/03_Proyectos/Codigo/VultrUI/services/` |

---

[← Volver al indice](./README.md)

---

*Ultima actualizacion: 2026-05-02 | Version: 1.0.0*
