# Qué tiene cada curso del Campus Virtual de un alumno

Fecha: 2026-11-13.

Pregunta: ¿qué significa «todo el material» de las materias que cursa un alumno, y cuánto de eso cubre hoy el puerto `classroom` (`hackai/lib/ports/classroom.ts`)?

## Método

- En Chrome, con la sesión de un alumno de Ingeniería en Informática ya iniciada, desde la pestaña de Mis cursos. Solo lecturas: no se envió ningún formulario ni se generó ningún token.
- `core_course_get_enrolled_courses_by_timeline_classification` (`inprogress`) para la lista de cursos y `core_courseformat_get_state` por curso para sus módulos, las dos por `lib/ajax/service.php` con el `sesskey` ([nota del 12/11](2026-11-12-datos-reales-siu-campus.md)).
- Para ver si la sesión alcanza para leer el contenido, se pidió por `GET` la página de 4 recursos, 3 carpetas y 3 páginas, como al abrirlas con un click. Moodle registra cada una como vista.
- No se registran nombres de cursos, docentes ni archivos: solo cantidades y tipos.

## Inventario (confirmado)

15 cursos «en progreso» y 840 módulos en total. Por curso van de 3 a 148 (102, 29, 9, 71, 148, 18, 68, 16, 11, 3, 102, 91, 27, 78, 67).

| Módulo (`cm.module`) | Cantidad | Qué es | Puerto `classroom` hoy |
|---|---|---|---|
| `label` | 207 | Texto o imagen suelta entre recursos | No |
| `resource` | 195 | Un archivo | Sí: `contents`, tipo `file` |
| `url` | 171 | Un enlace | Sí: `contents`, tipo `url` |
| `folder` | 68 | Carpeta con varios archivos | No |
| `forum` | 58 | Foros; uno por curso es el de Avisos | Solo Avisos: `announcements` |
| `page` | 50 | Página de texto dentro de Moodle | No |
| `assign` | 48 | Tarea | Parcial: `assignments` trae nombre y fecha, no la consigna ni el estado de la entrega |
| `quiz` | 22 | Cuestionario | No |
| `checklist` | 16 | Lista de control (plugin) | No |
| `subsection` | 3 | Subsección | No |
| `questionnaire` | 1 | Encuesta (plugin) | No |
| `attendance` | 1 | Asistencia (plugin) | No |

Consecuencias:

- El puerto cubre hoy 366 de 840 módulos (`resource` y `url`), el 44 %. Para «todo» faltan, por peso: `label`, `folder`, `page`, los foros que no son Avisos y `quiz`.
- **«En progreso» no es «lo que estoy cursando».** Entre los 15 hay cursos que empezaron en febrero y marzo: Moodle los sigue clasificando en progreso. Las materias en curso salen del SIU, y cada comisión se vincula con su curso por el enlace «Moodle» de Mis inscripciones (confirmado en la nota del 12/11).

## Qué se lee con la sesión, sin token

| Módulo | Con la cookie `MoodleSession` | Estado |
|---|---|---|
| Estructura del curso, temas, nombres y enlaces | `core_courseformat_get_state` | Confirmado |
| `resource` | La página del recurso (`mod/resource/view.php`) responde 200 en HTML y trae el enlace `pluginfile.php/…/mod_resource/content/…` del archivo | Confirmado en 3 recursos. No se descargó ningún archivo |
| `page` | La página responde con contenido en `[role="main"]` | Responde; falta el selector que separa el texto del resto de la pantalla |
| `folder` | La página de la carpeta no trae enlaces a `mod_folder/content` en el HTML | **No confirmado:** no se encontró dónde lista los archivos |
| Avisos y demás foros | — | **No confirmado** (nota del 12/11) |

## Sin ver

- El contenido de `label`, `quiz`, `checklist`, `questionnaire` y `attendance`.
- Que el token de la app (`launch.php`) habilite `core_course_get_contents` en la Austral: daría archivos, carpetas, páginas y etiquetas en una sola llamada por curso. No se generó el token porque es una escritura en la cuenta.
- Si abrir un recurso desde HackAI marca la actividad como completada en Moodle: cada lectura con la sesión cuenta como vista del alumno.

## Con el token de la app (fase 0 del issue #142)

Probado el 2026-11-13 con la cuenta de un alumno de Ingeniería en Informática, que conectó su Campus en HackAI corriendo en local (`/conectar-campus`). Se miró solo el log del servidor, sin valores: ni la sesión, ni el token, ni nombres.

| Qué | Resultado |
|---|---|
| Canje de la sesión por el token: `launch.php` pedido por el servidor con la cookie `MoodleSession`, sin seguir la redirección | **Confirmado.** Devuelve el token y el `md5(wwwroot + passport)` coincide |
| `core_webservice_get_site_info` con el token | **Confirmado** |
| Cursos y elementos de cada curso (`core_enrol_get_users_courses`, `core_course_get_contents`) | **Confirmado.** El material de dos materias en curso salió con sus archivos |
| Archivos por `webservice/pluginfile.php` con el token | **Confirmado.** Un PDF del aula se abrió dentro de HackAI (`/aula/archivos/…`, 200) |
| Avisos y tareas (`mod_forum_*`, `mod_assign_*`) | Sin errores en el log al abrir `#avisos` y las materias. El alumno confirmó que «anda»; no se miró el contenido |
| Vínculo comisión → curso por el enlace «Moodle» del SIU real | **Confirmado** |

Sin ver todavía: cuánto dura el token en la Austral (Moodle 4 y 5 traen 12 semanas por defecto) y si alguna lectura marcó una actividad como vista en el aula.
