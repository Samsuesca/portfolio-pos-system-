🔒 Auditoría de Seguridad API — OWASP API Security Top 10 (2023)
Target: Uniformes System API v2.0.0 (OAS 3.1) Alcance: 363 endpoints, multi-tenant (schools), dual-auth (Staff JWT + Portal Client JWT) Metodología: OWASP API Security Top 10:2023, black-box basado en especificación OpenAPI Fecha: 2026-04-12

API1:2023 — Broken Object Level Authorization (BOLA)
200 endpoints contienen UUIDs en path. Tipos de ID detectados: school_id, user_id, sale_id, order_id, client_id, product_id, garment_type_id, image_id, expense_id, account_id, register_id, employee_id, payroll_id, item_id, contact_id, zone_id, document_id, folder_id, alteration_id, notification_id, template_id, schedule_id, record_id, absence_id, budget_id, review_id, responsibility_id, role_id, payment_id, wompi_id.

Endpoints con school_id en path (~120): La documentación indica que el service layer filtra por Model.school_id == school_id y valida roles del usuario. Esto es una buena práctica, pero la validación debe ser verificada en código para cada endpoint.

Endpoints shortcut SIN school_id que acceden datos por UUID directo:

Severidad	OWASP ID	Endpoint	Riesgo	Mitigación
ALTA	API1	GET /api/v1/sales/{sale_id}	Descripción dice "from any school the user has access to" — pero si la validación falla, un UUID adivinado/filtrado da acceso a ventas de otro tenant.	Verificar en código que sale.school_id IN user.school_ids. Agregar tests de BOLA.
ALTA	API1	GET /api/v1/sales/{sale_id}/details	Mismo riesgo. Explícitamente dice "does not require school_id in URL."	Confirmar filtro server-side contra school_ids del token JWT.
ALTA	API1	GET /api/v1/orders/{order_id}	Mismo patrón shortcut sin school_id.	Verificar ownership en service layer.
ALTA	API1	GET /api/v1/orders/{order_id}/details	Acceso a detalles completos de pedido por UUID solo.	Verificar ownership en service layer.
ALTA	API1	GET /api/v1/sale-changes/{change_id}/details	Acceso a cambios de venta por UUID sin school_id.	Validar que el change pertenece a un school del usuario.
MEDIA	API1	GET /api/v1/clients/{client_id}	Clientes son "global entities" — cualquier staff autenticado puede ver cualquier cliente.	Evaluar si esto es intencional o si debería restringirse por school.
MEDIA	API1	PATCH /api/v1/clients/{client_id}	Actualización de cliente global por UUID.	Validar permisos de escritura.
ALTA	API1	GET /api/v1/payments/order/{order_id}	Portal client accede pagos por order_id — si no valida ownership, un cliente ve pagos de otro.	Confirmar que valida order.client_id == token.client_id.
MEDIA	API1	PATCH /api/v1/notifications/{notification_id}/read	Documentación menciona tenant isolation, pero el UUID es el único identificador.	Confirmar filtro notification.user_id == current_user.id.
Endpoints /global/ — 154 total, 150 autenticados: Los /global/ endpoints son cross-school y requieren permisos granulares. 15 endpoints globales autenticados no mencionan permisos específicos en su descripción (ej: GET /api/v1/global/alterations, DELETE /api/v1/global/garment-types/{garment_type_id}). Esto no significa que no estén protegidos en código, pero la falta de documentación es una señal de riesgo.

Nota API1: 6/10 — La arquitectura multi-tenant con school_id en path es sólida, pero los endpoints shortcut y globales amplían la superficie de ataque.

