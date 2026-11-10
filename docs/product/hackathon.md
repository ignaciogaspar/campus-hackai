# HackAI 2026: reglas del juego

Hackathon de la Universidad Austral. Consigna: rediseñar SIU Guaraní y el Campus Virtual (Moodle).

**Fuente:** análisis del artifact de kickoff «HackAI 2026 Product» (23 slides, R&D Software Engineering Lab, Austral), resumido en la pestaña [Repo Mergeable de Nacho](https://docs.google.com/document/d/1vzCAqms9f6OHlAU2imse0ZOsw-SNLW2Ol5P_9auUWtk/edit?tab=t.jsz8o639788i), sección 3. Este archivo es una lectura de segunda mano: si una regla define una decisión, confirmarla contra el artifact original.

## Calendario

| Fecha | Qué pasa |
| --- | --- |
| Vie 06/11/2026 | Definición del objetivo |
| Sáb 07/11 a jue 12/11 | Pruebas: un ciclo por día |
| Vie 13/11/2026 | Demo y pitch, con 1-pager y changelog |

Al 10/11 quedan tres ciclos (10, 11 y 12). Alcanza para una feature acotada que se muestre corriendo, no para una reescritura.

## Qué se evalúa

- Claridad del problema.
- Resultado (outcome) frente a output.
- Iteraciones validadas.
- Estrategia justificada.
- Riesgos reducidos.
- Calidad de la demo.

Consecuencia para el repo: cada ciclo diario tiene que dejar evidencia (qué se probó, con quién, qué cambió). El changelog del viernes sale de ahí.

## Estrategias posibles

El artifact nombra tres: construir desde cero, construir sobre Moodle y SIU Guaraní, o envolver lo que hay. «Se evalúa que esté justificada, no cuál eligen».

Construir sobre el repo de Nacho (Campus Austral) es una cuarta variante: una base nueva que ya existe. No reemplaza a Moodle ni al SIU; a lo sumo los envuelve o convive con ellos. Qué estrategia seguimos está sin decidir: ver [preguntas-abiertas.md](preguntas-abiertas.md).

## Reglas de trabajo que fija el kickoff

- **Extender antes que forkear.** Aplicado a este repo: módulo propio en `hackai/` con las rutas de campus, en vez de editar archivos compartidos de `campus/`.
- **Spike el día 1.** Levantar la base lleva más de lo que se cree. Acá es urgente: el zip de campus no compila ni se puede sembrar tal como vino ([campus-upstream.md](../campus-upstream.md)).
- **Datos sintéticos.** «Nada de datos reales de alumnos. Generen datos sintéticos realistas». Vale para seeds, capturas, tests y la demo. Campus ya lo hace con un padrón ficticio marcado `is_fictional` y seeds idempotentes.
- **Entender el sistema propio.** Código que nadie del equipo entiende es un riesgo. Ingeniería aporta criterio en datos, permisos, trazabilidad y revisión.
- **Escribir para un agente.** La spec lleva contexto, roles, reglas, criterios de aceptación y estrategia. Campus ya trabaja así: `campus/docs/POST-CLASS.md` es la plantilla de spec de feature.

## Cumplimiento

El kickoff pide tener en cuenta cuatro cosas. Toda spec de feature que toque datos académicos las responde explícitamente:

- **CONEAU:** qué exige la acreditación sobre el proceso que se rediseña.
- **Registros:** qué tiene que quedar asentado (actas, historial, cambios: quién cambió qué y cuándo).
- **Permisos:** quién ve y quién modifica cada dato.
- **Datos mínimos:** guardar solo los datos personales necesarios.

Qué ofrece campus para esto y qué le falta está en [la nota del repo de Nacho](../research/2026-11-10-repo-campus-nacho.md#13-límites-del-repo-que-condicionan-la-idea).
