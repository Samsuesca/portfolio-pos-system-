# Storefront V3 — Handoff de diseño Claude Design → Next.js

> **Fecha:** 2026-05-04
> **Última revisión:** 2026-05-04 (decisiones tomadas por el dueño)
> **Origen:** `claudesing/Uniformes Consuelo Rios _ Design System.zip` (extraído en `claudesing/extracted/`)
> **Destino:** `web-portal/` (Next.js 16 + React 19 + Tailwind v4)
> **Fuente única de datos del negocio:** [`business-facts.md`](./business-facts.md) — extraído de DB de desarrollo (dump fresco de prod) + verbalizado con dueño.
> **Estado:** Diagnóstico + plan, sin código integrado todavía.

---

## TL;DR

El bundle entregado por Claude Design **no es un mockup**, es un design system formal con README de 200 líneas, tokens (`colors_and_type.css`), assets reales, y dos UI kits (storefront público + admin/POS). Hay material aprovechable de calidad — pero también inconsistencias internas y datos inventados que se resolvieron contra la DB real (ver [`business-facts.md`](./business-facts.md)).

### Decisiones tomadas (2026-05-04)

1. **Tipografía display: opción C — híbrida.** Fraunces en headlines de hero/sections (h1/h2 grandes, italic-en-gold editorial). Outfit en el resto (h3+, body, UI). Mantiene paridad con Tauri ERP en toda la UI funcional, gana el carácter editorial donde más impacta.
2. **Dirección: aprovechamiento parcial.** Se conservan **estructuras e ideas** del v3 (layouts, ProcessBand, SchoolPicker grid, sticky filter bar, PDP con specs table). Se descartan **invenciones** (catálogo ficticio de colegios élite, copy fabricado, emojis, stats inventadas, dirección falsa, política de envío inexistente).
3. **Datos reales:** consolidados en [`business-facts.md`](./business-facts.md). 10 colegios reales (mayormente IE públicas + Comfama + jardines), todos en Medellín, sin envío gratis, con tarifas $10K–$13K por zona. Pendientes externos: NIT, año fundación, política garantía, especificaciones de producto, colores de marca de 9 colegios sin asignar.

Con esto, ya no hay decisiones bloqueantes — pasamos a Fase 0 (cerrar pendientes externos) y Fase 1 (tokens + assets).

---

## 1. Inventario: lo aprovechable del bundle

### 1.1 Tokens y assets directamente reutilizables

| Pieza | Path en bundle | Acción |
|---|---|---|
| Logos PNG (mark, lockup, lockup-dark, favicon) | `extracted/assets/*.png` | Copiar a `web-portal/public/` y reemplazar el `logo.png` actual |
| Wompi logo | `extracted/assets/wompi-logo.png` | Copiar a `web-portal/public/` para footer/checkout |
| Tokens motion (`--ucr-ease-out`, durations) | `extracted/colors_and_type.css` líneas 93-102 | Ya existen en `web-portal/app/globals.css` (líneas 113-120). Verificar paridad. |
| Tokens shadow warm-toned | `colors_and_type.css` líneas 85-91 | Ya existen en `globals.css`. Paridad confirmada. |
| Tokens border (`--ucr-border-*`) | `colors_and_type.css` líneas 80-83 | Ya existen en `globals.css`. Paridad confirmada. |

**Brand color scale — drift menor:**

| Token | Bundle CSS | Producción `globals.css` |
|---|---|---|
| `brand-100` | `#F7EED5` | `#F5ECD4` |
| `brand-600` | `#946C09` | `#9A7209` |
| `brand-700` | `#745408` | `#7C5B07` |

Diferencias dentro del rango perceptual aceptable. **Producción gana** (es la que ya viste publicado y aprobaste). No tocar.

### 1.2 Componentes V3 con valor de diseño aprovechable

Estos son los componentes del v3 que vale la pena adaptar a tu stack Next.js. Cada uno con su localización y *qué exactamente* aprovechar.

| # | Componente | Origen | Razón para adoptarlo |
|---|---|---|---|
| 1 | **Hero dark editorial** | `ui_kits/storefront/StorefrontV3.jsx::Hero` (líneas 100-214) | Background `#0F0E0C` con grid SVG sutil + radial gold + manifesto stripe (3 columnas: Calidad/Servicio/Innovación) + marquee de colegios al pie. Mejor que el hero claro v2. |
| 2 | **SchoolPicker grid** | `StorefrontV3.jsx::SchoolPicker` (216-264) | Grid 3-col con `code`/`code2`, color bar de 32px×4px de identidad por colegio, hover `brand-50`. Reemplaza al search+grid básico actual. |
| 3 | **ProcessBand 4 pasos** | `StorefrontV3.jsx::ProcessBand` (266-302) | Sección "Cómo funciona" con border-top `stone-900`, eyebrow `01–04`, italics en pasos. No existe en producción. |
| 4 | **PDP con specs table** | `StorefrontV3.jsx::PDP` (442-571) | Página de producto con galería 4×, buy box sticky, talla/qty, dual CTA (Wompi + WhatsApp), tabla de especificaciones tipográfica (Tela/Gramaje/Costuras/Bordado/Cuidado/Origen). Reemplaza `ProductDetailModal.tsx`. |
| 5 | **Cart page con resumen sticky** | `StorefrontV3.jsx::CartPage` (574-680) | Tabla de items + resumen sticky + dual CTA (Wompi + WhatsApp). Mejor que el `FloatingCartSummary` actual. |
| 6 | **Catalog filter bar sticky** | `StorefrontV3.jsx::CatalogPage` (336-406) | Banner de colegio (color del colegio) + sticky filter bar con tabs Diario/EF/Gala + filtros talla/sort. Mejora `CatalogClient.tsx`. |

