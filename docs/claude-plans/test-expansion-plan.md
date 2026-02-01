# Plan de Expansión de Tests - Uniformes System v2

## Alcance: Cobertura Completa del Sistema

**Objetivo**: Expandir tests para todo el sistema (Backend + Frontend + Web Portal + Admin Portal) con cobertura completa de todos los servicios y rutas faltantes.

---

## Estado Actual

### Backend (Python/pytest)
- **Tests existentes**: 284 tests
- **Unit tests**: 5 archivos, 140 tests (2,862 líneas)
- **API tests**: 6 archivos, 133 tests (3,170 líneas)
- **Integration tests**: 1 archivo, 11 tests

### Frontend (Tauri/React), Web Portal, Admin Portal
- **Sin framework de testing configurado**
- **0 tests en las 3 aplicaciones frontend**

---

## Gaps Críticos Identificados

### Backend - Servicios SIN Tests

| Servicio | Archivo | Prioridad |
|----------|---------|-----------|
| Balance Integration | `balance_integration.py` (25KB) | 🔴 Crítica |
| Cash Register | `cash_register.py` | 🔴 Crítica |
| Email | `email.py` | 🟡 Alta |
| Document | `document.py` | 🟡 Alta |
| Receipt | `receipt.py` | 🟡 Alta |
| Client | `client.py` | 🟢 Media |
| Global Product | `global_product.py` | 🟢 Media |
| Patrimony | `patrimony.py` | 🟢 Media |
| School | `school.py` | 🟢 Media |
| User | `user.py` | 🟢 Media |

### Backend - Rutas API SIN Tests

| Ruta | Archivo | Endpoints | Prioridad |
|------|---------|-----------|-----------|
| Global Accounting | `global_accounting.py` (58KB) | ~25+ | 🔴 Crítica |
| Accounting | `accounting.py` (48KB) | ~30+ | 🔴 Crítica |
| Dashboard | `dashboard.py` | ~5 | 🟡 Alta |
| Reports | `reports.py` | ~5 | 🟡 Alta |
| Global Products | `global_products.py` | ~10 | 🟢 Media |
| Documents | `documents.py` | ~5 | 🟢 Media |
| Schools | `schools.py` | ~5 | 🟢 Media |
| Users | `users.py` | ~5 | 🟢 Media |
| Delivery Zones | `delivery_zones.py` | ~5 | 🟢 Media |
| Payment Accounts | `payment_accounts.py` | ~5 | 🟢 Media |

---

## Plan de Implementación

### Fase 1: Tests Críticos de Backend (Prioridad Alta)

#### 1.1 Unit Tests - Servicios Críticos

**Archivo**: `backend/tests/unit/test_balance_integration_service.py`
- Test de integración de ventas con balance
- Test de registro de transacciones
- Test de actualización de saldos de caja/banco
- Test de manejo de errores

**Archivo**: `backend/tests/unit/test_cash_register_service.py`
- Test de apertura/cierre de caja
- Test de cuadre de caja
- Test de movimientos de caja

#### 1.2 API Tests - Rutas Críticas

**Archivo**: `backend/tests/api/test_global_accounting_routes.py`
- GET `/global/accounting/cash-balances`
- GET `/global/accounting/balance-accounts`
- POST `/global/accounting/balance-accounts`
- PATCH `/global/accounting/balance-accounts/{id}`
- DELETE `/global/accounting/balance-accounts/{id}`
- GET `/global/accounting/expenses`
- POST `/global/accounting/expenses`
- GET `/global/accounting/receivables-payables`
- POST `/global/accounting/receivables`
- POST `/global/accounting/payables`

**Archivo**: `backend/tests/api/test_accounting_routes.py`
- GET `/schools/{id}/accounting/dashboard`
- GET `/schools/{id}/accounting/transactions`
- POST `/schools/{id}/accounting/transactions`
- GET `/schools/{id}/accounting/cash-flow`
- GET `/schools/{id}/accounting/monthly-report`

### Fase 2: Tests de Alta Prioridad

#### 2.1 Unit Tests - Servicios Importantes

**Archivo**: `backend/tests/unit/test_document_service.py`
- Test de generación de PDFs
- Test de formatos de documentos

**Archivo**: `backend/tests/unit/test_receipt_service.py`
- Test de generación de recibos
- Test de formato de impresión

