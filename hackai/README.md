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
npm test               # node:test + tsx sobre tests/*.test.ts
npm run build
```

Con Node 20 instala y pasa los tres chequeos, con un warning de `engines`. Para la demo, usá Node 22.

## Variables de entorno

Van en `hackai/.env.local`, que no se versiona. `.env.example` las lista sin valores.

| Variable | Para qué |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Proyecto Supabase del equipo. |
| `SUPABASE_SERVICE_ROLE_KEY` | Acceso a datos desde el servidor. Nunca llega al cliente. |
| `DATABASE_URL` | Solo para correr migraciones con psql. |
| `SESSION_SECRET` | Firma la cookie de sesión `hackai_session`. |
| `ANTHROPIC_API_KEY` | API de Claude. |

No las imprimas en logs ni en reportes.

## Lo que ya hay

| Archivo | Qué trae |
| --- | --- |
| `lib/db.ts` | `db()`, el cliente de Supabase con service role, y `must(res, what)`, que devuelve `data` o tira un error. |
| `lib/claude.ts` | `claude()`, `MODEL_LIVE`, `MODEL_AUTHORING`. |
| `lib/session-token.ts`, `lib/auth.ts` | Sesión firmada en una cookie: `forgeSessionCookie`, `getSession()`, `requireSession(role?)`. Es provisoria: cómo entra el alumno todavía no está decidido. |
| `app/globals.css` | Estilos base provisorios, hasta que se rediseñe el sistema visual. |
| `tests/session-token.test.ts` | Tests de la sesión. Ejemplo de cómo se escribe un test con `node:test`. |

Los módulos del núcleo, los puertos, la estructura de carpetas y cómo se testea están en [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md).
