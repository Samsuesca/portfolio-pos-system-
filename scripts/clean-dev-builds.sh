#!/bin/bash
# =============================================================================
# clean-dev-builds.sh - Limpia builds de desarrollo del frontend
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
FRONTEND_DIR="$PROJECT_ROOT/frontend"

echo "=== Limpiando builds de desarrollo ==="
echo "Directorio: $FRONTEND_DIR"
echo ""

# Contadores
CLEANED=0

# 1. Limpiar dist de Vite
if [ -d "$FRONTEND_DIR/dist" ]; then
    echo "- Eliminando frontend/dist..."
    rm -rf "$FRONTEND_DIR/dist"
    ((CLEANED++))
fi

# 2. Limpiar target de Rust/Tauri (debug y release)
if [ -d "$FRONTEND_DIR/src-tauri/target" ]; then
    SIZE=$(du -sh "$FRONTEND_DIR/src-tauri/target" 2>/dev/null | cut -f1)
    echo "- Eliminando src-tauri/target ($SIZE)..."
    rm -rf "$FRONTEND_DIR/src-tauri/target"
    ((CLEANED++))
fi

# 3. Limpiar node_modules (opcional, comentado por defecto)
# if [ -d "$FRONTEND_DIR/node_modules" ]; then
#     echo "- Eliminando node_modules..."
#     rm -rf "$FRONTEND_DIR/node_modules"
#     ((CLEANED++))
# fi

# 4. Limpiar .next de admin-portal y web-portal
for PORTAL in "admin-portal" "web-portal"; do
    PORTAL_DIR="$PROJECT_ROOT/$PORTAL"
    if [ -d "$PORTAL_DIR/.next" ]; then
        echo "- Eliminando $PORTAL/.next..."
        rm -rf "$PORTAL_DIR/.next"
        ((CLEANED++))
    fi
done

# 5. Limpiar cache de TypeScript
if [ -d "$FRONTEND_DIR/.tsbuildinfo" ]; then
    rm -rf "$FRONTEND_DIR/.tsbuildinfo"
fi

echo ""
if [ $CLEANED -eq 0 ]; then
    echo "No habia nada que limpiar."
else
    echo "Limpieza completada: $CLEANED directorios eliminados."
fi
