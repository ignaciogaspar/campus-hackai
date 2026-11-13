# Guion del pitch

Pitch del 13/11/2026, en el orden de «La historia de su demo»: problema, usuario, antes y después, demo, evidencia y próximo paso. Dura unos 12 minutos con la demo adentro, repartidos entre cuatro personas de a unos 3 minutos cada una.

**Regla de todo el pitch:** decir qué es real y qué está simulado, sin esperar a que lo pregunten.

## Quién dice qué

| Persona | Slides | Tiempo | Además |
| --- | --- | --- | --- |
| **Persona 1** | 1 a 5: portada, problema, usuario y estrategia | 3:10 | Abre el pitch |
| **Persona 2** | 6 y 7.1: antes y después, demo del alumno | 3:00 | Maneja la compu en la demo del alumno |
| **Persona 3** | 7.2 y 7.3: demo del docente y de secretaría | 3:00 | Publica el aviso en vivo durante la demo del alumno |
| **Persona 4** | 8 a 12: real y simulado, evidencia, iteraciones, próximo paso y cierre | 3:15 | Cierra el pitch |
| | | **12:25** | |

Cada persona termina con una frase de pase que nombra a la siguiente.

**Antes de empezar:** la app abierta en `campus-hackai.vercel.app`, el servidor de Discord del equipo a la vista (otra ventana o un celular) y los tres perfiles a mano en el ingreso de demo. Persona 3 tiene abierta la sesión del docente en otro dispositivo para publicar el aviso. Probar el recorrido completo una vez en la última hora.

**Si la demo falla:** Persona 2 y Persona 3 pasan a las slides de respaldo (Mis materias, espacio de la materia, inscripción, lado del docente y una captura de reportes) y siguen su parte del guion sin cambiar el orden.

---

# Persona 1 · 3:10

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

## 3. Problema: qué les duele · 0:45

**En pantalla, dos columnas:**

*Alumnos (encuesta, n = 39, cinco facultades, 6 al 10/11):*

| Problema | % |
| --- | --- |
| Cursos viejos mezclados con los actuales | 56% |
| Aulas con organización confusa | 54% |
| Inscribirse a materias o exámenes en el SIU | 54% |
| Se usa mal desde el celular | 49% |
| Avisos que no llegan (lo más pedido en texto libre) | 44% |

*Docentes y gestión (entrevistas, 12 y 13/11):*

- **Tomar lista:** de 10 a 15 minutos por clase, alumno por alumno (profesor).
- **Notas:** Moodle, después un Excel, después el SIU: tres pasos, y en cada paso hay errores (docente de Comunicación, 120 alumnos por cuatrimestre).
- **Reportes:** 20 carreras por 4 cohortes son **80 reportes** para ver un solo indicador de toda la universidad (Dirección de Estudios).

Pie: «Encuesta, n = 39. Entrevistas a 3 docentes, Admisiones y la Dirección de Estudios, 12 y 13/11.»

> No lo supusimos: lo preguntamos. Respondieron 39 alumnos de cinco facultades. Más de la mitad se queja de los cursos viejos mezclados, de las aulas desordenadas y de la inscripción en el SIU. Y el 44 por ciento dice que los avisos no llegan, lo más pedido cuando los dejamos escribir. Después hablamos con docentes y con gestión, y apareció el mismo problema del otro lado. Un profesor tarda hasta quince minutos en tomar lista. Una docente con 120 alumnos corrige en Moodle, pasa las notas a un Excel y después las carga en el SIU: tres pasos, con errores en cada uno. Y en la Dirección de Estudios, para saber cómo vienen los alumnos de toda la universidad, tienen que bajar un reporte por carrera y por año de ingreso: ochenta reportes, o esperar meses a que sistemas les arme un tablero de Power BI.

## 4. Usuario: para quién lo construimos · 0:45

**En pantalla, tres columnas en orden de prioridad:**

| | Quién | Qué necesita | Le respondemos |
| --- | --- | --- | --- |
| **Primero** | El alumno de grado | Cursa varias materias, vive en el celular y revisa dos sistemas | ¿Qué me toca? ¿A qué me puedo anotar? ¿Hay algo nuevo? |
| **Después** | El docente | Publicar, tomar lista, corregir y cargar notas una sola vez | Avisos que llegan, lista en segundos, notas sin pasos de más |
| **Gestión** | Secretaría y Dirección de Estudios | Asignar aulas y seguir a los alumnos que se están quedando | ¿Cómo vienen? ¿Quién está en riesgo? ¿Qué le falta a este alumno? |

