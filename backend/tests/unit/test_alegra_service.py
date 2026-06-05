"""
Unit tests for AlegraService (Facturacion Electronica DIAN).

The single HTTP choke point (`_request`) is patched, so these tests exercise
payload construction, contact/item resolution, the identification fallback,
retry behaviour and credit-note emission without touching the network.
"""
from decimal import Decimal
from datetime import datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import httpx
import pytest

from app.core.config import settings
from app.models.client import IdentificationType
from app.models.sale import PaymentMethod
from app.services.alegra import (
    AlegraService, AlegraAPIError,
    FINAL_CONSUMER_IDENTIFICATION, FINAL_CONSUMER_NAME,
    ALTERATION_ITEM_REFERENCE,
)

pytestmark = pytest.mark.unit


# ---------------------------------------------------------------------------
# Pure helpers
# ---------------------------------------------------------------------------

def test_alegra_id_type_normalizes_enum():
    assert AlegraService._alegra_id_type(IdentificationType.NIT) == "NIT"
    assert AlegraService._alegra_id_type("cc") == "CC"
    assert AlegraService._alegra_id_type("nonsense") == "CC"
    assert AlegraService._alegra_id_type(None) == "CC"


def test_payment_codes_from_method():
    assert AlegraService._payment_codes_from_method(PaymentMethod.CASH) == ("CASH", "CASH")
    assert AlegraService._payment_codes_from_method(PaymentMethod.CREDIT) == ("CREDIT", "CASH")
    assert AlegraService._payment_codes_from_method(PaymentMethod.NEQUI) == ("CASH", "TRANSFER")
    assert AlegraService._payment_codes_from_method(None) == ("CASH", "CASH")


def test_payment_codes_from_balance():
    # Outstanding balance -> credit
    assert AlegraService._payment_codes_from_balance(Decimal("100"), Decimal("40")) == ("CREDIT", "CASH")
    # Fully paid -> cash
    assert AlegraService._payment_codes_from_balance(Decimal("100"), Decimal("100")) == ("CASH", "CASH")
    assert AlegraService._payment_codes_from_balance(Decimal("100"), None) == ("CASH", "CASH")


def test_order_item_descriptor_with_product():
    product = SimpleNamespace(code="PRD-1", name="Camisa")
    oi = SimpleNamespace(product=product, garment_type=None, garment_type_id=None,
                         id="x", size="T12", color="Blanco")
    ref, name, unspsc = AlegraService._order_item_descriptor(oi)
    assert ref == "PRD-1"
    assert "Camisa" in name and "T12" in name and "Blanco" in name


def test_order_item_descriptor_without_product():
    gt = SimpleNamespace(name="Pantalón a medida")
    oi = SimpleNamespace(product=None, garment_type=gt, garment_type_id="gt-9",
                         id="x", size=None, color=None)
    ref, name, unspsc = AlegraService._order_item_descriptor(oi)
    assert ref == "ENC-gt-9"
    assert name == "Pantalón a medida"


# ---------------------------------------------------------------------------
# resolve_contact — identification vs Consumidor Final fallback
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_resolve_contact_uses_client_identification():
    svc = AlegraService()
    client = SimpleNamespace(
        name="Maria Garcia",
        identification_number="1037612345",
        identification_type=IdentificationType.CC,
        email="m@e.com", phone="3001112233", address="Cra 1",
    )

    async def fake_request(method, path, *, params=None, json_body=None):
        if method == "GET" and path == "/contacts":
            return []  # not found -> will create
        if method == "POST" and path == "/contacts":
            return {"id": 55}
        raise AssertionError(f"unexpected call {method} {path}")

    with patch.object(svc, "_request", side_effect=fake_request) as req:
        contact_id = await svc.resolve_contact(client)

    assert contact_id == 55
    # The POST body must carry the real identification, not Consumidor Final.
    post_call = [c for c in req.call_args_list if c.args[0] == "POST"][0]
    body = post_call.kwargs["json_body"]
    assert body["identification"] == "1037612345"
    assert body["identificationObject"] == {"type": "CC", "number": "1037612345"}


@pytest.mark.asyncio
async def test_resolve_contact_falls_back_to_final_consumer():
    svc = AlegraService()
    client = SimpleNamespace(
        name="Cliente sin cedula",
        identification_number=None,
        identification_type=None,
        email=None, phone=None, address=None,
    )

    async def fake_request(method, path, *, params=None, json_body=None):
        if method == "GET" and path == "/contacts":
            assert params["identification"] == FINAL_CONSUMER_IDENTIFICATION
            return []
        if method == "POST" and path == "/contacts":
            return {"id": 1}
        raise AssertionError(f"unexpected call {method} {path}")

    with patch.object(svc, "_request", side_effect=fake_request) as req:
        contact_id = await svc.resolve_contact(client)

    assert contact_id == 1
    post_call = [c for c in req.call_args_list if c.args[0] == "POST"][0]
    body = post_call.kwargs["json_body"]
    assert body["name"] == FINAL_CONSUMER_NAME
    assert body["identification"] == FINAL_CONSUMER_IDENTIFICATION


@pytest.mark.asyncio
async def test_resolve_contact_reuses_existing():
    svc = AlegraService()
    client = SimpleNamespace(name="x", identification_number="900123",
                             identification_type=IdentificationType.NIT,
                             email=None, phone=None, address=None)

    async def fake_request(method, path, *, params=None, json_body=None):
        if method == "GET" and path == "/contacts":
            return [{"id": 7, "name": "x"}]
        raise AssertionError("should not create when contact exists")

    with patch.object(svc, "_request", side_effect=fake_request):
        contact_id = await svc.resolve_contact(client)
    assert contact_id == 7


