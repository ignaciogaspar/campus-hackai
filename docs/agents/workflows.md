# Workflows

En este repo los agentes en paralelo se lanzan con el Workflow tool y un script guardado en `.claude/workflows/`, no con subagentes armados a mano (ADR 0003). Cada script fija quién hace qué, con qué modelo y qué devuelve.

## Cómo se invoca

Llamá al Workflow tool con `name` igual al nombre del archivo sin `.js` y `args` como objeto JSON:

```json
{ "name": "mergeable-check", "args": { "feature": "inscripciones" } }
```

- Los arrays van como arrays JSON reales, no como texto.
- El script valida sus `args` y falla con un mensaje que dice cuál falta. El `meta.whenToUse` de cada script es la fuente de verdad de sus args; esta tabla es su resumen.
- El resultado vuelve como un objeto a la sesión que lo llamó, que es la que decide qué hacer con él (corregir, comentar el ticket, mostrarle al usuario).

## Índice

Modelo y esfuerzo: «sesión» significa que los agentes heredan los de la sesión que llama.

| Workflow | Para qué | Args | Devuelve | Lo llama | Modelo / esfuerzo |
|---|---|---|---|---|---|
| `review-axes` | Revisar el diff desde un punto fijo en dos ejes independientes: estándares del repo y spec. Solo lectura. | `{ fixedPoint, standardsSources: [rutas], smellBaseline, spec \| null }` | `{ standards, spec }`: un reporte por eje con hallazgos (`file`, `line`, `kind`, `severity`, `rule`, `evidence`). Sin spec, `spec` vuelve como `{ skipped: true, findings: [] }`. | skill `code-review` | sesión |
| `implement-tickets` | Implementar los tickets de una spec por olas, según sus dependencias: un agente por ticket desbloqueado, cada uno en su worktree con `tdd`, y un merger que integra de a uno. | `{ spec, integrationBranch, tickets: [{ id, title, blockedBy: [ids] }], notesDir, explore? }`. El branch de integración tiene que existir y estar checkouteado en la raíz, con el árbol limpio. | `{ integrationBranch, waves, allMerged, tickets: [estado por ticket] }` | skill `implement-spec` | sesión |
| `design-it-twice` | Generar 3 o más diseños de interfaz radicalmente distintos para un módulo, uno por restricción, y compararlos. | `{ brief, constraints?: [texto] }` (por defecto: interfaz mínima, máxima flexibilidad, caso común) | `{ designs, comparison }` | skill `codebase-design` (`DESIGN-IT-TWICE.md`); `improve-codebase-architecture` llega a través de ella | sesión |
| `explore-codebase` | Lectores en paralelo, uno por área del repo, que devuelven un mapa para responder una pregunta. Solo lectura. | `{ question, areas: [{ name, paths: [rutas] }], synthesize? }` | `{ maps, synthesis }`: por área, resumen, archivos con su rol, fricciones y qué aporta a la pregunta. `synthesis` es `null` sin `synthesize`. | skills `grilling` e `improve-codebase-architecture` | sesión / medio |
| `research-tickets` | Resolver en paralelo los tickets de research de un mapa de wayfinder: un agente por ticket, en su worktree, con la skill `research`. Deja la nota en el branch `research/<number>`; no abre PR ni cierra el ticket. | `{ tickets: [{ number, question }], push? }` | `{ results: [{ number, answer, sources, notePath, branch, unresolved }], missing }` | skill `wayfinder` | sesión |
| `mergeable-check` | Revisar una feature de `hackai/` contra el checklist de compatibilidad con campus: un revisor por dimensión y un escéptico por hallazgo que intenta refutarlo. Solo lectura. | `{ feature }` (nombre de la carpeta de la feature) | `{ feature, mergeable, confirmed, unverified, refuted, notReviewed, coverage }`. Severidades: `bloquea-merge`, `genera-conflicto`, `menor`. | skills `campus-feature`, `port-to-campus`, `sync-campus`, `implement`, `implement-spec` y `code-review` | sesión |
| `scan-siu-campus` | Relevar SIU Guaraní y el Campus Virtual en el Chrome del usuario, por áreas, en solo lectura. Requiere Claude in Chrome conectado y la sesión de alumno iniciada en los dos sitios. | `{ areas?: [ids] }` con ids entre `siu-inicio`, `siu-cursada`, `siu-examenes`, `siu-reportes`, `siu-tramites`, `campus-inicio`, `campus-curso`, `campus-herramientas`, `campus-integraciones`. Sin args releva todas. | `{ results, missing }`: un relevamiento por área | skill `relevar-siu-campus` | Sonnet / medio |

## Cuándo usar un workflow

Usalo cuando el trabajo se parte en piezas independientes que no necesitan verse entre sí, o cuando la independencia es el punto (una revisión que no comparte contexto con quien escribió el código, diseños que no se copian entre sí).

Hacelo inline, en la sesión, cuando:

- es una lectura puntual: un archivo, un comando, una pregunta que se responde con un `grep`;
- es un solo ticket (skill `implement`) o un cambio de uno o dos archivos;
- cada paso depende de lo que encontró el anterior;
- hace falta ir conversando con el usuario en el medio.

Si dudás, inline: un workflow gasta más tokens y tarda más en arrancar de lo que ahorra en una tarea chica.

## Reglas para los agentes de un workflow

- **Archivos disjuntos.** Dos agentes del mismo workflow no escriben el mismo archivo. Si el reparto no lo garantiza, cada agente corre con `isolation: 'worktree'` y un paso posterior integra de a uno (así lo hacen `implement-tickets` y `research-tickets`).
- **`campus/` es de solo lectura** también para ellos. Un lector entra a `campus/` solo si el área que le asignaron lo pide.
- **Solo lectura cuando el workflow revisa o releva.** `review-axes`, `explore-codebase`, `mergeable-check` y `scan-siu-campus` no editan archivos ni hacen commits; `scan-siu-campus` además no toca botones que confirmen, envíen, inscriban o den de baja.
- **Sin datos personales.** Lo relevado de SIU y Campus vuelve con marcadores (`<nota>`, `<nombre>`), no con datos de la cuenta.
- Un agente de workflow no ve la conversación: todo lo que necesita va en `args` o en archivos del repo.

## Sumar o cambiar un workflow

Script nuevo en `.claude/workflows/<nombre>.js` con `meta.name` igual al nombre del archivo, su fila en esta tabla y, si reemplaza un paso de una skill, la skill editada para llamarlo: todo en el mismo PR. Antes de escribirlo, cargá la skill `workflow-authoring`. Si cambian los args de un script, actualizá la skill que lo llama: la llamada y el script tienen que coincidir.
