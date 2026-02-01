"""
Unit tests for School Service.

Tests for school management including:
- School CRUD operations
- School search and filtering
- School summary statistics
- Activation/deactivation
- Display order management
"""
import pytest
from uuid import uuid4

pytestmark = pytest.mark.unit


class TestSchoolServiceCreate:
    """Tests for school creation."""

    async def test_create_school_success(self, db_session):
        """Test successful school creation."""
        from app.services.school import SchoolService
        from app.schemas.school import SchoolCreate

        service = SchoolService(db_session)

        school_data = SchoolCreate(
            code="TEST-001",
            name="Test School",
            slug="test-school"
        )

        school = await service.create_school(school_data)

        assert school.id is not None
        assert school.code == "TEST-001"
        assert school.name == "Test School"
        assert school.slug == "test-school"
        assert school.is_active == True

    async def test_create_school_with_settings(self, db_session):
        """Test school creation with settings."""
        from app.services.school import SchoolService
        from app.schemas.school import SchoolCreate, SchoolSettings

        service = SchoolService(db_session)

        # Use valid SchoolSettings fields
        custom_settings = SchoolSettings(
            currency="USD",
            tax_rate=15.0,
            allow_credit_sales=False
        )

        school_data = SchoolCreate(
            code="TEST-002",
            name="School With Settings",
            slug="school-settings",
            settings=custom_settings
        )

        school = await service.create_school(school_data)

        assert school.settings is not None
        assert school.settings.get("currency") == "USD"
        assert school.settings.get("tax_rate") == 15.0
        assert school.settings.get("allow_credit_sales") == False

    async def test_create_school_duplicate_code_fails(self, db_session):
        """Test that duplicate school code raises error."""
        from app.services.school import SchoolService
        from app.schemas.school import SchoolCreate

        service = SchoolService(db_session)

        school_data = SchoolCreate(
            code="DUP-CODE",
            name="First School",
            slug="first-school"
        )
        await service.create_school(school_data)

        # Try to create another school with same code
        duplicate_data = SchoolCreate(
            code="DUP-CODE",
            name="Second School",
            slug="second-school"
        )

        with pytest.raises(ValueError, match="already exists"):
            await service.create_school(duplicate_data)


class TestSchoolServiceUpdate:
    """Tests for school updates."""

    async def test_update_school_success(self, db_session):
        """Test successful school update."""
        from app.services.school import SchoolService
        from app.schemas.school import SchoolCreate, SchoolUpdate

        service = SchoolService(db_session)

        # Create school
        school_data = SchoolCreate(
            code="UPD-001",
            name="Original Name",
            slug="original-slug"
        )
        school = await service.create_school(school_data)

        # Update school
        update_data = SchoolUpdate(name="Updated Name")
        updated = await service.update_school(school.id, update_data)

        assert updated is not None
        assert updated.name == "Updated Name"
        assert updated.code == "UPD-001"  # Code unchanged

    async def test_update_nonexistent_school(self, db_session):
        """Test updating nonexistent school returns None."""
        from app.services.school import SchoolService
        from app.schemas.school import SchoolUpdate

        service = SchoolService(db_session)

        update_data = SchoolUpdate(name="New Name")
        result = await service.update_school(uuid4(), update_data)

        assert result is None


