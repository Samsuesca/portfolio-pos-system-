# Testing - Uniformes System v2

Esta documentacion describe la estructura de tests, configuracion y como ejecutar pruebas en el sistema.

---

## Resumen de Cobertura

> **Ultima actualizacion:** 2026-01-19

| Proyecto | Framework | Tests | Estado |
|----------|-----------|-------|--------|
| Backend (Python) | pytest | 895 | 834 passed, 61 skipped |
| Frontend (Tauri) | Vitest | 16 | Activo |
| Web Portal (Next.js) | Vitest | 17 | Activo |
| Admin Portal (Next.js) | Vitest | 12 | Activo |
| **Total** | - | **940** | - |

---

## Backend (Python/pytest)

### Estructura de Tests

```
backend/tests/
├── conftest.py                    # Fixtures globales
├── fixtures/
│   ├── builders.py               # Constructores de entidades de prueba
│   └── ...
├── unit/                          # Tests unitarios de servicios
│   ├── test_sale_service.py
│   ├── test_product_service.py
│   ├── test_inventory_service.py
│   ├── test_order_service.py
│   ├── test_balance_integration_service.py  # NUEVO
│   ├── test_cash_register_service.py        # NUEVO
│   └── test_email_service.py                # NUEVO
├── api/                           # Tests de endpoints API
│   ├── test_sales_routes.py
│   ├── test_products_routes.py
│   ├── test_orders_routes.py
│   ├── test_clients_routes.py
│   ├── test_auth_routes.py
│   ├── test_web_orders_routes.py
│   ├── test_global_accounting_routes.py     # NUEVO - 25+ endpoints
│   └── test_accounting_routes.py            # NUEVO - 30+ endpoints
└── integration/                   # Tests de integracion
    └── test_sales_inventory.py
```

### Ejecutar Tests

```bash
# Activar entorno virtual
cd backend
source venv/bin/activate

# Ejecutar todos los tests
pytest

# Ejecutar con verbose
pytest -v

# Ejecutar solo tests unitarios
pytest tests/unit/ -v

# Ejecutar solo tests de API
pytest tests/api/ -v

# Ejecutar tests de un archivo especifico
pytest tests/api/test_global_accounting_routes.py -v

# Ejecutar con cobertura
pytest --cov=app --cov-report=html

# Ejecutar tests por marca
pytest -m "unit"
pytest -m "api"
pytest -m "integration"
```

### Markers Disponibles

```python
pytestmark = pytest.mark.unit        # Tests unitarios
pytestmark = pytest.mark.api         # Tests de API
pytestmark = pytest.mark.integration # Tests de integracion
```

### Fixtures Principales

```python
# Database
@pytest.fixture
async def db_session():
    """Sesion de base de datos async para tests"""

# Authentication
@pytest.fixture
def auth_headers(test_user):
    """Headers con JWT token para requests autenticados"""

# Entities
@pytest.fixture
async def test_school(db_session):
    """Colegio de prueba"""

@pytest.fixture
async def test_user(db_session, test_school):
    """Usuario de prueba con rol en el colegio"""

@pytest.fixture
async def test_product(db_session, test_school):
    """Producto de prueba con inventario"""

@pytest.fixture
async def complete_test_setup(db_session):
    """Setup completo con todas las entidades relacionadas"""
```

### Assertions Personalizadas

```python
from tests.fixtures.assertions import (
    assert_success_response,      # HTTP 200
    assert_created_response,      # HTTP 201
    assert_bad_request,           # HTTP 400
    assert_forbidden,             # HTTP 403
    assert_not_found,             # HTTP 404
)

# Uso
response = await api_client.get("/endpoint")
assert_success_response(response)
```

### Archivos de Test Nuevos (v2.2.0)

#### test_permission_service.py (NUEVO)
Tests unitarios para el sistema de permisos granulares:
- CRUD de permisos
- Validacion de permisos por rol
- Herencia de permisos
- Permisos por colegio

#### test_custom_roles_routes.py (NUEVO)
Tests de API para roles personalizados:
- Crear/editar/eliminar roles custom
- Asignar permisos a roles
- Validaciones de seguridad
- Listar roles disponibles

#### test_school_users_routes.py (NUEVO)
Tests de API para gestion de usuarios por colegio:
- Listar usuarios de un colegio
- Invitar usuario a colegio
- Cambiar rol de usuario
- Remover usuario de colegio

