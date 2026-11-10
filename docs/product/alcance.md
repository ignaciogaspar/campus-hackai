# Alcance

**Estado al 10/11/2026: por decidir.** El equipo todavía no eligió qué construir. Este archivo lista las ideas candidatas y lo que falta decidir. Cuando se cierre, se reemplaza por el alcance acordado y las decisiones difíciles de revertir van a `docs/adr/`.

Contexto: [hackathon.md](hackathon.md) (reglas y calendario), [problema.md](problema.md) (problemas y línea base).

## Ideas candidatas

Salen del research del equipo. El encaje y el costo son la estimación del análisis del repo de Nacho ([nota](../research/2026-11-10-repo-campus-nacho.md), sección 10 de la pestaña), hecha leyendo el código sin correr la app. Ninguna está elegida ni descartada.

| Idea | Problemas que ataca | Encaje en campus | Costo estimado |
| --- | --- | --- | --- |
| Inicio «Mi cuatrimestre» para el celular: materias actuales, próximas entregas, avisos sin leer | A8, A9, A10 | Alto. Ya existe la lógica de «próximo paso» y la home del alumno; falta que sea de varias materias | Medio: tablas propias de materias e inscripciones y una pantalla nueva |
| Avisos donde están los alumnos | A7, pedido docente | Alto. Hay tabla de avisos y herramienta MCP sin pantalla propia | Bajo a medio |
| Resumen semanal con IA | A7, A11 | Alto. Claude ya está integrado; el resumen de analítica sirve de modelo | Bajo a medio |
| Inscripción a materias o finales con cupo | A3 | Medio. Existe el patrón de reserva con cupo (función SQL `oh_book`); no existe el modelo académico | Medio a alto |
| Cierre de actas | Cumplimiento (registros) | Medio. Hay rúbricas, CSV y patrón de borrador y publicación; falta acta inmutable y rol de bedelía | Alto |
| Matriculación automática SIU a Moodle y rol «final pendiente» | A5, A6 | Bajo. Es un problema de Moodle; en campus solo se puede simular | Fuera de esta base |
| Arreglos de configuración de Moodle (fechas de fin, filtros, Línea de tiempo, push, aviso de cambio de contenido marcado) | A7, A8, A9 | Ninguno. Sirven para el pitch como quick wins | No aplica |

Los códigos A1 a A11 son los de [problema.md](problema.md).

Dos ideas del research no tienen fila en el análisis de encaje: «aula ordenada por defecto» (plantilla de curso y chequeo de actividades sin fecha) y el arreglo de los mensajes cortados con «…».

## Restricciones que pesan en la elección

- **Tiempo:** tres ciclos diarios hasta el pitch del 13/11.
- **Campus es de un solo curso y dos roles.** Cualquier idea tipo SIU (varias materias, bedelía) necesita tablas nuevas propias; el detalle está en [la nota del repo](../research/2026-11-10-repo-campus-nacho.md#límites).
- **Todo dato de SIU y Moodle va a ser sintético.** No hay acceso de administrador ni API confirmada.
- **El zip de campus no compila tal como vino** ([campus-upstream.md](../campus-upstream.md)). Hasta que Nacho pase el repo completo, `hackai/` tiene que poder correr sin depender de `campus/`.

## Qué hace falta decidir para cerrar el alcance

Cada punto tiene su pregunta en [preguntas-abiertas.md](preguntas-abiertas.md):

1. Estrategia: sobre la base de campus, sobre Moodle y SIU, desde cero, o envolviendo.
2. Qué idea se construye (una, o una principal y quick wins para el pitch).
3. Para quién: alumno, docente o ambos.
4. Qué es real y qué está simulado en la demo.
5. Con qué métrica se muestra la mejora, sobre la línea base de clicks.
6. Qué entiende Nacho por «mergeable» y cómo quiere recibir el código.

## Cuando se decida

1. Reemplazar este archivo por el alcance acordado: qué entra, qué queda afuera, métrica objetivo.
2. Marcar las preguntas como decididas en [preguntas-abiertas.md](preguntas-abiertas.md).
3. Escribir la spec de la feature en `hackai/docs/<FEATURE>.md` con el formato de `campus/docs/POST-CLASS.md`.
