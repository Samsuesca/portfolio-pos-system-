"""
Unit tests para la FE DIAN de contratos B2B (AlegraService).

La dotación corporativa B2B GRAVA IVA 19% (≠ uniforme escolar excluido). Se
parchea el único choke point HTTP (`_request`), así que no tocan red ni DB.
"""
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import patch
from uuid import uuid4

import pytest

from app.core.config import settings
from app.services.alegra import AlegraService


def _b2b_client():
    return SimpleNamespace(
        tax_id="900123456-7",
        legal_name="Hotel Demo SAS",
        trade_name=None,
        contact_email="contacto@hotel.co",
        contact_phone="3001112233",
        billing_address="Cra 10 # 1-23",
    )


def _contract_with_quotation(tax_amount=Decimal("171000")):
    qi = SimpleNamespace(
        id=uuid4(),
        description="Filipina chef bordada",
        quantity=10,
        unit_price=Decimal("90000"),
    )
    quotation = SimpleNamespace(items=[qi], tax_amount=tax_amount)
    return SimpleNamespace(
        id=uuid4(),
        b2b_client=_b2b_client(),
        quotation=quotation,
        total=Decimal("1071000"),
        contract_number="CTR-2026-0001",
    )


@pytest.mark.asyncio
async def test_contract_payload_applies_iva_19_when_configured():
    svc = AlegraService()
    contract = _contract_with_quotation()

    async def fake_request(method, path, *, params=None, json_body=None):
        if method == "GET" and path == "/contacts":
            return []  # contacto no existe → se crea
        if method == "POST" and path == "/contacts":
            return {"id": 77}
        if method == "GET" and path == "/items":
            return []  # item no existe → se crea
        if method == "POST" and path == "/items":
            return {"id": 501}
        raise AssertionError(f"unexpected call {method} {path}")

    with patch.object(settings, "ALEGRA_IVA_19_TAX_ID", 7), \
            patch.object(svc, "_request", side_effect=fake_request) as req:
        payload = await svc._build_contract_payload(contract)

    # El contacto B2B se crea como empresa (NIT → LEGAL_ENTITY).
    contact_post = [c for c in req.call_args_list
                    if c.args[0] == "POST" and c.args[1] == "/contacts"][0]
    cbody = contact_post.kwargs["json_body"]
    assert cbody["identification"] == "900123456-7"
    assert cbody["identificationObject"]["type"] == "NIT"
    assert cbody["kindOfPerson"] == "LEGAL_ENTITY"

    # El item lleva IVA 19% (tax NO vacío).
    item_post = [c for c in req.call_args_list
                 if c.args[0] == "POST" and c.args[1] == "/items"][0]
    ibody = item_post.kwargs["json_body"]
    assert ibody["tax"] == [{"id": 7}], ibody["tax"]

    # El bloque de items del payload tiene precio/cantidad correctos.
    assert payload["items"] == [{"id": 501, "price": 90000.0, "quantity": 10}]
    assert payload["client"] == 77
    assert payload["stamp"] == {"generateStamp": True}


@pytest.mark.asyncio
async def test_contract_payload_no_iva_when_tax_id_unset():
    svc = AlegraService()
    contract = _contract_with_quotation()

    async def fake_request(method, path, *, params=None, json_body=None):
        if path == "/contacts":
            return [] if method == "GET" else {"id": 1}
        if path == "/items":
            return [] if method == "GET" else {"id": 2}
        raise AssertionError(f"unexpected call {method} {path}")

    with patch.object(settings, "ALEGRA_IVA_19_TAX_ID", None), \
            patch.object(svc, "_request", side_effect=fake_request) as req:
        await svc._build_contract_payload(contract)

    item_post = [c for c in req.call_args_list
                 if c.args[0] == "POST" and c.args[1] == "/items"][0]
    assert item_post.kwargs["json_body"]["tax"] == []


@pytest.mark.asyncio
async def test_contract_payload_without_quotation_single_line():
    svc = AlegraService()
    contract = SimpleNamespace(
        id=uuid4(),
        b2b_client=_b2b_client(),
        quotation=None,
        total=Decimal("5000000"),
        contract_number="CTR-2026-0009",
    )

    async def fake_request(method, path, *, params=None, json_body=None):
        if path == "/contacts":
            return [] if method == "GET" else {"id": 9}
        if path == "/items":
            return [] if method == "GET" else {"id": 90}
        raise AssertionError(f"unexpected call {method} {path}")

    with patch.object(settings, "ALEGRA_IVA_19_TAX_ID", 7), \
            patch.object(svc, "_request", side_effect=fake_request):
        payload = await svc._build_contract_payload(contract)

    assert payload["items"] == [{"id": 90, "price": 5000000.0, "quantity": 1}]
