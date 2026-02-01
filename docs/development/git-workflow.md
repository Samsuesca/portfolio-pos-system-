# 🔧 Git Workflow - Uniformes System v2.0

Esta guía describe el flujo de trabajo con Git/GitHub para el proyecto.

---

## 📦 Repositorio

**URL**: https://github.com/Samsuesca/uniformes-system-v2

---

## 🌿 Estrategia de Branches

### Branches Principales

```
main (producción)
  ↑
develop (desarrollo)
  ↑
feature/* (nuevas funcionalidades)
bugfix/* (corrección de bugs)
hotfix/* (parches urgentes)
```

### Descripción

- **`main`**: Código en producción, estable
  - Solo merges desde `develop` o `hotfix/*`
  - Cada merge = nueva release
  - Protegida (requiere pull request)

- **`develop`**: Rama de desarrollo activo
  - Base para nuevas features
  - Código funcional pero en testing
  - Merge frecuente desde `feature/*` y `bugfix/*`

- **`feature/*`**: Nuevas funcionalidades
  - Formato: `feature/nombre-descriptivo`
  - Ejemplos:
    - `feature/multi-tenant-models`
    - `feature/authentication-system`
    - `feature/sales-module`
  - Crear desde `develop`
  - Merge a `develop` cuando esté lista

- **`bugfix/*`**: Corrección de bugs
  - Formato: `bugfix/descripcion-del-bug`
  - Ejemplos:
    - `bugfix/inventory-calculation-error`
    - `bugfix/login-validation`
  - Crear desde `develop`
  - Merge a `develop`

- **`hotfix/*`**: Parches urgentes en producción
  - Formato: `hotfix/descripcion-urgente`
  - Crear desde `main`
  - Merge a `main` Y `develop`

---

## 🚀 Workflow Diario

### 1. Trabajar en Nueva Feature

```bash
# 1. Actualizar develop
git checkout develop
git pull origin develop

# 2. Crear rama de feature
git checkout -b feature/nombre-descriptivo

# 3. Trabajar en la feature
# ... hacer cambios en archivos ...

# 4. Revisar cambios
git status
git diff

# 5. Agregar archivos
git add .
# O selectivo:
git add backend/app/models/product.py

# 6. Commit con mensaje descriptivo
git commit -m "Add Product model with multi-tenant support

- Create Product SQLAlchemy model
- Add school_id foreign key
- Implement size, color, price fields
- Add indexes for performance"

# 7. Push a GitHub
git push -u origin feature/nombre-descriptivo

# 8. Crear Pull Request en GitHub (interfaz web)
# Ir a: https://github.com/Samsuesca/uniformes-system-v2/pulls
# Click "New pull request"
# Base: develop ← Compare: feature/nombre-descriptivo
```

### 2. Actualizar Rama con Cambios de Develop

```bash
# Si develop avanzó mientras trabajabas en tu feature
git checkout feature/tu-feature
git pull origin develop

# Resolver conflictos si los hay
# Hacer commit del merge
git push
```

### 3. Completar Feature (Merge a Develop)

```bash
# Opción A: Usando GitHub Pull Request (RECOMENDADO)
# 1. Crear PR en GitHub
# 2. Esperar review (si trabajas en equipo)
# 3. Merge en la interfaz web
# 4. Borrar rama en GitHub
# 5. Actualizar local:
git checkout develop
git pull origin develop
git branch -d feature/nombre-descriptivo

# Opción B: Merge local (solo desarrollo individual)
git checkout develop
git pull origin develop
git merge --no-ff feature/nombre-descriptivo
git push origin develop
git branch -d feature/nombre-descriptivo
```

---

## 📝 Convenciones de Commits

### Formato

```
<tipo>: <descripción corta>

<cuerpo opcional con más detalles>

<footer opcional>
```

### Tipos de Commit

