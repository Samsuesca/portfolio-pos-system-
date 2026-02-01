# Cloud Deployment Guide

## Pre-requisitos

### Sistema Verificado
- [x] 117 tests pasando
- [x] 3 colegios configurados (Caracas, Pinal, Pumarejo)
- [x] 292 productos con precios actualizados
- [x] Sistema de entornos (LOCAL/LAN/CLOUD)
- [x] Variables de entorno preparadas

### Datos en BD Local
| Item | Cantidad |
|------|----------|
| Colegios | 3 (+ 1 Demo) |
| Tipos de Prenda | 27 |
| Productos | 292 |
| Inventario | 292 registros |

---

## Opciones de Deployment

### Opción 1: VPS (Recomendado)
- **Costo**: $5-20/mes
- **Proveedores**: DigitalOcean, Linode, Vultr, Hetzner
- **Ventajas**: Control total, costo fijo
- **Requisitos**: Ubuntu 22.04, 2GB RAM, 50GB SSD

### Opción 2: PaaS
- **Proveedores**: Railway, Render, Fly.io
- **Costo**: $5-25/mes según uso
- **Ventajas**: Deployment automático, menos mantenimiento

### Opción 3: AWS/GCP/Azure
- **Costo**: Variable ($10-50+/mes)
- **Ventajas**: Escalabilidad, servicios integrados

---

## Arquitectura Cloud

```
┌─────────────────────────────────────────────────────┐
│                    INTERNET                         │
└─────────────────────┬───────────────────────────────┘
                      │
        ┌─────────────▼─────────────┐
        │      Nginx (Reverse      │
        │         Proxy)           │
        │   - SSL/TLS (Let's       │
        │     Encrypt)             │
        │   - Rate Limiting        │
        └─────────────┬────────────┘
                      │
     ┌────────────────┼────────────────┐
     │                │                │
     ▼                ▼                ▼
┌─────────┐    ┌─────────────┐   ┌─────────┐
│ FastAPI │    │ PostgreSQL  │   │  Redis  │
│ Backend │◄──►│   Database  │   │ (Cache) │
│ :8000   │    │   :5432     │   │  :6379  │
└─────────┘    └─────────────┘   └─────────┘

App Tauri (Desktop) ──► https://api.uniformes-system.com
```

---

## Pasos de Deployment (VPS)

### 1. Preparar VPS

```bash
# Conectar al servidor
ssh root@YOUR_SERVER_IP

# Actualizar sistema
apt update && apt upgrade -y

# Instalar dependencias
apt install -y python3.11 python3.11-venv python3-pip \
    postgresql postgresql-contrib redis-server \
    nginx certbot python3-certbot-nginx git
```

### 2. Configurar PostgreSQL

```bash
# Crear usuario y base de datos
sudo -u postgres psql

CREATE USER uniformes_user WITH PASSWORD 'YOUR_SECURE_PASSWORD';
CREATE DATABASE uniformes_db OWNER uniformes_user;
GRANT ALL PRIVILEGES ON DATABASE uniformes_db TO uniformes_user;
\q
```

### 3. Clonar y Configurar Backend

```bash
# Clonar repositorio
cd /var/www
git clone https://github.com/Samsuesca/uniformes-system-v2.git
cd uniformes-system-v2/backend

# Crear entorno virtual
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Configurar variables de entorno
cp .env.production .env
nano .env  # Editar con valores reales
```

### 4. Ejecutar Migraciones

```bash
cd /var/www/uniformes-system-v2/backend
source venv/bin/activate

# Aplicar migraciones
alembic upgrade head

# Crear superusuario inicial
python seed_data.py
```

### 5. Configurar Systemd Service

```bash
# Crear archivo de servicio
sudo nano /etc/systemd/system/uniformes-api.service
```

```ini
[Unit]
Description=Uniformes System API
After=network.target postgresql.service

[Service]
User=www-data
Group=www-data
WorkingDirectory=/var/www/uniformes-system-v2/backend
Environment="PATH=/var/www/uniformes-system-v2/backend/venv/bin"
ExecStart=/var/www/uniformes-system-v2/backend/venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
# Habilitar y arrancar servicio
sudo systemctl daemon-reload
sudo systemctl enable uniformes-api
sudo systemctl start uniformes-api
sudo systemctl status uniformes-api
```

### 6. Configurar Nginx

```bash
sudo nano /etc/nginx/sites-available/uniformes-api
```

```nginx
server {
    listen 80;
    server_name api.uniformes-system.com;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
# Habilitar sitio
sudo ln -s /etc/nginx/sites-available/uniformes-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 7. Configurar SSL

```bash
sudo certbot --nginx -d api.uniformes-system.com
```

### 8. Migrar Datos de Producción

```bash
# Desde la máquina local, exportar datos
docker exec docker-postgres-1 pg_dump -U uniformes_user uniformes_db > backup.sql

# Copiar al servidor
scp backup.sql root@YOUR_SERVER_IP:/tmp/

# En el servidor, importar
sudo -u postgres psql uniformes_db < /tmp/backup.sql
```

---

## Configurar Frontend (App Tauri)

### Actualizar URL del servidor

1. Editar `frontend/src/config/environments.ts`:
```typescript
export const ENVIRONMENTS = {
  LOCAL: 'http://localhost:8000',
  LAN: 'http://192.168.18.48:8000',
  CLOUD: 'https://api.uniformes-system.com',  // ← URL real
} as const;
```

2. Compilar app para distribución:
```bash
cd frontend
npm run tauri:build
```

3. Distribuir instalador desde `frontend/src-tauri/target/release/bundle/`

---

## Checklist Post-Deployment

- [ ] API responde en https://api.uniformes-system.com/api/v1/health
- [ ] Login funciona desde app Tauri
- [ ] CORS configurado correctamente
- [ ] SSL funcionando (candado verde)
- [ ] Backups automáticos configurados
- [ ] Monitoreo configurado (opcional)

---

## Comandos Útiles

```bash
# Ver logs del API
sudo journalctl -u uniformes-api -f

# Reiniciar servicio
sudo systemctl restart uniformes-api

# Ver estado de nginx
sudo systemctl status nginx

# Renovar certificado SSL (automático, pero por si acaso)
sudo certbot renew

# Backup manual de BD
pg_dump -U uniformes_user uniformes_db > backup_$(date +%Y%m%d).sql
```

---

## Seguridad

1. **Firewall**: Solo puertos 22, 80, 443 abiertos
2. **SSH**: Usar llaves, deshabilitar password auth
3. **PostgreSQL**: Solo conexiones locales
4. **SECRET_KEY**: Generar nuevo para producción
5. **Contraseñas**: Cambiar todas las por defecto

---

## Costos Estimados

| Servicio | Costo Mensual |
|----------|---------------|
| VPS (2GB RAM) | $6-12 USD |
| Dominio (.com) | $12/año |
| SSL | Gratis (Let's Encrypt) |
| **Total** | ~$8-15 USD/mes |
