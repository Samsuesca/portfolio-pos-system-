"""
Tests for Workforce Attendance API endpoints.

Tests cover attendance logging, absence management, daily summaries,
and deductible absences for payroll integration.

NOTE: Workforce is a GLOBAL module with prefix /global/workforce
"""
import pytest
from httpx import AsyncClient
from datetime import date, time, datetime
from uuid import uuid4
from unittest.mock import AsyncMock, MagicMock, patch


BASE_URL = "/api/v1/global/workforce"
SERVICE_PATH = "app.api.routes.workforce_attendance.attendance_service"


def _make_employee(employee_id=None, name="Maria Lopez"):
    emp = MagicMock()
    emp.id = employee_id or uuid4()
    emp.full_name = name
    return emp


def _make_attendance_record(employee=None, **overrides):
    emp = employee or _make_employee()
    record = MagicMock()
    record.id = overrides.get("id", uuid4())
    record.employee_id = emp.id
    record.employee = emp
    record.record_date = overrides.get("record_date", date(2026, 4, 14))
    record.status = overrides.get("status", "present")
    record.check_in_time = overrides.get("check_in_time", time(8, 0))
    record.check_out_time = overrides.get("check_out_time", time(17, 0))
    record.scheduled_start = overrides.get("scheduled_start", time(8, 0))
    record.scheduled_end = overrides.get("scheduled_end", time(17, 0))
    record.minutes_late = overrides.get("minutes_late", 0)
    record.minutes_early_departure = overrides.get("minutes_early_departure", 0)
    record.notes = overrides.get("notes", None)
    record.recorded_by = overrides.get("recorded_by", uuid4())
    record.created_at = overrides.get("created_at", datetime(2026, 4, 14, 8, 0))
    return record


def _make_absence(employee=None, **overrides):
    from decimal import Decimal
    emp = employee or _make_employee()
    absence = MagicMock()
    absence.id = overrides.get("id", uuid4())
    absence.employee_id = emp.id
    absence.employee = emp
    absence.attendance_record_id = overrides.get("attendance_record_id", uuid4())
    absence.absence_type = overrides.get("absence_type", "absence_unjustified")
    absence.absence_date = overrides.get("absence_date", date(2026, 4, 14))
    absence.justification = overrides.get("justification", None)
    absence.evidence_url = overrides.get("evidence_url", None)
    absence.is_deductible = overrides.get("is_deductible", True)
    absence.deduction_amount = overrides.get("deduction_amount", Decimal("0"))
    absence.approved_by = overrides.get("approved_by", None)
    absence.approved_at = overrides.get("approved_at", None)
    absence.created_by = overrides.get("created_by", uuid4())
    absence.created_at = overrides.get("created_at", datetime(2026, 4, 14, 8, 0))
    return absence


# ============================================
# Attendance
# ============================================

