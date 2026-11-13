# campus-hackai

Vocabulario del dominio. Sale del [relevamiento de SIU y Campus](docs/research/2026-11-10-relevamiento-siu-campus.md), del [análisis del repo de Nacho](docs/research/2026-11-10-repo-campus-nacho.md), de las pestañas de research del [Google Doc del equipo](https://docs.google.com/document/d/1vzCAqms9f6OHlAU2imse0ZOsw-SNLW2Ol5P_9auUWtk/edit) y de los docs de campus (`campus/README.md`, `campus/docs/`). Hay tres vocabularios que conviven y repiten palabras: el de **SIU Guaraní** (gestión académica), el del **Campus Virtual** (Moodle) y el de **Campus Austral** (el repo de Nacho).

Nombres en inglés entre paréntesis: son los que van en el código. Los de Campus Austral son los que ya usa su código. Los de SIU y Moodle son una propuesta nuestra y se fijan al escribir la primera migración que los use. «A confirmar» marca lo que las fuentes no dejan claro; la definición refleja lo observado, no una decisión.

## Language

### Sistemas

**SIU Guaraní (SIU)**:
Sistema de gestión académica de la universidad. El alumno lo usa por un portal de autogestión para inscribirse a materias y exámenes, ver su historia académica y su plan, y pedir constancias. No es público ni lo administramos; versión (2 o 3) y existencia de una API, a confirmar.
_Avoid_: «el SIU» para hablar del Campus; «Guaraní» a secas.

**Campus Virtual (Moodle)**:
Aula virtual de la universidad, una instalación de Moodle 5.1 con el tema Lambda 2 y login con Microsoft 365. Ahí están los cursos con su material, avisos, tareas y calificaciones.
_Avoid_: «campus» a secas en docs y tickets: se confunde con Campus Austral y con la carpeta `campus/`.

**Campus Austral (campus)**:
El campus propio de Nacho, hecho en Next.js y Supabase para una materia del IAE (AI-Centric Management). Para HackAI es un sistema de origen más y la referencia de su lógica; su snapshot está en `campus/`. No es Moodle ni SIU.
_Avoid_: «el repo de Moodle»; «upstream» sin aclarar.

**HackAI (hackai)**:
Nuestro sistema, en `hackai/`. Unifica la vida académica del alumno: muestra y ejecuta lo que resuelven bien SIU, Moodle y Campus Austral, y resuelve por su cuenta lo que ninguno resuelve.

**Sistema de origen (Source system)**:
El sistema externo donde vive un dato o donde se completa una acción: el SIU para inscripciones, notas y constancias; Moodle o Campus Austral para el material y las entregas de una materia. HackAI lo consulta o le pide la acción, pero no lo reemplaza.
_Avoid_: «backend», «fuente» a secas.

### Personas y roles

**Alumno (Student)**:
Persona inscripta en una propuesta que cursa materias. En Campus Austral es uno de los dos roles (`alumno`).
_Avoid_: «estudiante», «usuario» cuando se sabe el rol.

**Docente (Teacher)**:
Persona que dicta una comisión, carga material, avisos y notas. En Campus Austral el rol se llama `profesor` y las rutas son `/profesor/...`.
_Avoid_: mezclar «profesor» y «docente» en un mismo texto de UI; en código, el valor del rol es `'profesor'`.

**Aspirante (Applicant)**:
Persona en proceso de ingreso. En el SIU queda como una propuesta aparte («Aspirantes - fi») que sigue apareciendo, marcada como pasiva, cuando el alumno ya está en su carrera.

**Perfil (Profile)**:
En el SIU, el papel con el que un usuario ve el portal (alumno, docente, gestión). Un alumno ve un selector con una sola opción.
_Avoid_: usar «perfil» para la propuesta o para la página de datos personales.

**Gestión (Staff)**:
Personal administrativo que cierra actas y administra inscripciones (bedelía, departamento de alumnos). No existe como rol en Campus Austral. Nombre y alcance, a confirmar.

### Estructura académica (SIU)

**Propuesta (Program)**:
Carrera o trayecto al que está vinculado un alumno (por ejemplo, Ingeniería en Informática). El SIU muestra todo según la propuesta elegida en un selector, y lista también las propuestas pasivas.
_Avoid_: «carrera» en código; sí se puede usar en UI.

**Facultad (School)**:
Unidad académica de la universidad (Ingeniería, Ciencias Empresariales, Derecho, Comunicación, Ciencias Biomédicas). La misma materia se dicta distinto en cada facultad.

**Plan de estudios (StudyPlan)**:
Versión del conjunto de materias de una propuesta (por ejemplo, IINF Plan 2023), organizado por año, con optativas y otros requisitos, y con las correlativas de cada materia.
_Avoid_: «plan» para hablar de un plan de trabajo o de la propuesta.

**Optativa (Elective)**:
Materia del plan que el alumno elige entre varias. El plan pide una cantidad (`electivesRequired`) y va en el año desde el que se puede cursar.

**Actividad de vida universitaria (UniversityLife)**:
Materia del plan que no es de la carrera en sí (voluntariado, oratoria, coro) y suma créditos. Se hace en cualquier año y suele aprobarse sin nota. El plan pide una cantidad (`universityLifeRequired`).
_Avoid_: «crédito» para la actividad; el crédito es lo que suma.

**Estado de la materia (SubjectStatus)**:
Cómo viene el alumno en una materia: promocionada, aprobada (por final o equivalencia), en curso, regular (cursada aprobada, falta el final) o pendiente. Lo calcula Cursada en `career`.
_Avoid_: «disponible» o «archivada» para el estado: esas palabras son de Materias y hablan del período, no de la aprobación.

**Materia (Subject)**:
Unidad del plan que se cursa y se aprueba. El SIU la llama «actividad» y usa la misma palabra para extracurriculares (ayudantías, viajes, Vida Universitaria).
_Avoid_: «actividad» en nuestra UI; «curso» (es de Moodle y de Campus Austral).

**Actividad con créditos (Credit activity)**:
Actividad extracurricular del SIU (un taller, un curso de Vida Universitaria) que da créditos al aprobarla. Se inscribe igual que una cursada, a una comisión de un período lectivo. En la UI se llama «Actividad»; el valor de dominio es `'actividad'`.
_Avoid_: «materia» para estas actividades; «actividad» para una materia del plan.

**Correlativa (Prerequisite)**:
Materia que hay que tener regularizada o aprobada para poder cursar o rendir otra. El plan las muestra de a una, con requisito y condición.
_Avoid_: «requisito» a secas (se confunde con requisito de ingreso).

**Período lectivo (Term)**:
Tramo del calendario en el que se dictan las comisiones, con sus fechas de cursada y de inscripción (por ejemplo, Grado 2do Cuatrimestre 2026). Hay anuales, cuatrimestrales y quarters.
_Avoid_: «cuatrimestre» como nombre de la entidad.

**Comisión (Section)**:
Dictado concreto de una materia en un período lectivo: docentes, días y horarios, sede, modalidad y cupo. Es a lo que se inscribe el alumno.
_Avoid_: «curso», «clase», «grupo».

**Cupo (Capacity)**:
Cantidad máxima de inscriptos de una comisión o de una mesa. Puede estar «sin definir».

**Inscripción a cursada (CourseEnrollment)**:
Alta de un alumno en una comisión para cursar una materia en un período lectivo. Tiene comprobante y se puede dar de baja mientras el período de inscripción está abierto.
_Avoid_: «matriculación» (es de Moodle); «inscripción» a secas cuando puede ser a examen.

**Cursada (Course attempt)**:
El hecho de cursar una materia en una comisión, con su resultado: promocionada, aprobada (regular), desaprobada, ausente o libre, o en curso.
_Avoid_: usarla como sinónimo de comisión.

**Regularidad (Regular standing)**:
Resultado de una cursada aprobada que habilita a rendir el examen final. Se pierde, entre otras causas, por inasistencias. Según el equipo, el límite suele ser 3 faltas por materia; que el SIU lo dé por comisión es una hipótesis (`docs/product/preguntas-abiertas.md`, pregunta 22). Vigencia, a confirmar.
_Avoid_: confundirla con «alumno regular», que es la condición general que acredita la constancia.

**Promoción (Promotion)**:
Aprobación de la materia durante la cursada, sin examen final. Al inscribirse, la comisión indica si la instancia es promoción o regularidad.

**Final pendiente (Pending final)**:
Situación de un alumno que tiene la regularidad de una materia y todavía no aprobó su examen final. El SIU no la muestra como tal: hay que buscar materias con Regularidad y sin Examen en la historia académica.

**Turno de examen (Exam period)**:
Tramo del calendario en el que hay mesas (por ejemplo, «FI - Mesas Especiales»), con fecha de inicio y de fin.

**Mesa de examen (ExamBoard)**:
Fecha y tribunal en que se rinde el final de una materia dentro de un turno. Relación exacta entre mesa y «llamado», a confirmar: no había mesas abiertas al relevar.
_Avoid_: «examen» para nombrar la mesa.

**Inscripción a examen (ExamEnrollment)**:
Alta de un alumno en una mesa para rendir un final. Requiere tener la cursada que habilita; pasos exactos y validaciones, a confirmar.

**Evaluación (Assessment)**:
Parcial o trabajo práctico de una comisión, con fecha y horario. El SIU las lista en el cronograma de evaluaciones, por materia.
_Avoid_: usarla para el examen final.

**Inasistencia (Absence)**:
Falta de un alumno a una clase, registrada por materia con fecha y si está justificada. El máximo de inasistencias de una comisión (`AbsenceLimit`) es una hipótesis: ver Regularidad.

**Acta (GradeRecord)**:
Documento oficial que asienta las notas de una cursada, una promoción o una mesa. Mientras no se cierra, las notas son provisorias; cerrada, no se modifica. Quién la cierra y cómo, a confirmar.
_Avoid_: «planilla»; guardar en un acta una nota que escribió un agente sin que la apruebe una persona.

**Actuación provisoria (Provisional result)**:
Nota cargada en un acta todavía abierta. El SIU la muestra en un reporte aparte, separado de la historia académica.

**Historia académica (AcademicHistory)**:
Registro completo de un alumno en una propuesta: cursadas, exámenes, promociones, equivalencias y aprobaciones por resolución, con nota, resultado y fecha. Hipótesis: también trae notas de evaluaciones (parciales, TP) que el docente cargó ahí y no en un acta abierta (pregunta 14 de `docs/product/preguntas-abiertas.md`).
_Avoid_: «analítico» (es el documento que se emite a partir de ella).

**Equivalencia (Equivalence)**:
Reconocimiento de una materia aprobada en otro plan o institución.

**Promedio y avance (Average and progress)**:
Promedio general con y sin aplazos, y porcentaje de la carrera aprobado. Cómo se calcula el avance, a confirmar.

**Requisito de ingreso (Admission requirement)**:
Documentación que el alumno debe presentar al ingresar (título secundario, DNI, foto), con fecha límite y estado.
_Avoid_: «requisito» a secas.

**Constancia (Certificate)**:
Documento que el alumno pide por el SIU para presentar ante un tercero: de alumno regular o de examen final. La solicitud tiene estado y vencimiento.
_Avoid_: «certificado» para la constancia; «analítico».

**Analítico (Transcript)**:
Documento oficial con la historia académica completa, que se descarga junto con el diploma digital.

**Vida Universitaria (University Life)**:
Programa de actividades extracurriculares que dan créditos exigidos por el plan.

**Mensaje del SIU (SIU message)**:
Comunicado de la facultad que llega a la bandeja del portal. El alumno solo lee.
_Avoid_: «aviso» (es de un curso de Moodle).

### Aula virtual (Moodle)

**Curso de Moodle (MoodleCourse)**:
Espacio de una materia en el Campus Virtual: material por tema o semana, foro de avisos, tareas y calificaciones. No está atado a una comisión del SIU; el único puente visible es un botón «Ir» en Mis inscripciones.
_Avoid_: «curso» a secas; «aula» y «materia» como sinónimos.

**Matriculación (Enrolment)**:
Alta de un usuario en un curso de Moodle con un rol. Hoy es manual o por auto-inscripción y no se sincroniza con las inscripciones del SIU.
_Avoid_: «inscripción» (es del SIU).

**Desmatriculación (Unenrolment)**:
Baja de un usuario de un curso de Moodle. Hoy se hace en forma masiva al terminar la cursada, y el alumno con final pendiente pierde el acceso al material. El alumno no puede darse de baja solo.

**Aviso (Announcement)**:
Novedad que publica el docente en el foro de Avisos de un curso. Llega por web y mail a quienes están suscriptos; no hay push.
_Avoid_: «anuncio», «notificación» (la notificación es el envío, no el contenido).

**Notificación (Notification)**:
Envío que avisa de un evento (aviso nuevo, material nuevo, devolución) por un canal. En el Campus Virtual solo hay web y mail.

**Tarea (Assignment)**:
Actividad de un curso con consigna y fecha límite en la que el alumno sube una entrega.
_Avoid_: «entrega» para la consigna.

**Entrega (Submission)**:
Lo que el alumno sube a una tarea, con su estado, comentarios y devolución. En Campus Austral, «entrega» nombra además la consigna (ruta `/campus/entregas`, tabla `assignments`); en nuestro código, `Assignment` es la consigna y `Submission` lo entregado.

**Calificación (Grade)**:
Nota de una tarea o de un curso en Moodle. No es una nota oficial: la oficial es la del acta en el SIU.
_Avoid_: «nota» cuando hay que distinguirla de la del acta.

### Campus Austral (repo de Nacho)

**Curso (Course)**:
Materia cargada en Campus Austral. Hoy hay una sola, fija en una constante, y cada persona pertenece a un único curso.

**Jornada (ClassSession)**:
Cada encuentro presencial de un curso, con fecha, docentes, deck, caso, entrega y actividades.
_Avoid_: «clase» (se reserva para la clase en vivo).

**Clase en vivo (LiveSession)**:
Dictado de una jornada desde el campus: el deck se proyecta, los alumnos lo siguen desde el celular con un código y todo queda registrado por slide.

**Deck (Deck)**:
Presentación de una jornada, hecha de slides ordenadas.
_Avoid_: «presentación», «PPT».

**Slide (Slide)**:
Unidad de un deck. Vive en un repositorio único, se reutiliza entre decks y guarda revisiones. Las notas del docente nunca llegan al alumno.

**Overlay (Overlay)**:
Lo que el docente o el agente superponen a la slide proyectada: encuesta, QR, alumno sorteado, posturas, timer.

**Padrón (Roster)**:
Lista de alumnos de un curso. El alumno elige su nombre del padrón para ingresar. El de prueba es ficticio (`is_fictional`).
_Avoid_: «lista», «nómina».

**Cohorte (Cohort)**:
El grupo de alumnos que cursa junto; se usa para lo agregado (analítica, perfiles).
_Avoid_: usarla como sinónimo de padrón (el padrón es la lista; la cohorte, el grupo) o de comisión.

**Agente en vivo (Live agent)**:
Claude con herramientas, al que el docente le habla durante la clase en vivo para que cambie la presentación.

**Tutor (Tutor)**:
Asistente con IA al que el alumno le pregunta sobre una slide o un deck.

**Encuesta (Poll)**:
Pregunta que se abre en una slide durante la clase y se responde por QR.

**Caso y postura (Case, Posture)**:
Caso de discusión sobre el que cada alumno toma una postura con justificación antes de clase.

**Entregable (Deliverable)**:
Cada uno de los trabajos oficiales por bloque de la materia (B1 a B6). Es una entrega con ese carácter.

**Revisión entre pares (Peer review)**:
Evaluación de una entrega por otros alumnos con una rúbrica.

**Reflexión (Reflection)**:
Lo que el alumno escribe al cerrar una jornada: qué se lleva, qué sigue confuso, qué va a aplicar. No es nota ni asistencia.

**Devolución (Feedback)**:
Mensaje privado del docente a un alumno. Tiene un borrador separado de la copia publicada y se publica en forma explícita.
_Avoid_: «feedback» en UI.

**Invitado (Guest)**:
Persona sin login que responde una encuesta por QR con un nombre.

### HackAI

**Seguimiento (Coursework)**:
Módulo de HackAI que lleva las tareas de una materia: el docente las crea para una o más de sus comisiones y los alumnos de esas comisiones las ven. Suma las entregas, las calificaciones y el pase de las notas al SIU. No es el seguimiento de Moodle ni reemplaza al SIU: es lo propio de HackAI.
_Avoid_: «actividades», «trabajos prácticos».

**Tarea de HackAI (Task)**:
Una tarea con nombre, consigna, archivo opcional, fecha límite y si lleva nota, creada en HackAI por un docente. No es la Tarea (Assignment) de Moodle: esa viene del aula virtual. En el código, `Task` es la de HackAI y `Assignment` la de Moodle. Una tarea que no lleva nota no tiene columna en Calificaciones.

**Pase al SIU (Grade pass)**:
Escribir en el SIU las notas que el docente publicó en HackAI: la de cada evaluación del cronograma del SIU y, más adelante, la de cursada. Una tarea no existe en el SIU y queda solo en HackAI. Cada nota guarda su estado de pase: `pendiente` (todavía no pasó: el SIU falló y se reintenta, sin duplicar), `pasado` o `no-permitido` («Sin pasar al SIU»: el SIU no deja escribir notas). El alumno ve la nota en los tres estados. Se hace por la capacidad `canWriteGrades` del puerto del SIU: el adaptador real declara que no puede, el simulado sí.
_Avoid_: «sincronizar notas», «exportar».

**Espacio de la materia (Subject space)**:
Lugar de una materia en HackAI donde se comunican sus docentes y alumnos. Hay uno por materia y facultad: la misma materia en dos facultades son dos espacios. Adentro hay canales de toda la materia y canales de cada comisión. Quien se inscribe a una comisión en el SIU queda adentro.
_Avoid_: «aula», «servidor», «curso».

**Canal (Channel)**:
Conversación con nombre dentro de un espacio de la materia, al estilo de un canal de Discord o Slack. Es de toda la materia (el material) o de una comisión (`#avisos` y `#consultas`, que dependen de su docente). Lo ven sus miembros. Reemplaza al foro de Moodle.
_Avoid_: «foro», «chat», «grupo».

**Canal externo (External channel)**:
Plataforma de mensajería que eligió la cátedra o el docente (Discord, Slack, WhatsApp u otra) para sincronizar los canales de su materia. Las notificaciones le llegan al alumno por ahí.
_Avoid_: «integración» a secas.

**Mensaje directo (Direct message)**:
Mensaje privado entre un alumno y un docente de su espacio. Entre alumnos no hay.
_Avoid_: «mensaje» a secas: choca con el Mensaje del SIU y con la mensajería de Moodle.

**Calificaciones (Gradebook)**:
Pestaña del docente en la materia donde carga las notas de una comisión. Tiene una columna por cada tarea con nota de la comisión y una por cada evaluación del cronograma del SIU (parcial, recuperatorio, TP). Una tarea sin nota no tiene columna. En cada columna el docente pone a cada alumno una nota o un ausente y un comentario.
_Avoid_: «planilla», «libreta».

**Nota publicada (Published grade)**:
Nota de una columna que el docente publicó en HackAI: desde ese momento el alumno la ve, con el comentario entero, en Notas, y le llega a la campana y a Novedades. Una nota sin publicar no la ve nadie más que el docente. Es una nota de HackAI, distinta de la nota cargada en el SIU: para una evaluación calificada y publicada en HackAI, Notas muestra la de HackAI.

### Este repo

**Snapshot de campus (Campus snapshot)**:
El contenido de `campus/`: una copia del repo de Nacho en una fecha, sin historial, que solo se reemplaza entera.

## Flagged ambiguities

- **Curso**: en Moodle es el espacio de una materia; en Campus Austral es la materia cargada; en el SIU no existe (hay materia y comisión). Decir siempre cuál.
- **Entrega**: en Moodle es lo que sube el alumno; en Campus Austral nombra también la consigna.
- **Inscripción y matriculación**: inscripción es del SIU (a cursada o a examen); matriculación es de Moodle. Que no estén conectadas es uno de los problemas del research.
- **«Campus»** en boca del equipo puede ser el Campus Virtual (Moodle), Campus Austral o HackAI. Decir cuál.
- **Actividad**: en el SIU es una materia o una extracurricular; en Moodle, un recurso del curso (tarea, foro); en Campus Austral, una dinámica de clase. Preferir el término específico.
- **Nota**: la del acta (oficial, SIU), la calificación (Moodle) y la nota calculada al leer de Campus Austral son tres cosas distintas.
