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
| `reglas.yml` | En todos los PRs, también los de docs | `scripts/checks/reglas.sh`: las reglas duras de `AGENTS.md` que se ven en git. Un commit que toca `campus/` no toca nada más, no hay tablas `siu_*` ni `moodle_*` en `supabase/migrations/`, cada tabla activa RLS sin políticas, el núcleo (`lib/core/`) no importa adaptadores, `composition`, pantallas ni el cliente de la base, solo `lib/composition.ts` importa adaptadores (los tests y los scripts también pueden), un paquete nuevo viene con su ADR y no hay `.env` ni claves en el diff. Antes corre `reglas.test.sh`, que prueba cada regla. |
| `claude-review.yml` | Al abrir o reabrir un PR, al pasarlo de draft a listo, y en un push si el PR todavía no tiene la label `revisado-por-claude` | Review de Claude según [`docs/agents/review.md`](../docs/agents/review.md): contra la issue que cierra el PR, las reglas de `AGENTS.md` y los bugs, con un comentario en línea por hallazgo y un resumen. Corre una vez por PR. |
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

Sin secreto, los dos workflows de Claude avisan y terminan en verde.

Cuando la review termina bien, le pone al PR la label `revisado-por-claude`, y con eso los pushes siguientes no la vuelven a correr. GitHub no corre ningún workflow mientras un PR tiene conflictos con `main`: si se abrió así, la review llega en el primer push que los resuelve, y si falló, en el push siguiente. Para pedir otra review, sacale la label al PR y pusheá, o comentá `@claude`. `claude.yml` corre desde `main`: `@claude` empieza a responder cuando ese archivo está mergeado.

## Ingreso de demo

En `/` se entra eligiendo una persona sintética de la lista, alumno o docente, sin clave. La sesión queda en la cookie firmada `hackai_session` y lleva a `/hoy`, el inicio de los dos roles. Se sale con «Salir», que en el celular está en la hoja que abre el avatar. En producción se entra con la cuenta de Microsoft de la Austral: cambia el adaptador del puerto de identidad, no el núcleo.

Tomás Aguirre y Mariana Ledesma, las personas del guion, van primeras en la lista (`components/session/person-order.ts`). En la compu, arriba de la lista hay un QR para seguir en el celular; en el celular no aparece (se ve desde 768 px de ancho). Apunta siempre al deploy, https://campus-hackai.vercel.app/ (`DEPLOY_URL` en `components/session/sign-in-qr.ts`), también corriendo en local, porque el celular no abre `localhost`. Se genera en el servidor con `qrcode` (ADR 0008).

Para abrir sesiones hace falta `SESSION_SECRET` en el entorno. Sin esa variable la lista se ve, pero al elegir una persona el ingreso avisa que falta.

El ingreso de demo queda abierto a propósito. La identidad en memoria es el único adaptador que hay, y el que se usa si falta `HACKAI_IDENTITY`: cualquiera que llegue a `/` entra como cualquier persona de la lista, también en el deploy público. Para la demo alcanza, porque todos los datos son sintéticos. Antes de cargar datos reales tiene que estar el adaptador de Microsoft.

La cookie va marcada `Secure` solo si el pedido llegó por HTTPS, y eso se sabe por el header `x-forwarded-proto`. Si el hosting no lo manda, la cookie sale sin `Secure` y no avisa. La sesión no se guarda en el servidor: «Salir» borra la cookie, pero una copia de la cookie sigue valiendo hasta que vence, a los 30 días.

## Datos y fecha de la demo

Todo sale del set sintético, `lib/adapters/synthetic-data.ts`. Sus fechas son absolutas. Sin configurar, el reloj queda fijo en su «hoy», el martes 10/11 a las 12, que es lo que usan los tests. **La demo va con `HACKAI_CLOCK=sistema`**, como trae `.env.example`: así Hoy muestra la fecha del día y la cuenta regresiva al próximo parcial es la real.

El set está pensado para el ensayo del jueves 12/11 y la demo del viernes 13/11, y `tests/synthetic-data.test.ts` lo verifica para esos dos días. El alumno de la demo es Tomás Aguirre:

- tiene el segundo parcial de Análisis Matemático I el lunes 16/11;
- Física I de verano tiene la inscripción abierta, con la comisión de la mañana sin cupo y la de la tarde con lugar;
- a la mesa de diciembre de Sistemas de Representación, que desaprobó en febrero, le queda un solo lugar;
- Análisis Matemático I y Programación I tienen avisos, material y tareas con fecha en Moodle;
- tiene dos notas nuevas en la campana y en Novedades: el TP integrador de Programación I (historia académica, cargado el 9/11) y el primer parcial de Análisis Matemático I (actuación provisoria, cargado el 10/11). Tocar una lleva a Notas y deja de contarlas en ese navegador (cookie `hackai_notas_vistas`); para volver a verlas, borrá la cookie o entrá desde otro navegador.

Los enlaces a Moodle y a la Autogestión del SIU («Ir al aula», el material, las constancias, «Seguir en la Autogestión») no salen de HackAI: van a `/simulado/<moodle|siu>/<ruta del sistema real>` (`app/simulado/`), una página que dice que el sistema está simulado y qué abriría el enlace en producción. No pide sesión ni lee datos.

Si cambiás el set, corré `npm run siu:seed`, `npm run moodle:seed` y `npm run people:seed` y commiteá los SQL: un test avisa si alguno quedó viejo.

## Vínculos de Personas en Supabase

Personas guarda el id de cada persona en cada sistema (la identidad, el SIU, Moodle y Discord). Sin configurar, esos vínculos salen del set sintético y viven en memoria. Con `HACKAI_STORE=supabase` se leen de la tabla propia `people_accounts`.

