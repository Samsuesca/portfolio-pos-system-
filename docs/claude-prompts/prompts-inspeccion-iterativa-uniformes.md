# Prompts de Inspeccion Iterativa — Uniformes Consuelo Rios

> **Workflow probado:** Prompt → Evaluacion → Corregir con Claude Code → Re-evaluar → Repetir
> Ya probado en API REST: 58.5 → 67 → 78/100 en 3 iteraciones.
>
> **Sistema de tracking:** `./docs/audits/scripts/audit-tracker.sh status`
> **Skill interno:** `/audit-improve --ingest <reporte.md>` para registrar evaluaciones

---

## AREA 0: API REST (Swagger /docs)

### 0A. API REST Architecture Audit

**Donde:** Swagger UI en /docs (produccion: yourdomain.com/docs)
**Antes:** Expandir TODOS los endpoints y grupos visibles, hacer scroll completo

```
Actua como un Senior API Architect con +15 anos de experiencia disenando APIs REST empresariales. Analiza exhaustivamente esta documentacion OpenAPI/Swagger visible en pantalla.

Evalua los siguientes aspectos con puntuacion de 1 a 10 y justificacion detallada:

1. **Diseno de URIs y Naming Conventions**: ¿Los endpoints siguen convenciones RESTful? ¿El versionado es correcto? ¿Los nombres de recursos son consistentes (plural/singular, kebab-case, etc.)?

2. **Estructura de recursos y verbos HTTP**: ¿Se usan correctamente GET, POST, PUT, PATCH, DELETE? ¿Hay violaciones del principio REST (ej: POST para obtener datos, verbos en las URIs)?

3. **Agrupacion y organizacion**: ¿Los tags/grupos de endpoints tienen sentido logico? ¿Hay acoplamiento innecesario entre modulos?

4. **Autenticacion y Seguridad**: ¿El esquema de auth es robusto? ¿Los endpoints sensibles estan protegidos (candado)? ¿Hay endpoints expuestos que no deberian estarlo?

5. **Consistencia y convenciones**: ¿Los patrones se repiten de forma uniforme en todos los modulos? ¿Hay inconsistencias en naming, estructura o respuestas?

6. **Completitud CRUD**: ¿Cada recurso tiene las operaciones necesarias? ¿Faltan endpoints obvios? ¿Sobran endpoints innecesarios?

7. **Paginacion, filtrado y ordenamiento**: ¿Los endpoints de listado soportan query params adecuados?

8. **Codigos de respuesta HTTP**: ¿Se documentan los codigos correctos (200, 201, 400, 401, 403, 404, 409, 422, 500)?

9. **Schemas y modelos de datos**: ¿Los request/response bodies estan bien definidos? ¿Se usan DTOs apropiados?

10. **Documentacion y Developer Experience (DX)**: ¿Las descripciones son claras? ¿Un dev nuevo entenderia la API sin ayuda extra?

IMPORTANTE:
- Navega y expande TODOS los endpoints y grupos visibles
- Revisa los schemas/modelos si estan disponibles abajo
- Haz scroll completo por toda la pagina
- Senala anti-patterns y code smells de diseno API
- Compara contra estandares como: JSON:API, OpenAPI best practices, Microsoft REST API Guidelines, Google API Design Guide

Al final entrega:
- Tabla resumen con las 10 categorias y sus notas
- Top 5 problemas criticos encontrados
- Top 5 fortalezas
- Nota global sobre 100
- Veredicto: ¿Esta API esta lista para produccion?
- Roadmap de mejoras priorizadas (quick wins vs cambios estructurales)

TABLA DE SCORES FINAL (copiar exactamente este formato):
| Categoria CSV       | Nota /10 |
|---------------------|----------|
| uri-design          |          |
| http-verbs          |          |
| organization        |          |
| auth-security       |          |
| consistency         |          |
| crud-completeness   |          |
| pagination-filtering|          |
| http-status-codes   |          |
| schemas-models      |          |
| documentation-dx    |          |
| GLOBAL (/100)       |          |
```

---

## AREA 1: PORTAL WEB — E-Commerce (Next.js 14)

### 1A. Conversion Funnel Audit

**Donde:** yourdomain.com (llegar como usuario nuevo)
**Antes:** Borrar cookies, abrir en incognito

