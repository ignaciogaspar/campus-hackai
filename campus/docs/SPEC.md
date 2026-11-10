# Campus Austral · spec de construcción

Campus virtual para IAE / Universidad Austral. Primera materia cargada: **AI-Centric Management** (8 jornadas, 10/11 al 03/12/2026, DOT, CABA; profesores Sebastián Buffo Sempé, Ignacio Berdiñas, Alberto Willi). El corazón es la **clase en vivo**: el deck se proyecta desde el campus, el profesor le habla a un **agente en vivo** con un botón de micrófono, y el agente modifica la presentación o muestra cosas a los alumnos (encuesta con QR, sorteo de quién habla, resultados, slide nueva). Todo lo que el alumno marca, anota y responde queda guardado por slide para entender qué entendió la cohorte.

UI y comentarios en español rioplatense (voseo). Estilo de código: dos espacios, comillas simples, sin punto y coma, imports `@/` desde la raíz.

## Stack y contratos

- Next.js 15 App Router, React 19, TypeScript estricto, CSS plano (sin Tailwind). Node 22 (`nvm use 22`).
- Supabase Postgres (proyecto `campus-austral`, ref `uvxmcuknhhygywctoqxd`, São Paulo). Esquema: `supabase/migrations/0001_campus.sql`. **No cambies tablas existentes**; si una feature necesita columnas o tablas nuevas, agregá un archivo `supabase/migrations/01NN_<feature>.sql` idempotente (`if not exists`) y aplicalo con `psql "$DATABASE_URL" -f ...`.
- **Todo acceso a datos es server-side** con el service role (`lib/db.ts` → `db()` devuelve un cliente supabase-js con service role). RLS está activo sin políticas. Nunca mandes la service key al cliente.
- **Tiempo real**: Supabase Realtime **Broadcast** con canales privados de solo lectura para los clientes (migración 0140). Canal `live:<liveSessionId>` y un canal del profesor con nombre firmado para transcript, agente y sorteos (ver CONTRACTS). El servidor emite con `lib/realtime.ts` → `broadcast(liveSessionId, event, payload)` (vía REST `POST /realtime/v1/api/broadcast` con service key) además de insertar en `live_events`. Los clientes se suscriben con la anon key (`lib/realtime-client.ts` → `useLiveChannel(id, handler)`). Eventos:
  - `state` `{position, overlay, deckVersion}` — fuente de verdad del estado visible; los clientes también pueden pedir `GET /api/live/<id>/state`.
  - `deck.changed` `{deckVersion}` — se insertó o editó una slide: recargar slides.
  - `poll.updated` `{pollId, counts}` — llegó una respuesta.
  - `transcript` `{text, isCommand}` — opcional para mostrar subtítulos.
- **Auth sin SSO** (`lib/auth.ts`): cookie `campus_session` firmada con HMAC (`SESSION_SECRET`), contiene `{personId, role}`. `getSession()`, `requireSession(role?)`.
  - Profesor: email de un `people` con role profesor + `PROFESSOR_ACCESS_CODE` (env).
  - Alumno: elige su nombre del padrón del curso + PIN de 4 dígitos (se fija en el primer ingreso, guardado con scrypt en `pin_hash`). El primer ingreso exige además el código inicial que el profesor ve en `/profesor/alumnos` (donde también resetea PINs). Con límite de intentos.
  - Invitado en encuesta por QR: puede responder sin login con un nombre; cookie `campus_guest` con un uuid.
- Claude: `@anthropic-ai/sdk`, `ANTHROPIC_API_KEY` en env. Modelos: `claude-sonnet-5-5` para el agente en vivo y el tutor (latencia), `claude-opus-5-5` para autoría de slides. Cargá el skill `claude-api` antes de escribir código de la API. `lib/claude.ts` exporta el cliente.
- Variables de entorno en `.env.local` (ya creado): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `SESSION_SECRET`, `PROFESSOR_ACCESS_CODE`, `ANTHROPIC_API_KEY`. No las imprimas en logs ni en reportes.

## Slides: DSL y repositorio único

El formato de slide es el DSL de `../mbt` (`components/campus/SlideDeck.tsx`, `DeckDiagrams.tsx`, `data/presentations/*.ts`): cada slide es un bloque markdown que empieza con `:::tipo` y se separa con `\n---\n`. Tipos existentes: `default, cover, big, quote, split, diagram, manos, cierre, cifra, tiempo, versus, pasos, matriz, tabla, pregunta`. Se suman tipos interactivos:

- `:::encuesta single|multiple|open|scale|wordcloud` — `# pregunta` + `- opción` por línea. Al llegar a la slide en vivo, el profesor (o el agente) la abre y aparece el QR.
- `:::postura <caseId>` — muestra la distribución de posturas previas del caso y habilita el sorteo.
- `:::simulador <simId>` — embebe el simulador; en vivo los alumnos lo abren en su dispositivo.
- `:::qr` — `# título` + una URL.

Cada slide es una fila de `slides` (repositorio único, reutilizable entre decks y profesores); `deck_slides` ordena. Editar crea una fila en `slide_revisions` e incrementa `version`. `teacher_notes` nunca se manda al alumno.

`lib/decks/` (motor puro, sin I/O): `parseSlide`, `parseDeck`, `splitDeck`, tipos. `components/deck/SlideView.tsx` renderiza una slide en marca IAE (azul `#1d21a9`, resaltador cian `#3ff0ff`, Montserrat; ver `../mbt/docs/iae-brand.md` y `../iae-piezas`), a 16:9 escalable, igual en proyector, celular y editor. `lib/decks/store.ts` (server) carga un deck con sus slides desde la DB.

