# Testing Documentation - Uniformes System v2

## Overview

This document describes the testing infrastructure, conventions, and coverage for the Uniformes System v2 project.

---

## Test Coverage Summary

| Component | Framework | Tests | Status |
|-----------|-----------|-------|--------|
| Backend (Python) | pytest | 709 | Active |
| Frontend (Tauri) | Vitest | 20+ | Configured |
| Web Portal | Vitest | 15+ | Configured |
| Admin Portal | Vitest | 15+ | Configured |

### Backend Test Breakdown

| Category | Tests | Files |
|----------|-------|-------|
| Unit Tests | 348 | 17 files |
| API Tests | 350 | 17 files |
| Integration Tests | 11 | 1 file |

---

## Backend Testing (pytest)

### Directory Structure

```
backend/tests/
├── conftest.py              # Shared fixtures
├── fixtures/
│   └── builders.py          # Test data builders
├── unit/                    # Service layer tests (17 files)
│   ├── test_accounting_service.py
│   ├── test_alteration_service.py
│   ├── test_balance_integration_service.py
│   ├── test_cash_register_service.py
│   ├── test_client_service.py
│   ├── test_email_service.py
│   ├── test_employee_service.py
│   ├── test_expense_adjustment_service.py
│   ├── test_global_product_service.py
│   ├── test_inventory_service.py
│   ├── test_order_service.py
│   ├── test_payroll_service.py
│   ├── test_reports_service.py
│   ├── test_sale_service.py
│   ├── test_school_service.py
│   └── test_user_service.py
├── api/                     # Route/endpoint tests (17 files)
│   ├── test_accounting_routes.py
│   ├── test_alterations_routes.py
│   ├── test_auth_routes.py
│   ├── test_clients_routes.py
│   ├── test_contacts_routes.py
│   ├── test_dashboard_routes.py
│   ├── test_employees_routes.py
│   ├── test_expense_adjustment_routes.py
│   ├── test_fixed_expenses_routes.py
│   ├── test_global_accounting_routes.py
│   ├── test_global_products_routes.py
│   ├── test_notifications_routes.py
│   ├── test_orders_routes.py
│   ├── test_payroll_routes.py
│   ├── test_products_routes.py
│   └── test_sales_routes.py
└── integration/             # Cross-system tests
    └── test_multi_tenant.py
```

### Test Database Setup

Los tests requieren una base de datos PostgreSQL dedicada:

```bash
# Iniciar contenedor de base de datos de tests
docker-compose -f docker/docker-compose.dev.yml up -d postgres-test

# Verificar que está corriendo
docker ps | grep postgres-test
# Debe mostrar: uniformes-postgres-test en puerto 5433

# Configuración de conexión (ya configurada en conftest.py)
# TEST_DATABASE_URL=postgresql+asyncpg://uniformes_test:test_password@localhost:5433/uniformes_test
```

**Importante**: Si los tests fallan con errores de conexión, verifica que Docker esté corriendo y el contenedor `postgres-test` esté activo.

### Running Tests

```bash
cd backend
source venv/bin/activate

# Run all tests
pytest

# Run by category
pytest -m unit           # Only unit tests
pytest -m api            # Only API tests
pytest -m integration    # Only integration tests

# Run specific file
pytest tests/unit/test_sale_service.py

# Run with coverage
pytest --cov=app --cov-report=html

# Run with verbose output
pytest -v

# Run specific test class
pytest tests/unit/test_client_service.py::TestClientServiceCreate

# Run specific test
pytest tests/unit/test_client_service.py::TestClientServiceCreate::test_create_client_success
```

### Test Markers

Tests use pytest markers for categorization:

```python
import pytest

pytestmark = pytest.mark.unit  # or pytest.mark.api, pytest.mark.integration

class TestFeatureName:
    async def test_success_case(self, db_session):
        pass
```

### Available Fixtures

**Database & Session:**
- `db_session` - Async SQLAlchemy session (auto-rollback)
- `db_engine` - Database engine for setup

**HTTP Client:**
- `api_client` - AsyncClient for API testing
- `auth_headers` - Authenticated headers (regular user)
- `superuser_auth_headers` - Superuser authentication

**Test Entities:**
- `test_user` - Regular test user
- `test_superuser` - Superuser for admin operations
- `test_school` - Test school entity
- `test_product` - Test product with inventory
- `test_client` - Test client with school association
- `complete_test_setup` - Full setup with all related entities

### Custom Assertions