```
Actua como un CRO (Conversion Rate Optimization) Specialist con experiencia en e-commerce de nicho educativo en Latinoamerica. Benchmark: 2-4% CR para tiendas de uniformes.

Vas a recorrer el sitio como un padre colombiano que necesita comprar uniformes para su hijo que entra a un colegio. NO conoces la tienda.

RECORRE Y DOCUMENTA CADA PASO:

1. LANDING (primeros 5 segundos):
   - ¿Entiendo que es el sitio y que puedo hacer?
   - ¿Hay call-to-action claro?
   - ¿Se ven los colegios disponibles?
   - ¿La propuesta de valor es visible? (¿por que comprar aqui y no en otro lado?)

2. SELECCION DE COLEGIO:
   - ¿Como encuentro mi colegio?
   - ¿Cuantos clicks necesito?
   - ¿Que pasa si mi colegio no esta listado?

3. CATALOGO:
   - ¿Veo todos los productos disponibles?
   - ¿Las fotos son profesionales y muestran el uniforme real?
   - ¿Los precios son visibles sin hacer click?
   - ¿Puedo filtrar por tipo de prenda, talla, genero?

4. DETALLE DE PRODUCTO:
   - ¿Hay guia de tallas?
   - ¿Se ve disponibilidad de stock?
   - ¿Puedo seleccionar talla y cantidad facilmente?

5. CARRITO:
   - ¿Hay mini-cart o feedback visual al agregar?
   - ¿Puedo modificar cantidades?
   - ¿Veo el total actualizado?

6. REGISTRO/LOGIN:
   - ¿Cuantos campos pide el registro?
   - ¿Puedo usar Google Login?
   - ¿Puedo comprar sin registrarme?
   - ¿El flujo de verificacion (email/telefono) es claro?

7. CHECKOUT:
   - ¿Cuantos pasos tiene?
   - ¿Pide datos de estudiante (nombre, grado)?
   - ¿Hay opcion de entrega y recogida en tienda?
   - ¿Las zonas de entrega son claras?

8. PAGO:
   - ¿Que metodos hay? (Wompi, Nequi, PSE, tarjeta, efectivo en tienda)
   - ¿Se siente seguro?
   - ¿Hay sello de seguridad visible?

9. CONFIRMACION:
   - ¿Recibo confirmacion visual inmediata?
   - ¿Me llega email?
   - ¿Puedo consultar el estado de mi pedido despues?

10. POST-COMPRA:
    - ¿Hay pagina de "mis pedidos"?
    - ¿Puedo contactar a la tienda facilmente?
    - ¿Hay WhatsApp visible?

PARA CADA PASO califica 1-10 y mide:
- Friccion (¿cuantos clicks/campos innecesarios?)
- Claridad (¿entiendo que hacer sin pensar?)
- Confianza (¿me siento seguro de que mi pedido llegara?)

ENTREGA:
- Funnel con % estimado de abandono por paso
- Top 3 "momentos de muerte" donde el usuario se va
- Top 5 quick wins que mejorarian la conversion
- Top 3 cambios estructurales necesarios
- Comparacion con MercadoLibre, Falabella.com.co, o Jumbo.com.co
- Nota global de conversion /10

TABLA DE SCORES FINAL (copiar exactamente este formato):
| Categoria CSV        | Nota /10 |
|----------------------|----------|
| landing-clarity      |          |
| school-selection     |          |
| catalog-ux           |          |
| product-detail       |          |
| cart-checkout        |          |
| registration         |          |
| payment-flow         |          |
| confirmation         |          |
| mobile-ux            |          |
| trust-credibility    |          |
| GLOBAL (/100)        |          |
```

---

### 1B. Mobile-First Audit

**Donde:** yourdomain.com en movil (o Chrome DevTools responsive)
**Antes:** Abrir en modo movil (375px) — el 70%+ de padres accedera desde celular

```
Actua como un Mobile UX Expert. El 70% de los padres colombianos van a acceder a este portal desde un celular Android (Samsung Galaxy A-series, Motorola G-series). Evalua la experiencia mobile.

EVALUA EN PANTALLA DE 375px:

1. **Velocidad percibida**: ¿La pagina carga rapido en 4G? ¿Hay skeleton loaders? ¿Las imagenes se cargan progresivamente?

2. **Touch targets**: ¿Los botones son >=44px? ¿Los links tienen suficiente espacio entre ellos? ¿Puedo tocar el boton correcto sin error?

3. **Navegacion mobile**: ¿Hay hamburger menu? ¿Es facil de abrir/cerrar? ¿Puedo volver atras siempre?

4. **Formularios en mobile**: ¿Los inputs usan el teclado correcto? (numerico para telefono, email para email) ¿Los labels no se cortan? ¿Puedo ver lo que escribo sin que el teclado tape el input?

5. **Imagenes**: ¿Las fotos de productos se ven bien en pantalla pequena? ¿Puedo hacer zoom? ¿Hay carrusel funcional?

6. **Scroll**: ¿El scroll es suave? ¿Hay scroll horizontal no deseado? ¿Los elementos se adaptan al ancho?

7. **Checkout mobile**: ¿El proceso de pago es factible en movil? ¿Los pasos son claros? ¿Puedo pagar con Nequi (redirect y volver)?

8. **WhatsApp**: ¿Hay boton flotante de WhatsApp? ¿Funciona correctamente en mobile?

9. **Fuentes y legibilidad**: ¿El texto es legible sin hacer zoom? ¿Min 16px para body text?

10. **Performance**: ¿Hay lazy loading? ¿Las imagenes estan optimizadas (WebP)? ¿Cuanto pesa la pagina?

ENTREGA:
- Screenshot conceptual de cada problema encontrado
- Top 10 problemas mobile ordenados por impacto
- Checklist de mobile-first compliance
- Nota de experiencia mobile /10

TABLA DE SCORES FINAL (copiar exactamente este formato):
| Categoria CSV      | Nota /10 |
|--------------------|----------|
| load-speed         |          |
| touch-targets      |          |
| navigation         |          |
| forms              |          |
| images             |          |
| scroll-layout      |          |
| checkout-mobile    |          |
| whatsapp-cta       |          |
| readability        |          |
| performance        |          |
| GLOBAL (/100)      |          |
```

---

### 1C. SEO & Discoverability Audit

**Donde:** yourdomain.com — inspeccionar HTML (View Source, DevTools)
**Antes:** Abrir DevTools → Elements

