# 🛠️ Guía de Setup Detallada - Uniformes System v2.0

Esta guía te llevará paso a paso desde cero hasta tener el proyecto funcionando en tu máquina.

## 📋 Checklist de Instalación

- [ ] Docker Desktop instalado
- [ ] Node.js 18+ instalado
- [ ] Python 3.10+ instalado
- [ ] Rust instalado
- [ ] Git configurado
- [ ] Editor de código (VSCode recomendado)

---

## 1️⃣ Instalar Herramientas Base

### macOS

```bash
# Homebrew (si no lo tienes)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Node.js (usando nvm - recomendado)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.zshrc  # o ~/.bashrc
nvm install 22
nvm use 22

# Python 3 (viene preinstalado, pero verifica la versión)
python3 --version  # Debe ser 3.10+

# Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env

# Docker Desktop
# Descargar de: https://www.docker.com/products/docker-desktop/
# Seguir el instalador gráfico

# Git (viene preinstalado, verificar)
git --version
```

### Windows

```powershell
# Chocolatey (gestor de paquetes)
# Ejecutar PowerShell como Administrador:
Set-ExecutionPolicy Bypass -Scope Process -Force
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

# Node.js
choco install nodejs-lts

# Python
choco install python

# Rust
# Descargar de: https://rustup.rs/
# Ejecutar instalador

# Docker Desktop
# Descargar de: https://www.docker.com/products/docker-desktop/

# Git
choco install git
```

### Linux (Ubuntu/Debian)

```bash
# Node.js (usando nvm)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 22
nvm use 22

# Python 3
sudo apt update
sudo apt install python3 python3-pip python3-venv

# Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env

# Docker
sudo apt install docker.io docker-compose
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker $USER  # Permite usar Docker sin sudo

# Git
sudo apt install git
```

---

## 2️⃣ Verificar Instalaciones

Ejecuta estos comandos para confirmar que todo está instalado:

```bash
# Docker
docker --version
# Esperado: Docker version 28.x.x

docker-compose --version
# Esperado: Docker Compose version v2.x.x

# Node.js y npm
node --version
# Esperado: v22.x.x o superior

npm --version
# Esperado: 10.x.x o superior

# Python
python3 --version
# Esperado: Python 3.10.x o superior

# Rust
rustc --version
# Esperado: rustc 1.x.x

cargo --version
# Esperado: cargo 1.x.x

# Git
git --version
# Esperado: git version 2.x.x
```

✅ Si todos los comandos funcionan, continúa al siguiente paso.

---

## 3️⃣ Clonar el Proyecto

```bash
# Navegar a tu carpeta de proyectos
cd ~/Documents  # o la carpeta que prefieras

# Clonar el repositorio
git clone <URL-DEL-REPOSITORIO>
cd uniformes-system-v2

# Verificar que estés en la rama correcta
git branch
git status
```

---

## 4️⃣ Configurar Backend (Python + FastAPI)

```bash
# Navegar a la carpeta backend
cd backend

# Crear entorno virtual
python3 -m venv venv

# Activar entorno virtual
# macOS/Linux:
source venv/bin/activate

# Windows (PowerShell):
.\venv\Scripts\Activate.ps1

# Windows (CMD):
venv\Scripts\activate.bat

# Tu prompt debe cambiar mostrando (venv)

# Instalar dependencias
pip install --upgrade pip
pip install -r requirements.txt

# Verificar instalaciones críticas
python -c "import sqlalchemy; print(f'SQLAlchemy: {sqlalchemy.__version__}')"
python -c "import fastapi; print(f'FastAPI: {fastapi.__version__}')"
python -c "import asyncpg; print('asyncpg OK')"
python -c "import alembic; print('Alembic OK')"

# Si todo importa sin error, ¡listo! ✅
```

---

## 5️⃣ Configurar Frontend (React + Tauri)

```bash
# Desde la raíz del proyecto
cd frontend

# Instalar dependencias npm
npm install

# Esto puede tomar varios minutos...
# Verás muchas líneas de instalación

# Verificar instalaciones
npm list react
npm list @tauri-apps/api

# ✅ No debe haber errores
```

---

## 6️⃣ Configurar Docker (PostgreSQL + Redis)

```bash
# Desde la raíz del proyecto
cd ..  # Volver a la raíz (uniformes-system-v2/)

# Iniciar Docker Desktop (GUI)
# Esperar a que el ícono de Docker muestre "running"

# Levantar servicios
docker-compose -f docker/docker-compose.dev.yml up -d postgres redis

# Esperar unos segundos mientras descarga las imágenes...
# Primera vez puede tomar 2-5 minutos

# Verificar que estén corriendo
docker ps

# Debes ver algo como:
# CONTAINER ID   IMAGE                STATUS
# xxxxx          postgres:15-alpine   Up X seconds (healthy)
# xxxxx          redis:7-alpine       Up X seconds (healthy)
```

### Probar Conexión a PostgreSQL

```bash
cd backend
source venv/bin/activate  # Si no lo habías activado

# Test de conexión
python -c "
import asyncio
import asyncpg

async def test():
    conn = await asyncpg.connect(
        'postgresql://uniformes_user:dev_password@localhost:5432/uniformes_db'
    )
    version = await conn.fetchval('SELECT version()')
    print('✅ PostgreSQL conectado!')
    print(f'Versión: {version[:60]}')
    await conn.close()

asyncio.run(test())
"

# Si ves "✅ PostgreSQL conectado!" estás listo
```

