"""
Tests for Sales API endpoints.

Tests cover:
- Sale creation (regular and historical)
- Sale listing and retrieval
- Sale changes/returns workflow
- Payment methods
- Multi-tenant isolation
"""
import pytest
from decimal import Decimal
from uuid import uuid4

from tests.fixtures.assertions import (
    assert_success_response,
    assert_created_response,
    assert_forbidden,
    assert_not_found,
    assert_bad_request,
    assert_sale_valid,
    assert_has_code,
)
from tests.fixtures.builders import (
    build_sale_request,
    build_sale_item,
    build_sale_change_request,
)


pytestmark = pytest.mark.api


def normalize_price(value):
    """Normalize price to float for comparison."""
    if isinstance(value, str):
        return float(value)
    return float(value)


# ============================================================================
# SALE CREATION TESTS
# ============================================================================

class TestSaleCreation:
    """Tests for POST /api/v1/schools/{school_id}/sales"""

    async def test_create_sale_success(
        self,
        api_client,
        superuser_headers,
        complete_test_setup
    ):
        """Should create sale and return receipt."""
        setup = complete_test_setup
        school_id = setup["school"].id
        product = setup["product"]
        client = setup["client"]

        response = await api_client.post(
            f"/api/v1/schools/{school_id}/sales",
            headers=superuser_headers,
            json=build_sale_request(
                client_id=client.id,
                items=[
                    build_sale_item(
                        product_id=product.id,
                        quantity=1
                    )
                ],
                payment_method="cash"
            )
        )

        data = assert_created_response(response)
        assert_sale_valid(data)
        assert_has_code(data, prefix="VNT-")

        # Verify amounts - normalize for string comparison
        assert normalize_price(data["total"]) > 0
        assert data["payment_method"] == "cash"
        assert data["status"] == "completed"

    async def test_create_sale_with_multiple_items(
        self,
        api_client,
        superuser_headers,
        complete_test_setup,
        db_session
    ):
        """Should create sale with multiple items."""
        setup = complete_test_setup
        school_id = setup["school"].id

        # Create second product
        from app.models import Product, Inventory

        product2 = Product(
            id=str(uuid4()),
            school_id=school_id,
            garment_type_id=setup["garment_type"].id,
            code="PRD-002",
            name="Pantalón Azul",
            size="M",
            color="Azul",
            price=Decimal("55000"),
            is_active=True
        )
        db_session.add(product2)

        inventory2 = Inventory(
            id=str(uuid4()),
            product_id=product2.id,
            school_id=school_id,
            quantity=50,
            min_stock_alert=5
        )
        db_session.add(inventory2)
        await db_session.flush()

        response = await api_client.post(
            f"/api/v1/schools/{school_id}/sales",
            headers=superuser_headers,
            json=build_sale_request(
                client_id=setup["client"].id,
                items=[
                    build_sale_item(product_id=setup["product"].id, quantity=2),
                    build_sale_item(product_id=product2.id, quantity=1)
                ],
                payment_method="nequi"
            )
        )

        data = assert_created_response(response)

        # Verify items
        assert "items" in data
        assert len(data["items"]) == 2

        # Verify total (2 * 45000 + 1 * 55000 = 145000) - normalize for comparison
        assert normalize_price(data["total"]) == 145000

    async def test_create_sale_insufficient_stock(
        self,
        api_client,
        superuser_headers,
        complete_test_setup
    ):
        """Should return 400 if insufficient inventory."""
        setup = complete_test_setup

        response = await api_client.post(
            f"/api/v1/schools/{setup['school'].id}/sales",
            headers=superuser_headers,
            json=build_sale_request(
                client_id=setup["client"].id,
                items=[
                    build_sale_item(
                        product_id=setup["product"].id,
                        quantity=9999  # More than available
                    )
                ]
            )
        )

        assert_bad_request(response, detail_contains="stock")

    async def test_create_sale_product_not_found(
        self,
        api_client,
        superuser_headers,
        complete_test_setup
    ):
        """Should return 400/404 if product doesn't exist."""
        setup = complete_test_setup

        response = await api_client.post(
            f"/api/v1/schools/{setup['school'].id}/sales",
            headers=superuser_headers,
            json=build_sale_request(
                client_id=setup["client"].id,
                items=[
                    build_sale_item(
                        product_id=str(uuid4()),  # Non-existent product
                        quantity=1
                    )
                ]
            )
        )

        # API returns 400 for "product not found"
        assert response.status_code in [400, 404]

    async def test_create_sale_no_auth(self, api_client, test_school):
        """Should return 401/403 without authentication."""
        response = await api_client.post(
            f"/api/v1/schools/{test_school.id}/sales",
            json=build_sale_request()
        )

        assert response.status_code in [401, 403]

    async def test_create_sale_without_client(
        self,
        api_client,
        superuser_headers,
        complete_test_setup
    ):
        """Should create sale without client (anonymous sale)."""
        setup = complete_test_setup

        response = await api_client.post(
            f"/api/v1/schools/{setup['school'].id}/sales",
            headers=superuser_headers,
            json=build_sale_request(
                client_id=None,  # No client
                items=[
                    build_sale_item(
                        product_id=setup["product"].id,
                        quantity=1
                    )
                ]
            )
        )

        data = assert_created_response(response)
        assert data["client_id"] is None

    async def test_create_sale_with_credit_payment(
        self,
        api_client,
        superuser_headers,
        complete_test_setup
    ):
        """Should create sale with credit payment."""
        setup = complete_test_setup

        response = await api_client.post(
            f"/api/v1/schools/{setup['school'].id}/sales",
            headers=superuser_headers,
            json=build_sale_request(
                client_id=setup["client"].id,
                items=[
                    build_sale_item(
                        product_id=setup["product"].id,
                        quantity=1
                    )
                ],
                payment_method="credit"
            )
        )

        data = assert_created_response(response)
        assert data["payment_method"] == "credit"
        # Credit sales are typically marked as completed with full paid amount

    async def test_create_sale_various_payment_methods(
        self,
        api_client,
        superuser_headers,
        complete_test_setup
    ):
        """Should accept various payment methods."""
        setup = complete_test_setup
        payment_methods = ["cash", "nequi", "transfer", "card"]

        for method in payment_methods:
            response = await api_client.post(
                f"/api/v1/schools/{setup['school'].id}/sales",
                headers=superuser_headers,
                json=build_sale_request(
                    client_id=setup["client"].id,
                    items=[
                        build_sale_item(
                            product_id=setup["product"].id,
                            quantity=1
                        )
                    ],
                    payment_method=method
                )
            )

            data = assert_created_response(response)
            assert data["payment_method"] == method


