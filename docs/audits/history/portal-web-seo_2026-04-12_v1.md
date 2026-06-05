AUDITORÍA SEO COMPLETA — yourdomain.com
Rol: SEO Specialist para negocios locales colombianos Fecha: 12 de abril de 2026 Objetivo: Posicionar para búsquedas tipo "uniformes colegio [nombre] [ciudad]" y "comprar uniformes escolares online"

1. META TAGS — ⚠️ PARCIAL (5/10)
Homepage:

<title>: "Uniformes Consuelo Rios - Portal de Clientes" → FAIL. El title no incluye keywords transaccionales. "Portal de Clientes" es lenguaje interno, no lo que busca un padre. Debería ser algo como "Uniformes Escolares en Medellín | Tienda Online — Consuelo Rios".
<meta description>: "Catalogo de uniformes escolares y pedidos online. Calidad y los mejores precios en uniformes escolares." → PARCIAL. Tiene keywords genéricas, pero falta la ciudad (Medellín), el barrio (Boston) y un CTA claro.
OG tags: presentes (title, description, image, type) → PASS.
Twitter card: present → PASS.
Canonical: NO existe → FAIL CRÍTICO. Sin canonical, Google puede indexar versiones duplicadas.
Páginas de colegio (ej: Institución Educativa Caracas):

Title dinámico: "Institución Educativa Caracas | Uniformes Consuelo Rios" → PASS — bien hecho, es único por colegio.
Description dinámica: "Catalogo de uniformes para Institución Educativa Caracas. Precios, tallas y pedidos online." → PARCIAL — falta la ciudad y keyword "uniformes escolares".
OG title/desc: NO son dinámicos — repiten el genérico del homepage → FAIL para social sharing.
2. HEADINGS — ✅ BIEN (7/10)
Homepage:

H1: "Calidad que se nota, precios que convienen" → FAIL semántico. El H1 es un slogan de marketing, no describe el contenido. Google necesita algo como "Uniformes Escolares en Medellín — Catálogo por Colegio".
H2: "Selecciona tu colegio" → OK como sección.
H3s: Cada colegio tiene su propio H3 → PASS, buena jerarquía.
Solo un H1 → PASS.
Páginas de colegio:

H1: "Institución Educativa Caracas" → PASS — correcto y único.
H3s: Nombres de productos (Blusa, Jean, etc.) → PASS pero saltan de H1 a H3 (falta H2) → FAIL estructura.
Solo un H1 → PASS.
Footer:

H4s para secciones (Puntos de Venta, Contacto, Ayuda) → PASS.
3. URL STRUCTURE — ❌ PROBLEMAS GRAVES (3/10)
Las URLs presentan múltiples errores críticos:

/instituci-n-educativa-caracas → El slug generator rompe la ñ y genera instituci-n en vez de institucion. Esto afecta directamente keywords porque un padre busca "institucion educativa caracas" no "instituci-n".
/instituci-n-educativa-alfonso-l-pez-pumarejo → Doble problema: instituci-n + l-pez (debería ser lopez). Las tildes se pierden y se rompe la palabra.
/buen-comiezo → Typo: debería ser buen-comienzo.
/institucion-educativa-hector-abad-gomes → Typo: debería ser gomez.
No hay prefijo semántico: las URLs están en raíz (/instituci-n-...) en vez de /colegios/institucion-educativa-caracas o /uniformes/colegio-caracas.
No hay URLs de producto individuales visibles — todo el catálogo se muestra en la misma página del colegio.
Los nombres de archivo de imágenes son UUIDs (499b95b0-9126-42cf-a83b-a39f78624efc.jpg) → desperdician señal SEO.
Impacto: Cuando alguien busca "uniformes institucion educativa caracas medellin", tu URL con instituci-n no matchea la query exacta.

4. SCHEMA.ORG — ❌ INEXISTENTE (0/10)
No hay ningún tipo de structured data en todo el sitio:

❌ LocalBusiness — NO existe
❌ Product — NO existe (y tienes productos con nombre, precio, disponibilidad, tallas)
❌ Organization — NO existe
❌ BreadcrumbList — NO existe
❌ FAQPage — NO existe
❌ No hay application/ld+json en ninguna página
Impacto: Sin schema de LocalBusiness, Google no puede mostrar tu negocio en el Knowledge Panel ni en Maps. Sin schema de Product, tus productos nunca aparecerán como rich snippets con precio y disponibilidad en los resultados de búsqueda. Esto es una de las mayores oportunidades perdidas.

5. IMÁGENES — ⚠️ PARCIAL (5/10)
Alt text:

Escudos de colegios: "Escudo Institución Educativa Caracas" → PASS — descriptivo.
Productos: "Delantal de cuadros", "Jean", "Tennis Nike Blanco" → PASS — tienen alt descriptivo.
Logo: "Uniformes Consuelo Rios" → PASS.
Nombres de archivo:

/uploads/school-logos/499b95b0-9126-42cf-a83b-a39f78624efc.jpg → FAIL. UUIDs no aportan nada a SEO. Debería ser escudo-institucion-educativa-caracas.jpg.
/uploads/global-garment-types/de2a7e22-.../img_20260408_132448_94e2096f.jpeg → FAIL. Timestamps de cámara + UUID. Debería ser delantal-cuadros-uniforme-escolar.jpg.
Optimización técnica:

Lazy loading en imágenes de producto: PASS.
width/height atributos: FAIL — 5 de 5 imágenes no tienen dimensiones explícitas. Esto causa CLS (layout shifts).
Formato: JPEG en vez de WebP/AVIF → oportunidad de mejora (Next.js Image puede optimizar automáticamente).
6. CORE WEB VITALS — ⚠️ ACEPTABLE (6/10)
Mediciones observadas:

FCP (First Contentful Paint): ~1,004ms → BUENO (umbral Google: <1.8s)
DOM Content Loaded: ~540ms → BUENO
Load Event: ~890ms → BUENO
Protocolo: HTTP/3 (h3) → EXCELENTE — estás en Vercel con QUIC.
Total transfer: ~469KB → ACEPTABLE
JS bundle: ~215KB → ACEPTABLE pero podría ser menor.
Problemas estimados:

CLS (Cumulative Layout Shift): Probablemente ALTO — las imágenes no tienen width/height, lo que causa saltos de layout cuando cargan. Esto es penalizable.
LCP (Largest Contentful Paint): El hero section del homepage no tiene imagen, depende de texto renderizado por JS (RSC streaming), así que el LCP depende de cuándo hidrata el JS.
Fuentes pre-cargadas (3 fonts) → PASS — buena práctica.
7. LOCAL SEO — ❌ MUY DÉBIL (2/10)
Lo que existe:

Dirección física en footer: "Calle 56 D #26 BE 04, Villas de San José, Boston - Barrio Sucre, Medellín, Antioquia" → PASS (visible al usuario).
Teléfono: +57 300 123 4567 → PASS.
Horarios: L-V 8:00-6:00, Sáb 9:00-2:00 → PASS.
Link a Google Maps → PASS.
Lo que FALTA (crítico):

❌ Schema LocalBusiness con dirección, teléfono, horarios, geo coordinates → FAIL CRÍTICO para Local Pack de Google.
❌ La dirección/teléfono/horarios NO están en el HTML inicial del homepage (se cargan por CSR) → Google probablemente NO los ve en el crawl.
❌ No hay página "Sobre Nosotros" o "Nuestra Tienda" con contenido local rico.
❌ No hay NAP (Name, Address, Phone) consistente en schema.
❌ No hay mención de "Medellín" en el title, H1, ni meta description del homepage.
❌ No hay páginas de ciudad/barrio ("uniformes-escolares-medellin", "uniformes-boston-medellin").
Esto significa que para la búsqueda "uniformes escolares Medellín" o "tienda de uniformes Boston Medellín", el sitio probablemente NO aparece.

8. SITEMAP Y ROBOTS.TXT — ❌ FALLO TOTAL (1/10)
robots.txt:

Existe en /robots.txt pero solo contiene comentarios de Vercel sobre content signals.
❌ NO tiene User-agent: *
❌ NO tiene Allow ni Disallow
❌ NO tiene referencia a Sitemap:
Básicamente es un archivo vacío de directivas funcionales.
sitemap.xml:

/sitemap.xml devuelve un 404 (redirige a "Colegio no encontrado") → FAIL CRÍTICO.
Sin sitemap, Google depende solo del crawling natural para descubrir tus páginas de colegio. Si no hay links internos claros o las URLs están rotas, muchas páginas podrían nunca indexarse.
9. SSR / INDEXABILIDAD — ⚠️ MIXTO (5/10)
Next.js App Router — Análisis de rendering:

Homepage (/):

HTML inicial: solo ~16KB con apenas estructura básica.
El H1, H2, catálogo de colegios, footer con dirección → NO están en el HTML inicial.
Se cargan via RSC (React Server Components) streaming — 7 chunks RSC.
Los nombres de colegios aparecen como payload RSC, no como HTML semántico.
Impacto: Googlebot renderiza JavaScript, PERO depende de la cola de rendering. Con RSC streaming, el contenido puede tardar en estar disponible. El footer con la dirección del negocio probablemente no se indexa.
Páginas de colegio (/instituci-n-educativa-caracas):

HTML inicial: ~296KB — contenido completo SSR'd.
H1, nombres de productos, precios → SÍ están en el HTML.
Title y meta description dinámicos → SÍ.
PASS — estas páginas sí son indexables.
Veredicto: Las páginas de colegio están bien (SSR completo), pero el homepage — la página más importante para SEO — es esencialmente una SPA que carga contenido via JS. Esto es un problema serio porque el homepage es donde debería concentrarse la autoridad para búsquedas genéricas como "uniformes escolares Medellín".

10. MOBILE-FRIENDLINESS — ✅ PROBABLEMENTE PASS (7/10)
Viewport meta tag: width=device-width, initial-scale=1 → PASS.
Layout responsive: La UI usa grid de 3 columnas en desktop que visualmente parece adaptable.
Touch targets: Los botones "Ver tallas" y cards de colegios parecen tener tamaño adecuado.
Font size: Legible.
Preocupaciones: Las imágenes sin width/height causarán layout shifts en móvil. No pude verificar al 100% la adaptación móvil por limitaciones de la herramienta, pero la estructura CSS (Tailwind/CSS Grid) sugiere que es responsive.
CHECKLIST SEO — PASS/FAIL
Criterio	Estado	Detalle
Title tag homepage	❌ FAIL	Sin keywords ni ciudad
Title tag colegios	✅ PASS	Dinámico con nombre de colegio
Meta description homepage	⚠️ PARCIAL	Falta ciudad y CTA
Meta description colegios	⚠️ PARCIAL	Falta ciudad
Canonical tag	❌ FAIL	No existe
H1 homepage	❌ FAIL	Es slogan, no keyword
H1 colegios	✅ PASS	Nombre del colegio
Jerarquía H1-H6	⚠️ PARCIAL	Salta H1→H3 en colegios
URLs semánticas	❌ FAIL	Slugs rotos (ñ, ó, typos)
Schema LocalBusiness	❌ FAIL	No existe
Schema Product	❌ FAIL	No existe
Schema BreadcrumbList	❌ FAIL	No existe
Alt text imágenes	✅ PASS	Descriptivos
Nombres archivo img	❌ FAIL	UUIDs y timestamps
Image width/height	❌ FAIL	Ninguna imagen tiene dimensiones
robots.txt funcional	❌ FAIL	Vacío de directivas
sitemap.xml	❌ FAIL	404
Homepage SSR	❌ FAIL	CSR — contenido no en HTML
Colegios SSR	✅ PASS	Full SSR
Viewport meta	✅ PASS	Correcto
HTTP/3	✅ PASS	Habilitado
Font preload	✅ PASS	3 fuentes pre-cargadas
Lazy loading imgs	✅ PASS	Implementado
TOP 5 OPORTUNIDADES DE SEO LOCAL (por impacto)
1. Implementar Schema.org LocalBusiness + Product (Impacto: ALTÍSIMO) Agrega JSON-LD en el <head> con schema LocalBusiness (nombre, dirección en Medellín, teléfono, horarios, geo coordinates) y Product en cada ficha de colegio (nombre del producto, precio, disponibilidad, imagen). Esto te posiciona para el Local Pack de Google y rich snippets de producto. Es la implementación con mayor ROI de toda la lista.

