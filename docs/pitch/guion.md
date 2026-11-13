# Guion del pitch

Pitch del 13/11/2026, en el orden de «La historia de su demo»: problema, usuario, antes y después, demo, evidencia y próximo paso. Dura unos 13 minutos con la demo adentro, repartidos entre cuatro personas de a unos 3 minutos cada una.

**Regla de todo el pitch:** decir qué es real y qué está simulado, sin esperar a que lo pregunten.

## Quién dice qué

| Persona | Slides | Tiempo | Además |
| --- | --- | --- | --- |
| **Persona 1** | 1 a 6: portada, problema, usuario y estrategia | 3:30 | Abre el pitch |
| **Persona 2** | 7 y 8.1: antes y después, demo del alumno | 3:00 | Maneja la compu en la demo del alumno |
| **Persona 3** | 8.2 y 8.3: demo del docente y de secretaría | 3:00 | Publica el aviso en vivo durante la demo del alumno |
| **Persona 4** | 9 a 13: real y simulado, evidencia, iteraciones, próximo paso y cierre | 3:15 | Cierra el pitch |
| | | **12:45** | |

Cada persona termina con una frase de pase que nombra a la siguiente.

**Antes de empezar:** la app abierta en `campus-hackai.vercel.app` y el servidor de Discord del equipo a la vista (otra ventana o un celular). Dentro de la app no se cambia de persona: hay que cerrar sesión y elegir otra en el ingreso. Por eso conviene dejar las cuatro sesiones abiertas de antemano, cada una en su ventana de incógnito o en su perfil del navegador:

| Sesión | Quién la maneja | Para qué |
| --- | --- | --- |
| Tomás Aguirre (alumno) | Persona 2 | Toda la demo del alumno |
| Mariana Ledesma (docente) | Persona 3, en otro dispositivo | Publicar el aviso: dicta Análisis Matemático I, donde cursa Tomás |
| Diego Arrieta (docente) | Persona 3 | Tomar lista y cargar notas: es el único docente con clase los viernes |
| Secretaría | Persona 3 | Planning y Reportes |

Probar el recorrido completo una vez en la última hora, con estas mismas personas.

**Entorno, a revisar en esa última hora.** Sale de leer el código; nadie lo comprobó contra Vercel ni Supabase:

- La migración `0014_reports_follow_ups.sql` está aplicada. Si falta, «Seguir a este alumno» falla con «No pudimos guardarlo porque la base no responde».
- El Planning tiene una planilla cargada. Si está vacío, el alumno ve «Secretaría todavía no cargó las aulas» y la ficha de Reportes marca «No figura en el Planning» en cada materia.
- Esa planilla trae un cambio de aula de **Análisis Matemático I, comisión A**, entre el día de la demo y una semana después: es el aviso que le llega a Tomás en el paso 8.1-6. Tiene que caer el día de su clase semanal; si no, cuenta como clase extra y no se avisa. La planilla de ejemplo de «Cargar clases» trae los dos: la clase de los lunes y el cambio del lunes 16/11. Tocar el aviso lo marca visto en ese navegador: en el ensayo, mirarlo sin tocarlo, o ensayar en otra ventana de incógnito.
- La migración del Moodle simulado `supabase/simulados/0004_moodle_contenidos.sql` está aplicada: el material de las materias lee sus columnas nuevas.
- Variables: `HACKAI_STORE=supabase`, `HACKAI_CLOCK=sistema`, `HACKAI_EXTERNAL_CHANNEL=discord` con `DISCORD_BOT_TOKEN`, `HACKAI_CACHE_SEGUNDOS=0` (si no, la nota publicada puede tardar hasta 5 minutos en verse) y `HACKAI_SIU_REAL_PUBLICO=no`, para que no aparezca «Entrá con tu cuenta del SIU» en el ingreso.
- Los canales de Discord vinculados se pierden al correr `demo:preparar`: volver a vincularlos después.
- El enlace de Zoom no viene sembrado y `demo_reset.sql` lo borra: cargarlo en «Alumnos y clases» o no nombrar Zoom.
- `demo_reset.sql` no limpia los alumnos en seguimiento ni el Planning: pueden quedar restos de un ensayo.
- `demo:verificar` no cubre Planning, Cargar clases ni Reportes: la parte de secretaría se ensaya a mano.

