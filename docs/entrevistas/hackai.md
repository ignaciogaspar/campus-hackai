> Export del Google Doc del equipo (pestañas Research, encuesta, relevamiento de SIU y Campus, Moodle y SIU, repo de Nacho y propuesta), copiado tal cual el 13/11/2026. El nombre del profesor entrevistado se reemplazó por «Un profesor». Lo que se decidió después está en `docs/product/`; donde difieran, manda `docs/product/alcance.md`.

# Estructuras Actuales:

* SIU  
* Moodle (Campus) (son cosas distintas pero es la adaptación de la austral)  
* Burocracia Universidad (legales)

# Cosas que nos molestan (alumnos de grado)

* Salimos como aspirantes de FI en el siu apenas entramos  
* En el campus, no podemos darnos de baja de las materias después de terminarlas (capaz solo deberíamos poder después de terminar la materia).  
* Cantidad de clicks que hay que hacer en el SIU para acceder al recurso que queres  
* Cuando te mandan un mensaje dentro de una entrega en el campus, se corta el mensaje con 3 puntos y no hay forma de ver el resto del mensaje.

Alumnas Ing. Biomedica:  
Apenas entras al siu tenés que cambiar al perfil de alumnos. Cuando pateas un final, y te sacan de una materia del campus, después no te podés volver para ver el material.  
“Si cursaste la materia te deberías poder matricular cuando quieras a la materia en el campus”  
Tenés que matricularte a mano, no te anota en las materias solo.  
No te mandan las notificaciones del material que se publica en el campus.

# Cosas que molestan a los profesores

Un profesor: es una cagada el manejo de comunicación, anuncios, notificaciones. Subida de material de clases (Para mi no necesitás una UX para ver todo el material, hay tabs innecesarias y es engorroso tener que pedir al alumno suscribirse para recibir los anuncios y notificaciones, discord súper cómodo \- SLACK)

## Por qué pasa cada cosa

Detalle en las pestañas **Moodle (campus)** y **Moodle y Siu**. Resumen:

* **Cursos viejos mezclados:** ningún curso tiene fecha de fin cargada y los filtros "En progreso / Pasados" de Moodle están desactivados. Todo queda "en progreso" para siempre.  
* **No se ven las fechas en el inicio:** el inicio usa un bloque de tarjetas de terceros y no tiene el bloque Línea de tiempo de Moodle.  
* **Celular:** el campus usa un tema comercial (Lambda 2\) y no tiene notificaciones push configuradas: la app oficial de Moodle no recibe avisos.  
* **Notificaciones de material nuevo:** Moodle solo avisa si el docente marca "enviar notificación de cambio de contenido" al subir algo. Viene desmarcado.  
* **Matriculación:** el campus usa auto-inscripción e inscripción manual, y desmatriculaciones masivas por CSV. No hay sincronización con el SIU.  
* **Dato clave:** el campus está en Moodle 5.1, así que ya trae el subsistema de IA de Moodle (solo falta conectar un proveedor).

## Ideas: qué haríamos con el campus

*Ordenadas por impacto y factibilidad para la hackathon. Son propuestas, para discutir en el equipo.*

1. **Matriculación automática \+ rol "Final pendiente"** (problema que confirma todo el mundo). Un servicio puente lee las inscripciones del SIU (en la demo, un mock o CSV) y matricula solo, usando enrol\_database o cohortes de Moodle. Al cerrar la cursada no se desmatricula: el alumno con final pendiente pasa a un rol de solo lectura y sigue viendo el material. Demo: inicio sesión y ya veo mis materias, sin matricularme a mano.  
2. **Inicio "Mi cuatrimestre" pensado para el celular** (celular 61%, cursos viejos 56%, fechas 39%). Una sola pantalla con: materias actuales arriba y las viejas archivadas, próximas entregas y avisos nuevos sin leer. Se puede hacer como app web externa (PWA) usando la API REST de Moodle, o como bloque/plugin dentro del campus.  
3. **Resumen semanal con IA** (notificaciones 44%, organización 61%). Por cada materia: "esta semana se subió X, hay aviso de Y, vence Z". Usa el subsistema de IA que el campus ya tiene por ser 5.1. Se puede mandar por mail, push en la app o un bot de WhatsApp/Discord.  
4. **Avisos donde ya están los alumnos** (pedido del profesor: "Discord / Slack súper cómodo"). Suscripción forzada al foro de Avisos \+ push en la app oficial \+ un bot que reenvíe avisos y material nuevo a WhatsApp, Discord o Telegram (un plugin local de Moodle que escuche los eventos del curso, o un servicio externo que use la API).  
5. **Aula ordenada por defecto** (organización 61%). Plantilla de curso estándar (por ejemplo, formato Tiles: una tarjeta por unidad con material, grabación y entrega) y un chequeo que le avise al docente qué actividades no tienen fecha o están sueltas.  
6. **Arreglos rápidos de configuración** (para mencionar en el pitch como quick wins): cargar fechas de fin, activar los filtros En progreso / Pasados, sumar la Línea de tiempo al inicio, activar notificaciones push y que "avisar cambio de contenido" venga marcado.  
7. **Mensajes cortados con "…" en las entregas:** reproducirlo y sacar captura. Probablemente sea CSS del tema; si se confirma, es un arreglo chico y visible.

**Para la demo** conviene levantar un Moodle propio con Docker (moodlehq/moodle-docker), con datos de prueba y un SIU simulado, porque no tenemos acceso de administrador al campus real.

## Próximos pasos de research

* Probar la app oficial de Moodle con el login de Office 365 del campus y ver si anda bien.  
* Averiguar quién administra el campus y el SIU en la Austral, y si el SIU es Guaraní 2 o 3\.  
* Preguntar a 2 o 3 docentes más cómo suben material y avisos.  
* Sumar a la encuesta la pregunta sobre matriculación y difundirla en otras facultades.

# **Encuesta de alumnos vs repo de Nacho**

Cruce de las 39 respuestas de la encuesta «SIU Guaraní y Campus Virtual \- Austral» con el análisis del repo «Campus Austral» (pestaña *Repo Mergeable de Nacho*). Hecho por Claude el 10/11/2026. Se compara contra ese análisis del código, no contra la app corriendo.

## **1\. Resumen**

* **Se repiten en el repo:** la mala experiencia desde el celular (49% la marcó en el Campus) y los avisos sin notificaciones (44%, y es lo más pedido en texto libre). En el repo los avisos son incluso más débiles que en el Campus.  
* **Lo resuelve:** ver entregas y próximos pasos en el inicio (0 clicks), menos clicks para llegar al material, sesión de 30 días y no existe el problema de entrar como «aspirante».  
* **No lo cubre:** nada de gestión académica. La inscripción a materias y exámenes, que es la queja nº 1 del SIU (54%), no existe en el repo.  
* **Problemas propios del repo** que la encuesta no mide pero que pegan si se usa con datos reales: notas que no se guardan, login débil (PIN de 4 dígitos, código de profesor compartido), un solo curso fijo en el código y un zip que no compila. Ver sección 4\.  
* **Qué conviene construir:** avisos con notificaciones que se vean bien en el celular, dentro de un inicio «Mi cuatrimestre». Coincide con lo que recomienda la pestaña del repo.

## **2\. Qué dice la encuesta**

* **Quiénes:** 39 alumnos. Ingeniería 16 (41%), Comunicación 11 (28%), Empresariales 7 (18%), Biomédicas 3, Derecho 2\. La muestra está cargada hacia FI.  
* **Frecuencia de uso:** varias veces por semana 18 (46%), todos los días 9 (23%), solo en épocas de inscripción o trámites 8 (21%), una vez por semana 4 (10%).  
* **Calificación de 1 a 5:** SIU \~2,9 y Campus \~3,3 de promedio; en los dos la respuesta más común es 3\. Las notas se leyeron del gráfico, son aproximadas.

### **Problemas del SIU Guaraní**

| Problema | Votos |
| :---- | :---- |
| Inscripción a materias o exámenes (se cae, lento, cupos) | 21 (54%) |
| Diseño confuso o difícil de navegar | 17 (44%) |
| Demasiados menús o nombres largos | 16 (41%) |
| Lentitud o caídas del sistema | 15 (38%) |
| Avisos o requisitos que no sé si corresponden (ej. requisitos vencidos) | 14 (36%) |
| Consulta de notas o historia académica | 13 (33%) |
| Trámites y certificados | 10 (26%) |
| No sé qué período de inscripción está abierto | 8 (21%) |
| Problemas para ingresar (usuario, clave, celular) | 7 (18%) |
| Historia académica carga lento o vacía | 4 (10%) |
| Texto libre: entra como «aspirante» (3), no notifica cupos ni deja elegir notificaciones (2) | 5 |

### **Problemas del Campus Virtual**

| Problema | Votos |
| :---- | :---- |
| Cursos viejos que no puedo ordenar u ocultar | 22 (56%) |
| Organización de aulas y materias confusa o desactualizada | 21 (54%) |
| Mala experiencia desde el celular | 19 (49%) |
| Notificaciones y avisos de los docentes | 17 (44%) |
| Lentitud o caídas de la plataforma | 14 (36%) |
| No veo mis entregas o fechas importantes en el inicio | 14 (36%) |
| Entrega de trabajos prácticos (fallas al subir, fechas) | 9 (23%) |
| Nombres de materias confusos | 6 (15%) |
| Acceso a materiales y clases grabadas | 5 (13%) |
| Texto libre: asistencia difícil de encontrar (1), pide login cada vez (1) | 2 |

### **Texto libre**

* **Lo más pedido:** notificaciones (cuando suben una nota, corrigen un trabajo, abre la inscripción a materias o créditos).  
* **Después:** diseño más simple y moderno con lo más usado en el inicio, que el SIU no se caiga en la inscripción, ver horarios y duración de una materia sin desinscribirse, ver los puntos de vida universitaria y ordenar los cursos viejos.  
* **Casos concretos:** se perdieron cupos de optativas porque el SIU colapsó; se perdieron créditos por no recibir aviso; notas repartidas entre historia académica y actuación provisoria; un archivo entregado que no le llegó al profesor.  
* Una persona propone una app única que centralice todo.

## **3\. ¿Se repiten los problemas en el repo de Nacho?**

| Problema (encuesta) | En el repo | Veredicto |
| :---- | :---- | :---- |
| Mala experiencia en el celular (49%) | Diseño de escritorio; en el celular algunos accesos quedan escondidos. Solo la vista de la clase en vivo está pensada para celular. | **Se repite** |
| Avisos y notificaciones (44% y lo más pedido) | Los avisos aparecen solo en la home, sin registro de leídos, sin push ni mail. Se publican solo por MCP: no hay página web para crearlos. Office hours tampoco notifica. | **Se repite (peor)** |
| Entrega de TPs (23%) | Entrega en 3 clicks, pero no se pueden subir archivos: solo texto o link. | Problema distinto |
| Notas difíciles de encontrar (33%) | La nota de cada trabajo está a 2 clicks, pero se calcula al leer, no se guarda y puede cambiar después de comunicada. | Riesgo parcial |
| Lentitud o caídas (38% SIU, 36% Campus) | No hay datos de carga. Si la base falla, sesión y throttle dejan pasar (fail-open); las actividades consultan cada 4 a 6 s; hay N+1 en listados. | Sin datos |
| No veo entregas ni fechas en el inicio (36%) | La home muestra el próximo paso y un checklist sin clicks. El calendario no tiene parciales ni finales. | Resuelto en parte |
| Diseño confuso y demasiados menús (44% y 41%) | Material de clase en 1 a 2 clicks y «qué hago ahora» en 0\. | Resuelto |
| Aulas desordenadas (54%) | Material ordenado por jornada y deck; la página /campus/materiales es un stub. | Resuelto en parte |
| Pide login cada vez | Sesión de 30 días. | Resuelto |
| Entrar como «aspirante» | Solo dos roles, sin selector de perfil. Pero es una credencial más (PIN), sin usuario institucional ni SSO. | No se repite |
| Cursos viejos (56%) | Hay un solo curso fijo, así que hoy no pasa. Si se generaliza a varias materias vuelve el problema y hay que diseñarlo. | Hoy no aplica |
| Inscripción, cupos, períodos, trámites, historia, requisitos vencidos | No hay nada de gestión académica. El patrón de cupo de office hours (oh\_book con FOR UPDATE) sirve de base. | No lo cubre |

## **4\. Otros problemas grandes del repo**

No salen de la encuesta, pero condicionan cualquier cosa que construyamos encima. Vienen de la sección 15 de la pestaña del repo.

* **El zip no compila ni carga datos:** falta lib/content/server (15 errores de typecheck) y los seeds importan de ../mbt. Sin eso no hay curso, jornadas ni padrón. Hay que pedirle a Nacho el repo completo antes de construir.  
* **Notas no persistidas:** se calculan al leer; cambiar el modo o reabrir un trabajo altera notas ya comunicadas, y las transiciones de estado son libres. Es justo lo que los alumnos critican del SIU (no saber dónde ni cuál es la nota).  
* **Login débil:** PIN de 4 dígitos, códigos iniciales en claro para el profesor, padrón (nombres y empresas) visible sin login y un código de profesor compartido que permite entrar como otro profesor. Sirve para una demo, no para datos académicos reales.  
* **Un solo curso y dos roles:** COURSE\_ID fijo usado 141 veces y queries sin filtro de curso; no hay rol de bedelía. Escalar a la facultad es un cambio estructural.  
* **Fail-open:** si la base cae, se aceptan sesiones revocadas y se pierde el bloqueo por PIN. Relevante porque las caídas son una queja fuerte.  
* **Datos abiertos:** canal realtime del profesor y bucket de media públicos; tokens MCP sin vencimiento, en la URL y con CORS «\*».  
* **Simuladores:** el score lo manda el cliente sin validar.  
* **IA sin control de gasto:** no se registran tokens y la autoría con Opus no tiene cupo.  
* **Operación:** sin CI, sin linter, casi sin tests, sin .env.example y documentación que contradice al código.

## **5\. Qué conviene construir**

* **Avisos que lleguen:** página para crearlos desde la web, registro de leídos y aviso por mail o push cuando se sube una nota, se corrige un trabajo o abre una inscripción. Ataca lo más pedido y una de las dos cosas que el repo repite.  
* **Mobile first:** que la home y los avisos funcionen bien en el celular (49% se queja hoy).  
* **Inicio «Mi cuatrimestre»:** sumar al «qué hago ahora» las fechas de parciales y finales, que hoy faltan.  
* **Con cuidado:** cualquier cosa que muestre notas (no se guardan) o inscripción (necesita tablas nuevas, cupos y un rol de staff). Todo como módulo nuevo con su propia migración, según el checklist de la sección 11 de la pestaña del repo.

## **6\. Límites de este análisis**

* 39 respuestas, 41% de Ingeniería: no es representativo de toda la universidad.  
* Las calificaciones de 1 a 5 se leyeron del gráfico de Forms y son aproximadas.  
* El repo no se ejecutó: clicks y celular se estimaron leyendo código y CSS (ver «Sin verificar» en la pestaña del repo).

