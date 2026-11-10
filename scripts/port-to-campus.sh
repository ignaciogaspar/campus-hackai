#!/usr/bin/env bash
# Copia una feature de hackai/ a una copia de campus y deja el diff y un .patch.
# Ese diff es lo que se le manda a Nacho. Nunca escribe en campus/ de este repo.
#
# Uso: scripts/port-to-campus.sh <feature> [destino]
#   feature   nombre de la carpeta de la feature (por ejemplo: avisos)
#   destino   clon del repo de Nacho, con el árbol de git limpio. Sin destino
#             se usa una copia temporal de campus/ fuera de este repo.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
HACKAI="$REPO/hackai"
CAMPUS="$REPO/campus"
COMPAT_FILE="$HACKAI/compat.txt"

die() { echo "Error: $*" >&2; exit 1; }

[ $# -ge 1 ] && [ $# -le 2 ] || die "uso: scripts/port-to-campus.sh <feature> [destino]"
F="$1"
DEST_ARG="${2:-}"

[[ "$F" =~ ^[a-z][a-z0-9-]*$ ]] || die "nombre de feature inválido: '$F'. Usá minúsculas, números y guiones (por ejemplo: avisos)."
command -v rsync >/dev/null || die "hace falta rsync"
[ -d "$HACKAI" ] || die "no existe $HACKAI"

F_SNAKE="${F//-/_}"
F_UPPER="$(printf '%s' "$F" | tr '[:lower:]' '[:upper:]')"

# --- stubs compat: nunca viajan ---
COMPAT=()
if [ -f "$COMPAT_FILE" ]; then
  while IFS= read -r line; do
    line="${line%%#*}"
    line="$(printf '%s' "$line" | sed 's/^[[:space:]]*//; s/[[:space:]]*$//; s:/*$::')"
    [ -z "$line" ] || COMPAT+=("$line")
  done < "$COMPAT_FILE"
fi

is_compat() { # ruta relativa a hackai/: es compat o está dentro de un directorio compat
  local c
  for c in ${COMPAT[@]+"${COMPAT[@]}"}; do
    case "$1" in "$c"|"$c"/*) return 0 ;; esac
  done
  return 1
}

# --- rutas de compatibilidad de la feature ---
CANDIDATES=(
  "lib/$F"
  "components/$F"
  "app/campus/$F"
  "app/profesor/$F"
  "app/api/$F"
  "docs/$F_UPPER.md"
)
shopt -s nullglob
for p in "$HACKAI"/supabase/migrations/*_"$F".sql "$HACKAI"/supabase/migrations/*_"$F_SNAKE".sql "$HACKAI"/tests/"$F"*.ts; do
  CANDIDATES+=("${p#"$HACKAI"/}")
done
shopt -u nullglob

PATHS=()
SKIPPED=()
for rel in "${CANDIDATES[@]}"; do
  [ -e "$HACKAI/$rel" ] || continue
  case " ${PATHS[*]-} " in *" $rel "*) continue ;; esac
  if is_compat "$rel"; then SKIPPED+=("$rel"); continue; fi
  PATHS+=("$rel")
done

if [ "${#PATHS[@]}" -eq 0 ]; then
  {
    echo "Error: no encontré nada de la feature '$F' en hackai/."
    [ "${#SKIPPED[@]}" -eq 0 ] || echo "Lo único que coincide son stubs compat, que no se portan: ${SKIPPED[*]}"
    echo "Busqué en: lib/$F/, components/$F/, app/campus/$F/, app/profesor/$F/, app/api/$F/,"
    echo "  supabase/migrations/*_$F_SNAKE.sql, tests/$F*.ts y docs/$F_UPPER.md"
  } >&2
  exit 1
fi

# --- destino ---
OUT="$(mktemp -d "${TMPDIR:-/tmp}/port-$F.XXXXXX")"
PATCH="$OUT/$F.patch"

if [ -z "$DEST_ARG" ]; then
  [ -d "$CAMPUS" ] || die "no existe $CAMPUS"
  DEST="$OUT/campus"
  mkdir -p "$DEST"
  echo "Copiando campus/ a $DEST…"
  rsync -a --exclude='.DS_Store' --exclude='node_modules' --exclude='.next' --exclude='.git' "$CAMPUS/" "$DEST/"
  git -C "$DEST" init -q
  git -C "$DEST" add -A
  git -C "$DEST" -c user.name='port-to-campus' -c user.email='port-to-campus@localhost' -c commit.gpgsign=false \
    commit -q -m 'campus: snapshot base'
else
  [ -d "$DEST_ARG" ] || die "el destino no existe o no es una carpeta: $DEST_ARG"
  DEST="$(cd "$DEST_ARG" && pwd -P)"
  case "$DEST/" in
    "$REPO/"*) die "el destino está dentro de este repo ($DEST). campus/ nunca se edita: usá un clon del repo de Nacho o corré el script sin destino." ;;
  esac
  TOP="$(git -C "$DEST" rev-parse --show-toplevel 2>/dev/null)" || die "el destino no es un repo de git: $DEST. Hace falta para armar el diff."
  [ "$(cd "$TOP" && pwd -P)" = "$DEST" ] || die "el destino tiene que ser la raíz del repo de campus: $TOP"
  [ -f "$DEST/package.json" ] || die "el destino no parece el repo de campus: no hay package.json en $DEST"
  [ -z "$(git -C "$DEST" status --porcelain)" ] || die "el destino tiene cambios sin commitear: $DEST. Commitealos o descartalos para que el diff sea solo de la feature."
fi

# --- copia ---
echo
echo "Feature '$F': copiando a $DEST"
for rel in "${PATHS[@]}"; do
  if [ -e "$DEST/$rel" ]; then
    echo "  AVISO: $rel ya existe en el destino. Si no es de un port anterior, el parche modifica código de Nacho en vez de solo sumar archivos."
  fi
  mkdir -p "$(dirname "$DEST/$rel")"
  if [ -d "$HACKAI/$rel" ]; then
    EXCLUDES=(--exclude='.DS_Store' --exclude='.gitkeep')
    for c in ${COMPAT[@]+"${COMPAT[@]}"}; do
      case "$c" in "$rel"/*) EXCLUDES+=(--exclude="/${c#"$rel"/}"); SKIPPED+=("$c") ;; esac
    done
    rsync -a --delete "${EXCLUDES[@]}" "$HACKAI/$rel/" "$DEST/$rel/"
  else
    cp -p "$HACKAI/$rel" "$DEST/$rel"
  fi
  echo "  $rel"
done
[ "${#SKIPPED[@]}" -eq 0 ] || echo "  (stubs compat salteados: ${SKIPPED[*]})"

# --- diff y patch ---
git -C "$DEST" add -A -- "${PATHS[@]}"
if git -C "$DEST" diff --cached --quiet; then
  rm -rf "$PATCH"; [ -n "$DEST_ARG" ] && rmdir "$OUT" 2>/dev/null || true
  echo
  echo "Sin diferencias: el destino ya tiene esta versión de la feature."
  echo "Destino: $DEST"
  exit 0
fi
git -C "$DEST" diff --cached --binary > "$PATCH"

echo
echo "== Resumen del diff =="
git -C "$DEST" --no-pager diff --cached --stat
echo
echo "== Archivos (A = nuevo, M = modificado, D = borrado) =="
git -C "$DEST" --no-pager diff --cached --name-status
echo
echo "Destino: $DEST  (cambios en el index, sin commitear)"
echo "Patch:   $PATCH"
echo "Diff completo:  git -C '$DEST' diff --cached"
echo "Aplicar en un clon de campus:  git apply --index '$PATCH'"
echo
echo "El script no toca los archivos compartidos de campus. Si la feature los necesita, van aparte y a mano:"
echo "  lib/routes.ts (menú), middleware.ts (excepción de ruta de alumno), app/campus/page.tsx y"
echo "  app/profesor/page.tsx (homes), package.json (script de test) y el número de migración a acordar con Nacho."
