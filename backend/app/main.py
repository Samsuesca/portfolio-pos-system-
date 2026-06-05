import asyncio
import json
import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from pydantic import ValidationError as PydanticValidationError
from contextlib import asynccontextmanager
from pathlib import Path
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.core.config import settings
from app.core.logging import setup_logging

setup_logging(
    log_level=settings.LOG_LEVEL,
    log_format=settings.LOG_FORMAT,
    env=settings.ENV,
)

from app.core.limiter import limiter
from app.services.telegram import fire_and_forget_alert
from app.services.monitoring import metrics

logger = logging.getLogger(__name__)
from app.api.routes import health, auth, schools, products, clients, sales, orders, inventory, users, reports, accounting, global_products, global_accounting, global_reports, contacts, delivery_zones, dashboard, documents, fixed_expenses, employees, payroll, alterations, notifications, school_users, custom_roles, inventory_logs, global_roles, cash_drawer, business_settings, email_logs, print_queue, cfo_dashboard, workforce_shifts, workforce_attendance, workforce_checklists, workforce_performance, workforce_responsibilities, payments, telegram_alerts, financial_model, permission_registry, cost_components, cost_change_log, cost_insights, catalog, vendors, electronic_invoicing


async def _email_log_flush_loop():
    """Background task: flush email log queue to DB every 10 seconds."""
    from app.db.session import AsyncSessionLocal
    from app.services.email import process_email_log_queue, get_email_log_queue_size

    while True:
        await asyncio.sleep(10)
        if get_email_log_queue_size() > 0:
            try:
                async with AsyncSessionLocal() as db:
                    await process_email_log_queue(db)
            except Exception as e:
                logger.error(f"Email log flush failed: {e}")


async def _health_sample_loop():
    """Background task: periodic health sampling + Telegram alerts."""
    from app.db.session import AsyncSessionLocal
    from app.services.monitoring import collect_health_sample
    from app.services.telegram import get_telegram_service

    interval = settings.HEALTH_SAMPLE_INTERVAL
    while True:
        await asyncio.sleep(interval)
        try:
            async with AsyncSessionLocal() as db:
                sample = await collect_health_sample(db)

            telegram = get_telegram_service()

            if not sample.db_ok:
                await telegram.send_alert(
                    "<b>DB Connection Failed</b>\n"
                    "Health check could not reach PostgreSQL.",
                    alert_type="db_down",
                    cooldown=300,
                )

            if sample.disk_usage_pct > settings.DISK_ALERT_THRESHOLD_PCT:
                await telegram.send_alert(
                    f"<b>Disk Usage High</b>\n"
                    f"Usage: {sample.disk_usage_pct}% "
                    f"(threshold: {settings.DISK_ALERT_THRESHOLD_PCT}%)",
                    alert_type="disk_high",
                    cooldown=1800,
                )

            if sample.memory_usage_pct > 85:
                await telegram.send_alert(
                    f"<b>Memory Usage High</b>\n"
                    f"Usage: {sample.memory_usage_pct}%",
                    alert_type="mem_high",
                    cooldown=1800,
                )

        except Exception as e:
            logger.error("Health sample failed: %s", e)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting Uniformes System API")

    # Preload business info cache
    from app.db.session import AsyncSessionLocal
    from app.services.email import load_business_info
    try:
        async with AsyncSessionLocal() as db:
            await load_business_info(db)
    except Exception as e:
        logger.warning(f"Could not preload business info: {e}")

    # Validate permission codes referenciados por rutas existen en DB.
    # En produccion aborta startup si hay codes huerfanos (typo silencioso).
    # En dev solo loguea warning.
    try:
        from app.utils.permission_validator import validate_permission_registry
        async with AsyncSessionLocal() as db:
            errors = await validate_permission_registry(app, db)
        if errors:
            if settings.ENV == "production":
                raise RuntimeError(
                    "Permission validation failed at startup: " + "; ".join(errors)
                )
            for err in errors:
                logger.warning(f"Permission validation warning: {err}")
        else:
            logger.info("Permission validation passed: all codes resolve in DB.")
    except RuntimeError:
        raise
    except Exception as e:
        # Si el validator mismo falla (e.g. DB no accesible al startup),
        # log y continua. NO abortar boot por bug del validator.
        logger.warning(f"Permission validator could not run: {e}")

    # Start background tasks
    flush_task = asyncio.create_task(_email_log_flush_loop())
    health_task = asyncio.create_task(_health_sample_loop())

    # Start Telegram digest/reminders loop
    from app.services.telegram_digest import telegram_digest_loop
    digest_task = asyncio.create_task(telegram_digest_loop())

    # Start InventoryLog DLQ reprocess loop (hourly)
    from app.services.inventory_log_dlq_worker import inventory_log_dlq_loop
    dlq_task = asyncio.create_task(inventory_log_dlq_loop())

    # Send startup notification
    from app.services.telegram import get_telegram_service
    telegram = get_telegram_service()
    if telegram.enabled:
        await telegram.send_alert(
            f"<b>UCR API Started</b>\n"
            f"Version: <code>{settings.VERSION}</code>\n"
            f"Env: <code>{settings.ENV}</code>",
            alert_type="startup",
            cooldown=0,
        )

    yield

    # Shutdown
    flush_task.cancel()
    health_task.cancel()
    digest_task.cancel()
    dlq_task.cancel()
    for task in (flush_task, health_task, digest_task, dlq_task):
        try:
            await task
        except asyncio.CancelledError:
            pass

    # Final flush of any remaining email logs
    try:
        async with AsyncSessionLocal() as db:
            from app.services.email import process_email_log_queue
            await process_email_log_queue(db)
    except Exception:
        pass

    # Close Telegram HTTP client pool
    telegram = get_telegram_service()
    await telegram.close()

    logger.info("Shutting down Uniformes System API")


