uditoría SEO Completa — yourdomain.com
Sitio auditado: Uniformes Consuelo Rios (Next.js App Router)
Nicho: Uniformes escolares — Medellín, Colombia
Fecha: 12 de abril de 2026

1. META TAGS — ✅ PASS (con observaciones)
Cada página tiene <title> y <meta description> únicos y bien diferenciados:

Homepage: Title con keywords "Uniformes Escolares en Medellin" + marca. Description incluye propuesta de valor, ciudad y modelo de entrega.
Páginas de colegio: Titles dinámicos como "Uniformes Institución Educativa Caracas en Medellin | Uniformes Consuelo Rios". Descriptions personalizadas por colegio.
Soporte / Encargos: Titles únicos con marca al final.

Open Graph completo (og:title, og:description, og:image, og:type, og:locale=es_CO, og:site_name). Twitter Cards configuradas (summary_large_image). Canonical definida correctamente. html lang="es".
Problemas detectados:

Faltan tildes en titles y descriptions ("Medellin" en vez de "Medellín", "catalogo" sin tilde). Google sabe manejar esto, pero para el usuario es una señal de calidad inferior.
og:image apunta a /logo.png genérico — debería ser una imagen más atractiva por página (ej: foto de uniformes del colegio específico).
No hay meta[name="robots"] explícito (no es crítico, pero es buena práctica tenerlo en index, follow).


2. HEADINGS — ✅ PASS
Jerarquía correcta en todas las páginas auditadas:

Homepage: 1 solo <h1> ("Uniformes Escolares en Medellin") → <h2> ("Selecciona tu colegio") → <h3> por cada colegio. Perfecto.
Página de colegio: 1 <h1> (nombre del colegio) → <h2> ("Catalogo de Uniformes") → <h3> por producto. Correcto.
Soporte: 1 <h1> → mezcla H2 y H3. Falta un H2 antes de los primeros H3 (Atención al Cliente y Soporte Técnico saltan de H1 a H3), pero es un problema menor.

Problema: Los <h1> de las páginas de colegio solo muestran el nombre de la institución sin la keyword "uniformes". Debería ser algo como "Uniformes Institución Educativa Caracas — Medellín" para reforzar la keyword principal.

3. URL STRUCTURE — ⚠️ FAIL PARCIAL
Las URLs son semánticas y legibles en concepto (/institucion-educativa-felix-henao-botero), lo cual es positivo frente a una estructura tipo /products?school=abc123. Sin embargo, hay problemas serios:
Errores críticos de slugs:

/instituci-n-educativa-caracas → La ó se convirtió en -n-. Debería ser /institucion-educativa-caracas.
/instituci-n-educativa-alfonso-l-pez-pumarejo → Múltiples caracteres rotos. Debería ser /institucion-educativa-alfonso-lopez-pumarejo.
/buen-comiezo → Typo. Debería ser /buen-comienzo.
/confama → El nombre correcto es "Comfama" (la URL dice "confama").
/institucion-educativa-hector-abad-gomes → Typo. Debería ser "gomez".

Falta estructura jerárquica: No hay prefijo /colegios/ o /uniformes/ que agrupe las URLs por tipo. Una estructura como /colegios/institucion-educativa-caracas comunicaría mejor la taxonomía del sitio a Google y habilitaría breadcrumbs semánticos.
No hay páginas individuales de producto: Todo el catálogo vive en la página del colegio. Esto significa que productos individuales no pueden posicionarse en búsquedas como "chompa azul uniforme Caracas".

4. SCHEMA.ORG — ✅ PASS (muy bien implementado, con mejoras posibles)
Schemas encontrados:

LocalBusiness (en TODAS las páginas): Incluye name, telephone, email, address (PostalAddress completa con calle, ciudad, región, país), geo (lat/long), openingHoursSpecification (L-V y Sáb), priceRange, currenciesAccepted, paymentAccepted, areaServed. Excelente.
ItemList + Product (en páginas de colegio): Cada producto tiene @type: Product con name, description, image y offers (pricing). Esto puede generar rich snippets de productos en Google.

