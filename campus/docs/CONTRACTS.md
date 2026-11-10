# Contratos de la fundación

Resumen de lo que dejó el agente de fundación. Complementa `docs/SPEC.md`. Si algo choca, manda el SPEC. Si cambiás un contrato de esta lista, avisalo en tu reporte.

## Entorno

- Node 22: `source ~/.nvm/nvm.sh && nvm use 22`. Variables: `set -a; source .env.local; set +a`. No las imprimas.
- Scripts: `npm run typecheck` (`tsc --noEmit -p .`), `npm run build`, `npm run dev`, `npm run seed` (corre base y después content), `npm run seed:base` y `npm run seed:content`.
- TypeScript 5.9, Next 15.5, React 19, `@anthropic-ai/sdk` 1.x y `@supabase/supabase-js` 2.x. Alias: `@/*` apunta a la raíz.

## lib/ (compartido: no lo edites, extendelo en `lib/<feature>/`)

| Módulo | Exports | Notas |
| --- | --- | --- |
| `lib/db.ts` (server-only) | `db()`, `must(res, what)`, `COURSE_ID` | Cliente de supabase-js con service role. RLS sin políticas. |
| `lib/db-node.ts` | `serviceDb()`, `createServiceClient()`, `COURSE_ID` | Lo mismo sin `server-only`. Usalo solo en scripts y tests con tsx. |
| `lib/db-types.ts` | `Person`, `PERSON_PUBLIC_COLUMNS`, `ClassSession`, `DeckRow`, `SlideDbRow`, `LiveSession`, `Overlay`, `OverlayType` | Escritos a mano. `Overlay` es `{type:'poll', pollId, showResults} \| {type:'qr', url, title?} \| {type:'student', personId, name, company?, position?, photoUrl?} \| {type:'postures', caseId} \| {type:'confusion', position} \| {type:'timer', endsAt, label?} \| {type:'sim', simId, url} \| {type:'message', text}`. |
| `lib/auth.ts` (server-only) | `getSession()` (verifica en la DB persona, rol y `people.session_version`; memoizado por request), `bumpSessionVersion(personId)` (revoca sesiones), `requireSession(role?)`, `getCurrentPerson()`, `requirePerson(role?)`, `setSessionCookie({personId, role})`, `clearSessionCookie()`, `getGuestKey()`, `ensureGuestKey()`, `homeFor(role)`, más los re-exports de session-token | `requireSession` redirige a `/` si no hay sesión y a la home del rol si el rol no coincide. `ensureGuestKey`, `setSessionCookie` y `clearSessionCookie` funcionan solo en server actions y route handlers. |
| `lib/session-token.ts` | `signSession`, `verifySessionToken`, `forgeSessionCookie`, `hashPin`, `verifyPin`, `isValidPin`, `SESSION_COOKIE` (`campus_session`), `GUEST_COOKIE` (`campus_guest`), `Role`, `Session` | Es puro (node:crypto) y sirve para tests. La cookie es `base64url(JSON{personId, role, iat, exp}).hmacSHA256` con `SESSION_SECRET` y dura 30 días. El PIN se guarda como `scrypt$salt$hash`. |
| `lib/realtime.ts` (server-only) | `broadcast(id, event, payload, audience?)`, `emitLive(id, type, payload?, actor?)`, `getLiveState(id)`, `broadcastState(id)`, `liveChannelName(id)`, `liveProfChannelName(id)`, `LIVE_EVENTS`, `LiveState`, `LiveStateFull` | Canales **privados** (migración 0140: los clientes leen, nunca emiten). `transcript`, `agent.turn`, `draw`, `settings` y `poll.created` van solo al canal del profesor (`liveprof:<id>:<hmac>`); `poll.updated` va completo al profesor y como `{pollId, total, status?}` a `live:<id>`; el resto a `live:<id>`. `LiveState` lleva `seq` (live_sessions.seq): los clientes ignoran un state con seq menor. `emitLive` inserta en `live_events` y emite con `event = type`. |
| `lib/realtime-client.ts` (client) | `useLiveChannel(liveSessionId, handler) → {status}`, `useBroadcastChannel(topic, handler)`, `browserSupabase()` | Se suscribe con `config.private`. El nombre del canal del profesor lo pasa el servidor a `/live/[id]`. |
| `lib/claude.ts` (server-only) | `claude()`, `MODEL_LIVE` (`claude-sonnet-5-5`), `MODEL_AUTHORING` (`claude-opus-5-5`), `Anthropic` | |
| `lib/decks/` (puro) | `parseSlide`, `parseDeck`, `splitDeck`, `joinDeck`, `slideIssues`, `slideTitle`, `slideKind`, `slideContext`, `deckContext`, `pollOptionId`, `SLIDE_LIMITS`, tipos (`ParsedSlide`, `SlideType`, `SlideInteractive`, `PollKind`, `PollOption`, `SlideContext`, `DeckChapter`, `DeckSource`, `SLIDE_TYPES`, `INTERACTIVE_TYPES`, `STRUCTURED_TYPES`, `POLL_KINDS`) | Importá desde `@/lib/decks` o `@/lib/decks/parse`. |
| `lib/decks/store.ts` (server-only) | `getDeck(deckId, audience='alumno') → {deck, slides} \| null`, `listDecks(courseId?)`, `getDeckVersion(deckId)`, `touchDeck(deckId)` | `slides` trae `[{position, id, kind, title, markdown, teacherNotes?, version, tags}]`. `teacherNotes` y `deck.teacherGuide` aparecen solo con `audience: 'profesor'`. Después de insertar, editar o reordenar slides, llamá a `touchDeck(deckId)` y emití `deck.changed {deckVersion}`. Reordená solo con `authoring_set_deck_order(p_deck, p_slides, p_expected)` o `live_insert_deck_slide` (lock del deck, control de concurrencia, corren marcas/notas y la posición de las clases vivas); después `publishDeckSessions(deckId)` (lib/live/session) emite el state. |
| `lib/course.ts` (server-only) | `getClassSessions()`, `getCases()`, `getAssignments()`, `getSims()`, `bySession(rows)` | Si la tabla está vacía devuelven `[]`. |
| `lib/ids.ts` | `uuidv5(name)`, `baseSlideId(deckId, pos)`, `insertedSlideId(sessionId, i)`, `personId(slug)`, `slidePollId(slideId)`, `liveCode()`, `CODE_ALPHABET` | El código de clase tiene 6 caracteres sin 0/O/1/I/L. |
| `lib/routes.ts` | `routes.*` (todas las rutas del SPEC), `PROFESOR_NAV`, `ALUMNO_NAV`, `NavItem` | Usalo para linkear entre features. |
| `lib/format.ts` | `fechaLarga`, `fechaCorta`, `diaSemana`, `fechaHora` | Hora de Buenos Aires. |

