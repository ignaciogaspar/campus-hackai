#!/bin/sh
# Prueba cada regla de reglas.sh en repos de git temporales: un caso que la
# cumple y uno que la rompe. Lo corre CI antes del chequeo de verdad.
#
#   sh scripts/checks/reglas.test.sh

set -eu

script="$(cd "$(dirname "$0")" && pwd)/reglas.sh"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

export GIT_AUTHOR_NAME=prueba GIT_AUTHOR_EMAIL=prueba@example.com
export GIT_COMMITTER_NAME=prueba GIT_COMMITTER_EMAIL=prueba@example.com
fallas=0

# Sin los ganchos ni la firma de commits de quien lo corre.
g() {
  git -c commit.gpgsign=false -c core.hooksPath=/dev/null "$@"
}

# Repo nuevo con lo mínimo que miran las reglas, todo en un primer commit.
repo() {
  cd "$tmp" && mkdir "$1" && cd "$1"
  g init -q
  g checkout -q -b main
  mkdir -p campus hackai/supabase/migrations hackai/supabase/simulados docs/adr
  echo 'export const x = 1' > campus/a.ts
  echo 'export const y = 1' > hackai/b.ts
  printf '{\n  "dependencies": { "next": "15" },\n  "devDependencies": {}\n}\n' > hackai/package.json
  printf 'create table if not exists siu_x (id int);\nalter table siu_x enable row level security;\n' \
    > hackai/supabase/simulados/0001_siu.sql
  echo '# ADR' > docs/adr/0001-algo.md
  echo 'X=' > hackai/.env.example
  g add -A
  g commit -qm base
  inicio=$(g rev-parse HEAD)
}

commit() {
  g add -A
  g commit -qm "$1"
}

espera() {  # espera <pasa|falla> <descripción> <args de reglas.sh>
  quiere=$1
  desc=$2
  shift 2
  if sh "$script" "$@" > "$tmp/salida" 2>&1; then obtuvo=pasa; else obtuvo=falla; fi
  if [ "$obtuvo" = "$quiere" ]; then
    echo "✓ $desc"
  else
    echo "✗ $desc: esperaba que $quiere y $obtuvo"
    sed 's/^/    /' "$tmp/salida"
    fallas=$((fallas + 1))
  fi
}

# --- campus/ ---
repo campus-solo
echo 'export const x = 2' > campus/a.ts
commit 'chore(campus): sync snapshot'
echo 'export const y = 2' > hackai/b.ts
commit 'feat: algo'
espera pasa 'campus/: un commit que solo toca campus/' "$inicio"

repo campus-mezcla
echo 'export const x = 2' > campus/a.ts
echo 'export const y = 2' > hackai/b.ts
commit 'feat: algo con un arreglo en campus'
espera falla 'campus/: un commit que toca campus/ y hackai/' "$inicio"

repo campus-staged
echo 'export const x = 2' > campus/a.ts
echo 'export const y = 2' > hackai/b.ts
g add -A
espera falla 'campus/: en stage, campus/ junto con hackai/' --staged

# --- Lo simulado aparte ---
repo simulado-ok
printf '%s\n' '-- No es una tabla siu_*.' 'create table if not exists people (id int);' \
  'alter table people enable row level security;' > hackai/supabase/migrations/0001_people.sql
commit 'feat: people'
espera pasa 'simulados: una migración propia que nombra siu_* en un comentario' "$inicio"

repo simulado-en-migraciones
printf 'create table if not exists moodle_y (id int);\nalter table moodle_y enable row level security;\n' \
  > hackai/supabase/migrations/0001_moodle.sql
commit 'feat: moodle'
espera falla 'simulados: una tabla moodle_* en migrations/' "$inicio"

# --- RLS ---
repo rls-falta
printf 'create table if not exists people (id int);\n' > hackai/supabase/migrations/0001_people.sql
commit 'feat: people'
espera falla 'RLS: una tabla sin enable row level security' "$inicio"

repo rls-politica
printf 'create table people (id int);\nalter table public.people enable row level security;\ncreate policy p on people for select using (true);\n' \
  > hackai/supabase/migrations/0001_people.sql
commit 'feat: people'
espera falla 'RLS: una migración con create policy' "$inicio"

# --- Dependencias con ADR ---
repo dependencia-sin-adr
printf '{\n  "dependencies": { "next": "15" },\n  "devDependencies": { "husky": "9" }\n}\n' > hackai/package.json
commit 'chore: husky'
espera falla 'dependencias: un paquete nuevo sin ADR' "$inicio"

repo dependencia-con-adr
printf '{\n  "dependencies": { "next": "15" },\n  "devDependencies": { "husky": "9" }\n}\n' > hackai/package.json
echo '# Husky' > docs/adr/0002-husky.md
commit 'chore: husky con su ADR'
espera pasa 'dependencias: un paquete nuevo con su ADR' "$inicio"

repo dependencia-version
printf '{\n  "dependencies": { "next": "16" },\n  "devDependencies": {}\n}\n' > hackai/package.json
commit 'chore: next 16'
espera pasa 'dependencias: solo cambia una versión' "$inicio"

# --- Secretos ---
repo env-versionado
echo 'SESSION_SECRET=algo' > hackai/.env.local
commit 'chore: env'
espera falla 'secretos: un .env.local versionado' "$inicio"

repo clave-en-codigo
# La clave se arma en partes para que este archivo no tenga una.
printf 'const k = "%s%s"\n' 'sk-an' 't-api03-aaaaaaaaaaaaaaaaaaaaaaaaaaaa' > hackai/c.ts
commit 'feat: c'
espera falla 'secretos: una clave de Anthropic en el código' "$inicio"
if grep -q 'aaaaaaaaaaaa' "$tmp/salida"; then
  echo '✗ secretos: el mensaje muestra el valor de la clave'
  fallas=$((fallas + 1))
fi

repo clave-staged
printf 'const k = "%s%s"\n' 'sk-an' 't-api03-aaaaaaaaaaaaaaaaaaaaaaaaaaaa' > hackai/c.ts
g add -A
espera falla 'secretos: una clave de Anthropic en stage' --staged

if [ "$fallas" -gt 0 ]; then
  printf '\n%s prueba(s) de reglas.sh fallaron.\n' "$fallas"
  exit 1
fi
printf '\n✓ reglas.sh: todas las pruebas pasan.\n'