> El usuario principal es el alumno de grado, y lo que necesita son tres respuestas: qué me toca, a qué me puedo anotar y si hay algo nuevo. Después, el docente: publicar, tomar lista y cargar notas, una sola vez. Y en las entrevistas apareció un tercero que no teníamos: gestión. La secretaría que asigna las aulas, y la Dirección de Estudios, que acompaña a los alumnos para que no se queden en el camino. Su pregunta es otra: cómo vienen todos, quién está en riesgo y qué le falta a cada uno para recibirse.

## 5. La estrategia: sistema propio, apoyado en lo que ya existe · 0:40

**En pantalla:** el diagrama (SIU, Moodle y Discord → puertos y adaptadores → núcleo → pantallas de alumno, docente y secretaría) y los tres principios:

1. **Delega lo que ya anda bien.** Actas, constancias y la historia oficial siguen en el SIU.
2. **Resuelve lo que nadie resuelve.** Qué me toca, avisos que llegan, inscripción en un paso, lista en segundos, reportes cruzados.
3. **Aísla cada sistema.** Si mañana cambia el SIU, se cambia un adaptador y no la aplicación.

> La consigna permitía construir desde cero, sobre Moodle y el SIU, o envolver lo que hay. Elegimos una combinación. HackAI es un sistema propio que no reemplaza nada: el SIU, Moodle y Discord entran por un puerto, cada uno con su adaptador. La regla es simple: si un sistema existente resuelve algo bien, HackAI lo delega; si no lo resuelve nadie, lo resuelve el núcleo. Y como cada sistema está aislado, si mañana cambia el SIU, cambiamos un adaptador y no la aplicación.

**Pase:**
> Pero lo que importa es qué cambia para cada uno. Persona 2 se los muestra.

---

# Persona 2 · 3:00

## 6. Antes y después: cómo cambia cada trámite · 1:00

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

## 7. Demo en vivo

**Frase de entrada:**
> Ahora lo ven andando. Lo que van a ver corre con personas sintéticas. Discord es real; el SIU y el Moodle están simulados con la forma de sus APIs.

### 7.1 Alumno · 2:00

| Paso | Qué se hace | Qué se dice |
| --- | --- | --- |
| 1 | Ingreso de demo → elegir un alumno | «En producción se entra con la cuenta Microsoft de la Austral; acá elegimos una persona sintética.» |
| 2 | **Mis materias** | «Solo lo que cursa hoy. Las viejas están archivadas. Cada tarjeta muestra horario, aula y lo próximo que vence.» |
| 3 | Entrar a una materia → **#avisos** | «Cada materia tiene su espacio, que se crea solo desde el SIU.» |
| 4 | Persona 3 publica un aviso como docente desde su dispositivo; aparece en la pantalla del alumno y en Discord | «Se publica una vez y llega por Discord, al celular, por la aplicación que ya usa.» Es el momento fuerte: dejar que se vea llegar |
| 5 | **Calendario** → exportar | «Clases, parciales, finales y entregas en un solo lugar, y van al calendario del celular.» |
| 6 | **Notas** → pestaña «Final pendiente» | «Lo que el SIU no responde: qué finales debo y su próxima mesa.» |
| 7 | (Si sobra tiempo) **Inscripciones** → elegir comisión | «El cupo y el horario antes de elegir, y un paso para quedar adentro.» |

**Pase:**
> Ese aviso lo publicó un docente. Persona 3 les muestra su lado.

---

# Persona 3 · 3:00

Durante la demo del alumno (paso 4), publica el aviso desde la sesión del docente en su dispositivo.

### 7.2 Docente · 1:30

| Paso | Qué se hace | Qué se dice |
| --- | --- | --- |
| 1 | Cambiar a un docente → **Hoy** | «Su día en una pantalla: la clase de ahora, con Zoom si es virtual, y las consultas sin responder.» |
| 2 | **Tomar lista** → tocar tres ausentes → guardar | «Todos presentes, toca a los que faltan. Lo que hoy le lleva quince minutos son cuatro toques.» |
| 3 | Materia → **Calificaciones** → pegar notas desde una planilla → publicar | «Corrige una vez. El alumno la ve enseguida y queda lista para pasar al SIU.» |

### 7.3 Secretaría y Dirección de Estudios · 1:30

| Paso | Qué se hace | Qué se dice |
| --- | --- | --- |
| 1 | Cambiar a secretaría → **Planning** | «Secretaría sube la planilla de aulas del cuatrimestre y el alumno ve dónde cursa.» |
| 2 | **Reportes** → elegir dos facultades y tres cohortes | «Lo que hoy son ochenta reportes. Activos, ingresantes, graduados y bajas, cruzando facultades, carreras y años, y también años anteriores.» |
| 3 | Tocar una barra o un indicador de riesgo → listado → un alumno | «De un número al listado y del listado al alumno, sin cambiar de reporte.» |
| 4 | Ficha del alumno: plan de estudios con **lo que le falta** marcado y los créditos de Vida Universitaria desplegados | «Es lo que nos pidió la Dirección de Estudios: no lo que el alumno hizo, sino lo que le falta para terminar.» |
| 5 | Marcar «en seguimiento» y **exportar** | «Lo marca para seguirlo y se lo lleva a Excel.» |

