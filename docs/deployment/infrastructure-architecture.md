# Arquitectura de Despliegue - Uniformes System v2.9

## Vision General

Sistema de gestion de uniformes profesional con arquitectura multi-tenant desplegado en produccion.

### Arquitectura Actual (EN PRODUCCION)

```
                         SERVIDOR VPS (Vultr)
                         104.156.247.226
                    ┌─────────────────────────┐
                    │      Ubuntu 22.04       │
                    │                         │
                    │  ┌─────────────────┐    │
                    │  │     Nginx       │    │
                    │  │  (Reverse Proxy)│    │
                    │  └────────┬────────┘    │
                    │           │             │
                    │     ┌─────┴─────┐       │
                    │     │           │       │
                    │  ┌──▼──┐    ┌──▼──┐    │
                    │  │:8000│    │:3000│    │
                    │  │ API │    │:3001│    │
                    │  └─────┘    │Webs │    │
                    │             └─────┘    │
                    │                         │
                    │  ┌──────────┐ ┌──────┐ │
                    │  │PostgreSQL│ │Redis │ │
                    │  │ (Docker) │ │      │ │
                    │  └──────────┘ └──────┘ │
                    └─────────────────────────┘
                              │
        ┌──────────────┬──────┴───────┬──────────────┐
        │              │              │              │
        ▼              ▼              ▼              ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ Desktop App │ │ Web Portal  │ │Admin Portal │ │ Mobile App  │
│   (Tauri)   │ │  (Next.js)  │ │  (Next.js)  │ │   (Expo)    │
│ Windows/Mac │ │ Puerto 3000 │ │ Puerto 3001 │ │  iOS/Android│
└─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘
```

### Dominios y URLs

| Componente | URL | Puerto |
|------------|-----|--------|
| API Backend | `api.yourdomain.com` | 8000 |
| Web Portal (Clientes) | `yourdomain.com` | 3000 |
| Admin Portal | `admin.yourdomain.com` | 3001 |
| Desktop App (Tauri) | Conecta a API via HTTPS | - |
| Mobile App (Expo) | Conecta a API via HTTPS | - |

---

## Componentes del Sistema

### 1. Backend API (FastAPI)

**Ubicacion:** `/backend/`

**Stack:**
- Python 3.10+
- FastAPI 0.115.6
- SQLAlchemy 2.0.36 (async)
- Pydantic 2.10.4
- PostgreSQL 15
- Redis 5.2.1
- Alembic (migraciones)
- structlog 24.4.0 (logging estructurado)
- httpx 0.28.1 (cliente Wompi)

**Integraciones:**
- Wompi Payment Gateway (pagos en linea)
- Telegram Bot API (alertas operacionales)
- Google Auth (login federado opcional)

**Configuracion de Produccion:**
```bash
# Servicio systemd
/etc/systemd/system/uniformes-api.service

# Configuracion
WorkingDirectory=/var/www/uniformes-system-v2/backend
ExecStart=/var/www/uniformes-system-v2/backend/venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
```

**Variables de Entorno (`.env`):**
```env
# Database & Cache
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/uniformes_db
REDIS_URL=redis://localhost:6379

# Auth
SECRET_KEY=<jwt-secret>

# CORS
BACKEND_CORS_ORIGINS=["https://yourdomain.com","https://www.yourdomain.com","https://admin.yourdomain.com","https://api.yourdomain.com"]

# Wompi Payment Gateway
WOMPI_ENABLED=true
WOMPI_ENVIRONMENT=production
WOMPI_PUBLIC_KEY=pub_prod_xxx
WOMPI_PRIVATE_KEY=prv_prod_xxx
WOMPI_EVENTS_KEY=stagtest_events_xxx
WOMPI_INTEGRITY_KEY=integrity_xxx
WOMPI_REDIRECT_URL=https://yourdomain.com/pago/resultado

# Telegram Alerts
TELEGRAM_BOT_TOKEN=<bot-token>
TELEGRAM_CHAT_ID=<chat-id>
```

### 2. Web Portal - Clientes (Next.js)

**Ubicacion:** `/web-portal/`

**Stack:**
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Zustand (estado)