```
Actua como un SEO Specialist enfocado en negocios locales colombianos. Un padre busca en Google: "uniformes colegio san jose bogota" o "donde comprar uniformes escolares".

EVALUA:

1. **Meta tags**: ¿Hay title y description unicos por pagina? ¿Incluyen keywords relevantes?

2. **Headings**: ¿La jerarquia H1-H6 es correcta? ¿Solo un H1 por pagina?

3. **URL structure**: ¿Las URLs son semanticas? (ej: /colegios/san-jose vs /products?school=abc123)

4. **Schema.org**: ¿Hay structured data? (Product, LocalBusiness, Organization, BreadcrumbList)

5. **Imagenes**: ¿Tienen alt text descriptivo? ¿Nombres de archivo semanticos?

6. **Rendimiento**: ¿Core Web Vitals estimados? (LCP, FID, CLS) — esto afecta ranking

7. **Google My Business**: ¿El sitio esta preparado para Local SEO? ¿Hay direccion, telefono, horarios en schema?

8. **Sitemap y robots.txt**: ¿Existen? ¿Estan correctos?

9. **Contenido indexable**: Next.js con App Router — ¿Esta usando SSR/SSG o solo CSR? ¿Google puede indexar el catalogo?

10. **Mobile-friendliness**: ¿Pasaria el test de mobile-friendly de Google?

KEYWORDS OBJETIVO que deberian estar posicionando:
- "uniformes escolares [ciudad]"
- "uniformes colegio [nombre]"
- "comprar uniformes escolares online Colombia"
- "tienda de uniformes [barrio/zona]"

ENTREGA:
- Checklist SEO con pass/fail por criterio
- Top 5 oportunidades de SEO local
- Estrategia de contenido sugerida (blog, FAQ, guias de tallas)
- Nota SEO /10

TABLA DE SCORES FINAL (copiar exactamente este formato):
| Categoria CSV       | Nota /10 |
|---------------------|----------|
| meta-tags           |          |
| headings            |          |
| url-structure       |          |
| schema-org          |          |
| image-alt           |          |
| core-web-vitals     |          |
| local-seo           |          |
| sitemap-robots      |          |
| ssr-indexability     |          |
| mobile-friendly     |          |
| GLOBAL (/100)       |          |
```

---

## AREA 2: APP DESKTOP (Tauri + React)

### 2A. POS Efficiency Audit — Velocidad de venta

**Donde:** App Tauri, pantalla de nueva venta
**Antes:** Tener un colegio seleccionado y productos disponibles

```
Actua como un Retail Operations Consultant que optimiza tiempos de atencion en punto de venta. Has trabajado con cadenas de retail que procesan 200+ transacciones/dia por terminal.

CONTEXTO: Tienda de uniformes escolares. En temporada alta (enero-febrero), un vendedor puede hacer 60+ ventas por dia. Cada segundo cuenta.

MIDE EL FLUJO COMPLETO (cronometra mentalmente):

ESCENARIO 1 — Venta rapida (cliente sabe que quiere):
"Necesito una falda talla 12 azul y medias blancas M"
→ Mide: busqueda → agregar items → cobrar efectivo → recibo
→ Benchmark: <20 segundos, <8 clicks

ESCENARIO 2 — Venta consultiva (cliente necesita ayuda):
"Necesito el uniforme completo para mi hija que entra a 5to en el San Jose"
→ Mide: ver catalogo del colegio → mostrar opciones → elegir tallas → cobrar
→ Benchmark: <60 segundos, <15 clicks

ESCENARIO 3 — Venta multi-pago:
"Pago $30.000 en efectivo y el resto con Nequi"
→ Mide: split payment → confirmar ambos → recibo
→ Benchmark: <10 segundos extra vs pago unico

ESCENARIO 4 — Venta a credito con cliente registrado:
"Anoteme esto a mi cuenta, soy Maria Garcia CLI-0042"
→ Mide: buscar cliente → asignar → marcar credito → CxC automatica
→ Benchmark: <15 segundos extra

ESCENARIO 5 — Cambio de talla (post-venta):
"Me quedo grande la falda T14, necesito T12"
→ Mide: buscar venta original → crear cambio → verificar stock → aprobar
→ Benchmark: <45 segundos

EVALUA TAMBIEN:
- ¿Hay atajos de teclado? (F1-F12, Ctrl+N nueva venta, Enter confirmar)
- ¿La busqueda de productos es por codigo de barras? ¿Escaner?
- ¿Puedo ver ventas del dia sin salir de la pantalla de POS?
- ¿El selector de colegio es rapido? (no deberia tomar >2 clicks)

ENTREGA:
- Tabla de tiempos por escenario (actual vs benchmark)
- Top 5 cuellos de botella que alargan el tiempo de venta
- Propuesta de atajos de teclado
- Wireframe textual del layout ideal para POS de uniformes
- Nota de eficiencia operacional /10

TABLA DE SCORES FINAL (copiar exactamente este formato):
| Categoria CSV        | Nota /10 |
|----------------------|----------|
| product-search       |          |
| cart-management      |          |
| payment-flow         |          |
| speed-efficiency     |          |
| keyboard-shortcuts   |          |
| error-handling       |          |
| post-sale-flow       |          |
| multi-payment        |          |
| change-return        |          |
| receipt-printing     |          |
| GLOBAL (/100)        |          |
```

---

### 2B. Order Management Audit — Flujo de pedidos

**Donde:** App Tauri, seccion de pedidos/encargos
**Antes:** Navegar a la lista de pedidos

