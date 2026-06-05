🔍 Auditoría Exhaustiva de API — Uniformes System API v2.0.0
OpenAPI 3.1 | 476 endpoints | 397 schemas | 45 tags

1. Diseño de URIs y Naming Conventions — 7/10
La API sigue el patrón /api/v1/ como prefijo de versionado, lo cual es correcto y alineado con las prácticas de Google y Microsoft. Los recursos usan kebab-case de forma consistente (garment-types, link-google, reset-password) y no se detectaron segmentos en camelCase ni caracteres especiales. Los path parameters usan snake_case (school_id, garment_type_id) de forma uniforme en los 47 parámetros de ruta detectados.
Sin embargo, se encontraron problemas significativos. Existe una inconsistencia crítica en el prefijo /global: la mayoría de endpoints globales usan /api/v1/global/garment-types, pero 3 rutas usan /api/v1/global-garment-types/ y /api/v1/global-products/ (con guion en vez de slash). Esto rompe la jerarquía de recursos. Además, los endpoints de salud (/ping, /health) no llevan el prefijo /api/v1/, lo cual podría ser intencional para probes de infraestructura pero crea una inconsistencia visual. Los operationId son auto-generados por FastAPI en 304 de 476 casos (64%), resultando en nombres como add_user_school_role_api_v1_users__user_id__schools__school_id__role_post, que degradan la experiencia de generación de SDKs.

2. Estructura de Recursos y Verbos HTTP — 6.5/10
La distribución de métodos es razonable: 233 GET, 133 POST, 30 PUT, 42 PATCH, 38 DELETE. Se detectó solamente 1 verbo explícito en URI (POST /api/v1/portal/orders/create), lo cual es un anti-pattern REST claro — debería ser simplemente POST /api/v1/portal/orders.
Se identifican 79 rutas con "acciones" como segmento final (/activate, /approve, /reject, /cancel, /pay, /reorder, /generate, etc.). Si bien esto es aceptable para operaciones RPC-style según las Microsoft REST Guidelines (que permiten "actions" en recursos), la proporción es alta (17% de todos los endpoints). Esto indica una API con fuerte sesgo hacia operaciones de negocio por encima de CRUD puro.
PUT y PATCH nunca coexisten en el mismo recurso (0 overlap), lo cual evita ambigüedad, pero algunos recursos usan PUT (schools, users, products) mientras otros usan PATCH (clients, sales, orders, employees). La consistencia sería mejor si se estandarizara un enfoque.
35 endpoints POST carecen de request body, lo que sugiere que se usan POST como trigger de acciones sin payload — patrón aceptable para acciones, pero debería documentarse mejor.

3. Agrupación y Organización — 5.5/10
La API tiene 45 tags, lo que resulta excesivo para una documentación navegable. Hay problemas de consistencia en el naming de tags: la mayoría usa Title Case ("Global Accounting", "Client Portal"), pero 3 tags usan kebab-case en minúsculas (documents, school-users, custom-roles). Esto indica módulos desarrollados por equipos o en momentos diferentes sin una convención unificada.
Se observa una duplicación estructural severa entre endpoints scoped a escuelas (/schools/{school_id}/accounting/...) y endpoints globales (/global/accounting/...). Solo el módulo de Accounting tiene 50 endpoints a nivel escuela + 70 a nivel global = 120 endpoints. El tag "Global Accounting" con 70 endpoints es inmanejable en Swagger UI.
La separación en "Accounting" vs "Global Accounting", "Products" vs "Global Products", "Reports" vs "Global Reports" genera redundancia y confusión. Un enfoque de query parameter (?scope=global) o middleware de contexto reduciría significativamente la superficie de la API. El módulo "Workforce" está bien separado con prefijo (Workforce - Shifts, Workforce - Attendance), mostrando un patrón más maduro que no se replica en otros módulos.

