# Plan de Mejora: portal-web-seo v2
Score actual: 41 | Target: 75 | Gap: 34 pts

## P0 — Quick Wins (< 1 hora c/u, impacto directo en score)

### 1. robots.txt + sitemap.xml (sitemap-robots: 1 → 8)
Crear `web-portal/app/robots.ts` y `web-portal/app/sitemap.ts`.
- `robots.ts`: User-agent *, Allow /, Disallow /mi-cuenta, Disallow /pago, Sitemap ref
- `sitemap.ts`: Fetch all schools from API, generate URLs for homepage + cada /colegios/{slug}
- Archivos: `web-portal/app/robots.ts` (nuevo), `web-portal/app/sitemap.ts` (nuevo)

### 2. Canonical tags (meta-tags: 5 → 7)
Agregar `alternates.canonical` en root layout metadata y en `generateMetadata` de school pages.
- Root: `alternates: { canonical: 'https://yourdomain.com' }`
- Schools: `alternates: { canonical: \`https://yourdomain.com/\${school.slug}\` }`
- Archivos: `web-portal/app/layout.tsx:25`, `web-portal/app/[school_slug]/page.tsx:18`

### 3. Homepage title + description + H1 con keywords geo (meta-tags + local-seo)
- Title: "Uniformes Escolares en Medellin | Catalogo Online por Colegio — Consuelo Rios"
- Description: "Compra uniformes escolares en Medellin. Catalogo por colegio con precios, tallas y pedidos online. Envio a domicilio o recoge en Boston, Medellin."
- H1 en HomePageClient: cambiar slogan por "Uniformes Escolares en Medellin"
- OG title/desc: alinear con title/desc
- Archivos: `web-portal/app/layout.tsx:25-53`, `web-portal/components/HomePageClient.tsx` (buscar H1)

### 4. School pages — OG/Twitter dinámicos + ciudad (meta-tags)
En `generateMetadata` agregar openGraph y twitter con datos del colegio + "Medellin".
- Description: "Uniformes escolares para {school.name} en Medellin. Blusas, pantalones, medias y calzado. Precios y tallas disponibles."
- OG image: logo del colegio o fallback
- Archivo: `web-portal/app/[school_slug]/page.tsx:10-22`

### 5. Schema.org LocalBusiness JSON-LD (schema-org: 0 → 5, local-seo: 2 → 5)
Crear componente server `web-portal/components/JsonLd.tsx` que renderice `<script type="application/ld+json">`.
Inyectar en root layout con datos de `getBusinessInfo()`.
Schema: LocalBusiness con name, address (PostalAddress), telephone, openingHoursSpecification, geo, url, image.
- Archivos: `web-portal/components/JsonLd.tsx` (nuevo), `web-portal/app/layout.tsx` (importar)

## P1 — Mejoras Medianas (1-4 horas)

### 6. Schema.org Product en school pages (schema-org: 5 → 7)
En `[school_slug]/page.tsx`, generar JSON-LD con array de Products.
Cada producto: name, image, description, offers (price, priceCurrency: COP, availability).
- Archivo: `web-portal/app/[school_slug]/page.tsx` o nuevo `components/ProductJsonLd.tsx`

### 7. Footer SSR — convertir a Server Component (ssr-indexability: 5 → 7, local-seo: 5 → 7)
Eliminar `'use client'` del Footer. Usar `getBusinessInfo()` (ya existe con cache server-side).
El footer tendra dirección, teléfono, horarios en el HTML inicial.
- Archivo: `web-portal/components/Footer.tsx` (refactor completo)
- Dependencia: `web-portal/lib/businessInfo.ts:getBusinessInfo`

### 8. Heading hierarchy fix (headings: 7 → 8)
- School pages: agregar H2 "Catalogo de Uniformes" antes de los H3 de productos.
- Homepage: H2 "Selecciona tu Colegio" ya existe, verificar que H1 sea descriptivo.
- Archivos: `web-portal/components/CatalogClient.tsx`, `web-portal/components/HomePageClient.tsx`

### 9. Image width/height attributes (core-web-vitals: 6 → 7, image-alt: 5 → 7)
- ProductImageOptimized: quitar `unoptimized={true}` para habilitar optimización Next.js.
- CatalogClient modal images: agregar width/height explícitos.
- Archivos: `web-portal/components/ProductImageOptimized.tsx`, `web-portal/components/CatalogClient.tsx`

### 10. Homepage SSR hardening (ssr-indexability: 7 → 8)
El homepage ya fetcha schools server-side (PASS), pero HomePageClient es 'use client'.
La lista de colegios ya está en el HTML via RSC props, pero el H1 y footer no.
- Mover el H1 y hero text fuera del client component hacia page.tsx server component.
- El footer ya se resuelve en P1.7.
- Archivo: `web-portal/app/page.tsx`, `web-portal/components/HomePageClient.tsx`

## P2 — Cambios Estructurales (requiere backend)

### 11. URL slug fix — normalizar caracteres especiales (url-structure: 3 → 7)
El slug generator del backend rompe ñ/tildes: "institución" → "instituci-n".
Fix en backend slug generation: normalizar unicode (NFKD decomposition), strip diacritics, ñ → n.
Requiere: migration para actualizar slugs existentes en DB.
- Archivos: `backend/app/services/` o `backend/app/models/school.py` (buscar slug generation)
- Impacto: URLs cambiarán, necesita redirects 301

### 12. URL prefix semántico /colegios/ (url-structure)
Mover de /{slug} a /colegios/{slug}.
- Renombrar `web-portal/app/[school_slug]/` a `web-portal/app/colegios/[school_slug]/`
- Agregar redirects en next.config.ts para URLs antiguas
- Actualizar sitemap, internal links

### 13. BreadcrumbList schema (schema-org)
Agregar JSON-LD BreadcrumbList en school pages: Inicio > Colegios > {school.name}
- Archivo: nuevo componente o inline en school page

### 14. Landing pages geo (/uniformes-escolares-medellin) (local-seo)
Crear paginas estáticas con contenido SEO para búsquedas geolocalizadas.
Requiere contenido editorial.

## Impacto Estimado

| Fase | Score estimado | Delta |
|------|---------------|-------|
| Actual | 41 | — |
| P0 completado | ~60 | +19 |
| P0+P1 completado | ~73 | +32 |
| P0+P1+P2 completado | ~82 | +41 |

## Prioridad de ejecución P0

1. robots.ts + sitemap.ts (mayor gap, 0 a algo)
2. Schema LocalBusiness JSON-LD (mayor gap, 0 a algo)
3. Homepage meta tags + H1 (afecta 3 categorías)
4. Canonical tags (quick add)
5. School pages OG/Twitter dinámicos
