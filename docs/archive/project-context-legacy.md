# Contexto de Desarrollo - Uniformes System v2.0

## 🎯 Resumen del Proyecto

**Sistema de gestión de uniformes modernizado** - Migración completa de PyQt5 a arquitectura moderna con Tauri + React + FastAPI.

### Estado Actual: ✅ MVP FUNCIONANDO
- **Frontend Desktop**: Aplicación nativa Tauri con React corriendo exitosamente
- **Backend API**: FastAPI funcionando en `http://127.0.0.1:8000`
- **Plugins**: HTTP, FS, Dialog configurados y funcionando

---

## 🏗️ Arquitectura Actual

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   FRONTEND      │    │   BACKEND API   │    │   DATABASE      │
│   (Tauri+React) │◄──►│   (FastAPI)     │◄──►│   (PostgreSQL)  │
│   Puerto: N/A   │    │   Puerto: 8000  │    │   Puerto: 5432  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Stack Tecnológico
- **Frontend**: Tauri v2.1 + React 18 + TypeScript + Tailwind CSS
- **Backend**: FastAPI + SQLAlchemy + Python 3.12
- **Base de Datos**: PostgreSQL (pendiente configurar)
- **DevOps**: Docker + Docker Compose

---

## 📁 Estructura del Proyecto

```
/Users/angelsamuelsuescarios/Documents/uniformes-system-v2/
├── backend/                    # ✅ CONFIGURADO
│   ├── app/
│   │   ├── main.py            # FastAPI app principal
│   │   ├── core/config.py     # Configuraciones
│   │   └── api/routes/        # Rutas API (health, inventory, sales, etc.)
│   ├── requirements.txt       # ✅ Dependencias instaladas
│   ├── venv/                  # ✅ Entorno virtual activo
│   └── Dockerfile.dev
├── frontend/                   # ✅ CONFIGURADO Y FUNCIONANDO
│   ├── src/
│   │   ├── App.tsx           # ✅ Componente principal React
│   │   ├── main.tsx          # ✅ Entry point
│   │   └── components/       # Componentes organizados por módulo
│   ├── src-tauri/            # ✅ CONFIGURADO
│   │   ├── Cargo.toml        # ✅ Dependencias Rust v2.1
│   │   ├── tauri.conf.json   # ✅ Configuración Tauri v2
│   │   ├── build.rs          # ✅ Build script
│   │   └── src/main.rs       # ✅ Plugins HTTP, FS, Dialog
│   ├── package.json          # ✅ Dependencias Node.js
│   └── tailwind.config.js    # ✅ Configuración Tailwind
├── docker/
│   └── docker-compose.dev.yml # ⚠️  PENDIENTE: PostgreSQL + Redis
└── scripts/
    └── development/setup.sh   # ✅ Script de configuración
```

---

## 🛠️ Herramientas Instaladas y Configuradas

### ✅ Funcionando Correctamente
- **Python 3.12.7** + venv activado
- **Node.js 22.14.0** + npm 10.9.2
- **Rust/Cargo** (con `source ~/.cargo/env`)
- **Tauri CLI v2.7.1**
- **Git 2.48.1**
- **VS Code**

### ⚠️ Pendientes de Instalar
- **Docker Desktop** (necesario para PostgreSQL)
- **PostgreSQL 15x** (para base de datos)
- **Redis** (para cache)

---

## 🚀 Comandos de Desarrollo

### Iniciar Backend (Terminal 1)
```bash
cd /Users/angelsamuelsuescarios/Documents/uniformes-system-v2/backend
source venv/bin/activate
`uvicorn app.main:app --reload`
# ✅ Debe mostrar: "🚀 Starting Uniformes System API"
# ✅ Disponible en: http://127.0.0.1:8000
```

### Iniciar Frontend (Terminal 2)
```bash
cd /Users/angelsamuelsuescarios/Documents/uniformes-system-v2/frontend
source ~/.cargo/env  # ⚠️ IMPORTANTE: Cargar Rust en cada nueva terminal
cd src-tauri
cargo tauri dev
# ✅ Debe abrir ventana nativa con interfaz React
```

