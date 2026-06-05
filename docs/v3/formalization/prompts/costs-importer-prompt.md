# Prompt: Importer de Costos Manuscritos al Sistema (UCR v3 — M3 Prep)

> **Para sesión nueva.** Self-contained. Pégame este prompt en una sesión limpia de Claude Code en el repo `uniformes-system-v2`. No requiere contexto previo.

---

## 1. Por qué existe esto

UCR está en **sprint de estabilización contable Q2-2026** preparando deploy v3. Uno de los tres frentes de M3 es **importar los costos reales de producción** al sistema, porque sin costos confiables el COGS y la utilidad real son ficción.

Los costos vienen de cuadernos manuscritos de la dueña (Consuelo Ríos). Su hijo (el hermano del owner) los está transcribiendo a Excel con un workflow PowerShell+Excel COM ya estandarizado. **A día de hoy hay 39 archivos `.xlsx` consolidados** — son el primer batch listo para migrar.

El sistema **YA tiene la infraestructura de cost breakdown**: tablas, servicios, UI editor, 19 tests backend pasando. Lo que falta es **el importer** que toma los xlsx y puebla las tablas.

> **Lo que NO es este task**: NO es diseñar el modelo de costos (ya está). NO es modificar la UI. NO es tocar el workflow del hermano. NO es importar bancos ni encargos audit (otros frentes M3).

---

## 2. Objetivo

Producir un script Python en `backend/scripts/import_costs_from_xlsx.py` que:

1. Toma como input una carpeta con los 39 xlsx (formato fijo, ver §4).
2. Identifica colegio + prenda + tallas + costos por componente.
3. Mapea a `schools.id` y `garment_types.id` existentes (con reporte de ambigüedades).
4. Pobla/actualiza `cost_component_templates` y `product_cost_components` (o las tablas reales — confirmar en §5).
5. Es **idempotente** (re-correr no duplica), **dry-run-first**, y emite un **markdown report** con: productos creados/actualizados, gaps detectados (tallas Pendiente), colegios sin match, prendas ambiguas.
6. Acompañado de tests pytest contra fixtures del propio zip.

**Done cuando**:
- `python backend/scripts/import_costs_from_xlsx.py --dry-run` corre limpio y reporta plan.
- `python backend/scripts/import_costs_from_xlsx.py --commit` puebla la DB y devuelve report.
- `pytest backend/tests/scripts/test_import_costs.py -v` pasa.
- Spot-check manual: 1 producto verificado vía SQL coincide con el xlsx fuente.

---

## 3. Contexto operativo

### Repo y entorno
- **CWD**: `/Users/angelsamuelsuescarios/Documents/03_Proyectos/Codigo/uniformes-system-v2`
- **Branch**: `chore/stabilization-sprint-2026-Q2` (NO crear branch nueva — regla global)
- **Backend venv**: `backend/venv/` (activar antes de cualquier import; tiene SQLAlchemy 2.0, Pydantic v2, FastAPI, pytest)
- **openpyxl**: NO está en backend venv. Hay que instalarlo PRIMERO. **Solo si el usuario lo autoriza explícitamente en el chat** (regla global anti supply-chain). Ofrece dos opciones:
  - (a) `pip install openpyxl==3.1.5` dentro de backend/venv
  - (b) usar `python3` del sistema que ya tiene openpyxl 3.1.5

### DB de trabajo
- **Container**: `uniformes-postgres` (puerto 5432)
- **DB destino**: `uniformes_db` (tiene migraciones v3 + cost_component schema)
- **DB de referencia read-only**: `uniformes_prod_snapshot` (refrescado hoy desde prod)
- **Credenciales dev**: `uniformes_user` / ver `backend/.env`

### Archivos input
- **Zip de costos** (NO descomprimir en repo, está gitignored): `documentos/Costos/COSTOS-20260516T232636Z-3-001.zip` (491KB, 39 xlsx)
- **Spec del formato xlsx** (autoritativo, leerlo COMPLETO antes de codear): `documentos/Costos/CLAUDE.md`
- **Sample ya extraído** disponible en `/tmp/ucr-costos-sample/Colegio_Comfama_Camiseta.xlsx` (puede haber sido borrado; re-extraer si no está)

### Reglas globales del usuario (NO violar)
- **NO crear branches nuevas.** Trabajar sobre `chore/stabilization-sprint-2026-Q2`.
- **NO `pip install` ni `npm install` sin autorización explícita** en el mensaje del chat.
- **Conventional commits SIN emojis, SIN Co-Authored-By de Claude.**
- **Mensajes de error al usuario en español.**
- **Fechas con `app.utils.timezone`** (`get_colombia_now_naive()`), nunca `datetime.now()`.
- **SQLAlchemy 2.0 style** (`select()`, `async with`, `result.scalars()`).