**Pase:**
> Eso es lo que construimos. Persona 4 les cuenta qué es real, qué medimos y qué sigue.

---

# Persona 4 · 3:15

## 8. Evidencia: qué es real y qué está simulado · 0:40

**En pantalla:**

| Real | Simulado | Pendiente (depende de la universidad) |
| --- | --- | --- |
| Discord: un bot propio, en el servidor del equipo | El SIU y el Moodle de la demo: tablas propias con la forma de sus APIs | Ingreso con la cuenta Microsoft de la Austral |
| La aplicación: publicada, se instala en el celular | Las personas: alumnos, docentes, notas y la población de los reportes son sintéticos | API del SIU y servicios web de Moodle |
| Lectura del SIU con la sesión del alumno: en vivo, no se guarda nada | La inscripción y el pase de notas al SIU: no tocan el SIU real | Datos de toda la universidad para reportes (hoy en Power BI) y autorización de Gobierno de Datos |

> Lo que nos pidieron decir con todas las letras. Es real la integración con Discord, la aplicación publicada y la lectura del SIU con la sesión del propio alumno, que no se guarda en ningún lado. Está simulado el SIU y el Moodle de la demo, las personas, y todo lo que escribe en el SIU: la inscripción y el pase de notas. Los reportes de gestión corren sobre una población sintética. Y queda pendiente lo que depende de la universidad: el ingreso con Microsoft, los accesos a las APIs y, para los reportes, los datos de toda la universidad con la autorización de Gobierno de Datos.

## 9. Evidencia: qué medimos y qué falta medir · 0:50

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

## 10. Evidencia: lo que cambiamos en el camino · 0:50

**En pantalla:**

| Fecha | Qué aprendimos | Qué cambiamos |
| --- | --- | --- |
| 10/11 | La base que heredamos no compilaba y era de un solo curso | Sistema propio, con SIU y Moodle detrás de puertos |
| 12/11 | La API del SIU pide un usuario institucional y no deja inscribir | HackAI usa la sesión del propio alumno, con su confirmación |
| 12/11 | Hoy le mostraba demasiado al alumno de entrada | Mis materias pasó a ser el inicio; Hoy quedó para el docente |
| 12/11 | Tres docentes: lista de 15 minutos, notas cargadas tres veces | Docentes al alcance: tomar lista con toques, entregas propias, se carga una vez |
| 13/11 | Entrar a una materia tardaba hasta 17 segundos | Unos 3 segundos: Moodle y Discord se consultan después |
| 13/11 | La Dirección de Estudios baja 80 reportes y no ve qué le falta a cada alumno | Rol de gestión: reportes cruzados y ficha con lo que falta |

Abajo: **428 commits · 45 PRs · 81 issues cerrados · ~1.040 tests** (recontar antes de presentar).

> No salió derecho. Arrancamos sobre una base que no compilaba y decidimos el sistema propio. Descubrimos que la API del SIU no deja inscribir y usamos la sesión del alumno. El primer inicio mostraba demasiado y lo simplificamos. Los docentes nos dijeron que tomar lista les lleva un cuarto de hora y que cargan las notas tres veces, y los sumamos al alcance. Y hoy a la mañana, la Dirección de Estudios nos contó que baja ochenta reportes para ver una cohorte: de ahí sale la pantalla de gestión que vieron. Todo con revisión y tests automáticos en cada cambio.

## 11. Próximo paso: qué validaríamos después · 0:40

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

> Qué sigue. Con usuarios: cronometrar las tareas con alumnos y la lista con un docente, un piloto con una cátedra que ya usa Discord, y llevarle los reportes a la Dirección de Estudios con un caso real. Con la universidad: el ingreso con Microsoft, el acceso a las APIs y un acuerdo de datos. Y la próxima hipótesis la puso la propia Dirección de Estudios: si ya sabemos qué le falta a un alumno y cuándo se dicta cada materia, HackAI le puede proponer el camino más corto para recibirse.

## 12. Cierre · 0:15

**En pantalla:** HackAI. «Un solo lugar que te dice qué te toca y te avisa a tiempo.» `campus-hackai.vercel.app`.

> Eso es HackAI: un solo lugar que te dice qué te toca y te avisa a tiempo. Para el alumno, para el docente y para quien los acompaña. Lo pueden probar desde el celular en campus-hackai.vercel.app. Gracias.
