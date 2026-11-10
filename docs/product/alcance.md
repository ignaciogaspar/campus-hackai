# Alcance

**Estado al 10/11/2026: casi cerrado.** Están decididos el problema, la estrategia, qué resuelve cada sistema, el espacio de la materia, el recorte de la demo y cómo se mide. Falta confirmar de dónde salen los datos de SIU y Moodle y correr el research previo a la spec ([preguntas-abiertas.md](preguntas-abiertas.md)).

Contexto: [hackathon.md](hackathon.md) (reglas y calendario), [problema.md](problema.md) (problemas y línea base de clicks).

## El problema

> La vida académica de un alumno de la Austral está partida en sistemas que no se hablan. Para saber qué le toca tiene que revisar el SIU y el Campus y cruzar pantallas a mano. Para cursar una materia se inscribe en uno y espera que otro lo matricule en el otro. Y si se pierde un aviso, pierde un cupo, un crédito o una fecha.

Es la versión vigente. Se ajusta con lo que salga de cada validación.

**De dónde sale** (encuesta a 39 alumnos): cursos viejos mezclados (56%), aulas desordenadas (54%), inscripción a materias o exámenes en el SIU (54%), mal desde el celular (49%), avisos que no llegan (44%, y lo más pedido en texto libre), no ver las fechas en el inicio (36%) y no saber qué inscripción está abierta (21%). En texto libre aparecen créditos y optativas perdidos por no enterarse a tiempo o porque el SIU se cayó. El docente entrevistado pidió una comunicación «del estilo Discord o Slack».

**La promesa:** un solo lugar que te dice qué te toca y te avisa a tiempo.

## Decisiones

- **Estrategia:** sistema propio, HackAI, construido de cero con puertos y adaptadores. SIU, Moodle, Campus Austral y los canales externos son sistemas de origen. Por cada capacidad, si un sistema existente la resuelve bien, HackAI la delega; si no, la resuelve el núcleo ([ADR 0004](../adr/0004-sistema-propio-con-puertos-y-adaptadores.md)).
- **Para quién:** el alumno primero. Del docente entra lo necesario para el espacio de la materia: publicar, responder y elegir su canal externo.
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
| Constancias y certificados | SIU | Lo burocrático se queda donde está |
| Notas e historia académica | SIU, mostradas desde el núcleo | Una sola fuente de verdad |
| Entregas | Moodle, con enlace directo | No vale la pena rehacerlo |

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
2. **Hoy:** materias actuales, próximo parcial o final y novedades de todos los espacios.
3. **Inscripción en un paso:** te inscribís y quedás en el aula y en el espacio.
4. Notas e historia académica, constancias e inscripción a finales con cupo.

**Real y simulado:** en la demo se entra eligiendo una persona sintética, alumno o docente, sin clave; en el pitch se cuenta que en producción se entra con la cuenta de Microsoft de la Austral. Discord es real, en un servidor del equipo. Campus Austral queda fuera de la demo. De dónde salen los datos de SIU y Moodle está por confirmar ([preguntas-abiertas.md](preguntas-abiertas.md), #4).

## Cómo se mide

Procesos completos, hoy contra HackAI, con 3 alumnos por ciclo en sus propias cuentas, cronómetro y clicks. En SIU y Campus reales no se confirma nada.

- **T1, «¿qué me toca?»:** el próximo parcial o final y qué hay esta semana.
- **T2, «anotarme a algo abierto»:** hasta el botón «Inscribirse» del SIU, sin apretarlo. En HackAI, el flujo completo.
- **T3, «enterarme»:** cuánto tarda en llegar un aviso o un material nuevo. Hoy se le pregunta al alumno; en HackAI se mide en vivo, del Discord del docente al celular.

La espera de la matriculación en Moodle se anota como dato reportado, no medido. Los resultados van a `docs/product/validaciones.md`, con los alumnos anonimizados (A1, A2…).

## Cumplimiento

- Los registros académicos (inscripciones, notas, actas) siguen en el SIU: la trazabilidad oficial no cambia.
- HackAI guarda los mensajes y el material de cada espacio. Los ve solo quien pertenece al espacio o a la comisión, y los mensajes directos solo sus dos participantes. Se archivan al cerrar el cuatrimestre.
- Usar un canal externo es una elección de la cátedra, y ese contenido también queda en un tercero. Se dice en el pitch.