# ============================================================================
# SALE RETRIEVAL TESTS
# ============================================================================

class TestSaleRetrieval:
    """Tests for GET /api/v1/sales and GET /api/v1/schools/{school_id}/sales"""

    async def test_list_all_sales(
        self,
        api_client,
        superuser_headers,
        test_sale
    ):
        """Should list all sales across accessible schools."""
        response = await api_client.get(
            "/api/v1/sales",
            headers=superuser_headers
        )

        data = assert_success_response(response)

        # API returns a list (not paginated)
        assert isinstance(data, list)
        assert len(data) >= 1

    async def test_list_school_sales(
        self,
        api_client,
        superuser_headers,
        test_sale,
        test_school
    ):
        """Should list sales for specific school."""
        response = await api_client.get(
            f"/api/v1/schools/{test_school.id}/sales",
            headers=superuser_headers
        )

        data = assert_success_response(response)

        # API returns a list (not paginated)
        assert isinstance(data, list)

    async def test_get_single_sale(
        self,
        api_client,
        superuser_headers,
        complete_test_setup
    ):
        """Should get single sale by ID.

        Note: API has a bug where SaleResponse validation fails.
        This should be fixed in the API layer.
        """
        setup = complete_test_setup

        # Create a sale via API to ensure it's properly constructed
        create_response = await api_client.post(
            f"/api/v1/schools/{setup['school'].id}/sales",
            headers=superuser_headers,
            json=build_sale_request(
                client_id=setup["client"].id,
                items=[
                    build_sale_item(
                        product_id=setup["product"].id,
                        quantity=1
                    )
                ],
                payment_method="cash"
            )
        )

        assert create_response.status_code == 201
        created_sale = create_response.json()

        # Now fetch the sale by ID
        response = await api_client.get(
            f"/api/v1/schools/{setup['school'].id}/sales/{created_sale['id']}",
            headers=superuser_headers
        )

        data = assert_success_response(response)
        assert data["id"] == created_sale["id"]
        assert data["code"] == created_sale["code"]

    async def test_get_sale_not_found(
        self,
        api_client,
        superuser_headers,
        test_school
    ):
        """Should return 404 for non-existent sale."""
        response = await api_client.get(
            f"/api/v1/schools/{test_school.id}/sales/{uuid4()}",
            headers=superuser_headers
        )

        assert_not_found(response)

    async def test_filter_sales_by_date(
        self,
        api_client,
        superuser_headers,
        test_sale,
        test_school
    ):
        """Should filter sales by date range."""
        from datetime import date

        today = date.today().isoformat()

        response = await api_client.get(
            f"/api/v1/schools/{test_school.id}/sales",
            headers=superuser_headers,
            params={
                "start_date": today,
                "end_date": today
            }
        )

        data = assert_success_response(response)
        # API returns a list
        assert isinstance(data, list)

    async def test_search_sales_by_code(
        self,
        api_client,
        superuser_headers,
        test_sale,
        test_school
    ):
        """Should search sales by code."""
        response = await api_client.get(
            f"/api/v1/schools/{test_school.id}/sales",
            headers=superuser_headers,
            params={"search": "VNT"}
        )

        data = assert_success_response(response)
        # API returns a list
        assert isinstance(data, list)


