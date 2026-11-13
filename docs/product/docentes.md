# Docentes: problemas y plan

**Estado al 12/11/2026: decidido** (ver [Decisiones del 12/11](#decisiones-del-1211)). Junta lo que contaron una profesora, una persona de Admisiones y un profesor, y lo cruza con lo que ya tiene HackAI y con el repo de Nacho (`campus/`). Los docentes entran al [alcance](alcance.md).

## Decisiones del 12/11

- **Docentes en el alcance.** Entra el recorte de abajo, además del espacio de la materia.
- **Tarjeta de la materia sin faltas.** La línea de inasistencias se saca del todo; las faltas viven en la sección Inasistencias.
- **Entregas propias.** Las entregas de trabajos prácticos dejan Moodle: el docente crea las tareas en HackAI y los alumnos entregan ahí. Reemplaza la fila «Entregas: Moodle» del alcance.
- **Tomar lista: opción A para arrancar.** Todos presentes y el docente toca a los ausentes, en cualquier modalidad. QR, código y Zoom se iteran después.
- **Las clases virtuales son por Zoom.** La comisión virtual o híbrida tiene su enlace de Zoom, que carga el docente.
- **Excel de la materia.** El docente descarga un Excel con los alumnos de la materia, una hoja por comisión, para no escribirlos uno por uno (D16).
- **Se carga una vez, en HackAI, y HackAI lo pasa al SIU.** Hoy el docente carga en el SIU, alumno por alumno, las notas y las faltas, y es lo más tedioso. Con HackAI:
  - las faltas y las notas se cargan en HackAI;
  - HackAI las guarda y el alumno las ve enseguida en Notas e Inasistencias, sin depender del SIU;
  - HackAI las pasa al SIU si el SIU lo permite, así se actualiza la base del SIU y el docente no carga dos veces.

## Fuentes

Lo que dijo cada uno, con las transcripciones de los audios: [`docs/entrevistas/docentes-y-admisiones.md`](../entrevistas/docentes-y-admisiones.md).

- **Profesora** (audio de WhatsApp, 12/11): usa poco el Campus. Del SIU necesita reportes certeros por materia, y los arma a mano bajando varios reportes y juntándolos.
- **Admisiones** (audio de WhatsApp, 12/11): no usa el SIU. Los ingresantes se traban con el mail Austral y con el Campus. El material del curso de ingreso termina bajado en PDF y mandado por WhatsApp.
- **Profesor** (contado por el equipo, 12/11): tomar lista en el SIU le lleva de 10 a 15 minutos por clase. Además pide cargar notas, crear entregas y adaptar las herramientas a la modalidad de la clase.
- **Repo de Nacho:** lo revisó un agente el 12/11 sobre `campus/`; el resumen está más abajo. Coincide con [la research del repo](../research/2026-11-10-repo-campus-nacho.md).

## Problemas, uno por uno

Viabilidad: **demo** entra para el viernes 13/11; **después** es viable, pero no llega; **pitch** se cuenta, no se construye; **no** queda descartado.

| # | Problema | Quién lo dijo | Viabilidad | Tamaño |
| --- | --- | --- | --- | --- |
| D1 | Tomar lista lleva de 10 a 15 minutos por clase | Profesor | **demo** | M |
| D2 | El docente no ve a los alumnos de su comisión | Profesor | **demo** (D1 lo necesita) | S |
| D3 | Las faltas del alumno están en la tarjeta de la materia y la ensucian | Profesor | **demo** | S |
| D4 | Cargar notas con comentario y publicarlas a los alumnos | Profesor | **demo** con recorte | M |
| D5 | Nota de cursada con pesos por evaluación, calculada sola | Profesor | **demo** con recorte | S, si D4 está |
| D6 | Subir notas desde Excel o Google Sheets | Profesor | **demo**: pegar desde la planilla; `.xlsx`, **después** | S a M |
| D7 | Espacios de entrega que crea el docente, con fecha límite y atrasadas | Profesor | **demo** (decidido 12/11: las entregas dejan Moodle) | L |
| D8 | Docentes con varias materias y comisiones | Profesor | **demo**: ya está en el modelo, falta la UX | S |
| D9 | Modalidad presencial, virtual o híbrida con las mismas herramientas | Profesor | **demo** solo en la lista; el resto, **después** | S a M |
| D10 | Reportes por materia: cuántos la deben, cuántos deben el final, cuántos la cursan el año que viene | Profesora | **pitch**; **después** como rol de gestión | M |
| D11 | Excel por alumno con las materias aprobadas | Profesora | **después** | S |
| D12 | Reporte de asistencia por materia | Profesora | **después**, sale gratis de D1 | S |
| D13 | Ingresantes trabados con el mail Austral y las contraseñas | Admisiones | **no**: es de Sistemas; **pitch**: con el ingreso de Microsoft hay una sola cuenta | – |
| D14 | Material del curso de ingreso por PDF y WhatsApp | Admisiones | **pitch**: un espacio de la materia para aspirantes | M |
| D15 | Tutoriales para entender el Campus | Admisiones | **no** como tutorial: la pantalla tiene que entenderse sola | – |
| D16 | El docente escribe a mano los alumnos de cada comisión en su planilla | Equipo | **demo** | S a M |

### D1 y D2. Tomar lista en menos de un minuto (spike)

**Por qué tarda hoy:** el profesor recorre la lista entera en el SIU y marca a cada alumno. Los 10 a 15 minutos son lo que contó, no está medido.

**Opciones:**

| Opción | Cómo funciona | Veredicto |
| --- | --- | --- |
| A. Todos presentes, tocás a los ausentes | La lista de la comisión arranca con todos presentes. El docente toca a los que faltan y guarda. En una clase de 30 con 3 ausentes son 4 toques | **Base.** Funciona sin que el alumno haga nada y sin señal |
| B. QR en el aula | El docente proyecta un QR que cambia cada 30 segundos y los alumnos lo escanean con HackAI abierto. La lista se llena sola y el docente revisa | **Complemento** de A. Riesgo: el QR se pasa por WhatsApp. El código que rota lo achica, no lo elimina |
| C. Código en la reunión | En una clase virtual el docente pega un código de 4 dígitos en el chat de la reunión y el alumno lo escribe en HackAI | **Complemento** para virtual e híbrida |
| D. Reporte de participantes de Zoom | Leer quién estuvo en la reunión | **Después**: necesita una app de Zoom con permisos de la cuenta de la Austral |
| E. Foto del aula o reconocimiento facial | – | **No.** Los datos biométricos son sensibles (Ley 25.326) |
| F. Ubicación o Bluetooth | – | **No.** Mucha complejidad y falla en el aula |

**Decidido (12/11):** opción A para tener el flujo completo; las demás se iteran después. Desde Hoy, el docente ve «Tu clase de ahora» con el botón **Tomar lista**. Si dicta varias clases, es la del horario más cercano. Se abre la lista, el docente toca a los ausentes, guarda, y queda la clase en el historial: fecha, modalidad, presentes y ausentes. Una clase guardada se corrige el mismo día.

**El momento de la demo:** el docente marca ausente a un alumno y, del otro lado, ese alumno ve la falta en su pantalla de Inasistencias.

**Cómo encaja en la arquitectura:**

- **HackAI guarda la asistencia** en un almacén propio de Cursada, junto a las inasistencias que ya lee del SIU. El alumno ve la falta enseguida, aunque el SIU no responda.
- **Después la pasa al SIU** por el puerto del SIU, con una operación nueva detrás de una capacidad (que el adaptador diga si el SIU deja escribir asistencia):
  - El SIU simulado dice que sí y la guarda en `siu_*`.
  - Cada clase guarda su estado: pendiente, pasada al SIU o el SIU no lo permite. Si el pase falla, queda pendiente y se reintenta, como un mensaje pendiente de Discord en Espacios.
- **La API real del SIU no tiene escritura de asistencia**, según la [research](../research/2026-11-10-siu-guarani-integracion.md): solo lee, y escribe únicamente el vínculo con Moodle.
  - En producción el adaptador lo declara y la clase queda «sin pasar al SIU».
  - Para pasarla hace falta que la Austral o el SIU habiliten la escritura, o importar un archivo si el SIU lo acepta (hipótesis, a investigar). Es para el pitch.
- **En Inasistencias del alumno**, una clase que tomó HackAI se ve como la guardó HackAI. Las faltas que solo están en el SIU, por ejemplo las que cargó la bedelía, se siguen viendo.
- D2 es una lectura nueva en Cursada (`rosterOf(docente, comisión)`). Hoy no existe, y por eso los directos los abre solo el alumno.

**Hipótesis a confirmar:** que el SIU de la Austral registre la asistencia por clase, con tipo de clase y tema dictado. El reporte de Inasistencias del alumno muestra esas columnas, así que es probable.

**Cómo se mide:** se suma una tarea al estilo de las del alcance, T6 «tomar lista»: cronómetro con un docente en el SIU y en HackAI.

### D3. Inasistencias como sección del alumno

- **Hoy:** cada tarjeta de Materias trae una línea «3 de 8 faltas · te quedan 5» (`components/subjects/subject-grid.tsx`).
- **Propuesta:** sacar esa línea y sumar **Inasistencias** a la barra lateral, en «Más» del celular, que ya tiene 4 accesos abajo. Hay una fila por materia que se despliega con cada falta: fecha y si está justificada, y tipo de clase y tema si el SIU los da. Arriba de cada fila va «3 de 8 · te quedan 5».
- **Decidido (12/11):** la tarjeta queda sin nada de faltas. El aviso de que está cerca del máximo, que ya calcula Cursada, se muestra en la fila de la materia en Inasistencias.
- **Costo:** chico. El puerto del SIU ya trae cada falta con su fecha (`SiuAbsence`); falta exponer el detalle desde Cursada y armar la pantalla.

### D4, D5 y D6. Calificaciones de la comisión

**Se carga una vez** (decidido el 12/11). Hoy el docente carga las notas en el SIU alumno por alumno.

- **En HackAI:** el docente carga la nota y el comentario, o los pega desde la planilla, y publica.
- **Lo que ve el alumno:** al publicar, la nota y el comentario aparecen en Notas, en la campana y en Novedades, guardados en HackAI. No depende del SIU.
- **Lo que pasa al SIU:** HackAI le pasa al SIU lo que el SIU tiene, con el mismo estado de pase que la asistencia: las notas de las evaluaciones del SIU (los parciales) y la nota de cursada.
- **Lo que no pasa:** una tarea que no existe en el SIU queda solo en HackAI y cuenta para la nota de cursada.

**En Notas del alumno:** para una evaluación con nota en HackAI se ve la de HackAI. Las del SIU que no pasaron por HackAI (otras materias, la historia) se siguen viendo como hoy. Hipótesis: que el SIU y HackAI no difieran después del pase. Si la bedelía corrige una nota en el SIU, falta definir cuál se muestra.

**Qué columnas tiene:** una por cada cosa que se califica en la comisión, de dos tipos:

- **Tareas de HackAI** (D7), las que crea el docente. Una tarea sin nota, como una guía de apoyo, no tiene columna.
- **Evaluaciones del SIU:** los parciales del cronograma. El docente no las crea ni les cambia la fecha; les pone nota y peso, y la nota pasa al SIU.

**Flujo, parecido al de calificar del Campus:**

1. En la materia, el docente entra a **Calificaciones** de su comisión.
2. Ve una columna por tarea o evaluación, cada una con su peso.
3. Toca un alumno y carga la nota y el comentario. Anterior y Siguiente lo llevan por la lista sin volver a la tabla, como en el repo de Nacho. En una tarea ve además la entrega.
4. **Publicar** le avisa a los alumnos: aparece en la campana y en Novedades, que ya muestran notas nuevas. El comentario se ve entero, sin cortarse con «...» como en el Campus.

**Nota de cursada (D5):** el promedio ponderado de las evaluaciones con nota. El docente puede pisarla a mano y queda marcada como editada.

- **Hipótesis a confirmar:** que un recuperatorio reemplace al parcial y que haya un mínimo para regularizar. Son reglas de cada cátedra o de la facultad, no las sabemos.

**Subir desde una planilla (D6):**

- **Para la demo, pegar desde la planilla.** El docente copia las columnas en Excel o Google Sheets y las pega en HackAI. Llega como texto separado por tabulaciones y no necesita ninguna dependencia nueva.
- HackAI reconoce la columna del alumno (legajo, DNI, mail o nombre) y la de la nota.
- Convierte la escala: de 0 a 100 a de 1 a 10, coma o punto decimal, «A» de ausente.
- Antes de publicar muestra una vista previa con lo que no pudo emparejar.
- **Después, `.xlsx`.** Leer el archivo necesita una librería, y eso pide una ADR por la regla de stack fijo. Para Google Sheets alcanza con pegar o con el CSV que exporta; conectarse a su API suma OAuth y no vale la pena.

### D7. Espacios de entrega creados por el docente

**Decidido (12/11):** las entregas de trabajos prácticos dejan Moodle y se hacen en HackAI. Antes el [alcance](alcance.md) decía «Entregas: Moodle, con enlace directo».

**Cómo funciona:**

- **El docente crea la tarea** en la materia, para una o varias de sus comisiones: nombre, consigna (texto y un archivo opcional), fecha límite y si lleva nota. Después puede cambiarle el nombre, la consigna y la fecha.
- **El alumno entrega** desde la materia: sube uno o más archivos con Archivos (el puerto que ya existe) y puede reemplazarlos hasta que el docente califica.
- **Cada entrega guarda cuándo se hizo.** Si es después de la fecha límite queda marcada **atrasada**, con cuánto. No se bloquea: el docente decide qué hace con una atrasada.
- **El docente ve** quién entregó, quién no y quién entregó tarde, y califica desde ahí (D4).
- **Las tareas con fecha** entran en «qué me toca», en el calendario y en el `.ics` del alumno, como hoy las de Moodle.
- **Las tareas de Moodle se siguen mostrando** con su enlace, para las cátedras que todavía no se pasaron. Es la misma adopción gradual que los avisos de Moodle.

**Dónde va en la arquitectura:** tareas, entregas y calificaciones son datos propios de HackAI, con tablas en `supabase/migrations/`. No entran en ninguno de los cuatro módulos actuales:

- `spaces` es mensajería y material.
- `studies` es lo que viene de los sistemas de origen.

Propuesta: un **quinto módulo, Seguimiento (`coursework`)**, con tareas, entregas, calificaciones y nota de cursada. La asistencia queda en Cursada (ver «Cómo se divide»).

- **Lo que hace:** guarda cada registro y su estado de pase al SIU, y lo pasa al SIU llamando a Cursada. Cursada es la que habla con el puerto del SIU.
- **Lo que usa:** Cursada (comisiones, alumnos, clases y evaluaciones), Personas, Archivos y el reloj. Hoy lo usa a él.
- **Sin ciclos:** Cursada no lo llama.
- **Las vistas del alumno:** Notas y la campana juntan lo de Seguimiento con lo del SIU. Lo hace quien compone las dos lecturas. Inasistencias lo junta Cursada adentro.

Sumar el módulo pide actualizar `hackai/docs/ARQUITECTURA.md` y la regla de AGENTS.md que dice «cuatro módulos».

### D8. Docentes con varias materias y comisiones

El modelo ya lo soporta: `sectionsOf` da todas sus comisiones y Hoy del docente las lista. Falta que no se pierda:

- **Hoy** arranca por **la clase de ahora o la próxima**, según el horario del SIU. Es la puerta a tomar lista. Debajo, sus comisiones agrupadas por materia.
- **Dentro de la materia**, si tiene más de una comisión, un selector arriba. Por defecto, la de la clase de hoy.
- **Lo que es de la materia, para toda la materia:** el material y las evaluaciones compartidas (el mismo parcial para la A y la B).
- **Lo que es de la comisión, por comisión:** lista, asistencia, notas y `#avisos`.
- Hay **cero ítems nuevos en la navegación del docente.** Alumnos y clases, Tareas y Calificaciones viven dentro de la materia, junto al espacio. Hoy es la entrada rápida.

### D9. Presencial, virtual e híbrida

La queja: «La dinámica presencial, virtual, híbrida no tiene nada que ver y las herramientas que el sistema pretende que uses son exactamente las mismas».

**Propuesta:** HackAI no cambia de herramientas según la modalidad: cambia **cómo se hace lo mismo**.

- La modalidad viene de la comisión en el SIU (`presencial`, `virtual` o `hibrida`, ya en el puerto).
- Que el docente la cambie para una clase puntual queda para después.
- Las clases virtuales son por **Zoom**: la comisión virtual o híbrida tiene un enlace de Zoom que carga el docente una vez.

| | Presencial | Virtual (Zoom) | Híbrida |
| --- | --- | --- | --- |
| Tomar lista | Toques (A) | Toques (A), con la ventana de Zoom al lado | Toques (A) |
| Lo que ven alumno y docente en la clase de hoy | Aula y horario | **Entrar a Zoom**, arriba de todo | Aula, horario y Entrar a Zoom |

El docente lo ve en su clase de Hoy. El alumno no tiene Hoy (PR #88): lo ve en la tarjeta de la materia el día de clase y en Calendario.

**Para la demo:** la etiqueta de modalidad en la clase, el enlace de Zoom en la clase de hoy y la opción A en todas. **Después:**

- en la lista, las marcas «en el aula» y «remoto»;
- el código en la reunión (C);
- el reporte de participantes de Zoom (D);
- la grabación de Zoom al material.

### D16. Excel de la materia

**Qué es:** desde la materia, el docente toca **Descargar Excel** y baja un `.xlsx` con una hoja por cada comisión suya de esa materia. Cada hoja trae:

- una fila por alumno, con legajo, apellido, nombre y mail;
- una columna por tarea o evaluación calificable de la comisión, con la nota si ya la cargó, y la nota de cursada.

Así el docente arma su planilla sin escribir alumno por alumno. La puede completar y volver a pegar en Calificaciones (D6).

**Sin dependencias nuevas:** un `.xlsx` es un ZIP con XML adentro. Se escribe con un generador propio y chico: el ZIP va sin comprimir y con el CRC32 de `node:zlib`. Si eso no alcanza, la librería entra con una ADR, como pide la regla de stack fijo. **Hipótesis:** que Excel y Google Sheets abran bien un ZIP sin comprimir; se verifica al implementarlo.

**Datos personales:** en la demo son sintéticos. En producción el docente ve lo mismo que ya ve en el SIU, solo de sus comisiones.

### D10, D11 y D12. Reportes para secretarías y coordinación

Son pedidos de **gestión**, un rol que HackAI no tiene: no es ni alumno ni docente. Lo bueno es que la lógica ya existe por alumno:

- `pendingFinals` sabe qué finales debe cada uno.
- `career` sabe qué tiene aprobado.

Sumarla por materia responde «cuántos deben el final de X» y «cuántos la tienen que cursar el año que viene». La exportación va en CSV con `;` y BOM, que Excel abre bien, como hace el repo de Nacho, sin dependencias.

**Recomendación:** pitch, con una frase y quizá una captura. Construirlo es **después** y pide el rol de gestión y permisos.

**En producción:** la API del SIU lee la historia de a un alumno por vez, así que un reporte de toda la facultad tarda. Habría que calcularlo de noche, o pedir acceso a las bases de reportes del SIU (hipótesis).

### D13, D14 y D15. Admisiones

No son de docentes y la persona de Admisiones lo aclara: ni el SIU ni el Campus son suyos. Sirven para el pitch:

- **D13:** en producción se entra con la cuenta de Microsoft de la Austral, que es la misma del mail. Es una contraseña menos, no el arreglo del alta de la cuenta.
- **D14:** un espacio de la materia para el curso de ingreso, con el material y su canal externo. Hoy lo resuelven a mano por WhatsApp. Hipótesis: el aspirante no tiene comisión en el SIU, así que la membresía no saldría de `sectionsOf`.
- **D15:** HackAI no debería necesitar un tutorial. Los estados vacíos explican qué va ahí y qué hacer.

## Repo de Nacho: qué nos sirve para docentes

Revisado sobre `campus/app/profesor/`. Es un curso único (`COURSE_ID` fijo) sin comisiones, sin modalidad y **sin asistencia**: lo más parecido es el resultado «ausente» de un sorteo, que aplica a un alumno y no a la clase. Se reimplementa la idea, nunca el código.

| Funcionalidad | Qué hace | ¿Nos quedamos? |
| --- | --- | --- |
| Inicio del profesor con atrasados | Quiénes no entregaron, en 0 clicks | **Sí, la idea**, en Hoy del docente, después |
| Corrección con Anterior/Siguiente | Corregir sin volver a la lista, 3 clicks | **Sí**, en el flujo de D4 |
| Devolución con plantilla y borrador | Comentario por alumno, se guarda y se publica | **Sí, en simple**: comentario y publicar, sin plantilla |
| Rúbrica por criterios con pesos | Nota de 0 a 100 por criterio | **No para la demo**: nota directa y comentario. Después, si una cátedra la pide |
| Export CSV (`;`, BOM UTF-8) | Abre bien en Excel | **Sí**, para D10 a D12 |
| Check-in del alumno por código o QR (`/s/[code]`) | Entrar a la clase en vivo | **Sí, la idea**, para las opciones B y C de D1 |
| Chips de un toque en la consola | Participó, pasó o ausente | **Sí, el patrón** para la lista de D1 |
| Office hours con cupo | El alumno reserva una franja | **Después**: no lo pidió nadie |
| Pre-evaluación con IA | Nivel sugerido por criterio | **No por ahora**: suma un paso y una decisión de IA sin pedido |
| Revisión entre pares | Asignación y discordancias | **No**: es de una cátedra |
| Clase en vivo, decks, agente de voz, transcripción y analítica por slide | Dar la clase desde la app | **No**: es la forma de dar clase de Nacho, no un problema de los docentes que escuchamos |
| Casos, sorteo, radar, simuladores, organizaciones | Dinámicas de su materia | **No** |
| Padrón con PIN y tokens MCP | Acceso propio | **No**: entramos con Microsoft |

## Criterios de diseño para docentes

- **Celular primero.** La lista se toma parado en el aula con una mano: botones grandes, todo a un toque y nada que dependa de una tabla ancha.
- **Una entrada por tarea.** Tomar lista sale de Hoy, y las notas y los alumnos, de la materia. La navegación del docente no suma ítems.
- **Por defecto lo común.** Todos presentes, la comisión de la clase de hoy y la modalidad del horario. El docente solo toca lo que cambia.
- **Nada sin pedido.** Rúbricas, IA, pares y plantillas quedan afuera hasta que un docente las pida.
- **Se carga una vez.** Lo que carga el docente en HackAI lo ve el alumno enseguida y pasa al SIU si el SIU lo permite. El docente ve si ya pasó.

## Recorte para la demo

En orden, para que siempre haya algo que mostrar:

1. **D3:** Inasistencias del alumno. Es chico y deja lista la otra punta de D1.
2. **D2, D1 y D9:** alumnos de la comisión y tomar lista con toques, desde Hoy, con la modalidad y el enlace de Zoom en la clase. Es el momento fuerte del pitch: de 15 minutos a menos de uno.
3. **D16:** Excel de la materia, una hoja por comisión.
4. **D7:** tareas y entregas, con fecha límite y atrasadas.
5. **D4 y D5:** Calificaciones de la comisión, con nota, comentario, peso, nota de cursada y publicar.
6. **D6:** pegar notas desde la planilla.

Al pitch van D10, D13 y D14. Quedan para después:

- D11 y D12;
- subir un `.xlsx`;
- QR, código y reporte de participantes de Zoom para la lista;
- la grabación de Zoom al material.

## Cómo se divide

La épica [#93](https://github.com/ignaciogaspar/campus-hackai/issues/93) está partida en dos specs que se trabajan a la par:

- **A, [#95](https://github.com/ignaciogaspar/campus-hackai/issues/95):** D1, D2, D3, D8 y D9.
  - Qué cubre: tomar lista, alumnos y clases de la comisión, Inasistencias y Zoom.
  - Dónde: Cursada y Hoy.
  - Por dónde arranca: lo compartido (alumnos de la comisión, pestañas de la materia del docente y selector de comisión).
- **B, [#96](https://github.com/ignaciogaspar/campus-hackai/issues/96):** D4, D5, D6, D7 y D16.
  - Qué cubre: tareas y entregas, Calificaciones, nota de cursada, Excel y pegar notas.
  - Dónde: el módulo nuevo Seguimiento.
  - Por dónde arranca: crear tareas y entregar, que no necesitan nada de A.

La asistencia queda en Cursada y no en Seguimiento, para que cada mitad tenga su módulo. Las reglas para no pisarse están en la sección «Contrato» de cada spec.

## Pendiente

- **T6, «tomar lista»:** falta cronometrar a un docente en el SIU. Los 10 a 15 minutos son lo que contó el profesor.
- **Reglas de la nota de cursada:** si el recuperatorio reemplaza al parcial y cuál es el mínimo para regularizar. Hasta saberlo, el promedio ponderado y la nota editable a mano cubren el caso.
