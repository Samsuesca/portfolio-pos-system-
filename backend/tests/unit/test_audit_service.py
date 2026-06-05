"""
Unit Tests for AuditService

Tests audit logging, querying with filters, resource history, and actor activity.
"""
import uuid
from datetime import date
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.models.audit_log import AuditAction
from app.services.audit import AuditService


@pytest.fixture
def service():
    return AuditService()


def _make_audit_log(**overrides):
    defaults = {
        "id": uuid.uuid4(),
        "actor_id": uuid.uuid4(),
        "action": "sale_cancel",
        "resource_type": "sale",
        "resource_id": str(uuid.uuid4()),
        "description": "Cancelled sale",
        "school_id": None,
        "data_before": {"status": "completed"},
        "data_after": {"status": "cancelled"},
        "ip_address": "192.168.1.1",
        "user_agent": "TestAgent/1.0",
    }
    defaults.update(overrides)
    log = MagicMock()
    for k, v in defaults.items():
        setattr(log, k, v)
    return log


# ============================================================================
# TEST: log
# ============================================================================


class TestAuditLog:

    @pytest.mark.asyncio
    async def test_log_happy_path_all_fields(self, mock_db_session, service):
        actor_id = uuid.uuid4()
        school_id = uuid.uuid4()
        resource_id = str(uuid.uuid4())

        result = await service.log(
            db=mock_db_session,
            actor_id=actor_id,
            action="sale_cancel",
            resource_type="sale",
            resource_id=resource_id,
            description="Cancelled sale CARACAS-001-VNT-2026-0001",
            school_id=school_id,
            data_before={"status": "completed"},
            data_after={"status": "cancelled"},
            request=None,
        )

        mock_db_session.add.assert_called_once()
        mock_db_session.flush.assert_awaited_once()
        added_obj = mock_db_session.add.call_args[0][0]
        assert added_obj.action == "sale_cancel"
        assert added_obj.actor_id == actor_id
        assert added_obj.resource_type == "sale"
        assert added_obj.resource_id == resource_id
        assert added_obj.school_id == school_id
        assert added_obj.data_before == {"status": "completed"}
        assert added_obj.data_after == {"status": "cancelled"}
        assert added_obj.ip_address is None
        assert added_obj.user_agent is None

    @pytest.mark.asyncio
    async def test_log_extracts_enum_value(self, mock_db_session, service):
        await service.log(
            db=mock_db_session,
            actor_id=uuid.uuid4(),
            action=AuditAction.SALE_CANCEL,
            resource_type="sale",
        )
        added_obj = mock_db_session.add.call_args[0][0]
        assert added_obj.action == "sale_cancel"

    @pytest.mark.asyncio
    async def test_log_string_action_passed_directly(self, mock_db_session, service):
        await service.log(
            db=mock_db_session,
            actor_id=uuid.uuid4(),
            action="custom_action",
            resource_type="widget",
        )
        added_obj = mock_db_session.add.call_args[0][0]
        assert added_obj.action == "custom_action"

    @pytest.mark.asyncio
    @patch("app.middleware.request_context.get_client_ip", return_value="10.0.0.5")
    async def test_log_with_request_extracts_ip_and_user_agent(
        self, mock_get_ip, mock_db_session, service
    ):
        request = MagicMock()
        request.client.host = "192.168.1.1"
        request.headers.get.return_value = "Mozilla/5.0"

        await service.log(
            db=mock_db_session,
            actor_id=uuid.uuid4(),
            action="sale_cancel",
            resource_type="sale",
            request=request,
        )
        added_obj = mock_db_session.add.call_args[0][0]
        assert added_obj.ip_address == "10.0.0.5"
        assert added_obj.user_agent == "Mozilla/5.0"

    @pytest.mark.asyncio
    @patch("app.middleware.request_context.get_client_ip", return_value=None)
    async def test_log_with_request_falls_back_to_client_host(
        self, mock_get_ip, mock_db_session, service
    ):
        request = MagicMock()
        request.client.host = "172.16.0.1"
        request.headers.get.return_value = "curl/7.88"

        await service.log(
            db=mock_db_session,
            actor_id=uuid.uuid4(),
            action="config_change",
            resource_type="config",
            request=request,
        )
        added_obj = mock_db_session.add.call_args[0][0]
        assert added_obj.ip_address == "172.16.0.1"

    @pytest.mark.asyncio
    async def test_log_without_request_sets_none(self, mock_db_session, service):
        await service.log(
            db=mock_db_session,
            actor_id=uuid.uuid4(),
            action="record_delete",
            resource_type="product",
            request=None,
        )
        added_obj = mock_db_session.add.call_args[0][0]
        assert added_obj.ip_address is None
        assert added_obj.user_agent is None

    @pytest.mark.asyncio
    @patch("app.middleware.request_context.get_client_ip", return_value="10.0.0.1")
    async def test_log_truncates_long_user_agent(
        self, mock_get_ip, mock_db_session, service
    ):
        long_ua = "A" * 1000
        request = MagicMock()
        request.client.host = "1.2.3.4"
        request.headers.get.return_value = long_ua

        await service.log(
            db=mock_db_session,
            actor_id=uuid.uuid4(),
            action="sale_cancel",
            resource_type="sale",
            request=request,
        )
        added_obj = mock_db_session.add.call_args[0][0]
        assert len(added_obj.user_agent) == 500

    @pytest.mark.asyncio
    async def test_log_with_none_actor_id(self, mock_db_session, service):
        await service.log(
            db=mock_db_session,
            actor_id=None,
            action="config_change",
            resource_type="system",
        )
        added_obj = mock_db_session.add.call_args[0][0]
        assert added_obj.actor_id is None


