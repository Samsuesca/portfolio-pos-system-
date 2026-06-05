🔒 Auditoría de Seguridad — Uniformes System API v2.0.0
OWASP API Security Top 10 (2023)
Fecha de auditoría: 12/04/2026
Scope: 477 endpoints, 32 sin autenticación, 283 con UUIDs en path
Framework: FastAPI + JWT Bearer (Staff 30min + Portal Client aislado)
Arquitectura: Multi-tenant con school_id scoping

API1:2023 — Broken Object Level Authorization (BOLA)
Endpoints con UUIDs en path SIN school_id scope (acceso directo por ID): Existen al menos 30+ endpoints que aceptan un resource UUID sin {school_id} en el path, lo que significa que la validación de tenant aislamiento depende enteramente del service layer y no del path.
Endpoints de acceso directo más críticos:

GET/PUT/DELETE /api/v1/users/{user_id} — La doc dice "self OR superuser" pero si la validación falla, cualquier usuario autenticado podría acceder a otros usuarios.
GET/PATCH/DELETE /api/v1/clients/{client_id} — Sin school_id en path. Si el service layer no filtra por escuelas del usuario, un vendedor de School A podría ver clientes de School B.
GET /api/v1/sales/{sale_id} y GET /api/v1/sales/{sale_id}/details — Dicen "from any accessible school" lo cual implica que SÍ validan contra las escuelas del usuario, pero el riesgo es que la validación sea solo a nivel de ownership y no de tenant.
GET /api/v1/orders/{order_id} y GET /api/v1/orders/{order_id}/details — Mismo patrón.
GET/PUT /api/v1/contacts/{contact_id} — Admin endpoint sin school_id en path.
GET/PUT/DELETE /api/v1/documents/{document_id} — Documentos por ID directo.
GET/PUT/DELETE /api/v1/delivery-zones/{zone_id} — Zonas de entrega por ID.
PATCH /api/v1/notifications/{notification_id}/read — Podría marcar notificaciones de otros usuarios.

Endpoints /global/ sin validación de permisos elevados explícita en path: Hay 210 endpoints bajo /global/. La documentación indica que usan require_global_permission(), pero esto no es verificable externamente. Endpoints como GET /api/v1/global/accounting/cash-balances y POST /api/v1/global/accounting/expenses manejan datos financieros cross-school críticos.
¿/api/v1/sales/{sale_id} valida que la venta pertenezca al school del usuario? La descripción dice que valida acceso basado en las escuelas asignadas al usuario, pero esta validación es invisible en la spec. Un atacante con acceso a una escuela podría intentar acceder a ventas de otra escuela simplemente cambiando el UUID.

API2:2023 — Broken Authentication
Rate limiting del login (5/min/IP): Es insuficiente contra ataques distribuidos. Un botnet con 1000 IPs podría hacer 5000 intentos/minuto. No hay mención de rate limiting por cuenta (username), lo que permite password spraying horizontal.
No hay refresh token: La API solo emite un access_token con expires_in. No hay mecanismo de refresh token documentado. Sin embargo, el JWT expira en 30 minutos (no 24h como se sugería), lo cual es razonable, pero la ausencia de refresh token implica re-autenticación frecuente, lo que puede incentivar tokens de larga vida en el frontend.
Password reset abusable (email enumeration): El endpoint POST /api/v1/portal/clients/password-reset/request retorna 200 sin diferenciación documentada entre email existente y no existente. Sin embargo, el endpoint más peligroso es POST /api/v1/portal/clients/register que explícitamente retorna el cliente existente si el email ya existe. Esto es un vector de enumeración de emails confirmado.
Portal auth aislado: El portal usa JWT separado (Portal Client JWT con client_type: web_client), lo cual es positivo. Sin embargo, no se documenta la expiración del portal JWT ni mecanismos anti-replay.
Google OAuth: Acepta un id_token de Google. La especificación no documenta si valida aud (audience), iss (issuer) y exp del token. Si solo verifica la firma sin validar el audience, un token emitido para otra aplicación podría ser reutilizado.

