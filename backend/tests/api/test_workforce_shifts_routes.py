"""
Tests for Workforce Shifts API endpoints.

Tests cover shift template CRUD, schedule management,
bulk schedule creation, and employee schedule queries.

NOTE: Workforce is a GLOBAL module with prefix /global/workforce
"""
import pytest
from httpx import AsyncClient
from datetime import date, time, datetime
from uuid import uuid4
from unittest.mock import AsyncMock, MagicMock, patch


BASE_URL = "/api/v1/global/workforce"
SERVICE_PATH = "app.api.routes.workforce_shifts.shift_service"


def _make_employee(employee_id=None, name="Ana Martinez"):
    emp = MagicMock()
    emp.id = employee_id or uuid4()
    emp.full_name = name
    return emp


def _make_shift_template(**overrides):
    t = MagicMock()
    t.id = overrides.get("id", uuid4())
    t.name = overrides.get("name", "Turno Manana")
    t.shift_type = overrides.get("shift_type", "morning")
    t.start_time = overrides.get("start_time", time(6, 0))
    t.end_time = overrides.get("end_time", time(14, 0))
    t.break_minutes = overrides.get("break_minutes", 0)
    t.description = overrides.get("description", None)
    t.is_active = overrides.get("is_active", True)
    t.created_at = overrides.get("created_at", datetime(2026, 1, 1))
    return t


def _make_schedule(employee=None, template=None, **overrides):
    emp = employee or _make_employee()
    tmpl = template or _make_shift_template()
    s = MagicMock()
    s.id = overrides.get("id", uuid4())
    s.employee_id = emp.id
    s.employee = emp
    s.shift_template_id = tmpl.id
    s.shift_template = tmpl
    s.schedule_date = overrides.get("schedule_date", date(2026, 4, 14))
    s.start_time = overrides.get("start_time", time(6, 0))
    s.end_time = overrides.get("end_time", time(14, 0))
    s.notes = overrides.get("notes", None)
    s.created_at = overrides.get("created_at", datetime(2026, 4, 14))
    return s


# ============================================
# Shift Templates
# ============================================