**Archivo**: `backend/tests/unit/test_email_service.py`
- Test de envío de correos (mock SMTP)
- Test de templates de email

#### 2.2 API Tests - Rutas Importantes

**Archivo**: `backend/tests/api/test_dashboard_routes.py`
- GET `/schools/{id}/dashboard`
- GET `/schools/{id}/dashboard/stats`

**Archivo**: `backend/tests/api/test_reports_routes.py`
- GET `/schools/{id}/reports/sales`
- GET `/schools/{id}/reports/inventory`

### Fase 3: Tests de Media Prioridad

#### 3.1 Unit Tests Restantes

- `test_client_service.py`
- `test_global_product_service.py`
- `test_patrimony_service.py`
- `test_school_service.py`
- `test_user_service.py`

#### 3.2 API Tests Restantes

- `test_global_products_routes.py`
- `test_documents_routes.py`
- `test_schools_routes.py`
- `test_users_routes.py`
- `test_delivery_zones_routes.py`
- `test_payment_accounts_routes.py`

### Fase 4: Testing Frontend (Tauri Desktop)

#### 4.1 Configuración de Vitest para Frontend

**Archivos a crear en `frontend/`**:
- `vitest.config.ts`
- `src/test/setup.ts`
- `src/test/test-utils.tsx`

**Dependencias a instalar**:
```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom @vitest/coverage-v8
```

**package.json scripts a agregar**:
```json
{
  "test": "vitest",
  "test:ui": "vitest --ui",
  "test:coverage": "vitest run --coverage"
}
```

#### 4.2 Tests de Componentes

**Archivo**: `frontend/src/components/__tests__/`
- `SaleForm.test.tsx` - Formulario de ventas
- `ProductCard.test.tsx` - Tarjeta de producto
- `AccountingTable.test.tsx` - Tabla de contabilidad
- `Navigation.test.tsx` - Navegación

#### 4.3 Tests de Hooks

**Archivo**: `frontend/src/hooks/__tests__/`
- `useAuth.test.ts` - Hook de autenticación
- `useSchool.test.ts` - Hook de colegio seleccionado

#### 4.4 Tests de Servicios

**Archivo**: `frontend/src/services/__tests__/`
- `api.test.ts` - Cliente API base
- `globalAccountingService.test.ts` - Servicio contabilidad global
- `salesService.test.ts` - Servicio de ventas

### Fase 5: Testing Web Portal (Next.js)

#### 5.1 Configuración de Vitest para Web Portal

**Archivos a crear en `web-portal/`**:
- `vitest.config.ts`
- `src/test/setup.ts`
- `src/test/test-utils.tsx`

**Dependencias a instalar**:
```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom @vitest/coverage-v8
```

#### 5.2 Tests de Componentes

**Archivo**: `web-portal/src/components/__tests__/`
- `ProductCatalog.test.tsx` - Catálogo de productos
- `ShoppingCart.test.tsx` - Carrito de compras
- `CheckoutForm.test.tsx` - Formulario de checkout

#### 5.3 Tests de Páginas

**Archivo**: `web-portal/app/__tests__/`
- `[school_slug]/page.test.tsx` - Página principal por colegio
- `[school_slug]/cart/page.test.tsx` - Página de carrito

### Fase 6: Testing Admin Portal (Next.js)

#### 6.1 Configuración de Vitest para Admin Portal

**Archivos a crear en `admin-portal/`**:
- `vitest.config.ts`
- `src/test/setup.ts`

**Dependencias a instalar**:
```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

#### 6.2 Tests de Componentes y Páginas

**Archivo**: `admin-portal/app/__tests__/`
- `login/page.test.tsx` - Página de login
- `dashboard/page.test.tsx` - Dashboard admin
- `users/page.test.tsx` - Gestión de usuarios
- `schools/page.test.tsx` - Gestión de colegios

---

## Convenciones de Testing (Existentes)

### Estructura de Tests
```python
pytestmark = pytest.mark.api  # o .unit, .integration

class TestFeatureName:
    async def test_success_case(self, fixtures...):
        # Arrange, Act, Assert

    async def test_error_case(self, fixtures...):
        pass
