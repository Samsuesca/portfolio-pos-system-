# Dimensión 5 — Datos Personales (Habeas Data)

> **Última actualización:** 2026-05-04
> **Owner:** Carmen Consuelo Ríos Cartagena (titular RUT, responsable del tratamiento) + Angel Suesca (encargado técnico de facto)
> **Criticidad global:** 🔴 ALTA
> **% Formalización estimado:** 5%
> **Fuentes documentales:** auditoría de código sobre branch `main` (2026-05-04) + DB `uniformes_prod_snapshot` (last_sale 2026-05-01).

---

## Resumen ejecutivo

UCR procesa datos personales de tres titulares distintos sin **ningún** marco formal de cumplimiento de la Ley 1581 de 2012:

1. **Padres** (clientes web portal): nombre, teléfono, correo, contraseña hasheada, dirección.
2. **Menores de edad** (estudiantes): `student_name`, `student_grade` capturados en `/registro` sin consentimiento informado del tutor — categoría **especialmente protegida** por el Decreto 1377 Art. 7 y la doctrina actual de la SIC.
3. **Empleados, contratistas y vendors**: nombre, dirección, teléfono, correo (en `payroll`, `vendor`, `contact`).

Adicionalmente:
- No hay **Política de Tratamiento de Datos** publicada.
- No hay **Aviso de Privacidad** ni mecanismo de consentimiento informado en `/registro` (verificado en `web-portal/app/registro/page.tsx`).
- No hay registro en el **RNBD** (Registro Nacional de Bases de Datos) de la SIC, obligatorio para responsables que cumplan los criterios de la Resolución 32593/2024.
- Wompi y Telegram reciben PII como **encargados** sin contratos de transmisión/transferencia firmados.

Las sanciones de la SIC son materialmente más altas que las de DIAN para este perfil de negocio: hasta **2.000 SMMLV (~$2.840M COP en 2026)** por infracción (Art. 23 Ley 1581).

---

## Marco normativo aplicable

| Norma | Aplicación a UCR |
|-------|------------------|
| Constitución Política, Art. 15 | Habeas data como derecho fundamental |
| **Ley 1581 de 2012** | Ley estatutaria de protección de datos personales — núcleo del régimen |
| **Decreto 1377 de 2013** | Reglamentación: aviso de privacidad, política de tratamiento, autorización |
| Decreto 886 de 2014 | Reglamenta el RNBD |
| Decreto 1074 de 2015 (DUR) | Compila las normas anteriores en libro reglamentario |
| **Resolución SIC 32593 de 2024** | Actualiza criterios de inscripción RNBD; aplica a responsables con activos > 100.000 UVT o ingresos > 100.000 UVT |
| Circular Externa 002 de 2015 SIC | Lineamientos sobre transferencia internacional |
| Ley 1266 de 2008 | Habeas data financiero — aplica a `accounts_receivable` con riesgo crediticio |
| Resolución SIC 76434 de 2012 | Niños, niñas y adolescentes: prevalencia del interés superior |
| Reglamento (UE) 2016/679 (GDPR) | Solo si UCR ofrece servicios a residentes UE — **no aplica hoy**, monitorear si v3.2 SaaS atrae clientes externos |

---

## Estado actual

### PII en la base de datos (auditoría modelo a modelo, 2026-05-04)