OPENAPI_TAGS = [
    # Core
    {"name": "Authentication", "description": "Login, JWT tokens, password management, Google OAuth"},
    {"name": "Users", "description": "System user management (staff accounts)"},
    {"name": "Schools", "description": "Multi-tenant school/colegio management"},
    {"name": "School Users", "description": "User-school role assignments and invitations"},
    {"name": "Custom Roles", "description": "Granular permission roles per school"},
    {"name": "Global Roles", "description": "Cross-school role management (superuser only)"},
    {"name": "Permission Registry", "description": "Available permissions catalog"},
    # Business
    {"name": "Sales", "description": "School-scoped sales with items, payments, receipts, and cancellations"},
    {"name": "Orders", "description": "School-scoped customer orders with approval workflow"},
    {"name": "Clients", "description": "Global client management with students sub-resource"},
    {"name": "Products", "description": "School-scoped products, garment types, images, and inventory"},
    {"name": "Global Products", "description": "Cross-school product and garment type catalog"},
    {"name": "Inventory", "description": "School-scoped stock adjustments and queries"},
    {"name": "Inventory Logs", "description": "School-scoped inventory movement history"},
    {"name": "Global Inventory Logs", "description": "Cross-school inventory movement history"},
    {"name": "Global Alterations", "description": "Garment alterations tracking (hemming, adjustments)"},
    {"name": "Cost Components", "description": "Product cost breakdown templates and calculations"},
    # Accounting
    {"name": "Accounting", "description": "School-scoped transactions, expenses, receivables, payables"},
    {"name": "Global Accounting", "description": "Cross-school accounting: balance accounts, cash flow, expenses, debt, snapshots"},
    {"name": "Fixed Expenses", "description": "Recurring fixed expenses with auto-generation"},
    {"name": "Financial Model", "description": "KPIs, profitability, budgets, cash forecast, executive summary"},
    {"name": "CFO Dashboard", "description": "Financial health metrics overview"},
    # Portal
    {"name": "Client Portal", "description": "Web portal: client registration, login, Google OAuth, profile"},
    {"name": "Order Portal", "description": "Web portal: order creation for registered clients"},
    # Workforce
    {"name": "Employees", "description": "Employee profiles, bonuses, and compensation"},
    {"name": "Payroll", "description": "Payroll runs, approval, and payment processing"},
    {"name": "Workforce - Shifts", "description": "Shift templates and employee scheduling"},
    {"name": "Workforce - Attendance", "description": "Attendance logging, absences, and daily summaries"},
    {"name": "Workforce - Checklists", "description": "Daily task checklists and verification"},
    {"name": "Workforce - Performance", "description": "Employee performance reviews and metrics"},
    {"name": "Workforce - Responsibilities", "description": "Employee responsibility assignments"},
    # Admin & System
    {"name": "Payments", "description": "Wompi payment gateway: sessions, webhooks, status"},
    {"name": "Cash Drawer", "description": "Physical cash drawer access control"},
    {"name": "Documents", "description": "File/folder management (superuser only)"},
    {"name": "Notifications", "description": "In-app notification delivery and read tracking"},
    {"name": "Email Logs", "description": "Email sending history and queue management"},
    {"name": "Telegram Alerts", "description": "Telegram bot alert subscriptions and linking"},
    {"name": "Print Queue", "description": "Receipt/label print queue with SSE streaming"},
    {"name": "Contacts", "description": "Contact form submissions from web portal"},
    {"name": "Delivery Zones", "description": "Delivery zone configuration and public listing"},
    {"name": "Business Info", "description": "Business profile and settings"},
    {"name": "Dashboard", "description": "Global dashboard statistics"},
    {"name": "Reports", "description": "School-scoped business reports"},
    {"name": "Global Reports", "description": "Cross-school business reports"},
    {"name": "Health", "description": "API health checks and readiness probes"},
]