| Archivo | Qué hace |
| --- | --- |
| `supabase/migrations/0001_people.sql` | Crea `people_accounts`. Es una tabla propia de HackAI: va también en producción. Idempotente, en una transacción, con RLS activado sin políticas y sin acceso para `anon` ni `authenticated`. |
| `supabase/simulados/people_seed.sql` | Carga los vínculos de las personas sintéticas. Es solo de la demo, por eso va con lo simulado y no se aplica en producción. Idempotente: borra los vínculos de esas personas con la identidad, el SIU y Moodle y los carga de nuevo. Los de Discord no los pisa: si una persona ya tiene uno, por ejemplo el real de quien la usa en la demo, lo deja, y el del set entra solo si no tiene ninguno. Se genera con `npm run people:seed` desde `lib/adapters/synthetic-data.ts`; no se edita a mano. |

Se cargan en el Supabase del equipo con `npm run demo:preparar` («Base de la demo»).

Si cambiás las personas de `synthetic-data.ts`, corré `npm run people:seed` y commiteá el SQL: un test avisa si quedó viejo.

La batería de contrato del almacén (`tests/contracts/people-store.test.ts`) corre siempre contra el de memoria y contra el de Supabase con un PostgREST de mentira, sin red. Contra una base de verdad corre solo con `HACKAI_TEST_SUPABASE_URL` y `HACKAI_TEST_SUPABASE_SERVICE_ROLE_KEY`, de una base de prueba con las dos SQL aplicadas.

## Espacio de la materia

En `/materias/<materia>` está el espacio de cada materia, para alumnos y docentes: arriba, una pestaña por canal con sus no leídos (`#avisos` y `#consultas` de cada comisión, el material de toda la materia, los canales que crea el docente y Directos). La pestaña elegida va en `?canal=` y el hilo de una consulta en `?hilo=`. En compu son tres columnas: canales, conversación y el material reciente con los docentes de la comisión. Quién ve y quién escribe lo decide Espacios (`lib/core/spaces/`), no la pantalla: la membresía sale de las comisiones que da Cursada, sin tabla de miembros.

Los mensajes directos son solo entre un alumno y un docente de su comisión. La pestaña Directos (`?vista=directos`) junta las conversaciones privadas de la persona y «Escribirle» a cada contacto que da Espacios (`viewer.directContacts`): para el alumno, los docentes de su comisión; el docente responde lo que le escriben. En compu, el mismo botón está junto a cada docente del panel de la derecha. Escribirle abre el canal directo, o el que ya hay, con `openDirect`: hay uno por par y por espacio, y lo ven solo esas dos personas. Lo que no leyeron cuenta como novedad, igual que en cualquier canal.

Al abrir el espacio se trae lo nuevo de Moodle (`lib/core/spaces/classroom-import.ts`): los avisos del foro de Avisos de cada curso llegan a `#avisos` de su comisión y los recursos de los cursos de todas las comisiones vigentes de la materia (las de la oferta de Cursada), al material, en la sección de su tema. Quedan con origen Moodle, como enlaces al aula (no se copian a Archivos), y no entran dos veces. Si Moodle no responde, el espacio abre igual y lo trae en la próxima apertura. Con el reloj del sistema (`HACKAI_CLOCK=sistema`), `open` no vuelve a Moodle antes de 10 segundos por espacio; con el reloj fijo la hora no avanza, así que trae en cada apertura.

El espacio y sus canales se crean la primera vez que alguien los abre. Sin configurar, todo vive en memoria mientras dure el proceso: al reiniciar `npm run dev` se pierden los mensajes. El sistema se arma una vez por proceso (`system()` en `lib/composition.ts`) y sobrevive a la recarga en caliente: si cambiás algo de `lib/`, reiniciá `npm run dev` para verlo. Con `HACKAI_STORE=supabase` se guarda en tablas propias, y con `HACKAI_FILES=supabase` el material y los adjuntos van a un bucket privado de Supabase Storage.

| Archivo | Qué hace |
| --- | --- |
| `supabase/migrations/0002_spaces.sql` | Crea `spaces`, `space_channels`, `space_messages`, `space_material` y `space_reads`, y la función `space_mark_read`, que marca leído sin retroceder. Tablas propias de HackAI: van también en producción. Idempotente, en una transacción, con RLS activado sin políticas y sin acceso para `anon` ni `authenticated`. |
| `supabase/migrations/0003_files.sql` | Crea el bucket privado `hackai-files`, de hasta 10 MB por archivo. Sin políticas: solo lo toca el servidor con el service role. |
| `supabase/migrations/0004_spaces_sync.sql` | Suma a `space_channels` el cursor de lectura del canal externo vinculado (`external_cursor`). Idempotente. |
| `supabase/migrations/0005_spaces_external_server.sql` | Suma a `spaces` el servidor del canal externo con que lo conectó un docente (`external_system`, `external_server_id`), para «Conectar con Discord» (`docs/discord.md`). Idempotente. |

Se aplican con `npm run demo:preparar`, que además vacía lo que dejaron los ensayos («Base de la demo»).

Los archivos se abren por `/archivos/<id>/<nombre>` (`app/archivos/[id]/[name]/route.ts`); qué responde, en `lib/file-delivery.ts`, con sus tests en `tests/file-delivery.test.ts`:

- **Sin sesión** lleva al ingreso con `?next=<ruta del archivo>`, y al entrar vuelve al archivo. `lib/return-to.ts` deja volver solo a rutas de la app, nunca a otro sitio.
- **Con sesión** le pide el archivo a Espacios, que chequea que la persona vea el espacio del material o el canal del adjunto. Si no lo ve, o el archivo no existe, muestra la misma página corta («Este archivo no está disponible», 404), así no se sabe si existe. Si el almacenamiento no responde, otra página propone probar de nuevo (502).
- **Se muestran** PDF, imágenes y texto plano; el resto se descarga, con el nombre original aunque tenga tildes. PDF e imágenes van sin CSP, porque los abre el visor del navegador y una CSP cerrada se lo arruina (en Chrome, la imagen pierde los estilos del visor). Todo lo demás va con `default-src 'none'; sandbox`, que no deja correr nada. Todo va con `nosniff`.
- **Caché:** cada archivo lleva su id como `ETag` y `Cache-Control: private, no-cache`. El navegador lo guarda y, al volver a abrirlo, pregunta: si la persona lo sigue viendo recibe un 304 sin cuerpo, no el archivo entero. Como cada pregunta pasa por la sesión y por Espacios, después de «Salir» la copia guardada no se vuelve a mostrar. El 304 le ahorra la bajada al navegador, no al servidor: `file` de Espacios igual trae los bytes de Storage en cada pregunta.

