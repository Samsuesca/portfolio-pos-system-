# Dimensión 7 — Operacional (Continuidad, Procesos, Riesgo Operativo)

> **Última actualización:** 2026-05-04
> **Owner:** Carmen Consuelo Ríos Cartagena (operación de tienda) + Angel Suesca (operación técnica) + (pendiente) Asesor SST/SG-SST
> **Criticidad global:** 🟠 ALTA
> **% Formalización estimado:** 25%
> **Fuentes documentales:** auditoría de código sobre branch `main` (2026-05-04) + `docs/deployment/`, `docs/architecture/`, `backend/scripts/`.

---

## Resumen ejecutivo

UCR tiene una base **técnico-operativa sorprendentemente sólida** comparada con su estado en otras dimensiones (legal, tributaria, comercial). El sistema en producción ya cuenta con:

- Sistema de permisos granulares con audit trail (`docs/architecture/permission-system.md`).
- Logging estructurado JSON consumido por VultrUI Log Explorer.
- Health endpoint con métricas en memoria (24h de samples).
- 18 tipos de alertas Telegram con cooldown anti-spam.
- Monitoreo de DB, disco, memoria, uptime.
- Despliegue documentado en VPS Vultr.

Pero la **continuidad operativa está expuesta** por tres motivos:
1. **Backups manuales** (no automatizados, no probados, no offsite). Un solo `rm` mal puesto o un disk failure borra el negocio.
2. **Single point of failure de infraestructura**: un único VPS sin redundancia ni failover. RTO real desconocido.
3. **Single point of failure humano**: solo Angel sabe administrar el sistema. Si Angel se ausenta, el negocio queda sin capacidad de respuesta técnica.

A nivel de operación física (tienda en Bello), no hay manuales de procedimiento, política de control de acceso, ni protocolos para incidentes (faltante de caja, robo, daño de máquina de costura, etc.).

---

## Marco normativo y de buenas prácticas aplicable

| Norma / Estándar | Aplicación a UCR |
|------------------|------------------|
| **Decreto 1072 de 2015** Libro 2 Parte 2 Título 4 Capítulo 6 (SG-SST) | Sistema de Gestión de Seguridad y Salud en el Trabajo — obligatorio aunque sea PYME (cruzado con dim. 4 laboral) |
| Resolución 0312 de 2019 (SG-SST) | Estándares mínimos según tamaño de empresa (≤10 trabajadores: 7 estándares mínimos) |
| Decreto 1499 de 2017 | Modelo Integrado de Planeación y Gestión (referencia voluntaria PYME) |
| Circular Externa SFC 007 de 2018 | Ciberseguridad — referencia, no obligatoria para UCR |
| ISO 22301 (Continuidad del Negocio) | Voluntario; útil como marco de referencia |
| ISO 27001 (Seguridad de la Información) | Voluntario; obligatorio si v3.2 SaaS atrae clientes con auditorías de proveedor |
| NTC 6001 (Modelo de Gestión para PYMES) | Voluntario, certificable. Da credibilidad B2B |

---

## Estado actual

### Infraestructura técnica

