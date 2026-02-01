# 🧪 Fase 1: Guía de Testing - Red Local (Mac ↔ Windows)

## 📋 Objetivo

Probar el sistema distribuido en red local antes del deployment a cloud. El backend correrá en Mac y la app Tauri en Windows se conectará a través de la LAN.

---

## 🎯 Arquitectura de Testing

```
[Mac - Servidor Backend]                [Windows - Cliente]
    ├── PostgreSQL (Docker)              ├── Tauri Desktop App
    ├── Redis (Docker)                   └── Conecta a: http://192.168.1.X:8000
    ├── FastAPI (0.0.0.0:8000)
    └── IP LAN: 192.168.1.X
```

---

## 📝 Pre-requisitos

### En Mac (Servidor)

- [ ] Docker Desktop instalado y corriendo
- [ ] Backend configurado y funcionando localmente
- [ ] Puerto 8000 accesible (verificar firewall)
- [ ] Ambas máquinas en la misma red Wi-Fi/LAN

### En Windows (Cliente)

- [ ] Rust instalado (para compilar Tauri)
- [ ] Node.js 18+ instalado
- [ ] Git instalado (para clonar repo)
- [ ] Acceso a la IP del Mac en la red

---

## 🚀 Paso 1: Configurar Backend en Mac

### 1.1 Obtener IP del Mac

```bash
# Opción 1: ifconfig
ifconfig | grep "inet " | grep -v 127.0.0.1

# Opción 2: System Preferences
# System Preferences → Network → Wi-Fi → Advanced → TCP/IP
# Ejemplo: 192.168.1.100
```

Anota tu IP: `__________________`

### 1.2 Configurar CORS para la IP de Windows

```bash
cd ~/Documents/03_Proyectos/Codigo/uniformes-system-v2
```

Edita `backend/app/main.py` y verifica que CORS acepte todas las IPs de la red local:

```python
# backend/app/main.py (ya configurado)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # En desarrollo acepta todo
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### 1.3 Iniciar Servicios Backend

```bash
# Terminal 1: Docker services
docker-compose -f docker/docker-compose.dev.yml up -d postgres redis

# Terminal 2: Backend API
cd backend
source venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 1.4 Verificar que el Backend Esté Accesible

```bash
# Desde el Mac, verifica que funcione
curl http://localhost:8000/api/v1/health

# Desde el Mac, verifica con tu IP LAN
curl http://192.168.1.X:8000/api/v1/health
```

Deberías recibir: `{"status":"ok"}`

---

## 🪟 Paso 2: Preparar Windows (Cliente)

### 2.1 Instalar Dependencias en Windows

**PowerShell (como Administrador):**

```powershell
# Instalar Rust
winget install --id Rustlang.Rust.MSVC

# Verificar Rust
rustc --version
cargo --version

# Instalar Node.js (si no está instalado)
winget install --id OpenJS.NodeJS.LTS

# Verificar Node
node --version
npm --version
```

### 2.2 Clonar Proyecto en Windows

```powershell
# Navegar a Documents
cd C:\Users\TuUsuario\Documents

# Clonar repositorio
git clone https://github.com/Samsuesca/uniformes-system-v2.git
cd uniformes-system-v2\frontend
```

### 2.3 Configurar IP del Servidor Mac

Edita `frontend/src/config/environments.ts` y actualiza la IP de tu Mac:

```typescript
export const ENVIRONMENTS = {
  LOCAL: 'http://localhost:8000',
  LAN: 'http://192.168.1.X:8000',  // ← Cambia X por la IP de tu Mac
  CLOUD: 'https://api.uniformes-system.com',
} as const;
```

### 2.4 Instalar Dependencias Frontend

```powershell
npm install
```

---

## 🧪 Paso 3: Testing de Conectividad

### 3.1 Verificar Conectividad Desde Windows

**PowerShell en Windows:**

```powershell
# Hacer ping al Mac
ping 192.168.1.X

# Probar acceso al backend
curl http://192.168.1.X:8000/api/v1/health
```