**Sin confirmar con el equipo:**

- **Cuántas entrevistas y cuántos docentes** (slides 4 y 10). El guion dice «3 docentes» y «6 entrevistas». Según `docs/entrevistas/`, la persona de la Dirección de Estudios es también la docente de Comunicación de los 120 alumnos, así que cuenta dos veces; y lo del profesor del 12/11 lo contó por escrito un integrante, no fue una entrevista directa. Recontar y corregir las dos slides con el mismo número.
- **Si se habló con secretaría** (slide 5). En la entrevista de la Dirección de Estudios alguien del equipo dice «recién hablábamos con secretaría», pero no hay notas de esa charla en `docs/entrevistas/`. El guion nombra a la secretaría sin decir si se la entrevistó; si hubo charla, decirlo.

**Videos de la demo en el deck.** Después de la slide 8 hay dos slides, «Demo 1» y «Demo 2», con el recorrido completo del docente y de gestión en una sola toma, a ritmo lento y con un rótulo abajo para cada acción:

| Slide | Video | Dura | Datos |
| --- | --- | --- | --- |
| Demo 1 · docente | `docs/pitch/video/docente.mp4` | 1:27 | Diego Arrieta, sintético, con el SIU simulado |
| Demo 2 · gestión | `docs/pitch/video/gestion.mp4` | 1:37 | Secretaría, sobre la población sintética |

Cada slide muestra el título y la compu con el video quieto; el primer avance lo agranda a pantalla completa y lo arranca, y el siguiente pasa de slide. No tienen sonido: se narra encima. No cuentan en la numeración de las slides. Se grabaron en localhost con los adaptadores en memoria, sin tocar Supabase ni Discord.

**La parte del alumno va en vivo** (decisión del 13/11): Persona 2 hace 8.1 en la app, sin video.

**Sin decidir con el equipo:** si Persona 3 narra los videos o hace su parte en vivo. Los dos videos suman 3:04, lo mismo que su tiempo. Si va en vivo, las dos slides se pasan de largo con cuatro avances, o se salta a la 9 escribiendo `#11` al final de la dirección.

**Si la demo falla:** Persona 2 y Persona 3 pasan a las slides de respaldo (Mis materias, espacio de la materia, inscripción, lado del docente y una captura de reportes) y siguen su parte del guion sin cambiar el orden.

---

# Persona 1 · 3:30

## 1. Portada · 0:20

**En pantalla:** HackAI. «Un solo lugar que te dice qué te toca y te avisa a tiempo.» Los cuatro nombres. Pitch, 13 de noviembre de 2026.

> Buenas tardes. Somos Facundo, Ignacio, Marco y Facundo. En una semana rediseñamos la experiencia del SIU Guaraní y del Campus Virtual. Lo que construimos se llama HackAI y se resume en una promesa: un solo lugar que te dice qué te toca y te avisa a tiempo.

## 2. Problema: dos sistemas que no se hablan · 0:40

**En pantalla:**
- SIU Guaraní: inscripciones, historia académica, plan, constancias.
- Campus Virtual (Moodle): aulas, material, entregas, avisos.
- Cada uno con su calendario, su bandeja y sus notas.
- Único puente entre los dos: el botón «Ir».
- Pie: relevamiento de SIU y Campus, 10/11/2026.