## Slides: DSL interactivo

- `:::encuesta single|multiple|open|scale|wordcloud`, seguido de `# pregunta` y de `- opción` por línea. Produce `interactive = {kind:'encuesta', pollKind, question, options:[{id:'opt-a', label}]}`. En `open` y `wordcloud` no hay opciones. En `scale` sin opciones la escala va de 1 a 5.
- `:::postura <caseId>` produce `{kind:'postura', caseId, title?}`.
- `:::simulador <simId>` produce `{kind:'simulador', simId, title?}`.
- `:::qr` con `# título` y una URL produce `{kind:'qr', title?, url?}`.
- Las slides interactivas también admiten `>> kicker` y `-- pie`. Si faltan datos, `slideIssues()` lo avisa.

## components/deck/

- `SlideView` (client): `{ slide: ParsedSlide | string, index?, total?, contexto?: {materia?, jornada?}, renderInteractive?: (slide) => ReactNode, fit?: 'width' | 'contain', className?, style? }`. Renderiza una slide en un escenario de 1280×720 que se escala al contenedor. Con `fit='width'` ocupa el ancho a 16:9. Con `fit='contain'` llena un contenedor que tiene alto (proyector) y deja bandas. Si `renderInteractive` devuelve `null`, se muestra el placeholder.
- `SlideCanvas`: la misma slide sin escalar, a 1280×720.
- `DeckPlayer` (client): `{ slides: [{id?, position?, markdown, title?, teacherNotes?}], materia?, contexto?, index?, initialIndex?, onIndexChange?, renderInteractive?: (slide, index) => ReactNode, showNotes?, chapters?, keyboard?, children? }`. Se maneja con ← → espacio, PageUp/PageDown, Inicio/Fin y F (pantalla completa). Puede ser controlado o no controlado.
- `DECK_DIAGRAMS`: los 15 diagramas SVG de mbt (`:::diagram <id>`).
- CSS: `slides-base.css` (piel portada de mbt) y `deck.css` (escenario, cian, placeholders y player). Las clases `c-*` y `dk-*` son de la slide. No las uses para otras cosas.

