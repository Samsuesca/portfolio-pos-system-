"""
Expense Category Service

CRUD operations for expense categories.
System categories (is_system=True) cannot be deleted.
"""
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from uuid import UUID
from datetime import datetime

from app.utils.timezone import get_colombia_now_naive
from app.models.accounting import ExpenseCategoryModel
from app.schemas.accounting import (
    ExpenseCategoryCreate,
    ExpenseCategoryUpdate,
    ExpenseCategoryResponse,
    ExpenseCategoryListResponse
)


class ExpenseCategoryService:
    """Service for managing expense categories."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_categories(
        self,
        include_inactive: bool = False,
        limit: int = 100,
        offset: int = 0
    ) -> list[ExpenseCategoryListResponse]:
        """
        List all expense categories.
        By default only returns active categories.
        """
        query = select(ExpenseCategoryModel)

        if not include_inactive:
            query = query.where(ExpenseCategoryModel.is_active == True)

        query = query.order_by(
            ExpenseCategoryModel.display_order.asc(),
            ExpenseCategoryModel.name.asc()
        ).offset(offset).limit(limit)

        result = await self.db.execute(query)
        categories = result.scalars().all()

        return [
            ExpenseCategoryListResponse(
                id=cat.id,
                code=cat.code,
                name=cat.name,
                color=cat.color,
                icon=cat.icon,
                is_system=cat.is_system,
                is_active=cat.is_active,
                display_order=cat.display_order
            )
            for cat in categories
        ]

    async def get_by_id(self, category_id: UUID) -> Optional[ExpenseCategoryResponse]:
        """Get a single category by ID."""
        result = await self.db.execute(
            select(ExpenseCategoryModel).where(ExpenseCategoryModel.id == category_id)
        )
        category = result.scalar_one_or_none()

        if not category:
            return None

        return ExpenseCategoryResponse.model_validate(category)

    async def get_by_code(self, code: str) -> Optional[ExpenseCategoryResponse]:
        """Get a single category by code."""
        result = await self.db.execute(
            select(ExpenseCategoryModel).where(ExpenseCategoryModel.code == code.lower())
        )
        category = result.scalar_one_or_none()

        if not category:
            return None

        return ExpenseCategoryResponse.model_validate(category)

    async def create(self, data: ExpenseCategoryCreate) -> ExpenseCategoryResponse:
        """
        Create a new expense category.
        Raises ValueError if code already exists.
        """
        # Check if code already exists
        existing = await self.get_by_code(data.code)
        if existing:
            raise ValueError(f"Ya existe una categoría con el código '{data.code}'")

        # Get max display_order for new categories
        result = await self.db.execute(
            select(func.max(ExpenseCategoryModel.display_order))
        )
        max_order = result.scalar() or 0

        category = ExpenseCategoryModel(
            code=data.code.lower(),
            name=data.name,
            description=data.description,
            color=data.color,
            icon=data.icon,
            is_system=False,  # User-created categories are never system
            is_active=True,
            display_order=data.display_order if data.display_order > 0 else max_order + 1
        )

        self.db.add(category)
        await self.db.flush()
        await self.db.refresh(category)

        return ExpenseCategoryResponse.model_validate(category)

    async def update(
        self,
        category_id: UUID,
        data: ExpenseCategoryUpdate
    ) -> Optional[ExpenseCategoryResponse]:
        """
        Update an expense category.
        System categories can be updated (name, color, etc.) but not deleted.
        """
        result = await self.db.execute(
            select(ExpenseCategoryModel).where(ExpenseCategoryModel.id == category_id)
        )
        category = result.scalar_one_or_none()

        if not category:
            return None

        # Apply updates (only non-None values)
        update_data = data.model_dump(exclude_unset=True)

        for field, value in update_data.items():
            if hasattr(category, field):
                setattr(category, field, value)

        category.updated_at = get_colombia_now_naive()

        await self.db.flush()
        await self.db.refresh(category)

        return ExpenseCategoryResponse.model_validate(category)

    async def delete(self, category_id: UUID) -> bool:
        """
        Delete (soft-delete) an expense category.
        System categories cannot be deleted.
        Returns False if category not found or is a system category.
        """
        result = await self.db.execute(
            select(ExpenseCategoryModel).where(ExpenseCategoryModel.id == category_id)
        )
        category = result.scalar_one_or_none()

        if not category:
            return False

        if category.is_system:
            raise ValueError("No se puede eliminar una categoría del sistema")

        # Soft delete
        category.is_active = False
        category.updated_at = get_colombia_now_naive()

        await self.db.flush()
        return True

    async def hard_delete(self, category_id: UUID) -> bool:
        """
        Permanently delete a category.
        Only works for non-system categories.
        Use with caution - this will fail if expenses reference this category.
        """
        result = await self.db.execute(
            select(ExpenseCategoryModel).where(ExpenseCategoryModel.id == category_id)
        )
        category = result.scalar_one_or_none()

        if not category:
            return False

        if category.is_system:
            raise ValueError("No se puede eliminar una categoría del sistema")

        await self.db.delete(category)
        await self.db.flush()
        return True

    async def reorder(self, category_orders: list[dict[str, int]]) -> bool:
        """
        Update display order for multiple categories.
        Input: [{"id": "uuid", "display_order": 1}, ...]
        """
        for item in category_orders:
            category_id = item.get("id")
            new_order = item.get("display_order")

            if category_id and new_order is not None:
                result = await self.db.execute(
                    select(ExpenseCategoryModel).where(
                        ExpenseCategoryModel.id == UUID(category_id)
                    )
                )
                category = result.scalar_one_or_none()
                if category:
                    category.display_order = new_order
                    category.updated_at = get_colombia_now_naive()

        await self.db.flush()
        return True

    async def count(self, include_inactive: bool = False) -> int:
        """Count total categories."""
        query = select(func.count(ExpenseCategoryModel.id))

        if not include_inactive:
            query = query.where(ExpenseCategoryModel.is_active == True)

        result = await self.db.execute(query)
        return result.scalar() or 0
