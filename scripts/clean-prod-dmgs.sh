#!/bin/bash
# =============================================================================
# clean-prod-dmgs.sh - Limpia DMGs de produccion construidos
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
FRONTEND_DIR="$PROJECT_ROOT/frontend"

# Ubicaciones donde Tauri genera los DMGs
BUNDLE_DIR="$FRONTEND_DIR/src-tauri/target/release/bundle"

echo "=== Limpiando DMGs de produccion ==="
echo ""

CLEANED=0

# 1. Limpiar DMGs en bundle/dmg
if [ -d "$BUNDLE_DIR/dmg" ]; then
    DMG_COUNT=$(find "$BUNDLE_DIR/dmg" -name "*.dmg" 2>/dev/null | wc -l | tr -d ' ')
    if [ "$DMG_COUNT" -gt 0 ]; then
        echo "- Eliminando $DMG_COUNT DMG(s) en bundle/dmg..."
        rm -rf "$BUNDLE_DIR/dmg"/*.dmg
        ((CLEANED++))
    fi
fi

# 2. Limpiar .app en bundle/macos
if [ -d "$BUNDLE_DIR/macos" ]; then
    APP_COUNT=$(find "$BUNDLE_DIR/macos" -name "*.app" -type d 2>/dev/null | wc -l | tr -d ' ')
    if [ "$APP_COUNT" -gt 0 ]; then
        echo "- Eliminando $APP_COUNT app(s) en bundle/macos..."
        rm -rf "$BUNDLE_DIR/macos"/*.app
        ((CLEANED++))
    fi
fi

# 3. Limpiar todo el directorio bundle si existe
if [ -d "$BUNDLE_DIR" ]; then
    SIZE=$(du -sh "$BUNDLE_DIR" 2>/dev/null | cut -f1)
    echo "- Eliminando directorio bundle completo ($SIZE)..."
    rm -rf "$BUNDLE_DIR"
    ((CLEANED++))
fi

# 4. Limpiar DMGs sueltos en el proyecto
LOOSE_DMGS=$(find "$PROJECT_ROOT" -maxdepth 2 -name "*.dmg" 2>/dev/null)
if [ -n "$LOOSE_DMGS" ]; then
    echo "- Eliminando DMGs sueltos en el proyecto..."
    echo "$LOOSE_DMGS" | while read dmg; do
        echo "  - $(basename "$dmg")"
        rm -f "$dmg"
    done
    ((CLEANED++))
fi

echo ""
if [ $CLEANED -eq 0 ]; then
    echo "No habia DMGs que limpiar."
else
    echo "Limpieza completada."
fi
