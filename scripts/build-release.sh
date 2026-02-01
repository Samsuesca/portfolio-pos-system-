#!/bin/bash
# =============================================================================
# build-release.sh - Construye DMG de produccion basado en un tag
# =============================================================================
# Uso: ./build-release.sh [tag]
# Ejemplo: ./build-release.sh v2.1.0
# Si no se especifica tag, usa el tag mas reciente
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
FRONTEND_DIR="$PROJECT_ROOT/frontend"

# Directorio de salida para DMGs de produccion
OUTPUT_DIR="$HOME/Documents/Uniformes-DMGs"

# Obtener tag
if [ -n "$1" ]; then
    TAG="$1"
else
    # Usar el tag mas reciente
    TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
    if [ -z "$TAG" ]; then
        echo "Error: No se encontro ningun tag. Especifica uno: ./build-release.sh v2.1.0"
        exit 1
    fi
fi

echo "=== Build Release: $TAG ==="
echo ""

# Verificar que el tag existe
if ! git rev-parse "$TAG" >/dev/null 2>&1; then
    echo "Error: El tag '$TAG' no existe."
    echo "Tags disponibles:"
    git tag -l | tail -10
    exit 1
fi

# Crear directorio de salida si no existe
mkdir -p "$OUTPUT_DIR"

# Guardar branch actual
CURRENT_BRANCH=$(git branch --show-current)
echo "Branch actual: $CURRENT_BRANCH"
echo "Cambiando a tag: $TAG"
echo ""

# Checkout al tag
git checkout "$TAG" --quiet

# Actualizar version en tauri.conf.json basado en el tag
VERSION="${TAG#v}"  # Quitar 'v' del inicio (v2.1.0 -> 2.1.0)
TAURI_CONF="$FRONTEND_DIR/src-tauri/tauri.conf.json"

echo "Actualizando version a $VERSION en tauri.conf.json..."
# Usar sed para actualizar la version
sed -i '' "s/\"version\": \"[^\"]*\"/\"version\": \"$VERSION\"/" "$TAURI_CONF"

# Instalar dependencias
echo ""
echo "=== Instalando dependencias ==="
cd "$FRONTEND_DIR"
npm install --silent

# Build de produccion
echo ""
echo "=== Construyendo aplicacion (esto puede tomar varios minutos) ==="
npm run tauri build

# Buscar el DMG generado
DMG_SOURCE=$(find "$FRONTEND_DIR/src-tauri/target/release/bundle/dmg" -name "*.dmg" 2>/dev/null | head -1)

if [ -z "$DMG_SOURCE" ]; then
    echo "Error: No se encontro el DMG generado."
    git checkout "$CURRENT_BRANCH" --quiet
    exit 1
fi

# Copiar DMG con nombre que incluye version y fecha
TIMESTAMP=$(date +%Y%m%d)
DMG_NAME="Uniformes-Consuelo-Rios-${VERSION}-${TIMESTAMP}.dmg"
DMG_DEST="$OUTPUT_DIR/$DMG_NAME"

echo ""
echo "=== Copiando DMG ==="
cp "$DMG_SOURCE" "$DMG_DEST"
echo "DMG guardado en: $DMG_DEST"

# Mostrar info del DMG
DMG_SIZE=$(du -h "$DMG_DEST" | cut -f1)
echo "Tamano: $DMG_SIZE"

# Volver al branch original
echo ""
echo "=== Volviendo a branch: $CURRENT_BRANCH ==="
git checkout "$CURRENT_BRANCH" --quiet

# Restaurar tauri.conf.json
git checkout -- "$TAURI_CONF" 2>/dev/null || true

echo ""
echo "=== Build completado ==="
echo "DMG: $DMG_DEST"
echo ""
echo "Para instalar:"
echo "  open \"$DMG_DEST\""