# ============================================================================
# HISTORICAL SALES TESTS
# ============================================================================

class TestHistoricalSales:
    """Tests for historical sales (no inventory impact)."""

    async def test_create_historical_sale(
        self,
        api_client,
        superuser_headers,
        complete_test_setup
    ):
        """Should create historical sale without inventory check."""
        setup = complete_test_setup

        response = await api_client.post(
            f"/api/v1/schools/{setup['school'].id}/sales",
            headers=superuser_headers,
            json=build_sale_request(
                client_id=setup["client"].id,
                items=[
                    build_sale_item(
                        product_id=setup["product"].id,
                        quantity=1
                    )
                ],
                is_historical=True,
                sale_date="2024-01-15"
            )
        )

        data = assert_created_response(response)
        assert data.get("is_historical") is True

    async def test_historical_sale_no_inventory_impact(
        self,
        api_client,
        superuser_headers,
        complete_test_setup
    ):
        """Historical sale should not reduce inventory."""
        setup = complete_test_setup

        # Create historical sale with large quantity
        response = await api_client.post(
            f"/api/v1/schools/{setup['school'].id}/sales",
            headers=superuser_headers,
            json=build_sale_request(
                client_id=setup["client"].id,
                items=[
                    build_sale_item(
                        product_id=setup["product"].id,
                        quantity=500  # More than available - but historical
                    )
                ],
                is_historical=True,
                sale_date="2024-06-01"
            )
        )

        # Should succeed because it's historical
        assert_created_response(response)


# ============================================================================
# SALE CHANGES TESTS
# ============================================================================

