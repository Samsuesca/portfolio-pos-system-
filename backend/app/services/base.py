"""
Base CRUD Service with common operations
"""
from typing import TypeVar, Generic, Type, Any
from uuid import UUID
from sqlalchemy import select, update, delete, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import Base

ModelType = TypeVar("ModelType", bound=Base)


class BaseService(Generic[ModelType]):
    """
    Base service class with common CRUD operations

    Usage:
        class SchoolService(BaseService[School]):
            def __init__(self, db: AsyncSession):
                super().__init__(School, db)
    """

    def __init__(self, model: Type[ModelType], db: AsyncSession):
        """
        Initialize base service

        Args:
            model: SQLAlchemy model class
            db: Database session
        """
        self.model = model
        self.db = db

    async def create(self, obj_data: dict[str, Any]) -> ModelType:
        """
        Create a new record

        Args:
            obj_data: Dictionary with model data

        Returns:
            Created model instance
        """
        db_obj = self.model(**obj_data)
        self.db.add(db_obj)
        await self.db.flush()
        await self.db.refresh(db_obj)
        return db_obj

    async def get(self, id: UUID) -> ModelType | None:
        """
        Get record by ID

        Args:
            id: Record UUID

        Returns:
            Model instance or None if not found
        """
        result = await self.db.execute(
            select(self.model).where(self.model.id == id)
        )
        return result.scalar_one_or_none()

    async def get_multi(
        self,
        *,
        skip: int = 0,
        limit: int = 100,
        filters: dict[str, Any] | None = None
    ) -> list[ModelType]:
        """
        Get multiple records with pagination and filters

        Args:
            skip: Number of records to skip
            limit: Maximum number of records to return
            filters: Dictionary of field:value filters

        Returns:
            List of model instances
        """
        query = select(self.model)

        # Apply filters
        if filters:
            for field, value in filters.items():
                if hasattr(self.model, field):
                    query = query.where(getattr(self.model, field) == value)

        query = query.offset(skip).limit(limit).order_by(self.model.id)

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def update(self, id: UUID, obj_data: dict[str, Any]) -> ModelType | None:
        """
        Update record by ID

        Args:
            id: Record UUID
            obj_data: Dictionary with fields to update

        Returns:
            Updated model instance or None if not found
        """
        # Remove None values
        update_data = {k: v for k, v in obj_data.items() if v is not None}

        if not update_data:
            return await self.get(id)

        await self.db.execute(
            update(self.model)
            .where(self.model.id == id)
            .values(**update_data)
        )
        await self.db.flush()

        return await self.get(id)

    async def delete(self, id: UUID) -> bool:
        """
        Delete record by ID (hard delete)

        Args:
            id: Record UUID

        Returns:
            True if deleted, False if not found
        """
        result = await self.db.execute(
            delete(self.model).where(self.model.id == id)
        )
        await self.db.flush()
        return result.rowcount > 0

    async def soft_delete(self, id: UUID) -> ModelType | None:
        """
        Soft delete record (set is_active=False)
        Only works if model has is_active field

        Args:
            id: Record UUID

        Returns:
            Updated model instance or None if not found
        """
        if not hasattr(self.model, 'is_active'):
            raise ValueError(f"{self.model.__name__} does not support soft delete")

        return await self.update(id, {"is_active": False})

    async def count(self, filters: dict[str, Any] | None = None) -> int:
        """
        Count records with optional filters

        Args:
            filters: Dictionary of field:value filters

        Returns:
            Number of records
        """
        query = select(func.count(self.model.id))

        if filters:
            for field, value in filters.items():
                if hasattr(self.model, field):
                    query = query.where(getattr(self.model, field) == value)

        result = await self.db.execute(query)
        return result.scalar_one()

    async def exists(self, id: UUID) -> bool:
        """
        Check if record exists

        Args:
            id: Record UUID

        Returns:
            True if exists, False otherwise
        """
        result = await self.db.execute(
            select(func.count(self.model.id)).where(self.model.id == id)
        )
        return result.scalar_one() > 0


class SchoolIsolatedService(BaseService[ModelType]):
    """
    Base service for multi-tenant models (with school_id)
    All operations automatically filter by school_id
    """

    async def get(self, id: UUID, school_id: UUID) -> ModelType | None:
        """Get record by ID and school_id"""
        result = await self.db.execute(
            select(self.model).where(
                self.model.id == id,
                self.model.school_id == school_id
            )
        )
        return result.scalar_one_or_none()

    async def get_multi(
        self,
        *,
        school_id: UUID,
        skip: int = 0,
        limit: int = 100,
        filters: dict[str, Any] | None = None
    ) -> list[ModelType]:
        """Get multiple records filtered by school_id"""
        query = select(self.model).where(self.model.school_id == school_id)

        # Apply additional filters
        if filters:
            for field, value in filters.items():
                if hasattr(self.model, field):
                    query = query.where(getattr(self.model, field) == value)

        query = query.offset(skip).limit(limit).order_by(self.model.id)

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def update(
        self,
        id: UUID,
        school_id: UUID,
        obj_data: dict[str, Any]
    ) -> ModelType | None:
        """Update record ensuring school_id isolation"""
        # Verify record belongs to school
        existing = await self.get(id, school_id)
        if not existing:
            return None

        # Remove None values and school_id (can't be changed)
        update_data = {k: v for k, v in obj_data.items() if v is not None and k != 'school_id'}

        if not update_data:
            return existing

        # Apply updates directly to the object
        for field, value in update_data.items():
            setattr(existing, field, value)

        await self.db.flush()
        await self.db.refresh(existing)

        return existing

    async def delete(self, id: UUID, school_id: UUID) -> bool:
        """Delete record ensuring school_id isolation"""
        result = await self.db.execute(
            delete(self.model).where(
                self.model.id == id,
                self.model.school_id == school_id
            )
        )
        await self.db.flush()
        return result.rowcount > 0

    async def soft_delete(self, id: UUID, school_id: UUID) -> ModelType | None:
        """Soft delete with school_id isolation"""
        if not hasattr(self.model, 'is_active'):
            raise ValueError(f"{self.model.__name__} does not support soft delete")

        return await self.update(id, school_id, {"is_active": False})

    async def count(self, school_id: UUID, filters: dict[str, Any] | None = None) -> int:
        """Count records for a specific school"""
        query = select(func.count(self.model.id)).where(
            self.model.school_id == school_id
        )

        if filters:
            for field, value in filters.items():
                if hasattr(self.model, field):
                    query = query.where(getattr(self.model, field) == value)

        result = await self.db.execute(query)
        return result.scalar_one()

    async def exists(self, id: UUID, school_id: UUID) -> bool:
        """Check if record exists for a specific school"""
        result = await self.db.execute(
            select(func.count(self.model.id)).where(
                self.model.id == id,
                self.model.school_id == school_id
            )
        )
        return result.scalar_one() > 0

    async def get_by_code(self, code: str, school_id: UUID) -> ModelType | None:
        """
        Get record by code and school_id
        Only works if model has 'code' field
        """
        if not hasattr(self.model, 'code'):
            raise ValueError(f"{self.model.__name__} does not have a 'code' field")

        result = await self.db.execute(
            select(self.model).where(
                self.model.code == code,
                self.model.school_id == school_id
            )
        )
        return result.scalar_one_or_none()