---

## 4. Estructura del xlsx (CRÍTICO leer entero)

**Lee primero**: `documentos/Costos/CLAUDE.md` líneas completas. Define el contrato.

Resumen ejecutivo del formato (verificado contra `Colegio_Comfama_Camiseta.xlsx`):

### Hoja 1 — `Telas`
- A1: título `COLEGIO <NOMBRE> - <PRENDA>` (mayúsculas, mergeado A1:D1)
- Header en fila 3: `Tela | Tipo | Colores | Precio por metro`
- Datos desde fila 4. Generalmente 1 tela "Principal" + 1 "Colores".

### Hoja 2 — `Insumos`
- Header en fila 3: `Concepto | Valor | Notas`
- Datos en filas 4-10 (Marquilla logo, Talla c/u, Confección, Bolsa+cinta, Bordado, Broche, Corte).
- Fila 11: `TOTAL INSUMOS` con fórmula `=SUM(B4:B10)`. **Ignorar al importar**, recalcular.

### Hoja 3 — `Consumo Tela`
- Header en fila 3: `Talla | Tela principal (cm) | Unidades por corte | Costo total corte | Costo tela c/u`
- Datos por talla desde fila 4. **Las tallas con "Pendiente" en cualquier columna → marcar gap, NO inventar.**
- Bloque "TELA COMPLEMENTO (RIB)" tras las tallas: una fila merge + una fila flat (`Todas | 20 | 1 | 2300 | 2300`).

### Hoja 4 — `Total por Talla`
- **Solo referencia visual**, todo es fórmula. Al importar, **recalcular** desde Telas + Insumos + Consumo Tela. No fiarse de los valores cacheados (pueden estar stale si el xlsx no se abrió post-edición).

### Convención de archivo
- `Colegio_<Codigo>_<Prenda>.xlsx`
- Códigos vistos en el zip: `Comfama`, `FHB`, `HAG`, `JDLCP`, `JIGL`, `MJC`, `Pinal`, `Pumarejo`, `Caracas`, `BuenComienzo`
- Prendas vistas: `Camiseta`, `Camiseta_Diario`, `Camiseta_Fisica`, `Camiseta_Algodon`, `Sudadera`, `Chompa`, `Chompa_Gris`, `Chompa_Azul`, `Delantal`, `Jomber`
- **Excepción**: `Jomber_Pumarejo_Pinal_Caracas.xlsx` aplica a 3 colegios (mismo costo). Hay 3 copias (una por carpeta de colegio). Importar UNA VEZ y vincular a los 3 productos.

---

## 5. Discovery (PRIMERA FASE — NO CODEAR AÚN)

Esta fase es **read-only**. Genera un documento `docs/v3/formalization/costs-importer-discovery.md` con tus hallazgos. Recién después codeas.

### 5.1 Modelos existentes
Lee y resume:
- `backend/app/models/product.py` (o donde estén productos/garments)
- `backend/app/models/school.py`
- Buscar con grep: `cost_component_templates`, `product_cost_components`, `unit_cost`. Documentar columnas, FKs, constraints. **Si el nombre real difiere de "cost_component_templates", reportar el real.**
- Buscar service: `backend/app/services/cost_breakdown.py` o similar. Ver si hay un upsert público reusable o tienes que tocar DB directo.

### 5.2 Mapeo colegios → schools.id

Query a `uniformes_prod_snapshot`:
```sql
SELECT id, name, code, slug FROM schools ORDER BY name;
```

Para cada código del xlsx (`FHB`, `JIGL`, `MJC`, `JDLCP`, `HAG`, `Pinal`, `Pumarejo`, `Caracas`, `BuenComienzo`, `Comfama`), proponer el match a `schools` con **score de confianza**. Conocidos:
- `FHB` = **Felix Henao Botero**
- `JIGL` = **Gota de Leche** (ojo: hay otro "Fe y Alegría" en la misma carpeta, distinguir)
- `MJC` = **Manuel José Caicedo**
- `JDLCP` = **Juan de la Cruz Posada**
- `HAG` = **Héctor Abad Gómez**
- `Pinal` = **Institución Educativa El Pinal**
- `Pumarejo` = **Institución Educativa Alfonso López Pumarejo**
- `Caracas` = **Institución Educativa Caracas**
- `BuenComienzo` = **Buen Comienzo**
- `Comfama` = **Comfama**

