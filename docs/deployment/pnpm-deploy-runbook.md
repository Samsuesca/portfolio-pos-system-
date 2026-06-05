# Runbook de Deploy con pnpm — Producción UCR

**Creado:** 2026-05-17
**Aplica a:** primer deploy a `main` tras la migración npm → pnpm 11
**VPS:** 104.156.247.226 · `/var/www/uniformes-system-v2`

---

## Por qué este runbook

La migración a pnpm 11 borró todos los `package-lock.json` del repo y los reemplazó por
`pnpm-lock.yaml`. El VPS de producción **no tiene pnpm instalado** y su checkout está en un
commit pre-migración (`v2.9.0`). Sin los pasos de este runbook, el próximo deploy **rompe**:

- `pnpm install` falla → comando inexistente en el VPS.
- `npm ci` falla → ya no hay `package-lock.json`.
- `npm install` "funciona" pero hace resolución en frío sin lockfile (riesgo de supply-chain).

Decisión de versión de Node: **se estandariza en Node 22**. El VPS corre Node 20.19.6, así que
el upgrade de runtime es un **prerequisito obligatorio** (los `package.json` exigen `engines.node >=22`).

---

## Topología real de producción (verificada 2026-05-17)

| Componente | Cómo corre | Detalle |
|------------|-----------|---------|
| Backend API | systemd `uniformes-api` | venv Python, puerto 8000 — **no Docker** |
| PostgreSQL | nativo | `sudo -u postgres pg_dump uniformes_db` |
| web-portal | PM2 `uniformes-web` | `npm/pnpm start` (`next start`) sobre `.next/`, puerto 3000 |
| admin-portal | PM2 `uniformes-admin` | `next start -p 3001` |
| Nginx | reverse proxy | proxy_pass a 3000 / 3001, no sirve estáticos |
| frontend (Tauri) | **no se compila en VPS** | se distribuye como DMG/EXE desde el build de CI o macOS local |

> Los portales **no se caen** durante el rebuild: `next start` sirve el `.next/` existente
> hasta el `pm2 restart` final.

---

## Paso 0 — Prerequisitos en el VPS (UNA SOLA VEZ)

Ejecutar manualmente por SSH **antes** del primer deploy pnpm. Requiere sudo.

> **Solo toca el runtime — NO borres `node_modules` aquí.** Estos pasos son seguros con los
> portales vivos. La limpieza de `node_modules` va atómica justo antes del `pnpm install`
> (Paso 1 / 1-bis), nunca como paso adelantado: `next start` carga sus módulos de `node_modules`
> en runtime, así que borrarlo deja una ventana en la que cualquier restart de PM2 tumba el
> portal con `MODULE_NOT_FOUND` hasta que termine el install.

```bash
ssh root@104.156.247.226

# --- 0.1 Upgrade Node 20 → 22 LTS ---
# Node está instalado vía nodesource (repo node_20.x). El setup_22.x REEMPLAZA
# el repo por node_22.x; apt-get reemplaza el binario /usr/bin/node in-place.
# Los procesos PM2 vivos NO se caen (binario ya cargado en memoria).
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v   # debe imprimir v22.x

# --- 0.2 Habilitar pnpm vía corepack ---
# Hacerlo DESPUÉS del upgrade (Node 22 trae corepack más nuevo, evita estado mixto).
# El shim aterriza en /usr/local/bin/pnpm, que está en el PATH de root (PM2 corre como root).
sudo corepack enable pnpm
sudo corepack prepare pnpm@11.1.2 --activate
pnpm -v   # debe imprimir 11.1.2

# --- 0.3 Aplicar Node 22 a los portales vivos (blip de ~2-3s por portal) ---
# Los procesos siguen en Node 20 hasta reiniciarlos. Nginx puede dar 502 ese instante.
pm2 restart uniformes-web && pm2 restart uniformes-admin
```

> **Verificación:** `which pnpm` → `/usr/local/bin/pnpm`. `node -v` dentro de un proceso PM2
> reiniciado debe ser v22. El backend (`uniformes-api`, Python) no se ve afectado por el upgrade.

---

## Paso 1 — Deploy automatizado (vía tag + workflow `cd.yml`)

El workflow `cd.yml` ya quedó migrado a pnpm. El deploy se dispara al crear un tag `v*`:

