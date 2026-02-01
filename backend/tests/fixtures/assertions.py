"""
Custom assertion helpers for API tests.

These functions provide clear, descriptive assertions
for common API testing patterns.
"""
from decimal import Decimal
from typing import Any
from httpx import Response


# ============================================================================
# RESPONSE ASSERTIONS
# ============================================================================

def assert_success_response(
    response: Response,
    status_code: int = 200
) -> dict[str, Any]:
    """
    Assert a successful API response.

    Args:
        response: HTTP response object
        status_code: Expected status code (default 200)

    Returns:
        Response JSON data

    Raises:
        AssertionError: If status code doesn't match
    """
    assert response.status_code == status_code, (
        f"Expected status {status_code}, got {response.status_code}. "
        f"Response: {response.text[:500]}"
    )
    return response.json()


def assert_created_response(response: Response) -> dict[str, Any]:
    """
    Assert a 201 Created response.

    Args:
        response: HTTP response object

    Returns:
        Response JSON data
    """
    return assert_success_response(response, status_code=201)


def assert_no_content_response(response: Response) -> None:
    """
    Assert a 204 No Content response.

    Args:
        response: HTTP response object

    Raises:
        AssertionError: If status code is not 204
    """
    assert response.status_code == 204, (
        f"Expected status 204, got {response.status_code}. "
        f"Response: {response.text[:500]}"
    )


def assert_error_response(
    response: Response,
    status_code: int,
    detail_contains: str | None = None
) -> dict[str, Any]:
    """
    Assert an error response.

    Args:
        response: HTTP response object
        status_code: Expected error status code
        detail_contains: Substring expected in error detail

    Returns:
        Response JSON data

    Raises:
        AssertionError: If status code or detail doesn't match
    """
    assert response.status_code == status_code, (
        f"Expected status {status_code}, got {response.status_code}. "
        f"Response: {response.text[:500]}"
    )

    data = response.json()

    if detail_contains:
        detail = data.get("detail", "")
        if isinstance(detail, list):
            # Pydantic validation errors are lists
            detail = str(detail)
        assert detail_contains.lower() in detail.lower(), (
            f"Expected '{detail_contains}' in error detail. "
            f"Got: {detail}"
        )

    return data


def assert_unauthorized(
    response: Response,
    detail_contains: str | None = None
) -> dict[str, Any]:
    """
    Assert a 401 Unauthorized response.

    Args:
        response: HTTP response object
        detail_contains: Optional substring in error detail

    Returns:
        Response JSON data
    """
    return assert_error_response(response, 401, detail_contains)


def assert_forbidden(
    response: Response,
    detail_contains: str | None = None
) -> dict[str, Any]:
    """
    Assert a 403 Forbidden response.

    Args:
        response: HTTP response object
        detail_contains: Optional substring in error detail

    Returns:
        Response JSON data
    """
    return assert_error_response(response, 403, detail_contains)


def assert_not_found(
    response: Response,
    detail_contains: str | None = None
) -> dict[str, Any]:
    """
    Assert a 404 Not Found response.

    Args:
        response: HTTP response object
        detail_contains: Optional substring in error detail

    Returns:
        Response JSON data
    """
    return assert_error_response(response, 404, detail_contains)


def assert_bad_request(
    response: Response,
    detail_contains: str | None = None
) -> dict[str, Any]:
    """
    Assert a 400 Bad Request response.

    Args:
        response: HTTP response object
        detail_contains: Optional substring in error detail

    Returns:
        Response JSON data
    """
    return assert_error_response(response, 400, detail_contains)


def assert_validation_error(
    response: Response,
    field: str | None = None
) -> dict[str, Any]:
    """
    Assert a 422 Validation Error response.

    Args:
        response: HTTP response object
        field: Optional field name that should have error

    Returns:
        Response JSON data
    """
    assert response.status_code == 422, (
        f"Expected status 422, got {response.status_code}. "
        f"Response: {response.text[:500]}"
    )

    data = response.json()

    if field:
        errors = data.get("detail", [])
        field_in_errors = any(
            field in str(error.get("loc", []))
            for error in errors
        )
        assert field_in_errors, (
            f"Expected validation error for field '{field}'. "
            f"Got errors: {errors}"
        )

    return data


# ============================================================================
# DATA STRUCTURE ASSERTIONS
# ============================================================================

