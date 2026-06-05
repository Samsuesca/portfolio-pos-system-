import logging
import logging.config
import sys

import structlog


def setup_logging(log_level: str = "INFO", log_format: str = "auto", env: str = "development") -> None:
    """Configure structured logging for the entire application.

    Uses structlog as the formatting layer on top of stdlib logging.
    All existing logging.getLogger(__name__) calls continue working
    unchanged — their LogRecords are intercepted by ProcessorFormatter
    and routed through structlog's processor pipeline.
    """
    use_json = _should_use_json(log_format, env)
    level = getattr(logging, log_level.upper(), logging.INFO)

    shared_processors: list[structlog.types.Processor] = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.stdlib.add_logger_name,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
    ]

    if use_json:
        renderer: structlog.types.Processor = structlog.processors.JSONRenderer()
    else:
        renderer = structlog.dev.ConsoleRenderer(colors=sys.stderr.isatty())

    formatter = structlog.stdlib.ProcessorFormatter(
        foreign_pre_chain=shared_processors,
        processors=[
            structlog.stdlib.ProcessorFormatter.remove_processors_meta,
            renderer,
        ],
    )

    logging.config.dictConfig({
        "version": 1,
        "disable_existing_loggers": False,
        "handlers": {
            "structured": {
                "class": "logging.StreamHandler",
                "stream": "ext://sys.stdout",
                "formatter": "structlog",
            },
        },
        "formatters": {
            "structlog": {
                "()": lambda: formatter,
            },
        },
        "loggers": {
            "": {
                "handlers": ["structured"],
                "level": level,
                "propagate": False,
            },
            "uvicorn": {
                "handlers": ["structured"],
                "level": level,
                "propagate": False,
            },
            "uvicorn.access": {
                "handlers": ["structured"],
                "level": "WARNING",
                "propagate": False,
            },
            "uvicorn.error": {
                "handlers": ["structured"],
                "level": level,
                "propagate": False,
            },
            # httpx logs every request URL at INFO; for Telegram/Wompi those
            # URLs embed the bot token / secrets. Keep it at WARNING so tokens
            # never reach the logs.
            "httpx": {
                "handlers": ["structured"],
                "level": "WARNING",
                "propagate": False,
            },
        },
    })

    structlog.configure(
        processors=[
            *shared_processors,
            structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
        ],
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )


def _should_use_json(log_format: str, env: str) -> bool:
    if log_format == "json":
        return True
    if log_format == "console":
        return False
    return env == "production"
