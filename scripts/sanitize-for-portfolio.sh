#!/bin/bash
# Script de sanitización para portfolio público

set -e

echo "🧹 Sanitizando datos sensibles para portfolio..."

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0

# 1. Reemplazar dominio de producción
echo "📝 Reemplazando dominio..."
find . -type f \( -name "*.py" -o -name "*.ts" -o -name "*.tsx" -o -name "*.md" -o -name "*.yml" \) \
  ! -path "*/node_modules/*" \
  ! -path "*/.git/*" \
  ! -path "*/venv/*" \
  ! -path "*/dist/*" \
  ! -path "*/build/*" \
  -exec sed -i '' 's/uniformesconsuelorios\.com/yourdomain.com/g' {} \;

echo "✓ Dominio reemplazado"

# 2. Reemplazar email
echo "📧 Reemplazando email..."
find . -type f \( -name "*.py" -o -name "*.ts" -o -name "*.tsx" -o -name "*.md" \) \
  ! -path "*/node_modules/*" \
  ! -path "*/.git/*" \
  ! -path "*/venv/*" \
  -exec sed -i '' 's/uniformesconsuelorios@gmail\.com/contact@example.com/g' {} \;

echo "✓ Email reemplazado"

# 3. Reemplazar teléfonos
echo "📱 Reemplazando teléfonos..."

# Reemplazar +57 310 599 7451 y variantes
find . -type f \( -name "*.py" -o -name "*.ts" -o -name "*.tsx" -o -name "*.md" \) \
  ! -path "*/node_modules/*" \
  ! -path "*/.git/*" \
  ! -path "*/venv/*" \
  -exec sed -i '' 's/\+57 310 599 7451/+57 300 123 4567/g' {} \;

find . -type f \( -name "*.py" -o -name "*.ts" -o -name "*.tsx" -o -name "*.md" \) \
  ! -path "*/node_modules/*" \
  ! -path "*/.git/*" \
  ! -path "*/venv/*" \
  -exec sed -i '' 's/310 599 7451/300 123 4567/g' {} \;

find . -type f \( -name "*.py" -o -name "*.ts" -o -name "*.tsx" -o -name "*.md" \) \
  ! -path "*/node_modules/*" \
  ! -path "*/.git/*" \
  ! -path "*/venv/*" \
  -exec sed -i '' 's/310-599-7451/300-123-4567/g' {} \;

find . -type f \( -name "*.py" -o -name "*.ts" -o -name "*.tsx" -o -name "*.md" \) \
  ! -path "*/node_modules/*" \
  ! -path "*/.git/*" \
  ! -path "*/venv/*" \
  -exec sed -i '' 's/3105997451/3001234567/g' {} \;

find . -type f \( -name "*.py" -o -name "*.ts" -o -name "*.tsx" -o -name "*.md" \) \
  ! -path "*/node_modules/*" \
  ! -path "*/.git/*" \
  ! -path "*/venv/*" \
  -exec sed -i '' 's/573105997451/573001234567/g' {} \;

# Segundo teléfono
find . -type f \( -name "*.py" -o -name "*.ts" -o -name "*.tsx" -o -name "*.md" \) \
  ! -path "*/node_modules/*" \
  ! -path "*/.git/*" \
  ! -path "*/venv/*" \
  -exec sed -i '' 's/313-485-6061/300-765-4321/g' {} \;

echo "✓ Teléfonos reemplazados"

# 4. Eliminar backups (si existen)
if [ -d "backups" ]; then
  echo "🗑️  Eliminando carpeta backups..."
  rm -rf backups/
  echo "✓ Backups eliminados"
fi

# 5. Verificar que no quedan datos sensibles
echo ""
echo "🔍 Verificando sanitización..."
echo ""

if grep -r "uniformesconsuelorios\.com" . \
  --include="*.py" --include="*.ts" --include="*.tsx" --include="*.md" \
  --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=venv \
  --exclude-dir=dist --exclude-dir=build 2>/dev/null; then
  echo -e "${RED}❌ ERROR: Dominio de producción encontrado${NC}"
  ERRORS=$((ERRORS + 1))
fi

if grep -r "3105997451\|310 599 7451\|310-599-7451" . \
  --include="*.py" --include="*.ts" --include="*.tsx" --include="*.md" \
  --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=venv \
  --exclude-dir=dist --exclude-dir=build 2>/dev/null; then
  echo -e "${RED}❌ ERROR: Teléfono de producción encontrado${NC}"
  ERRORS=$((ERRORS + 1))
fi

if grep -r "uniformesconsuelorios@gmail\.com" . \
  --include="*.py" --include="*.ts" --include="*.tsx" --include="*.md" \
  --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=venv 2>/dev/null; then
  echo -e "${RED}❌ ERROR: Email de producción encontrado${NC}"
  ERRORS=$((ERRORS + 1))
fi

# 6. Verificar archivos .env
if [ -f "backend/.env" ]; then
  echo -e "${RED}❌ ERROR: backend/.env existe (debe ser .env.example)${NC}"
  ERRORS=$((ERRORS + 1))
fi

if [ -f "frontend/.env" ]; then
  echo -e "${RED}❌ ERROR: frontend/.env existe (debe ser .env.example)${NC}"
  ERRORS=$((ERRORS + 1))
fi

if [ ! -f "backend/.env.example" ]; then
  echo -e "${YELLOW}⚠️  WARNING: backend/.env.example no existe${NC}"
fi

# 7. Resultado
echo ""
if [ $ERRORS -eq 0 ]; then
  echo -e "${GREEN}✅ Sanitización exitosa - No hay datos sensibles${NC}"
  echo ""
  echo "📋 Archivos modificados:"
  git status --short 2>/dev/null || echo "   (git status no disponible)"
  exit 0
else
  echo -e "${RED}❌ Sanitización falló con $ERRORS errores${NC}"
  echo ""
  echo "Por favor revisa los errores arriba y ejecuta nuevamente."
  exit 1
fi
