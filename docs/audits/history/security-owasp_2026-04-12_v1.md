🔒 AUDITORÍA DE SEGURIDAD — OWASP API Security Top 10 (2023)
API: Uniformes System API v2.0.0
Fecha: 12/04/2026
Auditor: Application Security Engineer (OSCP)
Superficie de ataque: 477 endpoints (437 autenticados, 40 públicos)
Arquitectura: Multi-tenant (school_id scoping), JWT Bearer 24h, Portal público para clientes

MATRIZ DE HALLAZGOS POR CATEGORÍA OWASP

API1:2023 — Broken Object Level Authorization (BOLA)
205 endpoints contienen parámetros UUID en el path. De estos, los más críticos son aquellos sin school_id en la ruta, ya que dependen enteramente de validación server-side para evitar acceso cross-tenant.
Endpoints sin school_id en path (BOLA de alto riesgo):
#EndpointRiesgo1GET/PUT/DELETE /api/v1/users/{user_id}Acceder/modificar/eliminar cualquier usuario cambiando UUID2GET /api/v1/users/{user_id}/schoolsEnumerar a qué schools tiene acceso otro usuario3POST /api/v1/users/{user_id}/reset-passwordResetear password de cualquier user si no valida ownership4PUT /api/v1/users/{user_id}/emailCambiar email de otro usuario5PUT /api/v1/users/{user_id}/superuserEscalar privilegios a superuser6GET/PATCH/DELETE /api/v1/clients/{client_id}Acceder datos de clientes de otro school7GET /api/v1/clients/{client_id}/summaryObtener resumen financiero de cliente ajeno8GET/PUT /api/v1/sales/{sale_id}Acceder/modificar ventas de otro tenant9GET /api/v1/sales/{sale_id}/detailsVer detalles de venta ajena10GET /api/v1/sale-changes/{change_id}/detailsVer cambios de venta de otro school11GET/PUT/PATCH /api/v1/orders/{order_id}Acceder/modificar órdenes de otro tenant12GET /api/v1/orders/{order_id}/detailsVer detalles de orden ajena13GET/PUT/DELETE /api/v1/documents/{document_id}Acceder documentos de otro school14GET /api/v1/payments/order/{order_id}Ver pagos de orden ajena (SIN AUTH)15GET /api/v1/payments/status/{reference}Consultar estado de pago ajeno (SIN AUTH)16GET /api/v1/payments/resolve/{wompi_id}Resolver pago ajeno (SIN AUTH)
¿Los endpoints /api/v1/sales/{sale_id} validan que la venta pertenezca al school del usuario? No se puede confirmar desde el schema. La ruta NO incluye school_id, lo que indica que la validación de tenancy depende enteramente del backend. Esto es un patrón anti-BOLA: si el server hace SELECT * FROM sales WHERE id = ? sin filtrar por school, es explotable.
¿Los endpoints /global/ validan permisos elevados? Todos los 70+ endpoints bajo /global/ declaran HTTPBearer en el OpenAPI spec, pero la descripción no siempre especifica que requieran superuser. Si la validación es solo "usuario autenticado", cualquier vendedor podría acceder a contabilidad global, KPIs financieros, y datos de nómina cross-school.