**Reportar como tabla** en el discovery markdown:
```
| Código xlsx | School name (DB) | school.id | Confidence | Notas |
|-------------|------------------|-----------|------------|-------|
| FHB         | Felix Henao...   | uuid...   | 100%       | match exacto |
| JIGL        | Gota de Leche... | uuid...   | 80%        | ambigüedad: hay 2 colegios en carpeta |
```

### 5.3 Mapeo prendas → garment_types

Query:
```sql
SELECT id, name, code FROM garment_types ORDER BY name;
```

Mapear las 10 prendas. Las variantes (`Camiseta` vs `Camiseta_Diario` vs `Camiseta_Fisica` vs `Camiseta_Algodon`) **probablemente son productos distintos en DB con mismo `garment_type` pero diferente variant/tela**. Investigar y reportar.

### 5.4 Match producto-específico

Cada `Colegio_X_Prenda.xlsx` debería corresponder a 1 fila en `products`:
```sql
SELECT p.id, p.name, s.name as school, gt.name as garment
FROM products p
JOIN schools s ON p.school_id = s.id
JOIN garment_types gt ON p.garment_type_id = gt.id
WHERE s.code = 'FHB'  -- ejemplo
ORDER BY gt.name;
```

**Reportar** xlsx que NO tienen producto correspondiente (gap), y productos en DB que NO tienen xlsx (cobertura).

### 5.5 Decisiones que requieren input del owner ANTES de implementar

Lista en el discovery markdown:
- ¿Cómo manejar tallas "Pendiente"? Recomendación: importar como NULL + setear `has_gap=true` en el producto.
- ¿Sobreescribir costos existentes o solo poblar vacíos? Recomendación: en `--commit` por default solo vacíos; con `--overwrite` actualizar todo. Snapshot del valor previo en cada update.
- ¿Activar como **componentes compartidos** (insumos repetidos entre productos: marquilla, confección) o duplicar por producto? Recomendación: si `cost_component_templates` es la tabla compartida, usarla; los `product_cost_components` referencian el template.
- ¿Versionado de costos? Si el modelo tiene `effective_from`/`effective_to`, este import marca la fecha de hoy como `effective_from`. Si no, no inventar.

**STOP. Esperar OK del usuario sobre las decisiones antes de codear.**

---

## 6. Implementación (POST discovery aprobado)

### 6.1 Script
`backend/scripts/import_costs_from_xlsx.py` con CLI:
```
python import_costs_from_xlsx.py [--zip PATH | --dir PATH] [--dry-run | --commit] [--overwrite] [--only "Comfama,Pinal"] [--report-out PATH]
```

Defaults:
- `--dry-run` por default (commit explícito requerido).
- Input: zip de `documentos/Costos/` si no se especifica.
- Report: `docs/v3/formalization/imports/costs-import-<timestamp>.md`.

### 6.2 Estructura del script
1. **Extract** zip a `tempfile.TemporaryDirectory()`. NO dejar archivos sueltos.
2. **Parse** cada xlsx con openpyxl `data_only=False` (queremos las fórmulas para recalcular) + `data_only=True` (para verificar nuestros cálculos vs. los que Excel cacheó).
3. **Validate**: estructura de las 4 hojas. Si falla, log warning y SKIP ese archivo (no abortar batch).
4. **Compute** costos por talla manualmente. NO fiarse de los valores cacheados.
5. **Map** colegio + prenda. Si hay ambigüedad sin match alto-confidence, SKIP + log warning.
6. **Upsert** vía servicio existente (preferido) o DB directo con UPSERT clause + ON CONFLICT.
7. **Snapshot** del estado previo en `expense_audit_log` o tabla similar (revisar en discovery).
8. **Emit** report markdown con: archivos procesados, productos modificados, errores, tallas pendientes, totales por colegio.

### 6.3 Logging
Usar `structlog` (ya en el stack). Cada record: `xlsx_filename`, `school_code`, `garment`, `product_id`, `action` (created/updated/skipped/error), `gap_reasons` (lista).

### 6.4 Idempotencia
Re-correr 2 veces seguidas: la segunda debe reportar 0 cambios (o solo cambios donde el xlsx cambió genuinamente). Test pytest verifica esto.

---

## 7. Tests

`backend/tests/scripts/test_import_costs.py`:
1. **`test_parses_comfama_camiseta_correctly`**: parsea el sample, verifica que talla 2 → costo total $14,370 (computed manually, no Excel cache).
2. **`test_handles_pendiente_size`**: talla 10 → marcada como gap, no inventada.
3. **`test_jomber_shared_across_three_schools`**: el xlsx multi-colegio crea 3 product_cost_components (uno por school).
4. **`test_idempotent_run`**: 2 corridas consecutivas → segunda devuelve 0 cambios.
5. **`test_dry_run_does_not_write`**: con `--dry-run`, count de cost_components antes == después.

