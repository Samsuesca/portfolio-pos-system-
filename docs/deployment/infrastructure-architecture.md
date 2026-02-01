# Arquitectura de Despliegue - Uniformes System v2.0

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
                    │  ┌─────────────────┐    │
                    │  │   PostgreSQL    │    │
                    │  │     (Docker)    │    │
                    │  └─────────────────┘    │
                    └─────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│  Desktop App  │   │  Web Portal   │   │ Admin Portal  │
│    (Tauri)    │   │   (Next.js)   │   │   (Next.js)   │
│  Windows/Mac  │   │  Puerto 3000  │   │  Puerto 3001  │
└───────────────┘   └───────────────┘   └───────────────┘
```

### Dominios y URLs

| Componente | URL | Puerto |
|------------|-----|--------|
| API Backend | `api.yourdomain.com` | 8000 |
| Web Portal (Clientes) | `yourdomain.com` | 3000 |
| Admin Portal | `admin.yourdomain.com` | 3001 |
| Desktop App | Conecta a API via HTTPS | - |

---

## Componentes del Sistema

### 1. Backend API (FastAPI)

**Ubicacion:** `/backend/`

**Stack:**
- Python 3.10+
- FastAPI 0.104.1
- SQLAlchemy 2.0 (async)
- PostgreSQL 15
- Alembic (migraciones)
- Pydantic v2

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
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/uniformes_db
SECRET_KEY=<jwt-secret>
CORS_ORIGINS=["https://yourdomain.com","https://admin.yourdomain.com"]
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
- Gestion de usuarios y roles
- Cuentas de pago
- Zonas de entrega
- Productos e inventario
- Contabilidad (gastos, balances)

**PM2 Config:**
```bash
pm2 start npm --name "uniformes-admin" -- start -- -p 3001
```

### 4. Desktop App (Tauri)

**Ubicacion:** `/frontend/`

**Stack:**
- Tauri (Rust + WebView)
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

### Deploy Completo

```bash
# SSH al servidor
ssh root@104.156.247.226

# Pull cambios
cd /var/www/uniformes-system-v2
git pull origin develop

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
npm run build
pm2 restart uniformes-admin
```

### Deploy Rapido (Solo Frontend)

```bash
# Desde local - una linea
ssh root@104.156.247.226 "cd /var/www/uniformes-system-v2 && git pull origin develop && cd admin-portal && npm run build && pm2 restart uniformes-admin"
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
│   │   ├── services/          # Business logic
│   │   └── main.py            # Entry point
│   ├── alembic/               # Migraciones DB
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
│   │       ├── schools/
│   │       ├── users/
│   │       ├── products/
│   │       ├── payment-accounts/
│   │       ├── delivery-zones/
│   │       └── accounting/
│   ├── lib/
│   │   ├── adminAuth.ts       # Auth store
│   │   ├── api.ts             # API client
│   │   └── services/          # API services
│   └── package.json
│
└── docs/                       # Documentacion
```

---

## Seguridad

### Implementado

- HTTPS obligatorio (SSL/TLS)
- JWT con expiracion (tokens)
- Passwords hasheados (bcrypt)
- CORS configurado por dominio
- Autenticacion de superuser para admin portal
- Validacion de datos con Pydantic

### Configuracion CORS (Backend)

```python
# app/main.py
CORS_ORIGINS = [
    "https://yourdomain.com",
    "https://www.yourdomain.com",
    "https://admin.yourdomain.com",
    "https://api.yourdomain.com",
    "http://localhost:3000",
    "http://localhost:3001",
    "tauri://localhost",
]
```

---

## Monitoreo y Logs

### Ubicacion de Logs

```bash
# Backend API
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
git push origin develop
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

1. Verificar que el dominio este en CORS_ORIGINS del backend
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

---

## Desarrollo Local

### Backend

```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

### Web Portal

```bash
cd web-portal
npm run dev
```

### Admin Portal

```bash
cd admin-portal
npm run dev
```

### Desktop App

```bash
cd frontend
npm run tauri:dev
```

---

## Contacto y Soporte

**Desarrollador:** Angel Samuel Suesca Rios
**GitHub:** https://github.com/Samsuesca
**Servidor:** 104.156.247.226
**Dominio:** yourdomain.com

---

**Ultima actualizacion:** 2026-01-10
**Version:** v2.0.0
**Estado:** EN PRODUCCION
