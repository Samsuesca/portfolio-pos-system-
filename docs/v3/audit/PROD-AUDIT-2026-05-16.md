# Auditoría Producción yourdomain.com — 2026-05-16

> **Contexto:** Replica local de DB importada hoy contra prod en vivo. Múltiples discrepancias detectadas que afectan SEO, identidad de marca y catálogo. **Algunas son bloqueantes del cutover V3.**
>
> **Método:** Chrome DevTools MCP navegando prod + curl directo a `api.yourdomain.com` + queries a dev DB local.
>
> **Screenshots:** `docs/v3/audit/0X-*.jpeg` (5 capturas full-page).

---

## TL;DR

Hay **3 hallazgos bloqueantes** que requieren sync **dev DB → prod DB** antes del cutover V3, más **8 hallazgos cosméticos/de copy** que el rediseño V3 ya resuelve.

| # | Hallazgo | Severidad | Resuelto por V3? |
|---|---|---|---|
| 1 | Slugs sucios en `schools.slug` (5 de 11 corruptos) | **BLOQUEANTE** | Solo si se sincroniza dev→prod antes del cutover |
| 2 | `schools.primary_color` = NULL en prod (CARACAS tiene `#1E3A8A` en dev) | **BLOQUEANTE** | V3 SchoolPicker tiene fallback gris, pero pierde la identidad por colegio |
| 3 | Productos de IE Caracas no aparecen en catálogo prod (DB local dice 60 activos) | **BLOQUEANTE** | Bug pre-existente — V3 no lo resuelve, solo lo expone |
| 4 | Acentos omitidos en copy actual ("Selecciona tu Colegio" sin tilde, "Necesitas ayuda?" sin `¿`) | Cosmético | ✓ V3 ya escribe con acentos |
| 5 | Tagline interno fugando: "Sistema de Gestión" como tagline de portal | Cosmético | ✓ V3 omite hasta tener `tagline_public` real |
| 6 | Inconsistencia de capitalización en nombres de garment_types (`camiseta` vs `Camiseta`) | Calidad | Deferido a V3.1 (requiere normalización backend) |
| 7 | Categorías sucias (`accessories` vs `accesorios`) | Calidad | ✓ Migración `v3_design_cleanup_001` (aplicada a dev, falta prod) |
| 8 | Productos duplicados visibles en Comfama (`camiseta de algodón amarillo` Y `Camiseta Amarillo`) | Data dirty | Requiere consolidación por Consuelo, no scope V3 |
| 9 | `display_order` no respetado en home (orden aparece random vs DB) | UX | ✓ V3 SchoolPicker ordena por display_order |
| 10 | `instituci-n-educativa-*` (slugs con tilde rota) ya indexado por Google → SEO redirect needed | SEO | Requiere redirects post-cutover |
| 11 | Versión "v2.9.0 | Portal v1.5.0" visible en footer | Info | ✓ V3 footer no muestra versión |

---

## 1. Hallazgos bloqueantes (requieren migración prod antes de cutover V3)

### 1.1 Slugs corruptos en producción

Llamada directa a `https://api.yourdomain.com/api/v1/schools` confirma que prod tiene **5 de 11 slugs corruptos**:

| Código | Slug en prod ❌ | Slug en dev ✓ | Tipo de corrupción |
|---|---|---|---|
| `CARACAS-001` | `instituci-n-educativa-caracas` | `institucion-educativa-caracas` | Tilde `ó` mal escapada → `-` |
| `PUMAREJO-001` | `instituci-n-educativa-alfonso-l-pez-pumarejo` | `institucion-educativa-alfonso-lopez-pumarejo` | 2 tildes mal escapadas |
| `PINAL-001` | `instituci-n-educativa-el-pinal` | `institucion-educativa-el-pinal` | Tilde mal escapada |
| `CONFAMA-001` | `confama` | `comfama` | Typo: `f` en vez de `m` |
| `BUEN-002` | `buen-comiezo` | `buen-comienzo` | Typo: falta `n` |
| `HECTOR-001` | `institucion-educativa-hector-abad-gomes` | `institucion-educativa-hector-abad-gomez` | Typo: `s` en vez de `z` |

**Impacto:**
- URLs visibles a usuarios y motores de búsqueda son feas y mal escritas (`/confama`, `/buen-comiezo`)
- Probablemente ya indexadas en Google → cambiar implica configurar redirects 301
- Frontend V3 hace `router.push(/[slug])` confiando en `school.slug` → si se sincroniza prod a los slugs limpios, los slugs viejos quedan 404 y rompen links externos

**Fix requerido:** UPDATE en prod replicando los slugs limpios de dev + nginx/Next redirects de los slugs viejos a los nuevos para preservar SEO.

### 1.2 `primary_color` NULL en producción

Dev DB local tiene `CARACAS-001.primary_color = '#1E3A8A'`. Prod tiene NULL para los 11 colegios.

**Impacto:**
- V3 SchoolPicker está diseñado para mostrar color bar por colegio (32×4px) — clave de la identidad editorial del rediseño
- Sin colores en prod, todos los colegios se ven idénticos (fallback gris)
- Pérdida del 80% del valor visual del SchoolPicker