# ---------------------------------------------------------------------------
# Emission flows
# ---------------------------------------------------------------------------

def _sale_stub():
    product = SimpleNamespace(code="PRD-1", name="Camisa")
    item = SimpleNamespace(product=product, unit_price=Decimal("50000"),
                           quantity=2, discount=Decimal("0"))
    return SimpleNamespace(
        client=None, items=[item], payment_method=PaymentMethod.CASH,
        sale_date=datetime(2026, 5, 20, 10, 0), code="VNT-1", notes=None,
    )


@pytest.mark.asyncio
async def test_emit_invoice_for_sale_builds_stamped_payload():
    svc = AlegraService()
    captured = {}

    async def fake_request(method, path, *, params=None, json_body=None):
        if path == "/contacts" and method == "GET":
            return []
        if path == "/contacts" and method == "POST":
            return {"id": 1}
        if path == "/items" and method == "GET":
            return []
        if path == "/items" and method == "POST":
            return {"id": 10}
        if path == "/invoices" and method == "POST":
            captured["payload"] = json_body
            return {"id": 999, "numberTemplate": {"fullNumber": "FE2-1"},
                    "stamp": {"cufe": "CUFE", "legalStatus": "STAMPED_AND_ACCEPTED"}}
        raise AssertionError(f"unexpected {method} {path}")

    with patch.object(svc, "_request", side_effect=fake_request):
        resp = await svc.emit_invoice_for_sale(_sale_stub())

    assert resp["id"] == 999
    payload = captured["payload"]
    assert payload["stamp"] == {"generateStamp": True}
    assert payload["paymentForm"] == "CASH"
    assert payload["items"] == [{"id": 10, "price": 50000.0, "quantity": 2}]


@pytest.mark.asyncio
async def test_emit_credit_note_mirrors_invoice_items():
    svc = AlegraService()
    captured = {}

    async def fake_request(method, path, *, params=None, json_body=None):
        if method == "GET" and path.startswith("/invoices/"):
            return {"client": {"id": 3}, "items": [{"id": 10, "price": 50000.0, "quantity": 2}]}
        if method == "POST" and path == "/credit-notes":
            captured["body"] = json_body
            return {"id": 777, "numberTemplate": {"fullNumber": "NC-1"},
                    "stamp": {"cufe": "CN-CUFE"}}
        raise AssertionError(f"unexpected {method} {path}")

    with patch.object(svc, "_request", side_effect=fake_request):
        resp = await svc.emit_credit_note(alegra_invoice_id="999", reason="Devolución")

    assert resp["id"] == 777
    body = captured["body"]
    assert body["invoices"] == [{"id": 999, "amount": 100000.0}]
    assert body["type"] == "VOID_ELECTRONIC_INVOICE"  # anulacion total (Colombia)
    assert body["cause"]  # motivo obligatorio al timbrar
    assert body["items"] == [{"id": 10, "price": 50000.0, "quantity": 2}]
    assert body["stamp"] == {"generateStamp": True}
    assert body["observations"] == "Devolución"


# ---------------------------------------------------------------------------
# Retry / error handling
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_request_retries_then_raises_on_transient(monkeypatch):
    svc = AlegraService()
    monkeypatch.setattr(settings, "ALEGRA_EMAIL", "e@x.com", raising=False)
    monkeypatch.setattr(settings, "ALEGRA_TOKEN", "tok", raising=False)

    # All attempts return 503 -> exhausts retries -> AlegraAPIError(503)
    resp503 = httpx.Response(503, json={"err": "down"})

    class FakeClient:
        is_closed = False
        async def request(self, *a, **k):
            return resp503
        async def aclose(self):
            pass

    monkeypatch.setattr(svc, "_get_client", AsyncMock(return_value=FakeClient()))
    monkeypatch.setattr("app.services.alegra.asyncio.sleep", AsyncMock())

    with pytest.raises(AlegraAPIError) as exc:
        await svc._request("GET", "/number-templates")
    assert exc.value.status_code == 503


@pytest.mark.asyncio
async def test_alteration_payload_uses_service_item():
    svc = AlegraService()
    alteration = SimpleNamespace(
        client=None, cost=Decimal("15000"), amount_paid=Decimal("0"),
        garment_name="Pantalón", code="ARR-1",
    )
    captured = {}

    async def fake_request(method, path, *, params=None, json_body=None):
        if path == "/contacts" and method == "GET":
            return []
        if path == "/contacts" and method == "POST":
            return {"id": 1}
        if path == "/items" and method == "GET":
            return []
        if path == "/items" and method == "POST":
            captured["item_body"] = json_body
            return {"id": 22}
        if path == "/invoices" and method == "POST":
            captured["payload"] = json_body
            return {"id": 500, "numberTemplate": {"fullNumber": "FE2-9"}, "stamp": {}}
        raise AssertionError(f"unexpected {method} {path}")

    with patch.object(svc, "_request", side_effect=fake_request):
        await svc.emit_invoice_for_alteration(alteration)

    assert captured["item_body"]["reference"] == ALTERATION_ITEM_REFERENCE
    assert captured["payload"]["items"] == [{"id": 22, "price": 15000.0, "quantity": 1}]
