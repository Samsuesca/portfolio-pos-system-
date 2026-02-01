# Claude AI - Contexto del Proyecto

> **ESTADO: EN PRODUCCION** | VPS: 104.156.247.226 | Dominio: yourdomain.com

Sistema de gestion de uniformes **Uniformes Consuelo Rios** con arquitectura multi-tenant.

---

## Reglas Criticas (LEER PRIMERO)

### 1. Contabilidad es GLOBAL (No por Colegio)

```
CORRECTO:  /api/v1/global/accounting/expenses
INCORRECTO: /api/v1/schools/{school_id}/accounting/expenses
```

- **UNA SOLA Caja** y **UNA SOLA cuenta bancaria** para todo el negocio
- Los colegios son **fuentes de ingreso**, no entidades contables separadas
- Usar `globalAccountingService.ts` para operaciones contables
- `school_id` es OPCIONAL en contabilidad (solo para filtros/reportes)

### 2. Entorno de Produccion

| Aspecto | Valor |
|---------|-------|
| VPS | 104.156.247.226 (Vultr) |
| Dominio | yourdomain.com |
| Branch produccion | `main` |
| Branch desarrollo | `develop` |
| API Docs | https://yourdomain.com/docs |

### 3. Antes de Modificar Codigo

- [ ] Leer el archivo existente antes de editar
- [ ] Verificar que los tests pasen localmente
- [ ] No introducir breaking changes sin consultar
- [ ] Mantener compatibilidad con datos existentes en produccion

### 4. Zona Horaria: Colombia (UTC-5)

**TODAS las fechas/horas deben usar zona horaria de Colombia (America/Bogota):**

```python
# CORRECTO - Usar utilidades de timezone
from app.utils.timezone import get_colombia_now_naive, get_colombia_date

created_at = get_colombia_now_naive()  # Para campos DateTime en DB
today = get_colombia_date()            # Para campos Date

# INCORRECTO - NUNCA usar estos
from datetime import datetime, date
datetime.utcnow()  # NO USAR
datetime.now()     # NO USAR
date.today()       # NO USAR
```

**Utilidades disponibles** en `backend/app/utils/timezone.py`:
| Funcion | Uso |
|---------|-----|
| `get_colombia_now()` | datetime con timezone (para calculos) |
| `get_colombia_date()` | fecha actual Colombia (para Date fields) |
| `get_colombia_now_naive()` | datetime sin tz (para DateTime fields en DB) |
| `get_colombia_datetime_range(date)` | tupla (inicio_dia, fin_dia) |

**Frontend**: Usar `timeZone: 'America/Bogota'` en `toLocaleString()`:
```typescript
date.toLocaleString('es-CO', { timeZone: 'America/Bogota' })
```

---

## Arquitectura del Sistema

### Stack Tecnologico

| Capa | Tecnologia | Version |
|------|------------|---------|
| Backend | FastAPI + SQLAlchemy (async) | Python 3.10+ |
| Base de Datos | PostgreSQL | 15 |
| Desktop App | Tauri + React + TypeScript | Tauri 2.x |
| Web Portal | Next.js (App Router) | 14 |
| Admin Portal | Next.js | 16 |
| Estado | Zustand | - |
| Estilos | Tailwind CSS | v4 |

### Estructura de Carpetas

```
uniformes-system-v2/
├── backend/                 # API FastAPI
│   ├── app/
│   │   ├── api/routes/      # Endpoints (18 archivos)
│   │   ├── models/          # SQLAlchemy models
│   │   ├── services/        # Logica de negocio
│   │   └── schemas/         # Pydantic schemas
│   ├── alembic/             # Migraciones DB
│   └── tests/               # pytest (284 tests)
│
├── frontend/                # App Tauri (vendedores)
│   ├── src/
│   │   ├── pages/           # 18 vistas principales
│   │   ├── components/      # 45+ componentes
│   │   ├── services/        # 14 clientes API
│   │   └── stores/          # Estado Zustand
│   └── src-tauri/           # Codigo Rust
│
├── web-portal/              # Portal padres (Next.js)
├── admin-portal/            # Portal admin (Next.js)
└── docs/                    # Documentacion organizada
```

