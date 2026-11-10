#!/usr/bin/env bash
# Instalador del campus de AI-Centric Management (IAE · Universidad Austral).
#
#   curl -fsSL __CAMPUS_URL__/setup | bash
#
# Qué hace, en orden:
#   1. Instala Claude Code si no está (instalador oficial de claude.ai).
#   2. Te pide confirmar esta compu en el campus (se abre el navegador).
#   3. Conecta Claude Code al campus (claude mcp add, alcance de usuario).
#   4. Mira qué herramientas del stack tenés (git, gh, node, vercel, supabase)
#      y se lo cuenta al campus: eso marca tu entrega B1.
# No instala nada más ni manda contraseñas. El token del campus queda solo en
# la configuración de Claude Code.
#
# Variables opcionales: CAMPUS_NO_BROWSER=1 (no abrir el navegador),
# CAMPUS_URL (otro campus, para pruebas).

set -u

CAMPUS="${CAMPUS_URL:-__CAMPUS_URL__}"
CAMPUS="${CAMPUS%/}"

if [ -t 1 ]; then B=$'\033[1m'; V=$'\033[32m'; A=$'\033[33m'; R=$'\033[31m'; N=$'\033[0m'; else B=''; V=''; A=''; R=''; N=''; fi
paso() { printf '\n%s▸ %s%s\n' "$B" "$1" "$N"; }
ok()   { printf '  %s✓%s %s\n' "$V" "$N" "$1"; }
ojo()  { printf '  %s!%s %s\n' "$A" "$N" "$1"; }
fallo() { printf '\n%s✗ %s%s\n' "$R" "$1" "$N" >&2; exit 1; }

