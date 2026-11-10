---
status: accepted
date: 2026-11-10
---

# Los espacios de la materia se sincronizan de ida y vuelta con el canal externo de cada cátedra

Los avisos no llegan: el Campus no tiene push, el mail se ignora y la mensajería interna del Campus está escondida y nadie la abre. En vez de construir notificaciones propias y pedirle a todos que vivan en HackAI, cada cátedra o docente elige un canal externo que ya usa (Discord, Slack u otro) y HackAI sincroniza su espacio de la materia con ese canal en los dos sentidos. Lo que el docente sube o publica en el canal externo (material, avisos, respuestas) aparece en HackAI, y lo que se publica o se consulta en HackAI aparece en el canal externo. Las notificaciones las da la app que el alumno y el docente ya tienen. HackAI sigue siendo la vista unificada: junta en un lugar lo que viene del canal externo, de Moodle y del SIU. Cada plataforma entra por su adaptador (ADR 0004); la primera es Discord, porque es la que ya usan cátedras como Laboratorio 3.

## Opciones consideradas

- **Notificaciones propias (push web o mail)**: rechazada. El mail se ignora, y el push web obliga a instalar la app y suma una dependencia para cifrar los envíos.
- **Delegar todo en Discord o Slack, sin espacio en HackAI**: rechazada. El material y las consultas quedarían separados de lo demás del alumno, que es justo lo que queremos unificar, y la cátedra que no usa un canal externo quedaría afuera.
- **Sincronización solo de ida (HackAI hacia el canal externo)**: rechazada. El docente que ya sube material a Discord tendría que repetirlo en HackAI.

## Consecuencias

- Hay que vincular la cuenta del canal externo de cada docente con su persona en HackAI. En la demo, el vínculo se carga a mano en el seed.
- Un mensaje puede nacer de los dos lados, así que cada mensaje recuerda dónde nació para no duplicarse al sincronizar.
- El contenido de la materia también queda en un tercero. Es una elección de la cátedra y se dice en el pitch.
- Cómo se lee cada plataforma (consultas a su API REST a demanda o periódicas, o webhooks) se confirma con research antes de la spec.
