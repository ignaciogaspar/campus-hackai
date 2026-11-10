# hackai

Nuestra app para HackAI 2026. Tiene el mismo stack, las mismas versiones y las mismas rutas de carpetas que `campus/` (Campus Austral, el repo de Nacho), para que una feature se pueda copiar a ese repo tal cual. Todavía no tiene features ni tablas: salen de las specs.

## Cómo correrlo

```bash
cd hackai
source ~/.nvm/nvm.sh && nvm use        # Node 22 (.nvmrc)
npm install
cp .env.example .env.local             # y completá los valores
npm run dev                            # http://localhost:3000
```

Chequeos, los mismos que pide campus antes de entregar:

```bash
npm run typecheck      # tsc --noEmit -p .
npm test               # node:test + tsx sobre tests/*.test.ts
npm run build
```

Con Node 20 instala y pasa los tres chequeos, con un warning de `engines`. Para entregar, usá Node 22.

## Variables de entorno

Van en `hackai/.env.local`, que no se versiona. `.env.example` las lista sin valores. Son las que pide `campus/README.md`:

| Variable | Para qué |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Proyecto Supabase del equipo (no el de Campus Austral). |
| `SUPABASE_SERVICE_ROLE_KEY` | Acceso a datos desde el servidor. Nunca llega al cliente. |
| `DATABASE_URL` | Solo para correr migraciones con psql. |
| `SESSION_SECRET` | Firma la cookie de sesión `campus_session`. |
| `PROFESSOR_ACCESS_CODE` | Código de ingreso del profesor. |
| `ANTHROPIC_API_KEY` | API de Claude. |
| `NEXT_PUBLIC_SITE_URL` (opcional) | Dominio público para QR y links. |

No las imprimas en logs ni en reportes.

## Dónde va cada archivo de una feature

Una feature vive en las mismas rutas que usaría en campus. `<feature>` es un nombre en minúsculas, con guiones si hace falta (`avisos`, `post-class`).

| Ruta | Qué va |
| --- | --- |
| `lib/<feature>/types.ts` | Tipos. |
| `lib/<feature>/core.ts` | Lógica pura, sin I/O. Es lo que se testea. |
| `lib/<feature>/store.ts` | Acceso a datos. `import 'server-only'`, usa `db()` y `must()`. |
| `lib/<feature>/actions.ts` | Server actions (`'use server'`). |
| `components/<feature>/` | Componentes y `<feature>.css`, con un prefijo de clase propio. |
| `app/campus/<feature>/` | Pantallas del alumno. |
| `app/profesor/<feature>/` | Pantallas del docente. |
| `app/api/<feature>/` | Route handlers. |
| `supabase/migrations/02NN_<feature>.sql` | Desde `0240`. Idempotente, RLS activado sin políticas, `revoke` a `anon` y `authenticated`. En el nombre del archivo los guiones pasan a guion bajo. |
| `tests/<feature>.test.ts` | Tests de `core.ts` con `node:test`. |
| `docs/<FEATURE>.md` | Doc de la feature, con el formato de `campus/docs/POST-CLASS.md`. |

`scripts/port-to-campus.sh <feature>` copia exactamente esas rutas a una copia de campus y arma el parche. Lo que quede fuera de esas rutas no llega a Nacho. El checklist completo de compatibilidad está en la skill `campus-feature`.

Sin dependencias nuevas: `package.json` tiene las mismas `dependencies` y `devDependencies` que `campus/package.json` y tiene que seguir así.

## Stubs compat

Para que el código de una feature compile acá con los mismos imports que en campus, `hackai/` trae versiones mínimas de algunos archivos compartidos de campus. Están listados en `compat.txt`, empiezan con un comentario `compat:` y **nunca se portan**: en campus se usan los archivos reales.

| Archivo | Imita | Qué trae |
| --- | --- | --- |
| `lib/db.ts` | `lib/db.ts` | `db()`, `must(res, what)`, `COURSE_ID` |
| `lib/auth.ts` | `lib/auth.ts` | `getSession()`, `requireSession(role?)`, `homeFor(role)` |
| `lib/session-token.ts` | `lib/session-token.ts` | `verifySessionToken`, `forgeSessionCookie`, `SESSION_COOKIE`, `GUEST_COOKIE`, `Role`, `Session` |
| `lib/claude.ts` | `lib/claude.ts` | `claude()`, `MODEL_LIVE`, `MODEL_AUTHORING`, `Anthropic` |
| `app/globals.css` | `app/globals.css` | Tokens y parte de las clases compartidas (`.page`, `.card`, `.btn`, `.form`…) |
| `app/layout.tsx`, `app/page.tsx` | — | Layout raíz y placeholder |
| `tests/compat.test.ts` | — | Test de ejemplo |

Los stubs se escribieron leyendo solo `campus/docs/CONTRACTS.md`, sin mirar el código de campus. Lo que el contrato no define y acá es una suposición:

- `must()` devuelve `data` y tira un error si la respuesta trae `error`. El contrato no dice qué hace cuando `data` es `null`.
- `getSession()` solo verifica la firma de la cookie. En campus además verifica persona, rol y `session_version` en la base.
- El formato exacto de la firma del token (acá, HMAC en base64url). Una cookie forjada acá no sirve en campus ni al revés.
- Los valores de `globals.css`, salvo `--azul` y `--cian`. Montserrat no se carga con `next/font`: se usa la fuente del sistema si no está instalada.

Si una feature necesita un helper compartido que no está acá (`lib/routes.ts`, `lib/format.ts`, `lib/realtime.ts`, `lib/security.ts`, `untrusted()`…), no lo inventes dentro de la feature: sumá el stub como compat, con la firma de `CONTRACTS.md`, y agregalo a `compat.txt`.

## Primeros tickets

1. Comparar los stubs compat con los archivos reales de `campus/lib/` y `campus/app/globals.css` y corregir las diferencias de firma o de comportamiento. Lo hace quien está relevando el código de campus.
2. Ingreso de desarrollo. Hoy no hay pantalla de login: `/` es un placeholder. Hasta que una spec lo defina, una sesión se arma con `forgeSessionCookie(personId, role)`.
3. Base de datos. No hay migraciones ni seeds. Las tablas de campus (`people`, `courses`…) no existen en nuestro Supabase hasta que alguien decida cómo sembrarlas (los seeds de campus no corren con el snapshot que tenemos, ver `docs/campus-upstream.md`).
