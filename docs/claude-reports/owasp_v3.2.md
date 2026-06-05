Auditoría de Seguridad — Uniformes System API v2.0.0
Framework: OWASP API Security Top 10 (2023)
Auditor: Application Security Engineer (OSCP) Target: Uniformes System API — REST multi-tenant (OpenAPI 3.1.0) Superficie: 363 endpoints, 45 tags funcionales, 29 endpoints públicos, 283 endpoints con UUIDs en path Fecha: 2026-04-12

API1:2023 — Broken Object Level Authorization (BOLA)
142 endpoints contienen IDs en path SIN school_id como contexto de tenant, lo cual los convierte en candidatos BOLA. Los más críticos:

Endpoints con UUID sin aislamiento de tenant explícito en path:

Los endpoints bajo /api/v1/sales/{sale_id}, /api/v1/orders/{order_id}, /api/v1/clients/{client_id} no incluyen school_id en la ruta. La documentación dice que filtran "from any school the user has access to", pero un usuario con acceso a School-A podría probar UUIDs de ventas de School-B si la validación server-side no es estricta.

Endpoints directos más riesgosos: GET /api/v1/sales/{sale_id}, GET /api/v1/sales/{sale_id}/details, GET /api/v1/orders/{order_id}, GET /api/v1/orders/{order_id}/details, GET /api/v1/clients/{client_id}, PATCH /api/v1/clients/{client_id}, DELETE /api/v1/clients/{client_id}, GET /api/v1/clients/{client_id}/summary, GET /api/v1/products/{product_id}, POST /api/v1/clients/{client_id}/resend-activation, y los endpoints de students bajo clients/{client_id}/students/{student_id}.

Endpoints /global/ sin validación superuser documentada: GET /api/v1/global/inventory/{product_id}/logs, POST /api/v1/global/accounting/set-balance, GET /api/v1/global/accounting/daily-flow y más de 60 endpoints bajo /global/ que solo documentan permisos granulares pero no exigen is_superuser. Un usuario con un permiso como accounting.view_global_balances en un solo school podría potencialmente acceder a datos cross-tenant si require_global_permission() no valida membership en todos los schools.

Los endpoints bajo /api/v1/users/{user_id} (GET, PUT, DELETE, reset-password, email, superuser) son high-risk BOLA: la documentación indica "superuser only" pero el UUID en la ruta sin contexto de tenant es un vector clásico de enumeración.