```
Actua como un Operations Manager de una fabrica/taller de confeccion que recibe pedidos personalizados. Evalua el modulo de gestion de pedidos (encargos).

CONTEXTO:
- Los encargos son uniformes que se confeccionan a medida o no estan en stock
- Flujo: Pendiente → En produccion → Listo → Entregado
- Cada item puede tener medidas personalizadas
- El cliente paga un anticipo al crear y el saldo al retirar
- Algunos pedidos vienen del portal web (padres online)

EVALUA:

1. **Creacion de pedido**:
   - ¿Puedo seleccionar productos del catalogo Y crear items personalizados?
   - ¿Las medidas personalizadas se capturan bien? (cintura, largo, cadera, etc.)
   - ¿Puedo registrar anticipo con metodo de pago?
   - ¿Se genera codigo de pedido automaticamente?

2. **Vista de lista y filtros**:
   - ¿Puedo filtrar por estado (pendiente, en produccion, listo)?
   - ¿Veo los pedidos de TODOS los colegios en una vista?
   - ¿Los pedidos web se distinguen visualmente de los de tienda?
   - ¿Puedo ver cuantos pedidos hay por estado de un vistazo? (badges/contadores)

3. **Gestion de estados por item**:
   - ¿Puedo marcar items individuales como "listo" sin marcar todo el pedido?
   - ¿El estado del pedido se sincroniza automaticamente con sus items?

4. **Demanda agregada**:
   - ¿Puedo ver cuantas "faldas T12 azul" necesito producir en total?
   - ¿Esto me ayuda a planificar compra de telas y produccion?

5. **Entrega y cobro final**:
   - ¿Al entregar, me pide cobrar el saldo pendiente?
   - ¿Actualiza inventario si el item era de catalogo?
   - ¿Se envia notificacion al cliente?

6. **Cambios en pedidos**:
   - ¿Puedo cambiar talla/producto despues de creado?
   - ¿El flujo de aprobacion de cambios es claro?
   - ¿Se recalculan totales automaticamente?

7. **Pedidos web**:
   - ¿Los pedidos del portal web aparecen aqui?
   - ¿Puedo aprobarlos, verificar stock, y procesarlos?
   - ¿El vendedor entiende que hacer con un pedido web?

8. **Notificaciones**:
   - ¿El cliente recibe avisos cuando su pedido cambia de estado?
   - ¿Hay alertas para el vendedor sobre pedidos urgentes o vencidos?

9. **Vista de produccion**:
   - ¿Hay una vista orientada al taller/costurera?
   - ¿Puedo imprimir ordenes de trabajo?

10. **Medidas personalizadas**:
    - ¿El formulario de medidas es completo y no ambiguo?
    - ¿Se guardan las medidas del estudiante para futuros pedidos?

ENTREGA:
- Mapa del flujo actual vs flujo ideal
- Top 5 puntos donde el vendedor se pierde o comete errores
- Sugerencias para dashboard de produccion (vista taller)
- Nota de gestion de pedidos /10

TABLA DE SCORES FINAL (copiar exactamente este formato):
| Categoria CSV            | Nota /10 |
|--------------------------|----------|
| order-creation           |          |
| order-list-filters       |          |
| item-status-tracking     |          |
| demand-aggregation       |          |
| delivery-payment         |          |
| order-changes            |          |
| web-orders-integration   |          |
| notifications            |          |
| production-view          |          |
| custom-measurements      |          |
| GLOBAL (/100)            |          |
```

---

### 2C. Desktop UI Consistency Audit

**Donde:** App Tauri — todas las pantallas
**Antes:** Navegar por ventas, pedidos, clientes, inventario, contabilidad, configuracion

```
Actua como un Senior React Architect y Design System Lead que audita consistencia visual y calidad de componentes en aplicaciones empresariales. Has construido design systems para apps con 20+ pantallas.

CONTEXTO: App desktop (Tauri + React + Tailwind v4) para gestion de uniformes escolares. Multiples modulos: ventas, pedidos, clientes, inventario, contabilidad, nomina, workforce.

NAVEGA TODAS LAS PANTALLAS y evalua:

1. **Consistencia visual**: ¿Los componentes se ven iguales entre modulos? ¿Los botones, cards, badges, tablas, modales usan el mismo estilo en todas partes? ¿Hay pantallas que parecen de otra app?

2. **Layout y spacing**: ¿El spacing es consistente? ¿Hay modulos con padding diferente? ¿Las grids se alinean? ¿El contenido respira o esta apretado?

3. **Color y tipografia**: ¿La paleta de colores es coherente? ¿Los colores de marca se usan consistentemente? ¿La tipografia (font-size, weight, line-height) es uniforme? ¿Los estados (success, error, warning, info) siempre usan los mismos colores?

4. **Feedback y estados**: ¿Loading states son consistentes? (spinners, skeletons, disabled states) ¿Los mensajes de exito/error se muestran siempre igual? (toasts, alerts, inline) ¿Empty states tienen mensaje util o se ve un vacio?

5. **Tablas y listas**: ¿Todas las tablas usan el mismo componente? ¿Headers, filas, hover, seleccion se comportan igual? ¿La paginacion es identica en todos los modulos?

6. **Formularios y validacion**: ¿Los inputs, selects, date pickers son del mismo componente? ¿La validacion muestra errores de la misma forma? ¿Los labels estan posicionados igual?

7. **Navegacion**: ¿El sidebar/nav es claro? ¿El breadcrumb funciona? ¿El usuario siempre sabe donde esta? ¿El cambio de colegio es visible y prominente?

8. **Modales y dialogs**: ¿Los modales tienen tamano consistente? ¿Se abren/cierran igual? ¿Los de confirmacion (eliminar, cancelar) siguen el mismo patron?

9. **Rendimiento de renderizado**: ¿Hay pantallas que se sienten lentas al navegar? ¿Se nota re-render excesivo? ¿Las listas grandes usan virtualizacion?

10. **Dark mode / Tema**: ¿Hay soporte de dark mode? ¿Si existe, es completo o parcial? ¿Los colores se adaptan bien?

ENTREGA:
- Inventario de inconsistencias entre modulos (tabla: modulo | componente | inconsistencia)
- Screenshot conceptual de los peores offenders
- Propuesta de tokens de design system (colores, spacing, tipografia)
- Nota de consistencia UI /10

TABLA DE SCORES FINAL (copiar exactamente este formato):
| Categoria CSV         | Nota /10 |
|-----------------------|----------|
| visual-consistency    |          |
| layout-spacing        |          |
| color-typography      |          |
| feedback-states       |          |
| tables-lists          |          |
| forms-validation      |          |
| navigation            |          |
| modals-dialogs        |          |
| render-performance    |          |
| dark-mode             |          |
| GLOBAL (/100)         |          |
```

