# Arquitectura de la App Movil

App nativa iOS/Android para vendedoras en terreno — operaciones del dia (auth, ventas, clientes, pedidos, inventario, contabilidad limitada). Construida con Expo SDK 54 + React Native 0.81 + expo-router v6.

> **Estado**: MVP en producción en testflight/APK distribuído manualmente. Bundle id: `com.uniformesconsuelorios.vendedoras`. Slug: `ucr-vendedoras`.

---

## Por Que Existe

El frontend desktop (Tauri) cubre el flujo de tienda fisica. La mobile cubre dos casos no-tienda:

1. **Eventos en colegios**: la vendedora acompaña a un colegio durante el periodo de matricula y necesita registrar ventas/encargos sin laptop.
2. **Visitas a clientes**: alteraciones puntuales, cobros de CxC en domicilio.

Comparte el backend FastAPI con desktop y web — no hay codigo Python ni base de datos local. Mantiene el mismo modelo de permisos granulares y suscripciones Telegram.

---

## Stack

| Componente | Tecnologia | Version |
|---|---|---|
| Runtime | Expo | SDK 54.0.33 |
| Framework | React Native | 0.81.5 |
| React | React | 19.1.0 |
| Routing | expo-router | 6.0.23 |
| Estilos | NativeWind (Tailwind para RN) | 4.2.3 |
| Estado | Zustand | 5.0.12 |
| Data fetching | TanStack Query (React Query) | 5.96.1 |
| HTTP | axios | 1.14.0 |
| Storage seguro | expo-secure-store | 15.0.8 |
| Storage no-sensible | @react-native-async-storage/async-storage | 2.2.0 |
| Auth Google | expo-auth-session + expo-web-browser | 7.0.10 / 15.0.10 |
| Network status | @react-native-community/netinfo | 12.0.1 |
| Animaciones | react-native-reanimated | 4.1.1 (Worklets) |
| Toasts | react-native-toast-message | 2.3.3 |

**New Architecture habilitada** (`app.json: newArchEnabled=true`) — bridgeless, JSI, Fabric.

---

## Estructura del Repo

```
mobile/
├── app/                          # expo-router (file-based)
│   ├── _layout.tsx               # Root: Auth guard, providers, hydration
│   ├── index.tsx                 # Splash redirect
│   ├── (auth)/
│   │   ├── _layout.tsx
│   │   └── login.tsx             # Local + Google OAuth
│   └── (app)/
│       ├── _layout.tsx           # Stack para detail screens
│       ├── (tabs)/
│       │   ├── _layout.tsx       # Bottom tabs (home/sales/clients/more)
│       │   ├── home.tsx
│       │   ├── sales.tsx
│       │   ├── clients.tsx
│       │   └── more.tsx
│       ├── school-selector.tsx   # Multi-tenant: cambiar de colegio
│       ├── new-sale.tsx
│       ├── sale-detail.tsx
│       ├── new-sale-change.tsx
│       ├── sale-changes.tsx
│       ├── sale-change-detail.tsx
│       ├── new-order.tsx
│       ├── orders.tsx
│       ├── order-detail.tsx
│       ├── new-client.tsx
│       ├── client-detail.tsx
│       ├── edit-client.tsx
│       ├── inventory.tsx
│       └── accounting/
│           ├── _layout.tsx
│           ├── index.tsx
│           ├── daily-flow.tsx
│           ├── expenses.tsx
│           └── receivables.tsx
│
├── src/
│   ├── components/
│   │   ├── ErrorBoundary.tsx
│   │   └── OfflineBanner.tsx
│   ├── constants/                 # brand, paymentMethods
│   ├── hooks/
│   │   ├── useQueryConfig.ts      # QueryClient global
│   │   ├── useGoogleAuth.ts
│   │   ├── useNetworkStatus.ts
│   │   ├── usePermissions.ts
│   │   └── usePermissionsRefresh.ts  # Polling 60s a backend
│   ├── services/                  # 11+ clientes API (axios)
│   ├── stores/                    # Zustand: auth, school, saleDraft, orderDraft
│   ├── types/api.ts               # Tipos sincronizados con backend
│   └── utils/                     # apiClient, format, pagination
│
├── assets/                        # icons, splash, fonts
├── app.json                       # expo config
├── eas.json                       # EAS build profiles
├── babel.config.js
├── metro.config.js
├── global.css                     # Tailwind directives
└── package.json
```

---

## Routing (expo-router v6)

File-based, dos grupos principales: `(auth)` y `(app)`. El paréntesis hace el segmento "invisible" en la URL pero permite layouts compartidos.

### Auth guard