**Funcionalidades:**
- Catalogo de productos por colegio
- Carrito de compras
- Sistema de pedidos web
- Verificacion telefonica
- Seleccion de zona de entrega
- Pagos en linea via Wompi

**PM2 Config:**
```bash
pm2 start npm --name "uniformes-web" -- start -- -p 3000
```

### 3. Admin Portal (Next.js)

**Ubicacion:** `/admin-portal/`

**Stack:**
- Next.js 16 (App Router)
- TypeScript
- Tailwind CSS
- Zustand (estado)

**Funcionalidades:**
- Dashboard de administracion
- Gestion de colegios (CRUD)
- Gestion de usuarios y roles (sistema de permisos granular)
- Cuentas de pago
- Zonas de entrega
- Productos e inventario
- Contabilidad (gastos, balances)
- Suscripciones a alertas Telegram

**PM2 Config:**
```bash
pm2 start npm --name "uniformes-admin" -- start -- -p 3001
```

### 4. Desktop App (Tauri)

**Ubicacion:** `/frontend/`

**Stack:**
- Tauri 2.x (Rust + WebView)
- React 18 + TypeScript
- Tailwind CSS
- Zustand (estado)
- Axios

**Funcionalidades:**
- POS completo de ventas
- Gestion de inventario
- Sistema de cambios/devoluciones
- Impresion de recibos
- Encargos personalizados
- Contabilidad global

### 5. Mobile App (Expo) — MVP

**Ubicacion:** `/mobile/`

**Stack:**
- Expo SDK 54
- React Native 0.81
- expo-router v6
- NativeWind (Tailwind para RN)
- EAS Build / Workflows

**Funcionalidades (MVP):**
- Auth (login)
- Ventas (crear/listar)
- Clientes
- Inventario (consulta)
- Pedidos

**Distribucion:**
- iOS/Android via EAS Build

---

## Infraestructura de Servidor

### VPS (Vultr)

**Especificaciones:**
- **IP:** 104.156.247.226
- **OS:** Ubuntu 22.04 LTS
- **RAM:** 2GB
- **CPU:** 1 vCPU
- **Storage:** 55GB NVMe

