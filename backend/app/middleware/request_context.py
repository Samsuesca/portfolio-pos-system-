import logging
import time
import uuid

import structlog

from starlette.types import ASGIApp, Receive, Scope, Send

logger = logging.getLogger("app.access")

_SCANNER_PATH_PREFIXES = frozenset({
    "/.env", "/.git", "/wp-admin", "/wp-login", "/wp-content", "/wp-includes",
    "/phpmyadmin", "/pma", "/actuator", "/solr", "/cgi-bin", "/.aws",
    "/xmlrpc.php", "/config.json", "/telescope", "/vendor/phpunit",
    "/vendor/vendor", "/phpunit", "/lib/phpunit", "/debug", "/console",
    "/admin/config", "/containers/json", "/sdk", "/HNAP1", "/evox",
    "/hello.world", "/odinhttpcall",
})

_SCANNER_PATH_EXTENSIONS = frozenset({
    ".php", ".asp", ".aspx", ".jsp", ".cgi",
})

_SCANNER_USER_AGENTS = frozenset({
    "zgrab", "masscan", "nmap", "nikto", "sqlmap", "gobuster",
    "dirbuster", "nuclei", "httpx", "censys", "shodan",
})


def _extract_header(headers: list[tuple[bytes, bytes]], name: bytes) -> str | None:
    for key, value in headers:
        if key == name:
            return value.decode("latin-1").strip()
    return None


def _extract_client_ip(headers: list[tuple[bytes, bytes]], scope: Scope) -> str:
    real_ip = _extract_header(headers, b"x-real-ip")
    if real_ip:
        return real_ip

    forwarded_for = _extract_header(headers, b"x-forwarded-for")
    if forwarded_for:
        first_ip = forwarded_for.split(",")[0].strip()
        if first_ip:
            return first_ip

    client = scope.get("client")
    if client:
        return client[0]
    return "unknown"


def _is_scanner_request(path: str, user_agent: str | None) -> bool:
    path_lower = path.lower()

    for prefix in _SCANNER_PATH_PREFIXES:
        if path_lower.startswith(prefix):
            return True

    for ext in _SCANNER_PATH_EXTENSIONS:
        if path_lower.endswith(ext):
            return True

    if "allow_url_include" in path_lower or "eval-stdin" in path_lower:
        return True

    if user_agent:
        ua_lower = user_agent.lower()
        for scanner in _SCANNER_USER_AGENTS:
            if scanner in ua_lower:
                return True

    if not user_agent:
        if not path.startswith("/api/") and path != "/health":
            return True

    return False


class RequestContextMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] not in ("http", "websocket"):
            await self.app(scope, receive, send)
            return

        headers = scope.get("headers", [])
        request_id = _extract_header(headers, b"x-request-id") or uuid.uuid4().hex[:12]
        client_ip = _extract_client_ip(headers, scope)
        method = scope.get("method", "WS")
        path = scope.get("path", "/")
        user_agent = _extract_header(headers, b"user-agent")
        is_scanner = _is_scanner_request(path, user_agent)

        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(
            request_id=request_id,
            client_ip=client_ip,
        )

        status_code = 0
        start = time.perf_counter()

        async def send_with_request_id(message: dict) -> None:
            nonlocal status_code
            if message["type"] == "http.response.start":
                status_code = message.get("status", 0)
                headers_list = list(message.get("headers", []))
                headers_list.append((b"x-request-id", request_id.encode()))
                message = {**message, "headers": headers_list}
            await send(message)

        try:
            await self.app(scope, receive, send_with_request_id)
        finally:
            duration_ms = round((time.perf_counter() - start) * 1000, 1)
            log_level = logging.DEBUG if is_scanner else logging.INFO
            logger.log(
                log_level,
                "%s %s %d %.1fms",
                method, path, status_code, duration_ms,
                extra={
                    "http_method": method,
                    "http_path": path,
                    "http_status": status_code,
                    "duration_ms": duration_ms,
                },
            )
            structlog.contextvars.clear_contextvars()


def get_client_ip() -> str | None:
    ctx = structlog.contextvars.get_contextvars()
    return ctx.get("client_ip")


def get_request_id() -> str | None:
    ctx = structlog.contextvars.get_contextvars()
    return ctx.get("request_id")
