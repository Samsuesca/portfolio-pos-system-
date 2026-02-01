# Bug: Cliente HTTP en Windows no conecta a API externa

## Resumen Ejecutivo

**Estado**: Resuelto
**Plataforma**: Windows 11/10 con Tauri 2.x
**Severidad**: Crítica (bloquea login en builds .exe)
**Fecha de descubrimiento**: 2026-01-27
**Fecha de resolución**: 2026-01-27

En los builds .exe de Windows (producción), la aplicación no podía conectar a la API externa (`https://api.yourdomain.com`), mostrando "No hay conexión disponible" en el selector de conexiones. La misma máquina en modo `npm run tauri:dev` funcionaba perfectamente, y `curl` desde Windows conectaba sin problemas.

---

## Síntoma

**Pasos para reproducir:**
1. Build producción: `npm run tauri:build` en Windows
2. Ejecutar el .exe resultante
3. Ir a Login page
4. Ver selector de conexiones (botón rojo/verde)
5. Selector mostrará spinner infinito → "No hay conexión disponible"
6. Logs de red muestran `fetch()` bloqueado por CORS

**Comportamiento esperado:**
- Selector conecta a API y muestra verde
- Login permite autenticarse

**Comportamiento actual:**
- Selector intenta usar `fetch()` en WebView2
- CORS bloquer las requests a dominio externo
- App inutilizable hasta hacer login manual (con servidor hardcodeado)

---

## Causa Raíz

### Detección incorrecta de dev vs producción

El código usaba `window.location.protocol` para diferenciar modos:

**Archivo: `frontend/src/utils/api-client.ts` (INCORRECTO)**
```typescript
const useRustHttp = typeof window !== 'undefined' &&
  '__TAURI_INTERNALS__' in window &&
  window.location.protocol !== 'http:';  // ← PROBLEMA AQUI
```

**Archivo: `frontend/src/pages/Login.tsx` (INCORRECTO)**
```typescript
const isDevMode = window.location.protocol === 'http:';  // ← PROBLEMA AQUI
```

### Asunción falsa

```
ASUNCION: Tauri 2 en Windows usa https://tauri.localhost (protocol = 'https:')
REALIDAD: Tauri 2 en Windows usa http://tauri.localhost (protocol = 'http:')
         (al usar feature 'custom-protocol')
```

### Cadena de fallos

```
Build producción (.exe)
    ↓
window.location.protocol = 'http:' (NO 'https:')
    ↓
useRustHttp evaluaba a FALSE (porque protocol === 'http:')
    ↓
isDevMode evaluaba a TRUE (incorrectamente)
    ↓
App usaba fetch() / XHR en lugar de Rust IPC
    ↓
WebView2 bloqueaba CORS a dominio externo
    ↓
"No hay conexión disponible" en login
```

### Por qué la detección funcionaba antes

La versión anterior solo usaba:
```typescript
'__TAURI_INTERNALS__' in window
```

Sin la verificación de `protocol`, **siempre usaba Rust IPC en Tauri** (correcto). El cambio introducido fue regresivo.

### Pista falsa: TLS

Inicialmente sospechamos problemas con certificados:
- `rustls-tls` vs `native-tls` en `reqwest`
- Un build anterior (.exe) temporalmente falló al conectar

**Análisis posterior:**
- El build anterior falló por razones no relacionadas (DNS/red transiente)
- Cambiar TLS solo fue mejora defensiva, no raíz del problema
- La prueba definitiva: **cambiar solo el detection logic lo resolvió todo**, sin tocar TLS

---

## Solución Implementada

### 1. Usar `import.meta.env.DEV` en lugar de `window.location.protocol`

**Ventajas:**
- Es constante de **compile-time** de Vite, no runtime
- Independiente de la plataforma y versión de Tauri
- Código muerto se elimina del bundle de producción (tree-shaking)
- Confiable y estándar en ecosistema Vite

**Mapeo:**
```
npm run dev / tauri:dev  →  import.meta.env.DEV = true  →  usa XHR
npm run build / tauri:build  →  import.meta.env.DEV = false  →  usa Rust IPC
```

### 2. Cambio en `frontend/src/utils/api-client.ts`

**Antes (INCORRECTO):**
```typescript
const useRustHttp = typeof window !== 'undefined' &&
  '__TAURI_INTERNALS__' in window &&
  window.location.protocol !== 'http:';  // ← Falla en Windows
```

**Después (CORRECTO):**
```typescript
const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
const useRustHttp = isTauri && !import.meta.env.DEV;
```

### 3. Cambio en `frontend/src/pages/Login.tsx`

**Antes (INCORRECTO):**
```typescript
const isDevMode = window.location.protocol === 'http:';
```

**Después (CORRECTO):**
```typescript
const isDevMode = import.meta.env.DEV;
```

### 4. Mejora: Cambiar a `native-tls` (defensiva)

**Archivo: `frontend/src-tauri/Cargo.toml`**