app = FastAPI(
    title=settings.PROJECT_NAME,
    version="2.0.0",
    description=(
        "Sistema de Gestión de Uniformes — API REST multi-tenant.\n\n"
        "## Autenticación\n"
        "Dos tipos de Bearer Token (JWT):\n"
        "- **Staff JWT** — Obtenido via `POST /api/v1/auth/login`. Expira en **30 minutos**. "
        "Incluye `user_id`, `is_superuser`, y school roles.\n"
        "- **Portal Client JWT** — Obtenido via `POST /api/v1/portal/clients/login`. "
        "Incluye `client_id` y `client_type: web_client`. Aislado del staff auth.\n\n"
        "## Multi-Tenant Isolation\n"
        "Todos los endpoints bajo `/schools/{school_id}/` validan que el usuario autenticado "
        "tiene acceso al school especificado. Requests a schools no autorizados retornan **403**. "
        "El `school_id` es validado server-side contra los roles del usuario en la DB. "
        "El service layer filtra por `Model.school_id == school_id` en cada query.\n\n"
        "## Permission System\n"
        "Endpoints usan permisos granulares (ej: `sales.create`, `accounting.view_global_balances`). "
        "Cada permiso se verifica contra el rol del usuario en el school target. "
        "Endpoints globales usan `require_global_permission()` que valida acceso cross-school. "
        "Endpoints de superuser usan `require_superuser` que verifica `is_superuser=True`.\n\n"
        "## Rate Limiting\n"
        "Rate limiting global: **120 req/min** por IP. "
        "Endpoints sensibles tienen limites especificos: "
        "login staff **5/min**, login portal **5/min**, webhooks **10/min**. "
        "Exceder el limite retorna **429 Too Many Requests**.\n\n"
        "## Portal de Clientes\n"
        "Los endpoints bajo `/portal/` requieren **Portal Client JWT**. "
        "Los clientes solo pueden acceder a sus propios datos (ordenes, pagos, PQRS).\n\n"
        "## Webhooks\n"
        "El endpoint `POST /payments/webhooks/wompi` es publico pero valida la firma "
        "HMAC-SHA256 del payload usando `hmac.compare_digest()` con el Wompi events secret key. "
        "Payloads con firma invalida son rechazados silenciosamente.\n\n"
        "## Production Security\n"
        "In production (ENV=production): `/docs`, `/redoc`, and `/openapi.json` are **disabled**. "
        "The `/health` endpoint requires superuser auth. `/ping` is the only unauthenticated "
        "health probe and returns only `{status: ok}`. "
        "CORS is configured with an explicit allowlist of origins (not `*`)."
    ),
    contact={"name": "Uniformes Consuelo Rios"},
    openapi_url=f"{settings.API_V1_STR}/openapi.json" if settings.ENV != "production" else None,
    docs_url="/docs" if settings.ENV != "production" else None,
    redoc_url="/redoc" if settings.ENV != "production" else None,
    openapi_tags=OPENAPI_TAGS,
    lifespan=lifespan
)

