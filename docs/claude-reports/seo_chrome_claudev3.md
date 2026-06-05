AUDITORÍA SEO COMPLETA — yourdomain.com
Sitio: Uniformes Consuelo Rios | Next.js App Router
Nicho: Uniformes escolares en Medellín, Colombia
Fecha del análisis: 12 de abril de 2026

1. META TAGS — Nota: 7/10
Title tags: Cada página tiene un <title> único y descriptivo con keywords relevantes. La homepage usa "Uniformes Escolares en Medellin | Catalogo Online por Colegio — Consuelo Rios" (74 caracteres, bien). Las páginas de colegio usan el patrón "Uniformes [Nombre Colegio] en Medellin | Uniformes Consuelo Rios", lo cual es excelente para SEO local.
Meta description: Presente en todas las páginas revisadas. La homepage menciona "Compra uniformes escolares en Medellin", los colegios mencionan productos específicos. Longitudes adecuadas (~150 chars).
Open Graph: Completo (og:title, og:description, og:image, og:type, og:locale=es_CO). Twitter Card configurada como summary_large_image.
Canonical tags — PROBLEMA CRÍTICO: Las páginas de /encargos-personalizados y /pago tienen su canonical apuntando a la homepage (https://yourdomain.com/), lo cual le dice a Google que son duplicados de la homepage y NO las indexará como páginas independientes. Las páginas de colegio sí tienen canonicals correctos.
CriterioEstadoTitle único por página✅ PASSDescription única por página✅ PASSOpen Graph completo✅ PASSTwitter Card✅ PASSCanonical correcto❌ FAIL (encargos, pago apuntan a homepage)Keywords en titles✅ PASS

2. HEADINGS — Nota: 7/10
H1: Cada página tiene exactamente un H1 visible en el DOM renderizado. La homepage usa "Uniformes Escolares en Medellin" y cada colegio usa su nombre como H1.
Jerarquía: H1 → H2 → H3 es correcta. Los productos se listan como H3 bajo el H2 "Catálogo de Uniformes", y el footer usa H3/H4 para secciones de contacto.
Problemas detectados:
El H1 de la homepage tiene un error tipográfico en el HTML: "Uniformes Escolaresen Medellin" (falta el espacio antes de "en"). Aunque visualmente puede verse bien por estilos CSS (el "en Medellin" está en un <span> separado), en el texto raw que Google lee falta el espacio, y eso daña la keyword "uniformes escolares en medellin".
El sitio renderiza dos versiones de la misma página (mobile y desktop) simultáneamente en el DOM ocultando una con CSS. Esto crea contenido duplicado dentro de la misma página que Google puede detectar. También genera un espacio en blanco enorme al hacer scroll, perjudicando la UX.
CriterioEstadoUn solo H1 por página✅ PASS (en DOM renderizado)Jerarquía H1→H6 correcta✅ PASSKeywords en H1⚠️ PARCIAL (falta espacio en keyword principal)Contenido duplicado en DOM❌ FAIL (doble renderizado mobile/desktop)

3. URL STRUCTURE — Nota: 5/10
Formato actual: Las URLs de colegios usan slugs derivados del nombre, pero con problemas de encoding. Por ejemplo: /instituci-n-educativa-caracas en lugar del ideal /institucion-educativa-caracas. La "ó" de "Institución" simplemente se eliminó dejando "instituci-n", lo cual no es semántico ni legible.
También hay una URL con error ortográfico en el sitemap: /buen-comiezo (debería ser "comienzo").
No existen URLs individuales para productos (todo se muestra en la página del colegio). Esto significa que no hay landing pages para búsquedas como "chompa azul colegio caracas medellin".
No existe una estructura jerárquica /colegios/[nombre]/[producto] que sería ideal.
CriterioEstadoURLs semánticas❌ FAIL (encoding roto, tildes mal manejadas)URLs jerárquicas❌ FAIL (sin estructura /colegios/...)Sin parámetros query✅ PASSSin errores ortográficos❌ FAIL (/buen-comiezo)Páginas individuales de producto❌ FAIL (no existen)

4. SCHEMA.ORG — Nota: 8/10
Excelente implementación base. El sitio incluye:
Homepage: LocalBusiness con nombre, descripción, teléfono, email, dirección completa (PostalAddress), geocoordenadas, horarios de apertura (OpeningHoursSpecification para L-V y Sábado), priceRange, currenciesAccepted, paymentAccepted, y areaServed. Muy completo.
Páginas de colegio: LocalBusiness + ItemList con ListItem → Product para cada prenda. Cada producto incluye nombre con contexto ("[Producto] — [Colegio]"), descripción con localidad, imagen, y offers con precio y moneda.
Faltantes:
No hay BreadcrumbList schema (ni breadcrumbs visuales en la UI). Esto es una oportunidad perdida para rich snippets y navegación.
No hay Organization schema separado. No hay FAQPage schema. No hay aggregateRating ni review en productos.
CriterioEstadoLocalBusiness✅ PASS (completo con geo, horarios, pagos)Product schema✅ PASS (con offers y precios)ItemList✅ PASSBreadcrumbList❌ FAILFAQPage❌ FAIL (no existe)Review/Rating❌ FAIL

5. IMÁGENES — Nota: 6/10
Alt text: Todas las imágenes tienen alt text descriptivo. Los escudos de colegios usan "Escudo [Nombre Colegio]", las prendas usan el nombre del producto ("Chompa Azul", "Sudadera", etc.). Ninguna imagen carece de alt (0 sin alt de 25 en homepage).
Lazy loading: 23 de 25 imágenes usan loading="lazy", dejando correctamente las primeras 2 sin lazy (above the fold).
Nombres de archivo — PROBLEMA: Los archivos de producto usan nombres auto-generados como img_20260118_172852_41ef93b5.jpeg en lugar de nombres semánticos como chompa-azul-colegio-caracas.jpeg. Google usa los nombres de archivo como señal para Google Images.
Muchos productos sin foto real: La mayoría de las prendas muestran un ícono SVG placeholder en lugar de una fotografía real. Esto afecta la conversión, la confianza del usuario, y elimina la posibilidad de aparecer en Google Images.
CriterioEstadoAlt text presente✅ PASS (100%)Alt text descriptivo⚠️ PARCIAL (genérico, sin contexto de colegio)Nombres de archivo semánticos❌ FAILLazy loading✅ PASSFotos reales de producto❌ FAIL (mayormente placeholders)

6. CORE WEB VITALS (Estimados) — Nota: 7/10
Mediciones en entorno local (los valores en producción pueden variar):
TTFB: ~149ms — Excelente, indica SSR eficiente.
LCP: ~428ms — Excelente (umbral Google: <2.5s).
CLS: 0 — Perfecto (umbral Google: <0.1).
DOM Content Loaded: ~357ms — Muy bueno.
FID/INP: No medido directamente, pero con 25 scripts cargados y React hydration, podría haber cierta latencia en interactividad inicial.
Preocupaciones: 25 archivos JavaScript cargados es considerable. No hay preconnect configurado. Solo 4 preloads. El doble renderizado (mobile + desktop) en el DOM aumenta innecesariamente el peso del DOM.
CriterioEstadoLCP < 2.5s✅ PASSCLS < 0.1✅ PASSTTFB < 800ms✅ PASSJS bundle optimizado⚠️ PARCIAL (25 scripts)Preconnect/prefetch❌ FAIL

7. LOCAL SEO — Nota: 7/10
NAP (Name, Address, Phone): Presente en el footer de todas las páginas y en el schema LocalBusiness. Dirección completa: "Calle 56 D #26 BE 04, Villas de San José, Boston - Barrio Sucre, Medellín, Antioquia". Teléfono y email visibles.
Horarios: Incluidos tanto en el footer como en el schema (L-V: 8-6, Sáb: 9-2).
Google Maps: Link a Google Maps presente en el footer.
Geo: Coordenadas en schema (lat: 6.2518, lng: -75.5636).
Faltantes: No hay página "Sobre Nosotros" con historia del negocio local. No hay testimonios ni reseñas de clientes. No hay mención de barrios/zonas específicas de cobertura para envío. El areaServed solo dice "Medellin" — debería incluir barrios, comunas y municipios cercanos. No hay integración evidente con Google Business Profile.
CriterioEstadoNAP consistente✅ PASSSchema LocalBusiness✅ PASSHorarios✅ PASSGoogle Maps link✅ PASSGeocoordenadas✅ PASSBarrios/zonas en contenido❌ FAILPágina "Sobre Nosotros"❌ FAILReseñas/testimonios❌ FAIL

8. SITEMAP Y ROBOTS.TXT — Nota: 8/10
robots.txt: Bien configurado. Permite todo (Allow: /) y bloquea correctamente rutas privadas (/mi-cuenta, /pago, /registro, /recuperar-password). Apunta al sitemap correcto.
Sitemap.xml: Presente y funcional con 14 URLs, prioridades diferenciadas (homepage 1.0, colegios 0.8, encargos 0.5, soporte 0.3), changefreq apropiados, y lastmod actualizado.
Problemas: La página /pago está bloqueada en robots.txt Y en el sitemap no aparece (correcto), pero la página de información de métodos de pago (no el checkout) podría ser indexable para SEO. El sitemap no incluye páginas individuales de productos (que no existen aún). El sitemap tiene el slug con error /buen-comiezo.
CriterioEstadorobots.txt existe✅ PASSRutas privadas bloqueadas✅ PASSsitemap.xml existe✅ PASSPrioridades correctas✅ PASSlastmod actualizado✅ PASSCobertura completa⚠️ PARCIAL (sin páginas de producto)

9. SSR/INDEXABILIDAD — Nota: 8/10
Framework: Next.js con App Router (confirmado por scripts /_next/, streaming markers <!--$-->, y ausencia de #__NEXT_DATA__).
Server-Side Rendering: Confirmado. El contenido HTML viene pre-renderizado del servidor, incluyendo los schemas JSON-LD, meta tags, y contenido del catálogo. React Server Components con streaming están en uso.
Contenido indexable: Los catálogos de productos con nombres, precios y disponibilidad de tallas están presentes en el HTML inicial — Google puede indexarlos sin ejecutar JavaScript.
Problemas: El doble renderizado (mobile + desktop oculto con CSS) duplica contenido en el source HTML, lo cual no es ideal para crawl budget. No existen páginas individuales de producto, así que toda la información vive en una sola URL por colegio.
CriterioEstadoSSR activo✅ PASSContenido en HTML inicial✅ PASSSchema en server HTML✅ PASSCatálogo indexable✅ PASSPáginas individuales de producto❌ FAILDOM limpio (sin duplicados)❌ FAIL

10. MOBILE-FRIENDLINESS — Nota: 7/10
Viewport meta: Configurado correctamente (width=device-width, initial-scale=1).
Diseño responsive: El sitio se adapta bien a pantallas móviles. La navegación, las cards de colegios y el grid de productos se reorganizan para pantallas pequeñas.
Idioma: lang="es" configurado correctamente.
Problemas: El doble renderizado crea un espacio en blanco enorme entre secciones al hacer scroll — esto es un problema grave de UX mobile. La barra sticky del header se duplica visualmente al scrollear. No hay theme-color meta para personalizar la barra del navegador móvil.
CriterioEstadoViewport meta✅ PASSResponsive design✅ PASSTouch targets✅ PASSlang="es"✅ PASStheme-color❌ FAILUX de scroll❌ FAIL (espacio en blanco, sticky duplicado)

TOP 5 OPORTUNIDADES DE SEO LOCAL
1. Crear páginas individuales por producto con URLs semánticas. Cada prenda debería tener su propia URL tipo /uniformes/institucion-educativa-caracas/chompa-azul. Esto permitiría rankear para búsquedas long-tail como "chompa azul colegio caracas medellin precio" y multiplicaría las páginas indexables de ~14 a 200+.
2. Corregir los slugs de URLs y los canonicals. Los slugs como /instituci-n-educativa-caracas deben normalizarse a /institucion-educativa-caracas. Los canonicals de /encargos-personalizados y /pago deben apuntar a sí mismos, no a la homepage. Esto está literalmente impidiendo que Google indexe esas páginas.
3. Crear contenido enfocado en keywords locales. No existe un blog, FAQ, ni guías. Crear páginas como "Guía de tallas de uniformes escolares", "Uniformes escolares en Boston, Medellín", "Cómo elegir el uniforme correcto para tu hijo" capturaría tráfico informacional. También crear landing pages por barrio/zona: "Uniformes escolares cerca al barrio Sucre", "Tienda de uniformes en Boston Medellín".
4. Implementar BreadcrumbList schema y breadcrumbs visuales. Ruta tipo Inicio → Colegios → I.E. Caracas → Chompa Azul. Esto mejora la navegación, los rich snippets en Google, y el entendimiento de la estructura del sitio por parte del crawler.
5. Subir fotografías reales de todos los productos con nombres de archivo semánticos. La mayoría de productos muestran iconos placeholder. Tener fotos reales nombradas como chompa-azul-institucion-educativa-caracas-medellin.jpg abriría el canal de Google Images y mejoraría la conversión drásticamente.

ESTRATEGIA DE CONTENIDO SUGERIDA
Blog (publicación semanal/quincenal):
Artículos con keywords locales como "¿Cuántos uniformes necesita mi hijo para el año escolar?", "Guía de cuidado y lavado de uniformes escolares", "Calendario escolar Medellín 2026: cuándo comprar uniformes", "Diferencias entre uniformes de diario y de gala". Cada artículo debe incluir links internos a los catálogos de colegios relevantes.
FAQ (página dedicada con FAQPage schema):
Preguntas como: ¿Hacen envíos a domicilio?, ¿Cuánto demora un encargo personalizado?, ¿Cómo tomo las medidas de mi hijo?, ¿Qué pasa si la talla no es correcta?, ¿Tienen uniformes para todos los colegios de Medellín? Esto apunta directamente a los featured snippets de Google.
Guías de tallas (una por tipo de prenda):
Página interactiva con tabla de medidas, instrucciones visuales de cómo medir, y recomendaciones por edad/grado. Esto resuelve una necesidad real del padre que compra online y genera confianza. URL ideal: /guia-de-tallas.
Landing pages por colegio con contenido editorial:
Cada página de colegio debería tener un párrafo introductorio: "Encuentra todos los uniformes oficiales de la Institución Educativa Caracas en Medellín. Tenemos en stock chompas, camisetas, sudaderas, pantalones y calzado aprobados por la institución." Esto aporta contexto semántico para Google.

TABLA DE SCORES FINAL
Categoria CSVNota /10meta-tags7headings7url-structure5schema-org8image-alt6core-web-vitals7local-seo7sitemap-robots8ssr-indexability8mobile-friendly7GLOBAL (/100)70

Veredicto: El sitio tiene una base técnica sólida — SSR funciona, el schema LocalBusiness está muy bien implementado, los meta tags son únicos por página, y los Core Web Vitals estimados son buenos. Sin embargo, hay problemas críticos que frenan el posicionamiento: los canonicals rotos que impiden indexación de páginas clave, los slugs mal formados que dañan la semántica de las URLs, la ausencia total de contenido editorial (blog, FAQ, guías), y la falta de páginas individuales de producto que limita severamente el potencial de long-tail keywords. Corregir los canonicals y los slugs es lo más urgente — es un fix técnico relativamente pequeño con impacto inmediato. Luego, la estrategia de contenido y las fotos reales de producto transformarían este sitio de un catálogo funcional a una máquina de captura de tráfico orgánico local.