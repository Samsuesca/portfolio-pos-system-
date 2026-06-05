"""
Vendor Service - CRUD operations for the vendor catalog
"""
from uuid import UUID
from sqlalchemy import select, func, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.vendor import Vendor, VendorType
from app.models.accounting import Expense, AccountsPayable
from app.models.fixed_expense import FixedExpense
from app.schemas.vendor import VendorCreate, VendorUpdate


class VendorService:

    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_vendors(
        self,
        include_inactive: bool = False,
        search: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[Vendor]:
        stmt = select(Vendor)
        if not include_inactive:
            stmt = stmt.where(Vendor.is_active.is_(True))
        if search:
            stmt = stmt.where(Vendor.name.ilike(f"%{search}%"))
        stmt = stmt.order_by(Vendor.name).limit(limit).offset(offset)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def search_vendors(self, query: str, limit: int = 10) -> list[Vendor]:
        normalized = query.strip().lower()
        stmt = (
            select(Vendor)
            .where(
                Vendor.is_active.is_(True),
                Vendor.normalized_name.ilike(f"%{normalized}%"),
            )
            .order_by(Vendor.name)
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_by_id(self, vendor_id: UUID) -> Vendor | None:
        return await self.db.get(Vendor, vendor_id)

    async def get_by_normalized_name(self, name: str) -> Vendor | None:
        normalized = name.strip().lower()
        stmt = select(Vendor).where(Vendor.normalized_name == normalized)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def create(
        self,
        data: VendorCreate,
        created_by: UUID | None = None,
    ) -> Vendor:
        existing = await self.get_by_normalized_name(data.name)
        if existing:
            raise ValueError(f"Ya existe un proveedor con nombre similar: {existing.name}")

        vendor = Vendor(
            name=data.name.strip(),
            normalized_name=data.name.strip().lower(),
            type=data.type,
            phone=data.phone,
            email=data.email,
            notes=data.notes,
            created_by=created_by,
        )
        self.db.add(vendor)
        await self.db.flush()
        await self.db.refresh(vendor)
        return vendor

    async def get_or_create(
        self,
        name: str,
        vendor_type: VendorType = VendorType.PERSON,
        is_system: bool = False,
        created_by: UUID | None = None,
    ) -> Vendor:
        existing = await self.get_by_normalized_name(name)
        if existing:
            return existing

        vendor = Vendor(
            name=name.strip(),
            normalized_name=name.strip().lower(),
            type=vendor_type,
            is_system=is_system,
            created_by=created_by,
        )
        self.db.add(vendor)
        await self.db.flush()
        await self.db.refresh(vendor)
        return vendor

    async def update_vendor(
        self,
        vendor_id: UUID,
        data: VendorUpdate,
    ) -> Vendor | None:
        vendor = await self.get_by_id(vendor_id)
        if not vendor:
            return None

        if vendor.is_system and data.name is not None:
            raise ValueError("No se puede renombrar un proveedor del sistema")

        update_data = data.model_dump(exclude_unset=True)
        if "name" in update_data and update_data["name"]:
            new_name = update_data["name"].strip()
            existing = await self.get_by_normalized_name(new_name)
            if existing and existing.id != vendor_id:
                raise ValueError(f"Ya existe un proveedor con nombre similar: {existing.name}")
            update_data["normalized_name"] = new_name.lower()
            update_data["name"] = new_name

        for key, value in update_data.items():
            setattr(vendor, key, value)

        await self.db.flush()
        await self.db.refresh(vendor)
        return vendor

    async def deactivate(self, vendor_id: UUID) -> Vendor | None:
        vendor = await self.get_by_id(vendor_id)
        if not vendor:
            return None
        if vendor.is_system:
            raise ValueError("No se puede desactivar un proveedor del sistema")
        vendor.is_active = False
        await self.db.flush()
        return vendor

    async def merge_vendors(
        self,
        source_ids: list[UUID],
        target_id: UUID,
    ) -> int:
        """Merge source vendors into target. Returns count of updated records."""
        target = await self.get_by_id(target_id)
        if not target:
            raise ValueError("Proveedor destino no encontrado")

        if target_id in source_ids:
            raise ValueError("El proveedor destino no puede ser uno de los proveedores a fusionar")

        updated = 0
        for table in (Expense, AccountsPayable, FixedExpense):
            stmt = (
                update(table)
                .where(table.vendor_id.in_(source_ids))
                .values(vendor_id=target_id)
            )
            result = await self.db.execute(stmt)
            updated += result.rowcount

        for source_id in source_ids:
            source = await self.get_by_id(source_id)
            if source and not source.is_system:
                source.is_active = False

        await self.db.flush()
        return updated

    async def get_usage_stats(self, vendor_id: UUID) -> dict[str, int]:
        stats = {}
        for name, table in [
            ("expenses", Expense),
            ("accounts_payable", AccountsPayable),
            ("fixed_expenses", FixedExpense),
        ]:
            stmt = select(func.count()).where(table.vendor_id == vendor_id)
            result = await self.db.execute(stmt)
            stats[name] = result.scalar_one()
        return stats
