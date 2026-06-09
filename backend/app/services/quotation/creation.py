"""
Quotation Creation Mixin

Crea/edita cotizaciones B2B. Computa totales server-side:
  line_total = unit_price * quantity
  subtotal   = Σ line_total
  total      = subtotal + tax_amount

La numeracion (COT-YYYY-NNNN) se serializa con un advisory lock transaccional
en `numbering.py`, por lo que el consecutivo es único sin necesidad de
retry/rollback ante colisiones.
"""
from decimal import Decimal
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.b2b import Quotation, QuotationItem, QuotationStatus
from app.schemas.b2b import QuotationCreate, QuotationUpdate, QuotationItemCreate


class QuotationCreationMixin:
    """Mixin con metodos de creacion/edicion para QuotationService."""

    db: AsyncSession  # Type hint for IDE support

    @staticmethod
    def _compute_items(
        items: list[QuotationItemCreate],
    ) -> tuple[list[dict], Decimal]:
        """Construye los dicts de items con line_total y devuelve (items, subtotal)."""
        items_data: list[dict] = []
        subtotal = Decimal("0")
        for item in items:
            line_total = (item.unit_price * item.quantity).quantize(Decimal("0.01"))
            items_data.append(
                {
                    "product_id": item.product_id,
                    "description": item.description,
                    "quantity": item.quantity,
                    "unit_price": item.unit_price,
                    "unit_cost_estimate": item.unit_cost_estimate,
                    "customization": item.customization,
                    "line_total": line_total,
                }
            )
            subtotal += line_total
        return items_data, subtotal

    async def create_quotation(
        self,
        data: QuotationCreate,
        user_id: UUID,
    ) -> Quotation:
        """Crea una cotizacion en estado DRAFT con sus items y totales computados."""
        if data.valid_until < data.issue_date:
            raise ValueError("La vigencia no puede ser anterior a la fecha de emisión")

        items_data, subtotal = self._compute_items(data.items)
        tax_amount = data.tax_amount or Decimal("0")
        total = subtotal + tax_amount

        # El advisory lock en _generate_quotation_code serializa el consecutivo,
        # así que un simple insert+flush es seguro bajo concurrencia.
        quotation_number = await self._generate_quotation_code()
        quotation = Quotation(
            branch_id=data.branch_id,
            b2b_client_id=data.b2b_client_id,
            quotation_number=quotation_number,
            status=QuotationStatus.DRAFT,
            issue_date=data.issue_date,
            valid_until=data.valid_until,
            subtotal=subtotal,
            tax_amount=tax_amount,
            total=total,
            deposit_pct=data.deposit_pct,
            estimated_delivery_days=data.estimated_delivery_days,
            terms=data.terms,
            notes=data.notes,
            created_by=user_id,
        )
        self.db.add(quotation)
        await self.db.flush()

        for item_dict in items_data:
            item_dict["quotation_id"] = quotation.id
            self.db.add(QuotationItem(**item_dict))

        await self.db.flush()
        await self.db.refresh(quotation)
        return quotation

    async def update_quotation(
        self,
        quotation_id: UUID,
        data: QuotationUpdate,
    ) -> Quotation | None:
        """Edita la cabecera. Solo permitido en estado DRAFT."""
        quotation = await self.get(quotation_id)
        if not quotation:
            return None

        if quotation.status != QuotationStatus.DRAFT:
            raise ValueError("Solo se pueden editar cotizaciones en borrador")

        update_data = data.model_dump(exclude_unset=True)

        if "valid_until" in update_data and update_data["valid_until"] is not None:
            if update_data["valid_until"] < quotation.issue_date:
                raise ValueError(
                    "La vigencia no puede ser anterior a la fecha de emisión"
                )

        for field, value in update_data.items():
            setattr(quotation, field, value)

        if "tax_amount" in update_data and update_data["tax_amount"] is not None:
            quotation.total = quotation.subtotal + quotation.tax_amount

        await self.db.flush()
        await self.db.refresh(quotation)
        return quotation

    async def replace_items(
        self,
        quotation_id: UUID,
        items: list[QuotationItemCreate],
    ) -> Quotation | None:
        """Reemplaza todos los items. Solo permitido en estado DRAFT.

        Recomputa subtotal y total (= subtotal + tax_amount actual).
        """
        quotation = await self.get_quotation_with_items(quotation_id)
        if not quotation:
            return None

        if quotation.status != QuotationStatus.DRAFT:
            raise ValueError("Solo se pueden editar cotizaciones en borrador")

        # Borra items existentes (cascade orphan-delete sobre la relacion).
        quotation.items.clear()
        await self.db.flush()

        items_data, subtotal = self._compute_items(items)
        for item_dict in items_data:
            item_dict["quotation_id"] = quotation.id
            self.db.add(QuotationItem(**item_dict))

        quotation.subtotal = subtotal
        quotation.total = subtotal + quotation.tax_amount

        await self.db.flush()
        await self.db.refresh(quotation)
        return quotation
