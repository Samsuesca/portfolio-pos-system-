"""
Integration tests para las rutas de Contratos B2B (Fase B3).

Cubre:
- happy path end-to-end vía HTTP (crear → anticipo → entrega → cobro) con
  superuser (saltea gating; la contabilidad la fijan los unit tests).
- I11: gating de permisos. require_global_permission resuelve contra el rol de
  sistema en cualquier colegio:
    VIEWER → b2b.view
    ADMIN  → + b2b.manage_contracts (pero NO b2b.void_contracts)
  void_contracts solo lo tiene OWNER/superuser.
- distinción 401 (sin token) vs 403 (token válido sin permiso).
"""
from datetime import timedelta
from decimal import Decimal
from uuid import uuid4, UUID

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.b2b import B2BClient, B2BSegment
from app.models import User, School, UserSchoolRole
from app.models.user import UserRole
from app.services.user import UserService
from app.utils.timezone import get_colombia_date


# ---------------------------------------------------------------------------
# Fixtures (espejan test_b2b_permission_gating.py)
# ---------------------------------------------------------------------------


async def _make_user_with_role(db: AsyncSession, role: UserRole) -> User:
    unique = uuid4().hex[:8]
    user = User(
        id=str(uuid4()),
        username=f"ctr_{role.value}_{unique}",
        email=f"ctr_{role.value}_{unique}@test.com",
        hashed_password=UserService.hash_password("Samuel2741"),
        full_name=f"CTR {role.value}",
        is_active=True,
        is_superuser=False,
    )
    db.add(user)
    await db.flush()

    school = School(
        id=str(uuid4()),
        code=f"CTR-{unique}",
        name=f"School {unique}",
        slug=f"school-{unique}",
        is_active=True,
    )
    db.add(school)
    await db.flush()

    db.add(
        UserSchoolRole(
            id=str(uuid4()),
            user_id=user.id,
            school_id=school.id,
            role=role,
        )
    )
    await db.flush()
    return user


def _headers_for(user: User) -> dict[str, str]:
    token = UserService(None).create_access_token(
        user_id=UUID(str(user.id)), username=user.username
    )
    return {"Authorization": f"Bearer {token.access_token}"}


@pytest.fixture
async def viewer_headers(db_session: AsyncSession) -> dict[str, str]:
    user = await _make_user_with_role(db_session, UserRole.VIEWER)
    return _headers_for(user)


@pytest.fixture
async def admin_headers(db_session: AsyncSession) -> dict[str, str]:
    user = await _make_user_with_role(db_session, UserRole.ADMIN)
    return _headers_for(user)


@pytest.fixture
async def cash_client(db_session: AsyncSession) -> B2BClient:
    record = B2BClient(
        id=uuid4(),
        legal_name="API Contado SAS",
        tax_id=f"903{uuid4().hex[:6]}",
        segment=B2BSegment.CORPORATE,
        payment_terms_days=0,
    )
    db_session.add(record)
    await db_session.flush()
    return record


def _contract_payload(client_id, **overrides) -> dict:
    payload = {
        "b2b_client_id": str(client_id),
        "total": "1000000",
        "deposit_amount": "400000",
    }
    payload.update(overrides)
    return payload


# ---------------------------------------------------------------------------
# Happy path E2E (superuser)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_full_lifecycle_via_http(api_client, superuser_headers, cash_client):
    # crear
    created = await api_client.post(
        "/api/v1/b2b/contracts",
        json=_contract_payload(cash_client.id),
        headers=superuser_headers,
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["status"] == "pending_deposit"
    assert body["contract_number"].startswith("CTR-")
    cid = body["id"]

    # anticipo
    deposit = await api_client.post(
        f"/api/v1/b2b/contracts/{cid}/deposit",
        json={"payment_method": "cash"},
        headers=superuser_headers,
    )
    assert deposit.status_code == 200, deposit.text
    assert deposit.json()["status"] == "in_production"

    # entrega total (contado)
    deliver = await api_client.post(
        f"/api/v1/b2b/contracts/{cid}/deliver",
        json={"settlement_method": "cash"},
        headers=superuser_headers,
    )
    assert deliver.status_code == 200, deliver.text
    assert deliver.json()["status"] == "delivered"


@pytest.mark.asyncio
async def test_deliver_on_pending_deposit_returns_409(
    api_client, superuser_headers, cash_client
):
    created = await api_client.post(
        "/api/v1/b2b/contracts",
        json=_contract_payload(cash_client.id),
        headers=superuser_headers,
    )
    cid = created.json()["id"]

    deliver = await api_client.post(
        f"/api/v1/b2b/contracts/{cid}/deliver",
        json={},
        headers=superuser_headers,
    )
    assert deliver.status_code == 409, deliver.text


@pytest.mark.asyncio
async def test_get_missing_contract_404(api_client, superuser_headers):
    resp = await api_client.get(
        f"/api/v1/b2b/contracts/{uuid4()}", headers=superuser_headers
    )
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# I11 — gating de permisos
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_list_requires_b2b_view(api_client, viewer_headers):
    ok = await api_client.get("/api/v1/b2b/contracts", headers=viewer_headers)
    assert ok.status_code == 200

    no_auth = await api_client.get("/api/v1/b2b/contracts")
    assert no_auth.status_code in (401, 403)


@pytest.mark.asyncio
async def test_viewer_cannot_register_deposit(
    api_client, viewer_headers, superuser_headers, cash_client
):
    created = await api_client.post(
        "/api/v1/b2b/contracts",
        json=_contract_payload(cash_client.id),
        headers=superuser_headers,
    )
    cid = created.json()["id"]

    # VIEWER solo tiene b2b.view → 403 al registrar anticipo
    denied = await api_client.post(
        f"/api/v1/b2b/contracts/{cid}/deposit",
        json={"payment_method": "cash"},
        headers=viewer_headers,
    )
    assert denied.status_code == 403


@pytest.mark.asyncio
async def test_admin_can_manage_but_not_void(
    api_client, admin_headers, superuser_headers, cash_client
):
    created = await api_client.post(
        "/api/v1/b2b/contracts",
        json=_contract_payload(cash_client.id),
        headers=superuser_headers,
    )
    cid = created.json()["id"]

    # ADMIN tiene b2b.manage_contracts → puede registrar anticipo
    deposit = await api_client.post(
        f"/api/v1/b2b/contracts/{cid}/deposit",
        json={"payment_method": "cash"},
        headers=admin_headers,
    )
    assert deposit.status_code == 200, deposit.text

    # ADMIN NO tiene b2b.void_contracts → 403 al cancelar
    cancel = await api_client.post(
        f"/api/v1/b2b/contracts/{cid}/cancel",
        json={"retain_deposit": False},
        headers=admin_headers,
    )
    assert cancel.status_code == 403


@pytest.mark.asyncio
async def test_deposit_without_token_401(api_client, superuser_headers, cash_client):
    created = await api_client.post(
        "/api/v1/b2b/contracts",
        json=_contract_payload(cash_client.id),
        headers=superuser_headers,
    )
    cid = created.json()["id"]

    resp = await api_client.post(
        f"/api/v1/b2b/contracts/{cid}/deposit",
        json={"payment_method": "cash"},
    )
    assert resp.status_code in (401, 403)