Schemas faltantes:

BreadcrumbList: No existe. Google lo usa para mostrar breadcrumbs en SERPs.
FAQPage: No hay sección FAQ ni schema de FAQ.
Organization: Complementaría al LocalBusiness con logo, redes sociales, etc.
WebSite con SearchAction: Permitiría el sitelinks searchbox en Google.


5. IMÁGENES — ✅ PASS (con reservas)
Alt text: Todas las imágenes (13 en homepage, 8+ en páginas de colegio) tienen alt descriptivo. Los escudos usan "Escudo [Nombre Colegio]" y los productos usan el nombre del producto. Bien hecho.
Uso de next/image: Las imágenes usan el componente <Image> de Next.js (data-nimg presente), lo que aporta optimización automática (formato WebP/AVIF, srcset, lazy loading).
Problemas:

Las imágenes de productos en las páginas de colegio no tienen width/height explícitos en el HTML, lo que puede causar CLS (layout shifts) al cargar.
Los alt text de productos son genéricos ("Sudadera", "Jean") — deberían incluir contexto: "Sudadera uniforme Institución Educativa Caracas Medellín".
Algunos productos no cargan imágenes (naturalWidth = 0), posiblemente por problemas de carga lazy o rutas rotas.
El último logo tiene alt="Logo" — debería ser "Logo Uniformes Consuelo Rios".


6. CORE WEB VITALS — ✅ PASS (estimado bueno)
Métricas obtenidas (entorno local, indicativas):

TTFB: ~134ms (excelente para local; en producción dependerá del hosting)
DOM Content Loaded: ~485ms
Load Complete: ~584ms
CLS estimado: 0.0000 (excelente)
Recursos: 57 total, ~16KB transferidos (extremadamente liviano gracias a SSR)

Positivo: 3 fuentes precargadas (preload), 1 solo stylesheet CSS, imágenes lazy-loaded.
Problemas:

31 scripts sin async/defer: Esto puede bloquear el render en conexiones lentas. Next.js los maneja internamente, pero es un punto de observación.
0 preconnects: Debería haber preconnect a dominios de imágenes/APIs externas.
En producción, el rendimiento real dependerá del hosting (Vercel vs. VPS colombiano) y la CDN.


7. LOCAL SEO — ✅ PASS (fuerte, con mejoras)
NAP Consistency (Name, Address, Phone):

Schema LocalBusiness: "Uniformes Consuelo Rios" / "Calle 56 D #26 BE 04" / "+57 300 123 4567" ✅
Footer: Mismo NAP exacto ✅
Geo coordinates: 6.2518, -75.5636 (Medellín) ✅
Google Maps link en footer ✅
Horarios en schema Y en footer ✅
areaServed definido ✅

Problemas:

No hay página /acerca-de o /nosotros con historia del negocio, que ayuda a E-E-A-T.
No hay link a Google My Business profile desde el sitio.
No hay testimonios/reseñas de clientes en schema (aggregateRating faltante).
El sitio está enfocado solo en Medellín — el title dice "Bogotá" en la búsqueda del usuario, lo que significa que este negocio NO aparecería para esa búsqueda. La oportunidad de expansión geográfica es clave si planean escalar.


8. SITEMAP Y ROBOTS.TXT — ✅ PASS
robots.txt:

User-Agent: * con Allow: / ✅
Bloquea correctamente rutas privadas: /mi-cuenta, /pago, /registro, /recuperar-password ✅
Referencia a sitemap: Sitemap: https://yourdomain.com/sitemap.xml ✅

sitemap.xml:

Formato válido con <urlset> ✅
14 URLs indexadas con <lastmod>, <changefreq> y <priority> ✅
Prioridades razonables: homepage (1.0), colegios (0.8), encargos (0.5), soporte (0.3) ✅

Problemas:

Las URLs del sitemap heredan los mismos problemas de slugs rotos (instituci-n-educativa-caracas).
No hay páginas individuales de producto en el sitemap (los 20+ productos del catálogo de cada colegio no tienen URLs propias).
lastmod es el mismo timestamp para todas las URLs — debería reflejar la última modificación real de cada página.