---

## 🔧 Configuraciones Críticas

### Tauri Plugins Funcionando
```rust
// frontend/src-tauri/src/main.rs
fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())     // ✅ HTTP requests
        .plugin(tauri_plugin_fs::init())       // ✅ File system
        .plugin(tauri_plugin_dialog::init())   // ✅ File dialogs
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### FastAPI Backend Básico
```python
# backend/app/main.py - Rutas principales configuradas
# ✅ Health check: GET /health
# ⚠️ Pendiente: Conectar con PostgreSQL
```

---

## 🎯 Próximos Pasos Críticos

### 1. Instalar Docker y Base de Datos (PRIORIDAD ALTA)
```bash
# Instalar Docker Desktop para Mac (Apple Silicon)
# URL: https://www.docker.com/products/docker-desktop/

# Después ejecutar:
cd /Users/angelsamuelsuescarios/Documents/uniformes-system-v2
docker-compose -f docker/docker-compose.dev.yml up -d
```

### 2. Conectar Frontend con Backend (PRIORIDAD ALTA)
```typescript
// Crear archivo: frontend/src/api/client.ts
const API_BASE = 'http://127.0.0.1:8000';

export const apiClient = {
  async get(endpoint: string) {
    const response = await fetch(`${API_BASE}${endpoint}`);
    return response.json();
  }
};
```

### 3. Migrar Lógica de Negocio (PRIORIDAD MEDIA)
```python
# Migrar desde proyecto original:
# - Modelos de base de datos (SQLAlchemy)
# - Lógica de inventarios
# - Lógica de ventas
# - Lógica de clientes
```

---

## 📋 Referencia Rápida de Errores Comunes

### Error: "cargo not found"
```bash
# Solución:
source ~/.cargo/env
```

### Error: "Failed to open icon"
```bash
# Solución: Usar configuración sin iconos en tauri.conf.json
# (Ya solucionado en configuración actual)
```

### Error: Plugin HTTP configuration
```bash
# Solución: No configurar plugins en tauri.conf.json
# Solo inicializar en main.rs (ya implementado)
```

---

## 🔗 URLs Importantes

- **Backend API**: http://127.0.0.1:8000
- **API Docs**: http://127.0.0.1:8000/docs (cuando esté configurado)
- **Health Check**: http://127.0.0.1:8000/health

---

## 📚 Documentación de Migración

### Desde Proyecto Original
- **PyQt5 → Tauri+React**: ✅ Base configurada
- **Estructura de BD**: ⚠️ Pendiente migrar schema
- **Lógica de negocio**: ⚠️ Pendiente migrar a FastAPI

### Funcionalidades por Migrar
1. **Gestión de Inventarios** (corte, bordados, confección, empaque)
2. **Gestión de Ventas** (detalles, informes)
3. **Gestión de Clientes** (búsqueda fuzzy, historial)
4. **Sistema de Encargos** (yómbers, fechas entrega)
5. **Sistema de Cambios** (prendas entrantes/salientes)
6. **Análisis Financiero** (movimientos, gastos)

---

## 🎉 Logros Completados

✅ **Estructura del proyecto creada completamente**
✅ **Backend FastAPI funcionando con auto-reload**
✅ **Frontend Tauri+React funcionando con ventana nativa**
✅ **Plugins HTTP, FS, Dialog configurados**
✅ **Entorno de desarrollo completamente operativo**
✅ **Interfaz básica con Tailwind CSS funcionando**

---

## ⚠️ Notas Importantes para Desarrolladores

1. **Siempre ejecutar** `source ~/.cargo/env` en nuevas terminales
2. **Backend debe estar corriendo** antes de hacer requests desde frontend
3. **Docker requerido** para PostgreSQL y Redis
4. **Configuración funciona** para desarrollo en Mac y deployment en Windows
5. **Arquitectura preparada** para escalabilidad y deployment profesional

---

## 🔄 Estado del MVP: COMPLETADO ✅

La aplicación base está **completamente funcional** como MVP. Se puede continuar el desarrollo agregando funcionalidades específicas del negocio de uniformes sobre esta base sólida.