| Componente | Estado | Evidencia |
|------------|--------|-----------|
| Servidor productivo | VPS Vultr 104.156.247.226, Ubuntu 22.04, **único nodo** | [docs/deployment/infrastructure-architecture.md](../../../docs/deployment/infrastructure-architecture.md) |
| Reverse proxy | Nginx con TLS Let's Encrypt | docs/deployment/cloud-deployment-guide.md |
| Backend | FastAPI gestionado por systemd `uniformes-api.service` | docs/deployment/cloud-deployment-guide.md |
| Frontend web | Next.js (web-portal :3000, admin-portal :3001) gestionado por systemd | docs/deployment/cloud-deployment-guide.md |
| Base de datos | PostgreSQL 15 en Docker container `docker-postgres-1` | docs/deployment/cloud-deployment-guide.md |
| Caché | Redis (mismo VPS) | docs/architecture/system-overview.md |
| Pasarela de pagos | Wompi (en producción desde 2026-03-18) | Memoria persistente del proyecto |
| Notificaciones | Telegram Bot — 18 tipos de alertas | [docs/architecture/telegram-alerts-system.md](../../../docs/architecture/telegram-alerts-system.md) |
| Logs | structlog → stdout JSON → consumido por VultrUI Log Explorer | [docs/architecture/logging-and-observability.md](../../../docs/architecture/logging-and-observability.md) |
| Monitoreo | In-memory ring buffer (24h, 1440 samples). Endpoints `/ping` (público) y `/health` (superuser) | [backend/app/services/monitoring.py](../../../backend/app/services/monitoring.py) |
| Auth + permisos | Sistema granular endurecido en `feature/permissions-hardening-v3` (5/2026) | [docs/architecture/permission-system.md](../../../docs/architecture/permission-system.md) |
| Audit trail | Tabla `audit_logs` con `data_before`/`data_after` JSON | [backend/app/models/audit_log.py](../../../backend/app/models/audit_log.py) |
| Despliegue | `git pull && systemctl restart` manual. Sin CI/CD productivo automatizado | docs/deployment/cloud-deployment-guide.md |

### Operación física (tienda Bello)

| Aspecto | Estado |
|---------|--------|
| Local físico | 1 local en CR 56 A 66 89, Barrio Hato Nuevo, Bello |
| Manual de operación de tienda | ❌ No existe |
| Procedimiento de apertura/cierre | ❌ No documentado |
| Procedimiento de cuadre de caja | ⚠️ Funcionalidad técnica existe (`daily_cash_registers`) pero sin manual escrito |
| Control de acceso físico (llaves, alarma) | ❌ No documentado |
| Inventario físico vs. sistémico (kardex) | ⚠️ Tabla `inventory_logs` existe pero sin política de conteos físicos periódicos |
| Recepción de mercancía / proveedores | ❌ Sin procedimiento escrito |
| Despacho a domicilio | ⚠️ Modelo de `delivery_zones` existe; sin manual |
| Atención al cliente (mostrador) | ❌ Sin protocolo escrito |
| Gestión de incidentes (faltantes, robos, daños) | ❌ Sin procedimiento |
| Control de cámaras / videovigilancia | ❌ No documentado (verificar si existen) |
| Plan de evacuación / emergencias | ❌ No documentado |

### Backups y recuperación (CONFIRMADO 2026-05-04 — auditoría server-handler en VPS)

| Aspecto | Estado |
|---------|--------|
| Backup automatizado de DB | ❌ **INEXISTENTE**. Sin crontab para `root` ni para el usuario del backend. Sin systemd timers activos. Sin scripts de backup en `/usr/local/bin/`, `/root/scripts/`, ni en `backend/scripts/` que se ejecute automáticamente. `/etc/cron.daily/` y `/etc/cron.d/` no contienen entradas relacionadas con Postgres |
| Backup de archivos uploads (`/var/www/uniformes-system-v2/uploads/`) | ❌ Sin política de respaldo |
| Frecuencia | ❌ Solo dumps **manuales esporádicos** del owner |
| Retención | ❌ No definida — archivos viejos siguen ocupando disco sin política |
| Almacenamiento offsite | ❌ `rclone`, `restic`, `borg`, `s3cmd`, `aws` **no están instalados** en el VPS. Sin referencia a rsync remoto en ningún cron |
| Cifrado del backup | ❌ Ningún dump tiene extensión `.gpg`, `.enc`, `.aes`. Todos texto plano leíbles por `root` |
| Pruebas de restauración periódicas | ❌ Nunca verificadas formalmente |
| Documentación de procedimiento de restauración | ⚠️ Implícita en `refresh_prod_snapshot.sh` (proceso inverso, descarga local) |

**Dumps existentes en el VPS (auditoría 2026-05-04):**

