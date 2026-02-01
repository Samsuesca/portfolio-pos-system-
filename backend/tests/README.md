# Testing Suite - Uniformes System v2.0

## Overview

This directory contains the testing suite for the Uniformes System backend API.

## Test Structure

```
tests/
├── conftest.py                    # Shared fixtures
├── fixtures/
│   ├── builders.py                # Request payload builders
│   └── assertions.py              # Custom assertion helpers
├── unit/                          # Unit tests (service layer)
│   ├── test_inventory_service.py
│   ├── test_accounting_service.py
│   ├── test_sale_service.py
│   ├── test_order_service.py
│   └── test_reports_service.py
├── api/                           # API endpoint tests
│   ├── test_auth_routes.py        # Authentication tests (25 tests)
│   ├── test_sales_routes.py       # Sales API tests (35+ tests)
│   ├── test_orders_routes.py      # Orders API tests (40+ tests)
│   ├── test_clients_routes.py     # Clients API tests (30+ tests)
│   ├── test_products_routes.py    # Products API tests (35+ tests)
│   └── test_contacts_routes.py    # PQRS/Contacts tests (25+ tests)
└── integration/                   # Integration tests
    └── test_business_flows.py
```

## Test Types

### Unit Tests (`tests/unit/`)

- Fast, isolated tests for service layer logic
- Use mocked database sessions
- No external dependencies required

### API Tests (`tests/api/`)

- Test HTTP endpoints via FastAPI TestClient
- Require PostgreSQL database
- Test full request/response cycle
- Include authentication, authorization, and validation tests

### Integration Tests (`tests/integration/`)

- Test complete business flows
- Combine multiple services

## Running Tests

### Prerequisites

1. PostgreSQL database running (on production server)
2. Test database created: `uniformes_test`
3. Python virtual environment activated

### Environment Setup

Set the test database URL:

```bash
export TEST_DATABASE_URL="postgresql+asyncpg://uniformes_user:password@localhost:5432/uniformes_test"
```

### Run All Tests

```bash
cd backend
source venv/bin/activate
pytest
```

### Run by Category

```bash
# Unit tests only (no database required)
pytest -m unit

# API tests only (requires database)
pytest -m api

# Integration tests
pytest -m integration
```

### Run Specific Test File

```bash
pytest tests/api/test_auth_routes.py -v
```

### Run with Coverage

```bash
pytest --cov=app --cov-report=html tests/
```

### Run in Parallel

```bash
pytest -n auto  # Requires pytest-xdist
```

## Test Markers

Tests are organized with pytest markers:

- `@pytest.mark.unit` - Unit tests (fast, no DB)
- `@pytest.mark.api` - API endpoint tests
- `@pytest.mark.integration` - Integration tests
- `@pytest.mark.slow` - Long-running tests

## Fixtures

### Database Fixtures

- `async_engine` - PostgreSQL async engine
- `db_session` - Database session with auto-rollback

### Entity Fixtures

- `test_user` - Regular test user
- `test_superuser` - Admin user
- `test_school` - Test school
- `test_product` - Test product with inventory
- `test_client` - Test client
- `test_sale` - Complete sale with items
- `test_order` - Complete order with items

### Auth Fixtures

- `auth_headers` - JWT headers for regular user
- `superuser_headers` - JWT headers for admin

### Complete Setup

- `complete_test_setup` - All entities configured together

## Writing Tests

### Example API Test

```python
import pytest
from tests.fixtures.assertions import assert_success_response, assert_created_response
from tests.fixtures.builders import build_sale_request

pytestmark = pytest.mark.api

class TestSaleCreation:
    async def test_create_sale_success(
        self,
        api_client,
        superuser_headers,
        complete_test_setup
    ):
        setup = complete_test_setup

        response = await api_client.post(
            f"/api/v1/schools/{setup['school'].id}/sales",
            headers=superuser_headers,
            json=build_sale_request(
                client_id=setup["client"].id,
                items=[{"product_id": setup["product"].id, "quantity": 1}]
            )
        )

        data = assert_created_response(response)
        assert data["status"] == "completed"
```

## Test Coverage Goals

| Category | Current | Target |
|----------|---------|--------|
| Unit Tests | ~60% | 80% |
| API Tests | ~70% | 90% |
| Overall | ~65% | 85% |

## Running on Production Server

To run API tests on the production server:

```bash
ssh root@104.156.247.226
cd /var/www/uniformes-system-v2/backend
source venv/bin/activate

# Create test database if not exists
psql -U uniformes_user -d postgres -c "CREATE DATABASE uniformes_test;"

# Run tests
TEST_DATABASE_URL="postgresql+asyncpg://uniformes_user:Uniformes2024!@localhost:5432/uniformes_test" pytest tests/api/ -v
```

## Troubleshooting

### UUID Error with SQLite

The tests require PostgreSQL because models use PostgreSQL's native UUID type.
Set `TEST_DATABASE_URL` to a PostgreSQL database.

### Permission Error for Uploads

The app tries to create `/var/www/uniformes-system-v2/uploads/` on startup.
In test/development environments, it uses a relative path instead.

### Connection Refused

Ensure PostgreSQL is running and accessible at the configured host/port.