> La vida académica en la Austral está partida en dos sistemas. El SIU tiene lo administrativo; el Campus, que es un Moodle, las aulas y el material. Cada uno tiene su calendario, su bandeja y sus notas, y no se hablan: el único puente que encontramos es un botón «Ir» escondido en un reporte del SIU. Entonces el que cruza la información es una persona, a mano. Si es un alumno, cuando se le escapa un aviso pierde un cupo, un crédito o una fecha. Y si es alguien de gestión, como vamos a ver, se baja ochenta reportes.

## 3. Problema: qué les duele a los alumnos · 0:20

**En pantalla, dos columnas:**

*Encuesta a alumnos (n = 39, cinco facultades, 6 al 10/11):*

| Problema | % |
| --- | --- |
| Cursos viejos mezclados con los actuales | 56% |
| Aulas con organización confusa | 54% |
| Inscribirse a materias o exámenes en el SIU | 54% |
| Se usa mal desde el celular | 49% |
| Avisos que no llegan (lo más pedido en texto libre) | 44% |

*Quiénes respondieron y qué pidieron:*

- **5 facultades:** 39 respuestas, del 6 al 10/11.
- **Lo más pedido:** que los avisos lleguen, cuando los dejamos escribir.
- **Lo que se pierde:** créditos y optativas, por no enterarse a tiempo (texto libre de la encuesta).

Pie: «Encuesta a alumnos, n = 39, cinco facultades, 6 al 10/11.»

> No lo supusimos: lo preguntamos. Respondieron 39 alumnos de cinco facultades. Más de la mitad se queja de los cursos viejos mezclados, de las aulas desordenadas y de la inscripción en el SIU. Y el 44 por ciento dice que los avisos no llegan: fue lo más pedido cuando los dejamos escribir, y ahí aparecieron créditos y optativas perdidos por no enterarse a tiempo.

## 4. Problema: y a docentes y gestión · 0:50

Todo sale de las entrevistas del 12 y 13/11 (`docs/entrevistas/`). Son datos contados por quien los vive, no medidos por el equipo: decirlo así si lo preguntan.

**En pantalla, dos columnas:**

*Docentes (entrevistas, 12 y 13/11):*

- **10 a 15 minutos** para tomar lista en el SIU, en cada clase (profesor, 12/11).
- **3 cargas por nota:** Moodle, después un Excel y después el SIU: «hay como tres pasos y en esos pasos hay errores» (docente de la Dirección de Estudios, 13/11).
- **120 alumnos, 6 notas:** cuatro trabajos prácticos y dos parciales por alumno en un cuatrimestre. Al SIU solo suben los parciales y la nota final; el detalle queda en un Excel (la misma docente).

*Gestión (Dirección de Estudios, 13/11):*

- **80 reportes:** el reporte se baja por carrera y por año de ingreso. 20 carreras por 4 años, para ver un solo indicador de toda la universidad.
- **3 reportes por alumno:** la ficha, el plan de estudios y los créditos de Vida Universitaria están en reportes distintos, sin conexión entre sí: «no existe un lugar donde esté todo eso junto».
- **«Meses, años»:** lo que tarda un tablero nuevo de Power BI. Hay que armar un business case, esperar al área de sistemas y pedir la autorización de Gobierno de Datos.

Abajo, la cita: «Al final estás sacando datos de un lugar para llevarlos a otro.» (Dirección de Estudios).

Pie: «Entrevistas a 3 docentes, Admisiones y la Dirección de Estudios, 12 y 13/11.»

> Después hablamos con docentes y con gestión, y apareció el mismo problema del otro lado. Un profesor nos contó que tomar lista en el SIU le lleva hasta quince minutos por clase. Una docente con 120 alumnos corrige en Moodle, pasa las notas a un Excel y después las carga en el SIU: tres pasos, y en esos pasos hay errores. Son seis notas por alumno, así que al SIU solo suben los parciales y la nota final. Esa misma persona trabaja en la Dirección de Estudios, que acompaña a los alumnos de toda la universidad. Para ver un solo indicador baja un reporte por carrera y por año de ingreso: ochenta reportes. Para ver a un alumno, la ficha, el plan de estudios y los créditos están en tres reportes que no se conectan. Y un tablero nuevo de Power BI, con sistemas y Gobierno de Datos, le lleva meses. Lo resumió ella: al final estás sacando datos de un lugar para llevarlos a otro.

