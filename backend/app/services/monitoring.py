"""In-memory health metrics and periodic sampling for Uniformes System."""

import logging
import shutil
import time
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.utils.timezone import get_colombia_now_naive

logger = logging.getLogger("monitoring")

# Store last 1440 samples (24h at 1 sample/min)
MAX_SAMPLES = 1440


@dataclass
class HealthSample:
    timestamp: datetime
    db_ok: bool
    db_latency_ms: float
    disk_usage_pct: float
    memory_usage_pct: float
    uptime_seconds: float


@dataclass
class HealthMetrics:
    """In-memory ring buffer of health samples."""

    samples: deque = field(default_factory=lambda: deque(maxlen=MAX_SAMPLES))
    start_time: float = field(default_factory=time.monotonic)
    total_requests: int = 0
    total_errors_5xx: int = 0

    @property
    def uptime_seconds(self) -> float:
        return time.monotonic() - self.start_time

    @property
    def uptime_pct(self) -> float:
        if not self.samples:
            return 100.0
        ok_count = sum(1 for s in self.samples if s.db_ok)
        return round((ok_count / len(self.samples)) * 100, 2)

    @property
    def avg_db_latency_ms(self) -> float:
        if not self.samples:
            return 0.0
        return round(
            sum(s.db_latency_ms for s in self.samples) / len(self.samples), 2
        )


# Global singleton
metrics = HealthMetrics()


async def collect_health_sample(db: AsyncSession) -> HealthSample:
    """Collect a single health sample (DB, disk, memory)."""
    # DB check
    db_ok = False
    db_latency_ms = 0.0
    try:
        start = time.perf_counter()
        await db.execute(text("SELECT 1"))
        db_latency_ms = round((time.perf_counter() - start) * 1000, 2)
        db_ok = True
    except Exception as e:
        logger.error("Health DB check failed: %s", e)

    # Disk
    disk = shutil.disk_usage("/")
    disk_pct = round((disk.used / disk.total) * 100, 1)

    # Memory (Linux /proc/meminfo)
    mem_pct = _get_memory_usage_pct()

    sample = HealthSample(
        timestamp=get_colombia_now_naive(),
        db_ok=db_ok,
        db_latency_ms=db_latency_ms,
        disk_usage_pct=disk_pct,
        memory_usage_pct=mem_pct,
        uptime_seconds=metrics.uptime_seconds,
    )
    metrics.samples.append(sample)
    return sample


def _get_memory_usage_pct() -> float:
    """Read memory usage from /proc/meminfo (Linux only)."""
    try:
        with open("/proc/meminfo") as f:
            lines = f.readlines()
        info = {}
        for line in lines[:5]:
            parts = line.split()
            info[parts[0].rstrip(":")] = int(parts[1])
        total = info.get("MemTotal", 1)
        available = info.get("MemAvailable", total)
        return round(((total - available) / total) * 100, 1)
    except (FileNotFoundError, KeyError):
        # macOS or non-Linux — return 0
        return 0.0
