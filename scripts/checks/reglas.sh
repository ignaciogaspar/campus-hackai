#!/bin/sh
# Chequea las reglas duras de AGENTS.md que se pueden verificar mirando git.
# Lo corren el gancho pre-commit (.githooks/pre-commit) y CI (.github/workflows/reglas.yml).
#
#   sh scripts/checks/reglas.sh --staged   # lo que está en stage, contra main
#   sh scripts/checks/reglas.sh <desde>    # los commits de <desde>..HEAD
#
# Cada regla rota imprime qué pasó y cómo arreglarlo. Sale con 1 si se rompió alguna.
# Las pruebas de cada regla están en reglas.test.sh.

set -u

raiz=$(git rev-parse --show-toplevel) || exit 2
cd "$raiz" || exit 2

if [ "${1:-}" = '--staged' ]; then
  modo=staged
  # El cambio se mide desde main, así cuenta también lo ya commiteado en el branch.
  base=$(git merge-base HEAD origin/main 2>/dev/null || git rev-parse HEAD)
  diff_args="--cached $base"
  pref=':'
elif [ -n "${1:-}" ]; then
  modo=rango
  desde=$1
  if ! git cat-file -e "$desde^{commit}" 2>/dev/null; then
    echo "Aviso: no encuentro el commit $desde; chequeo solo el último commit."
    desde=$(git rev-parse HEAD^)
  fi
  base=$(git merge-base "$desde" HEAD)
  diff_args="$base HEAD"
  pref='HEAD:'
else
  echo 'Uso: sh scripts/checks/reglas.sh --staged | <desde>' >&2
  exit 2
fi

rotas=0

romper() {  # romper <regla> <detalle> <cómo arreglarlo>
  rotas=$((rotas + 1))
  printf '\n✗ %s\n%s\n  Cómo arreglarlo: %s\n' "$1" "$2" "$3"
}

# Archivos del cambio (desde la base hasta lo staged o HEAD).
cambiados() {
  # shellcheck disable=SC2086
  git diff --name-only $diff_args "$@"
}

# Contenido de un archivo en lo staged o en HEAD.
leer() {
  git show "$pref$1" 2>/dev/null
}

# Todos los archivos versionados en lo staged o en HEAD.
versionados() {
  if [ "$modo" = staged ]; then git ls-files; else git ls-tree -r --name-only HEAD; fi
}

# --- campus/ es de solo lectura -------------------------------------------
# Se reemplaza entero con la skill sync-campus, en un commit que solo toca campus/.

mezcla_campus() {  # lee una lista de archivos y dice si mezcla campus/ con otra cosa
  lista=$(cat)
  [ -n "$lista" ] || return 1
  printf '%s\n' "$lista" | grep -q '^campus/' && printf '%s\n' "$lista" | grep -qv '^campus/'
}

malos=''
if [ "$modo" = staged ]; then
  # Al cerrar un merge entra lo que trae el otro branch, con su sync de campus/ incluido.
  if ! git rev-parse -q --verify MERGE_HEAD >/dev/null && git diff --cached --name-only | mezcla_campus; then
    malos='    (el commit que estás armando)'
  fi
else
  for c in $(git rev-list --no-merges "$desde..HEAD"); do
    if git diff-tree --root --no-commit-id --name-only -r "$c" | mezcla_campus; then
      malos="$malos
    $(git log -1 --format='%h %s' "$c")"
      malos=${malos#
}
    fi
  done
fi
if [ -n "$malos" ]; then
  romper 'campus/ es de solo lectura (AGENTS.md, «Reglas duras»).' \
    "  Estos commits tocan campus/ junto con otros archivos:
$malos" \
    'sacá los cambios de campus/ de esos commits. campus/ se reemplaza entero con la skill sync-campus, en un commit que solo toca campus/.'
fi

# --- Lo simulado va aparte ------------------------------------------------
# Las tablas siu_* y moodle_* van en hackai/supabase/simulados/, que no se aplica en producción.

buscar() {  # buscar <patrón> <ruta>: git grep en lo staged o en HEAD
  if [ "$modo" = staged ]; then
    git grep --cached -nIiE "$1" -- "$2"
  else
    git grep -nIiE "$1" HEAD -- "$2" | sed 's/^HEAD://'
  fi
}