---

## Patrones de Desarrollo

### Multi-Tenancy (Colegios)

```python
# Endpoints POR COLEGIO - requieren school_id
GET  /api/v1/schools/{school_id}/products
POST /api/v1/schools/{school_id}/sales
GET  /api/v1/schools/{school_id}/clients

# Endpoints GLOBALES - sin school_id
GET  /api/v1/global/accounting/cash-balances
POST /api/v1/global/accounting/expenses
GET  /api/v1/users
```

### AccountType Enum (MINUSCULAS)

```python
# CORRECTO
account_type = "asset_current"
account_type = "asset_fixed"

# INCORRECTO
account_type = "ASSET_CURRENT"  # NO usar mayusculas
```

Valores validos:
- `asset_current` - Activo Corriente (Caja, Banco)
- `asset_fixed` - Activo Fijo (Equipos)
- `liability_current` - Pasivo Corriente
- `liability_long` - Pasivo Largo Plazo
- `equity` - Patrimonio
- `income` - Ingresos
- `expense` - Gastos

### Metodos de Pago

```typescript
type PaymentMethod = 'cash' | 'nequi' | 'transfer' | 'card' | 'credit';
```

---

## Convenciones de Codigo

### Python (Backend)

```python
# Async obligatorio para DB
async def get_products(db: AsyncSession) -> list[Product]:
    result = await db.execute(select(Product))
    return result.scalars().all()

# Type hints siempre
def calculate_total(items: list[SaleItem]) -> Decimal:
    return sum(item.subtotal for item in items)

# SQLAlchemy 2.0 style
stmt = select(Product).where(Product.school_id == school_id)
result = await db.execute(stmt)
```

### TypeScript (Frontend)

```typescript
// Componentes funcionales + hooks
const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const [loading, setLoading] = useState(false);
  // ...
};

// Servicios tipados
const products = await productService.getAll(schoolId);

// Zustand para estado global
const { currentSchool } = useSchoolStore();
```

### Commits (Conventional Commits)

```bash
feat: add new product modal
fix: resolve inventory update bug
docs: update API documentation
refactor: simplify sale service logic
test: add tests for accounting service
chore: update dependencies
```

---

## Comandos Frecuentes

### Desarrollo Local

```bash
# Backend
cd backend && source venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Frontend Tauri
cd frontend && npm run tauri:dev

# Web Portal
cd web-portal && npm run dev

# Tests Backend
cd backend && pytest -v
cd backend && pytest --cov=app  # Con cobertura
```

### Deployment a Produccion

```bash
# Deploy rapido (desde local)
git push origin develop
# Luego en VPS: git pull && systemctl restart uniformes-api

# Ver logs del servidor
ssh root@104.156.247.226 "tail -100 /var/log/uniformes/backend.log"

# Restart servicios
ssh root@104.156.247.226 "systemctl restart uniformes-api"

# Estado del servicio
ssh root@104.156.247.226 "systemctl status uniformes-api"
```

### Base de Datos

```bash
# Nueva migracion
cd backend && alembic revision --autogenerate -m "descripcion"

# Aplicar migraciones
cd backend && alembic upgrade head

# Ver historial
cd backend && alembic history
```

---

## Flujos de Trabajo

### Nuevo Feature

1. `git checkout develop && git pull`
2. `git checkout -b feature/nombre-descriptivo`
3. Desarrollar y probar localmente
4. `git add . && git commit -m "feat: descripcion"`
5. `git push -u origin feature/nombre-descriptivo`
6. Crear PR hacia `develop`

### Bug Fix en Produccion

1. `git checkout main && git pull`
2. `git checkout -b hotfix/descripcion-bug`
3. Fix minimo necesario
4. Test local
5. PR hacia `main` Y `develop`

