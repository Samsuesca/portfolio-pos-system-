"""
Business Settings Service

Provides methods to get and update business configuration.
Includes in-memory caching with TTL for performance.
"""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from uuid import UUID
from datetime import datetime, timedelta
import asyncio

from app.utils.timezone import get_colombia_now_naive
from app.models.business_settings import BusinessSettings, DEFAULT_BUSINESS_SETTINGS
from app.schemas.business_settings import BusinessInfoResponse, BusinessInfoUpdate


class BusinessSettingsCache:
    """Simple in-memory cache with TTL."""

    def __init__(self, ttl_seconds: int = 300):  # 5 minutes default
        self._cache: Optional[dict] = None
        self._expires_at: Optional[datetime] = None
        self._ttl = timedelta(seconds=ttl_seconds)
        self._lock = asyncio.Lock()

    def get(self) -> Optional[dict]:
        """Get cached data if not expired."""
        if self._cache is None or self._expires_at is None:
            return None
        if get_colombia_now_naive() > self._expires_at:
            self._cache = None
            self._expires_at = None
            return None
        return self._cache

    def set(self, data: dict) -> None:
        """Set cache data with TTL."""
        self._cache = data
        self._expires_at = get_colombia_now_naive() + self._ttl

    def invalidate(self) -> None:
        """Clear the cache."""
        self._cache = None
        self._expires_at = None


# Global cache instance
_settings_cache = BusinessSettingsCache()


class BusinessSettingsService:
    """Service for managing business settings."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_all_settings(self) -> dict[str, str]:
        """
        Get all business settings as a flat dictionary.
        Uses cache if available.
        """
        # Check cache first
        cached = _settings_cache.get()
        if cached is not None:
            return cached

        # Query database
        result = await self.db.execute(select(BusinessSettings))
        settings = result.scalars().all()

        # Convert to dict
        settings_dict = {s.key: s.value for s in settings}

        # Fill in defaults for any missing keys
        for key, config in DEFAULT_BUSINESS_SETTINGS.items():
            if key not in settings_dict:
                settings_dict[key] = config["value"]

        # Update cache
        _settings_cache.set(settings_dict)

        return settings_dict

    async def get_business_info(self) -> BusinessInfoResponse:
        """Get business info as a typed response object."""
        settings = await self.get_all_settings()
        return BusinessInfoResponse(**settings)

    async def get_setting(self, key: str) -> Optional[str]:
        """Get a single setting value."""
        settings = await self.get_all_settings()
        return settings.get(key)

    async def update_setting(
        self,
        key: str,
        value: str,
        updated_by: Optional[UUID] = None
    ) -> bool:
        """
        Update a single setting.
        Returns True if successful.
        """
        result = await self.db.execute(
            select(BusinessSettings).where(BusinessSettings.key == key)
        )
        setting = result.scalar_one_or_none()

        if setting:
            setting.value = value
            setting.updated_by = updated_by
            setting.updated_at = get_colombia_now_naive()
        else:
            # Create new setting
            description = DEFAULT_BUSINESS_SETTINGS.get(key, {}).get("description", "")
            setting = BusinessSettings(
                key=key,
                value=value,
                description=description,
                updated_by=updated_by
            )
            self.db.add(setting)

        await self.db.flush()

        # Invalidate cache
        _settings_cache.invalidate()

        return True

    async def update_bulk(
        self,
        updates: BusinessInfoUpdate,
        updated_by: Optional[UUID] = None
    ) -> BusinessInfoResponse:
        """
        Update multiple settings at once.
        Only updates fields that are provided (not None).
        """
        # Get current settings
        current = await self.get_all_settings()

        # Convert updates to dict, excluding None values
        updates_dict = updates.model_dump(exclude_none=True)

        # Update each changed setting
        for key, value in updates_dict.items():
            if key in current and current[key] != value:
                await self.update_setting(key, value, updated_by)
            elif key not in current:
                await self.update_setting(key, value, updated_by)

        # Return updated settings
        return await self.get_business_info()

    async def seed_defaults(self) -> int:
        """
        Seed default settings if they don't exist.
        Returns number of settings created.
        """
        created = 0
        for key, config in DEFAULT_BUSINESS_SETTINGS.items():
            result = await self.db.execute(
                select(BusinessSettings).where(BusinessSettings.key == key)
            )
            if not result.scalar_one_or_none():
                setting = BusinessSettings(
                    key=key,
                    value=config["value"],
                    description=config["description"]
                )
                self.db.add(setting)
                created += 1

        if created > 0:
            await self.db.flush()
            _settings_cache.invalidate()

        return created


def invalidate_business_settings_cache():
    """Utility function to invalidate cache from outside the service."""
    _settings_cache.invalidate()
