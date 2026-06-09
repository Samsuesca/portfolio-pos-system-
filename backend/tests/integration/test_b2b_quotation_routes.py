"""
Integration tests para las rutas de Cotizaciones B2B.

Usa `api_client` + `superuser_headers` (el superuser saltea el gating de
permisos — el gating se prueba en test_b2b_permission_gating.py).
"""
from datetime import timedelta
from decimal import Decimal
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.b2b import B2BClient, B2BSegment
from app.utils.timezone import get_colombia_date


@pytest.fixture
async def b2b_client_record(db_session: AsyncSession) -> B2BClient:
    record = B2BClient(
        id=uuid4(),
        legal_name="Corporativo Andes SAS",
        tax_id=f"901{uuid4().hex[:6]}",
        segment=B2BSegment.CORPORATE,
    )
    db_session.add(record)
    await db_session.flush()
    return record


def _payload(client_id, **overrides) -> dict:
    today = get_colombia_date()
    payload = {
        "b2b_client_id": str(client_id),
        "issue_date": today.isoformat(),
        "valid_until": (today + timedelta(days=15)).isoformat(),
        "deposit_pct": "50",
        "tax_amount": "19000",
        "items": [
            {"description": "Camisa", "quantity": 10, "unit_price": "50000"},
            {"description": "Pantalón", "quantity": 5, "unit_price": "80000"},
        ],
    }
    payload.update(overrides)
    return payload


