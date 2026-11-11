# hackai

HackAI, nuestro sistema para HackAI 2026: unifica la vida académica del alumno sobre el SIU, Moodle y Campus Austral (qué hace y por qué: `docs/product/alcance.md`). Todavía no tiene pantallas ni tablas: salen de la spec.

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

## Con Docker

El `Dockerfile` tiene cuatro etapas: `deps` (instala con `npm ci`), `check` (typecheck y tests), `builder` (`next build` en modo standalone) y `runner` (la imagen final: solo el servidor de Next, con un usuario sin privilegios).

```bash
cd hackai
docker compose up --build                 # http://localhost:3000
docker build --target check -t hackai .   # typecheck y tests dentro del contenedor
```

Las variables se leen de `.env.local` al arrancar el contenedor, nunca se copian a la imagen (`.dockerignore` excluye `.env*`). Sin `.env.local`, arranca con los adaptadores en memoria.

`GET /api/health` responde `{ "status": "ok" }` sin tocar la base. El `HEALTHCHECK` de la imagen lo consulta cada 30 segundos, y `docker compose ps` muestra el estado (`healthy` o `unhealthy`).

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

Los módulos del núcleo, los puertos, la estructura de carpetas y cómo se testea están en [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md).