API2:2023 — Broken Authentication
SeveridadHallazgoDetalleALTARate limiting insuficiente en login5/min/IP es bypasseable con rotating proxies. No hay evidencia de lockout por cuenta ni CAPTCHA progresivo. Botnets con miles de IPs hacen este control irrelevante.ALTASin refresh token — JWT de 24hEl spec solo documenta un access token de 24 horas. No hay endpoint de refresh token. Un token robado da acceso completo por 24h sin posibilidad de revocación.ALTAPortal de clientes sin rate limiting documentadoPOST /portal/clients/login no menciona rate limiting. Un atacante podría hacer brute-force ilimitado contra cuentas de padres de familia.ALTAEmail enumeration en registro de portalPOST /portal/clients/register: "If email already exists, returns the existing client." Esto confirma explícitamente la existencia de emails, permitiendo enumeration masiva.MEDIAPassword reset sin rate limitingPOST /portal/clients/password-reset/request es público y no documenta rate limiting. Permite bombardeo de emails y enumeración.MEDIAGoogle OAuth — validación no documentadaGoogleLoginRequest acepta un id_token string. No se documenta si se valida el aud, iss, exp del token. Si solo se decodifica sin verificar firma con Google, es falsificable.MEDIAAuth del portal no documentadaEl portal tiene su propio flujo (register → verify → login) pero el schema de token, expiración, y scope no están documentados. No hay evidencia de que los tokens del portal estén aislados de los tokens admin.BAJAEndpoint legacy activo sin authPOST /portal/clients/verify-token/{token} está marcado como "legacy" pero sigue activo y público.

API3:2023 — Broken Object Property Level Authorization
SeveridadSchemaCampo peligrosoRiesgoCRÍTICAUserUpdateis_activeUn usuario podría desactivar su propia cuenta o, peor, si no se valida ownership, desactivar a otros usuarios. El schema no incluye is_superuser, lo cual es positivo: la escalación a superuser tiene su propio endpoint (PUT /users/{user_id}/superuser).ALTASaleUpdatestatus, client_id, payment_methodPermite cambiar el status de una venta directamente (ej: de pending a completed), reasignar a otro cliente, y cambiar método de pago. Debería ser controlado por workflow, no por field update directo.ALTAOrderUpdatestatusPermite cambiar el status de una orden directamente (ej: a in_production, delivered). Bypass del workflow de cambios de estado.ALTAEmployeeUpdatebase_salary, user_id, bank_accountUn empleado con acceso de escritura podría auto-asignar salario mayor, cambiar cuenta bancaria para redirigir pagos, o linkear otro user_id.MEDIAClientUpdateis_active, notification_preferenceNo incluye client_type (positivo), pero is_active permite desactivar clientes.MEDIASchoolUpdatelogo_urlAcepta URL externa arbitraria (hasta 2083 chars, formato URI). Vector SSRF potencial si el server fetches la URL.
¿ClientUpdate permite cambiar client_type? NO. El schema ClientUpdate no expone client_type. Este es un buen control.
¿UserUpdate permite cambiar is_superuser? NO. is_superuser tiene su propio endpoint dedicado (PUT /users/{user_id}/superuser), que debería requerir ser superuser. El UserUpdate solo expone username, email, full_name, password, is_active.

API4:2023 — Unrestricted Resource Consumption
SeveridadHallazgoDetalleALTALímites de paginación excesivos (500)Múltiples endpoints permiten limit=500: products, clients, sales, orders, order-changes, sale-changes, global inventory logs, garment-types, accounting transactions, expenses, email logs. Esto permite extraer la base de datos completa rápidamente.ALTAUploads sin límite de tamaño documentadoLos 5 endpoints de upload (school logo, garment images, global garment images, documents) usan binary sin maxLength ni documentación de límite. Un atacante podría subir archivos de GB para causar DoS por disco.ALTABúsqueda sin rate limiting12+ endpoints con parámetro search (products, clients, sales, orders, contacts, documents, global alterations, etc.) podrían causar full table scan con queries como %a%. Sin rate limiting, es un vector DoS.MEDIAListados sin paginaciónVarios endpoints no tienen paginación en absoluto: balance accounts, debts, fixed assets, global balance accounts, delivery zones, garment images, school users, custom roles. Retornan todos los registros.MEDIABulk operations sin límite documentadoPATCH /products/bulk-update-costs, POST /schedules/bulk, PUT /images/reorder no documentan límite en el array de items. Un request con 100K items podría causar timeout o DoS.MEDIAEndpoint de polling sin throttleGET /notifications/unread-count sugiere polling cada 30-60 segundos, pero no documenta rate limiting. Múltiples clientes podrían crear carga significativa.