### 1.3 Componentes shared del bundle

`extracted/ui_kits/shared/`:
- `Logo.jsx` — exporta `CRLockup`, `CRStamp`, `CRMonogram` (referenciados en v3). **Leer antes de integrar** para entender qué representa cada variante.
- `Icons.jsx` — set de iconos Lucide-style stroke 1.5–1.75px. **No copiar**: tu portal real ya importa de `lucide-react` (mejor). Usar como referencia de qué iconos usa el diseño.
- `ProductPhoto.jsx` — placeholder gráfico para fotos de producto. Útil mientras consigues fotografía real, después se reemplaza con `<Image>` de Next.js.

---

## 2. Invenciones del bundle vs realidad

> **Resuelto contra DB:** la mayoría de invenciones de §2.1 se cerraron consultando `uniformes_db` el 2026-05-04. Detalle completo en [`business-facts.md`](./business-facts.md). Esta sección queda como **diff** entre lo que el bundle asumió y lo que es realmente, para que no se vuelva a colar en futuras sesiones de Claude Design.

### 2.1 Datos de negocio — diff bundle vs realidad

| Campo | Bundle (v2/v3) | Realidad (`business-facts.md`) |
|---|---|---|
| Lista de colegios | v2: 6 colegios élite privados inventados (San José Vegas, Marymount, Calasanz, Colombo Británico, Columbus, San Ignacio). v3: placeholders `[Colegio aliado 0X]` | **10 colegios reales** mayormente IE públicas + Comfama + jardines. Ver `business-facts.md` §2 |
| Cantidad de colegios | v2: `28 colegios` (inventado). v3: `[N] colegios` | **10 activos** (1 inactivo, 1 temporal — no mostrar) |
| Cobertura geográfica | v3: "[Años] vistiendo a Medellín"; v2: solo Medellín | **Solo Medellín** confirmado. La data sucia en `schools.address` (Bogotá/Cali) es seed placeholder, no realidad |
| Año de fundación | v2: `1985`, "Cuatro décadas", "+40 años cosiendo" | **PENDIENTE** — no está en DB |
| Tiempo de entrega | v2: `24h Medellín`, `48 horas hábiles` | **1–2 días hábiles** según zona (real, en `delivery_zones`) |
| Política de envío | v2 + v3: `Envío gratis sobre $200.000` | **No existe envío gratis.** Tarifas reales $10K–$13K por zona. Ver `business-facts.md` §3 |
| Política de garantía | v2: `Cambio en 30 días` | **PENDIENTE** — no está en DB |
| Stat de satisfacción | v2: `98%` | **Eliminar.** Sin data real, no se publica |
| NIT | v2: `8001234567-1` | **PENDIENTE** — falta key en `business_settings` |
| Dirección física | v2: `Cra. 50 #45-23` | Existe en `business_settings` (`address_line1`/`line2`/`city`). El valor real, distinto del v2, leer de DB. |
| Teléfono | No mostrado en v2 | Existe en `business_settings` (`phone_main`, `phone_support`). Leer de DB. |
| Horarios | v2: `Lun–Sáb 8am–6pm` (incompleto) | Existe en `business_settings` (`hours_weekday`/`saturday`/`sunday`). Real: incluye sábado distinto y domingo cerrado. Leer de DB. |
| Email | No mostrado en v2 | Existe en `business_settings` (`email_contact`, `email_noreply`). Leer de DB. |
| WhatsApp link | No mostrado en v2 | Existe en `business_settings` (`whatsapp_number`). Leer de DB. |

### 2.2 Catálogo de productos — diff bundle vs realidad

| Aspecto | Bundle (v3) | Realidad |
|---|---|---|
| Productos | 8 inventados: Camibuso, Pantalón gris, Jardinera escocesa, Sudadera completa, etc. | 80+ reales en `garment_types` con casing inconsistente: CAMISETA, CHOMPA, SUDADERA, Yomber, Bicicletero, Delantal, Moño, Tennis Nike Blanco/Negro, Boxer, Correa, etc. |
| Categorías | `Diario / Educación física / Gala` | `uniforme_diario`, `uniforme_deportivo`, `tops`, `bottoms`, `accesorios` (sic, duplicado con `accessories`), `Superior` (sic), `Conjunto`, `footwear`. **Taxonomía sucia, hay que normalizar.** |
| Conteo por colegio | `24 prendas en catálogo` (hardcoded en v3) | **Asimétrico:** algunos 3 prendas, Comfama 17. Mostrar real. |
| Productos globales | No contemplado | Existen (Tennis Nike, Jean, Boxer, Medias, etc.) — `school_id` NULL. Ver `business-facts.md` §4 |

### 2.3 Especificaciones de producto (PDP)

`StorefrontV3.jsx::PDP` líneas 552-557 inventa especs técnicas (poliéster/algodón antifluido, gramaje 180g, costura doble, hilo Madeira). **Plausibles pero no verificadas.** No están en DB — el modelo `Product`/`GarmentType` no tiene campos de especificación. Decisiones:
- **Opción 1:** No mostrar specs en V3 release. PDP queda con descripción + tallas + foto + agregar al carrito.
- **Opción 2:** Agregar campos `specs` (JSONB) a `GarmentType` o `Product`, llenarlos manualmente con Consuelo, y exponerlos en PDP.

Recomendación: **Opción 1** para V3 release inicial, **Opción 2** como follow-up post-launch.

### 2.4 Tone-of-voice violations en el bundle

