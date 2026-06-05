# Prompt — Sesión: Aplicar v3 sobre data real de producción

> **Para usar en sesión nueva** de Claude Code.
> **Modo SPRINT ACELERADO:** correr desde worktree de spike para aislar riesgo.
> **Working dir RECOMENDADO:** `/tmp/wt-uniformes-m2-spike` (worktree creado en M1).
> **Working dir alternativo:** `/Users/angelsamuelsuescarios/Documents/03_Proyectos/Codigo/uniformes-system-v2` (repo principal).
> **Branch:** `chore/stabilization-sprint-2026-Q2` (rama autorizada del sprint, creada en Milestone 1).
> **Target DB:** `uniformes_db_spike` primero (copia segura). Solo después de éxito en spike → replicar contra `uniformes_db` real.
> **Pre-requisito:** Milestone 1 del ROADMAP completado — `uniformes_db` y `uniformes_db_spike` deben tener data fresh de prod con schema v2.9.0.

---

## Contexto del proyecto

UCR — sistema multi-tenant para retail de uniformes en producción. Stack FastAPI
+ Tauri + Postgres. Estamos en sprint de estabilización mayo 2026. El objetivo
de esta sesión es **el momento más arriesgado del sprint**: aplicar las
migraciones v3 sobre data real de producción para detectar y corregir cualquier
falla antes del deploy oficial.

**Lee primero:**
1. `docs/formalization/ROADMAP.md` — visión completa del sprint.
2. `docs/v3-branch-architecture/v3-release-scope.md` — qué hace cada migración v3.
3. `docs/formalization/db-snapshot-workflow.md` — cómo trabajar con DB local.

## Objetivo único de esta sesión

Aplicar **todas las migraciones pendientes** desde el head actual de prod
(v2.9.0) hasta `merge_stab_001_unify_heads` (head más nuevo) contra la DB
`uniformes_db` que tiene data fresh de producción. Si alguna migración falla,
**debugear y parchear ANTES de continuar**.

## Estado de partida verificable

```bash
# Ejecutar para confirmar el punto de partida correcto
docker exec uniformes-postgres psql -U uniformes_user -d uniformes_db \
  -c "SELECT version_num FROM alembic_version;"
# Debe ser un version_num PREVIO a unify_step1 (v2.9.0).

docker exec uniformes-postgres psql -U uniformes_user -d uniformes_db \
  -c "SELECT MAX(sale_date) FROM sales;"
# Debe ser ~2026-05-01 o más reciente (data fresh de prod).

docker exec uniformes-postgres psql -U uniformes_user -d uniformes_db \
  -c "\dt global_*"
# Debe listar global_garment_types, global_garment_type_images, global_products,
# global_inventory (4 tablas que serán fusionadas).
```

Si no se cumple el estado de partida, **DETENERSE y revisar Milestone 1**.

## Migraciones a aplicar (orden estricto)

```
v2.9.0 (estado partida)
  ↓ unify_step1_nullable_school_id      ← schema: school_id nullable + partial indexes
  ↓ unify_step2_copy_global_data        ← DATA: copia rows global_* → tablas unificadas
  ↓ unify_step3_remap_fks               ← DATA: remap FKs en sale_items, order_items, etc.
  ↓ unify_step4_drop_global_columns     ← schema: drop columnas global_*_id
  ↓ unify_step5_drop_global_tables      ← schema: drop tablas global_*
  ↓ pos1t10n5_add_positions_table       ← nuevo: catálogo positions
  ↓ inv_reserved_qty_add_reserved_qty   ← schema: columna reserved_quantity + backfill
  ↓ inv_failed_logs_add_dlq             ← nuevo: dead-letter queue
  ↓ alt_view_rev_001                    ← (revisar qué hace)
  ↓ usr_token_ver_001                   ← user.token_version para invalidación JWT
  ↓ order_chg_disp_001                  ← order_change disposition enum
  ↓ tg_seller_dgst_add_daily_digest     ← telegram daily digest
  ↓ alt_no_ext_v3_remove_external       ← alterations sin clientes externos
  ↓ vendor_norm_a/b/c                   ← normalización vendors (3 migraciones)
  ↓ exp_cat_002_add_formalization_categories  ← (yo agregué esta)
  ↓ fp_proj_001_add_financial_projections     ← (yo agregué esta)
  ↓ merge_stab_001_unify_heads          ← merge final
```