# Rate limiter - asignar al estado de la app
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Diccionario de traducción para mensajes de validación de Pydantic v2.
# Cumple regla CLAUDE.md "Mensajes de error al usuario SIEMPRE en español".
# Las claves coinciden con los `type` que Pydantic emite en cada error.
PYDANTIC_ES_TRANSLATIONS = {
    "missing": "Campo requerido",
    "string_too_short": "Texto demasiado corto",
    "string_too_long": "Texto demasiado largo",
    "string_pattern_mismatch": "Formato inválido",
    "string_type": "Debe ser un texto",
    "value_error": "Valor inválido",
    "greater_than": "Debe ser mayor que {gt}",
    "greater_than_equal": "Debe ser mayor o igual a {ge}",
    "less_than": "Debe ser menor que {lt}",
    "less_than_equal": "Debe ser menor o igual a {le}",
    "int_parsing": "Debe ser un número entero",
    "int_type": "Debe ser un número entero",
    "float_parsing": "Debe ser un número decimal",
    "decimal_parsing": "Debe ser un número decimal",
    "decimal_max_digits": "Demasiados dígitos",
    "bool_parsing": "Debe ser verdadero o falso",
    "bool_type": "Debe ser verdadero o falso",
    "uuid_parsing": "Identificador inválido",
    "uuid_type": "Identificador inválido",
    "datetime_parsing": "Fecha u hora inválida",
    "datetime_type": "Fecha u hora inválida",
    "date_parsing": "Fecha inválida",
    "date_type": "Fecha inválida",
    "literal_error": "Valor no permitido",
    "enum": "Valor no permitido",
    "list_type": "Debe ser una lista",
    "dict_type": "Debe ser un objeto",
    "json_invalid": "JSON inválido",
    "extra_forbidden": "Campo no permitido",
}


def _translate_pydantic_error(error: dict) -> str:
    """Traduce el msg de Pydantic a español usando el dict de templates.
    Si el tipo no está en el diccionario, deja el msg original (mejor que
    nada). Los placeholders {gt}, {le}, etc. se rellenan con `ctx`."""
    err_type = error.get("type", "")
    template = PYDANTIC_ES_TRANSLATIONS.get(err_type)
    if template is None:
        return error.get("msg", "Error de validación")
    ctx = error.get("ctx") or {}
    try:
        return template.format(**ctx)
    except (KeyError, IndexError, ValueError):
        # Si el template tiene placeholders que no están en ctx, devuelve
        # el template literal sin reemplazar.
        return template


# Exception handler to log validation errors
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.error(f"Validation error on {request.method} {request.url}: {exc.errors()}")
    # Ensure all error details are JSON serializable
    # Pydantic v2 may include non-serializable objects (like ValueError) in error context
    errors = []
    for error in exc.errors():
        clean_error = {
            "loc": error.get("loc"),
            "msg": _translate_pydantic_error(error),
            "type": error.get("type"),
        }
        # Only include 'input' if it's serializable
        if "input" in error:
            try:
                json.dumps(error["input"])
                clean_error["input"] = error["input"]
            except (TypeError, ValueError):
                clean_error["input"] = str(error["input"])
        errors.append(clean_error)
    return JSONResponse(
        status_code=400,
        content={"detail": errors}
    )


# Handler for Pydantic validation errors (response serialization failures)
@app.exception_handler(PydanticValidationError)
async def pydantic_validation_exception_handler(request: Request, exc: PydanticValidationError):
    logger.error(f"Pydantic validation error on {request.method} {request.url}: {exc}")
    # Convert Pydantic errors to JSON-serializable format
    errors = []
    for error in exc.errors():
        clean_error = {
            "loc": error.get("loc"),
            "msg": _translate_pydantic_error(error),
            "type": error.get("type"),
        }
        errors.append(clean_error)
    return JSONResponse(
        status_code=400,
        content={"detail": errors}
    )


# Catch-all exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception(f"Unhandled exception on {request.method} {request.url}: {exc}")
    metrics.total_errors_5xx += 1
    fire_and_forget_alert(
        f"<b>Error 500</b>\n"
        f"Path: <code>{request.method} {request.url.path}</code>\n"
        f"Type: <code>{type(exc).__name__}</code>\n"
        f"Error: <code>{str(exc)[:200]}</code>",
        alert_type=f"error_500_{type(exc).__name__}",
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"}
    )


