# Recorrido de UX/UI por perfil y módulo

Fecha: 2026-11-13. Contra `main` en `2b85f4c`, que ya incluye #118 (tomar lista, historial de clases, clase de ahora con Zoom) y #121 (mejoras visuales en compu y celular).

Pregunta: qué le cuesta a cada tipo de usuario hacer sus tareas frecuentes en HackAI, en el celular y en la compu, y qué conviene cambiar primero. De acá salen los issues de mejora.

## Cómo se hizo y límites

- Con el workflow `recorrer-ux` (`docs/agents/workflows.md`). Cada agente usó su propio Chrome headless (`npm run recorrer`) con la sesión de una persona sintética, completó las tareas del módulo de punta a punta y miró las capturas. Después, un segundo agente intentó refutar cada hallazgo reproduciéndolo, y una síntesis deduplicó entre celdas y priorizó.
- Perfiles: un alumno por facultad (el set sintético tiene dos: Ingeniería y Ciencias Empresariales) y tres docentes de distintas edades. La edad y la familiaridad digital **no están en los datos**: son un rasgo que el agente actúa y que define qué vistas se emulan.

  | Perfil | Persona sintética | Rasgo | Vistas |
  |---|---|---|---|
  | `alumno-fi` | Tomás Aguirre (Informática) | 20 años, celular entre clases, apurado | celular, compu |
  | `alumno-fce` | Nicolás Herrera (Contador Público) | 22 años, celular para chequear, notebook para trámites | celular, compu |
  | `docente-joven` | Diego Arrieta (FI) | 31 años, carga cosas desde el celular | celular, compu |
  | `docente-medio` | Mariana Ledesma (FI) | 47 años, notebook en la oficina, varias comisiones | compu, celular |
  | `docente-mayor` | Carolina Bustos (FCE) | 64 años, poca familiaridad digital | navegador al 125 %, celular con letra a 20 px |

- Dos corridas. La primera (38 celdas, 340 hallazgos confirmados, 80 mejoras) se hizo sobre `main` en `aa533ef`, antes de #118 y #121. Después de esos PRs, cada una de las 80 mejoras se volvió a probar en el navegador contra `2b85f4c` (sigue, cambió o resuelta), y se recorrieron de nuevo `shell`, `hoy` y el módulo nuevo `asistencia` (13 celdas, 109 hallazgos confirmados). Una consolidación final juntó las dos.
- Servidor local con los adaptadores en memoria y la fecha fija de la demo. Los agentes completaron flujos que cambian datos (inscripciones, entregas, notas), y otros agentes en paralelo cambiaban los mismos datos: algunos contadores y listas se movieron durante el recorrido.
- Las capturas quedaron fuera del repo. Las personas y los datos son sintéticos.
- Lo que no se pudo ver en pantalla y se confirmó solo por código, o quedó sin probar:

  - No hubo mejoras en estado «no-se-pudo»: todas se revalidaron en el navegador o por código. Estas partes, en cambio, quedaron sin ver en pantalla.
  - U-43 (M-12): el desfase de los contadores de la barra lateral contra la campana no se volvió a probar, porque depende de datos que cambian en paralelo. El mecanismo del layout no cambió.
  - U-46 (M-21): al mandar una consulta como alumno-fi, el botón quedó más de 20 s en «Enviando…» aunque el mensaje se guardó. No se investigó y puede ser del entorno local.
  - U-22 (M-23): el caso de Material y el de directos no se volvieron a probar. El mecanismo (UnreadRefresh y threadOf) es el mismo.
  - U-58 (M-43): no se verificó si se acepta un recuperatorio anterior al parcial, porque las instancias de prueba no estaban en esta corrida.
  - U-32 (M-51): la tira de columnas al 125 % con p-cbustos se infiere del código, que no cambió.
  - U-33 (M-54): no se volvió a confirmar que las mismas fechas sean enlaces en /hoy.
  - U-35 (M-56): la parte del alumno (estado de entrega en el calendario) se confirma solo por código, porque los datos de Práctica 4, 5 y 8 ya no existen.
  - U-64 (M-57): en el celular se confirma por código, porque el helper de captura reinicia el scroll.
  - U-36 (M-61): no se revisó el formato de fechas de Trámites.
  - U-69 (M-64): la respuesta a una consulta propia y la comisión para el docente se confirman por código, porque no quedaban consultas sin leer.
  - U-5 (M-65): la pestaña de exámenes para FCE no se recorrió.
  - U-39 (M-71): el «próximamente» con nota no se reprodujo en pantalla (el Segundo parcial de AM1 ya no tiene nota). AssessmentRow sigue con el defecto en el código.
  - U-92 (M-78): la ausencia de campos condicionales en Nueva solicitud se confirma en el código de requests.tsx.
  - U-61 (M-50): el teclado de iOS con inputMode decimal no se pudo ver en headless.
  - U-59 (M-44): solo se vio una tarea con 0 entregas, no una fila con entregas.
  - U-62 (M-52): el texto de la página incluye «Cambiaste el texto o la escala» justo después de la vista previa, pero no se confirmó si se ve en pantalla (probablemente es U-3).
  - U-53 (M-32): el formato de hora distinto entre Hoy (timeAgo) y Novedades (messageTime) se confirma por código.
  - U-6 (N-15): ningún recorrido vio el formulario editable de lista, el guardado ni el pase al SIU, por el reloj de la demo.

## Resumen

