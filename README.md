# Uniformes Consuelo Rios — Multi-Tenant POS & ERP

![Python](https://img.shields.io/badge/Python-3.10+-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React_18-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL_15-4169E1?logo=postgresql&logoColor=white)
![Tauri](https://img.shields.io/badge/Tauri_2.0-FFC131?logo=tauri&logoColor=black)
![Next.js](https://img.shields.io/badge/Next.js_14-000000?logo=next.js&logoColor=white)
![Tests](https://img.shields.io/badge/Tests-284_passing-brightgreen)

**Live:** [yourdomain.com](https://yourdomain.com)

Production multi-tenant point-of-sale and ERP system for school uniform retailers. Serves **4+ school organizations** with complete data isolation, a native desktop app for in-store operations, and a public e-commerce storefront — all powered by a unified backend API.

## Architecture

```
                    ┌──────────────────────┐
                    │    PostgreSQL 15      │
                    │  (Row-level tenancy)  │
                    └──────────┬───────────┘
                               │
                    ┌──────────┴───────────┐
                    │   FastAPI Backend     │
                    │   18+ REST endpoints  │
                    │   284 unit tests      │
                    └──┬───────────────┬───┘
                       │               │
          ┌────────────┴──┐     ┌──────┴────────────┐
          │  Desktop ERP  │     │  E-Commerce Portal │
          │  Tauri + React│     │  Next.js 14        │
          │  (in-store)   │     │  (parents/public)  │
          └───────────────┘     └───────────────────┘
```

## Key Features

- **Multi-Tenant Isolation** — Shared database with row-level tenant filtering via SQLAlchemy scoped sessions. Each school sees only its data.
- **Desktop POS** — Native cross-platform app (Tauri 2.0 + Rust + React) for in-store sales, orders, returns, and inventory management.
- **E-Commerce Portal** — Next.js 14 storefront with real-time inventory sync, online ordering, and product catalog for parents.
- **Global Accounting** — Single cash register and bank across all tenants; schools serve as revenue sources with per-school reporting filters.
- **Inventory System** — Stock tracking by school, garment type, and size. Automatic adjustments on sales, returns, and transfers.
- **Orders & Returns** — Custom order management with status tracking, exchanges, and automatic inventory reconciliation.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | FastAPI, Python 3.10+, SQLAlchemy 2.0 (async), Pydantic v2, Alembic |
| **Database** | PostgreSQL 15 with row-level tenant isolation |
| **Desktop** | Tauri 2.0 + Rust, React 18, TypeScript, Tailwind CSS, Zustand |
| **Web Portal** | Next.js 14 (App Router), TypeScript, Tailwind CSS |
| **Infrastructure** | Linux VPS, Docker, Nginx, systemd, SSL/TLS, GitHub Actions CI/CD |
| **Testing** | pytest — 284 tests, >90% coverage on critical paths |

## Project Structure

```
uniformes-system-v2/
├── backend/                # FastAPI REST API
│   ├── app/
│   │   ├── api/routes/     # 18+ endpoint modules
│   │   ├── models/         # SQLAlchemy models (tenant-aware)
│   │   ├── schemas/        # Pydantic v2 schemas
│   │   └── services/       # Business logic layer
│   ├── alembic/            # Database migrations
│   └── tests/              # 284 unit + integration tests
├── frontend/               # Desktop ERP (Tauri + React)
│   ├── src/
│   │   ├── pages/          # Main views (POS, inventory, orders)
│   │   ├── components/     # Reusable React components
│   │   ├── services/       # API client layer
│   │   └── stores/         # Zustand state management
│   └── src-tauri/          # Rust backend (Tauri)
├── web-portal/             # E-Commerce (Next.js 14)
│   ├── app/                # App Router pages
│   ├── components/         # UI components
│   └── lib/                # Utilities and API clients
└── docs/                   # Technical documentation
```

## Quick Start

```bash
# Clone
git clone https://github.com/Samsuesca/uniformes-system-v2.git
cd uniformes-system-v2

# Backend
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # Configure database credentials
alembic upgrade head
uvicorn app.main:app --reload

# Desktop App (separate terminal)
cd frontend
npm install
npm run tauri dev

# Web Portal (separate terminal)
cd web-portal
npm install
npm run dev
```

| Service | URL |
|---------|-----|
| Backend API | http://localhost:8000 |
| API Docs (Swagger) | http://localhost:8000/docs |
| Web Portal | http://localhost:3000 |
| Desktop App | Native window |

## Tests

```bash
cd backend
pytest                          # Run all 284 tests
pytest --cov=app --cov-report=html  # With coverage report
```

## Author

**Angel Samuel Suesca Rios** — [@Samsuesca](https://github.com/Samsuesca)

## License

MIT
