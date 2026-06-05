# Deployment

Guias de configuracion y despliegue en produccion.

---

## Contenido

| Documento | Descripcion |
|-----------|-------------|
| [pnpm-deploy-runbook.md](./pnpm-deploy-runbook.md) | **Runbook del primer deploy pnpm** (prerequisitos Node 22 + corepack, pasos, rollback) |
| [cloud-deployment-guide.md](./cloud-deployment-guide.md) | Guia completa de despliegue en VPS |
| [infrastructure-architecture.md](./infrastructure-architecture.md) | Arquitectura de infraestructura |

---

## Informacion del Servidor

| Parametro | Valor |
|-----------|-------|
| **Proveedor** | Vultr |
| **IP** | 104.156.247.226 |
| **Dominio** | yourdomain.com |
| **OS** | Ubuntu 22.04 |
| **Costo** | ~$8-15 USD/mes |

---

## Servicios en Produccion

| Servicio | Puerto | Estado |
|----------|--------|--------|
| Nginx | 80, 443 | Activo |
| Backend API | 8000 | systemd |
| Web Portal (PM2) | 3000 | Activo |
| Admin Portal (PM2) | 3001 | Activo |
| PostgreSQL (Docker) | 5432 | Activo |
| Redis | 6379 | Activo |

## Apps Cliente

| App | Tecnologia | Distribucion |
|-----|------------|--------------|
| Desktop | Tauri 2.x + React 18 | Instaladores (Windows/Mac) |
| Mobile | Expo SDK 54 + React Native 0.81 | EAS Build (iOS/Android) — MVP |

---

## Comandos Utiles

```bash
# Conectar al servidor
ssh root@104.156.247.226

# Deploy rapido (produccion usa branch main)
ssh root@104.156.247.226 "cd /var/www/uniformes-system-v2 && git pull origin main && systemctl restart uniformes-api"

# Ver logs
ssh root@104.156.247.226 "tail -100 /var/log/uniformes/backend.log"

# Restart servicios
ssh root@104.156.247.226 "systemctl restart uniformes-api"
```

---

## SSL/HTTPS

- Certificado: Let's Encrypt (Certbot)
- Renovacion automatica configurada
- Dominio: https://yourdomain.com

---

[← Volver al indice](../README.md)
