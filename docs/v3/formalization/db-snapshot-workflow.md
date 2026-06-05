# Workflow de reset de DB dev con data de produccion

> **Ultima actualizacion:** 2026-05-24
> **Proposito:** correr el backend local (uvicorn, tests, scripts financieros, modelo) contra **data real y fresca de produccion** con el **schema actual de la rama de desarrollo**. Reemplaza la DB dev por un dump de prod y aplica `alembic upgrade head` encima.
> **Cambio respecto a versiones previas:** antes manteniamos una DB paralela `uniformes_prod_snapshot` para no migrar data de prod nunca vista por las migraciones v3. Ahora asumimos ese riesgo controladamente, con backup previo y rollback documentado, porque el objetivo es **probar el flujo de desarrollo contra data real**, no solo correr SQL ad-hoc.

---

## Cuando usar este flujo

- Antes de validar una feature contra data real (no solo seeds).
- Antes de correr el modelo financiero / `cfo-strategist` con numeros que importen.
- Despues de un deploy o cambio comercial relevante (cierre de mes, nuevo contrato, conciliacion bancaria, etc.).
- Para reproducir un bug reportado en prod usando exactamente la misma data.

Cuando **NO** usarlo:
- Si necesitas comparar lado-a-lado dev vs. prod (usa la opcion paralela legacy mas abajo).
- Si solo quieres SQL read-only sin tocar dev (idem).

---

## TL;DR

```bash
./backend/scripts/reset_dev_from_prod.sh
```

Toma ~30-60 segundos. El script:

1. Backupea la DB dev actual a `/tmp/ucr-snapshots/dev_backup_<timestamp>.sql`.
2. Hace `pg_dump` de prod via SSH y lo descarga a `/tmp/ucr-snapshots/prod_<timestamp>.sql`.
3. Drop + recreate de `uniformes_db` local.
4. Restaura el dump de prod.
5. Corre `alembic upgrade head` desde `backend/` (con el venv local).
6. Imprime counts + `alembic_version` para verificar.

Si el paso 5 falla, el script aborta con instrucciones exactas para restaurar el backup del paso 1.

---

## Requisitos

- SSH key configurada para `root@104.156.247.226`.
- Docker corriendo con el container `uniformes-postgres` (definido en `docker/docker-compose.dev.yml`).
- `backend/venv/` con `alembic` instalado (`pip install -r backend/requirements.txt`).
- **Backend local apagado** (uvicorn cerrado) — el `DROP DATABASE WITH (FORCE)` mata conexiones, pero si el backend esta corriendo intentara reconectar contra una DB con schema parcial.

---

## Flags

| Variable | Efecto |
|----------|--------|
| `NONINTERACTIVE=1` | Salta el prompt de confirmacion. Util para automatizar en CI o invocaciones desde otro script. |
| `SKIP_MIGRATIONS=1` | Restaura el dump pero no corre `alembic upgrade head`. Util para inspeccionar el schema exacto de prod o reproducir bugs sin que las migraciones muevan data. |

Ejemplo:

```bash
NONINTERACTIVE=1 SKIP_MIGRATIONS=1 ./backend/scripts/reset_dev_from_prod.sh
```

---

## Connection string (igual que dev normal)

```
postgresql+asyncpg://uniformes_user:dev_password@localhost:5432/uniformes_db
```

CLI:
```bash
docker exec -it uniformes-postgres psql -U uniformes_user -d uniformes_db
```

Y el backend levanta normal:
```bash
cd backend && source venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

---

## Verificacion (lo que imprime el paso 6)

```
       db_size       |     alembic_head      | last_sale  | sales | orders | alterations
---------------------+-----------------------+------------+-------+--------+-------------
 19 MB               | v3_design_cleanup_001 | 2026-05-23 |  1612 |    318 |         171
```

`alembic_head` debe coincidir con `alembic heads` de la rama actual (hoy: `v3_design_cleanup_001`).

---

## Si `alembic upgrade head` falla

El script aborta y deja instrucciones literales. Resumen:

```bash
# 1. Restaurar la DB dev al estado previo al reset
docker exec uniformes-postgres psql -U uniformes_user -d postgres \
    -c "DROP DATABASE uniformes_db WITH (FORCE);"
docker exec uniformes-postgres psql -U uniformes_user -d postgres \
    -c "CREATE DATABASE uniformes_db;"
docker exec -i uniformes-postgres psql -U uniformes_user -d uniformes_db \
    < /tmp/ucr-snapshots/dev_backup_<timestamp>.sql

# 2. Diagnosticar la migracion que fallo (output del alembic) y arreglarla en codigo
# 3. Re-correr el reset
```

Las migraciones que mueven data sobre prod son las mas riesgosas:
- `unify_step2_copy_global_data`
- `unify_step3_remap_fks`
- `unify_step4_drop_global_columns`
- `vendor_norm_b_populate`
- `u5v6w7x8y9z0_format_client_names_title_case`

Si alguna falla, **fija el codigo de la migracion** (idempotencia, NULL handling, edge cases de prod) antes de re-correr. El backup del paso 1 te protege mientras tanto.

---

## Hallazgos historicos (validar contra data fresca)

Mezcla finanzas personales/negocio (snapshot 2026-05-02 sobre data hasta 2026-05-01):

| Concepto | Valor |
|----------|-------|
| Gastos personales (`mercado`+`ocio`+`comida`+`viaticos`) | $4.92M |
| Gastos negocio | $100.5M |
| **% mezcla** | **4.9%** |

> 4.7% en abril → 4.9% en mayo. La mezcla persiste y crece levemente.

Revisar de nuevo despues de cada reset para detectar drift.

---

## Limpieza

Los dumps quedan en `/tmp/ucr-snapshots/` que se limpia en reinicios. Para archivar:

```bash
cp /tmp/ucr-snapshots/prod_<timestamp>.sql ~/backups/ucr/
```

Para borrar acumulado:
```bash
rm -rf /tmp/ucr-snapshots/
```

---

## Opcion legacy: DB paralela read-only

Si solo quieres una copia de prod **sin tocar la DB dev** (para SQL ad-hoc sin riesgo de romper el backend local), sigue existiendo el script viejo:

```bash
./backend/scripts/refresh_prod_snapshot.sh
```

Crea/recrea la DB `uniformes_prod_snapshot` en el mismo Postgres container. El backend Python **no levanta** contra ella (espera schema v3 con migraciones aplicadas). Usala solo para `psql` o consultas via cliente externo.

Connection string:
```
postgresql://uniformes_user:dev_password@localhost:5432/uniformes_prod_snapshot
```

Borrarla cuando termines:
```bash
docker exec uniformes-postgres psql -U uniformes_user -d postgres \
    -c "DROP DATABASE uniformes_prod_snapshot;"
```

---

## Notas de seguridad

- La password de prod se lee via SSH de `/var/www/uniformes-system-v2/backend/.env` y se pasa por env var en el comando remoto. En un server multi-usuario seria visible en `ps`; en nuestro VPS con root unico es aceptable.
- El dump contiene **toda la data de prod** (clientes, ventas, gastos). Tratar `/tmp/ucr-snapshots/` como contenido sensible: no commitear, no copiar a paths shared, borrar al terminar la sesion si tu equipo es compartido.
- El script no toca prod (solo `pg_dump` read-only). Aun asi, asegurate de no equivocarte de direccion: `PROD_HOST` esta hardcoded como destino del SSH, **no** del restore.