| Ruta | Fecha | Tamaño | Riesgo |
|------|-------|--------|--------|
| `/tmp/uniformes_prod_20260411.dump` | 12 abr 2026 | 1.5 MB | Más reciente. **~34 días de antigüedad.** En `/tmp` → vulnerable a `systemd-tmpfiles-clean.timer` |
| `/root/backups/uniformes_pre_v244_20260127_074422.sql` | 27 ene 2026 | 2.0 MB | Pre-deploy, no recurrente |
| `/var/backups/uniformes_db_20260121_081634.sql` | 21 ene 2026 | 1.3 MB | Histórico |
| `/tmp/backup_prod_20260121_152530.sql` | 21 ene 2026 | 1.4 MB | En `/tmp` (riesgo igual al de 12-abr) |
| Otros .dump vacíos (0 bytes) y .sql de dic 2025 | dic 2025 | 0–~1 MB | Artefactos rotos |

> **Hallazgo crítico confirmado con evidencia dura:** **el único backup relativamente reciente (12 abr 2026) está en `/tmp/`** y puede ser borrado por el servicio `systemd-tmpfiles-clean.timer` de Ubuntu en cualquier momento. Si eso ocurre antes del próximo dump manual del owner, el VPS pasa a tener **>3 meses de antigüedad** como punto de recuperación. Combinado con la **ausencia total de cifrado de disco** (LUKS/dm-crypt no presentes — `vda2` ext4 puro), cualquier compromiso del VPS o falla de hardware borra prácticamente toda la operación.

### Cifrado de disco (CONFIRMADO 2026-05-04)

| Capa | Estado |
|------|--------|
| LUKS / dm-crypt en `vda2` | ❌ No. `lsblk -f` muestra `ext4` puro, `/etc/crypttab` vacío, `dmsetup status` reporta "No devices found" |
| Filesystem-level (ecryptfs, gocryptfs, age) | ❌ No detectado |
| Cifrado at-rest por Vultr | ❌ Vultr no ofrece cifrado at-rest del disco por defecto |
| Cifrado en aplicación (columnas DB con `pgcrypto`) | ❌ No implementado |

> Implicación: cualquier acceso administrativo al hipervisor (soporte de Vultr, compromiso interno) lee la DB y los dumps directamente en texto claro. Cruzado con `05-datos-personales.md` — riesgo de exposición de PII de clientes, menores y empleados.

### Disaster Recovery (DR)

| Métrica | Objetivo formal | Capacidad real estimada |
|---------|-----------------|-------------------------|
| **RTO** (tiempo máximo de inactividad aceptable) | **No definido** | **>4 horas** (provisionar nuevo VPS, instalar stack, restaurar DB desde último snapshot del owner) |
| **RPO** (cantidad máxima de datos perdidos aceptable) | **No definido** | **24-48 horas** en el peor caso (depende de cuándo el owner haya hecho el último `refresh_prod_snapshot.sh`) |
| Sitio alterno | No existe | — |
| Plan documentado paso a paso | No existe | — |
| Pruebas de DR | Nunca | — |

### Gestión de secretos y configuración

| Aspecto | Estado |
|---------|--------|
| `.env` productivo | En el VPS, no versionado (correcto) |
| Rotación de secretos | ❌ Sin política |
| Inventario de secretos | ❌ No documentado quién los conoce |
| `SECRET_KEY` validación | ✅ `backend/app/core/config.py` valida que no quede en default |
| API keys de terceros (Wompi, Telegram, Resend) | En `.env` sin rotación documentada |
| Credenciales de DB en producción | Solo el owner las conoce |

### Gestión de incidentes técnicos

| Aspecto | Estado |
|---------|--------|
| Canal de alertas técnicas | ✅ Telegram bot (alertas sistema) |
| Log centralizado | ✅ structlog → VultrUI Log Explorer |
| On-call / respuesta 24×7 | ❌ Implícitamente: **solo Angel** |
| Runbook por tipo de incidente | ❌ No existe |
| Post-mortem de incidentes pasados | ❌ No documentado |
| SLA interno de atención | ❌ No definido |

### Continuidad del conocimiento (riesgo SPOF humano)

| Aspecto | Estado |
|---------|--------|
| Documentación de arquitectura | ✅ Sólida en `docs/architecture/` |
| Documentación de despliegue | ✅ Sólida en `docs/deployment/` |
| **Capacidad de un tercero para operar el sistema sin Angel** | ❌ Implícitamente baja: las contraseñas, los detalles del Wompi, la configuración productiva, las APIs de Telegram solo Angel las conoce |
| Bus factor del sistema | **1** |

