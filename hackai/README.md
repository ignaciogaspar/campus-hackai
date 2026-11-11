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
npm run typecheck      # tsc --noEmit -p .
npm test               # node:test + tsx sobre tests/**/*.test.ts
npm run build
```

`npm test` necesita Node 22 o más: le pasa el glob a `node --test`, que Node 20 no expande. Para la demo, usá Node 22.

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

Los tests que arman un cliente de Supabase (el SIU simulado y `composition` con `HACKAI_SIU=simulado`) necesitan Node 22: con Node 20, supabase-js falla por no tener `WebSocket` nativo.

## Con Docker

Necesita Docker Engine 25 o más nuevo y Docker Compose 2.24 o más nuevo (`docker compose version`). Qué hace cada etapa del build está en los comentarios del [Dockerfile](Dockerfile).

```bash
cd hackai
docker compose up --build                 # http://localhost:3000
docker build --target check -t hackai .   # typecheck y tests dentro del contenedor
```

Las variables se leen de `.env.local` al arrancar el contenedor, nunca se copian a la imagen (`.dockerignore` excluye `.env*`). Sin `.env.local`, arranca con los adaptadores en memoria.

`GET /api/health` responde `{ "status": "ok" }` sin tocar la base. El `HEALTHCHECK` de la imagen lo consulta, y `docker compose ps` muestra el estado (`healthy` o `unhealthy`).

## Variables de entorno

Van en `hackai/.env.local`, que no se versiona. `.env.example` las lista sin valores.

| Variable | Para qué |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Proyecto Supabase del equipo. |
| `SUPABASE_SERVICE_ROLE_KEY` | Acceso a datos desde el servidor. Nunca llega al cliente. |
| `DATABASE_URL` | Solo para correr migraciones con psql. |
| `SESSION_SECRET` | Firma la cookie de sesión `hackai_session`. |
| `ANTHROPIC_API_KEY` | API de Claude. |
| `HACKAI_IDENTITY`, `HACKAI_SIU`, `HACKAI_CLASSROOM`, `HACKAI_EXTERNAL_CHANNEL`, `HACKAI_FILES`, `HACKAI_CLOCK` | Qué adaptador usa cada puerto. Vacías, usan los de memoria con los datos sintéticos. Valores posibles: `lib/composition.ts`. |
| `HACKAI_TEST_SUPABASE_URL`, `HACKAI_TEST_SUPABASE_SERVICE_ROLE_KEY` | Solo para los tests: base de prueba contra la que corre la batería de contrato del SIU simulado. |

No las imprimas en logs ni en reportes.

## Lo que ya hay

| Archivo | Qué trae |
| --- | --- |
| `lib/db.ts` | `db()`, el cliente de Supabase con service role, y `must(res, what)`, que devuelve `data` o tira un error. |
| `lib/claude.ts` | `claude()`, `MODEL_LIVE`, `MODEL_AUTHORING`. |
| `lib/session-token.ts`, `lib/auth.ts` | Sesión firmada en una cookie: `forgeSessionCookie`, `getSession()`, `requireSession(role?)`. Es provisoria: cómo entra el alumno todavía no está decidido. |
| `app/globals.css` | Tailwind CSS 4 y los tokens de shadcn/ui, con los colores provisorios de la Austral, hasta que se rediseñe el sistema visual. |
| `components/ui/` | Componentes de shadcn/ui (ADR 0006). Se suman con `npx shadcn add <componente>` y se pasan a las convenciones del repo. Por ahora, `button`. |
| `lib/utils.ts` | `cn()`, que junta clases de Tailwind. |
| `tests/session-token.test.ts` | Tests de la sesión. Ejemplo de cómo se escribe un test con `node:test`. |
| `lib/result.ts` | `Result`, `ok()`, `fail()` y `notImplemented()`: los errores como valores. |
| `lib/ports/` | Los seis puertos (identidad, SIU, aula virtual, canal externo, archivos, reloj) con sus capacidades. |
| `lib/core/` | Las interfaces de Personas, Cursada, Espacios y Hoy. Lo que todavía no está hecho devuelve `no-implementado`. |
| `lib/adapters/synthetic-data.ts` | El set único de datos sintéticos: facultades, materias, comisiones, alumnos, notas, cursos de Moodle y canales de Discord. |
| `lib/adapters/memoria/` | Un adaptador en memoria por puerto, cargado con ese set. |
| `lib/composition.ts` | `compose(env)` para los tests y `system()` para la app: arma los módulos con el adaptador de cada puerto. |
| `lib/adapters/siu-simulado/` | El SIU simulado sobre las tablas `siu_*` y el generador de su seed. |
| `app/materias/` | Mis materias: las actuales arriba y las archivadas aparte, para alumno y docente. |

Los módulos del núcleo, los puertos, la estructura de carpetas y cómo se testea están en [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md).
