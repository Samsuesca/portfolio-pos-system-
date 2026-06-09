"""
Integration tests para los endpoints nuevos del sprint de QA B2B:

- ``/b2b/clients`` (CRUD de clientes empresariales) — cierra el gap "no hay
  gestión de clientes B2B": leer requiere b2b.view, escribir b2b.manage_clients.
- ``/branches`` (sucursales v3.1) — cierra el 404 del branchStore: leer
  branches.view, escribir branches.manage.
- ``outstanding_balance`` en ContractResponse — garantiza que un contrato de
  CONTADO entregado reporta 0 por cobrar (no el balance_amount contractual),
  que es lo que evita el botón "Cobrar saldo" fantasma en el frontend.

El gating resuelve contra el rol de sistema (SYSTEM_ROLE_PERMISSIONS), por eso
no dependemos del seed de la tabla `permissions` (la BD de test usa create_all).
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


async def _make_user_with_role(db: AsyncSession, role: UserRole) -> User:
    unique = uuid4().hex[:8]
    user = User(
        id=str(uuid4()),
        username=f"cb_{role.value}_{unique}",
        email=f"cb_{role.value}_{unique}@test.com",
        hashed_password=UserService.hash_password("Samuel2741"),
        full_name=f"CB {role.value}",
        is_active=True,
        is_superuser=False,
    )
    db.add(user)
    await db.flush()
    school = School(
        id=str(uuid4()), code=f"CB-{unique}", name=f"School {unique}",
        slug=f"school-{unique}", is_active=True,
    )
    db.add(school)
    await db.flush()
    db.add(UserSchoolRole(id=str(uuid4()), user_id=user.id, school_id=school.id, role=role))
    await db.flush()
    return user


def _headers_for(user: User) -> dict[str, str]:
    token = UserService(None).create_access_token(
        user_id=UUID(str(user.id)), username=user.username
    )
    return {"Authorization": f"Bearer {token.access_token}"}


@pytest.fixture
async def viewer_headers(db_session: AsyncSession) -> dict[str, str]:
    return _headers_for(await _make_user_with_role(db_session, UserRole.VIEWER))


@pytest.fixture
async def admin_headers(db_session: AsyncSession) -> dict[str, str]:
    return _headers_for(await _make_user_with_role(db_session, UserRole.ADMIN))


# ---------------------------------------------------------------------------
# Clientes B2B
# ---------------------------------------------------------------------------


def _client_payload(**over):
    base = {
        "legal_name": f"Cliente {uuid4().hex[:6]} SAS",
        "tax_id": f"9{uuid4().hex[:8]}",
        "segment": "corporate",
        "payment_terms_days": 30,
    }
    base.update(over)
    return base


@pytest.mark.asyncio
async def test_create_client_requires_manage_clients(api_client, viewer_headers):
    """VIEWER tiene b2b.view pero NO b2b.manage_clients → 403 al crear."""
    resp = await api_client.post(
        "/api/v1/b2b/clients", json=_client_payload(), headers=viewer_headers
    )
    assert resp.status_code == 403, resp.text


@pytest.mark.asyncio
async def test_list_clients_allowed_for_viewer(api_client, viewer_headers):
    """VIEWER puede LISTAR clientes (b2b.view) para elegirlos al cotizar."""
    resp = await api_client.get("/api/v1/b2b/clients", headers=viewer_headers)
    assert resp.status_code == 200, resp.text
    assert "items" in resp.json()


@pytest.mark.asyncio
async def test_create_client_without_token_unauthorized(api_client):
    # Sin token, HTTPBearer responde 403 "Not authenticated" (no 401) — el proyecto
    # acepta ambos, igual que test_deposit_without_token_401.
    resp = await api_client.post("/api/v1/b2b/clients", json=_client_payload())
    assert resp.status_code in (401, 403), resp.text


@pytest.mark.asyncio
async def test_admin_creates_client_and_dup_nit_409(api_client, admin_headers):
    payload = _client_payload(tax_id="900555444")
    first = await api_client.post("/api/v1/b2b/clients", json=payload, headers=admin_headers)
    assert first.status_code == 201, first.text
    body = first.json()
    assert body["legal_name"] == payload["legal_name"]
    assert body["tax_id"] == "900555444"

    dup = await api_client.post(
        "/api/v1/b2b/clients",
        json=_client_payload(tax_id="900555444"),
        headers=admin_headers,
    )
    assert dup.status_code == 409, dup.text


@pytest.mark.asyncio
async def test_get_and_update_client(api_client, admin_headers):
    created = await api_client.post(
        "/api/v1/b2b/clients", json=_client_payload(), headers=admin_headers
    )
    cid = created.json()["id"]

    got = await api_client.get(f"/api/v1/b2b/clients/{cid}", headers=admin_headers)
    assert got.status_code == 200

    upd = await api_client.patch(
        f"/api/v1/b2b/clients/{cid}",
        json={"payment_terms_days": 60, "contact_name": "Nuevo contacto"},
        headers=admin_headers,
    )
    assert upd.status_code == 200, upd.text
    assert upd.json()["payment_terms_days"] == 60
    assert upd.json()["contact_name"] == "Nuevo contacto"


# ---------------------------------------------------------------------------
# Sucursales
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_list_branches_allowed_for_viewer(api_client, viewer_headers):
    """El 404 que disparaba el branchStore ya no ocurre: 200 con forma paginada."""
    resp = await api_client.get("/api/v1/branches?active_only=true", headers=viewer_headers)
    assert resp.status_code == 200, resp.text
    assert "items" in resp.json()


@pytest.mark.asyncio
async def test_create_branch_requires_manage(api_client, viewer_headers):
    resp = await api_client.post(
        "/api/v1/branches",
        json={"name": "Sede Norte", "code": f"N{uuid4().hex[:5]}"},
        headers=viewer_headers,
    )
    assert resp.status_code == 403, resp.text


@pytest.mark.asyncio
async def test_admin_creates_branch_and_dup_code_409(api_client, admin_headers):
    code = f"S{uuid4().hex[:5]}".upper()
    first = await api_client.post(
        "/api/v1/branches", json={"name": "Sede Centro", "code": code}, headers=admin_headers
    )
    assert first.status_code == 201, first.text
    assert first.json()["code"] == code

    dup = await api_client.post(
        "/api/v1/branches", json={"name": "Otra", "code": code.lower()}, headers=admin_headers
    )
    assert dup.status_code == 409, dup.text


# ---------------------------------------------------------------------------
# outstanding_balance — guarda el fix del "saldo fantasma"
# ---------------------------------------------------------------------------


@pytest.fixture
async def cash_client(db_session: AsyncSession) -> B2BClient:
    rec = B2BClient(
        id=uuid4(), legal_name="OB Contado SAS", tax_id=f"901{uuid4().hex[:6]}",
        segment=B2BSegment.CORPORATE, payment_terms_days=0,
    )
    db_session.add(rec)
    await db_session.flush()
    return rec


@pytest.fixture
async def credit_client(db_session: AsyncSession) -> B2BClient:
    rec = B2BClient(
        id=uuid4(), legal_name="OB Credito SAS", tax_id=f"901{uuid4().hex[:6]}",
        segment=B2BSegment.CORPORATE, payment_terms_days=30,
    )
    db_session.add(rec)
    await db_session.flush()
    return rec


async def _create_and_deposit(api_client, headers, client_id, total="1000000", deposit="400000"):
    created = await api_client.post(
        "/api/v1/b2b/contracts",
        json={"b2b_client_id": str(client_id), "total": total, "deposit_amount": deposit},
        headers=headers,
    )
    assert created.status_code == 201, created.text
    cid = created.json()["id"]
    dep = await api_client.post(
        f"/api/v1/b2b/contracts/{cid}/deposit", json={"payment_method": "cash"}, headers=headers
    )
    assert dep.status_code == 200, dep.text
    return cid


@pytest.mark.asyncio
async def test_outstanding_zero_for_cash_contract_after_delivery(
    api_client, superuser_headers, cash_client
):
    """Contado: el saldo se liquida en la entrega → outstanding_balance == 0,
    aunque balance_amount (contractual) siga > 0. Esto oculta "Cobrar saldo"."""
    cid = await _create_and_deposit(api_client, superuser_headers, cash_client.id)
    deliver = await api_client.post(
        f"/api/v1/b2b/contracts/{cid}/deliver",
        json={"settlement_method": "cash"},
        headers=superuser_headers,
    )
    assert deliver.status_code == 200, deliver.text
    body = deliver.json()
    assert Decimal(str(body["balance_amount"])) > 0  # saldo contractual
    assert Decimal(str(body["outstanding_balance"])) == Decimal("0")  # nada por cobrar


@pytest.mark.asyncio
async def test_outstanding_tracks_receivable_for_credit_contract(
    api_client, superuser_headers, credit_client
):
    """Crédito: tras entrega outstanding == saldo (hay CxC); tras cobrarlo → 0."""
    cid = await _create_and_deposit(
        api_client, superuser_headers, credit_client.id, total="1000000", deposit="400000"
    )
    deliver = await api_client.post(
        f"/api/v1/b2b/contracts/{cid}/deliver",
        json={"settlement_method": "credit"},
        headers=superuser_headers,
    )
    assert deliver.status_code == 200, deliver.text
    assert Decimal(str(deliver.json()["outstanding_balance"])) == Decimal("600000")

    pay = await api_client.post(
        f"/api/v1/b2b/contracts/{cid}/pay-balance",
        json={"amount": "600000", "payment_method": "transfer"},
        headers=superuser_headers,
    )
    assert pay.status_code == 200, pay.text
    assert Decimal(str(pay.json()["outstanding_balance"])) == Decimal("0")