**Si sobra tiempo**, lo de la profesora del 12/11: del SIU lo que más necesita son reportes por materia, y hoy baja varios y los junta a mano. Une el lado docente con el de gestión.

## 5. Usuario: para quién lo construimos · 0:35

**En pantalla, tres columnas en orden de prioridad:**

| | Quién | Qué necesita | Le respondemos |
| --- | --- | --- | --- |
| **Primero** | El alumno de grado | Cursa varias materias, vive en el celular y revisa dos sistemas | ¿Qué me toca? ¿A qué me puedo anotar? ¿Hay algo nuevo? |
| **Después** | El docente | Publicar, tomar lista, corregir y cargar notas una sola vez | Avisos que llegan, lista en segundos, notas sin pasos de más |
| **Gestión** | Secretaría y Dirección de Estudios | Asignar aulas y seguir a los alumnos que se están quedando | ¿Cómo vienen? ¿Quién está en riesgo? ¿Qué le falta a este alumno? |

> El usuario principal es el alumno de grado, y lo que necesita son tres respuestas: qué me toca, a qué me puedo anotar y si hay algo nuevo. Después, el docente: publicar, tomar lista y cargar notas, una sola vez. Y un tercero que no teníamos hasta esa entrevista: gestión, que es la Dirección de Estudios y la secretaría que asigna las aulas. Su pregunta es otra: cómo vienen todos, quién está en riesgo y qué le falta a cada uno para recibirse.

## 6. La estrategia: sistema propio, apoyado en lo que ya existe · 0:40

**En pantalla:** el diagrama (SIU, Moodle y Discord → puertos y adaptadores → núcleo → pantallas de alumno, docente y secretaría) y los tres principios:

1. **Delega lo que ya anda bien.** Actas, constancias y la historia oficial siguen en el SIU.
2. **Resuelve lo que nadie resuelve.** Qué me toca, avisos que llegan, inscripción en un paso, lista en segundos, reportes cruzados.
3. **Aísla cada sistema.** Si mañana cambia el SIU, se cambia un adaptador y no la aplicación.

> La consigna permitía construir desde cero, sobre Moodle y el SIU, o envolver lo que hay. Elegimos una combinación. HackAI es un sistema propio que no reemplaza nada: el SIU, Moodle y Discord entran por un puerto, cada uno con su adaptador. La regla es simple: si un sistema existente resuelve algo bien, HackAI lo delega; si no lo resuelve nadie, lo resuelve el núcleo. Y como cada sistema está aislado, si mañana cambia el SIU, cambiamos un adaptador y no la aplicación.

**Pase:**
> Pero lo que importa es qué cambia para cada uno. Persona 2 se los muestra.

---

# Persona 2 · 3:00

## 7. Antes y después: cómo cambia cada trámite · 1:00

**En pantalla:**

| Trámite | Hoy, en SIU y Campus | Con HackAI |
| --- | --- | --- |
| Saber qué me toca esta semana | Calendario del Campus + Cronograma del SIU: 3 clicks, en dos sistemas | 1 click: un solo calendario |
| Enterarme de un aviso | Inicio › curso › Avisos › aviso: 3 clicks, y solo si entrás a mirar | Te llega por Discord; en HackAI, a 1 click |
| Inscribirme a una materia | 3 clicks; el cupo se ve al final | 3 clicks, con el cupo y el horario antes de elegir, y quedás en el aula y el espacio |
| Saber qué finales debo | Cruzar la historia académica con las mesas, a mano | 1 click: pestaña «Final pendiente», con su mesa |
| **Docente:** tomar lista | 10 a 15 minutos, alumno por alumno | Todos presentes y tocás a los ausentes: 4 toques en una clase de 30 con 3 ausentes |
| **Docente:** cargar las notas | Moodle → Excel → SIU, alumno por alumno | Se cargan una vez en HackAI, se pegan de una planilla y pasan al SIU |
| **Gestión:** ver cómo viene una cohorte | 1 reporte por carrera y año de ingreso; 80 para toda la universidad en 4 años | 1 pantalla con varias facultades, carreras y cohortes, que se exporta |