class TestListShiftTemplates:
    @pytest.mark.asyncio
    @patch(SERVICE_PATH)
    async def test_list_templates(
        self, mock_svc, api_client: AsyncClient, superuser_headers: dict
    ):
        templates = [_make_shift_template(), _make_shift_template(name="Turno Tarde")]
        mock_svc.get_shift_templates = AsyncMock(return_value=templates)

        response = await api_client.get(
            f"{BASE_URL}/shift-templates", headers=superuser_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    @pytest.mark.asyncio
    @patch(SERVICE_PATH)
    async def test_list_templates_filter_active(
        self, mock_svc, api_client: AsyncClient, superuser_headers: dict
    ):
        mock_svc.get_shift_templates = AsyncMock(return_value=[])

        response = await api_client.get(
            f"{BASE_URL}/shift-templates?is_active=true",
            headers=superuser_headers,
        )

        assert response.status_code == 200
        call_kwargs = mock_svc.get_shift_templates.call_args
        assert call_kwargs.kwargs.get("is_active") is True

    @pytest.mark.asyncio
    async def test_list_templates_unauthorized(self, api_client: AsyncClient):
        response = await api_client.get(f"{BASE_URL}/shift-templates")
        assert response.status_code in [401, 403]


class TestCreateShiftTemplate:
    @pytest.mark.asyncio
    @patch(SERVICE_PATH)
    async def test_create_template_success(
        self, mock_svc, api_client: AsyncClient, superuser_headers: dict
    ):
        template = _make_shift_template()
        mock_svc.create_shift_template = AsyncMock(return_value=template)

        payload = {
            "name": "Turno Manana",
            "shift_type": "morning",
            "start_time": "06:00:00",
            "end_time": "14:00:00",
        }

        response = await api_client.post(
            f"{BASE_URL}/shift-templates",
            json=payload,
            headers=superuser_headers,
        )

        assert response.status_code == 201


class TestUpdateShiftTemplate:
    @pytest.mark.asyncio
    @patch(SERVICE_PATH)
    async def test_update_template_success(
        self, mock_svc, api_client: AsyncClient, superuser_headers: dict
    ):
        template_id = uuid4()
        updated = _make_shift_template(id=template_id, name="Turno Noche")
        mock_svc.update_shift_template = AsyncMock(return_value=updated)

        response = await api_client.patch(
            f"{BASE_URL}/shift-templates/{template_id}",
            json={"name": "Turno Noche"},
            headers=superuser_headers,
        )

        assert response.status_code == 200

    @pytest.mark.asyncio
    @patch(SERVICE_PATH)
    async def test_update_template_value_error(
        self, mock_svc, api_client: AsyncClient, superuser_headers: dict
    ):
        mock_svc.update_shift_template = AsyncMock(
            side_effect=ValueError("Plantilla no encontrada")
        )

        response = await api_client.patch(
            f"{BASE_URL}/shift-templates/{uuid4()}",
            json={"name": "X"},
            headers=superuser_headers,
        )

        assert response.status_code == 400


class TestDeleteShiftTemplate:
    @pytest.mark.asyncio
    @patch(SERVICE_PATH)
    async def test_delete_template_success(
        self, mock_svc, api_client: AsyncClient, superuser_headers: dict
    ):
        template_id = uuid4()
        mock_svc.delete_shift_template = AsyncMock(return_value=True)

        response = await api_client.delete(
            f"{BASE_URL}/shift-templates/{template_id}",
            headers=superuser_headers,
        )

        assert response.status_code == 204

    @pytest.mark.asyncio
    @patch(SERVICE_PATH)
    async def test_delete_template_not_found(
        self, mock_svc, api_client: AsyncClient, superuser_headers: dict
    ):
        mock_svc.delete_shift_template = AsyncMock(return_value=False)

        response = await api_client.delete(
            f"{BASE_URL}/shift-templates/{uuid4()}",
            headers=superuser_headers,
        )

        assert response.status_code == 404


# ============================================
# Schedules
# ============================================

class TestListSchedules:
    @pytest.mark.asyncio
    @patch(SERVICE_PATH)
    async def test_list_schedules_paginated(
        self, mock_svc, api_client: AsyncClient, superuser_headers: dict
    ):
        schedules = [_make_schedule() for _ in range(3)]
        mock_svc.get_schedules = AsyncMock(return_value=schedules)

        response = await api_client.get(
            f"{BASE_URL}/schedules", headers=superuser_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 3

    @pytest.mark.asyncio
    @patch(SERVICE_PATH)
    async def test_list_schedules_with_date_range(
        self, mock_svc, api_client: AsyncClient, superuser_headers: dict
    ):
        mock_svc.get_schedules = AsyncMock(return_value=[])

        response = await api_client.get(
            f"{BASE_URL}/schedules?date_from=2026-04-01&date_to=2026-04-30",
            headers=superuser_headers,
        )

        assert response.status_code == 200


class TestCreateSchedule:
    @pytest.mark.asyncio
    @patch(SERVICE_PATH)
    async def test_create_schedule_success(
        self, mock_svc, api_client: AsyncClient, superuser_headers: dict
    ):
        schedule = _make_schedule()
        mock_svc.create_schedule = AsyncMock(return_value=schedule)

        payload = {
            "employee_id": str(uuid4()),
            "shift_template_id": str(uuid4()),
            "schedule_date": "2026-04-15",
            "start_time": "06:00:00",
            "end_time": "14:00:00",
        }

        response = await api_client.post(
            f"{BASE_URL}/schedules",
            json=payload,
            headers=superuser_headers,
        )

        assert response.status_code == 201

    @pytest.mark.asyncio
    @patch(SERVICE_PATH)
    async def test_create_schedule_conflict(
        self, mock_svc, api_client: AsyncClient, superuser_headers: dict
    ):
        mock_svc.create_schedule = AsyncMock(
            side_effect=ValueError("Ya existe un horario para esta fecha")
        )

        payload = {
            "employee_id": str(uuid4()),
            "shift_template_id": str(uuid4()),
            "schedule_date": "2026-04-15",
            "start_time": "06:00:00",
            "end_time": "14:00:00",
        }

        response = await api_client.post(
            f"{BASE_URL}/schedules",
            json=payload,
            headers=superuser_headers,
        )

        assert response.status_code == 400


class TestDeleteSchedule:
    @pytest.mark.asyncio
    @patch(SERVICE_PATH)
    async def test_delete_schedule_success(
        self, mock_svc, api_client: AsyncClient, superuser_headers: dict
    ):
        mock_svc.delete_schedule = AsyncMock(return_value=True)

        response = await api_client.delete(
            f"{BASE_URL}/schedules/{uuid4()}",
            headers=superuser_headers,
        )

        assert response.status_code == 204

    @pytest.mark.asyncio
    @patch(SERVICE_PATH)
    async def test_delete_schedule_not_found(
        self, mock_svc, api_client: AsyncClient, superuser_headers: dict
    ):
        mock_svc.delete_schedule = AsyncMock(return_value=False)

        response = await api_client.delete(
            f"{BASE_URL}/schedules/{uuid4()}",
            headers=superuser_headers,
        )

        assert response.status_code == 404


class TestEmployeeSchedule:
    @pytest.mark.asyncio
    @patch(SERVICE_PATH)
    async def test_get_employee_schedule(
        self, mock_svc, api_client: AsyncClient, superuser_headers: dict
    ):
        emp_id = uuid4()
        schedules = [_make_schedule() for _ in range(2)]
        mock_svc.get_employee_schedule = AsyncMock(return_value=schedules)

        response = await api_client.get(
            f"{BASE_URL}/schedules/employee/{emp_id}?date_from=2026-04-01&date_to=2026-04-30",
            headers=superuser_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 2

    @pytest.mark.asyncio
    async def test_get_employee_schedule_missing_dates(
        self, api_client: AsyncClient, superuser_headers: dict
    ):
        response = await api_client.get(
            f"{BASE_URL}/schedules/employee/{uuid4()}",
            headers=superuser_headers,
        )

        assert response.status_code in [400, 422]
