"""
Tests for NotificationService.

Covers:
- create: happy path from NotificationCreate schema
- get_for_user: user-specific + broadcast, superuser, school filtering,
  unread_only, pagination, return shape
- get_unread_count: count + latest timestamp, no notifications
- mark_as_read: specific IDs, mark all, rowcount, access filtering
- notify_new_web_order: formatting, broadcast, type/reference
- notify_order_status_changed: status label mapping, unknown fallback
- notify_new_web_sale: formatting, type
- notify_pqrs_received: subject truncation
- notify_low_stock: message format
"""
import uuid
from datetime import datetime
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.models.notification import NotificationType, ReferenceType
from app.schemas.notification import NotificationCreate
from app.services.notification import NotificationService


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_db() -> AsyncMock:
    db = AsyncMock()
    db.add = MagicMock()
    return db


def _make_service(db: AsyncMock | None = None) -> NotificationService:
    return NotificationService(db or _make_db())


def _uid() -> uuid.UUID:
    return uuid.uuid4()


def _make_order(**overrides) -> MagicMock:
    defaults = {
        "id": _uid(),
        "code": "ORD-001",
        "total": Decimal("150000"),
        "school_id": _uid(),
    }
    defaults.update(overrides)
    order = MagicMock()
    for k, v in defaults.items():
        setattr(order, k, v)
    return order


def _make_sale(**overrides) -> MagicMock:
    defaults = {
        "id": _uid(),
        "code": "VTA-001",
        "total": Decimal("250000"),
        "school_id": _uid(),
    }
    defaults.update(overrides)
    sale = MagicMock()
    for k, v in defaults.items():
        setattr(sale, k, v)
    return sale


def _notification_from_data(data: NotificationCreate) -> MagicMock:
    """Simulate what Notification(**fields) would produce."""
    notif = MagicMock()
    notif.user_id = data.user_id
    notif.type = data.type
    notif.title = data.title
    notif.message = data.message
    notif.reference_type = data.reference_type
    notif.reference_id = data.reference_id
    notif.school_id = data.school_id
    notif.id = _uid()
    return notif


# ---------------------------------------------------------------------------
# create
# ---------------------------------------------------------------------------

class TestCreate:

    @pytest.mark.asyncio
    async def test_happy_path(self):
        db = _make_db()
        svc = _make_service(db)
        data = NotificationCreate(
            type=NotificationType.LOW_STOCK_ALERT,
            title="Stock bajo",
            message="Producto X tiene 2 unidades",
            user_id=None,
            school_id=_uid(),
        )

        result = await svc.create(data)

        db.add.assert_called_once()
        db.flush.assert_awaited_once()
        db.refresh.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_creates_with_all_fields(self):
        db = _make_db()
        svc = _make_service(db)
        ref_id = _uid()
        school_id = _uid()
        user_id = _uid()

        data = NotificationCreate(
            type=NotificationType.PQRS_RECEIVED,
            title="Nuevo PQRS",
            message="Asunto: prueba",
            reference_type=ReferenceType.CONTACT,
            reference_id=ref_id,
            school_id=school_id,
            user_id=user_id,
        )

        await svc.create(data)

        added_obj = db.add.call_args[0][0]
        assert added_obj.user_id == user_id
        assert added_obj.type == NotificationType.PQRS_RECEIVED
        assert added_obj.school_id == school_id
        assert added_obj.reference_id == ref_id


# ---------------------------------------------------------------------------
# get_for_user
# ---------------------------------------------------------------------------