Pie: «Hoy: línea base del 10/11 y entrevistas. HackAI: contado por el equipo, con datos sintéticos.»

> Esto es lo que cambia, trámite por trámite. A la izquierda, lo que medimos navegando el SIU y el Campus reales y lo que nos contaron en las entrevistas. A la derecha, lo mismo en HackAI. Para el alumno: un calendario en vez de dos, el aviso que te llega en vez de ir a buscarlo, y los finales que debés en una pestaña, sin cruzar pantallas. Para el docente: la lista arranca con todos presentes y solo tocás a los que faltan, y las notas se cargan una vez. Para gestión: lo que hoy son ochenta reportes es una pantalla. Una aclaración: los números de HackAI los contamos nosotros sobre datos sintéticos; medirlos con usuarios es lo que sigue.

## 8. Demo en vivo

**Frase de entrada:**
> Ahora lo ven andando. Lo que van a ver corre con personas sintéticas. Discord es real; el SIU y el Moodle están simulados con la forma de sus APIs.

### 8.1 Alumno · 2:00

| Paso | Qué se hace | Qué se dice |
| --- | --- | --- |
| 1 | Ingreso de demo → elegir a **Tomás Aguirre** | «En producción se entra con la cuenta Microsoft de la Austral; acá elegimos una persona sintética.» |
| 2 | Cae en **Materias** (la pantalla se titula «Mis materias») | «Solo lo que cursa hoy. Las viejas están archivadas. Cada tarjeta muestra horario, aula y la próxima entrega.» |
| 3 | En la misma pantalla, pestaña **Final pendiente** | «Lo que el SIU no responde: qué finales debo y su próxima mesa.» Tomás tiene dos, cada uno con su mesa |
| 4 | Volver a «En curso» → entrar a **Análisis Matemático I** → pestaña **Avisos** | «Cada materia tiene su espacio, que se crea solo desde el SIU, con el material en el mismo orden que el aula.» En la app la pestaña es «Avisos»; `#avisos` es el nombre del canal en Discord |
| 5 | Persona 3 publica un aviso como Mariana Ledesma desde su dispositivo; aparece en la pantalla del alumno y en Discord | «Se publica una vez y llega por Discord, al celular, por la aplicación que ya usa.» Es el momento fuerte: dejar que se vea llegar. La pantalla consulta cada 5 a 20 segundos, así que no prometer un tiempo en voz alta y dejar la pestaña visible |
| 6 | **Campana** → «Cambió la clase de Análisis Matemático I (Comisión A)» → abre el **Planning** en esa clase | «Si secretaría cambia el aula o suspende una clase, le llega a quien la cursa y a quien la dicta.» Sale de la planilla que Persona 3 muestra en 8.3 |
| 7 | **Calendario** → **Agregar a mi calendario** | «Clases, parciales, finales y entregas en un solo lugar. Los parciales, los finales y las entregas van al calendario del celular.» El archivo que se baja no lleva las clases |
| 8 | (Si sobra tiempo) **Inscripciones** → Física I de verano → **Inscribirme** | «El cupo y el horario antes de elegir, y un paso para quedar adentro.» La comisión de la mañana está sin cupo y la de la tarde tiene lugar |

**Pase:**
> Ese aviso lo publicó un docente. Persona 3 les muestra su lado.

---

# Persona 3 · 3:00

Durante la demo del alumno (paso 5), publica el aviso desde la sesión de Mariana Ledesma en su dispositivo: Análisis Matemático I → Avisos → **Publicar**.

