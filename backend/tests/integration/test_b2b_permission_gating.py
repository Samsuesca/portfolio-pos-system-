"""
Integration tests para el gating de permisos de Cotizaciones B2B.

require_global_permission resuelve el permiso contra el rol de sistema del
usuario en CUALQUIER colegio:
  VIEWER → b2b.view
  SELLER → b2b.view, b2b.manage_quotations
  ADMIN  → + b2b.manage_contracts

Verifica además la distinción 401 (sin token) vs 403 (token válido sin permiso).
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
        username=f"b2b_{role.value}_{unique}",
        email=f"b2b_{role.value}_{unique}@test.com",
        hashed_password=UserService.hash_password("Samuel2741"),
        full_name=f"B2B {role.value}",
        is_active=True,
        is_superuser=False,
    )
    db.add(user)
    await db.flush()

    school = School(
        id=str(uuid4()),
        code=f"B2B-{unique}",
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
async def seller_headers(db_session: AsyncSession) -> dict[str, str]:
    user = await _make_user_with_role(db_session, UserRole.SELLER)
    return _headers_for(user)


@pytest.fixture
async def admin_headers(db_session: AsyncSession) -> dict[str, str]:
    user = await _make_user_with_role(db_session, UserRole.ADMIN)
    return _headers_for(user)


@pytest.fixture
async def b2b_client_record(db_session: AsyncSession) -> B2BClient:
    record = B2BClient(
        id=uuid4(),
        legal_name="Eventos del Valle SAS",
        tax_id=f"902{uuid4().hex[:6]}",
        segment=B2BSegment.EVENT,
    )
    db_session.add(record)
    await db_session.flush()
    return record


def _payload(client_id) -> dict:
    today = get_colombia_date()
    return {
        "b2b_client_id": str(client_id),
        "issue_date": today.isoformat(),
        "valid_until": (today + timedelta(days=10)).isoformat(),
        "items": [{"description": "Uniforme evento", "quantity": 20, "unit_price": "40000"}],
    }


@pytest.mark.asyncio
async def test_view_requires_b2b_view(api_client, viewer_headers):
    ok = await api_client.get("/api/v1/b2b/quotations", headers=viewer_headers)
    assert ok.status_code == 200

    no_auth = await api_client.get("/api/v1/b2b/quotations")
    assert no_auth.status_code in (401, 403)


@pytest.mark.asyncio
async def test_create_requires_manage_quotations(
    api_client, viewer_headers, seller_headers, b2b_client_record
):
    # VIEWER tiene solo b2b.view → 403 al crear.
    denied = await api_client.post(
        "/api/v1/b2b/quotations",
        json=_payload(b2b_client_record.id),
        headers=viewer_headers,
    )
    assert denied.status_code == 403

    # SELLER tiene b2b.manage_quotations → 201.
    allowed = await api_client.post(
        "/api/v1/b2b/quotations",
        json=_payload(b2b_client_record.id),
        headers=seller_headers,
    )
    assert allowed.status_code == 201, allowed.text


@pytest.mark.asyncio
async def test_convert_requires_manage_contracts(
    api_client, seller_headers, admin_headers, superuser_headers, b2b_client_record
):
    # Crear + aceptar la cotización como admin (tiene manage_quotations).
    created = await api_client.post(
        "/api/v1/b2b/quotations",
        json=_payload(b2b_client_record.id),
        headers=admin_headers,
    )
    assert created.status_code == 201, created.text
    qid = created.json()["id"]

    for new_status in ("sent", "accepted"):
        r = await api_client.patch(
            f"/api/v1/b2b/quotations/{qid}/status",
            json={"status": new_status},
            headers=admin_headers,
        )
        assert r.status_code == 200, r.text

    # SELLER no tiene b2b.manage_contracts → 403 al convertir.
    denied = await api_client.post(
        f"/api/v1/b2b/quotations/{qid}/convert", headers=seller_headers
    )
    assert denied.status_code == 403

    # ADMIN sí → 201.
    allowed = await api_client.post(
        f"/api/v1/b2b/quotations/{qid}/convert", headers=admin_headers
    )
    assert allowed.status_code == 201, allowed.text


@pytest.mark.asyncio
async def test_403_not_401_when_authenticated_without_perm(
    api_client, viewer_headers, b2b_client_record
):
    resp = await api_client.post(
        "/api/v1/b2b/quotations",
        json=_payload(b2b_client_record.id),
        headers=viewer_headers,
    )
    assert resp.status_code == 403
