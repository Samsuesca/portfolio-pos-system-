# Google OAuth — Runbook de activación en producción

> **Versión:** 1.0 — 2026-05-24
> **Owner:** Angel Suesca
> **Alcance:** activación del login con Google en `frontend/` (Tauri desktop) y `admin-portal/` (Next.js) de UCR, para el equipo operativo (Consuelo, Felipe, Salomé, Santiago, Angel).
> **Estado backend:** Google OAuth ya implementado (`/auth/google-login`, `/auth/link-google`, modelo `User` con `google_id` + `auth_provider`). Solo requiere configuración + saneo de cuentas + validación.

---

## Contexto

El sistema **ya soporta Google Sign-In** end-to-end. El endpoint `/auth/google-login` valida el `id_token` contra Google, busca el usuario por `google_id` y, si no encuentra, **vincula automáticamente por email** (auto-link) poniendo `auth_provider="both"`. No crea cuentas nuevas — el usuario debe existir previamente con el email Google verificado.

**Pre-condición crítica:** `User.email` en la DB debe estar en **minúsculas** y coincidir con el email que devuelve Google. Si no coincide, el auto-link falla con 403 "Contacta al administrador".

---

## Checklist Google Cloud Console (pre-deploy)

En el proyecto Google Cloud asociado a UCR (https://console.cloud.google.com):

- [ ] **OAuth consent screen** publicada y en estado `In production` (no `Testing`).
- [ ] **Authorized domains**: `yourdomain.com` (y subdominios relevantes).
- [ ] **OAuth 2.0 Client ID (Web)** activo:
  - [ ] *Authorized JavaScript origins*: `https://yourdomain.com`, `https://admin.yourdomain.com` (o el host del admin-portal), `http://localhost:5173` (dev Tauri), `http://localhost:3002` (dev admin).
  - [ ] *Authorized redirect URIs*: igual que origins si el flujo es popup/credential. Si se migra a flujo redirect, agregar el callback.
- [ ] **Scopes**: `email`, `profile`, `openid` (mínimos para auto-link).
- [ ] **Test users** (si la app está en Testing por algún motivo): incluir los 5 emails del equipo.

> Una sola OAuth Client puede servir a frontend Tauri + admin-portal si los orígenes están autorizados. El backend acepta múltiples client IDs vía la property `Settings.google_client_ids` (lista derivada de `GOOGLE_CLIENT_ID` env var, ampliable a futuro con `,` separado si se necesita).

---

## Variables de entorno (prod)

| Componente | Variable | Valor |
|---|---|---|
| Backend (`backend/.env` o systemd Environment) | `GOOGLE_CLIENT_ID` | el Client ID del paso anterior |
| Tauri (`frontend/.env.production`) | `VITE_GOOGLE_CLIENT_ID` | el **mismo** Client ID |
| Admin portal (`admin-portal/.env.production`) | `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | el **mismo** Client ID |

**Punto crítico:** los 3 valores deben ser idénticos. El backend verifica que `idinfo["aud"] == GOOGLE_CLIENT_ID` (en `app/services/google_auth.py:32`). Si difieren, todo login Google falla con 401 "Token de Google invalido o expirado".

---

## Pasos de replicación a producción

### 1. Sanear cuentas del equipo (DB prod)

Los emails deben ser Gmail reales en minúsculas. El script `backend/scripts/update_team_emails.py` aplica los 5 updates de forma idempotente.

```bash
# Desde la máquina con acceso a la DB de prod, dentro del backend
cd backend

# Dry-run primero — verifica qué cambiaría sin persistir
DATABASE_URL=postgresql+asyncpg://USER:PASS@PROD_HOST:5432/uniformes_db \
  venv/bin/python -m scripts.update_team_emails

# Si el dry-run se ve bien, aplicar
DATABASE_URL=postgresql+asyncpg://USER:PASS@PROD_HOST:5432/uniformes_db \
  venv/bin/python -m scripts.update_team_emails --commit
```

**Salvaguardas del script:**
- Aborta si algún email objetivo colisiona con otro usuario.
- Aborta si algún username no existe (no crea cuentas).
- Idempotente: re-ejecutar es seguro, skip si ya está al valor objetivo.

### 2. Deploy del fix de email-lowercase

`backend/app/services/user.py` (`create_user`/`update_user`) ahora normaliza `email.lower()` antes de guardar. Sin este fix, futuras altas de usuarios con email en mayúsculas reproducen el bug.

```bash
# En el VPS
cd /opt/uniformes-system-v2  # o la ruta real
git pull origin main           # asumiendo que el fix está mergeado a main
systemctl restart uniformes-api
```

### 3. Deploy de los frontends

Tauri y admin-portal deben tener `VITE_GOOGLE_CLIENT_ID` / `NEXT_PUBLIC_GOOGLE_CLIENT_ID` set y haber sido construidos con esa env var. Si ya estaba set, no hay nada nuevo aquí — solo verificar build reciente.

---

## Validación post-deploy

### A. Backend — verificar que el endpoint responde

```bash
# Health check
curl https://yourdomain.com/health

# Sin token (debe devolver 422 por validación de schema, no 500)
curl -X POST https://yourdomain.com/auth/google-login \
  -H "Content-Type: application/json" \
  -d '{"id_token": "invalid"}'
# Esperado: 401 "Token de Google invalido o expirado"
```

### B. Validación humana con el primer usuario piloto (Angel)

1. Angel abre admin-portal en prod, click "Iniciar con Google".
2. Selecciona su cuenta `suescapsam@gmail.com`.
3. **Resultado esperado:** entra al sistema. En la DB se ve que `users.google_id` quedó seteado y `auth_provider` pasó de `local` a `both` para el username `samuel`.
4. Verificar en `auth_logs` o `users.last_login` que el evento quedó registrado.

```sql
-- Verificación SQL (prod, solo lectura)
SELECT username, email, auth_provider, google_id IS NOT NULL AS linked, last_login
FROM users
WHERE username IN ('samuel', 'chelorios', 'felipe', 'salome', 'santimazo')
ORDER BY username;
```

### C. Rollout al resto del equipo

Después de que Angel valide:
1. **Santiago y Salomé** (Gmail puro): mismo flujo, debe funcionar sin fricción.
2. **Consuelo y Felipe**: usan sus Gmail personales (`chelorios74@gmail.com`, `felipesuescarios@gmail.com`). Si esos son cuentas Google reales (no solo emails con formato gmail), el flujo funciona igual.
3. Cada uno hace su primer login, el auto-link los vincula, y `auth_provider` pasa a `both`. **Su password sigue funcionando** como respaldo (no se rompe nada).

### D. Tauri desktop — caso especial

Google **bloquea OAuth en webviews embebidos** desde 2021 (error `disallowed_useragent`). El login con `@react-oauth/google` puede:

- **Funcionar** con el flujo de credential / One Tap si Google no detecta el WebView de Tauri como agresivo, o
- **Fallar** con error 403 `disallowed_useragent`.

**Plan B si falla:** flujo de navegador externo del sistema con `@tauri-apps/plugin-shell` (abrir URL Google en el browser por defecto) + redirect loopback a `http://localhost:<port>/callback`. Requiere desarrollo adicional (3-5h estimadas). No bloquea el admin-portal.

---

## Rollback

Si después del rollout aparecen problemas:

1. **El password sigue funcionando** para todos: `auth_provider="both"` permite login por usuario/clave. Nadie queda fuera.
2. **Desvincular Google de una cuenta** específica:
   ```bash
   # Vía endpoint (requiere password local activo)
   curl -X POST https://yourdomain.com/auth/unlink-google \
     -H "Authorization: Bearer <jwt-del-user>"
   ```
   Esto resetea `google_id=NULL` y `auth_provider="local"`.
3. **Deshabilitar Google completamente** (de emergencia): vaciar `GOOGLE_CLIENT_ID` en `.env` del backend y reiniciar. `GoogleAuthService` queda con lista vacía de client IDs y rechaza todos los logins Google con 401 (vía mensaje "Google OAuth no configurado"). El password sigue funcionando.

---

## Endurecimiento opcional (Fase 3, post-piloto estable)

Una vez todo el equipo lleva varias semanas usando Google sin fricción y se quiere forzar el SSO:

1. Para cada cuenta del equipo: `UPDATE users SET auth_provider='google', hashed_password=NULL WHERE username IN (...)`.
2. Cualquier intento de `POST /auth/login` con password devuelve 401 (no hay hash).
3. Solo `POST /auth/google-login` permite acceso.

Riesgo: si Google Cloud Console se cae o el proyecto se suspende, nadie entra. Por eso es opcional y se recomienda **al menos** mantener una cuenta admin (ej. `samuel`) con `auth_provider="both"` como break-glass.

---

## Apéndice — Archivos y referencias del sistema

| Recurso | Ruta |
|---|---|
| Endpoint Google login | `backend/app/api/routes/auth.py:173-260` (`/auth/google-login`) |
| Endpoint link/unlink | `backend/app/api/routes/auth.py:263, 318` |
| Verificación de id_token | `backend/app/services/google_auth.py` |
| Configuración Settings | `backend/app/core/config.py` (`GOOGLE_CLIENT_ID`, property `google_client_ids`) |
| Modelo User con google_id | `backend/app/models/user.py:38-95` |
| Script saneo emails | `backend/scripts/update_team_emails.py` |
| Fix lowercase email | `backend/app/services/user.py` (`create_user`, `update_user`) |
| Tauri GoogleOAuthProvider | `frontend/src/App.tsx:9, 100-103` |
| Tauri login UI | `frontend/src/pages/Login.tsx:178-199` |
| Admin login UI | `admin-portal/app/login/page.tsx:182-204` |
| Admin auth store | `admin-portal/lib/adminAuth.ts:105-150` |

---

## Pendientes que NO cubre este runbook

- **Crear cuentas de usuario para nuevos empleados** (segunda sucursal): se hace desde la UI de administración o por script aparte; no es parte de este rollout.
- **Política de equity / formalización laboral**: viven en [`docs/v3/formalization/equipo-roadmap-2026.md`](../v3/formalization/equipo-roadmap-2026.md).
- **Validación empírica del WebView de Tauri con Google**: requiere correr la app en Tauri build de prod (no dev) y probar el flujo. Si falla, abrir issue para implementar el plan B (browser externo + loopback).
