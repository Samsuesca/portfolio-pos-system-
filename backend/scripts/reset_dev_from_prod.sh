#!/usr/bin/env bash
# Resetea la DB local de desarrollo (`uniformes_db`) con un dump fresco de
# produccion y luego aplica `alembic upgrade head` para llevarla al estado
# actual de la rama de desarrollo. Resultado: el backend local (uvicorn,
# tests, scripts financieros) corre contra data real de prod con el schema
# actual de dev.
#
# Flujo:
#   1. Backup de la DB dev actual (rescate si algo sale mal).
#   2. Dump de prod via SSH.
#   3. Drop + recreate de `uniformes_db` local.
#   4. Restore del dump de prod.
#   5. `alembic upgrade head` — aplica migraciones nuevas sobre data de prod.
#   6. Verificacion final (counts + alembic_version).
#
# Uso:
#   ./backend/scripts/reset_dev_from_prod.sh                 # interactivo
#   NONINTERACTIVE=1 ./backend/scripts/reset_dev_from_prod.sh
#   SKIP_MIGRATIONS=1 ./backend/scripts/reset_dev_from_prod.sh  # restore puro
#
# Requisitos:
#   - SSH key configurada para root@104.156.247.226
#   - Docker corriendo localmente con container `uniformes-postgres`
#   - Backend venv en `backend/venv/` con `alembic` instalado
#   - Backend NO levantado (uvicorn) — el DROP exige sin conexiones
#
# ADVERTENCIA:
#   Algunas migraciones mueven datos (unify_step2_copy_global_data,
#   unify_step3_remap_fks). Si alguna falla sobre data de prod, el
#   script aborta y deja instrucciones para restaurar el backup previo.

set -euo pipefail

PROD_HOST="root@104.156.247.226"
PROD_DB_USER="uniformes_user"
PROD_DB_NAME="uniformes_db"
PROD_ENV_PATH="/var/www/uniformes-system-v2/backend/.env"

LOCAL_CONTAINER="uniformes-postgres"
LOCAL_DB_USER="uniformes_user"
LOCAL_DB_PASSWORD="dev_password"
LOCAL_DB_NAME="uniformes_db"

BACKEND_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SNAPSHOT_DIR="/tmp/ucr-snapshots"
TIMESTAMP=$(date +%Y%m%d_%H%M)
DUMP_FILE="${SNAPSHOT_DIR}/prod_${TIMESTAMP}.sql"
BACKUP_FILE="${SNAPSHOT_DIR}/dev_backup_${TIMESTAMP}.sql"

mkdir -p "$SNAPSHOT_DIR"

# ---------------------------------------------------------------------------
# 0) Confirmacion explicita (esto es destructivo)
# ---------------------------------------------------------------------------
if [[ "${NONINTERACTIVE:-0}" != "1" ]]; then
    cat <<EOF
================================================================================
Este script va a:
  1. Backupear ${LOCAL_DB_NAME}    -> ${BACKUP_FILE}
  2. DROPEAR la DB local ${LOCAL_DB_NAME}
  3. Restaurar dump fresco de prod (${PROD_HOST})
  4. Aplicar 'alembic upgrade head' sobre data de prod
       ${SKIP_MIGRATIONS:+(SALTADO por SKIP_MIGRATIONS=1)}

Asegurate de que NINGUN backend (uvicorn) este conectado a ${LOCAL_DB_NAME}.
================================================================================
Continuar? [y/N]:
EOF
    read -r CONFIRM
    if [[ "${CONFIRM:-n}" != "y" && "${CONFIRM:-n}" != "Y" ]]; then
        echo "Abortado por el usuario."
        exit 1
    fi
fi

# ---------------------------------------------------------------------------
# 1) Backup de la DB dev actual (no fatal si la DB no existe / esta vacia)
# ---------------------------------------------------------------------------
echo "[1/6] Backup de DB dev actual -> ${BACKUP_FILE}"
if docker exec "$LOCAL_CONTAINER" pg_dump -U "$LOCAL_DB_USER" --no-owner --no-acl "$LOCAL_DB_NAME" \
        > "$BACKUP_FILE" 2> "${SNAPSHOT_DIR}/backup.err"; then
    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "      OK (${BACKUP_SIZE})"
else
    echo "      (skip — DB no existe aun o sin permisos; ver ${SNAPSHOT_DIR}/backup.err)"
    rm -f "$BACKUP_FILE"
fi

# ---------------------------------------------------------------------------
# 2) Obtener password de prod desde el .env remoto
# ---------------------------------------------------------------------------
PROD_DB_PASSWORD=$(ssh "$PROD_HOST" "grep DATABASE_URL ${PROD_ENV_PATH} | sed -E 's|.*://[^:]+:([^@]+)@.*|\\1|'")
if [[ -z "$PROD_DB_PASSWORD" ]]; then
    echo "ERROR: no se pudo leer la password de prod desde ${PROD_ENV_PATH}"
    exit 1
fi