Las baterías de contrato del almacén (`tests/contracts/spaces-store.test.ts`) y de Archivos (`tests/contracts/files.test.ts`) corren siempre contra memoria y contra Supabase con un PostgREST o un Storage de mentira, sin red, y contra una base de prueba solo con `HACKAI_TEST_SUPABASE_URL` y `HACKAI_TEST_SUPABASE_SERVICE_ROLE_KEY`.

## SIU simulado

Con `HACKAI_SIU=simulado`, el puerto del SIU lee y escribe las tablas `siu_*` de Supabase en vez de la copia en memoria. Esas tablas copian la forma de la API REST v2 de Guaraní y son solo de la demo: en producción el SIU es la API real. Las inasistencias (`siu_absences`) y el máximo de faltas por comisión (`siu_absence_limits`, una hipótesis: pregunta 22 de `docs/product/preguntas-abiertas.md`) se suman con `npm run demo:preparar`; mientras la base no las tenga, Inasistencias sale sin faltas.

Por eso sus migraciones y su seed van **aparte** de las propias, en `supabase/simulados/`, y no en `supabase/migrations/`: en producción no se aplican y se pueden tirar sin tocar nada de HackAI.

| Archivo | Qué hace |
| --- | --- |
| `supabase/simulados/0001_siu.sql` | Crea las tablas `siu_*`. Idempotente, en una transacción, con RLS activado sin políticas y sin acceso para `anon` ni `authenticated`. Sobre una base ya creada, agrega lo que falte (por ejemplo, las columnas de las evaluaciones de la historia del issue #14). |
| `supabase/simulados/siu_seed.sql` | Carga el set sintético. Idempotente: pisa cada fila por su clave y borra las inscripciones hechas durante la demo y las notas que el set ya no tiene. Se genera con `npm run siu:seed` desde `lib/adapters/synthetic-data.ts`, la misma fuente que el SIU en memoria; no se edita a mano. |

Se cargan en el Supabase del equipo con `npm run demo:preparar` («Base de la demo»).

Si cambiás `synthetic-data.ts`, corré `npm run siu:seed` y commiteá el SQL: un test avisa si quedó viejo. Si cambia `0001_siu.sql` o el seed, volvé a correr `npm run demo:preparar`.

La batería de contrato del SIU (`tests/contracts/siu.test.ts`) corre siempre contra el SIU en memoria. Contra el simulado corre solo si definís `HACKAI_TEST_SUPABASE_URL` y `HACKAI_TEST_SUPABASE_SERVICE_ROLE_KEY`, de una base de prueba con las dos SQL aplicadas; si no, la saltea y lo dice.

Los tests que arman un cliente de Supabase (el SIU y el Moodle simulados, y `composition` con `HACKAI_SIU=simulado` o `HACKAI_CLASSROOM=simulado`) necesitan Node 22: con Node 20, supabase-js falla por no tener `WebSocket` nativo.

## Moodle simulado

Con `HACKAI_CLASSROOM=simulado`, el puerto del aula virtual lee y escribe las tablas `moodle_*` de Supabase en vez de la copia en memoria. Esas tablas copian la forma de los Web Services de Moodle ([research](../docs/research/2026-11-10-moodle-web-services.md)): cursos de una persona, matrículas, foro de avisos, contenidos del curso y tareas con fecha. Son solo de la demo, y van aparte de las propias igual que las del SIU.

| Archivo | Qué hace |
| --- | --- |
| `supabase/simulados/0002_moodle.sql` | Crea las tablas `moodle_*`. Idempotente, en una transacción, con RLS activado sin políticas y sin acceso para `anon` ni `authenticated`. En el encabezado figura qué campos de la API quedan afuera. |
| `supabase/simulados/moodle_seed.sql` | Carga cursos, matrículas, avisos, contenidos y tareas del set sintético. Idempotente: pisa cada fila por su clave y borra las matrículas hechas durante la demo. Se genera con `npm run moodle:seed` desde `lib/adapters/synthetic-data.ts`, la misma fuente que el aula en memoria; no se edita a mano. |

Se cargan en el Supabase del equipo con `npm run demo:preparar` («Base de la demo»).

Los dos adaptadores arman el enlace al aula con `courseUrl(courseId)`: `<base>/course/view.php?id=<id>`, con la base de `data.moodle.baseUrl` en el set sintético. En la demo esa base es `/simulado/moodle`, la página de lo simulado («Datos y fecha de la demo»). Si cambiás `synthetic-data.ts`, corré `npm run moodle:seed` y commiteá el SQL: un test avisa si quedó viejo.

La batería de contrato del aula virtual (`tests/contracts/classroom.test.ts`) corre siempre contra el aula en memoria. Contra el simulado corre solo si definís `HACKAI_TEST_SUPABASE_URL` y `HACKAI_TEST_SUPABASE_SERVICE_ROLE_KEY`, de una base de prueba con las dos SQL aplicadas; si no, la saltea y lo dice. Cada caso que matricula deja las matrículas como estaban, así se puede repetir.

## Base de la demo

Tres comandos dejan lista la base del Supabase del equipo para la demo y dicen si está bien armada. Toman las variables de `hackai/.env.local`. Antes de cada demo o ensayo, en este orden:

```bash
npm run demo:preparar                          # deja la base como nueva; pide confirmación
npm run demo:verificar                         # solo lectura: ¿está lista?
npm run demo:probar                            # con la app levantada: entra como alumno y como docente (http://localhost:3000)
npm run demo:probar -- https://<dominio>       # lo mismo contra el deploy
```

**Preparar** (`scripts/demo-preparar.ts`; qué hace: `lib/demo-base/prepare.ts`) aplica con `psql`, en este orden:

1. Las migraciones propias, `supabase/migrations/*.sql`.
2. Las tablas de los sistemas simulados, `supabase/simulados/0*.sql`.
3. `supabase/simulados/demo_reset.sql`, que vacía los espacios, los canales, los mensajes, el material y lo leído de los ensayos. Los espacios y sus canales por defecto se vuelven a crear al abrir cada materia, con lo de Moodle.
4. Los seeds del set sintético, `supabase/simulados/*_seed.sql`.

Después borra todos los archivos del bucket `hackai-files` por la API de Storage, porque Storage no deja borrarlos por SQL. Todo es idempotente: correrlo dos veces deja lo mismo. Un SQL nuevo en `supabase/migrations/` o en `supabase/simulados/` entra solo; uno en `supabase/simulados/` que no sea tabla (`0001_*.sql`), seed (`*_seed.sql`) ni el vaciado frena el comando hasta que se le encuentre lugar.

Antes de tocar nada, se fija dos cosas:

- **Que la base sea la de la demo.** `HACKAI_DEMO_SUPABASE_REF` tiene que ser el ref del proyecto de Supabase de la demo (el subdominio de `https://<ref>.supabase.co`), y `NEXT_PUBLIC_SUPABASE_URL` y `DATABASE_URL`, directa o por el pooler, tienen que apuntar a ese proyecto. Si no, se niega y no toca nada: así un `.env.local` que apunta a otra base no la vacía.
- **Que quien lo corre confirme**, escribiendo «preparar». Para correrlo sin terminal: `npm run demo:preparar -- --si`.

Necesita `psql`, el cliente de PostgreSQL (con Homebrew, `brew install postgresql@17`), y las variables `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL` y `HACKAI_DEMO_SUPABASE_REF`. Los mensajes nombran archivos y variables, nunca sus valores.

Qué se conserva: los vínculos de Discord de las personas de la demo, porque `people_seed.sql` no los pisa. Qué no: los vínculos de los canales de un espacio con canales de Discord viven en `space_channels` y se borran con los espacios, así que se vuelven a vincular después de preparar (#15).

**Verificar** (`scripts/demo-verificar.ts`; qué revisa: `lib/demo-base/verify.ts`) no escribe nada. Marca cada chequeo con ✓, ! (aviso) o ✗, y sale con 1 si alguno falla:

- Las variables que necesita la app, por nombre.
- Que el sistema arme con los adaptadores elegidos, cuáles son, y que lea la lista de demo y las comisiones de un alumno. Avisa qué puertos están en memoria y no usan la base.
- Las tablas y las funciones de los SQL de `supabase/migrations/` y `supabase/simulados/`: una migración nueva entra sola. Las funciones se prueban con un `rpc` por GET, que PostgREST corre en una transacción de solo lectura.
- El bucket `hackai-files`: que exista, que sea privado y que su tope sea el que declara Archivos.
- Los seeds: las personas, comisiones y mesas del SIU, los cursos de Moodle y los vínculos de Personas del set sintético.

**Probar** (`scripts/demo-probar.ts`; qué pide: `lib/demo-base/screens.ts`) firma una sesión de alumna (`p-lbenitez`) y otra de docente (`p-gferreyra`), que no son las del guion porque abrir un espacio marca leído el canal que se abre, con el `SESSION_SECRET` de `.env.local` y pide Hoy, Novedades, Mis materias, el espacio de una materia, el Calendario y, al alumno, Inscripciones, Notas, Estado de la carrera y Trámites. Cada pantalla tiene que responder 200, sin redirigir al ingreso y sin mostrar un aviso de error (`ErrorNotice`). Contra el deploy, el `SESSION_SECRET` de `.env.local` tiene que ser el del deploy. Las pantallas están en `DEMO_SCREENS`: una pantalla nueva se suma ahí. Correla después de preparar la base: Lucía Benítez está en las mismas comisiones que Tomás Aguirre, así que la prueba le deja a él los espacios de Análisis I y Programación I armados, con lo de Moodle sin leer. Sin ese paso, la campana y Novedades de Tomás arrancan vacías hasta que alguien de su comisión abre la materia.

Además, `/api/health` deja de responder ok si el sistema no se puede armar («Con Docker»).

## Con Docker

Necesita Docker Engine 25 o más nuevo y Docker Compose 2.24 o más nuevo (`docker compose version`). Qué hace cada etapa del build está en los comentarios del [Dockerfile](Dockerfile).

```bash
cd hackai
docker compose up --build                 # http://localhost:3000
docker build --target check -t hackai .   # typecheck y tests dentro del contenedor
```

Las variables se leen de `.env.local` al arrancar el contenedor, nunca se copian a la imagen (`.dockerignore` excluye `.env*`). Sin `.env.local`, arranca con los adaptadores en memoria, pero no se puede entrar: el ingreso necesita `SESSION_SECRET`.

`GET /api/health` responde `{ "status": "ok" }` si el sistema se arma con los adaptadores que piden las variables, sin tocar la base. Si no se puede armar, por ejemplo por un adaptador desconocido o una variable que falta, responde 503 con `{ "status": "error", "reason": "configuracion" }`, y el log del servidor nombra la variable (`lib/health.ts`). Sin variables arma todo en memoria y responde ok. El `HEALTHCHECK` de la imagen lo consulta, y `docker compose ps` muestra el estado (`healthy` o `unhealthy`).

## App instalable

HackAI se instala en el celular como una app: abre desde su ícono, a pantalla completa y sin la barra del navegador. Necesita HTTPS, así que se prueba en el deploy, no en `localhost` desde el celular.

- **Manifest** (`app/manifest.ts`): nombre, colores, `start_url` en `/hoy` y los íconos de `public/icons/`. Los metadatos de iOS (`appleWebApp`, `apple-touch-icon`) están en `app/layout.tsx`.
- **Botón «Instalar»** (`components/shell/install-button.tsx`): en Android abre el aviso del navegador; en el iPhone, una hoja con los pasos para «Agregar a inicio».
- **Service worker** (`public/sw.js`, escrito a mano y sin dependencias): sin red, cualquier pantalla muestra `/sin-conexion`, que se recarga sola cuando vuelve la conexión. Lo estático (`/_next/static`, íconos, ilustraciones, logo) se sirve de la caché. El HTML de las pantallas y `/api` van siempre a la red: son datos de una persona con sesión. `components/shell/service-worker.tsx` lo registra solo en producción, así que para probarlo en la compu va `npm run build && npm start`. Si cambia lo que guarda, se sube `VERSION` en `sw.js`.

Para ver la pantalla sin conexión: en Chrome, DevTools → Application → Service workers → «Offline», y recargá cualquier pantalla.

## Deploy en Vercel

La demo corre en Vercel con el plan Hobby. Vercel compila Next.js por su cuenta; `output: 'standalone'` queda para Docker y Vercel lo ignora.

1. **Importar el repo** en Vercel (Add New → Project → `ignaciogaspar/campus-hackai`) con **Root Directory `hackai`**. El framework (Next.js) y Node 22 (`engines` de `package.json`) los detecta solo.
2. **Cargar las variables** en Settings → Environment Variables, para Production y Preview:

   | Variable | Valor para la demo |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Los del proyecto de Supabase de la demo |
   | `SESSION_SECRET` | El mismo que en tu `.env.local`, para poder correr `demo:probar` contra el deploy |
   | `CRON_SECRET` | Cualquier secreto largo; Vercel lo manda solo al llamar al cron |
   | `HACKAI_STORE`, `HACKAI_FILES` | `supabase` |
   | `HACKAI_SIU`, `HACKAI_CLASSROOM` | `simulado` |
   | `HACKAI_CLOCK` | `sistema` |
   | `HACKAI_EXTERNAL_CHANNEL`, `DISCORD_BOT_TOKEN` | `discord` y el token del bot, si la demo muestra Discord |
   | `HACKAI_CAIDAS` | `si` solo si se muestra la caída (ver abajo) |
   | `HACKAI_CACHE_SEGUNDOS` | Vacía (300) en la demo; `0` si se va a editar el seed o las notas en vivo |

   `DATABASE_URL`, `HACKAI_DEMO_SUPABASE_REF` y las `HACKAI_TEST_*` no van: son de los scripts y de los tests, que corren en tu máquina.
3. **Desplegar desde GitHub.** En el proyecto de Vercel, Settings → Git, conectar `ignaciogaspar/campus-hackai` y dejar **Root Directory `hackai`**. Vercel crea previews para los PRs y despliega producción automáticamente cada vez que llega un push a `main`; no hace falta guardar tokens de Vercel en GitHub Actions.
4. **Preparar la base** desde tu máquina con `npm run demo:preparar` («Base de la demo»), desplegar y probar con `npm run demo:probar -- https://<dominio>`.
5. **Región.** Las funciones corren por defecto en Washington (`iad1`). Si la base de Supabase está en otra región, conviene elegir la más cercana en Settings → Functions → Function Region (por ejemplo `gru1`, São Paulo, para `sa-east-1`): cada pantalla hace varias consultas y la distancia se suma en cada una.

`vercel.json` trae el cron diario de la sincronización («Corrida periódica»).

**Lo que cambia en Vercel.** Cada pedido puede caer en una instancia distinta del servidor, y ninguna guarda nada entre pedidos:

- **Nada en memoria.** Con los adaptadores en memoria, una inscripción, un mensaje o un archivo subido aparecen en una pantalla y desaparecen en la siguiente. Por eso la tabla de arriba pone todo en Supabase.
- **El interruptor de `/caidas` vive en la memoria del proceso** (`lib/adapters/caida/`): tirar el SIU puede no verse en la pantalla siguiente si la atiende otra instancia. Para mostrar la caída, ensayala antes en el deploy, o mostrala desde `npm run dev` o Docker, donde hay un solo proceso.
- **Pedidos de hasta 4,5 MB.** Vercel corta con un 413 cualquier pedido más grande antes de que llegue a la app, así que el material de más de 4,5 MB no se puede subir aunque la app acepte hasta 10 MB (`bodySizeLimit` en `next.config.ts`). En la demo, subí archivos más livianos.

## Corrida periódica

Los espacios se sincronizan con sus canales externos aunque nadie los abra: un cron del hosting pide `/api/cron/sync`, que llama a `syncAll` de Espacios. La ruta acepta `GET` y `POST`, y solo deja pasar el pedido que trae `Authorization: Bearer <valor de CRON_SECRET>`. Compara el secreto en tiempo constante, y ni el secreto ni lo que trajo el pedido van a la respuesta o al log. El log de cada corrida lleva solo el resultado y los números del resumen.

| Responde | Cuándo |
| --- | --- |
| 200 con el resumen: `channels`, `imported`, `sent`, `pending` | Sincronizó. Un canal externo caído no corta la corrida: sus mensajes quedan pendientes (`pending`) y se reintentan en la siguiente |
| 401 `no-autorizado` | El pedido no trae el secreto o trae otro |
| 502 `falla-externa` | El almacén de Espacios no respondió |
| 503 `sin-configurar` | Falta `CRON_SECRET` en el entorno: la ruta queda cerrada para todos |

Para probarla a mano, con el servidor andando y `CRON_SECRET` en `.env.local`:

```bash
curl -i -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/sync
```

**Con Vercel Cron.** `vercel.json` ya trae el cron: pide `/api/cron/sync` todos los días a las 9 UTC (las 6 en Argentina). Cargá `CRON_SECRET` en las variables del proyecto, en Production: Vercel la manda sola en el header `Authorization` al llamar al cron.

Según la [documentación de Vercel](https://vercel.com/docs/cron-jobs/usage-and-pricing), consultada el 11/11/2026, el cron corre solo en el deployment de producción, y en el plan Hobby corre una vez por día como mucho, en algún momento de la hora indicada. Una expresión más frecuente, como `*/5 * * * *`, hace fallar el deploy en Hobby. Con el plan Pro se puede cambiar por esa; si no, un cron de afuera (abajo) puede pedirla más seguido.

**Con otro hosting o con Docker.** Sirve cualquier cron que pida la ruta con el header, por ejemplo una línea de crontab en una máquina que tenga `CRON_SECRET` en su entorno:

```text
*/5 * * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://<dominio>/api/cron/sync
```

## Rendimiento de la demo

En Vercel, confirmá en Settings → Functions que Fluid compute esté activo. Antes de presentar,
corré `npm run demo:probar -- https://campus-hackai.vercel.app` con el `SESSION_SECRET`
del deploy en `.env.local` para abrir las pantallas del alumno y del docente.

Para contar consultas a Supabase en las pantallas de solo lectura del issue #91, compilá con
`npm run build` y levantá el servidor local con los adaptadores de la demo:

```bash
node --import ./scripts/medir-consultas.mjs node_modules/next/dist/bin/next start > /tmp/hackai-consultas.log 2>&1
```

En otra terminal, sin otro tráfico al servidor:

```bash
node --env-file-if-exists=.env.local --import tsx scripts/medir-pantallas.ts /tmp/hackai-consultas.log
```

La salida muestra ruta, total de consultas, lecturas de `siu_persons` y `space_reads`,
tiempo total y estado. Para medir cada pantalla en frío, reiniciá el servidor antes de cada ruta
y pasala como tercer argumento después del log y la URL local.

## Si el SIU o Moodle no responden

Todas las lecturas de Cursada toleran caídas, también la oferta (`offer`) y las constancias (`certificate`). El SIU y el Moodle simulados cortan cada consulta a los 5 segundos (`lib/adapters/supabase/query.ts`) y devuelven `falla-externa`. Entonces Cursada devuelve lo último que leyó para esa persona, con su hora en `readAt` y `stale: true`, y Hoy, Calendario, Mis materias, Inscripciones, Notas, Estado de la carrera y Trámites lo muestran con el aviso de `components/ui/stale-banner.tsx`: «actualizado hace 20 min» y la hora. El «hace…» se cuenta con el reloj de la app (`system().now()`), el mismo que marcó la lectura, así que también tiene sentido con el reloj fijo. Si no había nada leído antes, la pantalla muestra el error solo en la parte que falló. Lo que pasó, las inscripciones que cerraron y si una comisión ya abrió su inscripción se miran contra el reloj al armar la pantalla, aunque la lectura sea vieja.

Lo mismo pasa con los datos de la persona (`get` de Personas): con el SIU caído, el saludo y la tarjeta de Hoy, el perfil y la facultad del encabezado salen de la última vez que se leyeron.

Si se cae solo Moodle, las materias no usan lo último leído: salen al día del SIU, sin enlaces al aula ni tareas, y Mis materias avisa qué falta (`classroomUnavailable`). Esa lectura incompleta no pisa la última completa: si después se cae el SIU, vuelven los enlaces al aula y las tareas. Los parciales y finales (`upcoming`) salen solo del SIU, así que Hoy y el Calendario los muestran igual y avisan que faltan las entregas.

Inscribirse o darse de baja con el SIU caído no toca nada: Cursada lee el SIU antes de matricular en Moodle, y la pantalla lo dice: en una comisión, «El SIU o el Campus Virtual no respondieron, así que no te inscribimos en nada»; en una mesa, «El SIU no respondió, así que no te inscribimos».

Lo último leído vive en la memoria del proceso. Si el hosting levanta un proceso nuevo, por ejemplo una función serverless fría, la copia se pierde y la primera lectura con el sistema caído devuelve el error.

## Mostrar una caída en la demo

En la encuesta aparecen créditos perdidos porque el SIU se cayó. Para mostrar que HackAI sigue andando, quien presenta tira el SIU o Moodle desde `/caidas` y recorre las pantallas.

**Activarlo.** Con `HACKAI_CAIDAS=si` en `.env.local` (o en las variables del hosting), `lib/composition.ts` envuelve al SIU y al aula, sean los de memoria o los simulados, con los adaptadores de `lib/adapters/caida/`: mientras un sistema está «caído», cada consulta devuelve `falla-externa`, como un sistema real que no responde. El núcleo no se entera de que es una simulación. Reiniciá `npm run dev` después de cambiar la variable. Sin la variable, o con `no`, el interruptor no existe y `/caidas` responde 404: es lo de producción, y lo que trae `.env.example`.

**La página `/caidas`** pide sesión y tiene un botón por sistema, «Tirar» y «Levantar», con lo que pasa en cada caso y accesos a las pantallas para mostrar. Abrila en otra pestaña antes de empezar. El estado vive en la memoria del proceso: vale para todos los que usen esa instancia y se levanta solo al reiniciar.

**Guion**, con Tomás Aguirre («Datos y fecha de la demo»):

1. **Antes de tirar nada, recorré las pantallas con todo andando:** Hoy, Mis materias, Inscripciones (abrí Física I de verano), Notas y Trámites. HackAI guarda lo que lee de cada una; una pantalla que no se abrió antes no tiene qué mostrar y, con el SIU caído, muestra el error en su parte.
2. **En `/caidas`, «Tirar SIU Guaraní».** Volvé a Hoy: el aviso amarillo dice que el SIU no responde y desde cuándo es lo que se ve («actualizado hace 3 min»), y el próximo parcial (Análisis Matemático I, el lunes 16/11) sigue ahí. Lo mismo en Mis materias, Notas y Trámites.
3. **En Inscripciones, la oferta de Física I sigue visible.** Intentá inscribirte en la comisión de la tarde: HackAI dice «El SIU o el Campus Virtual no respondieron, así que no te inscribimos en nada». No queda nada a medias, ni en el SIU ni en el aula. En el SIU de hoy, ese es el momento en que se pierde el lugar o los créditos.
4. **«Levantar SIU Guaraní»** y recargá: el aviso desaparece y todo está al día.
5. **«Tirar Campus Virtual (Moodle)».** Mis materias muestra las materias igual, porque vienen del SIU, sin «Ir al aula» ni tareas y con un aviso de qué falta. Hoy avisa que faltan las entregas, pero los parciales y finales están todos.
6. **Levantá Moodle** antes de seguir con el resto de la demo.

Si algo se ve raro, reiniciar el proceso deja los dos sistemas levantados. La espera de 5 segundos de un sistema lento no se simula: la caída responde enseguida, para no frenar la demo.

## Variables de entorno

Van en `hackai/.env.local`, que no se versiona. `.env.example` las lista sin valores.

| Variable | Para qué |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Proyecto Supabase del equipo. |
| `SUPABASE_SERVICE_ROLE_KEY` | Acceso a datos desde el servidor. Nunca llega al cliente. |
| `DATABASE_URL` | Solo para `npm run demo:preparar`, que aplica los SQL con psql. |
| `HACKAI_DEMO_SUPABASE_REF` | El ref del proyecto de Supabase de la demo. Sin ella, o si las URLs apuntan a otro proyecto, `npm run demo:preparar` se niega. Ver «Base de la demo». |
| `SESSION_SECRET` | Firma la cookie de sesión `hackai_session`. Sin ella no se puede entrar. |
| `CRON_SECRET` | Secreto de la corrida periódica (`/api/cron/sync`). Sin ella la ruta queda cerrada. Ver «Corrida periódica». |
| `DISCORD_BOT_TOKEN` | Token del bot de Discord. Lo usan `HACKAI_EXTERNAL_CHANNEL=discord` y `npm run discord:probar`. Cómo crearlo: [docs/discord.md](docs/discord.md). |
| `HACKAI_IDENTITY`, `HACKAI_SIU`, `HACKAI_CLASSROOM`, `HACKAI_EXTERNAL_CHANNEL`, `HACKAI_FILES` | Qué adaptador usa cada puerto. Vacías, usan los de memoria con los datos sintéticos. Valores posibles: `lib/composition.ts`. |
| `HACKAI_CLOCK` | El reloj: `memoria` (por defecto) queda fijo en el martes 10/11 del set sintético, el «hoy» de los tests; `sistema` usa la fecha real. La demo va con `sistema` («Datos y fecha de la demo»). |
| `HACKAI_STORE` | Dónde guardan lo suyo los módulos: `memoria` (por defecto) o `supabase`, sobre las tablas de `supabase/migrations/`. Lo usan Personas y Espacios. |
| `HACKAI_CAIDAS` | `si` deja tirar el SIU o Moodle desde `/caidas` para mostrarlo en la demo. Vacía o `no` (por defecto): no existe, como en producción. Ver «Mostrar una caída en la demo». |
| `HACKAI_CACHE_SEGUNDOS` | Cuánto guarda la caché de lecturas (`lib/adapters/cache/`) lo que no cambia con lo que hace el alumno: personas, materias, comisiones, planes y vínculos. Vacía: 300. `0` no guarda nada (solo comparte la consulta en vuelo), por ejemplo para editar el seed o las notas en la base durante la demo; si no, un cambio así tarda hasta 5 minutos en verse en cada instancia de Vercel. Inscripciones, historia, cupos e inasistencias nunca se guardan. |
| `HACKAI_TEST_SUPABASE_URL`, `HACKAI_TEST_SUPABASE_SERVICE_ROLE_KEY` | Solo para los tests: base de prueba contra la que corren las baterías de contrato del SIU y del Moodle simulados, de Archivos y de los almacenes de Personas y Espacios. |

No las imprimas en logs ni en reportes.

## Lo que ya hay

| Archivo | Qué trae |
| --- | --- |
| `lib/session-token.ts`, `lib/auth.ts` | Sesión firmada en una cookie: `createSessionToken`, `forgeSessionCookie` (tests y desarrollo), `getSession()`, `requireSession(role?)`, `startSession()`, `endSession()` y `homeFor(role)`. |
| `app/globals.css` | Tailwind CSS 4 y los tokens de shadcn/ui con el sistema visual de la dirección «B, Profundo» (`docs/design/direccion-de-diseno.md`): los colores de la Austral, los avisos y la sombra de tarjeta. |
| `components/ui/` | Componentes de shadcn/ui (ADR 0006). Se suman con `npx shadcn add <componente>` y se pasan a las convenciones del repo. Por ahora, `button`. |
| `lib/utils.ts` | `cn()`, que junta clases de Tailwind. |
| `tests/session-token.test.ts` | Tests de la sesión. Ejemplo de cómo se escribe un test con `node:test`. |
| `lib/result.ts` | `Result`, `ok()`, `fail()` y `notImplemented()`: los errores como valores. |
| `lib/ports/` | Los seis puertos (identidad, SIU, aula virtual, canal externo, archivos, reloj) con sus capacidades. |
| `lib/core/` | Personas, Cursada, Espacios y Hoy. Lo que todavía no está hecho devuelve `no-implementado`. |
| `lib/adapters/synthetic-data.ts` | El set único de datos sintéticos: facultades, materias, comisiones, alumnos, notas, cursos de Moodle y canales de Discord. Los adjuntos PDF son PDF que abre el visor del navegador (`synthetic-files.ts`). |
| `lib/adapters/memoria/` | Un adaptador en memoria por puerto, cargado con ese set. |
| `lib/adapters/discord/` | El canal externo real: API REST v10 de Discord, sin gateway. Bot y prueba manual (`npm run discord:probar`): [docs/discord.md](docs/discord.md). |
| `tests/contracts/` | La batería de contrato de cada puerto y de los almacenes de Personas y Espacios, que corre contra el adaptador en memoria y el real. `fake-discord.ts` es un `fetch` con la forma de la API de Discord, y `fake-postgrest.ts`, uno con la de PostgREST, los dos sin red. |
| `lib/composition.ts` | `compose(env)` para los tests y `system()` para la app: arma los módulos con el adaptador de cada puerto y con su almacén. |
| `lib/adapters/siu-simulado/` | El SIU simulado sobre las tablas `siu_*` y el generador de su seed. |
| `lib/adapters/moodle-simulado/` | El Moodle simulado sobre las tablas `moodle_*` y el generador de su seed. |
| `lib/adapters/supabase/` | Lo que comparten los adaptadores sobre Supabase: `client.ts` (cliente con service role), `query.ts` (consultas con tiempo máximo) y `sql.ts` (literales y `upsert` que usan los generadores de seed). Además, los almacenes de Personas y de Espacios, el generador del seed de Personas y Archivos sobre Supabase Storage. |
| `app/page.tsx`, `app/actions/session.ts`, `components/session/` | El ingreso de demo: la lista de personas por rol, y las acciones para entrar y salir. |
| `components/shell/` | Lo que comparten las pantallas: `PageHeader` (encabezado navy con la marca y la campana, que pide en cada pantalla los no leídos a Espacios y, al alumno, las notas nuevas con `lib/new-grades.ts`), `Brand`, `AppShell` y `AppNav` (la navegación), y `Avatar` (iniciales). |
| `app/(app)/hoy/`, `components/today/` | Inicio de los dos roles, en una llamada a Hoy. Al alumno: su ficha, lo próximo (parcial o final, con turno y lugar, y la próxima entrega), la semana con sus clases y fechas (`calendar.tsx`; en el celular, una agenda), sus materias y las inscripciones que cierran pronto. Al docente (`teaching-screen.tsx`): sus comisiones, las consultas sin resolver, lo que no leyó y sus parciales y mesas. Si el SIU o Moodle no responden, cada parte muestra lo último leído con el aviso de `components/ui/stale-banner.tsx` o su error. Las novedades sin leer de todos sus espacios llegan a la campana. |
| `app/(app)/calendario/`, `app/calendario/exportar/` | El Calendario: la semana con clases, parciales, finales, entregas y cierres de inscripción, con filtros. `/calendario/exportar` da los próximos como .ics («Agregar a mi calendario»; con `?mesa=`, solo ese final). |
| `app/(app)/novedades/`, `components/news/` | Novedades, adonde lleva la campana: lo que no leíste en todos tus espacios, por materia y canal, con quién publicó lo último, el texto y cuándo. Cada fila lleva al canal o al hilo, que al abrirse queda leído. Para alumno y docente. Al alumno, arriba, hasta dos notas nuevas con «Ver todas» si hay más (`grade-news.tsx`): tocar una pasa por `app/notas/vistas/`, que guarda en una cookie que las vio (`lib/grades-seen.ts`) y lo lleva a Notas. Con el SIU caído no aparecen. |
| `app/(app)/notas/`, `components/grades/` | Notas, del alumno: cada materia del plan con su estado (promocionada, aprobada, regular, en curso) y, al elegirla, sus parciales, la nota de cursada y la final. Filtros por año, optativas y vida universitaria. `/academico` redirige acá. |
| `app/(app)/estado/`, `components/career/` | Estado de la carrera: promedio y avance por año, optativas y vida universitaria. |
| `app/(app)/tramites/`, `components/procedures/`, `components/academic/` | Trámites: constancias con el enlace a la Autogestión o el motivo por el que todavía no se puede pedir, certificados y analítico. |
| `app/(app)/materias/` | Mis materias, para alumno y docente: una grilla paginada con las que cursa, cada una con su espacio, lo que no leíste en él y su aula de Moodle. Las de final pendiente (con la próxima mesa, de `pendingFinals`) y las archivadas se eligen arriba (`?ver=`). Si el SIU o Moodle no responden, muestra lo último leído con el aviso de desactualizado. En `[subjectId]/`, el espacio de la materia. |
| `app/(app)/inscripciones/`, `components/enrollment/` | Inscripciones del alumno, en dos pestañas (materias y exámenes): lo que tiene la inscripción abierta, solo de su carrera, y lo que ya tiene; al elegir una materia (`?materia=`, y `?tab=examenes` para las mesas), su oferta con modalidad, horarios, cupo, sede, docentes y observaciones. Las actividades con créditos van con las materias. Inscribirse y darse de baja van por el mismo flujo; si el SIU no deja hacerlo por API, llevan a la Autogestión. `offerHref` arma el enlace; las rutas viejas (`[materia]/`, `[materia]/final/`) redirigen. |
| `app/simulado/`, `components/simulated/` | La página a la que llevan los enlaces al SIU y a Moodle simulados: dice que es una demo y qué abriría el enlace en producción. |
| `app/actions/spaces.ts`, `components/spaces/` | El espacio de la materia: publicar, responder, marcar resuelta, crear canales, vincularlos con Discord, subir y organizar el material y escribirle en privado a un docente de la comisión. |
| `app/api/cron/sync/`, `lib/periodic-sync.ts` | La corrida periódica: la ruta protegida por `CRON_SECRET` que sincroniza todos los espacios. Ver «Corrida periódica». |
| `app/manifest.ts`, `public/sw.js`, `app/sin-conexion/`, `components/shell/service-worker.tsx` | La app instalable y su pantalla sin conexión. Ver «App instalable». |
| `vercel.json` | El cron diario y la configuración del deploy en Vercel. Ver «Deploy en Vercel». |
| `app/api/health/`, `lib/health.ts` | El chequeo de salud: ok solo si el sistema se arma. Ver «Con Docker». |
| `lib/demo-base/`, `scripts/demo-*.ts` | Preparar, verificar y probar la base de la demo. Ver «Base de la demo». |
| `lib/adapters/caida/`, `app/caidas/`, `app/actions/outages.ts` | Las caídas de la demo: el interruptor que tira el SIU o Moodle y la página para usarlo. Ver «Mostrar una caída en la demo». |

Los módulos del núcleo, los puertos, la estructura de carpetas y cómo se testea están en [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md).