---

## AREA 3: SEGURIDAD

### 3A. OWASP API Top 10 Audit

**Donde:** Swagger UI (/docs)
**Antes:** Expandir todos los endpoints, especialmente Portal y Auth

```
Actua como un Application Security Engineer con certificacion OSCP y experiencia auditando APIs REST en produccion. Analiza esta API usando el framework OWASP API Security Top 10 (2023).

PARA CADA CATEGORIA, lista endpoints especificos vulnerables:

API1:2023 — Broken Object Level Authorization (BOLA):
- Lista TODOS los endpoints con UUIDs en path ({user_id}, {sale_id}, {order_id}, etc.)
- ¿Cuales podrian permitir acceso a recursos de otro tenant simplemente cambiando el UUID?
- ¿Los endpoints /api/v1/sales/{sale_id} validan que la venta pertenezca al school del usuario?
- ¿Los endpoints globales (/global/...) validan permisos elevados?

API2:2023 — Broken Authentication:
- ¿El login tiene rate limiting? (dice 5/min/IP — ¿es suficiente?)
- ¿Hay refresh token o solo access token de 24h?
- ¿Los endpoints de password reset son abusables? (email enumeration)
- ¿El portal de clientes tiene su propio esquema de auth? ¿Esta documentado?

API3:2023 — Broken Object Property Level Authorization:
- ¿El UserUpdate schema permite cambiar is_superuser?
- ¿El ClientUpdate permite cambiar client_type de "regular" a "web"?
- ¿El SaleUpdate permite cambiar status directamente?
- ¿Los schemas de update exponen campos que solo admins deberian poder modificar?

API4:2023 — Unrestricted Resource Consumption:
- ¿Los endpoints de listado tienen limites maximos razonables?
- ¿Los uploads (imagenes, documentos) tienen limite de tamano documentado?
- ¿El endpoint de busqueda podria causar full table scan?
- ¿Las operaciones bulk tienen limite?

API5:2023 — Broken Function Level Authorization:
- Lista endpoints que mencionan "superuser only" o "ADMIN role" — ¿Estan todos protegidos?
- ¿POST /api/v1/portal/orders realmente valida algo sin auth?
- ¿GET /api/v1/contacts/by-email expone datos sin auth?
- ¿Los endpoints /global/ validan que el usuario tiene rol en al menos un colegio?

API6:2023 — Unrestricted Access to Sensitive Business Flows:
- ¿Se puede crear ordenes masivamente sin limite desde el portal?
- ¿Se puede registrar clientes ilimitadamente?
- ¿Se puede intentar login infinitamente para otros endpoints (no solo /login)?

API7:2023 — Server Side Request Forgery (SSRF):
- ¿Algun endpoint acepta URLs externas? (image_url, redirect_url, webhook)
- ¿El campo logo_url de schools acepta cualquier URL?

API8:2023 — Security Misconfiguration:
- ¿El /health endpoint expone informacion del servidor? (versiones, memoria, disco)
- ¿Hay endpoints de debug o test en produccion?
- ¿Los errores 500 exponen stack traces?

API9:2023 — Improper Inventory Management:
- ¿Hay endpoints deprecated que siguen activos?
- ¿Todas las versiones de la API estan documentadas?

API10:2023 — Unsafe Consumption of APIs:
- ¿El webhook de Wompi valida signatures?
- ¿El Google OAuth valida el id_token correctamente?

FORMATO POR HALLAZGO:
| Severidad | OWASP ID | Endpoint | Riesgo | Mitigacion |
|-----------|----------|----------|--------|------------|

ENTREGA:
- Matriz de riesgos (impacto vs probabilidad)
- Top 10 hallazgos ordenados por severidad
- Plan de remediacion priorizado (1 dia, 1 semana, 1 mes)
- Nota de seguridad /10

TABLA DE SCORES FINAL (copiar exactamente este formato):
| Categoria CSV              | Nota /10 |
|----------------------------|----------|
| bola-api1                  |          |
| broken-auth-api2           |          |
| property-auth-api3         |          |
| resource-consumption-api4  |          |
| function-auth-api5         |          |
| sensitive-flows-api6       |          |
| ssrf-api7                  |          |
| misconfiguration-api8      |          |
| inventory-api9             |          |
| unsafe-consumption-api10   |          |
| GLOBAL (/100)              |          |
```