4. Autenticación y Seguridad — 7/10
Se usa HTTPBearer (JWT) como esquema único de autenticación, que es estándar y apropiado. De 476 endpoints, 432 están protegidos (90.7%) y 44 están abiertos (9.3%). Los endpoints abiertos incluyen health checks, login, registro y verificaciones de token, lo cual es generalmente correcto.
Sin embargo, se detectaron vulnerabilidades potenciales: POST /api/v1/portal/clients/link-google y POST /api/v1/portal/clients/unlink-google aparecen sin autenticación, lo cual es un riesgo de seguridad severo — permitiría a cualquiera vincular/desvincular cuentas de Google de clientes. Igualmente, GET /api/v1/portal/clients/me y GET /api/v1/portal/clients/me/orders aparecen sin auth en la spec (probablemente usan un esquema diferente de JWT para clientes del portal, pero esto no está documentado en la spec). El endpoint POST /api/v1/portal/orders/create sin autenticación es preocupante — podría permitir creación de órdenes sin verificar identidad.
Solo el endpoint de login menciona rate limiting en su descripción. No hay evidencia de rate limiting documentado para otros endpoints sensibles como registro, password reset o verificación de tokens. No existe esquema OAuth2 documentado para los flujos de Google Login.

5. Consistencia y Convenciones — 5/10
La inconsistencia más grave es en el patrón de respuesta de listas: 75 endpoints devuelven arrays planos (type: array) mientras solo 11 usan PaginatedResponse con metadata (items, total, skip, limit). Endpoints críticos como /schools, /users y /products devuelven arrays simples sin metadata de paginación en la respuesta, mientras /clients, /sales y /orders sí incluyen PaginatedResponse. Esto obliga al consumidor a aprender dos patrones diferentes.
Se mezclan idiomas: la gran mayoría de la API está en inglés, pero existen 3 schemas con nombres en español (CajaMenorAutoCloseResult, CajaMenorConfigResponse, CajaMenorConfigUpdate) y rutas como /caja-menor/. Hay 5 schemas auto-generados por FastAPI con nombres tipo Body_update_document_api_v1_documents__document_id__put que nunca se refactorizaron a DTOs con nombres significativos.
La convención PUT vs PATCH no es uniforme: schools/users/products usan PUT, clients/employees/orders usan PATCH. No hay un estándar claro documentado.

6. Completitud CRUD — 7.5/10
Los recursos principales tienen operaciones razonablemente completas. Schools, Users y Products tienen GET (list), GET (single), POST, PUT y DELETE. Clients tiene GET, POST, PATCH y DELETE. Sales y Orders no tienen DELETE (usan /cancel en su lugar), lo que tiene sentido para entidades transaccionales que no deberían borrarse.
Se nota la ausencia de GET /api/v1/schools con filtro por estado activo/inactivo como endpoint separado (aunque existe active_only como query param). Falta un PATCH parcial para Schools, Users y Products (solo tienen PUT que requiere payload completo). La API tiene endpoints de negocio ricos: recibos (/receipt), envío de recibos (/send-receipt), flujos de aprobación (/approve, /reject), verificación de stock (/stock-verification), lo cual muestra madurez funcional.
Sin embargo, el tag "Order Portal" tiene solamente 1 endpoint (POST /create), lo que sugiere un módulo incompleto. El tag "Dashboard" y "CFO Dashboard" tienen 1 endpoint cada uno, lo que parece insuficiente.

7. Paginación, Filtrado y Ordenamiento — 4/10
Este es uno de los aspectos más débiles. Solo 59 de ~109 endpoints de listado implementan parámetros skip/limit. El patrón de paginación usa skip/limit (offset-based), no cursor-based, lo cual es problemático para datasets grandes.
El soporte de ordenamiento es casi inexistente: solo 1 endpoint (/api/v1/orders/demand) tiene parámetro sort_by. Ningún otro endpoint de listado permite al consumidor definir el orden de resultados. Esto es un déficit severo según Microsoft REST Guidelines y Google API Design Guide, que requieren $orderBy o sort como estándar.
No hay soporte documentado para filtrado avanzado (operadores como gt, lt, contains, etc.). El filtrado es ad-hoc con query params específicos por endpoint (active_only, status, date_from, date_to). No hay estándar de filtrado unificado tipo OData o JSON:API filter[field].
La PaginatedResponse incluye total, skip y limit, lo que es correcto, pero solo 11 endpoints la usan. Los otros 75 endpoints de listado devuelven arrays sin metadata, haciendo imposible implementar paginación en el frontend sin endpoints adicionales de conteo.