[`app/_layout.tsx`](../../mobile/app/_layout.tsx) implementa `AuthGuard`:

```tsx
function AuthGuard() {
  const { isAuthenticated, isHydrated } = useAuthStore();
  const segments = useSegments();

  usePermissionsRefresh();  // ← polling 60s a /users/me/permissions/version

  useEffect(() => {
    if (!isHydrated) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!isAuthenticated && !inAuthGroup) router.replace('/(auth)/login');
    else if (isAuthenticated && inAuthGroup) router.replace('/(app)/(tabs)/home');
  }, [isAuthenticated, isHydrated, segments]);
  ...
}
```

- **Hydration**: el `authStore` carga el JWT desde `expo-secure-store` antes de renderizar nada (splash + spinner). Esto evita un flash de la pantalla de login cuando el usuario ya esta autenticado.
- **Permissions refresh hook**: cada 60s consulta al backend si la `permissions_version` del usuario cambio (admin lo cambio de rol, asignacion a custom role, etc.). Si cambio, refetch del set completo y rehidrata el cache.

### Tabs (bottom navigation)

`(app)/(tabs)/_layout.tsx`:

| Tab | Screen | Proposito |
|---|---|---|
| Home | `home.tsx` | Resumen del dia (ventas, ordenes, alertas) |
| Sales | `sales.tsx` | Lista paginada de ventas con filtros |
| Clients | `clients.tsx` | Lista de clientes + busqueda |
| More | `more.tsx` | Settings, school selector, accounting, logout |

Detail screens y formularios viven en `(app)/` directamente (fuera de tabs) — al abrir un detalle se reemplaza la stack actual.

---

## Estado (Zustand)

### `authStore`

```ts
{
  user: User | null
  token: string | null            // JWT — persistido en SecureStore
  isAuthenticated: boolean
  isHydrated: boolean             // true tras leer SecureStore en startup
  permissions: Set<string>        // del registry, refrescado vía hook
  permissionsVersion: number

  login(...): Promise<void>
  loginWithGoogle(...): Promise<void>
  logout(): void
  hydrate(): Promise<void>
}
```

JWT vive en **SecureStore** (Keychain iOS / EncryptedSharedPreferences Android). NO en AsyncStorage por seguridad.

### `schoolStore`

Tracking del colegio activo cuando el usuario tiene rol en varios:

```ts
{
  currentSchool: School | null
  availableSchools: School[]
  setCurrentSchool(school): void
}
```

`currentSchool.id` se inyecta en headers (`X-School-Id`) o como path param dependiendo del endpoint.

### `saleDraftStore` / `orderDraftStore`

Estados temporales de wizards de creacion. Persistidos en AsyncStorage para sobrevivir background-kill. Limpieza tras submit exitoso.

---

## Networking

### `apiClient.ts` (axios)

Interceptores:

1. **Request**: inyecta `Authorization: Bearer <jwt>` desde `authStore`.
2. **Request**: inyecta `X-School-Id` si hay current school.
3. **Response**: en `401`, llama `authStore.logout()` y redirige a `/(auth)/login`.
4. **Response**: en `403`, dispara toast con el `detail` del backend (e.g. "Permission required: sales.cancel").
5. **Response**: parsea el formato `PaginatedResponse` y normaliza paginacion.

### React Query config (`useQueryConfig.ts`)

```ts
{
  queries: {
    staleTime: 30 * 1000,            // 30s
    gcTime: 5 * 60 * 1000,           // 5 min
    retry: 1,
    refetchOnWindowFocus: false,     // RN no tiene window focus
    refetchOnReconnect: true,        // ← clave para offline
  }
}
```

`refetchOnReconnect=true` + `OfflineBanner` + NetInfo permiten que mutations en cola fallen explicitamente cuando no hay red, y refresquen al reconectar.

### Servicios

Un archivo por dominio (`saleService.ts`, `orderService.ts`, `clientService.ts`, `productService.ts`, `inventoryService.ts`, `accountingService.ts`, `saleChangeService.ts`, `schoolService.ts`, `authService.ts`, `permissionRegistryService.ts`). Cada uno exporta funciones tipadas que llaman al `apiClient`.

---

## Permisos en Mobile

El sistema de permisos vive en backend (ver [permission-system.md](./permission-system.md)). En mobile:

1. **Login** → backend retorna JWT + `permissions_version`.
2. **Post-login** → fetch de `/api/v1/permissions/registry` (cacheable con ETag).
3. **Hidratacion** → set de codes del usuario actual queda en `authStore.permissions`.
4. **Hook `usePermissions`** → API ergonomica para los componentes:
   ```tsx
   const { has, hasAny, maxDiscount } = usePermissions();
   if (has("sales.cancel")) { ... }
   ```