```python
from tests.conftest import (
    assert_success_response,
    assert_created_response,
    assert_forbidden,
    assert_not_found,
    assert_bad_request,
    assert_validation_error
)

async def test_example(self, api_client, auth_headers):
    response = await api_client.get("/endpoint", headers=auth_headers)
    assert_success_response(response)
```

### Test Conventions

1. **File naming**: `test_<module>_<type>.py` (e.g., `test_sale_service.py`)
2. **Class naming**: `Test<Feature><Operation>` (e.g., `TestClientServiceCreate`)
3. **Method naming**: `test_<scenario>` (e.g., `test_create_client_success`)
4. **All tests are async**: Use `async def` with `await`
5. **Use fixtures**: Inject via parameters, don't create manually

### Example Unit Test

```python
"""Unit tests for Client Service."""
import pytest
from uuid import uuid4

pytestmark = pytest.mark.unit


class TestClientServiceCreate:
    """Tests for client creation."""

    async def test_create_client_success(self, db_session, test_school):
        """Test successful client creation."""
        from app.services.client import ClientService
        from app.schemas.client import ClientCreate

        service = ClientService(db_session)

        client_data = ClientCreate(
            school_id=test_school.id,
            name="Test Client",
            phone="3001234567",
            email="test@example.com"
        )

        client = await service.create_client(client_data)

        assert client.id is not None
        assert client.name == "Test Client"
        assert client.school_id == test_school.id
```

### Example API Test

```python
"""API tests for Global Products routes."""
import pytest

pytestmark = pytest.mark.api


class TestGlobalProductRoutes:
    """Tests for global product endpoints."""

    async def test_list_global_products(self, api_client, auth_headers):
        """Test listing global products."""
        response = await api_client.get(
            "/global/products",
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    async def test_create_global_product_superuser_only(
        self, api_client, auth_headers
    ):
        """Test that only superusers can create global products."""
        response = await api_client.post(
            "/global/products",
            json={"name": "Test Product", "price": 50000},
            headers=auth_headers  # Regular user
        )

        assert response.status_code == 403
```

---

## Frontend Testing (Vitest)

### Configuration

**File: `frontend/vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: ['node_modules/', 'src/test/']
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
})
```

### Running Frontend Tests

```bash
cd frontend

# Run all tests
npm test

# Run with UI
npm run test:ui

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

### Test Structure

```
frontend/src/
├── test/
│   ├── setup.ts              # Test setup
│   └── test-utils.tsx        # Testing utilities
├── components/
│   └── __tests__/
│       ├── SaleForm.test.tsx
│       └── ProductCard.test.tsx
├── hooks/
│   └── __tests__/
│       └── useAuth.test.ts
└── services/
    └── __tests__/
        └── api.test.ts
```

### Example Component Test

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ProductCard } from '../ProductCard'

describe('ProductCard', () => {
  const mockProduct = {
    id: '1',
    name: 'Test Product',
    price: 50000,
    imageUrl: '/test.jpg'
  }

  it('renders product information', () => {
    render(<ProductCard product={mockProduct} />)

    expect(screen.getByText('Test Product')).toBeInTheDocument()
    expect(screen.getByText('$50,000')).toBeInTheDocument()
  })

  it('calls onAddToCart when button clicked', async () => {
    const onAddToCart = vi.fn()
    render(<ProductCard product={mockProduct} onAddToCart={onAddToCart} />)

    fireEvent.click(screen.getByRole('button', { name: /agregar/i }))

    expect(onAddToCart).toHaveBeenCalledWith(mockProduct)
  })
})
```

### Example Service Test

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiClient } from '../api'

describe('API Client', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('includes auth token in requests', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [] })
    })
    global.fetch = mockFetch

    localStorage.setItem('token', 'test-token')

    await apiClient.get('/test')

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          'Authorization': 'Bearer test-token'
        })
      })
    )
  })
})
```

---

## Web Portal Testing (Vitest)

### Configuration

**File: `web-portal/vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', '.next']
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
})
```

### Running Web Portal Tests

```bash
cd web-portal

npm test
npm run test:coverage
```

### Test Structure

```
web-portal/
├── src/test/
│   └── setup.ts
├── components/
│   └── __tests__/
│       ├── ProductCatalog.test.tsx
│       └── ShoppingCart.test.tsx
└── app/
    └── __tests__/
        └── page.test.tsx
```

---

## Admin Portal Testing (Vitest)

### Configuration

**File: `admin-portal/vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./lib/__tests__/setup.ts'],
    include: ['**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', '.next']
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './')
    }
  }
})
```

### Running Admin Portal Tests

```bash
cd admin-portal

