"""
Sale Update Mixin

Contains update methods for sale operations:
- update_sale (client_id, notes)
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
    """Mixin providing update methods for SaleService"""

    db: AsyncSession  # Type hint for IDE support

    async def update_sale(
        self,
        sale_id: UUID,
        school_id: UUID,
        data: SaleUpdate
    ) -> Sale:
        """
        Update a sale's editable fields (client_id, notes).

        Args:
            sale_id: Sale UUID
            school_id: School UUID
            data: SaleUpdate schema with fields to update

        Returns:
            Updated Sale

        Raises:
            HTTPException: If sale not found or client not found
        """
        # Get the sale
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

        # Track if any field was updated
        updated = False

        # Update client_id if explicitly provided in the request
        # Note: Clients are GLOBAL (not tied to schools), so we only validate existence
        if 'client_id' in data.model_fields_set:
            if data.client_id is None:
                # Explicitly remove client from sale
                sale.client_id = None
                updated = True
                logger.info(f"Sale {sale.code}: client removed")
            else:
                # Validate client exists and is active (no school_id filter - clients are global)
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

        # Update notes if provided
        if data.notes is not None:
            sale.notes = data.notes
            updated = True

        if updated:
            await self.db.commit()
            await self.db.refresh(sale)

        return sale

    async def assign_client_to_sale(
        self,
        sale_id: UUID,
        school_id: UUID,
        client_id: UUID
    ) -> Sale:
        """
        Assign or change the client for a sale.
        Convenience method that wraps update_sale.

        Args:
            sale_id: Sale UUID
            school_id: School UUID
            client_id: Client UUID to assign

        Returns:
            Updated Sale
        """
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
        """
        Remove the client from a sale (set to None).

        Args:
            sale_id: Sale UUID
            school_id: School UUID

        Returns:
            Updated Sale with client_id = None
        """
        # Get the sale
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
        await self.db.commit()
        await self.db.refresh(sale)

        logger.info(f"Sale {sale.code}: client removed")
        return sale
