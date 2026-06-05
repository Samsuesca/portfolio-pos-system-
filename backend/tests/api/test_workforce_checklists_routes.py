"""
Tests for Workforce Checklists API endpoints.

Tests cover checklist template CRUD, template item management,
daily checklist generation, item status updates, and verification.

NOTE: Workforce is a GLOBAL module with prefix /global/workforce
"""
import pytest
from httpx import AsyncClient
from datetime import date, datetime
from uuid import uuid4
from unittest.mock import AsyncMock, MagicMock, patch


BASE_URL = "/api/v1/global/workforce"
SERVICE_PATH = "app.api.routes.workforce_checklists.checklist_service"


def _make_employee(employee_id=None, name="Laura Gomez"):
    emp = MagicMock()
    emp.id = employee_id or uuid4()
    emp.full_name = name
    return emp


def _make_template_item(template_id=None, **overrides):
    item = MagicMock()
    item.id = overrides.get("id", uuid4())
    item.template_id = template_id or uuid4()
    item.description = overrides.get("description", "Limpiar area de trabajo")
    item.sort_order = overrides.get("sort_order", 1)
    item.is_required = overrides.get("is_required", True)
    item.created_at = overrides.get("created_at", datetime(2026, 1, 1))
    return item


def _make_template(**overrides):
    t = MagicMock()
    t.id = overrides.get("id", uuid4())
    t.name = overrides.get("name", "Checklist Apertura Tienda")
    t.assignment_type = overrides.get("assignment_type", "position")
    t.position = overrides.get("position", "Vendedora")
    t.employee_id = overrides.get("employee_id", None)
    t.employee_name = overrides.get("employee_name", None)
    t.assigned_employee = overrides.get("assigned_employee", None)
    t.description = overrides.get("description", "Tareas de apertura")
    t.is_active = overrides.get("is_active", True)
    t.items = overrides.get("items", [_make_template_item(template_id=t.id)])
    t.created_at = overrides.get("created_at", datetime(2026, 1, 1))
    return t


def _make_checklist_item(**overrides):
    item = MagicMock()
    item.id = overrides.get("id", uuid4())
    item.checklist_id = overrides.get("checklist_id", uuid4())
    item.description = overrides.get("description", "Organizar vitrinas")
    item.sort_order = overrides.get("sort_order", 1)
    item.is_required = overrides.get("is_required", True)
    item.status = overrides.get("status", "pending")
    item.completed_at = overrides.get("completed_at", None)
    item.completed_by = overrides.get("completed_by", None)
    item.notes = overrides.get("notes", None)
    return item


def _make_checklist(employee=None, **overrides):
    emp = employee or _make_employee()
    c = MagicMock()
    c.id = overrides.get("id", uuid4())
    c.employee_id = emp.id
    c.employee = emp
    c.template_id = overrides.get("template_id", uuid4())
    c.checklist_date = overrides.get("checklist_date", date(2026, 4, 14))
    c.total_items = overrides.get("total_items", 5)
    c.completed_items = overrides.get("completed_items", 3)
    c.completion_rate = overrides.get("completion_rate", 60.0)
    c.verified_by = overrides.get("verified_by", None)
    c.verified_at = overrides.get("verified_at", None)
    c.notes = overrides.get("notes", None)
    c.items = overrides.get("items", [_make_checklist_item(checklist_id=c.id)])
    c.created_at = overrides.get("created_at", datetime(2026, 4, 14, 6, 0))
    return c


# ============================================
# Checklist Templates
# ============================================