def assert_pagination(
    data: dict[str, Any],
    expected_total: int | None = None,
    expected_page: int = 1,
    expected_size: int | None = None
) -> list[dict]:
    """
    Assert paginated response structure.

    Args:
        data: Response data dictionary
        expected_total: Expected total count
        expected_page: Expected current page
        expected_size: Expected page size

    Returns:
        List of items from response

    Raises:
        AssertionError: If structure is incorrect
    """
    assert "items" in data, "Missing 'items' in paginated response"
    assert "total" in data, "Missing 'total' in paginated response"
    assert "page" in data, "Missing 'page' in paginated response"
    assert "size" in data or "page_size" in data, "Missing 'size' in paginated response"

    if expected_total is not None:
        assert data["total"] == expected_total, (
            f"Expected total {expected_total}, got {data['total']}"
        )

    assert data["page"] == expected_page, (
        f"Expected page {expected_page}, got {data['page']}"
    )

    if expected_size is not None:
        size = data.get("size") or data.get("page_size")
        assert size == expected_size, (
            f"Expected size {expected_size}, got {size}"
        )

    return data["items"]


def assert_list_response(
    response: Response,
    expected_count: int | None = None,
    min_count: int | None = None
) -> list[dict]:
    """
    Assert a list response.

    Args:
        response: HTTP response object
        expected_count: Exact expected count
        min_count: Minimum expected count

    Returns:
        List of items

    Raises:
        AssertionError: If structure or count is incorrect
    """
    data = assert_success_response(response)

    # Handle both list and paginated responses
    if isinstance(data, list):
        items = data
    else:
        items = data.get("items", data)

    if expected_count is not None:
        assert len(items) == expected_count, (
            f"Expected {expected_count} items, got {len(items)}"
        )

    if min_count is not None:
        assert len(items) >= min_count, (
            f"Expected at least {min_count} items, got {len(items)}"
        )

    return items


# ============================================================================
# ENTITY ASSERTIONS
# ============================================================================

def assert_has_id(data: dict[str, Any]) -> str:
    """
    Assert entity has an ID and return it.

    Args:
        data: Entity data dictionary

    Returns:
        Entity ID string

    Raises:
        AssertionError: If ID is missing
    """
    assert "id" in data, "Entity missing 'id' field"
    assert data["id"], "Entity 'id' is empty"
    return data["id"]


def assert_has_code(data: dict[str, Any], prefix: str | None = None) -> str:
    """
    Assert entity has a code and optionally validate prefix.

    Args:
        data: Entity data dictionary
        prefix: Expected code prefix (e.g., "VNT-", "ENC-")

    Returns:
        Entity code string

    Raises:
        AssertionError: If code is missing or prefix doesn't match
    """
    assert "code" in data, "Entity missing 'code' field"
    code = data["code"]
    assert code, "Entity 'code' is empty"

    if prefix:
        assert code.startswith(prefix), (
            f"Expected code to start with '{prefix}', got '{code}'"
        )

    return code


def assert_timestamps(data: dict[str, Any]) -> None:
    """
    Assert entity has created_at and updated_at timestamps.

    Args:
        data: Entity data dictionary

    Raises:
        AssertionError: If timestamps are missing
    """
    assert "created_at" in data, "Entity missing 'created_at'"
    assert "updated_at" in data, "Entity missing 'updated_at'"
    assert data["created_at"], "Entity 'created_at' is empty"
    assert data["updated_at"], "Entity 'updated_at' is empty"


# ============================================================================
# VALUE ASSERTIONS
# ============================================================================

def assert_decimal_equal(
    actual: Decimal | float,
    expected: Decimal | float,
    places: int = 2
) -> None:
    """
    Assert two decimal values are equal within precision.

    Args:
        actual: Actual value
        expected: Expected value
        places: Decimal places for comparison

    Raises:
        AssertionError: If values differ
    """
    actual_dec = Decimal(str(actual))
    expected_dec = Decimal(str(expected))

    assert round(actual_dec, places) == round(expected_dec, places), (
        f"Expected {expected}, got {actual}"
    )


def _to_numeric(value) -> float:
    """Convert value to numeric (handles string decimal values)."""
    if isinstance(value, str):
        return float(value)
    return float(value)


def assert_positive(value: Decimal | float | int | str, name: str = "value") -> None:
    """
    Assert a value is positive (> 0).

    Args:
        value: Value to check (can be string from API)
        name: Name for error message

    Raises:
        AssertionError: If value is not positive
    """
    numeric_val = _to_numeric(value)
    assert numeric_val > 0, f"Expected {name} to be positive, got {value}"