| Problema | Dónde | Decisión |
|---|---|---|
| Emojis 👕👗🩳 en hero v2 | `Home.jsx::HomeHero` líneas 56-58 | **Eliminar.** README del bundle dice "essentially zero emoji" — el v2 viola su propia regla. |
| Acento opcional | El bundle alterna `Sesión` y `Sesion` | Usar **siempre acentuado** |
| `usted` vs `tú` | El bundle usa `tú` correctamente | Mantener |
| Tone "élite/premium" | v2: "los mejores colegios", "exclusivo"; v3: "el uniforme que los niños no quieren quitarse" en italic-gold sobre dark | **Atemperar.** Target real es mercado popular público. Ver §3.2 abajo |

---

## 3. Decisiones tomadas

### 3.1 Tipografía: opción C — híbrida Fraunces + Outfit

**Decidido 2026-05-04.**

| Superficie | Tipografía | Razón |
|---|---|---|
| `<h1>` y `<h2>` de hero/sections grandes (con `font-display` o clase específica) | **Fraunces** | Carga editorial del italic-en-gold del v3. Es lo que le da identidad al hero. |
| `<h3>` y abajo, body, UI controls, labels, badges | **Outfit** | Mantiene paridad con `frontend/` (Tauri ERP) y el resto del sistema productivo |
| Mono (códigos, tabular, labels uppercase) | **JetBrains Mono** | Sin cambios |

**Implementación esperada (Tailwind v4 + Next.js):**

```ts
// web-portal/app/layout.tsx
import { Inter, Outfit, JetBrains_Mono, Fraunces } from 'next/font/google';

const inter      = Inter({ subsets: ['latin'], variable: '--font-inter' });
const outfit     = Outfit({ subsets: ['latin'], variable: '--font-outfit' });
const jetbrains  = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains-mono' });
const fraunces   = Fraunces({ subsets: ['latin'], variable: '--font-fraunces', axes: ['opsz'] });
```

```css
/* web-portal/app/globals.css */
@theme inline {
  --font-sans: var(--font-inter);
  --font-display: var(--font-outfit);   /* default display, mantener */
  --font-editorial: var(--font-fraunces); /* nueva — solo hero/section h1/h2 */
  --font-mono: var(--font-jetbrains-mono);
}
```

```tsx
/* Uso */
<h1 className="font-editorial italic">El uniforme <em className="text-brand-600">perfecto</em>.</h1>
<h3 className="font-display">Detalles de prenda</h3>  {/* sigue siendo Outfit */}
```

Riesgo a vigilar: peso de bundle. Fraunces con axis `opsz` agrega ~80KB woff2. Aceptable si solo aparece en home (`/`) y headings de PDP. Si se cuela en cada página vía `<h1>` global, se vuelve costo. **Restricción de uso:** `font-editorial` solo en `HeroV3`, `SchoolPickerV3` h2, `ProcessBandV3` h2, `PDP` h1.

### 3.2 Dirección: aprovechamiento parcial (estructura sí, invención no)

**Decidido 2026-05-04: conservar lo no-inventado, aprovechar las ideas estructurales.**

Ya no es "v2 vs v3". Es **componer del v3** lo que aplica a la realidad UCR (mercado popular público, 10 colegios IE en Medellín):

| Idea del v3 | ¿Se conserva? | Adaptación |
|---|---|---|
| **Layout editorial** del Hero (grid 1.1fr/1fr, eyebrow + h1 con italic-gold + párrafo + 2 CTA + manifesto stripe) | **Sí** | Copy real: "Uniformes escolares en Medellín — Calidad que se nota, precios que convienen". Sin "el uniforme que los niños no quieren quitarse" ni "[Años de tradición]". |
| **Hero dark `#0F0E0C` + radial gold + grid SVG** | **Atemperar** | El dark hero funciona, pero **bajar la intensidad editorial-luxury**. Considerar versión clara con `stone-900` solo en el text/CTA y fondo `surface-100` con radial gold sutil — más cercano al target popular sin perder calidad visual. **Decidir con POC visual.** |
| **Manifesto stripe** (Calidad / Servicio / Innovación) | **Sí, con copy real** | Reemplazar las 3 promesas inventadas por 3 reales acordadas con Consuelo. Default: Calidad ("Tela y costuras aprobadas por cada colegio"), Servicio ("Asesora WhatsApp lun-sáb"), Cumplimiento ("Entrega en Medellín 1-2 días"). |
| **Marquee de colegios al pie del hero** | **Sí** | Con los 10 colegios reales y sus colores cuando estén disponibles. Mientras tanto, solo nombres con un dot neutral. |
| **SchoolPicker grid 3-col** con code/code2 + color bar | **Sí** | Con `school.code` real (`CARACAS-001` → mostrar como `01 / CARACAS`). Color bar usa `school.primary_color`; si NULL, fallback a un gris neutral hasta que se asigne color. |
| **ProcessBand 4 pasos** con border-top stone-900 | **Sí** | Pasos reales: 01 Eligen, 02 Confeccionamos (sin tiempo inventado), 03 Confirmamos (asesora WhatsApp), 04 Entregamos (1-2 días Medellín o recoger en Boston). |
| **CatalogPage**: banner color del colegio + sticky filter bar + tabs por categoría | **Sí** | Tabs con categorías reales normalizadas. Conteo de prendas real (no `24` hardcoded). |
| **PDP**: galería 4× + buy box sticky + dual CTA Wompi/WhatsApp + specs table | **Parcial** | Galería + buy box + dual CTA: sí. Specs table: **no en V3 inicial** — esperar a modelar specs en DB (ver §2.3). |
| **CartPage**: tabla items + resumen sticky | **Sí** | Sin "Envío gratis sobre $200K". Mostrar zona seleccionada + tarifa real. |
| **Footer dark `#0F0E0C`** con 4 columnas + edición/año | **Sí** | Con NIT (cuando se obtenga) + dirección/teléfono/horarios leídos de `business_settings`. Sin "Est. [año pendiente]" — omitir si no hay año confirmado. |
| Hero stat "Edición 26 / [N] colegios" | **No** | Demasiado editorial-pretencioso para el target. Reemplazar por algo simple: "10 colegios aliados en Medellín". |
| Decoración: stack 3D de tarjetas con fotos angulares | **Sí**, pero | Solo cuando haya fotografía real. Hasta entonces, usar `ProductPhoto` placeholder o eliminar la columna derecha del hero y dejarlo full-width. |
| Italic-gold en `<em>` de headlines | **Sí** | Con Fraunces (§3.1). Una palabra clave por headline máximo (no abusar). |

