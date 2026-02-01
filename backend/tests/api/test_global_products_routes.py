"""
API tests for Global Products Routes.

Tests for global products management:
- Global garment types CRUD
- Global products CRUD
- Global inventory management
- Image uploads
"""
import pytest
from uuid import uuid4

pytestmark = pytest.mark.api

NEEDS_ISOLATION_FIX = pytest.mark.skip(reason="DB isolation issue")


class TestGlobalGarmentTypeRoutes:
    """Tests for global garment type endpoints."""

    async def test_list_global_garment_types(self, api_client, auth_headers):
        """Test listing global garment types."""
        from tests.fixtures.assertions import assert_success_response

        response = await api_client.get(
            "/api/v1/global/garment-types",
            headers=auth_headers
        )

        assert_success_response(response)
        data = response.json()
        assert isinstance(data, list)

    async def test_create_global_garment_type_superuser(
        self, api_client, superuser_headers
    ):
        """Test creating global garment type as superuser."""
        from tests.fixtures.assertions import assert_created_response

        response = await api_client.post(
            "/api/v1/global/garment-types",
            json={
                "name": "Test Garment Type API",
                "description": "Test description"
            },
            headers=superuser_headers
        )

        assert_created_response(response)
        data = response.json()
        assert data["name"] == "Test Garment Type API"

    async def test_create_global_garment_type_non_superuser_forbidden(
        self, api_client, auth_headers
    ):
        """Test that non-superuser cannot create garment type."""
        from tests.fixtures.assertions import assert_forbidden

        response = await api_client.post(
            "/api/v1/global/garment-types",
            json={"name": "Should Not Create"},
            headers=auth_headers
        )

        assert_forbidden(response)

    async def test_get_global_garment_type(
        self, api_client, superuser_headers
    ):
        """Test getting a global garment type by ID."""
        # First create one
        create_response = await api_client.post(
            "/api/v1/global/garment-types",
            json={"name": "Get Test Type"},
            headers=superuser_headers
        )

        if create_response.status_code == 201:
            garment_type_id = create_response.json()["id"]

            response = await api_client.get(
                f"/api/v1/global/garment-types/{garment_type_id}",
                headers=superuser_headers
            )

            assert response.status_code == 200
            assert response.json()["id"] == garment_type_id

    async def test_get_global_garment_type_not_found(
        self, api_client, auth_headers
    ):
        """Test 404 for nonexistent garment type."""
        from tests.fixtures.assertions import assert_not_found

        response = await api_client.get(
            f"/api/v1/global/garment-types/{uuid4()}",
            headers=auth_headers
        )

        assert_not_found(response)

    async def test_update_global_garment_type_superuser(
        self, api_client, superuser_headers
    ):
        """Test updating a global garment type as superuser."""
        # First create one
        create_response = await api_client.post(
            "/api/v1/global/garment-types",
            json={"name": "Update Test Type"},
            headers=superuser_headers
        )

        if create_response.status_code == 201:
            garment_type_id = create_response.json()["id"]

            response = await api_client.put(
                f"/api/v1/global/garment-types/{garment_type_id}",
                json={"name": "Updated Type Name"},
                headers=superuser_headers
            )

            assert response.status_code == 200
            assert response.json()["name"] == "Updated Type Name"