**Si no funciona:**

1. **Firewall del Mac:** System Preferences → Security & Privacy → Firewall
   - Desactiva temporalmente o agrega Python a las excepciones

2. **Firewall de Windows:** Asegúrate de que permita conexiones salientes

3. **Red incorrecta:** Ambas máquinas deben estar en la misma red Wi-Fi

### 3.2 Compilar y Ejecutar App Tauri

**PowerShell en Windows:**

```powershell
cd uniformes-system-v2\frontend

# Opción 1: Modo desarrollo (recomendado para testing)
npm run tauri dev

# Opción 2: Build release (más lento, pero app final)
npm run tauri build
```

---

## 📱 Paso 4: Configurar Entorno en la App

### 4.1 Abrir la App Tauri en Windows

1. La app se abrirá automáticamente después de compilar
2. **Login inicial:**
   - Usuario: `admin`
   - Contraseña: `Admin123`

### 4.2 Cambiar al Entorno LAN

1. Navega a **Settings** (⚙️ en el sidebar)
2. En "Configuración del Servidor", selecciona **🏠 Red Local (Testing)**
3. Verifica que la URL muestre: `http://192.168.1.X:8000`
4. Debe aparecer **✅ Conectado** en verde

### 4.3 Si No Se Conecta

**Configurar URL Personalizada:**
1. En Settings, sección "URL Personalizada"
2. Ingresa: `http://192.168.1.X:8000` (la IP de tu Mac)
3. Click en **Aplicar**
4. Cierra sesión y vuelve a iniciar sesión

---

## ✅ Paso 5: Casos de Prueba

### 5.1 Test de Autenticación

- [ ] Login exitoso desde Windows al backend en Mac
- [ ] Token JWT almacenado correctamente
- [ ] Dashboard carga con nombre de usuario

### 5.2 Test de Ventas

- [ ] Navegar a **Ventas**
- [ ] Crear una venta nueva
- [ ] Agregar productos al carrito
- [ ] Completar venta
- [ ] Verificar que se guardó en PostgreSQL (desde Mac)

### 5.3 Test de Productos

- [ ] Ver lista de productos
- [ ] Filtrar por colegio
- [ ] Editar un producto
- [ ] Verificar cambios en tiempo real

### 5.4 Test de Cambios/Devoluciones

- [ ] Abrir una venta existente
- [ ] Solicitar un cambio de producto
- [ ] Aprobar cambio (si eres admin)
- [ ] Verificar ajuste de inventario

### 5.5 Test Multi-Usuario

**En Mac:** Abrir navegador → `http://localhost:5173` → Login
**En Windows:** App Tauri → Login con otro usuario

- [ ] Crear venta desde Mac
- [ ] Ver venta desde Windows (refrescar)
- [ ] Crear venta desde Windows
- [ ] Ver venta desde Mac (refrescar)

### 5.6 Test de Impresión

- [ ] Abrir detalle de venta
- [ ] Click en "Imprimir Recibo"
- [ ] Verificar que el diálogo de impresión de Windows se abra

---

## 🐛 Troubleshooting

### Problema: "Network Error" en la App

**Causa:** No puede conectarse al backend

**Soluciones:**
1. Verificar que el backend en Mac esté corriendo: `curl http://192.168.1.X:8000/api/v1/health`
2. Verificar firewall del Mac
3. Verificar que ambas máquinas estén en la misma red
4. Verificar que la IP en Settings sea correcta

---

### Problema: "CORS Error"

**Causa:** CORS no permite la IP del cliente

**Solución:**
```python
# backend/app/main.py
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # ← Asegúrate que esté en "*"
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

Reinicia el backend.

---

### Problema: "Connection Refused"

**Causa:** Backend no está escuchando en 0.0.0.0

**Solución:**
```bash
# Asegúrate de usar --host 0.0.0.0
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

---

### Problema: App Tauri No Compila en Windows

