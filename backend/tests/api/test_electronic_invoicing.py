"""
Integration tests for electronic invoicing (service + routes).

AlegraService is replaced with an in-memory fake (no network), so these tests
exercise persistence, idempotency, the FAILED audit trail, annulment and the
HTTP surface end-to-end against the test database.
"""
from decimal import Decimal
from uuid import uuid4

import pytest

from app.core.config import settings
from app.models.sale import Sale, SaleItem, SaleStatus, PaymentMethod
from app.models.electronic_invoice import (
    ElectronicInvoice, InvoiceDocumentType, ElectronicInvoiceStatus,
)
from app.services.alegra import AlegraAPIError
from app.services.electronic_invoicing import (
    ElectronicInvoicingService, ElectronicInvoicingError,
)

pytestmark = pytest.mark.api


# ---------------------------------------------------------------------------
# Fakes & fixtures
# ---------------------------------------------------------------------------

_EMIT_RESPONSE = {
    "id": 999,
    "numberTemplate": {"fullNumber": "FE2-123"},
    "stamp": {"cufe": "CUFE-XYZ", "legalStatus": "STAMPED_AND_ACCEPTED"},
}
_CREDIT_NOTE_RESPONSE = {
    "id": 777,
    "numberTemplate": {"fullNumber": "NC-9"},
    "stamp": {"cufe": "CN-CUFE"},
}


class _FakeAlegra:
    """Async-context-manager stand-in for AlegraService."""
    raise_on_emit = False

    def __init__(self, db=None):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def emit_invoice_for_sale(self, sale):
        if _FakeAlegra.raise_on_emit:
            raise AlegraAPIError(400, {"message": "rechazado"})
        return _EMIT_RESPONSE

    emit_invoice_for_order = emit_invoice_for_sale

    async def emit_invoice_for_alteration(self, alteration):
        if _FakeAlegra.raise_on_emit:
            raise AlegraAPIError(400, {"message": "rechazado"})
        return _EMIT_RESPONSE

    async def get_invoice_files(self, invoice_id):
        return {"pdf": "https://alegra/pdf", "xml": "https://alegra/xml"}

    async def emit_credit_note(self, *, alegra_invoice_id, reason):
        return _CREDIT_NOTE_RESPONSE


@pytest.fixture(autouse=True)
def _enable_alegra(monkeypatch):
    monkeypatch.setattr(settings, "ALEGRA_ENABLED", True, raising=False)
    monkeypatch.setattr(settings, "ALEGRA_EMAIL", "e@x.com", raising=False)
    monkeypatch.setattr(settings, "ALEGRA_TOKEN", "tok", raising=False)
    monkeypatch.setattr(
        "app.services.electronic_invoicing.AlegraService", _FakeAlegra
    )
    _FakeAlegra.raise_on_emit = False
    yield


async def _make_sale(db_session, school, user, product, client=None,
                     total=Decimal("100000")):
    sale = Sale(
        id=str(uuid4()),
        school_id=school.id,
        user_id=user.id,
        client_id=client.id if client else None,
        code=f"{school.code}-VNT-2026-{uuid4().hex[:6].upper()}",
        status=SaleStatus.COMPLETED,
        total=total,
        paid_amount=total,
        payment_method=PaymentMethod.CASH,
    )
    db_session.add(sale)
    await db_session.flush()
    db_session.add(SaleItem(
        id=str(uuid4()),
        sale_id=sale.id,
        product_id=product.id,
        quantity=1,
        unit_price=total,
        subtotal=total,
    ))
    await db_session.commit()
    return sale


# ---------------------------------------------------------------------------
# Service-level
# ---------------------------------------------------------------------------

