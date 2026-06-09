"""
Electronic Invoicing Service - Facturacion Electronica DIAN (Alegra)

Orchestrates emission of electronic invoices for sales, orders and alterations:
- Idempotency: a document with an EMITTED invoice cannot be re-emitted.
- Audit trail: every attempt persists an ElectronicInvoice row; failures are
  recorded with their error so the user can inspect and retry.
- Annulment: an emitted invoice can be voided via a DIAN credit note.

The AlegraService performs the HTTP work; this service owns persistence,
idempotency, snapshots and status transitions.
"""
import logging
from uuid import UUID

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.models.alteration import Alteration, AlterationStatus
from app.models.electronic_invoice import (
    ElectronicInvoice, InvoiceDocumentType, ElectronicInvoiceStatus,
)
from app.models.order import Order, OrderItem, OrderStatus
from app.models.sale import Sale, SaleItem, SaleStatus
from app.services.alegra import AlegraService, AlegraAPIError
from app.utils.timezone import get_colombia_now_naive

logger = logging.getLogger(__name__)


class ElectronicInvoicingError(Exception):
    """Domain error for invoicing failures (mapped to HTTP at the route)."""
    def __init__(self, message: str, *, status_code: int = 400, detail=None):
        self.message = message
        self.status_code = status_code
        self.detail = detail
        super().__init__(message)