```toml
# Antes:
reqwest = { version = "0.12", features = ["json", "rustls-tls"] }

# Después:
reqwest = { version = "0.12", features = ["json", "native-tls"] }
```

**Razón:** `native-tls` usa el certificado store del sistema operativo, evitando problemas de rotación de certificados en futuro. Mejor práctica para apps desktop.

---

## Detalles Técnicos

### Por qué `window.location.protocol` no es confiable en Tauri

| Aspecto | Dev Mode | Build Mode |
|--------|----------|-----------|
| **Windows (custom-protocol)** | `http://localhost:5173` | `http://tauri.localhost` |
| **macOS (app)** | `http://localhost:5173` | `https://tauri.app` |
| **Linux (app)** | `http://localhost:5173` | `https://tauri.app` |

La lógica `window.location.protocol !== 'http:'` falla porque en Windows, incluso el build usa `http://`.

### Por qué Rust IPC es necesario

WebView2 en Windows tiene restricciones CORS para requests a dominios externos:
```
fetch('https://api.yourdomain.com/...')
  → CORS policy: blocked

invoke('http_request', { url: 'https://...' })  (desde Rust)
  → Sin restricciones CORS (es un proceso distinto)
  → ✓ Funciona
```

### Flujo de requests después del fix

```
DESARROLLO (npm run tauri:dev):
  React component
    ↓
  apiClient.get() detecta: import.meta.env.DEV = true
    ↓
  XHR / fetch() a http://localhost:8000/api/v1/...
    ↓
  Dev server CORS: "Access-Control-Allow-Origin: *"
    ↓
  ✓ OK

PRODUCCION (npm run tauri:build / .exe):
  React component
    ↓
  apiClient.get() detecta: import.meta.env.DEV = false + __TAURI_INTERNALS__
    ↓
  invoke('http_request', { method: 'GET', url: 'https://...' })
    ↓
  Rust (reqwest) hace la request sin restricciones
    ↓
  Response vuelve a través de IPC
    ↓
  ✓ OK
```

---

## Commits Relacionados

| Commit | Descripcion |
|--------|-------------|
| `79e4378` | Introdujo detección basada en protocol (regresivo) |
| `8f9b75f` | **fix**: usar native-tls y import.meta.env.DEV |
| `2a741e0` | chore: eliminar alert() de debug |

---

## Archivos Modificados

| Archivo | Cambios |
|---------|---------|
| `frontend/src-tauri/Cargo.toml` | rustls-tls → native-tls en reqwest |
| `frontend/src/utils/api-client.ts` | window.location.protocol → import.meta.env.DEV |
| `frontend/src/pages/Login.tsx` | window.location.protocol → import.meta.env.DEV |

---

## Testing & Validación

### Validación realizada:

- [x] Build .exe en Windows se conecta a API externa
- [x] Login page selector muestra verde (conectado)
- [x] Autenticación funciona en builds producción
- [x] `npm run tauri:dev` sigue funcionando (XHR a dev server)
- [x] No hay CORS errors en console
- [x] Requests a https://api.yourdomain.com exitosas

### Cómo reproducir el fix:

```bash
# En Windows:
cd frontend
npm run tauri:build

# Ejecutar el .exe
./src-tauri/target/release/uniformes-desktop.exe

# Esperar a que inicie
# Login page debe mostrar selector VERDE
```

---

## Lecciones Aprendidas

### 1. ❌ Nunca usar `window.location.protocol` en Tauri

La URL varía según plataforma, versión y características. No es confiable.

### 2. ✅ Siempre usar `import.meta.env.DEV` en Tauri + Vite

Es compile-time, independiente de plataforma, y optimizable por bundler.

### 3. ✅ Preferir `native-tls` sobre `rustls-tls` en desktop

Usa certificados del SO, mejor mantenimiento a largo plazo.

### 4. 🐛 Los builds anteriores que "funcionaban" puede ser coincidencia

Validar con múltiples máquinas/versiones de Windows.

### 5. 📍 Tauri 2 en Windows con `custom-protocol` usa `http://tauri.localhost`

Documentar bien: no es `https://` como en macOS/Linux.

### 6. 🔍 El error CORS de WebView2 es la pista clave

Si `fetch()` a dominio externo falla sin error aparente → probablemente Tauri necesita Rust IPC.

---

## Referencias

- **Documentación Tauri 2**: https://v2.tauri.app/
- **WebView2 CORS**: https://learn.microsoft.com/en-us/microsoft-edge/webview2/
- **Vite env variables**: https://vitejs.dev/guide/env-and-mode.html
- **reqwest TLS**: https://docs.rs/reqwest/latest/reqwest/#optional-features

---

## Etiquetas

`windows` `tauri-2` `webview2` `http-client` `cors` `reqwest` `vite` `native-tls` `production-bug`

---

*Última actualización: 2026-01-27 | Versión del documento: 1.0*