| Modelo | Campos PII | Categoría | Observaciones |
|--------|------------|-----------|---------------|
| `clients` ([backend/app/models/client.py](../../../backend/app/models/client.py)) | `name`, `phone`, `email`, `address`, `whatsapp_opted_in` | Datos personales generales | `whatsapp_opted_in` es la única bandera de consentimiento existente — pero solo para canal, no para tratamiento global |
| `clients` (registro web) | `student_name`, `student_grade` (vía relacionamiento padre↔estudiante) | **Datos sensibles de menores** | Categoría especialmente protegida. Requiere autorización explícita del tutor + finalidad delimitada |
| `contacts` ([backend/app/models/contact.py](../../../backend/app/models/contact.py)) | `name`, `email`, `phone` | Datos personales generales | Captados desde formulario público de contacto / soporte |
| `payroll` ([backend/app/models/payroll.py](../../../backend/app/models/payroll.py)) | `name`, `email`, `phone`, `address` | Datos personales de empleados | Vinculados con dimensión 4 (laboral) |
| `vendor` ([backend/app/models/vendor.py](../../../backend/app/models/vendor.py)) | `name`, `phone`, `email` | Datos personales o empresariales | Si vendor es persona natural → aplica Ley 1581 |
| `users` ([backend/app/models/user.py](../../../backend/app/models/user.py)) | `email`, password hasheado (bcrypt), `permissions_version` | Datos personales internos | Usuarios del sistema (vendedores) |
| `payment_transactions` ([backend/app/models/payment_transaction.py](../../../backend/app/models/payment_transaction.py)) | `reference` + `full Wompi response stored for reference` | PII derivada (datos de pagador desde Wompi) | La respuesta cruda de Wompi puede incluir datos del pagador, IP, dispositivo |
| `telegram_subscriptions` ([backend/app/models/telegram_subscription.py](../../../backend/app/models/telegram_subscription.py)) | `user_id` ↔ `chat_id` Telegram | PII derivada | El chat_id permite re-identificar a la persona en Telegram |
| `audit_log` ([backend/app/models/audit_log.py](../../../backend/app/models/audit_log.py)) | `data_before`, `data_after` (JSON) | Espejo arbitrario de PII | Por diseño, contiene snapshots de cualquier modelo modificado, incluyendo PII |
| `email_log` ([backend/app/models/email_log.py](../../../backend/app/models/email_log.py)) | Cuerpos de correo y destinatarios | PII en tránsito archivada | Conservación indefinida = riesgo de retención excesiva |

### Captura en interfaces

| Superficie | Archivo | Datos capturados | Aviso/consentimiento |
|-----------|---------|------------------|----------------------|
| Web portal — registro | [web-portal/app/registro/page.tsx](../../../web-portal/app/registro/page.tsx) | `email`, `name`, `phone`, `password`, `student_name`, `student_grade`, `school_id` | **NINGUNO** — no hay checkbox de aceptación, no hay link a política |
| Web portal — pago | [web-portal/app/pago/](../../../web-portal/app/pago/) | Datos pasan a Wompi (PCI-DSS delegado) | Wompi tiene su propia política, pero UCR debe declararla como encargado |
| Web portal — encargos | [web-portal/app/encargos-personalizados/](../../../web-portal/app/encargos-personalizados/) | Datos del estudiante + medidas | **NINGUNO** |
| Admin portal — login/dashboard | [admin-portal/app/(dashboard)/](../../../admin-portal/app/(dashboard)/) | Operación interna; expone PII a operadores | Sin política interna documentada |
| Mobile app | [mobile/app/(app)/new-client.tsx](../../../mobile/app/(app)/new-client.tsx), `new-sale.tsx`, `new-order.tsx` | Captura idéntica al desktop | Sin política, sin aviso |

### Encargados del tratamiento (terceros con acceso a PII)

| Tercero | Datos compartidos | Contrato de transmisión/transferencia |
|---------|-------------------|---------------------------------------|
| **Wompi** (pasarela de pagos) | Nombre, correo, monto, referencia, IP del pagador | Por cláusula en T&C de Wompi (no firmado bilateralmente). Falta acuerdo específico Art. 25 Decreto 1377 |
| **Telegram Bot API** | `chat_id` + contenido de notificaciones (incluyendo nombres de clientes en alertas de venta) | **No existe** acuerdo. Telegram opera bajo legislación rusa/dubai — transferencia internacional sin garantías |
| **Resend** (servicio SMTP) | `email`, contenido de correos (códigos de verificación, recibos, recuperación de contraseña, confirmación de pedidos) | Confirmado 2026-05-04 (discovery): Resend es el proveedor productivo. Transferencia internacional (datos a servidores de Resend en USA). Pendiente firmar/archivar DPA específico bajo Decreto 1377 |
| **Hosting Vultr** (VPS 104.156.247.226) | DB completa | Por T&C de Vultr; transferencia internacional. **No se ha evaluado** si Vultr cumple Estándares de Seguridad de la SIC |
| **Backups** | DB completa con todas las PII | **Confirmado 2026-05-04 (auditoría server-handler en VPS prod):** los backups son **manuales y esporádicos**, sin cifrado, sin offsite. Último dump conocido: `/tmp/uniformes_prod_20260411.dump` (12 abr 2026, hace ~34 días). Dumps históricos en `/var/backups/` y `/root/backups/` en texto plano. **`/tmp` está sujeto a limpieza periódica de `systemd-tmpfiles-clean.timer`** → riesgo de pérdida del único respaldo relativamente reciente |

