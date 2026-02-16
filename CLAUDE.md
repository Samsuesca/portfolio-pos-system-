<!-- AUTO-GENERATED GIT WORKFLOW HEADER -->
<!-- Version: 1.0.0 | Template: GIT_WORKFLOW_BUSINESS.md | Last Updated: 2026-02-16 -->
<!-- DO NOT EDIT MANUALLY - Run: ~/.claude/scripts/sync-git-workflow.sh -->

---

# Git Workflow & Commit Standards

**Version:** 1.0.0
**Last Updated:** 2026-02-15
**Template Type:** Business Applications

---

## Branch Strategy

### Main Branches

- **`main`** - Production-ready code. Protected branch.
  - Only merge via Pull Requests
  - All commits must be tested and reviewed
  - Deployments happen from this branch

- **`develop`** - Integration branch for features
  - Merge feature branches here first
  - Run full test suite before merging to main
  - Base branch for new features

### Supporting Branches

- **`feature/*`** - New functionality
  - Branch from: `develop`
  - Merge into: `develop`
  - Naming: `feature/user-authentication`, `feature/export-reports`

- **`bugfix/*`** - Non-critical bug fixes
  - Branch from: `develop`
  - Merge into: `develop`
  - Naming: `bugfix/login-validation`, `bugfix/ui-alignment`

- **`hotfix/*`** - Critical production fixes
  - Branch from: `main`
  - Merge into: `main` AND `develop`
  - Naming: `hotfix/security-patch`, `hotfix/payment-crash`

- **`refactor/*`** - Code improvements without changing behavior
  - Branch from: `develop`
  - Merge into: `develop`
  - Naming: `refactor/auth-service`, `refactor/database-queries`

---

## Commit Convention

### Format

```
<emoji> <type>: <description>

[optional body]

[optional footer]
```

### Commit Types with Emojis

```bash
✨ feat:       New feature or significant functionality
🐛 fix:        Bug fix
♻️ refactor:   Code restructuring without behavior change
📚 docs:       Documentation updates (README, comments, guides)
✅ test:       Adding or updating tests
🔒 security:   Security fixes or improvements
⚡ perf:       Performance optimization
🚀 chore:      Dependencies, build config, tooling
🎨 style:      Formatting, whitespace (no logic change)
🔧 config:     Configuration files
🗑️ remove:     Removing code or files
🔀 merge:      Merge branches
```

### Examples

**Good commits:**
```bash
✨ feat: add OAuth Google integration to login flow
🐛 fix: resolve timezone inconsistency in sales reports
♻️ refactor: simplify accounting service business logic
📚 docs: update API endpoints documentation
✅ test: add unit tests for inventory service
🔒 security: patch JWT token expiration vulnerability
⚡ perf: optimize database queries with indexes
🚀 chore: upgrade FastAPI to 0.115.0
```

**Bad commits (avoid):**
```bash
❌ "fixed stuff"
❌ "WIP"
❌ "changes"
❌ "updated files"
❌ "feat: add feature" (redundant)
```

---

## Standard Workflows

### 1. Feature Development

```bash
# 1. Start from develop
git checkout develop
git pull origin develop

# 2. Create feature branch
git checkout -b feature/user-notifications

# 3. Make changes and commit
git add src/services/notifications.ts
git commit -m "✨ feat: implement push notification service"

# 4. Push to remote
git push -u origin feature/user-notifications

# 5. Create Pull Request (via GitHub/GitLab)
# - Target: develop
# - Add description, link issues
# - Request reviews

# 6. After approval, merge and delete branch
git checkout develop
git pull origin develop
git branch -d feature/user-notifications
```

### 2. Hotfix (Critical Production Issue)

```bash
# 1. Start from main
git checkout main
git pull origin main

# 2. Create hotfix branch
git checkout -b hotfix/payment-gateway-timeout

# 3. Fix the issue
git add src/services/payment.ts
git commit -m "🐛 fix: increase payment gateway timeout to 30s"

# 4. Push and create PR to main
git push -u origin hotfix/payment-gateway-timeout

# 5. After merging to main, also merge to develop
git checkout develop
git pull origin develop
git merge hotfix/payment-gateway-timeout
git push origin develop

# 6. Delete branch
git branch -d hotfix/payment-gateway-timeout
```

### 3. Bugfix (Non-Critical)

