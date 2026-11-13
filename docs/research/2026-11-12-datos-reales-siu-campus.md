# Datos reales del SIU y el Campus con la cuenta del alumno (issue #90)

Fecha: 2026-11-12.

Pregunta: ¿cómo puede HackAI leer y escribir los datos reales de un alumno de la Austral con su propia cuenta, sumando un valor `real` a `HACKAI_SIU` y `HACKAI_CLASSROOM` sin tocar el núcleo (ADR 0004)?

## Método

- Sin sesión: se pidieron con `curl` páginas y endpoints públicos de los dos sistemas.
- Con sesión: en Chrome, con la cuenta de un alumno de Ingeniería en Informática, solo con pedidos de lectura desde la misma pestaña. No se envió ningún formulario, no se generó ningún token y no se cambió nada en ninguno de los dos sistemas.
- Para el significado de los campos se leyó el código de Moodle 5.1 (rama `MOODLE_501_STABLE`).
- No se registran tokens, cookies ni datos personales: los valores aparecen como `<valor>`.

## Campus Virtual (Moodle)

### Configuración pública (confirmado)

Se consultó `tool_mobile_get_public_config` sin sesión: `POST https://campusvirtual.austral.edu.ar/lib/ajax/service-nologin.php`, consultado el 2026-11-12.