- `feat`: Nueva funcionalidad
- `fix`: Corrección de bug
- `docs`: Cambios en documentación
- `style`: Formateo, punto y coma faltante, etc (no afecta código)
- `refactor`: Refactorización de código
- `test`: Agregar o modificar tests
- `chore`: Tareas de mantenimiento, actualizar dependencias

### Ejemplos

```bash
# Feature
git commit -m "feat: add Product model with multi-tenant support"

# Bugfix
git commit -m "fix: resolve inventory calculation error for exchanges

- Update inventory trigger to handle exchange_items
- Add constraint to prevent negative quantities
- Fix rounding issue in price calculations"

# Documentation
git commit -m "docs: update DATABASE.md with triggers documentation"

# Refactor
git commit -m "refactor: extract authentication logic to service layer"

# Chore
git commit -m "chore: update FastAPI to version 0.105"
```

---

## 🔒 Archivos Sensibles

### ⚠️ NUNCA Commitear

```bash
# Ya están en .gitignore, pero verificar siempre:
.env                  # Variables de entorno con contraseñas
*.pem                 # Certificados SSL
*.key                 # Claves privadas
credentials.json      # Credenciales de servicios
venv/                 # Entorno virtual Python
node_modules/         # Dependencias Node.js
__pycache__/          # Cache Python
.DS_Store             # Archivos macOS
```

### ✅ Sí Commitear

```bash
.env.example          # Plantilla sin secretos
requirements.txt      # Dependencias Python
package.json          # Dependencias Node.js
docker-compose.dev.yml
README.md
docs/
alembic/versions/     # Migraciones de BD (IMPORTANTE)
```

### Verificar Antes de Commit

```bash
# Ver qué archivos se van a commitear
git status

# Ver diferencias
git diff

# Ver archivos ignorados (no deben aparecer secretos)
git status --ignored

# Si accidentalmente agregaste un archivo sensible:
git reset HEAD archivo-sensible.env
git restore archivo-sensible.env
```

---

## 🏷️ Tags y Releases

### Crear Versión (Release)

```bash
# Cuando merges a main, crear tag
git checkout main
git pull origin main

# Crear tag anotado
git tag -a v2.0.0 -m "Release v2.0.0: Initial multi-tenant system

Features:
- Multi-school architecture
- Complete database schema
- Docker development environment
- Comprehensive documentation"

# Push tag a GitHub
git push origin v2.0.0

# Ver tags
git tag -l
```

### Versionado Semántico

Formato: `vMAJOR.MINOR.PATCH`

- **MAJOR**: Cambios incompatibles (breaking changes)
- **MINOR**: Nueva funcionalidad compatible
- **PATCH**: Corrección de bugs

Ejemplos:
- `v2.0.0` → Primera versión completa
- `v2.1.0` → Agregar módulo de reportes
- `v2.1.1` → Corregir bug en reportes
- `v3.0.0` → Cambio de arquitectura (breaking)

---

## 🔄 Sincronización Diaria

### Inicio del Día

```bash
# Actualizar main y develop
git checkout main
git pull origin main

git checkout develop
git pull origin develop

# Volver a tu rama de trabajo
git checkout feature/tu-feature
git pull origin develop  # Traer últimos cambios
```

### Fin del Día

```bash
# Commitear trabajo del día
git add .
git commit -m "feat: WIP - implementing sales module

Work in progress:
- Created Sale and SaleItem models
- Added basic CRUD endpoints
- TODO: Add validation and tests"

# Push para backup en GitHub
git push origin feature/tu-feature
```

---

## 🐛 Resolver Conflictos

### Cuando Aparece Conflicto