API3:2023 — Broken Object Property Level Authorization
UserCreate expone is_superuser: El schema UserCreate incluye is_superuser: boolean (default: false). Aunque el endpoint POST /api/v1/users es "superuser only", si la validación del flag is_superuser depende solo del endpoint y no del schema, un atacante que logre acceder al endpoint podría crear superusuarios. El campo debería ser eliminado del schema público.
UserUpdate NO incluye is_superuser: Esto es correcto. El superuser status se cambia vía un endpoint dedicado PUT /api/v1/users/{user_id}/superuser.
ClientUpdate NO expone client_type: El schema solo permite modificar name, phone, email, address, notes, student_name, student_grade, is_active, notification_preference, whatsapp_opted_in. No hay forma de cambiar client_type de "regular" a "web" via update. Esto es correcto.
SaleUpdate es restringido: Solo permite cambiar client_id y notes. No expone status, total, ni campos financieros. El status se cambia vía endpoint dedicado /cancel. Bien diseñado.
OrderUpdate es restringido: Solo delivery_date y notes. El status se cambia vía PATCH .../status. Correcto.
SchoolUpdate incluye logo_url y is_active: Estos campos son superuser-only pero están en el schema. Un superuser comprometido podría desactivar escuelas.

API4:2023 — Unrestricted Resource Consumption
Límites de paginación:

Orders: max: 500, default: 100 — 500 es alto para una sola request.
Sales: max: 100, default: 100 — Razonable.
Clients: max: 500, default: 100 — 500 con búsqueda podría ser costoso.
Contacts: max: 100, default: 20 — Razonable.
Users: max: 100, default: 100 — Razonable.
Products search: max: 50, default: 20 — Bien.

Uploads sin límite claro de requests: Logo y garment images tienen 2MB max y formatos restringidos (JPG, PNG, WebP). Documentos permiten hasta 50MB (PDF, PNG, JPG, XLSX, XLS, DOCX, DOC), lo cual es un vector de DoS por almacenamiento si no hay cuota global.
Búsqueda potencialmente costosa: GET /api/v1/clients/search?q=... y GET /api/v1/global/products/search?q=... con parámetro q de texto libre. Si hacen LIKE sin índice o full-text search sin optimización, un q=a podría causar full table scan.
Operaciones bulk sin límite documentado: POST /api/v1/global/workforce/schedules/bulk y PATCH /api/v1/products/bulk-update-costs no documentan un máximo de items por request.
SSE (Server-Sent Events): GET /api/v1/global/print-queue/subscribe es un endpoint de streaming. Sin timeout ni límite de conexiones, podría agotar sockets del servidor.

API5:2023 — Broken Function Level Authorization
Endpoints "superuser only" protegidos: Se documentan 20+ endpoints como superuser only (CRUD schools, CRUD users, health check, etc.) y todos requieren HTTPBearer. La protección parece bien documentada.
POST /api/v1/portal/orders sí requiere auth: Requiere Portal Client JWT. No es público. Correcto.
GET /api/v1/contacts/by-email requiere auth: Requiere Portal Client JWT y retorna solo mensajes del email del cliente autenticado. No es público. Correcto.
Endpoints públicos de riesgo:

GET /api/v1/global/inventory/low-stock — SIN AUTH: Expone niveles de inventario de la empresa. Un competidor podría monitorear qué productos tienen bajo stock. Riesgo de inteligencia competitiva.
GET /api/v1/global/products/{product_id}/inventory — SIN AUTH: Inventario específico por producto.
GET /api/v1/global/products/search — SIN AUTH: Búsqueda de catálogo público. Aceptable si es un e-commerce.
GET /api/v1/schools y GET /api/v1/schools/{school_id} — SIN AUTH: Información de escuelas pública. Aceptable para portal.
GET /api/v1/permissions/registry — SIN AUTH: Expone el catálogo completo de permisos del sistema. Un atacante puede mapear toda la superficie de autorización.
GET /api/v1/business-info — SIN AUTH: Información del negocio pública. Aceptable.
GET /api/v1/payments/config — SIN AUTH: Solo expone public key de Wompi. Correcto.

