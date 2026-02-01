"""
Timezone utilities for Colombia (UTC-5)

This module provides centralized timezone handling for the entire application.
All timezone-aware operations should use these utilities to ensure consistency.
"""
from datetime import datetime, date, timedelta
from zoneinfo import ZoneInfo

# Colombia timezone (UTC-5, no DST)
COLOMBIA_TZ = ZoneInfo("America/Bogota")


def get_colombia_now() -> datetime:
    """Get current datetime in Colombia timezone"""
    return datetime.now(COLOMBIA_TZ)


def get_colombia_date() -> date:
    """Get current date in Colombia timezone"""
    return datetime.now(COLOMBIA_TZ).date()


def get_colombia_datetime_range(target_date: date) -> tuple[datetime, datetime]:
    """
    Get start and end datetime for a given date in Colombia timezone.
    Returns (start_of_day, end_of_day) as timezone-aware datetimes.
    """
    start = datetime.combine(target_date, datetime.min.time(), tzinfo=COLOMBIA_TZ)
    end = datetime.combine(target_date, datetime.max.time(), tzinfo=COLOMBIA_TZ)
    return start, end


def get_colombia_now_naive() -> datetime:
    """
    Get current datetime in Colombia timezone as naive datetime.
    Useful for database storage when timezone info should be stripped.
    """
    return datetime.now(COLOMBIA_TZ).replace(tzinfo=None)


def get_colombia_datetime_range_naive(target_date: date) -> tuple[datetime, datetime]:
    """
    Get start and end datetime for a given date in Colombia timezone as naive datetimes.
    Useful for database queries comparing with naive datetime columns.

    Returns (start_of_day, end_of_day) with timezone stripped.
    """
    start, end = get_colombia_datetime_range(target_date)
    return start.replace(tzinfo=None), end.replace(tzinfo=None)