9. SSR / INDEXABILIDAD — ✅ PASS (excelente)
Verificado: Next.js con App Router usando Server-Side Rendering (SSR).
Evidencia:

No existe __NEXT_DATA__ (propio de Pages Router) → confirma App Router.
document.body.innerHTML.length = 325,966 bytes → todo el HTML se entrega pre-renderizado.
Meta tags, headings, schema.org y contenido de productos están en el HTML inicial.
Google puede indexar el catálogo completo sin ejecutar JavaScript.

Problema menor: El contenido del catálogo (productos, precios) se renderiza en servidor, pero las imágenes de producto dependen de lazy loading client-side. Googlebot renderiza JS pero puede no scrollear; las imágenes podrían no ser indexadas si no están en el viewport inicial.

10. MOBILE-FRIENDLINESS — ⚠️ PASS CON RESERVAS
Positivo:

<meta name="viewport" content="width=device-width, initial-scale=1"> ✅
Sin scroll horizontal ✅
10 media queries CSS para responsive ✅
Fuentes legibles en las áreas principales ✅

Problemas detectados:

Textos de 10px encontrados en la zona de pagos/trust badges ("A medida", "Visa, Mastercard", "Débito bancario"). Google penaliza texto <12px en mobile.
Touch targets de 36px ("Iniciar Sesión" = 144×36px, otros botones = 40px). Google recomienda mínimo 48×48px.
En la prueba visual a 375px de ancho, la vista sigue mostrando el layout de desktop (3 columnas de colegios), lo que indica que el responsive breakpoint podría no estar activándose correctamente o el viewport no se aplica al redimensionar la ventana del browser.


CHECKLIST SEO — PASS/FAIL
#CriterioEstadoDetalle1Title único por página✅ PASSDinámico y con keywords2Description única por página✅ PASSPersonalizada por colegio3Open Graph completo✅ PASSTitle, desc, image, type, locale4Twitter Cards✅ PASSsummary_large_image5Canonical tag✅ PASSPresente en todas las páginas6Un solo H1 por página✅ PASSVerificado en todas las páginas7Jerarquía H1→H6 correcta⚠️ PARCIALSoporte salta de H1 a H38URLs semánticas⚠️ FAILSlugs con caracteres rotos y typos9Schema LocalBusiness✅ PASSCompleto con NAP, geo, horarios10Schema Product✅ PASSItemList + Product con pricing11Schema BreadcrumbList❌ FAILNo existe12Schema FAQPage❌ FAILNo existe13Alt text en imágenes✅ PASSTodas tienen alt descriptivo14Imágenes optimizadas (next/image)✅ PASSWebP, srcset, lazy loading15Width/height en imágenes⚠️ PARCIALFalta en imágenes de producto16Core Web Vitals estimados✅ PASSLiviano, CLS ~0, carga rápida17NAP consistente✅ PASSSchema = footer18robots.txt correcto✅ PASSBloquea rutas privadas19sitemap.xml presente✅ PASS14 URLs con prioridades20SSR/SSG (indexable)✅ PASSApp Router con SSR21Viewport meta tag✅ PASSwidth=device-width22Sin scroll horizontal✅ PASSVerificado23Touch targets ≥48px⚠️ FAILVarios botones <44px24Texto ≥12px mobile⚠️ FAILTextos de 10px detectados25Blog/contenido SEO❌ FAILNo existe blog ni FAQ26Páginas individuales de producto❌ FAILNo existen

