# Desarrollo

Guias para configuracion del entorno de desarrollo local.

---

## Contenido

| Documento | Descripcion |
|-----------|-------------|
| [setup-guide.md](./setup-guide.md) | Configuracion del entorno local |
| [git-workflow.md](./git-workflow.md) | Flujo de trabajo con Git/GitHub |
| [coding-conventions.md](./coding-conventions.md) | Estandares de codigo |

---

## Inicio Rapido

### Requisitos

- Python 3.10+
- Node.js 18+
- PostgreSQL 15
- Redis
- Rust (para Tauri)

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Frontend (Tauri)

```bash
cd frontend
npm install
npm run tauri:dev
```

### Portal Web

```bash
cd web-portal
npm install
npm run dev
```

---

## Estructura de Branches

| Branch | Proposito |
|--------|-----------|
| `main` | Produccion estable |
| `develop` | Desarrollo activo |
| `feature/*` | Nuevas funcionalidades |
| `bugfix/*` | Correcciones de bugs |
| `hotfix/*` | Fixes urgentes en produccion |

---

## Variables de Entorno

Copiar `.env.example` a `.env` y configurar:

```bash
DATABASE_URL=postgresql+asyncpg://user:pass@localhost/uniformes
SECRET_KEY=your-secret-key
ENVIRONMENT=development
```

---

[← Volver al indice](../README.md)