API2:2023 — Broken Authentication
Severidad	OWASP ID	Endpoint	Riesgo	Mitigación
MEDIA	API2	POST /api/v1/auth/login	Rate limit 5/min por IP. Es insuficiente contra ataques distribuidos (botnet). No hay evidencia de CAPTCHA, bloqueo de cuenta, o detección de anomalías.	Agregar bloqueo de cuenta tras N intentos, CAPTCHA progresivo, y alertas por geolocalización anómala.
MEDIA	API2	Token JWT Staff	Expira en 30 minutos. No hay refresh token documentado — solo permissions-refresh que valida versiones de permisos. Sin refresh token, el usuario debe re-autenticarse cada 30 min o el frontend almacena credenciales.	Implementar refresh token rotation con familia de tokens para detectar token theft.
BAJA	API2	POST /api/v1/portal/clients/login	Rate limit 5/min por IP. Misma debilidad que staff login.	Mismas mitigaciones + considerar MFA para portal.
BAJA	API2	POST /api/v1/portal/clients/password-reset/request	No se menciona rate limit. Podría usarse para email bombing. Sin embargo, el register devuelve respuesta uniforme para prevenir enumeración — verificar que reset hace lo mismo.	Agregar rate limit explícito (3/min) y respuesta uniforme.
MEDIA	API2	POST /api/v1/auth/google-login	Sin descripción documentada. No se puede verificar si valida id_token correctamente (audience, issuer, expiry).	Documentar validación de id_token. Verificar aud, iss, exp server-side.
BAJA	API2	Portal Client Auth	El portal usa JWT separado con client_type: web_client. Está documentado en la descripción principal. El aislamiento staff/portal es correcto en diseño.	Verificar que tokens de portal no sean aceptados en endpoints de staff y viceversa.
Nota API2: 7/10 — Buena separación staff/portal, tokens cortos (30min), rate limiting presente. Falta refresh token, bloqueo de cuenta, y documentación de Google OAuth validation.

API3:2023 — Broken Object Property Level Authorization
Severidad	OWASP ID	Endpoint/Schema	Riesgo	Mitigación
BAJA	API3	UserUpdate	Solo expone username, email, full_name, password, is_active. No incluye is_superuser — hay un endpoint dedicado PUT /users/{user_id}/superuser. Buen diseño.	Mantener. Verificar que el endpoint PUT users no acepte campos extra no definidos en schema.
BAJA	API3	ClientUpdate	Campos: name, phone, email, address, notes, student_name, student_grade, is_active, notification_preference, whatsapp_opted_in. No incluye client_type. Correcto.	Mantener.
BAJA	API3	SaleUpdate	Solo permite client_id y notes. Descripción explícita: "Status transitions use dedicated endpoints." Excelente diseño.	Mantener.
MEDIA	API3	SchoolUpdate	Incluye is_active — un admin de school podría desactivar el school. El endpoint es "superuser only" lo cual mitiga.	Verificar en código que solo superusers usen PUT schools.
MEDIA	API3	EmployeeUpdate	Incluye base_salary, is_active, termination_date. Campos sensibles de nómina. Si un usuario con permiso employees.edit puede cambiar salarios, podría haber escalación.	Segregar permisos: employees.edit_profile vs employees.edit_compensation.
BAJA	API3	OrderCreate	Incluye client_id en el body. El portal valida que order.client_id == token.client_id, pero si esta validación falla, un cliente podría crear órdenes a nombre de otro.	Ignorar client_id del body y usar el del token JWT.
Nota API3: 7/10 — Excelente segregación de schemas (UserUpdate sin is_superuser, SaleUpdate sin status). EmployeeUpdate con salary es un riesgo menor.

API4:2023 — Unrestricted Resource Consumption
Severidad	OWASP ID	Endpoint	Riesgo	Mitigación
MEDIA	API4	GET /api/v1/sales	limit máximo 500. Es alto — podría permitir extraer datos masivamente en pocas requests.	Reducir a 100-200 máximo.
BAJA	API4	GET /api/v1/clients, GET /api/v1/orders	limit máximo 200. Razonable.	Mantener.
BAJA	API4	Búsquedas (/search/by-name, /clients/search, /global/products/search)	Límite máximo 50. Bueno. Pero no se documenta si hay índices. Una búsqueda con wildcard % podría causar full table scan.	Verificar índices en columnas de búsqueda. Limitar caracteres especiales en q.
MEDIA	API4	POST /api/v1/documents	Upload de 50MB documentado. Es generoso. Sin límite documentado de cantidad de documentos por usuario/school.	Limitar a 10MB default. Agregar cuota por school.
BAJA	API4	Image uploads (garment-types)	Max 2MB, max 10 imágenes por garment type. Bien documentado.	Mantener.
MEDIA	API4	PATCH /api/v1/products/bulk-update-costs	Operación bulk sin límite documentado de items por request.	Limitar a 50-100 items por batch.
MEDIA	API4	POST /api/v1/global/workforce/schedules/bulk	Bulk schedule sin límite documentado.	Agregar límite de items.
BAJA	API4	Rate limiting global	120 req/min por IP documentado.	Considerar rate limiting por usuario autenticado además de IP.
Nota API4: 6/10 — Paginación presente con máximos, rate limiting global. Faltan límites en bulk operations y documentos.

