"""
Integration tests for the per-school catalog order service (issue #8).

Exercises GarmentTypeService.reorder_school_catalog / get_school_catalog_order
against a real DB session: upsert idempotency, visibility validation (own +
global types) and rejection of types not visible to the school.
"""
import pytest
from uuid import uuid4

from app.models.product import GarmentType, SchoolGarmentTypeOrder
from app.models.school import School
from app.services.product import GarmentTypeService

pytestmark = pytest.mark.integration


async def _make_garment_type(db_session, school_id, name):
    # id as a UUID object (column is UUID(as_uuid=True)) so it matches the UUIDs
    # the service reads back — mirrors the route, where Pydantic parses the body
    # into list[UUID].
    gt = GarmentType(
        id=uuid4(),
        school_id=school_id,
        name=name,
        category="uniforme_diario",
        is_active=True,
    )
    db_session.add(gt)
    await db_session.flush()
    return gt


async def _make_school(db_session):
    unique = uuid4().hex[:8]
    school = School(
        id=str(uuid4()),
        code=f"OTH-{unique}",
        name=f"Other School {unique}",
        slug=f"other-school-{unique}",
        is_active=True,
    )
    db_session.add(school)
    await db_session.flush()
    return school


class TestReorderSchoolCatalog:
    async def test_persists_order_for_own_and_global_types(
        self, db_session, test_school
    ):
        service = GarmentTypeService(db_session)
        own = await _make_garment_type(db_session, test_school.id, f"Camisa {uuid4().hex[:6]}")
        glob = await _make_garment_type(db_session, None, f"Medias {uuid4().hex[:6]}")

        result = await service.reorder_school_catalog(
            test_school.id, [glob.id, own.id]
        )

        assert [str(e.garment_type_id) for e in result] == [str(glob.id), str(own.id)]
        assert [e.display_order for e in result] == [0, 1]

    async def test_get_order_reflects_persisted(self, db_session, test_school):
        service = GarmentTypeService(db_session)
        a = await _make_garment_type(db_session, test_school.id, f"A {uuid4().hex[:6]}")
        b = await _make_garment_type(db_session, test_school.id, f"B {uuid4().hex[:6]}")

        await service.reorder_school_catalog(test_school.id, [a.id, b.id])
        order = await service.get_school_catalog_order(test_school.id)

        assert [str(e.garment_type_id) for e in order] == [str(a.id), str(b.id)]

    async def test_reorder_is_idempotent_upsert(self, db_session, test_school):
        service = GarmentTypeService(db_session)
        a = await _make_garment_type(db_session, test_school.id, f"A {uuid4().hex[:6]}")
        b = await _make_garment_type(db_session, test_school.id, f"B {uuid4().hex[:6]}")

        await service.reorder_school_catalog(test_school.id, [a.id, b.id])
        # Reverse the order — must update existing rows, not create duplicates.
        await service.reorder_school_catalog(test_school.id, [b.id, a.id])

        order = await service.get_school_catalog_order(test_school.id)
        assert [str(e.garment_type_id) for e in order] == [str(b.id), str(a.id)]

        rows = (
            await db_session.execute(
                SchoolGarmentTypeOrder.__table__.select().where(
                    SchoolGarmentTypeOrder.school_id == test_school.id
                )
            )
        ).fetchall()
        assert len(rows) == 2  # upsert, no duplicate rows

    async def test_rejects_garment_type_not_visible(self, db_session, test_school):
        service = GarmentTypeService(db_session)
        other_school = await _make_school(db_session)
        foreign = await _make_garment_type(
            db_session, other_school.id, f"Ajena {uuid4().hex[:6]}"
        )

        with pytest.raises(ValueError):
            await service.reorder_school_catalog(test_school.id, [foreign.id])