simulados=$(buscar '(^|[^a-z0-9_])(siu|moodle)_' 'hackai/supabase/migrations/' 2>/dev/null \
  | grep -vE ':[0-9]+:[[:space:]]*--' | sed 's/^/    /' | cut -c1-160)
if [ -n "$simulados" ]; then
  romper 'Lo simulado va aparte (AGENTS.md, «Reglas duras»).' \
    "  hackai/supabase/migrations/ se aplica en producción y menciona tablas siu_* o moodle_*:
$simulados" \
    'mové esas tablas, su SQL y su seed a hackai/supabase/simulados/.'
fi

# --- Las migraciones activan RLS, sin políticas ---------------------------

sin_rls=''
con_politicas=''
for f in $(versionados | grep -E '^hackai/supabase/(migrations|simulados)/[^/]+\.sql$'); do
  sql=$(leer "$f" | sed 's/--.*$//' | tr 'A-Z' 'a-z')
  tablas=$(printf '%s\n' "$sql" | grep -oE 'create table( if not exists)? [a-z0-9_."]+' \
    | awk '{ print $NF }' | sed -e 's/"//g' -e 's/^public\.//')
  for t in $tablas; do
    if ! printf '%s\n' "$sql" | grep -qE "alter table( if exists)?( only)? (public\.)?\"?$t\"? enable row level security"; then
      sin_rls="$sin_rls
    $f: $t"
    fi
  done
  if printf '%s\n' "$sql" | grep -q 'create policy'; then
    con_politicas="$con_politicas
    $f"
  fi
done
if [ -n "$sin_rls" ]; then
  romper 'Las migraciones activan RLS (AGENTS.md, «Datos en el servidor»).' \
    "  Estas tablas no tienen su enable row level security:${sin_rls}" \
    'sumá «alter table <tabla> enable row level security;» en el mismo archivo.'
fi
if [ -n "$con_politicas" ]; then
  romper 'RLS va sin políticas (AGENTS.md, «Datos en el servidor»).' \
    "  Estos archivos crean políticas:${con_politicas}" \
    'sacá los create policy: todo acceso pasa por el servidor con el service role.'
fi

# --- Puertos y adaptadores: reglas de import ------------------------------
# hackai/docs/ARQUITECTURA.md, «Reglas de import» (ADR 0004).

# Los imports (from '…', import '…', import('…') o require('…')) hacia <destinos>,
# sin contar las líneas comentadas: buscar_imports <destinos ERE> <pathspec>...
buscar_imports() {
  patron="(from|import|require)[[:space:]]*\\(?[[:space:]]*[\"'](${1})"
  shift
  if [ "$modo" = staged ]; then
    git grep --cached -nIE "$patron" -- "$@"
  else
    git grep -nIE "$patron" HEAD -- "$@" | sed 's/^HEAD://'
  fi | grep -vE '^[^:]+:[0-9]+:[[:space:]]*(//|/?\*)' | sed 's/^/    /' | cut -c1-160
}

# El núcleo no importa adaptadores, composition, pantallas (app/, components/) ni
# el cliente de la base: solo puertos, otros módulos del núcleo y piezas de lib/.
nucleo=$(buscar_imports '@/lib/(adapters|composition)([/"'"'"'.]|$)|@/(app|components)/|@supabase/|(\.\./)+(adapters|composition|app|components)[/"'"'"'.]' \
  'hackai/lib/core/' 2>/dev/null)
if [ -n "$nucleo" ]; then
  romper 'El núcleo no importa adaptadores, pantallas ni la base (AGENTS.md, «Reglas duras»; ADR 0004).' \
    "  Estos imports de hackai/lib/core/ salen del núcleo:
$nucleo" \
    'importá el puerto (lib/ports/) o la interfaz del otro módulo del núcleo; el adaptador lo elige y lo pasa lib/composition.ts.'
fi

# Solo composition conoce los adaptadores. Los tests y los scripts de hackai/
# arman los suyos, así que pueden importarlos.
adaptadores=$(buscar_imports '@/lib/adapters/|(\.\.?/)+adapters/' \
  'hackai/app/' 'hackai/components/' 'hackai/lib/' \
  ':(exclude)hackai/lib/adapters/' ':(exclude)hackai/lib/composition.ts' ':(exclude)hackai/lib/core/' 2>/dev/null)