class TestGetForUser:

    @pytest.mark.asyncio
    async def test_returns_tuple_of_three(self):
        db = _make_db()
        scalar_mock = MagicMock(return_value=5)
        scalars_mock = MagicMock()
        scalars_mock.all.return_value = []

        execute_results = [
            MagicMock(scalar=MagicMock(return_value=5)),
            MagicMock(scalar=MagicMock(return_value=2)),
            MagicMock(scalars=MagicMock(return_value=scalars_mock)),
        ]
        db.execute = AsyncMock(side_effect=execute_results)

        svc = _make_service(db)
        result = await svc.get_for_user(
            user_id=_uid(), school_ids=[_uid()], is_superuser=False,
        )

        assert isinstance(result, tuple)
        assert len(result) == 3
        notifications, total, unread = result
        assert total == 5
        assert unread == 2
        assert notifications == []

    @pytest.mark.asyncio
    async def test_superuser_gets_all(self):
        db = _make_db()
        execute_results = [
            MagicMock(scalar=MagicMock(return_value=10)),
            MagicMock(scalar=MagicMock(return_value=3)),
            MagicMock(scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[])))),
        ]
        db.execute = AsyncMock(side_effect=execute_results)

        svc = _make_service(db)
        _, total, unread = await svc.get_for_user(
            user_id=_uid(), school_ids=[], is_superuser=True,
        )

        assert total == 10
        assert unread == 3

    @pytest.mark.asyncio
    async def test_no_school_ids_non_superuser(self):
        db = _make_db()
        execute_results = [
            MagicMock(scalar=MagicMock(return_value=1)),
            MagicMock(scalar=MagicMock(return_value=0)),
            MagicMock(scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[])))),
        ]
        db.execute = AsyncMock(side_effect=execute_results)

        svc = _make_service(db)
        _, total, _ = await svc.get_for_user(
            user_id=_uid(), school_ids=[], is_superuser=False,
        )
        assert total == 1

    @pytest.mark.asyncio
    async def test_unread_only_filter(self):
        db = _make_db()
        execute_results = [
            MagicMock(scalar=MagicMock(return_value=5)),
            MagicMock(scalar=MagicMock(return_value=2)),
            MagicMock(scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[])))),
        ]
        db.execute = AsyncMock(side_effect=execute_results)

        svc = _make_service(db)
        await svc.get_for_user(
            user_id=_uid(), school_ids=[_uid()], unread_only=True,
        )

        assert db.execute.await_count == 3

    @pytest.mark.asyncio
    async def test_pagination_params_forwarded(self):
        db = _make_db()
        execute_results = [
            MagicMock(scalar=MagicMock(return_value=0)),
            MagicMock(scalar=MagicMock(return_value=0)),
            MagicMock(scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[])))),
        ]
        db.execute = AsyncMock(side_effect=execute_results)

        svc = _make_service(db)
        await svc.get_for_user(
            user_id=_uid(), school_ids=[], limit=10, offset=20,
        )
        assert db.execute.await_count == 3

    @pytest.mark.asyncio
    async def test_null_scalar_defaults_to_zero(self):
        db = _make_db()
        execute_results = [
            MagicMock(scalar=MagicMock(return_value=None)),
            MagicMock(scalar=MagicMock(return_value=None)),
            MagicMock(scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[])))),
        ]
        db.execute = AsyncMock(side_effect=execute_results)

        svc = _make_service(db)
        _, total, unread = await svc.get_for_user(
            user_id=_uid(), school_ids=[],
        )
        assert total == 0
        assert unread == 0


# ---------------------------------------------------------------------------
# get_unread_count
# ---------------------------------------------------------------------------

class TestGetUnreadCount:

    @pytest.mark.asyncio
    async def test_returns_count_and_timestamp(self):
        now = datetime(2026, 4, 14, 10, 0, 0)
        db = _make_db()
        db.execute = AsyncMock(side_effect=[
            MagicMock(scalar=MagicMock(return_value=7)),
            MagicMock(scalar=MagicMock(return_value=now)),
        ])

        svc = _make_service(db)
        count, last_at = await svc.get_unread_count(
            user_id=_uid(), school_ids=[_uid()],
        )
        assert count == 7
        assert last_at == now

    @pytest.mark.asyncio
    async def test_no_notifications_returns_zero_and_none(self):
        db = _make_db()
        db.execute = AsyncMock(side_effect=[
            MagicMock(scalar=MagicMock(return_value=None)),
            MagicMock(scalar=MagicMock(return_value=None)),
        ])

        svc = _make_service(db)
        count, last_at = await svc.get_unread_count(
            user_id=_uid(), school_ids=[],
        )
        assert count == 0
        assert last_at is None

    @pytest.mark.asyncio
    async def test_superuser_access(self):
        db = _make_db()
        db.execute = AsyncMock(side_effect=[
            MagicMock(scalar=MagicMock(return_value=3)),
            MagicMock(scalar=MagicMock(return_value=None)),
        ])

        svc = _make_service(db)
        count, _ = await svc.get_unread_count(
            user_id=_uid(), school_ids=[], is_superuser=True,
        )
        assert count == 3


# ---------------------------------------------------------------------------
# mark_as_read
# ---------------------------------------------------------------------------