---

## Gaps identificados

### Gap 7.1 — Backups no automatizados ni offsite 🔴 URGENTE (confirmado 2026-05-04)

**Problema:** auditoría del VPS confirma que la operación entera depende de la integridad del único disco. **Sin backup automatizado, sin cifrado, sin offsite, sin cifrado de disco**, un fallo de hardware o un comando destructivo borra el negocio. El backup más reciente (12-abr-2026) está en `/tmp/` y puede ser borrado por `systemd-tmpfiles-clean.timer` en cualquier momento.

**Riesgo cuantificado:** la DB de prod tiene 1.535 ventas, 306 órdenes, 166 alteraciones, ~$89M en activos contables registrados, y los registros de clientes con PII. Reconstruir esto manualmente desde Wompi + extractos bancarios + memoria es **prácticamente imposible** y, aún siendo posible, perdería 100% de la contabilidad, inventario, encargos y datos de clientes.

**Tiempo de exposición actual:** 34 días desde el último dump (12-abr). Si `/tmp/` se purga antes de la próxima copia manual, el RPO se dispara a >3 meses (último dump persistente del 27-ene en `/root/backups/`).

**Acción inmediata (< 48 horas):**
1. **Mover** `/tmp/uniformes_prod_20260411.dump` a `/root/backups/` o `/var/backups/` para protegerlo de la limpieza automática.
2. Crear un dump fresco manual y guardarlo en ambos: VPS persistente + laptop owner.

**Acción de fondo (< 14 días):**
1. Habilitar **systemd timer diario** (preferible a cron por logging y ergonomía):
   ```
   /etc/systemd/system/ucr-backup.service
   /etc/systemd/system/ucr-backup.timer  (OnCalendar=daily 03:00)
   ```
   con script que ejecute:
   ```bash
   docker exec docker-postgres-1 pg_dump -U uniformes_user uniformes_db | gzip | gpg --encrypt --recipient angel@... > /var/backups/ucr_$(date +%Y%m%d).sql.gz.gpg
   ```
2. Sincronizar a almacenamiento offsite (Vultr Object Storage — mismo proveedor, simple, ~$5 USD/mes por 250 GB; o Backblaze B2 ~$6 USD/TB; o rclone a S3 Glacier).
3. Retención automática: 30 días diarios + 12 meses mensuales + 3 años anuales. Script de limpieza con `find ... -mtime +N -delete`.
4. **Probar restauración mensual**: descargar último backup, descifrar, restaurar en `uniformes_prod_snapshot` local, validar counts contra producción.
5. Backup también de `/var/www/uniformes-system-v2/uploads/` (logos, posibles documentos cargados) — incluir en el mismo job o uno paralelo.
6. Documentar la clave GPG y compartir con Carmen Consuelo en sobre cerrado (cruzado con Gap 7.3 — bus factor).

**Costo:** ~$60–$100 USD/año + 2-3 días de setup inicial.

---

### Gap 7.2 — Sin plan de Disaster Recovery 🟠

**Problema:** RTO y RPO no definidos. Sin documento, ante un incidente real cada decisión se toma en pánico.

**Acción:**
1. Definir **RTO ≤ 4 horas** y **RPO ≤ 24 horas** como objetivos iniciales razonables para el tamaño del negocio.
2. Redactar [docs/operations/disaster-recovery-plan.md](../../../docs/operations/disaster-recovery-plan.md) con:
   - Inventario de servicios y dependencias.
   - Procedimiento paso a paso para reconstruir desde cero (provisionar VPS, instalar stack, restaurar DB, reapuntar DNS).
   - Lista de contactos externos (Vultr soporte, Wompi, proveedor de dominio).
   - Comandos exactos copiables.
3. Probar el plan **una vez** en un VPS de pruebas. Cronometrar.
4. Versión simplificada para Carmen Consuelo: "qué hacer si la web se cae" (sin tecnicismos).

---

