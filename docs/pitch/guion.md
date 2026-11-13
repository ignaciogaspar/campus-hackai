# Guion del pitch y 1-pager

Contenido del pitch del 13/11/2026, ordenado según la estructura que pide el kickoff («La historia de su demo» y «El 1-pager»). Parte del deck de la [PR #120](https://github.com/ignaciogaspar/campus-hackai/pull/120) (`docs/pitch/index.html`, rama `docs/pitch-hackai`) y lo actualiza con lo que pasó después: las entrevistas a docentes, Admisiones y la Dirección de Estudios, lo construido para docentes y secretaría, y la pantalla de reportes.

No toca el deck: dice qué va en cada slide y qué se dice. Cada slide marca **Qué cambia respecto del deck de la #120**, para editarlo después.

**Fuentes:** [hackathon.md](../product/hackathon.md) (criterios), [alcance.md](../product/alcance.md), [problema.md](../product/problema.md), [validaciones.md](../product/validaciones.md), [docentes.md](../product/docentes.md), [entrevistas de docentes y Admisiones](../entrevistas/docentes-y-admisiones.md) y la [entrevista de Gestión Académica](<../entrevistas/Gestión Académica Y Docente>).

**Sin verificar:** el tiempo máximo del pitch. El deck de la #120 dura 10:00 sin la demo. Acá se propone ~12 minutos con la demo adentro; ajustar contra el artifact del kickoff.

## Lo que se evalúa y dónde se responde

| Criterio del kickoff | Dónde se contesta |
| --- | --- |
| Claridad del problema | Slides 2 y 3 |
| Resultado (outcome) frente a output | Slide 6 (antes y después) y slide 9 (evidencia): cada cosa construida se cuenta como un trámite que cambia, no como una pantalla |
| Iteraciones validadas | Slide 10 |
| Estrategia justificada | Slide 5 |
| Riesgos reducidos | Slides 8 y 11, y el 1-pager |
| Calidad de la demo | Bloque 7 |

**Regla de todo el pitch:** decir qué es real y qué está simulado, sin esperar a que lo pregunten.

## Qué cambió desde el deck de la #120

1. **Ya no es «un solo docente».** Hablamos con tres docentes, Admisiones y la Dirección de Estudios. El deck dice «Entrevistamos a un solo docente» en la slide del usuario y «Entrevistar a más docentes» en el próximo paso: las dos cosas quedaron viejas.
2. **Hay un tercer usuario: gestión.** Secretaría carga el Planning de Aulas, y la Dirección de Estudios necesita ver el estado de todos los alumnos. La pantalla de reportes sale de esa entrevista.
3. **La matriculación automática ya existe, a veces.** La persona de la Dirección de Estudios contó que hoy, si el alumno se inscribe en el SIU, queda inscripto en Moodle, aunque «a veces anda mal». Las alumnas de Biomédica contaron que se matriculan a mano. El argumento de «inscripción en un paso» pasa de «nadie te matricula» a «el cupo, el horario y el espacio, en un paso, y si algo falla se deshace». La slide 6 y el próximo paso de la #120 hay que corregirlos.
4. **El lado del docente creció:** tomar lista, inasistencias, tareas y entregas propias, calificaciones con nota de cursada, Excel de la comisión y pase al SIU.
5. **Números del repo al 13/11, 13 h:** 428 commits en `main`, 45 PRs mergeados, 81 issues cerrados y unos 1.040 tests. El deck dice 302, 39, 64 y 697. Recontar antes de presentar.

---

# Parte 1: el pitch, slide por slide

Orden de «La historia de su demo»: problema, usuario, antes y después, demo, evidencia, próximo paso. La estrategia va después del usuario porque es criterio de evaluación; lo real y lo simulado va justo después de la demo.

| # | Bloque | Slide | Tiempo |
| --- | --- | --- | --- |
| 1 | — | Portada | 0:20 |
| 2 | Problema | Dos sistemas que no se hablan | 0:40 |
| 3 | Problema | Qué les duele, con números | 0:45 |
| 4 | Usuario | Para quién lo construimos | 0:45 |
| 5 | Usuario | La estrategia | 0:40 |
| 6 | Antes y después | Cómo cambia cada trámite | 1:00 |
| 7 | Demo | En vivo, tres perfiles | 5:00 |
| 8 | Evidencia | Qué es real y qué está simulado | 0:40 |
| 9 | Evidencia | Qué medimos y qué falta medir | 0:50 |
| 10 | Evidencia | Lo que cambiamos en el camino | 0:50 |
| 11 | Próximo paso | Qué validaríamos después | 0:40 |
| 12 | — | Cierre | 0:15 |
| | | **Total** | **~12:25** |

Las slides 7 a 10 de la #120 (Mis materias, espacio, inscripción, lado del docente) pasan a ser el **respaldo de la demo**: se muestran solo si la demo en vivo falla.

---

## 1. Portada · 0:20

**En pantalla:** HackAI. «Un solo lugar que te dice qué te toca y te avisa a tiempo.» Los cuatro nombres. Pitch, 13 de noviembre de 2026.

**Guion:**
> Buenas tardes. Somos Facundo, Ignacio, Marco y Facundo. En una semana rediseñamos la experiencia del SIU Guaraní y del Campus Virtual. Lo que construimos se llama HackAI y se resume en una promesa: un solo lugar que te dice qué te toca y te avisa a tiempo.

**Qué cambia respecto del deck de la #120:** nada.

---

## 2. Problema: dos sistemas que no se hablan · 0:40

**En pantalla:**
- SIU Guaraní: inscripciones, historia académica, plan, constancias.
- Campus Virtual (Moodle): aulas, material, entregas, avisos.
- Cada uno con su calendario, su bandeja y sus notas.
- Único puente entre los dos: el botón «Ir».
- Pie: relevamiento de SIU y Campus, 10/11/2026.

**Guion:**
> La vida académica en la Austral está partida en dos sistemas. El SIU tiene lo administrativo; el Campus, que es un Moodle, las aulas y el material. Cada uno tiene su calendario, su bandeja y sus notas, y no se hablan: el único puente que encontramos es un botón «Ir» escondido en un reporte del SIU. Entonces el que cruza la información es una persona, a mano. Si es un alumno, cuando se le escapa un aviso pierde un cupo, un crédito o una fecha. Y si es alguien de gestión, como vamos a ver, se baja ochenta reportes.

**Qué cambia respecto del deck de la #120:** la última frase suma a gestión y prepara la slide 3.

---

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
- **Notas:** «Moodle, después un Excel, después el SIU»: tres pasos, y en cada paso hay errores (docente de Comunicación, 120 alumnos por cuatrimestre).
- **Reportes:** 20 carreras por 4 cohortes son **80 reportes** para ver un solo indicador de toda la universidad (Dirección de Estudios).

**Guion:**
> No lo supusimos: lo preguntamos. Respondieron 39 alumnos de cinco facultades. Más de la mitad se queja de los cursos viejos mezclados, de las aulas desordenadas y de la inscripción en el SIU. Y el 44 por ciento dice que los avisos no llegan, lo más pedido cuando los dejamos escribir. Después hablamos con docentes y con gestión, y apareció el mismo problema del otro lado. Un profesor tarda hasta quince minutos en tomar lista. Una docente con 120 alumnos corrige en Moodle, pasa las notas a un Excel y después las carga en el SIU: tres pasos, con errores en cada uno. Y en la Dirección de Estudios, para saber cómo vienen los alumnos de toda la universidad, tienen que bajar un reporte por carrera y por año de ingreso: ochenta reportes, o esperar meses a que sistemas les arme un tablero de Power BI.

**Qué cambia respecto del deck de la #120:** se suma la columna de docentes y gestión. Se saca «Ningún docente respondió» del pie: la encuesta sigue sin docentes, pero ahora hay entrevistas. Pie nuevo: «Encuesta, n = 39. Entrevistas a 3 docentes, Admisiones y la Dirección de Estudios, 12 y 13/11.»

---

## 4. Usuario: para quién lo construimos · 0:45

**En pantalla, tres columnas en orden de prioridad:**

| | Quién | Qué necesita | Le respondemos |
| --- | --- | --- | --- |
| **(01) Primero** | El alumno de grado | Cursa varias materias, vive en el celular y revisa dos sistemas | ¿Qué me toca? ¿A qué me puedo anotar? ¿Hay algo nuevo? |
| **(02) Después** | El docente | Publicar, tomar lista, corregir y cargar notas una sola vez | Avisos que llegan, lista en segundos, notas sin pasos de más |
| **(03) Gestión** | Secretaría y Dirección de Estudios | Asignar aulas y seguir a los alumnos que se están quedando | ¿Cómo vienen? ¿Quién está en riesgo? ¿Qué le falta a este alumno? |

**Guion:**
> El usuario principal es el alumno de grado, y lo que necesita son tres respuestas: qué me toca, a qué me puedo anotar y si hay algo nuevo. Después, el docente: publicar, tomar lista y cargar notas, una sola vez. Y en las entrevistas apareció un tercero que no teníamos: gestión. La secretaría que asigna las aulas, y la Dirección de Estudios, que acompaña a los alumnos para que no se queden en el camino. Su pregunta es otra: cómo vienen todos, quién está en riesgo y qué le falta a cada uno para recibirse.

**Qué cambia respecto del deck de la #120:** de dos columnas a tres. Se saca «Entrevistamos a un solo docente».

---

## 5. La estrategia: sistema propio, apoyado en lo que ya existe · 0:40

**En pantalla:** el diagrama de la #120 (SIU, Moodle y Discord → puertos y adaptadores → núcleo → pantallas de alumno, docente y secretaría) y los tres principios:

1. **Delega lo que ya anda bien.** Actas, constancias y la historia oficial siguen en el SIU.
2. **Resuelve lo que nadie resuelve.** Qué me toca, avisos que llegan, inscripción en un paso, lista en segundos, reportes cruzados.
3. **Aísla cada sistema.** Si mañana cambia el SIU, se cambia un adaptador y no la aplicación.

**Guion:**
> La consigna permitía construir desde cero, sobre Moodle y el SIU, o envolver lo que hay. Elegimos una combinación. HackAI es un sistema propio que no reemplaza nada: el SIU, Moodle y Discord entran por un puerto, cada uno con su adaptador. La regla es simple: si un sistema existente resuelve algo bien, HackAI lo delega; si no lo resuelve nadie, lo resuelve el núcleo. Y como cada sistema está aislado, si mañana cambia el SIU, cambiamos un adaptador y no la aplicación.

**Qué cambia respecto del deck de la #120:** el núcleo ya no son cinco módulos (se sumó el Planning y, con reportes, quizá uno más): decir «el núcleo» sin contar. «Pantallas: alumno y docente» pasa a «alumno, docente y secretaría».

---

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

**Guion:**
> Esto es lo que cambia, trámite por trámite. A la izquierda, lo que medimos navegando el SIU y el Campus reales y lo que nos contaron en las entrevistas. A la derecha, lo mismo en HackAI. Para el alumno: un calendario en vez de dos, el aviso que te llega en vez de ir a buscarlo, y los finales que debés en una pestaña, sin cruzar pantallas. Para el docente: la lista arranca con todos presentes y solo tocás a los que faltan, y las notas se cargan una vez. Para gestión: lo que hoy son ochenta reportes es una pantalla. Una aclaración: los números de HackAI los contamos nosotros sobre datos sintéticos; medirlos con usuarios es lo que sigue.

**Qué cambia respecto del deck de la #120:**
- Se saca «Saber cuántas faltas tengo» para hacer lugar (sigue en la demo).
- La fila de inscripción ya no dice «al aula te suma otro proceso»: la Dirección de Estudios contó que la matriculación hoy es automática, aunque a veces falla. Lo que se gana es ver el cupo y el horario antes de elegir, y quedar en el espacio en el mismo paso.
- Se suman las filas de docente y gestión.

---

## 7. Demo en vivo · 5:00

**Antes de empezar:** la app abierta en `campus-hackai.vercel.app` (o la build local), el servidor de Discord del equipo abierto en otra ventana o en un celular a la vista, y los tres perfiles a mano en el ingreso de demo. Probar el recorrido completo una vez en la última hora.

**Frase de entrada:**
> Lo que van a ver corre con personas sintéticas. Discord es real; el SIU y el Moodle están simulados con la forma de sus APIs.

### 7.1 Alumno · 2:00

| Paso | Qué se hace | Qué se dice |
| --- | --- | --- |
| 1 | Ingreso de demo → elegir un alumno | «En producción se entra con la cuenta Microsoft de la Austral; acá elegimos una persona sintética.» |
| 2 | **Mis materias** | «Solo lo que cursa hoy. Las viejas están archivadas. Cada tarjeta muestra horario, aula y lo próximo que vence.» |
| 3 | Entrar a una materia → **#avisos** | «Cada materia tiene su espacio, que se crea solo desde el SIU.» |
| 4 | Un compañero publica un aviso como docente (o desde Discord) y aparece en la otra pantalla y en Discord | «Se publica una vez y llega por Discord, al celular, por la aplicación que ya usa.» Es el momento fuerte: dejar que se vea llegar |
| 5 | **Calendario** → exportar | «Clases, parciales, finales y entregas en un solo lugar, y van al calendario del celular.» |
| 6 | **Notas** → pestaña «Final pendiente» | «Lo que el SIU no responde: qué finales debo y su próxima mesa.» |
| 7 | (Si sobra tiempo) **Inscripciones** → elegir comisión | «El cupo y el horario antes de elegir, y un paso para quedar adentro.» |

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

**Si la demo falla:** pasar a las slides de respaldo (las 7 a 10 de la #120, más una captura de reportes) y seguir el guion de cada una sin cambiar el orden.

**Qué cambia respecto del deck de la #120:** la demo ya no va al final, después del cierre: va acá, entre antes y después y la evidencia, como pide el kickoff. Se suma el bloque de secretaría.

---

## 8. Evidencia: qué es real y qué está simulado · 0:40

**En pantalla:**

| Real | Simulado | Pendiente (depende de la universidad) |
| --- | --- | --- |
| Discord: un bot propio, en el servidor del equipo | El SIU y el Moodle de la demo: tablas propias con la forma de sus APIs | Ingreso con la cuenta Microsoft de la Austral |
| La aplicación: publicada, se instala en el celular | Las personas: alumnos, docentes, notas y la población de los reportes son sintéticos | API del SIU y servicios web de Moodle |
| Lectura del SIU con la sesión del alumno: en vivo, no se guarda nada | La inscripción y el pase de notas al SIU: no tocan el SIU real | Datos de toda la universidad para reportes (hoy en Power BI) y autorización de Gobierno de Datos |

**Guion:**
> Lo que nos pidieron decir con todas las letras. Es real la integración con Discord, la aplicación publicada y la lectura del SIU con la sesión del propio alumno, que no se guarda en ningún lado. Está simulado el SIU y el Moodle de la demo, las personas, y todo lo que escribe en el SIU: la inscripción y el pase de notas. Los reportes de gestión corren sobre una población sintética. Y queda pendiente lo que depende de la universidad: el ingreso con Microsoft, los accesos a las APIs y, para los reportes, los datos de toda la universidad con la autorización de Gobierno de Datos.

**Qué cambia respecto del deck de la #120:** se suman el pase de notas al SIU, la población sintética de reportes y la autorización de Gobierno de Datos.

---

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

**Guion:**
> Qué medimos. El problema: 39 alumnos encuestados y seis entrevistas, del lado alumno, docente y de gestión, más una línea base de 17 tareas con sus clicks en el SIU y el Campus reales. La promesa de avisar a tiempo: un aviso publicado aparece en otra pantalla en 13 segundos sin recargar, y en Discord casi al instante. Y que se pueda usar: cambiar de canal tardaba hasta 28 segundos y lo bajamos a 3. Lo que no medimos, y lo decimos: no cronometramos las tareas con alumnos ni la lista con un docente. Tenemos el protocolo armado.

**Qué cambia respecto del deck de la #120:** se suma la fila de entrevistas y, en «Falta», T6 y la validación de reportes.

**Cita para usar si sobra tiempo** (Dirección de Estudios, sobre el tiempo de hacer un tablero): «el departamento de sistemas me lleva meses, años». Contarla como dato del problema, no como elogio.

---

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

Abajo: **428 commits · 45 PRs · 81 issues cerrados · ~1.040 tests** (recontar el 13/11 antes de presentar).

**Guion:**
> No salió derecho. Arrancamos sobre una base que no compilaba y decidimos el sistema propio. Descubrimos que la API del SIU no deja inscribir y usamos la sesión del alumno. El primer inicio mostraba demasiado y lo simplificamos. Los docentes nos dijeron que tomar lista les lleva un cuarto de hora y que cargan las notas tres veces, y los sumamos al alcance. Y hoy a la mañana, la Dirección de Estudios nos contó que baja ochenta reportes para ver una cohorte: de ahí sale la pantalla de gestión que vieron. Todo con revisión y tests automáticos en cada cambio.

**Qué cambia respecto del deck de la #120:** se suman las filas de docentes (12/11) y gestión (13/11), y se actualizan los números.

---

## 11. Próximo paso: qué validaríamos después · 0:40

**En pantalla:**

*(01) Con usuarios: probar que mejora*
- Cronometrar T1 a T5 con tres alumnos, hoy contra HackAI.
- Cronometrar la lista (T6) con un docente en una clase real.
- Un piloto con una cátedra que ya usa Discord (Laboratorio 3): cuánto tarda una consulta en tener respuesta.
- Mostrarle reportes a la Dirección de Estudios con su caso real: un alumno atrasado y lo que le falta.

*(02) Con la universidad: pasar a producción*
- Ingreso con la cuenta Microsoft de la Austral.
- Acceso a la API del SIU y a los servicios web de Moodle; para reportes, a las bases de reportes del SIU (la API lee de a un alumno).
- Acuerdo de tratamiento de datos (Ley 25.326) y el visto bueno de Gobierno de Datos.

**Siguiente hipótesis a validar:** con la lista de lo que le falta y el Planning de Aulas, HackAI le arma a la Dirección de Estudios el camino más corto para que un alumno atrasado se reciba (correlativas, horarios y equivalentes en otra facultad). Lo pidió ella, con esas palabras; no está construido.

**Guion:**
> Qué sigue. Con usuarios: cronometrar las tareas con alumnos y la lista con un docente, un piloto con una cátedra que ya usa Discord, y llevarle los reportes a la Dirección de Estudios con un caso real. Con la universidad: el ingreso con Microsoft, el acceso a las APIs y un acuerdo de datos. Y la próxima hipótesis la puso la propia Dirección de Estudios: si ya sabemos qué le falta a un alumno y cuándo se dicta cada materia, HackAI le puede proponer el camino más corto para recibirse.

**Qué cambia respecto del deck de la #120:**
- Sale «Entrevistar a más docentes»: ya se hizo.
- Sale «Revisar la interfaz oficial de Guaraní a Moodle, que matricula sola»: según la Dirección de Estudios ya está activa. Si se quiere mantener, decir «confirmar por qué a veces falla».
- Se suman T6, la validación de reportes y la hipótesis del camino más corto.

---

## 12. Cierre · 0:15

**En pantalla:** HackAI. «Un solo lugar que te dice qué te toca y te avisa a tiempo.» `campus-hackai.vercel.app`.

**Guion:**
> Eso es HackAI: un solo lugar que te dice qué te toca y te avisa a tiempo. Para el alumno, para el docente y para quien los acompaña. Lo pueden probar desde el celular en campus-hackai.vercel.app. Gracias.

**Qué cambia respecto del deck de la #120:** ya no dice «Pasemos a la demo»: la demo fue antes.

---

# Parte 2: el 1-pager

Las ocho cajas del kickoff. Pensado para una carilla: cada bloque, tres a cinco líneas.

## Problema

La vida académica de un alumno de la Austral está partida en dos sistemas que no se hablan: SIU Guaraní y el Campus Virtual (Moodle). El alumno cruza pantallas a mano para saber qué le toca y, si se pierde un aviso, pierde un cupo, un crédito o una fecha. El mismo corte lo sufren los docentes (lista de 10 a 15 minutos, notas cargadas en Moodle, Excel y SIU) y gestión (80 reportes para ver cuatro cohortes de toda la universidad).

## Usuarios

- **Alumno de grado (primero):** ¿qué me toca?, ¿a qué me puedo anotar?, ¿hay algo nuevo?
- **Docente:** publicar una vez, tomar lista en segundos, cargar notas una vez.
- **Gestión (secretaría y Dirección de Estudios):** asignar aulas; ver cómo vienen todos los alumnos y qué le falta a cada uno.

## KRs

Las metas son propuestas del equipo y no están confirmadas: son hipótesis.

| KR | Línea base | Meta | Resultado al 13/11 |
| --- | --- | --- | --- |
| Saber qué me toca | 3 clicks en 2 sistemas | 1 click | 1 click, contado por el equipo con datos sintéticos; falta T1 con alumnos |
| Enterarse de un aviso | «Al día siguiente, o nunca» (reportado) | Menos de 1 minuto | 13 s en otra pantalla; Discord casi instantáneo |
| Saber qué finales debo | Cruzar dos pantallas a mano | 1 click | 1 click (pestaña «Final pendiente»), contado por el equipo |
| Tomar lista | 10 a 15 minutos (reportado) | Menos de 1 minuto | 4 toques en una clase de 30 con 3 ausentes; falta T6 cronometrada |
| Cargar notas | 3 cargas: Moodle, Excel y SIU | 1 carga | 1 carga, pegada desde planilla; el pase al SIU está simulado |
| Ver cómo viene una cohorte | 80 reportes (20 carreras × 4 años) | 1 pantalla | 1 pantalla, con población sintética; falta validarla con la Dirección de Estudios |

## Top 3 riesgos

1. **Acceso a los datos institucionales.** La API del SIU no deja inscribir, pide un usuario institucional y lee la historia de a un alumno. *Reducido:* la sesión del propio alumno se lee en vivo y cada sistema está detrás de un puerto. *Pendiente:* acceso institucional y bases de reportes para gestión.
2. **Que el aviso efectivamente suene.** Que esté en Discord no garantiza que llegue al celular: depende de la configuración del servidor y del teléfono. *Validado:* el bot real publica al instante y la pantalla se actualiza en 13 s. *Pendiente:* preguntarles a alumnos si les suena y el piloto con Laboratorio 3.
3. **Que mejore de verdad para los usuarios.** Los números de HackAI los contó el equipo, sobre datos sintéticos. *Reducido:* de un docente entrevistado pasamos a tres, más Admisiones y la Dirección de Estudios. *Pendiente:* cronometrar T1 a T6 con usuarios reales.

## Decisiones (iteraciones: con quién y qué cambió)

| Fecha | Con quién | Qué cambió |
| --- | --- | --- |
| 10/11 | Equipo, sobre el repo heredado | Sistema propio con puertos y adaptadores, en vez de construir sobre una base que no compilaba |
| 10/11 | Un profesor (entrevista previa) | Comunicación por el canal de la cátedra (Discord), de ida y vuelta |
| 12/11 | Research de la API del SIU | Lectura con la sesión del alumno; nada se escribe sin su confirmación |
| 12/11 | Equipo, recorriendo la demo | Mis materias como inicio del alumno; Hoy queda para el docente |
| 12/11 | Profesora, profesor y Admisiones | Docentes al alcance: tomar lista con toques, entregas propias, notas cargadas una vez |
| 13/11 | Mediciones del equipo | Entrar a una materia: de 17 s a 3 s |
| 13/11 | Dirección de Estudios | Rol de gestión con reportes cruzados y ficha del alumno con lo que le falta |

## Evidencia

- Encuesta a 39 alumnos de cinco facultades (6 al 10/11).
- Seis entrevistas: alumnas de Biomédica, tres docentes, Admisiones y la Dirección de Estudios.
- Línea base de 17 tareas frecuentes, en el SIU y el Campus reales (10/11).
- Mediciones del sistema: 13 s del aviso a otra pantalla, 3 s para cambiar de canal, 3 s para abrir una materia.
- Citas: «del estilo Discord o Slack» (profesor); sobre subir las notas desde un Excel, «Sería glorioso» (docente de Comunicación).

## Cumplimiento

| Tema | Qué cubre HackAI | Qué falta |
| --- | --- | --- |
| **CONEAU** | Actas, notas oficiales e historia siguen en el SIU: el proceso que se acredita no cambia | No se revisó el régimen de CONEAU para grado más allá de la Ley 24.521 |
| **Registros** | Los registros oficiales siguen en el SIU; lo que HackAI pasa al SIU queda marcado como pasado o pendiente | Bitácora de cambios en HackAI (quién cambió qué y cuándo) |
| **Permisos** | Cada espacio lo ve solo quien pertenece; los mensajes directos, sus dos participantes; los reportes, solo gestión | Ingreso con Microsoft y roles reales de la universidad |
| **Datos mínimos** | Todo es sintético; los datos de quien entra con su cuenta del SIU se leen en vivo y no se guardan | Acuerdo de tratamiento de datos (Ley 25.326) y autorización de Gobierno de Datos para reportes |

## Próximo paso

Llevarle la pantalla de reportes a la Dirección de Estudios con un caso real y probar la siguiente hipótesis: con lo que le falta a un alumno y el Planning de Aulas, HackAI le propone el camino más corto para recibirse. En paralelo, cronometrar T1 a T6 con alumnos y un docente.

---

# Anexo: lo que sale de la entrevista de Gestión Académica

Resumen para quien prepare las respuestas a preguntas del jurado.

- **El problema de gestión es la visualización y el cruce de datos**, no la gestión de un alumno puntual. El reporte de Vida Universitaria sale por carrera y año de ingreso, sin selección múltiple: 20 carreras × 4 años = 80 reportes.
- **Hoy se resuelve con Power BI**, que arma un equipo de sistemas con un *business case* y la autorización de Gobierno de Datos. Es un embudo: lleva meses y a veces se contrata afuera.
- **El tablero básico que usan** muestra activos, ingresantes, graduados y bajas, por facultad, carrera, sede, año y cohorte.
- **Para un alumno puntual**, la ficha del SIU y el reporte de plan de estudios están separados, y los créditos de Vida Universitaria no llevan a sus actividades: «los reportes no están conectados entre sí».
- **Lo más valioso:** ver lo que le falta al alumno, bien marcado, y cruzarlo con los horarios para que termine en el menor tiempo posible.
- **Del lado docente** (la misma persona da clases): carga notas en Moodle, Excel y SIU; subir un Excel «sería espectacular, la función principal»; un QR de asistencia que dure un minuto, «si ustedes lo desarrollan yo lo compro».
- **Sobre matriculación:** hoy el alta en Moodle sale sola al inscribirse en el SIU, «a veces anda mal».
- **Ideas que quedan para después:** avisar al alumno de una inhabilitación administrativa antes de que intente anotarse; un apartado de Vida Universitaria con filtros (por ejemplo, solo actividades virtuales).