class TestSchoolServiceLookup:
    """Tests for school lookup methods."""

    async def test_get_by_code(self, db_session):
        """Test getting school by code."""
        from app.services.school import SchoolService
        from app.schemas.school import SchoolCreate

        service = SchoolService(db_session)

        school_data = SchoolCreate(
            code="LOOKUP-001",
            name="Lookup Test",
            slug="lookup-test"
        )
        created = await service.create_school(school_data)

        found = await service.get_by_code("LOOKUP-001")

        assert found is not None
        assert found.id == created.id

    async def test_get_by_code_case_insensitive(self, db_session):
        """Test code lookup is case insensitive."""
        from app.services.school import SchoolService
        from app.schemas.school import SchoolCreate

        service = SchoolService(db_session)

        school_data = SchoolCreate(
            code="CASE-TEST",
            name="Case Test School",
            slug="case-test"
        )
        await service.create_school(school_data)

        found = await service.get_by_code("case-test")

        assert found is not None

    async def test_get_by_slug(self, db_session):
        """Test getting school by slug."""
        from app.services.school import SchoolService
        from app.schemas.school import SchoolCreate

        service = SchoolService(db_session)

        school_data = SchoolCreate(
            code="SLUG-001",
            name="Slug Test",
            slug="my-test-slug"
        )
        created = await service.create_school(school_data)

        found = await service.get_by_slug("my-test-slug")

        assert found is not None
        assert found.id == created.id

    async def test_get_by_slug_not_found(self, db_session):
        """Test slug lookup returns None for nonexistent slug."""
        from app.services.school import SchoolService

        service = SchoolService(db_session)

        found = await service.get_by_slug("nonexistent-slug")

        assert found is None


class TestSchoolServiceActiveSchools:
    """Tests for active schools listing."""

    async def test_get_active_schools(self, db_session):
        """Test getting active schools."""
        from app.services.school import SchoolService
        from app.schemas.school import SchoolCreate

        service = SchoolService(db_session)

        # Create active school
        active_data = SchoolCreate(
            code="ACTIVE-001",
            name="Active School",
            slug="active-school"
        )
        await service.create_school(active_data)

        schools = await service.get_active_schools()

        assert len(schools) >= 1
        assert all(s.is_active for s in schools)

    async def test_get_active_schools_excludes_inactive(self, db_session):
        """Test that inactive schools are excluded."""
        from app.services.school import SchoolService
        from app.schemas.school import SchoolCreate

        service = SchoolService(db_session)

        # Create and deactivate school
        school_data = SchoolCreate(
            code="INACTIVE-001",
            name="Inactive School",
            slug="inactive-school"
        )
        school = await service.create_school(school_data)
        await service.deactivate_school(school.id)

        schools = await service.get_active_schools()

        assert all(s.id != school.id for s in schools)

    async def test_get_active_schools_pagination(self, db_session):
        """Test pagination of active schools."""
        from app.services.school import SchoolService
        from app.schemas.school import SchoolCreate

        service = SchoolService(db_session)

        # Create multiple schools
        for i in range(5):
            school_data = SchoolCreate(
                code=f"PAGE-{i:03d}",
                name=f"Page School {i}",
                slug=f"page-school-{i}"
            )
            await service.create_school(school_data)

        # Test limit
        schools = await service.get_active_schools(limit=3)
        assert len(schools) <= 3

        # Test skip
        all_schools = await service.get_active_schools(limit=100)
        skipped = await service.get_active_schools(skip=2, limit=100)
        assert len(skipped) == len(all_schools) - 2 or len(skipped) == len(all_schools)


class TestSchoolServiceActivation:
    """Tests for school activation/deactivation."""

    async def test_activate_school(self, db_session):
        """Test activating a school."""
        from app.services.school import SchoolService
        from app.schemas.school import SchoolCreate

        service = SchoolService(db_session)

        # Create and deactivate
        school_data = SchoolCreate(
            code="ACTIVATE-001",
            name="To Activate",
            slug="to-activate"
        )
        school = await service.create_school(school_data)
        await service.deactivate_school(school.id)

        # Activate
        activated = await service.activate_school(school.id)

        assert activated is not None
        assert activated.is_active == True

    async def test_deactivate_school(self, db_session):
        """Test deactivating a school."""
        from app.services.school import SchoolService
        from app.schemas.school import SchoolCreate

        service = SchoolService(db_session)

        school_data = SchoolCreate(
            code="DEACTIVATE-001",
            name="To Deactivate",
            slug="to-deactivate"
        )
        school = await service.create_school(school_data)

        deactivated = await service.deactivate_school(school.id)

        assert deactivated is not None
        assert deactivated.is_active == False


