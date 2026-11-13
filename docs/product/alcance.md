# Alcance

**Estado al 10/11/2026: decidido.** Problema, estrategia, qué resuelve cada sistema, espacio de la materia, recorte de la demo y medición. Antes de la spec se corre el research de burocracia e integración.

Contexto: [hackathon.md](hackathon.md) (reglas y calendario), [problema.md](problema.md) (problemas y línea base de clicks).

## El problema

> La vida académica de un alumno de la Austral está partida en sistemas que no se hablan. Para saber qué le toca tiene que revisar el SIU y el Campus y cruzar pantallas a mano. Para cursar una materia se inscribe en uno y espera que otro lo matricule en el otro. Y si se pierde un aviso, pierde un cupo, un crédito o una fecha.

Es la versión vigente. Se ajusta con lo que salga de cada validación.

**De dónde sale** (encuesta a 39 alumnos): cursos viejos mezclados (56%), aulas desordenadas (54%), inscripción a materias o exámenes en el SIU (54%), mal desde el celular (49%), avisos que no llegan (44%, y lo más pedido en texto libre), no ver las fechas en el inicio (36%) y no saber qué inscripción está abierta (21%). En texto libre aparecen créditos y optativas perdidos por no enterarse a tiempo o porque el SIU se cayó. El docente entrevistado pidió una comunicación «del estilo Discord o Slack».

**La promesa:** un solo lugar que te dice qué te toca y te avisa a tiempo.

## Decisiones

- **Estrategia:** sistema propio, HackAI, construido de cero con puertos y adaptadores. SIU, Moodle, Campus Austral y los canales externos son sistemas de origen. Por cada capacidad, si un sistema existente la resuelve bien, HackAI la delega; si no, la resuelve el núcleo ([ADR 0004](../adr/0004-sistema-propio-con-puertos-y-adaptadores.md)).
- **Para quién:** el alumno primero. Del docente entra el espacio de la materia (publicar, responder y elegir su canal externo) y, desde el 12/11/2026, lo que pidieron los docentes: tomar lista, tareas con entregas, calificaciones y el Excel de la materia ([docentes.md](docentes.md)).
- **Comunicación:** cada espacio de la materia se sincroniza de ida y vuelta con el canal externo que elige la cátedra; las notificaciones llegan por ahí ([ADR 0005](../adr/0005-sincronizacion-con-canales-externos.md)). El primero es Discord.
- **Campus Austral es opcional.** Si conectarlo trae problemas, lo que nos sirva de su lógica lo hacemos nosotros de cero. No le copiamos código.
- **Diseño:** se rediseña todo con mucho foco en UX y UI, con los colores de la Austral. Lo feo y lo difícil de usar fue una de las quejas más grandes.

## Qué resuelve cada sistema