**Causa:** Falta Rust o WebView2

**Solución:**
```powershell
# Instalar Rust
winget install --id Rustlang.Rust.MSVC

# WebView2 (normalmente ya viene en Windows 11)
# Si falta: https://developer.microsoft.com/en-us/microsoft-edge/webview2/

# Reiniciar PowerShell después de instalar
```

---

### Problema: Base de Datos Vacía

**Causa:** No se corrió el seed

**Solución (en Mac):**
```bash
cd backend
source venv/bin/activate
python seed_data.py
```

---

## 📊 Checklist Final de Fase 1

### Backend (Mac)
- [ ] PostgreSQL y Redis corriendo en Docker
- [ ] Backend API corriendo en `0.0.0.0:8000`
- [ ] CORS configurado para aceptar todas las IPs
- [ ] Base de datos con seed data
- [ ] IP LAN identificada y accesible

### Frontend (Windows)
- [ ] Rust y Node.js instalados
- [ ] Proyecto clonado y dependencias instaladas
- [ ] IP del Mac configurada en `environments.ts`
- [ ] App Tauri compilada y ejecutándose
- [ ] Settings configurado a "Red Local"

### Testing
- [ ] Login exitoso desde Windows
- [ ] Crear y ver ventas
- [ ] Crear y editar productos
- [ ] Sistema de cambios funcional
- [ ] Testing multi-usuario (Mac + Windows simultáneo)
- [ ] Impresión funcional

---

## 🎯 Próximos Pasos

### Si Todo Funciona ✅
**¡Fase 1 completada!** Estás listo para:
- **Fase 2:** Deployment a cloud (servidor VPS)
- **Fase 3:** Builds finales multi-plataforma
- **Fase 4:** Web portal para clientes

### Si Hay Problemas ❌
1. Revisar troubleshooting arriba
2. Verificar logs del backend: `docker logs docker-postgres-1`
3. Verificar logs de la app Tauri (DevTools en la app)
4. Consultar documentación de proyecto en `/docs`

---

## 📞 Comandos Útiles

### Mac (Servidor)

```bash
# Ver logs de PostgreSQL
docker logs docker-postgres-1 -f

# Ver logs del backend
# (los verás en la terminal donde corre uvicorn)

# Reiniciar Docker
docker-compose -f docker/docker-compose.dev.yml restart

# Ver IP del Mac
ifconfig | grep "inet " | grep -v 127.0.0.1
```

### Windows (Cliente)

```powershell
# Verificar conectividad
Test-NetConnection 192.168.1.X -Port 8000

# Ver logs de Tauri (en la app)
# Click derecho → Inspect Element → Console

# Recompilar app
npm run tauri dev
```

---

## 📝 Notas Importantes

1. **Desarrollo Solo:** Esta configuración es SOLO para desarrollo/testing. No usar en producción.
2. **Seguridad:** CORS está abierto a `*` para facilitar testing. En producción se restringirá.
3. **Performance:** La latencia en LAN es ~1-5ms. En cloud será ~50-200ms (normal).
4. **IP Dinámica:** Si tu Mac usa DHCP, la IP puede cambiar. Considera configurar IP estática para testing.

---

## ✅ Criterios de Éxito

La Fase 1 se considera exitosa cuando:

1. ✅ Backend en Mac accesible desde Windows vía IP LAN
2. ✅ App Tauri en Windows se conecta y autentica correctamente
3. ✅ CRUD completo funciona (crear, leer, actualizar, eliminar)
4. ✅ Multi-usuario simultáneo funciona sin conflictos
5. ✅ Impresión funcional desde Windows
6. ✅ Sin errores de CORS o conexión

**Cuando completes estos criterios, estarás listo para Fase 2: Cloud Deployment! 🚀**

---

**Última actualización:** 2025-11-09
**Versión:** v2.0.0-dev
**Autor:** Angel Samuel Suesca Rios
**Fase:** 1 de 4