API5:2023 — Broken Function Level Authorization
Severidad	OWASP ID	Endpoint	Riesgo	Mitigación
BAJA	API5	POST /api/v1/portal/orders	Requiere auth (Portal Client JWT). Rate limit 10/min. Valida ownership. Correcto — no es público como se temía.	Mantener.
BAJA	API5	GET /api/v1/contacts/by-email	Requiere auth (Portal Client JWT). Devuelve mensajes asociados al email del cliente autenticado. No es público.	Mantener.
MEDIA	API5	GET /api/v1/schools (público)	Lista todos los schools sin auth. Expone nombres, IDs, logos, colores. Necesario para el portal pero expone inventario de tenants.	Evaluar si se puede limitar campos expuestos (solo name + slug).
MEDIA	API5	GET /api/v1/schools/{school_id} (público)	Detalle de school sin auth incluyendo settings, email, phone.	Minimizar campos en respuesta pública.
ALTA	API5	POST /api/v1/portal/clients/verify-phone/send (público)	Envía SMS sin auth. Rate limit 1/min por IP pero un atacante distribuido podría generar costos significativos de SMS.	Agregar CAPTCHA. Requerir token pre-autenticación.
MEDIA	API5	POST /api/v1/portal/clients/verify-email/send (público)	Envía emails sin auth. Rate limit 2/min por IP. Podría usarse para email bombing.	Agregar CAPTCHA.
ALTA	API5	15 endpoints /global/ sin permisos documentados	Endpoints como DELETE /global/garment-types/{id}, POST /global/alterations, etc. no documentan qué permiso requieren. Si la implementación no valida, cualquier staff autenticado podría ejecutarlos.	Auditar código para confirmar permisos. Documentar explícitamente.
MEDIA	API5	PUT /api/v1/users/{user_id}/superuser	Superuser can promote/demote. Si el único control es is_superuser en JWT, y un token es comprometido, da acceso total.	Agregar MFA para operaciones de superuser. Log de auditoría.
Nota API5: 6/10 — Portal orders y contacts/by-email están protegidos (bien). Los endpoints públicos de SMS/email y los /global/ sin permisos documentados son preocupantes.

API6:2023 — Unrestricted Access to Sensitive Business Flows
Severidad	OWASP ID	Endpoint	Riesgo	Mitigación
MEDIA	API6	POST /api/v1/portal/orders	Rate limit 10/min por IP. Un atacante con cuenta válida podría crear ~600 órdenes/hora cambiando IP o usando proxies.	Agregar límite por client_id (ej: 5 órdenes/día). Validar monto mínimo/máximo.
MEDIA	API6	POST /api/v1/portal/clients/register	Rate limit 3/min por IP. No hay CAPTCHA. Registro masivo de cuentas falsas posible.	Agregar CAPTCHA (hCaptcha/Turnstile). Email verification obligatoria antes de activar.
MEDIA	API6	POST /api/v1/contacts/submit	Público, sin auth, sin rate limit documentado. Spam masivo de formulario de contacto.	Agregar rate limit (3/min por IP) y CAPTCHA.
BAJA	API6	POST /api/v1/portal/clients/password-reset/request	Sin rate limit documentado. Podría abusar del envío de emails de reset.	Agregar rate limit y respuesta uniforme.
Nota API6: 6/10 — Rate limits presentes pero insuficientes contra atacantes sofisticados. Falta CAPTCHA en todos los flujos públicos.

