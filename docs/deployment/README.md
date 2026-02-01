# Deployment

Guias de configuracion y despliegue en produccion.

---

## Contenido

| Documento | Descripcion |
|-----------|-------------|
| [cloud-deployment-guide.md](./cloud-deployment-guide.md) | Guia completa de despliegue en VPS |
| [infrastructure-architecture.md](./infrastructure-architecture.md) | Arquitectura de infraestructura |

---

## Informacion del Servidor

| Parametro | Valor |
|-----------|-------|
| **Proveedor** | Vultr |
| **IP** | 104.156.247.226 |
| **Dominio** | uniformesconsuelo.com |
| **OS** | Ubuntu 22.04 |
| **Costo** | ~$8-15 USD/mes |

---

## Servicios en Produccion

| Servicio | Puerto | Estado |
|----------|--------|--------|
| Nginx | 80, 443 | Activo |
| Backend API | 8000 | systemd |
| PostgreSQL | 5432 | Activo |
| Redis | 6379 | Activo |

---

## Comandos Utiles

```bash
# Conectar al servidor
ssh root@104.156.247.226

# Deploy rapido
ssh root@104.156.247.226 "cd /var/www/uniformes-system-v2 && git pull origin develop && systemctl restart uniformes-api"

# Ver logs
ssh root@104.156.247.226 "tail -100 /var/log/uniformes/backend.log"

# Restart servicios
ssh root@104.156.247.226 "systemctl restart uniformes-api"
```

---

## SSL/HTTPS

- Certificado: Let's Encrypt (Certbot)
- Renovacion automatica configurada
- Dominio: https://uniformesconsuelo.com

---

[← Volver al indice](../README.md)
