#!/bin/bash
# Elimina archivos .js que tienen un .tsx o .ts correspondiente
# Esto evita que Vite sirva versiones viejas

cd "$(dirname "$0")/../src" || exit 1

count=0
for js in $(find . -name "*.js" -type f 2>/dev/null); do
  tsx="${js%.js}.tsx"
  ts="${js%.js}.ts"
  if [ -f "$tsx" ] || [ -f "$ts" ]; then
    rm "$js"
    echo "Eliminado: $js"
    ((count++))
  fi
done

if [ $count -gt 0 ]; then
  echo "✓ Eliminados $count archivos .js duplicados"
else
  echo "✓ No hay archivos .js duplicados"
fi

# Limpiar cache de Vite
rm -rf ../node_modules/.vite 2>/dev/null
echo "✓ Cache de Vite limpiado"
