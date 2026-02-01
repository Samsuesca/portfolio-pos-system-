# Uniformes System v2.0

Sistema de gestion de uniformes escolares con arquitectura **multi-tenant**, aplicacion de escritorio nativa y portal web para pedidos online.

## Caracteristicas Principales

- **Multi-Colegio**: Gestiona 4+ instituciones con datos aislados 
- **Contabilidad Global**: Un negocio, una caja, un banco - colegios como fuentes de ingreso
- **Inventario Inteligente**: Control de stock por colegio, tallas y tipos de prenda
- **Ventas y Encargos**: Sistema POS completo con pedidos personalizados
- **Cambios y Devoluciones**: Gestion de cambios con ajuste automatico de inventario
- **Portal Web**: Catalogo online para padres de familia
- **App Desktop**: Aplicacion nativa multiplataforma con Tauri

## Stack Tecnologico

| Componente | Tecnologia |
|------------|------------|
| **Backend** | FastAPI, Python 3.10+, PostgreSQL 15, SQLAlchemy 2.0 |
| **Frontend Desktop** | Tauri (Rust), React 18, TypeScript, Tailwind CSS |
| **Portal Web** | Next.js 14, TypeScript, Tailwind CSS |
| **Estado** | Zustand |
| **Servidor** | VPS Vultr, Nginx, Systemd, Certbot SSL |

## Arquitectura

```
uniformes-system-v2/
├── backend/               # API REST (FastAPI)
│   ├── app/
│   │   ├── api/routes/    # Endpoints
│   │   ├── models/        # SQLAlchemy models
│   │   ├── schemas/       # Pydantic schemas
│   │   └── services/      # Logica de negocio
│   ├── alembic/           # Migraciones DB
│   └── tests/             # Tests unitarios e integracion
│
├── frontend/              # App Desktop (Tauri + React)
│   ├── src/
│   │   ├── pages/         # Vistas principales
│   │   ├── components/    # Componentes React
│   │   ├── services/      # API clients
│   │   └── stores/        # Estado Zustand
│   └── src-tauri/         # Configuracion Tauri
│
├── web-portal/            # Portal Web (Next.js)
│   ├── app/               # App Router pages
│   ├── components/        # Componentes React
│   └── lib/               # Utilidades y API
│
└── docs/                  # Documentacion
```

## Desarrollo Local

### Requisitos

- Python 3.10+
- Node.js 18+
- Rust (para Tauri)
- PostgreSQL 15 (o Docker)

### Setup

```bash
# Clonar repositorio
git clone https://github.com/Samsuesca/uniformes-system-v2.git
cd uniformes-system-v2

# Backend
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Editar .env con credenciales de DB
uvicorn app.main:app --reload

# Frontend (otra terminal)
cd frontend
npm install
npm run tauri:dev

# Web Portal (otra terminal)
cd web-portal
npm install
npm run dev
```

### URLs Desarrollo

| Servicio | URL |
|----------|-----|
| Backend API | http://localhost:8000 |
| API Docs | http://localhost:8000/docs |
| Web Portal | http://localhost:3000 |
| Desktop App | Ventana nativa |

## Produccion

### URLs Produccion

| Servicio | URL |
|----------|-----|
| API | https://api.yourdomain.com |
| Portal Web | https://yourdomain.com |
| Servidor | 104.156.247.226 |

### Desplegar Cambios

```bash
# Backend (en servidor)
cd /var/www/uniformes-system-v2
git pull origin main
systemctl restart uniformes-api

# Web Portal (en servidor)
cd /var/www/uniformes-system-v2/web-portal
npm run build
pm2 restart web-portal

# Ver logs
journalctl -u uniformes-api -f
```

### Build App Desktop

```bash
cd frontend
npm run tauri build

# Instaladores generados en:
# src-tauri/target/release/bundle/msi/   (Windows)
# src-tauri/target/release/bundle/dmg/   (macOS)
```

## Base de Datos

### Migraciones

```bash
cd backend
source venv/bin/activate

# Crear migracion
alembic revision --autogenerate -m "descripcion"

# Aplicar migraciones
alembic upgrade head

# Rollback
alembic downgrade -1
```

### Conexion

```
Host: localhost (dev) / 104.156.247.226 (prod)
Port: 5432
Database: uniformes_db
User: uniformes_user
```

## Contabilidad Global

El sistema maneja contabilidad a nivel de **negocio**, no por colegio:

- **Una sola Caja** y **un solo Banco**
- Colegios son fuentes de ingreso (filtros para reportes)
- Endpoints en `/api/v1/global/accounting/*`

```python
# school_id es OPCIONAL en:
- Expenses (gastos)
- Transactions
- AccountsReceivable (CxC)
- AccountsPayable (CxP)
```

## Tests

```bash
cd backend
source venv/bin/activate
pytest

# Con coverage
pytest --cov=app --cov-report=html
```

## Git Workflow

```bash
# Desarrollo en develop
git checkout develop
git pull origin develop

# Nueva feature
git checkout -b feature/nombre
# ... cambios ...
git add . && git commit -m "feat: descripcion"
git push -u origin feature/nombre

# Merge a main para produccion
git checkout main
git merge develop
git push origin main
```

## Documentacion

- [CLAUDE.md](CLAUDE.md) - Contexto del proyecto para AI
- [docs/CLOUD_DEPLOYMENT.md](docs/CLOUD_DEPLOYMENT.md) - Guia de despliegue
- [docs/SALE_CHANGES.md](docs/SALE_CHANGES.md) - Sistema de cambios/devoluciones
- [docs/GIT_WORKFLOW.md](docs/GIT_WORKFLOW.md) - Flujo de trabajo Git

## Autor

**Angel Samuel Suesca Rios**
- GitHub: [@Samsuesca](https://github.com/Samsuesca)

## Licencia

MIT License
