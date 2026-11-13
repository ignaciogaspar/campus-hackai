---
status: accepted
date: 2026-11-13
---

# El Campus Virtual real se lee con el token de la app del alumno, en vivo y sin guardarlo

Quien entra a HackAI con su cuenta real del SIU (ADR 0009) veía sus materias reales, pero el aula de cada una seguía siendo la del Moodle simulado. El issue #142 pide que vea, dentro de cada materia que cursa, todo lo que esa materia tiene en el Campus Virtual: archivos, carpetas, páginas, textos, avisos, tareas y cuestionarios. En un alumno de Ingeniería en Informática son 15 cursos y 840 elementos, y el puerto `classroom` cubría el 44 % (solo archivos y enlaces). Research: `docs/research/2026-11-12-datos-reales-siu-campus.md` y `docs/research/2026-11-13-inventario-cursos-campus.md`.

## Opciones consideradas

- **Token de la app móvil (servicio `moodle_mobile_app`):** la API oficial de Moodle en JSON. `core_course_get_contents` da archivos, carpetas, páginas y textos de un curso en una llamada, y hay funciones para avisos y tareas. Sacarlo es una escritura en la cuenta: Moodle crea la clave del servicio móvil o reusa la que ya tiene la app del alumno. Elegida.
- **Cookie de sesión (`MoodleSession` + `sesskey`), leyendo el HTML:** no escribe en la cuenta, pero necesita un parser por tipo de elemento, carpetas y avisos no se pudieron confirmar, cada página leída cuenta como vista en el aula, y la sesión vence a las horas. Rechazada.
- **Enlazar al aula y no traer nada:** lo más simple, pero el alumno sigue saliendo de HackAI para todo. Rechazada.

## Decisión

- **Credencial:** el alumno pega su sesión del Campus en HackAI, como la del SIU (`/conectar-campus`, segundo paso después de entrar con el SIU y que se puede saltear). El servidor la canjea una vez por el token de la app: pide `admin/tool/mobile/launch.php` con esa sesión, sin seguir la redirección, y lee el token de `<esquema>://token=<base64>`, validando el `md5(wwwroot + passport)`. La sesión no se guarda. El token viaja cifrado en una cookie del navegador de su dueño (`hackai_campus`, `lib/campus-session.ts`), nunca en la base ni en logs. Antes de conectarlo se prueba que lea (`core_webservice_get_site_info`).
- **Dónde vive lo leído:** en memoria. Los cursos que se leen con la cuenta de una persona se marcan `liveOnly` en el puerto, y Espacios los muestra en vivo (`lib/core/spaces/classroom-live.ts`) en vez de importarlos: ni el material ni los avisos van a la base. Son datos de terceros (docentes, compañeros). Cambiar la regla para guardarlos queda rechazado.
- **Qué se trae:** todos los elementos del curso, en el orden y con los temas del aula. Con contenido dentro de HackAI: archivos, carpetas con sus archivos, páginas con su texto, textos sueltos, enlaces, los avisos del foro de Avisos y la consigna y el estado de cada tarea. Como enlace al aula: cuestionarios, los demás foros, listas de control, encuestas, asistencia y cualquier otra actividad. Entregar, responder un cuestionario o escribir en un foro siguen en el Campus.
- **Archivos:** la ruta `/aula/archivos/<ruta de pluginfile.php>` los pide a Moodle con el token de quien los abre y se los pasa al navegador, con los headers de seguridad de los archivos guardados (`lib/file-delivery.ts`). El token no sale del servidor, el PDF se ve dentro de HackAI y el archivo no se guarda.
- **Vistas en el aula:** HackAI usa solo funciones de lectura (`core_course_get_contents`, `mod_page_get_pages_by_courses`, `mod_forum_get_forum_discussions`, `mod_assign_get_assignments`, `mod_assign_get_submission_status`) y nunca las `*_view_*`, que son las que registran una vista o marcan la actividad como completada. El texto de las páginas sale de `mod_page_get_pages_by_courses`, sin abrir cada página. Por eso el puerto no suma un método para «abrir» un elemento, que el plan del issue preveía para el camino de la sesión.
- **Qué cursos:** los vinculados a las comisiones del alumno en el SIU real. El enlace «Moodle» de Mis inscripciones responde `302` a `course/view.php?id=<n>` (`moodleCourses` del SIU real), y solo entran los cursos en los que está matriculado. Los demás cursos «en progreso» de Moodle quedan afuera.
- **Adaptador:** `lib/adapters/moodle-real/` con `fetch` del servidor, sin dependencias (ADR 0002). Un registro por cuenta, como el del SIU real: ids `real-<clave>-…` y todo lo demás al aula de la demo, así las personas sintéticas siguen con el Moodle simulado. No matricula: el alumno no puede matricularse solo en el Campus, y Cursada no matricula en un curso `liveOnly`. Cada lectura se guarda un minuto.
- Prendido junto con las cuentas reales del SIU; `HACKAI_CAMPUS_REAL=no` lo apaga. `MOODLE_URL` fija el Campus si no es `https://campusvirtual.austral.edu.ar`.

## Consecuencias

- El token es la llave de lectura de la cuenta del Campus y dura más que la sesión (12 semanas por defecto según el código de Moodle 4 y 5; sin confirmar en la Austral). La cookie dura un mes y se borra al salir. El alumno lo da de baja en el Campus, en Preferencias › Claves de seguridad; si Moodle deja de reconocerlo, el material lo dice y pide conectar de nuevo.
- Generar el token es una escritura en la cuenta. El texto de consentimiento lo dice antes de conectar.
- Pasan por el servidor archivos y avisos de docentes (Ley 25.326): se leen con la cuenta de quien los ve, solo se muestran a esa persona y no se guardan. Las condiciones de uso del Campus sobre acceso automatizado: no encontradas.
- En el celular vale lo mismo que con el SIU: no se puede copiar la cookie, así que el Campus se conecta desde la compu.
- En el hosting sin estado, una instancia nueva vuelve a leer todo: la primera apertura de una materia puede tardar unos segundos.
- Lo leído en vivo no cuenta como nuevo ni entra en la búsqueda del espacio: no hay dónde guardar la marca de leído sin guardar el elemento.
- Además, con el Moodle simulado y en memoria, carpetas, páginas, textos y actividades también se muestran en vivo: el material guardado sigue teniendo solo archivos y enlaces.
- Sin probar contra la cuenta real al escribir esta decisión: que el token de `launch.php` traiga todas esas funciones en la Austral. El plan del issue #142 tenía esa prueba como fase 0; su resultado va en la nota de research del 13/11.
- Pedido de implementar el plan del issue #142 el 2026-11-13, con la credencial elegida por el equipo. Cambia la decisión 4 de `docs/product/preguntas-abiertas.md` («Moodle sigue simulado»).