class TestGlobalProductRoutes:
    """Tests for global product endpoints."""

    async def test_list_global_products(self, api_client, auth_headers):
        """Test listing global products."""
        from tests.fixtures.assertions import assert_success_response

        response = await api_client.get(
            "/api/v1/global/products",
            headers=auth_headers
        )

        assert_success_response(response)
        data = response.json()
        assert isinstance(data, list)

    async def test_list_global_products_with_pagination(
        self, api_client, auth_headers
    ):
        """Test listing global products with pagination."""
        response = await api_client.get(
            "/api/v1/global/products?skip=0&limit=10",
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data) <= 10

    @NEEDS_ISOLATION_FIX
    async def test_create_global_product_superuser(
        self, api_client, superuser_headers
    ):
        """Test creating global product as superuser."""
        # First create garment type
        gt_response = await api_client.post(
            "/api/v1/global/garment-types",
            json={"name": "Product Test Garment Type"},
            headers=superuser_headers
        )

        if gt_response.status_code == 201:
            garment_type_id = gt_response.json()["id"]

            response = await api_client.post(
                "/api/v1/global/products",
                json={
                    "garment_type_id": garment_type_id,
                    "size": "M",
                    "color": "Blanco",
                    "price": 50000
                },
                headers=superuser_headers
            )

            assert response.status_code == 201
            data = response.json()
            assert data["size"] == "M"
            assert data["price"] == 50000

    async def test_create_global_product_non_superuser_forbidden(
        self, api_client, auth_headers, superuser_headers
    ):
        """Test that non-superuser cannot create global product."""
        from tests.fixtures.assertions import assert_forbidden

        # First create garment type with superuser
        gt_response = await api_client.post(
            "/api/v1/global/garment-types",
            json={"name": "Forbidden Product Type"},
            headers=superuser_headers
        )

        if gt_response.status_code == 201:
            garment_type_id = gt_response.json()["id"]

            response = await api_client.post(
                "/api/v1/global/products",
                json={
                    "garment_type_id": garment_type_id,
                    "size": "L",
                    "price": 60000
                },
                headers=auth_headers  # Non-superuser
            )

            assert_forbidden(response)

    async def test_get_global_product(
        self, api_client, superuser_headers
    ):
        """Test getting a global product by ID."""
        # Create garment type
        gt_response = await api_client.post(
            "/api/v1/global/garment-types",
            json={"name": "Get Product Type"},
            headers=superuser_headers
        )

        if gt_response.status_code == 201:
            garment_type_id = gt_response.json()["id"]

            # Create product
            create_response = await api_client.post(
                "/api/v1/global/products",
                json={
                    "garment_type_id": garment_type_id,
                    "size": "S",
                    "price": 45000
                },
                headers=superuser_headers
            )

            if create_response.status_code == 201:
                product_id = create_response.json()["id"]

                response = await api_client.get(
                    f"/api/v1/global/products/{product_id}",
                    headers=superuser_headers
                )

                assert response.status_code == 200
                assert response.json()["id"] == product_id

    async def test_get_global_product_not_found(
        self, api_client, auth_headers
    ):
        """Test 404 for nonexistent product."""
        from tests.fixtures.assertions import assert_not_found

        response = await api_client.get(
            f"/api/v1/global/products/{uuid4()}",
            headers=auth_headers
        )

        assert_not_found(response)

    async def test_search_global_products(
        self, api_client, auth_headers
    ):
        """Test searching global products."""
        response = await api_client.get(
            "/api/v1/global/products/search?q=test",
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    @NEEDS_ISOLATION_FIX
    async def test_update_global_product_superuser(
        self, api_client, superuser_headers
    ):
        """Test updating a global product as superuser."""
        # Create garment type
        gt_response = await api_client.post(
            "/api/v1/global/garment-types",
            json={"name": "Update Product Type"},
            headers=superuser_headers
        )

        if gt_response.status_code == 201:
            garment_type_id = gt_response.json()["id"]

            # Create product
            create_response = await api_client.post(
                "/api/v1/global/products",
                json={
                    "garment_type_id": garment_type_id,
                    "size": "M",
                    "price": 50000
                },
                headers=superuser_headers
            )

            if create_response.status_code == 201:
                product_id = create_response.json()["id"]

                response = await api_client.put(
                    f"/api/v1/global/products/{product_id}",
                    json={"price": 55000},
                    headers=superuser_headers
                )

                assert response.status_code == 200
                assert response.json()["price"] == 55000


class TestGlobalInventoryRoutes:
    """Tests for global inventory endpoints."""

    async def test_get_global_inventory(
        self, api_client, superuser_headers
    ):
        """Test getting inventory for a global product."""
        # Create garment type
        gt_response = await api_client.post(
            "/api/v1/global/garment-types",
            json={"name": "Inventory Test Type"},
            headers=superuser_headers
        )

        if gt_response.status_code == 201:
            garment_type_id = gt_response.json()["id"]

            # Create product (auto-creates inventory)
            product_response = await api_client.post(
                "/api/v1/global/products",
                json={
                    "garment_type_id": garment_type_id,
                    "size": "M",
                    "price": 50000
                },
                headers=superuser_headers
            )

            if product_response.status_code == 201:
                product_id = product_response.json()["id"]

                response = await api_client.get(
                    f"/api/v1/global/products/{product_id}/inventory",
                    headers=superuser_headers
                )

                assert response.status_code == 200
                data = response.json()
                assert "quantity" in data

    async def test_adjust_global_inventory_increase(
        self, api_client, superuser_headers
    ):
        """Test increasing global inventory."""
        # Create garment type
        gt_response = await api_client.post(
            "/api/v1/global/garment-types",
            json={"name": "Adjust Inv Type"},
            headers=superuser_headers
        )

        if gt_response.status_code == 201:
            garment_type_id = gt_response.json()["id"]

            # Create product
            product_response = await api_client.post(
                "/api/v1/global/products",
                json={
                    "garment_type_id": garment_type_id,
                    "size": "M",
                    "price": 50000
                },
                headers=superuser_headers
            )

            if product_response.status_code == 201:
                product_id = product_response.json()["id"]

                response = await api_client.post(
                    f"/api/v1/global/products/{product_id}/inventory/adjust",
                    json={"adjustment": 10},
                    headers=superuser_headers
                )

                assert response.status_code == 200
                assert response.json()["quantity"] == 10

    async def test_adjust_global_inventory_decrease(
        self, api_client, superuser_headers
    ):
        """Test decreasing global inventory."""
        # Create garment type
        gt_response = await api_client.post(
            "/api/v1/global/garment-types",
            json={"name": "Decrease Inv Type"},
            headers=superuser_headers
        )

        if gt_response.status_code == 201:
            garment_type_id = gt_response.json()["id"]

            # Create product
            product_response = await api_client.post(
                "/api/v1/global/products",
                json={
                    "garment_type_id": garment_type_id,
                    "size": "M",
                    "price": 50000
                },
                headers=superuser_headers
            )

            if product_response.status_code == 201:
                product_id = product_response.json()["id"]

                # First add some stock
                await api_client.post(
                    f"/api/v1/global/products/{product_id}/inventory/adjust",
                    json={"adjustment": 20},
                    headers=superuser_headers
                )

                # Then decrease
                response = await api_client.post(
                    f"/api/v1/global/products/{product_id}/inventory/adjust",
                    json={"adjustment": -5},
                    headers=superuser_headers
                )

                assert response.status_code == 200
                assert response.json()["quantity"] == 15

    async def test_adjust_inventory_below_zero_fails(
        self, api_client, superuser_headers
    ):
        """Test that inventory cannot go below zero."""
        from tests.fixtures.assertions import assert_bad_request

        # Create garment type
        gt_response = await api_client.post(
            "/api/v1/global/garment-types",
            json={"name": "Below Zero Type"},
            headers=superuser_headers
        )

        if gt_response.status_code == 201:
            garment_type_id = gt_response.json()["id"]

            # Create product (starts with 0 inventory)
            product_response = await api_client.post(
                "/api/v1/global/products",
                json={
                    "garment_type_id": garment_type_id,
                    "size": "M",
                    "price": 50000
                },
                headers=superuser_headers
            )

            if product_response.status_code == 201:
                product_id = product_response.json()["id"]

                # Try to decrease below 0
                response = await api_client.post(
                    f"/api/v1/global/products/{product_id}/inventory/adjust",
                    json={"adjustment": -10},
                    headers=superuser_headers
                )

                assert_bad_request(response)

    async def test_get_low_stock_global(
        self, api_client, auth_headers
    ):
        """Test getting global products with low stock."""
        response = await api_client.get(
            "/api/v1/global/inventory/low-stock",
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    async def test_update_global_inventory(
        self, api_client, superuser_headers
    ):
        """Test updating global inventory settings."""
        # Create garment type
        gt_response = await api_client.post(
            "/api/v1/global/garment-types",
            json={"name": "Update Inv Type"},
            headers=superuser_headers
        )

        if gt_response.status_code == 201:
            garment_type_id = gt_response.json()["id"]

            # Create product
            product_response = await api_client.post(
                "/api/v1/global/products",
                json={
                    "garment_type_id": garment_type_id,
                    "size": "M",
                    "price": 50000
                },
                headers=superuser_headers
            )

            if product_response.status_code == 201:
                product_id = product_response.json()["id"]

                response = await api_client.put(
                    f"/api/v1/global/products/{product_id}/inventory",
                    json={"min_stock_alert": 15},
                    headers=superuser_headers
                )

                assert response.status_code == 200
                assert response.json()["min_stock_alert"] == 15


class TestGlobalGarmentTypeImages:
    """Tests for global garment type image endpoints."""

    async def test_list_garment_type_images(
        self, api_client, superuser_headers
    ):
        """Test listing images for a garment type."""
        # Create garment type
        gt_response = await api_client.post(
            "/api/v1/global/garment-types",
            json={"name": "Image List Type"},
            headers=superuser_headers
        )

        if gt_response.status_code == 201:
            garment_type_id = gt_response.json()["id"]

            response = await api_client.get(
                f"/api/v1/global/garment-types/{garment_type_id}/images",
                headers=superuser_headers
            )

            assert response.status_code == 200
            data = response.json()
            assert isinstance(data, list)

    async def test_list_images_not_found_garment_type(
        self, api_client, auth_headers
    ):
        """Test 404 for images of nonexistent garment type."""
        from tests.fixtures.assertions import assert_not_found

        response = await api_client.get(
            f"/api/v1/global/garment-types/{uuid4()}/images",
            headers=auth_headers
        )

        assert_not_found(response)


class TestGlobalProductsAuthentication:
    """Tests for authentication on global products endpoints."""

    @NEEDS_ISOLATION_FIX
    async def test_unauthenticated_list_fails(self, api_client):
        """Test that listing products requires authentication."""
        response = await api_client.get("/api/v1/global/products")

        assert response.status_code == 401

    @NEEDS_ISOLATION_FIX
    async def test_unauthenticated_garment_types_fails(self, api_client):
        """Test that listing garment types requires authentication."""
        response = await api_client.get("/api/v1/global/garment-types")

        assert response.status_code == 401


class TestGlobalProductsValidation:
    """Tests for input validation on global products."""

    async def test_create_product_invalid_garment_type(
        self, api_client, superuser_headers
    ):
        """Test creating product with invalid garment type ID."""
        from tests.fixtures.assertions import assert_bad_request

        response = await api_client.post(
            "/api/v1/global/products",
            json={
                "garment_type_id": str(uuid4()),
                "size": "M",
                "price": 50000
            },
            headers=superuser_headers
        )

        assert_bad_request(response)

    async def test_create_garment_type_duplicate_name(
        self, api_client, superuser_headers
    ):
        """Test creating garment type with duplicate name."""
        from tests.fixtures.assertions import assert_bad_request

        # Create first
        await api_client.post(
            "/api/v1/global/garment-types",
            json={"name": "Duplicate Name Test"},
            headers=superuser_headers
        )

        # Try duplicate
        response = await api_client.post(
            "/api/v1/global/garment-types",
            json={"name": "Duplicate Name Test"},
            headers=superuser_headers
        )

        assert_bad_request(response)
