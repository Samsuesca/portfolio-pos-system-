"""Integration tests del audit trail de costos: el flujo de upsert_breakdown
y bulk_apply_component debe generar entries en cost_change_log de forma
consistente, y get_product_history debe devolverlas.
"""
from decimal import Decimal
from uuid import uuid4

import pytest
from sqlalchemy import select

from app.models.cost_change_log import CostChangeLog, CostChangeType
from app.models.product import CostComponentTemplate
from app.services.cost_change_log import CostChangeLogService
from app.services.cost_component import CostComponentService


@pytest.fixture
async def cost_template(db_session, test_garment_type) -> CostComponentTemplate:
    """Template de costo (fabric) para el garment del test_product."""
    tpl = CostComponentTemplate(
        id=str(uuid4()),
        garment_type_id=test_garment_type.id,
        name="Tela",
        code="fabric",
        is_variable=True,
        display_order=1,
        is_active=True,
    )
    db_session.add(tpl)
    await db_session.flush()
    return tpl


class TestUpsertBreakdownEmitsLogs:
    async def test_create_emits_created_log(
        self, db_session, test_user, test_product, cost_template,
    ):
        # Arrange
        service = CostComponentService(db_session)
        # Act
        await service.upsert_breakdown(
            test_product.id,
            [{"template_id": str(cost_template.id), "amount": 5000, "notes": None}],
            changed_by=test_user.id,
            reason="test create",
        )
        # Assert
        logs = (await db_session.execute(
            select(CostChangeLog).where(CostChangeLog.product_id == test_product.id)
        )).scalars().all()
        assert len(logs) == 1
        assert logs[0].change_type == CostChangeType.CREATED
        assert logs[0].amount_before is None
        assert logs[0].amount_after == Decimal("5000")
        assert str(logs[0].changed_by) == str(test_user.id)
        assert logs[0].reason == "test create"

    async def test_update_emits_updated_log_with_before_after(
        self, db_session, test_user, test_product, cost_template,
    ):
        service = CostComponentService(db_session)
        await service.upsert_breakdown(
            test_product.id,
            [{"template_id": str(cost_template.id), "amount": 5000, "notes": None}],
            changed_by=test_user.id,
        )
        # Act — cambio de amount
        await service.upsert_breakdown(
            test_product.id,
            [{"template_id": str(cost_template.id), "amount": 7500, "notes": None}],
            changed_by=test_user.id,
            reason="bump",
        )
        # Assert
        logs = (await db_session.execute(
            select(CostChangeLog)
            .where(CostChangeLog.product_id == test_product.id)
            .order_by(CostChangeLog.created_at)
        )).scalars().all()
        assert len(logs) == 2
        assert logs[1].change_type == CostChangeType.UPDATED
        assert logs[1].amount_before == Decimal("5000")
        assert logs[1].amount_after == Decimal("7500")
        assert logs[1].reason == "bump"

    async def test_idempotent_save_does_not_log(
        self, db_session, test_user, test_product, cost_template,
    ):
        service = CostComponentService(db_session)
        payload = [{"template_id": str(cost_template.id), "amount": 5000, "notes": None}]
        await service.upsert_breakdown(test_product.id, payload, changed_by=test_user.id)
        # Act — mismos valores otra vez
        await service.upsert_breakdown(test_product.id, payload, changed_by=test_user.id)
        # Assert — solo 1 log (el primero)
        count = (await db_session.execute(
            select(CostChangeLog).where(CostChangeLog.product_id == test_product.id)
        )).scalars().all()
        assert len(count) == 1


class TestHistoryService:
    async def test_returns_logs_newest_first(
        self, db_session, test_user, test_product, cost_template,
    ):
        service = CostComponentService(db_session)
        for amount in (1000, 2000, 3000):
            await service.upsert_breakdown(
                test_product.id,
                [{"template_id": str(cost_template.id), "amount": amount, "notes": None}],
                changed_by=test_user.id,
            )
        # Act
        log_service = CostChangeLogService(db_session)
        logs, total = await log_service.get_product_history(test_product.id)
        # Assert
        assert total == 3
        assert [l.amount_after for l in logs] == [Decimal("3000"), Decimal("2000"), Decimal("1000")]
