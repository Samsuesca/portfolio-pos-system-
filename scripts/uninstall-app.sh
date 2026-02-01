#!/bin/bash
# =============================================================================
# uninstall-app.sh - Desinstala Uniformes Consuelo Rios de la Mac
# =============================================================================

set -e

APP_NAME="Uniformes Consuelo Rios"
APP_BUNDLE_ID="com.uniformes.system"

echo "=== Desinstalando $APP_NAME ==="
echo ""

REMOVED=0

# 1. Eliminar de /Applications
if [ -d "/Applications/$APP_NAME.app" ]; then
    echo "- Eliminando /Applications/$APP_NAME.app..."
    rm -rf "/Applications/$APP_NAME.app"
    ((REMOVED++))
fi

# 2. Eliminar de ~/Applications (si existe)
if [ -d "$HOME/Applications/$APP_NAME.app" ]; then
    echo "- Eliminando ~/Applications/$APP_NAME.app..."
    rm -rf "$HOME/Applications/$APP_NAME.app"
    ((REMOVED++))
fi

# 3. Limpiar caches de la aplicacion
CACHE_DIRS=(
    "$HOME/Library/Caches/$APP_BUNDLE_ID"
    "$HOME/Library/Application Support/$APP_NAME"
    "$HOME/Library/Application Support/$APP_BUNDLE_ID"
    "$HOME/Library/Preferences/$APP_BUNDLE_ID.plist"
    "$HOME/Library/Saved Application State/$APP_BUNDLE_ID.savedState"
    "$HOME/Library/WebKit/$APP_BUNDLE_ID"
)

for DIR in "${CACHE_DIRS[@]}"; do
    if [ -e "$DIR" ]; then
        echo "- Eliminando $(basename "$DIR")..."
        rm -rf "$DIR"
        ((REMOVED++))
    fi
done

# 4. Limpiar Tauri WebView data
TAURI_DATA="$HOME/Library/Application Support/com.uniformes.system"
if [ -d "$TAURI_DATA" ]; then
    echo "- Eliminando datos de Tauri WebView..."
    rm -rf "$TAURI_DATA"
    ((REMOVED++))
fi

# 5. Limpiar logs de la app
LOG_DIR="$HOME/Library/Logs/$APP_NAME"
if [ -d "$LOG_DIR" ]; then
    echo "- Eliminando logs..."
    rm -rf "$LOG_DIR"
    ((REMOVED++))
fi

echo ""
if [ $REMOVED -eq 0 ]; then
    echo "La aplicacion no estaba instalada."
else
    echo "Desinstalacion completada: $REMOVED elementos eliminados."
fi

echo ""
echo "Nota: Si la app estaba en el Dock, deberas quitarla manualmente."
