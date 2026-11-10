# Checklist de compatibilidad con campus

Fuente: secciones 11 y 12 de la [nota del repo de Nacho](../../../docs/research/2026-11-10-repo-campus-nacho.md) (igual a la pestaña «Repo Mergeable de Nacho» del Google Doc), que a su vez bajan `campus/docs/SPEC.md` y `campus/docs/CONTRACTS.md`. Los ítems marcados «(nuestra)» no están escritos en campus: salen de los riesgos del análisis y hay que confirmarlos con Nacho. El repo de Nacho rompe algunas de estas reglas; el código nuevo sigue la regla escrita.

Las rutas están escritas relativas a la app: en este repo llevan `hackai/` adelante, en el de Nacho no.

## Estilo e idioma

- Dos espacios, comillas simples, sin punto y coma, imports con `@/` desde la raíz. No hay linter ni Prettier: se respeta a mano.
- Textos de UI, comentarios y mensajes de error en español rioplatense con voseo.
- Rutas de páginas en español (`/campus/entregas`). Identificadores y columnas en inglés. Valores de dominio en español (`'borrador'`, `'abierta'`).
- Las dependencias son las de `campus/package.json`, en las mismas versiones. Tailwind, librerías de UI, zod, un ORM u otro framework de tests rompen la compatibilidad.

## Estructura

- `lib/<feature>/` con `types.ts`, `core.ts` (lógica pura, sin I/O), `store.ts` (server-only, usa `db()` y `must()`) y `actions.ts` (`'use server'`). El modelo a copiar es `lib/learning`.
- `components/<feature>/` con su `<feature>.css` y un prefijo de clase propio. `'use client'` solo en la hoja interactiva, nunca dentro de `app/`.
- Páginas en `app/campus/<feature>` (alumno) y `app/profesor/<feature>` (docente). APIs en `app/api/<feature>`.
- Tests de la lógica pura en `tests/<feature>.test.ts` con `node:test`, más su script en `package.json`.
- `docs/<FEATURE>.md` con el formato de `POST-CLASS.md` (ver `FEATURE-DOC.md`).

## Base de datos

- Una migración nueva, `supabase/migrations/02NN_<feature>.sql`, desde `0240`. El `0230` está repetido en campus: el número se acuerda con Nacho.
- Idempotente (`if not exists`, `create or replace`): correrla dos veces da el mismo resultado.
- En transacción (`begin`/`commit`). En cada tabla y función: RLS activado sin políticas, `revoke` a `anon` y `authenticated` y `grant` a `service_role`. Plantilla: `0230_post_class.sql`.
- Las tablas existentes quedan como están. Un dato extra va en una tabla nueva que referencie `people(id)` o `courses(id)`.
- Operaciones con cupo o concurrencia: una función SQL con lock, como `oh_book`.

## Auth y datos

- Cada página y cada action empieza con `requireSession('alumno' | 'profesor')`; el layout no alcanza. En las APIs, `getSession()` y respuesta JSON con la forma `{ error }`.
- El id de la persona sale de la sesión, nunca del formulario.
- Todo acceso a datos es en el servidor con el service role; la clave se queda en el servidor.
- Filtrar siempre por curso. En lo que lee el alumno, columnas explícitas (nunca `pin_hash` ni notas del docente).
- `dynamic = 'force-dynamic'` en lo que lee sesión.
- Datos sintéticos únicamente: nada de datos reales de alumnos. Si la feature necesita datos de demo, trae su propio seed, idempotente.
- (nuestra) Datos personales (notas, inscripciones) viajan por pedidos al servidor, no por Realtime: la política de `0140` deja leer los canales `live:%` y `liveprof:%` sin login, y el del profesor solo se protege con un HMAC en el nombre.
- (nuestra) Los errores 500 no devuelven el mensaje interno.
- Un permiso administrativo se arma con una tabla propia y un `requireStaff()` montado sobre `requireSession('profesor')`. Agregar un rol al núcleo obliga a tocar `lib/session-token.ts`, `lib/auth.ts`, `lib/db-types.ts` y el check de `people.role`.

## IA

- `claude()` y las constantes de modelo de `lib/claude.ts`; `maxDuration` explícito en la ruta.
- Todo texto escrito por alumnos entra al prompt marcado como datos, con el helper `untrusted()` (`lib/agent/context.ts`). En campus solo lo usa el agente en vivo; el tutor y la pre-evaluación no, y no hay que copiarlos.
- Lo que escribe un agente es una propuesta que aprueba una persona (patrón `Proposal`). En actas y notas es obligatorio.
- (nuestra) Si la feature llama al modelo por usuario, el cupo se descuenta de forma atómica (el del tutor no lo es).
- Herramienta MCP nueva: archivo propio en `lib/mcp/tools/` y una línea en el array del rol.

## Archivos compartidos

Son los archivos donde un cambio nuestro choca con cambios de Nacho. La feature los toca con una sola línea como máximo, y cada toque se anota en la sección «Archivos y pasos» del doc de la feature, con la línea exacta.

- `lib/routes.ts` (rutas y menús `PROFESOR_NAV`, `ALUMNO_NAV`): el choque más probable. Las rutas se definen en `lib/<feature>/routes.ts` y al menú se le suma una línea.
- `middleware.ts`: hasta el 12/11 a las 18:30, `/campus` redirige a la bienvenida salvo 4 rutas exactas (bienvenida, organizacion, perfil, cohorte; sus subrutas no). El middleware no autentica. Una ruta nueva de alumno queda bloqueada hasta que se suma a `ABIERTAS_ANTES` o se define `CAMPUS_ABRE`.
- `app/campus/page.tsx` y `app/profesor/page.tsx` (las homes), `lib/inicio.ts` (jornada en foco y avisos), `lib/learning/core.ts` (`nextStep()`, el «próximo paso») y `lib/jornadas.ts`: solo si la feature aparece en la home.
- `package.json` (script de test), `README.md`, `docs/CONTRACTS.md` y el número de migración.

## Antes de entregar

- Node 22, `npm ci`, `npm run typecheck`, `npm run build`, los tests propios y los que ya trae la app.
- Probado a 390 px de ancho y con teclado.
- Migración corrida dos veces sin error.
- Workflow `mergeable-check` sin hallazgos abiertos.
