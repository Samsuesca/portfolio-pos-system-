"""Sale metadata updates (client assignment, notes).

Only modifies non-financial fields — no inventory or accounting impact.
Uses flush() to delegate commit control to the caller.
"""
import logging
from uuid import UUID
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from app.models.sale import Sale
from app.models.client import Client
from app.schemas.sale import SaleUpdate

logger = logging.getLogger(__name__)


class SaleUpdateMixin:
    """Provides sale metadata update methods to :class:`SaleService`."""

    db: AsyncSession

    async def update_sale(
        self,
        sale_id: UUID,
        school_id: UUID,
        data: SaleUpdate
    ) -> Sale:
        """Update a sale's editable fields.

        Only ``client_id`` and ``notes`` can be modified. Financial fields
        (total, paid_amount, payment_method) are immutable through this method.

        Client validation: clients are GLOBAL (not school-scoped), so only
        existence and active status are checked — no school_id filter.

        Args:
            sale_id: Sale UUID.
            school_id: School UUID for tenant isolation.
            data: Partial update schema. Only fields present in
                ``model_fields_set`` are applied (supports explicit None
                for client removal).

        Returns:
            Updated Sale.

        Raises:
            HTTPException 404: Sale or client not found.
        """
        result = await self.db.execute(
            select(Sale).where(
                Sale.id == sale_id,
                Sale.school_id == school_id
            )
        )
        sale = result.scalar_one_or_none()

        if not sale:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Venta no encontrada"
            )

        updated = False

        if 'client_id' in data.model_fields_set:
            if data.client_id is None:
                sale.client_id = None
                updated = True
                logger.info(f"Sale {sale.code}: client removed")
            else:
                client_result = await self.db.execute(
                    select(Client).where(
                        Client.id == data.client_id,
                        Client.is_active == True
                    )
                )
                client = client_result.scalar_one_or_none()

                if not client:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail=f"Cliente no encontrado (ID: {data.client_id})"
                    )

                sale.client_id = data.client_id
                updated = True
                logger.info(f"Sale {sale.code}: client updated to {client.name}")

        if data.notes is not None:
            sale.notes = data.notes
            updated = True

        if updated:
            await self.db.flush()
            await self.db.refresh(sale)

        return sale

    async def assign_client_to_sale(
        self,
        sale_id: UUID,
        school_id: UUID,
        client_id: UUID
    ) -> Sale:
        """Convenience wrapper: assign a client to a sale."""
        return await self.update_sale(
            sale_id=sale_id,
            school_id=school_id,
            data=SaleUpdate(client_id=client_id)
        )

    async def remove_client_from_sale(
        self,
        sale_id: UUID,
        school_id: UUID
    ) -> Sale:
        """Convenience wrapper: remove the client from a sale."""
        result = await self.db.execute(
            select(Sale).where(
                Sale.id == sale_id,
                Sale.school_id == school_id
            )
        )
        sale = result.scalar_one_or_none()

        if not sale:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Venta no encontrada"
            )

        sale.client_id = None
        await self.db.flush()
        await self.db.refresh(sale)

        logger.info(f"Sale {sale.code}: client removed")
        return sale