if [ -n "$adaptadores" ]; then
  romper 'Solo composition conoce los adaptadores (AGENTS.md, «Reglas duras»; ADR 0004).' \
    "  Estos archivos importan lib/adapters/ fuera de lib/composition.ts:
$adaptadores" \
    'pedí los módulos armados a lib/composition.ts (system()) en vez de importar el adaptador.'
fi

# --- Sumar un paquete requiere una ADR ------------------------------------

if [ -n "$(cambiados -- hackai/package.json)" ]; then
  antes=$(git show "$base:hackai/package.json" 2>/dev/null || true)
  ahora=$(leer hackai/package.json)
  if [ -n "$antes" ] && command -v node >/dev/null 2>&1; then
    nuevas=$(ANTES="$antes" AHORA="$ahora" node -e '
      const deps = (json) => {
        try {
          const p = JSON.parse(json)
          return new Set([...Object.keys(p.dependencies || {}), ...Object.keys(p.devDependencies || {})])
        } catch {
          return new Set()
        }
      }
      const antes = deps(process.env.ANTES)
      console.log([...deps(process.env.AHORA)].filter((d) => !antes.has(d)).join(", "))
    ')
    if [ -n "$nuevas" ] && [ -z "$(cambiados --diff-filter=A -- docs/adr/)" ]; then
      romper 'Sumar un paquete requiere una ADR (AGENTS.md, «Reglas duras»; ADR 0002 y 0006).' \
        "  Este cambio suma a hackai/package.json: $nuevas" \
        'escribí en docs/adr/ la ADR que justifica el paquete y sumala en el mismo PR, o sacá la dependencia.'
    fi
  elif [ -n "$antes" ]; then
    echo 'Aviso: sin node no puedo chequear las dependencias nuevas de hackai/package.json.'
  fi
fi

# --- Los secretos van solo en .env.local ----------------------------------

envs=$(versionados | grep -E '(^|/)\.env[^/]*$' | grep -vE '\.example$' | sed 's/^/    /')
if [ -n "$envs" ]; then
  romper 'Los secretos van solo en .env.local (AGENTS.md, «Reglas duras»).' \
    "  Estos archivos de entorno están versionados:
$envs" \
    'sacalos del repo con git rm --cached <archivo>. Si tenían claves reales, rotalas.'
fi

# Formas de claves: Anthropic, Supabase (JWT y sb_secret_), bot de Discord, GitHub y claves privadas.
patron='sk-ant-[A-Za-z0-9_-]{20,}|sb_secret_[A-Za-z0-9_-]{20,}|eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{20,}|[MNO][A-Za-z0-9_-]{23,27}\.[A-Za-z0-9_-]{6}\.[A-Za-z0-9_-]{27,}|gh[pousr]_[A-Za-z0-9]{36,}|-----BEGIN [A-Z ]*PRIVATE KEY-----'
# Solo se imprime dónde está cada una, nunca su valor.
# shellcheck disable=SC2086
claves=$(git diff -U0 --no-color --no-ext-diff --src-prefix=a/ --dst-prefix=b/ $diff_args -- . ':(exclude)*package-lock.json' \
  | awk '
      /^\+\+\+ / { archivo = substr($0, 7); next }
      /^@@/ { split($3, a, ","); linea = substr(a[1], 2) + 0; next }
      /^\+/ { print archivo ":" linea "\t" substr($0, 2); linea++ }
    ' \
  | grep -E "$patron" | cut -f1 | sed 's/^/    /')
if [ -n "$claves" ]; then
  romper 'Los secretos van solo en .env.local (AGENTS.md, «Reglas duras»).' \
    "  Hay algo con forma de clave en estas líneas (no se muestra el valor):
$claves" \
    'sacá la clave del código y leela de una variable de entorno. Si es real, rotala: ya quedó en el historial de git.'
fi

# ---------------------------------------------------------------------------

if [ "$rotas" -gt 0 ]; then
  printf '\n%s regla(s) de AGENTS.md rota(s).\n' "$rotas"
  exit 1
fi
echo '✓ Reglas de AGENTS.md: todo en orden.'