# ============================================================================
# TEST: get_logs
# ============================================================================


class TestGetLogs:

    def _setup_execute(self, mock_db_session, count_val, logs_list):
        count_result = MagicMock()
        count_result.scalar.return_value = count_val

        scalars_mock = MagicMock()
        scalars_mock.all.return_value = logs_list
        logs_result = MagicMock()
        logs_result.scalars.return_value = scalars_mock

        mock_db_session.execute = AsyncMock(
            side_effect=[count_result, logs_result]
        )

    @pytest.mark.asyncio
    async def test_get_logs_no_filters(self, mock_db_session, service):
        logs = [_make_audit_log(), _make_audit_log()]
        self._setup_execute(mock_db_session, 2, logs)

        result_logs, total = await service.get_logs(db=mock_db_session)

        assert total == 2
        assert len(result_logs) == 2
        assert mock_db_session.execute.await_count == 2

    @pytest.mark.asyncio
    async def test_get_logs_all_filters(self, mock_db_session, service):
        actor_id = uuid.uuid4()
        school_id = uuid.uuid4()
        log = _make_audit_log(actor_id=actor_id, school_id=school_id)
        self._setup_execute(mock_db_session, 1, [log])

        result_logs, total = await service.get_logs(
            db=mock_db_session,
            action="sale_cancel",
            actor_id=actor_id,
            resource_type="sale",
            resource_id="some-id",
            school_id=school_id,
            date_from=date(2026, 1, 1),
            date_to=date(2026, 12, 31),
        )

        assert total == 1
        assert len(result_logs) == 1

    @pytest.mark.asyncio
    async def test_get_logs_pagination(self, mock_db_session, service):
        self._setup_execute(mock_db_session, 50, [_make_audit_log()])

        result_logs, total = await service.get_logs(
            db=mock_db_session,
            limit=10,
            offset=20,
        )

        assert total == 50
        assert len(result_logs) == 1

    @pytest.mark.asyncio
    async def test_get_logs_empty_result(self, mock_db_session, service):
        self._setup_execute(mock_db_session, 0, [])

        result_logs, total = await service.get_logs(db=mock_db_session)

        assert total == 0
        assert result_logs == []

    @pytest.mark.asyncio
    async def test_get_logs_with_date_from_only(self, mock_db_session, service):
        self._setup_execute(mock_db_session, 3, [_make_audit_log()] * 3)

        result_logs, total = await service.get_logs(
            db=mock_db_session,
            date_from=date(2026, 3, 1),
        )

        assert total == 3

    @pytest.mark.asyncio
    async def test_get_logs_with_date_to_only(self, mock_db_session, service):
        self._setup_execute(mock_db_session, 5, [_make_audit_log()] * 5)

        result_logs, total = await service.get_logs(
            db=mock_db_session,
            date_to=date(2026, 6, 30),
        )

        assert total == 5


# ============================================================================
# TEST: get_resource_history
# ============================================================================


class TestGetResourceHistory:

    @pytest.mark.asyncio
    async def test_returns_logs_for_resource(self, mock_db_session, service):
        logs = [_make_audit_log(), _make_audit_log()]
        scalars_mock = MagicMock()
        scalars_mock.all.return_value = logs
        mock_db_session.execute = AsyncMock(
            return_value=MagicMock(scalars=MagicMock(return_value=scalars_mock))
        )

        result = await service.get_resource_history(
            db=mock_db_session,
            resource_type="sale",
            resource_id="abc-123",
        )

        assert len(result) == 2
        mock_db_session.execute.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_returns_empty_for_no_history(self, mock_db_session, service):
        scalars_mock = MagicMock()
        scalars_mock.all.return_value = []
        mock_db_session.execute = AsyncMock(
            return_value=MagicMock(scalars=MagicMock(return_value=scalars_mock))
        )

        result = await service.get_resource_history(
            db=mock_db_session,
            resource_type="order",
            resource_id="nonexistent",
        )

        assert result == []


# ============================================================================
# TEST: get_actor_activity
# ============================================================================


class TestGetActorActivity:

    @pytest.mark.asyncio
    async def test_returns_activity_for_actor(self, mock_db_session, service):
        actor_id = uuid.uuid4()
        logs = [_make_audit_log(actor_id=actor_id) for _ in range(3)]
        scalars_mock = MagicMock()
        scalars_mock.all.return_value = logs
        mock_db_session.execute = AsyncMock(
            return_value=MagicMock(scalars=MagicMock(return_value=scalars_mock))
        )

        result = await service.get_actor_activity(
            db=mock_db_session,
            actor_id=actor_id,
        )

        assert len(result) == 3

    @pytest.mark.asyncio
    async def test_respects_limit_parameter(self, mock_db_session, service):
        actor_id = uuid.uuid4()
        logs = [_make_audit_log(actor_id=actor_id)]
        scalars_mock = MagicMock()
        scalars_mock.all.return_value = logs
        mock_db_session.execute = AsyncMock(
            return_value=MagicMock(scalars=MagicMock(return_value=scalars_mock))
        )

        result = await service.get_actor_activity(
            db=mock_db_session,
            actor_id=actor_id,
            limit=5,
        )

        assert len(result) == 1
        mock_db_session.execute.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_returns_empty_for_inactive_actor(self, mock_db_session, service):
        scalars_mock = MagicMock()
        scalars_mock.all.return_value = []
        mock_db_session.execute = AsyncMock(
            return_value=MagicMock(scalars=MagicMock(return_value=scalars_mock))
        )

        result = await service.get_actor_activity(
            db=mock_db_session,
            actor_id=uuid.uuid4(),
        )

        assert result == []
