"""
Position Service - CRUD for employee positions catalog
"""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from app.models.payroll import Position
from app.schemas.position import (
    PositionCreate,
    PositionUpdate,
    PositionResponse,
)


class PositionService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_positions(self, include_inactive: bool = False) -> list[PositionResponse]:
        query = select(Position)
        if not include_inactive:
            query = query.where(Position.is_active == True)
        query = query.order_by(Position.sort_order.asc(), Position.name.asc())
        result = await self.db.execute(query)
        return [PositionResponse.model_validate(p) for p in result.scalars().all()]

    async def get_position(self, position_id: UUID) -> PositionResponse | None:
        result = await self.db.execute(select(Position).where(Position.id == position_id))
        position = result.scalar_one_or_none()
        if not position:
            return None
        return PositionResponse.model_validate(position)

    async def create_position(self, data: PositionCreate) -> PositionResponse:
        existing = await self.db.execute(
            select(Position).where(Position.code == data.code)
        )
        if existing.scalar_one_or_none():
            raise ValueError(f"Ya existe una posición con el código '{data.code}'")

        max_order = await self.db.execute(
            select(Position.sort_order).order_by(Position.sort_order.desc()).limit(1)
        )
        next_order = (max_order.scalar() or -1) + 1

        position = Position(
            code=data.code,
            name=data.name,
            description=data.description,
            sort_order=next_order,
        )
        self.db.add(position)
        await self.db.commit()
        await self.db.refresh(position)
        return PositionResponse.model_validate(position)

    async def update_position(self, position_id: UUID, data: PositionUpdate) -> PositionResponse | None:
        result = await self.db.execute(select(Position).where(Position.id == position_id))
        position = result.scalar_one_or_none()
        if not position:
            return None

        update_data = data.model_dump(exclude_unset=True)
        if 'code' in update_data:
            existing = await self.db.execute(
                select(Position).where(Position.code == update_data['code'], Position.id != position_id)
            )
            if existing.scalar_one_or_none():
                raise ValueError(f"Ya existe otra posición con el código '{update_data['code']}'")

        for field, value in update_data.items():
            setattr(position, field, value)

        await self.db.commit()
        await self.db.refresh(position)
        return PositionResponse.model_validate(position)

    async def delete_position(self, position_id: UUID) -> bool:
        result = await self.db.execute(select(Position).where(Position.id == position_id))
        position = result.scalar_one_or_none()
        if not position:
            return False
        position.is_active = False
        await self.db.commit()
        return True
