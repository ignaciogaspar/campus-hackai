---
status: accepted
date: 2026-11-13
---

# El asistente del Planning usa Claude con el SDK oficial de Anthropic

Secretaría carga el Planning de Aulas subiendo la planilla o una clase a mano. Para los cambios sueltos, escribir «suspendé Termodinámica del viernes 13» o «AM1 comisión A pasa los lunes al Aula A10» es más rápido que completar diez campos. Sumamos un asistente que traduce ese mensaje a filas del Planning con Claude (`claude-sonnet-5-5`, esfuerzo `high`). Para llamarlo usamos el SDK oficial, `@anthropic-ai/sdk`, que había salido del repo en el issue #62 porque nada lo usaba (ADR 0002).

## Opciones consideradas

- **`fetch` a mano contra la API:** sin dependencia, pero hay que reescribir lo que el SDK ya resuelve y prueba: reintentos con espera ante 429 y 5xx, tiempo máximo, tipos de la respuesta y errores tipados. Rechazada.
- **El SDK oficial, `@anthropic-ai/sdk`:** el cliente que mantiene Anthropic, con tipos de TypeScript, errores por clase y salidas estructuradas. Elegida.
- **Otro proveedor o un modelo local:** el equipo ya usa Claude y un modelo local no corre en Vercel. Rechazada.

## Consecuencias

- Entra `@anthropic-ai/sdk` como dependencia, fijado en `1.3.0`, sin `^`. No entra `zod`: el esquema de la respuesta se escribe como JSON Schema.
- Lo usa solo el adaptador `lib/adapters/claude/planning-assistant.ts`, en el servidor. El núcleo habla con el puerto `PlanningAssistant` y en los tests usa el adaptador en memoria (ADR 0004).
- **Solo secretaría lo usa.** El rol se verifica en la pantalla, en la acción del servidor y en el núcleo antes de llamar al modelo, así nadie más gasta una llamada.
- **No hay agente ni herramientas:** una sola llamada por mensaje, sin historial, con salida estructurada. El modelo no guarda nada: lo que propone pasa por los mismos chequeos de la planilla (aula ocupada, repetida, suspender algo que no existe) y secretaría lo confirma antes de guardarlo.
- **Gasto acotado:** el mensaje se corta a 1.000 caracteres, se mandan hasta 500 clases con un número corto en vez del id, el prefijo va cacheado, `max_tokens` es 8.000 y hay un tope de 50 mensajes por día por persona.
- **Datos:** a la API de Anthropic solo viajan materia, comisión, facultad, aula, horario y el mensaje de secretaría; ningún dato de alumnos ni de docentes.
- Se activa con `HACKAI_ASSISTANT=claude` y `ANTHROPIC_API_KEY`. Sin esas variables el asistente no aparece y la carga sigue como antes.
- Si Claude se niega o no responde, el asistente lo dice y secretaría carga a mano. No hay reintento en otro modelo (decisión del 13/11/2026).