```bash
# 1. Start from develop
git checkout develop
git pull origin develop

# 2. Create bugfix branch
git checkout -b bugfix/form-validation-error

# 3. Fix and commit
git add src/components/LoginForm.tsx
git commit -m "🐛 fix: validate email format before submission"

# 4. Push and create PR to develop
git push -u origin bugfix/form-validation-error
```

---

## Database Migration Workflow

### Creating Migrations (Alembic)

```bash
# 1. Create feature branch first
git checkout -b feature/add-user-preferences

# 2. Modify SQLAlchemy models
# Edit: backend/app/models/user.py

# 3. Generate migration
alembic revision --autogenerate -m "add user preferences table"

# 4. Review generated migration
# Check: alembic/versions/xxxxx_add_user_preferences_table.py

# 5. Test migration locally
alembic upgrade head
alembic downgrade -1  # Test rollback
alembic upgrade head  # Re-apply

# 6. Commit migration with model changes
git add backend/app/models/user.py alembic/versions/xxxxx_*.py
git commit -m "✨ feat: add user preferences model and migration"

# 7. Push and create PR
git push -u origin feature/add-user-preferences
```

### Migration Checklist

Before committing migrations:

- [ ] **Reviewed auto-generated code** - Alembic can make mistakes
- [ ] **Added indexes** - For foreign keys and frequently queried columns
- [ ] **Tested upgrade** - `alembic upgrade head` succeeds
- [ ] **Tested downgrade** - `alembic downgrade -1` works
- [ ] **No data loss** - If altering columns, preserve existing data
- [ ] **Updated models** - SQLAlchemy models match migration

### Production Migration Deployment

```bash
# On production server (VPS)
cd /opt/your-app
git pull origin main

# Backup database first
pg_dump -U user db_name > backup_$(date +%Y%m%d_%H%M%S).sql

# Run migration
docker compose exec backend alembic upgrade head

# Verify
docker compose logs -f backend

# If issues, rollback
docker compose exec backend alembic downgrade -1
```

---

## Deployment Checklist

### Before Deploying to Production

- [ ] **All tests pass** - Unit, integration, E2E
- [ ] **Code reviewed** - At least 1 approval
- [ ] **Environment variables updated** - Add new vars to .env.example
- [ ] **Database migrations ready** - Tested locally
- [ ] **Dependencies updated** - `requirements.txt` or `package.json`
- [ ] **Documentation updated** - README, API docs, CHANGELOG
- [ ] **Rollback plan** - Know how to revert if issues
- [ ] **Monitoring ready** - Sentry, logs configured

### Deployment Workflow (VPS)

```bash
# 1. SSH to production server
ssh user@104.156.247.226

# 2. Navigate to app directory
cd /opt/your-app

# 3. Backup database
./scripts/backup-db.sh

# 4. Pull latest code
git fetch origin
git checkout main
git pull origin main

# 5. Update dependencies
docker compose build backend

# 6. Run migrations
docker compose exec backend alembic upgrade head

# 7. Restart services
docker compose up -d --force-recreate backend

# 8. Verify deployment
docker compose logs -f backend
curl https://your-api.com/health

# 9. Monitor for errors
tail -f logs/app.log
```

### Rollback Procedure

If deployment fails:

```bash
# 1. Revert to previous commit
git log --oneline  # Find previous working commit
git checkout <previous-commit-hash>

# 2. Rebuild and restart
docker compose build backend
docker compose up -d --force-recreate backend

# 3. Rollback migrations (if needed)
docker compose exec backend alembic downgrade -1

# 4. Restore database (if critical)
psql -U user db_name < backup_YYYYMMDD_HHMMSS.sql
```

---

## Production Branch Protection

For business applications, **main** branch MUST have:

- ✅ Require 1-2 pull request reviews
- ✅ Require status checks to pass (CI/CD)
- ✅ Require branches to be up to date before merging
- ✅ Prohibit force pushes
- ✅ Prohibit deletions
- ✅ Require conversation resolution before merge
- ❌ Allow bypassing (only for emergencies with approval)

---

## Commit Best Practices

### DO ✅

- **Write clear, descriptive messages** - Explain WHAT changed and WHY
- **Use imperative mood** - "add feature" not "added feature"
- **Keep commits atomic** - One logical change per commit
- **Reference issues** - Include `#123` or `fixes #456` in commit body
- **Test before committing** - Run tests locally
- **Use emojis consistently** - Follow the table above

