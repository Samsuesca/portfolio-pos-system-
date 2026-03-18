from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import get_db
from app.services.monitoring import collect_health_sample, metrics
from app.utils.timezone import get_colombia_now_naive

router = APIRouter()


@router.get("/ping")
async def ping():
    """Lightweight liveness probe."""
    return {"status": "ok"}


@router.get("/health")
async def health_check(db: AsyncSession = Depends(get_db)):
    """Comprehensive health check with DB, disk, and memory status."""
    sample = await collect_health_sample(db)

    return {
        "status": "ok" if sample.db_ok else "degraded",
        "version": settings.VERSION,
        "service": settings.PROJECT_NAME,
        "environment": settings.ENV,
        "timestamp": get_colombia_now_naive().isoformat(),
        "checks": {
            "database": {
                "status": "ok" if sample.db_ok else "error",
                "latency_ms": sample.db_latency_ms,
            },
            "disk": {
                "usage_pct": sample.disk_usage_pct,
                "status": "ok" if sample.disk_usage_pct < settings.DISK_ALERT_THRESHOLD_PCT else "warning",
            },
            "memory": {
                "usage_pct": sample.memory_usage_pct,
                "status": "ok" if sample.memory_usage_pct < 85 else "warning",
            },
        },
        "uptime_seconds": round(metrics.uptime_seconds),
        "uptime_pct": metrics.uptime_pct,
        "total_errors_5xx": metrics.total_errors_5xx,
    }