class TestMarkAsRead:

    @pytest.mark.asyncio
    @patch("app.services.notification.get_colombia_now_naive")
    async def test_specific_ids(self, mock_now):
        fake_now = datetime(2026, 4, 14, 10, 0, 0)
        mock_now.return_value = fake_now

        db = _make_db()
        db.execute = AsyncMock(return_value=MagicMock(rowcount=2))

        svc = _make_service(db)
        ids = [_uid(), _uid()]
        result = await svc.mark_as_read(
            notification_ids=ids,
            user_id=_uid(),
            school_ids=[_uid()],
        )

        assert result == 2
        db.flush.assert_awaited_once()

    @pytest.mark.asyncio
    @patch("app.services.notification.get_colombia_now_naive")
    async def test_mark_all_when_ids_none(self, mock_now):
        mock_now.return_value = datetime(2026, 4, 14)

        db = _make_db()
        db.execute = AsyncMock(return_value=MagicMock(rowcount=5))

        svc = _make_service(db)
        result = await svc.mark_as_read(
            notification_ids=None,
            user_id=_uid(),
            school_ids=[_uid()],
        )
        assert result == 5

    @pytest.mark.asyncio
    @patch("app.services.notification.get_colombia_now_naive")
    async def test_returns_zero_when_nothing_to_mark(self, mock_now):
        mock_now.return_value = datetime(2026, 4, 14)

        db = _make_db()
        db.execute = AsyncMock(return_value=MagicMock(rowcount=0))

        svc = _make_service(db)
        result = await svc.mark_as_read(
            notification_ids=[_uid()],
            user_id=_uid(),
            school_ids=[],
        )
        assert result == 0

    @pytest.mark.asyncio
    @patch("app.services.notification.get_colombia_now_naive")
    async def test_superuser_mark_all(self, mock_now):
        mock_now.return_value = datetime(2026, 4, 14)

        db = _make_db()
        db.execute = AsyncMock(return_value=MagicMock(rowcount=10))

        svc = _make_service(db)
        result = await svc.mark_as_read(
            notification_ids=None,
            user_id=_uid(),
            school_ids=[],
            is_superuser=True,
        )
        assert result == 10


# ---------------------------------------------------------------------------
# notify_new_web_order
# ---------------------------------------------------------------------------

class TestNotifyNewWebOrder:

    @pytest.mark.asyncio
    async def test_formats_total_with_separator(self):
        db = _make_db()
        svc = _make_service(db)
        order = _make_order(total=Decimal("1500000"))

        await svc.notify_new_web_order(order)

        added = db.add.call_args[0][0]
        assert "$1,500,000" in added.message

    @pytest.mark.asyncio
    async def test_zero_total_fallback(self):
        db = _make_db()
        svc = _make_service(db)
        order = _make_order(total=None)

        await svc.notify_new_web_order(order)

        added = db.add.call_args[0][0]
        assert "$0" in added.message

    @pytest.mark.asyncio
    async def test_broadcast_user_id_none(self):
        db = _make_db()
        svc = _make_service(db)
        order = _make_order()

        await svc.notify_new_web_order(order)

        added = db.add.call_args[0][0]
        assert added.user_id is None

    @pytest.mark.asyncio
    async def test_correct_type_and_reference(self):
        db = _make_db()
        svc = _make_service(db)
        order = _make_order()

        await svc.notify_new_web_order(order)

        added = db.add.call_args[0][0]
        assert added.type == NotificationType.NEW_WEB_ORDER
        assert added.reference_type == ReferenceType.ORDER
        assert added.reference_id == order.id

    @pytest.mark.asyncio
    async def test_includes_order_code_in_message(self):
        db = _make_db()
        svc = _make_service(db)
        order = _make_order(code="ORD-999")

        await svc.notify_new_web_order(order)

        added = db.add.call_args[0][0]
        assert "ORD-999" in added.message


# ---------------------------------------------------------------------------
# notify_order_status_changed
# ---------------------------------------------------------------------------

class TestNotifyOrderStatusChanged:

    @pytest.mark.asyncio
    async def test_known_status_labels(self):
        db = _make_db()
        svc = _make_service(db)
        order = _make_order()

        await svc.notify_order_status_changed(order, "pending", "ready")

        added = db.add.call_args[0][0]
        assert "Pendiente" in added.message
        assert "Listo" in added.message

    @pytest.mark.asyncio
    async def test_unknown_status_uses_raw_value(self):
        db = _make_db()
        svc = _make_service(db)
        order = _make_order()

        await svc.notify_order_status_changed(order, "custom_old", "custom_new")

        added = db.add.call_args[0][0]
        assert "custom_old" in added.message
        assert "custom_new" in added.message

    @pytest.mark.asyncio
    async def test_correct_type(self):
        db = _make_db()
        svc = _make_service(db)
        order = _make_order()

        await svc.notify_order_status_changed(order, "pending", "delivered")

        added = db.add.call_args[0][0]
        assert added.type == NotificationType.ORDER_STATUS_CHANGED

    @pytest.mark.asyncio
    async def test_title_includes_order_code(self):
        db = _make_db()
        svc = _make_service(db)
        order = _make_order(code="ORD-555")

        await svc.notify_order_status_changed(order, "pending", "cancelled")

        added = db.add.call_args[0][0]
        assert "ORD-555" in added.title