Endpoints /global/ y validación de roles: Los endpoints globales usan require_global_permission() que valida acceso cross-school. No se documenta si un usuario sin roles en ninguna escuela podría acceder. Si un usuario desactivado mantiene su JWT válido, podría seguir accediendo.

API6:2023 — Unrestricted Access to Sensitive Business Flows
Creación masiva de órdenes desde portal: POST /api/v1/portal/orders requiere auth pero no documenta rate limiting específico. Un cliente registrado podría crear miles de órdenes automatizadamente, generando ruido operativo o agotando stock reservado.
Registro ilimitado de clientes: POST /api/v1/portal/clients/register es público y no documenta rate limiting. Un atacante podría registrar miles de cuentas fake. Además, como ya señalado, retorna el cliente existente si el email ya existe, facilitando enumeración y spam masivo.
Envío de mensajes de contacto ilimitado: POST /api/v1/contacts/submit es público sin rate limiting documentado. Vector de spam.
Verificación de teléfono/email sin límite: POST /api/v1/portal/clients/verify-phone/send y POST /api/v1/portal/clients/verify-email/send son públicos. Sin rate limiting, podrían usarse para enviar SMS/emails masivos a cualquier número/dirección (SMS bombing/email flooding).

API7:2023 — Server Side Request Forgery (SSRF)
Campos que aceptan URLs:

SchoolCreate/SchoolUpdate.logo_url — Acepta URI con max 2083 chars. Si el server hace fetch del logo para almacenamiento local o preview, es un vector SSRF clásico.
ProductCreate/ProductUpdate.image_url — Mismo riesgo.
GlobalProductCreate/GlobalProductUpdate.image_url — Mismo riesgo.
BusinessInfoUpdate.maps_url y website_url — Si el servidor hace crawling o genera previews.
AbsenceCreate/AbsenceUpdate.evidence_url — URL de evidencia de ausencia.

Mitigación probable: Si estos campos son solo almacenados como strings y renderizados en el frontend sin ser fetched por el servidor, el riesgo SSRF es bajo. Sin embargo, la especificación no documenta si hay server-side fetching. El campo logo_url coexiste con POST /schools/{school_id}/logo (upload directo), sugiriendo que logo_url podría ser un URL externo que el server procesa.

API8:2023 — Security Misconfiguration
/health expone métricas de infraestructura: La descripción confirma que expone "database latency, disk/memory usage, uptime, and 5xx error count". Aunque requiere superuser auth, si un token es comprometido, esto facilita reconocimiento masivo. El /ping es público pero solo retorna status, lo cual es correcto.
No hay endpoints de debug/test documentados. Positivo.
Stack traces en errores 500: No se documenta si los errores 500 exponen stack traces. FastAPI por defecto puede exponer detalles en modo debug.
CORS: No documentado en la spec. Si está configurado como *, cualquier sitio podría hacer requests autenticados.
Headers de seguridad: No documentados (X-Content-Type-Options, X-Frame-Options, Strict-Transport-Security, etc.).

API9:2023 — Improper Inventory Management
No hay endpoints deprecated marcados en la spec. Solo existe api/v1.
El endpoint /api/v1/portal/clients/verify-token/{token} es marcado como "legacy endpoint", lo que sugiere que es un vestigio de una versión anterior. Debería eliminarse si ya existe /verify-email/confirm.
Documentación de OpenAPI completa y bien estructurada. Todos los 477 endpoints están documentados con tags, descriptions, y security requirements. Positivo.