### 3.3 Cobertura de páginas — ver §6 (gap analysis dedicado)

El bundle V3 cubre solo el **storefront de venta** (Home, Catálogo, PDP, Cart). El web-portal real tiene 8 superficies adicionales (auth, mi-cuenta, pago, soporte, encargos, checkout). El gap analysis con LOC reales y profundidad de rediseño recomendada por superficie está en **§6 Estado de páginas**.

---

## 4. Prompt de re-brief para próxima sesión Claude Design

> **Importante:** este prompt es una **plantilla**. Los valores específicos de identidad/contacto del negocio (dirección, teléfonos, emails, WhatsApp, horarios) **NO se inlinean en este documento** — el operador los inyecta al pegar, leyéndolos de la tabla `business_settings` (ver `business-facts.md` §1). Esto evita que datos personales/operativos vivan duplicados en el repo.

Pegar en una nueva sesión de Claude Design, **reemplazando los `{{...}}` con los valores reales obtenidos de `business_settings` en el momento de pegar**:

```
Estoy iterando el storefront V3 del Design System UCR. La sesión anterior
inventó datos (colegios élite ficticios, año 1985, dirección inventada, política
"envío gratis sobre $200K"). Esa data NO es real. Antes de generar nada nuevo,
adopta estas restricciones como verdad de campo:

== STACK FIJO ==
- Producción target: web-portal/ Next.js 16 + React 19 + Tailwind v4.
  NO Vite, NO Babel-standalone — eso fue sandbox de exploración.
- Tokens canónicos: web-portal/app/globals.css. Lift token names directly.
- Tipografía: HÍBRIDA. Fraunces (--font-editorial) SOLO en h1/h2 de hero y
  section headings grandes (con italic-en-gold para palabras clave). Outfit
  (--font-display) en h3 hacia abajo, body, UI controls. Inter (--font-sans)
  para body. JetBrains Mono para tabular y eyebrow uppercase.
- Iconos: lucide-react importados como componentes. NO redibujar SVG inline.

== DATA REAL DEL NEGOCIO ==
- Nombre: Uniformes Consuelo Rios (UCR). Sede en Medellín, Antioquia, Colombia.
- Dirección: {{address_line1}}, {{address_line2}}, {{city}}.
- Teléfonos: {{phone_main}} (principal), {{phone_support}} (soporte).
- Email: {{email_contact}}.
- WhatsApp: wa.me/{{whatsapp_number}}.
- Horarios: {{hours_weekday}} · {{hours_saturday}} · {{hours_sunday}}.
- Cobertura: SOLO Medellín. NO hay envío nacional. NO hay envío gratis.
- Tarifas envío: $10K-$13K según barrio, 1-2 días hábiles
  (zonas reales: Buenos Aires, La Candelaria, Villahermosa, Manrique,
  Milagrosa/Loreto). Recogida en taller también disponible.

== COLEGIOS ALIADOS (10 activos, mostrar todos) ==
1. Institución Educativa Caracas (CARACAS-001) — color #1E3A8A
2. Institución Educativa Alfonso López Pumarejo (PUMAREJO-001) — sin color
3. Institución Educativa El Pinal (PINAL-001) — sin color
4. Comfama (CONFAMA-001) — sin color
5. Buen Comienzo (BUEN-002) — sin color
6. Institución Educativa Felix Henao Botero (FELIX-001) — sin color
7. Institución Educativa Héctor Abad Gómez (HECTOR-001) — sin color
8. Institución Educativa Juan De La Cruz Posada (CRUZPOSADA-001) — sin color
9. Institución Educativa Manuel José Caycedo (CAICEDO-001) — sin color
10. Jardín Infantil Fe y Alegría (ALEGRIA-001) — sin color
11. Jardín Gota De Leche (GOTA-001) — sin color

Cuando primary_color es NULL, usa fallback gris neutral (#A8A29E). NO
inventes colores.

== TARGET DE MERCADO ==
Padres de instituciones educativas PÚBLICAS y programas sociales (Buen
Comienzo, Fe y Alegría) + caja de compensación (Comfama). Mercado popular
Medellín. NO es mercado élite. Tono: confianza, calidad, precio conviene.
NO usar "exclusivo", "premium", "elite", "para los mejores colegios".

== PENDIENTES (placeholders explícitos en el código, NO inventar) ==
Hasta que el dueño los confirme, usa placeholders visibles:
- Año de fundación: NO usar. Si la sección requiere uno, omitirla.
- NIT: usa "NIT pendiente de confirmación" en footer. NO inventar.
- Política de garantía: omitir sección hasta confirmar.
- Especificaciones de producto (tela/gramaje/costuras): NO mostrar specs
  table en PDP V3 inicial. Modelo de Product no tiene esos campos.

== PRODUCTOS — NO INVENTES ==
La taxonomía real de garment_types tiene casing inconsistente
(CAMISETA, Camiseta, camiseta) y categorías sucias (uniforme_diario,
uniforme_deportivo, accesorios, accessories, Superior, tops, bottoms,
Conjunto, footwear). Antes de exponer filtros públicos hay que normalizar.
Para el mockup, usa estas categorías canónicas como decisión de diseño:

  type Category = 'uniforme_diario' | 'uniforme_deportivo' | 'accesorios';
  // labels UI: 'Diario' | 'Deporte' | 'Accesorios'

Type del producto:

  type Product = {
    id: string;
    slug: string;
    name: string;             // viene de garment_type.name normalizado
    schoolSlug: string | null; // null = producto global (Tennis, Jean, etc.)
    category: Category;
    price: number;            // COP sin decimales
    sizes: string[];
    stock: 'taller' | 'pedido' | 'agotado';
  };

NO generes array PRODUCTS hardcoded. Acepta `products: Product[]` como prop.

== TONE-OF-VOICE — INVIOLABLE ==
- Spanish, Colombian, "tú" (NO "usted").
- Acentos siempre: Sesión, Contraseña, Días, Próximo.
- CERO emojis en UI primaria. CERO. Si propones uno, te equivocaste.
- Numbers: Colombian peso, sin decimales, separador dot-mil: $48.500.
- Tabular nums (font-variant-numeric: tabular-nums) en toda cifra monetaria.
- Copy de marca: "Calidad que se nota, precios que convienen". Plainspoken,
  family-business. NO editorial-luxury.

== APROVECHAMIENTO PARCIAL DEL V3 ANTERIOR ==
Conserva del v3 anterior: layout editorial del hero, manifesto stripe,
SchoolPicker grid 3-col con code/code2 + color bar, ProcessBand 4 pasos,
sticky filter bar en catálogo, dual CTA (Wompi + WhatsApp) en PDP/cart,
italic-en-gold en headlines (con Fraunces).

Descarta del v3 anterior: hero stat "Edición 26", italic-gold abusivo
(>1 palabra por headline), tone "el uniforme que los niños no quieren
quitarse", dark hero #0F0E0C ATEMPERAR — proponer versión donde el dark
solo aparece en CTAs/copy clave y el fondo es surface-100 con un radial
gold sutil.

== ENTREGABLE ESPERADO ==
Componentes Next.js App Router. Server components donde aplique, client
components solo donde haya estado interactivo. Tipos TypeScript estrictos
(NO any). Usar Tailwind classes con tokens canónicos (bg-surface-100,
text-stone-900, border-brand-400) en vez de inline style={{}}.

Pares de archivos esperados:
- app/page.tsx + components/HeroV3.tsx
- app/page.tsx + components/SchoolPickerV3.tsx
- app/page.tsx + components/ProcessBandV3.tsx
- app/[school_slug]/page.tsx + components/CatalogV3.tsx
- app/[school_slug]/[product_slug]/page.tsx + components/PDPV3.tsx
- app/carrito/page.tsx + components/CartV3.tsx

NO entregues HTML+Babel-standalone. NO inline styles. NO inventes datos.
Si te falta data, deja un comentario `{/* TODO: depende de business-facts.md
§N — pendiente confirmar con dueño */}` y propón el placeholder más honesto.
```

