"""
Tests for monitoring service (HealthMetrics, collect_health_sample, _get_memory_usage_pct).

Covers:
- HealthMetrics.uptime_seconds: increases over time
- HealthMetrics.uptime_pct: all ok=100%, some failed, empty=100%
- HealthMetrics.avg_db_latency_ms: average calculation, empty=0
- collect_health_sample: happy path (DB ok), DB failure
- _get_memory_usage_pct: Linux mock, non-Linux fallback
- samples deque: respects MAX_SAMPLES limit
"""
import time
from collections import deque
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, mock_open, patch

import pytest

from app.services.monitoring import (
    HealthMetrics,
    HealthSample,
    MAX_SAMPLES,
    _get_memory_usage_pct,
    collect_health_sample,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _sample(db_ok: bool = True, db_latency_ms: float = 5.0) -> HealthSample:
    return HealthSample(
        timestamp=datetime(2026, 4, 14, 10, 0, 0),
        db_ok=db_ok,
        db_latency_ms=db_latency_ms,
        disk_usage_pct=50.0,
        memory_usage_pct=40.0,
        uptime_seconds=100.0,
    )


# ---------------------------------------------------------------------------
# HealthMetrics.uptime_seconds
# ---------------------------------------------------------------------------

class TestUptimeSeconds:

    def test_increases_over_time(self):
        m = HealthMetrics(start_time=time.monotonic() - 60)
        assert m.uptime_seconds >= 59.0

    def test_starts_near_zero(self):
        m = HealthMetrics(start_time=time.monotonic())
        assert m.uptime_seconds < 1.0


# ---------------------------------------------------------------------------
# HealthMetrics.uptime_pct
# ---------------------------------------------------------------------------

class TestUptimePct:

    def test_all_ok_is_100(self):
        m = HealthMetrics()
        m.samples.extend([_sample(db_ok=True) for _ in range(10)])
        assert m.uptime_pct == 100.0

    def test_some_failed(self):
        m = HealthMetrics()
        m.samples.extend([_sample(db_ok=True) for _ in range(7)])
        m.samples.extend([_sample(db_ok=False) for _ in range(3)])
        assert m.uptime_pct == 70.0

    def test_all_failed(self):
        m = HealthMetrics()
        m.samples.extend([_sample(db_ok=False) for _ in range(5)])
        assert m.uptime_pct == 0.0

    def test_empty_returns_100(self):
        m = HealthMetrics()
        assert m.uptime_pct == 100.0


# ---------------------------------------------------------------------------
# HealthMetrics.avg_db_latency_ms
# ---------------------------------------------------------------------------

class TestAvgDbLatency:

    def test_average_calculation(self):
        m = HealthMetrics()
        m.samples.extend([
            _sample(db_latency_ms=10.0),
            _sample(db_latency_ms=20.0),
            _sample(db_latency_ms=30.0),
        ])
        assert m.avg_db_latency_ms == 20.0

    def test_empty_returns_zero(self):
        m = HealthMetrics()
        assert m.avg_db_latency_ms == 0.0

    def test_single_sample(self):
        m = HealthMetrics()
        m.samples.append(_sample(db_latency_ms=7.5))
        assert m.avg_db_latency_ms == 7.5


# ---------------------------------------------------------------------------
# samples deque maxlen
# ---------------------------------------------------------------------------

class TestSamplesDeque:

    def test_respects_max_samples(self):
        m = HealthMetrics()
        for i in range(MAX_SAMPLES + 100):
            m.samples.append(_sample(db_latency_ms=float(i)))
        assert len(m.samples) == MAX_SAMPLES

    def test_oldest_dropped_first(self):
        m = HealthMetrics()
        for i in range(MAX_SAMPLES + 5):
            m.samples.append(_sample(db_latency_ms=float(i)))
        assert m.samples[0].db_latency_ms == 5.0


# ---------------------------------------------------------------------------
# collect_health_sample
# ---------------------------------------------------------------------------

class TestCollectHealthSample:

    @pytest.mark.asyncio
    @patch("app.services.monitoring._get_memory_usage_pct", return_value=45.0)
    @patch("app.services.monitoring.shutil")
    @patch("app.services.monitoring.get_colombia_now_naive")
    async def test_happy_path_db_ok(self, mock_now, mock_shutil, mock_mem):
        fake_now = datetime(2026, 4, 14, 12, 0, 0)
        mock_now.return_value = fake_now
        mock_shutil.disk_usage.return_value = MagicMock(used=50, total=100)
        fresh_metrics = HealthMetrics()

        db = AsyncMock()
        db.execute = AsyncMock()

        with patch("app.services.monitoring.metrics", fresh_metrics):
            sample = await collect_health_sample(db)

        assert sample.db_ok is True
        assert sample.db_latency_ms >= 0
        assert sample.disk_usage_pct == 50.0
        assert sample.memory_usage_pct == 45.0
        assert sample.timestamp == fake_now

    @pytest.mark.asyncio
    @patch("app.services.monitoring._get_memory_usage_pct", return_value=0.0)
    @patch("app.services.monitoring.shutil")
    @patch("app.services.monitoring.get_colombia_now_naive")
    async def test_db_failure(self, mock_now, mock_shutil, mock_mem):
        mock_now.return_value = datetime(2026, 4, 14)
        mock_shutil.disk_usage.return_value = MagicMock(used=10, total=100)
        fresh_metrics = HealthMetrics()

        db = AsyncMock()
        db.execute = AsyncMock(side_effect=Exception("connection refused"))

        with patch("app.services.monitoring.metrics", fresh_metrics):
            sample = await collect_health_sample(db)

        assert sample.db_ok is False
        assert sample.db_latency_ms == 0.0

    @pytest.mark.asyncio
    @patch("app.services.monitoring._get_memory_usage_pct", return_value=0.0)
    @patch("app.services.monitoring.shutil")
    @patch("app.services.monitoring.get_colombia_now_naive")
    async def test_appends_to_metrics(self, mock_now, mock_shutil, mock_mem):
        mock_now.return_value = datetime(2026, 4, 14)
        mock_shutil.disk_usage.return_value = MagicMock(used=30, total=100)
        fresh_metrics = HealthMetrics()

        db = AsyncMock()

        with patch("app.services.monitoring.metrics", fresh_metrics):
            sample = await collect_health_sample(db)

        assert len(fresh_metrics.samples) == 1
        assert fresh_metrics.samples[0] is sample


# ---------------------------------------------------------------------------
# _get_memory_usage_pct
# ---------------------------------------------------------------------------

class TestGetMemoryUsagePct:

    def test_linux_reads_proc_meminfo(self):
        meminfo_content = (
            "MemTotal:       16384000 kB\n"
            "MemFree:         2000000 kB\n"
            "MemAvailable:    8192000 kB\n"
            "Buffers:          500000 kB\n"
            "Cached:          3000000 kB\n"
        )
        with patch("builtins.open", mock_open(read_data=meminfo_content)):
            result = _get_memory_usage_pct()

        expected = round(((16384000 - 8192000) / 16384000) * 100, 1)
        assert result == expected

    def test_non_linux_returns_zero(self):
        with patch("builtins.open", side_effect=FileNotFoundError):
            result = _get_memory_usage_pct()
        assert result == 0.0

    def test_missing_key_returns_zero(self):
        meminfo_content = "SomeOtherKey: 12345 kB\n"
        with patch("builtins.open", mock_open(read_data=meminfo_content)):
            result = _get_memory_usage_pct()
        assert result == 0.0