class TestEmitService:
    async def test_emit_sale_success_persists_emitted(
        self, db_session, test_school, test_user, test_product, test_client
    ):
        sale = await _make_sale(db_session, test_school, test_user, test_product, test_client)
        service = ElectronicInvoicingService(db_session)

        invoice = await service.emit(InvoiceDocumentType.SALE, sale.id, test_user.id)

        assert invoice.status == ElectronicInvoiceStatus.EMITTED
        assert invoice.full_number == "FE2-123"
        assert invoice.cufe == "CUFE-XYZ"
        assert invoice.alegra_invoice_id == "999"
        assert invoice.pdf_url == "https://alegra/pdf"
        assert str(invoice.sale_id) == str(sale.id)
        assert invoice.total == Decimal("100000.00")

    async def test_emit_is_idempotent(
        self, db_session, test_school, test_user, test_product
    ):
        sale = await _make_sale(db_session, test_school, test_user, test_product)
        service = ElectronicInvoicingService(db_session)
        await service.emit(InvoiceDocumentType.SALE, sale.id, test_user.id)

        with pytest.raises(ElectronicInvoicingError) as exc:
            await service.emit(InvoiceDocumentType.SALE, sale.id, test_user.id)
        assert exc.value.status_code == 409

    async def test_emit_failure_records_failed_row_and_raises(
        self, db_session, test_school, test_user, test_product
    ):
        sale = await _make_sale(db_session, test_school, test_user, test_product)
        _FakeAlegra.raise_on_emit = True
        service = ElectronicInvoicingService(db_session)

        with pytest.raises(ElectronicInvoicingError) as exc:
            await service.emit(InvoiceDocumentType.SALE, sale.id, test_user.id)
        assert exc.value.status_code == 502

        # A FAILED row must persist for the audit trail / retry.
        existing = await service.get_for_document(InvoiceDocumentType.SALE, sale.id)
        assert existing is not None
        assert existing.status == ElectronicInvoiceStatus.FAILED
        assert existing.error_message

    async def test_failed_attempt_can_be_retried(
        self, db_session, test_school, test_user, test_product
    ):
        sale = await _make_sale(db_session, test_school, test_user, test_product)
        service = ElectronicInvoicingService(db_session)

        _FakeAlegra.raise_on_emit = True
        with pytest.raises(ElectronicInvoicingError):
            await service.emit(InvoiceDocumentType.SALE, sale.id, test_user.id)

        _FakeAlegra.raise_on_emit = False
        invoice = await service.emit(InvoiceDocumentType.SALE, sale.id, test_user.id)
        assert invoice.status == ElectronicInvoiceStatus.EMITTED

        # Retry must reuse the same row, not create a second one.
        items, total = await service.list_invoices()
        assert total == 1

    async def test_void_marks_voided_with_credit_note(
        self, db_session, test_school, test_user, test_product
    ):
        sale = await _make_sale(db_session, test_school, test_user, test_product)
        service = ElectronicInvoicingService(db_session)
        invoice = await service.emit(InvoiceDocumentType.SALE, sale.id, test_user.id)

        voided = await service.void(invoice.id, "Devolución total", test_user.id)
        assert voided.status == ElectronicInvoiceStatus.VOIDED
        assert voided.credit_note_number == "NC-9"
        assert voided.void_reason == "Devolución total"
        assert voided.voided_at is not None

    async def test_emit_alteration(
        self, db_session, test_user, test_client, alteration_factory
    ):
        alteration = alteration_factory(client_id=test_client.id, cost=Decimal("20000"))
        db_session.add(alteration)
        await db_session.commit()

        service = ElectronicInvoicingService(db_session)
        invoice = await service.emit(
            InvoiceDocumentType.ALTERATION, alteration.id, test_user.id
        )
        assert invoice.status == ElectronicInvoiceStatus.EMITTED
        assert str(invoice.alteration_id) == str(alteration.id)

    async def test_emit_disabled_raises_409(
        self, db_session, test_school, test_user, test_product, monkeypatch
    ):
        sale = await _make_sale(db_session, test_school, test_user, test_product)
        monkeypatch.setattr(settings, "ALEGRA_ENABLED", False, raising=False)
        service = ElectronicInvoicingService(db_session)
        with pytest.raises(ElectronicInvoicingError) as exc:
            await service.emit(InvoiceDocumentType.SALE, sale.id, test_user.id)
        assert exc.value.status_code == 409


# ---------------------------------------------------------------------------
# Route-level
# ---------------------------------------------------------------------------

class TestRoutes:
    async def test_emit_requires_auth(self, api_client):
        resp = await api_client.post(
            "/api/v1/global/electronic-invoicing/emit",
            json={"document_type": "sale", "document_id": str(uuid4())},
        )
        assert resp.status_code in (401, 403)

    async def test_emit_endpoint_happy_path(
        self, api_client, superuser_headers, db_session,
        test_school, test_user, test_product
    ):
        sale = await _make_sale(db_session, test_school, test_user, test_product)

        resp = await api_client.post(
            "/api/v1/global/electronic-invoicing/emit",
            headers=superuser_headers,
            json={"document_type": "sale", "document_id": str(sale.id)},
        )
        assert resp.status_code == 201, resp.text
        body = resp.json()
        assert body["status"] == "emitted"
        assert body["full_number"] == "FE2-123"

        # Idempotency over HTTP.
        resp2 = await api_client.post(
            "/api/v1/global/electronic-invoicing/emit",
            headers=superuser_headers,
            json={"document_type": "sale", "document_id": str(sale.id)},
        )
        assert resp2.status_code == 409

    async def test_by_document_returns_invoice(
        self, api_client, superuser_headers, db_session,
        test_school, test_user, test_product
    ):
        sale = await _make_sale(db_session, test_school, test_user, test_product)
        await api_client.post(
            "/api/v1/global/electronic-invoicing/emit",
            headers=superuser_headers,
            json={"document_type": "sale", "document_id": str(sale.id)},
        )
        resp = await api_client.get(
            f"/api/v1/global/electronic-invoicing/by-document/sale/{sale.id}",
            headers=superuser_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["full_number"] == "FE2-123"