### Gap 7.3 — Single Point of Failure humano (bus factor = 1) 🟠

**Problema:** la infraestructura técnica depende exclusivamente de Angel. Si Angel se ausenta (vacaciones largas, accidente, terminación de relación con el negocio), el sistema entra en deriva.

**Acción:**
1. **Documentar credenciales** en gestor compartido (1Password, Bitwarden, KeePass cifrado en disco compartido). Compartir acceso de emergencia con Carmen Consuelo (formato sobre cerrado físico + acceso digital).
2. Identificar a un **segundo técnico** (contratista freelance, alianza con proveedor de servicios) que conozca el sistema lo suficiente para mantenerlo operativo durante una ausencia. Pagar 1-2 jornadas para que se familiarice.
3. **Manual de operación técnica nivel 1** que Carmen Consuelo pueda seguir: cómo reiniciar servicios desde el panel de Vultr, cómo verificar que la web está arriba, a quién llamar si no levanta.
4. Cruzar con dimensión 1 (legal): si UCR migra a S.A.S, definir representación legal y poder operativo independiente del owner.

---

### Gap 7.4 — Sin manuales operativos de tienda 🟠

**Problema:** la operación física se sostiene en costumbre y memoria. Cuando se contrate al trabajador del segundo local (jun 2026, ver dim. 4) no hay nada escrito que entregar.

**Acción:**
1. **Manual de Tienda v1** cubriendo:
   - Apertura: revisión cámaras (si hay), prendido de equipos, login en sistema, conteo inicial de caja.
   - Operación: atención al cliente, registro de ventas, cambios y devoluciones, encargos.
   - Cuadre de caja al final del día (ya soportado por `daily_cash_registers`).
   - Cierre: inventario rápido, backup local del día (si aplica), apagado, alarma.
2. **Procedimiento de recepción de mercancía** (cuando llegue producto del proveedor o de modistas externas): conteo, cotejo con orden de compra, ingreso al sistema, ubicación física en tienda.
3. **Procedimiento de despacho a domicilio**: empaque, marbete, llamada al cliente, entrega, registro de evidencia.
4. **Procedimiento de inventario físico**: cuándo (mensual recomendado), cómo (categorías, conteo cruzado), qué hacer ante diferencias (registrar en `inventory_logs` con motivo).

---

### Gap 7.5 — Control de acceso físico no documentado 🟡

**Problema:** llaves de la tienda, claves de la alarma (si existe), acceso a la caja fuerte (si existe) — ninguno tiene política escrita ni inventario.

**Acción:**
1. Inventariar quién tiene llaves de qué.
2. Política: rotación de claves de alarma cada 6 meses, recuperación inmediata de llaves al egreso de personal.
3. Si no hay alarma: evaluar instalación (costo $300k–$1.5M + monitoreo $50k/mes).
4. Si hay cámaras: confirmar que cumplen Ley 1581 (avisos de videovigilancia visibles, finalidad delimitada, retención máxima 30 días recomendada).

---

### Gap 7.6 — Gestión de secretos sin rotación 🟡

**Problema:** API keys de Wompi, Telegram, Resend, secret JWT, contraseñas de DB no rotan. Si una credencial se filtra (laptop perdido, repo público accidental), se mantiene válida indefinidamente.

**Acción:**
1. Política de rotación:
   - JWT `SECRET_KEY`: anual.
   - API keys de terceros: cuando el proveedor las invalide o cuando haya cambio de personal con acceso.
   - Contraseña DB: anual o ante incidente.
2. Inventario de secretos en gestor (cruzado con Gap 7.3).
3. **Auditoría inmediata** del git history para detectar si algún secreto se commiteo accidentalmente alguna vez (`git log --all -p | grep -i 'api_key\|secret\|password'`).

---

### Gap 7.7 — Audit log con PII y sin política de retención 🟡

> Cruzado con `05-datos-personales.md` Gap 5.6 y 5.8.

**Problema:** `audit_logs.data_before` y `data_after` guardan snapshots completos. Para soporte y forensic es valioso, pero el crecimiento es lineal y la retención indefinida.