def assert_non_negative(value: Decimal | float | int | str, name: str = "value") -> None:
    """
    Assert a value is non-negative (>= 0).

    Args:
        value: Value to check (can be string from API)
        name: Name for error message

    Raises:
        AssertionError: If value is negative
    """
    numeric_val = _to_numeric(value)
    assert numeric_val >= 0, f"Expected {name} to be non-negative, got {value}"


def assert_in_range(
    value: Decimal | float | int,
    min_val: Decimal | float | int,
    max_val: Decimal | float | int,
    name: str = "value"
) -> None:
    """
    Assert a value is within a range.

    Args:
        value: Value to check
        min_val: Minimum allowed value
        max_val: Maximum allowed value
        name: Name for error message

    Raises:
        AssertionError: If value is out of range
    """
    assert min_val <= value <= max_val, (
        f"Expected {name} to be between {min_val} and {max_val}, got {value}"
    )


# ============================================================================
# BUSINESS LOGIC ASSERTIONS
# ============================================================================

def assert_sale_valid(sale: dict[str, Any]) -> None:
    """
    Assert a sale response has all required fields.

    Args:
        sale: Sale data dictionary

    Raises:
        AssertionError: If required fields are missing or invalid
    """
    assert_has_id(sale)
    assert_has_code(sale, prefix="VNT-")
    assert "status" in sale
    assert "total" in sale
    assert "payment_method" in sale
    assert "items" in sale
    assert_timestamps(sale)

    # Validate amounts
    assert_non_negative(sale["total"], "sale.total")
    assert_non_negative(sale.get("paid_amount", 0), "sale.paid_amount")


def assert_order_valid(order: dict[str, Any]) -> None:
    """
    Assert an order response has all required fields.

    Args:
        order: Order data dictionary

    Raises:
        AssertionError: If required fields are missing or invalid
    """
    assert_has_id(order)
    assert_has_code(order, prefix="ENC-")
    assert "status" in order
    assert "total" in order
    assert "balance" in order
    assert_timestamps(order)

    # Validate amounts
    assert_non_negative(order["total"], "order.total")
    assert_non_negative(order["balance"], "order.balance")


def assert_expense_valid(expense: dict[str, Any]) -> None:
    """
    Assert an expense response has all required fields.

    Args:
        expense: Expense data dictionary

    Raises:
        AssertionError: If required fields are missing or invalid
    """
    assert_has_id(expense)
    assert "description" in expense
    assert "amount" in expense
    assert "category" in expense
    assert "is_paid" in expense
    assert_timestamps(expense)

    assert_positive(expense["amount"], "expense.amount")


def assert_client_valid(client: dict[str, Any]) -> None:
    """
    Assert a client response has all required fields.

    Args:
        client: Client data dictionary

    Raises:
        AssertionError: If required fields are missing or invalid
    """
    assert_has_id(client)
    assert "name" in client
    assert client["name"], "Client name is empty"


def assert_product_valid(product: dict[str, Any]) -> None:
    """
    Assert a product response has all required fields.

    Args:
        product: Product data dictionary

    Raises:
        AssertionError: If required fields are missing or invalid
    """
    assert_has_id(product)
    assert "name" in product
    assert "price" in product
    assert_timestamps(product)

    assert_positive(product["price"], "product.price")


# ============================================================================
# JWT/AUTH ASSERTIONS
# ============================================================================

def assert_token_response(data: dict[str, Any]) -> str:
    """
    Assert a valid token response.

    Args:
        data: Response data dictionary

    Returns:
        Access token string

    Raises:
        AssertionError: If token structure is invalid
    """
    assert "access_token" in data, "Missing 'access_token'"
    assert "token_type" in data, "Missing 'token_type'"
    assert data["token_type"].lower() == "bearer", (
        f"Expected token_type 'bearer', got '{data['token_type']}'"
    )
    assert data["access_token"], "Access token is empty"

    return data["access_token"]


def assert_jwt_structure(token: str) -> None:
    """
    Assert a string is a valid JWT structure.

    Args:
        token: Token string

    Raises:
        AssertionError: If not a valid JWT structure
    """
    parts = token.split(".")
    assert len(parts) == 3, (
        f"JWT should have 3 parts separated by '.', got {len(parts)}"
    )