Giuliana (de presentación hackai)  
Encuestas  
	Profesores: [https\://docs.google.com/forms/d/e/1FAIpQLSc6VW0wx1Wa3JiJcK6x4DUvY0aUJJ3XukAok2mDJA3FqlPf1Q/viewform](https://docs.google.com/forms/d/e/1FAIpQLSc6VW0wx1Wa3JiJcK6x4DUvY0aUJJ3XukAok2mDJA3FqlPf1Q/viewform)  
	alumnos:   
Hola\! 👋 Estamos relevando qué problemas o molestias tenemos los estudiantes de la Austral con el SIU Guaraní y el Campus Virtual.

Lleva 2 minutos y es anónimo. Con los resultados vamos a armar propuestas concretas de mejora.

👉 [https\://docs.google.com/forms/d/e/1FAIpQLSdL\_86CRqjIUQzChX246hhj0nSf0mSNdU3Ui-C5imsDttMUzQ/viewform?usp=publish-editor](https://docs.google.com/forms/d/e/1FAIpQLSdL_86CRqjIUQzChX246hhj0nSf0mSNdU3Ui-C5imsDttMUzQ/viewform?usp=publish-editor)

¡Si podés, reenviáselo a tus compañeros\! Cuantas más respuestas, más fuerza tiene el pedido 🙌

Contactos que nos pase Giulilana

# **SIU Guaraní y Campus Virtual: cómo funcionan hoy**

*Relevamiento de funcionalidades para HackAI, 10/11/2026. Hecho con una cuenta de alumno de Ingeniería en Informática, en modo solo lectura: no se confirmó, envió ni modificó nada. Los datos personales (nombre, notas, promedios, legajo) se reemplazaron por marcadores como \<nota\>.*  
**Cómo leer este documento:** “Clicks” cuenta los clicks de un usuario que navega por los menús desde la pantalla de inicio de cada sistema (SIU: siu.austral.edu.ar/portal/inicio\_alumno; Campus: campusvirtual.austral.edu.ar/my/), sin escribir URLs. Cada funcionalidad tiene para qué sirve, cómo se llega, los pasos, qué muestra la pantalla y las fricciones observadas. Lo que no se pudo ver figura como “Sin verificar”.

## **Resumen**

* Los dos sistemas no se hablan. El SIU tiene su propia Agenda, Cronograma de evaluaciones y bandeja de mensajes; el Campus tiene su Calendario, Calificaciones y Mensajería. El alumno tiene que revisar los dos para saber qué tiene que hacer y cuándo. El único puente visible es el botón “Ir” de SIU \> Reportes \> Mis inscripciones, que lleva al curso de Moodle.  
* En el SIU casi todo está a 1 o 2 clicks, pero las preguntas que más se hace un alumno no tienen respuesta directa: qué me falta para recibirme, qué finales tengo pendientes y cuántas faltas tengo. Hay que cruzar Plan de estudios, Historia académica e Inasistencias a mano.  
* El inicio del Campus no muestra próximas entregas, fechas ni avisos nuevos: solo tarjetas de cursos, mezcladas entre cuatrimestres actuales, terminados y de 2025, con la misma imagen y nombres con códigos internos (por ejemplo “26\|1C\|FI\|IND\|BIO\|INF\|ÉPROF … NO USAR”).  
* Las tareas más frecuentes del Campus cuestan 3 a 5 clicks: ver un archivo de la semana (3), leer el último aviso (3), entregar una tarea (5). En el SIU, inscribirse a una materia cuesta 3 clicks y a un final unos 4 (no verificado: hoy no hay mesas abiertas).  
* Hay datos contradictorios a la vista: el inicio del SIU avisa 4 requisitos de ingreso vencidos en 2023, mientras Trámites \> Requisitos de Ingreso dice “No posees requisitos de ingreso”. El contador de mensajes del SIU no coincide con los no leídos.  
* Hay links que no funcionan para un alumno: en el Campus, Reportes (Acceso denegado) y Solicitar curso de Teams (deshabilitado); en el SIU, Configuración (vuelve al inicio) y la Agenda (pantalla en blanco).  
* El alumno no puede darse de baja de un curso del Campus ni suscribirse o desuscribirse del foro de Avisos. Las notificaciones solo llegan por Web y Email: no hay canal push para la app.  
* Ambos sistemas son de escritorio. El SIU bloquea el zoom en celular y no tiene menú colapsable; el Campus es responsive pero esconde los accesos útiles en un cajón lateral y usa iframes de ancho fijo.

## **Tareas frecuentes: pasos y clicks**

La tabla compara cuánto cuesta cada tarea habitual hoy. Sirve como línea base para los KRs de pasos.

| Tarea | Sistema | Ruta | Clicks |
| :---- | :---- | :---- | :---- |
| Ver mis materias del cuatrimestre | Campus | Inicio (/my/) | 0, mezcladas con cursos terminados y de 2025 |
| Entrar a una materia | Campus | Inicio \> tarjeta del curso | 1 |
| Ver un archivo de la semana | Campus | Inicio \> curso \> pestaña de la semana \> archivo | 3 |
| Leer el último aviso de una materia | Campus | Inicio \> curso \> Avisos \> aviso | 3 |
| Entregar una tarea | Campus | Inicio \> curso \> pestaña \> tarea \> Agregar entrega \> Guardar cambios | 5 |
| Ver qué vence pronto | Campus | Menú \> Calendario (no hay nada en el inicio) | 1 |
| Ver mis notas del Campus | Campus | Menú de usuario \> Calificaciones \> curso | 2 a 3 |
| Inscribirme a una materia | SIU | Inscripción a Materias \> actividad \> Inscribirse | 3 |
| Darme de baja de una materia | SIU | Inscripción a Materias \> Inscripciones activas \> Dar de baja | 2 a 3 |
| Inscribirme a un final | SIU | Inscripción a Exámenes \> materia \> mesa \> confirmar | 4 estimado, sin verificar |
| Ver fechas de parciales | SIU | Reportes \> Cronograma de evaluaciones | 2 |
| Ver mi historia académica | SIU | Reportes \> Historia académica \> consulta habitual | 3 |
| Ver mi promedio | SIU | Reportes \> Promedio y porcentaje de avance | 2 |
| Saber qué me falta para recibirme | SIU | Plan de estudios \+ Historia académica, cruzando a mano | 2 por pantalla, sin respuesta directa |
| Saber cuántas faltas tengo | SIU | Reportes \> Inasistencias, contando filas | 2 |
| Pedir constancia de alumno regular | SIU | Trámites \> Solicitar Constancias \> Nueva solicitud \> Guardar | 4 |
| Leer comunicados de la facultad | SIU | Ícono de sobre \> mensaje | 2 |

## **Mapa de navegación**

### **SIU Guaraní (portal del alumno)**

**Barra superior:** logo Austral (vuelve al inicio), ícono de sobre con contador de mensajes, menú de usuario (Configuración, Cerrar sesión), selector “Propuesta: \<carrera\>”.  
**Menú principal y destinos:**

* Inscripción a Materias (link directo): /portal/cursada  
* Inscripción a Exámenes (link directo): /portal/examen  
* Reportes (desplegable de 13 ítems): Actuación provisoria, Agenda, Historia académica, Inasistencias, Mis inscripciones, Cronograma de evaluaciones, Oferta de comisiones, Plan de estudios, Seguimiento de Solicitud de Título, Seguimiento de Solicitud de Título en la Secretaría de Educación, Reporte de Solicitudes de Readmisión, Promedio y porcentaje de avance en la carrera, Vida Universitaria  
* Trámites (desplegable de 5 ítems): Orientación, Solicitar Constancias y Certificados, Reasignar Optativa, Descargar Analítico y Diploma Digital, Requisitos de Ingreso  
* Perfil: Alumno (selector con una sola opción)

Todas las pantallas usan URLs del tipo /portal/\<pantalla\>. Los pasos intermedios usan tokens (por ejemplo /portal/cursada/elegir\_materia/\<hash\>). Es un portal multipágina con Bootstrap 2: cada click recarga la página y los widgets cargan por AJAX con un texto “Cargando...”. No hay breadcrumbs, buscador de funciones, ayuda ni pie de página.

### **Campus Virtual (Moodle 5.1, tema Lambda 2\)**

**Encabezado:** logo (va a la Página Principal), campana de notificaciones, burbuja de mensajes, nombre y avatar (menú de usuario).  
**Menú principal:** Página Principal (/), Mis cursos (/my/), Calendario, Biblioteca digital (sitio externo), Planning (un curso que embebe la grilla de aulas), Ayuda Campus. A la derecha, una lupa que busca cursos.  
**Menú de usuario:** Perfil, Calificaciones, Calendario, Mensajes, Archivos privados, Reportes, Accessibility settings, Preferencias, Salir.  
**Dentro de un curso:** barra Curso, Participantes, Calificaciones, Actividades, Competencias, Más; el foro Avisos fijo arriba; pestañas por tema o semana (formato Onetopic); índice lateral izquierdo y cajón de bloques a la derecha.  
**Pie:** Resumen de conservación de datos y Obtener la App Mobile, más un botón flotante de accesibilidad.

## **SIU Guaraní: funcionalidades**

### **Pantalla de inicio**

**Para qué:** resume la situación del alumno en la carrera elegida: avisos administrativos, períodos de inscripción, turnos de examen, encuestas y sus inscripciones.  
**Cómo se llega:** es la pantalla de inicio (/portal/inicio\_alumno). Desde cualquier pantalla se vuelve con 1 click en el logo.  
**Qué muestra:**

* Saludo “Hola \<nombre\>” y un aviso amarillo cerrable de requisitos de ingreso adeudados, con una tabla Requisito / Fecha límite / Estado presentación digital (certificado y constancia de título secundario, DNI frente y dorso, foto; vencidos el 31/12/2023, estado “no\_presentado”).  
* Períodos lectivos: una tarjeta por período (Posgrado Anual 2026, Grado Anual 2026, Grado 2do Cuatrimestre 2026, Grado 3er Quarter 2026\) con tipo, fechas del período, fechas de inscripción y un botón “¡Agendalo\!”.  
* Turnos de examen (por ejemplo “FI \- Mesas Especiales”) con fechas de inicio y fin.  
* Encuestas pendientes (vacío: “No hay encuestas pendientes para completar”).  
* Columna derecha: “Inscripciones” con un desplegable sin etiqueta (Quincena, Mes, Trimestre, Cuatrimestre, Semestre) y “Inscripción a exámenes” (vacío: “Los exámenes a los que te inscribas aparecerán aquí.”).

**Fricciones:**

* El aviso de requisitos vencidos ocupa el centro del inicio, muestra el valor técnico “no\_presentado” y no linkea a Trámites \> Requisitos de Ingreso, que además dice que no hay requisitos.  
* Mezcla períodos de posgrado y grado sin priorizar lo vigente.  
* Los widgets de inscripciones están vacíos y no ofrecen un botón para inscribirse.  
* El viewport bloquea el zoom (maximum-scale=1.0).

### **Mensajes**

**Para qué:** bandeja de comunicados de la facultad. Es solo de recepción.  
**Cómo se llega:** ícono de sobre con contador, arriba a la derecha (1 click). URL /portal/mensajes.  
**Pasos:**

1. Click en el sobre.  
2. Se abre “Mensajes recibidos”: una fila por mensaje, del más nuevo al más viejo.  
3. Click en el asunto: el mensaje se expande en la misma lista y se marca como leído.

**Qué muestra:**

* Asunto en negrita, “Enviado el dd/mm/aaaa”, ícono de leído o no leído e ícono de adjunto.  
* Asuntos típicos: info de finales, talleres de empleo, avisos de internacionales, links de clases virtuales.  
* No hay remitente, buscador, filtros, paginación ni botón de responder.

**Fricciones:**

* No se puede responder ni escribir, aunque la pestaña del navegador dice “Envío de Mensajes”.  
* El remitente aparece vacío.  
* El contador (8) no coincide con los mensajes marcados como no leídos.  
* Mensajes de marzo y de noviembre conviven en una lista plana.

**Sin verificar:** cómo se ve un mensaje abierto y cómo se descargan los adjuntos (abrirlos los marca como leídos).

### **Menú de usuario: Configuración y Cerrar sesión**

**Para qué:** configuración de la cuenta y salida.  
**Cómo se llega:** click en el nombre del alumno \> Configuración o Cerrar sesión (2 clicks).  
**Qué muestra:** solo esas dos opciones. Configuración (/portal/configuracion) redirige al inicio sin mensaje.  
**Fricciones:**

* Configuración parece no hacer nada.  
* No hay acceso a datos personales, foto ni cambio de contraseña.

### **Selector de propuesta (por qué aparece “Aspirantes \- fi”)**

**Para qué:** elegir la carrera sobre la que se ve todo el SIU (inscripciones, historia, plan, reportes).  
**Cómo se llega:** botón “Propuesta: \<carrera\>” arriba a la derecha (1 click para abrirlo).  
**Qué muestra:**

* Dos opciones: “Aspirantes \- fi” e “Ingeniería en informática” (marcada con un tilde).  
* “Aspirantes \- fi” aparece gris, con la clase “pasivo” y el tooltip “No estás activo/a en Aspirantes \- fi”. El SIU lista todas las propuestas con las que el alumno tuvo vínculo, incluida la de aspirante de cuando ingresó, y marca como pasivas las inactivas.

**Fricciones:**

* Muestra una propuesta que ya no sirve y genera la duda de por qué el alumno “sigue siendo aspirante”. Si el SIU abre con esa propuesta elegida, el alumno tiene que cambiarla antes de hacer cualquier cosa.  
* La explicación está solo en un tooltip, que no funciona en el celular.

**Sin verificar:** qué se ve al elegir “Aspirantes \- fi” (no se cambió para no afectar la sesión).

### **Selector de perfil**

**Para qué:** cambiar entre perfiles del usuario.  
**Cómo se llega:** “Perfil: Alumno” al final de la barra de menú (1 click).  
**Qué muestra:** una única opción, “Alumno”.  
**Fricciones:**

* Ocupa lugar en la barra sin aportar nada a un alumno con un solo perfil.  
* Está lejos del nombre y del selector de propuesta, que son los otros controles de identidad.

### **Inscripción a Materias**

**Para qué:** inscribirse a cursadas y actividades del período y, en la misma pantalla, ver las inscripciones activas con comprobante y baja.  
**Cómo se llega:** menú \> Inscripción a Materias (1 click). Ver el botón Inscribirse: 2 clicks. Inscribirse: 3 clicks. URL /portal/cursada.  
**Pasos:**

1. Click en Inscripción a Materias.  
2. A la izquierda aparece el listado de actividades habilitadas. Se puede acotar con el buscador “Buscar actividad...” y el selector “Ver: Todas \| Sólo inscriptas”.  
3. Click en una actividad: a la derecha aparecen el nombre con su código (por ejemplo “Viajes Culturales (VUARTVIAJES5.2)”), los filtros Días, Turnos y Ubicación y las comisiones agrupadas por período.  
4. Cada comisión muestra Instancias (Promoción o Regularidad), Modalidades, Cupo con barra de porcentaje (por ejemplo “15 \| Inscriptos: 12”), Docentes y Observaciones.  
5. Click en “Inscribirse”, al pie de la comisión. Es el último paso (no se ejecutó).  
6. Si ya estás inscripto, en lugar del botón aparece una franja verde “Estás inscripto en \<comisión\>” con “Mostrar comprobante” y “Dar de baja”.

**Qué muestra:**

* Estado inicial: “Comenzar inscripción. Seleccioná una actividad del listado para ver aquí las comisiones y subcomisiones a las que te podés inscribir”.  
* En la cuenta relevada el listado tenía 9 actividades, casi todas extracurriculares (Ayudantía, Escuela de Ayudantes, Laboratorio III, Práctica Profesional Supervisada, Programa de Vida Universitaria, Representativo Acción Social, Trabajo de Grado, Viajes Culturales, Viajes Solidarios). Las materias del cuatrimestre aparecen solo abajo, en “Inscripciones activas”.  
* Filtros del detalle: Días (Lun a Dom y S/H, sin horario), Turnos (Mañana, Tarde, Noche) y Ubicación (Espacio Campana, Espacio Nordelta, Sede Buenos Aires, Sede Pilar, Sede Rosario).  
* Sección “Inscripciones activas” al final, con Mostrar comprobante y Dar de baja por cada inscripción (en el código también hay Imprimir y Enviar por mail).  
* Algunas comisiones tienen cupo “Sin definir” y advertencias en Observaciones (por ejemplo “Se penalizará...” en Ayudantía).

**Fricciones:**

* El listado muestra solo nombres: no indica cupo, créditos, horario ni si ya estás inscripto; hay que abrir actividad por actividad.  
* No aparecen correlativas ni requisitos: solo texto libre en Observaciones, mezclando aranceles, créditos, fechas y mails.  
* Horarios, aulas y turnos figuran casi siempre como “Sin definir”.  
* Filtrar por un día sobre una comisión sin horario deja el bloque vacío con una etiqueta “80%” suelta, sin decir “sin resultados”.  
* “Dar de baja” está pegado a “Mostrar comprobante” con el mismo peso visual.

**Sin verificar:** confirmación y mensajes al inscribirse (éxito, cupo lleno, correlativas, superposición horaria) y mensaje de período cerrado.

### **Dar de baja una inscripción a materia**

**Para qué:** cancelar una inscripción vigente.  
**Cómo se llega:** Inscripción a Materias \> sección Inscripciones activas, o abrir la actividad inscripta (2 clicks hasta ver el botón, 3 con la baja).  
**Pasos:**

1. Inscripción a Materias.  
2. Bajar hasta “Inscripciones activas” o abrir la actividad.  
3. Click en “Dar de baja” (botón gris con una X, sobre la franja verde). No se ejecutó.  
4. La inscripción queda en Reportes \> Mis inscripciones con estado “Baja”.

**Fricciones:**

* No informa si la baja está permitida ni hasta cuándo.  
* No se puede dar de baja desde Mis inscripciones, que es donde se ve el historial.

**Sin verificar:** diálogo de confirmación y mensaje posterior.

### **Oferta de comisiones**

**Para qué:** consultar todas las comisiones de todos los períodos con cupo, docentes, horarios y aulas. Es solo consulta.  
**Cómo se llega:** Reportes \> Oferta de comisiones (2 clicks). URL /portal/oferta\_comisiones.  
**Pasos:**

1. Reportes \> Oferta de comisiones.  
2. Se carga una página muy larga agrupada por período lectivo y actividad.  
3. Opcional: botón “Filtros” para mostrar u ocultar el panel y filtrar.

**Qué muestra:**

* Filtros: botones de día (Lunes a Domingo y Sin definir), Período lectivo (Todos, 2026 Grado Anual, 2026 Grado 2do Cuatrimestre, 2026 Grado 3er Quarter), Actividad y Docente con autocompletado (mínimo 3 letras) y Ubicación (Sede Buenos Aires, Pilar, Rosario).  
* Encabezado por actividad con nombre y código (por ejemplo “Álgebra II (GIINDAL2)”).  
* Por comisión: Comisión, Turno, Cupo / insc. (por ejemplo “20 / 1”), Instancias, Ubicación, Docentes y Observaciones, más una tabla de clases con Tipo de clase, Día, Horario y Aula.  
* Escala: unas 256 actividades y 518 comisiones en una sola página, sin paginación.

**Fricciones:**

* Página gigante y lenta, sin orden ni buscador global; no filtra por la carrera del alumno (aparecen deportes y voluntariados de todas las sedes).  
* No hay botón de inscripción ni link a la actividad: hay que ir a Inscripción a Materias y buscarla de nuevo.  
* El cupo “20 / 1” no dice si quedan lugares. Muchos datos en “Sin definir” y “Aula a determinar”.  
* Los filtros no muestran cuántos resultados quedan ni tienen “limpiar filtros”.

### **Mis inscripciones**

**Para qué:** historial y estado de las inscripciones a cursadas y exámenes, comprobantes y acceso al curso en Moodle.  
**Cómo se llega:** Reportes \> Mis inscripciones (2 clicks). URL /portal/inscripciones.  
**Pasos:**

1. Reportes \> Mis inscripciones.  
2. Se ve “Cursadas \- Períodos lectivos vigentes”, de la más reciente a la más antigua.  
3. Opcional: tildar “Inscripciones históricas” para sumar períodos anteriores (en la cuenta relevada pasa a unas 83 filas, 2023 a 2026).  
4. Por fila: “Generar” (comprobante) o “Ir” (abre el curso en el Campus).

**Qué muestra:**

* Columnas: Fecha inscripción, Año, Período lectivo, Propuesta, Actividad (con código), Comisión, Subcomisión, Turno, Cátedra, Ubicación, Estado (Aceptada o Baja), Comprobantes y Moodle.  
* El botón “Ir” de la columna Moodle aparece solo en materias con curso en el Campus.  
* Segunda sección “Exámenes \- Turnos de exámenes vigentes” (vacía: “No hay información sobre exámenes”).

**Fricciones:**

* Tabla de 13 columnas, varias siempre en “Sin definir” o “No tiene”; ilegible en celular.  
* Bajas y aceptadas mezcladas, sin filtros ni orden.  
* “Generar” no dice qué genera e “Ir” no dice que lleva a Moodle.  
* Está bajo Reportes, lejos de Inscripción a Materias.

### **Inscripción a Exámenes**

**Para qué:** inscribirse a mesas de examen final (y darse de baja).  
**Cómo se llega:** menú \> Inscripción a Exámenes (1 click). Inscribirse a un final, estimado: 4 clicks (menú, materia, mesa, confirmar). URL /portal/examen.  
**Pasos (esperados, no verificados porque hoy no hay mesas abiertas):**

1. Click en Inscripción a Exámenes.  
2. Elegir la materia en el listado de la izquierda.  
3. En la columna central “Comenzar inscripción” aparecen las mesas o llamados de esa materia.  
4. Elegir la mesa y confirmar; el examen pasa al panel derecho “Inscripción a exámenes”.

**Qué muestra hoy:**

* Caja amarilla “No hay actividades disponibles para inscribirse”.  
* Columna central con “Seleccioná una actividad del listado para ver aquí las mesas a las que te podés inscribir”.  
* Panel derecho con el mismo desplegable de período del inicio y la lista de exámenes inscriptos (vacía).

**Fricciones:**

* El estado vacío no explica por qué no hay materias (sin mesas abiertas, falta de cursada aprobada o requisitos adeudados).  
* Pide seleccionar una actividad de un listado que está vacío.

**Sin verificar:** listado de materias, mesas, tipo de inscripción, requisitos, botón final y cómo darse de baja. Hay que repetirlo con un alumno que tenga mesas abiertas.

### **Cronograma de evaluaciones**

**Para qué:** ver fechas de parciales y trabajos prácticos de las materias que se cursan.  
**Cómo se llega:** Reportes \> Cronograma de evaluaciones (2 clicks). URL /portal/cronograma\_evaluaciones.  
**Qué muestra:**

* Un bloque por materia: “Nombre (CÓDIGO) \- Comisión: \<comisión\>”.  
* Tabla con Fecha, Evaluación (Primer Checkpoint, Primer Parcial, etc.), Tipo (Trabajo Práctico, Parcial), Hora inicio, Hora fin y Observaciones (siempre vacía).  
* Sin filtros, exportación ni sincronización con calendarios.

**Fricciones:**

* Ordenado por materia y no por fecha: para saber qué viene primero hay que leer todas las tablas.  
* No distingue evaluaciones pasadas de futuras.  
* Hay horarios mal cargados (parciales de 03:15 a 03:30) que el sistema no marca.  
* No muestra aula ni modalidad y no se integra con la Agenda.

### **Agenda**

**Para qué:** debería ser el calendario del alumno.  
**Cómo se llega:** Reportes \> Agenda (2 clicks). URL /portal/calendario.  
**Qué muestra:** solo el panel lateral “Inscripciones” con el desplegable de período y “Los exámenes a los que te inscribas aparecerán aquí.” El área principal queda en blanco, sin título, grilla, vistas ni mensaje.  
**Fricciones:**

* Parece una página rota.  
* No reúne clases, parciales ni finales, y no exporta a Google u Outlook.

**Sin verificar:** cómo se ve con exámenes inscriptos.

### **Actuación provisoria**

**Para qué:** notas cargadas de forma provisoria (sin acta cerrada) del período en curso.  
**Cómo se llega:** Reportes \> Actuación provisoria (2 clicks).  
**Qué muestra:**

* Tres secciones: Cursadas, Promociones y Exámenes.  
* Columnas: Propuesta, Actividad, Fecha, Nota, Resultado, Nro. Acta, Año Académico, Período Lectivo, Comisión.  
* Vacíos: “No hay información sobre actuaciones provisorias en promociones” (y en exámenes).

**Fricciones:**

* “Actuación provisoria” es jerga administrativa: el alumno no sabe que ahí están sus notas recientes.  
* No explica qué significa “provisoria” ni cuándo pasa a la historia académica; celdas vacías sin explicación.

### **Historia académica**

**Para qué:** historial completo de cursadas, exámenes, equivalencias y resoluciones.  
**Cómo se llega:** Reportes \> Historia académica (2 clicks; 3 para ver datos). URL /portal/historia\_academica.  
**Pasos:**

1. Reportes \> Historia académica.  
2. La pantalla arranca vacía con el aviso “O utilice los filtros para personalizar su búsqueda”.  
3. Elegir una consulta habitual (Materias en curso, Materias aprobadas, Cursadas aprobadas, Historia completa) o tildar filtros.  
4. Opcional: “Ver por” Año o Actividad/Reconocimiento; en vista Año, desplegable con cada año.  
5. Opcional: “Detalle” en cada fila (muestra Turno, Mesa, Condición y Año académico).

**Qué muestra:**

* 12 filtros: Cursadas (Promocionada, Aprobada, Desaprobada, Ausente/Libre, En curso), Exámenes (Aprobado, Desaprobado, Ausente) y Reconocimientos (Equivalencias aprobadas y desaprobadas, Aprobaciones por resolución, Créditos).  
* Por materia: filas de Examen, Regularidad, Promoción, Equivalencia o En curso, con \<nota\> en letras y número, resultado y fecha.  
* Exportación a Excel y PDF (íconos arriba a la derecha).

**Fricciones:**

* No hay vista por defecto: siempre hace falta un click extra.  
* Una materia ocupa dos filas (por ejemplo Regularidad y Examen) en distinto orden según la materia.  
* Las actividades de Vida Universitaria y deportes se mezclan con las de la carrera.  
* No hay switch “con/sin aplazos”: el promedio está en otra pantalla.  
* No responde “qué finales tengo pendientes”: hay que buscar materias con Regularidad y sin Examen.

### **Inasistencias**

**Para qué:** faltas registradas por materia en el período actual.  
**Cómo se llega:** Reportes \> Inasistencias (2 clicks).  
**Qué muestra:**

* Un bloque por materia con Fecha, Tipo de clase, Tema dictado, Cant. inasistencias (con formato “1.00”) y Justificada (Sí/No).  
* Sin totales, filtros, límite de faltas ni exportación.

**Fricciones:**

* Para saber cuántas faltas tenés hay que contar filas, y no dice cuántas hacen perder la regularidad.  
* Usa nombres de materia distintos a los del plan (“Técnicas de Comunicación” en lugar de “Comunicación Efectiva”).  
* No muestra períodos anteriores.

### **Plan de estudios**

**Para qué:** plan completo de la carrera por año, con el estado de cada materia y sus correlativas.  
**Cómo se llega:** Reportes \> Plan de estudios (2 clicks; 3 por cada correlativa consultada). URL /portal/plan\_estudio.  
**Pasos:**

1. Reportes \> Plan de estudios.  
2. Cabecera con propuesta, plan (por ejemplo IINF Plan 2023\) y versión.  
3. Botones Expandir y Contraer para los módulos.  
4. Botón “Ver” en la columna Correlativas: despliega “Para cursar” con una tabla Requisito / Condición y un botón “Verificar”.

**Qué muestra:**

* Módulos de 1er a 5to año, Materias Optativas, Otros Requisitos y Programa de Vida Universitaria.  
* Columnas: Actividad (con código), Tipo, Año, Período, Nota, Origen (Examen, Promoción o Regularidad), Créditos, Puntaje y Correlativas.  
* Aprobadas con \<nota\> y (Aprobado) o (Promocionado); en curso con “En Curso”; pendientes con celdas vacías.  
* Optativas: “Obtener 384 horas de actividades aprobadas”. Otros requisitos: Práctica Profesional Supervisada, Taller de Expresión Oral y Escrita, Inglés I y II.  
* Exportación a PDF y Excel.

**Fricciones:**

* No hay resumen de lo que falta: las pendientes solo se reconocen por tener celdas vacías.  
* Las correlativas se ven de a una y no indican si ya las cumplís; no hay vista de “qué puedo cursar ahora”.  
* Columnas Año, Período y Puntaje siempre vacías; página larga sin índice.

**Sin verificar:** qué hace el botón “Verificar”.

### **Promedio y porcentaje de avance en la carrera**

**Para qué:** promedio general y avance de la carrera.  
**Cómo se llega:** Reportes \> Promedio y porcentaje de avance en la carrera (2 clicks; es de los últimos ítems del menú).  
**Qué muestra:**

* “Promedio general en la carrera con aplazos: \<promedio\>” y “sin aplazos: \<promedio\>”.  
* Tabla: Certificado, Orientación, Ori. Elegida, % de Avance, Aprobadas, Promedio con y sin aplazos.

**Fricciones:**

* El avance es un número sin barra ni explicación de cómo se calcula.  
* “Aprobadas” no dice sobre cuántas materias del plan.  
* Es el único lugar con el promedio y está escondido al final del menú.

### **Vida Universitaria**

**Para qué:** actividades extracurriculares aprobadas y créditos del Programa de Vida Universitaria.  
**Cómo se llega:** Reportes \> Vida Universitaria (2 clicks).  
**Qué muestra:** “Total de créditos aprobados: \<n\>” y una tabla Actividad, Comisión, Nota, Fecha, Créditos.  
**Fricciones:**

* No dice cuántos créditos se necesitan ni cuánto falta.  
* No muestra actividades en curso ni categoría (deporte, arte, acción social).  
* La pestaña del navegador queda sin título.

### **Solicitar constancias y certificados**

**Para qué:** pedir constancias digitales y ver las ya pedidas. Es el único trámite con un flujo completo dentro del SIU.  
**Cómo se llega:** Trámites \> Solicitar Constancias y Certificados (2 clicks); formulario nuevo: 3 clicks; enviar: 4 clicks. URL /portal/solicitudes.  
**Pasos:**

1. Trámites \> Solicitar Constancias y Certificados: se ve el “Listado de solicitudes”.  
2. Click en “Nueva solicitud” (arriba a la derecha).  
3. Elegir “Constancia (\*)”: solo hay dos opciones, Constancia de Alumno Regular y Constancia Examen Final.  
4. Elegir “Copias (\*)”, de 1 a 10 (el desplegable aparece vacío hasta elegir la constancia).  
5. Escribir “Presentar a (\*)”, texto libre sin ejemplo.  
6. Opcional: Observaciones.  
7. Click en “Guardar” (o “Volver”). No se ejecutó.

**Qué muestra:**

* Listado con Constancia, Fecha solicitud, Presentar a, Solicitado en (“Autogestión”), Copias, Estado (“Online”) y Fecha vencimiento (unos 60 días después).  
* Checkbox “Solicitudes históricas” (recarga la página; en la cuenta relevada mostró “No hay solicitudes para mostrar”).

**Fricciones:**

* El estado “Online” parece un canal, no un estado: no se sabe si la constancia está lista.  
* No se ve un botón para descargar o imprimir la constancia.  
* El botón final dice “Guardar” en lugar de “Solicitar”.  
* Solo hay dos tipos: el resto (analítico, certificado de materias) presumiblemente va por bedelía.

**Sin verificar:** qué pasa al guardar, otros estados posibles y cómo se obtiene el PDF.

### **Reasignar optativa**

**Para qué:** asignar optativas cursadas a una categoría genérica del plan (por ejemplo Arte y Cultura) para que cuenten.  
**Cómo se llega:** Trámites \> Reasignar Optativa (2 clicks).  
**Pasos:**

1. Trámites \> Reasignar Optativa.  
2. En la tabla “Optativas compartidas” elegir en “Reasignar a” una genérica por fila.  
3. Click en “Confirmar”, único botón al pie. No se ejecutó.

**Qué muestra:** columnas Optativa, Estado, Asignada a, Genérica y Reasignar a; filas con “\<Sin Asignación\>” y desplegables con dos genéricas posibles por fila.  
**Fricciones:**

* Las opciones cambian por fila sin explicar por qué.  
* No aclara si el cambio es reversible ni si “Confirmar” guarda todas las filas.  
* Nombres crípticos (“Excepción 0,50”) y valores de sistema (“\<Sin Asignación\>”).

### **Requisitos de ingreso**

**Para qué:** ver la documentación de ingreso y su estado.  
**Cómo se llega:** Trámites \> Requisitos de Ingreso (2 clicks).  
**Qué muestra:** “No posees requisitos de ingreso”.  
**Fricciones:**

* Contradice el aviso del inicio, que lista 4 requisitos vencidos. El aviso probablemente viene de la propuesta pasiva “Aspirantes \- fi”.  
* No hay forma de subir documentación ni contacto (“Comunícate con el departamento de alumnos” sin datos).

### **Pantallas que hoy aparecen vacías**

Estas pantallas están a 2 clicks y en la cuenta relevada solo muestran un mensaje de una línea, sin explicar para qué sirven ni cómo iniciar el trámite:

* Trámites \> Orientación: “No hay información sobre orientaciones”. Aparece aunque la carrera no tenga orientaciones.  
* Trámites \> Descargar Analítico y Diploma Digital: “No se encontraron trámites de certificación.” Solo aplica a egresados.  
* Reportes \> Seguimiento de Solicitud de Título: “No se encontraron trámites de solicitud de títulos”. No dice cómo iniciar la solicitud.  
* Reportes \> Seguimiento de Solicitud de Título en la Secretaría de Educación (SICer): “No hay registros que cumplan los criterios indicados.”, aunque no hay filtros. Es la etapa nacional del título; la diferencia con el anterior no se explica.  
* Reportes \> Reporte de Solicitudes de Readmisión: “Sin solicitudes”. Solo es reporte, no permite pedir la readmisión.

**Fricciones:** trámites de título y readmisión viven en Reportes y no en Trámites, y se muestran a todos los alumnos aunque solo apliquen a egresados o a quienes perdieron la regularidad.

## **Campus Virtual: funcionalidades**

### **Inicio (Mis cursos)**

**Para qué:** pantalla de entrada del alumno: lista sus cursos y ofrece accesos rápidos en un cajón lateral.  
**Cómo se llega:** es el inicio (/my/). Entrar a una materia: 1 click en su tarjeta.  
**Pasos:**

1. Entrar a campusvirtual.austral.edu.ar/my/ (el login redirige acá).  
2. Click en la tarjeta del curso.  
3. Opcional: ícono “Change View” para alternar tarjetas y lista.  
4. Opcional: botón “Todos los cursos” para el catálogo.  
5. Opcional: pestañita del borde derecho para abrir el cajón de bloques.

**Qué muestra:**

* Un único bloque “Mis Cursos” con 14 cursos en grilla de 3 columnas, todos con la misma imagen oscura y el nombre en una franja negra truncada con “...”.  
* Vista lista: miniatura, nombre completo y categoría (por ejemplo “Tercer Año \| FI”).  
* No hay línea de tiempo, próximas entregas, eventos, mini calendario ni filtros.

**Fricciones:**

* Orden sin criterio visible: mezcla 1C, 2C, anuales y un curso del 2C 2025\.  
* Las tarjetas son idénticas y los nombres llevan códigos de gestión y hasta “NO USAR”.  
* Para ver qué vence hay que ir al Calendario o entrar curso por curso.  
* “Change View” está en inglés y no indica la vista actual.

### **Nombres de los cursos (cómo distinguir actuales y viejos)**

**Para qué:** el prefijo del nombre es la única pista del período de cada curso.  
**Qué muestra:**

* Patrón mayoritario: “\<período\> \| \<año\> \| \<carrera\> \| \<sigla\> \<Nombre\> \<año\>”, por ejemplo “1C \| 26 \| INF \| IA Inteligencia Artificial 26”.  
* Períodos 1C, 2C y ANUAL; año como 25, 26 o 2026; carrera INF, IND, FI, BIO, F u OPT.  
* Variantes: “2C \| 2026 \| INF \| ANAWS”, “2C\|26\|F\|INF\|LEG”, “26\|1C\|FI\|IND\|BIO\|INF\|ÉPROF” (orden invertido).

**Fricciones:**

* El 10/11/2026 el 1C ya terminó pero se lista igual que el 2C; no hay etiquetas “En curso” o “Finalizado”.  
* El formato es irregular, así que ordenar por nombre no ordena por período. Se podría derivar período, año y carrera de estos campos para mostrar etiquetas.

### **Mis cursos con filtros (/my/courses.php)**

**Para qué:** vista estándar de Moodle con filtros, orden, búsqueda y tres vistas. Es más completa que el inicio pero está escondida.  
**Cómo se llega:** solo por URL directa. El ítem “Mis cursos” del menú lleva a /my/.  
**Qué muestra:**

* Filtro con tres opciones: Todos, Destacados y Quitado de la vista. No existen En progreso, Futuros ni Pasados.  
* Búsqueda por nombre, orden (nombre del curso, nombre corto, último accedido) y vista (Tarjeta, Lista, Resumen).  
* Por curso: miniatura distinta, nombre corto (por ejemplo “2C \| 2026 \| INF \| SD”), nombre, “N% completado” en algunos y menú de tres puntos con Destacar y Quitar de la vista.  
* Paginación 12, 24 o Todos.

**Fricciones:**

* No hay filtro por período, que es lo que el alumno necesita.  
* El progreso es poco confiable (cursos del 1C al 100%, otros sin dato).  
* Carga con un spinner y la pantalla vacía unos segundos.

### **Encabezado: notificaciones, mensajes y menú de usuario**

**Para qué:** navegación global, avisos y acceso a herramientas personales.  
**Cómo se llega:** está en todas las páginas; 1 click abre cada panel y 2 clicks llegan a la sección.  
**Qué muestra:**

* Campana: popover con las últimas notificaciones (texto, antigüedad y “Ver notificación completa”), íconos de marcar todo como leído y de preferencias, y “Verlo todo”.  
* Burbuja: cajón de mensajería con búsqueda, Contactos y secciones Destacados, Grupo y Privado.  
* Menú de usuario: Perfil, Calificaciones, Calendario, Mensajes, Archivos privados, Reportes, Accessibility settings, Preferencias, Salir.

**Fricciones:**

* Nombre e íconos en gris sobre una foto oscura: bajo contraste.  
* Notificaciones genéricas (“Ha cambiado el contenido en \<curso\>”) y viejas.  
* Calendario duplicado en los dos menús; ítems en inglés; Reportes da error.

### **Cajón lateral de bloques**

**Para qué:** accesos institucionales y a Microsoft 365\.  
**Cómo se llega:** pestañita con flecha en el borde derecho del inicio (1 click); un recurso externo queda a 2 clicks. En la Página Principal aparece abierto.  
**Qué muestra:**

* Zona de entrenamiento para alumnos: link “Clic Aquí” a un curso de práctica y la contraseña de matriculación en texto plano.  
* Grado \- Aulas de Zoom seguras: link a una guía en Genially.  
* ¡App del campus\!: “Descargá la app en tu tienda colocando la palabra Moodle” y un PDF de instrucciones.  
* Microsoft: “Usted está actualmente conectado a microsoft 365” con Mi Email (Outlook), Mi OneDrive (SharePoint), Microsoft Stream, Microsoft Stream (classic), Microsoft Teams, Configuraciones de Sincronización de Calendario de Outlook y Solicitar curso de Teams.  
* Tweets de UA (link a X).

**Fricciones:**

* Los accesos más usados (mail, Teams, OneDrive) están escondidos y al fondo del cajón.  
* Links “Clic Aquí” sin describir el destino; errores de redacción (“Si sos alumnos”).  
* Stream classic está discontinuado y Solicitar curso de Teams da error.  
* Al abrirse ocupa casi un tercio de la pantalla y empuja el contenido.

### **Página Principal**

**Para qué:** portada institucional.  
**Cómo se llega:** menú \> Página Principal, o el logo (1 click).  
**Qué muestra:** foto del campus, “Bienvenidos al Campus Virtual de la Universidad Austral”, un recorrido interactivo en Genially, tarjetas Calendario Académico 2026 (PDF), Internacionales y Reglamento de Alumnos, redes sociales, el cajón de bloques abierto con “Usuarios en línea” y un link para reiniciar el tour guiado.  
**Fricciones:**

* No muestra nada personal ni accionable.  
* “Internacionales” lleva al catálogo de cursos, no a información de intercambios.  
* “Usuarios en línea” expone nombres de otras personas.

### **Catálogo de cursos y autoinscripción**

**Para qué:** recorrer todas las categorías de cursos, buscar y autoinscribirse donde esté habilitado.  
**Cómo se llega:** inicio \> botón “Todos los cursos” (1 click). URL /course/.  
**Pasos:**

1. Click en “Todos los cursos”.  
2. Abrir una categoría del acordeón o usar “Buscar cursos”.  
3. En el resultado, click en “Haga clic aquí para entrar al curso”.  
4. Se abre “Detalles de matriculación”: según el curso, campo de clave y botón para matricularse, o “No se puede auto matricular en este curso.” con “Continuar”.

**Qué muestra:**

* 15 categorías de primer nivel (facultades, sedes, áreas centrales) y un desplegable de 1267 categorías con hasta 6 niveles (Facultad \> Grado \> Cursada \> 2026 \> 1er cuatrimestre \> 1er año).  
* Resultados de búsqueda con nombre, categoría, profesor y paginación, mezclando cursos de 2023 a 2026\.  
* Al entrar a la matriculación el encabezado cambia al de “Austral Ingeniería”.

**Fricciones:**

* Catálogo inabarcable y sin filtro por facultad, carrera o año.  
* El botón promete entrar al curso pero lleva a la matriculación, y en grado casi siempre dice que no se puede.  
* No explica que la matrícula de grado depende de otro proceso.

**Sin verificar:** el formulario con clave de matriculación (el curso probado no lo tenía).

### **Estructura de un curso**

**Para qué:** pantalla principal de cada materia, con el contenido en pestañas por tema o semana.  
**Cómo se llega:** inicio \> tarjeta del curso (1 click); una semana concreta: 2 clicks. Se relevaron Sistemas Distribuidos 2C 2026, Laboratorio III anual e IA Generativa 2C 2026\.  
**Pasos:**

1. Click en la tarjeta del curso.  
2. El curso abre en alguna pestaña de tema, no siempre la primera ni la actual.  
3. Click en otra pestaña (Semana N, Trabajo Práctico Final, etc.): recarga la página completa.  
4. Opcional: botón de índice del curso (arriba a la izquierda) o cajón de bloques (derecha).

**Qué muestra:**

* Migas de pan: Cursos / Facultad / Grado \| FI / Año / Curso / Tema.  
* Barra del curso: Curso, Participantes, Calificaciones, Actividades, Competencias y Más (este último solo tiene Descargar contenido del curso y Centro de descargas).  
* Link fijo al foro “Avisos” arriba de las pestañas.  
* Pestañas según el docente. Sistemas Distribuidos: Programa, Semana 1 a 12, Trabajo Práctico Final, Simulacro parcial y Documentación (16, en dos filas). Laboratorio III: Visión y estructura del proyecto y Sprint 1 a 5\. IA Generativa: seis pestañas temáticas.  
* Dentro de cada pestaña, subtítulos (por ejemplo Teoría y Práctica) y actividades con ícono por tipo: archivo PDF o PPT, URL, tarea y foro.  
* Cajón derecho con bloques que varían por curso: Profesores, mini calendario, Herramientas Office, Buscar en los foros, Mensaje al Profesor, un video de prevención de COVID-19.

**Fricciones:**

* El alumno tiene que buscar la semana actual entre hasta 16 pestañas, y cada cambio recarga la página.  
* Cada docente organiza distinto; hay pestañas vacías (Documentación, Competencias).  
* Contenido heredado sin limpiar: textos de plantilla (“Nombre del curso \- Ingeniería ...”), tareas “\[NoUsar\]” y fechas de 2022 y 2025 en cursos de 2026\.  
* No hay indicador de progreso ni de “qué sigue”.

### **Ver los archivos de una semana**

**Para qué:** abrir diapositivas, apuntes y guías publicadas por el docente.  
**Cómo se llega:** inicio \> curso \> pestaña de la semana \> archivo (3 clicks).  
**Pasos:**

1. Click en la tarjeta del curso.  
2. Click en la pestaña de la semana.  
3. Click en el archivo: el PDF se abre en la misma pestaña con el visor del navegador.

**Fricciones:**

* El PDF reemplaza la pestaña: para volver hay que usar Atrás y se pierde la posición.  
* El título que muestra el navegador es el del metadato del archivo, no el de la actividad.  
* Semanas con 2 o 3 archivos ocupan una pestaña entera.

### **Foro de Avisos**

**Para qué:** novedades del docente. El alumno solo lee.  
**Cómo se llega:** inicio \> curso \> “Avisos” (2 clicks); leer el último aviso: 3 clicks.  
**Pasos:**

1. Click en la tarjeta del curso.  
2. Click en “Avisos”, arriba de las pestañas.  
3. Se ve la tabla de debates, el más reciente arriba.  
4. Click en el título para leerlo; al pie hay Anterior, Regresar a Curso y Siguiente.

**Qué muestra:**

* Banner “Avisos y novedades generales”, búsqueda en foros y tabla con Debate, Comenzado por, Último mensaje y Réplicas.  
* El menú de cada aviso solo ofrece “Marcar como favorita esta discusión”.  
* Aviso abierto: título, autor, fecha completa, cuerpo y enlace permanente.  
* En IA Generativa conviven “Avisos Generales” (vacío), “Noticias” y “Foro social”.

**Fricciones:**

* No hay opción para suscribirse o desuscribirse: el alumno no controla qué avisos le llegan.  
* La lista no muestra un adelanto: hay que abrir aviso por aviso.  
* Cuando hay varios foros no queda claro cuál es el canal oficial.  
* La miga de pan del foro puede mostrar una semana a la que no pertenece (“Semana 10 / Avisos”).

### **Entregar una tarea**

**Para qué:** ver consigna, fechas y estado; subir o editar la entrega y comentarla.  
**Cómo se llega:** inicio \> curso \> pestaña del tema \> tarea (3 clicks); formulario de entrega: 4; guardar: 5\.  
**Pasos:**

1. Click en la tarjeta del curso.  
2. Click en la pestaña donde está la tarea.  
3. Click en el título de la tarea.  
4. Click en “Agregar entrega” (o “Editar entrega” si ya hay una).  
5. Subir el archivo arrastrándolo o con el selector (ejemplo: máximo 250 MB, 1 archivo, solo PDF).  
6. Click en “Guardar cambios”. No se ejecutó.

**Qué muestra:**

* Apertura y Cierre con día y hora, descripción colapsable y archivo de consigna.  
* Tabla “Estado de la entrega”: Grupo, Estado de la entrega (por ejemplo “Enviado para calificar”), Estado de la calificación, Tiempo restante, Última modificación, Archivos enviados y Comentarios de la entrega.  
* Comentarios colapsados en “Comentarios (N)”: al abrirlos se ven completos, con un campo para agregar otro.  
* Tarea grupal sin grupo: aviso rojo “Usted no es miembro de ningún grupo, así que no puede realizar entregas”, sin botón de entrega y “La Tarea está retrasada por: 1 año 170 días”.

**Fricciones:**

* “Borrar entrega” está al lado de “Editar entrega”.  
* Guardar equivale a enviar: no hay borrador.  
* Los comentarios quedan ocultos detrás de un colapsable fácil de pasar por alto.  
* El alumno sin grupo se entera recién al abrir la tarea.

**Sin verificar:** cómo se ve la devolución del docente en una tarea calificada (ninguna estaba calificada) y si ahí se corta el texto con “...”.

### **Participantes, Calificaciones, Actividades y Competencias del curso**

**Para qué:** ver compañeros, las notas del curso, un resumen de actividades y competencias.  
**Cómo se llega:** curso \> pestaña correspondiente (2 clicks).  
**Qué muestra:**

* Participantes: filtro por grupo (viene aplicado el grupo propio), filtro por inicial y tabla con Nombre, Roles, Grupos y Último acceso al curso.  
* Calificaciones: ítems con Ponderación calculada, Calificación, Rango, Porcentaje, Retroalimentación y Aporta al total, más el Total del curso.  
* Actividades: acordeones cerrados de Foros, Recursos y Tareas.  
* Competencias: “No se han vinculado competencias con este curso”.

**Fricciones:**

* Se ve el último acceso de los compañeros.  
* Competencias vacía pero visible; Actividades no muestra fechas hasta abrir cada acordeón.

### **Marcas de completado**

**Para qué:** marcar manualmente una actividad como hecha.  
**Cómo se llega:** dentro del curso, botón “Marcar como hecha” junto a la actividad.  
**Qué muestra:** aparece en Laboratorio III e IA Generativa (incluso en el texto de bienvenida y el foro social); en Sistemas Distribuidos no existe. No hay barra de progreso.  
**Fricciones:**

* Es manual: entregar una tarea no la marca sola.  
* Inconsistente entre cursos, sin resumen de avance.

### **Darse de baja de un curso**

No existe para el alumno. Se revisaron el menú Más del curso, el menú de usuario y los links de la página. La matrícula se gestiona por fuera del Campus y la pantalla no explica cómo darse de baja.

### **Calificaciones (vista general)**

**Para qué:** nota total de cada curso.  
**Cómo se llega:** menú de usuario \> Calificaciones (2 clicks); detalle de un curso: 3 clicks.  
**Qué muestra:**

* Tabla “Cursos que yo estoy tomando” con Nombre del curso y Calificación: 14 cursos, casi todos con “-”.  
* Detalle por curso: ítem, Ponderación calculada, Calificación, Rango, Porcentaje, Retroalimentación, Aporta al total y Total del curso.

**Fricciones:**

* Cursos de todos los períodos mezclados, con nombres en código.  
* “-” sin explicar si significa sin notas o sin calificar; escalas 0-100 y 0-10 mezcladas.  
* No aclara si estas notas o las del SIU son las oficiales.

### **Calendario**

**Para qué:** fechas de entregas y eventos de todos los cursos.  
**Cómo se llega:** menú \> Calendario (1 click). Vista día o próximos: 3 clicks. Importar o exportar: 2 clicks.  
**Pasos:**

1. Click en Calendario: muestra el mes actual.  
2. Cambiar de mes con las flechas o de vista con el desplegable (Mes, Día, Próximos).  
3. Filtrar por curso con “Lista de cursos”.  
4. Click en un evento: abre la actividad.  
5. Al pie, “Importar o exportar calendarios”: importar un .ics o URL (con intervalo de actualización) o exportar eligiendo eventos (todos, de cursos, de grupos, personales) y período (semana, mes, 60 días, rango).

**Qué muestra:** grilla mensual, botón “Nuevo evento” y, en noviembre, un solo evento (“Entrega final trabajo práctico” el 5/11). Día y Próximos: “No hay eventos este día.” y “No hay eventos próximos”.  
**Fricciones:**

* El filtro lista los 14 cursos, incluidos los terminados, con nombres truncados.  
* Exportar lleva tres pantallas y un texto técnico; no hay “Agregar a Google Calendar”.  
* No incluye los parciales del SIU.

### **Mensajería**

**Para qué:** chat interno con docentes y compañeros.  
**Cómo se llega:** burbuja del encabezado (1 click, abre un cajón) o menú de usuario \> Mensajes (2 clicks).  
**Qué muestra:** búsqueda, Ajustes, Contactos y secciones Destacados, Grupo y Privado con contador; el panel derecho queda vacío hasta elegir una conversación.  
**Fricciones:**

* Panel vacío sin texto guía.  
* Es un segundo sistema de mensajes, separado del SIU.

### **Notificaciones y preferencias de notificación**

**Para qué:** historial de avisos del sistema y elección de canales.  
**Cómo se llega:** campana (1 click) \> Verlo todo (2). Preferencias: menú de usuario \> Preferencias \> Preferencias de notificación (3 clicks), o el engranaje de la campana.  
**Qué muestra:**

* Página de notificaciones: “Seleccionar de entre la lista de notificaciones a un lado para ver más detalles”.  
* Preferencias: interruptor “Deshabilitar notificaciones” y una tabla con columnas Web y Email. No hay columna Push.  
* Decenas de tipos agrupados por módulo, todos activos en Web y Email: Tarea (pronto a vencer, vencida, pendientes en 7 días), Foro (mensajes suscritos, resúmenes), Retroalimentación, Cuestionario, Examen, Certificados, Sistema (calificaciones, curso completado, cambios de contenido del curso), Quickmail, Mensaje para Mi Maestro, inscripciones, Bulk actions csv (Unenrol users, Delete users) y más.

**Fricciones:**

* Sin canal push: la app oficial de Moodle no recibe avisos.  
* Lista enorme, con tipos irrelevantes para un alumno y textos en inglés.

**Sin verificar:** cómo se ve cada notificación y “marcar todo como leído” (no había notificaciones nuevas).

### **Perfil, Preferencias y otras herramientas personales**

Todas están en el menú de usuario, a 2 clicks:

* Perfil: iniciales sin foto, email visible para los compañeros, zona horaria, insignias, cursos, certificados, mensajes en foros, último acceso y un código QR para entrar desde la app (vence en 10 minutos). No muestra carrera ni datos del SIU.  
* Preferencias: Editar perfil, Idioma, Foro, Editor, Calendario, Banco de contenidos, Llaves de seguridad, Mensajes, Notificaciones, Blogs e Insignias. No hay cambio de contraseña.  
* Archivos privados: espacio de 100 MB con Agregar, Crear directorio, Descargar y Eliminar.  
* Reportes: “Acceso denegado” para un alumno, aunque figura en el menú.  
* Resumen de conservación de datos (pie): todas las secciones dicen “No se ha definido un período de retención”.

### **Integración con Microsoft 365**

**Para qué:** accesos a Outlook, OneDrive, Stream y Teams y configuración del plugin local\_o365.  
**Cómo se llega:** cajón de bloques \> Microsoft (1 o 2 clicks).  
**Qué muestra:**

* Sincronización de Calendario de Outlook (/local/o365/ucp.php?action=calendar): un único checkbox “Habilitar Sincronización de Calendario Outlook” y Guardar cambios.  
* Solicitar curso de Teams: “Lo sentimos, pero solicitar cursos ha sido deshabilitado por el administrador.”

**Fricciones:**

* No explica qué se sincroniza ni en qué dirección.  
* Se ofrece a todos los alumnos una acción deshabilitada que termina en una página de error.  
* “Mi OneDrive” apunta a un dominio de SharePoint del IAE (alumniiaeedu).

### **Ayuda Campus**

**Para qué:** guía de autoayuda y contacto con soporte.  
**Cómo se llega:** menú \> Ayuda Campus (1 click).  
**Qué muestra:**

* Una guía interactiva en Genially (iframe de 1200 x 675\) con seis temas: No veo mis cursos o materias, Actividades, Materiales y navegación en el aula virtual, Correo institucional, Mi perfil y notificaciones, Recupero de contraseña.  
* Link para abrir la guía en otra pestaña y un formulario de Microsoft Forms para pedir asistencia.

**Fricciones:**

* El contenido está dentro de un iframe: no se puede buscar ni leer con lector de pantalla, y en celular queda chico.  
* No hay mail ni teléfono de contacto, ni ayuda sobre el SIU.

### **Planning**

**Para qué:** ver la ocupación de aulas por día, sede y aula.  
**Cómo se llega:** menú \> Planning (1 click).  
**Qué muestra:** un curso de Moodle con un único iframe a una app externa (planning-campus.austral.edu.ar:44443) con grilla horaria por aula, selectores de mes, año y sede, búsqueda y “Usuario Anónimo \- Entrar”.  
**Fricciones:**

* El nombre no dice que es una grilla de aulas.  
* Texto diminuto y otra estética; probablemente inusable en celular.

### **App móvil**

**Para qué:** acceder al Campus desde la app oficial de Moodle.  
**Cómo se llega:** cajón de bloques \> ¡App del campus\! \> “Clic aquí” (PDF), o pie \> “Obtener la App Mobile” (página de descarga de moodle.org con la URL del sitio). El Perfil tiene un código QR para iniciar sesión en la app.  
**Fricciones:**

* La instrucción es “buscar Moodle en la tienda”, sin links directos en el bloque.  
* No queda claro que es la app de Moodle y no una app de la Austral.  
* Sin notificaciones push configuradas.

### **Biblioteca digital**

**Para qué:** lleva al sitio institucional del Sistema de Bibliotecas Austral.  
**Cómo se llega:** menú \> Biblioteca digital (1 click; sale del Campus).  
**Qué muestra:** bibliotecas por sede, la plataforma de recursos electrónicos MyLoft (requiere iniciar sesión con el correo institucional e instalar una extensión), repositorio institucional y contactos.  
**Fricciones:** el nombre sugiere acceso directo a recursos, pero llegar a uno lleva varios pasos fuera del Campus.

## **Problemas transversales**

* Información duplicada y desconectada: dos calendarios, dos bandejas de mensajes, notas en los dos sistemas sin aclarar cuál es la oficial.  
* Nada se ordena por “qué tengo que hacer ahora”: ni el inicio del SIU ni el del Campus muestran próximos vencimientos.  
* Contenido viejo mezclado con el actual: cursos de 2025, períodos de posgrado, tareas de 2022, propuesta “Aspirantes”.  
* Estados vacíos de una línea, sin explicar por qué no hay datos ni qué hacer.  
* Lenguaje técnico o administrativo: “Actuación provisoria”, “no\_presentado”, “\<Sin Asignación\>”, “Bulk actions csv”, mezcla de español e inglés.  
* Links muertos o que no aplican al alumno (Reportes, Solicitar curso de Teams, Configuración, Agenda, trámites de egresados).  
* Diseño de escritorio: tablas de 7 a 13 columnas, iframes de ancho fijo, accesos escondidos en cajones.  
* Privacidad: “Usuarios en línea”, último acceso de compañeros, email visible y una contraseña publicada en un bloque.

## **Qué confirma el relevamiento sobre los problemas del research**

* “Salimos como aspirantes en el SIU”: confirmado. Es la propuesta pasiva “Aspirantes \- fi” del selector de propuesta; el aviso de requisitos de ingreso vencidos probablemente sale de ahí.  
* “No podemos darnos de baja de las materias del Campus”: confirmado, no existe la opción para el alumno.  
* “Demasiados clicks en el SIU”: matizado. Las pantallas están a 1 o 2 clicks, pero las respuestas requieren cruzar varias pantallas a mano. En el Campus las tareas comunes cuestan 3 a 5 clicks.  
* “El mensaje del docente en una entrega se corta con '...'”: no reproducido. Los comentarios de la entrega se ven completos al expandir “Comentarios (N)”. Falta revisar la devolución de una tarea calificada.  
* “No llegan notificaciones del material nuevo”: la preferencia “Cambios de contenido del curso” está activa en Web y Email, así que depende de que el docente marque el aviso al subir. No hay push.  
* “Hay que matricularse a mano”: el catálogo de grado responde “No se puede auto matricular en este curso”. El botón “Ir” de SIU \> Mis inscripciones indica que el SIU ya conoce el curso de Moodle de cada materia, un dato útil para la sincronización.  
* Pedido docente sobre avisos (“no tener que pedir que se suscriban”): el alumno no ve ninguna opción de suscripción en el foro de Avisos, lo que sugiere suscripción forzada o deshabilitada. Conviene confirmarlo con un docente.

## **Pendiente de verificar**

* Flujo completo de inscripción a un final y su baja (hoy no hay mesas abiertas).  
* Confirmaciones y mensajes de error al inscribirse o darse de baja de una materia.  
* Devolución del docente en una tarea calificada y si se trunca.  
* Qué cambia al elegir la propuesta “Aspirantes \- fi”.  
* Qué hace “Verificar” en las correlativas del Plan de estudios.  
* Cómo se obtiene el PDF de una constancia y qué estados tiene la solicitud.  
* Experiencia real en celular de ambos sistemas (solo se infirió por el código).  
* Contenido de la guía de Ayuda Campus, del PDF de la app y de la Zona de entrenamiento.

# **Moodle y el Campus Virtual de la Universidad Austral**

*Investigación para HackAI – noviembre 2026*

## **1\. Qué es Moodle**

**Moodle** (Modular Object-Oriented Dynamic Learning Environment) es un **LMS** (Learning Management System) para crear aulas virtuales. Lo creó Martin Dougiamas en Australia a principios de los 2000 y hoy lo desarrolla **Moodle HQ** (Moodle Pty Ltd) junto con una comunidad global. Es uno de los LMS más usados en universidades del mundo.

**Licencia:** software libre bajo **GPL v3**. Cualquiera puede descargarlo, instalarlo, modificarlo y redistribuirlo. Si lo redistribuye modificado, tiene que publicar también el código.

### **Stack técnico**

* **Backend:** PHP. Aplicación monolítica clásica con renderizado del lado del servidor.  
* **Base de datos:** PostgreSQL, MySQL/MariaDB, MS SQL Server u Oracle, a través de una capa de abstracción propia (DML API).  
* **Frontend:** plantillas Mustache, Bootstrap (tema por defecto: *Boost*) y módulos JavaScript AMD/ES6.  
* **Archivos:** los archivos subidos se guardan fuera de la base, en el directorio *moodledata*. Las tareas programadas corren por cron.  
* **Integraciones:** capa de web services (REST/SOAP). La usan la app móvil oficial y las integraciones externas.

### **Arquitectura de plugins**

Es lo que lo vuelve "modular": casi todo es un plugin de algún tipo.

* **mod/**: actividades (tareas, cuestionarios, foros, H5P…).  
* **auth/**: métodos de login (manual, LDAP, SAML, OIDC…).  
* **enrol/**: matriculación de alumnos en cursos.  
* **theme/**: apariencia.  
* **blocks/, local/, report/, format/, qtype/** y decenas de tipos más.

Hay un [directorio oficial de plugins](https://moodle.org/plugins/) con miles de plugins de la comunidad. Las universidades suelen armar su campus como **Moodle core \+ plugins de terceros \+ tema propio \+ desarrollos locales**.

### **Versiones**

Salen dos releases mayores por año (abril y octubre).

* **5.0** (abril 2025): reestructuró el código; el contenido accesible por web pasó a un directorio *public/*.  
* **5.1**: octubre 2025\.  
* [**5.2**](https://docs.moodle.org/502/en/New_Features): abril 2026\.

### **Dónde está el código**

* Repositorio oficial: [github.com/moodle/moodle](https://github.com/moodle/moodle) (espejo del git de Moodle HQ, git.moodle.org).  
* Bugs y desarrollo: tracker.moodle.org (Jira).  
* Documentación para desarrolladores: [moodledev.io](https://moodledev.io/docs).  
* Para recorrer el código: *lib/* (núcleo), *mod/assign* y *mod/forum* (actividades típicas), *auth/* (logins).  
* Lectura sobre arquitectura: capítulo de Moodle en [The Architecture of Open Source Applications](https://aosabook.org/en/v2/moodle.html) (viejo, pero los conceptos base siguen vigentes).

## **2\. El Campus Virtual de la Austral**

Verificado directamente en campusvirtual.austral.edu.ar (sin iniciar sesión):

* **Es Moodle.** Responde a las rutas estándar (/login/forgot\_password.php, /pluginfile.php, /admin/tool/mobile/launch.php). El servicio público de la app móvil (tool\_mobile\_get\_public\_config) devuelve sitename "Universidad Austral", así que es compatible con la app oficial de Moodle.  
* **Login con Microsoft 365\.** El acceso para cuentas @mail.austral.edu.ar / @austral.edu.ar va a /auth/oidc/, que es el plugin [auth\_oidc (OpenID Connect)](https://github.com/microsoft/moodle-auth_oidc) de la integración oficial de Microsoft. Proveedor configurado: "Office 365 Universidad Austral".  
* **Login manual con DNI.** Segunda opción para quienes usan el DNI como usuario (probablemente posgrado o externos sin cuenta institucional). Usa la autenticación manual de Moodle.  
* **Pantalla de login a medida.** newlogin.php no es parte de Moodle: es una página hecha por la universidad (Bootstrap 4.1 \+ jQuery desde CDN) que deriva al login real. Ahí se ve la capa de personalización local.  
* **Versión no pública.** El sitio oculta la versión de Moodle (configuración recomendada por seguridad). Solo la ve el administrador.  
* **Otro dominio:** aulavirtual.austral.edu.ar existe pero hoy devuelve error 502\. Puede ser una instancia vieja o de otra unidad académica.  
* La ayuda de ingreso se gestiona con un formulario de Microsoft Forms.

## **3\. ¿Hay código abierto del campus de la UA?**

**No se encontró nada público.** No hay repositorio identificable de la Austral con su tema, plugins o la página de login, ni aparece en el directorio de plugins de Moodle.

Eso no viola la GPL: la licencia solo obliga a publicar el código si se **distribuye** el software. Usarlo en un servidor propio, aunque esté modificado, no cuenta como distribución (Moodle usa GPL, no AGPL).

* **Abierto:** el núcleo (moodle/moodle) y el plugin de Microsoft (auth\_oidc).  
* **No público:** las personalizaciones de la UA (tema, newlogin.php, configuración, plugins locales).

Para acceder a ese código habría que pedirlo al área de Sistemas / Tecnología Educativa de la universidad.

## **4\. Implicancias para el hackathon**

* **Entorno propio:** se puede levantar un Moodle local con Docker usando [moodlehq/moodle-docker](https://github.com/moodlehq/moodle-docker) e instalar auth\_oidc para replicar algo parecido al campus de la UA.  
* **Extender sin tocar el core:** lo natural es desarrollar un plugin (local/, block/ o mod/), que es como se integra cualquier funcionalidad nueva, incluida IA.  
* **Integrar desde afuera:** los web services REST de Moodle permiten construir una app o un bot externo que lea cursos, tareas y calificaciones, siempre que la universidad habilite un token.  
* **Limitación:** sin acceso de administrador al campus real, cualquier integración con la instancia de la UA depende de que la universidad la habilite. Para la demo conviene usar una instancia propia con datos de prueba.

## **Fuentes**

* [Campus Virtual – Universidad Austral (login)](https://campusvirtual.austral.edu.ar/newlogin.php)  
* [moodle/moodle (GitHub)](https://github.com/moodle/moodle)  
* [Moodle 5.2 – New Features](https://docs.moodle.org/502/en/New_Features)  
* [Moodle 5.2 Has Arrived (Catalyst)](https://www.catalyst-ca.net/blog/moodle-5-2-has-arrived-discover-whats-new)  
* [Moodle 5.0 y 5.1 highlights (Open LMS)](https://support.openlms.net/hc/en-us/articles/25767173553180-Moodle-5-0-And-5-1-Essential-Release-Highlights)  
* [microsoft/moodle-auth\_oidc](https://github.com/microsoft/moodle-auth_oidc)  
* [The Architecture of Open Source Applications – Moodle](https://aosabook.org/en/v2/moodle.html)  
* [Moodle Developer Docs](https://moodledev.io/docs)  
* [moodlehq/moodle-docker](https://github.com/moodlehq/moodle-docker)

## **5\. Qué tiene instalado el campus**

* **Versión:** todo indica **Moodle 5.1** (la página marca la clase "m-51"). Eso significa que ya tiene el **subsistema de IA** de Moodle (disponible desde la 4.5).  
* **Tema visual:** **Lambda 2**, un tema comercial de terceros (no es el tema core Boost). Mucho de lo que se siente "viejo" o incómodo en el celular viene de acá.  
* **Integración Microsoft:** bloque *Microsoft* en el inicio y login por auth\_oidc. El bloque Microsoft depende del plugin local\_o365, así que probablemente ya esté instalada la integración con Microsoft 365/Teams.  
* **Inicio ("Mis cursos"):** usa un bloque de terceros de tarjetas de cursos (lw\_courses) en vez del bloque core de "Vista general de cursos" \+ "Línea de tiempo". **No aparece la Línea de tiempo** con las próximas entregas.  
* **Filtros de cursos:** en "Mis cursos" solo están Todos / Destacados / Quitado de la vista. Los filtros core **En progreso / Futuros / Pasados están desactivados**.  
* **Cursos sin fecha de fin:** en la cuenta relevada, los 15 cursos figuran "en progreso" y **ninguno tiene fecha de fin**. Por eso nunca pasan a "Pasados" y se acumulan. El curso más viejo es de julio 2025: los anteriores ya no están (coincide con las desmatriculaciones).  
* **Notificaciones:** las preferencias solo tienen canales **Web y Email**. No hay canal de notificaciones push al celular, o sea que la app oficial de Moodle no recibe avisos. Existe la opción "Cambios de contenido del curso", pero solo se envía si el docente marca la casilla al subir el material.  
* **App móvil:** el sitio tiene habilitados los servicios para la app oficial de Moodle, con login por Office 365\.  
* **Otros plugins visibles:** Quickmail (mails masivos del docente), Mensaje a mi maestro, Questionnaire (encuestas), Custom certificate y Simple certificate, acciones masivas por CSV (desmatricular/borrar usuarios), inscripción manual y auto-inscripción.

## **6\. Plugins y configuraciones que podrían sumarse al campus**

**Sin instalar nada (configuración de Moodle core):**

* **Cargar fecha de fin a los cursos y activar los filtros En progreso / Pasados** en "Vista general de cursos": resuelve los cursos viejos mezclados (56% de la encuesta).  
* **Bloque Línea de tiempo** en el inicio: muestra las próximas entregas y vencimientos (39% no ve fechas en el inicio). ([docs](https://docs.moodle.org/500/en/Timeline_block))  
* **Suscripción forzada al foro de Avisos**: llega a todos, incluso a los que se matriculan después. Evita que el docente tenga que pedir que se suscriban. ([docs](https://docs.moodle.org/404/en/Forum_settings))  
* **Notificaciones push de la app** (Airnotifier, el servicio de Moodle para push): hoy no está activo y es clave para el 61% que se queja del celular.  
* **Subsistema de IA** (core desde 4.5, el campus ya tiene 5.1): conectar un proveedor (OpenAI, Azure OpenAI u Ollama) habilita resumir y explicar contenido dentro del curso. ([docs](https://docs.moodle.org/en/AI_subsystem))

**Plugins de terceros:**

* [**Boost Union**](https://moodle.org/plugins/theme_boost_union) (tema): versión configurable del tema core Boost, gratuita y mantenida por Moodle an Hochschulen e.V. (asociación de universidades alemanas). Alternativa al tema comercial actual.  
* [**Tiles format**](https://moodle.org/plugins/format_tiles) (formato de curso, tiene versión para 5.1): muestra el curso como mosaicos por unidad. Ayuda a la "organización confusa de las aulas" (61%) y se usa cómodo en el celular.  
* [**Exabis AI Chat**](https://moodle.org/plugins/aiplacement_exaaichat) (placement para el subsistema de IA) y su versión bloque: un asistente de chat dentro del curso. Sirve como base para una demo de IA.  
* **Integración Microsoft 365 / Teams** ([local\_o365](https://learn.microsoft.com/en-us/microsoft-365/lti/moodle-plugin-configuration)): descartada. Ya hay parte instalada y podría llevar los avisos a Teams, pero los alumnos no usan Teams. Mejor un bot hacia WhatsApp, Discord o Telegram.  
* *Descartado:* [Course module modification notification](https://moodle.org/plugins/local_tdmmodnotify) (resumen diario de cambios en los cursos) está sin mantenimiento desde \~2020. Mejor usar las notificaciones core o desarrollar algo propio.

*Pendiente de verificar: compatibilidad de cada plugin con Lambda 2 y con Moodle 5.1 exacto antes de proponerlo.*

# **Moodle y SIU: integración de matriculación**

*Investigación para HackAI – 7/11/2026. Basado en un research con verificación cruzada de fuentes \+ relevamiento propio del campus.*

## **1\. El problema**

El SIU Guaraní (inscripciones) y el campus (Moodle) no están conectados. Los alumnos se matriculan a mano en cada materia del campus, y al terminar la cursada (incluso con el final pendiente) los desmatriculan y pierden el acceso al material. 

Evidencia del campus (cuenta de un alumno de Ingeniería): las notificaciones disponibles muestran que el campus usa **auto-inscripción** e **inscripción manual**, y hay un plugin de **acciones masivas por CSV para desmatricular usuarios**. Todo indica un proceso manual de alta y baja, no una sincronización con el SIU.

## **2\. Antecedentes en otras universidades (no son de la Austral)**

* **UNLP – Facultad de Ingeniería:** el SIU Guaraní tiene una opción "Moodle \> Sincronizar comisiones". La dispara el docente a mano, es **unidireccional** (de Guaraní a Moodle), crea el curso si no existe y solo agrega a los alumnos que faltan. Hay que repetirla hasta que cierran las inscripciones. ([guía oficial](https://www.asignaturas.ing.unlp.edu.ar/mod/resource/view.php?id=278209))  
* **Al migrar a SIU Guaraní 3** (versión 3.20.1, agosto 2023), UNLP Ingeniería dejó la sincronización "inactiva por el momento". No sabemos si se reactivó. ([circular oficial](https://www1.ing.unlp.edu.ar/sitio/gestion/archivos/cambio-de-version-a-Guarani-3.pdf))  
* **UNLP – Agrarias (2018):** integró Moodle con SIU Guaraní; la sincronización creaba el curso y matriculaba automáticamente según la inscripción en el SIU, pero cada docente elegía si usarla. ([fuente](https://agro.unlp.edu.ar/node/3207))  
* **Fin de cursada sin perder acceso:** Clackamas (EE.UU.) agrega un rol "Incomplete" a los alumnos con nota incompleta para que sigan viendo el curso; UCL (Londres) pasa los cursos a solo lectura después de la fecha de fin; Tampere (Finlandia) oculta el curso en vez de sacar alumnos. Son personalizaciones locales, no funciones de Moodle core. ([Clackamas](https://kb.dl.clackamas.edu/article/end-of-term-procedures/setting-up-an-incomplete-course/), [UCL](https://ucldata.atlassian.net/wiki/spaces/MoodleResourceCentre/pages/31865433/M30i+-+Making+a+Moodle+course+Read-Only), [Tampere](https://sites.tuni.fi/digitaltoolkit/moodle/what-to-do-after-a-moodle-course-ends/))

**Conclusión:** ni siquiera las universidades que tienen integración la tienen totalmente automática. Eso valida el problema y deja espacio para una solución propia. No se encontró un conector oficial del SIU listo para Guaraní 3\.

## **3\. Qué ofrece Moodle para resolverlo**

* **enrol\_database (base de datos externa):** Moodle lee una tabla externa (alumno, curso, rol) y matricula solo. Sincroniza cuando el usuario inicia sesión y tiene una tarea programada de sincronización completa (viene desactivada). ([docs](https://docs.moodle.org/en/External_database))  
* **Cohort sync:** matricula automáticamente a los miembros de una cohorte (por ejemplo "Comisión X 2C 2026"). Las cohortes se pueden poblar por CSV, base externa o web services. ([docs](https://docs.moodle.org/36/en/Cohort_sync))  
* **Qué hacer cuando el alumno deja de figurar:** la acción de desmatriculación externa tiene cuatro opciones: desmatricular, **mantener matriculado**, suspender, o suspender y quitar roles. **Ojo:** suspender conserva los datos pero el alumno no puede entrar al curso, así que no resuelve el caso del final pendiente.  
* **Web services:** también se puede matricular desde un servicio externo con la API REST de Moodle (enrol\_manual\_enrol\_users).

## **4\. Propuesta para la demo**

1. **Servicio puente SIU → Moodle:** lee las inscripciones (para la demo, un mock o CSV del SIU con alumno, materia, comisión y condición: cursando / regular con final pendiente / aprobada) y alimenta enrol\_database o cohortes.  
2. **Acción externa en "mantener matriculado"**, para que nadie pierda el acceso al cerrar la cursada.  
3. **Rol "Final pendiente"** de solo lectura: ve el material, no puede entregar. Se asigna automáticamente según la condición que informa el SIU.  
4. **Fecha de fin de curso** cargada desde el calendario académico, para que la materia pase a "Pasados" en vez de desaparecer.  
5. **Demo:** el alumno inicia sesión y ya ve sus materias del cuatrimestre sin matricularse; una materia con final pendiente sigue accesible en modo lectura.

## **5\. Preguntas abiertas**

* ¿Qué versión de SIU Guaraní usa la Austral (2 o 3)? ¿Expone una API o vista de donde leer inscripciones y condición académica?  
* ¿La desmatriculación de fin de cuatrimestre es automática o una limpieza manual (el plugin de CSV sugiere lo segundo)?  
* ¿Quién en la universidad administra la relación SIU–campus? Sería bueno entrevistarlo.

# Repo de Nacho (Campus Austral): análisis

*Referencia única del repo «Campus Austral» (zip campus-aicm) para la hackathon, hecha por Claude el 10/11/2026 sobre el zip, el artifact «HackAI 2026 Product» y las pestañas de relevamiento de SIU, Campus y Moodle de este documento. Se hizo en dos pasadas en modo solo lectura (una general con 7 agentes y otra en profundidad con 8 lectores Opus por área), con verificación manual de los datos clave.*

## 1\. Resumen

* **Qué es:** el zip no es Moodle ni SIU. Es «Campus Austral», un campus propio en TypeScript (Next.js 15, React 19, Supabase/Postgres, CSS plano, API de Claude), armado para una sola materia del IAE: AI-Centric Management. Ser mergeable significa escribir en ese stack y con sus reglas, no hacer un plugin de Moodle.  
* **Lenguaje:** Moodle y SIU Guaraní son PHP; el repo es TypeScript de punta a punta. Eso resuelve la preocupación de no entender lo que se codee en PHP.  
* **Qué cubre:** muy bien la experiencia de clase (proyección en vivo, agente por voz, encuestas por QR, marcas por slide, analítica de comprensión), la evaluación con rúbrica y pares con detección de discordancias, el «qué hago ahora» en 0 clicks, tutor con IA, agente de autoría, actividades, 7 simuladores y un servidor MCP por rol.  
* **Qué no cubre:** nada de gestión académica. No hay carreras, planes, períodos, comisiones, inscripciones, asistencia, correlativas, actas, historia académica ni trámites. Tampoco creación de trabajos y rúbricas desde la UI, adjuntos ni matriculación.  
* **Límites estructurales:** un solo curso (constante COURSE\_ID usada 141 veces en 37 archivos, people.course\_id obligatorio y queries sin filtro de curso) y solo dos roles, profesor y alumno. Las notas se calculan al leer y nunca se guardan.  
* **Reglas de merge:** docs/SPEC.md y docs/CONTRACTS.md piden no editar lib/ compartido, no alterar tablas existentes, una carpeta por feature, una migración nueva e idempotente, acceso a datos solo en el servidor y UI en voseo. La sección 11 las baja a un checklist.  
* **Zip incompleto:** falta lib/content/server (el typecheck falla con 15 errores en 3 archivos) y los seeds no corren porque importan del repo hermano ../mbt y de contenido que no vino. Hay que pedirle a Nacho el repo completo o acceso a git antes de construir.  
* **Riesgos principales:** código de profesor compartido que permite suplantar a otro profesor, sesión y throttle fail-open, score de simuladores enviado por el cliente sin validar, notas no persistidas con transiciones de estado libres y tokens MCP sin vencimiento.  
* **Recomendación:** construir la feature como módulo nuevo y autocontenido (lib, components, rutas y una migración propia), tocando solo dos o tres archivos compartidos, con datos sintéticos. Las ideas que mejor encajan son avisos donde están los alumnos, resumen semanal con IA e inicio «Mi cuatrimestre». Acordar con Nacho el número de migración y cómo quiere recibir el código.

## 2\. Qué se analizó y cómo

* **Artifact «HackAI 2026 Product»:** 23 slides del R\&D Software Engineering Lab de Austral. Es el kickoff de producto de la hackathon; no describe el repo, fija las reglas del juego. Se leyó slide por slide.  
* **Zip campus-aicm:** 441 archivos; unas 43.000 líneas de TypeScript/TSX, 18.000 de CSS y 1.300 de SQL. No trae historial de git.  
* **Primera pasada:** 7 agentes en paralelo, uno por área (rutas en app/, componentes, lib compartida, módulos de feature, IA y tiempo real, migraciones, tooling/tests/docs).  
* **Segunda pasada:** 8 lectores Opus en solo lectura, uno por área (núcleo y auth, modelo de datos, clase en vivo y decks, evaluación, alumno y aula, actividades y simuladores, IA y MCP, operación). Leyeron archivos y usaron grep.  
* **Verificación manual:** cantidad de tablas, migraciones que alteran tablas, uso de untrusted(), simuladores registrados, imports faltantes y otros datos clave.  
* **Lo que se ejecutó:** instalación de dependencias con Node 22 (sin scripts de instalación), typecheck y tests que no necesitan base.  
  * **Typecheck (tsc \--noEmit):** 15 errores, todos por @/lib/content/server, que importan app/campus/conceptos/page.tsx, components/conceptos/ConceptoParts.tsx y lib/jornadas.ts.  
  * **tests/learning.test.ts:** 12 de 12\. tests/assignments.test.ts: 20 de 20\. tests/learning-flow.ts: 31 chequeos contra un PostgREST en memoria.  
* **Lo que no se ejecutó:** next build, la app, las migraciones, los seeds y los tests contra base real. No hay credenciales ni base en el zip. El comportamiento en ejecución y los clicks salen de leer el código.  
* **SIU y Campus:** se usa el relevamiento de este documento. El stack interno de SIU Guaraní es conocimiento general, marcado «a confirmar».

## 3\. Qué pide la hackathon y cómo pega en el repo

| Lo que dice el artifact | Qué implica para este repo |
| :---- | :---- |
| Semana en tres pasos: objetivo (vie 06/11), pruebas con un ciclo por día (sáb 07 a jue 12), demo y pitch (vie 13\) con 1-pager y changelog. | Quedan pocos ciclos. Conviene una feature acotada que se pueda mostrar corriendo, no una reescritura. |
| Se evalúa claridad del problema, resultado vs. output, iteraciones validadas, estrategia justificada, riesgos reducidos y calidad de la demo. | Elegir esta base hay que justificarlo con evidencia. Las secciones 4 y 7 dan los argumentos a favor y en contra. |
| Estrategia: desde cero, sobre Moodle y SIU Guaraní, o envolviendo lo que hay. Se evalúa que esté justificada, no cuál eligen. | Mergear al repo de Nacho es una cuarta variante: construir sobre una base nueva que ya existe. No reemplaza a Moodle ni al SIU; a lo sumo convive o los envuelve. |
| Extender antes que forkear. Spike el día 1: levantar la base lleva más de lo que creen. | Módulo propio en vez de editar lo compartido. El spike es urgente porque el zip no compila ni se puede sembrar tal como vino. |
| Nada de datos reales de alumnos; datos sintéticos realistas. | El repo ya trabaja así: padrón ficticio marcado is\_fictional y seeds idempotentes. Seguir ese patrón para materias, inscripciones y notas. |
| Cumplimiento: CONEAU, registros que tienen que quedar (actas, historial, cambios), quién ve y modifica qué, datos personales mínimos. | Hay piezas útiles (revisiones, bitácora de turnos del agente, RLS cerrado) pero no hay actas inmutables, notas persistidas ni roles administrativos. |
| Escriban para un agente: spec con contexto, roles, reglas, criterios de aceptación y estrategia. | El repo ya está hecho así. docs/SPEC.md, docs/CONTRACTS.md y docs/POST-CLASS.md son specs para agentes; POST-CLASS es la plantilla a copiar. |
| Entender su sistema: código que nadie del equipo entiende es un riesgo. Ingeniería aporta criterio en datos, permisos, trazabilidad y revisión. | Argumento fuerte para TypeScript frente a PHP, y para respetar las reglas de auth y datos de la sección 11\. |

## 4\. Comparación técnica: Moodle, SIU Guaraní y el repo

| Aspecto | Campus Virtual (Moodle 5.1) | SIU Guaraní | Repo de Nacho (Campus Austral) |
| :---- | :---- | :---- | :---- |
| Lenguaje | PHP, monolito renderizado en servidor | PHP (a confirmar); el portal usa Bootstrap 2 y recarga por página | TypeScript estricto en todo: front, back, tests y seeds |
| Framework | Propio de Moodle, plantillas Mustache, JS AMD/ES6 | Frameworks propios del SIU (a confirmar) | Next.js 15 App Router, React 19, Server Components y Server Actions |
| Base de datos | Postgres/MySQL vía capa DML propia | PostgreSQL (a confirmar) | Supabase Postgres, 50 tablas, 18 migraciones SQL a mano, sin ORM |
| Estilos | Tema comercial Lambda 2 sobre Bootstrap | Bootstrap 2, bloquea el zoom en celular | CSS plano con tokens IAE, un .css por feature, sin Tailwind ni librería de UI |
| Login | Microsoft 365 (auth\_oidc) o DNI | Usuario propio del SIU | Sin SSO: alumno con padrón y PIN de 4 dígitos (más código inicial); profesor con email y código compartido |
| Roles | Muchos y configurables | Perfiles (alumno, docente, gestión) | Solo profesor y alumno, fijos en el código |
| Varias materias | Sí, miles de cursos | Sí, propuestas, planes y comisiones | No: un curso fijo y una persona por curso |
| Cómo se extiende | Plugins (mod, block, local, enrol) | Personalizaciones de la instalación | Carpeta por feature en lib/, components/ y app/, más una migración |
| Código disponible | Core abierto (GPL v3); lo de la UA, no | No público; lo administra la universidad | Lo tenemos en el zip (incompleto, sin historial de git) |
| IA | Subsistema de IA sin proveedor conectado | No | Agente en vivo con 17 herramientas, tutor, agente de autoría y servidor MCP (14 herramientas de profesor, 10 de alumno) |
| Tiempo real y celular | Sin push; responsive con accesos escondidos | Diseño de escritorio | Supabase Realtime; la vista del alumno en vivo está pensada para celular |
| Calidad | Proyecto maduro | Proyecto maduro | Sin linter ni CI, tests solo de dos módulos, docs en parte desactualizadas |

Lectura: el repo gana en lenguaje, velocidad para construir con agentes e IA ya integrada. Pierde en modelo académico (no existe) y no reemplaza a los sistemas oficiales: lo que se construya ahí es un campus paralelo, salvo que lea datos de Moodle o del SIU.

## 5\. Funcionalidades del repo

### Núcleo y acceso

* **Ingreso de alumno.** Quién: alumno. Ruta: / (app/page.tsx), server action loginAlumno. Cómo funciona: elige su nombre del padrón y escribe un PIN de 4 dígitos; en el primer ingreso o tras un reset también un código inicial de 6 caracteres, derivado por HMAC de SESSION\_SECRET, la persona y session\_version (no se guarda). El primer PIN se graba con un update condicionado a pin\_hash null. Rate limit por IP (80 intentos cada 10 minutos) y throttle por persona (5 fallos libres, después backoff hasta 60 minutos). 2 o 3 campos y 1 click. Datos: people (pin\_hash con scrypt, session\_version) y las RPC security\_\* de 0140\. Estado: completa. Archivos: app/actions/auth.ts, lib/session-token.ts, lib/security.ts, components/auth/LoginForms.tsx.  
* **Ingreso de profesor.** Quién: profesor. Ruta: pestaña Profesor en /. Cómo funciona: email más PROFESSOR\_ACCESS\_CODE, un único código compartido en variable de entorno. Throttle por IP y tope global de 200 intentos por hora. Datos: people con role profesor. Estado: completa, pero cualquier profesor puede entrar como otro.  
* **Sesión y revocación.** Quién: sistema. Ruta: todas. Cómo funciona: cookie campus\_session (payload base64url más firma HMAC, httpOnly, 30 días). En cada request getSession compara session\_version y rol contra people, así que se puede revocar. Si la base falla, deja pasar (fail-open). Invitados en encuestas usan la cookie campus\_guest de 180 días. Datos: people. Estado: completa. Archivos: lib/auth.ts, lib/session-token.ts.  
* **Salir.** Quién: los dos roles. Ruta: botón Salir (server action) y GET /salir. Cómo funciona: sube session\_version (cierra en todos los dispositivos) y borra la cookie. Datos: people. Estado: completa; GET /salir tiene efecto lateral.  
* **Apertura del campus.** Quién: sistema. Ruta: middleware sobre /campus/\*. Cómo funciona: antes de CAMPUS\_ABRE (por defecto 12/11/2026 18:30 \-03) redirige a /campus/bienvenida, salvo bienvenida, organizacion, perfil y cohorte, comparadas como ruta exacta (sus subrutas quedan bloqueadas). El middleware no autentica; eso lo hacen los layouts con requirePerson(rol). Datos: ninguno. Estado: completa. Archivos: middleware.ts, lib/apertura.ts.  
* **Navegación.** Quién: los dos roles. Ruta: lib/routes.ts. Cómo funciona: el alumno tiene Inicio, Mi organización, Entregas y Mi aprendizaje, 8 ítems en «Más» y Perfil y Tokens en el menú de usuario; el profesor tiene Inicio, Alumnos, Entregas, Devoluciones y Biblioteca, más 10 ítems en «Más». Datos: ninguno. Estado: completa. Archivos: components/shell/AppShell.tsx, components/shell/NavLinks.tsx.  
* **Home del alumno.** Quién: alumno. Ruta: /campus. Cómo funciona: lib/inicio.ts elige la jornada en foco (la en vivo; si no, la de hoy o la próxima; si terminaron, la última) y carga avisos, office hours y radar. El «próximo paso» lo calcula nextStep() en lib/learning/core.ts con este orden: clase en vivo, entrega vencida, devolución sin leer, reflexión pendiente, preparar la próxima jornada e historial. Suma un checklist «Antes de ir» (organización, entorno B1, postura en el caso, entregas que vencen). Datos: varias tablas del curso. Estado: completa, con textos del curso en el código. Archivo: app/campus/page.tsx.  
* **Home del profesor.** Quién: profesor. Ruta: /profesor. Cómo funciona: por entregable, cuántos entregaron y cuántos tienen corrección; lista alumnos atrasados (sin organización, sin entorno, con entregas vencidas o sin postura), encuestas en borrador y office hours. Datos: varias tablas. Estado: completa. Archivo: app/profesor/page.tsx.  
* **Bienvenida.** Quién: los dos roles. Ruta: /campus/bienvenida y /profesor/bienvenida. Cómo funciona: componente estático con contenido del curso en el código. La del profesor no llama a requireSession. Datos: ninguno. Estado: completa.  
* **Jornadas.** Quién: los dos roles. Ruta: /campus/jornadas/\[n\] y /profesor/jornadas/\[n\]. Cómo funciona: loadJornada junta deck, docentes, casos, actividades, entregas, conceptos, materiales, sims, office hours y radar; 1 o 2 clicks desde la home. Datos: class\_sessions y relacionadas. Estado: no compila con el zip (lib/jornadas.ts importa lib/content/server).  
* **Instalador del alumno.** Quién: alumno. Ruta: GET /setup y /setup.ps1, /api/setup/start, /api/setup/poll y /conectar?c=CODIGO. Cómo funciona: el alumno corre un curl a bash; el script instala Claude Code si falta, pide deviceCode y userCode, el alumno confirma en /conectar (1 click), el script hace poll, recibe un token MCP una sola vez, lo registra con claude mcp add y reporta git, node, gh, vercel y supabase. Con hola\_campus queda entregado el B1. Datos: setup\_pairings (0180), api\_tokens, environment\_checks. Estado: completa. Archivos: lib/setup/\*, app/conectar/\*.

### Clase en vivo y decks

* **Proyección y consola del profesor.** Quién: profesor y aula. Ruta: /live/\[id\] y /api/live/\[id\]/{state,goto,overlay,overlay-data,deck,settings,console,end}. Cómo funciona: navega slides y pone overlays (encuesta, posturas, confusión, timer, QR, mensaje, simulador). Cada cambio pasa por lib/live/session.ts, que actualiza live\_sessions (position, overlay, seq), registra en live\_events y emite «state»; los clientes descartan mensajes con seq viejo. Datos: live\_sessions, live\_events. Estado: completa. Archivos: lib/live/route.ts, components/live/LiveConsole.tsx.  
* **Agente de clase por voz.** Quién: profesor. Ruta: POST /api/live/\[id\]/agent y /api/live/\[id\]/transcript. Cómo funciona: Web Speech API del navegador (solo bien en Chrome y Edge); mientras el profesor mantiene el botón, la orden va a Claude Sonnet 5.5 con 17 herramientas. Datos: agent\_turns. Estado: completa. Archivos: lib/agent/\*, lib/voice/\*.  
* **Transcripción.** Quién: profesor. Ruta: /profesor/transcripcion y /descargar. Cómo funciona: cada segmento se guarda con la slide del momento; si está apagada, solo se guardan las órdenes. Datos: transcript\_segments. Estado: completa.  
* **Encuestas por QR.** Quién: el profesor crea; responden alumnos o invitados. Ruta: /p/\[pollId\]. Cómo funciona: se crean con una slide :::encuesta (single, multiple, open, scale o wordcloud) o en el momento; abrir una cierra la anterior. El canal público recibe solo conteos; el del profesor, también textos. Tope de 2000 respuestas por conteo. Datos: polls, poll\_responses (person\_id o guest\_key). Estado: completa. Archivo: lib/live/polls.ts.  
* **Vista del alumno en vivo.** Quién: alumno o invitado. Ruta: /s y /s/\[code\]. Cómo funciona: sigue la slide por el canal público, la marca (no entendí, clave, pregunta, idea) y toma notas privadas o para la cohorte. QuickJoin muestra el padrón sin login. Datos: slide\_marks, slide\_notes. Estado: completa. Archivos: app/s/\[code\]/page.tsx, components/student/LiveStudent.tsx.  
* **DSL de slides.** Quién: el profesor escribe; todos leen. Ruta: /decks/\[id\], /campus/decks/\[id\] y /ver/\[token\] (deck público). Cómo funciona: \--- separa slides y :::tipo define el tipo (cifra, tiempo, versus, pasos, matriz, tabla, pregunta, encuesta, postura, simulador, qr, iae); límites de texto pensados para 1280x720. Datos: slides, decks. Estado: completa. Archivo: lib/decks/parse.ts.  
* **Editor de decks y biblioteca.** Quién: profesor. Ruta: /profesor/decks, /profesor/decks/\[id\] y /profesor/biblioteca. Cómo funciona: guardar, mover, duplicar, insertar desde la biblioteca, asignar a jornada, publicar con public\_token y subir media al bucket; cada edición deja una fila en slide\_revisions. Datos: decks, deck\_slides, slide\_revisions, media\_assets. Estado: completa. Archivos: app/profesor/decks/actions.ts, lib/authoring/\*, lib/media/core.ts.  
* **Analítica por slide.** Quién: profesor. Ruta: /profesor/analitica/\[deckId\]. Cómo funciona: cruza marcas, notas, encuestas, transcripción e hilos del tutor por slide y agrega un resumen con Claude (lib/classroom/summary.ts). Datos: tablas en vivo y tutor. Estado: completa.  
* **Decks HTML y rediseño.** Quién: profesor. Ruta: /api/decks/empresas-familiares/redesign. Cómo funciona: un deck kind html se muestra en iframe; la ruta de rediseño sirve para un solo caso. Datos: decks. Estado: parcial; public/decks no vino en el zip.  
* **Materiales.** Quién: alumno. Ruta: /campus/materiales. Cómo funciona: redirige a conceptos. Datos: ninguno. Estado: stub.

### Evaluación y aprendizaje

* **Entregar un trabajo.** Quién: alumno. Ruta: /campus/entregas y /campus/entregas/\[id\]. Cómo funciona: Entregas, trabajo, texto o link, guardar (3 clicks). Guardar ya es entregar; se edita hasta el vencimiento o hasta que cambie el estado. Sin adjuntos. Datos: upsert en submissions. Estado: completa. Archivo: lib/assignments/core.ts.  
* **Ciclo de estados del trabajo.** Quién: profesor. Ruta: /profesor/entregas/\[id\]. Cómo funciona: 4 botones (borrador, abierta, revision-pares, cerrada) sin validar transiciones ni cierre automático por fecha. Datos: assignments. Estado: completa.  
* **Asignación de revisión entre pares.** Quién: profesor. Ruta: /profesor/entregas/\[id\]. Cómo funciona: N revisores, semilla y modo (incremental o rehacer); mezcla determinística, nadie se revisa a sí mismo, carga pareja. Datos: peer\_reviews, assignment\_settings. Estado: completa. Archivo: lib/assignments/assign.ts.  
* **Revisión entre pares.** Quién: alumno. Ruta: /campus/entregas/\[id\]\#revisar. Cómo funciona: ve «Entrega A», «Entrega B», elige nivel por criterio y comenta con 60 caracteres o más; ve lo recibido cuando envió todas o cuando el trabajo se cierra. Datos: peer\_reviews. Estado: completa.  
* **Revisión docente con rúbrica.** Quién: profesor. Ruta: /profesor/entregas/\[id\]/revisar/\[submissionId\]. Cómo funciona: 3 clicks desde la home, con Anterior/Siguiente. Datos: peer\_reviews con is\_teacher=true. Estado: completa.  
* **Pre-evaluación con IA.** Quién: profesor. Ruta: POST /api/assignments/\[id\]/ai-preview. Cómo funciona: Sonnet 5.5 con salida JSON schema (nivel sugerido y justificación por criterio). Datos: no se guarda. Estado: completa. Archivo: lib/assignments/ai.ts.  
* **Cálculo de nota.** Quién: sistema. Ruta: lib/assignments/scoring.ts. Cómo funciona: 4 modos (docente-o-pares, media-pares, mediana-pares, mixta), detección de discordancias por umbral y conversión a la escala de la rúbrica (0 a 100). Se recalcula en cada lectura. Datos: nunca se persiste. Estado: completa.  
* **Export CSV.** Quién: profesor. Ruta: GET /api/assignments/\[id\]/csv. Cómo funciona: un CSV por trabajo, separador ; y BOM UTF-8. Datos: submissions, peer\_reviews. Estado: completa.  
* **Panel de entregas del profesor.** Quién: profesor. Ruta: /profesor/entregas. Cómo funciona: estado, entregaron sobre total, revisiones y discordancias. No permite crear trabajos ni rúbricas: vienen del seed. Datos: assignments. Estado: completa para seguimiento, parcial para gestión.  
* **Reflexión post-clase.** Quién: alumno. Ruta: /campus/aprendizaje. Cómo funciona: tres campos (idea que me llevo, duda, qué aplicaría) por jornada terminada, con control optimista por revision. Datos: session\_reflections. Estado: completa.  
* **Devoluciones por jornada.** Quién: profesor. Ruta: /profesor/devoluciones. Cómo funciona: ve la evidencia del alumno (reflexión y marcas «no entendí»), parte de una plantilla, guarda borrador y publica ya o programado; el alumno la marca leída y aplicada. Es distinta de la revisión con rúbrica por trabajo. Datos: session\_feedback. Estado: completa, sin nota y sin IA.  
* **Tests.** Quién: equipo. Ruta: tests/. Cómo funciona: assignments.test.ts (20 casos) y learning.test.ts (12), más flujos contra base real y contra fixture. Solo learning tiene script npm. Datos: ninguno. Estado: parcial.

### Alumno, organización y aula

* **Casos con postura.** Quién: el alumno vota; el profesor ve y proyecta. Ruta: /campus/casos/\[id\] y /profesor/casos/\[id\]. Cómo funciona: postura, justificación y confianza de 1 a 5, cambiable hasta el cierre; la distribución se proyecta en vivo. Datos: cases, case\_postures. Estado: completa, no filtra is\_active. Archivo: lib/classroom/cases.ts.  
* **Sorteo y participación.** Quién: el profesor o el agente. Ruta: /profesor/participacion. Cómo funciona: sorteo con filtros (por postura o sin participación previa) y por rondas, con reintento ante choques; resultado participó, pasó o ausente. Si participó, fila en participation con calidad 1 a 3\. También registro manual. No es asistencia. Datos: cold\_call\_rounds, cold\_call\_draws, participation. Estado: completa. Archivo: lib/classroom/participation.ts.  
* **Office hours con cupo.** Quién: el profesor publica; el alumno reserva. Ruta: /profesor/office-hours y /campus/office-hours. Cómo funciona: hasta 12 franjas seguidas con cupo de 1 a 20; el alumno reserva con 1 click más un tema; la RPC oh\_book bloquea con FOR UPDATE. Datos: office\_hour\_slots, office\_hour\_bookings. Estado: completa, sin notificaciones ni lista de espera. Archivo: lib/actividades/office-hours.ts.  
* **Cohorte y perfil.** Quién: alumno. Ruta: /campus/cohorte y /campus/perfil. Cómo funciona: directorio interno y formulario de perfil. Datos: people. Estado: completa; no es un legajo.  
* **Radar semanal.** Quién: el profesor publica hasta 3 noticias por semana; todos comentan. Ruta: /campus/radar y /profesor/actividades/radar. Cómo funciona: comentarios planos, sin respuestas ni privados, con rate limit de 30 cada 10 minutos. Datos: radar\_items, radar\_comments. Estado: completa.  
* **Tokens MCP.** Quién: los dos roles. Ruta: /campus/tokens y /profesor/tokens. Cómo funciona: el token se muestra una vez y en la base queda su sha256; se revoca; la página da instrucciones para Claude Code y claude.ai. No expiran. Datos: api\_tokens. Estado: completa.  
* **Padrón y accesos.** Quién: profesor. Ruta: /profesor/alumnos. Cómo funciona: estado del PIN, código inicial en claro y reset de PIN (1 click). Sin alta, baja ni importación. Datos: people. Estado: parcial.  
* **Mi organización.** Quién: el alumno edita; el profesor lee. Ruta: /campus/organizacion, /profesor/organizaciones y /api/organizacion. Cómo funciona: ficha de la empresa del alumno (procesos, datos, sistemas, links), con una revisión por guardado. No es un trámite. Datos: organizations, organization\_revisions. Estado: completa.  
* **Portfolio de entregables.** Quién: alumno. Ruta: /campus/organizacion/portfolio. Cómo funciona: recorre la lista fija ENTREGABLES (B1 a B6, ids aicm-\*) con entrega, devolución y nota calculada. Datos: submissions, peer\_reviews. Estado: completa, atada a esta materia.  
* **Conceptos.** Quién: alumno. Ruta: /campus/conceptos. Cómo funciona: depende de lib/content, que falta. Datos: concepts, content\_items. Estado: no compila con el zip.

### Actividades y simuladores

* **Catálogo de actividades.** Quién: alumno. Ruta: /campus/actividades y /campus/actividades/\[id\]. Cómo funciona: 10 actividades de las jornadas 2 a 8 definidas en lib/actividades/catalog.ts, no en la base; 2 clicks desde la home. Datos: activity\_\*. Estado: completa.  
* **Fichas individuales.** Quién: alumno. Ruta: POST /api/actividades/\[id\] op entry.save. Cómo funciona: autopsia, request, galería, inventario y clon; upsert por actividad y persona. Datos: activity\_entries. Estado: completa.  
* **Endpoint eco.** Quién: alumno. Ruta: /api/actividades/eco. Cómo funciona: didáctico, para mirar requests en DevTools. Datos: ninguno. Estado: completa.  
* **Armado de parejas.** Quién: profesor. Ruta: pairs.generate. Cómo funciona: makeGroups con PRNG que evita repetir parejas, grupos de 2 (uno de 3 si es impar), asignación en ronda. Datos: activity\_state. Estado: completa y reutilizable.  
* **Rompé la del otro y Red team.** Quién: alumno. Ruta: actividades. Cómo funciona: registros autor a destino (bug o ataque) y el destino responde; polling cada 6 s. Datos: activity\_items. Estado: completa.  
* **Laboratorio de SQL.** Quién: alumno. Ruta: actividad de J4. Cómo funciona: ocho ejercicios con sql.js en el navegador. Datos: local. Estado: sin verificar.  
* **KNN.** Quién: alumno. Ruta: actividad de J5. Cómo funciona: tablero local. Datos: no guarda nada. Estado: completa.  
* **Cronómetro.** Quién: profesor. Ruta: actividades. Cómo funciona: lo maneja el profesor y los alumnos lo ven por polling; donde no hay polling aparece al recargar. Datos: activity\_state. Estado: completa.  
* **Directorio con votación.** Quién: alumno. Ruta: actividad de J8. Cómo funciona: 5 roles rotativos, un voto por presentador (aprobar, con cambios, rechazar), sin votar la propia; resultados al cerrar; polling cada 4 s. Datos: activity\_items. Estado: completa.  
* **Tablero del profesor por actividad.** Quién: profesor. Ruta: /profesor/actividades/\[id\]. Cómo funciona: guía privada, controles y entradas por alumno; sin export ni nota. Datos: activity\_\*. Estado: completa.  
* **Motor de corridas de simuladores.** Quién: sistema. Ruta: /api/sims/runs y /api/sims/\[runId\]/{events,state,complete}. Cómo funciona: eventos en lotes estilo xAPI, state con debounce, score y summary al completar; en vivo emite broadcast. Hay 7 simuladores registrados. Datos: sim\_definitions, sim\_runs, sim\_events. Estado: completa, con score enviado por el cliente.  
* **Simuladores HTML.** Quién: alumno. Ruta: iframe. Cómo funciona: agrodecide, stockdecide y financesim, integrados con public/sims/campus-sdk.js por postMessage. Datos: sim\_runs. Estado: completa.  
* **Simuladores React.** Quién: alumno. Ruta: /campus/sims. Cómo funciona: Cotización, Triage, HITL y Adopción; motores puros y deterministas, pero el score lo calcula el cliente. Datos: sim\_runs. Estado: completa.  
* **Listado y vista de cohorte.** Quién: los dos roles. Ruta: /campus/sims y /profesor/sims/\[id\]. Cómo funciona: promedio, mediana, histograma y distribución de decisiones; alimenta el overlay en vivo. Datos: sim\_runs. Estado: completa.

### IA, MCP y avisos

* **Tutor por slide.** Quién: alumno. Ruta: /api/tutor, con TutorPanel en el estudio del deck o en vivo. Cómo funciona: 4 modos (socrático, sparring, examinador, coach), streaming con Sonnet 5.5, 40 mensajes por día. Datos: tutor\_threads, tutor\_messages. Estado: completa.  
* **Agente de autoría.** Quién: profesor. Ruta: /api/authoring/agent, con AgentPanel en el editor. Cómo funciona: Opus 5.5 genera propuestas y el profesor acepta cada una con control de versión. Datos: slides, slide\_revisions. Estado: completa.  
* **Servidor MCP.** Quién: los dos roles. Ruta: /api/mcp y /api/mcp/\[token\]. Cómo funciona: JSON-RPC sin estado, 14 herramientas de profesor y 10 de alumno. Datos: agent\_turns. Estado: completa.  
* **Avisos.** Quién: el profesor publica; el alumno lee. Ruta: herramienta MCP post\_announcement; se leen en la home del alumno (lib/inicio.ts:124) y en my\_pending. Cómo funciona: no hay ABM web, página de avisos ni registro de leídos. Datos: announcements. Estado: parcial.

## 6\. Recorridos del alumno y del profesor

Los clicks del repo se estimaron leyendo el código; las cifras de hoy salen del relevamiento.

### Alumno

| Tarea | Ruta en el repo | Clicks en el repo | Hoy (SIU / Campus) |
| :---- | :---- | :---- | :---- |
| Ingresar | / | Nombre, PIN y 1 click (más código inicial la primera vez) | Usuario y contraseña institucional; el repo no tiene SSO |
| Saber qué hacer ahora | /campus | 0: próximo paso y checklist en la home | Campus: Calendario a 1 click, nada en el inicio |
| Ver material de la clase | /campus/jornadas/\[n\] o /campus/decks/\[id\] | 1 a 2 | Campus: 3 clicks por archivo |
| Leer el último aviso | /campus | 0 | Campus: 3 clicks; SIU: 2 |
| Entregar un trabajo | Entregas, trabajo, guardar | 3, sin archivos | Campus: 5, con archivo |
| Ver nota o devolución | /campus/entregas/\[id\] o portfolio | 2 | Campus: 2 a 3 |
| Reservar office hours | Office hours, reservar | 1 a 2 | Sin equivalente |
| Votar postura en un caso | Casos, caso, enviar | 2 a 3 | Sin equivalente |
| Seguir la clase en vivo | QR o /s/\[code\] | 1 (escanear) | Sin equivalente |
| Escribir la reflexión | Mi aprendizaje | 1 más el formulario | Sin equivalente |
| Inscribirse a una materia o un final | No existe | \- | SIU: 3 y unos 4 clicks |
| Ver faltas, historia o avance | No existe | \- | SIU: 2 a 3 por pantalla, cruzando a mano |

### Profesor

| Tarea | Ruta en el repo | Clicks en el repo | Hoy |
| :---- | :---- | :---- | :---- |
| Ver quién está atrasado | /profesor | 0 | Moodle: informes del curso (no relevado en detalle) |
| Corregir una entrega | Entregas, Abrir, Revisar | 3, con IA opcional y Anterior/Siguiente | Tarea de Moodle (no relevado) |
| Asignar revisión entre pares | /profesor/entregas/\[id\] | 1 formulario | Similar al Taller de Moodle |
| Dar una clase en vivo | /live/\[id\] | Consola, o voz con el agente | Sin equivalente |
| Sortear y registrar participación | /profesor/participacion | 1 a 2 | Sin equivalente |
| Publicar un aviso | Solo por MCP | Fuera de la web | Campus: foro de Avisos |
| Resetear el acceso de un alumno | /profesor/alumnos | 1 | Lo resuelve sistemas |
| Cargar notas finales o un acta | No existe | \- | SIU (bedelía) |

## 7\. Cobertura frente a SIU y el Campus Virtual

| Necesidad | SIU | Campus Virtual | Campus Austral | Qué se reutiliza o falta |
| :---- | :---- | :---- | :---- | :---- |
| Alumno: saber qué hacer ahora | No | No (Calendario a 1 click) | Sí, próximo paso en la home, para un curso | nextStep() y my\_pending |
| Alumno: materiales por clase | No | Sí, 3 clicks por archivo | Sí, jornadas y decks en 1 a 2 | Formato propio (DSL); /campus/materiales es stub |
| Alumno: entregar | No | Sí, 5 clicks con archivo | Sí, 3 clicks, solo texto o link | Sin adjuntos |
| Alumno: ver avisos | Mensajes en 2 clicks | 3 clicks | En la home, sin registro de leídos | Se publican solo por MCP; falta ABM y página |
| Alumno: ver notas | Historia y actuación | Calificaciones en 2 a 3 | Nota calculada por trabajo (0 a 100\) | No persiste ni se cierra |
| Alumno: calendario y evaluaciones | Sí, sin conectar | Sí, sin conectar | Parcial: jornadas | class\_sessions y lib/format.ts; sin parciales ni finales |
| Alumno: inscribirse a materias | Sí, 3 clicks | No | No | Patrón oh\_book para cupo |
| Alumno: inscribirse a finales | Sí, unos 4 clicks | No | No | Sin mesas |
| Alumno: asistencia y faltas | Sí, 2 clicks | No | No | «ausente» solo existe como resultado de sorteo |
| Alumno: avance, correlativas, historia | Sí, cruzando a mano | No | No | Sin plan de estudios |
| Alumno: constancias y trámites | Sí, 4 clicks | No | No | Nada directo |
| Alumno: mensajería | Sí | Sí | No | Radar tiene comentarios planos, sin privados |
| Alumno: participar en clase | No | No | Sí, por QR y en vivo | Diferencial |
| Alumno: tutor IA | No | No | Sí, por slide, 40 por día | Diferencial |
| Alumno: simuladores y actividades | No | Actividades de Moodle | Sí, 7 simuladores y 10 actividades | Contenido de la materia |
| Alumno: reservar consulta | No | No | Sí, office hours con cupo | \- |
| Docente: dar la clase | No | No | Proyector, consola y agente por voz | Diferencial |
| Docente: corregir con rúbrica | No | Tarea/Taller | Sí, con pares, discordancias e IA | Más completo que la Tarea |
| Docente: analítica de comprensión | No | Informes genéricos | Sí, por slide | Diferencial |
| Docente: crear trabajos y rúbricas | No | Sí | No, vienen del seed | Hueco |
| Docente: cargar el padrón | Automático | Matriculación | Solo seeds | Hueco |
| Gestión: actas y notas finales | Sí | No | No | Patrón borrador y publicación (session\_feedback) y Proposal |
| Gestión: matriculación automática y rol «final pendiente» | No | No | No | Habría que crear enrollments |
| Gestión: varias materias y carreras | Sí | Sí | No (COURSE\_ID fijo) | Límite estructural |
| Gestión: roles administrativos | Sí | Sí | No (2 roles) | Permisos en tabla aparte |
| Integración con asistentes IA externos | No | No | Sí, MCP por rol | Diferencial |

Conclusiones:

* **Lo que hace mejor:** la experiencia de clase (en vivo, voz, encuestas, marcas, analítica por slide), la evaluación entre pares con discordancias y el «qué hago ahora» en 0 clicks.  
* **Lo que no hace:** nada de gestión académica.  
* Frente a Moodle le faltan la autoría desde la UI (trabajos y rúbricas), los adjuntos y la matriculación.  
* Para cubrir lo del SIU harían falta tablas nuevas (enrollments, períodos, attendance, notas o actas), un rol de staff aparte, sacar COURSE\_ID de las queries y SSO.  
* Es un campus de una materia, muy profundo; no una plataforma institucional.

## 8\. Modelo de datos

18 migraciones SQL escritas a mano crean 50 tablas en public: 31 en 0001 y 19 en las demás. RLS activo sin políticas; todo el acceso pasa por service\_role. 7 migraciones alteran tablas creadas antes: 0140, 0141, 0150, 0160, 0200, 0210 y 0230\_public\_decks.

| Tabla | Feature | Para qué | Relaciones clave |
| :---- | :---- | :---- | :---- |
| courses | Núcleo | Curso (slug) | Padre de casi todo |
| people | Núcleo | Padrón, perfil, rol, pin\_hash, session\_version | course\_id NOT NULL (un curso por persona) |
| class\_sessions | Núcleo | Jornadas (aicm-jN) | course\_id; deck\_id sin FK |
| class\_session\_teachers | Núcleo | Docentes por jornada | class\_sessions y people |
| slides, slide\_revisions | Contenido | Slides DSL e historial | slide\_revisions a slides |
| decks, deck\_slides | Contenido | Decks y orden | deck\_slides a decks y slides |
| media\_assets | Contenido | Registro del bucket público media | deck\_id |
| live\_sessions, live\_events | En vivo | Estado de la clase y log | decks, class\_sessions |
| transcript\_segments, agent\_turns | En vivo / IA | Transcripción y turnos de IA y MCP | live\_sessions, people |
| polls, poll\_responses | En vivo | Encuestas | person\_id o guest\_key |
| slide\_marks, slide\_notes | En vivo | Marcas y notas por slide | people, decks |
| cases, case\_postures | Casos | Casos y posturas | class\_sessions, people |
| cold\_call\_rounds, cold\_call\_draws | Aula | Sorteos | people |
| participation | Aula | Intervenciones con calidad | people, class\_sessions |
| assignments, assignment\_settings | Entregas | Trabajo, rúbrica y modo de nota | settings 1:1 |
| submissions, peer\_reviews | Entregas | Entrega y revisiones (también la docente) | unique(assignment, person) |
| sim\_definitions, sim\_runs, sim\_events | Simuladores | Corridas, score y eventos xAPI | people, live\_sessions |
| tutor\_threads, tutor\_messages | Tutor | Hilos por slide y modo | people |
| concepts, content\_items | Conceptos | Conceptos y materiales | class\_sessions |
| api\_tokens, setup\_pairings, environment\_checks | Auth y setup | Tokens MCP, emparejamiento, verificación de entorno | people |
| auth\_throttle, rate\_hits | Seguridad | Throttle y rate limit | Sin FK |
| organizations, organization\_revisions | Organización | Ficha de la empresa y snapshots | unique(course, person) |
| activity\_entries, activity\_items, activity\_state | Actividades | Fichas, registros y estado | activity\_id text sin FK ni course\_id |
| office\_hour\_slots, office\_hour\_bookings | Office hours | Franjas con cupo (oh\_book) | people |
| radar\_items, radar\_comments | Radar | Noticias y comentarios | people |
| announcements | Avisos | Avisos del curso | class\_sessions, people |
| session\_reflections, session\_feedback | Post-clase | Reflexión y devolución (borrador a publicado) | class\_sessions, people |

### Qué falta para lo académico y cómo agregarlo

* **Faltan:** carrera, plan, materia, período o cuatrimestre, comisión, inscripción, nota persistida o acta, asistencia, mesas de examen, correlativas, registro de avisos leídos y mensajería.  
* **Cómo:** una migración nueva numerada después de 0230, sin alterar tablas existentes, con el estilo de 0230\_post\_class.sql (begin/commit, enable RLS, revoke a anon y authenticated, grant a service\_role).  
* **Tablas candidatas:**  
  * academic\_periods.  
  * **enrollments:** person\_id a people, course\_id a courses, period\_id, condición y estado, con unique. Permite varios cursos por persona sin tocar people.course\_id.  
  * **grades o actas:** congelan el resultado de gradeSubmission con published\_by y revision, como session\_feedback.  
  * **attendance:** class\_session\_id, person\_id y estado, unique.  
  * announcement\_reads.  
  * Permisos de staff en tabla aparte, en vez de ampliar el check de people.role.  
* **Funciones:** enroll\_book copiada de oh\_book (FOR UPDATE) para inscribirse con cupo.

## 9\. Acceso, seguridad y tiempo real

* **Login:** alumnos con padrón, PIN (scrypt) y código inicial HMAC en el primer ingreso; profesores con email y código compartido. Sin SSO; para sumarlo alcanza con una server action que termine en setSessionCookie.  
* **Sesión:** cookie firmada con HMAC por 30 días, validada en cada request contra people.session\_version (revocable). Fail-open si la base falla.  
* **Roles:** solo alumno y profesor, como check en people.role. Sumar un rol obliga a tocar verifySessionToken, homeFor, los layouts, lib/routes.ts, lib/session-token.ts, lib/auth.ts y lib/db-types.ts.  
* **Protección de rutas:** layouts y páginas llaman a requirePerson o requireSession; el middleware solo controla la apertura. Las APIs validan con getSession, withLive o apiSession (tres variantes de helper).  
* **RLS:** activo sin políticas. 0140 revoca todo a anon y authenticated, también en privilegios por defecto. La autorización real está en el código, porque todo usa service\_role.  
* **Realtime:** broadcast de Supabase con dos canales.  
  * **Público live:ID:** posición, overlay, conteos, marcas y posturas.  
  * **Profesor liveprof:ID:HMAC:** transcripción, turnos del agente, sorteos y textos de encuestas.  
  * La política de 0140 deja leer live:% y liveprof:% sin login: la protección del canal del profesor depende de que su nombre no se pueda adivinar. Notas e inscripciones no deberían viajar por realtime.  
  * Las actividades no usan realtime: polling cada 4 a 6 s.  
* **Exposición:** padrón sin login, códigos iniciales en claro en /profesor/alumnos y bucket media público. El detalle con archivos está en la sección 15\.

## 10\. IA en el repo

* **SDK:** @anthropic-ai/sdk directo, siempre claude().beta.messages con el beta server-side-fallback-2026-07-01. Sin Agent SDK ni LangChain.  
* **Modelos:** MODEL\_LIVE es claude-sonnet-5-5 (agente en vivo, tutor, resumen de analítica, pre-evaluación). MODEL\_AUTHORING es claude-opus-5-5. Hay ids repetidos en lib/authoring/agent.ts:23 y lib/assignments/ai.ts:7. Haiku no se usa.  
* **Agente en vivo (lib/agent/\*):** hasta 6 vueltas en 25 s, effort low, system prompt cacheado. Contexto: deck, slide actual, encuesta, casos, padrón, simuladores y últimos 2 minutos de transcripción. Lo escrito por alumnos entra con untrusted(), que solo se usa en lib/agent/context.ts. Actúa sin pedir confirmación.  
  * **17 herramientas:** goto\_slide, create\_poll, open\_slide\_poll, show\_poll\_results, close\_poll, insert\_slide, edit\_slide, pick\_random\_student, log\_participation, show\_case\_postures, show\_confusion, start\_timer, show\_qr, launch\_simulator, show\_message, clear\_overlay, recall\_transcript.  
* Tutor (lib/tutor, app/api/tutor): streaming, 4 modos, últimos 20 mensajes como historial. Contexto: slide sin notas del docente, slides vecinas, perfil del alumno y sus notas y marcas, que entran sin untrusted(). Cupo de 40 por día, no atómico.  
* **Autoría (lib/authoring):** Opus con thinking adaptativo, hasta 10 vueltas en 240 s, sin cupo. Herramientas: search\_library, read\_slide, propose\_slides, insert\_slides, edit\_slide, set\_teacher\_notes; las tres últimas solo generan Proposal que el profesor aplica con control de versión.  
* **Llamadas sueltas:** summarizeUnderstanding (resumen del deck), aiPreEvaluate (pre-evaluación sin persistir, sin untrusted()) y el rediseño de un caso (demo).  
* **MCP (lib/mcp):** no llama a ningún modelo; el razonamiento lo pone el cliente. Cada llamada queda en agent\_turns; ask\_about\_slide descuenta del cupo del tutor.  
  * **Profesor (14):** list\_sessions, get\_deck, search\_slides, create\_slide\_draft, insert\_slide, set\_teacher\_notes, class\_understanding, case\_postures, participation\_report, cold\_call\_plan, pending\_reviews, post\_announcement, search\_transcript, get\_materials.  
  * **Alumno (10):** my\_pending, get\_class, my\_notes, submit\_posture, submit\_assignment, get\_case, ask\_about\_slide, concept\_map, hola\_campus, mi\_organizacion.  
* **Consumo:** no se registran los tokens usados.  
* **Reutilizable para nuestras ideas:**  
  * my\_pending (lib/mcp/tools/alumno.ts:34) ya resuelve «qué tengo pendiente»: casos sin postura, entregas abiertas, revisiones, próxima jornada y últimos 5 avisos.  
  * **lib/classroom/summary.ts:** una llamada, contexto armado como texto, salida markdown; base para un resumen semanal.  
  * **La ruta del tutor:** chat con hilo, cupo y streaming.  
  * **El patrón Proposal:** cualquier IA que escriba datos sensibles, como notas o actas.  
  * Herramienta MCP nueva (por ejemplo mi\_semana): se agrega a ALUMNO\_TOOLS o PROFESOR\_TOOLS y aparece sola en la página de tokens.

## 11\. Checklist para que el código sea mergeable

Son las reglas de docs/SPEC.md y docs/CONTRACTS.md, más cinco recomendaciones nuestras que salen de los riesgos de la sección 15 y conviene confirmar con Nacho: seed propio, nada sensible por realtime ni en errores 500, untrusted() en todo prompt, cupo atómico y la excepción del middleware para rutas nuevas.

### Estilo e idioma

* Dos espacios, comillas simples, sin punto y coma, imports con @/ desde la raíz. No hay linter ni Prettier: se respeta a mano.  
* UI, comentarios y errores en español rioplatense con voseo. Rutas de páginas en español (/campus/entregas). Identificadores y columnas en inglés; valores de dominio en español ('borrador', 'abierta').  
* **Sin dependencias nuevas:** nada de Tailwind, librerías de UI, zod, ORM ni otro framework de tests.

### Estructura de una feature

* lib/nombre-feature/ con types.ts, core.ts (lógica pura, sin I/O), store.ts (server-only, usa db() y must()) y actions.ts ('use server'). Modelo a copiar: lib/learning.  
* components/nombre-feature/ con su .css y prefijo de clase propio. 'use client' solo en la hoja interactiva y nunca dentro de app/.  
* Páginas en app/campus/nombre-feature (alumno) y app/profesor/nombre-feature (docente); APIs en app/api/nombre-feature.  
* Rutas en lib/nombre-feature/routes.ts y una sola línea en el menú de lib/routes.ts.  
* Tests de la lógica pura en tests/nombre-feature.test.ts con node:test, con script en package.json.  
* docs/NOMBRE-FEATURE.md con el formato de POST-CLASS.md: producto, arquitectura, archivos, fallos y rollback, verificación.

### Base de datos

* Una migración nueva después de 0230 (0230 ya está repetido); el número hay que acordarlo con Nacho.  
* Idempotente (if not exists, create or replace), en transacción, con RLS activado sin políticas, revoke a anon y authenticated y grant a service\_role en cada tabla y función. Plantilla: 0230\_post\_class.sql.  
* No alterar tablas existentes, aunque el repo lo haya hecho. Si hace falta un dato extra, tabla aparte que referencie people(id) o courses(id).  
* Operaciones con cupo o concurrencia en una función SQL con lock, como oh\_book.  
* Seed propio, idempotente, con datos ficticios marcados is\_fictional y sin depender de ../mbt.

### Auth, datos y seguridad

* Cada página y cada action empieza con requireSession('alumno' \| 'profesor'); el layout no alcanza. En las APIs, getSession() y respuesta JSON con la forma { error }.  
* El id de la persona sale de la sesión, nunca del formulario. Datos solo en el servidor con service role; la clave nunca va al cliente.  
* Filtrar siempre por curso y listar columnas explícitas en lo que lee el alumno (nunca pin\_hash ni notas del docente).  
* dynamic \= 'force-dynamic' en lo que lee sesión.  
* Nada sensible por el canal público de realtime. No devolver mensajes internos en errores 500\.  
* Si la ruta de alumno es nueva, sumarla a las excepciones del middleware o definir CAMPUS\_ABRE.

### IA

* Usar claude() y las constantes de modelo de lib/claude.ts; maxDuration explícito en la ruta.  
* Todo texto escrito por alumnos entra al prompt con untrusted() (lib/agent/context.ts), aunque el tutor y la pre-evaluación no lo hagan.  
* Lo que escriba un agente es una propuesta que aprueba una persona (patrón Proposal). Para notas y actas es obligatorio.  
* **Herramienta MCP nueva:** archivo propio en lib/mcp/tools/ y una línea en el array del rol.  
* Poner cupo atómico si la feature llama al modelo por usuario.

### Antes de entregar

* Node 22, npm ci, npm run typecheck, npm run build, npm run test:learning, tests de assignments y los propios.  
* Probar a 390 px de ancho y con teclado, como pide el repo.

## 12\. Archivos compartidos donde va a haber conflictos

* **lib/routes.ts:** rutas y menús (PROFESOR\_NAV, ALUMNO\_NAV). Es el conflicto más probable.  
* **middleware.ts:** hasta el 12/11 18:30 las rutas de /campus fuera de las 4 excepciones exactas redirigen a la bienvenida.  
* **Homes y su lógica:** app/campus/page.tsx, app/profesor/page.tsx, lib/inicio.ts, lib/learning/core.ts y lib/jornadas.ts, si la feature quiere aparecer ahí.  
* Número de migración, package.json (scripts de test), README y docs/CONTRACTS.md.  
* **Solo si se agrega un rol:** lib/session-token.ts, lib/auth.ts, lib/db-types.ts y el check de people.role. Mejor evitarlo.

## 13\. Límites del repo que condicionan la idea

* **Un solo curso:** COURSE\_ID \= 'ai-centric-management'. Además del curso, están fijos en el código el login, las jornadas (ids aicm-jN, lugar «DOT Baires», 210 minutos), la fecha de apertura, los ENTREGABLES y los docentes. Camino mergeable: tablas nuevas de inscripción (persona, materia, comisión, período, condición) que referencien people y courses, sin tocar lo existente.  
* **Dos roles:** no hay bedelía ni administrativo. Camino mergeable: tabla de permisos y un requireStaff() propio montado sobre requireSession('profesor'), en vez de agregar un rol al núcleo.  
* **Sin modelo académico:** todo lo que lista la sección 8 sería tabla nueva.  
* **Notas no persistidas:** un acta necesita nota guardada, cierre y registro de quién cambió qué y cuándo, como pide el ejemplo de spec del artifact.  
* **Login y realtime:** el PIN de 4 dígitos alcanza para una demo, no para datos académicos reales, y el canal realtime abierto (sección 9\) no sirve para datos personales.

## 14\. Cómo encajan las ideas del research

| Idea | Encaje | Costo |
| :---- | :---- | :---- |
| Avisos donde están los alumnos | Alto: la tabla y la lectura en la home existen; falta lo demás | Bajo a medio |
| Resumen semanal con IA | Alto: Claude integrado y summary.ts como modelo | Bajo a medio |
| Inicio «Mi cuatrimestre» para celular (materias actuales, próximas entregas, avisos sin leer) | Alto: existen nextStep y la home; falta que sea de varias materias | Medio |
| Inscripción a materias o finales con cupo | Medio: existe el patrón de cupo, no el modelo académico | Medio a alto |
| Cierre de actas | Medio: hay rúbricas, CSV y borrador/publicación; faltan acta inmutable y staff | Alto |
| Matriculación SIU a Moodle y rol «final pendiente» | Bajo: es un problema de Moodle; acá solo se simula con enrollments | Fuera de esta base |
| Arreglos de configuración de Moodle | Ninguno: sirven para el pitch | No aplica |

### Avisos donde están los alumnos

* **Dónde se engancha:** announcements ya existe y lib/inicio.ts ya lo lee.  
* **Qué se reutiliza:** post\_announcement y my\_pending.  
* **Qué crear:** /campus/avisos, ABM en /profesor/avisos, tabla announcement\_reads y, si se quiere, herramienta MCP mis\_avisos.

### Resumen semanal con IA

* **Dónde se engancha:** ruta o server component nuevo.  
* **Qué se reutiliza:** patrón de lib/classroom/summary.ts (claude(), MODEL\_LIVE, effort low, system cacheado) alimentado con la consulta de my\_pending y los avisos; untrusted() para texto de alumnos.  
* **Qué crear:** la ruta y, si se guarda el resumen, una tabla nueva.

### Inicio «Mi cuatrimestre»

* **Dónde se engancha:** app/campus/cuatrimestre/page.tsx con requirePerson('alumno'), un NavItem en lib/routes.ts y la ruta en ABIERTAS\_ANTES de middleware.ts (o CAMPUS\_ABRE).  
* **Qué se reutiliza:** nextStep (extendiendo su entrada sin cambiar la prioridad), la consulta de my\_pending y las funciones de lib/course.ts que ya reciben courseId.  
* **Qué crear:** enrollments, academic\_periods y un seed propio.

### Inscripción con cupo

* **Dónde se engancha:** páginas nuevas de alumno y de staff.  
* **Qué se reutiliza:** oh\_book (0170\_actividades.sql) y app/campus/office-hours/actions.ts.  
* **Qué crear:** tablas de oferta (con capacity) y de inscripción (unique), y enroll\_book con FOR UPDATE.

### Cierre de actas

* **Dónde se engancha:** panel de staff nuevo sobre los trabajos.  
* **Qué se reutiliza:** gradeSubmission y buildGradebook (lib/assignments/scoring.ts, core.ts), borrador a publicado de session\_feedback y Proposal si interviene IA.  
* **Qué crear:** tabla de actas o grade\_snapshots que congele la nota y permisos de staff en tabla aparte.

## 15\. Riesgos, deuda técnica y problemas del zip

### Alto

* **Compilación:** lib/jornadas.ts y la página de conceptos importan lib/content/server, que no vino.  
* **Seeds:** npm run seed falla en scripts/seed/base.ts por el import de ../mbt; además faltan content/aicm/j\*.ts, content/aicm2/j1..j8.ts y conceptos.json. Sin eso no hay curso, jornadas ni padrón.  
* **Contenido faltante:** content/ trae solo los tipos; faltan public/decks, docs/shots e historial de git. content/hackai existe vacía, quizá reservada para la hackathon.  
* **Suplantación de profesor:** el código compartido permite entrar como otro conociendo su email (app/actions/auth.ts).  
* **Notas:** no se persisten; cambiar el modo o reabrir un trabajo altera notas ya comunicadas (lib/assignments/scoring.ts). Transiciones de estado libres (app/profesor/entregas/\[id\]/actions.ts).  
* **Simuladores:** el score lo manda el cliente sin validar y una corrida se puede completar de nuevo (lib/sims/server.ts completeRun).  
* **Curso fijo:** COURSE\_ID constante y queries sin filtro de curso en case\_postures, slide\_marks, polls, live\_sessions, activity\_\* y getCase (lib/db-node.ts, app/campus/page.tsx, lib/classroom/cases.ts).

### Medio

* **Fail-open:** sesión y throttle aceptan sesiones revocadas y pierden el bloqueo por PIN si la base cae (lib/auth.ts, lib/security.ts).  
* **Logout por GET:** /salir con efecto lateral permite un CSRF de logout en el mismo sitio y cierra todos los dispositivos (app/salir/route.ts).  
* **Padrón expuesto:** nombres y empresas sin login (app/page.tsx, app/s/\[code\]/page.tsx); PIN de 4 dígitos.  
* **Redirección abierta:** el sanitizado de next en app/page.tsx no excluye /\\ (safeNext en las actions sí).  
* **Migraciones:** dos con número 0230, 0001 usa una guarda de psql que no corre en otras herramientas, y 7 alteran tablas existentes.  
* **Esquema divergente:** radar\_votes se borra en 0190 pero ninguna migración la crea.  
* **Bucket y realtime:** bucket media público (0220\_media.sql) y política de realtime abierta a anon (0140\_security.sql).  
* **MCP:** tokens sin vencimiento, token en la URL, CORS «\*» y lotes sin tope (lib/mcp/server.ts).  
* **Cupo del tutor:** no atómico y compartido con el MCP (lib/tutor/server.ts).  
* **Resumen de sims:** GET /api/sims/summary exige sesión pero no rol profesor; devuelve agregados sin nombres (app/api/sims/summary/route.ts).  
* **Scripts de test:** smoke.ts y cleanup.ts escriben y borran por ventana de tiempo en la base que apunte .env.local (scripts/test/\*).  
* **Instalador:** el fallback apunta a campus-austral.vercel.app (lib/setup/scripts.ts:18).  
* **IA sin control de gasto:** no se registran tokens y la autoría con Opus no tiene cupo (lib/authoring/agent.ts).  
* **Errores 500:** algunos devuelven el mensaje interno.  
* **Prompts:** el tutor y la pre-evaluación no pasan el texto del alumno por untrusted().

### Bajo

* **Casos:** cases.is\_active no se filtra (lib/classroom/cases.ts:12-26).  
* **Concurrencia:** bumpSessionVersion y patchActivityState hacen read-modify-write sin lock (lib/auth.ts, lib/actividades/store.ts).  
* **Office hours:** se puede cancelar una franja pasada, borrar franjas sin aviso y las inserciones no van en transacción (lib/actividades/office-hours.ts, app/profesor/office-hours/actions.ts).  
* **Participación:** la deduplicación depende de un texto en note (lib/classroom/participation.ts:282).  
* **Rendimiento:** N+1 en listAssignmentsWithStats y conteos de actividades en JS (lib/actividades/store.ts).  
* **Reglas propias rotas:** ids de modelo fuera de lib/claude.ts, página sin requireSession (app/profesor/bienvenida), tres variantes de helpers de API, errores de base que se tragan. No es motivo para copiarlo: el código nuevo sigue la regla escrita.  
* **Operación:** sin CI, sin linter, sin script npm para assignments.test.ts y sin .env.example. Hacen falta un Supabase propio, SESSION\_SECRET, PROFESSOR\_ACCESS\_CODE y ANTHROPIC\_API\_KEY.  
* **Datos fijos:** textos, fechas, lugar, 210 minutos y docentes en el código (lib/apertura.ts, lib/jornadas.ts, lib/learning/core.ts, lib/actividades/catalog.ts).  
* **Documentación desactualizada:** SPEC dice que el curso va del 10/11 al 03/12 y el README del 12/11 al 10/12; SPEC pide migraciones 01NN y la serie llega a 0230; README y CONTRACTS describen mal los scripts npm, el orden de los seeds, la navegación y el horario. Si algo choca, manda el código.

## 16\. Preguntas para Nacho

* ¿Qué significa «mergeable» para él: un PR a su repo, un módulo que integre después, o solo mismo stack y convenciones?  
* ¿Puede pasar el repo completo o acceso a git? Faltan lib/content/server, ../mbt y el contenido para sembrar.  
* ¿Qué número de migración usamos y quién más suma migraciones esta semana?  
* ¿Hay un proyecto Supabase de prueba para la hackathon o cada equipo levanta el suyo?  
* ¿La carpeta content/hackai es para nosotros? ¿Qué espera ahí?  
* ¿Acepta tablas nuevas para varias materias y permisos administrativos, o prefiere todo dentro del curso único?  
* ¿El esquema de producción coincide con las migraciones (radar\_votes)?  
* ¿Quiere que le reportemos los hallazgos de seguridad de la sección 15 aparte?

## 17\. Próximos pasos

* **Spike:** conseguir el repo completo, levantar un Supabase propio, correr las migraciones y hacer andar la home del alumno con un seed sintético propio.  
* Elegir un flujo de encaje alto (sección 14\) y escribir su spec con el formato de POST-CLASS.md.  
* Construirlo como módulo autocontenido siguiendo la sección 11\.  
* Para el pitch, decir qué es real y qué está simulado: los datos del SIU y de Moodle van a ser sintéticos.

## 18\. Sin verificar

* **Ejecución:** que la app compile y corra con el repo completo; no se hicieron build, migraciones, seeds ni tests contra base real.  
* **Clicks y celular:** se estimaron leyendo código y CSS, sin usar la UI.  
* **Realtime real:** si la política RLS de la base exige usuario autenticado.  
* **Esquema de producción:** si coincide con las migraciones (indicio en contra: radar\_votes).  
* **UI puntual:** si QuickJoin en /s/\[code\] pide PIN, si SummaryPanel usa el resumen con IA, el detalle de LiveConsole, LiveStudent, TutorPanel, AgentPanel, EntryTools, PairTools y Directorio, y si la UI expone el parámetro only en pairs.generate.  
* **Laboratorio SQL:** cómo se carga sql.js y cómo valida.  
* **Instalador:** la entrega del token en /api/setup/poll y el efecto exacto de hola\_campus sobre B1.  
* **SIU:** su stack interno en la Austral y si expone una API.  
* **Moodle docente:** la comparación con la Tarea y el Taller no está en el relevamiento.  
* **Alcance:** qué entiende Nacho por mergeable; el checklist asume que valen SPEC y CONTRACTS.

# Propuesta: motor propio con la estética de Nacho

*Propuesta para discutir en el wayfinder (10/11/2026). Nada de esto está decidido: lo que falta resolver está en la última sección.*

## 1\. La propuesta en una frase

Armamos nuestro propio motor académico, pensado para muchas materias, y usamos el campus de Nacho de dos formas: como fuente de diseño y de lógica que copiamos, y como un sistema externo que aporta su materia a «Mis materias».

## 2\. El gráfico

Cada capa envuelve a la siguiente. Las dependencias apuntan hacia adentro: el motor no conoce a ninguna capa de afuera.

| Interfaces (con la estética de Nacho) y adaptadores  Alumno Docente Administrativo Asistente IA  Servicios Mis materias · inscripción con cupo · cierre de actas · avisos  Motor propio Carreras, materias, comisiones, períodos Inscripciones, notas, actas, historia Multimateria desde el día uno   SIU Simulado Campus de Nacho Proveedor de materia Moodle A futuro SSO Identidad única  |
| :---: |

Del repo de Nacho copiamos:

| Sistema visual | Lógica pura | Patrones |
| :---: | :---: | :---: |
| Va a las interfaces | Va al motor | Cupo, Proposal y untrusted() |

Colores: verde, lo que construimos nosotros; coral, lo que viene de Nacho; blanco y gris, interfaces, servicios y adaptadores.

## 3\. Por qué no usar el campus de Nacho como motor

* **No es casi todo frontend:** tiene tanta lógica de servidor como pantallas.

| Parte | Líneas aproximadas |
| :---- | :---- |
| Pantallas y componentes (TSX) | 15.000 |
| CSS (estilos IAE) | 18.000 |
| Lógica de servidor y dominio en lib/ | 20.000 |
| APIs y server actions | 2.000 |

* **Un solo curso:** COURSE\_ID \= 'ai-centric-management' aparece 141 veces en 37 archivos, y people.course\_id es obligatorio, así que una persona pertenece a un solo curso.  
* **Dos roles:** alumno y profesor. No hay administrativos.  
* **Notas que no se guardan:** se calculan al leer, así que no sirven para actas.  
* **Páginas atadas a su base:** 19 de sus 31 páginas consultan la base directamente.  
* **Conclusión:** usarlo de motor obliga a refactorizar su núcleo. Con un motor propio, el modelo nace multimateria y no dependemos de que Nacho cambie el suyo.

## 4\. Las capas

* **Centro, motor propio:** carreras, planes, materias, comisiones, períodos, inscripciones, asistencia, notas, actas e historia académica.  
* **Servicios:** Mis materias, inscripción con cupo, matriculación, cierre de actas, trámites y avisos unificados. Usan el motor.  
* **Interfaces:** alumno, docente, administrativo y asistente IA, armadas con el sistema visual de Nacho.  
* **Adaptadores:** SIU (simulado para la demo), campus de Nacho como proveedor de materia, Moodle a futuro y SSO con identidad única. Cambiar un adaptador no toca el motor.

## 5\. Qué tomamos del repo de Nacho

| Qué | Ejemplos | Dónde va | Cómo |
| :---- | :---- | :---- | :---- |
| Sistema visual | Tokens y CSS de IAE, shell con menú, tarjetas, componentes de presentación | Interfaces | Copiado y adaptado a nuestros tipos |
| Lógica pura | lib/assignments/scoring.ts, assign.ts, nextStep() de lib/learning/core.ts, parser de slides, motores de simuladores | Motor y servicios | Copiada tal cual: no tiene I/O |
| Patrones | Reserva con cupo en SQL (oh\_book), Proposal (la IA propone y una persona aprueba), untrusted() | Donde haga falta | Reimplementados con la misma idea |
| Su materia entera | Clase en vivo, agente por voz, tutor, MCP | Adaptador | Integrada por API, sin copiar código |

## 6\. Qué rehacemos y qué no

* **Rehacemos:** el modelo de datos multimateria, el login con identidad única, el acceso a datos (store y actions propios) y las páginas, con sus componentes y nuestros datos.  
* **No reconstruimos:** la clase en vivo, el agente por voz, el tutor y el MCP. Son lo más valioso y lo más pesado de su campus, y entran por el adaptador.

## 7\. Cómo entra el campus de Nacho como proveedor

* **Un adaptador «proveedor de materia»:** una interfaz chica con los datos de la materia, el próximo paso del alumno, sus pendientes y el enlace para entrar.  
* **Hipótesis para la materia de Nacho:** usar su MCP. La herramienta my\_pending del rol alumno ya devuelve lo que el alumno tiene pendiente en esa materia.  
* **Entrada a la clase:** desde «Mis materias», el alumno entra a la experiencia de Nacho tal como está.  
* **Moodle:** el mismo adaptador sirve después para una materia de Moodle.

## 8\. Qué cambia en el repo

* **ADR 0002 (mismo stack, sin dependencias nuevas):** sigue valiendo.  
* **ADR 0001 y la skill port-to-campus:** pierden peso, porque ya no mandamos código a su repo. El cambio se registra en una ADR 0004\.  
* **Regla de rutas compatibles (AGENTS.md y skill campus-feature):** se revisa. Lo que no viaja a campus no necesita imitar sus rutas.  
* **campus/:** sigue como snapshot de solo lectura, ahora como fuente de diseño y de lógica.

## 9\. Riesgos

* **Tipos de datos:** sus componentes esperan sus tipos. Adaptarlos lleva trabajo, aunque menos que diseñar desde cero.  
* **Atribución:** si copiamos su CSS y su lógica, hay que avisarle a Nacho y anotar de dónde sale cada archivo.  
* **Disponibilidad:** la integración depende de que su campus esté desplegado y accesible durante la demo. Si no, el adaptador usa datos simulados.  
* **Tiempo:** quedan tres días hasta la demo, así que el motor se limita a lo que muestra el recorte.

## 10\. Recorte para la demo del viernes 13/11

1. El alumno entra con identidad única.  
2. Ve «Mis materias» con dos materias de nuestro motor y la de Nacho como proveedor externo.  
3. Ve el próximo paso de cada una y los avisos unificados.  
4. Se inscribe a un final con cupo, con datos de un SIU simulado.

Todo con la estética de Nacho.

## 11\. Preguntas para el wayfinder

Destino posible (hipótesis): ADR 0004 aceptada y spec del recorte de la demo, listos para pasar a tickets.

| Pregunta | Por qué importa |
| :---- | :---- |
| ¿Adoptamos el motor propio o seguimos con el campus de Nacho como motor? | Define todo lo demás y si la ADR 0001 se reemplaza. |
| ¿Qué entidades entran en el modelo mínimo del motor para la demo? | Carreras, planes, períodos y asistencia pueden quedar fuera del recorte. |
| ¿El campus de Nacho entra por su MCP, por una API nueva o con datos simulados? | Depende de que esté desplegado y de cómo se autentica nuestro sistema contra el suyo. |
| ¿Cómo se comparte la identidad entre nuestro campus y el de Nacho? | Sin eso, el alumno inicia sesión dos veces. |
| ¿Qué componentes y estilos de Nacho copiamos primero y cómo registramos su origen? | Ordena el trabajo de interfaces y la atribución. |
| ¿Cómo simulamos el SIU: datos fijos, fixtures o una API falsa? | Define cuánto código de integración mostramos. |
| ¿Le contamos a Nacho antes de la demo y qué le proponemos? | La relación pasa de mandarle código a integrarnos con su sistema. |
| ¿Qué hacemos con la skill port-to-campus y la regla de rutas compatibles? | Si no viaja código, conviene simplificar el repo. |