API5:2023 — Broken Function Level Authorization
SeveridadEndpointRiesgoCRÍTICAPOST /api/v1/portal/ordersCrea órdenes SIN autenticación. Solo necesita un client_id (UUID). Cualquiera que obtenga o adivine un client_id puede crear órdenes fraudulentas a nombre de ese cliente.CRÍTICAGET /api/v1/contacts/by-emailExpone TODOS los mensajes PQRS de cualquier persona sin auth. Basta conocer un email para ver todas sus quejas, datos personales, y comunicaciones con el negocio.ALTAGET /api/v1/payments/order/{order_id}Sin auth. Expone información de pagos de cualquier orden solo con conocer el order_id.ALTAGET /api/v1/payments/status/{reference}Sin auth. Expone estado de pago por referencia.ALTAGET /api/v1/payments/resolve/{wompi_id}Sin auth. Resuelve pagos por Wompi transaction ID.ALTAPOST /api/v1/payments/sync-pendingSin auth. Permite sincronizar pagos pendientes. Podría ser usado para DoS o manipulación de estado.ALTAPOST /api/v1/payments/sessionsSin auth. Crea sesiones de pago arbitrarias con Wompi.ALTAGET /api/v1/global/products/{product_id}Sin auth. Expone detalles de productos globales incluyendo costos.ALTAGET /api/v1/global/products/{product_id}/inventorySin auth. Expone inventario global (competidores podrían espiar stock).ALTAGET /api/v1/global/inventory/low-stockSin auth. Expone productos con stock bajo — inteligencia competitiva.MEDIAGET /api/v1/schools (público)Lista todas las schools con datos. Info disclosure.MEDIAGET /api/v1/schools/{school_id}/summary (público)Expone resumen de cualquier school sin auth.MEDIAGET /api/v1/permissions/registry (público)Expone catálogo completo de permisos, roles del sistema, y constraint definitions. Facilita reconnaissance.
Endpoints "superuser only" identificados: POST /schools, PUT/DELETE /schools/{id}, POST /schools/{id}/activate, PUT /schools/reorder, POST/DELETE /schools/{id}/logo, POST/GET /users, DELETE /users/{id}, POST /users/{id}/reset-password, PUT /users/{id}/email, PUT /users/{id}/superuser, POST /products, global product CRUD. Todos declaran HTTPBearer pero la enforcement depende del backend.
¿Los endpoints /global/ validan rol? Las descripciones de algunos mencionan "requires ADMIN role" (ej: receivables/payables summary), pero la mayoría de endpoints globales (70+ endpoints de contabilidad, workforce, financial model) no especifican qué rol requieren. Si solo requieren autenticación, un vendedor de una school podría acceder a toda la contabilidad del negocio.

API6:2023 — Unrestricted Access to Sensitive Business Flows
SeveridadFlujoRiesgoCRÍTICACreación masiva de órdenes (portal)POST /portal/orders es público y no documenta rate limiting. Un atacante podría crear miles de órdenes falsas, colapsando el flujo operativo del negocio.ALTARegistro ilimitado de clientesPOST /portal/clients/register es público sin rate limiting documentado. Además, si el email ya existe, retorna el cliente existente (información gratuita + account enumeration).ALTACreación masiva de sesiones de pagoPOST /payments/sessions es público sin rate limiting. Podría generar miles de sesiones Wompi, incurriendo en costos o bloqueando el merchant account.MEDIAAbuso de envío de verificaciónPOST /portal/clients/verify-phone/send y verify-email/send son públicos. Sin rate limiting, se podrían usar como vectors de SMS/email bombing.MEDIAContacto/PQRS sin límitePOST /contacts/submit es público. Sin rate limiting, se podría spamear el sistema con miles de mensajes de contacto.