**Acción:**
1. Política de retención: 24 meses con anonimización opcional de PII en JSON antes de archivar.
2. Job de purga mensual.

---

### Gap 7.8 — Procedimientos SG-SST para PYME 🟠

> Cruzado con `04-laboral.md`.

**Problema:** Resolución 0312/2019 establece 7 estándares mínimos para empresas con ≤10 trabajadores. UCR no los cumple.

**Acción:**
1. Diseñar SG-SST nivel mínimo (matriz de riesgos, plan de trabajo anual, capacitación, examen médico ocupacional, reporte de accidentes).
2. Costo asesor SST: ~$1M–$3M COP arranque + $200k–$500k mensual.
3. Verificar con dim. 4 si esto se incluye en T2 o se contrata aparte.

---

### Gap 7.9 — Sin CI/CD ni pipeline de pruebas pre-deploy 🟡

**Problema:** despliegues son `git pull && systemctl restart`. No hay paso obligatorio de pasar tests, lint, ni revisión.

**Acción:**
1. GitHub Actions: en cada push a `main` correr backend tests + frontend lint. Si falla, marcar deploy como bloqueado.
2. (Opcional) Auto-deploy a producción al pasar checks vía webhook al VPS.
3. Documentar checklist pre-deploy en `docs/deployment/release-checklist.md` (independiente del template de Git Workflow ya existente).

---

### Gap 7.10 — Sin política de actualización de dependencias 🟡

**Problema:** `requirements.txt`, `package.json` son inventarios pero no hay cadencia para actualizar parches de seguridad. El `pyproject.toml` o `poetry.lock` no se reportan auditados.

**Acción:**
1. Cadencia mensual: ejecutar `pip-audit` (Python) y `npm audit` (JS), revisar CVEs altos.
2. Cadencia semestral: actualización mayor de dependencias con regression test.
3. Suscribirse a alertas de Dependabot en GitHub (gratuito).

---

## Roadmap de cierre

> **Lógica de priorización:** la urgencia 🔴 viene del riesgo de **pérdida total de datos** (Gap 7.1). El siguiente bloque 🟠 son riesgos materiales que se manifiestan ante eventos concretos (DR ante incidente, manuales ante apertura segundo local, SG-SST ante visita Mintrabajo). 🟡 son higiene operativa.

| ID | Acción | Prioridad | Driver | Plazo | Costo estimado | Dependencia |
|----|--------|-----------|--------|-------|----------------|-------------|
| O1 | Cron de backup diario cifrado + sincronización offsite + prueba mensual | 🔴 | Pérdida total de datos | <14 días | $60 USD/año + 2-3 días setup | — |
| O2 | Plan de DR documentado + prueba en VPS de pruebas | 🟠 | Continuidad ante incidente VPS | <60 días | 1 día owner + 1 día técnico | O1 |
| O3 | Gestor compartido de secretos + segundo técnico de contingencia + manual nivel 1 para Carmen | 🟠 | Bus factor humano | <90 días | $150k licencia gestor + tiempo onboarding | — |
| O4 | Manual de Tienda v1 + procedimientos (apertura/cierre, recepción, despacho, inventario físico) | 🟠 | Apertura segundo local jun 2026 | <60 días | 2-3 días owner | — |
| O5 | Implementar SG-SST mínimo (Resolución 0312/2019, 7 estándares) | 🟠 | Cumplimiento Decreto 1072/2015 | <90 días | $1M–$3M arranque + $200k–$500k mes | Cruzado con dim. 4 |
| O6 | Política de retención + purga de `audit_logs` y `email_log` | 🟡 | Higiene + cumplimiento Ley 1581 | <90 días | 2-3 días dev | Dim. 5 D7, D8 |
| O7 | Política de control de acceso físico + rotación de claves alarma | 🟡 | Riesgo físico tienda | <60 días | $0–$1.5M (si requiere alarma) | — |
| O8 | Política de rotación de secretos + auditoría git history | 🟡 | Filtración de credenciales | <60 días | 1 día owner | O3 |
| O9 | CI/CD con tests obligatorios pre-merge + Dependabot activo | 🟡 | Calidad de despliegue + parches | <90 días | 1-2 días dev | — |
| O10 | Política de actualización de dependencias (cadencia mensual y semestral) | 🟡 | Vulnerabilidades de software | <90 días | 1-2 horas mensuales | O9 |

