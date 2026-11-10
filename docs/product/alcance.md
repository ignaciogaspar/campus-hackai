# Alcance

**Estado al 10/11/2026: en definición.** Ya están decididos el problema, la estrategia, para quién es y qué resuelve cada sistema. Falta el recorte de la demo, la identidad del alumno y cómo se simula cada sistema de origen ([preguntas-abiertas.md](preguntas-abiertas.md)).

Contexto: [hackathon.md](hackathon.md) (reglas y calendario), [problema.md](problema.md) (problemas y línea base de clicks).

## El problema

> La vida académica de un alumno de la Austral está partida en sistemas que no se hablan. Para saber qué le toca tiene que revisar el SIU y el Campus y cruzar pantallas a mano. Para cursar una materia se inscribe en uno y espera que otro lo matricule en el otro. Y si se pierde un aviso, pierde un cupo, un crédito o una fecha.

Es la versión vigente. Se ajusta con lo que salga de cada validación.

**De dónde sale** (encuesta a 39 alumnos): cursos viejos mezclados (56%), aulas desordenadas (54%), inscripción a materias o exámenes en el SIU (54%), mal desde el celular (49%), avisos que no llegan (44%, y lo más pedido en texto libre), no ver las fechas en el inicio (36%) y no saber qué inscripción está abierta (21%). En texto libre aparecen créditos y optativas perdidos por no enterarse a tiempo o porque el SIU se cayó.

**La promesa:** un solo lugar que te dice qué te toca y te avisa a tiempo.

## Decisiones

- **Estrategia:** sistema propio, HackAI, construido de cero con puertos y adaptadores. SIU, Moodle y Campus Austral son sistemas de origen. Por cada capacidad, si un sistema existente la resuelve bien, HackAI la delega; si no, la resuelve el núcleo ([ADR 0004](../adr/0004-sistema-propio-con-puertos-y-adaptadores.md)).
- **Para quién:** el alumno. El lado docente se suma si conseguimos información de docentes.
- **Campus Austral es opcional.** Si conectarlo trae problemas, lo que nos sirva de su lógica lo hacemos nosotros de cero. No le copiamos código.
- **Diseño:** se rediseña todo con mucho foco en UX y UI, con los colores de la Austral. Lo feo y lo difícil de usar fue una de las quejas más grandes.

## Qué resuelve cada sistema

| Capacidad | Quién la resuelve | Por qué |
| --- | --- | --- |
| Ver mis materias actuales, con las viejas archivadas | Núcleo | Moodle no lo resuelve (56%) |
| Qué me toca: parciales y finales | Núcleo, con las fechas del SIU | Hoy están en el Cronograma de evaluaciones y en las mesas, ordenados por materia y no por fecha |
| Avisos unificados y notificaciones a tiempo, incluida la apertura de inscripciones | Núcleo | Ningún sistema avisa bien (44%, y 21% no sabe qué inscripción está abierta) |
| Inscribirse a una materia y quedar adentro de su aula | Núcleo: pide la inscripción al SIU y la matriculación a Moodle en un solo paso | Hoy son dos sistemas y la matriculación depende de otro proceso |
| Constancias y certificados | SIU | Lo burocrático se queda donde está |
| Notas e historia académica | SIU, mostradas desde el núcleo | Una sola fuente de verdad |
| Material y entregas | Moodle o Campus Austral, con enlace directo | No vale la pena rehacerlo |
| Inscripción a finales con cupo | SIU, por el mismo flujo de inscripción | Entra solo si sobra tiempo |

**Por qué «qué me toca» se limita a parciales y finales:** son las fechas que el SIU ya tiene. Las de Moodle dependen de que cada docente las cargue: en el relevamiento, el Calendario del Campus tenía un solo evento en noviembre para 14 cursos. Las entregas con fecha de Moodle pueden sumarse como complemento, sin prometer que estén todas.

## Cómo se mide

Tiempo de procesos completos, hoy contra HackAI, con alumnos reales. Ejemplo: inscribirse a una materia en el SIU y quedar matriculado en su aula de Moodle, contra el mismo proceso en HackAI. En SIU y Campus reales no se confirma nada; cómo se arma una comparación real con esa regla está abierto ([preguntas-abiertas.md](preguntas-abiertas.md), #5).

## Qué falta decidir

1. El recorte de la demo del 13/11.
2. Cómo se mide la comparación real sin confirmar nada en SIU y Campus.
3. Identidad e ingreso del alumno.
4. Cómo se simula cada sistema de origen.
5. Qué respondemos sobre cumplimiento (#7).