API7:2023 — Server Side Request Forgery (SSRF)
SeveridadEndpoint/CampoRiesgoALTAPUT /schools/{school_id} → logo_urlEl SchoolUpdate schema acepta cualquier URL (formato URI, hasta 2083 chars). Si el backend descarga/procesa esta URL (para generar thumbnails, validar imagen, etc.), es un vector SSRF directo. Un atacante podría apuntar a http://169.254.169.254/latest/meta-data/ (AWS metadata), http://localhost:PORT/, o servicios internos.MEDIABusinessInfoUpdate → maps_url, website_urlAcepta URLs arbitrarias. Si el server las verifica/fetches, es SSRF.MEDIAAbsenceCreate/Update → evidence_urlURLs de evidencia de ausencias. Si el server las procesa, vector SSRF.BAJAGarmentTypeResponse → image_urlCampo de respuesta que podría ser inyectado como URL maliciosa para XSS almacenado en el frontend.

API8:2023 — Security Misconfiguration
SeveridadHallazgoDetalleALTA/health expone info del servidorDescripción: "Comprehensive health check with DB, disk, and memory status." Expone estado de la DB, disco, y memoria sin autenticación. Un atacante obtiene: si la DB está caída (timing attacks), espacio en disco (para calibrar DoS por upload), y uso de memoria.MEDIASchema de error no documentadoErrorResponse se usa globalmente pero no se documenta si los errores 500 incluyen stack traces. En frameworks Python (FastAPI), el modo debug expone tracebacks completos por defecto.MEDIAInformación de contacto del desarrollador expuestaEl spec expone suescapsam@gmail.com como email de contacto. Facilita spear-phishing contra el developer.MEDIA40 endpoints públicos sin necesidad claraMuchos endpoints que exponen datos de negocio (inventario, productos, precios, stock) no deberían ser públicos en una API B2B.BAJACORS no documentadoNo hay documentación de CORS policy. Si está configurado como *, permite ataques CSRF desde cualquier dominio.

API9:2023 — Improper Inventory Management
SeveridadHallazgoDetalleMEDIAEndpoint legacy activoPOST /portal/clients/verify-token/{token} se describe como "legacy endpoint" pero sigue público y activo. Podría tener vulnerabilidades ya parcheadas en el endpoint nuevo.MEDIAVersión única sin versionado de deprecaciónSolo existe v1 (/api/v1/). No hay headers como Sunset, Deprecation, ni mecanismo de versionado futuro documentado.BAJAAPI spec v2.0.0 pero rutas v1La versión del OpenAPI es 2.0.0 pero todas las rutas usan /api/v1/. Posible confusión de versionado.

API10:2023 — Unsafe Consumption of APIs
SeveridadHallazgoDetalleALTAWebhook Wompi — validación de firma inciertaEl endpoint dice "Security is via Wompi's webhook signature validation" pero no documenta cómo se valida. Si no se valida el header X-Event-Checksum con el shared secret, cualquiera puede enviar webhooks falsos marcando pagos como exitosos — fraude directo.ALTAGoogle OAuth id_token — validación no documentadaSe acepta un id_token raw. No se especifica si se verifica la firma RSA contra las JWKS de Google, si se valida aud (client_id), iss (accounts.google.com), exp, y email_verified. Un token forjado o de otra app podría ser aceptado.MEDIAPayment resolve sin validaciónGET /payments/resolve/{wompi_id} es público. Si el sistema confía ciegamente en la respuesta de Wompi sin validar integrity, un MITM podría falsificar el estado del pago.