---

## 5. Plan de integración Next.js (fases)

**Tipografía:** opción C (Fraunces editorial + Outfit funcional). **Dirección:** aprovechamiento parcial del v3 con copy real (§3.2). **Datos:** [`business-facts.md`](./business-facts.md) como fuente única.

### Fase 0 — Pre-requisitos (bloqueantes, fuera de código)

- [x] ~~Recopilar data real de negocio~~ → resuelto en [`business-facts.md`](./business-facts.md)
- [x] ~~Decidir tipografía~~ → opción C (§3.1)
- [x] ~~Decidir dirección~~ → aprovechamiento parcial (§3.2)
- [ ] **Conseguir pendientes externos** (de Consuelo): NIT, año fundación, política de garantía, tagline público, especificaciones tela/costura, colores de marca de los 9 colegios sin asignar
- [ ] **Limpiar seed data sucia** en `schools.address` (3 placeholders falsos `Bogotá`/`Cali`) — migración Alembic o UPDATE manual
- [ ] **Normalizar `garment_types.category`** — eliminar duplicados de casing y consolidar taxonomía. Migración Alembic.

### Fase 1 — Tokens y assets

- [ ] Copiar logos PNG de `claudesing/extracted/assets/` a `web-portal/public/` (mantener nombres canónicos)
- [ ] **Agregar Fraunces a `app/layout.tsx`** con `next/font/google` y axis `opsz`. Registrar variable `--font-fraunces`
- [ ] **Agregar `--font-editorial: var(--font-fraunces)`** al bloque `@theme inline` de `globals.css`
- [ ] Confirmar paridad de tokens (color/shadow/motion) entre `colors_and_type.css` y `globals.css`. Diff documentado en §1.1 del handoff — solo brand color drift menor, producción gana
- [ ] (opcional) Crear página `/design-system` interna que renderice los previews del bundle (`extracted/preview/*.html`) como componentes Next, para validación visual con Consuelo

### Fase 2 — Componentes nuevos en ruta `/v3-preview/` (no destructiva)

Crear los componentes V3 sin tocar los actuales. Se prueban en `/v3-preview/*` antes de cortar.

