# Costs Importer — Plan Revisado tras Contraste con Desarrollo

> **Fecha:** 2026-05-16
> **Original:** `docs/v3/formalization/prompts/costs-importer-prompt.md`
> **Contraste con:** dev DB actual (`uniformes_db`), modelos, tests, chain alembic
> **Branch:** `chore/stabilization-sprint-2026-Q2` (no crear nueva — regla global)

---

## TL;DR

El prompt original asume estado que **ya cambió**: openpyxl está instalado, los modelos existen, el zip está, el sample está. La infraestructura **está**, pero **3 supuestos críticos del prompt son falsos o incompletos**:

1. **Tests "19/19 pasando" → realidad: 21 pasan, 16 fallan** por bug async-loop en fixtures. Deuda técnica pre-existente.
2. **`pcc.size` no existe** como columna — costos por talla se modelan via "un Product por talla".
3. **`uniformes_prod_snapshot` no tiene `cost_*` tables** — la infraestructura aún no llegó a prod. El importer solo puede correr en dev hasta que migración v3 entre a prod.

Plan revisado abajo ataca solo lo no hecho, en el orden correcto dado el estado real.

---

## Estado real (verificado 2026-05-16)

### ✓ Hecho (no re-hacer)

- **Infraestructura cost_breakdown** en dev: tablas `cost_component_templates` + `product_cost_components`, modelos en `app/models/product.py` líneas 180-234, service `app/services/cost_component.py`, routes con UI.
- **openpyxl 3.1.2** instalado en `backend/venv/` (no requiere autorización).
- **Spec autoritativa** del xlsx en `documentos/Costos/CLAUDE.md` (lectura obligatoria antes de codear).
- **Zip de 39 xlsx** en `documentos/Costos/COSTOS-20260516T232636Z-3-001.zip` (gitignored).
- **Sample extraído** en `/tmp/ucr-costos-sample/Colegio_Comfama_Camiseta.xlsx`.
- **uniformes_prod_snapshot** DB existe (sin cost_* tables — esperado).
- **Chain alembic** estable: head `v3_design_cleanup_001` (rama Q2 stabilization).

### ✗ Falta hacer

1. Discovery markdown
2. Importer script
3. Tests del importer + fixtures
4. Mapeo formal codes → DB
5. **Decisión arquitectónica: cómo modelar costo variable-por-talla** (el modelo NO tiene `pcc.size`)

### ⚠ Deuda técnica conocida que cruza este sprint

1. **16/37 tests de `test_cost_component_routes.py` fallan** con `Task got Future attached to a different loop` — fixture async-loop bug. Solo tests, no producción. Hay que decidir: ¿reparar fixtures antes del importer, o aceptar como precondición y arreglar después?
2. **Prod aún no tiene cost_* tables** — el importer puede correr solo en dev hasta que el frente `v3-migration-on-prod-data-prompt.md` aplique las migraciones a prod.

---

## Discrepancia crítica con el prompt: costos por talla

### Lo que el prompt asume

```sql
SELECT p.name, pcc.component_name, pcc.unit_cost, pcc.size
FROM products p JOIN product_cost_components pcc ON pcc.product_id = p.id
```

Asume que `product_cost_components` tiene columnas `component_name`, `unit_cost`, `size`. **Ninguna existe en el modelo real.**

### Modelo real

```python
class ProductCostComponent(Base):
    __tablename__ = "product_cost_components"
    id: UUID
    product_id: UUID         # FK → products(id)
    template_id: UUID        # FK → cost_component_templates(id)
    amount: Decimal(10,2)
    notes: Text | None

class CostComponentTemplate(Base):
    __tablename__ = "cost_component_templates"
    id: UUID
    garment_type_id: UUID    # FK → garment_types(id)
    name: str                # "Marquilla logo", "Tela principal", ...
    code: str
    is_variable: bool        # ← clave: marca si el costo varía entre tallas
    display_order: int
    is_active: bool

class Product(Base):
    size: str                # ← talla vive aquí, no en el cost component
```

### Diseño implícito (a confirmar antes de codear)

- **Cada talla es un Product distinto** (mismo `school_id` + `garment_type_id`, distinto `size`).
- El **template** se crea una vez por `garment_type` (ej. Camiseta Comfama tiene templates: Tela principal, Tela complemento, Marquilla, Talla, Confección, Bolsa+cinta, Bordado, Broche, Corte).
- Por cada Product (talla), se crea **un `ProductCostComponent` por template**. Si el template `is_variable=True` (Tela principal), el `amount` varía según xlsx Consumo Tela. Si es `is_variable=False` (Insumos), `amount` es flat.

### Mapeo xlsx → modelo

Para `Colegio_Comfama_Camiseta.xlsx`:

| Xlsx hoja | Genera |
|---|---|
| Telas (2 filas: Lacost / Poli-Lacost) | 2 `CostComponentTemplate` con `is_variable=True` |
| Insumos (7 filas: Marquilla, Talla, Confección, Bolsa, Bordado, Broche, Corte) | 7 `CostComponentTemplate` con `is_variable=False` |
| Consumo Tela (N filas por talla) | Para cada talla: 1 Product + 1 `ProductCostComponent` por template variable + N de los flat |
| Total por Talla | **Ignorado** (recalcular) |

---

## Plan de ataque (solo lo no hecho)

### Fase A — Decisiones bloqueantes (15 min, sin código)

Antes de tocar cualquier archivo, alinear con el owner:

1. **Confirmar el diseño "talla = Product distinto"**: ¿correcto?
2. **¿Reparar el bug de fixtures async-loop ANTES del importer?** Recomendación: **sí**, para que los nuevos tests del importer corran sobre base sana. Es ~1h de investigación.
3. **¿Sobreescribir costos existentes o solo poblar vacíos?** Recomendación del prompt original sigue válida: `--commit` solo vacíos por default, `--overwrite` actualiza.
4. **¿Versionado de costos?** El modelo `ProductCostComponent` NO tiene `effective_from/to`. No inventar. Si se necesita histórico, agregar columnas en migración aparte (no scope inicial).
5. **¿Importer se corre contra `uniformes_db` o `uniformes_prod_snapshot`?** Solo `uniformes_db` (snapshot no tiene cost tables). Tras éxito en dev → trigger del prompt v3-migration-on-prod para llevar tables a prod, **luego** correr importer en prod.

### Fase B — Discovery (45-60 min, read-only)

Generar `docs/v3/formalization/costs-importer-discovery.md` con:

1. **Mapeo confirmado 10 codes → school.id** (read `uniformes_db`):
   - FHB, JIGL, MJC, JDLCP, HAG, Pinal, Pumarejo, Caracas, BuenComienzo, Comfama
2. **Mapeo prendas → garment_type.id** (con ambigüedades documentadas):
   - `Camiseta`, `Camiseta_Diario`, `Camiseta_Fisica`, `Camiseta_Algodon`, `Sudadera`, `Chompa`, `Chompa_Gris`, `Chompa_Azul`, `Delantal`, `Jomber`
3. **Match producto-específico**: por cada xlsx → ¿existe producto? ¿cuántas tallas en DB vs xlsx?
4. **Cobertura inversa**: productos en DB sin xlsx → reportar como gap.
5. **Lectura completa del sample** `/tmp/ucr-costos-sample/Colegio_Comfama_Camiseta.xlsx`:
   - Cuántas tallas
   - Cuántas filas con "Pendiente"
   - Cuántos componentes únicos
6. **Inventario de templates existentes** en `cost_component_templates`: por garment_type, qué templates ya existen → decidir si crear nuevos o reusar.

### Fase C — Reparar fixtures async-loop (si se decide en A.2)

`backend/tests/conftest.py` o `backend/tests/api/conftest.py` tiene el bug. Patrón típico: fixture de session de DB usa loop distinto al que ejecuta el test. Fix probable:
- Usar `pytest-asyncio` mode `auto` (ya configurado)
- Asegurar que `async_engine` fixture sea `scope="function"` no `"session"`, o usar `NullPool` consistentemente
- Inyectar `db: AsyncSession` correctamente al cliente FastAPI overrideando `get_db`

Tiempo: 1-2 h.

### Fase D — Importer (2-3 h)

`backend/scripts/import_costs_from_xlsx.py`:

```
python import_costs_from_xlsx.py [--zip PATH | --dir PATH] [--dry-run | --commit] [--overwrite] [--only "Comfama,Pinal"] [--report-out PATH]
```

Defaults: `--dry-run`, input zip de `documentos/Costos/`, report `docs/v3/formalization/imports/costs-import-<timestamp>.md`.

Pipeline:

1. **Extract** zip a `tempfile.TemporaryDirectory()`
2. **Parse** cada xlsx con openpyxl (data_only=False para fórmulas + recompute manual)
3. **Validate** 4 hojas + esquema
4. **Map** colegio + prenda (con confidence score; <80% → skip + warn)
5. **Compute** costos por talla manualmente (NO fiarse de cache Excel)
6. **Upsert vía service `app/services/cost_component.py`** (preferido) — no SQL crudo
7. **Snapshot previo** en log (no en DB, no hay tabla histórico)
8. **Report markdown** con: archivos procesados, productos modificados, gaps, errores

Idempotencia: re-correr → 0 cambios (verificado por test).

### Fase E — Tests (45 min)

`backend/tests/scripts/test_import_costs.py` con 5 tests:

1. Parse correcto: Comfama Camiseta talla 2 → costo total $14,370 (calculado a mano)
2. Tallas "Pendiente" → marcadas como gap, no inventadas
3. Jomber multi-colegio: 1 xlsx → 3 vinculaciones (Pumarejo + Pinal + Caracas)
4. Idempotencia: 2 corridas → 2da reporta 0 cambios
5. Dry-run no escribe nada

Fixtures: 3 xlsx representativos en `backend/tests/fixtures/costos/`.

### Fase F — Verificación manual + commit (30 min)

1. `python backend/scripts/import_costs_from_xlsx.py --dry-run` → report sano
2. `--commit` → ejecuta
3. SQL spot-check: 1 producto verificado contra xlsx fuente
4. UI Cost Breakdown Editor para ese producto → confirmar render
5. `pytest backend/tests/scripts/test_import_costs.py -v` → 5/5
6. Conventional commit sin emoji, sin Co-Authored-By

---

## Cruces con otros frentes V3

| Frente | Bloqueado por importer? | Bloquea importer? |
|---|---|---|
| **V3 storefront** (lo recién hecho, `/v3-preview/`) | No | No — costos no afectan storefront público (precios en `products.price`) |
| **Sync dev→prod (PROD-AUDIT-2026-05-16)** | No | No — slugs/colores ortogonales a costos |
| **`v3-migration-on-prod-data-prompt.md`** | No | **Sí parcialmente** — para correr importer en PROD, primero hay que aplicar migración cost_breakdown a prod (incluida en `merge_stab_001_unify_heads`). En DEV no bloquea. |
| **`encargos-audit-session-prompt.md`** | No | No — encargos audit es ortogonal |
| **`financial-model-ui-prompt.md`** | No | No — UI financiera usa snapshots, no costos detallados |
| **Tests cost_component existentes (16 fallidos)** | Importer puede correr sin esto, pero **los nuevos tests del importer pueden ser falsos positivos** si comparten fixture rota | Sí, recomendado reparar antes |

---

## Riesgos

1. **Modelo no soporta versionado de costos** — si Consuelo actualiza un xlsx mañana, el importer en `--overwrite` mode pierde el costo anterior. Mitigación: snapshot pre-update en archivo log (no DB), o agregar tabla `cost_component_history` en migración aparte (fuera de scope inicial).

2. **Productos no existentes en DB** — algunos xlsx pueden referir a productos que aún no se crearon. Opciones: (a) skip con warning, (b) crear producto-placeholder, (c) abort. Recomendación: **(a) skip**, reportar en gap list para que Consuelo confirme creación manual.

3. **Tallas como Product distinto vs Variant** — si hay refactor futuro hacia `product_variants` con `size` como atributo, este importer queda obsoleto. Acceptable para sprint Q2 (no hay variants).

4. **Jomber multi-colegio** — 3 copias del mismo xlsx en 3 carpetas (Pumarejo/Pinal/Caracas). Importer debe deduplicar por **contenido hash**, no por filename, para no triplicar templates. Lógica:
   - Identificar por `garment_type` único
   - Si ya existe un template para ese garment_type creado por el importer en esta corrida, reusar
   - Crear `ProductCostComponent` por cada producto en cada colegio

5. **Bug async-loop de tests** — si se difiere reparación, los tests del importer pueden estar afectados. Mitigación: usar fixture sync simple para el importer (no FastAPI client), evitando el bug entero.

---

## Estimación

| Fase | Tiempo |
|---|---|
| A — Decisiones | 15 min (chat con owner) |
| B — Discovery markdown | 45-60 min |
| C — Reparar fixtures async-loop (opcional pero recomendado) | 1-2 h |
| D — Importer script | 2-3 h |
| E — Tests + fixtures | 45 min |
| F — Verificación + commit | 30 min |
| **Total con fix de fixtures** | **5.5-7 h** |
| **Total sin fix de fixtures** | **4-5 h** |

---

## Próxima acción concreta

Pedir confirmación al owner sobre las **5 decisiones de Fase A**, especialmente:

1. ¿"Talla = Product distinto" es el modelo correcto? (Si no, hay que agregar columna `size` a `ProductCostComponent` — migración aparte.)
2. ¿Reparar bug async-loop en `test_cost_component_routes.py` antes del importer? (1-2h extra al sprint, pero los nuevos tests salen sobre base sana.)
3. ¿Importer es solo dev por ahora, o se quiere ejecutar también en prod inmediatamente después? (Si prod, depende del frente `v3-migration-on-prod-data` que aplica `merge_stab_001`).

Una vez confirmado, arrancar Fase B inmediatamente.

---

*Plan generado contrastando `costs-importer-prompt.md` contra estado real de `uniformes_db` y `uniformes_prod_snapshot` el 2026-05-16. Si el estado cambia (nuevas migraciones, nueva data, refactor de modelos), regenerar.*
