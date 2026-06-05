# QA Brief — Sistema Post-Migración V3

**Fecha del brief:** 2026-05-04
**Audiencia:** QA externo (Claude Chrome Extension u operador humano)
**Tiempo estimado:** 45 min
**Plataforma:** Web app desktop (`http://localhost:5171`)

---

## Contexto

El sistema acaba de aplicar **14+ migraciones v3** sobre datos frescos de producción. Antes de cerrar el sprint de estabilización, necesitamos validación independiente desde la perspectiva de un usuario superuser.

El QA interno (Claude Code) ya ejecutó:
- ✅ 49+ endpoints API en verde
- ✅ Token versioning funcional
- ✅ Códigos globalizados (sales/orders) al 100%
- ❌ 5 bugs contables conocidos (presentes, no introducidos por v3)

**Tu rol:** Validar que la experiencia de usuario funciona como un super-administrador en operación diaria, especialmente en áreas que v3 tocó.

---

## Credenciales

```
URL:      http://localhost:5171/
Usuario:  Samuel
Password: Samuel2741
Rol:      Superusuario (acceso total)
```

---

## Tareas (45 min)

### 1. Login & Dashboard (5 min)

1. Abre `http://localhost:5171/`
2. Ingresa con `Samuel / Samuel2741`
3. Dashboard debe mostrar:
   - "¡Bienvenido, Angel Samuel Suesca Rios!"
   - "Resumen global de 11 colegios" (¿debería ser 12 ya que admin lista 12?)
   - Ventas totales: ~$169M
   - 1521 ventas, 306 encargos, 1699 clientes
4. **Reporta:** Cualquier KPI con valor `0`, `null`, `NaN`, o "Cargando..." que persista.

### 2. Códigos globalizados — verificación visual (5 min)

V3 cambió los códigos para incluir prefijo de colegio.

1. Visita `/sales` (Ventas) y `/orders` (Encargos)
2. Verifica que TODOS los códigos siguen el formato:
   - Ventas: `XXXX-001-VNT-2026-NNNN` (ej. `CARACAS-001-VNT-2026-0836`)
   - Encargos: `XXXX-001-ENC-2026-NNNN` (ej. `PUMAREJO-001-ENC-2026-0054`)
3. **Reporta:** Cualquier código sin prefijo de colegio (legacy `VNT-2026-XXXX` debería NO existir).

### 3. Panel CFO — Nueva feature v3 (10 min)

1. Ve a "Panel CFO" en el sidebar (sección FINANZAS)
2. Verifica que cargan:
   - Estado de Salud Financiera (puntuación /100)
   - Liquidez Disponible
   - Burn rate mensual
   - Cash Runway
   - Calidad de Datos (productos con costo real)
3. Click "Asignar costos a productos" → debe llevarte a `/accounting`
4. Click "Actualizar" en CFO Panel → debe re-fetch sin error
5. **Reporta:** Métricas con valores anómalos (negativos sin explicación, "N/A" sin contexto, etc.)

### 4. Configuración Superuser (10 min)

V3 introdujo gestión de **Cargos** (Positions). Vamos a probar las 6 cards superuser.

1. Ve a `/settings` (botón "Config" arriba a la derecha)
2. Verifica que aparecen estas secciones:
   - [ ] Configuración del Servidor (3 botones de entorno)
   - [ ] Perfil de Usuario (con tu info)
   - [ ] Seguridad (Cambiar Contraseña, Cambiar Correo)
   - [ ] **Colegios** (botón "Administrar Colegios")
   - [ ] **Usuarios**
   - [ ] **Zonas de Envío**
   - [ ] **Información del Negocio**
   - [ ] **Cargos** ← **NUEVO V3** (botón "Administrar Cargos")
   - [ ] **Cuentas de Pago**
   - [ ] Notificaciones (3 toggles)
   - [ ] Alertas Telegram
   - [ ] Impresora Térmica
3. Click "Administrar Cargos" → ¿abre modal/página? ¿Lista cargos? Debería haber 6 cargos.
4. Click "Administrar Colegios" → ¿lista los 12 colegios?
5. **Reporta:** Cualquier card que no cargue, botón roto, o flujo que termine en error.