# ---------------------------------------------------------------------------
# notify_new_web_sale
# ---------------------------------------------------------------------------

class TestNotifyNewWebSale:

    @pytest.mark.asyncio
    async def test_formats_total(self):
        db = _make_db()
        svc = _make_service(db)
        sale = _make_sale(total=Decimal("350000"))

        await svc.notify_new_web_sale(sale)

        added = db.add.call_args[0][0]
        assert "$350,000" in added.message

    @pytest.mark.asyncio
    async def test_correct_type_and_reference(self):
        db = _make_db()
        svc = _make_service(db)
        sale = _make_sale()

        await svc.notify_new_web_sale(sale)

        added = db.add.call_args[0][0]
        assert added.type == NotificationType.NEW_WEB_SALE
        assert added.reference_type == ReferenceType.SALE
        assert added.reference_id == sale.id

    @pytest.mark.asyncio
    async def test_broadcast(self):
        db = _make_db()
        svc = _make_service(db)
        sale = _make_sale()

        await svc.notify_new_web_sale(sale)

        added = db.add.call_args[0][0]
        assert added.user_id is None


# ---------------------------------------------------------------------------
# notify_pqrs_received
# ---------------------------------------------------------------------------

class TestNotifyPqrsReceived:

    @pytest.mark.asyncio
    async def test_short_subject_not_truncated(self):
        db = _make_db()
        svc = _make_service(db)
        subject = "Consulta sobre talla"

        await svc.notify_pqrs_received(_uid(), subject, _uid())

        added = db.add.call_args[0][0]
        assert subject in added.message

    @pytest.mark.asyncio
    async def test_long_subject_truncated_at_100(self):
        db = _make_db()
        svc = _make_service(db)
        subject = "A" * 150

        await svc.notify_pqrs_received(_uid(), subject, _uid())

        added = db.add.call_args[0][0]
        assert "A" * 100 in added.message
        assert "A" * 101 not in added.message

    @pytest.mark.asyncio
    async def test_correct_type_and_reference(self):
        db = _make_db()
        svc = _make_service(db)
        contact_id = _uid()

        await svc.notify_pqrs_received(contact_id, "Test", _uid())

        added = db.add.call_args[0][0]
        assert added.type == NotificationType.PQRS_RECEIVED
        assert added.reference_type == ReferenceType.CONTACT
        assert added.reference_id == contact_id


# ---------------------------------------------------------------------------
# notify_low_stock
# ---------------------------------------------------------------------------

class TestNotifyLowStock:

    @pytest.mark.asyncio
    async def test_message_format(self):
        db = _make_db()
        svc = _make_service(db)
        product_id = _uid()
        school_id = _uid()

        await svc.notify_low_stock(
            product_id=product_id,
            product_code="UNI-001",
            product_name="Camisa Blanca",
            current_quantity=3,
            min_stock_alert=10,
            school_id=school_id,
        )

        added = db.add.call_args[0][0]
        assert "Camisa Blanca" in added.message
        assert "3" in added.message
        assert "10" in added.message

    @pytest.mark.asyncio
    async def test_title_includes_product_code(self):
        db = _make_db()
        svc = _make_service(db)

        await svc.notify_low_stock(
            product_id=_uid(),
            product_code="UNI-002",
            product_name="Falda Azul",
            current_quantity=1,
            min_stock_alert=5,
            school_id=_uid(),
        )

        added = db.add.call_args[0][0]
        assert "UNI-002" in added.title

    @pytest.mark.asyncio
    async def test_correct_type_and_reference(self):
        db = _make_db()
        svc = _make_service(db)
        product_id = _uid()
        school_id = _uid()

        await svc.notify_low_stock(
            product_id=product_id,
            product_code="P-001",
            product_name="Test",
            current_quantity=0,
            min_stock_alert=5,
            school_id=school_id,
        )

        added = db.add.call_args[0][0]
        assert added.type == NotificationType.LOW_STOCK_ALERT
        assert added.reference_type == ReferenceType.PRODUCT
        assert added.reference_id == product_id
        assert added.school_id == school_id