| Campo | Valor | Qué significa |
|---|---|---|
| `enablewebservices` | `1` | Servicios web habilitados |
| `enablemobilewebservice` | `1` | El servicio `moodle_mobile_app` está activo: el alumno puede tener su propio token |
| `typeoflogin` | `3` | `LOGIN_VIA_EMBEDDED_BROWSER`: el login se hace en un navegador, porque es SSO ([api.php, 5.1](https://github.com/moodle/moodle/blob/MOODLE_501_STABLE/public/admin/tool/mobile/classes/api.php), constantes `LOGIN_VIA_*`) |
| `launchurl` | `https://campusvirtual.austral.edu.ar/admin/tool/mobile/launch.php` | El punto de entrada para sacar el token después del SSO |
| `identityproviders` | `Office 365 Universidad Austral` | El login es con la cuenta de Microsoft de la Austral (OAuth2) |
| `authloginviaemail` | `0` | — |
| `tool_mobile_disabledfeatures` | `CoreMainMenuDelegate_CoreCoursesDashboard`, `$mmSideMenuDelegate_mmaMessages` | La app tiene apagados el tablero y los mensajes. **Inferencia:** las funciones de mensajería pueden no estar en el servicio, aunque `classroom` no las usa. |

### Cómo se saca el token (código de Moodle; falta probarlo con la cuenta)

- `login/token.php` con usuario y clave **no aplica**: el login es SSO de Microsoft. Es una inferencia de `typeoflogin=3` y del proveedor de identidad.
- `admin/tool/mobile/launch.php?service=moodle_mobile_app&passport=<valor>&urlscheme=<esquema>` (con la sesión ya iniciada en el navegador) redirige a `<esquema>://token=<base64>`. El base64 se decodifica en `md5(wwwroot + passport):::<token>[:::<token privado>]` ([launch.php, 5.1](https://github.com/moodle/moodle/blob/MOODLE_501_STABLE/public/admin/tool/mobile/launch.php), líneas 30–34 y 102–116). El `passport` lo elige quien llama, así que se puede validar el `md5`.
- Preferencias > Claves de seguridad (`/user/managetoken.php`) puede mostrar la clave del servicio móvil: **sin verificar**.
- Con el token, el endpoint es `webservice/rest/server.php` con `wstoken`, `wsfunction` y `moodlewsrestformat=json` ([nota de Moodle del 10/11](2026-11-10-moodle-web-services.md)). Alcanza con `fetch` del lado del servidor (ADR 0002).

### Funciones con la sesión del navegador (confirmado el 2026-11-12)

Se relevó con la sesión de un alumno, llamando a `lib/ajax/service.php?sesskey=…` desde la misma pestaña. Solo lecturas; **no se generó ningún token**, porque crearlo es una escritura en la cuenta.

| Función | Por AJAX con la sesión | Qué cubre del puerto `classroom` |
|---|---|---|
| `core_course_get_enrolled_courses_by_timeline_classification` (`inprogress`) | Responde: 15 cursos, con `id`, `fullname`, `shortname` (forma `9a \| 99 \| aa \| aaa …`), `idnumber`, `startdate`, `enddate`, `viewurl`, `coursecategory` | `coursesOf` |
| `core_calendar_get_action_events_by_timesort` | Responde: eventos con `modulename` (`assign`), `name`, `timestart`, `timesort`, `course`, `url`, `overdue` | `assignments` (tareas con fecha) |
| `core_courseformat_get_state` | Responde: `section[]` (`title`, `cmlist`, `sectionurl`) y `cm[]` (`name`, `module`, `url`, `sectionid`), con módulos `forum`, `resource`, `page`, `folder`, `assign`, `quiz`, `label` | `contents`, sin los archivos de cada recurso |
| `core_course_get_contents`, `mod_assign_get_assignments`, `core_enrol_get_users_courses`, `mod_forum_get_forums_by_courses`, `mod_forum_get_forum_discussions`, `core_webservice_get_site_info` | `servicenotavailable`: no están habilitadas por AJAX | Solo con el token del servicio `moodle_mobile_app` |

Consecuencias:
- **Con el token de la app** (camino A) se cubre todo el puerto de lectura, incluidos los avisos del foro y los archivos. Para generarlo, el alumno abre `launch.php` con la sesión iniciada. Es una escritura en su cuenta: Moodle crea o reusa una clave del servicio móvil.
- **Con la cookie `MoodleSession` y el `sesskey`** (camino B) se cubren cursos, tareas con fecha y la estructura del curso. Los avisos quedan afuera: habría que leer el HTML del foro, y un primer intento no encontró la lista con los selectores clásicos (`tr.discussion`), así que **no confirmado**. La sesión vence, igual que la del SIU.
- `matricular` y `desmatricular`: el alumno no puede (relevamiento del 10/11, hallazgo 6), así que `canEnrol=false`.

### Términos de uso

- `admin/tool/policy/viewall.php` responde 200 y no muestra ninguna política del sitio publicada. `user/policy.php` redirige al inicio. **No encontrado:** ninguna regla del Campus sobre acceso automatizado.
- Del SIU de la Austral: **no encontrado**.

## SIU Guaraní (Autogestión 3W)

### Acceso y login (confirmado)

- URL base: `https://siu.austral.edu.ar/portal/`. Es el 3W de Guaraní 3 (kernel de pagelets, `op_default: 'acceso'`, `es_produccion: true`, codificación `iso-8859-1`). En el HTML público no figura el número de versión.
- El único login es un botón «Ingresar» que va a `https://siu.austral.edu.ar/portal/acceso?auth=saml`. Esa URL redirige (302) a `https://login.microsoftonline.com/<tenant>/saml2`: **SAML con Microsoft Entra**. No hay formulario de usuario y clave.
- Cookie de sesión: `siu_sess__portal_ua_UA`, `path=/portal`, `secure`, `HttpOnly`.
- Consecuencia (**inferencia**): el servidor de HackAI no puede iniciar sesión solo, porque la cuenta de Microsoft puede pedir MFA. Hay que usar la cookie de una sesión iniciada en el navegador (`SIU_SESION` en `.env.local`). Falta medir cuánto dura.

### Formato de las páginas (confirmado en las públicas)

- Cada página llega en HTML. El contenido de cada pagelet va en JSON, dentro de `kernel.renderer.on_arrival({ "op", "info": { "id", "estado", "mensajes" }, "content": "<html>" })`. Para parsearlo sin dependencias, se saca el JSON de cada `on_arrival` y se lee el HTML de `content`.
- Los filtros son formularios `POST` a la misma URL de la operación, con campos `formulario_filtro[...]` y un campo oculto anti-CSRF por página.

### Páginas públicas, sin sesión (confirmado que existen)

| Página | URL | Filtros | Qué podría cubrir del puerto `siu` |
|---|---|---|---|
| Fechas de Examen | `/portal/fecha_examen` | `ra`, `ubicacion`, `carrera`, `plan`, `tipo_mesa` | `examBoards` (oferta de mesas) |
| Horarios de Cursadas | `/portal/horarios_cursadas` | `ra`, `carrera`, `anio_cursada`, `periodo`, `ubicacion`, `dia_semana`, `turno` | `sections` (oferta de comisiones y horarios), `terms` |
| Validador de Certificados | `/portal/validador_certificados` | — | no aplica |

Falta ver qué columnas devuelve cada búsqueda.

### Pantallas del alumno, con sesión (confirmado el 2026-11-12)

Se relevó con la sesión de un alumno de Ingeniería en Informática, en Chrome. Fueron solo pedidos `GET` desde la misma pestaña y un filtro de consulta: no se envió ningún formulario. Todas las pantallas responden 200 con la cookie de sesión y llegan armadas desde el servidor con el mismo formato de pagelets. Las columnas son texto de la interfaz; los datos quedan como forma (`9` dígito, `a` letra).

| Método del puerto | Pantalla (`/portal/…`) | Qué trae | Estado hoy |
|---|---|---|---|
| `courseEnrollments` | `inscripciones`, pagelet `cursadas` | Fecha inscripción, Año, Período lectivo, Propuesta, Actividad, Comisión, Subcomisión, Turno, Cátedra, Ubicación, Estado, Comprobantes, Moodle | Con datos. Pagelet aparte `examenes` para las inscripciones a examen |
| `history` | `historia_academica` | Renglones `.catedra` agrupados por `.titulo-corte` (año y período). Cada uno: tipo (Promoción, Examen, Regularidad), nota `9.99`, resultado, fecha `99/99/9999` y un enlace «Detalle» (`data-origen`, id de materia) | Con datos. La lista sale de `GET historia_academica/?checks=PromocionA,RegularidadA,…,CreditosA,&modo=materia&e_cu=A&e_ex=A&e_re=A`; el detalle de cada renglón es un `POST` por `kernel.ajax.call` (no se llamó) |
| `provisionalResults` | `actuacion_provisoria`, pagelet `cursa` | Propuesta, Actividad, Fecha, Nota, Resultado, Nro. Acta, Año Académico, Período Lectivo, Comisión | Con datos. Pagelets `promo` y `exa` vacíos |
| `assessments` | `cronograma_evaluaciones`, pagelet `listado` | Una tabla por comisión: Fecha, Evaluación, Tipo, Hora Inicio, Hora Fin, Observaciones | Con datos: el SIU real **sí** tiene cronograma (`hasAssessmentSchedule=true`) |
| `studyPlan` | `plan_estudio`, pagelet `info_plan` | Encabezado (propuesta, plan con versión, promedio) y tabla: Actividad, Tipo, Año, Período, Nota, Origen, Créditos, Puntaje, Correlativas | Con datos |
| (avance) | `porcentaje_avance_carrera` | Certificado, Orientación, Ori. Elegida, % de Avance, Aprobadas, Promedio con y sin aplazos | Con datos. No hay método del puerto para esto |
| `absences` | `reporte_inasistencias` | — | «No se registran inasistencias correspondientes a los períodos lectivos vigentes.» No se pudo ver la forma con datos |
| `sections`, `terms` | `oferta_comisiones`, `cursada` | — | «No hay ofertas disponibles» y «No hay actividades disponibles para inscribirse»: hoy no hay período abierto |
| `examBoards`, `examEnrollments` | `examen` | — | «No hay actividades disponibles para inscribirse» |
| `meetsCertificateConditions` | `solicitudes` | Listado de solicitudes y el enlace `solicitudes/nueva_solicitud` | No se abrió el formulario nuevo |
| `person` | barra superior | Selector de propuesta («Ingeniería en informática»); cambia por `acceso/cambiar_carrera` | — |
| curso de Moodle de cada comisión | `inscripciones`, columna Moodle | Enlace `inscripciones/curso_moodle/cursada/<token>` que redirige al Campus | El `fetch` cruzado falla por CORS. **Inferencia:** un `fetch` del servidor sin seguir la redirección lee el `Location` con el id del curso |

Consecuencias para el adaptador (**inferencia**):
- Hay que parsear HTML, pero con una estructura estable: el JSON de `on_arrival`, tablas con `<th>` y clases como `.catedra`. Se puede hacer sin dependencias.
- Hoy no hay ningún período de inscripción abierto, así que no se puede ver ni probar la escritura real. Para la demo, `enroll` y `drop` quedan en `no-soportado` y la app manda al alumno a `selfServiceUrl`.
- Las tablas no traen ids del SIU de materia ni de comisión, solo nombres y códigos. El adaptador tiene que armar ids estables a partir de esos códigos.

## Caminos por sistema

### Campus Virtual (Moodle)

| Camino | Credencial (`.env.local`) | Métodos del puerto que cubre | Riesgo | Esfuerzo |
|---|---|---|---|---|
| A. REST con el token de la app (`webservice/rest/server.php`) | `MOODLE_TOKEN`, generado una vez por `launch.php` con la sesión de Microsoft | `coursesOf`, `announcements`, `contents` (con archivos), `assignments`, `courseUrl`. `coursesForSection` necesita el vínculo con el SIU | Bajo: es la API oficial de la app. Generar el token es una escritura en la cuenta | Bajo: `fetch` y JSON |
| B. AJAX con la sesión (`lib/ajax/service.php`) | `MOODLE_SESION` (cookie) + `sesskey` | `coursesOf`, `assignments`, `contents` sin archivos. Los avisos no | Medio: la sesión vence y el `sesskey` se lee del HTML | Medio |
| `enrol` / `unenrol` | — | Ninguno: el alumno no puede | — | — |

### SIU Guaraní

| Camino | Credencial (`.env.local`) | Métodos del puerto que cubre | Riesgo | Esfuerzo |
|---|---|---|---|---|
| API REST `/rest/v2/` | Usuario de la institución (basic o digest) | Todos los de lectura | Descartada para el alumno: pide un usuario institucional ([nota del 10/11](2026-11-10-siu-guarani-integracion.md), sección 3) | — |
| API-App del SIU | — | — | No encontrada para la Austral | — |
| Leer el 3W con la cookie del alumno | `SIU_SESION` (cookie `siu_sess__portal_ua_UA`), pegada desde el navegador | `courseEnrollments`, `history`, `provisionalResults`, `assessments`, `studyPlan`, `person`. Además `absences`, `sections`, `examBoards` y `examEnrollments` cuando haya datos o un período abierto | Alto: es HTML de pantallas, la sesión vence y no se puede renovar sola (SAML con Microsoft) | Medio-alto: un parser por pantalla |
| Páginas públicas (`fecha_examen`, `horarios_cursadas`) | Ninguna | `examBoards`, `sections` y `terms` (la oferta) | Medio: HTML con `POST` de filtro | Medio |
| `enroll` / `drop` reales | La misma cookie | — | No se puede relevar hoy: no hay período abierto. El alumno pidió no hacer escrituras | — |

## Recomendación

1. **Moodle primero, por el camino A.** Cubre todo el puerto de lectura con la API oficial y entra para la demo del 13/11. Hay que generar el token, y eso es una escritura: la decide el alumno dueño de la cuenta.
2. **SIU leyendo el 3W con la cookie, para las lecturas de la persona real.** Ya está hecho: `HACKAI_SIU_REAL=si` (`hackai/lib/adapters/siu-real/`, sección «Prueba con el adaptador»). Lo demás sigue en el simulado. Es frágil porque la cookie vence y hay que pegarla de nuevo.
3. **Inscribir y dar de baja de verdad no entra en la demo.** Hoy no hay período abierto para relevarlo ni probarlo, y la regla dura «solo lectura» sigue vigente. Para el pitch: «en producción, la institución le da a HackAI un usuario de la API REST de Guaraní y la inscripción sigue en la Autogestión».
4. **Datos personales (Ley 25.326):** las credenciales van solo en `.env.local`, los datos se guardan solo en la caché en memoria (`lib/adapters/cache/`) y nunca en Supabase ni en logs, y cada integrante usa su propia cuenta.

## Prueba con el adaptador (2026-11-12)

Con `HACKAI_SIU_REAL=si`, la cookie en `.env.local` y la cuenta de un alumno, solo lecturas:

- **El servidor lee con la cookie.** Un `fetch` de Node con `siu_sess__portal_ua_UA` recibe las mismas páginas que el navegador (200, mismos pagelets). Sin sesión, el SIU devuelve la pantalla de acceso (`op_actual: 'acceso'`, botón `auth=saml`): el adaptador lo toma como `falla-externa` y avisa por consola.
- **El enlace «Moodle» de Mis inscripciones** responde `302` a `https://campusvirtual.austral.edu.ar/course/view.php?id=<n>`. Con eso se vincula cada comisión con su curso del Campus sin adivinar.
- **Marcado real que hubo que respetar:** la historia usa comillas simples (`class='catedras'`) y atributos con mayúscula (`Promocion="Promocionado"`). Las páginas vienen en ISO-8859-1.
- **Optativas.** El plan no las lista: son «materias genéricas» que la pantalla carga aparte (`POST plan_estudio/optativas`, con el `data-elemento` del acordeón). La lista trae créditos por optativa, y «Nota» solo en las aprobadas. La regla pide horas («Obtener <n> horas de actividades aprobadas»), y su botón «Verificar» (`url_verificar_cumplimientos`) responde «… Lleva <n> horas». Las horas de cada optativa salen de esa proporción: horas que lleva sobre los créditos de las optativas aprobadas. Con la cuenta relevada, coincide con las horas del SIU. Lo aprobado que no está en esa lista (seminarios, otras propuestas) queda fuera del plan.
- **Vida Universitaria.** Reportes > Vida Universitaria (`reporte_vu`) da los créditos de cada actividad aprobada, con el mismo nombre que en la historia. El total coincide con el del SIU. Los módulos de actividades «se cumplen siempre», pero «Otros Requisitos» tiene la materia «Programa de Vida Universitaria» con la columna Créditos: los créditos que pide la carrera.
- **Avance.** Reportes > Promedio y porcentaje de avance (`porcentaje_avance_carrera`) da el % de avance que calcula el SIU. HackAI muestra ese (redondeado) en lugar de su estimación.
- **Notas de parciales y TP.** El «Detalle» de cada materia en curso de la historia (`POST historia_academica/detalle_encurso`, con el id del enlace) trae Fecha, Descripción, Tipo, Nota, Resultado y Corregido por. Cada nota va con su evaluación del cronograma, buscada por nombre.
- **Horarios, aulas y cupo.** Horarios de Cursadas es público: `buscar_carreras` y `buscar_periodo` por facultad, y `buscar_horarios` con facultad, carrera y período. Trae una tabla por materia con Comisión, Turno, Día de la semana, Hora inicio-fin, Tipo clase, Aula y Cupo. La facultad del alumno es la que ofrece su propuesta, y los períodos traen sus fechas reales de inicio y fin. Una materia anual de la cuenta relevada no figura en la búsqueda, así que sale sin horario.
- **«Otros Requisitos»** (por ejemplo, la práctica profesional supervisada) es un módulo del plan sin año: cuenta como obligatorio.
- **Parciales de materias cerradas.** El «Detalle» de cada regularidad y promoción (`url_detalle_cursada`, `url_detalle_promocion`) trae la misma tabla que el de las materias en curso. Con la cuenta relevada: 76 notas en 33 regularidades y 5 en 3 promociones. Los exámenes no traen detalle con notas.
- **Inscripción a Materias.** `cursada`, pagelet `lista_materias`: cada materia con la inscripción abierta, «Nombre - (CÓDIGO)», y su enlace `cursada/elegir_materia/<id>`. Ese GET (el que hace la pantalla al elegir la materia) devuelve las comisiones: «Comisión: Nombre - Período», instancias, modalidades, cupo con inscriptos y docentes. El nombre de la comisión puede tener « - »: el período se reconoce con los nombres que publica `buscar_periodo`. No se muestra la fecha de apertura ni de cierre de la inscripción: el puerto la lleva como «abierta hoy, sin fechas» (`enrollmentOpen`), sin completarlas. Mis inscripciones tampoco dice modalidad ni instancia: quedan sin dato. Entre la mañana y la tarde del 2026-11-12 la lista pasó de vacía a 8 materias.
- **Trámites.** `solicitudes` lista las solicitudes (Constancia, Fecha solicitud, Presentar a, Solicitado en, Copias, Estado, Fecha vencimiento; «Descargar certificado» en las Online vigentes). `solicitudes/nueva_solicitud` ofrece las constancias que se pueden pedir (`select#constancia`, cada una con `data-formulario`). La pantalla pide las copias permitidas a `url_cant_copias` y guarda con un POST AJAX a la acción del formulario: `constancia`, `copias`, `presentar`, `observaciones`, `formulario`, `formulario_campo` y `formulario_valor`; la de examen final pide además la mesa (`formulario_campo=llamado_mesa`). **No confirmado:** la forma de la respuesta exitosa, porque no se pidió ninguna constancia de verdad. El enlace «Descargar certificado» por GET devuelve el formulario, no el PDF: **no resuelto**. Los PDF de la historia (`url_pdf` + `/?checks=…&modo=…`, como el botón de la pantalla) y del plan (`url_pdf`) sí se descargan con la sesión. «Descargar Analítico y Diploma Digital»: «No se encontraron trámites de certificación».
- **Asignaciones.** El `info` del pagelet `notificaciones` (el calendario de la pantalla de inscripción) trae `asignaciones`: una por comisión del alumno, con día (`DIA_SEMANA`: 1 domingo, 2 lunes… 7 sábado; contrastado con Horarios de Cursadas), horas, fechas, aula y edificio. El mismo `info` trae datos personales del alumno (nombre y documento): no se leen ni se guardan. Con la cuenta relevada, la comisión de una materia anual figura sin día ni hora: el SIU no tiene cargado su horario en ninguna pantalla.
- **Contraste con Reportes > Promedio y porcentaje de avance:** coinciden las materias aprobadas, y el promedio de HackAI es el «sin aplazos» del SIU, porque el núcleo promedia solo lo aprobado. La estimación de avance de HackAI difería en unos puntos (**inferencia:** el SIU pondera por horas o créditos); por eso ahora se muestra el del SIU.

## No confirmado

- Cuánto dura la sesión del SIU antes de vencer.
- La forma real de la oferta de comisiones, las mesas, las inscripciones a examen y las inasistencias: hoy salen vacías.
- Que el token de `launch.php` traiga todas las funciones de la sección «Funciones con la sesión del navegador» (lo dice el código de Moodle; no se probó en la Austral).
- La versión exacta de Guaraní 3: no figura en el HTML.
