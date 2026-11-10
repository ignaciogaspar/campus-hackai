#!/usr/bin/env bash
# Reemplaza campus/ por una versión nueva del repo de Nacho (zip o carpeta).
# No commitea: el commit aparte lo hace quien corre la skill sync-campus.
#
# Uso: scripts/sync-campus.sh <zip-o-carpeta>
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
CAMPUS="$REPO/campus"

die() { echo "Error: $*" >&2; exit 1; }

[ $# -eq 1 ] || die "uso: scripts/sync-campus.sh <zip-o-carpeta>"
SRC="$1"
[ -e "$SRC" ] || die "no existe: $SRC"
command -v rsync >/dev/null || die "hace falta rsync"

if [ -n "$(git -C "$REPO" status --porcelain -- campus)" ]; then
  die "campus/ tiene cambios sin commitear. campus/ nunca se edita a mano: revisalos con 'git status -- campus' y descartalos o commitealos antes de sincronizar."
fi

TMP=""
cleanup() { [ -z "$TMP" ] || rm -rf "$TMP"; }
trap cleanup EXIT

if [ -f "$SRC" ]; then
  case "$SRC" in
    *.zip) ;;
    *) die "el archivo tiene que ser un .zip: $SRC" ;;
  esac
  command -v unzip >/dev/null || die "hace falta unzip"
  TMP="$(mktemp -d)"
  echo "Descomprimiendo $SRC…"
  unzip -q "$SRC" -d "$TMP" || die "no se pudo descomprimir $SRC"
  rm -rf "$TMP/__MACOSX"
  ROOT="$TMP"
  # si el zip trae una sola carpeta adentro, el contenido es esa carpeta
  while [ ! -f "$ROOT/package.json" ]; do
    entries=()
    while IFS= read -r line; do entries+=("$line"); done < <(find "$ROOT" -mindepth 1 -maxdepth 1 ! -name '.DS_Store')
    if [ "${#entries[@]}" -eq 1 ] && [ -d "${entries[0]}" ]; then ROOT="${entries[0]}"; else break; fi
  done
elif [ -d "$SRC" ]; then
  ROOT="$(cd "$SRC" && pwd -P)"
else
  die "tiene que ser un .zip o una carpeta: $SRC"
fi

[ -f "$ROOT/package.json" ] || die "no parece el repo de campus: no hay package.json en $ROOT"
case "$ROOT/" in
  "$REPO/"*) die "el origen está dentro de este repo ($ROOT). Pasá el zip o la carpeta que mandó Nacho." ;;
esac
case "$REPO/" in
  "$ROOT/"*) die "el origen contiene a este repo ($ROOT). Pasá el zip o la carpeta que mandó Nacho." ;;
esac

echo "Reemplazando campus/ con $ROOT"
mkdir -p "$CAMPUS"
# .env.example se conserva; cualquier otro .env* puede traer secretos y no entra
rsync -a --delete \
  --include='.env.example' \
  --exclude='.env*' \
  --exclude='.DS_Store' \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='.git' \
  "$ROOT/" "$CAMPUS/"

echo
echo "== git status de campus/ =="
STATUS="$(git -C "$REPO" status --short -- campus)"
if [ -z "$STATUS" ]; then
  echo "Sin cambios: campus/ ya estaba igual a ese origen."
  exit 0
fi
echo "$STATUS"
echo
echo "== git diff --stat de campus/ (archivos ya versionados) =="
git -C "$REPO" --no-pager diff --stat -- campus
echo
echo "No se commiteó nada. Revisá los cambios y hacé un commit aparte, solo con campus/:"
echo "  git add campus && git commit -m 'chore(campus): sync snapshot <fecha u origen>'"
echo "Después actualizá docs/campus-upstream.md."