```bash
# Intentar merge o pull
git pull origin develop
# Error: CONFLICT (content): Merge conflict in backend/app/models/product.py

# 1. Ver archivos en conflicto
git status

# 2. Abrir archivo y buscar marcadores:
# <<<<<<< HEAD
# Tu código actual
# =======
# Código entrante de develop
# >>>>>>> develop

# 3. Editar manualmente, decidir qué quedarse
# Borrar los marcadores (<<<<, ====, >>>>)

# 4. Agregar archivo resuelto
git add backend/app/models/product.py

# 5. Completar merge
git commit -m "merge: resolve conflict in Product model"

# 6. Push
git push
```

---

## 📊 Comandos Útiles

### Información

```bash
# Ver historial
git log --oneline --graph --all

# Ver cambios en archivo específico
git log -p backend/app/models/product.py

# Ver quién cambió cada línea
git blame backend/app/models/product.py

# Ver diferencias entre branches
git diff develop..main

# Ver archivos cambiados
git diff --name-only
```

### Deshacer Cambios

```bash
# Descartar cambios no commiteados
git restore archivo.py
git restore .  # Todos los archivos

# Deshacer último commit (mantener cambios)
git reset --soft HEAD~1

# Deshacer último commit (BORRAR cambios) ⚠️
git reset --hard HEAD~1

# Deshacer push (PELIGROSO, evitar en main) ⚠️
git push --force origin main  # Solo en emergencias
```

### Limpieza

```bash
# Ver branches locales
git branch

# Borrar branch local
git branch -d feature/ya-mergeada

# Borrar branch remota
git push origin --delete feature/ya-mergeada

# Limpiar branches remotas eliminadas
git fetch --prune

# Ver branches mergeadas (para limpiar)
git branch --merged
```

---

## 🔐 Autenticación

### Personal Access Token (PAT)

Si usaste HTTPS (tu caso), Git pedirá credenciales al hacer `git push`:

```
Username: Samsuesca
Password: [tu_personal_access_token]
```

**Crear nuevo token**: https://github.com/settings/tokens

**Guardar credenciales** (para no ingresarlas siempre):

```bash
# macOS - usar Keychain
git config --global credential.helper osxkeychain

# La primera vez que hagas push, guardar:
git push
# Ingresar username y token
# macOS lo guarda automáticamente en Keychain

# Próximos push no pedirán credenciales
```

---

## 🚨 Casos de Emergencia

### Commiteaste Algo Sensible (.env, password)

```bash
# 1. Si NO hiciste push aún:
git reset --soft HEAD~1
git restore .env
git add .
git commit -m "feat: add feature (fixed)"

# 2. Si YA hiciste push ⚠️:
# CONTACTAR AL EQUIPO INMEDIATAMENTE
# Cambiar todas las contraseñas/tokens expuestos
# Usar herramientas como BFG Repo-Cleaner para limpiar historial
```

### Rompiste Main

```bash
# Revertir último commit en main (crea commit nuevo)
git checkout main
git revert HEAD
git push origin main

# O rollback a commit anterior (más drástico)
git checkout main
git reset --hard commit_hash_anterior
git push --force origin main  # ⚠️ Coordinar con equipo
```

---

## 📚 Recursos

- **GitHub Repo**: https://github.com/Samsuesca/uniformes-system-v2
- **GitHub Docs**: https://docs.github.com
- **Git Book**: https://git-scm.com/book/en/v2
- **Conventional Commits**: https://www.conventionalcommits.org

---

## ✅ Checklist Pre-Commit

Antes de cada commit, verificar:

- [ ] `git status` - revisar archivos que se van a commitear
- [ ] No hay archivos sensibles (.env, passwords)
- [ ] Código funciona localmente
- [ ] Tests pasan (cuando los tengamos)
- [ ] Mensaje de commit es descriptivo
- [ ] No hay `console.log` o `print()` de debugging
- [ ] Imports organizados y sin warnings

---

## 🎯 Próximos Pasos

1. Crear rama `develop` desde `main`
2. Empezar primera feature: `feature/database-models`
3. Configurar branch protection rules en GitHub
4. Configurar GitHub Actions para CI/CD (futuro)