TABLA CONSOLIDADA DE HALLAZGOS
#SeveridadOWASP IDEndpointRiesgoMitigación1CRÍTICAAPI5POST /portal/ordersCreación de órdenes sin auth — fraude masivoRequerir auth del portal (JWT de cliente) o al mínimo un token de sesión2CRÍTICAAPI5GET /contacts/by-emailExposición total de PQRS de cualquier persona sin authRequerir autenticación; mover detrás del portal auth3CRÍTICAAPI6POST /portal/orders (masivo)Creación ilimitada de órdenes falsas — DoS operativoRate limiting (ej: 5 órdenes/hora por IP), CAPTCHA, auth obligatoria4CRÍTICAAPI1GET/PUT /sales/{sale_id} sin school_idAcceso cross-tenant a ventas cambiando UUIDValidar que sale.school_id pertenece al school del usuario autenticado5CRÍTICAAPI1GET/PUT/DELETE /orders/{order_id} sin school_idAcceso cross-tenant a órdenesValidar ownership por school_id6ALTAAPI5GET /payments/order/{order_id} (público)Exposición de datos de pago sin authRequerir autenticación7ALTAAPI5POST /payments/sessions (público)Creación arbitraria de sesiones de pagoRequerir auth o vincular a orden válida8ALTAAPI10POST /payments/webhooks/wompiFraude si no valida firma del webhookImplementar/verificar validación de X-Event-Checksum9ALTAAPI2Portal login sin rate limitingBrute force contra cuentas de clientesRate limiting 5/min/IP + lockout progresivo por cuenta10ALTAAPI2JWT 24h sin refresh tokenToken robado = acceso 24h irrevocableImplementar refresh tokens con access token de 15min11ALTAAPI3SaleUpdate.statusBypass de workflow de ventasRemover status del schema; usar endpoints de transición12ALTAAPI3OrderUpdate.statusBypass de workflow de órdenesRemover status del schema; usar endpoints de transición13ALTAAPI3EmployeeUpdate.base_salary/bank_accountAuto-escalación de salario o redirección de pagosRestringir campos sensibles a endpoint admin-only separado14ALTAAPI1GET/PUT/DELETE /users/{user_id} sin school_idBOLA en gestión de usuariosValidar que el usuario pertenece al mismo school o es superuser15ALTAAPI4Uploads sin límite de tamañoDoS por disco llenoImplementar límite de 5MB para imágenes, 50MB para documentos16ALTAAPI7SchoolUpdate.logo_urlSSRF contra infra internaValidar URL contra allowlist de dominios; no fetch server-side17ALTAAPI2Email enumeration en registroPOST /portal/clients/register confirma existenciaRespuesta genérica independiente de si el email existe18ALTAAPI5GET /global/inventory/low-stock (público)Inteligencia competitiva — stock visible sin authRequerir autenticación19ALTAAPI10Google OAuth sin validación documentadaPosible aceptación de tokens forjadosVerificar firma, aud, iss, exp, email_verified20MEDIAAPI8/health expone DB/disco/RAM sin authReconnaissance de infraestructuraProteger con auth o limitar a info no sensible21MEDIAAPI4limit=500 en 10+ endpointsExtracción masiva de datosReducir límite máximo a 10022MEDIAAPI6Registro ilimitado de clientesFlooding de registros falsosRate limiting + CAPTCHA23MEDIAAPI6SMS/email bombing via verify endpointsCostos y abuso de servicioRate limiting 3/hora por destino24MEDIAAPI5/global/ endpoints sin validación de rol claraVendedores podrían acceder a contabilidad globalDocumentar y enforce roles mínimos por endpoint25MEDIAAPI9Endpoint legacy /verify-token/{token} activoSuperficie de ataque innecesariaDesactivar o redirigir al endpoint nuevo26BAJAAPI8Contacto del developer en specSpear-phishing al developerRemover email personal del spec de producción

MATRIZ DE RIESGOS (Impacto vs Probabilidad)
IMPACTO ▲
         │
  ALTO   │  [17][22][23]        [9][10][15][16]     [1][2][3][4][5]
         │                       [13][18][19]         [8]
         │
  MEDIO  │  [25][26]            [20][21][24]          [6][7][11][12]
         │                                             [14]
         │
  BAJO   │                      [spec version]
         │
         └──────────────────────────────────────────────────► PROBABILIDAD
              BAJA                MEDIA                 ALTA

TOP 10 HALLAZGOS POR SEVERIDAD