Fixtures: copiar 2-3 xlsx representativos (Comfama Camiseta, Comfama Sudadera, Jomber multi-colegio) a `backend/tests/fixtures/costos/`. NO el zip completo (peso).

---

## 8. Verificación manual final

Antes de commitear:
1. `python backend/scripts/import_costs_from_xlsx.py --dry-run` → report sano.
2. `python backend/scripts/import_costs_from_xlsx.py --commit` → ejecuta.
3. SQL spot-check en `uniformes_db`:
   ```sql
   SELECT p.name, pcc.component_name, pcc.unit_cost, pcc.size
   FROM products p
   JOIN product_cost_components pcc ON pcc.product_id = p.id
   WHERE p.school_id = (SELECT id FROM schools WHERE code = 'FHB')
   AND p.garment_type_id = (SELECT id FROM garment_types WHERE code = 'CAMISETA_FISICA')
   ORDER BY pcc.size, pcc.component_name;
   ```
   Comparar con el xlsx fuente.
4. Abrir la UI del Cost Breakdown Editor para ese producto (modulo accounting/products) y verificar que aparece poblado.
5. `pytest backend/tests/scripts/test_import_costs.py -v` → 5/5 pass.

---

## 9. Commit & cleanup

### Conventional commit (sin emoji, sin Co-Authored-By)
```
feat(costs): import script for handwritten cost xlsx into cost_component tables

- Parse 4-sheet xlsx format (Telas, Insumos, Consumo Tela, Total por Talla)
- Map school codes (FHB, JIGL, MJC, ...) and garment variants to DB
- Idempotent upsert with snapshot in cost_history (or audit log)
- Handle "Pendiente" sizes as NULL + has_gap=true
- Multi-school garments (Jomber) imported once, linked to 3 products
- 5 pytest tests covering parsing, gaps, idempotency, dry-run

Imports 39 xlsx covering 10 schools. Report:
docs/v3/formalization/imports/costs-import-2026-MM-DD.md
```

### Verificar
- `git status` sin archivos sueltos en `/tmp` o `backend/scripts/_temp_*`.
- `documentos/Costos/` no aparece en `git status` (debe estar gitignored).
- `backend/tests/fixtures/costos/` SÍ commiteado (necesario para CI).

---

## 10. Cosas a NO hacer

- **NO instalar openpyxl sin autorización explícita** del usuario en el chat. Pregunta primero.
- **NO crear branches** nuevas. Trabajar sobre `chore/stabilization-sprint-2026-Q2`.
- **NO descomprimir el zip dentro del repo.** Solo en `/tmp` o `tempfile.TemporaryDirectory()`.
- **NO commitear los xlsx fuente.** `documentos/` está gitignored — verifica.
- **NO confiar en los valores cacheados de las celdas con fórmula** (Hoja 4 "Total por Talla"). Recalcular siempre.
- **NO inventar valores** para tallas "Pendiente". Marcar gap.
- **NO modificar el workflow PowerShell** del hermano. Es su dominio, no toques `documentos/Costos/scripts/` ni `documentos/Costos/CLAUDE.md`.
- **NO usar `datetime.now()`** ni equivalentes. Usar `app.utils.timezone.get_colombia_now_naive()`.
- **NO escribir mensajes de error al usuario en inglés.** Español siempre.

---

## 11. Output esperado al final de la sesión

1. Discovery markdown: `docs/v3/formalization/costs-importer-discovery.md` (~150-300 líneas).
2. Importer: `backend/scripts/import_costs_from_xlsx.py` (~400-700 líneas).
3. Tests: `backend/tests/scripts/test_import_costs.py` (5 tests, fixtures en `backend/tests/fixtures/costos/`).
4. Import report ejecutado: `docs/v3/formalization/imports/costs-import-<timestamp>.md` con métricas: N productos creados/actualizados, N tallas pendientes, N archivos skipped + razón.
5. Commit en `chore/stabilization-sprint-2026-Q2`.
6. Resumen final en el chat: cuántos productos quedaron con costos completos vs gap, tiempo invertido, próximos pasos sugeridos (típicamente: revisar gaps con Mama, conseguir xlsx faltantes).

---

## 12. Tiempo esperado

- Discovery: 45-60 min (lectura modelos + queries + mapeo + decisiones).
- Implementación: 2-3h (parser + mapper + upsert + report).
- Tests + verificación: 30-45 min.
- **Total: 4-5h** en una sesión enfocada.

Si pasas de 6h, **PARA y reporta** dónde te atascaste — probablemente hay decisión de modelo que requiere input del owner.