- [ ] `components/v3/HeroV3.tsx` — Hero con copy real ("Calidad que se nota..."), 10 colegios reales en marquee, manifesto stripe con 3 promesas reales (Calidad/Servicio/Cumplimiento), `font-editorial italic` en headline, dark **atemperado** (no full-luxury). Data desde props.
- [ ] `components/v3/SchoolPickerV3.tsx` — grid 3-col con `code` real, `primary_color` con fallback gris cuando NULL, conteo real de prendas por colegio. Recibe `schools: School[]`
- [ ] `components/v3/ProcessBandV3.tsx` — 4 pasos con copy real (Eligen / Confeccionamos / Confirmamos / Entregamos), sin tiempos inventados
- [ ] `components/v3/CatalogClientV3.tsx` — banner color del colegio (con fallback) + sticky filter bar con categorías normalizadas. Reemplaza eventualmente a `CatalogClient.tsx`
- [ ] `components/v3/ProductDetailV3.tsx` — PDP server-rendered + buy box client component, dual CTA (Wompi + WhatsApp). **Sin specs table** en V3 inicial. Reemplaza a `ProductDetailModal.tsx`
- [ ] `components/v3/CartPageV3.tsx` — full page con tabla items + resumen sticky, **sin "envío gratis"**, mostrar zona seleccionada + tarifa real. Reemplaza a `FloatingCartSummary` para `/carrito`
- [ ] `components/v3/FooterV3.tsx` — footer dark con NIT (cuando llegue) + datos de identidad/contacto leídos de `business_settings` (dirección, teléfono, horarios, email, WhatsApp). Sin "Est. [año]" si no hay año confirmado

### Fase 3 — Cutover

- [ ] Rutas `/v3-preview/*` se vuelven `/*`. Componentes viejos se mueven a `components/_legacy/` (no se borran inmediatamente).
- [ ] Smoke test completo: home → schools → catalog → PDP → cart → Wompi flow → mi-cuenta.
- [ ] Lighthouse audit + Web Vitals comparativo antes/después.
- [ ] Deploy a staging, validación con Consuelo y Diana.
- [ ] Deploy a producción dentro de la ventana V3 (ver `docs/v3/v3-branch-architecture/transition-plan.md`).

### Fase 4 — Limpieza

- [ ] Borrar `components/_legacy/` después de 2 semanas en producción sin issues.
- [ ] Documentar en `docs/v3/v3-branch-architecture/` la versión final del design system shipped.
- [ ] Actualizar `MEMORY.md` con la decisión de tipografía y dirección.

---

## 6. Estado de páginas (gap analysis)

El bundle V3 cubre solo el **storefront de venta** (4 páginas core). El web-portal real tiene **13 páginas** y ~9,400 LOC (5,492 en pages + 3,952 en components). **Cobertura real del bundle: ~25% de la superficie.**

### 6.1 Mapa completo de páginas

| # | Ruta | Archivo | LOC | Cubierto por V3 | Estado actual | Profundidad rediseño recomendada |
|---|---|---|---:|:---:|---|---|
| 1 | `/` | `app/page.tsx` + `components/HomePageClient.tsx` | 12 + 493 | **✓ Sí** | Hero claro + nav login + lista colegios. Login modal embebido | **Componentes** — adoptar HeroV3 + SchoolPickerV3 + ProcessBandV3 |
| 2 | `/[school_slug]` | `app/[school_slug]/page.tsx` + `components/CatalogClient.tsx` | 76 + 858 | **✓ Sí** | Catálogo del colegio. Modal de PDP embebido | **Componentes + arquitectura** — adoptar CatalogV3 + sacar PDP a route propia (`/[school_slug]/[product_slug]`) |
| 3 | `/[school_slug]/cart` | `app/[school_slug]/cart/page.tsx` | 324 | **✓ Sí** | Carrito | **Componentes** — adoptar CartV3 |
| 4 | `/[school_slug]/checkout` | `app/[school_slug]/checkout/page.tsx` | **1,385** | ✗ No | Checkout pre-Wompi (form datos cliente, dirección, zona, método pago) | **Cosmético + descomposición urgente** — la página es un monolito, hay que dividirla. Tokens/tipografía V3 sí; rediseño visual completo, no en V3 inicial |
| 5 | `/pago` | `app/pago/page.tsx` | 259 | ✗ No | Loading mientras Wompi procesa | **Cosmético** — no tocar lógica, solo tokens/tipografía |
| 6 | `/pago/resultado` | `app/pago/resultado/page.tsx` | 247 | ✗ No | Resultado del pago (success/error) | **Cosmético** — confianza en messaging, no rediseñar |
| 7 | `/mi-cuenta` | `app/mi-cuenta/page.tsx` | 859 | ✗ No | Dashboard cliente: pedidos, datos personales, dirección, password | **Componentes** — vale la pena V3 visual aquí (es la página post-compra). Adoptar Header/Footer V3, cards V3, table styling |
| 8 | `/registro` | `app/registro/page.tsx` | 577 | ✗ No | Signup multi-step (datos cliente + estudiantes + colegio) | **Cosmético + componentes** — actualizar inputs, botones, layout, pero mantener flow lógico |
| 9 | `/recuperar-password` | `app/recuperar-password/page.tsx` | 150 | ✗ No | Form simple email | **Cosmético** — adoptar input/btn V3, layout centrado |
| 10 | `/activar-cuenta/[token]` | `app/activar-cuenta/[token]/page.tsx` | 148 | ✗ No | Verify email by token | **Cosmético** — adoptar messaging V3 |
| 11 | `/encargos-personalizados` | `app/encargos-personalizados/page.tsx` | 609 | ✗ No | Form custom orders | **Componentes** — flujo no estándar, pero merece refresh visual |
| 12 | `/soporte` | `app/soporte/page.tsx` | 761 | ✗ No | Centro de ayuda + WhatsApp + FAQs | **Componentes** — buen candidato para usar el lenguaje editorial V3 (eyebrow + Fraunces en h2, secciones tipo content) |
| 13 | `/not-found` | `app/not-found.tsx` | — | ✗ No | 404 | **Cosmético** — actualizar tokens |