# --- HTTP sin depender de jq: el campus contesta clave=valor con Accept: text/plain
post() { # post <ruta> <datos urlencoded>
  if command -v curl >/dev/null 2>&1; then
    curl -fsS -m 20 -H 'Accept: text/plain' --data "$2" "$CAMPUS$1" 2>/dev/null
  elif command -v wget >/dev/null 2>&1; then
    wget -q -T 20 -O - --header='Accept: text/plain' --post-data="$2" "$CAMPUS$1" 2>/dev/null
  else
    fallo 'Necesito curl o wget para hablar con el campus.'
  fi
}
campo() { # campo <clave> <respuesta>
  printf '%s\n' "$2" | sed -n "s/^$1=//p" | head -n 1
}
urlenc() {
  local LC_ALL=C s="$1" out='' c i
  for ((i = 0; i < ${#s}; i++)); do
    c="${s:i:1}"
    case "$c" in
      [a-zA-Z0-9.~_-]) out+="$c" ;;
      *) out+=$(printf '%%%02X' "'$c") ;;
    esac
  done
  printf '%s' "$out"
}
json_str() { # string JSON con comillas; descarta caracteres de control
  local s
  s=$(printf '%s' "$1" | tr -d '\000-\037' | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g')
  printf '"%s"' "$s"
}
# Corre un comando con tope de tiempo (algunos CLIs preguntan cosas si no hay sesión).
con_tope() {
  local s="$1"; shift
  if command -v perl >/dev/null 2>&1; then perl -e 'alarm shift; exec @ARGV' "$s" "$@"; else "$@"; fi
}
primera_linea() { "$@" 2>/dev/null </dev/null | head -n 1 | tr -d '\r'; }

# Todo adentro de main: bash lee el script entero antes de ejecutar, así
# ningún comando se «come» el resto del script desde el pipe de curl.
main() {
  printf '%sCampus · AI-Centric Management%s\n' "$B" "$N"
  printf 'Vamos a dejar Claude Code conectado al campus y tu entorno verificado (B1).\n'

  # --- 1. Sistema
  case "$(uname -s)" in
    Darwin) OS="macOS $(sw_vers -productVersion 2>/dev/null)"; ABRIR='open' ;;
    Linux)
      OS="Linux $(uname -r)"
      if [ -r /etc/os-release ]; then OS="$(. /etc/os-release && printf '%s' "${PRETTY_NAME:-Linux}") ($(uname -r))"; fi
      grep -qi microsoft /proc/version 2>/dev/null && OS="$OS · WSL"
      ABRIR='xdg-open' ;;
    MINGW*|MSYS*|CYGWIN*)
      fallo 'Esto es Git Bash. En Windows usá PowerShell: irm '"$CAMPUS"'/setup.ps1 | iex' ;;
    *) OS="$(uname -sr)"; ABRIR='' ;;
  esac
  HOST="$(hostname 2>/dev/null || uname -n)"
  HOST="${HOST%.local}"

  # --- 2. Claude Code
  paso 'Claude Code'
  # el instalador oficial deja claude en ~/.local/bin, que puede no estar en el PATH todavía
  command -v claude >/dev/null 2>&1 || export PATH="$HOME/.local/bin:$PATH"
  if command -v claude >/dev/null 2>&1; then
    ok "ya está instalado ($(primera_linea claude --version))"
  else
    ojo 'no está instalado: lo instalo con el instalador oficial de claude.ai'
    if command -v curl >/dev/null 2>&1; then
      curl -fsSL https://claude.ai/install.sh | bash || fallo 'No se pudo instalar Claude Code. Copiá el error de arriba: sirve como evidencia para B1.'
    else
      wget -qO- https://claude.ai/install.sh | bash || fallo 'No se pudo instalar Claude Code. Copiá el error de arriba: sirve como evidencia para B1.'
    fi
    hash -r 2>/dev/null
    command -v claude >/dev/null 2>&1 || fallo "Se instaló, pero no encuentro el comando claude. Abrí otra terminal y corré de nuevo: curl -fsSL $CAMPUS/setup | bash"
    ok "instalado ($(primera_linea claude --version))"
  fi
  CLAUDE_V="$(primera_linea claude --version)"

  # --- 3. Emparejar esta compu con tu cuenta del campus
  paso 'Conectar esta compu con tu cuenta del campus'
  R1="$(post /api/setup/start "hostname=$(urlenc "$HOST")&os=$(urlenc "$OS")")" || fallo "No pude hablar con $CAMPUS. ¿Tenés internet?"
  DEVICE="$(campo deviceCode "$R1")"
  CODE="$(campo userCode "$R1")"
  VERIFY="$(campo verifyUrl "$R1")"
  INTERVAL="$(campo interval "$R1")"; INTERVAL="${INTERVAL:-3}"
  EXPIRES="$(campo expiresIn "$R1")"; EXPIRES="${EXPIRES:-600}"
  [ -n "$DEVICE" ] && [ -n "$CODE" ] || fallo "El campus no contestó bien: $(campo error "$R1")"

  printf '\n  Tu código: %s%s%s\n' "$B" "$CODE" "$N"
  printf '  Confirmalo en: %s\n' "$VERIFY"
  if [ -z "${CAMPUS_NO_BROWSER:-}" ] && [ -n "$ABRIR" ] && command -v "$ABRIR" >/dev/null 2>&1; then
    "$ABRIR" "$VERIFY" >/dev/null 2>&1 && printf '  (te abrí el navegador; si no ves nada, copiá el link)\n'
  fi
  printf '  Esperando que confirmes'

  TOKEN=''; ROLE=''; NAME=''; MCP_URL=''
  FIN=$(( $(date +%s) + EXPIRES ))
  while [ "$(date +%s)" -lt "$FIN" ]; do
    sleep "$INTERVAL"
    R2="$(post /api/setup/poll "deviceCode=$DEVICE")" || { printf '.'; continue; }
    case "$(campo status "$R2")" in
      ok)
        TOKEN="$(campo token "$R2")"; ROLE="$(campo role "$R2")"; NAME="$(campo name "$R2")"; MCP_URL="$(campo mcpUrl "$R2")"
        break ;;
      rechazado) printf '\n'; fallo 'Rechazaste la conexión en el campus. Si fue un error, corré el comando de nuevo.' ;;
      vencido|desconocido) printf '\n'; fallo 'El código venció. Corré el comando de nuevo.' ;;
      *) printf '.' ;;
    esac
  done
  printf '\n'
  [ -n "$TOKEN" ] || fallo 'Pasaron 10 minutos sin confirmar. Corré el comando de nuevo.'
  MCP_URL="${MCP_URL:-$CAMPUS/api/mcp}"
  ok "confirmado: $NAME"

  # --- 4. Conectar Claude Code
  paso 'Conectar Claude Code al campus'
  claude mcp remove campus -s user >/dev/null 2>&1
  claude mcp remove campus -s local >/dev/null 2>&1
  if claude mcp add --scope user --transport http campus "$MCP_URL" --header "Authorization: Bearer $TOKEN" >/dev/null 2>&1; then
    ok 'Claude Code tiene el servidor «campus» (para todos tus proyectos)'
  else
    fallo 'claude mcp add falló. Probá a mano desde el campus (Mi organización → Hacerlo a mano).'
  fi

  # --- 5. Stack
  paso 'Tu stack'
  GIT_V="$(primera_linea git --version)"
  NODE_V="$(primera_linea node --version)"
  GH_V="$(primera_linea gh --version)"
  GH_USER=''; [ -n "$GH_V" ] && GH_USER="$(con_tope 8 gh api user -q .login 2>/dev/null </dev/null | head -n 1)"
  [ -z "$GH_USER" ] && [ -n "$GIT_V" ] && GH_USER="$(git config --global user.name 2>/dev/null)"
  VERCEL_V="$(CI=1 con_tope 10 vercel --version 2>/dev/null </dev/null | tail -n 1)"
  VERCEL_USER=''; [ -n "$VERCEL_V" ] && VERCEL_USER="$(CI=1 con_tope 10 vercel whoami 2>/dev/null </dev/null | tail -n 1)"
  SUPA_V="$(primera_linea supabase --version)"

  FALTA=()
  linea() { # linea <nombre> <valor> <cómo instalarlo>
    if [ -n "$2" ]; then ok "$1: $2"; else ojo "$1: no está · $3"; FALTA+=("$1"); fi
  }
  linea 'Claude Code' "$CLAUDE_V" 'curl -fsSL https://claude.ai/install.sh | bash'
  linea 'git' "$GIT_V" "$( [ "$(uname -s)" = Darwin ] && echo 'xcode-select --install' || echo 'sudo apt install git')"
  linea 'Node.js' "$NODE_V" 'https://nodejs.org (LTS)'
  linea 'GitHub CLI' "${GH_V:+$GH_V${GH_USER:+ · $GH_USER}}" "$( [ "$(uname -s)" = Darwin ] && echo 'brew install gh && gh auth login' || echo 'https://cli.github.com, después gh auth login')"
  linea 'Vercel CLI' "${VERCEL_V:+$VERCEL_V${VERCEL_USER:+ · $VERCEL_USER}}" 'npm i -g vercel && vercel login'
  linea 'Supabase CLI' "$SUPA_V" "$( [ "$(uname -s)" = Darwin ] && echo 'brew install supabase/tap/supabase' || echo 'npx supabase --version (o ver supabase.com/docs/guides/cli)')"

  # --- 6. Saludo al campus (marca B1)
  if [ "$ROLE" = 'alumno' ]; then
    paso 'Saludo al campus'
    MSG="Instalador del campus. git: ${GIT_V:-no}; node: ${NODE_V:-no}; gh: ${GH_V:-no}; vercel: ${VERCEL_V:-no}."
    ARGS="{\"client\":\"claude-code\",\"clientVersion\":$(json_str "$CLAUDE_V"),\"os\":$(json_str "$OS")"
    [ -n "$GH_USER" ] && ARGS="$ARGS,\"githubUser\":$(json_str "$GH_USER")"
    [ -n "$VERCEL_USER" ] && ARGS="$ARGS,\"vercelUser\":$(json_str "$VERCEL_USER")"
    [ -n "$SUPA_V" ] && ARGS="$ARGS,\"supabase\":$(json_str "supabase $SUPA_V")"
    ARGS="$ARGS,\"message\":$(json_str "$MSG")}"
    BODY="{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/call\",\"params\":{\"name\":\"hola_campus\",\"arguments\":$ARGS}}"
    # el token va por stdin (-H @-), no en la línea de comandos
    if command -v curl >/dev/null 2>&1; then
      R3="$(printf 'Authorization: Bearer %s\n' "$TOKEN" | curl -fsS -m 30 -H @- -H 'Content-Type: application/json' -H 'Accept: application/json' --data "$BODY" "$MCP_URL" 2>/dev/null)"
    else
      R3="$(wget -q -T 30 -O - --header="Authorization: Bearer $TOKEN" --header='Content-Type: application/json' --post-data="$BODY" "$MCP_URL" 2>/dev/null)"
    fi
    if printf '%s' "$R3" | grep -q '"isError":false'; then
      SALUDO="$(printf '%s' "$R3" | sed -n 's/.*"structuredContent":{"saludo":"\([^"]*\)".*/\1/p')"
      ok "${SALUDO:-El campus te recibió.}"
      if printf '%s' "$R3" | grep -q '"estado":"entregada'; then ok 'Entrega B1 marcada con esta verificación'; else ojo 'La verificación quedó guardada, pero B1 no se marcó (mirá el campus).'; fi
    else
      ojo 'Claude Code quedó conectado, pero el saludo no llegó. Abrí claude y pedile «decile hola al campus».'
    fi
  fi
  unset TOKEN

  # --- Resumen
  printf '\n%sListo.%s ' "$B" "$N"
  if [ "${#FALTA[@]}" -eq 0 ]; then
    printf 'Tenés todo el stack.\n'
  else
    printf 'Falta: %s. Instalalo con los comandos de arriba y volvé a correr este instalador.\n' "$(IFS=,; printf '%s' "${FALTA[*]}" | sed 's/,/, /g')"
  fi
  printf 'Abrí claude y escribí /mcp para verlo: «campus» tiene que figurar conectado.\n'
  printf 'En el campus: %s/campus/entregas/aicm-b1-entorno\n' "$CAMPUS"
}

main "$@" </dev/null