| Capacidad | Quién la resuelve | Por qué |
| --- | --- | --- |
| Ver mis materias actuales, con las viejas archivadas | Núcleo | Moodle no lo resuelve (56%) |
| Qué me toca: parciales y finales | Núcleo, con las fechas del SIU | Hoy están en el Cronograma de evaluaciones y en las mesas, ordenados por materia y no por fecha |
| Espacio de la materia: avisos, consultas y mensajes con el docente | Núcleo, sincronizado con el canal externo de la cátedra | La mensajería y el foro del Campus no avisan y nadie los usa |
| Notificaciones | El canal externo de la cátedra | Ya está en el celular de alumnos y docentes |
| Material de la materia | Núcleo: lo reúne de Moodle, del canal externo y de lo que se sube a HackAI, e indica de dónde viene cada archivo | Hoy está suelto y repartido |
| Inscribirse a una materia y quedar adentro de su aula y de su espacio | Núcleo: pide la inscripción al SIU y la matriculación a Moodle en un solo paso | Hoy son dos sistemas y la matriculación depende de otro proceso |
| Inscripción a finales con cupo | SIU, por el mismo flujo de inscripción | La queja número uno del SIU (54%) |
| Constancias y certificados | SIU, con enlace directo a su Autogestión | Lo burocrático se queda donde está |
| Notas e historia académica | SIU, mostradas desde el núcleo | Una sola fuente de verdad; la API del SIU las expone |
| Finales pendientes: qué finales debés y su próxima mesa | Núcleo, con la historia y las mesas del SIU | El SIU no lo responde: hay que cruzar la historia con las mesas a mano |
| Cuántas faltas tengo en cada materia y cuántas me quedan | Núcleo, con las inasistencias del SIU (#60), en una sección propia y no en la tarjeta de la materia | Hoy es entrar a Reportes > Inasistencias y contar filas; el máximo, si el SIU lo da, no figura al lado |
| Tomar lista | Núcleo: el docente toca a los ausentes. HackAI guarda la asistencia y la pasa al SIU si el SIU lo permite | Hoy le lleva de 10 a 15 minutos por clase en el SIU (dato contado, no medido) |
| Tareas y entregas de trabajos prácticos | Núcleo: el docente crea la tarea y el alumno entrega en HackAI. Las tareas de Moodle se siguen mostrando con su enlace | Decisión del 12/11/2026: reemplaza «Entregas: Moodle» ([docentes.md](docentes.md)) |
| Calificaciones de la comisión y nota de cursada | Núcleo: el docente carga una vez en HackAI. El alumno las ve en HackAI sin depender del SIU, y HackAI pasa al SIU las notas de parciales y la de cursada si el SIU lo permite | Hoy las carga en el SIU alumno por alumno |
| Agregar parciales, finales y entregas al calendario del celular | Núcleo: un archivo .ics con lo que viene | Hoy hay dos calendarios desconectados y ninguno llega al teléfono |

**Lo que el research cambia** ([SIU](../research/2026-11-10-siu-guarani-integracion.md), [Moodle](../research/2026-11-10-moodle-web-services.md), [normativa](../research/2026-11-10-burocracia-academica-y-normativa.md)):

- **La API del SIU no permite inscribir.** Sus inscripciones a cursada y a examen son solo de lectura; inscribirse es una acción de la Autogestión. En la demo la inscripción en un paso es simulada de punta a punta; en producción, HackAI lleva al alumno a la Autogestión del SIU con un enlace directo, salvo que la universidad y el SIU habiliten otro canal.
- **La matriculación automática ya existe.** El SIU tiene una interfaz oficial que crea un curso de Moodle por comisión y sincroniza las matrículas. Que el alumno tenga que matricularse a mano es una configuración que la Austral no usa o no tiene activa (a confirmar). Es un argumento para el pitch.
- **El cronograma de evaluaciones no está en la API del SIU.** Sí están las inscripciones a mesas y las mesas de cada docente. En la demo se simula; en producción, los parciales necesitan otro canal.
- **Ninguna norma nacional encontrada impide mostrar o iniciar trámites desde otro sistema.** Las reglas de inscripción y equivalencias son de cada universidad (Ley 24.521, art. 29 inc. j). Actas, analíticos y diplomas quedan en el SIU y en el circuito del Ministerio (SICER 2.0). Con datos reales, HackAI sería encargado de tratamiento y haría falta un acuerdo con la Austral (Ley 25.326).

**Por qué «qué me toca» se limita a parciales y finales:** son las fechas que el SIU ya tiene. Las de Moodle dependen de que cada docente las cargue: en el relevamiento, el Calendario del Campus tenía un solo evento en noviembre para 14 cursos. Las entregas con fecha de Moodle pueden sumarse como complemento, sin prometer que estén todas.

## El espacio de la materia

- **Uno por materia y facultad.** Análisis Matemático I de Ingeniería y el de Empresariales son espacios distintos; dentro de Ingeniería, sus comisiones A y B comparten espacio.
- **Se crea solo** a partir del SIU, y quien se inscribe a una comisión queda adentro.
- **Canales de toda la materia:** el contenido general (material) y, como extra, consultas generales.
- **Canales de cada comisión:** `#avisos` (solo los docentes de la comisión) y `#consultas`, porque dependen de cada docente. Las consultas y sus respuestas las ven todos los de la comisión; el docente las marca resueltas. El docente crea más canales en un click.
- **Mensajes directos** solo entre alumno y docente. Entre alumnos no hay: hablan por otro lado.
- **Avisos de Moodle:** el adaptador de Moodle los trae a `#avisos`, para que la adopción sea gradual.
- **Primer caso de sincronización:** de Discord a HackAI, lo que el docente sube a material y a `#avisos`; de HackAI a Discord, las consultas, con la respuesta del docente de vuelta en HackAI.

## Recorte de la demo del 13/11

No queda nada afuera. Este es el orden en que se construye, para que siempre haya algo que mostrar:

1. **Espacio de la materia** sincronizado con Discord: material, avisos, consultas y mensajes con el docente.
2. **Mis materias como inicio:** el alumno entra a sus materias actuales, cada una con su espacio, lo próximo de Moodle y sus no leídos; la semana con parciales, finales y entregas está en Calendario y las novedades de todos los espacios, en la campana. Hoy queda para el docente, con sus comisiones y las consultas sin resolver (decisión del equipo del 12/11/2026, PR #88: Hoy le mostraba al alumno demasiado en la primera pantalla).
3. **Inscripción en un paso:** te inscribís y quedás en el aula y en el espacio.
4. Notas e historia académica, constancias e inscripción a finales con cupo.
5. **Docentes** (decisión del 12/11/2026): inasistencias del alumno en su sección, tomar lista, Excel de la materia, tareas y entregas, calificaciones. Orden y detalle en [docentes.md](docentes.md#recorte-para-la-demo).

**Real y simulado:** en la demo se entra eligiendo una persona sintética, alumno o docente, sin clave; en el pitch se cuenta que en producción se entra con la cuenta de Microsoft de la Austral. Discord es real, en un servidor del equipo. SIU y Moodle se simulan en tablas propias (`siu_*`, `moodle_*`) con datos sintéticos, modeladas sobre sus APIs reales; no levantamos un Moodle propio porque la máquina no lo aguanta. Campus Austral y WhatsApp quedan fuera de la demo.

## Cómo se mide

Procesos completos, hoy contra HackAI, con 3 alumnos por ciclo en sus propias cuentas, cronómetro y clicks. En SIU y Campus reales no se confirma nada.

- **T1, «¿qué me toca?»:** el próximo parcial o final y qué hay esta semana.
- **T2, «anotarme a algo abierto»:** hasta el botón «Inscribirse» del SIU, sin apretarlo. En HackAI, el flujo completo.
- **T3, «enterarme»:** cuánto tarda en llegar un aviso o un material nuevo. Hoy se le pregunta al alumno. En HackAI la demora depende solo del sistema: la mide el equipo una vez, con su cota. A los alumnos se les pregunta además si les llega la notificación de Discord al celular ([validaciones.md](validaciones.md#t3-enterarme)).
- **T4, «encontrar la nota de mi último parcial»:** hoy puede estar en historia académica o en actuación provisoria. Se mide de punta a punta mirando.
- **T5, «pedir una constancia de alumno regular»:** hasta el botón «Guardar» del SIU, sin apretarlo.
- **T6, «tomar lista»:** un docente toma lista de una comisión en el SIU y en HackAI, con cronómetro y toques.
- **Piloto con Laboratorio 3:** esa cátedra ya usa Discord. Si su docente acepta, se conecta un espacio de HackAI a su servidor y se mide cuánto tarda una consulta en tener respuesta. El contacto lo decide el equipo.

La espera de la matriculación en Moodle se anota como dato reportado, no medido. Los resultados van a `docs/product/validaciones.md`, con los alumnos anonimizados (A1, A2…).

## Cumplimiento

- Los registros académicos (inscripciones, notas, actas) siguen en el SIU: la trazabilidad oficial no cambia. HackAI guarda además las notas y la asistencia que carga el docente, y las pasa al SIU cuando el SIU lo permite; el acta se cierra en el SIU.
- HackAI guarda los mensajes y el material de cada espacio. Los ve solo quien pertenece al espacio o a la comisión, y los mensajes directos solo sus dos participantes. Se archivan al cerrar el cuatrimestre.
- Usar un canal externo es una elección de la cátedra, y ese contenido también queda en un tercero. Se dice en el pitch.
