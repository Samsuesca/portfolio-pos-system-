#!/usr/bin/env bash
# Crea el repo publico Samsuesca/uniformes-feedback con los 4 issue templates.
# Requiere: gh autenticado (gh auth login)
set -euo pipefail

REPO_NAME="uniformes-feedback"
REPO_OWNER="Samsuesca"
REPO_FULL="${REPO_OWNER}/${REPO_NAME}"
SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/.github/ISSUE_TEMPLATE"
TMP_DIR="$(mktemp -d)"

if ! command -v gh >/dev/null 2>&1; then
  echo "ERROR: gh CLI no instalado. brew install gh"
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "ERROR: gh no autenticado. Corre: gh auth login -h github.com"
  exit 1
fi

if [ ! -d "$SOURCE_DIR" ]; then
  echo "ERROR: no se encontro $SOURCE_DIR"
  exit 1
fi

if gh repo view "$REPO_FULL" >/dev/null 2>&1; then
  echo "[i] El repo ${REPO_FULL} ya existe. Solo voy a sincronizar templates."
else
  echo "[+] Creando repo publico ${REPO_FULL}..."
  gh repo create "$REPO_FULL" \
    --public \
    --description "Feedback de usuarios de Uniformes Consuelo Rios (bugs, mejoras, UX)" \
    --homepage "https://uniformesconsuelorios.com"
fi

echo "[+] Clonando repo a directorio temporal..."
cd "$TMP_DIR"
gh repo clone "$REPO_FULL" repo
cd repo

mkdir -p .github/ISSUE_TEMPLATE
cp "$SOURCE_DIR"/*.yml .github/ISSUE_TEMPLATE/

if [ ! -f README.md ]; then
  cat > README.md <<'EOF'
# Uniformes Consuelo Rios — Feedback

Este repo es solo para reportar problemas, sugerir mejoras o dar feedback de UX
sobre el sistema de **Uniformes Consuelo Rios**.

## Como reportar

Ve a [Issues > New issue](../../issues/new/choose) y elige uno de los 3 templates:

- **Bug Report** — Algo no funciona como deberia
- **Feature Request** — Algo que falta o podria mejorar
- **Feedback de UX** — Algo confuso, feo o lento

Tambien puedes abrir los formularios desde la app misma (boton de ayuda en la
esquina inferior derecha en el portal de padres y admin, o en la barra superior
en la app de escritorio).

## Para algo urgente

[WhatsApp](https://wa.me/573000000000) — reemplaza el numero en `.github/ISSUE_TEMPLATE/config.yml`.
EOF
fi

git add .github/ISSUE_TEMPLATE/*.yml README.md
if git diff --cached --quiet; then
  echo "[i] No hay cambios que commitear."
else
  git -c user.email="suescapsam@gmail.com" -c user.name="SamSuesca" \
    commit -m "chore: sync issue templates from main repo"
  git push
fi

echo "[+] Listo. Issues disponibles en:"
echo "    https://github.com/${REPO_FULL}/issues/new/choose"