API7:2023 — Server Side Request Forgery (SSRF)
Severidad	OWASP ID	Endpoint/Campo	Riesgo	Mitigación
MEDIA	API7	SchoolUpdate.logo_url	Acepta formato URI arbitrario (maxLength 2083). Si el server renderiza o descarga esta URL, podría acceder a servicios internos (http://169.254.169.254, http://localhost).	Validar contra allowlist de dominios. No hacer fetch server-side. Si se necesita, usar proxy con sanitización.
BAJA	API7	BusinessInfoUpdate.maps_url, website_url	URLs almacenadas pero probablemente solo mostradas en frontend. Riesgo menor de SSRF pero posible XSS stored si no se sanitiza al renderizar.	Validar esquema (solo https://). Sanitizar al renderizar.
BAJA	API7	AbsenceCreate.evidence_url	URL de evidencia. Si se descarga server-side para verificar, SSRF posible.	No hacer fetch server-side. Solo almacenar referencia.
BAJA	API7	Logo upload POST /schools/{school_id}/logo	Upload multipart — no acepta URL, solo archivo. Correcto.	Mantener.
Nota API7: 8/10 — El principal riesgo es logo_url en SchoolUpdate (superuser only). Los uploads son por file, no por URL. Riesgo mitigado por requerir superuser.

API8:2023 — Security Misconfiguration
Severidad	OWASP ID	Endpoint	Riesgo	Mitigación
BAJA	API8	GET /health	Expone DB latency, disk/memory usage, uptime, 5xx count. Pero requiere superuser auth y en producción está protegido. Bien diseñado.	Mantener.
BAJA	API8	/docs, /redoc, /openapi.json	Deshabilitados en producción (ENV=production). Correcto.	Mantener. Verificar que ENV no pueda ser sobreescrita via headers.
BAJA	API8	GET /ping	Solo devuelve {status: ok}. Mínima exposición. Correcto.	Mantener.
BAJA	API8	CORS	Documentado: "explicit allowlist of origins (not *)". Correcto.	Verificar que la allowlist no sea demasiado permisiva.
MEDIA	API8	Errores 500	No documentado si los errores exponen stack traces en producción. Es un riesgo común.	Confirmar que errores 500 devuelven mensaje genérico sin stack trace. Usar middleware de error handling.
BAJA	API8	Security Scheme	Solo HTTPBearer definido — sin distinción entre Staff JWT y Portal JWT en OpenAPI spec. El tooling de API no distingue los dos tipos de token.	Documentar dos security schemes separados en OpenAPI para claridad.
Nota API8: 8/10 — Excelente configuración: docs deshabilitados en prod, CORS con allowlist, health protegido. Verificar stack traces en errores 500.

API9:2023 — Improper Inventory Management
Severidad	OWASP ID	Hallazgo	Riesgo	Mitigación
BAJA	API9	Solo API v1	No hay v2 ni endpoints deprecated detectados. Inventario limpio.	Mantener versionado cuando evolucione la API.
MEDIA	API9	28 endpoints públicos	Gran superficie de ataque pública: 4 endpoints de schools, 9 de portal auth, 4 de productos globales, 1 contacto, 1 delivery zones, 1 business info, 1 payments config, 1 webhook, 1 ping, 1 verify-email.	Auditar regularmente. Documentar cada endpoint público y su justificación.
BAJA	API9	OpenAPI spec completa	363 endpoints documentados. Buen inventario.	Mantener sincronizado con implementación.
Nota API9: 8/10 — Sin endpoints deprecated, versionado limpio, documentación completa.

API10:2023 — Unsafe Consumption of APIs
Severidad	OWASP ID	Integración	Riesgo	Mitigación
BAJA	API10	Webhook Wompi	Valida HMAC-SHA256 con hmac.compare_digest(). Usa constant-time comparison (previene timing attacks). Devuelve siempre 200 (previene retry abuse). Excelente implementación.	Mantener. Rotar secret key periódicamente.
MEDIA	API10	Google OAuth (/auth/google-login, /portal/clients/google-login)	Sin descripción de validación. No se puede confirmar si valida aud (audience), iss (issuer), exp (expiry) del id_token.	Documentar y verificar: usar Google's tokeninfo endpoint o validar JWT localmente con Google's public keys. Verificar aud match con client_id.
BAJA	API10	Twilio/AWS SNS (SMS)	Mencionado para verificación de teléfono. Si las credenciales están hardcodeadas o expuestas, riesgo de abuso.	Usar secrets manager. Rotar credenciales.
BAJA	API10	Resend (Email)	Usado para envío de emails de verificación.	Mismas precauciones que SMS.
Nota API10: 7/10 — Wompi webhook bien implementado. Google OAuth necesita verificación de validación correcta.

Matriz de Riesgos (Impacto vs Probabilidad)
IMPACTO
  ALTO    │ API5:global-no-perm │ API1:shortcuts   │                    │
          │ API6:contact-spam   │ API5:sms-abuse   │                    │
          │                     │                   │                    │
  MEDIO   │ API4:bulk-no-limit  │ API2:no-refresh  │ API3:employee-sal  │
          │ API8:stack-traces   │ API6:orders-mass  │ API10:google-oauth │
          │                     │ API6:register     │                    │
  BAJO    │ API9:public-surface │ API7:logo-url     │                    │
          │                     │                   │                    │
          ├─────────────────────┼───────────────────┼────────────────────┤
                  BAJA               MEDIA                ALTA
                                PROBABILIDAD
Top 10 Hallazgos Ordenados por Severidad
#	Severidad	OWASP	Hallazgo	Impacto
1	ALTA	API1	Endpoints shortcut (/sales/{id}, /orders/{id}) sin school_id en path — BOLA si validación server-side falla	Acceso a datos de otros tenants
2	ALTA	API5	verify-phone/send público sin CAPTCHA — SMS bombing con costo financiero	Costo financiero, DoS del servicio SMS
3	ALTA	API5	15 endpoints /global/ sin permisos documentados — posible escalación horizontal	Acceso no autorizado a datos cross-school
4	MEDIA	API2	Sin refresh token — re-auth cada 30 min o almacenamiento inseguro de credenciales	Exposición de credenciales, mala UX
5	MEDIA	API6	contacts/submit público sin rate limit ni CAPTCHA — spam masivo	Spam, abuso de recursos
6	MEDIA	API4	Bulk operations sin límite documentado (bulk-update-costs, schedules/bulk)	DoS, consumo de recursos
7	MEDIA	API4	Upload de documentos 50MB sin cuota — posible abuso de almacenamiento	Costos de storage, DoS
8	MEDIA	API10	Google OAuth sin validación documentada de id_token	Account takeover si no valida audience
9	MEDIA	API7	SchoolUpdate.logo_url acepta URI arbitraria — SSRF si procesada server-side	Acceso a servicios internos
10	MEDIA	API3	EmployeeUpdate permite cambiar base_salary — posible abuso si permisos son laxos	Fraude de nómina
Plan de Remediación Priorizado
Día 1 (Inmediato — Crítico)
Auditar en código los endpoints shortcut (/sales/{id}, /orders/{id}, /payments/order/{id}) para confirmar validación de ownership contra school_ids del JWT.
Agregar rate limit a POST /contacts/submit (3/min por IP).
Verificar que los 15 endpoints /global/ sin permisos documentados tengan require_permission() o require_superuser en código.
Confirmar que errores 500 no exponen stack traces en producción.
Semana 1 (Alta Prioridad)
Implementar CAPTCHA en: verify-phone/send, verify-email/send, contacts/submit, portal/clients/register.
Agregar límites a bulk operations (50-100 items/batch).
Documentar y verificar validación de Google OAuth id_token (aud, iss, exp).
Implementar refresh token rotation para Staff JWT.
Agregar rate limit por client_id en POST /portal/orders (5/día).
Reducir límite de documents upload a 10MB y agregar cuota por school.
Mes 1 (Mejora Continua)
Implementar bloqueo progresivo de cuenta tras intentos fallidos de login (5 intentos → bloqueo 15 min).
Segregar permisos de empleados: employees.edit_profile vs employees.edit_compensation.
Validar logo_url contra allowlist de dominios o eliminar campo y usar solo upload.
Documentar dos security schemes separados en OpenAPI (StaffBearer, PortalBearer).
Implementar alertas de anomalía para operaciones sensibles (superuser promotion, bulk deletes).
Minimizar datos en respuestas públicas de schools (solo name, slug, logo_url, primary_color).
Agregar tests automatizados de BOLA para todos los endpoints con UUID.
TABLA DE SCORES FINAL
Categoria CSV	Nota /10
bola-api1	6
broken-auth-api2	7
property-auth-api3	7
resource-consumption-api4	6
function-auth-api5	6
sensitive-flows-api6	6
ssrf-api7	8
misconfiguration-api8	8
inventory-api9	8
unsafe-consumption-api10	7
GLOBAL (/100)	69
Veredicto: La API demuestra una arquitectura de seguridad sólida en su diseño (multi-tenant con school_id, separación staff/portal, schemas restrictivos para updates, webhook con HMAC, docs deshabilitados en prod). Los principales riesgos están en la validación real en código de los endpoints shortcut, los endpoints /global/ sin permisos documentados, y la falta de CAPTCHA en flujos públicos que pueden generar costos (SMS/email). El score de 69/100 refleja una API que tiene buenas bases arquitectónicas pero necesita hardening en los puntos identificados.