2. Arreglar las URLs y generar sitemap.xml (Impacto: ALTO) Tu slug generator necesita un fix urgente para normalizar caracteres especiales: ñ → n (sin guión), ó → o, etc. La URL ideal sería /colegios/institucion-educativa-caracas. Implementa next-sitemap para generar automáticamente sitemap.xml con todas las URLs de colegios. Agrega la referencia en robots.txt con las directivas User-agent y Sitemap.

3. SSR en Homepage + keywords geolocalizadas (Impacto: ALTO) El homepage necesita SSR completo (no CSR streaming para contenido principal). El H1 debería contener "Uniformes Escolares en Medellín". El title debería ser "Uniformes Escolares Medellín | Compra Online por Colegio — Consuelo Rios". La meta description debe mencionar Medellín, Boston, envío a domicilio. La dirección del footer debe estar en el HTML inicial.

4. Crear landing pages por colegio con contenido SEO (Impacto: MEDIO-ALTO) Cada página de colegio debería tener un párrafo de contexto: "Uniformes completos para la Institución Educativa Caracas en Medellín. Encuentra blusas, pantalones, medias y calzado aprobados por el colegio. Envío a domicilio en Medellín o recoge en nuestra sede de Boston." Esto crea contenido indexable rico en keywords long-tail.

5. Crear páginas de contenido (Blog/FAQ/Guías) (Impacto: MEDIO) Páginas como "/guia-tallas-uniformes-escolares", "/como-comprar-uniformes-online-medellin", "/faq" captarían búsquedas informacionales que eventualmente convierten. Un padre que busca "tallas uniformes escolares Colombia" podría llegar a tu guía y luego comprar.

ESTRATEGIA DE CONTENIDO SUGERIDA
Blog (2-3 artículos/mes): Artículos como "Cómo elegir la talla correcta de uniforme escolar", "Lista completa de útiles y uniformes temporada 2026 Medellín", "Cuidado y lavado de uniformes para que duren todo el año". Cada artículo debe tener internal links hacia los catálogos de colegios.

FAQ Page (/preguntas-frecuentes): Preguntas reales que hacen los padres: tiempos de entrega, política de cambios, medios de pago, cómo hacer pedidos personalizados, qué hacer si el colegio no está en la lista. Implementar con schema FAQPage para ganar rich snippets.

Guías de Tallas (/guia-de-tallas): Tabla de medidas por edad/estatura con instrucciones de cómo medir. Esto resuelve una búsqueda transaccional real y reduce devoluciones. Ideal para captar tráfico de "tallas uniformes escolares niños Colombia".

Landing pages por zona (/uniformes-escolares-medellin, /uniformes-boston-medellin): Para captar búsquedas geo-localizadas. Cada una lista los colegios de esa zona con links a sus catálogos.

TABLA DE SCORES FINAL
Categoria CSV	Nota /10
meta-tags	5
headings	7
url-structure	3
schema-org	0
image-alt	5
core-web-vitals	6
local-seo	2
sitemap-robots	1
ssr-indexability	5
mobile-friendly	7
GLOBAL (/100)	41
Resumen ejecutivo: El sitio tiene una base técnica decente (Next.js App Router, HTTP/3, Vercel hosting, SSR en páginas de colegio) pero está desperdiciando casi todo su potencial SEO. Los problemas más graves son la ausencia total de Schema.org, URLs rotas por mal manejo de caracteres especiales, falta de sitemap/robots.txt, y la inexistencia de señales de Local SEO (no hay mención de Medellín en meta tags, no hay schema LocalBusiness). Para un negocio local que depende de búsquedas como "uniformes colegio [nombre] Medellín", estos gaps significan que probablemente estás invisible en Google para tus keywords objetivo. La buena noticia: con Next.js App Router + Vercel, todas estas mejoras son implementables de manera relativamente directa, y el impacto será inmediato.




