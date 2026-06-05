#!/usr/bin/env bash
# Refresh local DB `uniformes_prod_snapshot` from production.
#
# Use case: tener una copia fresh y read-only de la data de producción
# para análisis (financiero, formalización, KPIs) SIN tocar la DB de
# desarrollo `uniformes_db` que tiene migraciones más nuevas (v3).
#
# Uso:
#   ./backend/scripts/refresh_prod_snapshot.sh
#
# Requisitos:
#   - SSH key configurada para root@104.156.247.226
#   - Docker corriendo localmente con uniformes-postgres
#
# El backend NO funciona contra esta DB (espera schema v3); es solo para SQL.

set -euo pipefail

PROD_HOST="root@104.156.247.226"
PROD_DB_USER="uniformes_user"
PROD_DB_NAME="uniformes_db"
LOCAL_CONTAINER="uniformes-postgres"
LOCAL_DB_NAME="uniformes_prod_snapshot"
SNAPSHOT_DIR="/tmp/ucr-snapshots"
TIMESTAMP=$(date +%Y%m%d_%H%M)
DUMP_FILE="${SNAPSHOT_DIR}/prod_${TIMESTAMP}.sql"

mkdir -p "$SNAPSHOT_DIR"

PROD_DB_PASSWORD=$(ssh "$PROD_HOST" "grep DATABASE_URL /var/www/uniformes-system-v2/backend/.env | sed -E 's|.*://[^:]+:([^@]+)@.*|\\1|'")

if [[ -z "$PROD_DB_PASSWORD" ]]; then
    echo "ERROR: no se pudo obtener la contraseña de prod desde /var/www/uniformes-system-v2/backend/.env"
    exit 1
fi

echo "[1/4] Dumping production DB to ${DUMP_FILE}..."
ssh "$PROD_HOST" "PGPASSWORD='${PROD_DB_PASSWORD}' pg_dump -h localhost -U ${PROD_DB_USER} --no-owner --no-acl ${PROD_DB_NAME}" \
    > "$DUMP_FILE" 2> "${SNAPSHOT_DIR}/dump.err"
DUMP_SIZE=$(du -h "$DUMP_FILE" | cut -f1)
echo "    Dump completado: ${DUMP_SIZE}"

echo "[2/4] Recreando local DB ${LOCAL_DB_NAME}..."
docker exec "$LOCAL_CONTAINER" psql -U "$PROD_DB_USER" -d postgres -c "DROP DATABASE IF EXISTS ${LOCAL_DB_NAME};" > /dev/null
docker exec "$LOCAL_CONTAINER" psql -U "$PROD_DB_USER" -d postgres -c "CREATE DATABASE ${LOCAL_DB_NAME};" > /dev/null

echo "[3/4] Restaurando dump en ${LOCAL_DB_NAME}..."
cat "$DUMP_FILE" | docker exec -i "$LOCAL_CONTAINER" psql -U "$PROD_DB_USER" -d "$LOCAL_DB_NAME" > /dev/null 2>&1 || true

echo "[4/4] Verificando..."
docker exec "$LOCAL_CONTAINER" psql -U "$PROD_DB_USER" -d "$LOCAL_DB_NAME" -c "
SELECT
  pg_size_pretty(pg_database_size('${LOCAL_DB_NAME}')) as db_size,
  (SELECT MAX(sale_date)::date FROM sales) as last_sale,
  (SELECT COUNT(*) FROM sales) as sales,
  (SELECT COUNT(*) FROM orders) as orders,
  (SELECT COUNT(*) FROM alterations) as alterations;
"

echo ""
echo "✓ Snapshot listo. Connection string para análisis:"
echo "  postgresql://uniformes_user:dev_password@localhost:5432/${LOCAL_DB_NAME}"
echo ""
echo "  docker exec -it ${LOCAL_CONTAINER} psql -U ${PROD_DB_USER} -d ${LOCAL_DB_NAME}"