### 5. Panel Admin — Gestión global (5 min)

1. Click "Panel Admin" en sidebar (sección ADMIN)
2. Verifica tabs: **Colegios (12)**, **Usuarios**, **Sistema**
3. Tab Colegios: lista 12 colegios con códigos correctos (CARACAS-001, PUMAREJO-001, etc.) + 1 inactivo (TEMP-1E18F1F7)
4. Tab Usuarios: ¿lista usuarios? ¿hay permisos visibles?
5. Tab Sistema: ¿muestra versión, status DB, info del sistema?
6. **Reporta:** Cualquier tab que no cargue o muestre error.

### 6. Cambios y Devoluciones — Disposal v3 (10 min)

V3 agregó tracking de qué pasa con el item original al procesar un cambio.

1. Ve a `/sale-changes` (Cambios/Devoluciones)
2. ¿Cargan los 46 cambios existentes?
3. Abre un cambio reciente (último mes). ¿Muestra alguna sección de "Disposición del item original"?
4. **NOTA:** El backend no está poblando ese campo (está siempre NULL). Si la UI muestra "—" o "N/A", es **comportamiento esperado** por ahora.
5. **Reporta:** Si la UI muestra error en lugar de "—" para items sin disposal.

---

## Stress scenarios (Layer-8)

Si tienes tiempo extra:

### S1. Sesión expirada
1. Login con Samuel
2. En otro terminal: invalida tu sesión bumpeando token_version (admin lo puede simular cerrando todas tus sesiones desde panel admin si esa feature existe)
3. Intenta hacer click en cualquier botón
4. **Esperado:** Re-login forzado. **Reporta:** Si te deja seguir operando o muestra error feo.

### S2. Refresh forzado en CFO
1. Abre `/cfo`
2. Cmd+Shift+R (hard reload)
3. **Esperado:** Misma data, sin doble-fetch visible, sin loaders eternos.

### S3. Multi-pestaña
1. Abre `/sales` en una pestaña
2. Abre `/orders` en otra pestaña
3. Crea una venta en pestaña 1
4. ¿Ve la otra pestaña los efectos (KPIs actualizados)?

---

## Formato de Reporte

Usa este template para cada hallazgo:

```
[SEVERIDAD] [PÁGINA] - Título corto

Pasos para reproducir:
1. ...
2. ...

Esperado:
- ...

Observado:
- ...

Screenshot/Console: (adjunta si aplica)
```

**Severidades:**
- **P0**: Sistema caído, data corrupta, login imposible
- **P1**: Feature crítica rota o resultados incorrectos
- **P2**: Bug aislado, workaround posible
- **P3**: Cosmético, UX, copy

---

## Áreas validadas (no necesitas re-testear)

Ya verificamos en QA interno:
- ✅ Login flujo principal
- ✅ Dashboard renderiza
- ✅ Token versioning end-to-end
- ✅ Permisos básicos del registry (97 perms)
- ✅ Códigos globalizados de sales/orders en DB
- ✅ Vendor normalization sin duplicados (97 vendors)
- ✅ Endpoints stats (anti-pattern paginación)
- ✅ Income statement cálculo
- ✅ CFO Health metrics endpoint

---

## Áreas críticas a validar (tu foco)

🎯 **Configuración → Cargos** (feature nueva v3, sin cobertura previa de UI)
🎯 **Cambios y Devoluciones → Disposal field** (validar UI, no data)
🎯 **CFO Panel → flujo "Asignar costos"** (461 productos sin costo)
🎯 **Admin → Tab Sistema** (ver si expone estado de migraciones)
🎯 **Admin → Tab Usuarios → Permisos por colegio** (registry tiene 97 permisos)

---

## Limpieza post-test

Si creaste data, prefíjala con `[QA-EXT]` para diferenciarla del cleanup interno (`[QA-TEST]` ya cleaned).

---

**Reporte de QA interno:** `docs/qa-briefs/qa-full-post-v3-2026-05-04.md`