npm test
npm run test:coverage
```

### Test Files

- `lib/__tests__/adminAuth.test.ts` - Authentication store tests
- `components/__tests__/AuthGuard.test.tsx` - Auth guard component tests
- `app/__tests__/login.test.tsx` - Login page tests

---

## CI/CD Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  backend-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: test
          POSTGRES_DB: test_db
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.10'

      - name: Install dependencies
        run: |
          cd backend
          pip install -r requirements.txt
          pip install pytest pytest-asyncio pytest-cov

      - name: Run tests
        env:
          DATABASE_URL: postgresql+asyncpg://postgres:test@localhost:5432/test_db
        run: |
          cd backend
          pytest --cov=app --cov-report=xml

  frontend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install and test frontend
        run: |
          cd frontend
          npm ci
          npm test -- --run

  web-portal-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install and test web portal
        run: |
          cd web-portal
          npm ci
          npm test -- --run

  admin-portal-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install and test admin portal
        run: |
          cd admin-portal
          npm ci
          npm test -- --run
```

---

## Test Data Management

### Using Builders

```python
from tests.fixtures.builders import (
    SchoolBuilder,
    UserBuilder,
    ProductBuilder,
    ClientBuilder,
    SaleBuilder
)

async def test_with_builder(self, db_session):
    school = await SchoolBuilder(db_session).build()
    user = await UserBuilder(db_session).with_school(school).build()
    product = await ProductBuilder(db_session).with_school(school).build()
```

### Factory Pattern for Tests

```python
# Create multiple related entities
async def test_sales_report(self, db_session, test_school):
    service = SaleService(db_session)

    # Create multiple sales
    for i in range(5):
        sale_data = SaleCreate(
            school_id=test_school.id,
            client_name=f"Client {i}",
            items=[{"product_id": product.id, "quantity": 1}]
        )
        await service.create_sale(sale_data)

    # Test report
    report = await service.get_sales_report(test_school.id)
    assert report.total_sales == 5
```

---

## Coverage Goals

| Component | Current | Target |
|-----------|---------|--------|
| Backend Services | ~85% | 90% |
| Backend Routes | ~80% | 85% |
| Frontend Components | ~60% | 75% |
| Web Portal | ~50% | 70% |
| Admin Portal | ~50% | 70% |

---

## Troubleshooting

### Common Issues

**1. Database connection errors**
```bash
# Ensure PostgreSQL is running
pg_isready -h localhost -p 5432

# Check DATABASE_URL in .env.test
```

**2. Async test failures**
```python
# Make sure to use async fixtures
@pytest.fixture
async def my_fixture(db_session):
    # Use await for async operations
    result = await some_async_operation()
    return result
```

**3. Frontend test environment issues**
```bash
# Clear Jest/Vitest cache
npm test -- --clearCache

# Reinstall dependencies
rm -rf node_modules && npm install
```

**4. Import errors in tests**
```python
# Use relative imports from app
from app.services.client import ClientService
from app.schemas.client import ClientCreate
```

---

## Adding New Tests

### Checklist for New Test Files

1. Create file in appropriate directory (`unit/`, `api/`, or `integration/`)
2. Add `pytestmark` marker at module level
3. Create test classes for logical groupings
4. Use descriptive test method names
5. Add docstrings explaining test purpose
6. Use fixtures instead of manual setup
7. Test both success and error cases
8. Update this documentation if adding new patterns

### Template for New Unit Test

```python
"""
Unit tests for [Service Name].

Tests for [feature] including:
- [Operation 1]
- [Operation 2]
- Error handling
"""
import pytest
from uuid import uuid4

pytestmark = pytest.mark.unit


class Test[Service][Operation]:
    """Tests for [operation description]."""

    async def test_[operation]_success(self, db_session, [fixtures]):
        """Test successful [operation]."""
        from app.services.[module] import [Service]
        from app.schemas.[module] import [Schema]

        service = [Service](db_session)
        # Arrange
        # Act
        # Assert

    async def test_[operation]_[error_case](self, db_session):
        """Test [error case description]."""
        pass
```

---

## Contact & Resources

- **Documentation**: See `CLAUDE.md` for project context
- **Issues**: Report test failures as GitHub issues
- **Coverage Reports**: Generated in `htmlcov/` directory

---

*Last updated: January 2026*
*Total tests: 709 (Backend) + ~50 (Frontend apps)*