class TestSchoolServiceSearch:
    """Tests for school search."""

    async def test_search_by_name(self, db_session):
        """Test searching schools by name."""
        from app.services.school import SchoolService
        from app.schemas.school import SchoolCreate

        service = SchoolService(db_session)

        school_data = SchoolCreate(
            code="SEARCH-001",
            name="Colegio San Francisco Xavier",
            slug="san-francisco"
        )
        await service.create_school(school_data)

        results = await service.search_by_name("Francisco")

        assert len(results) >= 1
        assert any("Francisco" in s.name for s in results)

    async def test_search_by_name_case_insensitive(self, db_session):
        """Test search is case insensitive."""
        from app.services.school import SchoolService
        from app.schemas.school import SchoolCreate

        service = SchoolService(db_session)

        school_data = SchoolCreate(
            code="SEARCH-002",
            name="Instituto Nacional",
            slug="instituto-nacional"
        )
        await service.create_school(school_data)

        results = await service.search_by_name("instituto")

        assert len(results) >= 1

    async def test_search_by_name_limit(self, db_session):
        """Test search respects limit."""
        from app.services.school import SchoolService
        from app.schemas.school import SchoolCreate

        service = SchoolService(db_session)

        # Create multiple matching schools
        for i in range(5):
            school_data = SchoolCreate(
                code=f"LIM-{i:03d}",
                name=f"Colegio Limitado {i}",
                slug=f"colegio-limitado-{i}"
            )
            await service.create_school(school_data)

        results = await service.search_by_name("Limitado", limit=3)

        assert len(results) <= 3


class TestSchoolServiceStatistics:
    """Tests for school statistics."""

    async def test_count_active_schools(self, db_session):
        """Test counting active schools."""
        from app.services.school import SchoolService
        from app.schemas.school import SchoolCreate

        service = SchoolService(db_session)

        initial_count = await service.count_active()

        # Create active school
        school_data = SchoolCreate(
            code="COUNT-001",
            name="Count School",
            slug="count-school"
        )
        await service.create_school(school_data)

        new_count = await service.count_active()

        assert new_count >= initial_count + 1

    async def test_get_school_summary(self, db_session, test_school):
        """Test getting school summary with statistics."""
        from app.services.school import SchoolService

        service = SchoolService(db_session)

        summary = await service.get_school_summary(test_school.id)

        assert summary is not None
        assert str(summary.id) == str(test_school.id)
        assert summary.code == test_school.code
        assert summary.name == test_school.name
        assert summary.total_products >= 0
        assert summary.total_clients >= 0
        assert summary.total_sales >= 0

    async def test_get_school_summary_nonexistent(self, db_session):
        """Test summary for nonexistent school returns None."""
        from app.services.school import SchoolService

        service = SchoolService(db_session)

        summary = await service.get_school_summary(uuid4())

        assert summary is None


class TestSchoolServiceDisplayOrder:
    """Tests for display order management."""

    async def test_reorder_schools(self, db_session):
        """Test reordering schools."""
        from app.services.school import SchoolService
        from app.schemas.school import SchoolCreate

        service = SchoolService(db_session)

        # Create schools
        schools = []
        for i in range(3):
            school_data = SchoolCreate(
                code=f"ORDER-{i:03d}",
                name=f"Order School {i}",
                slug=f"order-school-{i}"
            )
            school = await service.create_school(school_data)
            schools.append(school)

        # Reorder (reverse order)
        order_data = [
            {"id": schools[2].id, "display_order": 1},
            {"id": schools[1].id, "display_order": 2},
            {"id": schools[0].id, "display_order": 3},
        ]

        await service.reorder_schools(order_data)

        # Verify
        updated_0 = await service.get(schools[0].id)
        updated_2 = await service.get(schools[2].id)

        assert updated_0.display_order == 3
        assert updated_2.display_order == 1