class TestListChecklistTemplates:
    @pytest.mark.asyncio
    @patch(SERVICE_PATH)
    async def test_list_templates(
        self, mock_svc, api_client: AsyncClient, superuser_headers: dict
    ):
        templates = [_make_template(), _make_template(name="Checklist Cierre")]
        mock_svc.get_templates = AsyncMock(return_value=templates)

        response = await api_client.get(
            f"{BASE_URL}/checklist-templates", headers=superuser_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 2

    @pytest.mark.asyncio
    @patch(SERVICE_PATH)
    async def test_list_templates_filter_by_position(
        self, mock_svc, api_client: AsyncClient, superuser_headers: dict
    ):
        mock_svc.get_templates = AsyncMock(return_value=[])

        response = await api_client.get(
            f"{BASE_URL}/checklist-templates?position=Vendedora",
            headers=superuser_headers,
        )

        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_list_templates_unauthorized(self, api_client: AsyncClient):
        response = await api_client.get(f"{BASE_URL}/checklist-templates")
        assert response.status_code in [401, 403]


class TestCreateChecklistTemplate:
    @pytest.mark.asyncio
    @patch(SERVICE_PATH)
    async def test_create_template_success(
        self, mock_svc, api_client: AsyncClient, superuser_headers: dict
    ):
        template = _make_template()
        mock_svc.create_template = AsyncMock(return_value=template)

        payload = {
            "name": "Checklist Apertura",
            "assignment_type": "position",
            "position": "Vendedora",
            "items": [
                {"description": "Abrir caja registradora", "sort_order": 1, "is_required": True}
            ],
        }

        response = await api_client.post(
            f"{BASE_URL}/checklist-templates",
            json=payload,
            headers=superuser_headers,
        )

        assert response.status_code == 201


class TestGetChecklistTemplate:
    @pytest.mark.asyncio
    @patch(SERVICE_PATH)
    async def test_get_template_found(
        self, mock_svc, api_client: AsyncClient, superuser_headers: dict
    ):
        template_id = uuid4()
        template = _make_template(id=template_id)
        mock_svc.get_template = AsyncMock(return_value=template)

        response = await api_client.get(
            f"{BASE_URL}/checklist-templates/{template_id}",
            headers=superuser_headers,
        )

        assert response.status_code == 200

    @pytest.mark.asyncio
    @patch(SERVICE_PATH)
    async def test_get_template_not_found(
        self, mock_svc, api_client: AsyncClient, superuser_headers: dict
    ):
        mock_svc.get_template = AsyncMock(return_value=None)

        response = await api_client.get(
            f"{BASE_URL}/checklist-templates/{uuid4()}",
            headers=superuser_headers,
        )

        assert response.status_code == 404


# ============================================
# Daily Checklists
# ============================================

class TestListDailyChecklists:
    @pytest.mark.asyncio
    @patch(SERVICE_PATH)
    async def test_list_checklists_paginated(
        self, mock_svc, api_client: AsyncClient, superuser_headers: dict
    ):
        checklists = [_make_checklist() for _ in range(2)]
        mock_svc.get_checklists = AsyncMock(return_value=checklists)

        response = await api_client.get(
            f"{BASE_URL}/checklists", headers=superuser_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 2

    @pytest.mark.asyncio
    @patch(SERVICE_PATH)
    async def test_list_checklists_filter_by_date(
        self, mock_svc, api_client: AsyncClient, superuser_headers: dict
    ):
        mock_svc.get_checklists = AsyncMock(return_value=[])

        response = await api_client.get(
            f"{BASE_URL}/checklists?checklist_date=2026-04-14",
            headers=superuser_headers,
        )

        assert response.status_code == 200


class TestGenerateDailyChecklists:
    @pytest.mark.asyncio
    @patch(SERVICE_PATH)
    async def test_generate_checklists(
        self, mock_svc, api_client: AsyncClient, superuser_headers: dict
    ):
        checklists = [_make_checklist(), _make_checklist()]
        mock_svc.generate_daily_checklists = AsyncMock(return_value=checklists)

        response = await api_client.post(
            f"{BASE_URL}/checklists/generate?target_date=2026-04-14",
            headers=superuser_headers,
        )

        assert response.status_code == 201
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 2


class TestUpdateChecklistItemStatus:
    @pytest.mark.asyncio
    @patch(SERVICE_PATH)
    async def test_update_item_status_success(
        self, mock_svc, api_client: AsyncClient, superuser_headers: dict
    ):
        item_id = uuid4()
        updated_item = _make_checklist_item(
            id=item_id, status="completed", completed_at=datetime(2026, 4, 14, 10, 0)
        )
        mock_svc.update_item_status = AsyncMock(return_value=updated_item)

        response = await api_client.patch(
            f"{BASE_URL}/checklists/items/{item_id}",
            json={"status": "completed"},
            headers=superuser_headers,
        )

        assert response.status_code == 200

    @pytest.mark.asyncio
    @patch(SERVICE_PATH)
    async def test_update_item_status_value_error(
        self, mock_svc, api_client: AsyncClient, superuser_headers: dict
    ):
        mock_svc.update_item_status = AsyncMock(
            side_effect=ValueError("Item no encontrado")
        )

        response = await api_client.patch(
            f"{BASE_URL}/checklists/items/{uuid4()}",
            json={"status": "completed"},
            headers=superuser_headers,
        )

        assert response.status_code == 400


class TestVerifyChecklist:
    @pytest.mark.asyncio
    @patch(SERVICE_PATH)
    async def test_verify_checklist_success(
        self, mock_svc, api_client: AsyncClient, superuser_headers: dict
    ):
        checklist_id = uuid4()
        verified = _make_checklist(
            id=checklist_id,
            verified_by=uuid4(),
            verified_at=datetime(2026, 4, 14, 17, 0),
        )
        mock_svc.verify_checklist = AsyncMock(return_value=verified)

        response = await api_client.post(
            f"{BASE_URL}/checklists/{checklist_id}/verify",
            headers=superuser_headers,
        )

        assert response.status_code == 200

    @pytest.mark.asyncio
    @patch(SERVICE_PATH)
    async def test_verify_checklist_with_notes(
        self, mock_svc, api_client: AsyncClient, superuser_headers: dict
    ):
        checklist_id = uuid4()
        verified = _make_checklist(id=checklist_id, notes="Todo en orden")
        mock_svc.verify_checklist = AsyncMock(return_value=verified)

        response = await api_client.post(
            f"{BASE_URL}/checklists/{checklist_id}/verify",
            json={"notes": "Todo en orden"},
            headers=superuser_headers,
        )

        assert response.status_code == 200

    @pytest.mark.asyncio
    @patch(SERVICE_PATH)
    async def test_verify_checklist_value_error(
        self, mock_svc, api_client: AsyncClient, superuser_headers: dict
    ):
        mock_svc.verify_checklist = AsyncMock(
            side_effect=ValueError("Checklist ya verificado")
        )

        response = await api_client.post(
            f"{BASE_URL}/checklists/{uuid4()}/verify",
            headers=superuser_headers,
        )

        assert response.status_code == 400


class TestDeleteTemplateItem:
    @pytest.mark.asyncio
    @patch(SERVICE_PATH)
    async def test_delete_item_success(
        self, mock_svc, api_client: AsyncClient, superuser_headers: dict
    ):
        mock_svc.delete_template_item = AsyncMock(return_value=True)

        response = await api_client.delete(
            f"{BASE_URL}/checklist-templates/items/{uuid4()}",
            headers=superuser_headers,
        )

        assert response.status_code == 204

    @pytest.mark.asyncio
    @patch(SERVICE_PATH)
    async def test_delete_item_not_found(
        self, mock_svc, api_client: AsyncClient, superuser_headers: dict
    ):
        mock_svc.delete_template_item = AsyncMock(return_value=False)

        response = await api_client.delete(
            f"{BASE_URL}/checklist-templates/items/{uuid4()}",
            headers=superuser_headers,
        )

        assert response.status_code == 404