---

## AREA 4: PERFORMANCE

### 4A. API Performance Profiling

**Donde:** Swagger UI
**Antes:** Revisar especialmente endpoints de listados, reportes, y dashboards

```
Actua como un Performance Engineer que optimiza APIs para soportar 100+ usuarios concurrentes. Sin acceso al codigo, analiza los endpoints para predecir bottlenecks.

CLASIFICA CADA ENDPOINT en: bajo riesgo | medio | alto riesgo de performance

BUSCA ESTOS PATTERNS:

1. **N+1 queries**:
   - GET /sales/{id}/details → carga sale + items + products + client + payments
   - GET /orders/{id} → carga order + items + garment_types + client + payments
   - GET /products?with_stock=true&with_images=true → ¿cuantos JOINs?

2. **Aggregations costosas**:
   - GET /orders/demand → agrega por garment_type+size+color de TODAS las ordenes activas
   - GET /global/accounting/patrimony-summary → suma inventario + CxC + CxP + activos
   - GET /global/reports/profitability/by-school → calcula COGS por escuela
   - GET /cfo-dashboard/health-metrics → ¿cuantas queries ejecuta?

3. **Listados sin paginacion**:
   - ¿Cuales endpoints devuelven arrays sin limit?
   - ¿Que pasa cuando hay 10,000 ventas?

4. **Busquedas costosas**:
   - GET /clients/search?q=... → ¿LIKE %query%? ¿Full-text search?
   - GET /products/search/by-term?q=... → busca en code, name, size, color

5. **Endpoints de reporte**:
   - ¿Los dashboards se calculan en tiempo real o hay cache?
   - ¿Los reportes mensuales escanean toda la tabla de transactions?

6. **SSE y long-polling**:
   - GET /print-queue/subscribe → ¿cuantas conexiones SSE simultaneas soporta?
   - GET /auth/permissions-refresh?version=X → polling cada 60s x N usuarios

7. **Operaciones bulk**:
   - PATCH /products/bulk-update-costs → ¿limite de items?
   - POST /fixed-expenses/generate → genera N gastos en una transaccion

8. **Estrategia de caching**:
   - ¿Que endpoints serian candidatos a cache? ¿Hay headers Cache-Control?
   - ¿Los catalogos de productos cambian frecuentemente?

9. **Indices de BD inferidos**:
   - De los filtros disponibles (status, date_from, school_id, client_id), ¿que indices deberian existir?
   - ¿Los endpoints de busqueda sugieren necesidad de indices de texto?

10. **Carga concurrente**:
    - ¿Que pasa con 50 vendedores usando el POS simultaneamente?
    - ¿Los endpoints de contabilidad global compiten con las ventas?

ENTREGA:
- Mapa de calor de endpoints por riesgo
- Top 10 endpoints mas costosos
- Indices de BD que deberian existir (inferidos de los filtros)
- Estrategia de caching (que cachear, TTL sugerido)
- Nota de preparacion para escala /10

TABLA DE SCORES FINAL (copiar exactamente este formato):
| Categoria CSV        | Nota /10 |
|----------------------|----------|
| n-plus-1-queries     |          |
| aggregation-cost     |          |
| unpaginated-lists    |          |
| search-cost          |          |
| report-endpoints     |          |
| sse-long-polling     |          |
| bulk-operations      |          |
| caching-strategy     |          |
| db-indexes           |          |
| concurrent-load      |          |
| GLOBAL (/100)        |          |
```

---

## AREA 5: PRODUCTO Y NEGOCIO

### 5A. Product-Market Fit Audit

**Donde:** Swagger + Portal web + App (todo el sistema)
**Antes:** Revisar el sistema completo

```
Actua como un Product Manager de SaaS vertical para retail en Latinoamerica. Has evaluado productos como Treinta, Siigo, Alegra, Bold (Colombia), y Uala Bis (Argentina).

CONTEXTO:
- Sistema POS + ERP para tienda de uniformes escolares en Colombia
- 4+ colegios como clientes/tenants
- App desktop para vendedores + portal web para padres
- Modulos: ventas, pedidos, inventario, contabilidad, nomina, workforce, alertas

EVALUA:

1. **Validacion del problema**: ¿El sistema resuelve un problema real? ¿Que dolor tenia el dueno del negocio ANTES de este sistema? ¿Lo resuelve completamente?

2. **Cobertura funcional**: ¿Hay features que sobran? ¿Hay gaps criticos? ¿El modulo de workforce (asistencia, checklists, performance reviews) es necesario para una tienda de 5-10 empleados?

3. **Balance complejidad/simplicidad**: ¿El sistema es demasiado complejo para el tamano del negocio? ¿Un vendedor con educacion bachiller puede usarlo sin capacitacion extensa?

4. **Diferenciacion**: ¿Que tiene este sistema que NO tiene Siigo + Excel + WhatsApp (que es lo que usa el 90% de PYMES colombianas)?

5. **SaaS readiness**: Si el dueno quisiera vender este software a OTRAS tiendas de uniformes en Colombia, ¿esta listo? ¿Que faltaria?

6. **Temporalidad/estacionalidad**: El negocio de uniformes es altamente estacional (enero-febrero). ¿El sistema refleja esto? ¿Hay features para temporada alta vs baja?

7. **Oportunidades perdidas**: ¿Listas por grado? ¿Uniformes usados? ¿Reserva anticipada? ¿Integracion con colegios?

8. **Monetizacion**: ¿Podria esto ser un SaaS multi-cliente? ¿Cual seria el pricing?

9. **Retencion de usuario**: ¿El vendedor QUIERE usar el sistema cada dia o lo ve como una carga? ¿Hay funcionalidad que lo haga adictivo?

10. **Moat competitivo**: ¿Que tan facil es para un competidor copiar esto? ¿Hay network effects? ¿Data moats?

ENTREGA:
- Analisis FODA del producto
- Product-Market Fit score (Sean Ellis test)
- Roadmap de producto sugerido (6 meses)
- Modelo de negocio potencial si se convierte en SaaS
- Nota de madurez de producto /10

TABLA DE SCORES FINAL (copiar exactamente este formato):
| Categoria CSV          | Nota /10 |
|------------------------|----------|
| problem-validation     |          |
| feature-coverage       |          |
| complexity-balance     |          |
| differentiation        |          |
| saas-readiness         |          |
| seasonality            |          |
| missed-opportunities   |          |
| monetization           |          |
| user-retention         |          |
| competitive-moat       |          |
| GLOBAL (/100)          |          |
```