### 6.2 Tres niveles de profundidad — definiciones

Para evitar ambigüedad, cada superficie se clasifica en uno de tres niveles:

| Nivel | Qué cambia | Qué NO cambia | Costo aprox |
|---|---|---|---|
| **Cosmético** | Tokens (colores, sombras, radii), tipografía Outfit→Fraunces en h1/h2, classes Tailwind nuevas, Header/Footer V3 | Lógica, estructura HTML, flujos, props, types | ~10% del LOC tocado |
| **Componentes** | Lo de cosmético + reemplazo de inputs/botones/cards/tablas por variantes V3, eyebrows, sticky filters, layout grids | Routing, fetching, state shape | ~30-40% del LOC tocado |
| **Cosmético + descomposición** | Cosmético + extraer subcomponentes de un monolito (sin cambiar lógica) | Comportamiento end-to-end | ~50% del LOC tocado |
| **Rediseño completo** | Repensar UX, flujos, jerarquía, pasos | Solo lo que se mantiene como decisión explícita | 70%+ del LOC tocado |

### 6.3 Recomendación por categoría

**Tier 1 — Storefront de venta (las 4 cubiertas por V3 + PDP):** rediseño completo según el plan de Fase 2. Es lo que se vio primero, lo que tiene el mayor impacto en conversión, y donde el bundle tiene material.

**Tier 2 — Páginas post-venta visibles (mi-cuenta, soporte):** rediseño nivel **componentes**. Son páginas que el usuario ve después de comprar; mantener el lenguaje V3 ahí refuerza confianza. `mi-cuenta` además es donde se muestra el estado del pedido (importante post-Wompi).

**Tier 3 — Auth y flujos transaccionales (registro, recuperar, activar, checkout, pago):** rediseño **cosmético**. Lógica delicada (especialmente checkout 1,385 LOC y pago Wompi). NO tocar lógica en V3. Solo tokens/tipografía/Header/Footer.

**Tier 4 — Páginas pesadas con monolitos (encargos-personalizados, checkout):** dejar para **post-V3**. Son ~2,000 LOC combinados. Hacer V3 cosmético en el cutover, refactor + rediseño completo en una iteración posterior una vez V3 esté en producción estable.

### 6.4 Esfuerzo estimado por enfoque

Si decides **Tier 1 (rediseño)** + **Tier 2 (componentes)** + **Tier 3 (cosmético)** + **Tier 4 cosmético-defer**:

| Tier | Páginas | LOC tocado | Profundidad | Esfuerzo relativo |
|---|---|---|---|---|
| 1 | 4 (Home, Catalog, PDP, Cart) + nuevo PDP route | ~1,750 LOC | Rediseño completo | Alto |
| 2 | 2 (mi-cuenta, soporte) | ~1,620 LOC | Componentes | Medio |
| 3 | 5 (registro, recuperar, activar, pago x2) | ~1,381 LOC | Cosmético | Bajo |
| 4 | 2 (checkout, encargos) | ~1,994 LOC | Cosmético-defer | Bajo (defer refactor) |
| — | not-found, layout, providers | ~100 LOC | Cosmético | Trivial |

**Recomendación de cutover por etapas:**

- **V3.0 launch (Fase 2-3 del plan):** Tier 1 completo + Tier 3 cosmético. Eso entrega el storefront editorial nuevo + auth/checkout actualizados visualmente. Sin tocar mi-cuenta ni soporte aún.
- **V3.1 (post-launch ~2-4 semanas):** Tier 2 con `mi-cuenta` y `soporte` rediseñados a nivel componentes.
- **V3.2 (post-launch ~6-8 semanas):** Tier 4 con `checkout` y `encargos-personalizados` refactorizados (descomposición + V3) — esto requiere trabajo de ingeniería separado del rediseño visual.

### 6.5 Pendientes de Fase 2 que dependen de §6

- [ ] Decidir si PDP se saca a route propia (`/[school_slug]/[product_slug]`) o se mantiene como modal. Recomendación: **route propia** para SEO + linkability + alineación con bundle V3 (`PDPV3.tsx` está pensado como page).
- [ ] Decidir alcance de V3.0 launch: ¿solo Tier 1 + 3, o incluir Tier 2 desde el inicio?
- [ ] Definir lista exacta de "componentes V3 reutilizables" (input, button, card, table, eyebrow, badge) que se necesitan en Tier 2/3 para mantener consistencia visual.

---

## 7. Riesgos identificados

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Inventar datos por velocidad | Lanzar producción con `1985`/NIT inventado → riesgo legal/marca | Solo publicar campos confirmados en `business-facts.md`. Si no hay NIT, footer dice "NIT pendiente" o se omite la línea legal hasta tener el dato |
| **Seed data engañosa en DB** | Cualquier consulta SQL ingenua reproduce el bug que tuvo este análisis ("schools en Bogotá/Cali") | Limpiar `schools.address` en Fase 0. Documentar en `business-facts.md` que `address` no es fuente confiable hasta limpieza |
| Tone editorial mal calibrado al target | Padres de IE públicas perciben el portal como "no es para mí" | Validar versión visual con Consuelo y, si es posible, con 3-5 padres reales antes de cutover. Atemperar el dark hero si hay duda |
| Bundle de Fraunces infla TTI | Fraunces con axis `opsz` = ~80KB woff2 extra | Limitar `font-editorial` a hero + h2 de sections. Lighthouse audit en Fase 3 antes de cutover |
| Romper SEO al migrar URLs | `/[school_slug]/` ya está indexado | Auditar `app/sitemap.ts` y `app/robots.ts` antes de cualquier cambio de routing. **Mantener slugs actuales** |
| Wompi flow regresa | El v3 no incluye flujo de pago — solo el botón "Pagar con Wompi" | Mantener `app/pago/` actual sin cambios visuales en V1 del rediseño |
| `ProductPhoto` placeholder en prod | Si llega a producción se ve sin foto real | Marcar como temporal. Fotografiar producto antes de cutover, o aceptar placeholders explícitos hasta que llegue fotografía |
| Categorías sucias expuestas al público | Filtros del catálogo muestran `accesorios`/`accessories` como dos opciones distintas | Bloqueante de Fase 2: normalizar en Fase 0 |