---

## Conexión con releases técnicos

| Release | Requisito operacional | Driver |
|---------|----------------------|--------|
| v3.0 (abr 2026) | O1 (backups), O2 (DR mínimo) | No perder datos, no quedar paralizado |
| v3.1 (jun 2026) | O3, O4 — apertura del segundo local exige bus factor reducido y manuales | Habilitar multi-branch operativo |
| v3.2 (oct 2026) | Todo el roadmap + **certificación SOC 2 light o ISO 27001** si los clientes SaaS lo exigen | Habilitador comercial — los clientes institucionales del SaaS preguntarán por backups, DR, SG-SST |

> **Nota v3.2:** vender SaaS a otros negocios significa que UCR pasa a ser **proveedor crítico** de la operación de terceros. Cualquier downtime lleva penalidades contractuales (ver SLA en `06-comercial.md` C9). El roadmap operacional aquí es prerrequisito de la oferta comercial.

---

## Pendientes de discovery (necesitan input del owner)

1. **Backups en producción**: ✅ **Resuelto 2026-05-04** — auditoría server-handler confirma: **inexistencia de automatización**. Sin crontab, sin systemd timer, sin herramienta de sync offsite instalada. Dumps existentes en `/tmp/` (riesgo limpieza), `/root/backups/`, `/var/backups/`, todos en texto plano. Disco no cifrado. Gap 7.1 escalado a urgente con plazo de acción < 14 días.

2. **Última prueba de restauración**: [PENDIENTE — owner confirmará] — pero por la naturaleza manual del proceso, asumir que nunca se ha hecho una prueba formal de DR.

3. **VPS de respaldo / proveedor alterno**: ¿hay algún VPS secundario, snapshot de Vultr, o cuenta abierta en otro proveedor (Hetzner, DigitalOcean) como contingencia? Esto define el RTO real.

4. **Secretos productivos — quién los conoce**: ¿quién además de Angel tiene acceso al `.env` del VPS, a la cuenta de Vultr, al panel de Wompi, al bot de Telegram, al dominio? Necesario para Gap 7.3.

5. **Local físico — controles**: ¿hay alarma instalada? ¿Cámaras? ¿Caja fuerte para efectivo? ¿Quién tiene llaves del local?

6. **Inventario físico**: ¿cuándo fue la última vez que se hizo un conteo físico completo del inventario para reconciliar contra el sistema? ¿Diferencias detectadas?

7. **Incidentes pasados**: ¿el sistema ha tenido caídas, pérdidas de datos parciales, fraude detectado, faltantes de caja inexplicados? Necesario para construir runbooks reales.

8. **Auditoría git history para secretos**: ¿se requiere mi ayuda para correr `git log --all -p | grep -iE 'api_key|secret|password|token'` y reportar hallazgos? Operación de solo lectura, segura.

9. **Bus factor — segundo técnico**: ¿hay alguien (otro desarrollador conocido, alianza con proveedor) que pueda operar el sistema en tu ausencia? ¿Qué nivel de acceso le darías?

10. **Manual de tienda — formato preferido**: ¿prefieres un Markdown en `docs/operations/`, un PDF imprimible en el local, o una sección dentro de la admin-portal accesible para los trabajadores? Define el alcance de O4.

---

## Decisiones pendientes del owner

- [ ] Aprobar inversión en almacenamiento offsite ($60 USD/año).
- [ ] Definir RTO/RPO formales (recomendación: RTO ≤ 4h, RPO ≤ 24h).
- [ ] Designar segundo técnico de contingencia.
- [ ] Aprobar inversión en SG-SST (~$1M–$3M arranque).
- [ ] Decidir formato del Manual de Tienda.
- [ ] Si v3.2 procede: decidir si UCR busca certificación de seguridad (ISO 27001, SOC 2) y en qué plazo.