# ---------------------------------------------------------------------------
# 3) Dump de prod
# ---------------------------------------------------------------------------
echo "[2/6] Dump prod -> ${DUMP_FILE}"
ssh "$PROD_HOST" "PGPASSWORD='${PROD_DB_PASSWORD}' pg_dump -h localhost -U ${PROD_DB_USER} --no-owner --no-acl ${PROD_DB_NAME}" \
    > "$DUMP_FILE" 2> "${SNAPSHOT_DIR}/dump.err"
DUMP_SIZE=$(du -h "$DUMP_FILE" | cut -f1)
echo "      OK (${DUMP_SIZE})"

# ---------------------------------------------------------------------------
# 4) Drop + recreate de la DB dev
# ---------------------------------------------------------------------------
echo "[3/6] Dropeando y recreando ${LOCAL_DB_NAME}"
docker exec "$LOCAL_CONTAINER" psql -U "$LOCAL_DB_USER" -d postgres \
    -c "DROP DATABASE IF EXISTS ${LOCAL_DB_NAME} WITH (FORCE);" > /dev/null
docker exec "$LOCAL_CONTAINER" psql -U "$LOCAL_DB_USER" -d postgres \
    -c "CREATE DATABASE ${LOCAL_DB_NAME};" > /dev/null

# ---------------------------------------------------------------------------
# 5) Restore del dump de prod
# ---------------------------------------------------------------------------
echo "[4/6] Restaurando dump de prod en ${LOCAL_DB_NAME}"
docker exec -i "$LOCAL_CONTAINER" psql -U "$LOCAL_DB_USER" -d "$LOCAL_DB_NAME" \
    < "$DUMP_FILE" > /dev/null 2> "${SNAPSHOT_DIR}/restore.err" || true
RESTORE_ERRORS=$(grep -c -E '^ERROR' "${SNAPSHOT_DIR}/restore.err" || true)
if (( RESTORE_ERRORS > 0 )); then
    echo "      ${RESTORE_ERRORS} avisos de psql durante el restore"
    echo "      (revisar ${SNAPSHOT_DIR}/restore.err — usualmente son 'role does not exist' inocuos)"
fi

# ---------------------------------------------------------------------------
# 6) alembic upgrade head sobre la data de prod
# ---------------------------------------------------------------------------
if [[ "${SKIP_MIGRATIONS:-0}" == "1" ]]; then
    echo "[5/6] SKIP_MIGRATIONS=1 — no se aplican migraciones"
else
    echo "[5/6] Aplicando alembic upgrade head"
    pushd "$BACKEND_DIR" > /dev/null
    if [[ -d venv ]]; then
        # shellcheck disable=SC1091
        source venv/bin/activate
    fi

    if ! alembic upgrade head; then
        cat <<EOF

================================================================================
ERROR: 'alembic upgrade head' fallo sobre la data de prod.

Para restaurar tu DB dev anterior:
  docker exec ${LOCAL_CONTAINER} psql -U ${LOCAL_DB_USER} -d postgres \\
      -c "DROP DATABASE ${LOCAL_DB_NAME} WITH (FORCE);"
  docker exec ${LOCAL_CONTAINER} psql -U ${LOCAL_DB_USER} -d postgres \\
      -c "CREATE DATABASE ${LOCAL_DB_NAME};"
  docker exec -i ${LOCAL_CONTAINER} psql -U ${LOCAL_DB_USER} -d ${LOCAL_DB_NAME} \\
      < ${BACKUP_FILE}

Si te interesa solo inspeccionar la data sin migrar (modo read-only paralelo):
  ./backend/scripts/refresh_prod_snapshot.sh
================================================================================
EOF
        exit 1
    fi
    popd > /dev/null
fi

# ---------------------------------------------------------------------------
# 7) Verificacion final
# ---------------------------------------------------------------------------
echo "[6/6] Verificando estado final"
docker exec "$LOCAL_CONTAINER" psql -U "$LOCAL_DB_USER" -d "$LOCAL_DB_NAME" -c "
SELECT
  pg_size_pretty(pg_database_size('${LOCAL_DB_NAME}')) AS db_size,
  (SELECT version_num FROM alembic_version)            AS alembic_head,
  (SELECT MAX(sale_date)::date FROM sales)             AS last_sale,
  (SELECT COUNT(*) FROM sales)                         AS sales,
  (SELECT COUNT(*) FROM orders)                        AS orders,
  (SELECT COUNT(*) FROM alterations)                   AS alterations;
"

cat <<EOF

OK — DB dev reseteada a prod + migraciones aplicadas.
  Backup dev previo : ${BACKUP_FILE:-<no se hizo>}
  Dump prod         : ${DUMP_FILE}

Conexion:
  postgresql://${LOCAL_DB_USER}:${LOCAL_DB_PASSWORD}@localhost:5432/${LOCAL_DB_NAME}
  docker exec -it ${LOCAL_CONTAINER} psql -U ${LOCAL_DB_USER} -d ${LOCAL_DB_NAME}

Siguiente paso sugerido:
  cd backend && source venv/bin/activate && uvicorn app.main:app --reload --port 8000
EOF
