# Campus Austral

Campus virtual de IAE Business School (Universidad Austral). La primera materia cargada es **AI-Centric Management**: 8 jornadas presenciales de 18:30 a 22:00, martes y jueves del jueves 12/11 al jueves 10/12/2026, en DOT Baires (24 h de aula y 24 h de trabajo propio en la plataforma). J1 a J7 las dan Ignacio Berdiñas y Sebastián Buffo Sempé; J8, Alberto Willi.

Cada participante trabaja de forma individual sobre **su organización real** (su empresa, donde trabaja o un proyecto en marcha) y entrega un trabajo por bloque (B1 a B6). No hay casos ficticios: los casos para discutir son Harvard (Perplexity, Gamma, Harvey y Palantir). El stack del alumno es Claude Code, GitHub, Vercel y Supabase, el mismo con el que está hecho este campus.

Los decks de las 8 jornadas (v2) están armados en el estilo de los decks de Ignacio: slides `:::iae` con su HTML y su CSS, mezcladas con las interactivas del campus (encuesta con QR, posturas del caso, simulador).

El corazón del campus es la **clase en vivo**:

- El deck se proyecta desde el campus.
- El profesor le habla a un agente (Claude) con un botón de micrófono, y el agente cambia la presentación: abre encuestas con QR, sortea quién habla, muestra resultados o posturas, inserta slides.
- Los alumnos siguen la clase desde el celular, marcan slides, toman notas, responden encuestas y le preguntan al tutor.
- Todo queda guardado por slide, para ver después qué entendió la cohorte.

El contrato técnico está en `docs/SPEC.md` y `docs/CONTRACTS.md`. Hay capturas de las pantallas principales en `docs/shots/`, y de los decks v2 en el proyector, el celular y las páginas nuevas en `docs/shots/v2/` (más todas las slides de cada jornada en `docs/shots/v2/jN-all/`).

## Qué hay