### DON'T ❌

- **Commit commented-out code** - Delete it or document why it's kept
- **Commit secrets** - API keys, passwords, tokens (use .env)
- **Make huge commits** - Break down large changes into logical steps
- **Use vague messages** - "fix bug" tells nothing
- **Skip the emoji** - Helps quickly identify commit type
- **Commit directly to main** - Always use PRs

---

## Pre-Commit Checklist

Before every commit, verify:

- [ ] **Tests pass** - `npm test` / `pytest`
- [ ] **Linter passes** - `npm run lint` / `flake8`
- [ ] **No console.log/debug statements** - Remove or comment out
- [ ] **No secrets in code** - Check for API keys, passwords
- [ ] **Formatted code** - `npm run format` / `black .`
- [ ] **Updated dependencies** - If you added new packages
- [ ] **Documentation updated** - If API changed or new features
- [ ] **Migrations tested** - If database changes

---

## Pull Request Process

### Creating a PR

1. **Push your branch** to remote repository
2. **Navigate to GitHub/GitLab** and create Pull Request
3. **Fill out template:**
   - Title: Same as main commit (with emoji)
   - Description: What changed, why, how to test
   - Link related issues: `Closes #123`
4. **Request reviewers** - Team members or maintainers
5. **Add labels** - `feature`, `bugfix`, `hotfix`, `documentation`

### PR Description Template

```markdown
## Summary
Brief description of changes (1-3 sentences)

## Changes
- Added X feature
- Fixed Y bug
- Refactored Z module

## Database Changes
- [ ] New migrations added
- [ ] Migrations tested locally
- [ ] No breaking changes

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests pass
- [ ] Manual testing completed
- [ ] Edge cases covered

## Deployment Notes
- [ ] Environment variables updated
- [ ] Dependencies added
- [ ] Requires manual steps (describe below)

## Screenshots (if UI changes)
[Add images or GIFs]

## Related Issues
Closes #123
Fixes #456
```

### Review Process

1. **Wait for CI/CD** - All checks must pass
2. **Address feedback** - Make requested changes
3. **Re-request review** - After updates
4. **Squash or merge** - Follow project convention
5. **Delete branch** - After merge

---

## .gitignore Essentials

**Always ignore:**

```bash
# Secrets
.env
.env.local
.env.*.local
.env.production
*.pem
*.key
credentials.json
secrets/

# Dependencies
node_modules/
venv/
env/
__pycache__/
*.pyc

# Build artifacts
dist/
build/
*.egg-info/
.next/
out/

# IDE
.vscode/
.idea/
*.swp
*.swo
.DS_Store

# Logs
*.log
logs/
npm-debug.log*

# Testing
coverage/
.nyc_output/
.pytest_cache/

# Database
*.sqlite
*.db
backups/
dump_*.sql

# Docker
.dockerignore
docker-compose.override.yml
```

---

## Emergency Commands

### Undo Last Commit (Keep Changes)

```bash
git reset --soft HEAD~1
```

### Undo Last Commit (Discard Changes)

```bash
git reset --hard HEAD~1
```

### Discard All Local Changes

```bash
git checkout .
git clean -fd
```

### Stash Changes (Save for Later)

```bash
git stash save "WIP: feature description"
git stash list
git stash apply stash@{0}
```

### Amend Last Commit (Before Push)

```bash
git add forgotten-file.ts
git commit --amend --no-edit
```

### Revert a Pushed Commit

```bash
git revert <commit-hash>
git push origin <branch>
```

### Update Branch with Latest Develop

```bash
git checkout feature/my-branch
git fetch origin
git rebase origin/develop
git push --force-with-lease origin feature/my-branch
```

### Cherry-Pick a Commit

```bash
git cherry-pick <commit-hash>
```

---

## Resources

- **Conventional Commits:** https://www.conventionalcommits.org
- **Git Best Practices:** https://git-scm.com/book/en/v2
- **Alembic Docs:** https://alembic.sqlalchemy.org
- **FastAPI Deployment:** https://fastapi.tiangolo.com/deployment/

---

**Note:** This workflow header is auto-generated from `~/.claude/templates/GIT_WORKFLOW_BUSINESS.md`.
To update across all projects, run: `~/.claude/scripts/sync-git-workflow.sh`

---

<!-- END AUTO-GENERATED GIT WORKFLOW HEADER -->
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