---

### 5B. Colombian Compliance Audit

**Donde:** Swagger UI, secciones de Accounting y Payments

```
Actua como un asesor empresarial colombiano especializado en PYMES del regimen simplificado y ordinario. Conoces las obligaciones con DIAN, Camara de Comercio, y normativa laboral.

EVALUA EL CUMPLIMIENTO:

1. **Facturacion electronica**: ¿El sistema genera factura electronica DIAN? ¿Tiene resolucion de numeracion? ¿Genera el XML UBL 2.1? Si NO, ¿que tan dificil seria integrarlo?

2. **IVA**: ¿El sistema maneja IVA (19%)? ¿Diferencia productos gravados de exentos? (uniformes escolares pueden tener tratamiento especial)

3. **Retencion en la fuente**: ¿Hay soporte para retenciones? ¿En compras a proveedores?

4. **Nomina electronica**: ¿El modulo de nomina genera el soporte de nomina electronica DIAN? ¿Calcula correctamente: salud (4%), pension (4%), ARL, caja de compensacion, SENA, ICBF?

5. **Informacion exogena**: ¿Se pueden exportar los datos necesarios para la declaracion de renta y la informacion exogena?

6. **Proteccion de datos (Ley 1581)**: ¿Hay politica de tratamiento de datos? ¿Consentimiento informado en el registro? ¿Derecho al olvido?

7. **Medios de pago y SFC**: ¿Wompi cumple con regulacion de la SFC? ¿Se reportan transacciones >$5M?

8. **Libros contables**: ¿Los registros del sistema servirian como libros auxiliares ante una inspeccion de la DIAN?

9. **NIIF para PYMES**: ¿El modelo contable sigue las NIIF? ¿Los estados financieros cumplen la estructura requerida?

10. **Reportes DIAN**: ¿Se puede generar la informacion necesaria para declaracion de renta, IVA, retefuente?

ENTREGA:
- Checklist de cumplimiento colombiano con pass/fail
- Riesgos fiscales actuales
- Prioridad de implementacion para facturacion electronica
- Nota de cumplimiento normativo /10

TABLA DE SCORES FINAL (copiar exactamente este formato):
| Categoria CSV              | Nota /10 |
|----------------------------|----------|
| facturacion-electronica    |          |
| iva-handling               |          |
| retencion-fuente           |          |
| nomina-electronica         |          |
| informacion-exogena        |          |
| proteccion-datos           |          |
| medios-pago-sfc            |          |
| libros-contables           |          |
| niif-pymes                 |          |
| dian-reportes              |          |
| GLOBAL (/100)              |          |
```

---

## AREA 6: ACCESIBILIDAD Y CALIDAD

### 6A. WCAG 2.2 Accessibility Audit

**Donde:** Portal web publico
**Antes:** Abrir DevTools, preparar para inspeccionar HTML

```
Actua como un Accessibility Auditor certificado en WCAG 2.2 AA. En Colombia, la Ley 1680 de 2013 y la Resolucion 1519 de 2020 exigen accesibilidad web para servicios publicos (y es buena practica para privados).

EVALUA CRITERIO POR CRITERIO (solo los mas impactantes):

PERCEIVABLE:
1. **1.1.1 Non-text Content**: ¿Todas las imagenes de productos tienen alt text? ¿Los iconos tienen aria-label?
2. **1.3.1 Info and Relationships**: ¿Los formularios usan <label> asociado? ¿Las tablas tienen <th>?
3. **1.4.3 Contrast**: ¿El texto sobre fondos de color cumple 4.5:1? Verificar especialmente botones y badges de estado
4. **1.4.4 Resize Text**: ¿Funciona al 200% de zoom sin perder contenido?

OPERABLE:
5. **2.1.1 Keyboard**: Navega TODO el flujo de compra solo con Tab/Enter/Esc. ¿Funciona?
6. **2.4.3 Focus Order**: ¿El orden de tabulacion es logico? ¿El focus no salta erraticamente?
7. **2.4.7 Focus Visible**: ¿Se ve claramente que elemento tiene focus?

UNDERSTANDABLE:
8. **3.1.1 Language**: ¿La pagina tiene lang="es"?
9. **3.3.1 Error Identification**: ¿Los errores de formulario se identifican claramente?
10. **3.3.2 Labels**: ¿Todos los inputs tienen label visible?

ENTREGA:
- Tabla WCAG con criterio | estado (pass/fail) | evidencia
- Top 5 problemas que afectan a mas usuarios
- Nota de accesibilidad /10

TABLA DE SCORES FINAL (copiar exactamente este formato):
| Categoria CSV          | Nota /10 |
|------------------------|----------|
| non-text-content       |          |
| info-relationships     |          |
| contrast               |          |
| resize-text            |          |
| keyboard-nav           |          |
| focus-order            |          |
| focus-visible          |          |
| language               |          |
| error-identification   |          |
| labels-inputs          |          |
| GLOBAL (/100)          |          |
```

