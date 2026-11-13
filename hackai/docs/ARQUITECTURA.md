# Arquitectura de HackAI

Cómo se organiza el código de `hackai/`. Sale de la skill `codebase-design` aplicada a la spec [#5](https://github.com/ignaciogaspar/campus-hackai/issues/5), y aplica el [ADR 0004](../../docs/adr/0004-sistema-propio-con-puertos-y-adaptadores.md) (puertos y adaptadores) y el [ADR 0005](../../docs/adr/0005-sincronizacion-con-canales-externos.md) (sincronización con canales externos). El vocabulario (módulo, interfaz, seam, adaptador, profundidad) es el de esa skill.

## La idea en dos reglas

1. **Puertos y adaptadores en los bordes.** SIU, Moodle y los canales externos son sistemas que no controlamos: cada uno entra por un puerto, con un adaptador para la demo y otro en memoria para los tests.
2. **Módulos profundos adentro.** El núcleo son cuatro módulos con interfaces chicas que esconden mucho. Entre ellos se llaman directamente por su interfaz, sin puertos intermedios.

## Módulos del núcleo

Cada módulo expone una sola interfaz. Lo de adentro (reglas, almacén, piezas internas) no se importa desde afuera. Los errores esperables vuelven como valores (`{ ok: false, error: 'sin-cupo' }`), no como excepciones. Las excepciones quedan para lo que no debería pasar.

### Personas (`people`)

Quién es quién.

| Operación | Qué hace |
| --- | --- |
| `signIn(credencial)` | La persona que entra, según el puerto de identidad: en la demo, una persona elegida de la lista; en producción, la cuenta de Microsoft de la Austral |
| `demoPeople()` | Personas sintéticas para el ingreso de demo |
| `get(persona)` | Rol (alumno o docente), facultad y propuesta. Si el SIU no responde, la persona como se leyó la última vez |
| `accountIn(persona, sistema)` | Su id en un sistema de origen o canal externo (SIU, Moodle, Discord) |
| `byExternalAccount(sistema, idExterno)` | La persona dueña de ese id, o nada. Se vincula por id, porque nombres de usuario y mails cambian o se repiten |
| `linkAccount(persona, sistema, idExterno)` | Vincula su cuenta de un canal externo (Discord), por ejemplo la con que autorizó a HackAI. Reemplaza la que tenía; una cuenta de otra persona es `cuenta-en-uso`. La identidad, el SIU y Moodle no se vinculan así |

Usa el puerto de identidad, el del SIU para los datos de la persona y su almacén para los vínculos con cada sistema. Los adaptadores nunca adivinan a quién corresponde un id: se lo preguntan a Personas.

### Cursada (`studies`)

Todo lo que viene del SIU y de Moodle sobre la vida académica del alumno.

| Operación | Qué hace |
| --- | --- |
| `subjectsOf(persona)` | Materias del cuatrimestre actual y archivadas, cada una con el enlace a su aula de Moodle y, las actuales, sus tareas con fecha. Sin faltas: la tarjeta de la materia no las muestra |
| `absencesOf(persona)` | Las inasistencias del alumno por materia actual: cuántas, cuántas justificadas, el máximo si el SIU lo da, cuántas le quedan, un aviso cerca del máximo y cada falta con su fecha y su fuente (`siu`; `hackai` desde la toma de lista). Junta las dos fuentes: una clase tomada en HackAI vale como la guardó HackAI, también sin ausentes, y reemplaza las faltas del SIU de esa comisión ese día (se compara por día de Buenos Aires); las que solo están en el SIU se siguen viendo. Anda aunque el SIU no responda: con lo último leído de él (o, si nunca se leyó, solo con las listas de HackAI, que guardan el nombre de la materia y la comisión), desactualizado. Un docente recibe una lista vacía. Vive en `lib/core/studies/absence-sources.ts` |
| `classesOf(persona, comisión)` | Las clases de la comisión desde que empieza el período hasta hoy, la más nueva primero (se calculan del horario del SIU, con el reloj inyectado: `lib/core/studies/classes.ts`), con la lista de cada una si ya se tomó y cómo quedó su pase al SIU. Solo para un docente de la comisión (`sin-acceso`). Reintenta los pases pendientes de la comisión |
| `classHistory(persona, comisión)` | El historial de la comisión: solo las clases con la lista tomada, la más nueva primero, cada una con su modalidad (la de la comisión), los ausentes con nombre y el estado del pase al SIU. Solo para un docente de la comisión (`sin-acceso`, lo decide `classesOf`). Vive en `lib/core/studies/class-history.ts` y se ve en «Alumnos y clases» de la materia (`?comision=`) |
| `attendanceSheet(persona, comisión, clase)` | La lista de una clase: los alumnos de la comisión (los de `sectionStudents`) y los ausentes ya guardados. `clase-inexistente` si la comisión no tiene una clase en ese instante |
| `takeAttendance(persona, comisión, clase, ausentes)` | Toma la lista de la clase de hoy o la corrige: todos arrancan presentes, `ausentes` son legajos. Solo el docente de la comisión (`sin-acceso`), solo hoy (`clase-fuera-de-fecha`), solo alumnos inscriptos (`ausente-no-inscripto`). Guarda en el almacén de Cursada, así el alumno ve la falta aunque el SIU no responda, y la pasa al SIU: `pasado`, `pendiente` (el SIU no respondió) o `sin-pasar` (el SIU no deja escribir la asistencia). Vive en `lib/core/studies/attendance.ts` |
| `setZoomLink(persona, comisión, enlace)` | Carga el enlace de Zoom de la comisión, lo cambia o, con texto vacío, lo borra. Solo un docente de la comisión (`sin-acceso`) y solo `https://` (`enlace-invalido`). Se guarda en el almacén de Cursada, no en el SIU. `subjectsOf` lo trae en cada materia (`zoomUrl`) solo si la comisión es virtual o híbrida; si el almacén no responde, sale `null` y las materias salen igual. Vive en `lib/core/studies/zoom.ts`. `currentClass` y `hasClassOn` (`classes.ts`) son las cuentas puras del horario: cuál es la clase de ahora o la próxima, y si hay clase un día |
| `retryPases()` | Reintenta pasar las listas pendientes, de la más vieja a la más nueva, y corta en el primer fallo. Lo corre la corrida periódica. El SIU reemplaza la lista de la clase (el puerto es idempotente por comisión e instante), así que reintentar no duplica y una lista corregida se pasa de nuevo |
| `sectionsOf(persona)` | Sus comisiones, como alumno o como docente |
| `sectionStudents(persona, comisión)` | Los alumnos inscriptos (aceptados o pendientes) a una comisión, con legajo (el id del SIU), nombre («Apellido, Nombres», por orden alfabético), mail y su `personId` de HackAI si ya tiene cuenta. Solo para un docente de esa comisión: un alumno, un docente de otra comisión o una comisión que no existe reciben `sin-acceso`. Lee del puerto del SIU (`sectionEnrollments`) y con el SIU caído devuelve lo último leído, desactualizado. Vive en `lib/core/studies/section-students.ts` |
| `offer(persona, objetivo)` | Comisiones o mesas de examen con cupo, horario y docentes, y si su inscripción todavía no abrió, está abierta o ya cerró (mirado con el reloj de cada llamada, aunque sea lo último que se leyó). En una mesa, si para rendir le falta regularizar la cursada |
| `enroll(persona, objetivo)` | Inscribe y matricula. Devuelve comprobante, `requiere-autogestion` con el enlace al SIU, o `sin-cupo`, `fuera-de-periodo`, `ya-inscripto`, `solo-alumnos`, `sin-cuenta-del-aula`, `a-medias`, `falla-externa` |
| `drop(persona, objetivo)` | Baja en el SIU y desmatriculación en Moodle. A un docente le devuelve `solo-alumnos` |
| `upcoming(persona)` | Parciales y finales de todas sus materias, ordenados por fecha, con los pasados marcados. Cada final lleva su turno de examen y, si el SIU lo da, dónde se rinde. Cada próximo dice si la persona tiene (o tuvo) comisión de la materia (`hasSection`): un final que rinde libre no tiene espacio al que llevar. Al docente, los parciales de sus comisiones y las mesas que integra |
| `openEnrollments(persona)` | Inscripciones abiertas que le sirven, con los días que faltan para que cierren (contados con el reloj de cada llamada, aunque sea lo último que se leyó) y los lugares que quedan entre todas las comisiones o mesas abiertas de la materia |
| `pendingFinals(persona)` | Materias regulares sin aprobar (un final desaprobado sigue pendiente), cada una con su próxima mesa (en la que está inscripto o la primera cuya inscripción no cerró) y si está inscripto, abierta, sin cupo o todavía no abre |
| `record(persona)` | Notas de parciales unificadas, vengan de la historia académica o de actuación provisoria, cada una con su origen y, si el SIU lo dice, cuándo se cargó; materias aprobadas (promoción, final o equivalencia) y su promedio |
| `newGrades(persona, vistasHasta)` | Las notas con número de `record` (parciales, recuperatorios y TP; un ausente no cuenta) cargadas en los últimos 7 días y después de la última vez que las vio (`vistasHasta`, o `null`), la más nueva primero, medido con el reloj de cada llamada aunque sea lo último que se leyó. Sin fecha de carga, cuenta la de la evaluación. Con el SIU caído, salen de lo último leído, marcadas como desactualizadas como toda lectura; la campana y Novedades no muestran las desactualizadas (`lib/grades-seen.ts`), para no anunciar como nueva una nota vieja |
| `certificate(persona, tipo)` | Si cumple las condiciones de la constancia, por qué no si no cumple, y el enlace a la Autogestión del SIU |
| `career(persona)` | Cada materia de su plan de estudios (y las que cursó fuera de él) con su estado, sus notas de parciales, la nota de cursada, la final y el final al que está inscripto, más el promedio y el avance de la carrera. Las reglas están en `lib/core/studies/career.ts` |

`objetivo` es una comisión (cursada) o una mesa (examen).

**Invariantes de `enroll`:**

- **Solo alumnos.** Un docente no se inscribe ni se da de baja: devuelve `solo-alumnos` sin tocar el SIU ni el aula.
- **Todo o nada.** Si el SIU inscribe y Moodle falla, deshace la inscripción del SIU antes de devolver `falla-externa`. Si deshacerla también falla, devuelve `a-medias`: el SIU y el aula quedaron distintos y no se le puede decir al alumno que no pasó nada. Sin usuario de Moodle no se inscribe y devuelve `sin-cuenta-del-aula`, porque reintentar no lo arregla.
- **Una comisión vigente por materia.** Con una inscripción aceptada o pendiente a una comisión de un período que no terminó, inscribirse a otra comisión de la misma materia devuelve `ya-inscripto`, aunque sea de otro período. La oferta lo marca y las inscripciones abiertas no ofrecen esa materia.
- **Matricula solo si hace falta.** Si el adaptador del SIU declara que el SIU ya matricula en Moodle (su interfaz oficial activa), Cursada no matricula por su cuenta.
- **La baja es el camino inverso.** Desmatricula de las aulas y después da de baja en el SIU. Si el SIU la rechaza (fuera de período, caído), vuelve a matricular: lo que se deshace sin riesgo es la matrícula, no la inscripción.
- **Si el SIU no deja inscribir por API,** el adaptador lo declara y `enroll` devuelve `requiere-autogestion` con el enlace a la comisión en la Autogestión. Es el caso de la API real del SIU hoy. La pantalla lo muestra como un paso más, no como un error.

**Comisiones por carrera:** una comisión puede abrirse solo para algunas propuestas (`programIds` en el puerto del SIU). Las inscripciones abiertas solo cuentan las de sus propuestas activas y las abiertas a todas, e inscribirse a una de otra carrera devuelve `objetivo-desconocido`. La oferta trae todas las de la facultad y marca las de otra carrera (`otherProgram`): Inscripciones no las muestra, y Espacios las usa para juntar el material de toda la materia.

**Carrera:** el plan es el de su primera propuesta activa, que el SIU da con `studyPlan`; una pasiva, como la de aspirante, no cuenta. El estado de cada materia sigue este orden: promocionada o aprobada; si no, en curso; si no, regular (le falta el final); si no, pendiente. El avance cuenta las obligatorias aprobadas y, hasta lo que pide el plan, las optativas y las actividades de vida universitaria.

**Constancias:** si cumple lo dice el SIU (en la API real, solo `cumple_condiciones`). El motivo lo deduce Cursada con lo que la API también da: propuesta activa, inscripción vigente, finales rendidos. Si no lo encuentra, no inventa uno.

**Lecturas que toleran caídas:** si el SIU o Moodle no responden, las lecturas devuelven lo último que se leyó con su hora («actualizado hace 20 min»), marcado como desactualizado. Vale para todas las lecturas, también la oferta y las constancias. No falla toda la pantalla porque un sistema de origen esté caído, que es justamente una de las quejas de la encuesta. Si se cae solo Moodle, `subjectsOf` no usa lo último leído: devuelve las materias al día del SIU, sin enlaces al aula ni tareas, y lo marca con `classroomUnavailable`; Hoy lo anota en `unavailable` como `assignments`. Las inasistencias son una lectura aparte (`absencesOf`): si el SIU no las da, devuelve lo último leído y desactualizado, y las materias no se enteran.

Usa Personas y los puertos del SIU, del aula virtual y el reloj.

### Espacios (`spaces`)

El espacio de la materia, con la sincronización con canales externos adentro.

| Operación | Qué hace |
| --- | --- |
| `open(persona, materia)` | Trae lo nuevo del canal externo y de Moodle, y devuelve los canales que la persona ve, sus no leídos, el material y qué puede hacer, incluido a quiénes les puede escribir en privado (`directContacts`). Crea el espacio y los canales de sus comisiones si no existen |
| `channel(persona, canal)` | Mensajes del canal, con las consultas y sus respuestas en hilos; en el de material, el material. Marca leído |
| `version(canal)` | Si hay algo nuevo en el canal, sin leerlo: trae lo nuevo del canal externo y devuelve una versión que cambia cuando entra, se envía o se resuelve algo. No chequea la membresía, para no consultar Cursada en cada chequeo: dice si el canal cambió, nunca qué tiene. La pantalla abierta la pregunta cada 15 segundos (`/api/canales/<id>/version`) y se vuelve a pedir solo si cambió |
| `post(persona, canal, mensaje)` | Publica y lo envía al canal externo vinculado |
| `resolve(persona, consulta)` | Marca una consulta como resuelta |
| `createChannel(persona, espacio, alcance)` | Canal nuevo de la materia o de una comisión |
| `addMaterial(persona, espacio, archivo)` | Sube un archivo al material, con Archivos, en la unidad o el tema que elige el docente |
| `search(persona, espacio, texto)` | Busca en el material por nombre del archivo y por unidad o tema, y en las consultas de los `#consultas` que la persona ve por su texto o el de sus respuestas, sin distinguir mayúsculas ni tildes. Alcanza con que estén todas las palabras, en cualquier orden; en el material, lo que tiene lo buscado tal cual va primero. Las consultas vuelven con las resueltas primero. Nunca trae nada de otra comisión y no marca nada leído. La pantalla la pide con `?buscar=` en el canal de material |
| `organizeMaterial(persona, espacio, modo)` | Organiza el material por unidad, por semana o sin secciones |
| `openDirect(persona, espacio, otraPersona)` | Canal directo entre alumno y docente de una misma comisión del espacio. Hay uno por par y por espacio, así se archiva con el espacio. Lo puede abrir cualquiera de los dos, pero `open` solo le ofrece contactos al alumno: Cursada no le da al docente los alumnos de su comisión |
| `link(persona, canal, canalExterno)` | Vincula un canal con uno del canal externo de la cátedra y trae lo que ya tenía. Devuelve `canal-externo-inexistente` si no lo encuentra y `canal-externo-en-uso` si ya está vinculado con otro canal |
| `connect(persona, espacio, servidor, cuenta)` | Conecta el espacio con el servidor de la cátedra en el canal externo y vincula en Personas la cuenta externa con que lo autorizó. Solo docentes de la materia. Comprueba antes que el bot esté en el servidor: si algo falla, no conecta nada |
| `serverChannels(persona, espacio)` | Los canales de texto del servidor conectado, con cuál de HackAI está vinculado cada uno, para elegir uno al vincular. Solo si la cuenta externa del docente es miembro del servidor (`no-es-miembro`) |
| `createExternalChannels(persona, espacio)` | Crea en el servidor conectado una categoría con el nombre de la materia y un canal por cada canal del espacio que la persona puede vincular y no está vinculado, y los vincula. En `#avisos` y el material escriben solo los docentes; en el resto, todos. Cada canal se vincula apenas se crea: si el canal externo falla a mitad de camino, reintentar crea solo lo que falta |
| `syncAll()` | Sincroniza todos los canales vinculados; es la corrida periódica |
| `unreadFor(persona)` | Novedades sin leer de todos sus espacios, para Novedades, Hoy y la navegación: por canal, cuántas y la más nueva, con quién la publicó (y su texto o, si solo trae un adjunto, el nombre del archivo); en un directo, de quién es; si todo es de un mismo hilo, cuál; y la comisión del canal. No crea espacios |
| `openQuestions(persona)` | Las consultas sin resolver que le tocan responder, de todos sus espacios, la más vieja primero, con cuántas respuestas tienen: las de los canales de sus comisiones actuales en los que puede marcarlas resueltas. A un alumno no le toca ninguna. Como `unreadFor`, no crea espacios |
| `file(persona, archivo)` | Los bytes de un archivo guardado, si la persona ve el espacio de su material o el canal de su adjunto |

**Reglas que hace cumplir:**

- **Un espacio por materia y facultad.** Se crea la primera vez que alguien lo abre, con sus canales por defecto: material de la materia, y `#avisos` y `#consultas` por comisión.
- **Membresía.** Se deduce de `sectionsOf` de Cursada y no se guarda aparte. Por eso no hay operación para agregar miembros: quien se inscribe ya está adentro.
- **Quién ve:** el alumno ve los canales de la materia y los de su comisión, nunca los de otra comisión. Con los archivos guardados pasa lo mismo: el material lo baja cualquiera del espacio, y un adjunto, quien ve su canal.
- **Quién escribe:** en `#avisos` escriben solo los docentes de la comisión; en `#consultas` y en los canales que crea el docente, todos los que los ven. El material lo suben y lo organizan los docentes de la materia, y su canal no lleva mensajes. Las consultas las marcan resueltas los docentes de su comisión. Los canales directos son solo entre alumno y docente de la misma comisión, contando las comisiones vigentes del alumno, o todas si la materia está archivada para él; entre alumnos no hay. Vinculan un canal con el canal externo los docentes que lo gestionan: los de la materia si es de la materia, los de la comisión si es de una comisión; los directos no se vinculan. Cada canal le dice a quien lo mira qué puede hacer (`canPost`, `canResolve`, `canLink`), y el espacio, a quiénes les puede escribir en privado (`viewer.directContacts`), así la pantalla no repite estas reglas.
- **Canales por defecto:** el espacio y su canal de material se crean la primera vez que alguien abre el espacio; `#avisos` y `#consultas` de una comisión, la primera vez que lo abre alguien de esa comisión. Los nombres no se repiten entre canales que ven las mismas personas.
- **No leídos:** por persona y canal, lo que publicaron otros después de lo último que leyó. Lo ordena un contador del almacén, no la hora, que con el reloj fijo de los tests no avanza.
- **Sincronización:**
  - Cada mensaje guarda su origen (HackAI, Discord, Moodle) y su id externo, y un mensaje no entra dos veces.
  - De ida: lo publicado en un canal vinculado se guarda pendiente y se envía enseguida: primero el texto y al final, en letra chica, quién lo escribió, porque Discord nombra el hilo de una consulta con la primera línea. Una respuesta va al hilo de su mensaje y una consulta abre su hilo. Las menciones (`@everyone`, `@usuario`) no notifican (pregunta abierta 12). Lo que se sube al material se avisa en el canal de material vinculado con el nombre del archivo, sin el archivo; ese aviso no se reintenta (pregunta abierta 19).
  - Si el envío al canal externo falla, el mensaje queda publicado en HackAI como pendiente y se reintenta en la siguiente sincronización, en el orden en que se publicó.
  - De vuelta: se lee el canal externo desde el cursor guardado. En el canal de material, los adjuntos entran al material y el texto no; en los demás, cada mensaje entra al canal, y si es de un hilo, como respuesta a su mensaje. Un mensaje de primer nivel en `#consultas` que no escribió un docente es una consulta. El autor se busca en Personas por su id externo; sin vínculo, queda el nombre con que llegó y la pantalla dice «desde Discord».
  - De vuelta entra todo lo que se publica en el canal vinculado, escriba quien escriba: quién puede publicar en cada canal lo decide el servidor del canal externo (pregunta abierta 18).
  - Los adjuntos externos se copian a Archivos al leerlos, porque las URLs de Discord vencen. Uno que ya venció queda con su enlace original en un mensaje y no entra al material.
  - El cursor avanza solo si se guardó todo lo leído; si algo falla a la mitad, la próxima sincronización relee y los duplicados se descartan por el id externo.
  - Una sola sincronización a la vez por espacio, para no enviar dos veces el mismo pendiente. `open` no sincroniza más de una vez cada 5 segundos por espacio: lo mide un temporizador obligatorio que se inyecta (`timer`, en `composition` el tiempo real del proceso). No es el reloj: el de la demo está fijo, y con él un espacio se sincronizaba una sola vez por proceso.
  - Al vincular, el canal externo se lee desde el principio: lo que ya tenía entra a HackAI, pero lo que ya había en HackAI no se envía.
  - Moodle: `open` no trae lo nuevo de Moodle más de una vez cada 10 segundos por espacio. Con el reloj fijo (`capabilities.fixed`) la hora no avanza y no se puede medir el intervalo: lo trae en cada apertura. El material de Moodle sale de los cursos de todas las comisiones vigentes de la materia, que da la oferta de Cursada, y no solo de las comisiones que ya tienen canales: así no depende de quién abrió antes el espacio.
  - `open` espera las dos sincronizaciones antes de devolver la vista. Cada lectura de los adaptadores tiene tiempo máximo (5 s en Moodle simulado, 10 s en Discord) y lo que no llega entra en la próxima, así que un sistema lento demora la apertura pero no la rompe. Los límites se guardan en la memoria del proceso: con varias instancias, cada una lleva el suyo. Alcanza para la demo, que corre en una sola. La corrida periódica (`syncAll`) hoy sincroniza solo el canal externo; en producción debería traer también lo de Moodle y sacar la sincronización del camino de `open`.

Usa Cursada, Personas y los puertos del canal externo, del aula virtual, de Archivos y el reloj.

**Por qué la sincronización no es un módulo aparte:** separada, Espacios tendría que exponer operaciones que solo existen para ella («dame lo pendiente de enviar», «guardá este mensaje externo»), y cada pantalla tendría que acordarse de sincronizar. Adentro, todas las reglas de un mensaje (permisos, origen, duplicados, reintentos) están en un solo lugar y se prueban por la misma interfaz. La sincronización sigue siendo una pieza propia dentro de Espacios, con su seam interno.

### Hoy (`today`)

| Operación | Qué hace |
| --- | --- |
| `today(persona)` | Todo lo de la pantalla del alumno en una llamada: materias actuales y archivadas, próximos parciales y finales, novedades sin leer, inscripciones abiertas y entregas con fecha de Moodle. Además, el próximo parcial o final con los días que faltan, la hora en que se armó, desde cuándo hay algo desactualizado (`staleSince`) y qué partes no se pudieron leer (`unavailable`) |
| `teaching(persona)` | El Hoy del docente en una llamada: sus comisiones actuales, cada una con sus no leídos (los de la materia y los directos van en la primera comisión de cada materia, para no contarlos dos veces); las consultas sin resolver que le tocan (`openQuestions` de Espacios); los parciales de sus comisiones y las mesas que integra que no pasaron, por fecha; todo lo que no leyó, y `staleSince` y `unavailable` como en `today`. Suma `nowClass`: su clase de ahora (empezó y no terminó) o, si no hay, la próxima de sus comisiones actuales en los próximos 14 días, con materia, comisión, horario, aula, modalidad y enlace de Zoom. Sale del horario de la comisión y del reloj de la llamada, no de la hora de la lectura. El enlace va solo en las clases virtuales o híbridas con enlace cargado. Lee `subjectsOf`: si no responde, `nowClass` es `null` y `unavailable` lleva `class` |

Compone Cursada y Espacios, y usa el reloj para el próximo parcial. No tiene almacén propio. Una lectura que falla deja su parte vacía y el resto se ve igual: solo corta todo una persona que Cursada no conoce.

### Dependencias entre módulos

```text
today ──► studies ──► people
  │          ▲          ▲
  └──► spaces ┘          │
          └──────────────┘
```

Cursada usa Personas solo para traducir ids: una persona a sus ids del SIU y de Moodle (`accountIn`), y un docente del SIU a su persona de HackAI (`byExternalAccount`), porque los puertos hablan en ids de cada sistema. El rol y la facultad los lee del SIU con ese id.

No hay ciclos. Si un módulo nuevo necesita llamar a uno que lo llama, el diseño está mal: se revisa antes de escribir código.

## Puertos y adaptadores

Hay un puerto solo donde hay dos adaptadores de verdad (producción y test). Un puerto con un solo adaptador es indirección sin uso.

| Puerto | Qué ofrece | Adaptadores |
| --- | --- | --- |
| **Identidad** | Validar una credencial y devolver quién es | Selector de demo, en memoria. En producción, Microsoft Entra ID (OpenID Connect) |
| **SIU** | Personas, comisiones y oferta, inscripciones a cursada y examen, mesas, cronograma, historia, inasistencias y el máximo por comisión, condiciones de constancias; inscribir y dar de baja; qué capacidades soporta | SIU simulado sobre tablas `siu_*`, en memoria |
| **Aula virtual** | Cursos de una persona, matricular y desmatricular, avisos del foro, contenidos, tareas con fecha, enlace al aula de un curso | Moodle simulado sobre tablas `moodle_*`, en memoria |
| **Canal externo** | Leer mensajes nuevos de un canal desde un cursor (autor, texto, adjuntos, hilo), publicar, abrir un hilo, responder en él, bajar un adjunto. En el servidor de la cátedra: listar sus canales, saber si una cuenta es miembro, preparar la categoría y el rol de docentes de una materia y crear un canal con quién escribe | Discord, en memoria. Slack queda diseñado |
| **Archivos** | Guardar un archivo y obtener su URL; leerlo por id; borrarlo | Supabase Storage (bucket privado), en memoria |
| **Reloj** | La fecha y hora actuales | Sistema, fijo |

**Conectar con Discord** (`adapters/discord/oauth.ts`): la autorización OAuth2 de Discord no es un puerto, porque solo tiene un adaptador. `composition` la arma si el canal externo es Discord y están `DISCORD_CLIENT_ID` y `DISCORD_CLIENT_SECRET`, y las rutas `app/discord/conectar` y `app/discord/vuelta` la usan a través de `system()`. La vuelta solo vale con el `state` firmado y de un solo uso de `lib/oauth-state.ts`, y lo que conecta lo decide Espacios con `connect`.

**Caché de lecturas** (`adapters/cache/`): con el SIU y Moodle simulados, y con el almacén de Personas en Supabase, `composition` envuelve a cada adaptador con una caché en memoria, porque cada lectura es una consulta a la base y una pantalla hace muchas. Lo que no cambia con lo que hace el alumno (personas, materias, comisiones, planes, cronogramas, vínculos) se guarda `HACKAI_CACHE_SEGUNDOS` (300 por defecto); lo del aula, un minuto como mucho; lo que cambia al inscribirse (inscripciones, historia, cupos, actuación provisoria, inasistencias) solo se comparte mientras la consulta está en vuelo, así nunca se ve una inscripción vieja aunque otra instancia atienda el pedido siguiente. Un error no se guarda e inscribir pasa directo. El núcleo no se entera.

**Caídas de la demo** (`adapters/caida/`): con `HACKAI_CAIDAS=si`, `composition` envuelve al adaptador del SIU y al del aula con un interruptor que, prendido, hace que toda consulta devuelva `falla-externa`. Así se muestra en vivo la tolerancia a caídas sin tocar el núcleo, que ve un puerto que falla como uno real. Sin la variable el interruptor no existe, que es lo de producción. Con el interruptor levantado, los dos pasan la batería de contrato de su puerto.

Los adaptadores simulados del SIU y de Moodle copian la forma de las APIs reales: [research del SIU](../../docs/research/2026-11-10-siu-guarani-integracion.md) y [research de Moodle](../../docs/research/2026-11-10-moodle-web-services.md). Inscribir y el cronograma no existen en la API real del SIU: solo los provee el simulado. El adaptador de Discord sigue la [research de canales externos](../../docs/research/2026-11-10-canales-externos-apis.md): lee por REST desde un cursor, necesita el intent Message Content y ante un 429 espera `retry_after`. Si Discord pide esperar más de 30 segundos o sigue limitando después de 3 reintentos, el adaptador devuelve `falla-externa` en vez de bloquear la request, y la próxima sincronización reintenta. Es una desviación aceptada del issue #11, que pedía esperar siempre.

**Capacidades:** cada adaptador de un sistema de origen declara qué soporta: por ejemplo, si permite inscribir, si tiene cronograma, si ya matricula en Moodle, o si avisa por evento en vez de leerse desde un cursor. El núcleo decide con esas declaraciones, nunca preguntando qué adaptador es. Así el mismo núcleo funciona con el simulado de la demo y con el sistema real, que tiene menos capacidades.

**Almacén de Cursada:** `StudiesStore` (`lib/core/studies/store.ts`) guarda también el enlace de Zoom de cada comisión en `section_zoom_links` (`supabase/migrations/0011_studies_zoom_links.sql`, una fila por comisión; borrar el enlace lo deja en `null`). Y guarda las clases con la lista tomada en `section_classes` (`supabase/migrations/0007_studies_classes.sql`): una fila por comisión y clase, con los ausentes por legajo del SIU, el estado del pase (`pendiente`, `pasado`, `sin-pasar`) y cómo se llamaban la materia y la comisión. Tiene adaptador en memoria y de Supabase, con la misma batería de contrato. La asistencia que pasa al SIU simulado se escribe en `siu_absences` con la función `siu_record_attendance` (`supabase/simulados/0003_siu_attendance.sql`), y el vaciado de la demo (`demo_reset.sql`) borra las listas y esas faltas.

**Almacén de cada módulo:** cada módulo guarda lo suyo en tablas propias, con un adaptador de Supabase y otro en memoria. Es un seam interno: se inyecta al armar el módulo y no forma parte de su interfaz. Un módulo nunca lee las tablas de otro, y solo el adaptador de un sistema de origen toca sus tablas. Los archivos guardados se entregan por la ruta `/archivos/<id>/<nombre>`, que pide sesión y pasa por `file` de Espacios: este busca en su almacén de qué material o de qué mensaje es el archivo y chequea que la persona sea del espacio o vea el canal. El bucket es privado y nada se lee desde el navegador directo a Supabase.

## Estructura de carpetas

```text
hackai/
├── lib/
│   ├── core/            people/, studies/, spaces/, today/
│   ├── ports/           identity, siu, classroom, external-channel, files, clock
│   ├── adapters/        identity-demo/, siu-simulado/, moodle-simulado/, discord/, supabase/, memoria/, caida/, cache/
│   ├── composition      arma los módulos con sus adaptadores; el único lugar que los conoce a todos
│   ├── request-memo    comparte lecturas exitosas dentro de un render
│   └── demo-base/       preparar, verificar y probar la base de la demo (npm run demo:*); no lo usa la app
├── app/                 pantallas y server actions
├── components/
├── supabase/migrations/ tablas propias de HackAI
├── supabase/simulados/  tablas siu_* y moodle_* con su seed: solo para la demo
└── tests/
    ├── core/            un archivo por módulo
    └── contracts/       una batería por puerto
```

**Reglas de import.** La primera y la última las chequea `scripts/checks/reglas.sh` en el pre-commit y en CI; el resto se revisa en `code-review`.

- `core/` importa `ports/`, las interfaces de otros módulos de `core/` y piezas sueltas de `lib/` como `result` o `dates`. Nunca `adapters/`, `composition`, `app/`, `components/` ni el cliente de la base (`@supabase/*`).
- `adapters/` importa `ports/` y los tipos de `core/` que necesita.
- `app/` importa `composition` y los tipos de `core/`. Las pantallas no tienen reglas de negocio.
- `components/` no importa `composition`, salvo la campana de sesión (`components/shell/notifications-bell.tsx`): lee los no leídos y las notas nuevas (`lib/new-grades.ts`) como una página, porque Next.js no vuelve a ejecutar el layout al navegar y el número quedaría viejo. No lleva reglas de negocio.
- `composition` es el único lugar que conoce los adaptadores. Elige los de Supabase y Discord en producción; los tests arman sus propias instancias con los de memoria. Fuera de `lib/`, también los usan los scripts de `scripts/` (seeds y base de la demo), que arman lo suyo con `lib/adapters/supabase/demo-base.ts` y se lo pasan a `lib/demo-base/`.

Composition comparte las lecturas repetidas entre el layout, la página y los módulos durante un render.
Las escrituras invalidan las lecturas que pueden haber cambiado. El alcance termina con el render.

## De la demo a producción

La demo y producción usan el mismo núcleo. Lo que cambia es qué adaptador elige `composition` y la configuración. Si para pasar a producción hubiera que tocar `core/`, el diseño está mal y se revisa.

| Pieza | En la demo | En producción | Qué hace falta y de quién |
| --- | --- | --- | --- |
| Identidad | Elegir una persona sintética | Microsoft Entra ID por OpenID Connect, la misma cuenta del Campus Virtual | Registrar la app en el tenant de la Austral (TI de la Austral). Se implementa con `fetch` y `node:crypto`; si no alcanza, ADR para sumar una dependencia |
| SIU | Simulado sobre `siu_*` | API REST v2 de Guaraní, con un usuario propio para HackAI. Inscribir y el cronograma no existen: el adaptador lo declara, `enroll` devuelve `requiere-autogestion` y Hoy muestra solo finales y fechas de Moodle | Usuario de API y permisos por recurso (TI de la Austral y del SIU) |
| Aula virtual | Simulado sobre `moodle_*` | Web Services REST de Moodle con un token y un servicio con las funciones de la [research](../../docs/research/2026-11-10-moodle-web-services.md). Si la interfaz SIU → Moodle está activa, HackAI no matricula | Servicio, rol y token en el Moodle de la Austral (administración del Campus) |
| Canal externo | Discord, en un servidor del equipo | El mismo adaptador, instalado en el servidor de cada cátedra. Slack entra con su adaptador: recibe los eventos por HTTP y los entrega por el mismo «leer desde un cursor», así el núcleo no cambia | Que cada cátedra instale el bot y vincule sus canales |
| Base y archivos | Supabase del equipo | Supabase o Postgres de producción, con las mismas migraciones | Proyecto de producción y su backup |

**Reglas para que el paso sea un cambio de configuración:**

- **Adaptadores por entorno.** `composition` elige cada adaptador por una variable de entorno, una por puerto (por ejemplo `HACKAI_SIU` con `simulado` o `api`), y una más para el almacén de los módulos (`HACKAI_STORE` con `memoria` o `supabase`). Sus valores van en `.env.local` y en el hosting, y en los docs se nombran, nunca se copian.
- **Lo simulado se puede tirar.** Las tablas `siu_*` y `moodle_*`, sus migraciones y el seed sintético van aparte de las tablas propias de HackAI. En producción no se aplican, y nada de HackAI depende de ellas fuera de sus adaptadores.
- **Ids de los sistemas de origen.** Las tablas propias guardan los ids del SIU, de Moodle y de Discord tal como vienen, mapeados por Personas. Así los datos de producción entran sin migrar nada.
- **Adaptadores que se portan bien con sistemas lentos:** cada llamada tiene tiempo máximo, los reintentos esperan lo que pide el sistema (por ejemplo `retry_after` en un 429) y una caída devuelve un error como valor, que el núcleo convierte en «desactualizado».
- **Corrida periódica.** `syncAll` lo llama un cron del hosting, por ejemplo Vercel Cron, a través de una ruta protegida por un secreto: `/api/cron/sync` con `CRON_SECRET` (README, «Corrida periódica»).
- **Logs sin datos personales:** se registran ids y resultados, nunca mensajes, notas ni nombres.
- **Datos reales.** Antes de conectar un sistema de origen real hace falta un acuerdo con la Austral como encargado de tratamiento (Ley 25.326, art. 25; ver la [research de normativa](../../docs/research/2026-11-10-burocracia-academica-y-normativa.md)). Los espacios se archivan al cerrar el cuatrimestre y los datos se pueden suprimir a pedido.

Esta tabla es el plan; en la hackathon se construyen solo los adaptadores de la demo. Los de producción se escriben contra el mismo puerto y deben pasar la misma batería de contrato.

## Tests

- **Por módulo** (`tests/core/`): cada test arma el módulo real con los adaptadores en memoria y el reloj fijo, ejecuta una operación de la interfaz y mira el resultado y lo que les quedó a los puertos.
- **Sin dobles de módulos propios:** los tests de Hoy y de Espacios usan Cursada y Personas reales sobre puertos en memoria. Así se prueba el comportamiento real y los tests sobreviven a cualquier reordenamiento interno.
- **Por puerto** (`tests/contracts/`): la misma batería corre contra el adaptador en memoria y contra el real, para que el doble se porte como el real. Al de Discord se le inyecta `fetch` con respuestas de ejemplo con la forma de su API: sin red. Los simulados del SIU y de Moodle corren contra la base solo si hay una de prueba.
- **Casos que no pueden faltar:** los de la spec, entre ellos:
  - una inscripción que falla en Moodle deshace la del SIU;
  - un alumno de la comisión A no ve `#consultas` de la B;
  - no hay canal directo entre dos alumnos;
  - un mensaje nacido en HackAI no vuelve duplicado de Discord, y uno pendiente se envía en la siguiente sincronización;
  - parciales y finales salen ordenados por fecha.

## Qué se descartó y por qué

- **Puertos y adaptadores en todas las capas** (un puerto entre cada par de módulos, una clase por caso de uso): agrega interfaces sin que nada varíe detrás. Entre módulos propios hay un solo adaptador posible, el módulo real, así que el puerto sería indirección.
- **Seis módulos, como decía la primera versión de la spec:** Académico era casi un pasamanos del SIU y se juntó con Cursada. Sincronización obligaba a Espacios a exponer operaciones solo para ella, así que pasó a estar adentro.
- **Que Cursada agregue miembros a Espacios al inscribir:** sumaba un tercer paso que podía fallar en la inscripción y una segunda copia de la membresía. Espacios la deduce de Cursada.
