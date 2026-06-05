# Design Director — Rediseño del Tab de Productos → "Catálogo Studio"

> Objetivo: convertir la gestión de productos de la UI interna (Tauri) en una superficie
> **UX-intensive, catalog-céntrica**, que espeje lo que ve el cliente en la web y escale al
> negocio de **belleza** y a **B2B v3+**.
>
> Modo: Propuesta + mockup (sin tocar el repo). Capturas del rediseño en
> `after-01-catalog-studio.png` y `after-02-table-view.png`.

---

## 1. El veredicto

El tab de productos está **bien construido por dentro** (modular, `useProductsData` limpio,
stats agregados server-side, permisos granulares) pero **mal planteado por fuera para lo que
el negocio necesita ahora**: gestiona el catálogo como una **hoja de cálculo de filas-SKU por
talla, sin una sola imagen en la tabla principal** — mientras que lo que se publica en la web
es un **catálogo visual de grupos de producto con galería de fotos**. Gestionas en texto algo
que el cliente consume en imágenes. Esa desconexión es la raíz de la fricción.

Hoy un cambio simple ("publicar bien la Camiseta Amarilla de COMFAMA con sus 3 fotos, su rango
de precio y su costo") obliga a saltar entre: la fila del producto (precio/stock), el tab
"Tipos de Prenda" (fotos), un modal de costos, y un endpoint de visibilidad que ni siquiera
tiene UI para productos de colegio. **No existe una vista que muestre el grupo como lo verá el
cliente.**

---

## 2. Diagnóstico: síntomas concretos (no genéricos)

| # | Síntoma | Evidencia en el código |
|---|---------|------------------------|
| D1 | **La tabla principal no tiene imágenes.** El producto se ve como filas de texto. | `ProductsTable.tsx` — ninguna `<img>`; las fotos solo viven en `GarmentTypesTab.tsx:130`. |
| D2 | **Gestión fragmentada en 9+ modales.** `Products.tsx` orquesta ProductModal, GlobalProductModal, GarmentTypeModal, CostManager, CostBreakdown, InventoryAdjustment, InventoryHistory, Sale, Order. | `Products.tsx:44-63, 385-479` |
| D3 | **No hay concepto de "publicar en web".** Solo `is_active` (todo-o-nada). La visibilidad por colegio existe **solo para globales** y vía endpoint sin UI integrada. | backend `global/garment-types/{id}/visibility`; productos de colegio sin control. |
| D4 | **El ordenamiento engaña.** `filteredAndSortedProducts` ordena en cliente **solo la página cargada** (limit 100 + "cargar más"). Ordenar por precio/stock con >100 productos da un orden falso. | `useProductsData.ts:204-265` + `loadProducts(append)` |
| D5 | **El modelo está cableado a "colegio vs global".** No hay eje para **belleza** ni **B2B**. La categoría se infiere del *nombre* en la web (hardcode). | web-portal `utils/categorization.ts:12-22` |
| D6 | **Color es texto plano** (`product.color \|\| '-'`), sin swatch. Talla es free-text sin normalización en el origen. | `ProductsTable.tsx:227` |
| D7 | **Stats cards genéricas** (total/stock/low/out) que informan pero no accionan. No hay triage de "qué le falta a mi catálogo para verse bien en la web". | `ProductsStatsCards.tsx` |
| D8 | **`(product as any)` por todos lados** — se pierde type-safety justo en los campos críticos (school_name, garment_type_name, school_id). | `Products.tsx:97,193`, `useProductsData.ts:310-312` |

---

## 3. El producto que debería ser

- **Dominio:** gestión de catálogo + inventario + costos (familia Shopify Admin / Airtable / Linear / Notion).
- **Usuario:** la dueña (Consuelo) + admins + vendedoras. Desktop (app Tauri) en oficina/tienda. Conocen su catálogo de memoria; quieren **velocidad, control y ver lo que el cliente ve**.
- **Referentes concretos:** *Shopify Admin → Products* (grid con foto + estado + variantes + publicación), *Linear* (densidad + selección múltiple + atajos), *Notion* (multi-vista de la misma data), *Airtable* (vista cuadrícula ↔ tabla).
- **Emoción objetivo:** "Tengo el catálogo bajo control y puedo moldear exactamente lo que sale a la web."

**Tesis del rediseño — "Catálogo Studio":** la unidad de gestión deja de ser la fila-SKU y pasa a ser el **grupo de producto** (lo que el cliente percibe como "un producto"), con la **galería de fotos como ciudadano de primera clase**, **controles de publicación web inline**, y una **capa de taxonomía agnóstica (líneas de negocio)** que abre la puerta a belleza y B2B sin re-arquitecturar.

---

## 4. Sistema de diseño (anclado en el brand actual, elevado)

Se conserva la identidad existente (gold cálido + warm stone) y se le da disciplina.

```
/* Color — ya definido en tailwind.config; se mantiene */
--brand-500: #B8860B   /* CTA primario (DarkGoldenrod) */
--brand-600: #9A7209   /* hover */
--brand-400: #D4AF37   /* gold del logo, acentos/destacado */
--brand-50:  #FBF6EA   /* fondos de marca, estado activo */

/* Neutral — warm stone (existente) */
fg            #1C1917 / muted #57534E / subtle #A8A29E
surface base  #F8F7F4 / card #FFFFFF / hover #F1EFE9
border        rgba(28,25,23,.10)

/* Semánticos disciplinados */
success #059669  warning #D97706  danger #DC2626  info #2563EB

/* Tipografía */
Inter 400/500/600/700/800 · tracking -0.02em en headings · tabular-nums en TODA cifra
(precio, costo, margen, stock) — hoy falta en varias celdas.

/* Geometría */
radius: sm 6 · md 8 · lg 12 · xl 16 (la app ya usa rounded-lg; se sistematiza)
shadow: warm, multicapa, sutil (card / pop) — nada de shadow-md plano

/* Movimiento (hoy inexistente) */
hover card: translateY(-1px) + elevación · 150ms ease-out
slide-over: translateX(100%)→0 + fade · 250ms
stagger 40ms en primera carga del grid
```

**Estados obligatorios** que hoy faltan o son pobres: *sin foto*, *sin costo*, *borrador*,
*oculto en web*, *stock bajo/agotado*, *cargando (skeleton de tarjeta, no spinner)*.

---

## 5. Las transformaciones (qué cambia y por qué)

**T1 · Vista "Cuadrícula" catalog-céntrica** *(arregla D1, D7)*
Grid de tarjetas = **grupos de producto** que espejan la storefront: foto principal, nombre,
categoría, **rango de precio**, nº de tallas, stock total, y badges accionables — *Publicado /
Oculto / Borrador*, *nº de fotos*, *margen color-coded*, *stock bajo*, *★ Destacado*. Es la
misma carta que ve el cliente, pero con los controles de gestión encima.

**T2 · Barra de triage "Necesitan atención"** *(reemplaza stats cards, D7)*
Chips-filtro: *Sin foto 12 · Sin costo 8 · Margen <15% 4 · Sin publicar 3 · Stock bajo 5*.
Convierte "tengo 128 productos" en "tengo 12 cosas que arreglar para que la web se vea bien".

**T3 · Editor en slide-over (no más modal-hell)** *(arregla D2)*
Un panel lateral consolida todo lo del grupo en un scroll: **Galería** (subir/reordenar/marcar
principal, drag&drop), **Identidad** (nombre/categoría/color con swatch), **Matriz de variantes**
(tallas × Precio/Costo/Margen/Stock editable inline, con "aplicar a todas"), y **Publicación web**
(visible / destacado / orden). Cero saltos de contexto.

**T4 · Controles de publicación web de primera clase** *(arregla D3)*
Toggle *Visible en web* y *Destacado* por grupo + *orden de aparición* + visibilidad por colegio,
todo desde el editor. Estado *Borrador* para productos a medio cargar (sin foto/costo) que **no**
salen a la web hasta completarse.

**T5 · Rail de "Líneas de negocio"** *(arregla D5 — escalabilidad belleza/B2B)*
Eje ortogonal al multi-tenant: **Uniformes / Belleza / B2B**. Dentro de Uniformes, los colegios.
Es el lugar natural donde entra la 2ª línea (perfumería/belleza) y los catálogos/cotizaciones B2B
sin romper el modelo escolar. (Requiere backend — ver §7.)

**T6 · Vista "Tabla" densa para power-users + bulk** *(no perder densidad, arregla D4, D8)*
La tabla sigue, pero elevada: **thumbnails inline**, columna *Web*, cobertura de costo visual
(`●●●○○ 4/6`), margen color-coded, **selección múltiple** con barra de acciones bulk (*Publicar ·
Aplicar costo · Cambiar categoría · Exportar*), y **orden server-side sobre el catálogo completo**
(corrige D4). Tipos fuertes en vez de `as any` (corrige D8).

**+ Vista "Cliente"**: botón que muestra la storefront tal cual la ve el padre — el loop de
confianza "edito aquí → veo el efecto allá".

---

## 6. Mockups (evidencia visual)

- `after-01-catalog-studio.png` — vista Cuadrícula + rail de líneas + triage + slide-over editor con matriz de variantes y publicación.
- `after-02-table-view.png` — vista Tabla densa con thumbnails, estado web, cobertura de costo y barra de acciones bulk.

- `before-01-products-actual.png` / `before-02-products-full.png` — estado actual REAL de `/products`
  (capturado en vivo, usuario `samuel` superuser, 467 productos de colegio · 154 compartidos · 87 tipos).
  Confirma visualmente D1 (tabla de filas-SKU sin imágenes), D2 y D7.

---

## 7. Roadmap (impacto vs esfuerzo)

### Frontend — accionable con el backend actual

| Sprint | Cambio | Impacto | Esfuerzo |
|--------|--------|---------|----------|
| **S1** | Design tokens + tabular-nums en todas las cifras + sistema de sombras/movimiento | 4/5 | 0.5 d |
| **S1** | **Fix D4**: ordenar server-side (pasar `sort`/`order` a `getAllProducts`, quitar sort de cliente sobre página) | 4/5 | 1 d |
| **S1** | Tipos fuertes: eliminar `as any` en Products/useProductsData (extender `Product`/`ProductListResponse`) | 3/5 | 0.5 d |
| **S2** | **T1** Vista Cuadrícula catalog-céntrica (agrupar por garment_type, usar `with_images`) | 5/5 | 3 d |
| **S2** | **T2** Barra de triage (deriva de `/stats` + flags sin-foto/sin-costo) | 4/5 | 1 d |
| **S3** | **T3** Slide-over editor + galería first-class (reusar endpoints de imágenes existentes) | 5/5 | 4 d |
| **S3** | **T6** Tabla densa + thumbnails + selección múltiple + bulk (reusar `bulk-update-costs`) | 4/5 | 3 d |
| **S4** | Vista "Cliente" (iframe/preview de la storefront por colegio) | 3/5 | 1.5 d |

### Backend — fase aparte (habilita T4/T5 plenos) — ver Apéndice

| Cambio | Habilita | Esfuerzo |
|--------|----------|----------|
| `web_visible` + `featured` + `display_order` en Product (+ migración + endpoints) | T4 publicación real por producto de colegio | 1.5 d |
| Estado `draft/published` (o derivar de completitud) | T4 borradores | 0.5 d |
| `business_line` (Uniformes/Belleza/B2B) ortogonal al tenant | T5 escala belleza/B2B | 4–5 d (ver `business_line_model_design`) |
| Endpoint import/export XLSX de productos | carga masiva belleza | 2 d |
| Sort server-side en `/products` (param `sort`,`order`) | Fix D4 | 0.5 d |
| Imágenes a nivel producto (hoy solo a nivel garment-type) — opcional | variantes con foto propia | 1.5 d |

---

## 8. Si tuvieras 1 semana vs 1 mes

- **1 semana (S1+S2):** la página deja de sentirse hoja-de-cálculo. Cuadrícula visual con fotos,
  triage accionable, orden correcto, sin `any`. El salto perceptual más grande por el menor costo.
- **1 mes (S1–S4 + backend §7):** Catálogo Studio completo — publicación web real por producto,
  borradores, líneas de negocio listas para belleza/B2B, edición sin modales, vista cliente.
  La gestión del catálogo pasa de "tarea de digitador" a "estudio de catálogo".

---

## Apéndice A — Detalle de extensiones backend

(Marcado como fase separada; no bloquea el frontend de S1–S2.)

1. **Product.web_visible / featured / display_order**
   - Migración Alembic aditiva (nullable/default) — sin pérdida de datos.
   - `PUT /products/{id}` y `/global/products/{id}` aceptan los campos.
   - Web-portal `serverApi` filtra `web_visible=true` y ordena por `(featured desc, display_order)`.
2. **Estado de publicación**: o columna `status enum(draft,published,archived)`, o derivado
   (un grupo es "publicable" cuando tiene ≥1 foto y costo en todas sus variantes). Recomendado: derivado + override manual.
3. **business_line**: ya hay diseño en memoria (`business_line_model_design.md`, ~4.5–5 d). Eje
   ortogonal: `business_line_id` en Product/GarmentType; el rail de §T5 lo consume.
4. **Sort server-side** en `GET /products`: `sort in (code,name,price,stock,margin)`, `order in (asc,desc)` — corrige D4 de raíz.
5. **Import/export XLSX**: reusar patrón de `import_costs_xlsx_script` (ya idempotente + testeado).
