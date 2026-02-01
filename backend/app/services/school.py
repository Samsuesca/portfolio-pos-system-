"""
School Service
"""
import re
import unicodedata
from uuid import UUID
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.school import School
from app.schemas.school import SchoolCreate, SchoolUpdate, SchoolSummary
from app.services.base import BaseService


def generate_slug(name: str) -> str:
    """
    Generate a URL-friendly slug from a name.
    """
    # Normalize unicode characters (remove accents)
    normalized = unicodedata.normalize('NFKD', name)
    ascii_text = normalized.encode('ascii', 'ignore').decode('ascii')
    # Convert to lowercase
    slug = ascii_text.lower()
    # Replace spaces and underscores with hyphens
    slug = re.sub(r'[\s_]+', '-', slug)
    # Remove any character that isn't alphanumeric or hyphen
    slug = re.sub(r'[^a-z0-9-]', '', slug)
    # Remove consecutive hyphens
    slug = re.sub(r'-+', '-', slug)
    # Remove leading/trailing hyphens
    slug = slug.strip('-')
    return slug


class SchoolService(BaseService[School]):
    """Service for School operations"""

    def __init__(self, db: AsyncSession):
        super().__init__(School, db)

    async def create_school(self, school_data: SchoolCreate) -> School:
        """
        Create a new school

        Args:
            school_data: School creation data

        Returns:
            Created school instance

        Raises:
            ValueError: If school code already exists
        """
        # Check if code already exists
        existing = await self.get_by_code(school_data.code)
        if existing:
            raise ValueError(f"School with code '{school_data.code}' already exists")

        # Convert settings to dict if it's a Pydantic model
        data_dict = school_data.model_dump()
        if hasattr(school_data.settings, 'model_dump'):
            data_dict['settings'] = school_data.settings.model_dump()

        # Generate slug if not provided
        if not data_dict.get('slug'):
            base_slug = generate_slug(school_data.name)
            slug = base_slug
            counter = 1
            # Ensure slug is unique
            while await self.get_by_slug(slug):
                slug = f"{base_slug}-{counter}"
                counter += 1
            data_dict['slug'] = slug

        return await self.create(data_dict)

    async def update_school(self, school_id: UUID, school_data: SchoolUpdate) -> School | None:
        """
        Update school information

        Args:
            school_id: School UUID
            school_data: School update data

        Returns:
            Updated school or None if not found
        """
        update_dict = school_data.model_dump(exclude_unset=True)
        return await self.update(school_id, update_dict)

    async def get_by_code(self, code: str) -> School | None:
        """
        Get school by code

        Args:
            code: School code

        Returns:
            School instance or None
        """
        result = await self.db.execute(
            select(School).where(School.code == code.upper())
        )
        return result.scalar_one_or_none()

    async def get_by_slug(self, slug: str) -> School | None:
        """
        Get school by slug

        Args:
            slug: School slug (URL-friendly identifier)

        Returns:
            School instance or None
        """
        result = await self.db.execute(
            select(School).where(School.slug == slug.lower())
        )
        return result.scalar_one_or_none()

    async def get_active_schools(self, skip: int = 0, limit: int = 100) -> list[School]:
        """
        Get all active schools ordered by display_order

        Args:
            skip: Pagination offset
            limit: Maximum results

        Returns:
            List of active schools ordered by display_order
        """
        result = await self.db.execute(
            select(School)
            .where(School.is_active == True)
            .order_by(School.display_order, School.name)
            .offset(skip)
            .limit(limit)
        )
        return list(result.scalars().all())

    async def reorder_schools(self, order_data: list[dict]) -> None:
        """
        Update display_order for multiple schools

        Args:
            order_data: List of {id: UUID, display_order: int}
        """
        for item in order_data:
            school = await self.get(item["id"])
            if school:
                school.display_order = item["display_order"]
        await self.db.flush()

    async def get_school_summary(self, school_id: UUID) -> SchoolSummary | None:
        """
        Get school with summary statistics

        Args:
            school_id: School UUID

        Returns:
            School summary or None if not found
        """
        from app.models.product import Product
        from app.models.client import ClientStudent
        from app.models.sale import Sale

        school = await self.get(school_id)
        if not school:
            return None

        # Count related entities
        products_count = await self.db.execute(
            select(func.count(Product.id)).where(Product.school_id == school_id)
        )
        # Clients are now GLOBAL, count unique clients with students in this school
        clients_count = await self.db.execute(
            select(func.count(func.distinct(ClientStudent.client_id))).where(
                ClientStudent.school_id == school_id
            )
        )
        sales_count = await self.db.execute(
            select(func.count(Sale.id)).where(Sale.school_id == school_id)
        )

        return SchoolSummary(
            id=school.id,
            code=school.code,
            name=school.name,
            total_products=products_count.scalar_one(),
            total_clients=clients_count.scalar_one(),
            total_sales=sales_count.scalar_one(),
            is_active=school.is_active
        )

    async def activate_school(self, school_id: UUID) -> School | None:
        """
        Activate a school

        Args:
            school_id: School UUID

        Returns:
            Updated school or None
        """
        return await self.update(school_id, {"is_active": True})

    async def deactivate_school(self, school_id: UUID) -> School | None:
        """
        Deactivate a school (soft delete)

        Args:
            school_id: School UUID

        Returns:
            Updated school or None
        """
        return await self.soft_delete(school_id)

    async def count_active(self) -> int:
        """
        Count active schools

        Returns:
            Number of active schools
        """
        return await self.count(filters={"is_active": True})

    async def search_by_name(self, name: str, limit: int = 10) -> list[School]:
        """
        Search schools by name (case-insensitive, partial match)

        Args:
            name: Search term
            limit: Maximum results

        Returns:
            List of matching schools
        """
        result = await self.db.execute(
            select(School)
            .where(School.name.ilike(f"%{name}%"))
            .limit(limit)
            .order_by(School.name)
        )
        return list(result.scalars().all())
