# El problema

Qué les molesta a alumnos y docentes de SIU Guaraní y del Campus Virtual, por qué pasa, y cuánto cuesta hoy cada tarea frecuente.

**Fuentes** (pestañas del [Google Doc del equipo](https://docs.google.com/document/d/1vzCAqms9f6OHlAU2imse0ZOsw-SNLW2Ol5P_9auUWtk/edit)): Research, Moodle (campus), Moodle y Siu, y el [relevamiento](../research/2026-11-10-relevamiento-siu-campus.md) del 10/11/2026.

**Límites de la evidencia:** las quejas salen de conversaciones con pocos alumnos de grado de la Facultad de Ingeniería (Informática y Biomédica) y un docente. Los porcentajes vienen de la encuesta del equipo a alumnos: 39 respuestas entre el 6 y el 10/11/2026, 41% de Ingeniería, 28% de Comunicación, 18% de Empresariales y el resto de Biomédicas y Derecho. El conteo está en la pestaña «Resultados Encuesta» del Google Doc. No hubo respuestas de docentes. El relevamiento se hizo con una sola cuenta de alumno, en solo lectura.

## Los dos sistemas

- **SIU Guaraní:** gestión académica (inscripciones, historia académica, plan, constancias). Lo administra la universidad; el código no es público.
- **Campus Virtual:** Moodle 5.1 con el tema comercial Lambda 2 y login con Microsoft 365. Aulas, materiales, entregas, avisos.

No están conectados. Cada uno tiene su calendario, su bandeja de mensajes y sus notas. El único puente visible es el botón «Ir» de SIU > Reportes > Mis inscripciones, que abre el curso de Moodle.

## Problemas de alumnos

| # | Problema reportado | Qué confirmó el relevamiento | Causa |
| --- | --- | --- | --- |
| A1 | «Salimos como aspirantes en el SIU apenas entramos»; hay que cambiar de perfil | **Confirmado.** El selector de propuesta lista «Aspirantes - fi» como propuesta pasiva. El aviso de requisitos de ingreso vencidos del inicio probablemente sale de ahí | El SIU lista toda propuesta con la que el alumno tuvo vínculo |
| A2 | No podemos darnos de baja de una materia del Campus al terminarla | **Confirmado.** La opción no existe para el alumno | La matrícula se gestiona por fuera del Campus |
| A3 | Demasiados clicks en el SIU para llegar a lo que querés | **Matizado.** Las pantallas están a 1 o 2 clicks; el costo real es cruzar varias pantallas a mano para responder una pregunta. En el Campus las tareas comunes cuestan 3 a 5 clicks | No hay vista que responda «qué me falta», «qué finales debo» o «cuántas faltas tengo» |
| A4 | El mensaje del docente en una entrega se corta con «…» | **No reproducido.** Los comentarios se ven completos al expandir «Comentarios (N)». Falta revisar una tarea calificada | Hipótesis: CSS del tema |
| A5 | Hay que matricularse a mano en cada materia del Campus | **Confirmado en parte.** El catálogo de grado responde «No se puede auto matricular en este curso»; el alta la hace otro proceso | Auto-inscripción e inscripción manual, sin sincronización con el SIU. El SIU sí conoce el curso de Moodle de cada materia (botón «Ir») |
| A6 | Al patear un final te sacan del curso y perdés el material | No verificable con una cuenta de alumno. Indicio: existe un plugin de desmatriculación masiva por CSV y el curso más viejo visible es de julio de 2025 | Hipótesis: limpieza manual al cierre del cuatrimestre |
| A7 | No llegan notificaciones del material nuevo | **Explicado.** La preferencia «Cambios de contenido del curso» está activa en Web y Email, pero solo se envía si el docente marca la casilla al subir. No hay canal push | La casilla viene desmarcada; push sin configurar |
| A8 | Cursos viejos mezclados con los actuales (56% de la encuesta) | **Confirmado.** 14 cursos en el inicio: 1C, 2C, anuales y uno de 2025, con la misma imagen y nombres con códigos internos | Ningún curso tiene fecha de fin y los filtros En progreso / Pasados están desactivados |
| A9 | No se ven las fechas en el inicio (36%) | **Confirmado.** El inicio no muestra entregas, eventos ni avisos | El inicio usa un bloque de tarjetas de terceros, sin Línea de tiempo |
| A10 | Mal en el celular (49%) | **Inferido del código, sin probar en un teléfono.** El SIU bloquea el zoom; el Campus esconde accesos en un cajón y usa iframes de ancho fijo | Diseño de escritorio; tema Lambda 2 |
| A11 | Aulas con organización confusa (54%) | **Confirmado.** Cada docente organiza distinto; hasta 16 pestañas por curso; contenido heredado de 2022 y 2025 | No hay plantilla de curso |

## Problemas de docentes

Un solo testimonio, sin relevamiento con cuenta docente:

- La comunicación (anuncios, notificaciones) es engorrosa: hay que pedirle al alumno que se suscriba para que le lleguen los avisos. Compara con Discord y Slack, que le resultan cómodos.
- Subir material de clase tiene pasos y pestañas de más.

El relevamiento aporta un dato: el alumno no ve ninguna opción de suscripción en el foro de Avisos, lo que sugiere suscripción forzada o deshabilitada. Falta confirmarlo con un docente.

## Problemas que encontró el relevamiento y nadie había reportado

- **Nada se ordena por «qué tengo que hacer ahora».** Ni el inicio del SIU ni el del Campus muestran próximos vencimientos.
- **Información duplicada y desconectada:** dos calendarios, dos bandejas de mensajes, notas en los dos sistemas sin aclarar cuál es la oficial. El Calendario del Campus no incluye los parciales del SIU.
- **Datos contradictorios:** el inicio del SIU avisa requisitos de ingreso vencidos y Trámites > Requisitos de Ingreso dice que no hay ninguno; el contador de mensajes no coincide con los no leídos.
- **Links muertos para el alumno:** Reportes y Solicitar curso de Teams (Campus); Configuración y Agenda (SIU).
- **Estados vacíos de una línea** y **jerga administrativa** («Actuación provisoria», «no_presentado»).
- **Privacidad:** «Usuarios en línea», último acceso de los compañeros, email visible y una contraseña de matriculación publicada en un bloque.

## Línea base: pasos y clicks de las tareas frecuentes

Clicks de un alumno que navega por los menús desde la pantalla de inicio de cada sistema, sin escribir URLs. Medido el 10/11/2026. Es la referencia para medir cualquier mejora: una métrica de la forma «la tarea X pasa de N clicks a M» se apoya en esta tabla.

| Tarea | Sistema | Ruta | Clicks |
| --- | --- | --- | --- |
| Ver mis materias del cuatrimestre | Campus | Inicio | 0, mezcladas con cursos terminados y de 2025 |
| Entrar a una materia | Campus | Inicio > tarjeta del curso | 1 |
| Ver un archivo de la semana | Campus | Inicio > curso > pestaña de la semana > archivo | 3 |
| Leer el último aviso de una materia | Campus | Inicio > curso > Avisos > aviso | 3 |
| Entregar una tarea | Campus | Inicio > curso > pestaña > tarea > Agregar entrega > Guardar cambios | 5 |
| Ver qué vence pronto | Campus | Menú > Calendario (no hay nada en el inicio) | 1 |
| Ver mis notas del Campus | Campus | Menú de usuario > Calificaciones > curso | 2 a 3 |
| Inscribirme a una materia | SIU | Inscripción a Materias > actividad > Inscribirse | 3 |
| Darme de baja de una materia | SIU | Inscripción a Materias > Inscripciones activas > Dar de baja | 2 a 3 |
| Inscribirme a un final | SIU | Inscripción a Exámenes > materia > mesa > confirmar | 4 |
| Ver fechas de parciales | SIU | Reportes > Cronograma de evaluaciones | 2 |
| Ver mi historia académica | SIU | Reportes > Historia académica > consulta habitual | 3 |
| Ver mi promedio | SIU | Reportes > Promedio y porcentaje de avance | 2 |
| Saber qué me falta para recibirme | SIU | Plan de estudios + Historia académica, cruzando a mano | 2 por pantalla, sin respuesta directa |
| Saber cuántas faltas tengo | SIU | Reportes > Inasistencias, contando filas | 2 |
| Pedir constancia de alumno regular | SIU | Trámites > Solicitar Constancias > Nueva solicitud > Guardar | 4 |
| Leer comunicados de la facultad | SIU | Ícono de sobre > mensaje | 2 |

Los clicks subestiman el costo en tres casos: cuando la respuesta exige cruzar pantallas (qué me falta para recibirme), cuando hay que contar a mano (faltas) y cuando hay que revisar los dos sistemas (qué vence pronto: Calendario del Campus más Cronograma del SIU).

## Antecedentes de la integración SIU a Moodle

De la pestaña Moodle y Siu (no son de la Austral):

- UNLP Ingeniería tenía en Guaraní una opción «Sincronizar comisiones» manual y unidireccional; quedó inactiva al migrar a Guaraní 3 (2023).
- Para no perder el acceso al cerrar la cursada, otras universidades usan un rol de solo lectura, cursos en solo lectura tras la fecha de fin, u ocultan el curso en vez de desmatricular.
- No se encontró un conector oficial listo para Guaraní 3. Ni las universidades con integración la tienen totalmente automática.

## Sin verificar

- Qué versión de SIU Guaraní usa la Austral (2 o 3) y si expone una API.
- Si la desmatriculación de fin de cuatrimestre es automática o manual.
- Quién administra el Campus y el SIU.
- Todo lo docente: no hay relevamiento con cuenta de profesor.
- La lista completa de pendientes del relevamiento está en [la nota](../research/2026-11-10-relevamiento-siu-campus.md#pendiente-de-verificar).