```

### Fixtures Disponibles
- `db_session` - Sesión de base de datos async
- `api_client` - Cliente HTTP para tests de API
- `auth_headers` - Headers de autenticación
- `test_school`, `test_user`, `test_product`, etc.
- `complete_test_setup` - Setup completo de entidades

### Assertions Personalizadas
- `assert_success_response()`
- `assert_created_response()`
- `assert_forbidden()`
- `assert_not_found()`
- `assert_bad_request()`

---

## Archivos Críticos a Modificar/Crear

### Nuevos Archivos de Test
1. `backend/tests/unit/test_balance_integration_service.py`
2. `backend/tests/unit/test_cash_register_service.py`
3. `backend/tests/api/test_global_accounting_routes.py`
4. `backend/tests/api/test_accounting_routes.py`
5. `backend/tests/unit/test_document_service.py`
6. `backend/tests/unit/test_receipt_service.py`
7. `backend/tests/unit/test_email_service.py`
8. `backend/tests/api/test_dashboard_routes.py`
9. `backend/tests/api/test_reports_routes.py`

### Archivos a Revisar
- `backend/tests/conftest.py` - Agregar fixtures para accounting
- `backend/tests/fixtures/builders.py` - Agregar builders para accounting

---

## Estimación de Cobertura Esperada

| Fase | Tests Nuevos | Cobertura |
|------|--------------|-----------|
| Actual | 284 | Backend ~40% |
| Fase 1 | +80-100 | Backend ~60% |
| Fase 2 | +40-50 | Backend ~70% |
| Fase 3 | +60-80 | Backend ~85% |
| Fase 4 | +30-40 | Frontend Desktop |
| Fase 5 | +20-30 | Web Portal |
| Fase 6 | +15-20 | Admin Portal |

**Total estimado**: ~530-600 tests

---

## Orden de Ejecución Recomendado

### Bloque 1: Backend Crítico
1. `test_global_accounting_routes.py` - 25+ endpoints críticos
2. `test_accounting_routes.py` - 30+ endpoints de contabilidad
3. `test_balance_integration_service.py` - Servicio core

### Bloque 2: Backend Servicios
4. Unit tests de servicios restantes (8 archivos)
5. API tests de rutas restantes (8 archivos)

### Bloque 3: Frontend Setup
6. Configurar Vitest en `frontend/`
7. Configurar Vitest en `web-portal/`
8. Configurar Vitest en `admin-portal/`

### Bloque 4: Frontend Tests
9. Tests de componentes y servicios en cada app

---

## Resumen de Archivos a Crear

### Backend (17 archivos nuevos)
```
backend/tests/
├── unit/
│   ├── test_balance_integration_service.py  # NUEVO
│   ├── test_cash_register_service.py        # NUEVO
│   ├── test_document_service.py             # NUEVO
│   ├── test_email_service.py                # NUEVO
│   ├── test_receipt_service.py              # NUEVO
│   ├── test_client_service.py               # NUEVO
│   ├── test_global_product_service.py       # NUEVO
│   ├── test_patrimony_service.py            # NUEVO
│   ├── test_school_service.py               # NUEVO
│   └── test_user_service.py                 # NUEVO
└── api/
    ├── test_global_accounting_routes.py     # NUEVO
    ├── test_accounting_routes.py            # NUEVO
    ├── test_dashboard_routes.py             # NUEVO
    ├── test_reports_routes.py               # NUEVO
    ├── test_global_products_routes.py       # NUEVO
    ├── test_schools_routes.py               # NUEVO
    └── test_users_routes.py                 # NUEVO
```

### Frontend Tauri (7 archivos nuevos)
```
frontend/
├── vitest.config.ts                         # NUEVO
├── src/test/setup.ts                        # NUEVO
├── src/test/test-utils.tsx                  # NUEVO
├── src/components/__tests__/                # NUEVO (4 tests)
├── src/hooks/__tests__/                     # NUEVO (2 tests)
└── src/services/__tests__/                  # NUEVO (3 tests)
```

### Web Portal (5 archivos nuevos)
```
web-portal/
├── vitest.config.ts                         # NUEVO
├── src/test/setup.ts                        # NUEVO
├── src/components/__tests__/                # NUEVO (3 tests)
└── app/__tests__/                           # NUEVO (2 tests)
```

### Admin Portal (4 archivos nuevos)
```
admin-portal/
├── vitest.config.ts                         # NUEVO
├── src/test/setup.ts                        # NUEVO
└── app/__tests__/                           # NUEVO (4 tests)
```