## UI compartida

- `app/globals.css` define los tokens (`--azul #1d21a9`, `--cian #3ff0ff`, `--naranja`, `--hielo`, `--tinta`, `--gris`, `--borde`…) y estas clases: `.page`, `.page-head`, `.seccion`, `.card`, `.grid`, `.stack`, `.fila`, `.btn`, `.btn-primario`, `.btn-accion`, `.btn-ghost`, `.btn-sm`, `.form`, `.field`, `.input`, `.select`, `.textarea`, `.ayuda`, `.alerta(-error|-ok|-aviso)`, `.badge(-vivo|-ok|-ficticio)`, `.kicker`, `.resaltado`, `.vacio`, `.tabla`, `.tabla-scroll`, `.muted`, `.chico`. La fuente es Montserrat (next/font, `--font-montserrat`).
- Los shells son `app/profesor/layout.tsx` (exige profesor) y `app/campus/layout.tsx` (exige alumno), con `components/shell/AppShell`. Igual, **cada page y cada action tiene que llamar a `requireSession`**: el layout no alcanza.
- Rutas fuera de shell: `/live/[id]`, `/s/[code]` y `/p/[pollId]` arman su propio layout.
- Ingreso: `/` con un formulario para alumno (padrón + PIN; el primer ingreso exige el código inicial de `/profesor/alumnos`, `pinSetupCode(personId, session_version)`) y otro para profesor (email exacto + `PROFESSOR_ACCESS_CODE`). Ambos con límite de intentos (`lib/security.ts`). Acepta `?next=/ruta` (solo rutas internas). Para salir: action `logout` (`app/actions/auth.ts`) o `GET /salir`.
- Clase en vivo: `app/actions/start-live.ts` define `startLiveSession(formData{deckId, classSessionId?, force?})`. Si ya hay una clase viva del deck, la retoma; si no, crea `live_sessions` con un código de 6 caracteres, emite `session.started` y redirige a `/live/<id>`. `endLiveSession(formData{liveSessionId})` la cierra.
- `/decks/[id]` es un visor genérico de la fundación para cualquier rol, y el profesor ve las notas. No está en el SPEC: las features pueden linkear a sus propias rutas en su lugar.
- Nadie implementó todavía `GET /api/live/<id>/state`. Le toca a la feature en vivo, que lo resuelve con `getLiveState(id)`.

## Contenido (content/aicm/)

- `content/aicm/types.ts` define `JornadaContent`: `{ sessionId: 'aicm-jN', teacherNotes: Record<posBase, string>, insertions: [{afterPosition, markdown, teacherNotes?, tags?}], case: {id, title, protagonist, summary, bodyMd, question, postures:[{id,label,description}], teacherNotes, isFictional}, assignment?: {id, title, briefMd, rubric:[{id, criterion, weight, levels:[{score,label,description}]}], dueOffsetDays, peerReviewsPerSubmission}, contentItems: [{id, kind, title, url?, bodyMd?, conceptIds?}], concepts: [{id, name, summary, prereqs}] }`.
- Cada archivo `content/aicm/j1.ts` … `j8.ts` hace `export default`. `j0-ejemplo.ts` es la muestra y la seed no lo carga.
- Las posiciones son siempre del deck **base** (0-based, 34 slides por deck) y `afterPosition: -1` pone la slide al principio. Los ids de caso, entrega, contenidos y conceptos son globales, así que prefijalos con la jornada.

## Seeds (idempotentes)