---

## AREA 7: DATABASE (desde Swagger)

### 7A. Data Model Inference Audit

**Donde:** Swagger UI, seccion de Schemas al final
**Antes:** Scroll hasta los schemas, expandir los principales

```
Actua como un Senior Database Architect con experiencia en PostgreSQL y sistemas multi-tenant (row-level security, shared schema). Infiere el modelo de datos a partir de los schemas de la API.

A PARTIR DE LOS SCHEMAS, INFIERE Y EVALUA:

1. **Entity-relationships**: Dibuja el ER mental: schools, users, products, clients, sales, orders, inventory, accounting. ¿Las relaciones son correctas? ¿Hay entidades que faltan?

2. **Multi-tenant isolation**: ¿El school_id esta en TODAS las entidades que lo necesitan? ¿Hay riesgo de data leakage si falta un WHERE school_id=?

3. **Audit fields**: ¿Todas las entidades tienen created_at, updated_at, created_by? ¿Hay soft delete consistente (is_active)?

4. **Data types**: ¿Los campos monetarios son Decimal/Numeric (no float)? ¿Los IDs son UUID? ¿Las fechas diferencian date vs datetime vs timestamp?

5. **Indexes inferidos**: De los filtros de la API (status, date, school_id, client_id, code), ¿que indices deberian existir? ¿Hay filtros que sugieren full-table scans?

6. **Referential integrity**: ¿Las FKs son consistentes? ¿Que pasa si borro un school — cascada, restrict, o set null? ¿Un client puede existir sin school?

7. **Accounting model**: ¿El modelo contable soporta partida doble real? ¿Las transacciones son atomicas? ¿Los balances se recalculan o se almacenan?

8. **Enum strategy**: ¿Las enumeraciones (PaymentMethod, OrderStatus, AccountType) son DB enums, strings, o tablas de lookup?

9. **Scalability**: ¿El modelo escala a 100K ventas? ¿A 50 colegios? ¿Las tablas de alto volumen (sales, transactions, inventory_logs) estan preparadas para particionamiento?

10. **Normalization**: ¿Hay datos duplicados entre schemas? ¿Hay campos calculados que deberian ser derivados? ¿El nivel de normalizacion es apropiado?

ENTREGA:
- Diagrama ER inferido (en texto/mermaid)
- Indices que DEBEN existir para performance
- Riesgos de integridad de datos
- Nota del modelo de datos /10

TABLA DE SCORES FINAL (copiar exactamente este formato):
| Categoria CSV             | Nota /10 |
|---------------------------|----------|
| entity-relationships      |          |
| multi-tenant-isolation    |          |
| audit-fields              |          |
| data-types                |          |
| indexes                   |          |
| referential-integrity     |          |
| accounting-model          |          |
| enum-strategy             |          |
| scalability               |          |
| normalization             |          |
| GLOBAL (/100)             |          |
```

---

## COMO USAR ESTA COLECCION

### Workflow completo:

```
1. Elige un area (ej: security-owasp)
2. Abre la pagina correcta en Chrome (ej: /docs para API)
3. Activa Claude Chrome Extension
4. Pega el prompt correspondiente
5. Lee el reporte — copia la TABLA DE SCORES FINAL
6. En Claude Code: /audit-improve --ingest <reporte.md>
   (o pega el reporte directamente)
7. El skill registra scores via audit-tracker.sh y copia el reporte a history/
8. Genera plan de mejora: /audit-improve --plan <area>
9. Ejecuta fixes: /audit-improve --fix <area>
10. Vuelve al paso 2 y re-evalua
```

### Tracking de progreso:

```bash
# Ver estado de todas las areas
./docs/audits/scripts/audit-tracker.sh status

# Vista ejecutiva
./docs/audits/scripts/audit-tracker.sh dashboard

# Historial de un area
./docs/audits/scripts/audit-tracker.sh report api-rest

# Registrar evaluacion (interactivo)
./docs/audits/scripts/audit-tracker.sh add
```

### Orden recomendado de ejecucion:

1. **Seguridad** (3A) — riesgos reales en produccion
2. **Portal Web Mobile** (1B) — 70% de tus usuarios
3. **POS Efficiency** (2A) — productividad diaria del vendedor
4. **Portal Web Conversion** (1A) — ventas online
5. **Performance** (4A) — preparar para temporada escolar
6. **Compliance Colombia** (5B) — obligaciones fiscales
7. **Pedidos** (2B) — workflow de produccion
8. **API REST** (0A) — calidad tecnica
9. **SEO** (1C) — crecimiento organico
10. **Accesibilidad** (6A) — inclusion
11. **Product-Market Fit** (5A) — vision estrategica
12. **Data Model** (7A) — deuda tecnica
13. **UI Consistency** (2C) — polish