8. Códigos de Respuesta HTTP — 3.5/10
Este es el aspecto más crítico. La documentación de códigos de respuesta es extremadamente limitada: solo se documentan 200, 201, 204 y 422. Los 476 endpoints tienen cero documentación de códigos 400, 401, 403, 404 y 500. Esto es una violación grave de las best practices de OpenAPI.
Desglose: GET → solo 200/422; POST → 200 o 201/422; PUT → solo 200/422; DELETE → 200 o 204/422; PATCH → solo 200/422.
El 422 (Unprocessable Entity) en todos los endpoints viene del manejo automático de validación de FastAPI/Pydantic, no de documentación intencional. El uso de 201 para creaciones POST es correcto en 65 endpoints, pero 29 POST de tipo "acción" (no creación) devuelven 200, lo cual es adecuado. Los DELETE usan 204 (30 casos) y 200 (8 casos) de forma inconsistente.
Falta documentación de: 400 (Bad Request), 401 (Unauthorized), 403 (Forbidden), 404 (Not Found), 409 (Conflict), 429 (Too Many Requests), 500 (Internal Server Error). Un consumidor no puede anticipar ni manejar errores correctamente.

9. Schemas y Modelos de Datos — 7/10
Con 397 schemas, la API tiene una buena cobertura de modelos. Se sigue un patrón claro de DTOs: *Create (53 schemas), *Update (46), *Response (131), *ListResponse (44). Esto es una buena práctica que separa la entrada de la salida y evita exponer modelos internos.
305 schemas (77%) tienen campos required definidos correctamente. 362 schemas (91%) tienen description a nivel de schema. Sin embargo, solo 68 de 2,882 propiedades individuales tienen description (2.4%), y ninguna propiedad en toda la API tiene ejemplos (0 de 2,882). Esto impacta severamente la usabilidad del "Try it out" de Swagger y la generación de documentación.
Los 5 schemas Body_* auto-generados por FastAPI (para uploads multipart) son un technical debt menor. El PaginatedResponse genérico es un buen patrón reutilizable pero se usa en muy pocos endpoints. La estructura LoginRequest/LoginResponse es limpia y bien definida.

10. Documentación y Developer Experience (DX) — 5.5/10
De 476 endpoints, 458 (96%) tienen descripciones significativas, lo cual es excelente. El endpoint de login incluye detalles sobre rate limiting y comportamiento, mostrando buenas prácticas de documentación. La API utiliza OpenAPI 3.1 (la versión más reciente), lo que es un punto positivo.
Sin embargo, la DX sufre de: 45 tags haciendo la navegación de Swagger UI abrumadora, 0 ejemplos en propiedades, 95 endpoints con schemas de respuesta vacíos (el consumidor no sabe qué espera recibir), operationIds auto-generados ilegibles que degradan la generación de SDKs, y la falta total de documentación de errores. No hay documentación de flujos de autenticación (¿cómo obtener el token? ¿cuánto dura? ¿hay refresh token?). Un desarrollador nuevo tendría que hacer reverse-engineering significativo para consumir esta API correctamente.

📊 Tabla Resumen
#CategoríaNota1Diseño de URIs y Naming Conventions7.02Estructura de Recursos y Verbos HTTP6.53Agrupación y Organización5.54Autenticación y Seguridad7.05Consistencia y Convenciones5.06Completitud CRUD7.57Paginación, Filtrado y Ordenamiento4.08Códigos de Respuesta HTTP3.59Schemas y Modelos de Datos7.010Documentación y Developer Experience5.5

🔴 Top 5 Problemas Críticos
1. Ausencia total de documentación de códigos de error (400, 401, 403, 404, 500). Ninguno de los 476 endpoints documenta respuestas de error más allá del 422 auto-generado. Esto hace imposible la integración confiable y el manejo de errores por parte del consumidor.
2. Inconsistencia severa en respuestas de listado. 75 endpoints devuelven arrays planos sin metadata vs 11 que usan PaginatedResponse. Un consumidor tiene que adivinar cuál patrón usa cada endpoint, y los arrays planos no permiten paginación real en el frontend.
3. Endpoints del portal de clientes sin autenticación documentada. link-google, unlink-google, GET /me, GET /me/orders y POST /orders/create aparecen sin esquema de seguridad. Si realmente están desprotegidos, es una vulnerabilidad grave; si usan otro esquema, falta documentarlo.
4. Ordenamiento prácticamente inexistente. Solo 1 de ~109 endpoints de listado soporta sort_by. Esto es inaceptable para una API empresarial con módulos de contabilidad, ventas e inventario donde el ordenamiento es funcionalidad crítica.
5. 95 endpoints con schemas de respuesta vacíos. Incluye operaciones importantes como /auth/change-password, /auth/link-google, y otros. El consumidor no tiene contrato sobre lo que recibirá.