### 8.2 Docente · 1:30

| Paso | Qué se hace | Qué se dice |
| --- | --- | --- |
| 1 | Ventana de **Diego Arrieta** → **Hoy** | «Su día en una pantalla: su clase, con Zoom si es virtual, y las consultas sin responder.» Un viernes a la tarde no hay clase en curso: Hoy muestra «Tu próxima clase» y no trae el botón «Tomar lista» |
| 2 | **Materias** → Programación I → **Alumnos y clases** → la clase de hoy → **Tomar lista** → tocar a un ausente → **Guardar lista** | «Todos presentes, toca a los que faltan. En una clase de 30 con 3 ausentes son cuatro toques; hoy le lleva quince minutos.» La comisión de la demo tiene 3 alumnos: tocar a uno solo |
| 3 | Programación I → **Calificaciones** → **Pegar de una planilla** → pegar las filas copiadas de un Excel → vista previa → guardar → **Publicar las notas** | «Corrige una vez. El alumno la ve, y la nota pasa al SIU, que en la demo es el simulado. Cuando le mostramos el prototipo a la docente de los 120 alumnos, nos dijo que cargar las notas desde su planilla es, para ella, la función principal.» Elegir un parcial, que es una evaluación del SIU; la nota de una tarea de HackAI no pasa. Tener las filas ya copiadas. La cita es de la entrevista del 13/11 («yo creo que la función principal»): vio el prototipo de ese día, no la versión de la demo |

**En video** (slide Demo 1, 1:27): Hoy, un aviso a la comisión A, la lista con un ausente y las notas del parcial pegadas de la planilla y publicadas. No muestra el botón «Tomar lista» de Hoy, porque la clase del viernes ya pasó a esa hora.

### 8.3 Secretaría y Dirección de Estudios · 1:30

| Paso | Qué se hace | Qué se dice |
| --- | --- | --- |
| 1 | Ventana de **Secretaría** → **Cargar clases** (mostrar dónde se sube la planilla) → **Planning** | «Secretaría sube la planilla de aulas del cuatrimestre, y alumnos y docentes ven el Planning. De acá salió el cambio de aula que le llegó a Tomás.» El aula de las tarjetas de Materias sale del SIU, no del Planning |
| 2 | **Reportes** → filtro **Facultad**: Ingeniería y Ciencias Empresariales → filtro **Ingreso**: 2024, 2025 y 2026 | «Lo que hoy son ochenta reportes. Activos, ingresantes, graduados y bajas, cruzando facultades, carreras y años de ingreso, y también al cierre de años anteriores.» «Ingresantes» cuenta solo la cohorte del año del reporte: dejar 2026 entre los años elegidos |
| 3 | Tocar una barra de «Por facultad» o un indicador de la tarjeta **Para acompañar** → listado → un alumno | «De un número al listado y del listado al alumno, sin salir de Reportes.» Decir que los indicadores son una propuesta del equipo, todavía sin validar con la Dirección de Estudios |
| 4 | Ficha del alumno: **Lo que le falta** y el plan de estudios, y los créditos de Vida Universitaria | «Es lo que nos pidió la Dirección de Estudios: no lo que el alumno hizo, sino lo que le falta para terminar.» Con más de 4 actividades, Vida Universitaria arranca cerrada: tocar «Ver las N actividades» o elegir el alumno de antemano |
| 5 | **Seguir a este alumno** → pestaña **En seguimiento** → **Exportar CSV** | «Lo marca para seguirlo y se lo lleva en un archivo que abre en Excel.» |

**En video** (slide Demo 2, 1:37): el Planning del día, un cambio de aula de Análisis Matemático I cargado a mano y cómo queda el lunes 16, Reportes con el filtro de dos facultades, la columna de ingreso 2012, el listado, la ficha con lo que le falta y «Seguir a este alumno». No muestra la subida de la planilla ni la exportación.