---

## 7️⃣ Iniciar el Proyecto (Primera Vez)

### Terminal 1: Backend API

```bash
cd backend
source venv/bin/activate  # macOS/Linux
# o venv\Scripts\activate  # Windows

uvicorn app.main:app --reload

# Debes ver:
# 🚀 Starting Uniformes System API
# INFO:     Uvicorn running on http://127.0.0.1:8000
```

Abre en navegador: http://localhost:8000/docs
✅ Debes ver la documentación interactiva de la API (Swagger UI)

### Terminal 2: Frontend Tauri

```bash
cd frontend
npm run tauri:dev

# Primera vez compilará Rust (5-10 minutos)
# Verás muchas líneas de compilación...

# Al terminar se abrirá una ventana nativa con la app ✅
```

---

## 8️⃣ Configuración Opcional (Recomendada)

### Instalar Cliente PostgreSQL GUI

**Opción A: Postico (macOS)**
```bash
brew install --cask postico

# O descargar de: https://eggerapps.at/postico2/
```

**Opción B: DBeaver (Multiplataforma)**
```bash
# macOS
brew install --cask dbeaver-community

# Windows
choco install dbeaver

# Linux
sudo snap install dbeaver-ce

# O descargar de: https://dbeaver.io/
```

**Configuración en Postico/DBeaver:**
```
Connection Name: Uniformes Dev
Host: localhost
Port: 5432
Database: uniformes_db
User: uniformes_user
Password: dev_password
```

Haz clic en "Test Connection" → Debe conectar exitosamente ✅

### Configurar VSCode (Recomendado)

```bash
# Instalar VSCode
# macOS
brew install --cask visual-studio-code

# Windows
choco install vscode

# Linux
sudo snap install code --classic
```

**Extensiones recomendadas:**
1. Python (Microsoft)
2. Pylance (Microsoft)
3. ESLint (Microsoft)
4. Prettier - Code formatter
5. Tailwind CSS IntelliSense
6. rust-analyzer
7. Docker
8. GitLens

```bash
# Abrir proyecto en VSCode
code .
```

En VSCode, instala las extensiones sugeridas cuando te lo pida.

---

## 9️⃣ Verificación Final

### Checklist de Funcionamiento

- [ ] Docker Desktop está corriendo
- [ ] Contenedores postgres y redis muestran status "healthy"
- [ ] Backend API responde en http://localhost:8000/docs
- [ ] Frontend Tauri abre ventana nativa
- [ ] No hay errores en las terminales
- [ ] Puedes conectarte a PostgreSQL con Postico/DBeaver

### Comandos de Verificación Rápida

```bash
# Ver estado de contenedores
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Probar endpoint de health del backend
curl http://localhost:8000/health

# Debe responder:
# {"status":"ok","timestamp":"...","version":"2.0.0"}
```

---

## 🐛 Troubleshooting Común

### Error: "Puerto 5432 ya en uso"

```bash
# Ver qué proceso usa el puerto
lsof -i:5432  # macOS/Linux
netstat -ano | findstr :5432  # Windows

# Si tienes PostgreSQL local instalado, detenerlo:
# macOS
brew services stop postgresql

# Windows
net stop postgresql-x64-xx

# Linux
sudo systemctl stop postgresql
```

### Error: "Docker daemon not running"

1. Abrir Docker Desktop (aplicación GUI)
2. Esperar a que muestre "running"
3. Reintentar comandos docker

### Error: "Cannot find module 'vite'"

```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
```

### Error: "Rust compilation failed"

```bash
# Actualizar Rust
rustup update stable

# Limpiar cache de Cargo
cd frontend/src-tauri
cargo clean

# Reintentar
npm run tauri:dev
```

### Error: "ModuleNotFoundError: No module named 'X'"

```bash
cd backend
source venv/bin/activate
pip install -r requirements.txt --force-reinstall
```

---

## 📚 Próximos Pasos

Una vez que todo funcione:

1. ✅ Lee la [Arquitectura de BD](DATABASE.md)
2. ✅ Revisa la [Documentación de API](API.md)
3. ✅ Familiarízate con la estructura del código
4. ✅ Crea tu primera migración de base de datos

---

## 💡 Tips de Productividad

### Alias útiles (opcional)

Agregar al `~/.zshrc` o `~/.bashrc`:

```bash
# Backend
alias uv-start="cd ~/Documents/uniformes-system-v2/backend && source venv/bin/activate && uvicorn app.main:app --reload"

# Docker
alias u-docker="docker-compose -f ~/Documents/uniformes-system-v2/docker/docker-compose.dev.yml"
alias u-logs="docker-compose -f ~/Documents/uniformes-system-v2/docker/docker-compose.dev.yml logs -f"

# PostgreSQL
alias u-psql="docker exec -it docker-postgres-1 psql -U uniformes_user -d uniformes_db"
```

Recargar: `source ~/.zshrc`

Usar: `uv-start`, `u-docker up -d`, `u-logs postgres`, etc.

---

## ✅ Conclusión

Si llegaste hasta aquí y todos los pasos funcionaron:

**¡Felicidades! 🎉**

Tu entorno de desarrollo está 100% configurado y listo para empezar a programar.

**Siguiente paso:** Crear los modelos de base de datos multi-tenant.
