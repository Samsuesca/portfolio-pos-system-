# Diagnóstico y Plan de Estabilización del Catálogo (target: v3 deploy)

**Fecha:** 2026-05-24
**Versión prod actual:** v2.9.0 (rama `main` mergeada con v3, deploy DIFERIDO)
**Versión dev v3:** mergeada en `main` (`9cb0913` ~2026-05-10), alembic head `v3_design_cleanup_001`, 28 migraciones aplicadas
**Estrategia:** **TODOS los fixes del catálogo se hacen contra `uniformes_db` (dev v3) y se shippean junto con v3 deploy**. Cero cambios directos sobre prod v2.9.0.

---

## ✅ IMPLEMENTACIÓN APLICADA (2026-05-24 03:00-04:10)

Plan completo ejecutado contra `uniformes_db` (dev v3). Listo para shippear con v3 deploy.

### Artefactos creados

| Archivo | Propósito | Estado |
|---|---|---|
| [backend/alembic/versions/v3_catalog_stability_001_catalog_stabilization.py](../../backend/alembic/versions/v3_catalog_stability_001_catalog_stabilization.py) | Migración Alembic con todos los renames + Delantal Comfama fix + variantes huérfanas + verificaciones inline | ✅ Aplicada |
| [backend/scripts/seed_catalog_from_team_zip.py](../../backend/scripts/seed_catalog_from_team_zip.py) | Carga idempotente de imágenes del ZIP team con keyword matching | ✅ Aplicado (24 imgs nuevas) |
| [backend/scripts/export_catalog_to_excel.py](../../backend/scripts/export_catalog_to_excel.py) | Genera Excel por escuela + uno global para re-share con team (decisión #7) | ✅ 12 Excels en `catalog_exports_2026-05-24/` |
| [backend/tests/integration/test_catalog_stability.py](../../backend/tests/integration/test_catalog_stability.py) | 20 invariantes post-migración como regresión | ✅ **20/20 PASSED** |
| Frontend updates: `web-portal/{lib/api.ts, lib/types.ts, app/[school_slug]/utils/categorization.ts, components/PriceListModal.tsx, app/encargos-personalizados/page.tsx}` | Yomber→Jumper en categorías, filtros, tabs, encargos personalizados | ✅ **169/169 tests PASSED** |
| Screenshots evidencia: `catalog-2026-05-24-POST-FIX-{comfama,caracas,pumarejo,pinal}.png` | Verificación visual local 4 colegios | ✅ Capturados |

### Resultados verificados visualmente

**Comfama** (`http://localhost:3001/comfama` — slug corregido):
- ✅ 4 cards de Delantal por color (`Delantal comfama amarillo/azul/fucsia/morado`) con 5 tallas cada uno
- ✅ Síntoma reportado del usuario RESUELTO: "Delantal comfama fucsia" aparece como card propia
- ✅ Genérico `Delantal` desactivado y vacío
- ✅ Title Case en todo (`Camiseta azul`, `Moño amarillo`, etc.)

**Caracas / Pumarejo / Pinal**:
- ✅ Tab "Jumper" (no "Yomber")
- ✅ Cards "Jumper" (no "Yomber") con CONFECCION PERSONALIZADA
- ✅ Globales nuevos visibles: Bicicletero (12 tallas), Boxer (6 tallas), Top deportivo (4 tallas)
- ✅ Globales renombrados: `Camisa blanca básica`, `Tennis nike blanco`, `Tennis nike negro`, `Zapatos goma`, `Medias tobilleras`
- ✅ Pinal: typo `Interios` → `Interiores`

**Backend dev**: v3.0.0 + alembic head `reports_cov_001` (mi migración `v3_catalog_stab_001` aplicada + otra subsecuente).

### Issues residuales conocidos (no bloquean v3 deploy)

1. **API `/global/products` no devuelve `garment_type_name`**: el frontend cae al `product.name` para mostrar globales → se ven "Medias natalia" / "Medias policia" cuando la gt canónica es "Medias canilleras negro". Es bug pre-existente del backend, separado. La migración renombró el gt correctamente; el problema es de exposición vía API.
2. **Buen Comienzo PRD-0001 + PRD-0011 (Camiseta size 2 Blanco, ambos activos)**: requiere decisión negocio. Documentado, no se tocó.
3. **Comfama línea "polo algodón"** (4 gts con 20 variantes en stock=0): se mantiene visible per decisión #9.

### Snapshot DB pre/post migración

```
                    PRE                            POST
gts globales:       14 (5 con imagen)              14 (12 con imagen) — renombrados + 3 huérfanos poblados
gts escolares:      80                             80 — naming Title Case + Jumper + Interiores
productos:          642                            664 (+22 nuevos en Bicicletero/Top/Boxer)
gts huérfanos:      6                              0 (eliminados via dedup o populados)
productos sin inv:  2                              0 (backfilled)
imágenes en DB:     ~58                            ~82 (+24 del team ZIP)
imágenes faltantes: 33 gts sin imagen              11 gts sin imagen (en escuelas no canónicas)
slug typos:         1 (Caycedo)                    0
naming lowercase:   ~9 gts                         0
```

### Cómo verificar (smoke test rápido)

```bash
# 1. Aplicar migración (si no está)
cd backend && venv/bin/python -m alembic upgrade head

# 2. Correr tests de invariantes
venv/bin/python -m pytest tests/integration/test_catalog_stability.py -v

# 3. (Opcional) Cargar imágenes del team ZIP
venv/bin/python -m scripts.seed_catalog_from_team_zip \
  --zip "../documentos/Catalogo/HERRAMIENTAS PARA ORGANIZAR LA PAGINA WEB-20260524T061408Z-3-001.zip" \
  --apply --uploads ../uploads

# 4. (Opcional) Re-generar Excels para team
venv/bin/python -m scripts.export_catalog_to_excel --output ../docs/qa-briefs/catalog_exports_2026-05-24

# 5. Verificación visual: levantar backend + portal
venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8001 &
cd ../web-portal && pnpm dev  # ya estaba corriendo
# Abrir http://localhost:3001/comfama y verificar 4 cards Delantal por color
```

---

## 0. Estrategia (decisión #8 del owner)

Prod corre v2.9.0 con un schema dual (legacy `garment_types`+`products` para escolares + `global_garment_types`+`global_products` separados). El branch `main` ya tiene mergeada la v3 que **unifica todas las tablas globales** en las legacy con `school_id=NULL` (5 migraciones `unify_step1..step5`). El deploy de v3 está diferido, sin ventana asignada.

**Implicación operativa:**

1. **`uniformes_db`** (dev v3) es la fuente de verdad para desarrollar y QA. Ya tiene la unificación aplicada (verificado: 14 garment_types globales con `school_id=NULL` + 80 escolares = 94 totales; 138 productos globales unificados + 504 escolares = 642 totales).
2. **`uniformes_prod_snapshot`** (creado hoy vía `refresh_prod_snapshot.sh`) es read-only, mantiene el schema v2.9.0 dual. Solo para análisis.
3. **Cero cambios SQL directos en prod.** Los fixes se hacen en `uniformes_db`, se prueban, se commitean como migraciones/seeds, y bajan a prod cuando v3 deploye.
4. **No hay hotfix urgente** del "Delantal Comfama fucsia" en prod actual — la usuaria reportó el síntoma pero el negocio puede operar mientras tanto. Fix definitivo viene con v3.
5. **El Excel del equipo se vuelve fuente canónica de documentación** una vez aplicados los renames acordados (decisión #7 del owner). Se re-genera y re-comparte al equipo después del fix.

---

## 1. Fuentes Cotejadas en esta auditoría

1. **Catálogo canónico equipo:** `documentos/Catalogo/HERRAMIENTAS PARA ORGANIZAR LA PAGINA WEB-20260524T061408Z-3-001.zip` — 76 imágenes + 4 hojas Excel
2. **DB prod live** (vía SSH a 104.156.247.226): schema v2.9.0 con tablas duales
3. **DB dev v3** (`uniformes_db` local docker): schema v3 unificado
4. **Snapshot prod read-only** (`uniformes_prod_snapshot`): refrescado hoy vía script oficial
5. **Web pública** https://yourdomain.com (verificada con Chrome DevTools MCP): 4 colegios canónicos visualmente auditados, 5 screenshots
6. **API directa** (`api.yourdomain.com`) con cuenta de servicio `public-viewer`
7. **Filesystem prod** (vía server-handler): `/var/www/uniformes-system-v2/uploads/`

---

## 2. Reglas de naming definidas por el owner

### 2.1 Convención de capitalización (decisión #2)

> "Mayúscula primera letra, resto en minúsculas."

Aplicable a **todos** los campos `name` en `garment_types` y los campos `name`/`color` en `products`. Ejemplos:
- ✅ `Camiseta azul`, `Chompa fucsia`, `Moño morado`, `Delantal niña`
- ❌ `Camiseta Azul` (Title Case en cada palabra)
- ❌ `camiseta azul` (lowercase)
- ❌ `MOÑO AMARILLO` (uppercase)

SQL para aplicar:
```sql
-- garment_types: solo primera letra mayúscula
UPDATE garment_types
SET name = UPPER(SUBSTRING(TRIM(name), 1, 1)) || LOWER(SUBSTRING(TRIM(name), 2));

-- products: idem para name y color
UPDATE products
SET name = UPPER(SUBSTRING(TRIM(name), 1, 1)) || LOWER(SUBSTRING(TRIM(name), 2)),
    color = NULLIF(UPPER(SUBSTRING(TRIM(COALESCE(color,'')), 1, 1)) || LOWER(SUBSTRING(TRIM(COALESCE(color,'')), 2)), '');
```

### 2.2 Renames canónicos definidos (decisiones #1, #3, #4, #5)

| Nombre actual (prod) | Nombre canónico | Motivo |
|---|---|---|
| `Yomber` | **`Jumper`** | Decisión #1: "Jumper" es la grafía correcta. 4 escuelas afectadas (Caracas, Pumarejo, Pinal, también referencias en frontend) |
| `Interios` (Pinal) | **`Interiores`** | Typo en BD |
| `Tennis Nike Blanco` | **`Tennis Nike blanco`** (sin cambio de marca) | Decisión #3: mantener Tennis Nike, NO renombrar a "Zapatos For One". Suena mejor para el cliente |
| `Tennis Nike Negro` | **`Tennis Nike negro`** | idem |
| `Camisa basica` (global) | **`Camiseta blanca piel de durazno`** | Decisión #4: el nombre del Excel del equipo (`CAMISETA BASICA PIEL DE DURAZNO.png`) describe el producto que hoy se llama "Camisa basica" |
| `Camisillas` (global) | **`Camiseta blanca tipo esqueleto`** | Decisión #5: el nombre del Excel del equipo (`CAMISETA BASICA (TIPO ESQUELETO).png`) corresponde a las "Camisillas" actuales |

### 2.3 Medias: estandarizar lo que ya existe (decisión #6)

> "Ya hay tipos de medias y desgloses, pero se debe estandarizar."

**No se crea la familia Medias Natalia** (que pide el Excel team). Se trabaja con lo que prod ya tiene:
- `Medias` (global, 6 variantes color Negra) → renombrar a `Medias canilleras negro` y aplicar Title Case
- `Medias Tobilleras` (global, 1 variante) → mantener como `Medias tobilleras`

Acción: revisar caso por caso con el equipo si los colores existentes corresponden a los del Excel (canilleras blanco/azul oscuro). Si faltan colores reales del negocio, agregarlos a estas familias en vez de crear "Medias Natalia".

### 2.4 Chompa gris para Comfama (decisión #7)

El gt `chompa básica gris` (Comfama, 1 variante en stock por encargo) **se mantiene**. Renombrar a `Chompa básica gris` (Title Case). Se incluye en el Excel del equipo cuando se re-genere.

---

## 3. Catálogo canónico del equipo (referencia)

ZIP entregado el 2026-05-22 con 76 imágenes en 5 carpetas:

| Sección | Productos canónicos (resumen) | Variantes esperadas |
|---|---|---|
| APARTADO CARACAS (7 imgs) | Camiseta, Sudadera, Chompa azul, Chompa gris, Jumper, Moño diario, Moño ed.física | 6-16 / S-XXL; moños S/M/G ($5k/6k/7k) |
| APARTADO PUMAREJO (8 imgs) | Camiseta diario, Camiseta ed.física, Sudadera, Chompa, Jumper, Delantal, Moño diario, Moño ed.física | idem tallas; delantal 4-10 ($30k) |
| APARTADO PINAL (8 imgs) | Camiseta, Sudadera, Chompa, Jumper, Delantal niña, Delantal niño, Moño diario, Moño ed.física | idem tallas; delantales 4-10 ($30k) |
| APARTADO COMFAMA (24 imgs) | 6 familias × 4 colores: polo algodón (alternativa), polo lacoste (oficial), Chompa, Delantal, Sudadera, Moño | **Tallas 2-4-6-8-10 únicamente** |
| APARTADO PRODUCTOS GLOBALES (29 imgs) | Ver tabla §5 con mapeo a nombres canónicos del owner | varios |

---

## 4. Estado real producción web (qué ve el cliente)

### 4.1 Homepage — `https://yourdomain.com/`

11 colegios visibles. **4 slugs con typo en URLs públicas**:

| Colegio | Slug actual | Slug correcto |
|---|---|---|
| Comfama | `confama` | `comfama` |
| Buen Comienzo | `buen-comiezo` | `buen-comienzo` |
| Héctor Abad Gómez | `institucion-educativa-hector-abad-gomes` | `...gomez` |
| Manuel José Caycedo | `institucion-educativa-manuel-jose-caicedo` | `...caycedo` |

### 4.2 Comfama (`/confama`) — caso más caótico

24 cards escolares + 11 globales. Issues confirmados en pantalla:

| Issue | Detalle |
|---|---|
| **Delantal Comfama fucsia** ausente como card | gt creado 2026-05-15 con imagen pero 0 productos. Los 5 productos fucsia (PRD-0109..0113) viven bajo el `Delantal` genérico mezclado con otros colores |
| Falta `Delantal Comfama morado` | Ni gt ni productos. Los 5 morado viven bajo genérico |
| Naming inconsistente case | Conviven `Camiseta Azul` + `camiseta de algodón azul`, `Moño amarillo` + `moño azul`, `Chompa Azul` + `chompa básica gris` |
| 2 líneas paralelas confusas | 4 cards `Camiseta {color}` (lacoste, con stock) + 4 cards `camiseta de algodón {color}` (todas 0 stock). Cliente no sabe cuál escoger |
| `Delantal` genérico mezcla 4 colores | "7/16 tallas en stock" sin indicar color en el resumen; el cliente debe abrir tallas para descubrir |
| 3 cards de delantal coexisten | `Delantal` (genérico) + `Delantal comfama amarillo` + `Delantal comfama azul` — migración a-medias |

### 4.3 Caracas (`/instituci-n-educativa-caracas`)

8 escolares + 11 globales. Issues: `Yomber` (typo), `Interiores` extra, `Moño Gala`/`Moño Gris` cuando el Excel team dice "Moño de diario" + "Moño de educación física".

### 4.4 Pumarejo (`/instituci-n-educativa-alfonso-l-pez-pumarejo`)

8 escolares + 11 globales. Issues: `Delantal De Niña` aparece pero el Excel team solo dice "Delantal (unisex)"; `moños` (plural lowercase) con 1 talla cuando debería ser 2 cards de S/M/G; `Yomber`; `Interiores` extra.

### 4.5 Pinal (`/instituci-n-educativa-el-pinal`)

8 escolares + 11 globales. Issues: `Interios` (typo en BD), 3 cards de Delantal (De Niña/genérico 1-talla/De Niño) cuando team pide solo 2; `Moño` como 1 card cuando team pide 2; `Yomber`.

---

## 5. Globales: mapeo nombre actual ↔ nombre canónico

| Nombre actual en prod | Nombre canónico (post-fix) | Variantes | Imagen DB | Acción |
|---|---|---|---|---|
| `Blusa` | `Blusa` (sin cambio) | 12 | ❌ | Cargar imagen `BLUSA JOMBER.png` |
| `Camisa basica` | **`Camiseta blanca piel de durazno`** | 20 (Blanco/Negro) | ❌ | Rename + cargar `CAMISETA BASICA PIEL DE DURAZNO.png` |
| `Camisillas` | **`Camiseta blanca tipo esqueleto`** | 10 | ❌ | Rename + cargar `CAMISETA BASICA (TIPO ESQUELETO).png` |
| `Correa` | `Correa` | 7 (Negro) | ❌ | Cargar `CORREA-RIATA 1/2/3 DE 3.png` (3 ángulos) |
| `Delantal para niña` | `Delantal niña` (en globales o por escuela según decisión) | 3 | ✅ | Considerar mover a escolares por colegio |
| `Jean` | `Jean` | 16 | ✅ parcial | Cargar `BLUE JEAN.png` adicional si aplica |
| `Medias` | **`Medias canilleras negro`** | 6 | ❌ | Rename. Decidir si agregar colores blanco/azul oscuro |
| `Medias Tobilleras` | `Medias tobilleras` | 1 | ❌ | Title Case |
| `Tennis Nike Blanco` | `Tennis Nike blanco` (sin cambio de marca) | 21 | ✅ parcial | Cargar `ZAPATOS FOR ONE BLANCOS 1/2/3 DE 3.png` como imagen visual (aunque la marca interna sea Nike) |
| `Tennis Nike Negro` | `Tennis Nike negro` | 21 | ✅ parcial | idem `ZAPATOS FOR ONE NEGROS 1/2/3 DE 3.png` |
| `Zapatos Goma` | `Zapatos goma` | 21 | ✅ parcial | Cargar `ZAPATOS DE GOMA PARA JOMBER 1/2/3 DE 3.png` |
| `Bicicleteros` | `Bicicletero` | 0 → **12 (niña 9 + dama 3)** (decisión #11) | ❌ → cargar | Crear variantes + cargar `BICICLETERO NIÑA AZUL OSCURO/BLANCO/NEGRO.png` |
| `Boxer` | `Boxer` | 0 → **6 unisex** (decisión #11) | ❌ | Crear variantes 6-16 con color asumido Negro. **Confirmar specs con equipo** |
| `Top` | `Top deportivo` | 0 → **4 (niña 3 + dama 1)** (decisión #11) | ❌ → cargar | Crear variantes + cargar `TOP DE NIÑA (PARTE DE ADELANTE/ATRAS).png` |

### 5.1 Globales canónicos que faltan totalmente en DB

| Nombre canónico | Imágenes en ZIP | Status |
|---|---|---|
| Medias Natalia (4 colores) | `MEDIAS NATALIA AZUL OSCURO/BLANCA/CAFES/VERDE PINO.png` (4) | **Decisión #6: NO crear nueva familia. Estandarizar las medias existentes en su lugar** |
| Medias canilleras blanco/azul oscuro | `MEDIAS CANILLERAS BLANCAS/AZUL OSCURO.png` (2) | Considerar agregar como nuevas variantes en `Medias canilleras` (después del rename) |

---

## 6. Inventario numérico (DB dev v3 = `uniformes_db`)

```
escuelas activas:                              11
garment_types totales (escolares + globales):  94
  - escolares (school_id NOT NULL):            80
  - globales (school_id IS NULL):              14
products totales:                             642 (608 activos)
  - escolares:                                504 (470 activos)
  - globales:                                 138 (138 activos)
garment_type_images:                          ~58 (48 escolares + 10 globales)
inventarios:                                  642
```

### 6.1 Garment_types huérfanos (gt sin productos)

| Escuela | Garment type | Estado |
|---|---|---|
| Comfama | `Delantal Comfama fucsia` | Activo, con imagen — **fix priority** |
| Comfama (no existe) | `Delantal Comfama morado` | gt no existe, productos huérfanos en genérico |
| Pumarejo | `Moño azul` | Sin imagen, 0 productos |
| Caracas | `Bicicletero negro talla 6` | Sin imagen, 0 productos (debe ser global) |
| Caracas | `Bicicleteros` | Inactivo, 0 productos |
| Pinal | `boxers` | Inactivo, 0 productos |
| GLOBAL | `Bicicleteros` | 0 variantes — crear o eliminar |
| GLOBAL | `Boxer` | 0 variantes |
| GLOBAL | `Top` | 0 variantes |
| +caicedo (escuela inactiva) | `Producto Personalizado` | Escuela basura |

### 6.2 Productos duplicados activos (potenciales bugs)

| Escuela | Garment type | Talla | Color | Codes | Precios | Riesgo |
|---|---|---|---|---|---|---|
| Fe y Alegria | CAMISA | 4 | — | PRD-0002 + PRD-0006 | 38k + 39k | **AMBOS ACTIVOS** — bug vendible |
| Pinal | Delantal | 2/4/6/8/10 | azul | PRD-0046-0049 + PRD-0050-0055 | 22k + 25k | Todos inactivos — solo limpieza |
| Juan De La Cruz | sudadera | XL | — | PRD-0001 + PRD-0023 | 53k + 53k | 1 activo / 1 inactivo — OK |

### 6.3 Filesystem (prod)

- **Escolares** (`/uploads/garment-types/`): 62 archivos vs 48 referenciados → 14 huérfanos (re-uploads sin cleanup)
- **Globales** (`/uploads/global-garment-types/`): 7 subdirs, ~10 archivos. Cuando v3 deploye, el path canónico debería migrar a `/uploads/garment-types/` también (school_id=NULL en filesystem)
- Total: ~78 MB
- Uvicorn corre como `root` (deuda de seguridad)

---

## 7. Plan de Fix — ALINEADO CON V3 DEPLOY

> **Estrategia:** todos los cambios se hacen en `uniformes_db` (dev v3) y se shippean como parte de v3 deploy. **Cero SQL directo en prod**.

### Fase A — Catálogo en código (1-2 días, en `uniformes_db`)

**A.1 Crear migración Alembic `vXcatalog001_catalog_stabilization`** que incluya:

```sql
-- =================== NAMING UNIFICATION ===================

-- Rename Yomber → Jumper (4 escuelas)
UPDATE garment_types SET name = 'Jumper' WHERE LOWER(name) = 'yomber';

-- Fix typo Interios → Interiores
UPDATE garment_types SET name = 'Interiores' WHERE LOWER(name) = 'interios';

-- Renames globales
UPDATE garment_types SET name = 'Camiseta blanca piel de durazno'
WHERE school_id IS NULL AND LOWER(name) IN ('camisa basica', 'camisa básica');

UPDATE garment_types SET name = 'Camiseta blanca tipo esqueleto'
WHERE school_id IS NULL AND LOWER(name) = 'camisillas';

UPDATE garment_types SET name = 'Medias canilleras negro'
WHERE school_id IS NULL AND LOWER(name) = 'medias';

UPDATE garment_types SET name = 'Medias tobilleras'
WHERE school_id IS NULL AND LOWER(name) = 'medias tobilleras';

UPDATE garment_types SET name = 'Tennis Nike blanco'
WHERE school_id IS NULL AND LOWER(name) = 'tennis nike blanco';

UPDATE garment_types SET name = 'Tennis Nike negro'
WHERE school_id IS NULL AND LOWER(name) = 'tennis nike negro';

UPDATE garment_types SET name = 'Zapatos goma'
WHERE school_id IS NULL AND LOWER(name) = 'zapatos goma';

-- Title Case general (idempotente, no rompe los renames anteriores porque ya están bien capitalizados)
UPDATE garment_types
SET name = UPPER(SUBSTRING(TRIM(name), 1, 1)) || LOWER(SUBSTRING(TRIM(name), 2))
WHERE name <> UPPER(SUBSTRING(TRIM(name), 1, 1)) || LOWER(SUBSTRING(TRIM(name), 2));

UPDATE products
SET name = UPPER(SUBSTRING(TRIM(name), 1, 1)) || LOWER(SUBSTRING(TRIM(name), 2))
WHERE name IS NOT NULL
  AND name <> UPPER(SUBSTRING(TRIM(name), 1, 1)) || LOWER(SUBSTRING(TRIM(name), 2));

UPDATE products
SET color = UPPER(SUBSTRING(TRIM(color), 1, 1)) || LOWER(SUBSTRING(TRIM(color), 2))
WHERE color IS NOT NULL AND color <> '';

-- =================== DELANTAL COMFAMA FIX ===================

-- A.1.1 Mover los 5 delantales fucsia del genérico → gt específico
UPDATE products
SET garment_type_id = 'a270367f-9465-4123-91fe-56f27c6d5b06'  -- Delantal Comfama fucsia
WHERE garment_type_id = '93858642-5bd5-4222-8aed-1b89af976aa1'  -- Delantal genérico Comfama
  AND LOWER(color) = 'fucsia';

-- A.1.2 Crear gt Delantal Comfama morado y mover los 5
INSERT INTO garment_types (id, school_id, name, category, is_active, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  '45a33bc8-a732-4208-b99f-91f100077114',  -- Comfama
  'Delantal comfama morado',
  'school_uniform',
  true,
  NOW(),
  NOW()
) RETURNING id \gset

UPDATE products
SET garment_type_id = :'id'  -- usar el id retornado del INSERT
WHERE garment_type_id = '93858642-5bd5-4222-8aed-1b89af976aa1'
  AND LOWER(color) = 'morado';

-- A.1.3 Completar lo que falta a Delantal comfama amarillo (3) y Delantal comfama azul (1)
UPDATE products
SET garment_type_id = '28ed07bd-35e0-468d-ad43-d9762a3d8394'  -- Delantal comfama amarillo
WHERE garment_type_id = '93858642-5bd5-4222-8aed-1b89af976aa1'
  AND LOWER(color) = 'amarillo';

UPDATE products
SET garment_type_id = 'bc2b8af2-38f7-4a66-a2dc-c917851e1485'  -- Delantal comfama azul
WHERE garment_type_id = '93858642-5bd5-4222-8aed-1b89af976aa1'
  AND LOWER(color) = 'azul';

-- A.1.4 Genérico vacío → marcar inactivo (no DELETE por FKs históricos)
UPDATE garment_types SET is_active = false
WHERE id = '93858642-5bd5-4222-8aed-1b89af976aa1'
  AND NOT EXISTS (SELECT 1 FROM products WHERE garment_type_id = '93858642-5bd5-4222-8aed-1b89af976aa1' AND is_active);

-- A.1.5 Re-aplicar Title Case a los renames Comfama (ya están en lowercase post-merge)
UPDATE garment_types
SET name = UPPER(SUBSTRING(name, 1, 1)) || LOWER(SUBSTRING(name, 2))
WHERE LOWER(name) LIKE 'delantal comfama %';

-- =================== BUGS POR LIMPIAR ===================

-- Fe y Alegria CAMISA 4: desactivar el más antiguo
UPDATE products SET is_active = false
WHERE id = (SELECT id FROM products
            WHERE code IN ('PRD-0002', 'PRD-0006')
              AND name ILIKE 'camisa%'
            ORDER BY created_at ASC LIMIT 1);

-- Pinal Delantal azul duplicados inactivos (precio viejo 22k): DELETE seguro porque no hay ventas
DELETE FROM products
WHERE code IN ('PRD-0046','PRD-0047','PRD-0048','PRD-0049','PRD-0054')
  AND NOT is_active
  AND NOT EXISTS (SELECT 1 FROM sale_items si WHERE si.product_id = products.id);
```

**A.4 Poblar variantes para globales huérfanos (decisión #11)**

Datos desde el Excel Caracas (válido para Pumarejo y Pinal por ser globales). Precios provisionales — confirmar con equipo antes de v3 deploy:

```sql
-- Asumiendo que Bicicleteros ya se renombró a 'Bicicletero' en A.1 (post Title Case)
-- Variantes Bicicletero niña: 3 tallas × 3 colores = 9 variantes
WITH bici AS (SELECT id FROM garment_types WHERE school_id IS NULL AND name = 'Bicicletero')
INSERT INTO products (id, school_id, garment_type_id, code, name, size, color, gender, price, is_active, created_at, updated_at)
SELECT
  gen_random_uuid(), NULL, bici.id,
  'PRD-G-BICI-' || ROW_NUMBER() OVER (),
  'Bicicletero',
  size_val, color_val, 'niña',
  18000, true, NOW(), NOW()
FROM bici,
  unnest(ARRAY['4-6','6-8','8-10']) size_val,
  unnest(ARRAY['Azul oscuro','Blanco','Negro']) color_val;

-- Bicicletero dama: 1 talla única × 3 colores
INSERT INTO products (id, school_id, garment_type_id, code, name, size, color, gender, price, is_active, created_at, updated_at)
SELECT
  gen_random_uuid(), NULL,
  (SELECT id FROM garment_types WHERE school_id IS NULL AND name = 'Bicicletero'),
  'PRD-G-BICI-D-' || ROW_NUMBER() OVER (),
  'Bicicletero', 'Única', color_val, 'dama',
  20000, true, NOW(), NOW()
FROM unnest(ARRAY['Azul oscuro','Blanco','Negro']) color_val;

-- Top deportivo (renombrado desde 'Top' en A.1)
WITH top_gt AS (SELECT id FROM garment_types WHERE school_id IS NULL AND name = 'Top deportivo')
INSERT INTO products (id, school_id, garment_type_id, code, name, size, color, gender, price, is_active, created_at, updated_at)
-- Niña: 3 tallas, blanco
SELECT
  gen_random_uuid(), NULL, top_gt.id,
  'PRD-G-TOP-N-' || ROW_NUMBER() OVER (),
  'Top deportivo', size_val, 'Blanco', 'niña',
  15000, true, NOW(), NOW()
FROM top_gt, unnest(ARRAY['4-6','6-8','8-10']) size_val
UNION ALL
-- Dama: talla única, blanco
SELECT
  gen_random_uuid(), NULL,
  (SELECT id FROM garment_types WHERE school_id IS NULL AND name = 'Top deportivo'),
  'PRD-G-TOP-D-1', 'Top deportivo', 'Única', 'Blanco', 'dama',
  18000, true, NOW(), NOW();

-- Boxer: NO está en el Excel del equipo. Conservar el gt 'Boxer' activo pero sin variantes
-- (decidir en posterior sprint si crear variantes o eliminar). Como decisión #11 dice
-- "crear variantes", asumimos boxer básico unisex 6-16:
WITH boxer AS (SELECT id FROM garment_types WHERE school_id IS NULL AND name = 'Boxer')
INSERT INTO products (id, school_id, garment_type_id, code, name, size, color, gender, price, is_active, created_at, updated_at)
SELECT
  gen_random_uuid(), NULL, boxer.id,
  'PRD-G-BOX-' || ROW_NUMBER() OVER (),
  'Boxer', size_val, 'Negro', 'unisex',
  12000, true, NOW(), NOW()
FROM boxer, unnest(ARRAY['6','8','10','12','14','16']) size_val;

-- Crear inventory zero para todas las variantes nuevas
INSERT INTO inventory (id, school_id, product_id, quantity, reserved_quantity, min_stock_alert, last_updated)
SELECT gen_random_uuid(), NULL, p.id, 0, 0, 5, NOW()
FROM products p
WHERE p.code LIKE 'PRD-G-BICI-%' OR p.code LIKE 'PRD-G-TOP-%' OR p.code LIKE 'PRD-G-BOX-%';
```

**Notas para el equipo antes de aplicar A.4:**
- Bicicletero niña precio asumido $18.000, dama $20.000 (los del rango de medias). Confirmar.
- Top deportivo precio asumido $15.000 (niña) / $18.000 (dama). Confirmar.
- Boxer no está en Excel team — preguntar si dejarlo (con variantes default), eliminarlo, o crear con specs distintas.

**A.2 Crear seed script `backend/scripts/seed_catalog_from_team_zip.py`** que:
1. Itera `documentos/Catalogo/HERRAMIENTAS.../APARTADO_*/`
2. Para cada imagen, hace match con `garment_type.name` (post-rename A.1) por nombre normalizado
3. Sube la imagen al endpoint correspondiente (escolar o global) si el gt no tiene primary image
4. Reporta qué imágenes no encontraron match (acción manual)

**A.3 Crear tests:** `backend/tests/integration/test_catalog_stability.py` que verifica post-A.1:
- No quedan gt con name lowercase
- No quedan gt `Yomber`/`Interios`
- `Delantal Comfama fucsia` tiene exactamente 5 productos
- No quedan productos activos duplicados por `(school_id, garment_type_id, size, color)`

### Fase B — Slugs y constraints (1 día, en `uniformes_db`)

**B.1 Migración slug fix (decisión #10: cambio limpio, sin 301)**
```sql
UPDATE schools SET slug = 'comfama' WHERE slug = 'confama';
UPDATE schools SET slug = 'buen-comienzo' WHERE slug = 'buen-comiezo';
UPDATE schools SET slug = 'institucion-educativa-hector-abad-gomez'
WHERE slug = 'institucion-educativa-hector-abad-gomes';
UPDATE schools SET slug = 'institucion-educativa-manuel-jose-caycedo'
WHERE slug = 'institucion-educativa-manuel-jose-caicedo';
```

**B.2 Migración constraint único** `(school_id, garment_type_id, size, color)` en `products`:
```sql
-- Después de los DELETE/UPDATE de duplicados en A.1 y los INSERT de A.4
ALTER TABLE products ADD CONSTRAINT uq_product_variant
UNIQUE NULLS NOT DISTINCT (school_id, garment_type_id, size, color);
```

**B.3 (omitido)** No se requieren redirects 301 — no hay material impreso apuntando a los slugs viejos.

### Fase C — Guard backend (0.5 día, en `uniformes_db` + código)

**C.1 Modificar `backend/app/services/garment_type.py`** (o equivalente):
- Endpoint POST de gt: si se intenta crear con `is_active=true` sin productos, marcar como `pending=true` o requerir wizard de 2 pasos
- Agregar test que verifica el guard

**C.2 Modificar `backend/app/api/routes/garment_types.py`** endpoint POST images:
- Antes de guardar nueva imagen, eliminar archivos previos del mismo `garment_type_id` en disco
- Test de integración con dos uploads consecutivos

### Fase D — Re-generar Excel del equipo (0.5 día) — decisión #7

**D.1 Script `backend/scripts/export_catalog_to_excel.py`** que genera un Excel por escuela + uno global con:
- Garment type name (post-fix)
- Variantes (size, color, gender)
- Precio
- Tiene imagen sí/no
- Stock actual

**D.2 Compartir con equipo** los Excels generados como sustituto definitivo de los `Guia_Tallas_*.xlsx` originales.

### Fase E — Pre-deploy QA en dev v3 (1 día)

**E.1 Levantar web-portal contra `uniformes_db`** y verificar:
- Los 4 colegios canónicos muestran lo esperado
- Delantal Comfama fucsia/morado/amarillo/azul aparecen como 4 cards separados con imágenes
- Globales con nombres nuevos visibles (Camiseta blanca piel de durazno, etc.)
- Slugs nuevos resuelven correctamente

**E.2 Pytest catalogue suite verde:**
```bash
cd backend && pytest tests/integration/test_catalog_stability.py -v
```

**E.3 Smoke manual:** screenshots comparativos antes/después de cada colegio.

### Fase F — Deploy v3 a prod (cuando se agende ventana)

Se ejecuta SOLO cuando todo el track v3 esté listo. La migración del catálogo viaja en el mismo bundle:
1. Pre-deploy backup completo de DB prod
2. Aplicar alembic migrations (incluye `vXcatalog001_catalog_stabilization`)
3. Correr `seed_catalog_from_team_zip.py` post-migration para subir imágenes
4. Switch Nginx config para slugs nuevos + 301 viejos
5. Verificar web prod manualmente

---

## 8. Decisiones — TODAS RESUELTAS

| # | Decisión | Resolución |
|---|---|---|
| 1 | Yomber → Jumper | ✅ |
| 2 | Title Case (Mayúscula primera, resto minúscula) | ✅ |
| 3 | Tennis Nike (no rename) | ✅ Mantener |
| 4 | Camisa basica → Camiseta blanca piel de durazno | ✅ |
| 5 | Camisillas → Camiseta blanca tipo esqueleto | ✅ |
| 6 | Estandarizar medias existentes (sin crear Medias Natalia) | ✅ |
| 7 | Incluir Chompa gris + re-generar Excel para el equipo | ✅ |
| 8 | Todo el fix va en v3, no toca prod actual | ✅ |
| 9 | Línea "polo algodón" Comfama (0 stock) | ✅ **Mantener visible** — sigue como alternativa, no se desactiva |
| 10 | Slugs corregidos: ¿hay material impreso con typos? | ✅ **No** — cambio limpio sin redirects 301 |
| 11 | Bicicletero/Boxer/Top globales huérfanos | ✅ **Crear variantes** (detalle en §7.A.4 abajo) |

**Pendiente menor para implementación:** precios de Bicicletero/Top deportivo no están en los Excels del equipo. Asumir precios del rango existente (`Medias` $10k-$13k para shorts/tops) o pedir al equipo antes del deploy.

---

## 9. Comandos útiles

```bash
# Snapshot prod fresco (read-only para análisis)
bash backend/scripts/refresh_prod_snapshot.sh

# Conectar a dev v3
docker exec -it uniformes-postgres psql -U uniformes_user -d uniformes_db

# Conectar a snapshot prod
docker exec -it uniformes-postgres psql -U uniformes_user -d uniformes_prod_snapshot

# Login API prod (auditoría read-only)
TOKEN=$(curl -sS -X POST 'https://api.yourdomain.com/api/v1/auth/login' \
  -H 'Content-Type: application/json' \
  -d '{"username":"public-viewer","password":"Public2025"}' \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["token"]["access_token"])')

# Backend dev contra uniformes_db (validar fixes localmente)
cd backend && source venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8001

# Web portal contra backend dev
cd web-portal && NEXT_PUBLIC_API_URL=http://localhost:8001 pnpm dev
```

## 10. Screenshots de evidencia (prod web 2026-05-24)

- `catalog-2026-05-24-homepage.png` — Homepage con 11 colegios + typos en slugs
- `catalog-2026-05-24-caracas.png` — Caracas: 8 escolares + 11 globales
- `catalog-2026-05-24-pumarejo.png` — Pumarejo: 8 escolares + 11 globales
- `catalog-2026-05-24-pinal.png` — Pinal con typo "Interios"
- `catalog-2026-05-24-comfama-full.png` — Comfama con caos visible (Yomber, lowercase, Delantal genérico + parciales por color)

---

## 11. Resumen para el owner

**Lo que hay que hacer (todas las decisiones del owner ya tomadas):**
1. Estabilizar el catálogo en `uniformes_db` (dev v3) — Fases A-D del plan, ~3-4 días de trabajo
2. Pedir al equipo confirmación de precios Bicicletero / Top deportivo / Boxer (input bloqueador menor para A.4)
3. QA en dev v3 — Fase E, 1 día
4. Cuando se agende ventana de v3 deploy, las migraciones del catálogo viajan en el mismo bundle — Fase F

**Lo que NO se va a hacer (decisión #8):**
- ❌ Cero SQL directo sobre prod v2.9.0
- ❌ Cero hotfix individual del Delantal fucsia
- ❌ Cero cambio a prod hasta que v3 deploye

**Riesgo aceptado:**
- La web prod sigue con los caos visibles (Yomber, naming inconsistente, Delantal Comfama fucsia ausente) hasta el deploy de v3
- No se introducen nuevos bugs, solo se posterga la corrección de los existentes
- El equipo administrativo puede seguir creando productos en prod; al hacer el deploy v3, la migración seed los reorganiza

**Bloqueo principal:**
La ventana de deploy v3 está sin agendar. La estabilización del catálogo se puede preparar ya en dev pero no entra a prod hasta que v3 entre. Recomendación: usar este trabajo de catálogo como uno de los criterios "ready" del go-live de v3.

---

*Generado en sesión 2026-05-24. Reemplaza versión previa (que asumía hotfix directo a prod sin considerar v3).*