5. **Hook `usePermissionsRefresh`** → polling 60s a `/users/me/permissions/version`. Si cambia, refetch.
6. **Conditional rendering** → botones/tabs solo se muestran si el usuario tiene el permiso. **Nunca** se confia solo en el frontend — el backend valida igualmente con `require_permission`.

---

## Auth: Local + Google OAuth

### Login local

Username/password → `POST /auth/login` → JWT.

### Google OAuth (Expo Auth Session)

`useGoogleAuth` hook envuelve `expo-auth-session`:

```ts
const { signIn } = useGoogleAuth();
await signIn();
// → abre custom tab / browser
// → Google authorize callback
// → token Google → POST /auth/google-login → JWT propio
```

El backend valida el token Google (audience, expiry), busca o crea el `User` con `auth_provider="google"`, y retorna JWT. Si el username (email) ya existe pero con `auth_provider="local"`, retorna error pidiendo linkear cuentas via `POST /auth/link-google`.

---

## Branding & UI

- **Colores**: `BRAND.primary = "#B8860B"` (dorado UCR). Background fondo blanco.
- **Splash**: dorado solido con logo centrado.
- **Adaptive icon Android**: foreground con padding correcto + background dorado.
- **NativeWind**: `className="bg-primary text-white p-4"` funciona en componentes RN.
- **Toasts**: superior, autohide 3s, distintos por type (success/error/info).
- **Offline banner**: barra fija arriba cuando NetInfo reporta sin conexion.

---

## Builds (EAS)

`eas.json` define tres profiles:

| Profile | Distribution | Sim | Auto-increment |
|---|---|---|---|
| `development` | internal | dev client | No |
| `preview` | internal | dispositivo real | No |
| `production` | (App Store / Play) | dispositivo real | **Si** |

Comandos tipicos:

```bash
# Build de desarrollo (con dev menu)
eas build --profile development --platform ios

# Build de preview para testing interno
eas build --profile preview --platform android

# Production
eas build --profile production --platform all
eas submit --profile production
```

`appVersionSource: "remote"` — el versionCode/buildNumber se incrementa en EAS, no localmente.

---

## Limitaciones del MVP

Cosas que **NO** estan en mobile (estan en desktop):

- Apertura/cierre de caja (caja menor full).
- Configuracion de productos (CRUD de garment_types, costs, etc.).
- Gestion de usuarios y roles.
- Reportes financieros completos (solo daily-flow basico).
- Modulo de payroll/workforce.
- Configuracion de Wompi.

La filosofia es: **mobile cubre el flujo de la vendedora durante el dia**, no la administracion del negocio.

---

## Side-effects que disparan alertas Telegram

Estas acciones desde mobile generan notificaciones (igual que desde desktop):

| Accion | Alerta |
|---|---|
| Crear venta | `sale_created` |
| Cancelar venta | `sale_cancelled` (si esta configurada) |
| Crear pedido | `web_order_created` (mismo handler) |
| Crear gasto | `expense_created` (admin-restricted) |
| Cobrar CxC | (sin alerta especifica hoy) |

> Detalle: [telegram-alerts-system.md](./telegram-alerts-system.md).

---

## Roadmap

- **Push notifications** via Expo Notifications (hoy las alertas llegan solo a Telegram). Requiere registrar token en backend + endpoint de envio.
- **Offline-first para borrador de ventas**: hoy se pierde la red y la draft persiste en AsyncStorage, pero el submit falla. Se necesita queue + reintento automatico.
- **Modulo de caja menor completo** para que las vendedoras puedan operar sin desktop en eventos largos.
- **Camera scanning** de codigos de barras de productos para acelerar la creacion de ventas.

---

## Referencias

| Componente | Path |
|---|---|
| Auth guard | [`mobile/app/_layout.tsx`](../../mobile/app/_layout.tsx) |
| API client | [`mobile/src/utils/apiClient.ts`](../../mobile/src/utils/apiClient.ts) |
| Auth store | [`mobile/src/stores/authStore.ts`](../../mobile/src/stores/authStore.ts) |
| Permissions hook | [`mobile/src/hooks/usePermissions.ts`](../../mobile/src/hooks/usePermissions.ts) |
| EAS config | [`mobile/eas.json`](../../mobile/eas.json) |
| Expo config | [`mobile/app.json`](../../mobile/app.json) |

---

[← Volver al indice](./README.md)

---

*Ultima actualizacion: 2026-05-02 | Version: 1.0.0*