**Fix requerido:**
- O sincronizar `CARACAS-001` desde dev (el único con color)
- O conseguir los 10 colores faltantes con Consuelo y poblar antes del cutover
- O aceptar fallback gris para V3.0 launch y poblar en V3.1

### 1.3 Catálogo IE Caracas vacío de productos específicos en prod

Dev DB dice `CARACAS-001` tiene **60 productos activos** (Camiseta, Chompa Azul, Chompa Gris, Sudadera, Yomber, Bicicletero, Moño Gala, Moño Gris, Interiores, etc.).

Prod renderiza el catálogo de `instituci-n-educativa-caracas` mostrando **solo 11 productos globales** (Blusa, Camisilla, Camisa Básica, Correa, Delantal de cuadros, Jean, Medias, Tennis Nike, Zapatos Goma) — ninguno específico del colegio.

**Comparación cruzada — Comfama prod muestra 23+ productos específicos** (4 colores de Camiseta + 4 de Chompa + 4 de Sudadera + 4 de Moño + 3 de Delantal, más duplicados `camiseta` vs `Camiseta`). Así que el endpoint sí funciona en general.

**Hipótesis del bug:**
- Probable: productos de Caracas en prod DB no se replicaron desde dev (alguien creó productos en dev sin push a prod)
- Posible: filtro de stock/visible oculta los productos
- Poco probable: slug roto causa lookup fallido (Caracas resuelve a school object OK, sino no cargaría el banner)

**Conteos por colegio en dev DB (referencia):**

```
 ALEGRIA-001    | 12 productos (12 active)
 BUEN-002       | 11 productos (11 active)
 CAICEDO-001    | 33 productos (33 active)
 CARACAS-001    | 60 productos (60 active) ← cero visibles en prod
 CONFAMA-001    | 123 productos (113 active)
 CRUZPOSADA-001 | 35 productos (33 active)
 FELIX-001      | 45 productos (44 active)
 GOTA-001       | 12 productos (12 active)
 HECTOR-001     | 34 productos (33 active)
 PINAL-001      | 68 productos (58 active)
 PUMAREJO-001   | 71 productos (61 active)
```

**Fix requerido:** Auditar prod DB. Si prod realmente no tiene esos productos, hay que migrarlos. Si los tiene pero con flag oculto, identificar el flag.

---

## 2. Hallazgos cosméticos resueltos por V3 (sin acción extra)

### 2.1 Acentos omitidos en copy actual

Home prod:
- `Selecciona tu colegio` (debería tener tilde en `colegio`? no, está bien — pero la página dice "Busca tu institucion" sin tilde)
- `Catalogo de Uniformes` (debería ser `Catálogo`)
- `Pago en Linea` (debería ser `Línea`)
- `Debito bancario` (debería ser `Débito`)
- `Necesitas ayuda?` (falta `¿`)
- `Envio a domicilio o recogelo` (debería ser `Envío` y `recógelo`)
- `Especificaciones unicas` (debería ser `únicas`)

V3 ya escribe todo con acentos correctos. **Sin acción.**

### 2.2 Tagline interno fugando

Footer prod muestra subtítulo `"Sistema de Gestión"` que viene de `business_settings.tagline`. Ese campo es del software ERP interno, no del portal de clientes. README del bundle ya lo señalaba.

V3 FooterV3 omite el tagline cuando no hay `tagline_public` poblado. **Sin acción** (queda pendiente externo: definir tagline público con Consuelo).

### 2.3 Versión visible en footer

Prod muestra `v2.9.0 | Portal v1.5.0` al final del footer. Información interna que no aporta al cliente.

V3 FooterV3 no muestra versión. **Sin acción.**

### 2.4 Orden de schools inconsistente

Home prod muestra schools en orden distinto al `display_order` de DB. Probable que esté ordenando por otro campo o aleatorio.

V3 SchoolPickerV3 explícitamente filtra activos y mantiene el orden de `fetchSchools()` (que ya viene ordenado por `display_order` desde el backend). **Sin acción.**

---

## 3. Hallazgos que requieren trabajo aparte (no scope V3 inicial)

### 3.1 Capitalización inconsistente en garment_types

Prod muestra ambos `camiseta de algodón amarillo` (minúscula) Y `Camiseta Amarillo` (Title Case) en el catálogo Comfama — son entradas distintas en DB con casing distinto. Aspecto de seed data sucia más profundo.

**Acción:** Auditar `garment_types` con casing inconsistente y consolidar con Consuelo. **No bloqueante** para V3 launch.

### 3.2 Productos duplicados de Comfama

Comfama muestra `camiseta de algodón {amarillo/azul/fucsia/morado}` Y `Camiseta {Amarillo/Azul/Fucsia/Morado}` — 8 entradas que parecen ser 4 productos con typo doble.

**Acción:** Identificar duplicados con Consuelo. Migración data cleanup. **No bloqueante** para V3.

### 3.3 SEO redirects post-slug-cleanup