#### test_inventory_logs_routes.py (NUEVO)
Tests de API para logs de inventario:
- Consultar historial de movimientos
- Filtros por fecha/producto/tipo
- Paginacion de resultados

#### test_notification_channels.py (NUEVO)
Tests del orquestador de notificaciones:
- Seleccion de canal (WhatsApp/Email/SMS)
- Fallback entre canales
- Preferencias del cliente
- Notificaciones paralelas

#### test_email_service.py (EXPANDIDO)
Tests para el servicio de email:
- Envio de email cuando pedido listo para recoger
- Templates de email
- Manejo de errores de envio
- Correos de verificacion
- Correos de bienvenida
- Confirmacion de ventas

#### test_global_accounting_routes.py
Tests para endpoints de contabilidad global (`/global/accounting/*`):
- Cash balances (Caja/Banco)
- Balance accounts CRUD
- Expenses CRUD y pagos
- Accounts payable CRUD y pagos
- Accounts receivable CRUD y pagos
- Patrimony summary
- Transactions
- Cash flow reports

#### test_accounting_routes.py
Tests para endpoints de contabilidad por colegio (`/schools/{id}/accounting/*`):
- Dashboard contable
- Cash flow por colegio
- Monthly reports
- Transactions CRUD
- School expenses
- Daily cash register
- School receivables/payables

#### test_balance_integration_service.py
Tests unitarios para el servicio de integracion de balances:
- Configuracion de cuentas por defecto
- Mapeo de metodos de pago a cuentas
- Creacion/obtencion de cuentas globales
- Aplicacion de transacciones a balances
- Transferencias entre cuentas

#### test_cash_register_service.py
Tests unitarios para el servicio de caja:
- Balance de caja menor
- Balance de caja mayor
- Operaciones de liquidacion

---

## Frontend Tauri (Vitest)

### Estructura de Tests

```
frontend/
├── vitest.config.ts              # Configuracion de Vitest
├── src/
│   ├── test/
│   │   ├── setup.ts             # Setup global (mocks de Tauri)
│   │   └── test-utils.tsx       # Utilidades de testing
│   ├── components/__tests__/    # Tests de componentes (pendiente)
│   ├── hooks/__tests__/         # Tests de hooks (pendiente)
│   └── services/__tests__/
│       └── globalAccountingService.test.ts
```

### Configuracion (vitest.config.ts)

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
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: ['node_modules', 'dist', 'src-tauri'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html']
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
})
```

### Mocks de Tauri (setup.ts)

```typescript
// Mock Tauri core
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

// Mock Tauri plugins
vi.mock('@tauri-apps/plugin-dialog', () => ({
  ask: vi.fn(),
  confirm: vi.fn(),
  message: vi.fn(),
  open: vi.fn(),
  save: vi.fn()
}))

vi.mock('@tauri-apps/plugin-fs', () => ({
  readTextFile: vi.fn(),
  writeTextFile: vi.fn(),
  exists: vi.fn()
}))

vi.mock('@tauri-apps/plugin-http', () => ({
  fetch: vi.fn()
}))
```

### Ejecutar Tests

```bash
cd frontend

# Ejecutar todos los tests
npm run test

# Ejecutar en modo watch
npm run test

# Ejecutar una sola vez
npm run test:run

# Con UI interactiva
npm run test:ui

# Con cobertura
npm run test:coverage
```

### Test Utilities (test-utils.tsx)

```typescript
// Custom render con providers
import { render } from '@/test/test-utils'

// Helpers para crear datos mock
import {
  createMockAuthState,
  createMockSchool,
  createMockProduct,
  createMockSale
} from '@/test/test-utils'
```

---

## Web Portal (Vitest)

### Estructura de Tests

```
web-portal/
├── vitest.config.ts
├── src/test/
│   └── setup.tsx                # Setup global (mocks de Next.js)
└── lib/__tests__/
    └── api.test.ts              # Tests de API utilities
```

### Mocks de Next.js (setup.tsx)

```typescript
// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn()
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams()
}))

// Mock Next.js Image
vi.mock('next/image', () => ({
  default: ({ src, alt, ...props }) => <img src={src} alt={alt} {...props} />
}))
```

### Ejecutar Tests

```bash
cd web-portal