class TestListAttendance:
    @pytest.mark.asyncio
    @patch(SERVICE_PATH)
    async def test_list_attendance_returns_paginated(
        self, mock_svc, api_client: AsyncClient, superuser_headers: dict
    ):
        records = [_make_attendance_record() for _ in range(3)]
        mock_svc.get_attendance_records = AsyncMock(return_value=records)

        response = await api_client.get(
            f"{BASE_URL}/attendance", headers=superuser_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 3
        assert len(data["items"]) == 3

    @pytest.mark.asyncio
    @patch(SERVICE_PATH)
    async def test_list_attendance_with_date_filter(
        self, mock_svc, api_client: AsyncClient, superuser_headers: dict
    ):
        mock_svc.get_attendance_records = AsyncMock(return_value=[])

        response = await api_client.get(
            f"{BASE_URL}/attendance?record_date=2026-04-14",
            headers=superuser_headers,
        )

        assert response.status_code == 200
        mock_svc.get_attendance_records.assert_called_once()
        call_kwargs = mock_svc.get_attendance_records.call_args
        assert call_kwargs.kwargs.get("record_date") == date(2026, 4, 14)

    @pytest.mark.asyncio
    @patch(SERVICE_PATH)
    async def test_list_attendance_with_employee_filter(
        self, mock_svc, api_client: AsyncClient, superuser_headers: dict
    ):
        emp_id = uuid4()
        mock_svc.get_attendance_records = AsyncMock(return_value=[])

        response = await api_client.get(
            f"{BASE_URL}/attendance?employee_id={emp_id}",
            headers=superuser_headers,
        )

        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_list_attendance_unauthorized(self, api_client: AsyncClient):
        response = await api_client.get(f"{BASE_URL}/attendance")
        assert response.status_code in [401, 403]


class TestLogAttendance:
    @pytest.mark.asyncio
    @patch(SERVICE_PATH)
    async def test_log_attendance_success(
        self, mock_svc, api_client: AsyncClient, superuser_headers: dict
    ):
        emp_id = str(uuid4())
        record = _make_attendance_record()
        mock_svc.log_attendance = AsyncMock(return_value=record)

        payload = {
            "employee_id": emp_id,
            "record_date": "2026-04-14",
            "status": "present",
            "check_in_time": "08:00:00",
        }

        response = await api_client.post(
            f"{BASE_URL}/attendance",
            json=payload,
            headers=superuser_headers,
        )

        assert response.status_code == 201
        data = response.json()
        assert data["status"] == "present"

    @pytest.mark.asyncio
    @patch(SERVICE_PATH)
    async def test_log_attendance_value_error(
        self, mock_svc, api_client: AsyncClient, superuser_headers: dict
    ):
        mock_svc.log_attendance = AsyncMock(
            side_effect=ValueError("Ya existe un registro para este empleado en esta fecha")
        )

        payload = {
            "employee_id": str(uuid4()),
            "record_date": "2026-04-14",
            "status": "present",
        }

        response = await api_client.post(
            f"{BASE_URL}/attendance",
            json=payload,
            headers=superuser_headers,
        )

        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_log_attendance_missing_fields(
        self, api_client: AsyncClient, superuser_headers: dict
    ):
        response = await api_client.post(
            f"{BASE_URL}/attendance",
            json={},
            headers=superuser_headers,
        )

        assert response.status_code in [400, 422]


class TestUpdateAttendance:
    @pytest.mark.asyncio
    @patch(SERVICE_PATH)
    async def test_update_attendance_success(
        self, mock_svc, api_client: AsyncClient, superuser_headers: dict
    ):
        record_id = uuid4()
        updated = _make_attendance_record(id=record_id, notes="Llego tarde por lluvia")
        mock_svc.update_attendance = AsyncMock(return_value=updated)

        response = await api_client.patch(
            f"{BASE_URL}/attendance/{record_id}",
            json={"notes": "Llego tarde por lluvia"},
            headers=superuser_headers,
        )

        assert response.status_code == 200

    @pytest.mark.asyncio
    @patch(SERVICE_PATH)
    async def test_update_attendance_value_error(
        self, mock_svc, api_client: AsyncClient, superuser_headers: dict
    ):
        mock_svc.update_attendance = AsyncMock(
            side_effect=ValueError("Registro no encontrado")
        )

        response = await api_client.patch(
            f"{BASE_URL}/attendance/{uuid4()}",
            json={"notes": "test"},
            headers=superuser_headers,
        )

        assert response.status_code == 400


class TestDailySummary:
    @pytest.mark.asyncio
    @patch(SERVICE_PATH)
    async def test_get_daily_summary(
        self, mock_svc, api_client: AsyncClient, superuser_headers: dict
    ):
        # Use a plain dict; FastAPI will validate against DailyAttendanceSummary.
        summary = {
            "date": date(2026, 4, 14),
            "total_employees": 5,
            "present": 4,
            "absent": 1,
            "late": 0,
            "excused": 0,
            "not_logged": 0,
        }
        mock_svc.get_daily_summary = AsyncMock(return_value=summary)

        response = await api_client.get(
            f"{BASE_URL}/attendance/daily?target_date=2026-04-14",
            headers=superuser_headers,
        )

        assert response.status_code == 200


# ============================================
# Absences
# ============================================

class TestListAbsences:
    @pytest.mark.asyncio
    @patch(SERVICE_PATH)
    async def test_list_absences_returns_paginated(
        self, mock_svc, api_client: AsyncClient, superuser_headers: dict
    ):
        absences = [_make_absence() for _ in range(2)]
        mock_svc.get_absences = AsyncMock(return_value=absences)

        response = await api_client.get(
            f"{BASE_URL}/absences", headers=superuser_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 2

    @pytest.mark.asyncio
    @patch(SERVICE_PATH)
    async def test_list_absences_with_deductible_filter(
        self, mock_svc, api_client: AsyncClient, superuser_headers: dict
    ):
        mock_svc.get_absences = AsyncMock(return_value=[])

        response = await api_client.get(
            f"{BASE_URL}/absences?is_deductible=true",
            headers=superuser_headers,
        )

        assert response.status_code == 200


class TestCreateAbsence:
    @pytest.mark.asyncio
    @patch(SERVICE_PATH)
    async def test_create_absence_success(
        self, mock_svc, api_client: AsyncClient, superuser_headers: dict
    ):
        absence = _make_absence()
        mock_svc.create_absence = AsyncMock(return_value=absence)

        payload = {
            "employee_id": str(uuid4()),
            "absence_date": "2026-04-14",
            "absence_type": "absence_unjustified",
        }

        response = await api_client.post(
            f"{BASE_URL}/absences",
            json=payload,
            headers=superuser_headers,
        )

        assert response.status_code == 201


class TestApproveAbsence:
    @pytest.mark.asyncio
    @patch(SERVICE_PATH)
    async def test_approve_absence_success(
        self, mock_svc, api_client: AsyncClient, superuser_headers: dict
    ):
        absence_id = uuid4()
        approved = _make_absence(
            id=absence_id,
            approved_by=uuid4(),
            approved_at=datetime(2026, 4, 14, 10, 0),
        )
        mock_svc.approve_absence = AsyncMock(return_value=approved)

        response = await api_client.post(
            f"{BASE_URL}/absences/{absence_id}/approve",
            headers=superuser_headers,
        )

        assert response.status_code == 200

    @pytest.mark.asyncio
    @patch(SERVICE_PATH)
    async def test_approve_absence_value_error(
        self, mock_svc, api_client: AsyncClient, superuser_headers: dict
    ):
        mock_svc.approve_absence = AsyncMock(
            side_effect=ValueError("Ausencia ya aprobada")
        )

        response = await api_client.post(
            f"{BASE_URL}/absences/{uuid4()}/approve",
            headers=superuser_headers,
        )

        assert response.status_code == 400


class TestDeductibleAbsences:
    @pytest.mark.asyncio
    @patch(SERVICE_PATH)
    async def test_get_deductible_absences(
        self, mock_svc, api_client: AsyncClient, superuser_headers: dict
    ):
        absences = [_make_absence(is_deductible=True)]
        mock_svc.get_deductible_absences = AsyncMock(return_value=absences)

        response = await api_client.get(
            f"{BASE_URL}/absences/deductions?period_start=2026-04-01&period_end=2026-04-30",
            headers=superuser_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1

    @pytest.mark.asyncio
    async def test_deductible_absences_missing_required_params(
        self, api_client: AsyncClient, superuser_headers: dict
    ):
        response = await api_client.get(
            f"{BASE_URL}/absences/deductions",
            headers=superuser_headers,
        )

        assert response.status_code in [400, 422]