Cuando se limpien los slugs en prod, las URLs viejas `/confama`, `/buen-comiezo`, `/instituci-n-educativa-*` deben redirigir 301 a las nuevas. Sino se rompen:
- Bookmarks de usuarios
- Links indexados en Google (pérdida de ranking)
- Links externos compartidos por WhatsApp

**Acción:** Configurar redirects en `next.config.ts` o nginx. Puede ser pre-cutover.

---

## 4. Plan de fixes para V3 launch

### 4.1 Pre-cutover — sync dev → prod (BLOQUEANTE)

Antes de promover `/v3-preview/` a rutas reales, hacer en prod:

1. **Backup completo de prod DB** antes de cualquier UPDATE.
2. **Auditar diff dev⇄prod** para:
   - `schools.slug` (5 corregir)
   - `schools.primary_color` (1 al menos: CARACAS-001 → `#1E3A8A`)
   - `products` específicos de cada colegio (especialmente CARACAS-001: 60 productos missing)
   - Migración `v3_design_cleanup_001` (aplicar el cleanup de address + categorías a prod)
3. **Decidir si sync TOTAL o selectivo**:
   - Si dev es estrictamente "réplica de prod + cambios buenos", merge selectivo de los cambios buenos a prod
   - Si dev tiene cambios accidentales (productos nuevos no validados), filtrar antes de sync

**Sugerencia operativa:** generar un script SQL idempotente con los UPDATEs específicos (slugs, primary_color de Caracas, migración alembic) en lugar de un dump-restore que arrastraría todo.

### 4.2 Pre-cutover — redirects 301

Agregar a `web-portal/next.config.ts`:

```ts
async redirects() {
  return [
    { source: '/confama', destination: '/comfama', permanent: true },
    { source: '/buen-comiezo', destination: '/buen-comienzo', permanent: true },
    { source: '/instituci-n-educativa-caracas', destination: '/institucion-educativa-caracas', permanent: true },
    { source: '/instituci-n-educativa-alfonso-l-pez-pumarejo', destination: '/institucion-educativa-alfonso-lopez-pumarejo', permanent: true },
    { source: '/instituci-n-educativa-el-pinal', destination: '/institucion-educativa-el-pinal', permanent: true },
    { source: '/institucion-educativa-hector-abad-gomes', destination: '/institucion-educativa-hector-abad-gomez', permanent: true },
  ];
}
```

Esto debe deployearse **junto** con el sync de slugs (no antes, sino los slugs viejos siguen siendo válidos y next refuse to redirect a slug que no existe en DB).

### 4.3 Pre-cutover — confirmar productos de CARACAS-001

- Query prod DB directamente: `SELECT COUNT(*) FROM products WHERE school_id = (SELECT id FROM schools WHERE code='CARACAS-001');`
- Si es 0, hay que migrar productos desde dev (con cuidado de IDs/conflictos)
- Si es 60 pero todos `is_active=false`, marcar activos
- Si es 60 activos pero el endpoint no los devuelve, debuggear el endpoint

### 4.4 Post-cutover — V3.1+ data cleanup

- Auditar duplicados de garment_types (sesión con Consuelo)
- Normalizar capitalización (`Camiseta` Title Case consistente)
- Recopilar `primary_color` para los 10 colegios sin asignar
- Poblar pendientes externos: NIT, año fundación, política garantía, tagline público

---

## 5. Acciones concretas siguientes (orden)

| # | Acción | Owner | Cuándo |
|---|---|---|---|
| 1 | Snapshot/backup prod DB | DevOps / dueño | HOY antes de cualquier cambio |
| 2 | Diff dev vs prod en `schools`, `products`, `business_settings` | Backend | HOY |
| 3 | Generar SQL script de sync selectivo (slugs + colores + categorías) | Backend | Tras revisar diff |
| 4 | Aplicar `v3_design_cleanup_001` a prod | DBA | Después de sync |
| 5 | Verificar CARACAS-001 productos visibles en prod tras sync | Manual smoke | Tras sync |
| 6 | Agregar redirects 301 a `next.config.ts` y deploy | Frontend | Junto con sync |
| 7 | Validar visualmente `/v3-preview/` con Consuelo | Producto | Independiente |
| 8 | Cutover V3.0 | — | Cuando 1-7 pasan |

---

## 6. Inventario de screenshots

| Archivo | Descripción |
|---|---|
| `01-home-fullpage.jpeg` | Home actual: hero claro, grid de 11 colegios, footer con dirección real |
| `02-catalog-caracas.jpeg` | IE Caracas — **solo productos globales visibles** (bug) |
| `03-catalog-comfama.jpeg` | Comfama — 23+ productos específicos + globales (control positivo) |
| `04-registro.jpeg` | Form de registro step 1, acentos correctos |
| `05-soporte.jpeg` | Centro de soporte con PQRS form, acentos correctos |

---

*Generado por audit con Chrome DevTools MCP el 2026-05-16. Cross-referenciado contra dev DB local (`uniformes-postgres` en docker, `uniformes_db`).*