**Pase:**
> Eso es lo que construimos. Persona 4 les cuenta qué es real, qué medimos y qué sigue.

---

# Persona 4 · 3:15

## 9. Evidencia: qué es real y qué está simulado · 0:40

**En pantalla:**

| Real | Simulado | Pendiente (depende de la universidad) |
| --- | --- | --- |
| Discord: un bot propio, en el servidor del equipo | El SIU y el Moodle de la demo: tablas propias con la forma de sus APIs | Ingreso con la cuenta Microsoft de la Austral |
| La aplicación: publicada, se instala en el celular | Las personas: alumnos, docentes, notas y la población de los reportes son sintéticos | API del SIU y servicios web de Moodle |
| El SIU y el Campus Virtual con la cuenta del propio alumno, desde la compu: leen en vivo sus materias y todo el contenido de sus aulas; el SIU, con su confirmación, inscribe y da de baja. Nada se guarda en la base ni en los logs | En la demo, la inscripción va contra el SIU simulado y el aula sale del Moodle simulado. El pase de notas y de asistencia al SIU es siempre simulado | Datos de toda la universidad para reportes (hoy en Power BI) y autorización de Gobierno de Datos |

> Lo que nos pidieron decir con todas las letras. Es real la integración con Discord, la aplicación publicada, y el SIU y el Campus con la cuenta del propio alumno: desde la compu lee en vivo sus materias y todo lo que tienen sus aulas y, si él lo confirma, lo inscribe de verdad en el SIU; nada de eso se guarda en nuestra base. Está simulado el SIU y el Moodle de la demo, las personas, y lo que vieron recién: la inscripción de la demo y el pase de notas al SIU. Los reportes de gestión corren sobre una población sintética. Y queda pendiente lo que depende de la universidad: el ingreso con Microsoft, los accesos a las APIs y, para los reportes, los datos de toda la universidad con la autorización de Gobierno de Datos.

## 10. Evidencia: qué medimos y qué falta medir · 0:50

**En pantalla:**

| Dato | Qué prueba |
| --- | --- |
| **39** alumnos encuestados, de cinco facultades | El problema |
| **6** entrevistas: alumnas, 3 docentes, Admisiones, Dirección de Estudios | El problema, del lado docente y de gestión |
| **17** tareas frecuentes con sus clicks de hoy | La línea base |
| **13 s** tarda un aviso en aparecer en otra pantalla, sin recargar | La promesa de avisar a tiempo |
| **3 s** para cambiar de canal; antes, de 14 a 28 s | Que se pueda usar |

**Falta:** cronometrar las cinco tareas con alumnos (T1 a T5) y la lista con un docente (T6), hoy contra HackAI. Y mostrarle la pantalla de reportes a la Dirección de Estudios.

> Qué medimos. El problema: 39 alumnos encuestados y seis entrevistas, del lado alumno, docente y de gestión, más una línea base de 17 tareas con sus clicks en el SIU y el Campus reales. La promesa de avisar a tiempo: un aviso publicado aparece en otra pantalla en 13 segundos sin recargar, y en Discord casi al instante. Y que se pueda usar: cambiar de canal tardaba hasta 28 segundos y lo bajamos a 3. Lo que no medimos, y lo decimos: no cronometramos las tareas con alumnos ni la lista con un docente. Tenemos el protocolo armado.

**Si sobra tiempo**, la cita de la Dirección de Estudios sobre lo que tarda hacer un tablero: «el departamento de sistemas me lleva meses, años». Contarla como dato del problema, no como elogio.

## 11. Evidencia: lo que cambiamos en el camino · 0:50

**En pantalla**, sin las fechas (quedan acá como referencia para quien presenta):