npm run test        # Watch mode
npm run test:run    # Single run
npm run test:coverage
```

---

## Admin Portal (Vitest)

### Estructura de Tests

```
admin-portal/
├── vitest.config.ts
├── src/test/
│   ├── setup.tsx               # Setup global
│   └── test-utils.tsx          # Utilidades de testing
└── lib/__tests__/
    └── adminAuth.test.ts       # Tests de autenticacion admin
```

### Tests de Autenticacion

```typescript
// Tests incluidos en adminAuth.test.ts:
- Login exitoso para superuser
- Rechazo de login para usuario no-superuser
- Manejo de credenciales invalidas
- Verificacion de token valido
- Rechazo de token para no-superuser
- Logout y limpieza de estado
```

### Ejecutar Tests

```bash
cd admin-portal

npm run test        # Watch mode
npm run test:run    # Single run
npm run test:coverage
```

---

## Scripts de Package.json

### Backend (pytest)

No tiene scripts npm - usar pytest directamente.

### Frontend/Web-Portal/Admin-Portal

```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage"
  }
}
```

---

## Escribiendo Nuevos Tests

### Backend - Test de API

```python
import pytest
from tests.fixtures.assertions import assert_success_response

pytestmark = pytest.mark.api

class TestMyEndpoint:
    async def test_get_resource(self, api_client, auth_headers, test_school):
        """Test GET /schools/{id}/resource"""
        response = await api_client.get(
            f"/schools/{test_school.id}/resource",
            headers=auth_headers
        )
        assert_success_response(response)
        data = response.json()
        assert "items" in data
```

### Backend - Test Unitario

```python
import pytest
from unittest.mock import AsyncMock, MagicMock

pytestmark = pytest.mark.unit

class TestMyService:
    async def test_service_method(self, db_session):
        """Test service method logic"""
        from app.services.my_service import MyService

        service = MyService(db_session)
        result = await service.my_method(param="value")

        assert result is not None
        assert result.field == "expected"
```

### Frontend - Test de Servicio

```typescript
import { describe, it, expect, vi, Mock } from 'vitest'
import apiClient from '@/utils/api-client'
import { myFunction } from '@/services/myService'

vi.mock('@/utils/api-client')

describe('MyService', () => {
  it('should fetch data correctly', async () => {
    const mockResponse = { data: { items: [] } }
    ;(apiClient.get as Mock).mockResolvedValueOnce(mockResponse)

    const result = await myFunction()

    expect(apiClient.get).toHaveBeenCalledWith('/expected/endpoint')
    expect(result.items).toEqual([])
  })
})
```

### Frontend - Test de Componente

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@/test/test-utils'
import MyComponent from '@/components/MyComponent'

describe('MyComponent', () => {
  it('should render correctly', () => {
    render(<MyComponent title="Test" />)

    expect(screen.getByText('Test')).toBeInTheDocument()
  })
})
```

---

## Cobertura Pendiente

### Backend - Servicios sin tests
- `client.py` - Servicio de clientes
- `school.py` - Servicio de colegios
- `user.py` - Servicio de usuarios
- `patrimony.py` - Servicio de patrimonio
- `document.py` - Generacion de PDFs
- `receipt.py` - Generacion de recibos
- `global_product.py` - Productos globales

### Backend - Rutas API sin tests
- `global_products.py` - CRUD productos globales
- `schools.py` - CRUD colegios
- `users.py` - CRUD usuarios
- `dashboard.py` - Estadisticas
- `reports.py` - Reportes
- `delivery_zones.py` - Zonas de entrega
- `payment_accounts.py` - Cuentas de pago

### Frontend
- Tests de componentes (SaleForm, ProductCard, etc.)
- Tests de hooks (useAuth, useSchool)

### Web Portal
- Tests de componentes (ProductCatalog, ShoppingCart)
- Tests de paginas

### Admin Portal
- Tests de paginas (Login, Dashboard, Users, Schools)
- Tests de componentes (Sidebar, Header)

---

## CI/CD

Actualmente los tests se ejecutan manualmente. Para integracion con CI/CD:

### GitHub Actions (ejemplo)

```yaml
name: Tests

on: [push, pull_request]

jobs:
  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-python@v4
        with:
          python-version: '3.10'
      - run: |
          cd backend
          pip install -r requirements.txt
          pytest --cov=app

  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: |
          cd frontend
          npm install
          npm run test:run
```

---

## Recursos

- [pytest Documentation](https://docs.pytest.org/)
- [Vitest Documentation](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)

---

**Ultima actualizacion**: 2026-01-19