TOP 5 OPORTUNIDADES DE SEO LOCAL
1. Corregir los slugs rotos (URGENTE — impacto alto, esfuerzo bajo)
Las URLs con caracteres mal codificados (instituci-n-educativa-caracas) dañan la legibilidad, la indexación y la confianza del usuario. Corregir los slugs a formato limpio (/colegios/institucion-educativa-caracas) con redirecciones 301 desde las URLs antiguas. Esto es lo primero que debe hacerse.
2. Crear páginas individuales de producto (impacto muy alto)
Actualmente, un padre que busca "chompa azul uniforme Caracas Medellín" no encontrará este sitio porque ese producto no tiene URL propia. Crear rutas como /colegios/institucion-educativa-caracas/chompa-azul con su propio title, description y schema Product individual abriría cientos de long-tail keywords.
3. Implementar una sección de blog + FAQ (impacto alto para tráfico orgánico)
No hay contenido informativo. Artículos como "Guía de tallas de uniformes escolares en Medellín", "Calendario de compra de uniformes 2026", o "Cómo cuidar los uniformes escolares" capturarían búsquedas informacionales que luego convierten. Un FAQ con schema FAQPage sobre preguntas comunes (tiempos de entrega, cambios, personalización) generaría rich snippets en Google.
4. Agregar BreadcrumbList schema + navegación breadcrumb visual
Esto mejoraría la apariencia en SERPs (Google muestra breadcrumbs en vez de la URL fea) y la experiencia de usuario. Estructura: Inicio → Colegios → [Nombre Colegio] → [Producto].
5. Optimizar para Google Business Profile (GBP)
El schema LocalBusiness es sólido, pero falta un link directo al perfil de Google Business, reseñas de clientes con aggregateRating en el schema, y fotos del local físico. Un GBP bien optimizado con fotos, reseñas y posts regulares es la diferencia entre aparecer o no en el Local Pack de Google para "uniformes escolares cerca de mí".

ESTRATEGIA DE CONTENIDO SUGERIDA
Blog (publicar 2-4 artículos/mes):

"Guía completa de uniformes escolares para [Nombre Colegio] 2026" — una por cada colegio, con fotos, lista de prendas, tallas y precios. Posiciona para "uniformes [colegio]".
"Calendario escolar Medellín 2026: ¿cuándo comprar uniformes?" — captura búsquedas estacionales.
"Cómo tomar las medidas para uniformes escolares de niños" — contenido evergreen con alto volumen.
"Uniformes escolares económicos en Medellín: guía de precios 2026" — captura intent de compra.
"Barrio Boston, Medellín: tu zona de uniformes escolares" — refuerza el posicionamiento hiperlocal.

FAQ (página dedicada /preguntas-frecuentes con schema FAQPage):

¿Cuánto tiempo demora un pedido? / ¿Hacen envíos a domicilio? / ¿Qué métodos de pago aceptan? / ¿Pueden personalizar uniformes? / ¿Cuál es la política de cambios? / ¿Tienen uniformes para todos los colegios de Medellín?

Guías de tallas (página /guia-de-tallas):

Tabla visual con medidas en centímetros por prenda y edad. Posiciona para "tallas uniformes escolares Colombia". Incluir un video corto mostrando cómo medir a un niño.

Landing pages por zona:

/uniformes-escolares-boston-medellin, /uniformes-escolares-centro-medellin — para capturar búsquedas hiperlocales por barrio.


TABLA DE SCORES FINAL
Categoria CSVNota /10meta-tags8headings8url-structure4schema-org7image-alt7core-web-vitals8local-seo7sitemap-robots7ssr-indexability9mobile-friendly6GLOBAL (/100)71

Resumen ejecutivo: El sitio tiene una base técnica sólida — SSR con Next.js App Router, schema LocalBusiness completo, meta tags dinámicos y una arquitectura de catálogo por colegio que tiene sentido para el negocio. La nota de 71/100 refleja que los fundamentos están bien, pero hay oportunidades claras de mejora que podrían llevar este sitio a 85+ con esfuerzo moderado. Las prioridades inmediatas son: corregir los slugs rotos de las URLs (problema técnico que afecta indexación), crear páginas individuales de producto (multiplicaría las keywords indexadas por 10x), y lanzar contenido informativo (blog + FAQ) para capturar tráfico top-of-funnel. Para un negocio local en Medellín, el SEO local está bien encaminado con el schema, pero necesita Google Business Profile activo y reseñas para competir en el Local Pack.