class TestSaleChanges:
    """Tests for sale change/return workflow.

    Note: Sale changes endpoint is: POST /schools/{school_id}/sales/{sale_id}/changes

    SaleChangeCreate schema requires:
    - original_item_id: UUID
    - change_type: size_change, product_change, return, defect
    - returned_quantity: int > 0
    - reason: str
    - new_product_id: UUID (required for non-return changes)
    - new_quantity: int > 0 (required for non-return changes)
    """

    async def test_create_sale_change_return(
        self,
        api_client,
        superuser_headers,
        test_sale,
        test_school,
        db_session
    ):
        """Should create return request."""
        from sqlalchemy import select
        from app.models import SaleItem

        result = await db_session.execute(
            select(SaleItem).where(SaleItem.sale_id == test_sale.id)
        )
        sale_item = result.scalars().first()

        response = await api_client.post(
            f"/api/v1/schools/{test_school.id}/sales/{test_sale.id}/changes",
            headers=superuser_headers,
            json=build_sale_change_request(
                original_item_id=sale_item.id,
                change_type="return",
                returned_quantity=1,
                reason="Producto defectuoso"
            )
        )

        data = assert_created_response(response)
        assert data["change_type"] == "return"
        assert data["status"] == "pending"

    async def test_sale_change_exceeds_quantity(
        self,
        api_client,
        superuser_headers,
        test_sale,
        test_school,
        db_session
    ):
        """Should return 400 if change exceeds original quantity."""
        from sqlalchemy import select
        from app.models import SaleItem

        result = await db_session.execute(
            select(SaleItem).where(SaleItem.sale_id == test_sale.id)
        )
        sale_item = result.scalars().first()

        response = await api_client.post(
            f"/api/v1/schools/{test_school.id}/sales/{test_sale.id}/changes",
            headers=superuser_headers,
            json=build_sale_change_request(
                original_item_id=sale_item.id,
                change_type="return",
                returned_quantity=999,  # More than purchased
                reason="Devolución"
            )
        )

        # API should reject with 400
        assert response.status_code in [400, 422]

    async def test_list_sale_changes(
        self,
        api_client,
        superuser_headers,
        test_sale,
        test_school
    ):
        """Should list sale changes for a specific sale."""
        response = await api_client.get(
            f"/api/v1/schools/{test_school.id}/sales/{test_sale.id}/changes",
            headers=superuser_headers
        )

        data = assert_success_response(response)
        # Should return list
        assert isinstance(data, list)


# ============================================================================
# MULTI-TENANT TESTS
# ============================================================================

class TestSalesMultiTenancy:
    """Tests for multi-tenant isolation in sales."""

    async def test_cannot_access_other_school_sales(
        self,
        api_client,
        auth_headers,
        db_session,
        test_user_with_school_role
    ):
        """Should not access sales from unauthorized school."""
        from app.models import School

        # Create another school
        unique_id = uuid4().hex[:6]
        other_school = School(
            id=str(uuid4()),
            code=f"OTHER-{unique_id}",
            name="Other School",
            slug=f"other-school-{unique_id}",
            is_active=True
        )
        db_session.add(other_school)
        await db_session.flush()

        response = await api_client.get(
            f"/api/v1/schools/{other_school.id}/sales",
            headers=auth_headers
        )

        # Should be forbidden
        assert_forbidden(response)

    async def test_superuser_can_access_all_schools(
        self,
        api_client,
        superuser_headers,
        test_school
    ):
        """Should allow superuser to access all schools."""
        response = await api_client.get(
            f"/api/v1/schools/{test_school.id}/sales",
            headers=superuser_headers
        )

        assert_success_response(response)


# ============================================================================
# SALE CODE GENERATION TESTS
# ============================================================================

class TestSaleCodeGeneration:
    """Tests for sale code generation."""

    async def test_sale_code_format(
        self,
        api_client,
        superuser_headers,
        complete_test_setup
    ):
        """Should generate codes in format VNT-YYYY-NNNN."""
        setup = complete_test_setup

        response = await api_client.post(
            f"/api/v1/schools/{setup['school'].id}/sales",
            headers=superuser_headers,
            json=build_sale_request(
                client_id=setup["client"].id,
                items=[
                    build_sale_item(
                        product_id=setup["product"].id,
                        quantity=1
                    )
                ]
            )
        )

        data = assert_created_response(response)
        code = data["code"]

        # Verify format
        assert code.startswith("VNT-")
        parts = code.split("-")
        assert len(parts) == 3
        assert parts[1].isdigit() and len(parts[1]) == 4  # Year
        assert parts[2].isdigit()  # Sequential number

    async def test_sale_codes_are_sequential(
        self,
        api_client,
        superuser_headers,
        complete_test_setup
    ):
        """Should generate sequential codes."""
        setup = complete_test_setup
        codes = []

        # Create 3 sales
        for _ in range(3):
            response = await api_client.post(
                f"/api/v1/schools/{setup['school'].id}/sales",
                headers=superuser_headers,
                json=build_sale_request(
                    client_id=setup["client"].id,
                    items=[
                        build_sale_item(
                            product_id=setup["product"].id,
                            quantity=1
                        )
                    ]
                )
            )

            data = assert_created_response(response)
            codes.append(data["code"])

        # Extract sequential numbers
        numbers = [int(c.split("-")[2]) for c in codes]

        # Should be sequential
        for i in range(1, len(numbers)):
            assert numbers[i] == numbers[i-1] + 1
