# Validaciones

Resultados de las mediciones de [alcance.md](alcance.md#cómo-se-mide): cada tarea, hoy contra HackAI. Los alumnos van anonimizados (A1, A2…). Una medición hecha por el equipo, sin alumnos, se marca como informal: sirve para saber si el flujo anda, no como resultado para el pitch.

## T3, «enterarme»

Cuánto tarda en llegar un aviso o un material nuevo.

| Fecha | Quién | Tipo | Sentido | Resultado | Notas |
| --- | --- | --- | --- | --- | --- |
| 11/11/2026 | Equipo | Informal | HackAI → Discord | Casi instantáneo | Se envía al publicar. La notificación de Discord depende de cómo cada uno tenga configurado el servidor (pregunta abierta 12). |
| 11/11/2026 | Equipo | Informal | Discord → HackAI | Unos segundos: dos recargas | HackAI lee Discord al abrir el espacio, como mucho una vez cada 5 segundos por espacio. La primera recarga cayó dentro de esos 5 segundos y no leyó; la segunda, sí. La página no se actualiza sola. |

Contexto: build de producción en Docker, con Discord real (servidor del equipo) y el resto en memoria. Rama `feat/15-sync-discord` (#15).

**Falta:** medirlo con 3 alumnos en vivo, cronometrando desde que el docente publica en Discord hasta que el alumno lo ve en el celular, y anotar cómo se entera hoy cada uno sin HackAI (se le pregunta).