Decks `kind='html'` (el de Empresas Familiares) son sitios estáticos en `public/decks/<id>/` que navegan con `#N`; el campus los muestra en un iframe same-origin y les superpone la capa en vivo.

## Superficies (rutas)

- `/` — ingreso (elegir profesor/alumno) y redirección.
- `/profesor` — tablero: jornadas, decks, botón "Iniciar clase en vivo".
- `/live/[id]` — **proyector + consola del profesor**: slide a pantalla completa, overlay, botón de micrófono del agente (mantener apretado o tecla `M`), interruptor de transcripción, panel lateral ocultable con transcript, últimas acciones del agente, encuesta activa, sorteo.
- `/s/[code]` — **vista del alumno en vivo** (celular primero): sigue la slide actual (o navega libre), marcar slide (`no entendí`, `clave`, `pregunta`, `idea`), notas por slide con subrayado, responder la encuesta activa, preguntarle al tutor por esta slide, abrir el simulador lanzado.
- `/p/[pollId]` — destino del QR: responder la encuesta (con o sin login).
- `/profesor/decks/[id]` — editor del deck y de cada slide (markdown DSL + vista previa + **notas del docente**), insertar slides desde la biblioteca, agente de autoría ("tomá este ejemplo y dale continuación").
- `/profesor/biblioteca` — repositorio único de slides con búsqueda por texto, tipo, tag, autor y deck de origen.
- `/profesor/analitica/[deckId]` — entendimiento por slide: marcas, notas, respuestas a encuestas, lo dicho en la transcripción en esa slide, preguntas al tutor.
- `/profesor/casos` y `/profesor/casos/[id]` — casos con posturas, distribución, justificaciones.
- `/profesor/participacion` — randomizador con rondas (quién salió, quién no, reiniciar ronda), registro de participación por alumno y jornada.
- `/profesor/entregas/[id]` — entregas, asignación de revisión entre pares, rúbrica, notas.
- `/campus` — home del alumno: jornadas, decks (con sus notas), casos para tomar postura, entregas y revisiones pendientes, simuladores, tutor.
- `/campus/decks/[id]` — deck navegable fuera de clase, con marcas, notas y tutor.
- `/campus/casos/[id]` — leer el caso y tomar postura con justificación.
- `/campus/entregas/[id]` — entregar y revisar pares con rúbrica.
- `/campus/cohorte` y `/campus/perfil` — perfiles de la cohorte y el propio.
- `/campus/sims/[id]` — simulador con registro de eventos.
- `/api/mcp` — servidor MCP (HTTP streamable, JSON-RPC) con token Bearer de `api_tokens`; herramientas según rol.

## Agente en vivo

`POST /api/live/[id]/agent` `{utterance}` → Claude con herramientas → el servidor ejecuta cada herramienta contra la DB, emite `state`/`deck.changed`, guarda `agent_turns` y `live_events`, y devuelve `{reply, actions}`. El contexto del modelo incluye: deck (títulos por posición), slide actual completa con notas del docente, encuesta activa, casos de la jornada, padrón (nombres), últimos 2 minutos de transcripción. Respuesta corta; el profesor está dando clase. Herramientas mínimas: `goto_slide`, `create_poll` (abre y muestra QR), `show_poll_results`, `close_poll`, `insert_slide` (DSL), `edit_slide`, `pick_random_student`, `log_participation`, `show_case_postures`, `show_confusion`, `start_timer`, `show_qr`, `launch_simulator`, `clear_overlay`, `recall_transcript`.

Voz: Web Speech API (`webkitSpeechRecognition`, `es-AR`, continuo). Un único reconocedor: si la transcripción está encendida, todo se guarda en `transcript_segments` con la posición de slide; lo dicho con el botón apretado se marca `is_command` y va al agente. Interfaz `lib/voice/` con proveedor intercambiable para poder pasar a un STT de servidor más adelante.

Overlay (`live_sessions.overlay`), tipos: `poll` `{pollId, showResults}`, `qr` `{url, title}`, `student` `{personId, name, company, position, photoUrl}`, `postures` `{caseId}`, `confusion` `{position}`, `timer` `{endsAt, label}`, `sim` `{simId, url}`, `message` `{text}`.

## Contenido AI-Centric

- Fuente: `../mbt/data/presentations/ai-centric-j{1..8}.ts` (markdown, capítulos, fuentes, guía docente), `../mbt/data/course/*`, `../mbt/docs/ai-centric-outline-2026.md`, `../mbt/docs/ai-centric-material-review.md`, misiones y tutores en `../mbt/data/missions/`, `../mbt/data/tutor/`, sims en `../mbt/data/sims/` y `../mbt/app/campus/simuladores/`.
- Caso hilo ficticio: **Distribuidora Pampa Sur** (y Grupo Aconcagua, Conexa, Alimentos del Plata). Siempre etiquetado como ficticio.
- Cohorte demo: ~20 ejecutivos ficticios (`is_fictional = true`) con empresa, puesto, industria y bio verosímiles; los 3 profesores reales.
- Seeds en `scripts/seed/` (idempotentes, `npx tsx scripts/seed/<x>.ts`), contenido en `content/aicm/`.

## Reglas para quien construye

- Trabajás en paralelo con otros agentes sobre el mismo repo. **Tocá solo los archivos de tu feature** (lista en tu consigna). Si necesitás algo de `lib/` compartido que no existe, crealo dentro de tu carpeta (`lib/<feature>/`) en vez de editar el compartido, y anotalo en tu reporte.
- Para chequear tipos usá `npx tsc --noEmit -p .` y mirá solo los errores de tus archivos. No corras `next build` ni `next dev` en paralelo con otros (el integrador lo hace). Para probar lógica, scripts con `npx tsx`.
- No commitees. No despliegues.