class ElectronicInvoicingService:
    """Service for emitting and managing electronic invoices."""

    def __init__(self, db: AsyncSession):
        self.db = db

    # ─── Document loaders ────────────────────────────────────────────

    async def _load_sale(self, sale_id: UUID) -> Sale:
        stmt = (
            select(Sale)
            .where(Sale.id == sale_id)
            .options(
                selectinload(Sale.client),
                selectinload(Sale.items).selectinload(SaleItem.product),
            )
        )
        sale = (await self.db.execute(stmt)).scalar_one_or_none()
        if sale is None:
            raise ElectronicInvoicingError("Venta no encontrada", status_code=404)
        if sale.status == SaleStatus.CANCELLED:
            raise ElectronicInvoicingError(
                "No se puede facturar una venta cancelada", status_code=400
            )
        if not sale.items:
            raise ElectronicInvoicingError(
                "La venta no tiene items para facturar", status_code=400
            )
        return sale

    async def _load_order(self, order_id: UUID) -> Order:
        stmt = (
            select(Order)
            .where(Order.id == order_id)
            .options(
                selectinload(Order.client),
                selectinload(Order.items).selectinload(OrderItem.product),
                selectinload(Order.items).selectinload(OrderItem.garment_type),
            )
        )
        order = (await self.db.execute(stmt)).scalar_one_or_none()
        if order is None:
            raise ElectronicInvoicingError("Encargo no encontrado", status_code=404)
        if order.status == OrderStatus.CANCELLED:
            raise ElectronicInvoicingError(
                "No se puede facturar un encargo cancelado", status_code=400
            )
        if not order.items:
            raise ElectronicInvoicingError(
                "El encargo no tiene items para facturar", status_code=400
            )
        return order

    async def _load_alteration(self, alteration_id: UUID) -> Alteration:
        stmt = (
            select(Alteration)
            .where(Alteration.id == alteration_id)
            .options(selectinload(Alteration.client))
        )
        alteration = (await self.db.execute(stmt)).scalar_one_or_none()
        if alteration is None:
            raise ElectronicInvoicingError("Arreglo no encontrado", status_code=404)
        if alteration.status == AlterationStatus.CANCELLED:
            raise ElectronicInvoicingError(
                "No se puede facturar un arreglo cancelado", status_code=400
            )
        return alteration

    # ─── Idempotency lookup ──────────────────────────────────────────

    def _document_filter(self, document_type: InvoiceDocumentType, document_id: UUID):
        if document_type == InvoiceDocumentType.SALE:
            return ElectronicInvoice.sale_id == document_id
        if document_type == InvoiceDocumentType.ORDER:
            return ElectronicInvoice.order_id == document_id
        if document_type == InvoiceDocumentType.CONTRACT:
            return ElectronicInvoice.contract_id == document_id
        return ElectronicInvoice.alteration_id == document_id

    async def _load_contract(self, contract_id: UUID):
        from app.models.b2b import Contract, Quotation

        stmt = (
            select(Contract)
            .where(Contract.id == contract_id)
            .options(
                selectinload(Contract.b2b_client),
                selectinload(Contract.quotation).selectinload(Quotation.items),
            )
        )
        contract = (await self.db.execute(stmt)).scalar_one_or_none()
        if contract is None:
            raise ElectronicInvoicingError("Contrato no encontrado", status_code=404)
        return contract

    async def get_for_document(
        self, document_type: InvoiceDocumentType, document_id: UUID
    ) -> ElectronicInvoice | None:
        """Latest invoice row for a document (any status), or None."""
        stmt = (
            select(ElectronicInvoice)
            .where(self._document_filter(document_type, document_id))
            .order_by(ElectronicInvoice.created_at.desc())
            .limit(1)
        )
        return (await self.db.execute(stmt)).scalar_one_or_none()

    # ─── Emission ────────────────────────────────────────────────────

    @staticmethod
    def _require_enabled() -> None:
        if not settings.ALEGRA_ENABLED:
            raise ElectronicInvoicingError(
                "La facturación electrónica está deshabilitada", status_code=409
            )
        if not settings.ALEGRA_EMAIL or not settings.ALEGRA_TOKEN:
            raise ElectronicInvoicingError(
                "Alegra no está configurado (faltan credenciales)", status_code=409
            )

    async def emit(
        self,
        document_type: InvoiceDocumentType,
        document_id: UUID,
        user_id: UUID | None,
    ) -> ElectronicInvoice:
        self._require_enabled()
        # Pydantic's use_enum_values delivers a plain string from the request
        # body; coerce back to the enum so .value / setattr work uniformly.
        document_type = InvoiceDocumentType(document_type)

        # Idempotency: block if already emitted/voided; reuse a pending/failed row.
        existing = await self.get_for_document(document_type, document_id)
        if existing and existing.status == ElectronicInvoiceStatus.EMITTED:
            raise ElectronicInvoicingError(
                f"Este documento ya tiene factura electrónica ({existing.full_number})",
                status_code=409,
            )

        # Load and snapshot the document.
        if document_type == InvoiceDocumentType.SALE:
            doc = await self._load_sale(document_id)
            client = doc.client
            total = doc.total
        elif document_type == InvoiceDocumentType.ORDER:
            doc = await self._load_order(document_id)
            client = doc.client
            total = doc.total
        elif document_type == InvoiceDocumentType.CONTRACT:
            doc = await self._load_contract(document_id)
            client = doc.b2b_client
            total = doc.total
        else:
            doc = await self._load_alteration(document_id)
            client = doc.client
            total = doc.cost

        if existing and existing.status in (
            ElectronicInvoiceStatus.PENDING, ElectronicInvoiceStatus.FAILED
        ):
            invoice = existing
            invoice.status = ElectronicInvoiceStatus.PENDING
            invoice.error_message = None
        else:
            invoice = ElectronicInvoice(document_type=document_type)
            setattr(invoice, f"{document_type.value}_id", document_id)
            invoice.status = ElectronicInvoiceStatus.PENDING
            self.db.add(invoice)

        invoice.total = total
        # B2C client expone .name/.identification_number; el B2BClient expone
        # .legal_name/.tax_id — resolver ambos.
        invoice.client_name = (
            (getattr(client, "name", None)
             or getattr(client, "legal_name", None)
             or "Consumidor Final")
            if client else "Consumidor Final"
        )
        invoice.client_identification = (
            (getattr(client, "identification_number", None)
             or getattr(client, "tax_id", None))
            if client else None
        )
        invoice.created_by = user_id
        await self.db.flush()

        try:
            async with AlegraService(self.db) as alegra:
                if document_type == InvoiceDocumentType.SALE:
                    resp = await alegra.emit_invoice_for_sale(doc)
                elif document_type == InvoiceDocumentType.ORDER:
                    resp = await alegra.emit_invoice_for_order(doc)
                elif document_type == InvoiceDocumentType.CONTRACT:
                    resp = await alegra.emit_invoice_for_contract(doc)
                else:
                    resp = await alegra.emit_invoice_for_alteration(doc)

                alegra_id = str(resp.get("id")) if resp.get("id") is not None else None
                stamp = resp.get("stamp") or {}
                number_template = resp.get("numberTemplate") or {}

                invoice.alegra_invoice_id = alegra_id
                invoice.full_number = number_template.get("fullNumber")
                invoice.cufe = stamp.get("cufe") or stamp.get("uuid")
                invoice.legal_status = stamp.get("legalStatus") or stamp.get("status")
                invoice.status = ElectronicInvoiceStatus.EMITTED
                invoice.emitted_at = get_colombia_now_naive()

                if alegra_id:
                    try:
                        files = await alegra.get_invoice_files(alegra_id)
                        invoice.pdf_url = files.get("pdf")
                        invoice.xml_url = files.get("xml")
                    except AlegraAPIError as file_err:
                        logger.warning(
                            "Factura emitida pero no se pudieron obtener archivos: %s",
                            file_err,
                        )
        except (AlegraAPIError, ValueError) as exc:
            invoice.status = ElectronicInvoiceStatus.FAILED
            invoice.error_message = str(exc)[:2000]
            await self.db.commit()
            logger.error("Falla al emitir factura electrónica: %s", exc)
            raise ElectronicInvoicingError(
                "Alegra rechazó la emisión de la factura",
                status_code=502,
                detail=getattr(exc, "payload", str(exc)),
            ) from exc

        await self.db.commit()
        await self.db.refresh(invoice)
        return invoice

    # ─── Annulment (credit note) ─────────────────────────────────────

    async def void(
        self, invoice_id: UUID, reason: str, user_id: UUID | None
    ) -> ElectronicInvoice:
        self._require_enabled()

        invoice = await self.get(invoice_id)
        if invoice is None:
            raise ElectronicInvoicingError("Factura no encontrada", status_code=404)
        if invoice.status == ElectronicInvoiceStatus.VOIDED:
            raise ElectronicInvoicingError(
                "La factura ya está anulada", status_code=409
            )
        if invoice.status != ElectronicInvoiceStatus.EMITTED or not invoice.alegra_invoice_id:
            raise ElectronicInvoicingError(
                "Solo se pueden anular facturas emitidas", status_code=409
            )

        try:
            async with AlegraService(self.db) as alegra:
                resp = await alegra.emit_credit_note(
                    alegra_invoice_id=invoice.alegra_invoice_id, reason=reason
                )
        except (AlegraAPIError, ValueError) as exc:
            logger.error("Falla al anular factura electrónica: %s", exc)
            raise ElectronicInvoicingError(
                "Alegra rechazó la nota crédito",
                status_code=502,
                detail=getattr(exc, "payload", str(exc)),
            ) from exc

        stamp = resp.get("stamp") or {}
        number_template = resp.get("numberTemplate") or {}
        invoice.credit_note_alegra_id = (
            str(resp.get("id")) if resp.get("id") is not None else None
        )
        invoice.credit_note_number = number_template.get("fullNumber")
        invoice.credit_note_cufe = stamp.get("cufe") or stamp.get("uuid")
        invoice.void_reason = reason
        invoice.voided_at = get_colombia_now_naive()
        invoice.status = ElectronicInvoiceStatus.VOIDED

        await self.db.commit()
        await self.db.refresh(invoice)
        return invoice

    # ─── Queries ─────────────────────────────────────────────────────

    async def get(self, invoice_id: UUID) -> ElectronicInvoice | None:
        return await self.db.get(ElectronicInvoice, invoice_id)

    async def refresh_files(self, invoice_id: UUID) -> ElectronicInvoice:
        """Re-fetch PDF/XML URLs from Alegra (they may lag emission)."""
        self._require_enabled()
        invoice = await self.get(invoice_id)
        if invoice is None:
            raise ElectronicInvoicingError("Factura no encontrada", status_code=404)
        if not invoice.alegra_invoice_id:
            raise ElectronicInvoicingError(
                "La factura no tiene id de Alegra", status_code=409
            )
        async with AlegraService(self.db) as alegra:
            files = await alegra.get_invoice_files(invoice.alegra_invoice_id)
        invoice.pdf_url = files.get("pdf") or invoice.pdf_url
        invoice.xml_url = files.get("xml") or invoice.xml_url
        await self.db.commit()
        await self.db.refresh(invoice)
        return invoice

    async def list_invoices(
        self,
        *,
        status: ElectronicInvoiceStatus | None = None,
        document_type: InvoiceDocumentType | None = None,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[ElectronicInvoice], int]:
        conditions = []
        if status is not None:
            conditions.append(ElectronicInvoice.status == status)
        if document_type is not None:
            conditions.append(ElectronicInvoice.document_type == document_type)

        count_stmt = select(func.count(ElectronicInvoice.id))
        list_stmt = select(ElectronicInvoice)
        for cond in conditions:
            count_stmt = count_stmt.where(cond)
            list_stmt = list_stmt.where(cond)

        total = (await self.db.execute(count_stmt)).scalar_one()
        list_stmt = (
            list_stmt.order_by(ElectronicInvoice.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        items = list((await self.db.execute(list_stmt)).scalars().all())
        return items, total