### Cumplimiento formal — checklist

- ❌ Política de Tratamiento de Datos publicada y vigente.
- ❌ Aviso de privacidad en /registro y /encargos-personalizados.
- ❌ Mecanismo de consentimiento informado (checkbox + log de aceptación con timestamp).
- ❌ Inscripción en el RNBD (Registro Nacional de Bases de Datos) de la SIC.
- ❌ Procedimiento documentado para atender derechos del titular (consulta, rectificación, supresión, revocatoria, portabilidad).
- ❌ Designación formal de **Oficial de Protección de Datos** (no obligatorio para PYMES, pero recomendado).
- ❌ Contratos de transmisión/transferencia con encargados (Wompi, Telegram, hosting).
- ❌ Políticas de retención y eliminación segura.
- ❌ Cifrado en reposo de PII especialmente sensible (la DB no usa columnas cifradas; **confirmado 2026-05-04: el disco del VPS NO tiene LUKS ni dm-crypt — `lsblk -f` muestra `vda2` como `ext4` puro, `/etc/crypttab` vacío, `dmsetup status` reporta "No devices found"**). Los datos están en texto claro a nivel de almacenamiento Vultr.
- ⚠️ Cifrado en tránsito: HTTPS sí (Caddy/Nginx + Let's Encrypt) — confirmado en producción.
- ⚠️ Hash de contraseñas con bcrypt: implementado correctamente (verificado en `backend/app/services/auth.py`).
- ⚠️ Audit log existe pero **registra PII completa** sin tokenización ni anonimización.

---

## Gaps identificados

### Gap 5.1 — Datos de menores capturados sin consentimiento del tutor 🔴 CRÍTICO

**Problema:** el formulario de `/registro` captura `student_name` y `student_grade` durante el registro del padre/madre. El menor es titular del dato; el tutor debe autorizar expresamente.

**Marco:** Decreto 1377 Art. 7 (parcialmente vigente; aplican Resolución SIC 76434/2012 y doctrina sobre interés superior del menor).

**Riesgo:** sanción SIC + responsabilidad reputacional desproporcionada (un caso público de "uniformes captura datos de niños sin permiso" daña marca permanentemente).

**Acción inmediata:**
1. Añadir en `/registro` paso explícito: "Autorizo el tratamiento de los datos de mi(s) hijo(s) [nombre] con la finalidad exclusiva de personalización de pedidos escolares".
2. Loggear timestamp + versión de política + IP de aceptación en una tabla nueva `data_processing_consents`.
3. Permitir revocatoria desde `/mi-cuenta`.

---

### Gap 5.2 — Sin Política de Tratamiento publicada 🔴

**Problema:** el sitio no tiene ninguna página `/privacidad` ni link en footer. Esto es prerrequisito de cualquier captura legal.

**Acción:**
1. Redactar Política de Tratamiento (plantillas SIC disponibles, adaptar al contexto UCR).
2. Publicar en `/privacidad` (web portal y admin portal) con versionado (`v1`, fecha de vigencia).
3. Footer con link permanente: "Política de privacidad".
4. Notificar a clientes existentes (correo masivo) con periodo de oposición de 30 días hábiles antes de aplicar a la base existente.

---

### Gap 5.3 — Sin Aviso de Privacidad en captura 🔴

**Problema:** todo formulario que captura PII debe mostrar el aviso de privacidad **al momento de la captura**, no enterrado en T&C.

**Acción:**
- Componente reutilizable `<PrivacyNotice />` que se renderice arriba del botón submit en:
  - `web-portal/app/registro/page.tsx`
  - `web-portal/app/encargos-personalizados/page.tsx`
  - `web-portal/app/soporte/page.tsx`
  - `mobile/app/(app)/new-client.tsx`
  - `mobile/app/(app)/new-order.tsx`

---

### Gap 5.4 — RNBD no inscrito 🟠

**Problema:** la inscripción en el RNBD es obligatoria para responsables del tratamiento que superen los topes de la Resolución SIC 32593/2024 (activos o ingresos > 100.000 UVT ≈ $4.700M COP en 2024). Verificar si UCR los supera.

**Estado:** dado el patrimonio actual ($89M, ver `03-contable.md`) y los ingresos 2026 proyectados ($150M-$180M), UCR está **muy por debajo** del tope de inscripción obligatoria.

**Acción:**
1. Confirmar con contador la cifra exacta de activos e ingresos.
2. **Si está bajo el tope**: documentar la exención en este archivo y revisar anualmente.
3. **Si supera el tope**: inscribir las bases de datos en el RNBD (gratuito, vía SIC). Plazo: dos meses desde que se supera el tope.

---

### Gap 5.5 — Sin contratos de transmisión con encargados 🟠

**Problema:** Wompi, Telegram, proveedor SMTP y Vultr procesan PII sin contrato de transmisión específico (Art. 25 Decreto 1377). Aunque algunos (Wompi) tienen cláusulas en sus T&C que podrían bastar, la SIC exige documentación trazable.

**Acción:**
1. Revisar T&C de cada proveedor y archivar copia firmada/aceptada en `documentos/Legal/encargados/`.
2. Para Telegram: evaluar si se puede prescindir de mandar nombres de clientes en alertas — basta con el ID interno.
3. Documentar en este archivo la relación (responsable ↔ encargado) y la finalidad.

---

### Gap 5.6 — Logs y audit_log con PII en claro 🟡

**Problema:** `email.py::send_verification_email` hace `logger.debug(f"[DEV] Verification code for {email}")`. En producción `LOG_LEVEL` debería ser `INFO`, pero si por error queda en `DEBUG`, los emails fluyen a la VPS y a VultrUI Log Explorer (encargado adicional no contemplado).

**Acción:**
1. Implementar **filtro de PII** en `structlog` para enmascarar emails y teléfonos en mensajes (`s***@dominio.com`).
2. Revisar política de retención de `email_log` y `audit_log` — proponer purga automática a 24 meses con anonimización opcional.
3. Verificar `LOG_LEVEL` de producción (nunca debug).

---

### Gap 5.7 — Sin procedimiento para derechos del titular 🟡

**Problema:** no hay canal documentado para que un titular ejerza derechos (consulta, rectificación, supresión, revocatoria). Plazos legales: 10 días hábiles para consulta, 15 para reclamo (Art. 14, 15 Ley 1581).

**Acción:**
1. Habilitar correo dedicado: `privacidad@yourdomain.com` (alias).
2. Agregar formulario en `/soporte` con tipo "ejercicio de derechos habeas data".
3. Procedimiento interno: responsable (Angel + Carmen Consuelo), SLA, formato de respuesta.
4. Tabla `data_subject_requests` para trazabilidad.

---

### Gap 5.8 — Sin política de retención y eliminación 🟡

**Problema:** los datos se conservan indefinidamente. Ley 1581 exige finalidad temporal.

**Acción:**
1. Política de retención por categoría:
   - Clientes activos: mientras dure relación + 5 años (prescripción civil).
   - Clientes inactivos > 3 años: anonimización de PII directa (mantener histórico de ventas con `client_id` reemplazado por hash).
   - Datos de menores: eliminación automática 1 año después de que el menor egrese del colegio (requiere campo `expected_graduation_year`).
   - Logs/audit: 24 meses.
2. Job `cron` mensual que aplique la política. Reportar a Telegram el número de registros anonimizados.

---

## Roadmap de cierre

> **Lógica de priorización:** sanciones SIC son altas en cuantía (hasta 2.000 SMMLV) **y** la falta de política bloquea la venta SaaS v3.2. La urgencia 🔴 viene tanto de cumplimiento legal **estricto** (a diferencia de tributario donde el volumen mitiga) como de habilitar comercialización.

| ID | Acción | Prioridad | Plazo | Costo estimado | Dependencia |
|----|--------|-----------|-------|----------------|-------------|
| D1 | Redactar Política de Tratamiento + Aviso de Privacidad (plantilla SIC + adaptación) | 🔴 | <30 días | $0 si DIY, $300k–$800k con asesor | — |
| D2 | Publicar `/privacidad` y `/terminos` + footer link en web-portal y admin-portal | 🔴 | <30 días | 1 día dev | D1 |
| D3 | Componente `<PrivacyNotice />` + checkbox de aceptación en `/registro`, `/encargos`, `/soporte` y mobile | 🔴 | <30 días | 2 días dev | D1, D2 |
| D4 | Tabla `data_processing_consents` + log de aceptación (versión política, IP, timestamp) | 🔴 | <30 días | 1 día dev + migración Alembic | D3 |
| D5 | Habilitar consentimiento específico para datos de menores en flujo de registro y encargos | 🔴 | <30 días | 1 día dev | D3, D4 |
| D6 | Procedimiento + canal para derechos del titular (`privacidad@`, formulario, SLA) | 🟠 | <60 días | $0 + 1 día dev | D1 |
| D7 | Filtro de PII en `structlog` (enmascarar emails/teléfonos en logs) | 🟠 | <60 días | 1-2 días dev | — |
| D8 | Política de retención y job de anonimización por categoría | 🟠 | <90 días | 3-5 días dev + decisión política | D1 |
| D9 | Inscripción RNBD si supera topes (verificar con contador) | 🟡 | <60 días tras confirmación | $0 (gratuito SIC) | T2 (contador) en `02-tributario.md` |
| D10 | Contratos de transmisión con Wompi, Telegram, SMTP, Vultr — recopilar/firmar y archivar | 🟠 | <60 días | $0 | — |
| D11 | Cambio de licencia del repo (de MIT a propietaria) si v3.2 va a comercializarse | 🟠 | Antes v3.2 (oct 2026) | $0 + decisión owner | Ver dimensión 8 (tecnológico) |

---

## Conexión con releases técnicos

| Release | Requisito habeas data | Driver |
|---------|----------------------|--------|
| v3.0 (abr 2026) | D1, D2, D3, D5 — captura legal de datos en producción | Cumplimiento mínimo viable |
| v3.1 (jun 2026) | D4, D6, D7 — operación con derechos del titular y PII en logs sanitizada | Higiene operativa pre-expansión |
| v3.2 (oct 2026) | **Todo el roadmap completo + multi-tenant**: cada cliente SaaS es un responsable distinto y necesita su propia política, su propio RNBD y su propio canal de derechos | Habilitador comercial — sin esto el SaaS es invendible a clientes que sí entiendan el riesgo |

> **Nota técnica v3.2:** el modelo multi-tenant debe contemplar que la política de tratamiento se almacena por tenant (`tenant_privacy_policy_versions`) y que los consentimientos están atados al tenant correcto. Esto se cruza con la dimensión 8 (tecnológico) en lo relativo a aislamiento de datos.

---

## Discovery — Respuestas (2026-05-04)

1. **Proveedor SMTP**: ✅ **Resend**. Transferencia internacional (servidores USA). Requiere DPA específico bajo Decreto 1377 — incluido en Gap 5.5.

2. **Backups de DB**: ✅ Confirmado por auditoría VPS — **manuales, esporádicos, sin cifrado, sin offsite**. Último dump conocido en `/tmp/uniformes_prod_20260411.dump` (12 abr 2026, ~34 días). Detalle completo trasladado a `07-operacional.md` Gap 7.1 (donde se trata como hallazgo crítico operacional). El impacto en privacidad es: cualquier persona con acceso `root` al VPS lee toda la PII en texto plano de los `.sql`/`.dump` y nada los protege fuera del VPS.

3. **Acceso interno a PII**: ✅ **Acceso DB directo: solo Angel Suesca.** Admin-portal restringido por roles del sistema de permisos granulares. Cumple principio de mínimo privilegio en la capa aplicación. Brecha: acceso `root` SSH al VPS (Angel exclusivo, ver cruzado con `07-operacional.md` Gap 7.3 bus factor humano).

4. **Solicitudes de eliminación/copia por titulares**: ✅ **Ninguna recibida** hasta 2026-05-04. No hay obligaciones latentes pendientes. Esto no exime de habilitar el canal hacia adelante (Gap 5.7).

5. **Cifrado en VPS**: ✅ **NO está cifrado.** Confirmado en auditoría: `vda2` ext4 puro, sin LUKS/dm-crypt, sin filesystem cifrado. Los datos están en claro a nivel de almacenamiento Vultr. Cualquier acceso administrativo al hipervisor (vía soporte de Vultr o compromiso interno de su personal) lee la DB y los dumps directamente. **Recomendación:** evaluar cifrado de columnas sensibles en la DB (al menos campos como `email`, `phone`, `address` con `pgcrypto`) y cifrado de dumps en backup. Cifrado de disco completo retroactivo en el mismo VPS no es trivial (requiere recrear).

6. **Telegram bot — PII en alertas**: ✅ **No envía nombres reales de clientes.** Confirmado por owner. Mitiga el riesgo de transferencia internacional vía Telegram. Mantener vigilancia al añadir nuevos tipos de alertas para no introducir PII por error.

7. **Datos de menores**: ✅ **Decisión: anonimizar tras 1 año del egreso.** Mantener histórico de ventas con `client_id` reemplazado por hash, eliminar `student_name` y `student_grade`. Diseño técnico en Gap 5.8 (job mensual de anonimización por categoría).

8. **Licencia del software**: ✅ **MIT fue por template, no intencional.** Decisión de cambio trasladada a `08-tecnologico.md` Gap 8.1 (decisión de modelo propietaria/open-core/BSL pendiente).

9. **Incidentes de privacidad documentados**: ✅ **Ninguno.** No hay obligación de reporte SIC pendiente. Establecer procedimiento para futuros incidentes (Gap 5.7 ampliado).

10. **Contacto formal de privacidad**: ✅ **Carmen Consuelo Ríos Cartagena** (titular del RUT). Implicación operativa: las solicitudes de titulares llegan a su correo personal salvo que se decida después crear alias `privacidad@`. Plazos legales (Art. 14, 15 Ley 1581): 10 días hábiles consulta, 15 días reclamo — Carmen debe estar en capacidad de responder a tiempo o delegar formalmente por escrito a Angel.

---

## Decisiones pendientes del owner

- [ ] Aprobar plantilla de Política de Tratamiento (DIY con SIC vs. asesor externo).
- [ ] Aceptar el diseño del flujo de consentimiento en /registro (1-paso vs. 2-pasos con detalle).
- [x] **2026-05-04** — Datos de menores: anonimizar tras 1 año del egreso, conservando histórico de ventas con hash.
- [ ] Cambio de licencia MIT → propietaria (trasladado a `08-tecnologico.md`).
- [x] **2026-05-04** — Punto de contacto formal de privacidad: **Carmen Consuelo Ríos Cartagena** (titular RUT).
- [ ] **Nueva**: Decidir si Carmen otorga poder escrito a Angel para atender en su nombre las solicitudes de titulares dentro de los plazos legales (recomendación: sí, para evitar incumplir SLA de 10/15 días).
- [ ] **Nueva**: Evaluar cifrado de columnas sensibles en DB con `pgcrypto` o `cryptography` a nivel aplicación (no es bloqueante pero reduce impacto ante compromiso del VPS).
