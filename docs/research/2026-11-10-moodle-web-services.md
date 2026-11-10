# Web Services de Moodle 4.x y 5.x para HackAI

Fecha: 2026-11-10. Ticket: [#3](https://github.com/ignaciogaspar/campus-hackai/issues/3). Sirve para modelar las tablas `moodle_*` simuladas de forma fiel a la API real.

## Resumen

- Todas las funciones que HackAI necesita existen como funciones externas de Moodle, salvo dos huecos: **la matriculación por base de datos externa y la matriculación por cohortes no exponen ninguna función propia** (ver sección «Matriculación»). Se manejan por configuración y por tarea programada, y la cohorte se puebla con `core_cohort_add_cohort_members`.
- Entre Moodle 4.5 y 5.1 las funciones de este ticket son las mismas. Cambios de firma comprobados al comparar el código: `mod_assign_get_assignments` suma el campo `gradepenalty` en 5.1, `enrol_manual_unenrol_users` dejó de declarar un `roleid` opcional, `core_message_send_instant_messages` suma `cantsendtouser` a la respuesta, y `mod_forum` suma tres funciones nuevas en 5.1 (`mod_forum_set_forum_subscription`, `mod_forum_set_forum_tracking`, `mod_forum_mark_posts_read`).
- El campo `capabilities` de `db/services.php` es **solo orientativo**: no hace cumplir nada. Los permisos reales los exige el código de cada función con `require_capability()` / `has_capability()`. Fuente: [moodledev.io, Writing a web service](https://moodledev.io/docs/5.1/apis/subsystems/external/writing-a-service). Por eso en cada función de abajo se distingue «declarado» de «exigido en el código».
- **No confirmado:** qué versión corre el Campus de la Austral en producción más allá de lo que dice el relevamiento («Moodle 5.1», [relevamiento](2026-11-10-relevamiento-siu-campus.md)), si tiene los Web Services habilitados y cuáles funciones tiene agregadas a un servicio. Nada de esta nota se probó contra ese sitio.

## Fuentes y método

Primarias, en este orden de peso:

1. **Código de `moodle/moodle`**, ramas `MOODLE_501_STABLE` (5.1.8+, build 20261030, según [version.php](https://github.com/moodle/moodle/blob/MOODLE_501_STABLE/public/version.php)), `MOODLE_500_STABLE` (5.0.11) y `MOODLE_405_STABLE` (4.5.15+, [version.php](https://github.com/moodle/moodle/blob/MOODLE_405_STABLE/version.php)). Leí las definiciones `*_parameters()`, `*_returns()` y el cuerpo de cada función. En 5.1 el código vive bajo `public/`; en 4.5 y 5.0 no.
2. **Documentación oficial:** [moodledev.io](https://moodledev.io/docs/5.1/apis/subsystems/external) y [docs.moodle.org](https://docs.moodle.org/501/en/Using_web_services). Estas páginas las leí con una herramienta que las resume, no a mano: lo que cito de ellas es lo que el resumen devolvió, y lo marco con «según la doc».

Convenciones: las rutas de código son relativas a `public/` en 5.1 y a la raíz en 4.5. «Parámetro opcional» = `VALUE_OPTIONAL` o con default. Las marcas de tiempo son enteros Unix.

Límites: no ejecuté ninguna llamada contra un Moodle real, así que los ejemplos de respuesta no son capturas; son la estructura que declara el código. Cada función tiene una página de documentación autogenerada en cada sitio (Administración del sitio > Servidor > Servicios web > Documentación de API, según la [doc oficial](https://docs.moodle.org/501/en/Using_web_services)); no se pudo consultar la del Campus.

## Cómo se llama una función (REST)

- Hay que habilitar los servicios web y el protocolo REST, crear un servicio con las funciones elegidas y un token. Capacidades que menciona la doc: `moodle/webservice:createtoken` para generar el token propio, `webservice/rest:use` para REST, la del servicio si tiene una, y las de cada función. Fuente: [docs.moodle.org, Using web services](https://docs.moodle.org/501/en/Using_web_services) (según la doc).
- Parámetros de la llamada REST que reconoce el servidor: `wstoken`, `wsfunction`, `moodlewsrestformat` (`json` o `xml`; si falta, responde XML). Fuente: [webservice/rest/locallib.php, 5.1](https://github.com/moodle/moodle/blob/MOODLE_501_STABLE/public/webservice/rest/locallib.php). La ruta del endpoint es `webservice/rest/server.php` (archivo presente en [5.1](https://github.com/moodle/moodle/blob/MOODLE_501_STABLE/public/webservice/rest/server.php)); su documentación oficial con la URL completa no la encontré en las páginas que leí: **no confirmado el formato exacto de la URL**.
- Las funciones de escritura se declaran con `'type' => 'write'`, las de lectura con `'read'`. Las funciones con `MOODLE_OFFICIAL_MOBILE_SERVICE` pertenecen al servicio de la app oficial. Fuente: [lib/db/services.php, 5.1](https://github.com/moodle/moodle/blob/MOODLE_501_STABLE/public/lib/db/services.php).
- Los errores de validación de parámetros salen como excepciones; varias funciones devuelven además `warnings` (estructura `external_warnings`; su forma exacta no la verifiqué, aunque en `core_cohort_add_cohort_members` el código arma cada advertencia con `warningcode` y `message`). Una función de matriculación lanza la excepción en el primer error y revierte todo (transacción delegada). Fuente: [enrol/manual/externallib.php, 5.1](https://github.com/moodle/moodle/blob/MOODLE_501_STABLE/public/enrol/manual/externallib.php).

## 1. Listar los cursos de un usuario

### `core_enrol_get_users_courses`

- Declaración: lectura; capacidad declarada `moodle/course:viewparticipants`; está en el servicio móvil oficial. [services.php](https://github.com/moodle/moodle/blob/MOODLE_501_STABLE/public/lib/db/services.php)
- Parámetros: `userid` (int, obligatorio), `returnusercount` (bool, default `true`; la doc del parámetro avisa que contar usuarios inscriptos puede sumar segundos si el usuario está en muchos cursos grandes). [enrol/externallib.php](https://github.com/moodle/moodle/blob/MOODLE_501_STABLE/public/enrol/externallib.php)
- Qué exige el código: solo devuelve inscripciones **activas**; omite los cursos a los que el usuario que llama no puede acceder; si se pide otro usuario distinto del que llama, exige poder ver participantes del curso y el perfil de ese usuario. Mismo archivo.
- Devuelve una lista de cursos con: `id`, `shortname`, `fullname`, `displayname`, `enrolledusercount`, `idnumber`, `visible`, `summary`, `summaryformat`, `format`, `courseimage`, `showgrades`, `lang`, `enablecompletion`, `completionhascriteria`, `completionusertracked`, `category`, `progress` (porcentaje), `completed`, `startdate`, `enddate`, `marker`, `lastaccess`, `isfavourite`, `hidden`, `overviewfiles`, `showactivitydates`, `showcompletionconditions`, `timemodified`. Varios son opcionales. Mismo archivo.

### `core_course_get_enrolled_courses_by_timeline_classification`

- Declaración: lectura; sin capacidad declarada; llamable por AJAX y por el servicio móvil. [services.php](https://github.com/moodle/moodle/blob/MOODLE_501_STABLE/public/lib/db/services.php)
- Parámetros: `classification` (obligatorio; la descripción dice `future`, `inprogress` o `past`), `limit`, `offset`, `sort`, `customfieldname`, `customfieldvalue`, `searchvalue`, `requiredfields` (lista de nombres de campos a incluir). **No recibe `userid`**: opera sobre el usuario del token. [course/externallib.php](https://github.com/moodle/moodle/blob/MOODLE_501_STABLE/public/course/externallib.php)
- El código acepta además otras clasificaciones internas (todos, con ocultos, favoritos, ocultos, búsqueda, campo personalizado). La descripción del parámetro no las lista; son comportamiento observado en el código, no contrato documentado.
- Devuelve cursos con los campos del exportador de resumen de curso (`course_summary_exporter`), filtrables con `requiredfields`. **No verifiqué la lista completa de campos de retorno.**

Uso para HackAI (hipótesis): el período de un curso se deriva hoy del nombre ([relevamiento](2026-11-10-relevamiento-siu-campus.md)); estas dos funciones traen `startdate`/`enddate` y la clasificación `past`/`inprogress`/`future`, que podría reemplazar esa derivación **si los cursos del Campus tienen esas fechas cargadas** (no confirmado).

## 2. Matriculación y desmatriculación

### 2.1 Manual

**`enrol_manual_enrol_users`** — [enrol/manual/db/services.php](https://github.com/moodle/moodle/blob/MOODLE_501_STABLE/public/enrol/manual/db/services.php), [externallib.php](https://github.com/moodle/moodle/blob/MOODLE_501_STABLE/public/enrol/manual/externallib.php)

- Escritura. Capacidad `enrol/manual:enrol`, exigida en el contexto del curso.
- Parámetros: `enrolments`, lista de `{roleid (int, oblig.), userid (int, oblig.), courseid (int, oblig.), timestart (int, opc.), timeend (int, opc.), suspend (int, opc.; 1 = suspender)}`.
- Reglas del código: el usuario destino debe estar activo; el rol debe ser **asignable** por quien llama en ese curso; el curso debe tener una instancia de matriculación manual **habilitada**. `timestart` y `timeend` valen 0 si no se pasan; el estado queda activo salvo `suspend`.
- Devuelve `null` (nada). Si algo falla lanza excepción y deshace todo el lote.

**`enrol_manual_unenrol_users`** — mismos archivos.

- Escritura. Capacidad `enrol/manual:unenrol`.
- Parámetros: `enrolments`, lista de `{userid, courseid}`, ambos obligatorios. En 4.5 la estructura declaraba además un `roleid` opcional; en 5.1 ya no está. Comparación de [4.5](https://github.com/moodle/moodle/blob/MOODLE_405_STABLE/enrol/manual/externallib.php) y 5.1.
- Quita la matriculación **manual**; si el usuario además estaba por otro método (por ejemplo cohorte), esa otra matriculación sigue. (Inferido del código: llama a `unenrol_user` sobre la instancia manual; **no probado**.)
- Devuelve `null`.

### 2.2 Desmatricular por id de matriculación

**`core_enrol_unenrol_user_enrolment`** — [services.php](https://github.com/moodle/moodle/blob/MOODLE_501_STABLE/public/lib/db/services.php), [enrol/externallib.php](https://github.com/moodle/moodle/blob/MOODLE_501_STABLE/public/enrol/externallib.php), [enrol/locallib.php](https://github.com/moodle/moodle/blob/MOODLE_501_STABLE/public/enrol/locallib.php)

- Escritura, marcada `ajax`; no declara capacidad ni servicio móvil.
- Parámetro: `ueid` (id del registro `user_enrolments`).
- El código exige `enrol/<plugin>:unenrol` en el contexto del curso **y** que el plugin de matriculación permita desmatricular ese registro. Sirve para cualquier método, no solo manual.
- Devuelve `{result: bool, errors: [{key, message}]}`.
- **No confirmado** si el administrador puede agregarla a un servicio externo para tokens (aparece declarada como función AJAX; no leí la regla que decide qué funciones admite un servicio).

### 2.3 Auto-matriculación (el alumno se inscribe solo)

- `enrol_self_enrol_user`: parámetros `courseid` (oblig.), `password` (clave de matriculación, default vacío), `instanceid` (default 0). Devuelve `{status: bool, warnings}`. Es la función del usuario que llama; no declara capacidad. [enrol/self/db/services.php](https://github.com/moodle/moodle/blob/MOODLE_501_STABLE/public/enrol/self/db/services.php), [externallib.php](https://github.com/moodle/moodle/blob/MOODLE_501_STABLE/public/enrol/self/externallib.php)
- `enrol_self_get_instance_info`: lectura, de la instancia de auto-matriculación. Parámetros **no verificados**.
- `core_enrol_get_course_enrolment_methods`: lectura, lista los métodos de matriculación de un curso. Parámetros y retorno **no verificados**. [services.php](https://github.com/moodle/moodle/blob/MOODLE_501_STABLE/public/lib/db/services.php)

### 2.4 Cohortes

La matriculación por cohorte se hace en dos pasos con dos mecanismos distintos.

1. **Poblar la cohorte** con funciones externas ([cohort/externallib.php](https://github.com/moodle/moodle/blob/MOODLE_501_STABLE/public/cohort/externallib.php)):
   - `core_cohort_create_cohorts` (capacidad declarada `moodle/cohort:manage`): parámetro `cohorts`, lista con `categorytype {type, value}`, `name`, `idnumber`, `description`, `descriptionformat`, `visible`, `theme`, campos personalizados.
   - `core_cohort_add_cohort_members` (`moodle/cohort:assign`): parámetro `members`, lista de `{cohorttype {type: 'id'|'idnumber', value}, usertype {type: 'id'|'username', value}}`. Devuelve `{warnings}`. Códigos de advertencia que genera el código: tipo inválido, cohorte o usuario inexistente, ya es miembro, contexto inválido. Exige `moodle/cohort:manage` o `moodle/cohort:assign` en el contexto de la cohorte; solo acepta cohortes de sistema o de categoría. Un usuario eliminado no cuenta.
   - `core_cohort_delete_cohort_members` (`moodle/cohort:assign`): parámetro `members`, lista de `{cohortid, userid}`. Devuelve `null`.
   - `core_cohort_get_cohort_members` (lectura, `moodle/cohort:view`): parámetro `cohortids`. Devuelve `[{cohortid, userids[]}]`. Exige `moodle/cohort:manage` o `moodle/cohort:view`.
   - También existen `core_cohort_get_cohorts`, `core_cohort_search_cohorts`, `core_cohort_update_cohorts`, `core_cohort_delete_cohorts` ([services.php](https://github.com/moodle/moodle/blob/MOODLE_501_STABLE/public/lib/db/services.php)); sus parámetros no los detallé.
2. **Vincular la cohorte a un curso** es el método de matriculación «Sincronización de cohorte» (`enrol_cohort`). Según la [doc](https://docs.moodle.org/501/en/Cohort_sync) se agrega en Administración del curso > Métodos de matriculación; al agregar un usuario a la cohorte se lo matricula en el curso y al quitarlo se lo desmatricula. En el código, el plugin se engancha a los eventos `cohort_member_added`, `cohort_member_removed` y `cohort_deleted` ([enrol/cohort/db/events.php](https://github.com/moodle/moodle/blob/MOODLE_501_STABLE/public/enrol/cohort/db/events.php)). **No encontré ninguna función externa para crear esa instancia de matriculación** (el plugin no tiene `db/services.php` ni en 4.5 ni en 5.1: la URL da 404 en [5.1](https://github.com/moodle/moodle/blob/MOODLE_501_STABLE/public/enrol/cohort/db/services.php) y [4.5](https://github.com/moodle/moodle/blob/MOODLE_405_STABLE/enrol/cohort/db/services.php)). Qué pasa con las notas al desmatricular por cohorte: la doc no lo dice; **no confirmado**.

### 2.5 Base de datos externa

- **No hay función externa.** El plugin `enrol_database` no tiene `db/services.php` en 4.5 ni en 5.1 (404 en [5.1](https://github.com/moodle/moodle/blob/MOODLE_501_STABLE/public/enrol/database/db/services.php) y [4.5](https://github.com/moodle/moodle/blob/MOODLE_405_STABLE/enrol/database/db/services.php)).
- Funciona leyendo una tabla remota, no recibiendo llamadas. Según la [doc oficial](https://docs.moodle.org/501/en/External_database): una tabla con un registro por combinación usuario/curso; se configuran la base, qué campo identifica al curso (`idnumber`, `shortname` o `id`), al usuario (`idnumber`, `username`, `email` o `id`) y, opcionalmente, el rol; se sincroniza al iniciar sesión y por una tarea programada que viene deshabilitada y corre una vez por día. Los usuarios tienen que existir antes. La acción al desaparecer una matriculación de la tabla se elige con `unenrolaction`: desmatricular, mantener, suspender, o suspender y quitar roles; el plugin solo puede desmatricular lo que él mismo matriculó.
- En el código, el sincronizado vive en `sync_enrolments()` y `sync_courses()` de [enrol/database/lib.php](https://github.com/moodle/moodle/blob/MOODLE_501_STABLE/public/enrol/database/lib.php).

Implicancia para el modelo simulado (hipótesis, no dato): lo que el SIU «envía» a Moodle por matriculación automática es, en este mecanismo, una **tabla** y no una API. Lo que haga hoy la Austral entre SIU y Moodle **no está confirmado** en ninguna fuente de esta nota; el relevamiento solo prueba que el SIU conoce el curso de Moodle de cada materia (botón «Ir»).

## 3. Foro de avisos de un curso

El foro de avisos del curso es el de tipo `news` (clave interna). Los tipos válidos incluyen `news`, `social`, `general`, `eachuser`, `single`, `qanda`, según `forum_get_forum_types_all()` en [mod/forum/lib.php](https://github.com/moodle/moodle/blob/MOODLE_501_STABLE/public/mod/forum/lib.php). **No verifiqué** que en el Campus de la Austral el foro «Avisos» sea de ese tipo; el relevamiento solo dice que está fijo arriba del curso.

Archivos: [mod/forum/db/services.php](https://github.com/moodle/moodle/blob/MOODLE_501_STABLE/public/mod/forum/db/services.php), [mod/forum/externallib.php](https://github.com/moodle/moodle/blob/MOODLE_501_STABLE/public/mod/forum/externallib.php).

**`mod_forum_get_forums_by_courses`** (lectura; capacidad declarada `mod/forum:viewdiscussion`)
- Parámetro: `courseids` (lista de ints, default vacío = todos los foros a los que el usuario accede).
- Devuelve una lista de foros con, entre otros: `id`, `course`, `type`, `name`, `intro`, `duedate`, `cutoffdate`, `timemodified`, `cmid`, `numdiscussions`, `cancreatediscussions`. La lista completa tiene más campos que no transcribí.

**`mod_forum_get_forum_discussions`** (lectura; `mod/forum:viewdiscussion`, `mod/forum:viewqandawithoutposting`)
- Parámetros: `forumid` (oblig.), `sortorder` (int, default -1; elementos `numreplies`, `created`, `timemodified`), `page` (default -1), `perpage` (default 0), `groupid` (default 0).
- Devuelve `discussions[]` con, entre otros: `id`, `name`, `groupid`, `timemodified`, `usermodified`, `timestart`, `timeend`, `discussion`, `parent`, `userid`, `created`, `subject`, `message`, `userfullname`, `attachments`, `numreplies`, `pinned`; y `warnings`.

**`mod_forum_get_discussion_posts`** (lectura; mismas capacidades)
- Parámetros: `discussionid` (oblig.), `sortby` (`id`, `created` o `modified`; default `created`), `sortdirection` (`ASC`/`DESC`; default `DESC`), `includeinlineattachments` (bool).
- Devuelve `posts[]` (exportador `post`: `id`, `subject`, `message`, `messageformat`, `author`, `discussionid`, `parentid`, `timecreated`, `timemodified`, `unread`, `isdeleted`, `isprivatereply`, `capabilities`, entre otros), más `forumid`, `courseid` y `warnings`. Fuente de los campos: [exporters/post.php](https://github.com/moodle/moodle/blob/MOODLE_501_STABLE/public/mod/forum/classes/local/exporters/post.php).

**Nota sobre lectura y suscripción.** El relevamiento anota que el alumno no puede suscribirse ni desuscribirse del foro de Avisos. En 5.1 se suma `mod_forum_set_forum_subscription`, que no existe en 4.5 (comparación de los `db/services.php`), pero **no verifiqué sus parámetros ni si respeta esa restricción para foros `news`**. En 5.1 se suman también `mod_forum_set_forum_tracking` y `mod_forum_mark_posts_read`. `mod_forum_add_discussion` también existe (escritura).

## 4. Archivos y recursos de un curso

**`core_course_get_contents`** (lectura; capacidades declaradas `moodle/course:update`, `moodle/course:viewhiddencourses`) — [course/externallib.php](https://github.com/moodle/moodle/blob/MOODLE_501_STABLE/public/course/externallib.php)
- Parámetros: `courseid` (oblig.) y `options` (lista de `{name, value}`). Opciones documentadas en el código: `excludemodules`, `excludecontents`, `includestealthmodules`, `sectionid`, `sectionnumber`, `cmid`, `modname`, `modid`.
- Devuelve las secciones del curso: `id`, `name`, `visible`, `summary`, `section`, `uservisible`, `availabilityinfo`, y `modules[]` (`id`, `url`, `name`, `instance`, `contextid`, `visible`, `uservisible`, `availabilityinfo`, `modname`, `completion`, `downloadcontent`, `dates[]`, `contents[]`). Cada `contents` trae `type` (archivo, carpeta o link externo), `filename`, `filesize`, `fileurl`, `timemodified`, `mimetype`.
- Permisos: el código valida el contexto del curso; las dos capacidades declaradas se usan para decidir si se ven secciones y cursos ocultos (`moodle/course:update` o `moodle/course:viewhiddencourses`), así que **un alumno ve lo visible**. Es lo leído en el código; no lo probé con una cuenta de alumno.
- Es la función que da la estructura por **tema o semana** que el relevamiento describe para el Campus.

**`mod_resource_get_resources_by_courses`** (lectura; `mod/resource:view`) — [mod/resource/db/services.php](https://github.com/moodle/moodle/blob/MOODLE_501_STABLE/public/mod/resource/db/services.php), [classes/external.php](https://github.com/moodle/moodle/blob/MOODLE_501_STABLE/public/mod/resource/classes/external.php)
- Parámetro: `courseids` (default vacío = todos los accesibles).
- Devuelve `resources[]` con `contentfiles` (archivos), `display`, `displayoptions`, `filterfiles`, `revision`, `timemodified`, entre otros, y `warnings`.

**`mod_folder_get_folders_by_courses`** (lectura; `mod/folder:view`) — [mod/folder/db/services.php](https://github.com/moodle/moodle/blob/MOODLE_501_STABLE/public/mod/folder/db/services.php), [classes/external.php](https://github.com/moodle/moodle/blob/MOODLE_501_STABLE/public/mod/folder/classes/external.php)
- Su descripción dice que **no devuelve el contenido de la carpeta**; para eso hay que usar `core_course_get_contents`.

## 5. Tareas, entregas y fechas

### 5.1 Tareas (`mod_assign`)

Archivos: [mod/assign/db/services.php](https://github.com/moodle/moodle/blob/MOODLE_501_STABLE/public/mod/assign/db/services.php), [mod/assign/externallib.php](https://github.com/moodle/moodle/blob/MOODLE_501_STABLE/public/mod/assign/externallib.php).

**`mod_assign_get_assignments`** (lectura)
- Parámetros: `courseids` (default vacío = todos los cursos donde está inscripto), `capabilities` (lista, filtra por capacidades), `includenotenrolledcourses` (bool, default false).
- Devuelve cursos con `assignments[]`. Cada tarea trae: `id`, `cmid`, `course`, `name`, `nosubmissions`, `submissiondrafts`, `duedate`, `allowsubmissionsfromdate`, `cutoffdate`, `gradingduedate`, `maxattempts`, `requiresubmissionstatement`, `intro`, configuraciones de plugins de entrega y de feedback, y desde 5.x `gradepenalty`. La lista completa tiene más campos.
- Significado de las fechas según el código: `duedate` es la fecha de entrega; `cutoffdate` la fecha desde la cual no se acepta entrega sin extensión; `gradingduedate` la fecha esperada de corrección; `allowsubmissionsfromdate` desde cuándo se acepta.

**`mod_assign_get_submissions`** (lectura; el código exige poder ver las notas de la tarea)
- Parámetros: `assignmentids` (oblig.), `status` (default vacío), `since`, `before`.
- Devuelve `assignments[]` con `assignmentid` y `submissions[]`: `id`, `userid`, `attemptnumber`, `timecreated`, `timemodified`, `timestarted`, `status`, `groupid`, `assignment`, `latest`, `plugins`, `gradingstatus`; más `warnings`.
- Es una función de **corrector** (lista las entregas de todos); para que un alumno vea la suya está la siguiente.

**`mod_assign_get_submission_status`** (lectura; `mod/assign:view`)
- Parámetros: `assignid` (oblig.), `userid` (default 0 = quien llama), `groupid` (default 0).
- Devuelve, entre otros: `gradingsummary`, `lastattempt` (con `submission`, `locked`, `graded`, `canedit`, `cansubmit`, `extensionduedate`, `timelimit`, `gradingstatus`, etc.), feedback y `warnings`. Es la función que da «¿entregué? ¿está corregida? ¿puedo editar?».

**`mod_assign_save_submission`** (escritura) y **`mod_assign_submit_for_grading`** (escritura)
- `save_submission`: `assignmentid` y `plugindata`, cuya estructura depende de los plugins de entrega visibles. Para texto en línea es `onlinetext_editor {text, format, itemid}` ([submission/onlinetext](https://github.com/moodle/moodle/blob/MOODLE_501_STABLE/public/mod/assign/submission/onlinetext/locallib.php)); para archivos, `files_filemanager` (id de área de borrador) ([submission/file](https://github.com/moodle/moodle/blob/MOODLE_501_STABLE/public/mod/assign/submission/file/locallib.php)). Devuelve `warnings`.
- `submit_for_grading`: `assignmentid` y `acceptsubmissionstatement` (bool). Devuelve `warnings`. Se usa cuando la tarea exige confirmar el envío (borradores).
- Estas dos **modifican datos**; son las que quedan fuera de lo que se puede probar contra el Campus real (regla del repo: solo lectura).

### 5.2 Calendario (`core_calendar`)

Archivo: [calendar/externallib.php](https://github.com/moodle/moodle/blob/MOODLE_501_STABLE/public/calendar/externallib.php). Las tres funciones declaran capacidades de `moodle/calendar:manage*` en [services.php](https://github.com/moodle/moodle/blob/MOODLE_501_STABLE/public/lib/db/services.php), pero por lo anterior eso es orientativo; **no verifiqué qué exige el código a un alumno**.

- **`core_calendar_get_calendar_events`**: parámetros `events {eventids[], courseids[], groupids[], categoryids[]}` y `options {userevents, siteevents, timestart, timeend, ignorehidden}`. Devuelve `events[]` con `id`, `name`, `description`, `format`, `courseid`, `categoryid`, `groupid`, `userid`, `repeatid`, `modulename`, `instance`, `eventtype`, `timestart`, `timeduration`, `visible`, `uuid`, `sequence`, `timemodified`, `subscriptionid`; y `warnings`.
- **`core_calendar_get_action_events_by_timesort`**: `timesortfrom` (default 0), `timesortto`, `aftereventid`, `limitnum` (default 20), `limittononsuspendedevents`, `userid`, `searchvalue`. Devuelve eventos «de acción» (lo que hay que hacer, como entregar una tarea) ordenados por fecha. Estructura de retorno: exportador de eventos de Moodle, no transcripta.
- **`core_calendar_get_action_events_by_course`**: `courseid` (oblig.), `timesortfrom`, `timesortto`, `aftereventid`, `limitnum` (default 20), `searchvalue`.
- Existe además `core_calendar_get_action_events_by_courses` (varios cursos) y vistas por mes, día y próximos (`core_calendar_get_calendar_monthly_view`, `..._day_view`, `..._upcoming_view`); no detallé sus parámetros.

Uso para HackAI (hipótesis): «qué vence pronto» (hoy 1 click al Calendario y nada en el inicio, según el [relevamiento](2026-11-10-relevamiento-siu-campus.md)) corresponde a `get_action_events_by_timesort`; con `mod_assign_get_assignments` se obtiene `duedate` por tarea.

## 6. Mensajes

Archivo: [message/externallib.php](https://github.com/moodle/moodle/blob/MOODLE_501_STABLE/public/message/externallib.php). Ambas funciones declaran la capacidad `moodle/site:sendmessage` y están en el servicio móvil.

**`core_message_send_instant_messages`** (escritura)
- Parámetro: `messages`, lista de `{touserid (oblig.), text (oblig.), textformat (default FORMAT_MOODLE), clientmsgid (opc.)}`.
- Exige que la mensajería esté habilitada en el sitio (`messaging`) y `moodle/site:sendmessage` en el contexto del sistema. Por mensaje valida: destinatario existente y no eliminado, largo máximo (`MESSAGE_MAX_LENGTH`) y que el destinatario pueda recibir mensajes de quien envía (`can_send_message`: depende de las preferencias de privacidad del destinatario, que **no leí**).
- Devuelve por mensaje: `msgid` (−1 si falló), `clientmsgid`, `errormessage`, `text`, `timecreated`, `conversationid`, `useridfrom`, `candeletemessagesforallusers` y, desde 5.x, `cantsendtouser`.

**`core_message_send_messages_to_conversation`** (escritura)
- Parámetros: `conversationid` y `messages` (lista de `{text, textformat}`).
- Su cuerpo y su retorno no los leí con el detalle de arriba: **no confirmado** qué exige además de la capacidad declarada.

## 7. Funciones de apoyo

- `core_webservice_get_site_info`: lectura; devuelve datos del sitio, del usuario del token y la lista de funciones disponibles. Sirve para saber con qué versión y qué funciones se está hablando. [services.php](https://github.com/moodle/moodle/blob/MOODLE_501_STABLE/public/lib/db/services.php). **Campos de retorno no detallados.**
- `core_user_get_users_by_field`: lectura; según su descripción, devuelve datos de usuarios a partir de un campo único (para buscar por texto remite a `core_user_get_users`). Sirve para resolver ids antes de matricular; qué campos acepta no lo verifiqué. Misma fuente.
- `core_enrol_get_enrolled_users` (lectura): parámetros `courseid` y `options` (`withcapability`, `groupid`, `onlyactive`, `onlysuspended`, `userfields`, `limitfrom`, `limitnumber`, `sortby`, `sortdirection`). El código exige `moodle/role:review` para `withcapability`, `moodle/course:enrolreview` para `onlyactive` y `onlysuspended`, y `moodle/site:accessallgroups` para ver otro grupo. Devuelve por usuario: `id`, `username`, `fullname`, `email`, `idnumber`, `firstaccess`, `lastaccess`, `lastcourseaccess`, `roles[]`, `groups[]`, `enrolledcourses[]`, `customfields[]`, `preferences[]`, entre otros (varios opcionales). [enrol/externallib.php](https://github.com/moodle/moodle/blob/MOODLE_501_STABLE/public/enrol/externallib.php). **Ojo con la privacidad:** devuelve datos personales; el modelo simulado debería usar solo datos sintéticos (regla del repo).

## Qué sugiere esto para las tablas `moodle_*` (hipótesis a confirmar con el equipo)

Son propuestas derivadas de los campos devueltos arriba, no decisiones.

| Tabla simulada (propuesta) | Campos con respaldo en la API |
| --- | --- |
| `moodle_courses` | `id`, `shortname`, `fullname`, `idnumber`, `visible`, `format`, `category`, `startdate`, `enddate` |
| `moodle_enrolments` | `courseid`, `userid`, `roleid`, `timestart`, `timeend`, estado activo o suspendido, método (`manual`, `cohort`, `database`, `self`) |
| `moodle_cohorts` / `moodle_cohort_members` | `id`, `idnumber`, `name`; `cohortid`, `userid` |
| `moodle_forums` / `moodle_discussions` / `moodle_posts` | `type` (`news` para avisos), `name`, `intro`; `name`, `pinned`, `timemodified`, `numreplies`; `subject`, `message`, `author`, `timecreated`, `attachments` |
| `moodle_sections` / `moodle_modules` / `moodle_files` | `section`, `name`, `visible`; `modname`, `instance`, `url`; `filename`, `filesize`, `mimetype`, `timemodified` |
| `moodle_assignments` / `moodle_submissions` | `duedate`, `allowsubmissionsfromdate`, `cutoffdate`, `gradingduedate`, `maxattempts`; `userid`, `attemptnumber`, `status`, `gradingstatus`, `timemodified` |
| `moodle_calendar_events` | `name`, `courseid`, `modulename`, `instance`, `eventtype`, `timestart`, `timeduration` |
| `moodle_messages` | `useridfrom`, `touserid`, `conversationid`, `text`, `timecreated` |

Los nombres de columnas van en inglés como pide el repo; si el equipo prefiere otra convención, se cambia sin perder el mapeo.

## Lo que no se encontró o no se confirmó

- Versión, configuración y servicios habilitados del Campus de la Austral. Esta nota describe Moodle, no ese sitio.
- Formato oficial completo de la URL del endpoint REST (solo están confirmados los nombres de los parámetros).
- Función externa para crear instancias de matriculación por cohorte o por base externa: no existe en las ramas revisadas (404 en `db/services.php` de `enrol_cohort` y `enrol_database`).
- Parámetros y retorno de `core_enrol_get_course_enrolment_methods`, `enrol_self_get_instance_info`, `mod_forum_set_forum_subscription` y `core_message_send_messages_to_conversation`.
- Permisos que el código exige a un alumno en las funciones de calendario.
- Si `core_enrol_unenrol_user_enrolment` se puede agregar a un servicio externo.
- Comparación con 4.0 a 4.4: solo se comparó 4.5 contra 5.1 (la lista de funciones de 5.0 se leyó, sin comparar parámetros).
- Las páginas de `docs.moodle.org` y `moodledev.io` se leyeron mediante un resumen automático, no completas.

## Fuentes

- Código, 5.1: https://github.com/moodle/moodle/tree/MOODLE_501_STABLE (archivos citados en cada sección)
- Código, 4.5: https://github.com/moodle/moodle/tree/MOODLE_405_STABLE
- Código, 5.0: https://github.com/moodle/moodle/tree/MOODLE_500_STABLE
- https://moodledev.io/docs/5.1/apis/subsystems/external
- https://moodledev.io/docs/5.1/apis/subsystems/external/writing-a-service
- https://moodledev.io/docs/5.1/apis/subsystems/external/functions
- https://docs.moodle.org/501/en/Using_web_services
- https://docs.moodle.org/501/en/External_database
- https://docs.moodle.org/501/en/Cohort_sync