| Superficie | Ruta | Qué hace |
| --- | --- | --- |
| Ingreso | `/` | El alumno elige su nombre del padrón y pone su PIN de 4 dígitos. La primera vez además escribe el **código inicial** que le da el profesor (`/profesor/alumnos`) y fija el PIN. 5 intentos fallidos bloquean con espera creciente. El profesor entra con email y código de acceso. |
| Alumnos y accesos | `/profesor/alumnos` | Quién ya fijó su PIN, el código inicial de cada alumno que todavía no entró y «Resetear PIN» (genera un código nuevo y cierra sus sesiones). |
| Tablero del profesor | `/profesor` | Muestra las 8 jornadas con «Iniciar clase en vivo» (o «Retomar»), docentes, deck, caso, entrega y actividades de cada una. |
| Proyector + consola | `/live/[id]` | La slide a pantalla completa con el overlay encima. Botón «Agente» (mantener apretado o tecla M), orden escrita, «Transcribir clase» y un panel lateral (tecla T) con código y QR, agente, encuesta, sorteo, notas del docente, transcripción y «Terminar clase». |
| Vista del alumno en vivo | `/s/[code]` | Pensada para el celular. Sigue al profe o navega libre, con marcas (no entendí, clave, pregunta, idea), nota por slide con subrayado, encuesta activa, overlay del profe y tutor. Con `?invitado=1` se puede seguir la clase y responder sin login. |
| Encuesta por QR | `/p/[pollId]` | Responder la encuesta con o sin login (el invitado deja su nombre). |
| Editor de decks | `/profesor/decks`, `/profesor/decks/[id]` | Slides en DSL con vista previa, notas del docente, reordenar, insertar desde la biblioteca, historial de revisiones y agente de autoría (Claude Opus). |
| Biblioteca | `/profesor/biblioteca` | Repositorio único de slides con búsqueda por texto, tipo, tag, autor y deck. |
| Analítica | `/profesor/analitica/[deckId]` | Por slide: marcas, notas, encuestas, transcripción y preguntas al tutor, con filtro por clase y un resumen con IA. |
| Transcripciones | `/profesor/transcripcion` | La transcripción de cada clase en orden, con la slide de cada fragmento, búsqueda por texto y descarga en .txt. |
| Casos | `/profesor/casos`, `/campus/casos/[id]` | El alumno toma postura con justificación y confianza. El profesor ve la distribución, las justificaciones y quién falta, y puede proyectar las posturas. |
| Participación | `/profesor/participacion` | Randomizador con rondas sin repetir, filtros por postura y por «no participó», registro manual, tabla de cohorte y CSV. |
| Entregas | `/profesor/entregas`, `/campus/entregas/[id]` | Entrega con rúbrica, asignación de revisión entre pares, nota docente, pre-evaluación con IA y CSV. |
| Simuladores | `/campus/sims`, `/profesor/sims` | 7 simuladores con registro de eventos: cotizacion, triage, hitl, adopcion, agrodecide, stockdecide y financesim. |
| Campus del alumno | `/campus`, `/campus/decks/[id]`, `/campus/cohorte`, `/campus/perfil` | Mi organización y B1 arriba, jornadas con docentes y actividades, decks con marcas, notas y tutor, cohorte y perfil propio. |
| Mi organización | `/campus/organizacion`, `/campus/organizacion/portfolio`, `GET/PUT /api/organizacion` | La organización real del alumno (procesos candidatos, datos, sistemas, links). Los pasos para verificar el entorno están en la entrega B1 (`/campus/entregas/aicm-b1-entorno#entorno`); los 6 entregables y su devolución, en el portfolio (imprimible). |
| Organizaciones | `/profesor/organizaciones`, `/profesor/organizaciones/[personId]` | Tabla de alumnos con organización, procesos, último chequeo de entorno y estado de B1 a B6; calendario de docentes por jornada; perfil, portfolio y devolución por entregable. |
| Actividades | `/campus/actividades`, `/campus/actividades/[id]`, `/profesor/actividades`, `/profesor/actividades/[id]`, `/api/actividades/[id]` | Las 10 actividades de clase (autopsia, seguí el request, galería, rompé la del otro, inventario, laboratorio de SQL en el navegador, KNN con la sala, clon del viernes, red team, directorio simulado), con parejas, cronómetro y tablero del profesor. |
| Office hours | `/campus/office-hours`, `/profesor/office-hours` | Turnos que publica el profesor; el alumno reserva con tema y el cupo se controla en la base. |
| Radar | `/campus/radar`, `/profesor/actividades/radar` | Hasta 3 noticias por semana; el alumno las ubica en HOY / 6 MESES / 3 AÑOS. |
| Materiales y conceptos | `/campus/materiales`, `/campus/conceptos` | Por jornada: los conceptos en dos líneas, con las slides del deck donde se ve cada uno (`/campus/decks/aicm-jN?s=<n>`) y links para leer más; y los materiales (docs, artículos, demos, herramientas) con fuente, tipo y por qué leerlos. Se cargan con `scripts/seed/conceptos-v2.ts` desde `content/aicm2/conceptos.json` (migración `0200_conceptos_v2`); el contenido v1 quedó en el curso legacy con ids `legacy-…`. |
| Conectá Claude (MCP) | `/profesor/tokens`, `/campus/tokens`, `POST /api/mcp` | Servidor MCP con token Bearer: 14 herramientas para el profesor (incluye `search_transcript` y `get_materials`) y 10 para el alumno (incluye `concept_map`, `hola_campus`, que verifica el entorno y marca B1 con evidencia, y `mi_organizacion`). |
| Deck HTML | `/decks/empresas-familiares/index.html` | El deck de Empresas Familiares (90 slides) también se puede dar en vivo con la capa del campus encima. |

## Cómo correrlo

```bash
source ~/.nvm/nvm.sh && nvm use 22        # Node 22
npm install
set -a; source .env.local; set +a         # para los scripts con tsx
npm run dev                               # http://localhost:3000
# o producción local:
npm run build && npm start
```

Variables de `.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`
- `SESSION_SECRET`, que firma la cookie de sesión.
- `PROFESSOR_ACCESS_CODE`, el código de ingreso del profesor.
- `ANTHROPIC_API_KEY`

Opcionales:

- `NEXT_PUBLIC_SITE_URL`: el dominio público (por ejemplo `https://campus-austral.vercel.app`). Si está, los QR y la URL de MCP lo usan en vez del origin del navegador, así un QR nunca apunta a `localhost` ni a una URL de preview. Se incrusta en el build.
- `EF_MEDIA_ORIGIN` (por defecto `https://empresas-familiares-ia.vercel.app`) y `EF_MEDIA_REMOTE=1`: de dónde salen los mp4 del deck de Empresas Familiares (ver «Desplegar en Vercel»).
- `TUTOR_DAILY_LIMIT` (por defecto 40 mensajes por alumno por día).
- `LIVE_AGENT_EFFORT` (por defecto `low`).
- `LIVE_AGENT_DEBUG` loguea el uso de tokens del agente.

Chequeos:

```bash
npx tsc --noEmit -p .
npx next build
npx tsx --test tests/assignments.test.ts    # 20 tests de asignación de pares y notas
```

Smoke test de punta a punta contra `next start` (usa la DB real y después se limpia):

```bash
npx next build && npx next start -p 3210
SMOKE_OUT=/tmp/smoke.json npx tsx scripts/test/smoke.ts     # clase en vivo de aicm-j7, agente, encuestas, MCP, páginas
npx tsx scripts/test/cleanup.ts /tmp/smoke.json
```

Chequeo visual de un deck v2 (PNG por slide y report.json con desbordes, imágenes rotas y HTML no permitido):

```bash
npx tsx scripts/render-check.ts --file content/aicm2/j3.ts --out /tmp/j3   # el archivo
npx tsx scripts/render-check.ts --deck aicm-j3 --out /tmp/j3               # lo que está en la DB
```

`scripts/test/shots-v2.ts` vuelve a sacar las capturas de `docs/shots/v2/` (abre una clase por jornada; después corré `cleanup.ts` con su archivo de estado).

### Base de datos y seeds

El esquema está en `supabase/migrations/`. Primero va `0001_campus.sql` y después las de cada feature: `0105_announcements`, `0110_authoring`, `0120_live`, `0137_assignments`, `0140_security` (RLS en todo, sin permisos para anon, canales Realtime de solo lectura, límites de intentos, sesiones revocables), `0141_live_consistency` (estado de la clase atómico con `seq`, marcas y notas por `slide_id`, locks del deck), `0142_draws`, `0150_session_teacher` (docentes por jornada), `0160_organizacion` (`organizations`, `organization_revisions`, `environment_checks` y `cases.is_active`) y `0170_actividades` (actividades, office hours con la función `oh_book` y radar). Se corren en orden, con psql y cortando al primer error:

```bash
for f in supabase/migrations/*.sql; do psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f" || break; done
```

Desde 0105 todas son idempotentes. `0001_campus.sql` se aplica una sola vez: si las tablas ya existen, un guard de psql (`\if`) la saltea. Por eso hay que correrla con psql y no en el SQL editor de Supabase.

Los seeds también son idempotentes, no pisan lo que se editó en la app y van en este orden (`npm run seed` corre todos menos `htmldeck.ts`):

```bash
npx tsx scripts/seed/base.ts         # curso, 8 jornadas, 3 profesores, 20 alumnos ficticios del padrón de prueba
npx tsx scripts/seed/htmldeck.ts     # deck HTML de Empresas Familiares (90 slides)
npx tsx scripts/seed/sims.ts         # 7 simuladores
npx tsx scripts/seed/decks-v2.ts     # las 8 jornadas v2 de content/aicm2/j1..j8.ts
npx tsx scripts/seed/entregables.ts  # los 6 entregables B1..B6 (y las entregas viejas a borrador)
npx tsx scripts/seed/casos-hbs.ts    # los 4 casos Harvard (y los ficticios al curso legacy)
```

`decks-v2.ts` (con `--dry` valida y muestra qué haría) hace esto por jornada:

- Valida el archivo: estructura, cada slide, que cada `:::postura` apunte a un caso activo del curso y cada `:::simulador` a un simulador que exista. Si algo falla, esa jornada no se toca.
- La primera vez, el deck actual pasa a **`aicm-jN-v1`** (curso `ai-centric-management-legacy`) con sus mismas slides y orden, y se le mueven las encuestas, marcas, notas, hilos del tutor y clases terminadas del deck viejo. No se borra nada.
- Carga las slides (id `uuidv5('slide:v2:<deck>:<i>')`, `kind` = `iae`, `encuesta`, `postura`…), las notas del docente, los capítulos del deck y una encuesta en borrador por cada `:::encuesta`. Una slide que el profesor editó en la app (`version > 1`) no se pisa.
- Fija el orden del deck. Si el profesor le agregó slides de otro origen, el orden no se toca (salvo `--force-order`), y nunca con una clase en vivo sobre el deck.
- Actualiza el título y el resumen de la jornada (fecha, 18:30 a 22:00, DOT Baires y la pregunta del deck).

`base.ts` ya no toca un deck que pasó a v2, ni el título o el resumen de una jornada que existe. `content.ts` (contenido v1, `content/aicm/`) quedó como legacy: se saltea las jornadas que ya son v2 (salvo `--legacy`) y `--remove` no corre sobre ellas.

Lo que quedó cargado en la base:

| Qué | Cantidad |
| --- | --- |
| Decks AICM v2 (`aicm-j1` … `aicm-j8`) | 8: 73, 53, 62, 56, 56, 53, 59 y 54 slides (466, de las que 419 son `iae`) |
| Decks anteriores (`aicm-jN-v1`, curso legacy) | 8, de 43 a 44 slides |
| Deck HTML | 1, de 90 slides |
| Encuestas en borrador de los decks v2 | 37 |
| Casos (Harvard, J5 a J8) | 4; los 8 de Pampa Sur siguen en el curso legacy, inactivos |
| Entregables | 6 abiertos (B1 a B6) y 8 entregas viejas en borrador |
| Conceptos y contenidos (de v1) | 64 y 81 |
| Simuladores | 7 |

## Cómo dar una clase en vivo

1. **Ingresá como profesor** en `/` con tu email y el código de acceso.
2. **En el tablero**, tocá **«Iniciar clase en vivo»** en la jornada. Se abre `/live/<id>` con un código de 6 letras. Usá Chrome o Edge (ver limitaciones).
3. **Conectá el proyector** y apretá **F** para pantalla completa. **T** muestra u oculta el panel lateral (ocultalo si el proyector duplica tu pantalla) y **H** oculta la barra inferior.
4. **Hacé que los alumnos entren.** Pedile al agente «mostrá el QR de la clase» o tocá **«QR de acceso»** en el panel. Desde el celular abren `/s/<código>`, ingresan con su nombre y PIN, o siguen como invitados. El primer día cada alumno necesita su código inicial: imprimí `/profesor/alumnos` antes de la clase (no la proyectes).
5. **Navegá** con ← → (o PageUp/PageDown de un presentador), con clic en la mitad derecha o izquierda de la slide, o pidiéndoselo al agente. Los celulares siguen la slide.
6. **Hablale al agente.** Mantené apretado **«Agente»** (o tocá **M** para abrir y cerrar el micrófono), decí la orden y soltá. También podés escribirla en la caja de al lado. Responde en 3 a 5 segundos con una línea corta y la acción ya hecha.
7. **Prendé «Transcribir clase»** si querés que lo que decís quede guardado por slide. Sirve para la analítica y para pedirle al agente «hacé una slide con lo que dijimos».
8. **En las slides `:::encuesta`** aparece el botón **«Abrir encuesta»** (o decí «abrí la encuesta de esta slide»). Se proyecta el QR y los resultados llegan en vivo.
9. **Al terminar, tocá «Terminar clase».** Se cierran las encuestas y la analítica del deck queda en `/profesor/analitica/<deck>`.

Las notas del docente de cada slide (visibles solo en el panel) traen los minutos, qué preguntar y las órdenes sugeridas para el agente.

### Órdenes de voz de ejemplo

Estas órdenes están probadas contra el agente real, con latencias de 2,8 a 4,7 s:

- «Armá una encuesta: ¿cuánto usan IA por semana? Nada, poco, mucho»
- «Abrí la encuesta de esta slide» / «Mostrá los resultados» / «Cerrá la encuesta»
- «Sorteá a alguien»
- «Sorteá a alguien que haya elegido flujos agénticos acotados en el caso Harvey»
- «Anotá que Mariana hizo un muy buen aporte»
- «Mostrá las posturas del caso»
- «Mostrá qué no se entendió en esta slide»
- «Insertá una slide después de esta con tres preguntas para el caso»
- «Volvé a la de la tabla de tres caminos»
- «Poné un timer de 10 minutos para el trabajo en grupos»
- «Lanzá el simulador cotizacion»: los alumnos lo abren desde el QR y sus corridas quedan atadas a la clase.
- «Sacá eso»: limpia la pantalla.

## Conectar Claude (MCP)

En `/profesor/tokens` o `/campus/tokens` se crea un token, que se muestra una sola vez. Después:

```bash
claude mcp add --transport http campus https://<host>/api/mcp --header "Authorization: Bearer cmp_…"
```

claude.ai no acepta headers, así que ahí se usa la URL con el token: `https://<host>/api/mcp/<token>`. Esa variante requiere un despliegue https público.

## Limitaciones conocidas

**Voz y transcripción**

- **La voz usa la Web Speech API**, que solo funciona en Chrome y Edge, y en desktop. Necesita `https` o `localhost` y permiso de micrófono. En Safari y Firefox no hay reconocimiento: quedan las órdenes escritas. El reconocimiento corre en los servidores de Google (es-AR).
- **La transcripción solo capta el micrófono del profesor**, no al aula. Lo que dicen los alumnos no queda transcripto.
- **Chrome reinicia el reconocimiento** cada ~60 s y después de silencios. Hay reinicio automático, pero se puede perder una frase en el corte.
- **Al apretar el botón (o M)** la frase que venía en curso se cierra y queda como transcripción, no como parte de la orden. Si el reconocedor tarda más de 1,5 s en cerrarla, todavía se puede pegar.

**Agente en vivo**

- Las órdenes simples tardan de 2,5 a 4,5 s. Las de dos pasos (buscar en la transcripción y después insertar) tardan de 5,5 a 6,5 s.
- `edit_slide` y las ediciones del editor cambian la slide en el repositorio único, así que el cambio aparece en todos los decks que la reutilizan.
- Insertar o reordenar slides (agente, editor, MCP) mantiene al proyector en la slide que se estaba dando, y las marcas y notas de los alumnos siguen a su slide (la clave es `slide_id`).
- Los QR externos que proyecta el agente (`show_qr`) solo pueden apuntar a rutas del campus o a dominios que el profesor dictó o que están en la slide actual. Lo que escriben alumnos e invitados en las encuestas le llega al modelo marcado como datos, no como instrucciones.

**Sorteo y participación**

- El sorteo usa todo el padrón: no hay lista de asistencia, así que si sale un ausente el profesor lo marca «Ausente» y vuelve a la ronda.
- La ronda es del curso, compartida entre clases. Se reinicia sola cuando salieron todos, salvo que el sorteo tenga filtro de postura.
- Los puntos de participación suman calidades, y un registro sin calidad cuenta 1. Es una regla provisoria para validar antes de usarla como nota.

**Deck HTML (Empresas Familiares)**

- Se navega y se le superpone la capa en vivo, pero no se pueden insertar ni editar slides desde el campus.
- Las notas del presentador están en el HTML público.
- `public/decks/empresas-familiares` pesa ~150 MB por los videos. En Vercel no se suben: se sirven desde el deploy del deck (ver «Desplegar en Vercel»).
- Mientras el foco está en el iframe del deck, las teclas no llegan a la consola. Hacé clic fuera del deck.

**Decks v2**

- Las slides `:::iae` se editan como HTML en el editor (no con el DSL). El agente en vivo puede insertar slides del DSL entre ellas, que se dibujan con la piel de Ignacio.
- Las slides `:::postura` y `:::simulador` muestran un recuadro de muestra fuera de clase; la distribución y el QR reales aparecen en vivo.
- Los materiales y conceptos (`/campus/materiales`, `/campus/conceptos`) son todavía los de v1: no acompañan a los decks nuevos y unos pocos mencionan Pampa Sur.
- Los simuladores `triage`, `hitl` y `adopcion` que usan J5, J7 y J8 tienen empresas ficticias (Grupo Aconcagua, Conexa, Alimentos del Plata).