Severidad	OWASP ID	Endpoint	Riesgo	Mitigación
CRITICA	API1	GET /api/v1/sales/{sale_id}	Acceso a ventas de otro tenant cambiando UUID	Validar sale.school_id IN user.school_ids server-side obligatoriamente
CRITICA	API1	GET /api/v1/orders/{order_id}	Acceso a pedidos cross-tenant	Mismo filtro de ownership por school_ids del usuario
CRITICA	API1	GET/PATCH/DELETE /api/v1/clients/{client_id}	Lectura/modificación/eliminación de clientes de otro colegio	Validar school_id del cliente contra roles del usuario
ALTA	API1	GET /api/v1/users/{user_id}	Enumeración de usuarios del sistema	Verificar que solo superusers o el propio usuario acceden
ALTA	API1	GET /api/v1/global/accounting/* (60+ endpoints)	Acceso a datos financieros globales con permiso granular insuficiente	Implementar validación de superuser o membership multi-school
ALTA	API1	GET /api/v1/documents/{document_id} y /download	Acceso a documentos de cualquier tenant por UUID	Validar ownership del documento
MEDIA	API1	GET /api/v1/sale-changes/{change_id}/details	Lectura de cambios de ventas cross-tenant	Validar que el cambio pertenece a un school accesible
API2:2023 — Broken Authentication
Rate limiting del login (5/min/IP): Es insuficiente para ataques distribuidos. Con una botnet de 200 IPs, un atacante obtiene 1000 intentos/minuto. No se documenta bloqueo por cuenta (account lockout).

Token de 30 minutos (Staff JWT): Esto es razonable, pero NO se documenta un mecanismo de refresh token. Si no existe refresh, los usuarios deben re-autenticarse cada 30 minutos, lo cual incentiva malas prácticas (tokens de larga duración en localStorage, sharing de credenciales).

Password reset abusable (email enumeration): El endpoint POST /api/v1/portal/clients/register explícitamente dice que si el email ya existe, retorna el cliente existente. Esto es un vector de enumeración de emails directísimo: un atacante puede verificar si cualquier email está registrado.

Portal Client Auth separado pero incompleto: El portal usa su propio JWT (client_type: web_client), pero POST /api/v1/portal/clients/google-login no tiene descripción documentada sobre validación del id_token. Tampoco se documenta rate limit para Google login.

Endpoints de verificación sin auth: POST /portal/clients/verify-phone/send, POST /portal/clients/verify-email/send, POST /portal/clients/verify-phone/confirm, POST /portal/clients/verify-email/confirm y POST /portal/clients/activate-account son todos públicos. Aunque phone/send tiene 1/min y email/send 2/min, los endpoints de /confirm no documentan rate limit, permitiendo brute-force de códigos de verificación.

Severidad	OWASP ID	Endpoint	Riesgo	Mitigación
CRITICA	API2	POST /portal/clients/register	Email enumeration — retorna cliente si email ya existe	Respuesta uniforme: siempre "check your email" sin revelar existencia
ALTA	API2	POST /api/v1/auth/login	Rate limit 5/min/IP insuficiente, sin account lockout	Implementar lockout progresivo por cuenta (5, 15, 60 min) + CAPTCHA
ALTA	API2	POST /portal/clients/verify-phone/confirm	Brute-force de código SMS sin rate limit documentado	Rate limit 3/min + expiración de código a 5 minutos + max intentos
ALTA	API2	Auth general	Sin refresh token documentado — solo access token de 30 min	Implementar refresh token con rotación
MEDIA	API2	POST /api/v1/auth/google-login	Sin rate limit documentado en Google login	Aplicar rate limit 10/min/IP
MEDIA	API2	POST /portal/clients/password-reset/request	Posible email enumeration si respuestas varían	Respuesta uniforme independiente de existencia del email
API3:2023 — Broken Object Property Level Authorization
UserUpdate NO incluye is_superuser: Correcto — existe un endpoint separado PUT /api/v1/users/{user_id}/superuser con schema AdminSetSuperuser. Sin embargo, el schema UserUpdate incluye is_active, lo cual permitiría a un admin desactivar usuarios de otros schools si BOLA no se controla.

ClientUpdate NO incluye client_type: El schema solo permite name, phone, email, address, notes, student_name, student_grade, is_active, notification_preference, whatsapp_opted_in. No hay riesgo de escalación de tipo de cliente a través de este schema.

SaleUpdate solo permite client_id y notes: No se puede cambiar status directamente. Sin embargo, poder cambiar client_id de una venta es peligroso — permite reasignar ventas a otro cliente, potencialmente cross-tenant.

SaleCreate incluye is_historical y source: El campo is_historical podría permitir crear ventas con fechas pasadas que alteren reportes contables. El campo source podría ser manipulado.

EmployeeCreate/Update incluye base_salary, bank_account: Datos financieros sensibles expuestos en schemas de actualización sin documentar qué rol exacto se necesita.

Severidad	OWASP ID	Endpoint	Riesgo	Mitigación
ALTA	API3	PUT /api/v1/schools/{school_id}/sales/{sale_id} (SaleUpdate)	Reasignar client_id de venta a otro cliente/tenant	Validar que nuevo client_id pertenezca al mismo school
ALTA	API3	POST /api/v1/schools/{school_id}/sales (SaleCreate)	is_historical=true permite crear ventas retroactivas que alteran contabilidad	Restringir is_historical a superusers o eliminar del schema
MEDIA	API3	PUT/PATCH /global/employees/{employee_id}	Modificación de salario y cuenta bancaria sin claro control de roles	Restringir campos financieros a superuser solamente
MEDIA	API3	PATCH /api/v1/clients/{client_id}	Campo is_active permite desactivar clientes	Validar ownership del cliente por school
BAJA	API3	PUT /api/v1/users/{user_id} (UserUpdate)	Campo is_active podría desactivar usuarios sin ser superuser	Separar campo is_active a endpoint dedicado con validación de rol
API4:2023 — Unrestricted Resource Consumption
44 endpoints de listado tienen limit > 200 o sin máximo: Endpoints como /api/v1/products (max 500), /api/v1/sales (max 500), /api/v1/schools/{school_id}/inventory (max 500), y todos los de contabilidad global permiten hasta 500 registros por request. Si se combinan con consultas complejas, esto puede causar DoS por consumo de DB.

Upload de documentos: 50MB: El endpoint POST /api/v1/documents permite archivos de hasta 50MB (PDF, PNG, JPG, XLSX, XLS, DOCX, DOC). Sin documentar cuántos archivos se pueden subir en total por tenant ni rate limiting para uploads.

Upload de logos: 2MB: Razonable.

Upload de imágenes de prendas: 2MB, max 10 por garment type: Razonable y bien controlado.

Búsquedas sin paginación eficiente: GET /api/v1/clients/search, GET /api/v1/global/products/search (público), GET /api/v1/schools/search/by-name (público) podrían generar full table scans si los términos de búsqueda no están indexados.

Operaciones bulk sin límite documentado: PATCH /api/v1/products/bulk-update-costs, POST /api/v1/global/workforce/schedules/bulk no documentan límite máximo de items.

Severidad	OWASP ID	Endpoint	Riesgo	Mitigación
ALTA	API4	POST /api/v1/documents	Upload 50MB sin rate limit = storage abuse/DoS	Limitar a 10MB, implementar quota por tenant y rate limit
ALTA	API4	44 endpoints con limit=500	Queries masivas causan presión en DB	Reducir max_limit a 100, implementar cursor-based pagination
MEDIA	API4	GET /api/v1/global/products/search (PUBLIC)	Full table scan público sin autenticación	Agregar rate limit y limitar resultado a 20 items
MEDIA	API4	PATCH /products/bulk-update-costs	Actualización masiva sin límite de items	Limitar a 50 productos por request
MEDIA	API4	GET /api/v1/schools/search/by-name (PUBLIC)	Búsqueda pública potencialmente costosa	Rate limit + índice de texto en nombre
API5:2023 — Broken Function Level Authorization
29 endpoints públicos: Varios son esperables (ping, login, register, password-reset), pero hay exposiciones notables.

Endpoints de schools públicos sin justificación clara: GET /api/v1/schools, GET /api/v1/schools/{school_id}, GET /api/v1/schools/{school_id}/summary, GET /api/v1/schools/slug/{slug}, GET /api/v1/schools/search/by-name — exponen toda la información de escuelas sin autenticación. Podrían revelar nombres, direcciones, emails, teléfonos de todos los schools del sistema.

POST /api/v1/contacts/submit (PUBLIC): Endpoint de contacto sin autenticación y sin rate limit documentado. Vector de spam masivo.

POST /portal/clients/verify-phone/send (PUBLIC): Sin autenticación — un atacante puede enviar SMS a cualquier número, generando costos en Twilio/AWS SNS (SMS bombing).

Endpoints /global/ con permisos granulares en vez de superuser: Más de 60 endpoints bajo /global/ requieren permisos como accounting.view_global_balances o accounting.manage_payables, pero si un usuario tiene este permiso en un solo school, ¿accede a datos globales de TODOS los schools? La documentación no aclara si require_global_permission() verifica membership en todos los schools.

Severidad	OWASP ID	Endpoint	Riesgo	Mitigación
CRITICA	API5	POST /portal/clients/verify-phone/send (PUBLIC)	SMS bombing a cualquier número sin auth	Requerir auth o CAPTCHA + rate limit estricto 1/5min
ALTA	API5	POST /api/v1/contacts/submit (PUBLIC)	Spam masivo sin rate limit	Agregar rate limit 3/min/IP + CAPTCHA
ALTA	API5	GET /api/v1/schools + /{school_id} + /summary (PUBLIC)	Exposición total de datos de escuelas	Mover a auth requerida o limitar campos públicos
ALTA	API5	60+ endpoints /global/	Escalación horizontal: permiso en 1 school = acceso global	Implementar require_superuser o validar membership en todos los schools
MEDIA	API5	GET /api/v1/business-info (PUBLIC)	Exposición de información de negocio	Evaluar si debe ser público o requiere auth
MEDIA	API5	GET /api/v1/global/products/search (PUBLIC)	Exposición de catálogo completo de productos y precios	Rate limit + evaluar necesidad de exposición pública
API6:2023 — Unrestricted Access to Sensitive Business Flows
Creación de órdenes desde portal: POST /api/v1/portal/orders tiene rate limit de 10/min/IP, pero un atacante con múltiples IPs podría crear cientos de órdenes falsas que saturan el sistema operativo del negocio.

Registro de clientes: POST /portal/clients/register tiene 3/min/IP, pero la respuesta diferenciada (retorna cliente existente vs nuevo) facilita automatización de enumeración + creación masiva.

Envío de recibos por email: POST /schools/{school_id}/sales/{sale_id}/send-receipt y POST /schools/{school_id}/orders/{order_id}/send-receipt no documentan rate limit. Un atacante autenticado podría enviar miles de emails usando la infraestructura del sistema.

Creación de ventas históricas: SaleCreate.is_historical = true permite crear ventas con fecha pasada — un empleado malicioso podría manipular reportes de períodos cerrados.

Severidad	OWASP ID	Endpoint	Riesgo	Mitigación
ALTA	API6	POST /portal/orders	Flood de órdenes falsas (10/min/IP eludible)	Agregar CAPTCHA + verificación de pago previo + límite por client_id
ALTA	API6	POST /portal/clients/register	Registro masivo + email enumeration	CAPTCHA + respuesta uniforme + rate limit por fingerprint
MEDIA	API6	POST /{school_id}/sales/{sale_id}/send-receipt	Abuso de infraestructura de email	Rate limit 3/min por sale_id + cooldown
MEDIA	API6	SaleCreate con is_historical=true	Manipulación de ventas históricas	Restringir a superuser + audit log
API7:2023 — Server Side Request Forgery (SSRF)
SchoolCreate/SchoolUpdate.logo_url: Acepta cualquier URI (format: uri, maxLength: 2083). Si el servidor fetches esta URL para procesamiento (resize, cache, validación), un atacante podría apuntar a servicios internos: http://169.254.169.254/latest/meta-data/ (AWS metadata), http://localhost:8001/health, etc.

GlobalProductCreate/Update.image_url: Similar riesgo — acepta strings de hasta 500 caracteres sin validación de dominio.

AbsenceCreate/Update.evidence_url: URL de evidencia de ausencia laboral — podría ser usado como vector SSRF.

BusinessInfoUpdate.maps_url y website_url: URLs editables que si el servidor procesa, podrían servir como SSRF.

Severidad	OWASP ID	Endpoint	Riesgo	Mitigación
ALTA	API7	PUT /schools/{school_id} → logo_url	SSRF si el servidor procesa la URL (fetch/resize)	Allowlist de dominios + validar que no sea IP privada + usar upload en vez de URL
MEDIA	API7	POST/PUT /global-products/ → image_url	SSRF potencial	Mismo control: allowlist + validación de IP destino
BAJA	API7	POST /global/workforce/absences → evidence_url	SSRF menor (almacenamiento)	Validar scheme https + dominio permitido
API8:2023 — Security Misconfiguration
GET /health expone métricas de infraestructura: Database latency, disk/memory usage, uptime, 5xx error count. Aunque requiere superuser JWT, si un token de superuser se compromete, el atacante obtiene reconocimiento completo de la infraestructura.

Swagger UI habilitado en producción: El endpoint /docs expone documentación completa de 363 endpoints con schemas, ejemplos y descripciones de seguridad. Esto es un mapa completo para un atacante.

OpenAPI JSON accesible: /api/v1/openapi.json expone la especificación completa incluyendo schemas, validaciones, límites y ejemplos.

POST /api/v1/business-info/seed: Endpoint para inicializar settings por defecto — si se ejecuta en producción, podría resetear configuración.

No se documenta protección CORS, CSP, ni headers de seguridad.

Severidad	OWASP ID	Endpoint	Riesgo	Mitigación
CRITICA	API8	/docs + /api/v1/openapi.json	Exposición completa de API en producción	Deshabilitar en prod o proteger con auth
ALTA	API8	GET /health	Exposición de métricas de infra (disco, memoria, DB latency, errores 5xx)	Limitar respuesta a status ok/fail, separar métricas a monitoring interno
MEDIA	API8	POST /business-info/seed	Reset de configuración en producción	Deshabilitar en prod o limitar a primer uso
MEDIA	API8	Headers de seguridad	Sin CORS, CSP, X-Frame-Options documentados	Implementar security headers estándar
API9:2023 — Improper Inventory Management
Solo se documenta versión v1 (/api/v1/): No hay evidencia de versiones deprecated, lo cual es positivo. Sin embargo, 363 endpoints es una superficie de ataque enorme para una sola API.

Endpoint legacy detectado: POST /portal/clients/verify-token/{token} se describe como "legacy endpoint" — podría tener validaciones más débiles que los endpoints actuales.

No hay documentación de deprecation policy.

Severidad	OWASP ID	Endpoint	Riesgo	Mitigación
MEDIA	API9	POST /portal/clients/verify-token/{token}	Endpoint legacy potencialmente con validaciones débiles	Deprecar formalmente y remover
BAJA	API9	API general (363 endpoints)	Superficie de ataque excesiva sin inventario de shadow APIs	Implementar API gateway con inventario centralizado
API10:2023 — Unsafe Consumption of APIs
Webhook de Wompi: Validación documentada con hmac.compare_digest() y HMAC-SHA256. Siempre retorna 200 para prevenir abuse de reintentos. Esto es una buena práctica.

Google OAuth id_token: El schema GoogleLoginRequest acepta un id_token de Google. Si la validación server-side no verifica: (1) el aud (audience) coincide con el client_id de la app, (2) el iss es accounts.google.com, (3) el token no está expirado, y (4) la firma RSA — un atacante podría forjar tokens. La documentación NO describe estas validaciones.

Severidad	OWASP ID	Endpoint	Riesgo	Mitigación
ALTA	API10	POST /auth/google-login + POST /portal/clients/google-login	Validación de id_token no documentada — posible token forgery	Documentar y verificar: aud, iss, exp, firma RSA via Google certs
BAJA	API10	POST /payments/webhooks/wompi	Bajo — HMAC-SHA256 con compare_digest es correcto	Mantener, agregar IP allowlist de Wompi
MATRIZ DE RIESGOS (Impacto vs Probabilidad)
          │ Impacto BAJO    │ Impacto MEDIO        │ Impacto ALTO              │ Impacto CRITICO
──────────┼─────────────────┼──────────────────────┼───────────────────────────┼──────────────────────
Prob ALTA │                 │ API4: Limits 500     │ API1: BOLA sales/orders   │ API8: Swagger en prod
          │                 │ API6: Order flood    │ API2: Email enumeration   │ API5: SMS bombing
          │                 │                      │ API5: Schools públicos    │
──────────┼─────────────────┼──────────────────────┼───────────────────────────┼──────────────────────
Prob MEDIA│ API9: Legacy ep │ API3: SaleUpdate     │ API5: Global perms        │ API1: Cross-tenant
          │                 │ API7: SSRF logo_url  │ API2: No account lockout  │   clients/sales
          │                 │ API4: 50MB uploads   │ API10: Google OAuth       │
──────────┼─────────────────┼──────────────────────┼───────────────────────────┼──────────────────────
Prob BAJA │ API10: Wompi OK │ API3: EmployeeUpdate │ API7: SSRF productos      │ API8: /health metrics
          │ API9: Inventario│ API8: Seed endpoint  │ API6: Historical sales    │
TOP 10 HALLAZGOS POR SEVERIDAD
#	Severidad	OWASP	Hallazgo	Endpoint(s)
1	CRITICA	API1+API5	BOLA masivo en 142 endpoints sin school_id en path — ventas, órdenes, clientes accesibles cross-tenant por UUID	GET /sales/{sale_id}, /orders/{order_id}, /clients/{client_id}
2	CRITICA	API8	Swagger UI + OpenAPI JSON expuestos en producción — mapa completo de 363 endpoints para atacantes	/docs, /api/v1/openapi.json
3	CRITICA	API5	SMS bombing sin auth — envío de SMS a cualquier número sin autenticación	POST /portal/clients/verify-phone/send
4	CRITICA	API2	Email enumeration en registro — endpoint confirma existencia de emails	POST /portal/clients/register
5	ALTA	API5	60+ endpoints /global/ con permisos granulares insuficientes — permiso en 1 school = acceso a datos de todos los schools	/global/accounting/*, /global/reports/*
6	ALTA	API2	Sin account lockout + rate limit débil en login — brute force viable con IPs distribuidas	POST /auth/login, POST /portal/clients/login
7	ALTA	API5	Datos de schools completamente públicos — nombres, emails, teléfonos, direcciones de todas las escuelas	GET /schools, GET /schools/{school_id}
8	ALTA	API7	SSRF potencial via logo_url — URL arbitraria en SchoolCreate/Update	PUT /schools/{school_id} (logo_url)
9	ALTA	API10	Validación de Google id_token no documentada — posible token forgery	POST /auth/google-login
10	ALTA	API4	Uploads de 50MB sin quota + 44 endpoints con limit=500 — DoS por almacenamiento y queries pesadas	POST /documents, múltiples GET listados
PLAN DE REMEDIACIÓN PRIORIZADO
Día 1 (Emergencia)
Deshabilitar /docs y /api/v1/openapi.json en producción (o proteger con auth). Agregar rate limit y CAPTCHA a POST /portal/clients/verify-phone/send. Cambiar POST /portal/clients/register para dar respuesta uniforme sin revelar si el email existe. Agregar account lockout progresivo al login (bloqueo por cuenta después de 5 intentos fallidos).

Semana 1 (Crítico)
Auditar y validar server-side que los 142 endpoints sin school_id en path implementen filtrado por user.school_ids — priorizar /sales/{sale_id}, /orders/{order_id}, /clients/{client_id}. Revisar que require_global_permission() exija superuser o membership en todos los schools. Reducir GET /health a solo status ok/fail (mover métricas a monitoring interno). Implementar validación estricta de Google id_token (audience, issuer, expiry, RSA signature). Agregar rate limit a POST /contacts/submit.

Mes 1 (Importante)
Implementar refresh token con rotación. Reducir campos públicos en endpoints de schools o moverlos detrás de autenticación. Validar URLs en logo_url, image_url, evidence_url contra allowlist de dominios (prevención SSRF). Reducir max_limit de paginación a 100 en todos los endpoints. Reducir límite de upload de documentos de 50MB a 10MB + implementar quota por tenant. Agregar límite de items a operaciones bulk. Deprecar y remover endpoint legacy /portal/clients/verify-token/{token}. Implementar security headers (CORS restrictivo, CSP, X-Frame-Options, X-Content-Type-Options). Agregar rate limit por client_id (no solo por IP) a creación de órdenes del portal. Restringir SaleCreate.is_historical a superusers. Validar que SaleUpdate.client_id pertenezca al mismo school.

TABLA DE SCORES FINAL
Categoria CSV	Nota /10
bola-api1	3
broken-auth-api2	4
property-auth-api3	6
resource-consumption-api4	4
function-auth-api5	3
sensitive-flows-api6	5
ssrf-api7	5
misconfiguration-api8	3
inventory-api9	7
unsafe-consumption-api10	6
GLOBAL (/100)	46
Justificación del score global 46/100: La API demuestra buen diseño arquitectónico (multi-tenant, permisos granulares, JWT separado para portal, HMAC en webhooks) pero tiene debilidades críticas en la superficie de ataque: 142 endpoints sin aislamiento de tenant explícito en la ruta, Swagger expuesto en producción, endpoints públicos que filtran información, y vectores de abuso (SMS bombing, email enumeration, uploads de 50MB). La nota refleja una API que tiene los fundamentos correctos pero necesita hardening significativo antes de considerarse segura para producción multi-tenant con datos financieros y PII.