## Procedimiento

### Fase 1 — Aplicación gradual (una migración a la vez)

```bash
# Para cada migración, en orden:
docker exec uniformes-backend alembic upgrade <revision_id>

# Después de cada una, validar:
# 1. Que pasó sin error
# 2. Conteos de tablas relevantes
# 3. Datos no se perdieron
```

### Fase 2 — Las 5 migraciones críticas (`unify_*`)

Estas mueven datos. Validación obligatoria entre cada una.

#### Antes de unify_step1
```sql
SELECT COUNT(*) AS pre_school FROM products WHERE school_id IS NOT NULL;
SELECT COUNT(*) AS pre_global FROM global_products WHERE 1=1;
SELECT COUNT(*) AS pre_sale_items FROM sale_items;
SELECT COUNT(*) AS pre_order_items FROM order_items;
SELECT COUNT(*) AS pre_inventory_school FROM inventory;
SELECT COUNT(*) AS pre_inventory_global FROM global_inventory;
```

Anotar estos números. Son la línea base de validación.

#### Después de unify_step1
- `school_id` debe ser nullable en `garment_types` y `products`.
- Partial indexes deben existir.
- Sin cambios de data.

#### Después de unify_step2 (LA MÁS CRÍTICA)
```sql
-- Productos globales debieron copiarse a `products` con school_id=NULL
SELECT COUNT(*) AS post_step2_unified_globals FROM products WHERE school_id IS NULL;
-- Debe ser igual a pre_global

-- Inventario global debió copiarse a `inventory`
SELECT COUNT(*) AS post_step2_inventory FROM inventory
  WHERE product_id IN (SELECT id FROM products WHERE school_id IS NULL);
-- Debe ser igual a pre_inventory_global

-- IMPORTANTE: las tablas global_* aún existen, solo se copió la data
SELECT COUNT(*) AS still_in_global_products FROM global_products;
-- Debe ser igual a pre_global
```

#### Después de unify_step3 (REMAP FKs)
```sql
-- sale_items.product_id debe estar 100% poblado (era nullable porque podía
-- referirse a global_product_id alternativamente)
SELECT COUNT(*) AS sale_items_with_null_product FROM sale_items
  WHERE product_id IS NULL;
-- Debe ser 0. Si no es 0, hay un sale_item que apuntaba a global_product
-- que no se pudo remappear.

-- Verificar suma total de productos referenciados
SELECT COUNT(DISTINCT product_id) FROM sale_items;
-- Comparar con pre_step contra global_product_id + product_id
```

#### Después de unify_step4 y unify_step5
- Columnas `global_*_id` ya no existen.
- Tablas `global_*` ya no existen.

### Fase 3 — Si alguna migración falla

**Plan A — Fix forward:**
1. Dejar la DB en el estado de la última migración exitosa.
2. Hacer `alembic downgrade <previous_revision>` si es necesario.
3. Identificar la causa: probable es duplicate key en `products` (UNIQUE constraint
   conflicta entre school y global con misma `name`+`size`+algo).
4. Modificar la migración: agregar lógica de deduplicación, usar `ON CONFLICT
   DO NOTHING` o similar.
5. Commit del fix con mensaje claro: `fix(alembic): handle dupes in unify_step2
   for school_id collision`.
6. Re-intentar la migración.

**Plan B — Restaurar y re-intentar:**
```bash
# Si quedamos en mal estado
docker exec uniformes-postgres psql -U uniformes_user -d postgres \
  -c "DROP DATABASE uniformes_db; CREATE DATABASE uniformes_db;"

# Restaurar dump prod
ssh root@104.156.247.226 \
  "PGPASSWORD=Uniformes2025 pg_dump -h localhost -U uniformes_user --no-owner --no-acl uniformes_db" \
  | docker exec -i uniformes-postgres psql -U uniformes_user -d uniformes_db

# Aplicar fix de la migración antes de re-intentar
```

