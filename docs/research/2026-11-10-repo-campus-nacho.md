# El repo de Nacho: Campus Austral

Fecha: 2026-11-10. Análisis del zip `campus-aicm`, que es lo que hoy está en `campus/`. Es la misma versión que la pestaña [Repo Mergeable de Nacho](https://docs.google.com/document/d/1vzCAqms9f6OHlAU2imse0ZOsw-SNLW2Ol5P_9auUWtk/edit?tab=t.jsz8o639788i) del Google Doc del equipo; si se edita una, hay que actualizar la otra.

Desde el [ADR 0004](../adr/0004-sistema-propio-con-puertos-y-adaptadores.md) no le mandamos código a Nacho, así que la sección 11 (checklist para ser mergeable) quedó como antecedente. El resto sigue sirviendo para leer su lógica y para conectarlo como sistema de origen.

Referencia única del repo «Campus Austral» (zip campus-aicm) para la hackathon, hecha por Claude el 10/11/2026 sobre el zip, el artifact «HackAI 2026 Product» y las pestañas de relevamiento de SIU, Campus y Moodle de este documento. Se hizo en dos pasadas en modo solo lectura (una general con 7 agentes y otra en profundidad con 8 lectores Opus por área), con verificación manual de los datos clave.

## 1. Resumen
- Qué es: el zip no es Moodle ni SIU. Es «Campus Austral», un campus propio en TypeScript (Next.js 15, React 19, Supabase/Postgres, CSS plano, API de Claude), armado para una sola materia del IAE: AI-Centric Management. Ser mergeable significa escribir en ese stack y con sus reglas, no hacer un plugin de Moodle.
- Lenguaje: Moodle y SIU Guaraní son PHP; el repo es TypeScript de punta a punta. Eso resuelve la preocupación de no entender lo que se codee en PHP.
- Qué cubre: muy bien la experiencia de clase (proyección en vivo, agente por voz, encuestas por QR, marcas por slide, analítica de comprensión), la evaluación con rúbrica y pares con detección de discordancias, el «qué hago ahora» en 0 clicks, tutor con IA, agente de autoría, actividades, 7 simuladores y un servidor MCP por rol.
- Qué no cubre: nada de gestión académica. No hay carreras, planes, períodos, comisiones, inscripciones, asistencia, correlativas, actas, historia académica ni trámites. Tampoco creación de trabajos y rúbricas desde la UI, adjuntos ni matriculación.
- Límites estructurales: un solo curso (constante COURSE_ID usada 141 veces en 37 archivos, people.course_id obligatorio y queries sin filtro de curso) y solo dos roles, profesor y alumno. Las notas se calculan al leer y nunca se guardan.
- Reglas de merge: docs/SPEC.md y docs/CONTRACTS.md piden no editar lib/ compartido, no alterar tablas existentes, una carpeta por feature, una migración nueva e idempotente, acceso a datos solo en el servidor y UI en voseo. La sección 11 las baja a un checklist.
- Zip incompleto: falta lib/content/server (el typecheck falla con 15 errores en 3 archivos) y los seeds no corren porque importan del repo hermano ../mbt y de contenido que no vino. Hay que pedirle a Nacho el repo completo o acceso a git antes de construir.
- Riesgos principales: código de profesor compartido que permite suplantar a otro profesor, sesión y throttle fail-open, score de simuladores enviado por el cliente sin validar, notas no persistidas con transiciones de estado libres y tokens MCP sin vencimiento.
- Recomendación: construir la feature como módulo nuevo y autocontenido (lib, components, rutas y una migración propia), tocando solo dos o tres archivos compartidos, con datos sintéticos. Las ideas que mejor encajan son avisos donde están los alumnos, resumen semanal con IA e inicio «Mi cuatrimestre». Acordar con Nacho el número de migración y cómo quiere recibir el código.

## 2. Qué se analizó y cómo
- Artifact «HackAI 2026 Product»: 23 slides del R&D Software Engineering Lab de Austral. Es el kickoff de producto de la hackathon; no describe el repo, fija las reglas del juego. Se leyó slide por slide.
- Zip campus-aicm: 441 archivos; unas 43.000 líneas de TypeScript/TSX, 18.000 de CSS y 1.300 de SQL. No trae historial de git.
- Primera pasada: 7 agentes en paralelo, uno por área (rutas en app/, componentes, lib compartida, módulos de feature, IA y tiempo real, migraciones, tooling/tests/docs).
- Segunda pasada: 8 lectores Opus en solo lectura, uno por área (núcleo y auth, modelo de datos, clase en vivo y decks, evaluación, alumno y aula, actividades y simuladores, IA y MCP, operación). Leyeron archivos y usaron grep.
- Verificación manual: cantidad de tablas, migraciones que alteran tablas, uso de untrusted(), simuladores registrados, imports faltantes y otros datos clave.
- Lo que se ejecutó: instalación de dependencias con Node 22 (sin scripts de instalación), typecheck y tests que no necesitan base.
  - Typecheck (tsc --noEmit): 15 errores, todos por @/lib/content/server, que importan app/campus/conceptos/page.tsx, components/conceptos/ConceptoParts.tsx y lib/jornadas.ts.
  - tests/learning.test.ts: 12 de 12. tests/assignments.test.ts: 20 de 20. tests/learning-flow.ts: 31 chequeos contra un PostgREST en memoria.
- Lo que no se ejecutó: next build, la app, las migraciones, los seeds y los tests contra base real. No hay credenciales ni base en el zip. El comportamiento en ejecución y los clicks salen de leer el código.
- SIU y Campus: se usa el relevamiento de este documento. El stack interno de SIU Guaraní es conocimiento general, marcado «a confirmar».

## 3. Qué pide la hackathon y cómo pega en el repo
| Lo que dice el artifact | Qué implica para este repo |
|---|---|
| Semana en tres pasos: objetivo (vie 06/11), pruebas con un ciclo por día (sáb 07 a jue 12), demo y pitch (vie 13) con 1-pager y changelog. | Quedan pocos ciclos. Conviene una feature acotada que se pueda mostrar corriendo, no una reescritura. |
| Se evalúa claridad del problema, resultado vs. output, iteraciones validadas, estrategia justificada, riesgos reducidos y calidad de la demo. | Elegir esta base hay que justificarlo con evidencia. Las secciones 4 y 7 dan los argumentos a favor y en contra. |
| Estrategia: desde cero, sobre Moodle y SIU Guaraní, o envolviendo lo que hay. Se evalúa que esté justificada, no cuál eligen. | Mergear al repo de Nacho es una cuarta variante: construir sobre una base nueva que ya existe. No reemplaza a Moodle ni al SIU; a lo sumo convive o los envuelve. |
| Extender antes que forkear. Spike el día 1: levantar la base lleva más de lo que creen. | Módulo propio en vez de editar lo compartido. El spike es urgente porque el zip no compila ni se puede sembrar tal como vino. |
| Nada de datos reales de alumnos; datos sintéticos realistas. | El repo ya trabaja así: padrón ficticio marcado is_fictional y seeds idempotentes. Seguir ese patrón para materias, inscripciones y notas. |
| Cumplimiento: CONEAU, registros que tienen que quedar (actas, historial, cambios), quién ve y modifica qué, datos personales mínimos. | Hay piezas útiles (revisiones, bitácora de turnos del agente, RLS cerrado) pero no hay actas inmutables, notas persistidas ni roles administrativos. |
| Escriban para un agente: spec con contexto, roles, reglas, criterios de aceptación y estrategia. | El repo ya está hecho así. docs/SPEC.md, docs/CONTRACTS.md y docs/POST-CLASS.md son specs para agentes; POST-CLASS es la plantilla a copiar. |
| Entender su sistema: código que nadie del equipo entiende es un riesgo. Ingeniería aporta criterio en datos, permisos, trazabilidad y revisión. | Argumento fuerte para TypeScript frente a PHP, y para respetar las reglas de auth y datos de la sección 11. |

## 4. Comparación técnica: Moodle, SIU Guaraní y el repo
| Aspecto | Campus Virtual (Moodle 5.1) | SIU Guaraní | Repo de Nacho (Campus Austral) |
|---|---|---|---|
| Lenguaje | PHP, monolito renderizado en servidor | PHP (a confirmar); el portal usa Bootstrap 2 y recarga por página | TypeScript estricto en todo: front, back, tests y seeds |
| Framework | Propio de Moodle, plantillas Mustache, JS AMD/ES6 | Frameworks propios del SIU (a confirmar) | Next.js 15 App Router, React 19, Server Components y Server Actions |
| Base de datos | Postgres/MySQL vía capa DML propia | PostgreSQL (a confirmar) | Supabase Postgres, 50 tablas, 18 migraciones SQL a mano, sin ORM |
| Estilos | Tema comercial Lambda 2 sobre Bootstrap | Bootstrap 2, bloquea el zoom en celular | CSS plano con tokens IAE, un .css por feature, sin Tailwind ni librería de UI |
| Login | Microsoft 365 (auth_oidc) o DNI | Usuario propio del SIU | Sin SSO: alumno con padrón y PIN de 4 dígitos (más código inicial); profesor con email y código compartido |
| Roles | Muchos y configurables | Perfiles (alumno, docente, gestión) | Solo profesor y alumno, fijos en el código |
| Varias materias | Sí, miles de cursos | Sí, propuestas, planes y comisiones | No: un curso fijo y una persona por curso |
| Cómo se extiende | Plugins (mod, block, local, enrol) | Personalizaciones de la instalación | Carpeta por feature en lib/, components/ y app/, más una migración |
| Código disponible | Core abierto (GPL v3); lo de la UA, no | No público; lo administra la universidad | Lo tenemos en el zip (incompleto, sin historial de git) |
| IA | Subsistema de IA sin proveedor conectado | No | Agente en vivo con 17 herramientas, tutor, agente de autoría y servidor MCP (14 herramientas de profesor, 10 de alumno) |
| Tiempo real y celular | Sin push; responsive con accesos escondidos | Diseño de escritorio | Supabase Realtime; la vista del alumno en vivo está pensada para celular |
| Calidad | Proyecto maduro | Proyecto maduro | Sin linter ni CI, tests solo de dos módulos, docs en parte desactualizadas |

Lectura: el repo gana en lenguaje, velocidad para construir con agentes e IA ya integrada. Pierde en modelo académico (no existe) y no reemplaza a los sistemas oficiales: lo que se construya ahí es un campus paralelo, salvo que lea datos de Moodle o del SIU.

## 5. Funcionalidades del repo
### Núcleo y acceso
- Ingreso de alumno. Quién: alumno. Ruta: / (app/page.tsx), server action loginAlumno. Cómo funciona: elige su nombre del padrón y escribe un PIN de 4 dígitos; en el primer ingreso o tras un reset también un código inicial de 6 caracteres, derivado por HMAC de SESSION_SECRET, la persona y session_version (no se guarda). El primer PIN se graba con un update condicionado a pin_hash null. Rate limit por IP (80 intentos cada 10 minutos) y throttle por persona (5 fallos libres, después backoff hasta 60 minutos). 2 o 3 campos y 1 click. Datos: people (pin_hash con scrypt, session_version) y las RPC security_* de 0140. Estado: completa. Archivos: app/actions/auth.ts, lib/session-token.ts, lib/security.ts, components/auth/LoginForms.tsx.
- Ingreso de profesor. Quién: profesor. Ruta: pestaña Profesor en /. Cómo funciona: email más PROFESSOR_ACCESS_CODE, un único código compartido en variable de entorno. Throttle por IP y tope global de 200 intentos por hora. Datos: people con role profesor. Estado: completa, pero cualquier profesor puede entrar como otro.
- Sesión y revocación. Quién: sistema. Ruta: todas. Cómo funciona: cookie campus_session (payload base64url más firma HMAC, httpOnly, 30 días). En cada request getSession compara session_version y rol contra people, así que se puede revocar. Si la base falla, deja pasar (fail-open). Invitados en encuestas usan la cookie campus_guest de 180 días. Datos: people. Estado: completa. Archivos: lib/auth.ts, lib/session-token.ts.
- Salir. Quién: los dos roles. Ruta: botón Salir (server action) y GET /salir. Cómo funciona: sube session_version (cierra en todos los dispositivos) y borra la cookie. Datos: people. Estado: completa; GET /salir tiene efecto lateral.
- Apertura del campus. Quién: sistema. Ruta: middleware sobre /campus/*. Cómo funciona: antes de CAMPUS_ABRE (por defecto 12/11/2026 18:30 -03) redirige a /campus/bienvenida, salvo bienvenida, organizacion, perfil y cohorte, comparadas como ruta exacta (sus subrutas quedan bloqueadas). El middleware no autentica; eso lo hacen los layouts con requirePerson(rol). Datos: ninguno. Estado: completa. Archivos: middleware.ts, lib/apertura.ts.
- Navegación. Quién: los dos roles. Ruta: lib/routes.ts. Cómo funciona: el alumno tiene Inicio, Mi organización, Entregas y Mi aprendizaje, 8 ítems en «Más» y Perfil y Tokens en el menú de usuario; el profesor tiene Inicio, Alumnos, Entregas, Devoluciones y Biblioteca, más 10 ítems en «Más». Datos: ninguno. Estado: completa. Archivos: components/shell/AppShell.tsx, components/shell/NavLinks.tsx.
- Home del alumno. Quién: alumno. Ruta: /campus. Cómo funciona: lib/inicio.ts elige la jornada en foco (la en vivo; si no, la de hoy o la próxima; si terminaron, la última) y carga avisos, office hours y radar. El «próximo paso» lo calcula nextStep() en lib/learning/core.ts con este orden: clase en vivo, entrega vencida, devolución sin leer, reflexión pendiente, preparar la próxima jornada e historial. Suma un checklist «Antes de ir» (organización, entorno B1, postura en el caso, entregas que vencen). Datos: varias tablas del curso. Estado: completa, con textos del curso en el código. Archivo: app/campus/page.tsx.
- Home del profesor. Quién: profesor. Ruta: /profesor. Cómo funciona: por entregable, cuántos entregaron y cuántos tienen corrección; lista alumnos atrasados (sin organización, sin entorno, con entregas vencidas o sin postura), encuestas en borrador y office hours. Datos: varias tablas. Estado: completa. Archivo: app/profesor/page.tsx.
- Bienvenida. Quién: los dos roles. Ruta: /campus/bienvenida y /profesor/bienvenida. Cómo funciona: componente estático con contenido del curso en el código. La del profesor no llama a requireSession. Datos: ninguno. Estado: completa.
- Jornadas. Quién: los dos roles. Ruta: /campus/jornadas/[n] y /profesor/jornadas/[n]. Cómo funciona: loadJornada junta deck, docentes, casos, actividades, entregas, conceptos, materiales, sims, office hours y radar; 1 o 2 clicks desde la home. Datos: class_sessions y relacionadas. Estado: no compila con el zip (lib/jornadas.ts importa lib/content/server).
- Instalador del alumno. Quién: alumno. Ruta: GET /setup y /setup.ps1, /api/setup/start, /api/setup/poll y /conectar?c=CODIGO. Cómo funciona: el alumno corre un curl a bash; el script instala Claude Code si falta, pide deviceCode y userCode, el alumno confirma en /conectar (1 click), el script hace poll, recibe un token MCP una sola vez, lo registra con claude mcp add y reporta git, node, gh, vercel y supabase. Con hola_campus queda entregado el B1. Datos: setup_pairings (0180), api_tokens, environment_checks. Estado: completa. Archivos: lib/setup/*, app/conectar/*.

### Clase en vivo y decks
- Proyección y consola del profesor. Quién: profesor y aula. Ruta: /live/[id] y /api/live/[id]/{state,goto,overlay,overlay-data,deck,settings,console,end}. Cómo funciona: navega slides y pone overlays (encuesta, posturas, confusión, timer, QR, mensaje, simulador). Cada cambio pasa por lib/live/session.ts, que actualiza live_sessions (position, overlay, seq), registra en live_events y emite «state»; los clientes descartan mensajes con seq viejo. Datos: live_sessions, live_events. Estado: completa. Archivos: lib/live/route.ts, components/live/LiveConsole.tsx.
- Agente de clase por voz. Quién: profesor. Ruta: POST /api/live/[id]/agent y /api/live/[id]/transcript. Cómo funciona: Web Speech API del navegador (solo bien en Chrome y Edge); mientras el profesor mantiene el botón, la orden va a Claude Sonnet 5.5 con 17 herramientas. Datos: agent_turns. Estado: completa. Archivos: lib/agent/*, lib/voice/*.
- Transcripción. Quién: profesor. Ruta: /profesor/transcripcion y /descargar. Cómo funciona: cada segmento se guarda con la slide del momento; si está apagada, solo se guardan las órdenes. Datos: transcript_segments. Estado: completa.
- Encuestas por QR. Quién: el profesor crea; responden alumnos o invitados. Ruta: /p/[pollId]. Cómo funciona: se crean con una slide :::encuesta (single, multiple, open, scale o wordcloud) o en el momento; abrir una cierra la anterior. El canal público recibe solo conteos; el del profesor, también textos. Tope de 2000 respuestas por conteo. Datos: polls, poll_responses (person_id o guest_key). Estado: completa. Archivo: lib/live/polls.ts.
- Vista del alumno en vivo. Quién: alumno o invitado. Ruta: /s y /s/[code]. Cómo funciona: sigue la slide por el canal público, la marca (no entendí, clave, pregunta, idea) y toma notas privadas o para la cohorte. QuickJoin muestra el padrón sin login. Datos: slide_marks, slide_notes. Estado: completa. Archivos: app/s/[code]/page.tsx, components/student/LiveStudent.tsx.
- DSL de slides. Quién: el profesor escribe; todos leen. Ruta: /decks/[id], /campus/decks/[id] y /ver/[token] (deck público). Cómo funciona: --- separa slides y :::tipo define el tipo (cifra, tiempo, versus, pasos, matriz, tabla, pregunta, encuesta, postura, simulador, qr, iae); límites de texto pensados para 1280x720. Datos: slides, decks. Estado: completa. Archivo: lib/decks/parse.ts.
- Editor de decks y biblioteca. Quién: profesor. Ruta: /profesor/decks, /profesor/decks/[id] y /profesor/biblioteca. Cómo funciona: guardar, mover, duplicar, insertar desde la biblioteca, asignar a jornada, publicar con public_token y subir media al bucket; cada edición deja una fila en slide_revisions. Datos: decks, deck_slides, slide_revisions, media_assets. Estado: completa. Archivos: app/profesor/decks/actions.ts, lib/authoring/*, lib/media/core.ts.
- Analítica por slide. Quién: profesor. Ruta: /profesor/analitica/[deckId]. Cómo funciona: cruza marcas, notas, encuestas, transcripción e hilos del tutor por slide y agrega un resumen con Claude (lib/classroom/summary.ts). Datos: tablas en vivo y tutor. Estado: completa.
- Decks HTML y rediseño. Quién: profesor. Ruta: /api/decks/empresas-familiares/redesign. Cómo funciona: un deck kind html se muestra en iframe; la ruta de rediseño sirve para un solo caso. Datos: decks. Estado: parcial; public/decks no vino en el zip.
- Materiales. Quién: alumno. Ruta: /campus/materiales. Cómo funciona: redirige a conceptos. Datos: ninguno. Estado: stub.

### Evaluación y aprendizaje
- Entregar un trabajo. Quién: alumno. Ruta: /campus/entregas y /campus/entregas/[id]. Cómo funciona: Entregas, trabajo, texto o link, guardar (3 clicks). Guardar ya es entregar; se edita hasta el vencimiento o hasta que cambie el estado. Sin adjuntos. Datos: upsert en submissions. Estado: completa. Archivo: lib/assignments/core.ts.
- Ciclo de estados del trabajo. Quién: profesor. Ruta: /profesor/entregas/[id]. Cómo funciona: 4 botones (borrador, abierta, revision-pares, cerrada) sin validar transiciones ni cierre automático por fecha. Datos: assignments. Estado: completa.
- Asignación de revisión entre pares. Quién: profesor. Ruta: /profesor/entregas/[id]. Cómo funciona: N revisores, semilla y modo (incremental o rehacer); mezcla determinística, nadie se revisa a sí mismo, carga pareja. Datos: peer_reviews, assignment_settings. Estado: completa. Archivo: lib/assignments/assign.ts.
- Revisión entre pares. Quién: alumno. Ruta: /campus/entregas/[id]#revisar. Cómo funciona: ve «Entrega A», «Entrega B», elige nivel por criterio y comenta con 60 caracteres o más; ve lo recibido cuando envió todas o cuando el trabajo se cierra. Datos: peer_reviews. Estado: completa.
- Revisión docente con rúbrica. Quién: profesor. Ruta: /profesor/entregas/[id]/revisar/[submissionId]. Cómo funciona: 3 clicks desde la home, con Anterior/Siguiente. Datos: peer_reviews con is_teacher=true. Estado: completa.
- Pre-evaluación con IA. Quién: profesor. Ruta: POST /api/assignments/[id]/ai-preview. Cómo funciona: Sonnet 5.5 con salida JSON schema (nivel sugerido y justificación por criterio). Datos: no se guarda. Estado: completa. Archivo: lib/assignments/ai.ts.
- Cálculo de nota. Quién: sistema. Ruta: lib/assignments/scoring.ts. Cómo funciona: 4 modos (docente-o-pares, media-pares, mediana-pares, mixta), detección de discordancias por umbral y conversión a la escala de la rúbrica (0 a 100). Se recalcula en cada lectura. Datos: nunca se persiste. Estado: completa.
- Export CSV. Quién: profesor. Ruta: GET /api/assignments/[id]/csv. Cómo funciona: un CSV por trabajo, separador ; y BOM UTF-8. Datos: submissions, peer_reviews. Estado: completa.
- Panel de entregas del profesor. Quién: profesor. Ruta: /profesor/entregas. Cómo funciona: estado, entregaron sobre total, revisiones y discordancias. No permite crear trabajos ni rúbricas: vienen del seed. Datos: assignments. Estado: completa para seguimiento, parcial para gestión.
- Reflexión post-clase. Quién: alumno. Ruta: /campus/aprendizaje. Cómo funciona: tres campos (idea que me llevo, duda, qué aplicaría) por jornada terminada, con control optimista por revision. Datos: session_reflections. Estado: completa.
- Devoluciones por jornada. Quién: profesor. Ruta: /profesor/devoluciones. Cómo funciona: ve la evidencia del alumno (reflexión y marcas «no entendí»), parte de una plantilla, guarda borrador y publica ya o programado; el alumno la marca leída y aplicada. Es distinta de la revisión con rúbrica por trabajo. Datos: session_feedback. Estado: completa, sin nota y sin IA.
- Tests. Quién: equipo. Ruta: tests/. Cómo funciona: assignments.test.ts (20 casos) y learning.test.ts (12), más flujos contra base real y contra fixture. Solo learning tiene script npm. Datos: ninguno. Estado: parcial.

### Alumno, organización y aula
- Casos con postura. Quién: el alumno vota; el profesor ve y proyecta. Ruta: /campus/casos/[id] y /profesor/casos/[id]. Cómo funciona: postura, justificación y confianza de 1 a 5, cambiable hasta el cierre; la distribución se proyecta en vivo. Datos: cases, case_postures. Estado: completa, no filtra is_active. Archivo: lib/classroom/cases.ts.
- Sorteo y participación. Quién: el profesor o el agente. Ruta: /profesor/participacion. Cómo funciona: sorteo con filtros (por postura o sin participación previa) y por rondas, con reintento ante choques; resultado participó, pasó o ausente. Si participó, fila en participation con calidad 1 a 3. También registro manual. No es asistencia. Datos: cold_call_rounds, cold_call_draws, participation. Estado: completa. Archivo: lib/classroom/participation.ts.
- Office hours con cupo. Quién: el profesor publica; el alumno reserva. Ruta: /profesor/office-hours y /campus/office-hours. Cómo funciona: hasta 12 franjas seguidas con cupo de 1 a 20; el alumno reserva con 1 click más un tema; la RPC oh_book bloquea con FOR UPDATE. Datos: office_hour_slots, office_hour_bookings. Estado: completa, sin notificaciones ni lista de espera. Archivo: lib/actividades/office-hours.ts.
- Cohorte y perfil. Quién: alumno. Ruta: /campus/cohorte y /campus/perfil. Cómo funciona: directorio interno y formulario de perfil. Datos: people. Estado: completa; no es un legajo.
- Radar semanal. Quién: el profesor publica hasta 3 noticias por semana; todos comentan. Ruta: /campus/radar y /profesor/actividades/radar. Cómo funciona: comentarios planos, sin respuestas ni privados, con rate limit de 30 cada 10 minutos. Datos: radar_items, radar_comments. Estado: completa.
- Tokens MCP. Quién: los dos roles. Ruta: /campus/tokens y /profesor/tokens. Cómo funciona: el token se muestra una vez y en la base queda su sha256; se revoca; la página da instrucciones para Claude Code y claude.ai. No expiran. Datos: api_tokens. Estado: completa.
- Padrón y accesos. Quién: profesor. Ruta: /profesor/alumnos. Cómo funciona: estado del PIN, código inicial en claro y reset de PIN (1 click). Sin alta, baja ni importación. Datos: people. Estado: parcial.
- Mi organización. Quién: el alumno edita; el profesor lee. Ruta: /campus/organizacion, /profesor/organizaciones y /api/organizacion. Cómo funciona: ficha de la empresa del alumno (procesos, datos, sistemas, links), con una revisión por guardado. No es un trámite. Datos: organizations, organization_revisions. Estado: completa.
- Portfolio de entregables. Quién: alumno. Ruta: /campus/organizacion/portfolio. Cómo funciona: recorre la lista fija ENTREGABLES (B1 a B6, ids aicm-*) con entrega, devolución y nota calculada. Datos: submissions, peer_reviews. Estado: completa, atada a esta materia.
- Conceptos. Quién: alumno. Ruta: /campus/conceptos. Cómo funciona: depende de lib/content, que falta. Datos: concepts, content_items. Estado: no compila con el zip.

### Actividades y simuladores
- Catálogo de actividades. Quién: alumno. Ruta: /campus/actividades y /campus/actividades/[id]. Cómo funciona: 10 actividades de las jornadas 2 a 8 definidas en lib/actividades/catalog.ts, no en la base; 2 clicks desde la home. Datos: activity_*. Estado: completa.
- Fichas individuales. Quién: alumno. Ruta: POST /api/actividades/[id] op entry.save. Cómo funciona: autopsia, request, galería, inventario y clon; upsert por actividad y persona. Datos: activity_entries. Estado: completa.
- Endpoint eco. Quién: alumno. Ruta: /api/actividades/eco. Cómo funciona: didáctico, para mirar requests en DevTools. Datos: ninguno. Estado: completa.
- Armado de parejas. Quién: profesor. Ruta: pairs.generate. Cómo funciona: makeGroups con PRNG que evita repetir parejas, grupos de 2 (uno de 3 si es impar), asignación en ronda. Datos: activity_state. Estado: completa y reutilizable.
- Rompé la del otro y Red team. Quién: alumno. Ruta: actividades. Cómo funciona: registros autor a destino (bug o ataque) y el destino responde; polling cada 6 s. Datos: activity_items. Estado: completa.
- Laboratorio de SQL. Quién: alumno. Ruta: actividad de J4. Cómo funciona: ocho ejercicios con sql.js en el navegador. Datos: local. Estado: sin verificar.
- KNN. Quién: alumno. Ruta: actividad de J5. Cómo funciona: tablero local. Datos: no guarda nada. Estado: completa.
- Cronómetro. Quién: profesor. Ruta: actividades. Cómo funciona: lo maneja el profesor y los alumnos lo ven por polling; donde no hay polling aparece al recargar. Datos: activity_state. Estado: completa.
- Directorio con votación. Quién: alumno. Ruta: actividad de J8. Cómo funciona: 5 roles rotativos, un voto por presentador (aprobar, con cambios, rechazar), sin votar la propia; resultados al cerrar; polling cada 4 s. Datos: activity_items. Estado: completa.
- Tablero del profesor por actividad. Quién: profesor. Ruta: /profesor/actividades/[id]. Cómo funciona: guía privada, controles y entradas por alumno; sin export ni nota. Datos: activity_*. Estado: completa.
- Motor de corridas de simuladores. Quién: sistema. Ruta: /api/sims/runs y /api/sims/[runId]/{events,state,complete}. Cómo funciona: eventos en lotes estilo xAPI, state con debounce, score y summary al completar; en vivo emite broadcast. Hay 7 simuladores registrados. Datos: sim_definitions, sim_runs, sim_events. Estado: completa, con score enviado por el cliente.
- Simuladores HTML. Quién: alumno. Ruta: iframe. Cómo funciona: agrodecide, stockdecide y financesim, integrados con public/sims/campus-sdk.js por postMessage. Datos: sim_runs. Estado: completa.
- Simuladores React. Quién: alumno. Ruta: /campus/sims. Cómo funciona: Cotización, Triage, HITL y Adopción; motores puros y deterministas, pero el score lo calcula el cliente. Datos: sim_runs. Estado: completa.
- Listado y vista de cohorte. Quién: los dos roles. Ruta: /campus/sims y /profesor/sims/[id]. Cómo funciona: promedio, mediana, histograma y distribución de decisiones; alimenta el overlay en vivo. Datos: sim_runs. Estado: completa.

### IA, MCP y avisos
- Tutor por slide. Quién: alumno. Ruta: /api/tutor, con TutorPanel en el estudio del deck o en vivo. Cómo funciona: 4 modos (socrático, sparring, examinador, coach), streaming con Sonnet 5.5, 40 mensajes por día. Datos: tutor_threads, tutor_messages. Estado: completa.
- Agente de autoría. Quién: profesor. Ruta: /api/authoring/agent, con AgentPanel en el editor. Cómo funciona: Opus 5.5 genera propuestas y el profesor acepta cada una con control de versión. Datos: slides, slide_revisions. Estado: completa.
- Servidor MCP. Quién: los dos roles. Ruta: /api/mcp y /api/mcp/[token]. Cómo funciona: JSON-RPC sin estado, 14 herramientas de profesor y 10 de alumno. Datos: agent_turns. Estado: completa.
- Avisos. Quién: el profesor publica; el alumno lee. Ruta: herramienta MCP post_announcement; se leen en la home del alumno (lib/inicio.ts:124) y en my_pending. Cómo funciona: no hay ABM web, página de avisos ni registro de leídos. Datos: announcements. Estado: parcial.

## 6. Recorridos del alumno y del profesor
Los clicks del repo se estimaron leyendo el código; las cifras de hoy salen del relevamiento.

### Alumno
| Tarea | Ruta en el repo | Clicks en el repo | Hoy (SIU / Campus) |
|---|---|---|---|
| Ingresar | / | Nombre, PIN y 1 click (más código inicial la primera vez) | Usuario y contraseña institucional; el repo no tiene SSO |
| Saber qué hacer ahora | /campus | 0: próximo paso y checklist en la home | Campus: Calendario a 1 click, nada en el inicio |
| Ver material de la clase | /campus/jornadas/[n] o /campus/decks/[id] | 1 a 2 | Campus: 3 clicks por archivo |
| Leer el último aviso | /campus | 0 | Campus: 3 clicks; SIU: 2 |
| Entregar un trabajo | Entregas, trabajo, guardar | 3, sin archivos | Campus: 5, con archivo |
| Ver nota o devolución | /campus/entregas/[id] o portfolio | 2 | Campus: 2 a 3 |
| Reservar office hours | Office hours, reservar | 1 a 2 | Sin equivalente |
| Votar postura en un caso | Casos, caso, enviar | 2 a 3 | Sin equivalente |
| Seguir la clase en vivo | QR o /s/[code] | 1 (escanear) | Sin equivalente |
| Escribir la reflexión | Mi aprendizaje | 1 más el formulario | Sin equivalente |
| Inscribirse a una materia o un final | No existe | - | SIU: 3 y unos 4 clicks |
| Ver faltas, historia o avance | No existe | - | SIU: 2 a 3 por pantalla, cruzando a mano |

### Profesor
| Tarea | Ruta en el repo | Clicks en el repo | Hoy |
|---|---|---|---|
| Ver quién está atrasado | /profesor | 0 | Moodle: informes del curso (no relevado en detalle) |
| Corregir una entrega | Entregas, Abrir, Revisar | 3, con IA opcional y Anterior/Siguiente | Tarea de Moodle (no relevado) |
| Asignar revisión entre pares | /profesor/entregas/[id] | 1 formulario | Similar al Taller de Moodle |
| Dar una clase en vivo | /live/[id] | Consola, o voz con el agente | Sin equivalente |
| Sortear y registrar participación | /profesor/participacion | 1 a 2 | Sin equivalente |
| Publicar un aviso | Solo por MCP | Fuera de la web | Campus: foro de Avisos |
| Resetear el acceso de un alumno | /profesor/alumnos | 1 | Lo resuelve sistemas |
| Cargar notas finales o un acta | No existe | - | SIU (bedelía) |

## 7. Cobertura frente a SIU y el Campus Virtual
| Necesidad | SIU | Campus Virtual | Campus Austral | Qué se reutiliza o falta |
|---|---|---|---|---|
| Alumno: saber qué hacer ahora | No | No (Calendario a 1 click) | Sí, próximo paso en la home, para un curso | nextStep() y my_pending |
| Alumno: materiales por clase | No | Sí, 3 clicks por archivo | Sí, jornadas y decks en 1 a 2 | Formato propio (DSL); /campus/materiales es stub |
| Alumno: entregar | No | Sí, 5 clicks con archivo | Sí, 3 clicks, solo texto o link | Sin adjuntos |
| Alumno: ver avisos | Mensajes en 2 clicks | 3 clicks | En la home, sin registro de leídos | Se publican solo por MCP; falta ABM y página |
| Alumno: ver notas | Historia y actuación | Calificaciones en 2 a 3 | Nota calculada por trabajo (0 a 100) | No persiste ni se cierra |
| Alumno: calendario y evaluaciones | Sí, sin conectar | Sí, sin conectar | Parcial: jornadas | class_sessions y lib/format.ts; sin parciales ni finales |
| Alumno: inscribirse a materias | Sí, 3 clicks | No | No | Patrón oh_book para cupo |
| Alumno: inscribirse a finales | Sí, unos 4 clicks | No | No | Sin mesas |
| Alumno: asistencia y faltas | Sí, 2 clicks | No | No | «ausente» solo existe como resultado de sorteo |
| Alumno: avance, correlativas, historia | Sí, cruzando a mano | No | No | Sin plan de estudios |
| Alumno: constancias y trámites | Sí, 4 clicks | No | No | Nada directo |
| Alumno: mensajería | Sí | Sí | No | Radar tiene comentarios planos, sin privados |
| Alumno: participar en clase | No | No | Sí, por QR y en vivo | Diferencial |
| Alumno: tutor IA | No | No | Sí, por slide, 40 por día | Diferencial |
| Alumno: simuladores y actividades | No | Actividades de Moodle | Sí, 7 simuladores y 10 actividades | Contenido de la materia |
| Alumno: reservar consulta | No | No | Sí, office hours con cupo | - |
| Docente: dar la clase | No | No | Proyector, consola y agente por voz | Diferencial |
| Docente: corregir con rúbrica | No | Tarea/Taller | Sí, con pares, discordancias e IA | Más completo que la Tarea |
| Docente: analítica de comprensión | No | Informes genéricos | Sí, por slide | Diferencial |
| Docente: crear trabajos y rúbricas | No | Sí | No, vienen del seed | Hueco |
| Docente: cargar el padrón | Automático | Matriculación | Solo seeds | Hueco |
| Gestión: actas y notas finales | Sí | No | No | Patrón borrador y publicación (session_feedback) y Proposal |
| Gestión: matriculación automática y rol «final pendiente» | No | No | No | Habría que crear enrollments |
| Gestión: varias materias y carreras | Sí | Sí | No (COURSE_ID fijo) | Límite estructural |
| Gestión: roles administrativos | Sí | Sí | No (2 roles) | Permisos en tabla aparte |
| Integración con asistentes IA externos | No | No | Sí, MCP por rol | Diferencial |

Conclusiones:
- Lo que hace mejor: la experiencia de clase (en vivo, voz, encuestas, marcas, analítica por slide), la evaluación entre pares con discordancias y el «qué hago ahora» en 0 clicks.
- Lo que no hace: nada de gestión académica.
- Frente a Moodle le faltan la autoría desde la UI (trabajos y rúbricas), los adjuntos y la matriculación.
- Para cubrir lo del SIU harían falta tablas nuevas (enrollments, períodos, attendance, notas o actas), un rol de staff aparte, sacar COURSE_ID de las queries y SSO.
- Es un campus de una materia, muy profundo; no una plataforma institucional.

## 8. Modelo de datos
18 migraciones SQL escritas a mano crean 50 tablas en public: 31 en 0001 y 19 en las demás. RLS activo sin políticas; todo el acceso pasa por service_role. 7 migraciones alteran tablas creadas antes: 0140, 0141, 0150, 0160, 0200, 0210 y 0230_public_decks.

| Tabla | Feature | Para qué | Relaciones clave |
|---|---|---|---|
| courses | Núcleo | Curso (slug) | Padre de casi todo |
| people | Núcleo | Padrón, perfil, rol, pin_hash, session_version | course_id NOT NULL (un curso por persona) |
| class_sessions | Núcleo | Jornadas (aicm-jN) | course_id; deck_id sin FK |
| class_session_teachers | Núcleo | Docentes por jornada | class_sessions y people |
| slides, slide_revisions | Contenido | Slides DSL e historial | slide_revisions a slides |
| decks, deck_slides | Contenido | Decks y orden | deck_slides a decks y slides |
| media_assets | Contenido | Registro del bucket público media | deck_id |
| live_sessions, live_events | En vivo | Estado de la clase y log | decks, class_sessions |
| transcript_segments, agent_turns | En vivo / IA | Transcripción y turnos de IA y MCP | live_sessions, people |
| polls, poll_responses | En vivo | Encuestas | person_id o guest_key |
| slide_marks, slide_notes | En vivo | Marcas y notas por slide | people, decks |
| cases, case_postures | Casos | Casos y posturas | class_sessions, people |
| cold_call_rounds, cold_call_draws | Aula | Sorteos | people |
| participation | Aula | Intervenciones con calidad | people, class_sessions |
| assignments, assignment_settings | Entregas | Trabajo, rúbrica y modo de nota | settings 1:1 |
| submissions, peer_reviews | Entregas | Entrega y revisiones (también la docente) | unique(assignment, person) |
| sim_definitions, sim_runs, sim_events | Simuladores | Corridas, score y eventos xAPI | people, live_sessions |
| tutor_threads, tutor_messages | Tutor | Hilos por slide y modo | people |
| concepts, content_items | Conceptos | Conceptos y materiales | class_sessions |
| api_tokens, setup_pairings, environment_checks | Auth y setup | Tokens MCP, emparejamiento, verificación de entorno | people |
| auth_throttle, rate_hits | Seguridad | Throttle y rate limit | Sin FK |
| organizations, organization_revisions | Organización | Ficha de la empresa y snapshots | unique(course, person) |
| activity_entries, activity_items, activity_state | Actividades | Fichas, registros y estado | activity_id text sin FK ni course_id |
| office_hour_slots, office_hour_bookings | Office hours | Franjas con cupo (oh_book) | people |
| radar_items, radar_comments | Radar | Noticias y comentarios | people |
| announcements | Avisos | Avisos del curso | class_sessions, people |
| session_reflections, session_feedback | Post-clase | Reflexión y devolución (borrador a publicado) | class_sessions, people |

### Qué falta para lo académico y cómo agregarlo
- Faltan: carrera, plan, materia, período o cuatrimestre, comisión, inscripción, nota persistida o acta, asistencia, mesas de examen, correlativas, registro de avisos leídos y mensajería.
- Cómo: una migración nueva numerada después de 0230, sin alterar tablas existentes, con el estilo de 0230_post_class.sql (begin/commit, enable RLS, revoke a anon y authenticated, grant a service_role).
- Tablas candidatas:
  - academic_periods.
  - enrollments: person_id a people, course_id a courses, period_id, condición y estado, con unique. Permite varios cursos por persona sin tocar people.course_id.
  - grades o actas: congelan el resultado de gradeSubmission con published_by y revision, como session_feedback.
  - attendance: class_session_id, person_id y estado, unique.
  - announcement_reads.
  - Permisos de staff en tabla aparte, en vez de ampliar el check de people.role.
- Funciones: enroll_book copiada de oh_book (FOR UPDATE) para inscribirse con cupo.

## 9. Acceso, seguridad y tiempo real
- Login: alumnos con padrón, PIN (scrypt) y código inicial HMAC en el primer ingreso; profesores con email y código compartido. Sin SSO; para sumarlo alcanza con una server action que termine en setSessionCookie.
- Sesión: cookie firmada con HMAC por 30 días, validada en cada request contra people.session_version (revocable). Fail-open si la base falla.
- Roles: solo alumno y profesor, como check en people.role. Sumar un rol obliga a tocar verifySessionToken, homeFor, los layouts, lib/routes.ts, lib/session-token.ts, lib/auth.ts y lib/db-types.ts.
- Protección de rutas: layouts y páginas llaman a requirePerson o requireSession; el middleware solo controla la apertura. Las APIs validan con getSession, withLive o apiSession (tres variantes de helper).
- RLS: activo sin políticas. 0140 revoca todo a anon y authenticated, también en privilegios por defecto. La autorización real está en el código, porque todo usa service_role.
- Realtime: broadcast de Supabase con dos canales.
  - Público live:ID: posición, overlay, conteos, marcas y posturas.
  - Profesor liveprof:ID:HMAC: transcripción, turnos del agente, sorteos y textos de encuestas.
  - La política de 0140 deja leer live:% y liveprof:% sin login: la protección del canal del profesor depende de que su nombre no se pueda adivinar. Notas e inscripciones no deberían viajar por realtime.
  - Las actividades no usan realtime: polling cada 4 a 6 s.
- Exposición: padrón sin login, códigos iniciales en claro en /profesor/alumnos y bucket media público. El detalle con archivos está en la sección 15.

## 10. IA en el repo
- SDK: @anthropic-ai/sdk directo, siempre claude().beta.messages con el beta server-side-fallback-2026-07-01. Sin Agent SDK ni LangChain.
- Modelos: MODEL_LIVE es claude-sonnet-5-5 (agente en vivo, tutor, resumen de analítica, pre-evaluación). MODEL_AUTHORING es claude-opus-5-5. Hay ids repetidos en lib/authoring/agent.ts:23 y lib/assignments/ai.ts:7. Haiku no se usa.
- Agente en vivo (lib/agent/*): hasta 6 vueltas en 25 s, effort low, system prompt cacheado. Contexto: deck, slide actual, encuesta, casos, padrón, simuladores y últimos 2 minutos de transcripción. Lo escrito por alumnos entra con untrusted(), que solo se usa en lib/agent/context.ts. Actúa sin pedir confirmación.
  - 17 herramientas: goto_slide, create_poll, open_slide_poll, show_poll_results, close_poll, insert_slide, edit_slide, pick_random_student, log_participation, show_case_postures, show_confusion, start_timer, show_qr, launch_simulator, show_message, clear_overlay, recall_transcript.
- Tutor (lib/tutor, app/api/tutor): streaming, 4 modos, últimos 20 mensajes como historial. Contexto: slide sin notas del docente, slides vecinas, perfil del alumno y sus notas y marcas, que entran sin untrusted(). Cupo de 40 por día, no atómico.
- Autoría (lib/authoring): Opus con thinking adaptativo, hasta 10 vueltas en 240 s, sin cupo. Herramientas: search_library, read_slide, propose_slides, insert_slides, edit_slide, set_teacher_notes; las tres últimas solo generan Proposal que el profesor aplica con control de versión.
- Llamadas sueltas: summarizeUnderstanding (resumen del deck), aiPreEvaluate (pre-evaluación sin persistir, sin untrusted()) y el rediseño de un caso (demo).
- MCP (lib/mcp): no llama a ningún modelo; el razonamiento lo pone el cliente. Cada llamada queda en agent_turns; ask_about_slide descuenta del cupo del tutor.
  - Profesor (14): list_sessions, get_deck, search_slides, create_slide_draft, insert_slide, set_teacher_notes, class_understanding, case_postures, participation_report, cold_call_plan, pending_reviews, post_announcement, search_transcript, get_materials.
  - Alumno (10): my_pending, get_class, my_notes, submit_posture, submit_assignment, get_case, ask_about_slide, concept_map, hola_campus, mi_organizacion.
- Consumo: no se registran los tokens usados.
- Reutilizable para nuestras ideas:
  - my_pending (lib/mcp/tools/alumno.ts:34) ya resuelve «qué tengo pendiente»: casos sin postura, entregas abiertas, revisiones, próxima jornada y últimos 5 avisos.
  - lib/classroom/summary.ts: una llamada, contexto armado como texto, salida markdown; base para un resumen semanal.
  - La ruta del tutor: chat con hilo, cupo y streaming.
  - El patrón Proposal: cualquier IA que escriba datos sensibles, como notas o actas.
  - Herramienta MCP nueva (por ejemplo mi_semana): se agrega a ALUMNO_TOOLS o PROFESOR_TOOLS y aparece sola en la página de tokens.

## 11. Checklist para que el código sea mergeable
Son las reglas de docs/SPEC.md y docs/CONTRACTS.md, más cinco recomendaciones nuestras que salen de los riesgos de la sección 15 y conviene confirmar con Nacho: seed propio, nada sensible por realtime ni en errores 500, untrusted() en todo prompt, cupo atómico y la excepción del middleware para rutas nuevas.
### Estilo e idioma
- Dos espacios, comillas simples, sin punto y coma, imports con @/ desde la raíz. No hay linter ni Prettier: se respeta a mano.
- UI, comentarios y errores en español rioplatense con voseo. Rutas de páginas en español (/campus/entregas). Identificadores y columnas en inglés; valores de dominio en español ('borrador', 'abierta').
- Sin dependencias nuevas: nada de Tailwind, librerías de UI, zod, ORM ni otro framework de tests.

### Estructura de una feature
- lib/nombre-feature/ con types.ts, core.ts (lógica pura, sin I/O), store.ts (server-only, usa db() y must()) y actions.ts ('use server'). Modelo a copiar: lib/learning.
- components/nombre-feature/ con su .css y prefijo de clase propio. 'use client' solo en la hoja interactiva y nunca dentro de app/.
- Páginas en app/campus/nombre-feature (alumno) y app/profesor/nombre-feature (docente); APIs en app/api/nombre-feature.
- Rutas en lib/nombre-feature/routes.ts y una sola línea en el menú de lib/routes.ts.
- Tests de la lógica pura en tests/nombre-feature.test.ts con node:test, con script en package.json.
- docs/NOMBRE-FEATURE.md con el formato de POST-CLASS.md: producto, arquitectura, archivos, fallos y rollback, verificación.

### Base de datos
- Una migración nueva después de 0230 (0230 ya está repetido); el número hay que acordarlo con Nacho.
- Idempotente (if not exists, create or replace), en transacción, con RLS activado sin políticas, revoke a anon y authenticated y grant a service_role en cada tabla y función. Plantilla: 0230_post_class.sql.
- No alterar tablas existentes, aunque el repo lo haya hecho. Si hace falta un dato extra, tabla aparte que referencie people(id) o courses(id).
- Operaciones con cupo o concurrencia en una función SQL con lock, como oh_book.
- Seed propio, idempotente, con datos ficticios marcados is_fictional y sin depender de ../mbt.

### Auth, datos y seguridad
- Cada página y cada action empieza con requireSession('alumno' | 'profesor'); el layout no alcanza. En las APIs, getSession() y respuesta JSON con la forma { error }.
- El id de la persona sale de la sesión, nunca del formulario. Datos solo en el servidor con service role; la clave nunca va al cliente.
- Filtrar siempre por curso y listar columnas explícitas en lo que lee el alumno (nunca pin_hash ni notas del docente).
- dynamic = 'force-dynamic' en lo que lee sesión.
- Nada sensible por el canal público de realtime. No devolver mensajes internos en errores 500.
- Si la ruta de alumno es nueva, sumarla a las excepciones del middleware o definir CAMPUS_ABRE.

### IA
- Usar claude() y las constantes de modelo de lib/claude.ts; maxDuration explícito en la ruta.
- Todo texto escrito por alumnos entra al prompt con untrusted() (lib/agent/context.ts), aunque el tutor y la pre-evaluación no lo hagan.
- Lo que escriba un agente es una propuesta que aprueba una persona (patrón Proposal). Para notas y actas es obligatorio.
- Herramienta MCP nueva: archivo propio en lib/mcp/tools/ y una línea en el array del rol.
- Poner cupo atómico si la feature llama al modelo por usuario.

### Antes de entregar
- Node 22, npm ci, npm run typecheck, npm run build, npm run test:learning, tests de assignments y los propios.
- Probar a 390 px de ancho y con teclado, como pide el repo.

## 12. Archivos compartidos donde va a haber conflictos
- lib/routes.ts: rutas y menús (PROFESOR_NAV, ALUMNO_NAV). Es el conflicto más probable.
- middleware.ts: hasta el 12/11 18:30 las rutas de /campus fuera de las 4 excepciones exactas redirigen a la bienvenida.
- Homes y su lógica: app/campus/page.tsx, app/profesor/page.tsx, lib/inicio.ts, lib/learning/core.ts y lib/jornadas.ts, si la feature quiere aparecer ahí.
- Número de migración, package.json (scripts de test), README y docs/CONTRACTS.md.
- Solo si se agrega un rol: lib/session-token.ts, lib/auth.ts, lib/db-types.ts y el check de people.role. Mejor evitarlo.

## 13. Límites del repo que condicionan la idea
- Un solo curso: COURSE_ID = 'ai-centric-management'. Además del curso, están fijos en el código el login, las jornadas (ids aicm-jN, lugar «DOT Baires», 210 minutos), la fecha de apertura, los ENTREGABLES y los docentes. Camino mergeable: tablas nuevas de inscripción (persona, materia, comisión, período, condición) que referencien people y courses, sin tocar lo existente.
- Dos roles: no hay bedelía ni administrativo. Camino mergeable: tabla de permisos y un requireStaff() propio montado sobre requireSession('profesor'), en vez de agregar un rol al núcleo.
- Sin modelo académico: todo lo que lista la sección 8 sería tabla nueva.
- Notas no persistidas: un acta necesita nota guardada, cierre y registro de quién cambió qué y cuándo, como pide el ejemplo de spec del artifact.
- Login y realtime: el PIN de 4 dígitos alcanza para una demo, no para datos académicos reales, y el canal realtime abierto (sección 9) no sirve para datos personales.

## 14. Cómo encajan las ideas del research
| Idea | Encaje | Costo |
|---|---|---|
| Avisos donde están los alumnos | Alto: la tabla y la lectura en la home existen; falta lo demás | Bajo a medio |
| Resumen semanal con IA | Alto: Claude integrado y summary.ts como modelo | Bajo a medio |
| Inicio «Mi cuatrimestre» para celular (materias actuales, próximas entregas, avisos sin leer) | Alto: existen nextStep y la home; falta que sea de varias materias | Medio |
| Inscripción a materias o finales con cupo | Medio: existe el patrón de cupo, no el modelo académico | Medio a alto |
| Cierre de actas | Medio: hay rúbricas, CSV y borrador/publicación; faltan acta inmutable y staff | Alto |
| Matriculación SIU a Moodle y rol «final pendiente» | Bajo: es un problema de Moodle; acá solo se simula con enrollments | Fuera de esta base |
| Arreglos de configuración de Moodle | Ninguno: sirven para el pitch | No aplica |

### Avisos donde están los alumnos
- Dónde se engancha: announcements ya existe y lib/inicio.ts ya lo lee.
- Qué se reutiliza: post_announcement y my_pending.
- Qué crear: /campus/avisos, ABM en /profesor/avisos, tabla announcement_reads y, si se quiere, herramienta MCP mis_avisos.

### Resumen semanal con IA
- Dónde se engancha: ruta o server component nuevo.
- Qué se reutiliza: patrón de lib/classroom/summary.ts (claude(), MODEL_LIVE, effort low, system cacheado) alimentado con la consulta de my_pending y los avisos; untrusted() para texto de alumnos.
- Qué crear: la ruta y, si se guarda el resumen, una tabla nueva.

### Inicio «Mi cuatrimestre»
- Dónde se engancha: app/campus/cuatrimestre/page.tsx con requirePerson('alumno'), un NavItem en lib/routes.ts y la ruta en ABIERTAS_ANTES de middleware.ts (o CAMPUS_ABRE).
- Qué se reutiliza: nextStep (extendiendo su entrada sin cambiar la prioridad), la consulta de my_pending y las funciones de lib/course.ts que ya reciben courseId.
- Qué crear: enrollments, academic_periods y un seed propio.

### Inscripción con cupo
- Dónde se engancha: páginas nuevas de alumno y de staff.
- Qué se reutiliza: oh_book (0170_actividades.sql) y app/campus/office-hours/actions.ts.
- Qué crear: tablas de oferta (con capacity) y de inscripción (unique), y enroll_book con FOR UPDATE.

### Cierre de actas
- Dónde se engancha: panel de staff nuevo sobre los trabajos.
- Qué se reutiliza: gradeSubmission y buildGradebook (lib/assignments/scoring.ts, core.ts), borrador a publicado de session_feedback y Proposal si interviene IA.
- Qué crear: tabla de actas o grade_snapshots que congele la nota y permisos de staff en tabla aparte.

## 15. Riesgos, deuda técnica y problemas del zip
### Alto
- Compilación: lib/jornadas.ts y la página de conceptos importan lib/content/server, que no vino.
- Seeds: npm run seed falla en scripts/seed/base.ts por el import de ../mbt; además faltan content/aicm/j*.ts, content/aicm2/j1..j8.ts y conceptos.json. Sin eso no hay curso, jornadas ni padrón.
- Contenido faltante: content/ trae solo los tipos; faltan public/decks, docs/shots e historial de git. content/hackai existe vacía, quizá reservada para la hackathon.
- Suplantación de profesor: el código compartido permite entrar como otro conociendo su email (app/actions/auth.ts).
- Notas: no se persisten; cambiar el modo o reabrir un trabajo altera notas ya comunicadas (lib/assignments/scoring.ts). Transiciones de estado libres (app/profesor/entregas/[id]/actions.ts).
- Simuladores: el score lo manda el cliente sin validar y una corrida se puede completar de nuevo (lib/sims/server.ts completeRun).
- Curso fijo: COURSE_ID constante y queries sin filtro de curso en case_postures, slide_marks, polls, live_sessions, activity_* y getCase (lib/db-node.ts, app/campus/page.tsx, lib/classroom/cases.ts).

### Medio
- Fail-open: sesión y throttle aceptan sesiones revocadas y pierden el bloqueo por PIN si la base cae (lib/auth.ts, lib/security.ts).
- Logout por GET: /salir con efecto lateral permite un CSRF de logout en el mismo sitio y cierra todos los dispositivos (app/salir/route.ts).
- Padrón expuesto: nombres y empresas sin login (app/page.tsx, app/s/[code]/page.tsx); PIN de 4 dígitos.
- Redirección abierta: el sanitizado de next en app/page.tsx no excluye /\ (safeNext en las actions sí).
- Migraciones: dos con número 0230, 0001 usa una guarda de psql que no corre en otras herramientas, y 7 alteran tablas existentes.
- Esquema divergente: radar_votes se borra en 0190 pero ninguna migración la crea.
- Bucket y realtime: bucket media público (0220_media.sql) y política de realtime abierta a anon (0140_security.sql).
- MCP: tokens sin vencimiento, token en la URL, CORS «*» y lotes sin tope (lib/mcp/server.ts).
- Cupo del tutor: no atómico y compartido con el MCP (lib/tutor/server.ts).
- Resumen de sims: GET /api/sims/summary exige sesión pero no rol profesor; devuelve agregados sin nombres (app/api/sims/summary/route.ts).
- Scripts de test: smoke.ts y cleanup.ts escriben y borran por ventana de tiempo en la base que apunte .env.local (scripts/test/*).
- Instalador: el fallback apunta a campus-austral.vercel.app (lib/setup/scripts.ts:18).
- IA sin control de gasto: no se registran tokens y la autoría con Opus no tiene cupo (lib/authoring/agent.ts).
- Errores 500: algunos devuelven el mensaje interno.
- Prompts: el tutor y la pre-evaluación no pasan el texto del alumno por untrusted().

### Bajo
- Casos: cases.is_active no se filtra (lib/classroom/cases.ts:12-26).
- Concurrencia: bumpSessionVersion y patchActivityState hacen read-modify-write sin lock (lib/auth.ts, lib/actividades/store.ts).
- Office hours: se puede cancelar una franja pasada, borrar franjas sin aviso y las inserciones no van en transacción (lib/actividades/office-hours.ts, app/profesor/office-hours/actions.ts).
- Participación: la deduplicación depende de un texto en note (lib/classroom/participation.ts:282).
- Rendimiento: N+1 en listAssignmentsWithStats y conteos de actividades en JS (lib/actividades/store.ts).
- Reglas propias rotas: ids de modelo fuera de lib/claude.ts, página sin requireSession (app/profesor/bienvenida), tres variantes de helpers de API, errores de base que se tragan. No es motivo para copiarlo: el código nuevo sigue la regla escrita.
- Operación: sin CI, sin linter, sin script npm para assignments.test.ts y sin .env.example. Hacen falta un Supabase propio, SESSION_SECRET, PROFESSOR_ACCESS_CODE y ANTHROPIC_API_KEY.
- Datos fijos: textos, fechas, lugar, 210 minutos y docentes en el código (lib/apertura.ts, lib/jornadas.ts, lib/learning/core.ts, lib/actividades/catalog.ts).
- Documentación desactualizada: SPEC dice que el curso va del 10/11 al 03/12 y el README del 12/11 al 10/12; SPEC pide migraciones 01NN y la serie llega a 0230; README y CONTRACTS describen mal los scripts npm, el orden de los seeds, la navegación y el horario. Si algo choca, manda el código.

## 16. Preguntas para Nacho
- ¿Qué significa «mergeable» para él: un PR a su repo, un módulo que integre después, o solo mismo stack y convenciones?
- ¿Puede pasar el repo completo o acceso a git? Faltan lib/content/server, ../mbt y el contenido para sembrar.
- ¿Qué número de migración usamos y quién más suma migraciones esta semana?
- ¿Hay un proyecto Supabase de prueba para la hackathon o cada equipo levanta el suyo?
- ¿La carpeta content/hackai es para nosotros? ¿Qué espera ahí?
- ¿Acepta tablas nuevas para varias materias y permisos administrativos, o prefiere todo dentro del curso único?
- ¿El esquema de producción coincide con las migraciones (radar_votes)?
- ¿Quiere que le reportemos los hallazgos de seguridad de la sección 15 aparte?

## 17. Próximos pasos
- Spike: conseguir el repo completo, levantar un Supabase propio, correr las migraciones y hacer andar la home del alumno con un seed sintético propio.
- Elegir un flujo de encaje alto (sección 14) y escribir su spec con el formato de POST-CLASS.md.
- Construirlo como módulo autocontenido siguiendo la sección 11.
- Para el pitch, decir qué es real y qué está simulado: los datos del SIU y de Moodle van a ser sintéticos.

## 18. Sin verificar
- Ejecución: que la app compile y corra con el repo completo; no se hicieron build, migraciones, seeds ni tests contra base real.
- Clicks y celular: se estimaron leyendo código y CSS, sin usar la UI.
- Realtime real: si la política RLS de la base exige usuario autenticado.
- Esquema de producción: si coincide con las migraciones (indicio en contra: radar_votes).
- UI puntual: si QuickJoin en /s/[code] pide PIN, si SummaryPanel usa el resumen con IA, el detalle de LiveConsole, LiveStudent, TutorPanel, AgentPanel, EntryTools, PairTools y Directorio, y si la UI expone el parámetro only en pairs.generate.
- Laboratorio SQL: cómo se carga sql.js y cómo valida.
- Instalador: la entrega del token en /api/setup/poll y el efecto exacto de hola_campus sobre B1.
- SIU: su stack interno en la Austral y si expone una API.
- Moodle docente: la comparación con la Tarea y el Taller no está en el relevamiento.
- Alcance: qué entiende Nacho por mergeable; el checklist asume que valen SPEC y CONTRACTS.
