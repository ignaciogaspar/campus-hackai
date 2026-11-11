#!/usr/bin/env bash
# Capturas de la galería de pantallas con Chrome headless.
# Uso: docs/design/mocks/shoot.sh v1   → docs/design/mocks/shots/v1/*.png
# CHROME apunta al binario; por defecto, Chrome de macOS.
set -euo pipefail

version="${1:-v1}"
here="$(cd "$(dirname "$0")" && pwd)"
gallery="$here/index.html"
out="$here/shots/$version"
chrome="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
flags=(--headless=new --hide-scrollbars --allow-file-access-from-files --virtual-time-budget=15000)

mkdir -p "$out"

for s in cambios hoy novedades materias espacio docente compu pwa instalar estados; do
  url="file://$gallery?s=$s&bare=1&full=1&measure=1"
  h=$("$chrome" "${flags[@]}" --window-size=1440,900 --dump-dom "$url" | sed -n 's/.*<title>H=\([0-9]*\)<\/title>.*/\1/p')
  "$chrome" "${flags[@]}" --window-size="1440,${h:-2000}" --screenshot="$out/$s.png" "$url"
done

"$chrome" "${flags[@]}" --window-size=1440,1400 --screenshot="$out/0-galeria.png" "file://$gallery"
echo "Capturas en $out"