CRÍTICA — POST /portal/orders sin auth → Fraude directo y DoS operativo
CRÍTICA — GET /contacts/by-email sin auth → Exposición masiva de datos personales y PQRS
CRÍTICA — BOLA en sales/orders sin school_id → Acceso cross-tenant a transacciones financieras
ALTA — Endpoints de payments públicos → Creación de sesiones de pago y consulta de datos financieros sin auth
ALTA — Webhook Wompi sin validación documentada → Fraude por webhooks falsificados
ALTA — JWT 24h sin refresh + portal sin rate limiting → Tokens irrevocables + brute force
ALTA — SaleUpdate/OrderUpdate exponen status → Bypass de workflows de negocio
ALTA — EmployeeUpdate expone base_salary y bank_account → Manipulación financiera interna
ALTA — Uploads sin límite de tamaño → DoS por consumo de disco
ALTA — SSRF potencial via logo_url → Acceso a metadata de cloud y servicios internos


PLAN DE REMEDIACIÓN PRIORIZADO
🔴 DÍA 1 (Emergencia — Producción en riesgo)

Agregar autenticación a POST /portal/orders — al menos vincular a sesión de cliente verificado
Proteger GET /contacts/by-email — requerir auth del portal o admin
Proteger endpoints de payments — al menos POST /sessions y GET /order/{id} necesitan auth o token de sesión
Validar webhook Wompi — confirmar que X-Event-Checksum se valida con integrity hash; si no, implementar inmediatamente
Agregar rate limiting a POST /portal/clients/login — mínimo 5/min/IP
Proteger /health — mover info sensible (DB, disco, RAM) a un endpoint autenticado

🟡 SEMANA 1 (Alta prioridad)

Auditar BOLA en todos los endpoints sin school_id — verificar que sales/{id}, orders/{id}, users/{id}, clients/{id}, documents/{id} validan ownership en el backend
Remover status de SaleUpdate y OrderUpdate — crear endpoints de transición de estado dedicados con validaciones de workflow
Restringir EmployeeUpdate — campos sensibles (salary, bank_account, user_id) solo modificables por ADMIN
Implementar refresh tokens — access token de 15 min + refresh token de 7 días con rotación
Corregir email enumeration en registro — respuesta genérica siempre
Implementar límites de tamaño en uploads — 5MB imágenes, 50MB documentos
Reducir limit máximo a 100 en todos los endpoints de listado
Rate limiting en endpoints de verificación (SMS/email) — 3/hora por destino

🟢 MES 1 (Hardening general)

Documentar y enforce roles en endpoints /global/ — mínimo ADMIN para contabilidad, workforce, financial model
Validar URLs server-side — allowlist para logo_url, maps_url, evidence_url; bloquear IPs privadas y metadata endpoints
Documentar validación de Google OAuth — verificar firma, aud, iss, exp, email_verified; documentar en spec
Agregar paginación a todos los endpoints de listado que no la tienen
Deprecar /verify-token/{token} — redirigir al endpoint nuevo
Proteger endpoints de productos/inventario globales — requieren al menos auth para evitar espionaje competitivo
Implementar rate limiting global — por IP y por usuario autenticado en todos los endpoints
Agregar límites a bulk operations — máximo 100 items por request
Remover info del developer del spec de producción
Auditar CORS configuration — asegurar allowlist de origins, no *


NOTA DE SEGURIDAD
3.5 / 10
Justificación: La API tiene una superficie de ataque significativamente expuesta. La presencia de endpoints críticos completamente públicos (creación de órdenes, consulta de datos personales, endpoints de pago) sin ninguna autenticación representa un riesgo inmediato de explotación. El modelo multi-tenant se ve debilitado por la cantidad de endpoints que no incluyen school_id en la ruta, dependiendo enteramente de validación backend no verificable. Los schemas de update exponen campos sensibles sin segregación por roles. Se observan algunos controles positivos: is_superuser aislado en endpoint dedicado, client_type no expuesto en update, y rate limiting documentado en login principal, pero son insuficientes frente a la magnitud de los hallazgos.

Este análisis se basa exclusivamente en el OpenAPI spec (análisis estático). Una auditoría de caja negra/gris con requests reales podría revelar hallazgos adicionales o confirmar que algunos controles existen en el backend pero no están documentados en el spec.