- `npx tsx scripts/seed/base.ts` carga el curso `ai-centric-management`, las 8 `class_sessions` `aicm-j1..8` (solo fecha a las 00:00 -03, porque el horario no está confirmado y así lo dice el summary), 3 profesores (Ignacio con email, los otros dos sin email), 20 alumnos ficticios y 8 decks con 272 slides. Los ids son uuid v5, así que reejecutarlo no duplica. Una slide editada (version > 1) no se pisa, y el `deck_slides` de un deck que tenga inserciones no se toca.
- `npx tsx scripts/seed/content.ts [archivo…]` carga todos los `content/aicm/j<N>.ts` si no le pasás archivos. Carga notas, inserciones (después de su slide base; las slides ajenas quedan en su lugar), caso, entrega (`status` solo al crear), conceptos, contenidos y una poll `draft` por cada `:::encuesta` del deck (id `slidePollId(slideId)`).
- `npx tsx scripts/seed/content.ts --remove <archivo>` deshace lo que cargó ese archivo.

## Cómo forjar una sesión para tests

```ts
import { forgeSessionCookie } from '@/lib/session-token' // necesita SESSION_SECRET en el entorno
const cookie = forgeSessionCookie(personId, 'alumno')    // 'campus_session=<token>'
await fetch('http://localhost:3000/campus', { headers: { cookie } })
```

- Ids fijos: `personId('ignacio-berdinas')` es el profesor y `personId('<slug>')` es un alumno (los slugs están en `scripts/seed/cohort.ts`, por ejemplo `mariana-etcheverry`).
- Para llamar una server action desde un script, sacá el id de `.next/server/server-reference-manifest.json` (`node[id].exportedName`) y hacé un POST con el header `Next-Action: <id>` y multipart. Primero van los campos `_1_<campo>` y **al final** `0 = JSON.stringify([prevState, '$K1'])`, o `['$K1']` si la action recibe solo `FormData`.

## Endurecimiento (corrector, 24/10)

- Estado de la clase: `setPosition`, `setOverlay(live, overlay, actor, expect?)` y `endLive` usan funciones SQL atómicas (`live_goto`, `live_set_overlay`, `live_end`) que devuelven la fila; `live` se actualiza in place. `refreshLive(live)` relee la fila (el agente lo hace antes de cada herramienta).
- Marcas y notas: la clave es `slide_id` (índices únicos de 0141). Las APIs `/api/student/marks` y `/api/student/notes` aceptan `slideId` (gana sobre `position`).
- `overlay-data`: el parámetro `?overlay=` solo vale para el profesor; alumnos e invitados reciben el overlay proyectado, y sin conteos de encuesta hasta que se muestran resultados.
- Límites: `lib/security.ts` (`throttleStatus/Fail/Clear`, `rateHit`, `clientIp`) sobre las tablas `auth_throttle` y `rate_hits`.

## Jornadas v2 y features del integrador (24/10)

- **Decks v2**: `content/aicm2/jN.ts` (`JornadaDeckV2`, ver `content/aicm2/types.ts`) se cargan con `npx tsx scripts/seed/decks-v2.ts` en `aicm-jN`. El deck anterior queda como `aicm-jN-v1` (curso `ai-centric-management-legacy`). Ids de slide `uuidv5('slide:v2:<deck>:<i>')`, `origin = {v2: deckId, index, file}`, tags `['aicm', deckId, 'v2', …]`. Las slides `:::iae` se guardan con `slideV2Markdown` (`lib/iae/v2.ts`).
- **Casos**: `cases.is_active` (0160). `getCases()`, el agente en vivo y las herramientas MCP del alumno filtran `is_active = true`. Los casos Harvard son `hbs-perplexity`, `hbs-gamma`, `hbs-harvey` y `hbs-palantir`.
- **Entregas**: las de status `borrador` no se muestran al alumno (`/campus`, `/campus/entregas`, MCP `get_class`). Los 6 entregables oficiales están en `lib/organizacion/entregables.ts`.
- **Mi organización** (`lib/organizacion/`, migración 0160) y **actividades, office hours y radar** (`lib/actividades/`, migración 0170): ver los reportes en el README. Rutas en `routes.campusOrganizacion`, `routes.profesorOrganizaciones`, `routes.campusActividades`, `routes.profesorActividades`, `routes.campusOfficeHours`, `routes.campusRadar` y sus pares del profesor; todas están en `ALUMNO_NAV` y `PROFESOR_NAV`.
- **MCP**: 14 herramientas del profesor y 10 del alumno (`hola_campus` y `mi_organizacion` se suman a las 8).