| Fecha | Qué aprendimos | Qué cambiamos |
| --- | --- | --- |
| 10/11 | La base que heredamos no compilaba y era de un solo curso | Sistema propio, con SIU y Moodle detrás de puertos |
| 12/11 | La API del SIU pide un usuario institucional y no deja inscribir | HackAI usa la sesión del propio alumno, con su confirmación |
| 12/11 | Hoy le mostraba demasiado al alumno de entrada | Mis materias pasó a ser el inicio; Hoy quedó para el docente |
| 12/11 | Docentes: tomar lista lleva de 10 a 15 minutos | Docentes al alcance: tomar lista con toques, tareas y entregas propias |
| 13/11 | Entrar a una materia tardaba hasta 17 segundos | Unos 3 segundos: Moodle y Discord se consultan después |
| 13/11 | La Dirección de Estudios carga cada nota tres veces, baja 80 reportes y no ve qué le falta a cada alumno | Notas que se cargan una vez, y Reportes para secretaría: cruzados y con la ficha de lo que falta |
| 13/11 | Con la cuenta real, el aula de cada materia seguía siendo la simulada, y solo traíamos archivos y enlaces: el 44 % de lo que tiene un curso | El Campus real con la cuenta del alumno: todo el contenido del aula, en vivo y sin guardarlo |

> No salió derecho. Arrancamos sobre una base que no compilaba y decidimos el sistema propio. Descubrimos que la API del SIU no deja inscribir y usamos la sesión del alumno. El primer inicio mostraba demasiado y lo simplificamos. Los docentes nos dijeron que tomar lista les lleva un cuarto de hora, y los sumamos al alcance. Y hoy, la Dirección de Estudios nos contó que carga cada nota tres veces y que baja ochenta reportes para ver una cohorte: de ahí salen la carga única de notas y la pantalla de reportes que vieron. Y cuando un alumno entraba con su cuenta real, el aula seguía siendo la simulada: ahora lee su Campus de verdad, sin guardar nada. Todo con revisión y tests automáticos en cada cambio.

## 12. Próximo paso: qué validaríamos después · 0:40

**En pantalla:**

*Con usuarios: probar que mejora*
- Cronometrar T1 a T5 con tres alumnos, hoy contra HackAI.
- Cronometrar la lista (T6) con un docente en una clase real.
- Un piloto con una cátedra que ya usa Discord (Laboratorio 3): cuánto tarda una consulta en tener respuesta.
- Mostrarle reportes a la Dirección de Estudios con su caso real: un alumno atrasado y lo que le falta.

*Con la universidad: pasar a producción*
- Ingreso con la cuenta Microsoft de la Austral.
- Acceso a la API del SIU y a los servicios web de Moodle; para reportes, a las bases de reportes del SIU (la API lee de a un alumno).
- Acuerdo de tratamiento de datos (Ley 25.326) y el visto bueno de Gobierno de Datos.

*Siguiente hipótesis:* con lo que le falta a un alumno y el Planning de Aulas, HackAI le arma a la Dirección de Estudios el camino más corto para que se reciba (correlativas, horarios y equivalentes en otra facultad). No está construido.

> Qué sigue. Con usuarios: cronometrar las tareas con alumnos y la lista con un docente, un piloto con una cátedra que ya usa Discord, y llevarle los reportes a la Dirección de Estudios con un caso real. Con la universidad: el ingreso con Microsoft, el acceso a las APIs y un acuerdo de datos. Y la próxima hipótesis salió de la entrevista con la Dirección de Estudios, que nos contó que siempre soñó con algo así: si ya sabemos qué le falta a un alumno y cuándo se dicta cada materia, HackAI le puede proponer el camino más corto para recibirse.

## 13. Cierre · 0:15

**En pantalla:** HackAI. «Un solo lugar que te dice qué te toca y te avisa a tiempo.» `campus-hackai.vercel.app`.

> Eso es HackAI: un solo lugar que te dice qué te toca y te avisa a tiempo. Para el alumno, para el docente y para quien los acompaña. Lo pueden probar desde el celular en campus-hackai.vercel.app. Gracias.