### Fase 4 — Validación post-migración completa

```bash
# Estado final esperado
docker exec uniformes-postgres psql -U uniformes_user -d uniformes_db \
  -c "SELECT version_num FROM alembic_version;"
# Debe ser merge_stab_001_unify_heads

# Backend levanta sin errores
docker compose restart backend
docker logs uniformes-backend --tail 30
# Debe ver "Application startup complete" sin errores.

# Smoke test de endpoints
curl http://localhost:8001/api/v1/health
# 200 OK

# Frontend smoke
cd frontend && npm run dev
# Abrir http://localhost:5171, login, navegar a /accounting.

# Tests
docker exec uniformes-backend pytest -v --tb=short -x
# Detener al primer fallo. Si hay fallos, debugear antes de seguir.
```

## Restricciones

- ❌ NO tocar producción. Todo es local.
- ❌ NO saltarse migraciones críticas (`unify_step2/3`) sin validación de data.
- ❌ NO commitear fixes de migración sin tests.
- ✅ SI cada migración tiene su `git commit` separado si requiere fix.
- ✅ SI documentar en `docs/formalization/v3-migration-issues.md` cualquier
  problema encontrado y su solución.
- ✅ SI mantener ventana de tiempo total: idealmente medio día. Si toma más,
  re-evaluar.

## Entregables

1. DB local en `merge_stab_001_unify_heads` con data fresh de prod migrada.
2. Backend levanta y los smoke tests pasan.
3. Documento `docs/formalization/v3-migration-issues.md` con todos los issues
   encontrados y resueltos (aunque sea cero).
4. Commits con fixes a migraciones si hubo (en branch del sprint).
5. Reporte breve: cuánto tiempo tomó cada migración, qué se rompió, qué se
   parcheó.

## Cómo arrancar (modo sprint acelerado, desde worktree)

```bash
# 1. Posicionarse en el worktree de spike (creado en checklist de M1)
cd /tmp/wt-uniformes-m2-spike
git branch --show-current  # debe ser chore/stabilization-sprint-2026-Q2

# 2. Apuntar alembic al spike DB (no tocar uniformes_db real aún)
export DATABASE_URL="postgresql+asyncpg://uniformes_user:Uniformes2025@localhost:5432/uniformes_db_spike"
docker exec uniformes-postgres psql -U uniformes_user -d uniformes_db_spike \
  -c "SELECT version_num FROM alembic_version;"

# 3. Ver migraciones pendientes
cd backend && alembic history --verbose | head -100

# 4. Backup pre-migración (del SPIKE, el real ya está respaldado en M1)
docker exec uniformes-postgres pg_dump -U uniformes_user uniformes_db_spike \
  > /tmp/ucr-snapshots/pre_v3_spike_$(date +%Y%m%d_%H%M).sql

# 5. Empezar Fase 1 contra spike. Si éxito completo, REPLICAR contra uniformes_db
#    desde el repo principal. Si falla, parchear en spike y re-intentar.
```

## Si terminas con éxito en spike

```bash
# Volver al repo principal y replicar contra DB real
cd /Users/angelsamuelsuescarios/Documents/03_Proyectos/Codigo/uniformes-system-v2

# Aplicar las MISMAS migraciones (con cualquier fix que se haya commiteado en spike)
git pull  # por si hubo commits de fix
unset DATABASE_URL  # volver a default (uniformes_db)
docker exec uniformes-backend alembic upgrade head

# Cleanup del worktree y DB spike
git worktree remove /tmp/wt-uniformes-m2-spike
docker exec uniformes-postgres psql -U uniformes_user -d postgres \
  -c "DROP DATABASE uniformes_db_spike;"
```

Reportar avance al final del día con: cuántas migraciones aplicadas, cuántas
fallaron y se parchearon, tiempo total, próximo paso.