async def _create_quotation(api_client, headers, client_id, **overrides) -> dict:
    resp = await api_client.post(
        "/api/v1/b2b/quotations",
        json=_payload(client_id, **overrides),
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


async def _set_status(api_client, headers, quotation_id, new_status) -> int:
    resp = await api_client.patch(
        f"/api/v1/b2b/quotations/{quotation_id}/status",
        json={"status": new_status},
        headers=headers,
    )
    return resp.status_code


@pytest.mark.asyncio
async def test_create_quotation_computes_totals(
    api_client, superuser_headers, b2b_client_record
):
    body = await _create_quotation(api_client, superuser_headers, b2b_client_record.id)

    assert body["status"] == "draft"
    assert body["quotation_number"].startswith("COT-")
    # line_total = unit_price * quantity
    line_totals = {item["description"]: Decimal(str(item["line_total"])) for item in body["items"]}
    assert line_totals["Camisa"] == Decimal("500000")
    assert line_totals["Pantalón"] == Decimal("400000")
    # subtotal = Σ line_total ; total = subtotal + tax_amount
    assert Decimal(str(body["subtotal"])) == Decimal("900000")
    assert Decimal(str(body["tax_amount"])) == Decimal("19000")
    assert Decimal(str(body["total"])) == Decimal("919000")


@pytest.mark.asyncio
async def test_create_quotation_empty_items_rejected(
    api_client, superuser_headers, b2b_client_record
):
    resp = await api_client.post(
        "/api/v1/b2b/quotations",
        json=_payload(b2b_client_record.id, items=[]),
        headers=superuser_headers,
    )
    # El handler global de validación de esta app responde 400 (no el 422 por
    # defecto de FastAPI) para errores de validación de body.
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_status_fsm_valid_transition(
    api_client, superuser_headers, b2b_client_record
):
    body = await _create_quotation(api_client, superuser_headers, b2b_client_record.id)
    qid = body["id"]

    assert await _set_status(api_client, superuser_headers, qid, "sent") == 200
    assert await _set_status(api_client, superuser_headers, qid, "accepted") == 200

    final = await api_client.get(
        f"/api/v1/b2b/quotations/{qid}", headers=superuser_headers
    )
    assert final.json()["status"] == "accepted"


@pytest.mark.asyncio
async def test_status_fsm_invalid_transition_400(
    api_client, superuser_headers, b2b_client_record
):
    body = await _create_quotation(api_client, superuser_headers, b2b_client_record.id)
    qid = body["id"]

    resp = await api_client.patch(
        f"/api/v1/b2b/quotations/{qid}/status",
        json={"status": "accepted"},  # draft → accepted (salto, inválido)
        headers=superuser_headers,
    )
    assert resp.status_code == 400
    assert "no permitida" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_terminal_status_locked(
    api_client, superuser_headers, b2b_client_record
):
    body = await _create_quotation(api_client, superuser_headers, b2b_client_record.id)
    qid = body["id"]

    await _set_status(api_client, superuser_headers, qid, "sent")
    await _set_status(api_client, superuser_headers, qid, "rejected")

    # rejected es terminal → rejected → sent debe fallar 400.
    assert await _set_status(api_client, superuser_headers, qid, "sent") == 400


@pytest.mark.asyncio
async def test_convert_to_contract(
    api_client, superuser_headers, b2b_client_record
):
    body = await _create_quotation(api_client, superuser_headers, b2b_client_record.id)
    qid = body["id"]
    total = Decimal(str(body["total"]))

    await _set_status(api_client, superuser_headers, qid, "sent")
    await _set_status(api_client, superuser_headers, qid, "accepted")

    resp = await api_client.post(
        f"/api/v1/b2b/quotations/{qid}/convert", headers=superuser_headers
    )
    assert resp.status_code == 201, resp.text
    contract = resp.json()

    assert contract["status"] == "pending_deposit"
    assert contract["contract_number"].startswith("CTR-")
    assert Decimal(str(contract["total"])) == total
    assert contract["b2b_client_id"] == str(b2b_client_record.id)
    assert contract["quotation_id"] == qid

    expected_deposit = (total * Decimal("50") / Decimal("100")).quantize(Decimal("0.01"))
    assert Decimal(str(contract["deposit_amount"])) == expected_deposit
    assert Decimal(str(contract["balance_amount"])) == total - expected_deposit


@pytest.mark.asyncio
async def test_convert_non_accepted_409(
    api_client, superuser_headers, b2b_client_record
):
    body = await _create_quotation(api_client, superuser_headers, b2b_client_record.id)
    qid = body["id"]
    await _set_status(api_client, superuser_headers, qid, "sent")

    resp = await api_client.post(
        f"/api/v1/b2b/quotations/{qid}/convert", headers=superuser_headers
    )
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_convert_twice_409(
    api_client, superuser_headers, b2b_client_record
):
    body = await _create_quotation(api_client, superuser_headers, b2b_client_record.id)
    qid = body["id"]
    await _set_status(api_client, superuser_headers, qid, "sent")
    await _set_status(api_client, superuser_headers, qid, "accepted")

    first = await api_client.post(
        f"/api/v1/b2b/quotations/{qid}/convert", headers=superuser_headers
    )
    assert first.status_code == 201

    second = await api_client.post(
        f"/api/v1/b2b/quotations/{qid}/convert", headers=superuser_headers
    )
    assert second.status_code == 409


@pytest.mark.asyncio
async def test_update_non_draft_blocked_400(
    api_client, superuser_headers, b2b_client_record
):
    body = await _create_quotation(api_client, superuser_headers, b2b_client_record.id)
    qid = body["id"]
    await _set_status(api_client, superuser_headers, qid, "sent")

    resp = await api_client.put(
        f"/api/v1/b2b/quotations/{qid}",
        json={"notes": "intento de edición fuera de borrador"},
        headers=superuser_headers,
    )
    assert resp.status_code == 400
    assert "borrador" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_get_quotation_document_html(
    api_client, superuser_headers, b2b_client_record
):
    body = await _create_quotation(api_client, superuser_headers, b2b_client_record.id)
    qid = body["id"]

    resp = await api_client.get(
        f"/api/v1/b2b/quotations/{qid}/document", headers=superuser_headers
    )
    assert resp.status_code == 200
    assert "text/html" in resp.headers["content-type"]
    assert body["quotation_number"] in resp.text