Lista final de mejoras contra main (2b85f4c, con #118 y #121). De las 80 mejoras de la corrida 1, solo M-10 quedó resuelta del todo: la barra lateral entra entera al 125 %. Otras 14 cambiaron y entran con el problema y la recomendación ajustados: M-12, M-13, M-17, M-18, M-30, M-31, M-43, M-53, M-59, M-63, M-67, M-68, M-73 y M-80. Las demás siguen igual. La corrida nueva (shell, hoy, asistencia) aportó 38 mejoras. Unas 20 se juntaron con las de la corrida 1 y el resto entra como nuevo, sobre todo lo de #118: «Tu próxima clase», tomar lista, el historial y el Zoom. Quedan 95 mejoras, U-1 a U-95: 6 P0, 35 P1, 43 P2 y 11 P3.

Los P0 son cinco. (1) La docente cae en la comisión equivocada: «Comisión Verano» abre la A, el selector no gobierna el canal ni el compositor y al 125 % la pestaña «Espacio» tapa «Verano». (2) Pegar notas de más de una línea nunca se puede guardar. (3) «Guardar notas» no confirma nada. (4) FCE no tiene ninguna oferta abierta. (5) Nadie del equipo sabe con qué persona y a qué hora se ve tomar lista en la demo, que es hoy.

Lo transversal sigue pesando: Volver va siempre a Mis materias, «Salir» es un ícono sin texto en compu, las hojas no tienen botón Cerrar, Instalar pisa el nombre de la facultad, la barra inferior corta «Inscripciones», hay texto de 10 a 11 px y horas en 12 h. #121 dejó cosas resueltas: una sola entrada a Novedades para el alumno en compu, el chip «En curso», el selector Materia del calendario, los filtros de Notas más bajos y el choque de «Calificaciones» con Novedades. También sumó problemas nuevos: tarjetas de alto fijo con huecos y un desborde con letra grande en /notas.

### Por perfil

- **alumno-fi**: Tomás llega a todo en 1 o 2 toques, y #121 le dio una sola entrada a Novedades y filtros de Notas más bajos. Lo frenan: la pestaña Tareas sin lo de Moodle (U-24), el material nuevo plegado (U-23), la nota nueva que marca todo como visto y lleva a la lista general (U-37), los eventos del calendario que no se abren y lo próximo lejos (U-33, U-34), las faltas sin el «te quedan» (U-19) y las notas en curso escondidas detrás de «1/3» (U-38). En el celular le pesan la barra inferior que corta «Inscripcio…» y tapa «Entregar» (U-8, U-25), las hojas sin Cerrar (U-11), «Volver» que lo deja siempre en Mis materias (U-7) y, con letra grande, el desborde de Notas (U-73).
- **alumno-fce**: Nicolás sigue sin poder inscribirse a nada: el seed no tiene oferta FCE abierta (U-5). Le preocupa no perderse vencimientos, y eso falla en varios lugares: una tarea nueva no le llega por la tarjeta (U-54), el calendario no dice si ya entregó (U-35) ni responde arriba qué vence (U-34), y la hora sale en 12 h en unas pantallas y en 24 h en otras (U-36). En Trámites ve dos caminos contradictorios para la constancia y una solicitud que promete un aviso que nunca llega (U-40, U-41). Con letra grande, Instalar pisa el nombre de su facultad (U-9).
- **docente-joven**: Diego publica rápido desde el celular, pero el armazón lo deja en la comisión equivocada: «Comisión Verano» abre la A y el selector no cambia el canal (U-1), y al 125 % «Espacio» tapa «Verano» (U-2). El hilo de una consulta queda tapado en el celular (U-21) y el espacio es casi todo estructura (U-20). Corregir le cuesta: pegar notas nunca guarda (U-3), guardar no confirma (U-4), la entrega no tiene dónde poner la nota (U-27), y una tarea con fecha pasada no se puede rechazar ni borrar (U-28, U-29). Es el único con clase el día de la demo, así que el guion de tomar lista depende de su horario (U-6). «Tu próxima clase» no lo lleva a ningún lado ni le avisa que falta el Zoom (U-16).
- **docente-medio**: Mariana ve rápido si tiene consultas, pero en Hoy cada consulta aparece dos veces con íconos cruzados (U-14), responder no le dice que falta cerrarla (U-15) y resolver no se deshace (U-49). Un directo leído desaparece (U-50). En compu, la pantalla de lista no tiene camino de vuelta (U-17) y Alumnos y clases pone primero el Zoom (U-18). Hoy aparece segundo en su menú (U-86). En Calificaciones, el pegado está bloqueado, guardar no confirma y cambiar de columna borra lo escrito (U-3, U-4, U-31). En Tareas faltan los conteos de entregas (U-59).
- **docente-mayor**: Carolina es la más afectada por lo visual y por la falta de confirmación. Al 125 %, «Espacio» tapa el selector de comisión (U-2) y la tira de Calificaciones esconde la columna activa (U-32). «Salir» es un ícono sin texto que desaparece con la barra plegada, y su nombre se corta en «Carolin…» (U-10, U-42). Las hojas no tienen Cerrar (U-11). Con letra grande, Instalar pisa su facultad y las pestañas de la materia se pegan (U-9, U-79). Guardar notas no confirma (U-4) y Enter publica avisos a medio escribir (U-13). La fecha de un examen no se puede tipear y esconde la hora (U-58). Lee textos de alumno (U-53) y letra de 10 a 11 px en las fechas de Hoy (U-76). Valora los botones con texto y la hoja de perfil del celular.

## Mejoras

95 mejoras, ordenadas por prioridad. P0: bloquea una tarea central o se ve mal en la demo. P1: fricción alta en una tarea frecuente. P2: molestia o inconsistencia. P3: pulido. «QW» marca los quick wins (40): esfuerzo S con impacto visible. «A decidir» marca las que dependen de una decisión de producto abierta: **no son decisiones**, van a `docs/product/preguntas-abiertas.md` antes de implementarse.

| Id | Prioridad | Mejora | Esfuerzo | QW | Tema |
|---|---|---|---|---|---|
| [U-1](#u-1) | P0 | Abrir la comisión elegida y hacer que el selector gobierne el canal y el compositor | M |  | Comisiones del docente |
| [U-2](#u-2) | P0 | Separar el selector de comisión de las pestañas de la materia al 125 % | S | sí | Comisiones del docente |
| [U-3](#u-3) | P0 | Arreglar el pegado de notas con más de una línea | S | sí | Calificaciones |
| [U-4](#u-4) | P0 | Confirmar el guardado de la planilla y avisar cuando la columna ya está publicada | S | sí | Calificaciones |
| [U-5](#u-5) | P0 | Sumar oferta abierta de FCE a los datos sintéticos | S | sí | Demo y datos sintéticos |
| [U-6](#u-6) | P0 | Documentar con qué persona y a qué hora se muestra tomar lista en la demo | S | sí | Demo y datos sintéticos |
| [U-7](#u-7) | P1 | Hacer que «Volver» regrese a donde estabas o al inicio del rol | S | sí | Shell: encabezado, barras, hojas y menú |
| [U-8](#u-8) | P1 | Hacer que la barra inferior no corte nombres, use 12 px y entre con letra grande | S | sí | Shell: encabezado, barras, hojas y menú |
| [U-9](#u-9) | P1 | Ordenar el encabezado del celular: marca contenida, Instalar claro y botones de 44 px | S | sí | Shell: encabezado, barras, hojas y menú |
| [U-10](#u-10) | P1 | Dar en compu un menú de cuenta con «Cerrar sesión» escrito, también con la barra plegada | M |  | Shell: encabezado, barras, hojas y menú |
| [U-11](#u-11) | P1 | Agregar un botón «Cerrar» a todas las hojas y devolver el foco al disparador | S | sí | Shell: encabezado, barras, hojas y menú |
| [U-12](#u-12) | P1 | Explicar qué es HackAI en la portada | S | sí | Ingreso |
| [U-13](#u-13) | P1 | Publicar los avisos del docente con un botón y no con Enter | S | sí | Espacio de la materia y mensajes |
| [U-14](#u-14) | P1 | No repetir en «Sin leer» la consulta que ya está en «Consultas sin resolver» y unificar íconos y títulos | S | sí | Hoy del docente y consultas |
| [U-15](#u-15) | P1 | Mostrar que la consulta está respondida y falta cerrarla, y ofrecer «Responder y marcar resuelta» | M |  | Hoy del docente y consultas |
| [U-16](#u-16) | P1 | Hacer accionable «Tu próxima clase» y avisar antes si falta el Zoom | S | sí | Hoy del docente y consultas |
| [U-17](#u-17) | P1 | Dar a la pantalla de lista un camino de vuelta en compu | S | sí | Asistencia (tomar lista, clases y Zoom) |
| [U-18](#u-18) | P1 | Poner primero la clase de hoy y los alumnos en Alumnos y clases, y el Zoom al final | S | sí | Asistencia (tomar lista, clases y Zoom) |
| [U-19](#u-19) | P1 | Decir en Inasistencias cuántas faltas quedan y cómo se cuentan | S | sí | Situación académica e inasistencias |
| [U-20](#u-20) | P1 | Compactar el espacio de la materia en el celular | M |  | Espacio de la materia y mensajes |
| [U-21](#u-21) | P1 | Abrir el hilo en modo foco en el celular para que la consulta se vea | M |  | Espacio de la materia y mensajes |
| [U-22](#u-22) | P1 | Dejar a la vista lo nuevo al abrir un canal o una novedad | M |  | Espacio de la materia y mensajes |
| [U-23](#u-23) | P1 | Abrir las secciones de Material con archivos nuevos y mostrar «Lo último» | S |  | Espacio de la materia y mensajes |
| [U-24](#u-24) | P1 | Explicar en la pestaña Tareas que las entregas de Moodle están en el aula | M |  | Tareas y entregas |
| [U-25](#u-25) | P1 | Hacer que la barra inferior no tape el botón «Entregar» ni el foco | S | sí | Tareas y entregas |
| [U-26](#u-26) | P1 | Mostrar la nota y la devolución en la tarea del alumno | M |  | Tareas y entregas |
| [U-27](#u-27) | P1 | Permitir corregir una entrega desde su página | M |  | Tareas y entregas |
| [U-28](#u-28) | P1 | Rechazar fechas límite pasadas al crear una tarea | S | sí | Tareas y entregas |
| [U-29](#u-29) | P1 | Permitir borrar una tarea sin entregas ni notas | M |  | Tareas y entregas |
| [U-30](#u-30) | P1 | Borrar una nota al vaciar su campo | M |  | Calificaciones |
| [U-31](#u-31) | P1 | Avisar las notas sin guardar antes de salir de la columna | M |  | Calificaciones |
| [U-32](#u-32) | P1 | Mostrar la columna activa en la tira de Calificaciones y el estado de cada columna | M |  | Calificaciones |
| [U-33](#u-33) | P1 | Hacer que los eventos del calendario abran su destino | M |  | Calendario |
| [U-34](#u-34) | P1 | Responder arriba del calendario qué vence esta semana y cuál es el próximo parcial | M |  | Calendario |
| [U-35](#u-35) | P1 | Llevar al calendario las tareas del docente y el estado de entrega del alumno | M |  | Calendario |
| [U-36](#u-36) | P1 | Mostrar todas las horas en formato de 24 h con una sola función | S | sí | Fechas, horas y texto chico |
| [U-37](#u-37) | P1 | Llevar a la nota tocada en Novedades y marcar como vista solo esa | M |  | Novedades |
| [U-38](#u-38) | P1 | Mostrar las notas de las materias en curso en la lista de Notas | S |  | Situación académica e inasistencias |
| [U-39](#u-39) | P1 | Elegir los textos del detalle de la materia según su estado | S | sí | Situación académica e inasistencias |
| [U-40](#u-40) | P1 | Dejar un solo camino para pedir la constancia y ponerlo primero en el celular | S | sí | Trámites |
| [U-41](#u-41) | P1 | Escribir un copy honesto para la solicitud simulada y dejar a la vista la fila nueva | S | sí | Trámites |
| [U-42](#u-42) | P2 | Oscurecer los rótulos de la barra lateral, no cortar el nombre y mostrar la facultad | S | sí | Shell: encabezado, barras, hojas y menú |
| [U-43](#u-43) | P2 | Sacar el botón Novedades de su propia pantalla, darle fondo opaco y marcar la campana activa | S | sí | Shell: encabezado, barras, hojas y menú |
| [U-44](#u-44) | P2 | Poner la lista de personas antes del QR en compu | S | sí | Ingreso |
| [U-45](#u-45) | P2 | Volver a la pantalla pedida después de ingresar | M |  | Ingreso |
| [U-46](#u-46) | P2 | Dar texto a los botones del compositor y una confirmación visible con destinatario | S |  | Espacio de la materia y mensajes |
| [U-47](#u-47) | P2 | Guardar el borrador de mensajes y tareas | S |  | Espacio de la materia y mensajes |
| [U-48](#u-48) | P2 | Hacer que Atrás cierre la vista previa de un archivo y la hoja de Notas | M |  | Espacio de la materia y mensajes |
| [U-49](#u-49) | P2 | Permitir reabrir una consulta marcada como resuelta | M |  | Hoy del docente y consultas |
| [U-50](#u-50) | P2 | Seguir los directos sin responder del docente (a decidir) | M |  | Hoy del docente y consultas |
| [U-51](#u-51) | P2 | Reacomodar el Hoy del docente para que las fechas queden a la vista y el vacío no prometa de más | M |  | Hoy del docente y consultas |
| [U-52](#u-52) | P2 | Corregir las filas de «Parciales y mesas» del docente: destino, texto y comisión | M |  | Hoy del docente y consultas |
| [U-53](#u-53) | P2 | Escribir para el docente los textos que hoy le hablan al alumno | S | sí | Hoy del docente y consultas |
| [U-54](#u-54) | P2 | Hacer tocable la próxima entrega de la tarjeta y sumar las tareas de HackAI | M |  | Tareas y entregas |
| [U-55](#u-55) | P2 | Mostrar el estado de la tarea desde el punto de vista del alumno | S |  | Tareas y entregas |
| [U-56](#u-56) | P2 | Confirmar que la tarea quedó publicada | S | sí | Tareas y entregas |
| [U-57](#u-57) | P2 | Mostrar los errores de formulario propios, en voseo y junto al campo | M |  | Tareas y entregas |
| [U-58](#u-58) | P2 | Separar fecha y hora en los formularios y usar 24 h | M |  | Tareas y entregas |
| [U-59](#u-59) | P2 | Contar las entregas por corregir en la lista de tareas del docente | M |  | Tareas y entregas |
| [U-60](#u-60) | P2 | Marcar en la fila la nota inválida y no cortar los nombres | S |  | Calificaciones |
| [U-61](#u-61) | P2 | Dar foco visible a los campos de nota y una forma de marcar ausente en el celular | S | sí | Calificaciones |
| [U-62](#u-62) | P2 | Dejar a la vista la vista previa del pegado y dar los motivos correctos | M |  | Calificaciones |
| [U-63](#u-63) | P2 | Explicar la nota de cursada sin pesos y corregir los ejemplos que parecen valores | S | sí | Calificaciones |
| [U-64](#u-64) | P2 | Mostrar la semana elegida al tocar un día del mes chico | S | sí | Calendario |
| [U-65](#u-65) | P2 | Mostrar el tipo y la materia en cada bloque del calendario | S |  | Calendario |
| [U-66](#u-66) | P2 | Hacer más claros y más grandes los filtros y controles del calendario | S |  | Calendario |
| [U-67](#u-67) | P2 | Abrir la grilla del calendario en la hora con eventos | S | sí | Calendario |
| [U-68](#u-68) | P2 | Agregar «Marcar todo como leído» y precisar el estado vacío de Novedades | M |  | Novedades |
| [U-69](#u-69) | P2 | Hacer que las filas de Novedades digan qué pasó, de qué comisión y si esperan respuesta | M |  | Novedades |
| [U-70](#u-70) | P2 | Hacer que los estados vacíos y los bloqueos de inscripción digan la verdad | S |  | Inscripciones |
| [U-71](#u-71) | P2 | Ordenar Inscripciones en el celular: detalle compacto, pestañas cortas y botón a la vista | M |  | Inscripciones |
| [U-72](#u-72) | P2 | Reunir los finales pendientes y hacer tocable el plan de estudios | S |  | Situación académica e inasistencias |
| [U-73](#u-73) | P2 | Arreglar el desborde de los filtros de Notas y no truncar los selects | S |  | Situación académica e inasistencias |
| [U-74](#u-74) | P2 | Decidir dónde ve el alumno sus faltas y alinear los docs (a decidir) | S |  | Situación académica e inasistencias |
| [U-75](#u-75) | P2 | Abrir los reportes dentro de la app y aclarar dónde se pide el firmado | M |  | Trámites |
| [U-76](#u-76) | P2 | Llevar el texto chico a 12 px como mínimo y en rem | M |  | Fechas, horas y texto chico |
| [U-77](#u-77) | P2 | Ajustar las tarjetas de Mis materias para que no tengan huecos ni datos cortados | S | sí | Mis materias |
| [U-78](#u-78) | P2 | Cerrar el hueco entre el compositor y la barra inferior | S | sí | Espacio de la materia y mensajes |
| [U-79](#u-79) | P2 | Separar las pestañas de la materia cuando la letra crece | S | sí | Espacio de la materia y mensajes |
| [U-80](#u-80) | P2 | Mostrar con honestidad una clase fuera del día en la pantalla de lista | M |  | Asistencia (tomar lista, clases y Zoom) |
| [U-81](#u-81) | P2 | Decir en «Hoy no hay clase» cuándo es la próxima | M |  | Asistencia (tomar lista, clases y Zoom) |
| [U-82](#u-82) | P2 | Darle superficie a EmptyState en compu y mantenerlo igual en todas las pantallas | S | sí | Situación académica e inasistencias |
| [U-83](#u-83) | P2 | Agregar «Saltar al contenido» y «Saltar al menú» para navegar con teclado | S | sí | Shell: encabezado, barras, hojas y menú |
| [U-84](#u-84) | P2 | Abrir las preguntas de producto sobre la asistencia visible y aclarar Inasistencias (a decidir) | S |  | Asistencia (tomar lista, clases y Zoom) |
| [U-85](#u-85) | P3 | Pulir el selector de personas y el 404 de /caidas | S | sí | Ingreso |
| [U-86](#u-86) | P3 | Poner Hoy primero en el menú del docente y hacer del logo un enlace al inicio | S | sí | Shell: encabezado, barras, hojas y menú |
| [U-87](#u-87) | P3 | Ajustar las ilustraciones del encabezado: sacar los puntos de Hoy y diferenciar las secciones del alumno | S |  | Shell: encabezado, barras, hojas y menú |
| [U-88](#u-88) | P3 | Usar el mismo encabezado de la materia en Nueva tarea, Entrega y Pegar, y marcar las comisiones archivadas | M |  | Comisiones del docente |
| [U-89](#u-89) | P3 | Dar acciones a la lista de alumnos y mostrar los correos completos | S |  | Espacio de la materia y mensajes |
| [U-90](#u-90) | P3 | Separar en Hoy las comisiones de próximos períodos y sumar su horario (a decidir) | S |  | Hoy del docente y consultas |
| [U-91](#u-91) | P3 | Pulir los mensajes y las señales después de inscribirse | S | sí | Inscripciones |
| [U-92](#u-92) | P3 | Explicar el estado de cada solicitud y volver bien desde la Autogestión | M |  | Trámites |
| [U-93](#u-93) | P3 | Darle título al 404 raíz y, con sesión, mantener el shell | S |  | Ingreso |
| [U-94](#u-94) | P3 | Pegar el estado a la fecha de cada falta y enlazar a la materia | S |  | Situación académica e inasistencias |
| [U-95](#u-95) | P3 | Agrupar la hoja «Más» con títulos | S | sí | Shell: encabezado, barras, hojas y menú |

### Temas

- **Comisiones del docente** (U-1, U-2, U-88): Entradas que abren la comisión equivocada, un selector que no gobierna el canal, un selector tapado al 125 % y subpáginas con otro encabezado.
- **Demo y datos sintéticos** (U-5, U-6): Lo que hace falta para que la demo muestre las tareas centrales: oferta FCE y tomar lista.
- **Ingreso** (U-12, U-44, U-45, U-85, U-93): La portada no dice qué es HackAI, el QR va antes que la lista al 125 %, se pierde el destino al entrar sin sesión y hay detalles del selector y de los 404.
- **Shell: encabezado, barras, hojas y menú** (U-7, U-8, U-9, U-10, U-11, U-42, U-43, U-83, U-86, U-87, U-95): Volver fijo, cuenta sin «Salir» con texto en compu, hojas sin Cerrar, Instalar sobre la facultad, etiquetas cortadas en la barra inferior, rótulos con poco contraste, Novedades duplicada, orden del menú del docente, saltos de teclado e ilustraciones.
- **Espacio de la materia y mensajes** (U-13, U-20, U-21, U-22, U-23, U-46, U-47, U-48, U-78, U-79, U-89): Densidad en el celular, hilo tapado, Enter que publica, compositor sin texto ni confirmación, borradores, lo nuevo fuera de la vista, Material plegado y lista de alumnos sin acciones.
- **Hoy del docente y consultas** (U-14, U-15, U-16, U-49, U-50, U-51, U-52, U-53, U-90): Consultas duplicadas, respondidas sin cerrar, sin reabrir, directos que se pierden, el layout con todo al día, filas de fechas, textos de alumno y la tarjeta «Tu próxima clase».
- **Asistencia (tomar lista, clases y Zoom)** (U-17, U-18, U-80, U-81, U-84): Lo nuevo de #118: volver desde la lista en compu, orden de Alumnos y clases, una clase fuera del día que parece editable, el vacío sin la próxima clase y preguntas abiertas de asistencia.
- **Tareas y entregas** (U-24, U-25, U-26, U-27, U-28, U-29, U-54, U-55, U-56, U-57, U-58, U-59): Tareas sin lo de Moodle, Entregar tapado, nota sin mostrar, corrección lejos de la entrega, fechas pasadas, sin borrado ni confirmación, errores lejos del campo, fecha y hora difíciles y conteos ausentes.
- **Calificaciones** (U-3, U-4, U-30, U-31, U-32, U-60, U-61, U-62, U-63): Pegado bloqueado, guardar sin confirmación, vaciar o cambiar de columna pierde datos, errores sin marcar la fila, la tira esconde la columna activa y la nota de cursada sin pesos no se explica.
- **Calendario** (U-33, U-34, U-35, U-64, U-65, U-66, U-67): Eventos que no se abren, lo próximo lejos, faltan las tareas del docente y el estado de entrega, el mes chico mueve la semana sin mostrarla, bloques sin tipo, filtros chicos y grilla que arranca a las 8.
- **Fechas, horas y texto chico** (U-36, U-76): Dos funciones dueTime con 12 h y 24 h, y textos de 10 a 11 px en contadores, chips, fechas y la barra inferior.
- **Novedades** (U-37, U-68, U-69): Las notas nuevas se marcan todas juntas y no abren su materia, no hay «Marcar todo como leído» y las filas no dicen comisión ni si esperan respuesta.
- **Inscripciones** (U-70, U-71, U-91): Estados vacíos que contradicen, detalle largo en el celular con el botón tapado y detalles de texto después de inscribirse.
- **Situación académica e inasistencias** (U-19, U-38, U-39, U-72, U-73, U-74, U-82, U-94): Faltas sin el «te quedan», notas en curso escondidas, textos que contradicen el estado, finales pendientes dispersos, filtros que desbordan, acceso a Inasistencias, vacíos sin superficie y faltas sin estado junto a la fecha.
- **Trámites** (U-40, U-41, U-75, U-92): Dos caminos para la constancia, una solicitud simulada que promete avisos, reportes que bajan como .html y estados sin explicación.
- **Mis materias** (U-77): Tarjetas de alto fijo con huecos, detalle cortado y comisiones con el mismo título.

### Detalle

#### U-1

**Abrir la comisión elegida y hacer que el selector gobierne el canal y el compositor** · P0 · esfuerzo M

- Perfiles: docente-joven, docente-medio, docente-mayor. Vistas: todas.
- Pantallas: `/hoy`, `/materias`, `/materias/[subjectId]`, `/materias/[subjectId]/alumnos`, `/materias/[subjectId]/tareas`, `/materias/[subjectId]/calificaciones`.
- Problema: En Hoy («Tus comisiones») y en Mis materias, las tarjetas de la Comisión A y de la Comisión Verano de una misma materia apuntan al mismo /materias/<id> sin ?comision: teaching-screen.tsx:154 y subject-grid.tsx:90 usan spaceHref(subjectId), y SpaceQuery no tiene el campo comision. Al tocar Verano se abre la A: el selector marca «A», el canal es «Avisos · A» y el compositor dice «Aviso para la Comisión A». Aun con ?comision=…-v, el selector marca Verano pero el canal y el compositor siguen en A, y al abrir «Avisos · Verano» el selector vuelve a A, porque los enlaces de canal no llevan ?comision. Con dos comisiones, las pestañas de canal llevan sufijo y se cortan («Consulta…», «Avisos · …», y con letra grande «Aviso…», «Cons…»). La docente puede publicar un aviso, ver la lista o cargar notas en la comisión equivocada. Se reprodujo con docente-joven (PR1) y docente-mayor (AM1), en el celular y en compu.
- Recomendación: 1) Sumar `comision?: string` a SpaceQuery (components/spaces/format.ts) y armar con la comisión de cada fila los enlaces de SectionRow (teaching-screen.tsx) y de la tarjeta activa de subject-grid.tsx, incluidos los de Tareas y Calificaciones. 2) En materias/[subjectId]/page.tsx, si llega ?comision sin ?canal, abrir los Avisos de esa comisión. Filtrar el riel de canales por la comisión elegida, llevar ?comision en los enlaces de canal y, al abrir un canal, poner el selector en su comisión. 3) Con el riel filtrado, sacar el sufijo «· A»/«· Verano» de las pestañas de canal para que entren enteras. 4) Hacer que los enlaces de consultas y de «Sin leer» de Hoy también lleven la comisión. 5) Anotar en docs/product/preguntas-abiertas.md que el selector filtra el riel.
- Criterios de aceptación:
  - En /hoy y en /materias, las dos filas de una materia con dos comisiones tienen href distintos, con ?comision=<sectionId>
  - Al tocar «Comisión Verano», el selector marca Verano, el canal activo es «Avisos · Verano» y el compositor dice «Aviso para la Comisión Verano», en el celular y en compu
  - Al abrir un canal de Verano desde el riel, el selector queda en Verano
  - Al pasar a «Alumnos y clases», Tareas o Calificaciones, la URL conserva ?comision
  - Abrir /materias/<id> sin parámetros sigue abriendo la primera comisión
  - A 390 px y con letra del sistema de 20 px, ninguna pestaña de canal termina en «…»
  - Hay un test de format.ts que cubre spaceHref con comision
- Archivos: `hackai/components/today/teaching-screen.tsx`, `hackai/components/subjects/subject-grid.tsx`, `hackai/components/spaces/format.ts`, `hackai/components/subjects/subject-nav.ts`, `hackai/app/(app)/materias/[subjectId]/page.tsx`, `hackai/components/spaces/channel-tabs.tsx`, `hackai/components/spaces/more-channels.tsx`, `hackai/components/subjects/subject-toolbar.tsx`, `hackai/components/subjects/section-picker.tsx`, `hackai/lib/core/today/index.ts`, `docs/product/preguntas-abiertas.md`.
- Origen: M-15, M-16, N-1 (M: primera corrida; N: corrida sobre `main` nuevo).

#### U-2

**Separar el selector de comisión de las pestañas de la materia al 125 %** · P0 · esfuerzo S · quick win

- Perfiles: docente-joven, docente-mayor, docente-medio. Vistas: desktop-zoom.
- Pantallas: `/materias/[subjectId]`, `/materias/[subjectId]/alumnos`, `/materias/[subjectId]/tareas`, `/materias/[subjectId]/calificaciones`.
- Problema: A 1152 px útiles (navegador al 125 %), con la barra lateral desplegada, la píldora «Verano» (x 391–473) queda 35 px debajo de la pestaña «Espacio» (x 438–560). Con «A» elegida se lee «Verar», y un clic en el borde derecho de «Verano» cae en Espacio. Pasa en Espacio, Alumnos y clases, Tareas y Calificaciones. La causa es la grilla lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] de subject-toolbar.tsx, con la columna central fija en lg:w-[30rem]. La barra lateral más angosta de #121 no alcanzó. Para la docente de 64 años es la única forma de cambiar de comisión en compu. El choque de «Calificaciones» con el botón Novedades ya quedó resuelto.
- Recomendación: En subject-toolbar.tsx, pasar el layout de tres columnas a xl. Por debajo, poner el selector en su propia fila, arriba de las pestañas y con la etiqueta «Comisión». Otra opción es sacar el ancho fijo lg:w-[30rem] y usar flex-wrap. Sumar min-w-0 y flex-none donde haga falta, y píldoras de 44 px o más.
- Criterios de aceptación:
  - A 1152 px con la barra lateral abierta, el selector y las pestañas no se superponen y «Verano» se lee completo
  - Ningún clic sobre la píldora «Verano» cae en «Espacio»
  - A 1440 px el diseño de tres columnas no cambia
  - En el celular el selector sigue en su fila, debajo de las pestañas
- Archivos: `hackai/components/subjects/subject-toolbar.tsx`, `hackai/components/subjects/section-picker.tsx`, `hackai/components/subjects/subject-tabs.tsx`.
- Origen: M-17, N-5 (M: primera corrida; N: corrida sobre `main` nuevo).

#### U-3

**Arreglar el pegado de notas con más de una línea** · P0 · esfuerzo S · quick win

- Perfiles: docente-joven, docente-medio, docente-mayor. Vistas: todas.
- Pantallas: `/materias/[subjectId]/calificaciones/pegar`.
- Problema: Con cualquier texto de dos líneas o más (lo que siempre se copia de una planilla), la vista previa sale bien («2 notas»), pero junto a ella aparece «Cambiaste el texto o la escala: volvé a ver la vista previa antes de guardar» y «Guardar 2 notas» queda deshabilitado. Pedir de nuevo la vista previa no lo arregla. La causa está en paste-grades.tsx:119, `stale = shown.text !== text`: previewPastedGrades devuelve el texto con CRLF y el textarea tiene LF. Se reprodujo en main, en compu y en el celular. No se puede guardar ninguna planilla.
- Recomendación: Normalizar a LF en previewPastedGrades (`pasted.replace(/\r\n?/g, '\n')`), devolver ese texto y comparar también normalizado en el cliente. Sumar un test de la acción con varias líneas en CRLF y en LF.
- Criterios de aceptación:
  - Pegar 3 líneas válidas y pedir la vista previa deja «Guardar 3 notas» habilitado, sin el aviso de texto cambiado
  - Guardar redirige con «Guardamos 3 notas de la planilla», en compu y en el celular
  - Hay un test con texto en CRLF y en LF
- Archivos: `hackai/components/coursework/paste-grades.tsx`, `hackai/app/actions/coursework.ts`.
- Origen: M-45 (M: primera corrida; N: corrida sobre `main` nuevo).

#### U-4

**Confirmar el guardado de la planilla y avisar cuando la columna ya está publicada** · P0 · esfuerzo S · quick win

- Perfiles: docente-joven, docente-medio, docente-mayor. Vistas: todas.
- Pantallas: `/materias/[subjectId]/calificaciones`.
- Problema: Después de «Guardar notas» no aparece ninguna confirmación: solo cambia el contador («2 de 3 con nota · 2 sin publicar»). La key del ActionForm (`${columnId}-${page.page}-${saved}`, grade-sheet.tsx:137) remonta el formulario y se pierde «Guardamos N notas». Los mensajes viejos («No había cambios para guardar», «Publicamos 3 notas…») quedan en pantalla después de nuevos cambios. En una columna publicada, guardar publica la corrección y la pasa al SIU sin avisar: el botón sigue diciendo «Guardar notas». La pantalla Pegar sí lo avisa. Para la docente mayor, no ver que algo quedó guardado es lo más grave.
- Recomendación: Sacar las notas de la key del ActionForm (dejarla en un hijo que rearme los inputs) o redirigir con ?guardadas=N. Mostrar un aviso verde «Guardamos N notas» junto al botón, que se borre con el primer cambio. En una columna publicada, mostrar el mismo aviso que en Pegar y rotular el botón «Guardar y publicar». Eso sigue la hipótesis de la pregunta abierta #28, que mientras tanto no se cambia.
- Criterios de aceptación:
  - Después de guardar se lee «Guardamos N notas» sin recargar, en compu y en el celular
  - Al escribir de nuevo, el mensaje anterior desaparece
  - En una columna publicada, la planilla avisa antes de guardar que los alumnos van a ver el cambio y que pasa al SIU, y el botón dice «Guardar y publicar»
- Archivos: `hackai/components/coursework/grade-sheet.tsx`, `hackai/components/spaces/action-form.tsx`, `hackai/components/coursework/gradebook.tsx`, `hackai/app/actions/coursework.ts`, `hackai/app/(app)/materias/[subjectId]/calificaciones/page.tsx`, `hackai/lib/core/coursework/gradebook.ts`.
- Origen: M-46 (M: primera corrida; N: corrida sobre `main` nuevo).

#### U-5

**Sumar oferta abierta de FCE a los datos sintéticos** · P0 · esfuerzo S · quick win

- Perfiles: alumno-fce. Vistas: todas.
- Pantallas: `/inscripciones`.
- Problema: Para p-nherrera (FCE), /inscripciones muestra Todas 0, Materias 0, Optativas 0 y Vida univ. 0, con «No hay inscripciones abiertas»: la única comisión FCE de verano es la que ya cursa, mientras Ingeniería tiene unas diez. La tarea central del módulo no se puede hacer, y un jurado de FCE ve el módulo vacío. synthetic-data.ts no cambió desde la auditoría.
- Recomendación: En synthetic-data.ts, sumar comisiones FCE abiertas en verano-2027: una obligatoria disponible, una con el cupo lleno y una optativa, más una actividad de vida universitaria para FCE o sin schoolId. Regenerar el seed de hackai/supabase/simulados/ desde la misma fuente. Agregar un test que verifique que cada facultad tiene al menos una comisión abierta.
- Criterios de aceptación:
  - p-nherrera ve al menos una materia con inscripción abierta y se puede inscribir, en el celular y en compu
  - Hay un caso de cupo lleno para FCE
  - El seed simulado está regenerado y el test de synthetic-data pasa
- Archivos: `hackai/lib/adapters/synthetic-data.ts`, `hackai/supabase/simulados/`, `hackai/tests/synthetic-data.test.ts`.
- Origen: M-65 (M: primera corrida; N: corrida sobre `main` nuevo).

#### U-6

**Documentar con qué persona y a qué hora se muestra tomar lista en la demo** · P0 · esfuerzo S · quick win

- Perfiles: docente-joven, docente-medio, docente-mayor. Vistas: todas.
- Pantallas: `/hoy`, `/materias/[subjectId]/alumnos/lista`.
- Problema: Ningún recorrido pudo ver el formulario editable de lista, el guardado ni el pase al SIU. Con el reloj fijo (martes 10/11, 12:00) ninguna docente tiene clase. Con HACKAI_CLOCK=sistema el viernes 13/11, día de la demo, p-mledesma (lunes y miércoles) y p-cbustos (lunes y jueves) tampoco tienen. La única con clase es p-darrieta: Programación I, Comisión A, viernes de 09:00 a 12:00, híbrida (synthetic-data.ts:421-430). Si el pitch cae fuera de esa franja o se usa otra persona, «Tu clase de ahora» y Tomar lista no aparecen.
- Recomendación: En hackai/README.md, en «Datos y fecha de la demo», anotar que tomar lista se muestra con p-darrieta el viernes de 09:00 a 12:00, y cómo probarlo con reloj fijo (qué valor de HACKAI_CLOCK o qué fecha usar). Si la demo es fuera de esa franja, decidir con el equipo si se suma un horario de viernes a otra comisión, actualizando tests/synthetic-data.test.ts.
- Criterios de aceptación:
  - El README dice qué persona y qué franja horaria muestran Tomar lista en la demo
  - Siguiendo el README, otra persona del equipo llega al formulario editable y guarda una lista
  - Si se cambia el seed, los tests de synthetic-data siguen en verde
- Archivos: `hackai/README.md`, `hackai/lib/adapters/synthetic-data.ts`, `hackai/tests/synthetic-data.test.ts`.
- Origen: N-15 (M: primera corrida; N: corrida sobre `main` nuevo).

#### U-7

**Hacer que «Volver» regrese a donde estabas o al inicio del rol** · P1 · esfuerzo S · quick win

- Perfiles: alumno-fi, alumno-fce, docente-joven, docente-medio, docente-mayor. Vistas: mobile, mobile-texto-grande.
- Pantallas: `/novedades`, `/materias/[subjectId]`, `/materias/[subjectId]/tareas`, `/materias/[subjectId]/alumnos`, `/materias/[subjectId]/calificaciones`.
- Problema: La flecha «Volver» de Novedades y la del espacio de la materia tienen backHref='/materias' fijo (novedades/page.tsx:46, materias/[subjectId]/page.tsx:160 y :456), igual que Tareas (tareas/page.tsx:70), Alumnos y clases (alumnos/page.tsx:65 y :214) y Calificaciones (calificaciones/page.tsx:84). Docente: /hoy, campana, Volver termina en /materias. Alumno: Novedades, aviso, Volver termina en /materias, no en Novedades. Para el docente, cuyo inicio es Hoy, siempre termina en otra sección. En la app instalada no hay atrás del navegador, así que la flecha es la única salida. Lo vieron los cinco perfiles. Solo las subpáginas de tarea y de lista ya calculan su propio back.
- Recomendación: Pasar el origen como parámetro validado. La campana suma ?desde=<ruta actual>, y las filas de Novedades y de Hoy suman ?desde=novedades o ?desde=hoy (agregar `desde` a SpaceQuery). Novedades, el espacio y sus pestañas usan ese valor como backHref, y como texto del BackLink («Volver a Novedades»), solo si es una ruta interna permitida. Si falta, usar homeFor(session.role) de lib/home.ts: /hoy para el docente y /materias para el alumno. No usar router.back() solo, porque la entrada directa no tiene historial.
- Criterios de aceptación:
  - Celular, docente: /hoy, campana, Volver lleva a /hoy
  - Celular, alumno: /calendario, campana, Volver lleva a /calendario
  - Desde /novedades, abrir un aviso y tocar Volver lleva a /novedades
  - Desde /hoy, abrir una consulta y tocar Volver lleva a /hoy
  - Abrir /novedades por URL directa: Volver lleva al inicio del rol
  - Un ?desde= con una URL externa o una ruta inexistente se ignora
- Archivos: `hackai/app/(app)/novedades/page.tsx`, `hackai/app/(app)/materias/[subjectId]/page.tsx`, `hackai/app/(app)/materias/[subjectId]/tareas/page.tsx`, `hackai/app/(app)/materias/[subjectId]/alumnos/page.tsx`, `hackai/app/(app)/materias/[subjectId]/calificaciones/page.tsx`, `hackai/components/shell/notifications-bell.tsx`, `hackai/components/shell/page-header.tsx`, `hackai/components/news/format.ts`, `hackai/components/spaces/format.ts`, `hackai/components/today/teaching-screen.tsx`, `hackai/lib/home.ts`.
- Origen: M-6, N-2 (M: primera corrida; N: corrida sobre `main` nuevo).

#### U-8

**Hacer que la barra inferior no corte nombres, use 12 px y entre con letra grande** · P1 · esfuerzo S · quick win

- Perfiles: alumno-fi, alumno-fce, docente-medio. Vistas: mobile, mobile-texto-grande.
- Pantallas: `Barra inferior de todas las pantallas`.
- Problema: La barra inferior de #121 (Calendario, Notas, Materias, Inscripciones, Más) muestra «Inscripcio…» a 390 px en todas las pantallas, incluso cuando es la sección elegida. Con letra grande también se cortan «Calend…» e «Inscripc…». Las etiquetas son de 11 px (10 px debajo de 390) y usan max-w-full truncate en Cell de tab-bar.tsx. Con letra grande en /notas, las 5 celdas suman 417 px sobre 390 y «Más» queda a medias fuera de la pantalla. A la docente de 47 años también le pesan los 11 px.
- Recomendación: Agregar a Tab un `short` opcional para la barra (por ejemplo «Anotarme»), sin cambiar el nombre de la sección. Subir las etiquetas a 12 px (0.75rem). En lugar de truncate, permitir dos líneas con leading ajustado cuando la letra crece. Hacer que las celdas se repartan el ancho disponible (min-w-0, flex-1) para que la barra nunca supere el viewport.
- Criterios de aceptación:
  - A 390×844, ninguna etiqueta de la barra inferior termina en «…», ni la del alumno ni la del docente
  - Con letra del sistema de 20 px, las cinco celdas entran en 390 px y «Calendario» e «Inscripciones» (o su versión corta) se leen completas, en dos líneas si hace falta
  - El auditor no lista etiquetas de la barra en textoMenorA12px
  - La barra lateral de compu y el título de la pantalla siguen diciendo «Inscripciones»
- Archivos: `hackai/components/shell/tab-bar.tsx`, `hackai/components/shell/app-nav.tsx`.
- Origen: M-9, N-4 (M: primera corrida; N: corrida sobre `main` nuevo).

#### U-9

**Ordenar el encabezado del celular: marca contenida, Instalar claro y botones de 44 px** · P1 · esfuerzo S · quick win

- Perfiles: alumno-fi, alumno-fce, docente-joven, docente-medio, docente-mayor. Vistas: mobile, mobile-texto-grande.
- Pantallas: `Encabezado de todas las pantallas con marca (/materias, /hoy, /calendario, /novedades, /notas, /tramites, /inasistencias)`.
- Problema: Con la letra del sistema a 20 px, el ícono de Instalar queda dibujado encima del nombre de la facultad («Facultad de Ingeniería» en /notas con alumno-fi, «Facultad de Ciencias Empresariales» en /materias con alumno-fce, y con docente-mayor en /hoy y /materias/am1), porque Brand es inline-flex sin min-w-0. Debajo de 400 px, Instalar es solo un ícono Download de 36×32: el mismo de «Descargar» en Trámites, que se lee como «bajar un archivo». El auditor marca tres objetivos de menos de 44 px: Instalar (36×32), Novedades (40×40) y Perfil (40×40). La campana y el avatar no tienen texto, y la docente mayor no toca lo que no entiende.
- Recomendación: 1) Agregar min-w-0 al contenedor de Brand y line-clamp-2 al nombre de la facultad, y dejar las acciones en flex-none. Si no entra, ocultar el nombre, pero nunca superponerlo. 2) Cambiar el ícono de Instalar por uno distinto de Download (Smartphone o SquarePlus). Con poco ancho o letra grande, pasarlo a la hoja del perfil como «Instalar la app» con texto. 3) Llevar Instalar, la campana y el avatar a 44×44 como mínimo (min-h-11 min-w-11).
- Criterios de aceptación:
  - A 390×844 con letra del sistema de 20 px, ningún botón del encabezado se superpone con el nombre de la facultad, ni en FCE ni en FI
  - El auditor da objetivosMenoresA44 = 0 en el encabezado de /hoy y de /materias en el celular
  - El ícono de Instalar ya no es el mismo que el de Descargar en /tramites
  - A 400 px o más, Instalar sigue mostrando su texto
  - En compu el encabezado no cambia
- Archivos: `hackai/components/shell/brand.tsx`, `hackai/components/shell/page-header.tsx`, `hackai/components/shell/shell-context.tsx`, `hackai/components/shell/install-button.tsx`, `hackai/components/shell/notifications-bell.tsx`, `hackai/components/shell/avatar.tsx`, `hackai/components/session/profile-menu.tsx`.
- Origen: M-8, N-3 (M: primera corrida; N: corrida sobre `main` nuevo).

#### U-10

**Dar en compu un menú de cuenta con «Cerrar sesión» escrito, también con la barra plegada** · P1 · esfuerzo M

- Perfiles: docente-mayor, docente-medio, docente-joven, alumno-fce, alumno-fi. Vistas: desktop, desktop-zoom.
- Pantallas: `Barra lateral, pie «Cuenta» (todas las pantallas de compu)`, `Ingreso (/)`.
- Problema: En compu no hay menú de perfil. El pie de la barra lateral muestra el avatar, el nombre cortado («Carolin…», peor con la barra más angosta de #121), el rol y un ícono rojo de 47×47 sin texto: «Salir» está solo en el aria-label y el title. El avatar y el nombre no se pueden tocar. Con la barra plegada, el form de Salir se oculta (app-nav.tsx:118, group-data-[sidebar=plegada]/nav:hidden) y queda un avatar que no hace nada. Como el plegado se guarda en una cookie, quien la deja plegada nunca ve Salir. Además, salir lleva directo a «¿Quién sos?» sin avisar que la sesión se cerró, y un clic de más deja a la docente mayor afuera sin saber por qué.
- Recomendación: Convertir el bloque del avatar y el nombre en el disparador de un menú con el nombre completo, el rol o la carrera, la facultad y un botón «Cerrar sesión» con texto e ícono. Con la barra plegada, el avatar abre el mismo menú. ProfileMenu es la hoja del celular (lg:hidden en HeaderSessionActions): armar una variante para la barra lateral que reuse SignOutButton de components/session, en lugar del SignOutButton local de app-nav.tsx. Hacer que signOut redirija a /?salida=1 y que el ingreso muestre «Cerraste sesión».
- Criterios de aceptación:
  - A 1440 px y al 125 %, con la barra desplegada o plegada, «Cerrar sesión» se alcanza en 2 clics y tiene texto visible
  - Con la barra plegada, el avatar es un botón con nombre accesible («Tu perfil: <nombre>») que abre el menú
  - El menú se abre y se cierra con teclado (Enter, Escape) y devuelve el foco al avatar
  - Después de salir, el ingreso muestra «Cerraste sesión», en compu y en el celular
- Archivos: `hackai/components/shell/app-nav.tsx`, `hackai/components/session/profile-menu.tsx`, `hackai/components/session/sign-out-button.tsx`, `hackai/components/shell/shell-context.tsx`, `hackai/components/shell/avatar.tsx`, `hackai/app/actions/session.ts`, `hackai/app/page.tsx`.
- Origen: M-5, N-6, N-30 (M: primera corrida; N: corrida sobre `main` nuevo).

#### U-11

**Agregar un botón «Cerrar» a todas las hojas y devolver el foco al disparador** · P1 · esfuerzo S · quick win

- Perfiles: alumno-fi, alumno-fce, docente-mayor, docente-medio. Vistas: mobile, mobile-texto-grande, desktop.
- Pantallas: `Hoja «Más» (celular)`, `Hoja del perfil (celular)`, `/notas?materia=<id>`, `/materias/[subjectId] (Más canales)`, `/tramites (Nueva solicitud)`.
- Problema: Las hojas «Más secciones», Perfil, «Más canales», el detalle de una materia en Notas y «Nueva solicitud» (panel derecho en compu) muestran una manija decorativa (span aria-hidden) y no tienen X ni «Cerrar». Se cierran solo con Escape, que no existe en el celular, o tocando el fondo. Al cerrar con Escape, el foco queda en body: no vuelve a la tarjeta de Notas ni al botón «Más», que no es un SheetTrigger. En la hoja del perfil, el único botón visible, y el que recibe el foco, es «Salir», justo el que no se quiere tocar por error. sheet.tsx no cambió. SheetClose solo se usa en install-button.tsx, requests.tsx y siu-requests.tsx.
- Recomendación: Hacer que SheetContent dibuje por defecto un Dialog.Close de 44×44 con aria-label «Cerrar» (o «Cerrar» con texto) junto al título, en las hojas de abajo y del costado, con una prop para omitirlo. Sacar los SheetClose propios de install-button.tsx, requests.tsx y siu-requests.tsx si quedan duplicados. Usar SheetTrigger asChild en el botón «Más» de tab-bar.tsx, y en GradesBoard devolver el foco a la tarjeta con onCloseAutoFocus y una ref. En ProfileMenu, dar el foco inicial a «Cerrar» y no a «Salir».
- Criterios de aceptación:
  - Cada hoja tiene un botón de cierre visible de 44 px o más, en el celular y en compu
  - Ninguna hoja queda con dos botones de cierre
  - Al cerrar con Escape o con el botón, el foco vuelve al disparador (botón «Más», tarjeta de Notas, avatar)
  - Al abrir la hoja del perfil, el foco no queda en «Salir»
- Archivos: `hackai/components/ui/sheet.tsx`, `hackai/components/grades/grades-board.tsx`, `hackai/components/shell/tab-bar.tsx`, `hackai/components/session/profile-menu.tsx`, `hackai/components/spaces/more-channels.tsx`, `hackai/components/procedures/requests.tsx`, `hackai/components/procedures/siu-requests.tsx`, `hackai/components/shell/install-button.tsx`.
- Origen: M-7, N-30, N-35 (M: primera corrida; N: corrida sobre `main` nuevo).

#### U-12

**Explicar qué es HackAI en la portada** · P1 · esfuerzo S · quick win

- Perfiles: docente-mayor, alumno-fi, alumno-fce, docente-joven, docente-medio. Vistas: todas.
- Pantallas: `/`.
- Problema: La portada solo dice «¿Quién sos?», «Elegí una persona para entrar. No hace falta clave.», «Demo con datos inventados», con el logo de la Austral y la lista. La palabra HackAI aparece solo en el <title> («Ingresar · Campus HackAI») y nada dice que la app une el SIU y el Campus. Es lo primero que ven el jurado y una docente que llega sin contexto. #121 no tocó esta pantalla.
- Recomendación: En el PageHeader de app/page.tsx, mostrar «HackAI» y una línea de propuesta (por ejemplo «Tus materias, notas, inscripciones y avisos del SIU y del Campus en un solo lugar»). Aclarar que se entra eligiendo un alumno o una docente inventados, sin clave. Mantener la etiqueta «Demo con datos inventados».
- Criterios de aceptación:
  - La palabra HackAI y la propuesta se ven sin scroll en 390×844 y en 1440×900
  - El texto explica que hay que elegir a una persona inventada
  - La etiqueta de demo sigue visible y sigue habiendo un solo h1
- Archivos: `hackai/app/page.tsx`, `hackai/components/shell/page-header.tsx`.
- Origen: M-1 (M: primera corrida; N: corrida sobre `main` nuevo).

#### U-13

**Publicar los avisos del docente con un botón y no con Enter** · P1 · esfuerzo S · quick win

- Perfiles: docente-joven, docente-medio, docente-mayor. Vistas: desktop, desktop-zoom.
- Pantallas: `/materias/[subjectId]?canal=<avisos>`.
- Problema: En compu, Enter publica el aviso al instante para toda la comisión, sin ninguna pista: «Estimados alumnos:» se publicó a medio escribir con «Mensaje enviado.». El botón es solo un avión de papel (nombre accesible «Enviar»), no «Publicar aviso». No hay editar, borrar ni deshacer: el aviso solo ofrece «Responder». composer-keys.ts hace que Enter envíe con puntero fino sin mirar el tipo de canal. Es justo el miedo a equivocarse de las docentes de 47 y 64 años.
- Recomendación: Pasarle el tipo de canal a sendsOnKey. En Avisos, Enter agrega un renglón, y se publica con el botón «Publicar aviso» o con Ctrl/⌘+Enter, con la ayuda visible «Ctrl+Enter publica · les llega a la Comisión A». Consultas y Directos mantienen el comportamiento de chat. Editar, borrar o deshacer van a preguntas-abiertas.md, porque tocan la sincronización con Discord (ADR 0005).
- Criterios de aceptación:
  - En Avisos, Enter no envía en compu
  - El botón dice «Publicar aviso» con texto
  - Consultas y Directos siguen enviando con Enter en compu
  - La pregunta sobre editar y borrar avisos está en preguntas-abiertas.md, marcada como abierta
- Archivos: `hackai/components/spaces/composer-keys.ts`, `hackai/components/spaces/composer.tsx`, `hackai/components/spaces/channel-panels.tsx`, `docs/product/preguntas-abiertas.md`.
- Origen: M-20 (M: primera corrida; N: corrida sobre `main` nuevo).

#### U-14

**No repetir en «Sin leer» la consulta que ya está en «Consultas sin resolver» y unificar íconos y títulos** · P1 · esfuerzo S · quick win

- Perfiles: docente-medio, docente-mayor. Vistas: desktop, desktop-zoom, mobile.
- Pantallas: `/hoy`.
- Problema: Una sola consulta nueva aparece en Hoy dos veces: en «Consultas sin resolver» y en «Sin leer» como «Consultas · Análisis Matemático I», con el megáfono de Avisos. Además suma 1 en Novedades y 1 en la fila de la comisión, así que la docente cuenta dos pendientes. El directo usa las burbujas de Consultas y se titula «Mensaje directo · Análisis Matemático I», sin el nombre del alumno. En teaching-screen.tsx, `item.kind === 'directo' ? MessagesSquare : Megaphone` y el título `${label} · ${materia}` siguen igual. La hora es «recién» en Hoy y «mar 10/11 12:00» en Novedades y el hilo. Hoy dice «Sin respuestas» y el hilo «Sin respuesta». openQuestions y unreadFor son lecturas independientes y nadie deduplica.
- Recomendación: En el módulo today, al armar TeachingView, quitar de `unread` los canales de consultas cuyos mensajes ya están en `questions`, y no mostrar «Sin leer» si queda vacía. En UnreadRow, elegir el ícono con ChannelIcon según el tipo de canal (avisos, consultas, material, directos) y titular el directo con el nombre del alumno. Unificar «Sin respuesta» y el formato de hora con Novedades.
- Criterios de aceptación:
  - Con una consulta nueva sin leer, aparece una sola vez en /hoy, en «Consultas sin resolver»
  - Un aviso o un material sin leer sigue apareciendo en «Sin leer»
  - Cada tipo usa el mismo ícono que en Novedades y en las pestañas del espacio
  - El directo nombra al alumno
  - Hay un test del módulo today para una consulta sin leer que no aparece duplicada
- Archivos: `hackai/lib/core/today/index.ts`, `hackai/components/today/teaching-screen.tsx`, `hackai/lib/core/spaces/unread.ts`, `hackai/components/spaces/channel-icon.tsx`, `hackai/components/news/format.ts`.
- Origen: M-28, N-7 (M: primera corrida; N: corrida sobre `main` nuevo).

#### U-15

**Mostrar que la consulta está respondida y falta cerrarla, y ofrecer «Responder y marcar resuelta»** · P1 · esfuerzo M

- Perfiles: docente-medio, docente-mayor, docente-joven. Vistas: desktop, desktop-zoom, mobile.
- Pantallas: `/hoy`, `/materias/[subjectId]?canal=<consultas>&hilo=<id>`.
- Problema: Después de responder, la consulta sigue en «Consultas sin resolver» con «1 respuesta». Nada dice que la respuesta es de la docente ni que falta tocar «Marcar resuelta»: el aviso aparece solo en el estado vacío. El estado cambia de nombre según dónde se mire: «Sin respuestas» en Hoy, «Sin respuesta» y después «Abierta» en el hilo. Que el docente la cierre a mano es a propósito (alcance.md), pero para una docente que necesita saber que lo que hizo quedó listo, responder alcanza. En el recorrido de docente-medio fueron 6 clics por consulta. «Resuelta» va en 11 px.
- Recomendación: Unificar el vocabulario en Hoy y en el hilo: «Sin responder», «Respondida, falta cerrarla» y «Resuelta». Sumar a OpenQuestion un campo que diga si la última respuesta es de un docente, y en ese caso mostrar en la fila de Hoy «Respondiste · falta marcarla resuelta». En el hilo con canResolve, sumar junto a Enviar «Responder y marcar resuelta». Pedir confirmación solo si se resuelve una consulta con 0 respuestas. Subir la etiqueta «Resuelta» a 12 px.
- Criterios de aceptación:
  - Una consulta sin respuestas se rotula igual en Hoy y en el hilo
  - Después de que el docente responde, la fila de Hoy dice que respondió y que falta marcarla resuelta
  - «Responder y marcar resuelta» envía la respuesta y saca la consulta de Hoy
  - Resolver una consulta sin respuestas pide confirmación
  - Hay tests del módulo spaces o today para el nuevo campo
- Archivos: `hackai/components/today/teaching-screen.tsx`, `hackai/components/spaces/channel-panels.tsx`, `hackai/components/spaces/composer.tsx`, `hackai/lib/core/spaces/questions.ts`, `hackai/lib/core/spaces/index.ts`, `hackai/app/actions/spaces.ts`.
- Origen: M-27, N-8 (M: primera corrida; N: corrida sobre `main` nuevo).

#### U-16

**Hacer accionable «Tu próxima clase» y avisar antes si falta el Zoom** · P1 · esfuerzo S · quick win

- Perfiles: docente-joven, docente-medio, docente-mayor. Vistas: mobile, desktop, desktop-zoom, mobile-texto-grande.
- Pantallas: `/hoy`.
- Problema: La tarjeta más destacada de Hoy (#118) no es un enlace y, cuando la clase no es hoy, no tiene acciones: no figura entre los interactivos. Tampoco dice cuándo se va a poder tomar lista. Para la clase híbrida de Diego del viernes no avisaba que faltaba el enlace de Zoom, porque el aviso y el botón dependen de isToday: lo descubrió entrando a mano a Alumnos y clases. Después de cargarlo, la tarjeta no confirma nada. En compu ocupa unos 1144 px de ancho con el contenido en unos 330.
- Recomendación: En NowClassCard, cuando !isToday: agregar un botón de contorno «Ver alumnos y clases» que lleve a subjectTabHref(c.subjectId, ALUMNOS_TAB, c.sectionId), y una línea «Vas a poder tomar lista el <día>». Si la clase es virtual o híbrida y no tiene zoomUrl, mostrar el aviso de enlace faltante aunque no sea hoy. Opcional: «Zoom cargado» cuando lo tiene. «Tomar lista» y «Entrar a Zoom» siguen solo el día de la clase (pregunta abierta #30). Limitar el ancho de la tarjeta en compu.
- Criterios de aceptación:
  - En /hoy, un día sin clase, la tarjeta tiene un enlace que abre Alumnos y clases de esa comisión
  - La tarjeta dice qué día se habilita tomar lista
  - Con la clase híbrida del viernes sin Zoom, el aviso de enlace faltante aparece desde antes del viernes
  - Tomar lista sigue apareciendo solo el día de la clase
  - A 1440 px la tarjeta no ocupa todo el ancho
- Archivos: `hackai/components/today/now-class.tsx`, `hackai/components/today/teaching-screen.tsx`.
- Origen: N-10 (M: primera corrida; N: corrida sobre `main` nuevo).

#### U-17

**Dar a la pantalla de lista un camino de vuelta en compu** · P1 · esfuerzo S · quick win

- Perfiles: docente-medio, docente-mayor. Vistas: desktop, desktop-zoom.
- Pantallas: `/materias/[subjectId]/alumnos/lista`.
- Problema: En compu, la pantalla de tomar lista (#118) oculta la flecha (hideBackOnDesktop) y no tiene pestañas ni migas. Para volver a «Alumnos y clases» solo queda el atrás del navegador o pasar por Materias. Después de guardar no hay un paso siguiente. La pantalla de error de la misma ruta sí ofrece «Volver a Alumnos y clases». Es la pantalla que la docente usa en cada clase.
- Recomendación: Quitar hideBackOnDesktop en lista/page.tsx o sumar arriba un enlace «Volver a Alumnos y clases», como el de Problem(). Junto al mensaje de guardado (SAVED_TEXT en attendance-form.tsx), poner un enlace a Alumnos y clases de la comisión.
- Criterios de aceptación:
  - A 1440 px y al 125 %, la pantalla de lista muestra un control visible para volver a Alumnos y clases de la misma comisión
  - Después de guardar, el mensaje de éxito trae un enlace de vuelta
  - En el celular, la flecha sigue funcionando como hoy
- Archivos: `hackai/app/(app)/materias/[subjectId]/alumnos/lista/page.tsx`, `hackai/components/shell/page-header.tsx`, `hackai/components/subjects/attendance-form.tsx`.
- Origen: N-11 (M: primera corrida; N: corrida sobre `main` nuevo).

#### U-18

**Poner primero la clase de hoy y los alumnos en Alumnos y clases, y el Zoom al final** · P1 · esfuerzo S · quick win

- Perfiles: docente-joven, docente-medio, docente-mayor. Vistas: mobile, desktop, desktop-zoom.
- Pantallas: `/materias/[subjectId]/alumnos`.
- Problema: En el celular, Alumnos y clases muestra primero el formulario «Enlace de Zoom de la comisión A», con «Guardar enlace» azul a lo ancho. Después vienen «Hoy no hay clase» y «Todavía no tomaste lista», dos estados vacíos con ícono, y recién en y≈960, fuera de la pantalla, «3 alumnos». En compu los dos vacíos ocupan unos 400 px antes de los alumnos. El Zoom se carga una vez por cuatrimestre y la lista se toma en cada clase, pero «Guardar enlace» compite con Tomar lista como botón primario.
- Recomendación: En alumnos/page.tsx, reordenar así: ClassesBlock (clase de hoy), HistoryBlock, StudentsBlock y, al final, ZoomBlock. Con el enlace ya cargado, mostrar el Zoom plegado («Enlace de Zoom: cargado · Cambiar»), y abierto solo si falta. Si no hay clase hoy ni historial, juntar los dos vacíos en una franja compacta.
- Criterios de aceptación:
  - El día de la clase, a 390×844, la fila de Tomar lista se ve en la primera pantalla
  - Sin clase hoy ni historial, «3 alumnos» se ve en la primera pantalla de compu a 1440×900
  - Con el Zoom cargado, el formulario aparece plegado y al final
  - Una comisión presencial no muestra el bloque de Zoom
- Archivos: `hackai/app/(app)/materias/[subjectId]/alumnos/page.tsx`, `hackai/components/subjects/zoom-form.tsx`, `hackai/components/subjects/class-list.tsx`, `hackai/components/subjects/class-history.tsx`.
- Origen: N-12 (M: primera corrida; N: corrida sobre `main` nuevo).

#### U-19

**Decir en Inasistencias cuántas faltas quedan y cómo se cuentan** · P1 · esfuerzo S · quick win

- Perfiles: alumno-fi, alumno-fce. Vistas: mobile, desktop, mobile-texto-grande.
- Pantallas: `/inasistencias`.
- Problema: La fila dice «1 de 3 faltas» o «Cuidado: 2 de 3 faltas (1 justificada)», así que para saber cuántas quedan, que es la pregunta núcleo según alcance.md, hay que restar. El paréntesis da a entender que la justificada no cuenta, pero sí cuenta (pregunta 22, decidida el 13/11). No dice qué pasa al llegar al máximo. El párrafo de la regla del 75 % solo aparece si alguna materia trae `classes`, y con los datos de la demo no aparece. El chip naranja no tiene texto visible («Cuidado» es solo para el lector de pantalla). absencesLine no usa `left` ni `warning`, que Cursada ya calcula. El vacío dice «…no hay inasistencias cargadas en el SIU», con jerga e impreciso: también cuentan las listas tomadas en HackAI.
- Recomendación: En absencesLine, poner primero una línea calculada con left y warning («Te queda 1 falta», «Te quedan 2» o «Llegaste al máximo») y debajo, más chico, «2 de 3 · incluye 1 justificada». Dar texto visible al chip («Cuidado» o «Al límite»). Sumar una línea fija «Las justificadas también cuentan» y dejar el párrafo largo de la regla en un «¿Cómo se cuenta?» desplegable. Cambiar el vacío a «Todavía no tenés faltas en tus materias.», sin nombrar el SIU. Inasistencias sigue listando solo las materias con faltas, como dice la pregunta 22.
- Criterios de aceptación:
  - La fila de Programación I de p-taguirre dice cuántas faltas quedan, sin restar
  - El texto deja claro que la justificada cuenta para el máximo
  - El chip de aviso tiene texto visible además del color
  - El vacío de p-nherrera no menciona el SIU
  - Hay un test de absencesLine para los casos normal, cerca y límite
- Archivos: `hackai/components/absences/line.ts`, `hackai/components/absences/absences-list.tsx`, `hackai/app/(app)/inasistencias/page.tsx`.
- Origen: M-69, N-13 (M: primera corrida; N: corrida sobre `main` nuevo).

#### U-20

**Compactar el espacio de la materia en el celular** · P1 · esfuerzo M

- Perfiles: alumno-fi, alumno-fce, docente-joven, docente-medio, docente-mayor. Vistas: mobile, mobile-texto-grande.
- Pantallas: `/materias/[subjectId]`.
- Problema: A 390×844 (docente, /materias/pr1), antes del primer mensaje hay un hero hasta y≈190, las pestañas de la materia, el selector de comisión, la barra de canales y «Vincular con un canal de Discord», así que el primer mensaje recién aparece en y≈515. Con letra grande el hero ocupa unos 275 px, las pestañas se pegan y no se ve ningún mensaje. Para el alumno, en Avisos, el cartel fijo «Solo los docentes publican avisos. Si tenés una duda, usá Consultas.» ocupa unos 80 px, no enlaza a Consultas (channel-panels.tsx:132) y con letra grande tapa el segundo aviso. El error de Discord con un enlace inválido queda cortado detrás del compositor fijo, y la ayuda dice «clic derecho» (discord-link.tsx:94, app/actions/spaces.ts:210).
- Recomendación: Mover «Vincular con un canal de Discord» a un ícono de ajustes del canal, o mostrarlo solo mientras el canal no está vinculado. Compactar el hero al entrar a un canal o al scrollear, y sacar las insignias de comisión en el celular. Pasar el cartel de Avisos a una línea al final de la lista, con el enlace «Hacer una consulta». Mostrar el error de Discord junto al input, con el texto «mantené apretado el canal (en la compu, clic derecho)».
- Criterios de aceptación:
  - A 390×844 el primer mensaje empieza antes de y≈420, para el alumno y para el docente
  - Con letra del sistema de 20 px se ve al menos un mensaje sin scroll
  - El cartel de Avisos no queda fijo y enlaza a Consultas
  - El error de Discord se ve sin que lo tape el compositor y no habla solo de «clic derecho»
  - En compu el espacio no cambia
- Archivos: `hackai/app/(app)/materias/[subjectId]/page.tsx`, `hackai/components/shell/page-header.tsx`, `hackai/components/spaces/discord-link.tsx`, `hackai/components/spaces/channel-tabs.tsx`, `hackai/components/spaces/composer-dock.tsx`, `hackai/components/spaces/channel-panels.tsx`, `hackai/components/subjects/subject-toolbar.tsx`, `hackai/app/actions/spaces.ts`.
- Origen: M-19 (M: primera corrida; N: corrida sobre `main` nuevo).

#### U-21

**Abrir el hilo en modo foco en el celular para que la consulta se vea** · P1 · esfuerzo M

- Perfiles: docente-joven, docente-mayor. Vistas: mobile, mobile-texto-grande.
- Pantallas: `/materias/[subjectId]?canal=<consultas>&hilo=<id>`.
- Problema: Al abrir una consulta desde Hoy en el celular, el hilo empieza cerca de y≈510 de 844, y con letra grande cerca de y≈725, detrás del compositor y de la barra inferior. Arriba quedan el encabezado de la materia, las pestañas, el selector de comisión, el riel de canales cortado («Aviso…», «Cons…», «Aviso…») y «Volver a Consultas». Después de enviar, la respuesta propia queda debajo del dock fijo y solo se lee «Respuesta enviada.». latest-mark.tsx usa scrollIntoView({block:'nearest'}).
- Recomendación: En el celular, con `hilo` en la URL, ocultar las pestañas, el selector de comisión y el riel de canales, y dejar arriba una sola fila «← Consultas · A». Dar al contenido un padding inferior igual al alto del dock más la barra inferior. Después de enviar, desplazar la respuesta nueva para que quede visible sobre el dock.
- Criterios de aceptación:
  - A 390×844, al abrir una consulta desde Hoy, el texto de la consulta se ve en la primera pantalla sin scroll
  - Con letra del sistema de 20 px, el inicio de la consulta también se ve sin scroll
  - Después de enviar, la respuesta propia queda visible por encima del compositor
  - En compu el hilo no cambia
- Archivos: `hackai/app/(app)/materias/[subjectId]/page.tsx`, `hackai/components/spaces/channel-panels.tsx`, `hackai/components/spaces/composer-dock.tsx`, `hackai/components/spaces/latest-mark.tsx`, `hackai/components/spaces/channel-tabs.tsx`.
- Origen: N-9 (M: primera corrida; N: corrida sobre `main` nuevo).

#### U-22

**Dejar a la vista lo nuevo al abrir un canal o una novedad** · P1 · esfuerzo M

- Perfiles: alumno-fi, alumno-fce, docente-joven, docente-medio, docente-mayor. Vistas: todas.
- Pantallas: `/novedades`, `/materias/[subjectId]`.
- Problema: Al abrir una consulta nueva desde Novedades, la fila lleva a ?canal=ch-3 sin &hilo=, porque threadOf (lib/core/spaces/unread.ts:40-43) exige que haya respuestas. La consulta asoma detrás del compositor fijo y de la barra inferior, sin «Nuevo» y sin «Responder» a la vista. En la primera vista se pierde lo no leído: PR1 Consultas decía «1 sin leer» y, al abrirla, el mensaje no tenía «Nuevo» y el punto de la pestaña desapareció. Pasa porque UnreadRefresh hace router.refresh() con data-just-read (page.tsx:464), que vuelve a leer el canal ya marcado como leído. El docente entra al espacio y cae en sus propios Avisos, sin pista de qué cambió.
- Recomendación: Hacer que la primera vista conserve unread=true: marcar como leído después de renderizar, o que el refresh relea solo el layout. Ampliar threadOf para que una raíz sin respuestas cuente como hilo, y llevar desde Novedades a &hilo=. Agregar un separador «Nuevos» y hacer scroll a lo nuevo después del scroll al tope de Next. Al entrar al espacio sin ?canal, abrir el canal que tiene no leídos o consultas abiertas. Sumar un test que abra el canal dos veces seguidas y verifique que la primera vista conserva lo no leído.
- Criterios de aceptación:
  - Al abrir una novedad, el mensaje tocado se ve sin scroll en 390×844 y al 125 %
  - El «Nuevo» y los puntos de no leído siguen visibles en la primera vista
  - Una consulta nueva sin respuestas abre su hilo desde Novedades
  - Hay un test que cubre la doble lectura
- Archivos: `hackai/components/spaces/unread-refresh.tsx`, `hackai/components/spaces/latest-mark.tsx`, `hackai/components/spaces/channel-panels.tsx`, `hackai/components/spaces/messages.tsx`, `hackai/lib/core/spaces/unread.ts`, `hackai/lib/core/spaces/module.ts`, `hackai/components/news/format.ts`, `hackai/app/(app)/materias/[subjectId]/page.tsx`.
- Origen: M-23 (M: primera corrida; N: corrida sobre `main` nuevo).

#### U-23

**Abrir las secciones de Material con archivos nuevos y mostrar «Lo último»** · P1 · esfuerzo S

- Perfiles: alumno-fi, alumno-fce, docente-joven, docente-medio. Vistas: mobile, desktop.
- Pantallas: `/materias/[subjectId]?canal=<material>`.
- Problema: Material abre solo la primera sección (material-panel.tsx:136, open={i === 0}), que suele ser Bibliografía. En AM1, «Unidad 2: Derivadas», con la guía del 29/9, queda plegada, y no hay un bloque «Lo último»: view.material.recent solo se ve en ContextPanel desde 2xl. En el celular el nombre se corta («Enunciado del TP int…») por la columna w-14 reservada para «Nuevo» (material-row.tsx:57). En CO1, Material dice «Todavía no hay material» aunque el aviso del 3/11 trae temas-segundo-parcial.pdf, y buscar «parcial» no encuentra nada.
- Recomendación: Abrir por defecto toda sección que tenga algún item.unread, además de la del archivo más nuevo. Mostrar un bloque «Lo último» con view.material.recent arriba de las secciones, en el celular y en lg. Pasar «Nuevo» a un chip en la línea de metadatos y usar line-clamp-2 en el nombre. Decidir en preguntas-abiertas.md si los adjuntos de los avisos entran a Material y a la búsqueda; si no entran, que el estado vacío lo diga.
- Criterios de aceptación:
  - El archivo más nuevo se ve sin desplegar nada, en el celular y en compu
  - Ningún nombre de archivo termina en «…» a 390 px
  - Abrir una novedad de material muestra el archivo con su «Nuevo»
  - La pregunta sobre los adjuntos de avisos está en preguntas-abiertas.md
- Archivos: `hackai/components/spaces/material-panel.tsx`, `hackai/components/spaces/material-row.tsx`, `hackai/components/spaces/context-panel.tsx`, `hackai/lib/core/spaces/material.ts`, `hackai/lib/core/spaces/classroom-import.ts`, `hackai/lib/core/spaces/search.ts`, `docs/product/preguntas-abiertas.md`.
- Origen: M-24 (M: primera corrida; N: corrida sobre `main` nuevo).

#### U-24

**Explicar en la pestaña Tareas que las entregas de Moodle están en el aula** · P1 · esfuerzo M

- Perfiles: alumno-fi, alumno-fce, docente-joven, docente-medio. Vistas: todas.
- Pantallas: `/materias/[subjectId]/tareas`, `/materias`.
- Problema: La tarjeta de Mis materias y el Calendario muestran «Guía 3 resuelta · Vence vie, 13 nov… · Moodle», pero /materias/am1/tareas dice «Todavía no hay tareas. Cuando tu docente cree una tarea…», y en PR1 lista solo las de HackAI, sin «Ejercicios de recursión». El alumno concluye que no tiene nada pendiente. Al docente, la tarjeta de PR1 le muestra «Ejercicios de recursión · Vence…», que le habla como a un alumno, y /materias/tor/tareas no menciona Moodle. task-list.tsx solo mira coursework.tasksOf.
- Recomendación: En el estado vacío y arriba de la lista, nombrar las dos fuentes: «En el aula de Moodle tenés 1 con fecha: Guía 3 resuelta, vence hoy · Abrir el aula» (con classroom.courseUrl), y enlazar «Ver parciales y finales en Calendario». Para el docente, en la tarjeta, cambiar el callout «Vence» por «Cierra el 13/11 a las 23:59 · en Moodle». Mezclar las entregas de Moodle en TaskList se decide aparte con el equipo.
- Criterios de aceptación:
  - Una comisión con entregas de Moodle y sin tareas de HackAI no muestra un vacío sin explicación
  - El texto enlaza al aula y al Calendario
  - La tarjeta del docente no le habla como a un alumno
- Archivos: `hackai/app/(app)/materias/[subjectId]/tareas/page.tsx`, `hackai/components/coursework/task-list.tsx`, `hackai/components/subjects/subject-grid.tsx`, `hackai/lib/core/studies/index.ts`, `hackai/components/dates.ts`.
- Origen: M-33 (M: primera corrida; N: corrida sobre `main` nuevo).

#### U-25

**Hacer que la barra inferior no tape el botón «Entregar» ni el foco** · P1 · esfuerzo S · quick win

- Perfiles: alumno-fi, alumno-fce. Vistas: mobile, mobile-texto-grande.
- Pantallas: `/materias/[subjectId]/tareas/[taskId]`.
- Problema: En /materias/pr1/tareas/tarea-1 a 390×844, «Entregar» queda en y=760–809 y la barra inferior flotante de #121 en y≈765–835: solo se asoma el borde del botón. Con Tab el foco llega a «Entregar», pero no hace scroll y queda oculto (WCAG 2.4.11). No hay scroll-padding global. «Volver a las tareas» (y=294) repite la flecha «Volver» del encabezado. Con letra grande, «Tu entrega» queda al borde inferior, detrás de la barra. Lo mismo pasa con «Inscribirme» en exámenes (ver U-71).
- Recomendación: En globals.css, por debajo de lg: `html { scroll-padding-bottom: calc(var(--tabbar-space) + env(safe-area-inset-bottom)) }`, y scroll-margin-bottom en los botones de envío. Dar al contenido un padding inferior igual al alto de la barra. Ocultar el BackLink duplicado por debajo de lg.
- Criterios de aceptación:
  - Con Tab, «Entregar» queda entero a la vista sobre la barra inferior
  - En la primera pantalla de una tarea se ve el botón o el campo de archivos completo
  - Al final de la página, ningún botón queda debajo de la barra inferior
  - No hay un doble «Volver» en el celular
- Archivos: `hackai/app/globals.css`, `hackai/components/shell/tab-bar.tsx`, `hackai/app/(app)/materias/[subjectId]/tareas/[taskId]/page.tsx`, `hackai/components/spaces/back-link.tsx`, `hackai/components/coursework/submission-panel.tsx`.
- Origen: M-35 (M: primera corrida; N: corrida sobre `main` nuevo).

#### U-26

**Mostrar la nota y la devolución en la tarea del alumno** · P1 · esfuerzo M

- Perfiles: alumno-fi, alumno-fce. Vistas: todas.
- Pantallas: `/materias/[subjectId]/tareas/[taskId]`, `/notas`.
- Problema: Con una nota 8 guardada y sin publicar, la tarea del alumno ya muestra la píldora «Calificada» y «Tu docente ya la calificó, así que no se puede reemplazar», sin nota, comentario ni enlace a Notas. Submission solo trae `graded: boolean`. En /notas?materia=am1, «Parciales y trabajos prácticos» no lista la tarea que lleva nota, ni como pendiente. El alumno no sabe dónde va a aparecer la devolución.
- Recomendación: Pasar la nota publicada y el comentario al Submission que ve el alumno y mostrarlos en SubmissionPanel. Mientras la nota no esté publicada, decir «Tu docente la está corrigiendo» y no «Calificada». Sumar «Cuando tu docente la publique va a aparecer acá y en Notas · Ver en Notas». Que Notas liste las tareas con nota como «Entregada · sin corregir» se valida con el equipo.
- Criterios de aceptación:
  - Con la nota publicada, la tarea muestra el valor y el comentario
  - Con la nota sin publicar, no dice «Calificada»
  - Hay un enlace a /notas?materia=<id>
  - Hay tests de coursework para la nota en Submission
- Archivos: `hackai/components/coursework/submission-panel.tsx`, `hackai/lib/core/coursework/index.ts`, `hackai/lib/core/coursework/tasks.ts`, `hackai/lib/core/coursework/submissions.ts`, `hackai/lib/core/coursework/gradebook.ts`, `hackai/lib/core/today/grades.ts`, `hackai/components/grades/subject-detail.tsx`.
- Origen: M-36 (M: primera corrida; N: corrida sobre `main` nuevo).

#### U-27

**Permitir corregir una entrega desde su página** · P1 · esfuerzo M

- Perfiles: docente-joven, docente-medio, docente-mayor. Vistas: todas.
- Pantallas: `/materias/[subjectId]/tareas/[taskId]`, `/materias/[subjectId]/tareas/[taskId]/entregas/[submissionId]`.
- Problema: La página de una entrega calificada muestra nombre, legajo, mail, «Atrasada · 313 días 11 h», «Calificada» y el archivo, pero no la nota, ni la devolución, ni un botón para corregir. Para corregir hay que ir a Calificaciones, elegir la columna y tocar un ícono de comentario sin texto: entre 9 y 11 clics desde Hoy. La lista de entregas no muestra la nota cargada, y las filas «No entregó» no son enlaces.
- Recomendación: Como primer paso, sumar un botón con texto «Poner nota y devolución» en SubmissionDetailCard y en cada fila, que lleve a gradesHref(subjectId, {comision, columna:'tarea:<id>', alumno}). Después, sumar la nota a SubmissionRow y mostrarla junto al estado. Embeber el editor de grade-editor.tsx es opcional.
- Criterios de aceptación:
  - Desde la entrega se llega al editor de la nota de ese alumno en 1 clic, en compu y en el celular
  - La lista de entregas muestra la nota cargada
  - Las filas sin entrega llevan a cargar la nota
- Archivos: `hackai/components/coursework/submission-detail.tsx`, `hackai/components/coursework/submissions-panel.tsx`, `hackai/components/coursework/grade-editor.tsx`, `hackai/lib/core/coursework/index.ts`, `hackai/lib/core/coursework/roster.ts`, `hackai/app/(app)/materias/[subjectId]/tareas/[taskId]/entregas/[submissionId]/page.tsx`.
- Origen: M-38 (M: primera corrida; N: corrida sobre `main` nuevo).

#### U-28

**Rechazar fechas límite pasadas al crear una tarea** · P1 · esfuerzo S · quick win

- Perfiles: docente-joven, docente-medio, docente-mayor. Vistas: todas.
- Pantallas: `/materias/[subjectId]/tareas/nueva`.
- Problema: Con la fecha 01/01/2026 (estamos en noviembre), la tarea se crea sin aviso y nace «Venció jue, 1 ene, 01:00», sin año. Además pasa a ser la primera columna de Calificaciones y la elegida por defecto. checkedTexts y createTask solo validan que la fecha se pueda leer. No hay ningún error 'fecha-pasada'.
- Recomendación: Validar en lib/core/coursework, en createTask y en updateTask solo si cambia dueAt, con un error nuevo 'fecha-pasada' traducido a voseo. Poner min en el input con la hora de Buenos Aires. Mostrar el año en la fecha cuando no es el año actual.
- Criterios de aceptación:
  - Una fecha pasada devuelve un error claro junto al campo, en compu y en el celular
  - Editar el nombre de una tarea ya vencida sigue funcionando
  - Una fecha de otro año se muestra con el año
  - Hay un test en el módulo coursework
- Archivos: `hackai/lib/core/coursework/tasks.ts`, `hackai/lib/core/coursework/index.ts`, `hackai/app/actions/coursework.ts`, `hackai/components/coursework/task-form.tsx`, `hackai/components/coursework/format.ts`.
- Origen: M-39 (M: primera corrida; N: corrida sobre `main` nuevo).

#### U-29

**Permitir borrar una tarea sin entregas ni notas** · P1 · esfuerzo M

- Perfiles: docente-joven, docente-medio, docente-mayor. Vistas: todas.
- Pantallas: `/materias/[subjectId]/tareas/[taskId]`, `/materias/[subjectId]/calificaciones`.
- Problema: «Editar la tarea» solo cambia el nombre, la consigna y la fecha («Las comisiones y si lleva nota quedan como están»). No hay forma de borrar ni archivar una tarea creada por error, y su columna queda para siempre primera y elegida por defecto en Calificaciones. No existe deleteTask, mientras que deleteExam («Borrar instancia») ya es un precedente.
- Recomendación: Sumar deleteTask al módulo coursework con el patrón de deleteExam: borrar solo si no hay entregas ni notas, sacar también su columna y devolver 'tarea-con-entregas' si las hay. Agregar la acción y un botón «Eliminar tarea» con confirmación dentro de «Editar la tarea», separado de Guardar.
- Criterios de aceptación:
  - Una tarea sin entregas ni notas se borra con confirmación y desaparece de Tareas y de Calificaciones
  - Con entregas, el botón explica por qué no se puede borrar
  - Hay tests del módulo
- Archivos: `hackai/lib/core/coursework/module.ts`, `hackai/lib/core/coursework/tasks.ts`, `hackai/lib/core/coursework/index.ts`, `hackai/app/actions/coursework.ts`, `hackai/components/coursework/task-form.tsx`, `hackai/app/(app)/materias/[subjectId]/tareas/[taskId]/page.tsx`.
- Origen: M-40 (M: primera corrida; N: corrida sobre `main` nuevo).

#### U-30

**Borrar una nota al vaciar su campo** · P1 · esfuerzo M

- Perfiles: docente-joven, docente-medio, docente-mayor. Vistas: todas.
- Pantallas: `/materias/[subjectId]/calificaciones`.
- Problema: Vaciar el campo de un alumno (7,5) y guardar no hace nada: la nota reaparece sin ningún mensaje, mientras las demás se guardan. saveGradeSheet descarta los campos vacíos (`&& r.value.trim()`, «Una nota que se borra no se guarda») y no hay otro camino para quitar una nota mal puesta.
- Recomendación: Tratar un campo que pasó de tener valor a quedar vacío como un borrado, con confirmación («Vas a quitar la nota de X»). Como mínimo, avisar junto al campo cómo quitarla. Nunca descartar el cambio en silencio.
- Criterios de aceptación:
  - Vaciar una nota y guardar la quita, con confirmación, o muestra un aviso claro junto al campo
  - Los campos que ya estaban vacíos no generan borrados
  - Hay un test de la acción
- Archivos: `hackai/app/actions/coursework.ts`, `hackai/components/coursework/grade-sheet.tsx`, `hackai/lib/core/coursework/gradebook.ts`.
- Origen: M-47 (M: primera corrida; N: corrida sobre `main` nuevo).

#### U-31

**Avisar las notas sin guardar antes de salir de la columna** · P1 · esfuerzo M

- Perfiles: docente-joven, docente-medio, docente-mayor. Vistas: todas.
- Pantallas: `/materias/[subjectId]/calificaciones`.
- Problema: Con 7,5 y 8 escritos sin guardar, no aparece ningún contador ni marca de cambios pendientes. Al tocar otra columna y volver, los campos están vacíos: se navegó sin preguntar. Pasa igual con la paginación, el ícono de comentario y las otras pestañas. No hay beforeunload ni estado dirty en la planilla. En el celular, «Guardar notas» queda al final.
- Recomendación: Detectar los campos cuyo valor difiere de `antes`, marcar esas filas, mostrar «Tenés N notas sin guardar» junto al botón y pedir confirmación al salir por la tira, la paginación o el ícono de comentario. Sumar beforeunload para la recarga o el cierre.
- Criterios de aceptación:
  - Con un cambio sin guardar se ve el contador, en compu y en el celular
  - Tocar otra columna con cambios pendientes pide confirmación
  - Sin cambios no se pregunta nada
- Archivos: `hackai/components/coursework/grade-sheet.tsx`, `hackai/components/coursework/gradebook.tsx`, `hackai/app/(app)/materias/[subjectId]/calificaciones/page.tsx`.
- Origen: M-48 (M: primera corrida; N: corrida sobre `main` nuevo).

#### U-32

**Mostrar la columna activa en la tira de Calificaciones y el estado de cada columna** · P1 · esfuerzo M

- Perfiles: docente-mayor, docente-joven, docente-medio. Vistas: desktop-zoom, mobile, mobile-texto-grande.
- Pantallas: `/materias/[subjectId]/calificaciones`, `/materias/[subjectId]/calificaciones/evaluacion`.
- Problema: En el celular, la tira de columnas es un riel con scroll horizontal oculto: con 4 columnas, «Nota de cursada» queda fuera de los 390 px, y cuando está elegida la píldora activa se corta («Nota…»). No hay flecha, degradé ni contador. «Evaluación» enlaza sin ?columna, y «Volver a Calificaciones» desde Evaluación lleva a la primera columna. Las pestañas no dicen cuántas notas tiene cada columna ni si está publicada. En compu, con 6 o 7 columnas el riel no hace wrap. Quien no usa gestos no ve esas columnas.
- Recomendación: En compu, usar flex-wrap en lugar de scroll horizontal. En el celular, usar un select «Columna» o un indicador «Ver más ›». Arreglar RailScroller con scrollIntoView({inline:'center', block:'nearest'}). Pasar ?columna al enlace de Evaluación y a su Volver. Sumar a cada pestaña su estado («3/3 · publicada»).
- Criterios de aceptación:
  - La columna elegida siempre se ve entera en la tira, en compu y en el celular
  - Al 125 % todas las columnas se alcanzan sin gestos
  - Volver desde Evaluación mantiene la columna
  - Cada pestaña muestra su estado
- Archivos: `hackai/components/coursework/gradebook.tsx`, `hackai/components/ui/rail-scroller.tsx`, `hackai/app/(app)/materias/[subjectId]/calificaciones/page.tsx`, `hackai/app/(app)/materias/[subjectId]/calificaciones/evaluacion/page.tsx`.
- Origen: M-51 (M: primera corrida; N: corrida sobre `main` nuevo).

#### U-33

**Hacer que los eventos del calendario abran su destino** · P1 · esfuerzo M

- Perfiles: alumno-fi, alumno-fce, docente-joven, docente-medio, docente-mayor. Vistas: todas.
- Pantallas: `/calendario`.
- Problema: Los bloques de la semana son <span> (calendar.tsx:87) y las filas de «Próximas fechas» son <li> de texto: tocarlos no hace nada, y Tab los saltea. #121 pasó la grilla a franjas de 2 horas, pero los eventos siguen sin destino. Para llegar a una tarea hay que salir y hacer 4 toques sabiendo de qué materia es. El calendario funciona como cartelera.
- Recomendación: Sumar href a CalendarEvent en eventsOf y withClasses, reusando dateHref(item, viewer) de agenda.ts. Una tarea de HackAI lleva a la tarea, lo que tiene comisión lleva al espacio con ?comision y una entrega de Moodle lleva al aula. Para las clases, sumar subjectId a ClassSlot. Renderizar Block y cada fila de NextDates como <Link> con focus-ring cuando haya destino.
- Criterios de aceptación:
  - Tocar una entrega de HackAI abre la tarea, en el celular y en compu
  - Tocar una clase o un parcial abre la materia en su comisión
  - Los eventos con destino se recorren con Tab y tienen foco visible
  - El destino coincide con el de la misma fecha en Hoy
- Archivos: `hackai/components/today/calendar.tsx`, `hackai/components/today/calendar-layout.ts`, `hackai/components/today/agenda.ts`, `hackai/app/(app)/calendario/page.tsx`, `hackai/lib/core/studies/index.ts`.
- Origen: M-54 (M: primera corrida; N: corrida sobre `main` nuevo).

#### U-34

**Responder arriba del calendario qué vence esta semana y cuál es el próximo parcial** · P1 · esfuerzo M

- Perfiles: alumno-fi, alumno-fce, docente-joven, docente-medio. Vistas: mobile, desktop.
- Pantallas: `/calendario`.
- Problema: En el celular (alumno-fi), la página mide 2121 px y «Próximas fechas» empieza cerca de y≈1560, debajo de la semana, de un «Nada este día» por cada día vacío (calendar.tsx:312), del texto de Moodle y del mes chico. La lista corta en 6 ítems (calendario/page.tsx:39) y no usa daysLeft. A 1440×900, la grilla de franjas de 2 h de #121 ocupa toda la primera pantalla, y el mes chico y «Próximas fechas» quedan a más de una pantalla de scroll: la columna lateral recién se pone al costado desde 2xl (calendar.tsx:566).
- Recomendación: Arriba de la semana, sumar un resumen de una o dos líneas tocables: «Esta semana: nada por entregar» (o lo que vence), y «Próximo parcial: … (en N días)» y «Próximo final: …». En NextDates, garantizar el próximo parcial y el próximo final aunque superen el corte de 6. Comprimir los días vacíos seguidos en una sola línea. En compu, llevar las próximas fechas a una franja compacta junto a los filtros. Bajar el corte a xl no alcanza: con la barra lateral, la grilla se queda sin ancho.
- Criterios de aceptación:
  - A 390×844 y a 1440×900, el próximo parcial y el próximo final se ven sin scroll
  - El próximo final figura aunque haya más de 6 fechas antes
  - Los días vacíos seguidos ocupan una sola línea en el celular
- Archivos: `hackai/app/(app)/calendario/page.tsx`, `hackai/components/today/calendar.tsx`.
- Origen: M-55 (M: primera corrida; N: corrida sobre `main` nuevo).

#### U-35

**Llevar al calendario las tareas del docente y el estado de entrega del alumno** · P1 · esfuerzo M

- Perfiles: docente-joven, docente-medio, docente-mayor, alumno-fce, alumno-fi. Vistas: todas.
- Pantallas: `/calendario`.
- Problema: La tarea de HackAI «Reval pasada» de p-mledesma figura en Tareas, pero en su calendario los 7 días de esa semana dicen «Nada este día». «Revalidación lote 8» de p-darrieta tampoco aparece, y «Próximas fechas» solo trae lo del SIU y de Moodle. coursework/module.ts filtra `s.role === 'alumno'` en dated() (línea 246). El pie dice «solo aparecen las que el docente cargó con fecha», lo que para el docente es falso. Para el alumno, UpcomingItem no tiene estado de entrega: una entrega hecha se ve como pendiente y una atrasada solo aparece atenuada.
- Recomendación: Sumar a coursework una lectura de las tareas con fecha de las comisiones que dicta el docente, y elegirla en CalendarContent según session.role. Agregar a las tareas de HackAI convertidas en UpcomingItem el estado de entrega ('entregada', 'pendiente' o 'atrasada') y mostrarlo en el bloque y en «Próximas fechas». Mientras tanto, corregir el pie para el docente.
- Criterios de aceptación:
  - La docente ve sus tareas de HackAI en la semana y en «Próximas fechas»
  - El alumno ve «Entregada» o «Atrasada» en cada entrega de HackAI
  - Hay tests de coursework y de today
- Archivos: `hackai/lib/core/coursework/module.ts`, `hackai/lib/core/coursework/index.ts`, `hackai/lib/core/today/index.ts`, `hackai/lib/core/studies/index.ts`, `hackai/components/today/calendar-layout.ts`, `hackai/app/(app)/calendario/page.tsx`.
- Origen: M-56 (M: primera corrida; N: corrida sobre `main` nuevo).

#### U-36

**Mostrar todas las horas en formato de 24 h con una sola función** · P1 · esfuerzo S · quick win

- Perfiles: alumno-fi, alumno-fce, docente-joven, docente-medio, docente-mayor. Vistas: todas.
- Pantallas: `/calendario`, `/materias`, `/inscripciones`, `/materias/[subjectId]/tareas`.
- Problema: En /calendario, «Próximas fechas» dice «vie, 13 nov, 11:59 p. m.» y «lun, 16 nov, 08:00 a. m.», mientras la grilla de la misma pantalla dice «23:59» y «08:00 – 10:00». /materias muestra «Vence vie, 13 nov, 11:59 p. m.», y el detalle de una mesa dice «lun, 7 dic, 02:00 p. m.». Hay dos funciones dueTime: la de components/dates.ts, sin hourCycle (usada por el calendario, offer-detail y subject-grid), y la de coursework/format.ts, con hourCycle 'h23'. readTime tampoco fija h23. Un final a las «02:00» se puede leer como de madrugada.
- Recomendación: Agregar hourCycle: 'h23' a dueTime y readTime de components/dates.ts, y hacer que coursework/format.ts reuse esa función en lugar de duplicarla. Mostrar el año solo cuando no es el actual. Sumar un test del formato.
- Criterios de aceptación:
  - Ninguna pantalla muestra «a. m.» ni «p. m.»
  - Hay una sola función dueTime
  - Un test cubre «vie, 13 nov, 23:59»
- Archivos: `hackai/components/dates.ts`, `hackai/components/coursework/format.ts`, `hackai/app/(app)/calendario/page.tsx`, `hackai/components/subjects/subject-grid.tsx`, `hackai/components/enrollment/offer-detail.tsx`.
- Origen: M-61 (M: primera corrida; N: corrida sobre `main` nuevo).

#### U-37

**Llevar a la nota tocada en Novedades y marcar como vista solo esa** · P1 · esfuerzo M

- Perfiles: alumno-fi, alumno-fce. Vistas: mobile, desktop.
- Pantallas: `/novedades`, `/notas`.
- Problema: Con 3 notas nuevas, Novedades dice «3 nuevas» y muestra 2 (SHOWN = 2 en grade-news.tsx). Tocar «Primer parcial · Te llegó la nota de Análisis Matemático I» y tocar «Ver todas» van al mismo /notas/vistas, que guarda una sola hora, marca las 3 como vistas y redirige a /notas sin la materia abierta. La campana pasa de 4 a 1: la tercera nota nunca se mostró. Abrir la materia en Notas no baja la campana, porque GRADES_SEEN_COOKIE solo se escribe en esa ruta. Las filas no dicen «Provisoria» ni de qué sistema vienen (OriginBadge), así que un 7 provisorio parece definitivo.
- Recomendación: Hacer que cada fila de nota lleve a /notas/vistas?materia=…&evaluacion=…, que marca solo esa como vista y redirige a /notas?materia=<id> con la fila resaltada. Solo «Ver todas» marca todas. Con 3 notas, mostrar las 3 (o «y N más de <materia>»). Abrir una materia en Notas también marca sus notas. Mostrar «Provisoria» y OriginBadge como en subject-detail. Cuidar el tamaño de la cookie si se guardan ids.
- Criterios de aceptación:
  - Con 3 notas nuevas, Novedades lista las 3
  - Tocar una nota abre /notas con esa materia y la nota resaltada, en el celular y en compu
  - Después de tocar una, las otras siguen como nuevas y la campana baja en 1
  - Abrir la materia en Notas baja la campana
  - Una nota provisoria lo dice en Novedades
  - Hay tests de lib/new-grades.ts y lib/grades-seen.ts para marcar una sola
- Archivos: `hackai/components/news/grade-news.tsx`, `hackai/app/notas/vistas/route.ts`, `hackai/lib/grades-seen.ts`, `hackai/lib/new-grades.ts`, `hackai/app/(app)/notas/page.tsx`, `hackai/components/grades/subject-detail.tsx`, `hackai/components/ui/origin-badge.tsx`.
- Origen: M-62, N-14 (M: primera corrida; N: corrida sobre `main` nuevo).

#### U-38

**Mostrar las notas de las materias en curso en la lista de Notas** · P1 · esfuerzo S

- Perfiles: alumno-fi, alumno-fce. Vistas: todas.
- Pantallas: `/notas`.
- Problema: En /notas, AM1 muestra «Con nota 1/3» y PR1 «Con nota 2/2» en el mismo lugar y con el mismo tamaño extrabold que la nota de las aprobadas. «1/3» parece una nota o una fracción, y cuenta el recuperatorio en el total. Para ver los parciales hay que abrir una hoja por materia. #121 reescribió grades-board.tsx, pero Summary mantiene `{graded}/{subject.assessments.length}` (líneas 82-88).
- Recomendación: En Summary, para las materias en curso, mostrar las notas cargadas («1er parcial 7 · 2do parcial —») o la última con su nombre. Dejar el conteo como texto secundario («1 de 2 con nota»), sin el estilo de la nota y sin contar los recuperatorios no rendidos.
- Criterios de aceptación:
  - Las notas de los parciales se ven en la lista sin abrir la hoja, en el celular y en compu
  - Ningún conteo usa el estilo de la nota final
- Archivos: `hackai/components/grades/grades-board.tsx`.
- Origen: M-70 (M: primera corrida; N: corrida sobre `main` nuevo).

#### U-39

**Elegir los textos del detalle de la materia según su estado** · P1 · esfuerzo S · quick win

- Perfiles: alumno-fi, alumno-fce. Vistas: todas.
- Pantallas: `/notas?materia=<id>`.
- Problema: Sistemas de Representación dice «Regular · falta el final» y debajo «La aprobaste sin una cursada en el SIU (antes de los períodos que vemos o por equivalencia).», que es falso y está en jerga. En AM1 y CO1 siguen las 4 tarjetas con «Nota de cursada: Sin nota» arriba de un parcial con nota, «Aprobada: —» (que en realidad es una fecha) y «Nota final: Todavía no». En CO1, «Estás inscripto al final del lun, 14 dic.» va en un recuadro rosado que se lee como alerta. AssessmentRow suma « · próximamente» con `!a.past` sin mirar si hay nota, y «Todavía no se tomó» usa el azul de los enlaces.
- Recomendación: Elegir el texto vacío según el estado (aprobada por equivalencia, regular sin parciales en el SIU, sin parciales cargados) y sacar «los períodos que vemos». En las materias en curso, cambiar las 4 tarjetas por una línea («Cursando · la nota de cursada sale al cerrar»). Renombrar «Aprobada» a «Fecha de aprobación» y ocultarla si no hay. Mostrar el aviso del final en tono info o éxito. Mostrar «próximamente» solo si no hay nota, y «Todavía no se tomó» en muted.
- Criterios de aceptación:
  - Ninguna materia regular dice «La aprobaste»
  - El aviso de inscripción al final no usa tono de error
  - Un parcial con nota no dice «próximamente»
  - Una materia en curso no muestra «Nota de cursada: Sin nota» arriba de un parcial con nota
- Archivos: `hackai/components/grades/subject-detail.tsx`.
- Origen: M-71 (M: primera corrida; N: corrida sobre `main` nuevo).

#### U-40

**Dejar un solo camino para pedir la constancia y ponerlo primero en el celular** · P1 · esfuerzo S · quick win

- Perfiles: alumno-fi, alumno-fce. Vistas: mobile, mobile-texto-grande, desktop.
- Pantallas: `/tramites`.
- Problema: «Nueva solicitud» (ahora con un Radix Select) viene con «Constancia de alumno regular» elegida y responde «Recibimos tu solicitud» sin emitir nada. Más abajo, Constancias dice «Se piden en la Autogestión del SIU» y ofrece «Pedirla en la Autogestión», que es el camino que decidió alcance.md. En el celular, los dos «Pedirla en la Autogestión» quedan en y=1188 y y=1349 de 1569, mientras «Nueva solicitud» está en y=656. El botón que está a mano es el que no sirve.
- Recomendación: Sacar «Constancia de alumno regular» de las opciones de Nueva solicitud, o que al elegirla el formulario muestre «Esta se pide en la Autogestión» con ese botón. Poner primero en el DOM la columna de Constancias (order-first en el celular, lg:order-last en compu).
- Criterios de aceptación:
  - A 390×844, «Pedirla en la Autogestión» se ve en la primera pantalla o casi
  - No hay dos formas de pedir la misma constancia
  - En compu, Constancias sigue en la columna derecha
- Archivos: `hackai/app/(app)/tramites/page.tsx`, `hackai/components/procedures/requests.tsx`, `hackai/components/academic/certificate-card.tsx`.
- Origen: M-75 (M: primera corrida; N: corrida sobre `main` nuevo).

#### U-41

**Escribir un copy honesto para la solicitud simulada y dejar a la vista la fila nueva** · P1 · esfuerzo S · quick win

- Perfiles: alumno-fi, alumno-fce. Vistas: todas.
- Pantallas: `/tramites`.
- Problema: El éxito dice «Recibimos tu solicitud… Te avisamos cuando cambie de estado.» debajo de «Es una simulación»: promete un aviso que no llega, y la solicitud desaparece al recargar (useState). «Listo» es chico, de contorno y está a la izquierda. Al cerrar, la fila nueva queda bajo el pliegue, sin resaltar, y su fecha sale «13 de nov de 2026» junto a «4 nov 2026». La fecha toma el reloj del navegador con un today() propio, y el número sale de Math.random.
- Recomendación: Cambiar el éxito a «Quedó registrada con el n.º X. Es una simulación: se borra al recargar», con un botón «Ver mi solicitud» que cierre la hoja, haga scroll a la fila y la resalte. Usar el helper de fechas compartido (con año) y el reloj de la app, y envolver el número y la fecha en whitespace-nowrap. «Listo» primario y a todo el ancho en el celular.
- Criterios de aceptación:
  - El éxito no promete avisos
  - Después de cerrar la hoja, la fila nueva se ve resaltada, en el celular y en compu
  - Todas las fechas de la lista tienen el mismo formato
- Archivos: `hackai/components/procedures/requests.tsx`, `hackai/components/dates.ts`, `hackai/lib/dates.ts`.
- Origen: M-76 (M: primera corrida; N: corrida sobre `main` nuevo).

#### U-42

**Oscurecer los rótulos de la barra lateral, no cortar el nombre y mostrar la facultad** · P2 · esfuerzo S · quick win

- Perfiles: alumno-fi, alumno-fce, docente-joven, docente-medio, docente-mayor. Vistas: desktop, desktop-zoom.
- Pantallas: `Barra lateral de todas las pantallas de compu`.
- Problema: En compu, «Menú principal», «Tu carrera», «Cuenta» y el detalle («Docente», «Contador Público», «Ingeniería en Informática») tienen contraste 3,01:1 por text-gray-light (#8a8fa0): GroupLabel (app-nav.tsx:82) y el detalle de SidebarAccount (línea 116). Al pie, el nombre se corta en «Tomás…», «Nicolá…», «Maria…» o «Carolin…», porque el botón de salir ocupa la fila, y la carrera también se corta («Ingenier…»). En compu no se ve en ningún lado de qué facultad es la sesión: SidebarTop llama a Brand sin school (app-nav.tsx:166).
- Recomendación: En GroupLabel y en el detalle de SidebarAccount, reemplazar text-gray-light por un token con 4,5:1 o más sobre el fondo de la barra (text-muted-foreground o text-steel). El token global --gray-light no se toca: tiene otros usos que se revisan aparte. Dejar el nombre y la carrera en line-clamp-2, o resolverlo con el menú de cuenta de U-10. Pasar school a Brand en SidebarTop, o mostrar la facultad debajo de la carrera. Verificar la barra plegada.
- Criterios de aceptación:
  - El auditor en compu no lista rótulos de la barra lateral en contrasteBajo
  - A 1440 px y al 125 %, el nombre completo de las cinco personas se lee sin «…»
  - En compu se ve la facultad de la sesión
  - La barra plegada no cambia de ancho ni se desarma
- Archivos: `hackai/components/shell/app-nav.tsx`, `hackai/components/shell/brand.tsx`, `hackai/app/globals.css`.
- Origen: M-11, N-16, M-8 (M: primera corrida; N: corrida sobre `main` nuevo).

#### U-43

**Sacar el botón Novedades de su propia pantalla, darle fondo opaco y marcar la campana activa** · P2 · esfuerzo S · quick win

- Perfiles: docente-joven, docente-medio, docente-mayor, alumno-fi, alumno-fce. Vistas: desktop, desktop-zoom, mobile.
- Pantallas: `/novedades`, `/hoy`, `/calendario`, `/materias/[subjectId] (error)`.
- Problema: Para el alumno en compu ya hay una sola entrada a Novedades (#121). El docente, en cambio, tiene Novedades en la barra lateral y además una pastilla en el encabezado de /hoy, /calendario y /novedades. En /novedades esa pastilla lleva a la misma pantalla y no tiene aria-current. Sin nada sin leer, la pastilla pasa a bg-white/10 y la ilustración se ve a través: un círculo cian del radar queda pegado a la campana y parece un aviso nuevo. En el error de materia, un trazo naranja la cruza, porque SpaceError no pasa desktopBell=false. En el celular (alumno y docente), estando en /novedades ninguna pestaña de abajo queda activa y la campana se ve igual que en las demás pantallas. Los contadores de la barra lateral pueden quedar desfasados de la campana hasta recargar (no se re-probó).
- Recomendación: Pasar desktopBell={false} en novedades/page.tsx también para el profesor, y en SpaceError. En NotificationsBell, usar un fondo opaco (por ejemplo bg-navy con ring) cuando no hay pendientes, y en /novedades aplicar un estado activo visible con aria-current='page'. Dejar el desfase de contadores como limitación conocida del layout. Unificar el criterio entre roles (barra lateral o pastilla en el encabezado) va como pregunta para el equipo.
- Criterios de aceptación:
  - En /novedades en compu, el encabezado del docente no muestra la pastilla Novedades
  - En /materias/no-existe, ninguna ilustración cruza la pastilla
  - Sin nada sin leer, la ilustración no se ve a través de la pastilla en ninguna pantalla
  - En /novedades del celular, la campana se ve activa y tiene aria-current='page', para el alumno y para el docente
- Archivos: `hackai/app/(app)/novedades/page.tsx`, `hackai/app/(app)/materias/[subjectId]/page.tsx`, `hackai/components/shell/notifications-bell.tsx`, `hackai/components/shell/page-header.tsx`, `hackai/app/(app)/layout.tsx`.
- Origen: M-12, N-19, N-32, M-13 (M: primera corrida; N: corrida sobre `main` nuevo).

#### U-44

**Poner la lista de personas antes del QR en compu** · P2 · esfuerzo S · quick win

- Perfiles: docente-mayor. Vistas: desktop-zoom, desktop.
- Pantallas: `/`.
- Problema: A 1152×720, la tarjeta «Probala en tu celular» (unos 215 px de alto) va primera, y de la lista de personas se ven solo dos filas de dos columnas. El placeholder del buscador se corta en «Buscá por nombre,», y la URL del QR se parte a mitad de palabra («https://campus-hackai.vercel.ap» / «p/»).
- Recomendación: Mover PhoneQr debajo de la lista, o a una columna lateral desde xl. Acortar el placeholder a «Buscá por nombre o carrera», o darle más ancho al buscador en lg. Mostrar la URL del QR sin «https://» y con break-words en lugar de break-all.
- Criterios de aceptación:
  - A 1152×720 se ven al menos 4 filas de personas sin scroll
  - El placeholder se lee entero en lg
  - La URL del QR no se corta a mitad de palabra
- Archivos: `hackai/app/page.tsx`, `hackai/components/session/person-picker.tsx`.
- Origen: M-2 (M: primera corrida; N: corrida sobre `main` nuevo).

#### U-45

**Volver a la pantalla pedida después de ingresar** · P2 · esfuerzo M

- Perfiles: alumno-fi, alumno-fce, docente-joven, docente-medio, docente-mayor. Vistas: todas.
- Pantallas: `/`, `/notas`, `/calendario/exportar`, `/discord/conectar`, `/notas/vistas`.
- Problema: Sin sesión, /notas termina en «/» sin ?next y sin ningún aviso, y al elegir a una persona se llega a /materias. requireSession() hace redirect('/') (lib/auth.ts:39) y no hay middleware.ts. Los route handlers de calendario/exportar, discord/conectar, discord/vuelta, notas/vistas y calificaciones/excel también terminan en redirect('/'). PersonPicker ya acepta returnTo y reenvía 'next', pero nada lo completa. Afecta a cualquier enlace de Discord, de un aviso o compartido que se abra sin sesión.
- Recomendación: Crear un middleware.ts que pase la ruta pedida en un header (o que cada página se la pase a requireSession) y redirigir a signInUrl(ruta). Aplicarlo también a los route handlers que terminan en redirect('/'). En app/page.tsx, si llega returnTo, mostrar un aviso del tipo «Entrá para seguir a Notas».
- Criterios de aceptación:
  - Sin sesión, /notas lleva a /?next=/notas con un aviso visible
  - Después de elegir a una persona se llega a /notas
  - Los route handlers listados conservan el destino
  - Un ?next externo o inválido se ignora
- Archivos: `hackai/lib/auth.ts`, `hackai/lib/return-to.ts`, `hackai/app/page.tsx`, `hackai/app/calendario/exportar/route.ts`, `hackai/app/discord/conectar/route.ts`, `hackai/app/discord/vuelta/route.ts`, `hackai/app/notas/vistas/route.ts`, `hackai/app/(app)/materias/[subjectId]/calificaciones/excel/route.ts`.
- Origen: M-3 (M: primera corrida; N: corrida sobre `main` nuevo).

#### U-46

**Dar texto a los botones del compositor y una confirmación visible con destinatario** · P2 · esfuerzo S

- Perfiles: docente-mayor, alumno-fi, alumno-fce. Vistas: todas.
- Pantallas: `/materias/[subjectId]?canal=<canal>`.
- Problema: Enviar es un ícono sin texto: 40×40 en el celular y 43×43 al 125 %. Con el campo vacío queda deshabilitado sin explicar por qué. Adjuntar es otro ícono, y su input mide 1×1. Después de publicar, la confirmación («Mensaje enviado.» o «Respuesta enviada.», app/actions/spaces.ts:124) no dice el destinatario y dura 4 s (NOTICE_MS), y no quedó a la vista. El offset fijo del dock ya pasó a var(--tabbar-space) con #121.
- Recomendación: Mostrar «Enviar» y «Adjuntar» con texto visible y con 44 px o más. Mantener la confirmación hasta la próxima acción, con el destinatario («Publicado para la Comisión A»), y llevar el scroll al mensaje nuevo (en el hilo del celular, ver U-21).
- Criterios de aceptación:
  - Los dos botones tienen texto visible y miden 44 px o más
  - La confirmación queda hasta la próxima acción y nombra al destinatario
  - El mensaje nuevo queda a la vista después de enviar, en compu y en el celular
- Archivos: `hackai/components/spaces/composer.tsx`, `hackai/components/spaces/composer-dock.tsx`, `hackai/components/spaces/action-form.tsx`, `hackai/app/actions/spaces.ts`.
- Origen: M-21 (M: primera corrida; N: corrida sobre `main` nuevo).

#### U-47

**Guardar el borrador de mensajes y tareas** · P2 · esfuerzo S

- Perfiles: alumno-fi, alumno-fce, docente-joven, docente-medio. Vistas: mobile, desktop.
- Pantallas: `/materias/[subjectId]?canal=<consultas>`, `/materias/[subjectId]/tareas/nueva`.
- Problema: Lo escrito en una consulta, o el nombre y la consigna de una tarea nueva, se pierde sin aviso al tocar otra pestaña o la barra inferior y volver. Se reprodujo con alumno-fi (consulta en PR1, Material y Atrás) y con docente-joven (Nombre de Nueva tarea, Alumnos y clases y Atrás). composer.tsx y task-form.tsx no guardan nada.
- Recomendación: Guardar el borrador en sessionStorage, con clave por canal o hilo en el compositor y por materia en la tarea, envuelto en try/catch. Restaurarlo al montar y borrarlo al enviar o crear. No pedir confirmación en «Cancelar».
- Criterios de aceptación:
  - Escribir, cambiar de pestaña y volver conserva el texto, en el celular y en compu
  - Al enviar o crear se borra el borrador
  - Con el almacenamiento bloqueado la página funciona igual
- Archivos: `hackai/components/spaces/composer.tsx`, `hackai/components/coursework/task-form.tsx`.
- Origen: M-22 (M: primera corrida; N: corrida sobre `main` nuevo).

#### U-48

**Hacer que Atrás cierre la vista previa de un archivo y la hoja de Notas** · P2 · esfuerzo M

- Perfiles: alumno-fi, alumno-fce. Vistas: mobile.
- Pantallas: `/materias/[subjectId]?canal=<material>`, `/notas`.
- Problema: En Notas, abrir una materia hace window.history.replaceState (grades-board.tsx:295), así que con la hoja abierta Atrás lleva a /materias y se pierde la lista con sus filtros. En Material, con la vista previa de «Guía de ejercicios 2» abierta, Atrás pasa de ?canal=ch-9 a Avisos y se pierden Material y sus secciones desplegadas. file-preview.tsx no maneja el historial.
- Recomendación: Al abrir FilePreview o la hoja de Notas, sumar una entrada al historial (pushState o router.push con scroll:false, con ?archivo=<id> o ?materia=<id>) y cerrar el overlay en popstate.
- Criterios de aceptación:
  - Con la vista previa abierta, Atrás la cierra y queda Material con sus secciones
  - Con la hoja de Notas abierta, Atrás la cierra y queda la lista con sus filtros
  - Un segundo Atrás vuelve a la pantalla anterior
- Archivos: `hackai/components/spaces/file-preview.tsx`, `hackai/components/grades/grades-board.tsx`.
- Origen: M-25 (M: primera corrida; N: corrida sobre `main` nuevo).

#### U-49

**Permitir reabrir una consulta marcada como resuelta** · P2 · esfuerzo M

- Perfiles: docente-joven, docente-medio, docente-mayor. Vistas: todas.
- Pantallas: `/materias/[subjectId]?canal=<consultas>&hilo=<id>`, `/hoy`.
- Problema: «Marcar resuelta» se aplica de un toque, sin confirmación ni deshacer: el botón desaparece y queda solo la píldora «Resuelta», y la consulta sale de Hoy. Desde el colectivo, un toque sin querer la saca de la vista del docente. ResolveButton devuelve null si ya está resuelta, y el módulo spaces solo llama setResolved(id, true), aunque el puerto ya soporta false. No existe «Reabrir».
- Recomendación: Sumar «Reabrir consulta» al hilo resuelto, con una operación en la interfaz de Espacios y una action en app/actions/spaces.ts. Después de marcarla, mostrar un aviso de 12 px o más «Marcaste la consulta como resuelta · Deshacer».
- Criterios de aceptación:
  - Un hilo resuelto muestra «Reabrir consulta» al docente de la comisión
  - Al reabrirla, vuelve a «Consultas sin resolver» en Hoy
  - El alumno no ve el botón
  - Hay un test del módulo spaces para reabrir
- Archivos: `hackai/components/spaces/channel-panels.tsx`, `hackai/app/actions/spaces.ts`, `hackai/lib/core/spaces/module.ts`, `hackai/lib/core/spaces/index.ts`, `hackai/lib/core/spaces/questions.ts`.
- Origen: M-27, N-24 (M: primera corrida; N: corrida sobre `main` nuevo).

#### U-50

**Seguir los directos sin responder del docente** · P2 · esfuerzo M · **A decidir**

- Perfiles: docente-medio, docente-mayor. Vistas: todas.
- Pantallas: `/hoy`, `/novedades`, `/materias/[subjectId]?vista=directos`.
- Problema: Un directo que la docente abre sin contestar desaparece de «Sin leer» en Hoy y de Novedades, porque leer equivale a sacarlo de pendientes. La lista de Directos del espacio no marca ninguno como «Sin respuesta», y en Hoy no hay «Directos sin responder». Las consultas se siguen hasta marcarlas resueltas; los directos («no voy a poder llegar al parcial») no tienen ningún seguimiento.
- Recomendación: Decidirlo con el equipo y anotarlo en preguntas-abiertas.md. La propuesta es sumar «Directos sin responder» al Hoy del docente, con la regla «el último mensaje es del alumno», y la etiqueta «Sin respuesta». Como mínimo, marcar «Sin respuesta» en la lista de Directos del espacio.
- Criterios de aceptación:
  - La decisión queda registrada en preguntas-abiertas.md
  - Si se hace: un directo leído y sin responder sigue visible como pendiente
  - Al responderlo deja de figurar
  - La regla vive en lib/core y tiene test
- Archivos: `hackai/components/today/teaching-screen.tsx`, `hackai/lib/core/today/index.ts`, `hackai/lib/core/spaces/direct.ts`, `hackai/lib/core/spaces/unread.ts`, `docs/product/preguntas-abiertas.md`.
- Origen: M-29 (M: primera corrida; N: corrida sobre `main` nuevo).

#### U-51

**Reacomodar el Hoy del docente para que las fechas queden a la vista y el vacío no prometa de más** · P2 · esfuerzo M

- Perfiles: docente-joven, docente-medio, docente-mayor. Vistas: desktop, desktop-zoom, mobile.
- Pantallas: `/hoy`.
- Problema: La tarjeta «Tu próxima clase» (#118) va fuera de la grilla, a todo el ancho, y empuja todo hacia abajo. Con todo al día, la columna izquierda queda con «Estás al día» suelto y unos 250 a 500 px en blanco, sin proponer un paso siguiente, mientras la derecha apila cuatro comisiones. A 1440×900 el Final queda cortado, y al 125 % de «Parciales y mesas» se asoma solo una fila cortada. Además, «Estás al día» se lee como «no tenés nada» aunque haya una entrega atrasada sin calificar en Tareas: el cuerpo aclara que habla de consultas y mensajes, pero el título no.
- Recomendación: Poner NowClassCard dentro de la columna izquierda. Con allClear(view), compactar el vacío en una franja («No tenés consultas ni mensajes pendientes» con «Lo próximo: …» o un enlace al Calendario) y mostrar «Parciales y mesas» en la columna izquierda. En el celular, ubicar «Parciales y mesas» antes de «Tus comisiones». Sumar a docs/product/preguntas-abiertas.md la pregunta «¿El Hoy del docente muestra entregas por corregir?».
- Criterios de aceptación:
  - A 1152×720 sin pendientes, la primera fila de «Parciales y mesas» se ve entera sin scroll
  - Con consultas pendientes, siguen siendo lo primero de la columna izquierda
  - El título del vacío nombra solo lo que cubre (consultas y mensajes)
  - En el celular, el próximo parcial se ve antes de las comisiones
  - La pregunta de entregas por corregir está en preguntas-abiertas.md, marcada como abierta
- Archivos: `hackai/components/today/teaching-screen.tsx`, `hackai/components/today/now-class.tsx`, `docs/product/preguntas-abiertas.md`.
- Origen: M-30, N-21, N-22 (M: primera corrida; N: corrida sobre `main` nuevo).

#### U-52

**Corregir las filas de «Parciales y mesas» del docente: destino, texto y comisión** · P2 · esfuerzo M

- Perfiles: docente-joven, docente-medio, docente-mayor. Vistas: todas.
- Pantallas: `/hoy`.
- Problema: Las filas repiten el tipo («Segundo parcial / Parcial · 08:00», «Final / Final · 09:00») y el parcial no muestra aula ni comisión. Los parciales llevan al canal Avisos genérico de la materia («Todavía no hay avisos»), sin nada de esa fecha. El Final de Álgebra y Geometría Analítica lleva a /materias/aga, una comisión del 1er cuatrimestre con el compositor «Aviso para la Comisión A» (dateHref: `if (item.hasSection) return spaceHref(...)`). La insignia SIU, igual en todas las filas, le quita ancho al texto: en el celular, «Álgebra y Geometría Analítica · Turno Diciembre…» se corta. Con letra grande, el título de la consulta se corta en 2 líneas («¿el segundo parcia…»). UpcomingItem no trae sectionId, y location es null en los parciales.
- Recomendación: 1) Para el profesor, que dateHref lleve a /calendario?semana=<semana de la fecha> en lugar del espacio. 2) En whatAndWhen, omitir el tipo cuando ya está en el título. 3) En el celular, dejar que la descripción ocupe tres líneas, o reducir la insignia a un punto con aria-label «Fecha del SIU». 4) Subir line-clamp a 3 en QuestionRow, o dejar el título libre con letra grande. Sumar sectionId y sectionName a UpcomingItem va en otro issue, porque cambia el núcleo. Verificar Inscripciones y Calendario, que comparten UpcomingRow.
- Criterios de aceptación:
  - Tocar un parcial o un final en Hoy como docente lleva a una pantalla que muestra esa fecha, y nunca a una comisión de otro período
  - Ninguna fila repite el tipo
  - A 390 px, el final de AGA se lee completo
  - Con letra del sistema de 20 px, el título de la consulta no se corta en 2 líneas
  - Inscripciones del alumno se ve igual que antes
- Archivos: `hackai/components/today/agenda.ts`, `hackai/components/today/upcoming.tsx`, `hackai/components/today/teaching-screen.tsx`, `hackai/components/ui/origin-badge.tsx`, `hackai/app/(app)/calendario/page.tsx`.
- Origen: M-30, N-23 (M: primera corrida; N: corrida sobre `main` nuevo).

#### U-53

**Escribir para el docente los textos que hoy le hablan al alumno** · P2 · esfuerzo S · quick win

- Perfiles: docente-joven, docente-medio, docente-mayor. Vistas: todas.
- Pantallas: `/materias/[subjectId] (error)`, `/materias/[subjectId]?canal=<consultas>`, `/calendario`, `Tareas (error)`.
- Problema: El docente lee textos pensados para el alumno. En una materia ajena: «No sos parte de esta materia. Si recién te inscribiste, puede tardar un rato en aparecer.» (page.tsx:84, task-error.tsx:13, con textos parecidos en page.tsx:101, actions/spaces.ts:37 y actions/coursework.ts:45). El docente no se inscribe: lo asignan. En Consultas vacío: «Nadie preguntó todavía. Si tenés una duda, escribila abajo…» (channel-panels.tsx:190). En el Calendario: «Tus clases, parciales, finales y entregas…», el chip «Inscripciones», el pie «solo aparecen las que el docente cargó con fecha» y la mesa en la que es tribunal como «Final · Sistemas de Representación». En Consultas · A de PR1, un mensaje del docente aparece en la lista pero los filtros dicen «Abiertas 0 · Resueltas 0», porque question es null. Hoy usa timeAgo y Novedades messageTime.
- Recomendación: Elegir el texto según el rol. Para «sin acceso» del docente: «No figurás como docente de esta materia. Si te asignaron hace poco, puede tardar un rato en aparecer.», también en task-error.tsx y en las actions. En QuestionList con canResolve: «Todavía nadie preguntó. Cuando un alumno pregunte, te aparece en Hoy». Pasar session.role al Calendario para cambiar el subtítulo y el pie, ocultar el chip Inscripciones y rotular «Mesa de final». Rotular como «Mensaje del docente» las raíces de Consultas que no son preguntas. Unificar el formato de hora entre Hoy y Novedades.
- Criterios de aceptación:
  - Ningún texto visible para el docente le pide que se inscriba ni que pregunte
  - Como alumno, los textos siguen iguales
  - El calendario del docente no muestra el chip Inscripciones
  - Las raíces de Consultas que no son preguntas están rotuladas
- Archivos: `hackai/app/(app)/materias/[subjectId]/page.tsx`, `hackai/components/coursework/task-error.tsx`, `hackai/app/actions/coursework.ts`, `hackai/app/actions/spaces.ts`, `hackai/components/spaces/channel-panels.tsx`, `hackai/app/(app)/calendario/page.tsx`, `hackai/components/today/calendar.tsx`, `hackai/components/today/calendar-layout.ts`, `hackai/components/today/teaching-screen.tsx`, `hackai/components/news/format.ts`.
- Origen: M-32, N-31 (M: primera corrida; N: corrida sobre `main` nuevo).

#### U-54

**Hacer tocable la próxima entrega de la tarjeta y sumar las tareas de HackAI** · P2 · esfuerzo M

- Perfiles: alumno-fi, alumno-fce. Vistas: todas.
- Pantallas: `/materias`.
- Problema: El recuadro «Guía 3 resuelta · Vence vie, 13 nov… · Moodle» de la tarjeta de Mis materias no es interactivo. Lo único secundario es «Aula» (68×36), que abre el curso entero. La fecha va solo en absoluto, sin «vence hoy» ni «en N días». La tarjeta toma solo las entregas de Moodle, así que una tarea de HackAI («Revalidación lote 8») no le llega al alumno por la tarjeta, ni por la campana, ni por Novedades.
- Recomendación: Hacer del callout un enlace secundario de 44 px (z-10): a la tarea de HackAI con taskHref, o al aula con classroom.courseUrl. Sumar la próxima tarea de HackAI sin entregar desde coursework.dated() y ocultarla si ya está entregada. Mostrar primero la fecha relativa («Vence hoy», «en 3 días»). Una novedad por tarea nueva va a preguntas-abiertas.md.
- Criterios de aceptación:
  - Tocar la próxima entrega lleva a la tarea o al aula
  - Una tarea de HackAI vigente sin entregar aparece en la tarjeta
  - Una tarea entregada no aparece
  - La tarjeta mantiene su alto en el celular y en compu
- Archivos: `hackai/components/subjects/subject-grid.tsx`, `hackai/app/(app)/materias/(lista)/page.tsx`, `hackai/lib/core/coursework/index.ts`, `hackai/components/dates.ts`.
- Origen: M-34 (M: primera corrida; N: corrida sobre `main` nuevo).

#### U-55

**Mostrar el estado de la tarea desde el punto de vista del alumno** · P2 · esfuerzo S

- Perfiles: alumno-fi, alumno-fce, docente-mayor. Vistas: mobile, mobile-texto-grande, desktop.
- Pantallas: `/materias/[subjectId]/tareas`, `/materias/[subjectId]/tareas/[taskId]`.
- Problema: Sin entrega, la fila dice «Venció» y la meta «Venció jue, 1 ene, 01:00»: un doble «Venció» que habla de la tarea y no de si el alumno entregó. Ya entregada, la lista muestra «Atrasada · 313 días 11 h» a la derecha, el título se parte en 2 líneas y la consigna y la fecha se cortan. En el detalle, el encabezado sigue diciendo «Venció», el botón principal es «Reemplazar la entrega» y el éxito queda en y≈950 de 1160, fuera de la pantalla. Con letra grande, la píldora se superpone al título («Re…» tapado).
- Recomendación: Para el alumno, mostrar «Sin entregar · vence en N días», «Atrasada, podés entregarla igual» o «Entregada», y dejar «Vigente» y «Venció» para el docente. Extraer TaskStatus a un solo componente. En el celular, bajar la píldora a la fila de meta. Con la entrega hecha, pasar el reemplazo a botón secundario y subir el mensaje de éxito.
- Criterios de aceptación:
  - El alumno ve «Sin entregar», «Atrasada» o «Entregada» en la lista y en el detalle
  - A 390 px y con letra grande, la píldora no se superpone ni parte el título
  - Después de entregar, la acción principal no es reemplazar
- Archivos: `hackai/components/coursework/task-list.tsx`, `hackai/app/(app)/materias/[subjectId]/tareas/[taskId]/page.tsx`, `hackai/components/coursework/submission-panel.tsx`, `hackai/components/coursework/format.ts`, `hackai/components/ui/list.tsx`.
- Origen: M-37 (M: primera corrida; N: corrida sobre `main` nuevo).

#### U-56

**Confirmar que la tarea quedó publicada** · P2 · esfuerzo S · quick win

- Perfiles: docente-joven, docente-medio, docente-mayor. Vistas: todas.
- Pantallas: `/materias/[subjectId]/tareas`.
- Problema: Después de «Crear tarea», createTask (app/actions/coursework.ts:144) redirige a la lista sin parámetro, y no aparece ningún mensaje ni resaltado. Editar, en cambio, sí confirma con «Guardamos los cambios.». La docente no sabe si la tarea se publicó ni si los alumnos ya la ven.
- Recomendación: Redirigir con ?creada=<taskId> y mostrar arriba de la lista un aviso role='status' («Publicaste la tarea. Ya la ven los alumnos de la Comisión A»), resaltando la fila nueva.
- Criterios de aceptación:
  - Después de crear aparece un aviso arriba de la lista, en compu y en el celular
  - La fila nueva se distingue
  - Al recargar, el aviso no confunde (se va o queda solo la marca de la fila)
- Archivos: `hackai/app/actions/coursework.ts`, `hackai/app/(app)/materias/[subjectId]/tareas/page.tsx`, `hackai/components/coursework/task-list.tsx`.
- Origen: M-41 (M: primera corrida; N: corrida sobre `main` nuevo).

#### U-57

**Mostrar los errores de formulario propios, en voseo y junto al campo** · P2 · esfuerzo M

- Perfiles: alumno-fi, alumno-fce, docente-joven, docente-medio, docente-mayor. Vistas: todas.
- Pantallas: `/materias/[subjectId]/tareas/[taskId]`, `/materias/[subjectId]/tareas/nueva`.
- Problema: En «Tarea nueva», un nombre de solo espacios devuelve «Ponele un nombre a la tarea…» debajo del botón, lejos del campo, sin aria-invalid ni foco. Con la fecha vacía, el único aviso es el globo nativo «Completa este campo», en tuteo. Al entregar sin archivos, el input con `required` dispara solo el globo nativo, aunque el servidor tiene «Elegí al menos un archivo para entregar.», y no se listan los archivos elegidos. Ningún label dice qué es obligatorio. «Lleva nota» viene marcado y su advertencia queda abajo. «Editar la tarea» promete «Podés sumar un archivo con los enunciados» sin un campo para hacerlo.
- Recomendación: Hacer que ActionForm acepte errores por campo ({field, message}, opcional y retrocompatible) y los muestre debajo del campo con aria-invalid y aria-describedby, con el foco en el primero. En la entrega, usar noValidate para que llegue el error del servidor, y listar nombre y tamaño de los archivos elegidos. Marcar «(obligatorio)» u «(opcional)» en cada label, recortar espacios en el cliente, subir la advertencia de «Lleva nota» y mostrar la ayuda del archivo solo al crear.
- Criterios de aceptación:
  - Ningún error depende del globo nativo
  - El error aparece junto al campo, en voseo, y el foco va ahí
  - Todos los labels dicen si el campo es obligatorio
  - Antes de entregar se ven los archivos elegidos
- Archivos: `hackai/components/spaces/action-form.tsx`, `hackai/components/coursework/submission-panel.tsx`, `hackai/components/coursework/task-form.tsx`, `hackai/app/actions/coursework.ts`, `hackai/lib/core/coursework/submissions.ts`.
- Origen: M-42 (M: primera corrida; N: corrida sobre `main` nuevo).

#### U-58

**Separar fecha y hora en los formularios y usar 24 h** · P2 · esfuerzo M

- Perfiles: docente-mayor, docente-medio, docente-joven. Vistas: desktop-zoom, mobile, desktop.
- Pantallas: `/materias/[subjectId]/tareas/nueva`, `/materias/[subjectId]/tareas/[taskId]`, `/materias/[subjectId]/calificaciones/evaluacion`.
- Problema: El datetime-local de «Tarea nueva», «Editar la tarea» y «Agregar instancia» (Evaluación) tiene 6 segmentos con a. m./p. m. y muestra «01:00 a.m.». Al 125 %, el campo de Evaluación mide 170 px y esconde la hora («dd/mm/aaaa, --:»). Si se tipea de corrido el valor queda vacío, y el error nativo («Completa este campo») no dice qué falta. No hay atajos ni hora sugerida. El Tipo de la instancia ya no se corta: #121 lo pasó a un Radix Select.
- Recomendación: En task-form.tsx y evaluation.tsx, separar en type=date (con max) y type=time (23:59 o 18:00 por defecto), a todo el ancho y en 24 h. Confirmar en palabras debajo: «Vence el viernes 20 de noviembre a las 18:00». En Evaluación, poner fecha y hora en su propia fila para que entren al 125 %. Avisar, sin bloquear, si un recuperatorio queda antes del parcial que recupera.
- Criterios de aceptación:
  - Se puede tipear la fecha y la hora sin que queden vacías
  - Al 125 %, la fecha y la hora se ven completas en Tarea nueva y en Evaluación
  - Debajo de los campos se lee la fecha en palabras, en formato de 24 h
- Archivos: `hackai/components/coursework/task-form.tsx`, `hackai/components/coursework/evaluation.tsx`.
- Origen: M-43 (M: primera corrida; N: corrida sobre `main` nuevo).

#### U-59

**Contar las entregas por corregir en la lista de tareas del docente** · P2 · esfuerzo M

- Perfiles: docente-joven, docente-medio, docente-mayor. Vistas: todas.
- Pantallas: `/materias/[subjectId]/tareas`.
- Problema: Cada fila de la lista del docente muestra solo el nombre, «HackAI», la fecha y el chip Vigente o Venció. Los conteos («0 entregaron · 3 sin entregar») aparecen recién dentro de la tarea. Con varias comisiones, hay que entrar tarea por tarea para ver qué hay pendiente. El tipo Task no trae esos conteos.
- Recomendación: Ampliar tasksOf para el profesor con {entregaron, sinCorregir, sinEntregar} y mostrarlo en TaskRow («2 entregas · 2 sin corregir»), con Vigente o Venció como meta. Reusar el helper de format.ts. Si el Hoy del docente muestra «para calificar» se decide con la pregunta abierta de U-51.
- Criterios de aceptación:
  - Cada fila del docente muestra los conteos
  - Los conteos coinciden con el detalle de la tarea
  - Hay test del módulo
- Archivos: `hackai/components/coursework/task-list.tsx`, `hackai/components/coursework/format.ts`, `hackai/lib/core/coursework/index.ts`, `hackai/lib/core/coursework/module.ts`, `hackai/lib/core/coursework/tasks.ts`.
- Origen: M-44 (M: primera corrida; N: corrida sobre `main` nuevo).

#### U-60

**Marcar en la fila la nota inválida y no cortar los nombres** · P2 · esfuerzo S

- Perfiles: docente-joven, docente-medio, docente-mayor. Vistas: todas, mobile-texto-grande.
- Pantallas: `/materias/[subjectId]/calificaciones`.
- Problema: Con un 12 en Benítez y un 6 válido en otra fila, «Guardar notas» muestra en rojo «La nota de Benítez, Lucía no sirve: va de 1 a 10…», debajo del botón. El campo con 12 no se marca ni recibe el foco, no hay aria-invalid y el mensaje no dice que no se guardó ninguna nota. «No sirve» suena a reto. Con letra grande, los nombres se cortan («Giménez, Agu…», «Herrera, Nicol…») por el truncate del label, y el nombre es lo único que evita ponerle la nota al alumno equivocado.
- Recomendación: Marcar el campo inválido con borde y aria-invalid, y llevar el foco al primero. Poner el mensaje arriba de la lista: «No guardamos ninguna nota: la de Benítez, Lucía tiene que ir de 1 a 10». En los labels, cambiar truncate por break-words y bajar el campo debajo del nombre cuando falte ancho.
- Criterios de aceptación:
  - El campo inválido se ve marcado y recibe el foco
  - El mensaje dice que no se guardó nada y no usa «no sirve»
  - Con letra del sistema de 20 px, el auditor no marca nombres truncados
- Archivos: `hackai/components/coursework/grade-sheet.tsx`, `hackai/app/actions/coursework.ts`.
- Origen: M-49 (M: primera corrida; N: corrida sobre `main` nuevo).

#### U-61

**Dar foco visible a los campos de nota y una forma de marcar ausente en el celular** · P2 · esfuerzo S · quick win

- Perfiles: docente-joven, docente-medio. Vistas: desktop, mobile.
- Pantallas: `/materias/[subjectId]/calificaciones`.
- Problema: Con Tab, el campo de nota enfocado no muestra anillo ni borde, porque `outline-none … focus-visible:outline-3` (grade-sheet.tsx:85) deja ganar a none. Cada fila pide 2 Tabs por el enlace de comentario. El campo tiene inputMode='decimal' y la ayuda dice «Escribí «A» si faltó», pero el teclado decimal de iPhone no tiene letras. Marcar ausente solo se puede desde el casillero del editor de comentario.
- Recomendación: Usar la clase focus-ring, o focus-visible:outline-solid con un borde de color. Evaluar tabIndex=-1 en los enlaces de comentario. Sumar a cada fila un toggle «Ausente», y mientras tanto cambiar la ayuda en el celular por «Para un ausente, tocá el comentario de la fila».
- Criterios de aceptación:
  - Con Tab, el campo enfocado tiene un anillo visible
  - En el celular se puede marcar un ausente desde la planilla
  - La ayuda coincide con lo que permite el teclado
- Archivos: `hackai/components/coursework/grade-sheet.tsx`, `hackai/components/coursework/fields.ts`, `hackai/components/coursework/grade-editor.tsx`.
- Origen: M-50 (M: primera corrida; N: corrida sobre `main` nuevo).

#### U-62

**Dejar a la vista la vista previa del pegado y dar los motivos correctos** · P2 · esfuerzo M

- Perfiles: docente-joven, docente-medio, docente-mayor. Vistas: todas.
- Pantallas: `/materias/[subjectId]/calificaciones/pegar`.
- Problema: En el celular, al tocar «Ver vista previa» la pantalla no se mueve ni toma el foco, y el resultado queda debajo del pliegue. «hola» y «escobar joaquín;9» salen como «No reconocido · No es de esta comisión: no se guarda.», que es el motivo equivocado. «Ya venía en una línea anterior: usamos esa» no aclara que la línea anterior era inválida, así que la alumna se queda sin nota. El ejemplo va en el placeholder del textarea y parece texto ya cargado.
- Recomendación: Cuando llega la vista previa, hacer scrollIntoView y focus sobre el h2 «Vista previa» (tabIndex=-1). Agregar en paste.ts un resultado «Formato» para las líneas que no se pueden partir, y dejar «No es de esta comisión» solo para identificadores válidos que no están inscriptos. En «Repetido», avisar si la línea anterior era inválida. Pasar el ejemplo a la ayuda. Aceptar «;» es opcional.
- Criterios de aceptación:
  - Después de «Ver vista previa», el resumen queda a la vista y con foco, en el celular y en compu
  - «hola» sale como problema de formato
  - Un repetido de una línea inválida lo dice
- Archivos: `hackai/components/coursework/paste-grades.tsx`, `hackai/lib/core/coursework/paste.ts`, `hackai/app/(app)/materias/[subjectId]/calificaciones/pegar/page.tsx`.
- Origen: M-52 (M: primera corrida; N: corrida sobre `main` nuevo).

#### U-63

**Explicar la nota de cursada sin pesos y corregir los ejemplos que parecen valores** · P2 · esfuerzo S · quick win

- Perfiles: docente-joven, docente-medio, docente-mayor. Vistas: todas.
- Pantallas: `/materias/[subjectId]/calificaciones?columna=cursada`, `/materias/[subjectId]/calificaciones/evaluacion`.
- Problema: Con los pesos en 0, «Nota de cursada» muestra «—» para todos y «0 de 3 con nota de cursada», y el panel del alumno dice «Todavía no hay nada para calcular: este alumno no tiene notas en columnas con peso.» (course-grade.tsx:288), aunque el alumno tiene notas en Parcial. La única pista es «Pesos: 0 · Cambiar», en letra chica. Publicar queda deshabilitado sin explicar por qué. Los placeholders «8,5» (course-grade.tsx:307, grade-editor.tsx:71) y «0» en los pesos parecen valores, y el ejemplo del nombre, «Segundo parcial» (evaluation.tsx:46), repite uno que ya existe. El botón de Calificaciones sigue diciendo solo «Evaluación».
- Recomendación: Si la suma de pesos es 0, mostrar en Nota de cursada «Poné cuánto pesa cada columna» con un botón a Evaluación#pesos, y explicar por qué Publicar está deshabilitado. Cambiar el texto del panel a «Tiene notas, pero ninguna columna tiene peso todavía». Cambiar los placeholders a «Ej.: 8,5», el de los pesos a «Ej.: 40» y el del nombre a «Ej.: Parcial integrador». Renombrar el botón a «Parciales y pesos». La ficha por alumno va a preguntas-abiertas.md como idea.
- Criterios de aceptación:
  - Con pesos en 0 se explica qué falta y por qué no se puede publicar
  - Ningún placeholder de nota o de peso se confunde con un valor
  - El botón de Calificaciones dice para qué sirve
- Archivos: `hackai/components/coursework/course-grade.tsx`, `hackai/components/coursework/grade-editor.tsx`, `hackai/components/coursework/gradebook.tsx`, `hackai/components/coursework/evaluation.tsx`, `hackai/app/(app)/materias/[subjectId]/calificaciones/evaluacion/page.tsx`.
- Origen: M-53 (M: primera corrida; N: corrida sobre `main` nuevo).

#### U-64

**Mostrar la semana elegida al tocar un día del mes chico** · P2 · esfuerzo S · quick win

- Perfiles: alumno-fi, alumno-fce, docente-joven, docente-medio, docente-mayor. Vistas: todas.
- Pantallas: `/calendario`.
- Problema: El mes chico está debajo de la grilla (en compu, también a 1440 px y al 125 %, porque la columna lateral se pone al costado recién desde 2xl). Al tocar «Miércoles, 9 de diciembre», la semana pasa a «7 dic – 13 dic» arriba, fuera de la pantalla, y la vista se queda en el pie. goTo (calendar.tsx:549) solo hace setMonday y setMonth, sin scroll ni foco.
- Recomendación: Cuando goTo viene del mes chico, hacer scrollIntoView({block:'start'}) sobre la sección «Semana», respetando prefers-reduced-motion, y llevar el foco a su rango. Considerar subir o plegar el mes chico en el celular.
- Criterios de aceptación:
  - Después de tocar un día se ve la semana elegida con su rango, en compu y en el celular
  - El foco queda en el rango de la semana
- Archivos: `hackai/components/today/calendar.tsx`.
- Origen: M-57 (M: primera corrida; N: corrida sobre `main` nuevo).

#### U-65

**Mostrar el tipo y la materia en cada bloque del calendario** · P2 · esfuerzo S

- Perfiles: alumno-fi, alumno-fce, docente-joven, docente-medio, docente-mayor. Vistas: todas.
- Pantallas: `/calendario`.
- Problema: «Guía 3 resuelta / AM1 23:59» no dice que es una entrega: el tipo se lee solo por el borde celeste, porque TONES[tone].label está solo en title y sr-only. En el celular, el final dice solo «Final / AGA 09:00», sin el nombre de la materia (condición `(!e.code \|\| e.tone === 'clase')`, calendar.tsx:98). En la grilla el título se corta con guion («Análisis Matemáti-co I», hyphens-auto) y la clase pasada va con opacity-50. La sigla mide 10 px, y la comisión, el horario y el aula, 11 px. El mes chico tiene puntitos aria-hidden y aria-label solo con la fecha.
- Recomendación: Anteponer una etiqueta visible y chica del tipo en todo lo que no es clase, y en las entregas «Vence 18:00». Mostrar el nombre de la materia en parciales y finales, con la sigla como chip secundario. Subir los textos del bloque a 0.8125rem y la sigla a 0.75rem. Sacar hyphens-auto y rotular «Ya pasó» con fondo gris en lugar de opacidad. Sumar los eventos al aria-label de cada día del mes chico.
- Criterios de aceptación:
  - Cada bloque dice su tipo con texto visible
  - Los parciales y finales nombran la materia
  - Ningún texto del bloque mide menos de 12 px
  - Un lector de pantalla anuncia los eventos del día en el mes chico
- Archivos: `hackai/components/today/calendar.tsx`.
- Origen: M-58 (M: primera corrida; N: corrida sobre `main` nuevo).

#### U-66

**Hacer más claros y más grandes los filtros y controles del calendario** · P2 · esfuerzo S

- Perfiles: alumno-fi, alumno-fce, docente-joven, docente-medio, docente-mayor. Vistas: mobile, mobile-texto-grande, desktop.
- Pantallas: `/calendario`.
- Problema: Los chips de tipo son toggles que ocultan lo que se toca, cuando lo esperable es mostrar solo eso. Ocupan tres filas más el selector: en el celular los filtros llegan a y≈375 (y≈520 con letra grande). Al apagar «Finales», la semana del 7 al 13 dic queda vacía, sin avisar que hay eventos ocultos. El filtro de materia no filtra «Próximas fechas», y subjectsIn toma e.subject, que trae el turno pegado (calendar-layout.ts:120). Los controles miden entre 28 y 32 px (flechas del mes 28×28, flechas de semana 32×32, «Hoy» 49×32, chips de 32, días de 46×32): el auditor da 55 objetivos menores a 44 px. Los días de otro mes tienen contraste 3,22:1. Los filtros se pierden al recargar. El selector Materia ya quedó bien con #121.
- Recomendación: Pasar a selección única con un chip «Todo», en una fila con scroll horizontal y chips de 40 a 44 px. Mostrar «N eventos ocultos por el filtro · Mostrar todo». Aplicar el filtro de materia a NextDates y usar subjectName sin el turno en subjectsIn. Llevar las flechas, «Hoy» (con estilo outline) y los días del mes chico a 44 px. Oscurecer los días de otro mes. Guardar los filtros en la URL.
- Criterios de aceptación:
  - Tocar un chip muestra solo ese tipo
  - Con un filtro que deja la semana vacía, se avisa cuántos eventos se ocultaron
  - El filtro de materia también filtra «Próximas fechas»
  - El auditor no marca controles de navegación menores a 40 px en el celular
  - Al recargar, los filtros se mantienen
- Archivos: `hackai/components/today/calendar.tsx`, `hackai/components/today/calendar-layout.ts`, `hackai/app/(app)/calendario/page.tsx`.
- Origen: M-59 (M: primera corrida; N: corrida sobre `main` nuevo).

#### U-67

**Abrir la grilla del calendario en la hora con eventos** · P2 · esfuerzo S · quick win

- Perfiles: alumno-fce, docente-mayor, docente-joven, alumno-fi, docente-medio. Vistas: desktop, desktop-zoom.
- Pantallas: `/calendario`.
- Problema: En compu la grilla siempre arranca a las 8: rangeOf (calendar-layout.ts:259) usa first = 8*60 y solo estira el rango. Para p-nherrera (FCE) al 125 %, la primera pantalla muestra de 8:00 a 12:00 vacío, y las clases de 18:00 a 21:00 y el Segundo parcial quedan fuera, sin aviso. A 1440 px pasa lo mismo hasta las 14:00. La etiqueta azul «12:00» de la línea de «ahora» (NowLine, calendar.tsx:143) se apila sobre la «12:00» gris de la fila.
- Recomendación: Al montar, desplazar la grilla a la primera hora con eventos de la semana (o a la hora actual), o calcular el rango según los eventos con un mínimo de filas. En NowLine, ocultar la etiqueta de la fila cuando la línea cae a menos de 10 minutos de la hora en punto.
- Criterios de aceptación:
  - A 1440×900 y al 125 %, el primer evento de la semana se ve sin scroll
  - No aparecen dos horas apiladas
- Archivos: `hackai/components/today/calendar.tsx`, `hackai/components/today/calendar-layout.ts`.
- Origen: M-60 (M: primera corrida; N: corrida sobre `main` nuevo).

#### U-68

**Agregar «Marcar todo como leído» y precisar el estado vacío de Novedades** · P2 · esfuerzo M

- Perfiles: alumno-fi, alumno-fce, docente-medio, docente-mayor, docente-joven. Vistas: todas.
- Pantallas: `/novedades`.
- Problema: En Novedades no hay forma de marcar como leído sin abrir canal por canal, ni todo junto, ni de volver a no leído. El mock m-novedades.html tenía «Marcar todas como leídas» y no se construyó. Después de leer todo, en compu queda «Estás al día» sin enlace ni paso siguiente, con el resto en blanco. «Todas N» cuenta las notas nuevas aunque no hay chip «Notas», y con una sola categoría el filtro («Todas 1 / Avisos 1») aparece igual. #121 ya resolvió que el filtro saltaba de lugar.
- Recomendación: Sumar «Marcar todo como leído» (espacios y notas) en el encabezado, con una operación markAllRead en el puerto de Espacios y un «Deshacer». Cambiar el vacío a «No tenés nada sin leer», con un enlace a Calendario o Materias, y dejar «Estás al día» solo en Hoy. Sumar un chip «Notas» o no contarlas en «Todas», y ocultar KindFilter cuando hay un solo tipo. «Marcar como no leído» queda para después.
- Criterios de aceptación:
  - Un toque deja la campana en 0, con un aviso y Deshacer, en el celular y en compu
  - El vacío de Novedades no dice «Estás al día» y ofrece un paso siguiente
  - Con un solo tipo, no aparece el filtro
  - «Todas» coincide con la suma de los chips
- Archivos: `hackai/components/news/news-filter.tsx`, `hackai/components/news/news-list.tsx`, `hackai/app/(app)/novedades/page.tsx`, `hackai/lib/core/spaces/index.ts`, `hackai/lib/core/spaces/module.ts`, `hackai/app/actions/spaces.ts`.
- Origen: M-63 (M: primera corrida; N: corrida sobre `main` nuevo).

#### U-69

**Hacer que las filas de Novedades digan qué pasó, de qué comisión y si esperan respuesta** · P2 · esfuerzo M

- Perfiles: alumno-fi, alumno-fce, docente-mayor, docente-medio. Vistas: todas.
- Pantallas: `/novedades`.
- Problema: La fila de un canal se titula con el tipo («Avisos») y lo repite en el chip, sin la comisión: rowOf usa channelTitle(kind, channelName) sin sectionId, aunque UnreadItem lo trae. Muestra solo el último mensaje, así que la respuesta a la consulta del propio alumno queda tapada detrás de un número. No dice «Sin respuesta» ni si te respondieron: UnreadItem no sabe quién abrió el hilo. Los contadores se repiten y no hay orden por importancia.
- Recomendación: Titular con el principio del mensaje, o con «Respondieron tu consulta» cuando el hilo es de quien mira (hay que sumar ese dato a UnreadItem en lib/core/spaces). Sumar la comisión con channelLabel y sacar el chip cuando repite el título. Para el docente, marcar «Sin respuesta». Poner los directos primero y reducir los contadores repetidos es opcional.
- Criterios de aceptación:
  - La respuesta a una consulta propia se distingue en la lista
  - Con dos comisiones de la misma materia, cada fila dice cuál
  - Ningún chip repite el título
  - Hay un test de unread.ts para el nuevo dato
- Archivos: `hackai/components/news/news-list.tsx`, `hackai/components/news/format.ts`, `hackai/components/spaces/format.ts`, `hackai/lib/core/spaces/unread.ts`, `hackai/lib/core/spaces/index.ts`.
- Origen: M-64 (M: primera corrida; N: corrida sobre `main` nuevo).

#### U-70

**Hacer que los estados vacíos y los bloqueos de inscripción digan la verdad** · P2 · esfuerzo S

- Perfiles: alumno-fce, alumno-fi. Vistas: todas.
- Pantallas: `/inscripciones`, `/inscripciones?tab=examenes`, `/inscripciones?materia=am1`.
- Problema: Con el alumno anotado a la única mesa abierta, la pestaña de exámenes titula «No hay inscripciones abiertas» (título fijo en enrollment-lists.tsx:167) arriba de «Tus finales 1». Con los cuatro contadores en 0, Vida universitaria dice «Probá con otro filtro», y en compu el panel invita «Elegí una materia / Tocá una materia de la lista» con la lista vacía. En AM1, la Comisión Verano dice «Para cambiarte, primero date de baja de esa» debajo de «ya no te podés dar de baja» (enrollment-actions.tsx:340), y es de otro período. «Obtener certificado» se muestra deshabilitado con «Disponible cuando te inscribas.».
- Recomendación: En emptyText y SubjectList, separar los casos: «ya estás anotado a todo lo abierto (cierra el…)», «nada abierto» y «filtro sin resultados». Ocultar «Probá con otro filtro» cuando el total es 0. No mostrar el panel «Elegí una materia» con la lista vacía. En enrollment-actions.tsx, no sugerir la baja si ya cerró y explicar cuando es otro período. Ocultar el certificado cuando no se puede pedir.
- Criterios de aceptación:
  - Ningún título dice «No hay inscripciones abiertas» si hay una abierta
  - Ningún bloqueo sugiere una acción imposible
  - Con la lista vacía, compu no invita a tocar una materia
- Archivos: `hackai/components/enrollment/enrollment-lists.tsx`, `hackai/components/enrollment/enrollment-actions.tsx`, `hackai/components/enrollment/offer-detail.tsx`.
- Origen: M-66 (M: primera corrida; N: corrida sobre `main` nuevo).

#### U-71

**Ordenar Inscripciones en el celular: detalle compacto, pestañas cortas y botón a la vista** · P2 · esfuerzo M

- Perfiles: alumno-fi, alumno-fce. Vistas: mobile, mobile-texto-grande.
- Pantallas: `/inscripciones`, `/inscripciones?materia=<id>`, `/inscripciones?tab=examenes&materia=<id>`.
- Problema: En el celular, Física I mide unos 1880 px: cada comisión muestra 9 datos y un «Obtener certificado» deshabilitado, y el «Inscribirme» de la comisión con lugar queda en y≈1574, a dos pantallas. En exámenes, el hero repite «Elegí la materia y la comisión… y en el aula del Campus Virtual a la vez» (page.tsx:219), que no aplica a una mesa, e «Inscribirme» queda en y≈823, debajo de la barra inferior (que empieza en 771). Con letra grande, las pestañas «Inscripción a materias» e «Inscripción a exámenes» se pisan, y el chip «Vida univ.» se corta en «Vi», sin indicio de que el riel se desliza. Pestañas y chips miden 40 px de alto.
- Recomendación: Mostrar cada comisión compacta (nombre, días y horario, cupo y botón), con el resto en «Ver detalle», y las que tienen lugar primero. Ocultar el certificado hasta que haya inscripción. Hacer que el subtítulo de page.tsx dependa de la pestaña y achicar el hero cuando hay ?materia. Acortar las pestañas a «Materias» y «Finales», con salto de línea si hace falta, y agregar un fade al borde del riel de chips. El padding inferior para la barra inferior va con U-25.
- Criterios de aceptación:
  - A 390×844, el «Inscribirme» de la primera comisión con lugar se ve en la primera pantalla y no queda debajo de la barra inferior
  - Con letra del sistema de 20 px, las pestañas no se superponen y el riel de chips muestra que se desliza
  - El subtítulo de exámenes no habla de comisión ni de aula
- Archivos: `hackai/components/enrollment/offer-detail.tsx`, `hackai/components/enrollment/certificate-button.tsx`, `hackai/app/(app)/inscripciones/page.tsx`, `hackai/components/enrollment/list-filters.ts`, `hackai/components/enrollment/enrollment-lists.tsx`, `hackai/components/ui/rail.tsx`.
- Origen: M-67 (M: primera corrida; N: corrida sobre `main` nuevo).

#### U-72

**Reunir los finales pendientes y hacer tocable el plan de estudios** · P2 · esfuerzo S

- Perfiles: alumno-fi, alumno-fce. Vistas: todas.
- Pantallas: `/estado`, `/notas?estado=final-pendiente`, `/materias?ver=final-pendiente`.
- Problema: En /estado solo «En curso» y «Finales pendientes» son enlaces. «Promedio», «Aprobadas» y las píldoras de materias parecen botones pero no se tocan, y «Ver las notas de cada materia» mide 185×20. «Finales pendientes» lleva a /notas?estado=final-pendiente, que solo dice «Regular · falta el final · Cursada 6», sin la mesa. Con 0 finales (FCE) muestra «Ninguna materia coincide / Probá con otro estado…», un vacío de búsqueda fallida para una buena noticia. El anillo marca 17 % contra «2 de 9 materias», sin explicación, y hay errores de concordancia («0 de 1 aprobadas»).
- Recomendación: Llevar la tarjeta «Finales pendientes» a /materias?ver=final-pendiente, que muestra la próxima mesa. Que no sea enlace cuando vale 0, y usar un vacío propio («No debés ningún final»). En las tarjetas regulares de Notas, sumar la mesa inscripta. Enlazar cada píldora cursada o aprobada a /notas?materia=<id>, y dejar las pendientes sin borde. Aclarar qué cuenta el porcentaje. Corregir la concordancia y llevar «Ver las notas de cada materia» a 44 px.
- Criterios de aceptación:
  - «Finales pendientes» lleva a la vista con mesas
  - Con 0 finales el texto es positivo
  - Lo que parece tocable es tocable
  - El porcentaje está explicado
  - No aparece «0 de 1 aprobadas»
- Archivos: `hackai/app/(app)/estado/page.tsx`, `hackai/components/grades/grades-board.tsx`, `hackai/components/grades/subject-detail.tsx`, `hackai/components/career/plan-map.tsx`, `hackai/components/career/progress.tsx`.
- Origen: M-72 (M: primera corrida; N: corrida sobre `main` nuevo).

#### U-73

**Arreglar el desborde de los filtros de Notas y no truncar los selects** · P2 · esfuerzo S

- Perfiles: alumno-fi, alumno-fce. Vistas: mobile, mobile-texto-grande, desktop.
- Pantallas: `/notas`.
- Problema: #121 achicó los filtros de Notas: dos selects (Estado y Tipo) y un segmentado «Por año lectivo / Por año de la carrera». En el celular, la primera materia arranca en y=467 de 844 y se ve completa. Quedan fallas: los selects se truncan en el celular («Todos los esta...») y con letra grande («Todos lo...»). Con letra grande, el segmentado se corta en el borde derecho y la tarjeta de materia también, y se pierde la nota «1/3». En compu, el segmentado sobresale del panel de filtros (llega a x≈1430 y el panel termina en x≈1395). En la hoja de la materia, el período se corta («AM1 · Grado 2do Cuatrimestre 2…»). No hay vista «Este cuatrimestre».
- Recomendación: Hacer que el segmentado de agrupación entre en el panel en compu, y que se apile o haga scroll en el celular y con letra grande. Hacer que la tarjeta no se corte a la derecha (min-w-0, sin anchos fijos). Acortar las etiquetas de los selects («Estado», «Tipo») o darles min-width. Opcional: plegar año, tipo y agrupación en un botón «Filtrar» con contador, y mostrar primero «Este cuatrimestre».
- Criterios de aceptación:
  - Con letra del sistema de 20 px a 390 px, ni el segmentado ni las tarjetas se cortan a la derecha
  - Ningún select de Notas termina en «...» a 390 px ni en compu
  - En compu el segmentado queda dentro del panel de filtros
  - A 390×844 se sigue viendo una tarjeta completa sin scroll
- Archivos: `hackai/components/grades/grades-board.tsx`.
- Origen: M-73 (M: primera corrida; N: corrida sobre `main` nuevo).

#### U-74

**Decidir dónde ve el alumno sus faltas y alinear los docs** · P2 · esfuerzo S · **A decidir**

- Perfiles: alumno-fi, alumno-fce. Vistas: mobile.
- Pantallas: `/materias`, `/materias/[subjectId]`, `/inasistencias`.
- Problema: Ni la tarjeta de Mis materias ni el espacio de la materia muestran faltas, aunque Programación I está en «Cuidado» (2 de 3). En el celular, Inasistencias está dentro de «Más», a 2 toques: igual que la línea base del SIU. La pregunta 22 de preguntas-abiertas.md (decidida el 13/11) todavía dice en «Por qué importa» que «Mis materias muestra en cada materia actual cuántas faltas lleva el alumno». En cambio, el commit 6f734f6 las sacó de la tarjeta a propósito y ARQUITECTURA.md lo documenta. Los docs se contradicen.
- Recomendación: Primero alinear el texto de la pregunta 22 con la decisión vigente. Proponer al equipo una solución liviana que respeta la tarjeta de alto fijo: solo cuando la materia está en «cerca» o «límite», un chip «2 de 3 faltas» en el encabezado del espacio, que lleve a /inasistencias. No mover Inasistencias a la barra inferior sin decidirlo con el equipo.
- Criterios de aceptación:
  - preguntas-abiertas.md y ARQUITECTURA.md dicen lo mismo sobre las faltas en Mis materias
  - La propuesta del chip queda registrada como pregunta abierta o decidida
  - Si se implementa el chip, aparece solo en materias en cerca o límite y lleva a /inasistencias
  - La tarjeta de Mis materias mantiene su alto
- Archivos: `docs/product/preguntas-abiertas.md`, `hackai/docs/ARQUITECTURA.md`, `hackai/app/(app)/materias/[subjectId]/page.tsx`, `hackai/components/subjects/subject-grid.tsx`, `hackai/components/shell/app-nav.tsx`.
- Origen: M-74, N-29 (M: primera corrida; N: corrida sobre `main` nuevo).

#### U-75

**Abrir los reportes dentro de la app y aclarar dónde se pide el firmado** · P2 · esfuerzo M

- Perfiles: alumno-fi, alumno-fce. Vistas: mobile, todas.
- Pantallas: `/tramites`, `/tramites/analitico`, `/notas`.
- Problema: El analítico, la historia y el plan bajan como .html adjunto: [documento]/route.ts responde con Content-Disposition attachment y page.tsx usa download. En un iPhone van a Archivos y no se imprimen directo, aunque la página dice «listos para imprimir». En el celular, los tres botones son íconos de 42×40 con «Descargar» solo en sr-only. «El documento con firma se pide en la Autogestión» no tiene un enlace para el analítico. El formulario ofrece «Certificado analítico parcial» y «Certificado de materias aprobadas» sin explicar la diferencia. Desde Notas no hay un enlace a la historia académica.
- Recomendación: Servir el HTML de HackAI con Content-Disposition inline, en otra pestaña, con los botones «Imprimir o guardar PDF» y «Compartir». Dejar attachment para el PDF oficial. Mostrar «Ver» o «Descargar» con texto y 44 px en el celular. Sumar el enlace «Pedir el analítico firmado en la Autogestión» y una ayuda por opción en el select. Agregar «Descargar historia académica» en /notas.
- Criterios de aceptación:
  - Tocar un reporte lo abre en el navegador, listo para imprimir
  - Los botones tienen texto en el celular y miden 44 px
  - El analítico firmado tiene enlace propio
  - Notas enlaza la historia académica
- Archivos: `hackai/app/(app)/tramites/[documento]/route.ts`, `hackai/app/(app)/tramites/page.tsx`, `hackai/components/procedures/documents.ts`, `hackai/components/procedures/requests.tsx`, `hackai/app/(app)/notas/page.tsx`.
- Origen: M-77 (M: primera corrida; N: corrida sobre `main` nuevo).

#### U-76

**Llevar el texto chico a 12 px como mínimo y en rem** · P2 · esfuerzo M

- Perfiles: alumno-fi, alumno-fce, docente-joven, docente-medio, docente-mayor. Vistas: todas.
- Pantallas: `/hoy`, `/novedades`, `/materias`, `/materias/[subjectId]`, `/notas`, `/calendario`, `/inscripciones`.
- Problema: El auditor sigue marcando texto de menos de 12 px en todos los módulos. En /notas: «Facultad de Ingeniería», el contador de la campana, «sin leer», «Con nota», «Cursada» y las etiquetas de la barra inferior, a 11 px. En /hoy: «AM1» a 11 px, y «jue», «nov» y «dic» de los bloques de fecha a 10 px, en px fijos (text-[10px], text-[11px] en upcoming.tsx:41 y 43, y teaching-screen.tsx:159), así que no crecen con la letra del sistema. Las insignias SIU miden entre 11 y 11,7 px. Hay 35 usos de text-[0.6875rem] o text-[10px] en 20 archivos, y #121 sumó más en tab-bar.tsx y calendar.tsx. Son los datos que se escanean, y para la docente de 64 años la fecha del parcial es lo menos legible.
- Recomendación: Tratarlo como un cambio transversal: subir text-[0.6875rem], text-[10px] y text-[11px] a text-xs (0.75rem) en los componentes compartidos (unread-count, origin-badge, brand, subject-views, channel-panels, messages, material-row, upcoming, teaching-screen, news-list, news-filter, grades-board, subject-detail, enrollment-lists, paste-grades, calendar). La barra inferior va en U-8. Agrandar los radios y checkboxes de Pegar a size-5. No tocar las áreas táctiles fijadas en direccion-de-diseno.md. Verificar que el bloque de fecha no se rompa en Calendario e Inscripciones, que comparten UpcomingRow.
- Criterios de aceptación:
  - El auditor no marca textoMenorA12px en /hoy, /novedades, /materias/[subjectId] ni /notas
  - Con letra del sistema de 20 px, la fecha y la sigla de Hoy crecen junto con el resto
  - Ningún chip se corta por el cambio a 390 px
  - /calendario e /inscripciones se ven sin desbordes en el celular y en compu
- Archivos: `hackai/components/ui/unread-count.tsx`, `hackai/components/ui/origin-badge.tsx`, `hackai/components/shell/brand.tsx`, `hackai/components/today/calendar.tsx`, `hackai/components/subjects/subject-views.tsx`, `hackai/components/spaces/channel-panels.tsx`, `hackai/components/spaces/messages.tsx`, `hackai/components/spaces/material-row.tsx`, `hackai/components/today/upcoming.tsx`, `hackai/components/today/teaching-screen.tsx`, `hackai/components/news/news-list.tsx`, `hackai/components/news/news-filter.tsx`, `hackai/components/grades/grades-board.tsx`, `hackai/components/grades/subject-detail.tsx`, `hackai/components/enrollment/enrollment-lists.tsx`, `hackai/components/coursework/paste-grades.tsx`.
- Origen: M-79, N-17 (M: primera corrida; N: corrida sobre `main` nuevo).

#### U-77

**Ajustar las tarjetas de Mis materias para que no tengan huecos ni datos cortados** · P2 · esfuerzo S · quick win

- Perfiles: alumno-fi, alumno-fce, docente-joven, docente-mayor. Vistas: todas.
- Pantallas: `/materias`.
- Problema: Con el alto fijo de #121 (h-[20rem]), las materias sin entrega de Moodle dejan entre 120 y 150 px en blanco entre el horario y «Abrir el espacio». Con docente-joven en el celular, /materias pasó a medir 1702 px. A 1440 px, dos tarjetas ocupan 2 de las 3 columnas (xl:grid-cols-3) y las pestañas quedan centradas. El detalle sigue cortado con truncate en el celular y en el compu del alumno («AM1 · Comisión A · Grado 2do Cuatri…», «Miércoles 08:…»). «Grado 2do Cuatrimestre» es el nombre del SIU. Las dos comisiones de una misma materia llevan el mismo título y solo se distinguen por esa línea gris. #121 ya resolvió la franja «En curso» estirada y el corte al 125 % de la docente.
- Recomendación: Bajar el alto fijo a lo que ocupa el contenido: alto fijo solo para la fila de la entrega, o un min-h chico en lugar de h-[20rem]. Usar auto-fit con minmax(20rem,1fr) en lugar de xl:grid-cols-3, y alinear las pestañas con la grilla. Formatear el período sin «Grado» con una función compartida, y usar line-clamp-2 en lugar de truncate en el detalle (subject-grid.tsx:96). En la vista del docente, poner la comisión en el título o en una insignia («Programación I · Comisión Verano»). Pasar self-start a StatusChip por si reaparece en otra pestaña.
- Criterios de aceptación:
  - El auditor no marca truncados en las tarjetas, en el celular ni en compu
  - En el celular no quedan huecos de más de 24 px dentro de una tarjeta
  - Las dos comisiones de una materia se distinguen por el título
  - A 1440 px no queda una columna vacía al lado de las tarjetas
- Archivos: `hackai/components/subjects/subject-grid.tsx`, `hackai/components/subjects/subject-views.tsx`, `hackai/components/grades/status.tsx`, `hackai/app/(app)/materias/(lista)/page.tsx`.
- Origen: M-80 (M: primera corrida; N: corrida sobre `main` nuevo).

#### U-78

**Cerrar el hueco entre el compositor y la barra inferior** · P2 · esfuerzo S · quick win

- Perfiles: docente-joven, alumno-fi. Vistas: mobile, mobile-texto-grande.
- Pantallas: `/materias/[subjectId]`.
- Problema: En el espacio de la materia en el celular, el compositor flota en bottom calc(var(--tabbar-space) + 0.5rem), unos 84 px, y la barra inferior empieza más abajo. En esa franja de 14 a 20 px se lee el mensaje de abajo («Meet para el parcial del viernes 20») y la pantalla parece rota. --tabbar-space no coincide con la altura real de la barra: 58 px más el margen.
- Recomendación: Igualar --tabbar-space (globals.css) a la altura real de tab-bar.tsx más --tabbar-bottom, y quitar el +0.5rem del dock, o extender su fondo opaco hasta la barra con padding-bottom.
- Criterios de aceptación:
  - A 390×844 en /materias/pr1 no se ve texto de mensajes entre el compositor y la barra inferior
  - El último mensaje sigue alcanzable con scroll y no queda tapado por el dock
  - Con letra del sistema de 20 px tampoco aparece el hueco
- Archivos: `hackai/components/spaces/composer-dock.tsx`, `hackai/app/globals.css`, `hackai/components/shell/tab-bar.tsx`.
- Origen: N-18 (M: primera corrida; N: corrida sobre `main` nuevo).

#### U-79

**Separar las pestañas de la materia cuando la letra crece** · P2 · esfuerzo S · quick win

- Perfiles: docente-mayor, docente-joven. Vistas: mobile-texto-grande.
- Pantallas: `/materias/[subjectId]`, `/materias/[subjectId]/alumnos`.
- Problema: Con la letra del sistema a 20 px, la barra de pestañas se lee «EspacioAlumnos y clasesTareas Calificaciones»: no queda separación entre etiquetas y «Calificaciones» toca el borde. El auditor no lo detecta porque el contenedor no scrollea. Viene de max-sm:flex-auto max-sm:gap-1 max-sm:px-2 sobre railTrack y railItem.
- Recomendación: En subject-tabs.tsx y components/ui/rail.tsx: gap y padding horizontales mínimos entre pestañas, cada pestaña en flex-none, y overflow-x-auto (o RailScroller) cuando no entran.
- Criterios de aceptación:
  - Con letra del sistema de 20 px, las cuatro pestañas se distinguen con separación visible
  - Si no entran, la barra se desliza en horizontal sin cortar etiquetas y la pestaña activa queda a la vista
  - A 390 px con letra normal, la barra se ve igual que antes
- Archivos: `hackai/components/subjects/subject-tabs.tsx`, `hackai/components/ui/rail.tsx`, `hackai/components/ui/rail-scroller.tsx`.
- Origen: N-20 (M: primera corrida; N: corrida sobre `main` nuevo).

#### U-80

**Mostrar con honestidad una clase fuera del día en la pantalla de lista** · P2 · esfuerzo M

- Perfiles: docente-joven, docente-medio, docente-mayor. Vistas: todas.
- Pantallas: `/materias/[subjectId]/alumnos/lista`.
- Problema: Abierta por URL, una clase pasada en la que nunca se tomó lista se titula «Tomar lista», dice «Todos presentes (3)» y pinta tres píldoras verdes de Presente en botones deshabilitados que parecen activos. El único aviso es una línea gris de 13 px al pie. La clase futura que Hoy anuncia como «Tu próxima clase» da «Esa clase no está en el horario de la comisión», que es falso: classesThrough(now) no genera clases futuras y la clase cae en 'clase-inexistente'. Hoy no hay enlaces a estas clases, pero los habría si se suma el enlace de U-16.
- Recomendación: En AttendanceForm, con editable=false y pass=null, no pintar Presente ni Ausente, y mostrar arriba «En esta clase no se tomó lista». Con la lista tomada y no editable, usar filas <li> sin aspecto de botón y el título «Lista del <día>». En Cursada (attendance.ts), devolver un error propio para una clase futura que está en el horario (se puede verificar con classesThrough(section, term, term.end)), con el texto «La clase del <día> es a las <hora>. Ese día vas a poder tomar lista acá.» en ATTENDANCE_ERRORS. Sigue la hipótesis de la pregunta abierta #30 (solo hoy).
- Criterios de aceptación:
  - Una clase pasada sin lista no muestra «Todos presentes» ni píldoras verdes
  - Una clase pasada con lista se titula con su fecha y no parece editable
  - La próxima clase del horario dice cuándo se va a poder tomar lista, no «no está en el horario»
  - Una fecha que no está en el horario sigue dando «no está en el horario»
  - Hay tests de attendance.ts para la clase futura
- Archivos: `hackai/components/subjects/attendance-form.tsx`, `hackai/app/(app)/materias/[subjectId]/alumnos/lista/page.tsx`, `hackai/lib/core/studies/attendance.ts`, `hackai/components/subjects/attendance-format.ts`, `hackai/lib/core/studies/classes.ts`.
- Origen: N-25 (M: primera corrida; N: corrida sobre `main` nuevo).

#### U-81

**Decir en «Hoy no hay clase» cuándo es la próxima** · P2 · esfuerzo M

- Perfiles: docente-joven, docente-medio, docente-mayor. Vistas: todas.
- Pantallas: `/materias/[subjectId]/alumnos`.
- Problema: El vacío de Alumnos y clases dice «El día que la comisión A tenga clase, vas a poder tomar lista acá», sin fecha, aunque Hoy ya la calcula. Suena indefinido y deja la duda de si el sistema conoce el horario. En la Comisión Verano, de un período que todavía no empezó, no dice que arranca en 2027. ClassList recibe solo las clases hasta hoy.
- Recomendación: Calcular en Cursada la próxima clase de la comisión (currentClass o classesThrough sobre el período completo) y pasarla a la página. Texto: «Hoy no hay clase. La próxima es el miércoles 11 de noviembre, de 08:00 a 10:00». Para un período que no empezó: «La cursada empieza el <fecha>». Va bien junto con U-18.
- Criterios de aceptación:
  - Sin clase hoy, el vacío muestra el día y el horario de la próxima clase de esa comisión
  - En una comisión de un período futuro, dice cuándo empieza
  - El cálculo está en el núcleo y tiene test
- Archivos: `hackai/components/subjects/class-list.tsx`, `hackai/app/(app)/materias/[subjectId]/alumnos/page.tsx`, `hackai/lib/core/studies/classes.ts`.
- Origen: N-26 (M: primera corrida; N: corrida sobre `main` nuevo).

#### U-82

**Darle superficie a EmptyState en compu y mantenerlo igual en todas las pantallas** · P2 · esfuerzo S · quick win

- Perfiles: alumno-fce, alumno-fi, docente-medio, docente-joven, docente-mayor. Vistas: desktop, desktop-zoom.
- Pantallas: `/inasistencias`, `/novedades`, `/hoy`.
- Problema: En compu, el fondo del contenido es blanco y EmptyState usa bg-card sin borde: el ícono y dos líneas flotan sobre un lienzo vacío de unos 1200×700 (Inasistencias sin faltas, «Estás al día» en Hoy). En el celular, el mismo vacío es una tarjeta blanca sobre gris. Novedades vacía va en tarjeta en el celular y suelta en compu.
- Recomendación: Agregar a EmptyState (components/ui/states.tsx) un borde o un fondo de superficie distinto, y revisar las pantallas que lo usan para que se vea igual en el celular y en compu.
- Criterios de aceptación:
  - En compu, el vacío de /inasistencias, /novedades y /hoy se distingue del fondo
  - El vacío se ve como tarjeta tanto en el celular como en compu
  - Ninguna pantalla que use EmptyState queda con doble borde
- Archivos: `hackai/components/ui/states.tsx`, `hackai/app/(app)/inasistencias/page.tsx`, `hackai/app/(app)/novedades/page.tsx`, `hackai/components/today/teaching-screen.tsx`.
- Origen: N-27 (M: primera corrida; N: corrida sobre `main` nuevo).

#### U-83

**Agregar «Saltar al contenido» y «Saltar al menú» para navegar con teclado** · P2 · esfuerzo S · quick win

- Perfiles: docente-joven, alumno-fce. Vistas: desktop.
- Pantallas: `Todas las pantallas de compu`.
- Problema: En compu, el <nav> de la barra lateral va después del <main> en el DOM: en /hoy hacen falta 8 Tab para llegar a «Materias», y en el espacio de una materia, decenas. No hay enlace de salto. El orden actual tiene la ventaja de poner el contenido primero, así que conviene resolverlo con enlaces y no moviendo el DOM.
- Recomendación: Sumar al principio del layout (app/(app)/layout.tsx o sidebar-frame.tsx) dos enlaces que se vean al recibir foco: «Saltar al contenido», que apunta al main con id y tabIndex=-1, y «Saltar al menú», que apunta al nav.
- Criterios de aceptación:
  - El primer Tab de cualquier pantalla muestra «Saltar al contenido»
  - Con «Saltar al menú», el siguiente Tab cae en el primer ítem de la barra lateral
  - Los enlaces no se ven sin foco y no rompen el celular
- Archivos: `hackai/app/(app)/layout.tsx`, `hackai/components/shell/sidebar-frame.tsx`, `hackai/components/shell/app-nav.tsx`.
- Origen: N-28 (M: primera corrida; N: corrida sobre `main` nuevo).

#### U-84

**Abrir las preguntas de producto sobre la asistencia visible y aclarar Inasistencias** · P2 · esfuerzo S · **A decidir**

- Perfiles: alumno-fi, alumno-fce, docente-medio, docente-mayor. Vistas: todas.
- Pantallas: `/inasistencias`, `/materias/[subjectId]/alumnos`.
- Problema: El alumno no puede saber si en la última clase quedó presente o si todavía no se tomó lista: Inasistencias lista solo faltas, y «No tenés faltas» no distingue los dos casos. La docente no ve en ningún lado las faltas acumuladas de cada alumno (Escobar llegó al máximo en el SIU y no figura en «3 alumnos»), y /inasistencias la redirige a Hoy sin mensaje. Ninguna de las dos cosas está en el alcance: HackAI guarda solo los ausentes y la lectura de clases es solo del docente.
- Recomendación: Sumar dos preguntas a docs/product/preguntas-abiertas.md: «¿El alumno ve presente o ausente por clase?» y «¿El docente ve las faltas acumuladas por alumno?». Mientras tanto, aclarar en Inasistencias con una línea: «Acá ves solo tus faltas». Si se aprueban: una lectura nueva en Cursada pensada para el alumno (sin reusar classesOf ni class-history) y una pastilla de faltas en StudentRow que reuse absencesOf.
- Criterios de aceptación:
  - Las dos preguntas están en preguntas-abiertas.md, marcadas como abiertas
  - /inasistencias aclara que solo lista faltas
  - Ningún alumno ve información de otros alumnos
- Archivos: `docs/product/preguntas-abiertas.md`, `hackai/app/(app)/inasistencias/page.tsx`, `hackai/lib/core/studies/absences-of.ts`, `hackai/app/(app)/materias/[subjectId]/alumnos/page.tsx`.
- Origen: N-38 (M: primera corrida; N: corrida sobre `main` nuevo).

#### U-85

**Pulir el selector de personas y el 404 de /caidas** · P3 · esfuerzo S · quick win

- Perfiles: docente-mayor, alumno-fi. Vistas: todas.
- Pantallas: `/`, `/caidas`.
- Problema: En /, Federico Juárez aparece solo como «Ciencias Empresariales» (detailOf devuelve la facultad si no hay carrera activa), y los docentes dicen solo «Docente · Ingeniería» o «Docente · Ciencias Empresariales». En el celular, el riel Todos/Alumnos/Docentes usa min-h-10 y sus contadores van en 11 px con opacity-70: el auditor marca 4 objetivos menores a 44 px. Con sesión y sin HACKAI_CAIDAS, /caidas responde 404 pero la pestaña dice «Caídas de la demo · Campus HackAI» (metadata fija en app/caidas/page.tsx:16, notFound() en la línea 43).
- Recomendación: En detailOf, para un alumno sin propuesta activa, mostrar «Alumno · propuesta pasiva · Facultad». Valorar sumar la materia principal a los docentes, sin tocar el orden de las personas del guion. Subir el riel a min-h-11 y los contadores a 12 px sin opacidad. En /caidas, pasar a generateMetadata y llamar a notFound() ahí.
- Criterios de aceptación:
  - Ninguna fila del selector queda sin rol
  - El riel mide 44 px o más y los contadores 12 px o más
  - El 404 de /caidas no muestra el título «Caídas de la demo»
- Archivos: `hackai/components/session/person-picker.tsx`, `hackai/components/session/person-text.ts`, `hackai/components/ui/rail.tsx`, `hackai/app/caidas/page.tsx`.
- Origen: M-4 (M: primera corrida; N: corrida sobre `main` nuevo).

#### U-86

**Poner Hoy primero en el menú del docente y hacer del logo un enlace al inicio** · P3 · esfuerzo S · quick win

- Perfiles: docente-medio, docente-mayor, docente-joven. Vistas: desktop, desktop-zoom.
- Pantallas: `Barra lateral del docente`, `/calendario`.
- Problema: Para el docente, Hoy es el inicio (homeFor, alcance.md), pero la barra lateral lista Materias, Hoy, Calendario y Novedades: TEACHER (app-nav.tsx:54) copia el orden del alumno. El logo de la barra lateral es un <span> dentro de SidebarTop, no un enlace. En /calendario, el botón de la semana se llama solo «Hoy» (calendar.tsx:421), igual que la sección Hoy, y hace otra cosa.
- Recomendación: Ordenar TEACHER como Hoy, Materias, Calendario, Novedades. TEACHER_TABS del celular puede seguir con Hoy al centro. Envolver el logo de la barra lateral en un Link a homeFor(rol). Renombrar el botón del calendario a «Ir a hoy» o «Volver a esta semana».
- Criterios de aceptación:
  - En compu, Hoy es el primer ítem del menú del docente
  - El menú del alumno no cambia
  - Un clic en el logo lleva al inicio del rol
  - El botón del calendario ya no se llama solo «Hoy»
- Archivos: `hackai/components/shell/app-nav.tsx`, `hackai/components/shell/brand.tsx`, `hackai/lib/home.ts`, `hackai/components/today/calendar.tsx`.
- Origen: M-14, N-33 (M: primera corrida; N: corrida sobre `main` nuevo).

#### U-87

**Ajustar las ilustraciones del encabezado: sacar los puntos de Hoy y diferenciar las secciones del alumno** · P3 · esfuerzo S

- Perfiles: alumno-fi, alumno-fce, docente-medio, docente-mayor. Vistas: mobile, desktop, desktop-zoom.
- Pantallas: `/hoy`, `/notas`, `/estado`, `/tramites`, `/inasistencias`.
- Problema: La grilla de puntos de hoy.svg (dos filas de 7, un punto hueco y uno naranja) parece el paginador de un carrusel, aunque ya no toca el saludo al 125 %. Notas, Plan de estudios, Trámites e Inasistencias usan la misma medalla con estrella (art='academico'), que no ayuda a ubicarse y en Inasistencias se lee como un premio. En el celular, la estrella queda pegada a «reportes» en «Trámites y reportes». El choque de la pastilla del docente con el radar de Novedades va en U-43.
- Recomendación: Sacar de hoy.svg la fila de puntos con el naranja, o dejarla pareja y sin el punto hueco. Para Inasistencias, Trámites y Plan de estudios, reusar una ilustración existente de public/headers (por ejemplo general o inscripciones) en lugar de la medalla. Si el equipo quiere arte nuevo, sumar variantes a HeaderArt. En el celular, correr la ilustración a la derecha o bajar su opacidad detrás de títulos largos.
- Criterios de aceptación:
  - Hoy no muestra una fila de puntos que parezca un paginador
  - Inasistencias no usa la medalla
  - A 390 px, ninguna ilustración toca el título de la pantalla
- Archivos: `hackai/components/shell/page-header.tsx`, `hackai/public/headers/hoy.svg`, `hackai/public/headers/academico.svg`, `hackai/app/(app)/inasistencias/page.tsx`, `hackai/app/(app)/tramites/page.tsx`, `hackai/app/(app)/estado/page.tsx`, `hackai/app/(app)/notas/page.tsx`.
- Origen: M-13, N-34 (M: primera corrida; N: corrida sobre `main` nuevo).

#### U-88

**Usar el mismo encabezado de la materia en Nueva tarea, Entrega y Pegar, y marcar las comisiones archivadas** · P3 · esfuerzo M

- Perfiles: docente-mayor, docente-medio, docente-joven. Vistas: desktop, desktop-zoom, mobile.
- Pantallas: `/materias/[subjectId]/tareas/nueva`, `/materias/[subjectId]/tareas/[taskId]`, `/materias/[subjectId]/tareas/[taskId]/entregas/[submissionId]`, `/materias/[subjectId]/calificaciones/pegar`, `/materias/aga`.
- Problema: Alumnos y clases, Tareas y Pegar ya muestran el chip «Docente · Comisión A» (#121). Nueva tarea y Pegar, en cambio, siguen armando TaskHeader más SubjectTabs sin SubjectToolbar: las pestañas quedan a la izquierda (x≈270) y Novedades queda dentro del banner, sobre la ilustración. El detalle de una tarea enlaza las pestañas sin ?comision. El DOM pone el selector de comisión antes que las pestañas, y en el detalle de la tarea las entregas antes que la tarea. /materias/aga, una comisión archivada del 1er cuatrimestre, se ve igual que una activa: compositor «Aviso para la Comisión A» habilitado, sin ninguna marca.
- Recomendación: Armar Nueva tarea, Entrega y Pegar con TaskHeader(sections=[selected]) + SubjectToolbar + toolbarBell, y pasar siempre la comisión elegida a SubjectTabs, usando las comisiones del docente y no las de la tarea. Ordenar el DOM igual que lo visual: pestañas antes del selector y, en el celular, la tarea antes de las entregas. Sumar una franja «Cuatrimestre cerrado · archivada» en las comisiones archivadas, y deshabilitar o avisar al publicar.
- Criterios de aceptación:
  - El encabezado y la barra tienen la misma forma y posición en Espacio, Alumnos y clases, Tareas, Nueva tarea, Entrega y Pegar
  - Las pestañas conservan ?comision en todas las subrutas
  - Una comisión archivada se identifica como tal y no deja publicar sin avisar
  - El orden de Tab coincide con el visual
- Archivos: `hackai/app/(app)/materias/[subjectId]/tareas/nueva/page.tsx`, `hackai/app/(app)/materias/[subjectId]/tareas/[taskId]/page.tsx`, `hackai/app/(app)/materias/[subjectId]/tareas/[taskId]/entregas/[submissionId]/page.tsx`, `hackai/app/(app)/materias/[subjectId]/calificaciones/pegar/page.tsx`, `hackai/components/coursework/task-header.tsx`, `hackai/components/subjects/subject-toolbar.tsx`, `hackai/app/(app)/materias/[subjectId]/page.tsx`.
- Origen: M-18 (M: primera corrida; N: corrida sobre `main` nuevo).

#### U-89

**Dar acciones a la lista de alumnos y mostrar los correos completos** · P3 · esfuerzo S

- Perfiles: docente-medio, docente-joven, docente-mayor. Vistas: todas.
- Pantallas: `/materias/[subjectId]/alumnos`, `/materias/[subjectId]?vista=directos`.
- Problema: La lista de «Alumnos y clases» muestra nombre, legajo y un mailto, sin ninguna acción: no hay «Escribirle» ni «Copiar mails». En ?vista=directos solo aparece lo que abrió algún alumno, con la nota «Tus alumnos te pueden escribir en privado», y no hay forma de iniciar un directo. Con letra grande, los correos se cortan sin «…» (StudentRow con truncate). La pestaña del navegador dice «Alumnos · Campus HackAI», sin la materia (metadata fija en alumnos/page.tsx:40).
- Recomendación: Mostrar StartDirect («Escribirle») en las filas que tienen personId y un «Copiar mails» arriba, y actualizar el comentario de directContacts en access.ts. Enlazar a Alumnos y clases desde el estado vacío de Directos del docente. Hacer que los correos hagan wrap con overflow-wrap:anywhere. Usar generateMetadata con la materia, como ya hace Tareas.
- Criterios de aceptación:
  - Desde la fila de un alumno con cuenta se abre un directo
  - Los correos se leen completos con letra del sistema de 20 px
  - El título de la pestaña incluye la materia
- Archivos: `hackai/app/(app)/materias/[subjectId]/alumnos/page.tsx`, `hackai/components/spaces/start-direct.tsx`, `hackai/components/spaces/direct-panels.tsx`, `hackai/lib/core/spaces/access.ts`.
- Origen: M-26 (M: primera corrida; N: corrida sobre `main` nuevo).

#### U-90

**Separar en Hoy las comisiones de próximos períodos y sumar su horario** · P3 · esfuerzo S · **A decidir**

- Perfiles: docente-joven, docente-medio, docente-mayor. Vistas: mobile, desktop.
- Pantallas: `/hoy`.
- Problema: «Tu próxima clase» (#118) ya responde «¿tengo clase y dónde?» para la clase más cercana. Pero las filas de «Tus comisiones» dicen solo «Comisión A · Grado 2do Cuatrimestre 2026», sin días, horario ni aula, y las comisiones del Curso de Verano 2027 se mezclan con las actuales con el mismo peso. Con cuatro comisiones, «Parciales y mesas» arranca en y≈995 en el celular, fuera de la primera pantalla. El horario y el aula ya existen en /materias.
- Recomendación: Llevarlo a la pregunta abierta #13 («¿Las materias de un período que todavía no empezó van con las actuales?»), cuya hipótesis hoy es mostrarlas juntas. Si se aprueba, agrupar «Tus comisiones» en «Este cuatrimestre» y «Próximas», o plegar las de Verano con un chip «Empieza ene 2027». Opcional: sumar una línea corta de horario («Vie 09:00 a 12:00») reusando el horario que ya trae /materias.
- Criterios de aceptación:
  - La decisión queda registrada en la pregunta #13
  - Si se hace, las comisiones de períodos futuros aparecen agrupadas o después de las actuales
  - Si se suma el horario, cada fila muestra días y horario
- Archivos: `hackai/components/today/teaching-screen.tsx`, `hackai/lib/core/today/index.ts`, `hackai/lib/core/studies/index.ts`, `docs/product/preguntas-abiertas.md`.
- Origen: M-31, N-21 (M: primera corrida; N: corrida sobre `main` nuevo).

#### U-91

**Pulir los mensajes y las señales después de inscribirse** · P3 · esfuerzo S · quick win

- Perfiles: alumno-fi, alumno-fce. Vistas: todas.
- Pantallas: `/inscripciones`, `/materias?ver=final-pendiente`.
- Problema: La confirmación dice «¿Te das de baja de el final de Contabilidad I del 14 dic?», y el nombre accesible, «Darme de baja de el final…». Ya inscripto en la mesa de SRE, el cupo sigue en rojo («Sin cupo · 2 de 2 lugares ocupados») junto al badge «Inscripto». «Ver en el calendario» y «Agregar a mi calendario» se confunden. La regularidad aparece dos veces, y «Listo, quedaste inscripto al final» va junto a «antes tenés que regularizar». En compu, el aviso de baja sigue en media columna junto a «Inscribirme» y el panel queda scrolleado, cortando el título (el comprobante ya no se parte). «Ver la mesa» usa ArrowUpRight (subject-grid.tsx:318) y mide 36 px.
- Recomendación: Contraer «de el» a «del» (label sin artículo) y sumar un test. Pasar el cupo a color neutro cuando alreadyEnrolled. Renombrar el segundo botón a «Descargar al calendario del celu», con ícono de descarga. Dejar la condición en un solo aviso y usar un éxito condicional. Mostrar el resultado de la baja a todo el ancho y usar focus({preventScroll:true}). Usar ChevronRight con min-h-11 en los enlaces internos.
- Criterios de aceptación:
  - No aparece «de el» ni en el texto ni en el nombre accesible
  - Con el badge «Inscripto», el cupo no va en rojo
  - Después de darse de baja en compu, el panel no queda cortando el título
  - Los enlaces internos no usan el ícono de enlace externo y miden 44 px
- Archivos: `hackai/components/enrollment/offer-detail.tsx`, `hackai/components/enrollment/enrollment-actions.tsx`, `hackai/components/enrollment/format.ts`, `hackai/components/enrollment/enrollment-lists.tsx`, `hackai/components/subjects/subject-grid.tsx`.
- Origen: M-68 (M: primera corrida; N: corrida sobre `main` nuevo).

#### U-92

**Explicar el estado de cada solicitud y volver bien desde la Autogestión** · P3 · esfuerzo M

- Perfiles: alumno-fi, alumno-fce. Vistas: todas.
- Pantallas: `/tramites`, `/simulado/siu/constancias/solicitar`.
- Problema: Las filas de Solicitudes son <li> sin acción. «Rechazada» no da el motivo ni qué hacer, y «En trámite» no dice desde cuándo. El formulario «Nueva solicitud» pide solo «Qué necesitás» y «Comentario (opcional)», aunque el tipo sea «Cambio de comisión». «Volver a HackAI» de la Autogestión simulada va a / (simulado/[sistema]/[[...ruta]]/page.tsx:98) en la pestaña que abrió certificate-card con target _blank, así que el alumno termina con dos pestañas de HackAI.
- Recomendación: Sumar debajo del estado una línea de ayuda («Rechazada: escribile a la secretaría»). El detalle con línea de tiempo es opcional. Mostrar campos según el tipo (materia y comisión destino, obligatorios, para el cambio de comisión). En la página simulada, que «Volver» cierre la pestaña si la abrió HackAI, o que lleve al origen.
- Criterios de aceptación:
  - Cada estado tiene un próximo paso legible
  - Cambio de comisión pide materia y comisión
  - Volver desde la Autogestión no deja una pestaña duplicada de HackAI
- Archivos: `hackai/components/procedures/requests.tsx`, `hackai/components/procedures/siu-requests.tsx`, `hackai/components/ui/status-pill.tsx`, `hackai/app/simulado/[sistema]/[[...ruta]]/page.tsx`, `hackai/components/academic/certificate-card.tsx`.
- Origen: M-78 (M: primera corrida; N: corrida sobre `main` nuevo).

#### U-93

**Darle título al 404 raíz y, con sesión, mantener el shell** · P3 · esfuerzo S

- Perfiles: alumno-fce, docente-mayor. Vistas: mobile, desktop.
- Pantallas: `/<ruta inexistente>`.
- Problema: Con la sesión iniciada, una ruta inexistente muestra «No encontramos esta pantalla» con «Ir al inicio», pero sin barra inferior, campana ni perfil, y la pestaña dice solo «Campus HackAI». El error de materia inexistente sí conserva el shell. Que el 404 vaya fuera de las pantallas de adentro es una decisión documentada en app/not-found.tsx, y un not-found dentro de (app) no atrapa las URL sin ruta.
- Recomendación: Agregar a app/not-found.tsx un title en la metadata («Pantalla no encontrada · HackAI»). Opcional: en ese mismo not-found raíz, leer la sesión y montar AppNav si existe.
- Criterios de aceptación:
  - La pestaña del navegador en un 404 dice que la pantalla no existe
  - «Ir al inicio» sigue llevando al inicio del rol
- Archivos: `hackai/app/not-found.tsx`, `hackai/app/layout.tsx`.
- Origen: N-36 (M: primera corrida; N: corrida sobre `main` nuevo).

#### U-94

**Pegar el estado a la fecha de cada falta y enlazar a la materia** · P3 · esfuerzo S

- Perfiles: alumno-fi, alumno-fce. Vistas: desktop, mobile.
- Pantallas: `/inasistencias`.
- Problema: Cada falta de Inasistencias es texto plano, sin enlace a la materia. En compu, la fecha queda a la izquierda y «Justificada» o «Sin justificar» unos 750 px a la derecha (justify-between dentro de max-w-3xl), así que cuesta emparejarlos.
- Recomendación: Mostrar el estado como chip junto a la fecha («18 sept · Justificada») y agregar «Ir a la materia» al pie del desplegable. «Cómo justificarla» solo si Trámites tiene ese trámite (pregunta 31: HackAI no justifica faltas).
- Criterios de aceptación:
  - A 1440 px, la fecha y el estado de cada falta están juntos
  - El desplegable de cada materia tiene un enlace a /materias/<id>, en compu y en el celular
- Archivos: `hackai/components/absences/absences-list.tsx`.
- Origen: N-37 (M: primera corrida; N: corrida sobre `main` nuevo).

#### U-95

**Agrupar la hoja «Más» con títulos** · P3 · esfuerzo S · quick win

- Perfiles: alumno-fce, alumno-fi. Vistas: mobile.
- Pantallas: `Hoja «Más» (celular)`.
- Problema: La hoja «Más secciones» del alumno no anticipa qué tiene y mezcla Inasistencias (de uso diario) con Plan de estudios y Trámites (de carrera), sin títulos de grupo. En compu esas secciones se agrupan con «Tu carrera». Los órdenes distintos entre el celular y compu son a propósito. El cierre y la vuelta del foco van en U-11.
- Recomendación: Sumar GroupLabel en la hoja («Día a día» y «Tu carrera») y un título más claro. No forzar el mismo orden que en compu.
- Criterios de aceptación:
  - La hoja muestra grupos con título
  - Los objetivos siguen midiendo 48 px de alto
  - El orden de compu no cambia
- Archivos: `hackai/components/shell/tab-bar.tsx`, `hackai/components/shell/app-nav.tsx`.
- Origen: N-35 (M: primera corrida; N: corrida sobre `main` nuevo).

## Resuelto en main

Lo que la primera corrida marcó y #118 o #121 ya arreglaron, entero o en parte. Lo que falta de cada uno está en la mejora que se indica.

- **M-10, Que la barra lateral muestre todas sus secciones al 125 %**: #121 hizo la barra lateral más angosta y compacta, metió Novedades en el menú, bajó la caja de Cuenta y sumó «Plegar la barra lateral». A 1152×720, «Trámites y reportes» queda en y≈512–554, por encima de Cuenta (y≈648), sin scroll. No se agregó un degradé, y en notebooks de 600 a 650 px de alto el ítem podría volver a quedar tapado.
- **M-12 (parte), Una sola entrada a Novedades en compu para el alumno**: #121 pasó desktopBell={false} en las pantallas del alumno. En /novedades y /calendario, la pastilla queda solo para el profesor. Lo que falta, para el docente y en el celular, quedó en U-43.
- **M-13 (parte), Arte del encabezado detrás de la campana en las pantallas del alumno**: Sin campana en el encabezado del alumno en compu, la medalla ya no queda detrás de ningún botón. El arte del error de materia ahora es un libro abierto que no cruza la campana. Lo que falta quedó en U-43 y U-87.
- **M-17 (parte), «Calificaciones» choca con el botón Novedades al 125 %**: Con la barra lateral más angosta de #121 quedan 24 px entre «Calificaciones» y «Novedades». El selector tapado sigue en U-2.
- **M-18 (parte), Chip de comisión en Alumnos y Tareas**: #121 sumó el chip «Docente · Comisión A» y la misma forma de barra en Alumnos y clases, Tareas y Pegar. Nueva tarea, Entrega y la comisión archivada siguen en U-88.
- **M-21 (parte), Offset fijo del compositor**: composer-dock.tsx pasó del bottom fijo de 67 px a var(--tabbar-space) + 0.5rem por la barra de vidrio de #121. El hueco que queda está en U-78.
- **M-43 (parte), Tipo de instancia cortado en Evaluación**: #121 pasó el Tipo a un Radix Select y ya no se corta «Recuperatoric». La fecha y la hora siguen en U-58.
- **M-53 (parte), Publicar la nota de cursada sin pesos**: El botón de publicar queda deshabilitado cuando nadie tiene nota de cursada, y Evaluación muestra «N con nota» por columna y un total de pesos. Falta explicar por qué, y eso quedó en U-63.
- **M-59 (parte), Selector «Materia» del calendario cortado con letra grande**: #121 lo pasó a un Radix Select de ancho completo y 44 px de alto en pantallas angostas. Se ve entero con letra grande.
- **M-63 (parte), El filtro de Novedades salta de lugar**: #121 subió el filtro arriba de las notas nuevas en news-filter.tsx.
- **M-73 (parte), Filtros de Notas que empujan la lista en el celular**: #121 rehízo los filtros: dos selects y un segmentado. En 390×844 la primera tarjeta arranca en y=467 y se ve completa, y en compu los selects ya no se cortan. El desborde con letra grande sigue en U-73.
- **M-80 (parte), Chip «En curso» estirado y detalle cortado de la docente al 125 %**: #121 dejó de mostrar el chip en las tarjetas en curso, y al 125 % la docente ve completo «AM1 · Comisión A · Grado 2do Cuatrimestre 2026». El alto fijo, el hueco y el corte del alumno siguen en U-77.
- **M-31 (parte), «¿Tengo clase hoy y dónde?» en Hoy del docente**: #118 sumó la tarjeta «Tu próxima clase» con materia, comisión, día, horario, modalidad y aula. Lo que queda (comisiones de próximos períodos y horario en cada fila) está en U-90.

## Qué funciona y hay que conservar

- Entrar a la demo cuesta 1 toque, sin clave, con estados vacíos y de sesión vencida bien escritos en voseo
- Las tareas frecuentes mejoran la línea base: último aviso en 1 toque (Campus: 3), promedio en 1 (SIU: 2), «qué me falta» con respuesta directa, Novedades en 2 y entrar a una comisión desde Hoy en 1
- #121 dejó la barra lateral completa al 125 %, con Novedades dentro del menú y un botón para plegarla
- #121 sacó la pastilla Novedades duplicada del encabezado del alumno en compu, así que el alumno tiene una sola entrada
- #118 sumó «Tu próxima clase» en Hoy, con materia, comisión, día, horario, modalidad y aula, que responde «¿tengo clase y dónde?»
- Alumnos y clases, Tareas y Pegar ya comparten el chip «Docente · Comisión A» y la forma de la barra
- Los filtros de Notas de #121 dejan ver la primera materia completa a 390×844, y el selector Materia del calendario ya no se corta con letra grande
- La inscripción en un paso deja al alumno anotado en el SIU, en el aula y en el espacio a la vez, con comprobante, y la baja pide confirmación con el foco en «Cancelar»
- El diseño responsive es de verdad: barra inferior de vidrio en el celular, grilla semanal en compu y lista y detalle en dos columnas, sin scroll horizontal con letra normal
- La planilla por columna, la separación entre guardar y publicar, y la vista previa del pegado que explica cada fila son modelos a conservar
- El compositor dice a quién le llega lo que se escribe («Aviso para la Comisión A») y deshabilita Enviar con el campo vacío
- Voseo consistente, nombres pensados para el alumno («Notas», «Plan de estudios», «Trámites y reportes») y rótulos honestos sobre los límites de los datos («Es una simulación», «Estimado por HackAI»)

## Sin cubrir

- La corrida nueva cubrió solo shell, hoy y asistencia. Materias, tareas, calificaciones, inscripciones, académico, calendario, novedades y trámites se revalidaron contra los hallazgos viejos, pero no se buscaron problemas nuevos introducidos por #121 en esos módulos (por ejemplo, el desborde de /notas con letra grande apareció de casualidad)
- Ningún recorrido vio el formulario editable de tomar lista, el guardado ni el pase al SIU: con el reloj fijo ninguna docente tiene clase (U-6)
- El perfil opcional alumno-pasivo no tuvo recorrido propio
- El ingreso con la cuenta real del SIU (/entrar-con-siu, ADR 0009) no se pudo revisar, porque siuLive no tiene canConnect en este entorno
- No se probaron las caídas de SIU, Moodle o Espacios (sin HACKAI_CAIDAS) ni una caída de red real con el service worker
- Las correlativas no están modeladas y FCE no tiene casos de cupo lleno, así que no se probó cómo se explican esos bloqueos
- No se probaron subir y reemplazar entregas, adjuntar en el espacio ni ver como alumno una devolución publicada
- No se tocaron la descarga Excel, el .ics de «Agregar a mi calendario» ni los .html de reportes en un iPhone real, ni gestos de deslizar, el teclado virtual de iOS ni el aviso de instalación de Android
- desktop-zoom y mobile-texto-grande no se recorrieron en todos los perfiles y módulos
- Los datos en memoria compartidos entre agentes cambiaron contadores, consultas y tareas durante los recorridos, así que varios hallazgos se confirmaron por código
- No hay línea base de clics para tareas docentes en docs/product/problema.md
- Quedan para decidir con el equipo, no como defecto: editar o borrar avisos publicados, entregas por corregir en Hoy del docente, la ficha por alumno, la confirmación al republicar notas (pregunta #28), la novedad por tarea nueva, los adjuntos de avisos en Material y si la docente ve las faltas acumuladas por alumno

## Próximo paso

Sacar los issues con la skill `to-tickets`, empezando por los P0 y los quick wins P1. Cada mejora de arriba ya trae problema, recomendación, criterios de aceptación y archivos. Las marcadas «a decidir» primero pasan por `docs/product/preguntas-abiertas.md`. Para volver a medir después de implementar, correr `recorrer-ux` con los módulos tocados.
