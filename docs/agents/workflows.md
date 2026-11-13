# Workflows

En este repo los agentes en paralelo se lanzan con el Workflow tool y un script guardado en `.claude/workflows/`, no con subagentes armados a mano (ADR 0003). Cada script fija quién hace qué, con qué modelo y qué devuelve.

## Cómo se invoca

Llamá al Workflow tool con `name` igual al nombre del archivo sin `.js` y `args` como objeto JSON:

```json
{ "name": "scan-siu-campus", "args": { "areas": ["siu-cursada"] } }
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
| `scan-siu-campus` | Relevar SIU Guaraní y el Campus Virtual en el Chrome del usuario, por áreas, en solo lectura. Requiere Claude in Chrome conectado y la sesión de alumno iniciada en los dos sitios. | `{ areas?: [ids] }` con ids entre `siu-inicio`, `siu-cursada`, `siu-examenes`, `siu-reportes`, `siu-tramites`, `campus-inicio`, `campus-curso`, `campus-herramientas`, `campus-integraciones`. Sin args releva todas. | `{ results, missing }`: un relevamiento por área | skill `relevar-siu-campus` | Sonnet / medio |
| `recorrer-ux` | Probar HackAI como distintos perfiles, por módulo, y sacar mejoras de UX/UI. Recorrer (un agente por perfil × módulo, cada uno con su Chrome headless y su sesión, completando tareas de punta a punta en las vistas de su perfil) → Verificar (un escéptico por celda reproduce cada hallazgo e intenta refutarlo) → Sintetizar (deduplica entre celdas, agrupa por tema y prioriza). Completa flujos que cambian datos, por eso corre contra el servidor local con adaptadores en memoria. | `{ baseUrl, sessionSecret, outDir, hackaiDir, modulos?: [ids], perfiles?: [ids] }`. Módulos: `ingreso`, `shell`, `hoy`, `materias`, `tareas`, `calificaciones`, `asistencia`, `inscripciones`, `academico`, `calendario`, `novedades`, `tramites`; sin `modulos`, todos. Perfiles por defecto: `alumno-fi`, `alumno-fce`, `docente-joven`, `docente-medio`, `docente-mayor`; opcional: `alumno-pasivo`. | `{ celdas, hallazgos, descartados, sintesis: { resumen, temas, mejoras, porPerfil, positivos, sinCubrir }, faltantes, salteadas }`. Cada mejora sale lista para issue, con prioridad P0 a P3, criterios de aceptación y archivos. | la sesión, a pedido; con el resultado escribe una nota en `docs/research/` y saca los issues con `to-tickets` | Recorrer: Opus. Verificar: Sonnet / alto. Sintetizar: Opus / alto |

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
- **Solo lectura cuando el workflow revisa o releva.** `review-axes`, `explore-codebase`, `scan-siu-campus` y `recorrer-ux` no editan archivos ni hacen commits; `scan-siu-campus` además no toca botones que confirmen, envíen, inscriban o den de baja. `recorrer-ux` sí completa flujos, pero solo contra el servidor local con datos sintéticos en memoria.

## Correr `recorrer-ux`

1. Levantá el servidor como dice `hackai/README.md`, «Recorrer la app como una persona», con un `SESSION_SECRET` descartable y los adaptadores en memoria.
2. Llamalo con `outDir` en el scratchpad, fuera del repo, porque ahí quedan las capturas. Por ejemplo `{ "baseUrl": "http://localhost:3014", "sessionSecret": "<descartable>", "outDir": "<scratchpad>/ux", "hackaiDir": "<ruta absoluta a hackai/>", "modulos": ["inscripciones"] }`.
3. Con los cinco perfiles y todos los módulos salen unas 43 celdas, con un recorrido y una verificación cada una. Para una pasada rápida, filtrá con `modulos` o `perfiles`.
4. Con el resultado, escribí la nota en `docs/research/` con datos sintéticos y sin capturas, y sacá los issues de las mejoras con la skill `to-tickets`. Reiniciá el servidor antes de otra corrida: los recorridos dejan datos cambiados.

La edad y la familiaridad digital de cada perfil no están en los datos sintéticos. Son un rasgo que el agente actúa y que define qué vistas se emulan; el docente mayor usa `desktop-zoom` y `mobile-texto-grande`. Los perfiles están en `PERFILES`, al principio del script.
- **Sin datos personales.** Lo relevado de SIU y Campus vuelve con marcadores (`<nota>`, `<nombre>`), no con datos de la cuenta.
- Un agente de workflow no ve la conversación: todo lo que necesita va en `args` o en archivos del repo.

## Sumar o cambiar un workflow

Script nuevo en `.claude/workflows/<nombre>.js` con `meta.name` igual al nombre del archivo, su fila en esta tabla y, si reemplaza un paso de una skill, la skill editada para llamarlo: todo en el mismo PR. Antes de escribirlo, cargá la skill `workflow-authoring`. Si cambian los args de un script, actualizá la skill que lo llama: la llamada y el script tienen que coincidir.
