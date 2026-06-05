# OWASP v4 Rebuttal — Hallazgos ya Mitigados

Fecha: 2026-04-13
Contexto: El auditor externo evaluo la API via OpenAPI spec (black-box). Varios hallazgos marcados como riesgos ya estan mitigados en codigo. Este documento presenta evidencia para re-evaluacion.

---

## API1 — BOLA en endpoints shortcut: SECURE

**Hallazgo del auditor:** Endpoints `/sales/{sale_id}`, `/orders/{order_id}`, `/sale-changes/{change_id}/details` acceden recursos por UUID sin school_id en path.

**Evidencia de mitigacion:**
- `backend/app/api/routes/sales.py:186-187` — Query filtra `Sale.school_id.in_(user_school_ids)`
- `backend/app/api/routes/orders.py:335` — Query filtra `Order.school_id.in_(user_school_ids)`
- `backend/app/api/routes/sales.py:502-503` — Sale changes join con Sale y filtra por `user_school_ids`
- `backend/app/api/routes/payments.py:219-221` — Valida `order.client_id != current_client.id` -> 403
- `backend/app/api/routes/notifications.py:102-130` + `services/notification.py:180-193` — Filtra por user_id AND school_ids

**Conclusion:** Todos los endpoints shortcut validan ownership. Score deberia subir de 6 a 7-8.

---

## API8 — Stack traces en produccion: SECURE

**Hallazgo del auditor:** "No documentado si errores 500 exponen stack traces."

**Evidencia:**
- `backend/app/main.py:300-314` — Global exception handler devuelve `{"detail": "Internal server error"}` sin stack trace
- Stack traces solo en logs server-side via `logger.exception()`
- Metricas de 5xx + alertas Telegram automaticas

---

## API10 — Google OAuth sin validacion: SECURE

**Hallazgo del auditor:** "Sin descripcion de validacion. No se puede confirmar si valida aud, iss, exp."

**Evidencia:**
- `backend/app/services/google_auth.py:22-51` — Usa `google.oauth2.id_token.verify_oauth2_token()`
- Linea 29: `clock_skew_in_seconds=10` para tolerancia
- Linea 32: Valida audience contra `self._client_ids`
- Linea 36: Requiere `email_verified=True`
- Issuer y signature validados por la libreria oficial de Google

---

## API4 — Bulk operations: SECURE (con fix aplicado)

- `BulkCostUpdateRequest.updates`: `max_length=100` (productos)
- `BulkScheduleCreate.schedules`: `max_length=100` (FIX aplicado 2026-04-13)
- Documents: 50MB max file + 2GB total quota

---

## API6 — contacts/submit: SECURE

**Hallazgo:** "Publico, sin auth, sin rate limit documentado."

**Evidencia:** `backend/app/api/routes/contacts.py:44` — `@limiter.limit("10/minute")`

---

## Fixes Aplicados en esta Iteracion (2026-04-13)

1. Rate limit `3/minute` en password-reset/request y password-reset/confirm
2. `max_length=100` en `BulkScheduleCreate.schedules`
3. `require_global_permission("clients.view")` en GET /clients/{id}
4. `require_global_permission("clients.edit")` en PATCH /clients/{id}
