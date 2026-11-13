# Validaciones

Resultados de las mediciones de [alcance.md](alcance.md#cómo-se-mide): cada tarea, hoy contra HackAI. Los alumnos van anonimizados (A1, A2…).

Lo que depende solo del sistema (cuánto tarda HackAI en mover algo) lo mide el equipo una vez, con la cota y de dónde sale: no cambia de un alumno a otro. Lo que depende de cada persona (cómo hace hoy la tarea, qué le llega al celular) se mide o se pregunta con alumnos.

## T3, «enterarme»

Cuánto tarda en llegar un aviso o un material nuevo.

**Para el pitch:** «hoy te enterás al día siguiente, o nunca; con HackAI, en segundos».

### Lado HackAI: lo mide el equipo

Es mecánico y está acotado:

- **HackAI → Discord:** inmediato. Se envía al publicar; si Discord no responde, queda pendiente y sale en la siguiente sincronización.
- **Discord → HackAI, con el canal abierto:** La pantalla pregunta después de 5, 10 y hasta 20 segundos sin cambios. Al detectar novedades, vuelve a 5 segundos. HackAI limita la sincronización con Discord a una vez cada 5 segundos por espacio.
- **Discord → HackAI, entrando después:** lo ve al abrir el espacio.

| Fecha | Sentido | Resultado | Notas |
| --- | --- | --- | --- |
| 11/11/2026 | HackAI → Discord | Casi instantáneo | Build de producción en Docker, con Discord real (servidor del equipo). |
| 11/11/2026 | Discord → HackAI | Unos segundos: dos recargas | Antes de la actualización automática. La primera recarga cayó dentro de los 5 segundos desde la lectura anterior y no leyó; la segunda, sí. |
| 11/11/2026 | HackAI → otra pantalla abierta | 13 segundos, sin recargar | Con la actualización automática, en una build de producción local: se publicó en una pestaña y apareció solo en la otra. |

Rama `feat/15-sync-discord` (#15).

### Lado alumnos: se les pregunta

No hay nada que cronometrar del lado de hoy: el alumno se entera por un mail que no abre, por un compañero o en clase. Se le pregunta a cada uno (3 alumnos):

1. **Cómo se entera hoy** de un aviso o un material nuevo, y cuánto tarda, aproximadamente. Es la línea de base de T3.
2. **Si le llega la notificación de Discord** al celular cuando el docente publica en el canal de la cátedra. Que el aviso esté en Discord no garantiza que suene: depende de cómo tenga configurado el servidor (con «Solo @menciones», no suena; pregunta abierta 12) y de las notificaciones del teléfono.

**Falta:** hacerles las dos preguntas y anotar las respuestas acá.