# Middleware to log requests for debugging and add cache headers
from starlette.middleware.base import BaseHTTPMiddleware


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Middleware para agregar headers de seguridad HTTP"""
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)

        # Headers siempre presentes
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"

        # Content Security Policy
        if request.url.path in ("/docs", "/redoc", "/docs/oauth2-redirect"):
            response.headers["Content-Security-Policy"] = (
                "default-src 'self'; "
                "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
                "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
                "img-src 'self' data: https://fastapi.tiangolo.com; "
                "connect-src 'self'"
            )
        else:
            response.headers["Content-Security-Policy"] = (
                "default-src 'self'; "
                "script-src 'self'; "
                "style-src 'self' 'unsafe-inline'; "
                "img-src 'self' data: https:; "
                "connect-src 'self'"
            )

        # HSTS solo si está detrás de HTTPS (verificar con Nginx)
        # Nginx debe tener proxy_set_header X-Forwarded-Proto $scheme;
        if request.headers.get("x-forwarded-proto") == "https" or settings.ENV == "production":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

        return response


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.url.path == "/api/v1/documents" and request.method == "POST":
            content_type = request.headers.get("content-type", "none")
            logger.debug("Document upload request: content-type=%s", content_type)

        response = await call_next(request)

        if request.url.path == "/api/v1/documents" and request.method == "POST" and response.status_code >= 400:
            logger.error("Document upload failed: status=%d", response.status_code)

        # Cache-Control for static uploads — fixes Windows WebView2 aggressive caching
        if request.url.path.startswith("/uploads"):
            response.headers["Cache-Control"] = "no-cache, must-revalidate"
            response.headers["Pragma"] = "no-cache"

        return response

# Security headers middleware
app.add_middleware(SecurityHeadersMiddleware)

# Logging middleware (added first so it runs after CORS)
app.add_middleware(RequestLoggingMiddleware)

# Request context middleware — sets request_id, client_ip, filters scanners
from app.middleware.request_context import RequestContextMiddleware
app.add_middleware(RequestContextMiddleware)

# CORS - Allow specific origins
# NOTE: In FastAPI middleware is processed in LIFO order (last added = first executed)
# CORS middleware must be added LAST so it runs FIRST and handles preflight requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "X-Requested-With", "Cache-Control", "X-Request-ID"],
    expose_headers=["X-Request-ID"],
)

# Routes
app.include_router(health.router, tags=["Health"])
app.include_router(auth.router, prefix=f"{settings.API_V1_STR}")
app.include_router(schools.router, prefix=f"{settings.API_V1_STR}")
app.include_router(users.router, prefix=f"{settings.API_V1_STR}")
app.include_router(products.router, prefix=f"{settings.API_V1_STR}")  # Multi-school products
app.include_router(products.school_router, prefix=f"{settings.API_V1_STR}")  # School-specific products
app.include_router(clients.router, prefix=f"{settings.API_V1_STR}")
app.include_router(clients.web_router, prefix=f"{settings.API_V1_STR}")  # Web portal client endpoints
app.include_router(sales.router, prefix=f"{settings.API_V1_STR}")  # Multi-school sales
app.include_router(sales.school_router, prefix=f"{settings.API_V1_STR}")  # School-specific sales
app.include_router(orders.router, prefix=f"{settings.API_V1_STR}")  # Multi-school orders
app.include_router(orders.school_router, prefix=f"{settings.API_V1_STR}")  # School-specific orders
app.include_router(orders.web_router, prefix=f"{settings.API_V1_STR}")  # Web portal orders
app.include_router(inventory.router, prefix=f"{settings.API_V1_STR}")
app.include_router(inventory_logs.router, prefix=f"{settings.API_V1_STR}")  # Inventory audit logs
app.include_router(inventory_logs.global_router, prefix=f"{settings.API_V1_STR}")  # Global inventory logs
app.include_router(reports.router, prefix=f"{settings.API_V1_STR}")
app.include_router(accounting.router, prefix=f"{settings.API_V1_STR}")
app.include_router(global_accounting.router, prefix=f"{settings.API_V1_STR}")  # Global accounting endpoints
app.include_router(global_reports.router, prefix=f"{settings.API_V1_STR}")  # Global reports (sales across all schools)
app.include_router(fixed_expenses.router, prefix=f"{settings.API_V1_STR}")  # Fixed/recurring expenses
app.include_router(vendors.router, prefix=f"{settings.API_V1_STR}")  # Vendor catalog
app.include_router(employees.router, prefix=f"{settings.API_V1_STR}")  # Employee management
app.include_router(payroll.router, prefix=f"{settings.API_V1_STR}")  # Payroll runs
app.include_router(global_products.router, prefix=f"{settings.API_V1_STR}")
app.include_router(contacts.router, prefix=f"{settings.API_V1_STR}")  # PQRS Contact messages
app.include_router(delivery_zones.router, prefix=f"{settings.API_V1_STR}")  # Delivery zones for web orders
app.include_router(dashboard.router, prefix=f"{settings.API_V1_STR}")  # Global dashboard stats
app.include_router(cfo_dashboard.router, prefix=f"{settings.API_V1_STR}")  # CFO executive dashboard
app.include_router(documents.router, prefix=f"{settings.API_V1_STR}")  # Enterprise documents (superuser only)
app.include_router(alterations.router, prefix=f"{settings.API_V1_STR}")  # Alterations/repairs portal (global)
app.include_router(notifications.router, prefix=f"{settings.API_V1_STR}")  # User notifications
app.include_router(school_users.router, prefix=f"{settings.API_V1_STR}")  # School user management (OWNER self-service)
app.include_router(custom_roles.router, prefix=f"{settings.API_V1_STR}")  # Custom roles management (per-school)
app.include_router(global_roles.router, prefix=f"{settings.API_V1_STR}")  # Global custom roles (transversal)
app.include_router(cash_drawer.router, prefix=f"{settings.API_V1_STR}")  # Cash drawer access control
app.include_router(business_settings.router, prefix=f"{settings.API_V1_STR}")  # Business info (name, contact, address, hours)
app.include_router(email_logs.router, prefix=f"{settings.API_V1_STR}")  # Email audit trail and statistics
app.include_router(print_queue.router, prefix=f"{settings.API_V1_STR}")  # Print queue SSE for cash sale sync
app.include_router(workforce_shifts.router, prefix=f"{settings.API_V1_STR}")  # Workforce: shift templates & schedules
app.include_router(workforce_attendance.router, prefix=f"{settings.API_V1_STR}")  # Workforce: attendance & absences
app.include_router(financial_model.router, prefix=f"{settings.API_V1_STR}")  # Financial model (KPIs, profitability, budgets, etc.)
app.include_router(workforce_checklists.router, prefix=f"{settings.API_V1_STR}")  # Workforce: checklists
app.include_router(workforce_performance.router, prefix=f"{settings.API_V1_STR}")  # Workforce: performance metrics & reviews
app.include_router(workforce_responsibilities.router, prefix=f"{settings.API_V1_STR}")  # Workforce: position responsibilities
app.include_router(payments.router, prefix=f"{settings.API_V1_STR}")  # Wompi payment gateway
app.include_router(telegram_alerts.router, prefix=f"{settings.API_V1_STR}")  # Telegram alert subscriptions
app.include_router(permission_registry.router, prefix=f"{settings.API_V1_STR}")  # Permission registry (public, cacheable)
app.include_router(cost_components.router, prefix=f"{settings.API_V1_STR}")  # Cost component templates & breakdowns
app.include_router(cost_change_log.router, prefix=f"{settings.API_V1_STR}")  # Cost change audit trail
app.include_router(cost_insights.router, prefix=f"{settings.API_V1_STR}")  # Cost insights dashboard endpoints
app.include_router(catalog.router, prefix=f"{settings.API_V1_STR}")  # Catalog: positions, sizes, colors
app.include_router(electronic_invoicing.router, prefix=f"{settings.API_V1_STR}")  # Facturacion electronica DIAN (Alegra)

# Mount static files for uploads (payment proofs, etc.)
# Use environment-based path: production uses /var/www/..., development uses relative path
if settings.ENV == "production":
    uploads_dir = Path("/var/www/uniformes-system-v2/uploads")
else:
    # Use relative path for development/testing
    uploads_dir = Path(__file__).parent.parent / "uploads"

try:
    uploads_dir.mkdir(parents=True, exist_ok=True)
    app.mount("/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")
except PermissionError:
    # Skip mounting if we can't create the directory (e.g., in tests)
    logger.warning("Could not create uploads directory at %s", uploads_dir)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.BACKEND_HOST,
        port=settings.BACKEND_PORT,
        reload=True if settings.ENV == "development" else False
    )