**Costos:**
- Servidor: ~$12/mes
- Dominio: ~$10/year
- SSL: Gratuito (Let's Encrypt)

### Nginx Configuration

**Archivo:** `/etc/nginx/sites-available/uniformes`

```nginx
# API Backend
server {
    listen 443 ssl;
    server_name api.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# Web Portal (Clientes)
server {
    listen 443 ssl;
    server_name yourdomain.com www.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# Admin Portal
server {
    listen 443 ssl;
    server_name admin.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/admin.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/admin.yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# HTTP to HTTPS redirects
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com api.yourdomain.com admin.yourdomain.com;
    return 301 https://$host$request_uri;
}
```

### PostgreSQL (Docker)

```bash
# Docker container
docker run -d \
  --name uniformes-postgres \
  -e POSTGRES_USER=uniformes \
  -e POSTGRES_PASSWORD=<password> \
  -e POSTGRES_DB=uniformes_db \
  -p 5432:5432 \
  -v postgres_data:/var/lib/postgresql/data \
  postgres:15
```

### PM2 Process Manager

```bash
# Ver procesos
pm2 list

# Procesos activos:
# - uniformes-web (puerto 3000)
# - uniformes-admin (puerto 3001)

# Logs
pm2 logs uniformes-web
pm2 logs uniformes-admin

# Restart
pm2 restart all
```

### Systemd Service (Backend)

```ini
# /etc/systemd/system/uniformes-api.service
[Unit]
Description=Uniformes API
After=network.target

[Service]
User=root
WorkingDirectory=/var/www/uniformes-system-v2/backend
ExecStart=/var/www/uniformes-system-v2/backend/venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

---

## Comandos de Deployment

> **Branch de produccion:** `main` (NO `develop`).
> Todo deploy a produccion debe partir de `main`.

### Deploy Completo

```bash
# SSH al servidor
ssh root@104.156.247.226

# Pull cambios
cd /var/www/uniformes-system-v2
git pull origin main

# Backend (si hay cambios)
cd backend
source venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
systemctl restart uniformes-api

# Web Portal (si hay cambios)
cd ../web-portal
npm install
npm run build
pm2 restart uniformes-web

# Admin Portal (si hay cambios)
cd ../admin-portal
npm install
npm run build
pm2 restart uniformes-admin
```

### Deploy Rapido (Solo Frontend)

```bash
# Desde local - una linea
ssh root@104.156.247.226 "cd /var/www/uniformes-system-v2 && git pull origin main && cd admin-portal && npm run build && pm2 restart uniformes-admin"
```

### Verificar Estado

```bash
# Servicios
systemctl status uniformes-api
pm2 status

# Logs
journalctl -u uniformes-api -f
pm2 logs

# Nginx
nginx -t
systemctl status nginx
```

---

## SSL/HTTPS (Certbot)

### Certificados Instalados

```bash
# Listar certificados
certbot certificates

# Certificados:
# - api.yourdomain.com
# - yourdomain.com
# - admin.yourdomain.com
```

### Renovacion Automatica

```bash
# Cron job (automatico)
certbot renew --quiet

# Renovar manualmente
certbot renew

# Nuevo certificado
certbot --nginx -d nuevo-subdominio.yourdomain.com
```

---

## DNS Configuration (Cloudflare/Registrador)

```
Tipo    Nombre    Contenido          TTL
A       @         104.156.247.226    Auto
A       www       104.156.247.226    Auto
A       api       104.156.247.226    Auto
A       admin     104.156.247.226    Auto
```

---

## Estructura del Proyecto

```
uniformes-system-v2/
├── backend/                    # API FastAPI
│   ├── app/
│   │   ├── api/routes/        # Endpoints
│   │   ├── models/            # SQLAlchemy models
│   │   ├── schemas/           # Pydantic schemas
│   │   ├── services/          # Business logic (wompi, telegram, etc.)
│   │   ├── core/              # Config, security
│   │   ├── utils/             # Timezone, helpers
│   │   └── main.py            # Entry point
│   ├── alembic/               # Migraciones DB
│   ├── tests/                 # pytest (284+ tests)
│   ├── requirements.txt
│   └── .env                   # Variables (gitignored)
│
├── frontend/                   # Desktop App (Tauri)
│   ├── src/
│   │   ├── pages/             # React pages
│   │   ├── components/        # UI components
│   │   ├── services/          # API clients
│   │   └── stores/            # Zustand stores
│   ├── src-tauri/             # Rust backend
│   └── package.json
│
├── web-portal/                 # Portal Clientes (Next.js)
│   ├── app/                   # App Router pages
│   │   └── [school_slug]/     # Rutas por colegio
│   ├── lib/                   # Utilities
│   └── package.json
│
├── admin-portal/               # Panel Admin (Next.js)
│   ├── app/
│   │   ├── login/             # Pagina login
│   │   └── (dashboard)/       # Rutas protegidas
│   ├── lib/                   # Auth, API client, services
│   └── package.json
│
├── mobile/                     # Mobile App (Expo SDK 54)
│   ├── app/                   # expo-router v6 pages
│   ├── assets/
│   ├── eas.json               # EAS Build / Workflows
│   └── app.json
│
├── shared/                     # Codigo compartido entre apps
├── scripts/                    # dev.sh, migrate.sh, test.sh
├── docker/                     # Dockerfiles y compose
├── docs/                       # Documentacion
├── logs/                       # Logs locales
├── backups/                    # Backups de BD
└── version.json               # Versiones del sistema
```

---

## Seguridad

### Implementado

- HTTPS obligatorio (SSL/TLS)
- JWT con expiracion (PyJWT + bcrypt directo, sin python-jose ni passlib)
- Passwords hasheados (bcrypt)
- CORS configurado por dominio (allowlist explicita, no `*`)
- Sistema de permisos granular con cache compartido y audit trail
- Validacion de datos con Pydantic v2
- Rate limiting en endpoints publicos
- Verificacion de firma en webhooks (Wompi `WOMPI_EVENTS_KEY`)

### Configuracion CORS (Backend)

```python
# Configurado via BACKEND_CORS_ORIGINS en .env
# Valores tipicos en produccion:
[
    "https://yourdomain.com",
    "https://www.yourdomain.com",
    "https://admin.yourdomain.com",
    "https://api.yourdomain.com",
    "tauri://localhost",
]
```

---

## Monitoreo y Logs

### Logging Estructurado

El backend emite logs JSON con `structlog` (request_id, client_ip, ruta, latencia).
Los logs son consumidos por el VultrUI Log Explorer.

### Ubicacion de Logs

```bash
# Backend API (structlog JSON)
journalctl -u uniformes-api -f
/var/log/uniformes/backend.log

# Web Apps
pm2 logs uniformes-web
pm2 logs uniformes-admin

# Nginx
/var/log/nginx/access.log
/var/log/nginx/error.log

# PostgreSQL
docker logs uniformes-postgres
```

### Comandos Utiles

```bash
# Estado general
systemctl status uniformes-api
pm2 status
docker ps

# Memoria y CPU
htop
free -h
df -h

# Conexiones activas
netstat -tlnp
```

---

## Backups

### Base de Datos

```bash
# Backup manual
docker exec uniformes-postgres pg_dump -U uniformes uniformes_db > backup_$(date +%Y%m%d).sql

# Restaurar
cat backup.sql | docker exec -i uniformes-postgres psql -U uniformes uniformes_db
```

### Codigo

```bash
# Git es el backup del codigo
git push origin main
```

---

## Troubleshooting

### API no responde

```bash
systemctl status uniformes-api
systemctl restart uniformes-api
journalctl -u uniformes-api -n 100
```

### Web Portal no carga

```bash
pm2 status
pm2 restart uniformes-web
pm2 logs uniformes-web --lines 100
```

### Error de CORS

1. Verificar que el dominio este en `BACKEND_CORS_ORIGINS` del backend
2. Reiniciar backend: `systemctl restart uniformes-api`

### Error 502 Bad Gateway

```bash
# Verificar que el servicio este corriendo
systemctl status uniformes-api
pm2 status

# Verificar Nginx
nginx -t
systemctl restart nginx
```

### Certificado SSL expirado

```bash
certbot renew
systemctl restart nginx
```

### Webhook Wompi no llega

```bash
# Verificar que el endpoint este accesible
curl -X POST https://api.yourdomain.com/api/v1/payments/webhooks/wompi

# Revisar logs
journalctl -u uniformes-api -f | grep wompi
```

---

## Desarrollo Local

### Arquitectura Desarrollo vs Produccion

```
┌─────────────────────────────────────────────────────────────┐
│                    PRODUCCION (VPS)                         │
│                    Rama: main                               │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Web Portal   │  │ Admin Portal │  │ Desktop App  │      │
│  │ PM2 :3000    │  │ PM2 :3001    │  │ (conecta)    │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         └─────────────────┼─────────────────┘              │
│                           ▼                                │
│              ┌────────────────────────┐                    │
│              │  Backend API           │                    │
│              │  systemd :8000         │                    │
│              │  api.uniformes...com   │                    │
│              └───────────┬────────────┘                    │
│                          ▼                                 │
│         ┌────────────────────────────────┐                 │
│         │  PostgreSQL (Docker) + Redis   │                 │
│         └────────────────────────────────┘                 │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    DESARROLLO (Local)                       │
│                    Ramas: develop, feature/*, fix/*         │
│                                                             │
│  ┌────────────┐ ┌────────────┐ ┌──────────┐ ┌────────────┐ │
│  │ Web Portal │ │Admin Portal│ │Tauri App │ │ Mobile App │ │
│  │npm dev:3000│ │npm dev:3001│ │tauri:dev │ │ expo start │ │
│  └─────┬──────┘ └─────┬──────┘ └─────┬────┘ └─────┬──────┘ │
│        └──────────────┼──────────────┴────────────┘        │
│                       ▼                                    │
│              ┌────────────────────────┐                    │
│              │  Docker Backend        │                    │
│              │  localhost:8000        │                    │
│              └───────────┬────────────┘                    │
│                          ▼                                 │
│         ┌────────────────────────────────┐                 │
│         │  Docker PostgreSQL + Redis     │                 │
│         │  (copia de datos produccion)   │                 │
│         └────────────────────────────────┘                 │
└─────────────────────────────────────────────────────────────┘
```

### Entorno Docker (Recomendado)

El entorno Docker incluye: PostgreSQL + Redis + Backend FastAPI.

**Iniciar entorno completo:**

```bash
# Desde la raiz del proyecto
./scripts/dev.sh up

# Salida esperada:
# ✓ Entorno de desarrollo iniciado
#   - Backend: http://localhost:8000
#   - PostgreSQL: localhost:5432
#   - Redis: localhost:6379
```

**Comandos disponibles (`./scripts/dev.sh`):**

| Comando | Descripcion |
|---------|-------------|
| `up` | Iniciar todos los contenedores |
| `down` | Detener todos los contenedores |
| `restart` | Reiniciar contenedores |
| `logs [servicio]` | Ver logs (ej: `logs backend`) |
| `ps` | Ver estado de contenedores |
| `db` | Conectar a PostgreSQL (DB desarrollo) |
| `test-db` | Conectar a PostgreSQL (DB tests) |
| `shell` | Abrir shell en contenedor backend |
| `build` | Reconstruir imagen del backend |
| `clean` | Eliminar contenedores y volumenes |

**Migraciones (`./scripts/migrate.sh`):**

| Comando | Descripcion |
|---------|-------------|
| `up` | Aplicar migraciones pendientes |
| `down [n]` | Revertir n migraciones (default: 1) |
| `new "mensaje"` | Crear nueva migracion |
| `history` | Ver historial de migraciones |
| `current` | Ver migracion actual |
| `heads` | Ver cabezas de migracion |

**Tests (`./scripts/test.sh`):**

| Comando | Descripcion |
|---------|-------------|
| `all` | Correr todos los tests |
| `unit` | Solo tests unitarios |
| `api` | Solo tests de API |
| `cov` | Tests con reporte de coverage |
| `fast` | Tests rapidos (sin lentos) |

### Configuracion de Environment

**Web Portal - Desarrollo** (`web-portal/.env.local`):
```env
# Apunta al Docker local
NEXT_PUBLIC_API_URL=http://localhost:8000
```

**Web Portal - Produccion** (`web-portal/.env.production`):
```env
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
```

**Admin Portal - Desarrollo** (`admin-portal/.env.local`):
```env
# Apunta al Docker local
NEXT_PUBLIC_API_URL=http://localhost:8000
```

**Admin Portal - Produccion** (`admin-portal/.env.production`):
```env
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
```

**Tauri Desktop App:**
- Tiene selector de servidor en la UI (Settings)
- Puede apuntar a localhost:8000 o produccion

**Mobile App (Expo):**
- Configura `EXPO_PUBLIC_API_URL` en `mobile/.env` o via `eas.json`

### Iniciar Frontends en Desarrollo

**Paso 1: Iniciar Docker Backend**
```bash
./scripts/dev.sh up
# Esperar a que muestre "Backend: http://localhost:8000"
```

**Paso 2: Iniciar Frontend deseado**

```bash
# Web Portal (puerto 3000)
cd web-portal
npm run dev

# Admin Portal (puerto 3001)
cd admin-portal
npm run dev

# Desktop App (Tauri)
cd frontend
npm run tauri:dev

# Mobile App (Expo)
cd mobile
npx expo start
```

### Iniciar Frontends en Produccion (Build)

**Web Portal:**
```bash
cd web-portal
npm run build
npm start -p 3000
```

**Admin Portal:**
```bash
cd admin-portal
npm run build
npm start -p 3001
```

**Desktop App:**
```bash
cd frontend
npm run tauri:build
# Genera instaladores en frontend/src-tauri/target/release/bundle/
```

**Mobile App (EAS Build):**
```bash
cd mobile
eas build --platform ios
eas build --platform android
```

### Backend Sin Docker (Alternativa)

Si prefieres correr el backend sin Docker:

```bash
# Requiere PostgreSQL y Redis instalados localmente
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

---

## Contacto y Soporte

**Desarrollador:** Angel Samuel Suesca Rios
**GitHub:** https://github.com/Samsuesca
**Servidor:** 104.156.247.226
**Dominio:** yourdomain.com

---

**Ultima actualizacion:** 2026-05-02
**Version:** v2.9.0
**Estado:** EN PRODUCCION