```bash
# Desde local, sobre la rama ya mergeada a main:
git tag v3.0.0
git push origin v3.0.0
```

`cd.yml` se encarga de: backup DB → checkout del tag → backend (pip + alembic + restart) →
portales (`pnpm install --frozen-lockfile` + `pnpm run build` + `pm2 restart`) → health checks.

> El workflow incluye un guard que elimina `node_modules` estilo-npm **justo antes** del
> `pnpm install` (atómico, sin ventana de riesgo). Por eso la limpieza NO va en el Paso 0.

Requiere que la repo-variable `DEPLOY_ENABLED=true` esté seteada en GitHub.

> **PM2 arranca los portales con `npm start`** (`pm_exec_path: /usr/bin/npm` en el dump). Tras el
> deploy sigue funcionando (`npm start` solo ejecuta `next start`, no reinstala). Para consistencia
> con pnpm, opcionalmente recrea el proceso y persiste el dump:
> ```bash
> pm2 delete uniformes-web && pm2 start pnpm --name uniformes-web -- start && pm2 save
> pm2 delete uniformes-admin && pm2 start pnpm --name uniformes-admin -- start -- -p 3001 && pm2 save
> ```

---

## Paso 1-bis — Deploy manual (fallback si CD está deshabilitado)

```bash
ssh root@104.156.247.226
cd /var/www/uniformes-system-v2

# Backup DB
sudo -u postgres pg_dump uniformes_db | gzip > backups/pre-deploy-$(date +%Y%m%d_%H%M%S).sql.gz

# Traer código
git fetch origin --tags --force
git checkout main && git pull origin main   # o: git checkout v3.0.0

# Backend
cd backend && source venv/bin/activate
pip install -r requirements.txt --quiet
alembic upgrade head
sudo systemctl restart uniformes-api

# Web portal (pnpm) — rm + install atómicos (sin ventana de riesgo)
cd ../web-portal
rm -rf node_modules && pnpm install --frozen-lockfile
pnpm run build
pm2 restart uniformes-web

# Admin portal (pnpm)
cd ../admin-portal
rm -rf node_modules && pnpm install --frozen-lockfile
pnpm run build
pm2 restart uniformes-admin
```

---

## Paso 2 — Verificación post-deploy

```bash
# Backend
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8000/docs   # 200
systemctl is-active uniformes-api                                      # active

# Portales (PM2)
pm2 list                          # uniformes-web y uniformes-admin → online, 0 restarts en loop
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000        # 200
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001        # 200

# Confirmar que la instalación es pnpm (no npm)
ls /var/www/uniformes-system-v2/web-portal/node_modules/.pnpm >/dev/null && echo "pnpm OK"
test ! -f /var/www/uniformes-system-v2/web-portal/node_modules/.package-lock.json && echo "sin npm"
```

---

## Paso 3 — Rollback

Si un portal no levanta tras el build:

```bash
# Volver al tag/commit anterior
cd /var/www/uniformes-system-v2
git checkout v2.9.0          # último estado npm conocido bueno

# Reconstruir el portal afectado con pnpm
cd web-portal && pnpm install --frozen-lockfile && pnpm run build && pm2 restart uniformes-web
```

> PM2 mantiene el `.next/` previo vivo hasta el `restart`. Si el build nuevo falla, **no hagas
> el restart** — el servicio sigue sirviendo el build anterior. Diagnostica antes de reiniciar.

Rollback de DB (solo si una migración corrompió datos):

```bash
gunzip -c backups/pre-deploy-<TAG>-<TS>.sql.gz | sudo -u postgres psql uniformes_db
```

---

## Notas de inconsistencia detectadas

- `docs/deployment/DEPLOY-INSTRUCTIONS-2026-05-17.md` asume **docker-compose** y path `/opt/uniformes`.
  Eso **no coincide** con la realidad verificada (systemd + PM2 + `/var/www/uniformes-system-v2`).
  Este runbook refleja el estado real del VPS al 2026-05-17. Reconciliar ese doc antes de usarlo.
- `cloud-deployment-guide.md:263` aún menciona `npm run tauri:build` para el build de escritorio
  local; usar `pnpm run tauri:build` (ya migrado en `scripts/build-release.sh`).