**Alumnos y datos**

- El curso `empresas-familiares` no tiene padrón propio.
- Los puntajes de los simuladores React se calculan en el navegador.
- Las corridas que se cierran sin «terminar» quedan «en curso».
- Los broadcasts de Realtime van por canales **privados**: los navegadores (anon key) pueden escucharlos pero no emitir (política RLS de `realtime.messages`), así que nadie puede inyectar un overlay. El canal `live:<id>` que escuchan los celulares solo lleva el estado visible. La transcripción, las órdenes y respuestas del agente, los sorteos y los conteos y textos de las encuestas van por un canal del profesor, con un nombre firmado con `SESSION_SECRET`.
- Los invitados solo pueden responder encuestas mientras la clase está en vivo, con un tope por red y por encuesta, y no pueden usar el nombre de alguien del padrón.

**Infraestructura**

- El agente de autoría (Opus) tarda de 15 a 45 s por pedido y transmite los pasos por streaming. Corta solo a los 240 s y devuelve lo que alcanzó a proponer. La ruta tiene `maxDuration = 300`, que en Vercel Hobby exige Fluid compute.
- No hay OAuth para MCP: se usa token Bearer, o token en la URL para claude.ai, y la URL puede quedar en logs de proxies.

## Desplegar en Vercel

El proyecto queda listo para `vercel deploy`:

- **Fluid compute activado** (Project Settings → Functions): sin Fluid, Hobby tiene un máximo de 60 s y el build rechaza `maxDuration = 300` (autoría) y `120` (pre-evaluación con IA).
- **Región `gru1`** (São Paulo, `vercel.json`): la base está en sa-east-1 y el agente en vivo hace varias consultas seguidas por orden.
- **Node 22** (`engines: 22.x`).
- **Videos de Empresas Familiares**: los ~147 MB de mp4 no se suben (`.vercelignore`). Si no están en disco al hacer el build, `next.config.ts` redirige `/decks/empresas-familiares/media/*.mp4` a `https://empresas-familiares-ia.vercel.app/media/*`. En local se siguen sirviendo los archivos.
- **Variables** (Production, y Preview si se usa), cargadas **antes del primer build** porque las `NEXT_PUBLIC_*` se incrustan: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET`, `PROFESSOR_ACCESS_CODE`, `ANTHROPIC_API_KEY` y, recomendado, `NEXT_PUBLIC_SITE_URL` con el dominio de producción. `DATABASE_URL` no hace falta: solo la usan las migraciones y los seeds. Para producción conviene generar un `SESSION_SECRET` y un `PROFESSOR_ACCESS_CODE` nuevos. Cambiar `SESSION_SECRET` cierra todas las sesiones y cambia los códigos iniciales de los alumnos que todavía no entraron.
- La clase se da siempre desde el dominio de producción: las URLs de deployment y de preview piden login de Vercel.
- Headers: `X-Frame-Options: SAMEORIGIN` (el deck HTML y los simuladores van en iframes del mismo origen), `Permissions-Policy: microphone=(self)`, `Referrer-Policy` y `nosniff`.
- El plan Hobby es para uso personal y no comercial. Para la cohorte real de IAE conviene confirmar el plan o pasar a Pro.

## Estructura

```
app/            rutas (App Router) y APIs (app/api/*)
components/     deck (SlideView, DeckPlayer), live (consola, OverlayView), student, classroom,
                authoring, assignments, sims, tutor, htmldeck, shell
lib/            db, auth, realtime, claude, decks (parser DSL), live (estado de la clase),
                agent (agente en vivo), classroom (casos, sorteo, participación, analítica),
                authoring, assignments, sims, tutor, mcp, student, voice, htmldeck
content/aicm/   contenido de las 8 jornadas (notas, inserciones, caso, entrega, conceptos)
scripts/seed/   seeds idempotentes
supabase/       migraciones
public/decks/   decks HTML estáticos · public/sims/ simuladores HTML + campus-sdk.js
docs/           SPEC, CONTRACTS, shots/
```