API10:2023 — Unsafe Consumption of APIs
Webhook de Wompi valida signatures: Sí. La documentación confirma validación HMAC-SHA256 con hmac.compare_digest() (timing-safe comparison). Siempre retorna 200 para prevenir retry abuse. Bien implementado.
Google OAuth valida id_token: La spec no documenta si valida aud, iss, exp del token de Google. Acepta un id_token string pero la validación server-side no es visible desde la spec. Si usa la librería oficial de Google (google-auth), la validación es completa. Si hace verificación manual del JWT, podría ser incompleta.

Matriz de Hallazgos
SeveridadOWASP IDEndpointRiesgoMitigaciónCRÍTICAAPI6POST /portal/clients/registerRetorna cliente existente si email existe → enumeración masiva de emails + registro ilimitadoRetornar respuesta genérica siempre; agregar rate limit 3/min/IP; CAPTCHACRÍTICAAPI2POST /portal/clients/verify-phone/sendSMS bombing: público, sin rate limit doc → envío masivo de SMS a cualquier númeroRate limit 1/min/phone, 3/min/IP; verificar que phone pertenece a cliente registradoALTAAPI1GET/PATCH/DELETE /clients/{client_id}BOLA: acceso a clientes sin school_id en path. Depende 100% del service layerAgregar school_id al path o verificar auditoría de service layerALTAAPI3POST /users (UserCreate)Schema expone is_superuser en body. Si la validación falla, privilege escalationEliminar is_superuser del schema público; usar endpoint dedicadoALTAAPI5GET /global/inventory/low-stockPúblico sin auth: expone niveles de inventario → inteligencia competitivaAgregar autenticación BearerALTAAPI4POST /documents (upload 50MB)Sin cuota de almacenamiento documentada. DoS por llenado de discoImplementar cuota por usuario/school; limitar a 10MBMEDIAAPI7SchoolUpdate.logo_url, ProductUpdate.image_urlCampos URL que podrían causar SSRF si el server hace fetchValidar contra allowlist de dominios; usar solo upload directoMEDIAAPI5GET /permissions/registryPúblico: expone catálogo completo de permisos del sistemaRequerir autenticación mínimaMEDIAAPI4POST /global/workforce/schedules/bulkOperación bulk sin límite de items documentadoLimitar a 100 items/requestMEDIAAPI8GET /healthExpone DB latency, disco, memoria, uptime. Si token de superuser se filtra → reconocimientoReducir información expuesta; separar health de métricasMEDIAAPI6POST /contacts/submitPúblico sin rate limit → spam masivo de mensajes de contactoRate limit 2/min/IP; honeypot fieldMEDIAAPI6POST /portal/ordersSin rate limit documentado para creación de órdenesRate limit 5/min/client; validar stock antes de confirmarMEDIAAPI2Login rate limit 5/min/IP onlyNo hay rate limit por username → password spraying horizontalAgregar rate limit por username: 10/horaBAJAAPI10Google OAuth /auth/google-loginNo documenta validación de aud/iss del id_tokenDocumentar y verificar uso de librería oficial; validar audienceBAJAAPI9/portal/clients/verify-token/{token}Endpoint legacy activoDeprecar formalmente o eliminarBAJAAPI8Headers de seguridad y CORSNo documentados en specDocumentar y auditar CORS, CSP, HSTSINFOAPI4Orders limit: 500Límite alto que podría causar respuestas lentasReducir max a 200

Top 10 Hallazgos Ordenados por Severidad

[CRÍTICA] Enumeración de emails en registro de portal + registro ilimitado
[CRÍTICA] SMS/Email bombing vía endpoints de verificación públicos sin rate limit
[ALTA] BOLA en endpoints con UUID directo sin school_id en path (clients, documents, contacts, delivery-zones)
[ALTA] Campo is_superuser en schema UserCreate expuesto públicamente
[ALTA] Inventario y low-stock expuestos públicamente sin autenticación
[ALTA] Upload de documentos de 50MB sin cuota de almacenamiento
[MEDIA] SSRF potencial vía campos logo_url, image_url, evidence_url
[MEDIA] Rate limiting solo por IP en login (no por username)
[MEDIA] Catálogo de permisos público facilita reconocimiento
[MEDIA] Endpoints de contacto y órdenes del portal sin rate limiting


