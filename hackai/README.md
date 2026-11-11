# hackai

HackAI, nuestro sistema para HackAI 2026: unifica la vida académica del alumno sobre el SIU, Moodle y Campus Austral (qué hace y por qué: `docs/product/alcance.md`). Las pantallas y las tablas salen de la spec (#5).

## Cómo correrlo

```bash
cd hackai
source ~/.nvm/nvm.sh && nvm use        # Node 22 (.nvmrc)
npm install
cp .env.example .env.local             # y completá los valores
npm run dev                            # http://localhost:3000
```

Chequeos:

```bash
npm run lint           # Biome: formato, lint y orden de imports
npm run lint:arreglar  # arregla lo que Biome puede arreglar solo
npm run typecheck      # tsc --noEmit -p .
npm test               # node:test + tsx sobre tests/**/*.test.ts
npm run build
```

La configuración de Biome está en `biome.json` y repite las convenciones de `AGENTS.md`; por qué Biome: ADR 0007. Una función con complejidad cognitiva mayor a 15 no pasa el lint: se parte en funciones más chicas. Las ocho que ya la superaban llevan un `biome-ignore` con su puntaje hasta que se refactoricen.

Si tu branch venía de antes del formateo con Biome y choca con `main`, quedate con tu versión del archivo y corré `npm run lint:arreglar`.

`npm test` necesita Node 22 o más: le pasa el glob a `node --test`, que Node 20 no expande. Para la demo, usá Node 22. El glob va entre comillas dobles para que lo expanda Node y no el shell: así funciona igual con cmd en Windows y con sh.

## CI

Cada PR a `main` corre en GitHub Actions (`.github/workflows/`):

| Workflow | Cuándo | Qué hace |
| --- | --- | --- |
| `ci.yml` | Si cambia código de `hackai/` | `npm ci`, Biome (con anotaciones en el diff), typecheck, tests, build y una prueba de humo: levanta el servidor standalone y pide `/api/health` y `/`. Sin secretos: usa los adaptadores en memoria. |
| `reglas.yml` | En todos los PRs, también los de docs | `scripts/checks/reglas.sh`: las reglas duras de `AGENTS.md` que se ven en git. Un commit que toca `campus/` no toca nada más, no hay tablas `siu_*` ni `moodle_*` en `supabase/migrations/`, cada tabla activa RLS sin políticas, un paquete nuevo viene con su ADR y no hay `.env` ni claves en el diff. Antes corre `reglas.test.sh`, que prueba cada regla. |
| `claude-review.yml` | Al abrir o reabrir un PR, o al pasarlo de draft a listo | Review de Claude según [`docs/agents/review.md`](../docs/agents/review.md): contra la issue que cierra el PR, las reglas de `AGENTS.md` y los bugs, con un comentario en línea por hallazgo y un resumen. Corre una vez por PR. |
| `claude.yml` | Cuando alguien comenta `@claude` en un PR o una issue | Claude responde: «@claude revisá de nuevo» pide otra review con la misma guía. |

Para que la review mejore se corrige la guía, `docs/agents/review.md`: lo que marcó de más va en «Qué queda afuera» y lo que se le escapó, en «Qué mirar». Se puede pedir en el mismo PR: «@claude sumá a docs/agents/review.md que…».

Si una regla falla, el mensaje dice cuál es y cómo arreglarla. Para correrlas a mano:

```bash
sh scripts/checks/reglas.sh origin/main   # los commits de tu branch
sh scripts/checks/reglas.test.sh          # prueba cada regla
```

### Ganchos locales

`npm install` en `hackai/` activa los ganchos de `.githooks/` con el script `prepare` (`git config core.hooksPath .githooks`). No hay que instalar nada más.

- `pre-commit`: `reglas.sh --staged` sobre lo que vas a commitear y, si toca código de `hackai/`, Biome sobre esos archivos. Tarda menos de un segundo.
- `pre-push`: typecheck y tests, si lo que pusheás toca `hackai/`. Unos 5 segundos.

Se saltean con `--no-verify`. CI corre lo mismo en GitHub, así que un PR que rompe algo queda en rojo igual.

### Activar la review de Claude

Lo hace una vez un admin del repo:

1. Instalar la GitHub App de Claude en el repo: <https://github.com/apps/claude>.
2. Cargar uno de estos secretos en Settings → Secrets and variables → Actions:
   - `ANTHROPIC_API_KEY`: una clave de la Console de Anthropic. Se paga por uso.
   - `CLAUDE_CODE_OAUTH_TOKEN`: sale de `claude setup-token` y se descuenta de la suscripción de quien lo genera.

Sin secreto, los dos workflows de Claude avisan y terminan en verde. `claude.yml` corre desde `main`: `@claude` empieza a responder cuando ese archivo está mergeado.

## Ingreso de demo

En `/` se entra eligiendo una persona sintética de la lista, alumno o docente, sin clave. La sesión queda en la cookie firmada `hackai_session` y lleva a `/hoy`, el inicio de los dos roles. Se sale con «Salir», que en el celular está en la hoja que abre el avatar. En producción se entra con la cuenta de Microsoft de la Austral: cambia el adaptador del puerto de identidad, no el núcleo.

Para abrir sesiones hace falta `SESSION_SECRET` en el entorno. Sin esa variable la lista se ve, pero al elegir una persona el ingreso avisa que falta.

El ingreso de demo queda abierto a propósito. La identidad en memoria es el único adaptador que hay, y el que se usa si falta `HACKAI_IDENTITY`: cualquiera que llegue a `/` entra como cualquier persona de la lista, también en el deploy público. Para la demo alcanza, porque todos los datos son sintéticos. Antes de cargar datos reales tiene que estar el adaptador de Microsoft.

La cookie va marcada `Secure` solo si el pedido llegó por HTTPS, y eso se sabe por el header `x-forwarded-proto`. Si el hosting no lo manda, la cookie sale sin `Secure` y no avisa. La sesión no se guarda en el servidor: «Salir» borra la cookie, pero una copia de la cookie sigue valiendo hasta que vence, a los 30 días.

## Vínculos de Personas en Supabase

Personas guarda el id de cada persona en cada sistema (la identidad, el SIU, Moodle y Discord). Sin configurar, esos vínculos salen del set sintético y viven en memoria. Con `HACKAI_STORE=supabase` se leen de la tabla propia `people_accounts`.

| Archivo | Qué hace |
| --- | --- |
| `supabase/migrations/0001_people.sql` | Crea `people_accounts`. Es una tabla propia de HackAI: va también en producción. Idempotente, en una transacción, con RLS activado sin políticas y sin acceso para `anon` ni `authenticated`. |
| `supabase/simulados/people_seed.sql` | Carga los vínculos de las personas sintéticas. Es solo de la demo, por eso va con lo simulado y no se aplica en producción. Idempotente: borra los vínculos de esas personas y los carga de nuevo. Se genera con `npm run people:seed` desde `lib/adapters/synthetic-data.ts`; no se edita a mano. |

Para cargarlos en el Supabase del equipo:

```bash
psql "$DATABASE_URL" -f supabase/migrations/0001_people.sql -f supabase/simulados/people_seed.sql
```

Si cambiás las personas de `synthetic-data.ts`, corré `npm run people:seed` y commiteá el SQL: un test avisa si quedó viejo.

La batería de contrato del almacén (`tests/contracts/people-store.test.ts`) corre siempre contra el de memoria y contra el de Supabase con un PostgREST de mentira, sin red. Contra una base de verdad corre solo con `HACKAI_TEST_SUPABASE_URL` y `HACKAI_TEST_SUPABASE_SERVICE_ROLE_KEY`, de una base de prueba con las dos SQL aplicadas.

## SIU simulado

Con `HACKAI_SIU=simulado`, el puerto del SIU lee y escribe las tablas `siu_*` de Supabase en vez de la copia en memoria. Esas tablas copian la forma de la API REST v2 de Guaraní y son solo de la demo: en producción el SIU es la API real.

Por eso sus migraciones y su seed van **aparte** de las propias, en `supabase/simulados/`, y no en `supabase/migrations/`: en producción no se aplican y se pueden tirar sin tocar nada de HackAI.

| Archivo | Qué hace |
| --- | --- |
| `supabase/simulados/0001_siu.sql` | Crea las tablas `siu_*`. Idempotente, en una transacción, con RLS activado sin políticas y sin acceso para `anon` ni `authenticated`. |
| `supabase/simulados/siu_seed.sql` | Carga el set sintético. Idempotente: pisa cada fila por su clave y borra las inscripciones hechas durante la demo. Se genera con `npm run siu:seed` desde `lib/adapters/synthetic-data.ts`, la misma fuente que el SIU en memoria; no se edita a mano. |

Para cargarlas en el Supabase del equipo:

```bash
psql "$DATABASE_URL" -f supabase/simulados/0001_siu.sql -f supabase/simulados/siu_seed.sql
```

Si cambiás `synthetic-data.ts`, corré `npm run siu:seed` y commiteá el SQL: un test avisa si quedó viejo.

La batería de contrato del SIU (`tests/contracts/siu.test.ts`) corre siempre contra el SIU en memoria. Contra el simulado corre solo si definís `HACKAI_TEST_SUPABASE_URL` y `HACKAI_TEST_SUPABASE_SERVICE_ROLE_KEY`, de una base de prueba con las dos SQL aplicadas; si no, la saltea y lo dice.

Los tests que arman un cliente de Supabase (el SIU y el Moodle simulados, y `composition` con `HACKAI_SIU=simulado` o `HACKAI_CLASSROOM=simulado`) necesitan Node 22: con Node 20, supabase-js falla por no tener `WebSocket` nativo.

## Moodle simulado

Con `HACKAI_CLASSROOM=simulado`, el puerto del aula virtual lee y escribe las tablas `moodle_*` de Supabase en vez de la copia en memoria. Esas tablas copian la forma de los Web Services de Moodle ([research](../docs/research/2026-11-10-moodle-web-services.md)): cursos de una persona, matrículas, foro de avisos, contenidos del curso y tareas con fecha. Son solo de la demo, y van aparte de las propias igual que las del SIU.

| Archivo | Qué hace |
| --- | --- |
| `supabase/simulados/0002_moodle.sql` | Crea las tablas `moodle_*`. Idempotente, en una transacción, con RLS activado sin políticas y sin acceso para `anon` ni `authenticated`. En el encabezado figura qué campos de la API quedan afuera. |
| `supabase/simulados/moodle_seed.sql` | Carga cursos, matrículas, avisos, contenidos y tareas del set sintético. Idempotente: pisa cada fila por su clave y borra las matrículas hechas durante la demo. Se genera con `npm run moodle:seed` desde `lib/adapters/synthetic-data.ts`, la misma fuente que el aula en memoria; no se edita a mano. |

Para cargarlas en el Supabase del equipo:

```bash
psql "$DATABASE_URL" -f supabase/simulados/0002_moodle.sql -f supabase/simulados/moodle_seed.sql
```

Los dos adaptadores arman el enlace al aula con `courseUrl(courseId)`: `<base>/course/view.php?id=<id>`, con la base de `data.moodle.baseUrl` en el set sintético. Si cambiás `synthetic-data.ts`, corré `npm run moodle:seed` y commiteá el SQL: un test avisa si quedó viejo.

La batería de contrato del aula virtual (`tests/contracts/classroom.test.ts`) corre siempre contra el aula en memoria. Contra el simulado corre solo si definís `HACKAI_TEST_SUPABASE_URL` y `HACKAI_TEST_SUPABASE_SERVICE_ROLE_KEY`, de una base de prueba con las dos SQL aplicadas; si no, la saltea y lo dice. Cada caso que matricula deja las matrículas como estaban, así se puede repetir.

## Con Docker

Necesita Docker Engine 25 o más nuevo y Docker Compose 2.24 o más nuevo (`docker compose version`). Qué hace cada etapa del build está en los comentarios del [Dockerfile](Dockerfile).

```bash
cd hackai
docker compose up --build                 # http://localhost:3000
docker build --target check -t hackai .   # typecheck y tests dentro del contenedor
```

Las variables se leen de `.env.local` al arrancar el contenedor, nunca se copian a la imagen (`.dockerignore` excluye `.env*`). Sin `.env.local`, arranca con los adaptadores en memoria, pero no se puede entrar: el ingreso necesita `SESSION_SECRET`.

`GET /api/health` responde `{ "status": "ok" }` sin tocar la base. El `HEALTHCHECK` de la imagen lo consulta, y `docker compose ps` muestra el estado (`healthy` o `unhealthy`).

## Variables de entorno

Van en `hackai/.env.local`, que no se versiona. `.env.example` las lista sin valores.

| Variable | Para qué |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Proyecto Supabase del equipo. |
| `SUPABASE_SERVICE_ROLE_KEY` | Acceso a datos desde el servidor. Nunca llega al cliente. |
| `DATABASE_URL` | Solo para correr migraciones con psql. |
| `SESSION_SECRET` | Firma la cookie de sesión `hackai_session`. Sin ella no se puede entrar. |
| `ANTHROPIC_API_KEY` | API de Claude. |
| `DISCORD_BOT_TOKEN` | Token del bot de Discord. Lo usan `HACKAI_EXTERNAL_CHANNEL=discord` y `npm run discord:probar`. Cómo crearlo: [docs/discord.md](docs/discord.md). |
| `HACKAI_IDENTITY`, `HACKAI_SIU`, `HACKAI_CLASSROOM`, `HACKAI_EXTERNAL_CHANNEL`, `HACKAI_FILES`, `HACKAI_CLOCK` | Qué adaptador usa cada puerto. Vacías, usan los de memoria con los datos sintéticos. Valores posibles: `lib/composition.ts`. |
| `HACKAI_STORE` | Dónde guardan lo suyo los módulos: `memoria` (por defecto) o `supabase`, sobre las tablas de `supabase/migrations/`. Por ahora lo usa Personas. |
| `HACKAI_TEST_SUPABASE_URL`, `HACKAI_TEST_SUPABASE_SERVICE_ROLE_KEY` | Solo para los tests: base de prueba contra la que corren las baterías de contrato del SIU y del Moodle simulados y del almacén de Personas. |

No las imprimas en logs ni en reportes.

## Lo que ya hay

| Archivo | Qué trae |
| --- | --- |
| `lib/db.ts` | `db()`, el cliente de Supabase con service role, y `must(res, what)`, que devuelve `data` o tira un error. |
| `lib/claude.ts` | `claude()`, `MODEL_LIVE`, `MODEL_AUTHORING`. |
| `lib/session-token.ts`, `lib/auth.ts` | Sesión firmada en una cookie: `createSessionToken`, `forgeSessionCookie` (tests y desarrollo), `getSession()`, `requireSession(role?)`, `startSession()`, `endSession()` y `homeFor(role)`. |
| `app/globals.css` | Tailwind CSS 4 y los tokens de shadcn/ui con el sistema visual de la dirección «B, Profundo» (`docs/design/direccion-de-diseno.md`): los colores de la Austral, los avisos y la sombra de tarjeta. |
| `components/ui/` | Componentes de shadcn/ui (ADR 0006). Se suman con `npx shadcn add <componente>` y se pasan a las convenciones del repo. Por ahora, `button`. |
| `lib/utils.ts` | `cn()`, que junta clases de Tailwind. |
| `tests/session-token.test.ts` | Tests de la sesión. Ejemplo de cómo se escribe un test con `node:test`. |
| `lib/result.ts` | `Result`, `ok()`, `fail()` y `notImplemented()`: los errores como valores. |
| `lib/ports/` | Los seis puertos (identidad, SIU, aula virtual, canal externo, archivos, reloj) con sus capacidades. |
| `lib/core/` | Las interfaces de Personas, Cursada, Espacios y Hoy. Lo que todavía no está hecho devuelve `no-implementado`. |
| `lib/adapters/synthetic-data.ts` | El set único de datos sintéticos: facultades, materias, comisiones, alumnos, notas, cursos de Moodle y canales de Discord. |
| `lib/adapters/memoria/` | Un adaptador en memoria por puerto, cargado con ese set. |
| `lib/adapters/discord/` | El canal externo real: API REST v10 de Discord, sin gateway. Bot y prueba manual (`npm run discord:probar`): [docs/discord.md](docs/discord.md). |
| `tests/contracts/` | La batería de contrato de cada puerto y del almacén de Personas, que corre contra el adaptador en memoria y el real. `fake-discord.ts` es un `fetch` con la forma de la API de Discord, sin red. |
| `lib/composition.ts` | `compose(env)` para los tests y `system()` para la app: arma los módulos con el adaptador de cada puerto y con su almacén. |
| `lib/adapters/siu-simulado/` | El SIU simulado sobre las tablas `siu_*` y el generador de su seed. |
| `lib/adapters/moodle-simulado/` | El Moodle simulado sobre las tablas `moodle_*` y el generador de su seed. |
| `lib/adapters/supabase/` | Lo que comparten los adaptadores sobre Supabase: `client.ts` (cliente con service role), `query.ts` (consultas con tiempo máximo) y `sql.ts` (literales y `upsert` que usan los generadores de seed). Además, el almacén de Personas sobre `people_accounts` y el generador de su seed. |
| `app/page.tsx`, `app/actions/session.ts`, `components/session/` | El ingreso de demo: la lista de personas por rol, y las acciones para entrar y salir. |
| `components/shell/` | Lo que comparten las pantallas: `PageHeader` (encabezado navy con la marca), `Brand`, `AppShell` y `AppNav` (la navegación), y `Avatar` (iniciales). |
| `app/(app)/hoy/` | Inicio de los dos roles. Por ahora saluda y lleva a Mis materias; el resto llega con Hoy (#18). |
| `app/(app)/materias/` | Mis materias: las actuales arriba y las archivadas aparte, para alumno y docente, cada una con el enlace a su aula de Moodle y sus tareas con fecha. |

Los módulos del núcleo, los puertos, la estructura de carpetas y cómo se testea están en [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md).