### Agregar Endpoint

1. Crear schema en `backend/app/schemas/`
2. Crear/modificar modelo en `backend/app/models/`
3. Crear servicio en `backend/app/services/`
4. Crear ruta en `backend/app/api/routes/`
5. Agregar tests en `backend/tests/`
6. Crear servicio frontend en `frontend/src/services/`

---

## Troubleshooting

### Error 422 Unprocessable Entity

```python
# Verificar que el schema Pydantic coincida con el request
# Revisar validadores y campos requeridos
# Verificar tipos de datos (UUID vs string, etc.)
```

### Error de CORS

```python
# backend/app/main.py - Verificar origins permitidos
origins = [
    "http://localhost:5173",
    "https://yourdomain.com",
    "tauri://localhost"
]
```

### Inventario No Actualiza

```python
# Verificar que se llame a inventory_service.update_stock()
# Verificar transaccion de DB (commit/rollback)
# Revisar logs: /var/log/uniformes/backend.log
```

### Frontend No Conecta a API

```typescript
// Verificar VITE_API_URL en .env
// Verificar que el backend este corriendo
// Revisar Network tab en DevTools
```

---

## Tablas de Base de Datos

### Sistema
- `users` - Usuarios del sistema
- `user_school_roles` - Roles por colegio

### Multi-Tenant (por colegio)
- `schools` - Colegios/tenants
- `garment_types` - Tipos de prenda
- `products` - Productos
- `inventory` - Stock por talla
- `clients` - Clientes
- `sales`, `sale_items` - Ventas
- `sale_changes` - Cambios/devoluciones
- `orders`, `order_items` - Pedidos

### Contabilidad (GLOBAL)
- `balance_accounts` - Cuentas contables (Caja, Banco)
- `balance_entries` - Movimientos
- `expenses` - Gastos
- `accounts_receivable` - CxC
- `accounts_payable` - CxP
- `transactions` - Transacciones
- `daily_cash_registers` - Cierre de caja

---

## APIs Importantes

### globalAccountingService.ts

```typescript
// Usar SIEMPRE para operaciones contables
getCashBalances()           // Saldos Caja y Banco
getExpenses(params)         // Listar gastos
createExpense(data)         // Crear gasto
getReceivablesPayables()    // CxC y CxP
createReceivable(data)      // Crear CxC
createPayable(data)         // Crear CxP
getBalanceAccounts(params)  // Cuentas contables
```

### Endpoints Clave

| Endpoint | Descripcion |
|----------|-------------|
| `POST /auth/login` | Autenticacion JWT |
| `GET /schools` | Lista de colegios |
| `GET /schools/{id}/products` | Productos del colegio |
| `POST /schools/{id}/sales` | Crear venta |
| `GET /global/accounting/cash-balances` | Saldos globales |

---

## Seguridad

### NO Hacer

- Hardcodear credenciales en codigo
- Commit de archivos .env
- Deshabilitar SSL verification
- Usar `SELECT *` sin limites
- Exponer stack traces en produccion

### SI Hacer

- Variables de entorno para secrets
- Validar input con Pydantic
- Sanitizar queries SQL (SQLAlchemy lo hace)
- Logging apropiado (sin datos sensibles)
- Rate limiting en endpoints publicos

---

## Documentacion Adicional

| Documento | Ubicacion |
|-----------|-----------|
| Arquitectura | [docs/architecture/](docs/architecture/README.md) |
| Deployment | [docs/deployment/](docs/deployment/README.md) |
| Desarrollo | [docs/development/](docs/development/README.md) |
| Testing | [docs/test/](docs/test/README.md) |
| Guia Usuario | [docs/user-guide/](docs/user-guide/README.md) |

---

## Contacto

- **Desarrollador**: Angel Samuel Suesca Rios
- **GitHub**: https://github.com/Samsuesca
- **Produccion**: https://yourdomain.com

---

*Ultima actualizacion: 2026-01-23 | Version: v2.0.0*