Matriz de Riesgos (Impacto vs Probabilidad)
IMPACTO
  ALTO   │ [4] is_superuser  │ [1] Email enum    │ [3] BOLA clients
         │ [7] SSRF          │ [2] SMS bomb       │ [5] Inv. público
─────────┼───────────────────┼────────────────────┼───────────────────
  MEDIO  │ [9] Perms public  │ [8] Rate limit     │ [6] Upload 50MB
         │ [10] No rate lim  │     login          │
─────────┼───────────────────┼────────────────────┼───────────────────
  BAJO   │ [15] Legacy ep    │ [14] Google OAuth  │ [16] Headers
         │                   │                    │
─────────┼───────────────────┼────────────────────┼───────────────────
         │      BAJA         │     MEDIA          │     ALTA
         │                PROBABILIDAD

Plan de Remediación Priorizado
🔴 DÍA 1 (Inmediato — hotfix):

Agregar rate limiting a POST /portal/clients/register (3/min/IP).
Agregar rate limiting a POST /portal/clients/verify-phone/send y verify-email/send (1/min/phone, 2/min/IP).
Cambiar respuesta de registro cuando email ya existe: retornar siempre el mismo mensaje genérico ("si el email está registrado, recibirás instrucciones").
Requerir autenticación en GET /global/inventory/low-stock y GET /global/products/{product_id}/inventory.

🟠 SEMANA 1 (Sprint urgente):

Auditar service layer de TODOS los endpoints con UUID directo sin {school_id}: verificar que filtran por school_id de las escuelas del usuario autenticado.
Eliminar is_superuser del schema UserCreate público (mover a lógica interna del endpoint superuser).
Agregar rate limiting por username en login staff y portal (10 intentos/hora/username).
Reducir límite de upload de documentos a 10MB con cuota total por school.
Agregar rate limiting a POST /contacts/submit y POST /portal/orders.
Agregar autenticación a GET /permissions/registry.
Documentar y limitar operaciones bulk (max 100 items).

🟡 MES 1 (Sprint planificado):

Implementar validación de URLs en campos logo_url, image_url, evidence_url: allowlist de dominios o eliminar en favor de upload directo exclusivo.
Documentar y validar aud/iss en Google OAuth id_token (si no se está haciendo ya).
Deprecar formalmente POST /portal/clients/verify-token/{token} (legacy).
Auditar y documentar configuración CORS, headers de seguridad (HSTS, CSP, X-Frame-Options).
Reducir información en /health (separar liveness de métricas detalladas).
Implementar refresh tokens para evitar re-autenticaciones frecuentes.
Reducir limit máximo de orders de 500 a 200.
Agregar CAPTCHA o proof-of-work en flujos públicos críticos (registro, contacto, password reset).


TABLA DE SCORES FINAL
Categoria CSVNota /10bola-api16broken-auth-api26property-auth-api37resource-consumption-api45function-auth-api56sensitive-flows-api63ssrf-api77misconfiguration-api87inventory-api98unsafe-consumption-api108GLOBAL (/100)63

Nota de Seguridad Global: 6.3/10
La API demuestra buenas prácticas en varias áreas (multi-tenant isolation documentado, permisos granulares, webhook con HMAC, JWT de corta duración, schemas de update restrictivos), pero tiene deficiencias significativas en control de flujos sensibles (registro, verificación, contacto público), exposición innecesaria de datos de inventario y permisos, y depende excesivamente del service layer para la validación BOLA sin que esto sea verificable externamente. Las correcciones del Día 1 son críticas para prevenir abuso inmediato.