---

## 8. Anexo: mapa completo del bundle

```
claudesing/extracted/
├── README.md                         # Brand book derivado del repo (200 líneas)
├── SKILL.md                          # Manifest de skill Claude (referencia)
├── colors_and_type.css               # Tokens canónicos (Fraunces-based v2)
├── assets/                           # PNG: logo, icon, mark, lockup, wompi, favicon
├── preview/                          # Specimen cards (10 HTML para Design System tab)
├── ui_kits/
│   ├── shared/
│   │   ├── Logo.jsx                  # CRLockup, CRStamp, CRMonogram (V3 logo system)
│   │   ├── Icons.jsx                 # Lucide stroke-1.5 set
│   │   └── ProductPhoto.jsx          # Placeholder gráfico
│   ├── storefront/
│   │   ├── README.md                 # Notas del kit (NOTA: dice "Recreated from frontend/" — error, es web-portal/)
│   │   ├── index.html                # Prototipo v2 monolítico
│   │   ├── Storefront v2.html        # Idem con ProcessBand inyectado
│   │   ├── Storefront v3.html        # Prototipo v3
│   │   ├── Brand.jsx                 # Header/Logo/Wordmark v2
│   │   ├── Home.jsx                  # Hero/SchoolGrid/FeatureBand/Footer v2 (con datos inventados)
│   │   ├── Catalog.jsx               # CatalogPage/ProductCard/CartDrawer v2
│   │   ├── Cart.jsx                  # CartDrawer v2
│   │   ├── Header.jsx                # Header standalone
│   │   ├── Icons.jsx                 # Iconos del kit
│   │   ├── Screens.jsx               # Hero/SchoolPicker/ValueProps/Footer composables
│   │   └── StorefrontV3.jsx          # ⭐ TODO el V3 en un archivo (Hero/SchoolPicker/ProcessBand/Catalog/PDP/Cart)
│   └── web-portal/                   # Admin/POS kit (NO es el portal de clientes)
│       ├── README.md                 # NOTA: dice "Vite + React 18" — error, frontend/ Tauri sí, web-portal/ es Next
│       ├── index.html                # Prototipo admin v1
│       ├── Web Portal v3.html        # Prototipo admin v3
│       ├── Shell.jsx, ShellV3.jsx    # Sidebar + TopBar
│       ├── Pages.jsx, PagesV3.jsx    # Dashboard/Orders/Inventory
│       ├── Customers.jsx             # Clientes (V3 only)
│       └── Icons.jsx
├── scraps/                           # Archivos descartados (ignorar)
└── uploads/                          # Logo subido por el usuario (referencia)
```

**Archivos prioritarios para esta integración:**
- `colors_and_type.css` → comparar contra `web-portal/app/globals.css`
- `ui_kits/storefront/StorefrontV3.jsx` → fuente de los componentes V3 a portar
- `ui_kits/shared/Logo.jsx` → leer antes de implementar `CRLockup`/`CRStamp`/`CRMonogram` reales
- `assets/*.png` → copiar a `public/`

---

## 9. Próximos pasos sugeridos (pickear uno)

Con las decisiones de §3 ya tomadas, estos son los siguientes movimientos posibles. Cada uno arranca un flujo distinto:

1. **Conseguir pendientes externos** con Consuelo (NIT, año fundación, política garantía, tagline público, especificaciones tela/costura, colores de marca de 9 colegios). Sin esto, Fase 2 queda con placeholders — defendible para POC, no para producción.
2. **Migración de limpieza de DB** (Fase 0 técnica): Alembic para limpiar `schools.address` placeholder y normalizar `garment_types.category`. Independiente del rediseño visual, pero bloqueante de Fase 2.
3. **POC tipografía** (~30 min): página `/v3-preview/typography` que renderice una sola headline en Outfit-italic vs Fraunces-italic vs híbrida. Validar opción C visualmente con Consuelo antes de invertir en Fase 2 completa.
4. **Re-brief Claude Design** con el prompt de §4 (ya completo con data real). Pegar en sesión nueva y dejar que regenere componentes con la data correcta. Útil si quieres una segunda iteración visual antes de codificar.
5. **Arrancar Fase 2 directo** (HeroV3, SchoolPickerV3, ProcessBandV3 en `/v3-preview/`). Asume tipografía C y aprovechamiento parcial — coherente con las decisiones tomadas. Es el camino más rápido a algo testeable.

Mi sugerencia: **2 + 5 en paralelo** si tienes ancho de banda. La migración de DB es independiente del visual y se puede hacer en cualquier momento; la Fase 2 con `/v3-preview/` no destruye nada y permite iterar sin riesgo. (1) puede correr en paralelo asíncronamente con Consuelo.

---

*Documento generado por análisis del bundle entregado en `claudesing/Uniformes Consuelo Rios _ Design System.zip` (2026-05-04) y actualizado tras consulta a DB de desarrollo (dump de prod) y verbalización con dueño. Cualquier inconsistencia entre este documento y el código real de `web-portal/` significa que algo en la integración drift-eó — actualizar este documento al iterar.*