🟢 Top 5 Fortalezas
1. Cobertura funcional excepcional. 476 endpoints cubriendo ventas, órdenes, inventario, contabilidad, nómina, workforce management, alteraciones, documentos, notificaciones y más. La API refleja un sistema de negocio maduro y completo.
2. Patrón DTO sólido. La separación en schemas *Create, *Update, *Response y *ListResponse (397 schemas) es una práctica profesional que protege la superficie de la API de cambios internos y evita over-posting/under-posting.
3. Versionado y estructura base correctos. El prefijo /api/v1/, uso consistente de kebab-case en URIs, snake_case en parámetros, y jerarquía de recursos anidados (/schools/{id}/products/{id}) demuestra conocimiento de diseño REST.
4. Seguridad aplicada al 90.7% de endpoints. HTTPBearer está correctamente aplicado a la gran mayoría de operaciones sensibles, con los endpoints públicos apropiados (login, registro, health checks) dejados abiertos intencionalmente.
5. Descripciones en el 96% de endpoints. La mayoría de operaciones tienen descripciones significativas que explican su propósito, incluyendo detalles como rate limiting en el login. Los schemas también tienen descripciones a nivel de objeto (91%).

📊 Nota Global: 58.5 / 100

🏁 Veredicto: ¿Lista para producción?
NO en su estado actual para APIs públicas/de terceros. Para uso interno (frontend propio del equipo que conoce la API), es funcional y puede operar, pero presenta riesgos significativos de seguridad en el portal de clientes y una deuda técnica considerable en documentación.
Para una API que se expondrá a desarrolladores externos o equipos que no son los autores, requiere trabajo sustancial en documentación de errores, estandarización de respuestas de listado y corrección de seguridad.

🗺️ Roadmap de Mejoras Priorizadas
Quick Wins (1-2 semanas)
QW1 — Documentar códigos de error HTTP. Agregar respuestas 401, 403, 404 al menos a todos los endpoints protegidos. FastAPI permite esto con responses={401: {...}, 404: {...}} en cada ruta. Impacto: transforma la nota de "Códigos de respuesta" de 3.5 a 7+.
QW2 — Corregir seguridad del portal. Verificar y documentar el esquema de autenticación de los 16 endpoints del portal que aparecen sin security. Si usan un JWT diferente, registrar un segundo securityScheme en la spec.
QW3 — Normalizar tags inconsistentes. Renombrar documents → Documents, school-users → School Users, custom-roles → Custom Roles. Son 3 cambios de string en el código.
QW4 — Corregir ruta con verbo. Renombrar POST /api/v1/portal/orders/create → POST /api/v1/portal/orders.
QW5 — Agregar operationId legibles. Reemplazar los 304 IDs auto-generados con nombres explícitos en cada ruta (operation_id="listSchools", operation_id="createSale"). Mejora dramáticamente la generación de SDKs.
Cambios Estructurales (1-3 meses)
CE1 — Estandarizar PaginatedResponse en TODOS los endpoints de listado. Migrar los 75 endpoints que devuelven arrays planos al wrapper PaginatedResponse con items, total, skip, limit. Es un breaking change que requiere coordinación con frontends.
CE2 — Implementar soporte de ordenamiento. Agregar parámetros sort_by y sort_order (asc/desc) a todos los endpoints de listado. Definir campos ordenables por recurso.
CE3 — Agregar ejemplos a schemas. Poblar ejemplos en las 2,882 propiedades de los 397 schemas. Esto transforma completamente la experiencia del "Try it out" y la generación de documentación.
CE4 — Consolidar endpoints Global vs School. Evaluar si los ~120 endpoints de Accounting (50 school + 70 global) pueden reducirse con un parámetro de scope, reduciendo la superficie total y la complejidad cognitiva.
CE5 — Corregir la inconsistencia /global-garment-types vs /global/garment-types. Unificar bajo el patrón /global/ consistente. Es un breaking change menor pero necesario para coherencia.
CE6 — Implementar filtrado estandarizado. Definir un patrón de query parameters uniforme para filtrado (por ejemplo, field_name=value, date_from, date_to, status) con documentación explícita de los filtros disponibles por endpoint.