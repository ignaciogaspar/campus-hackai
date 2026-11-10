---
status: accepted
date: 2026-11-10
---

# Los agentes en paralelo se lanzan con workflows guardados, no con subagentes

Varias skills de Matt Pocock piden lanzar subagentes en paralelo (`code-review`, `implement-spec`, `codebase-design`, `improve-codebase-architecture`, `wayfinder`, `grilling`). Lanzados a mano, cada sesión los arma distinto: otro prompt, otro modelo, otro reparto de archivos. Decidimos que todo trabajo en paralelo pase por el Workflow tool con un script guardado en `.claude/workflows/`: `review-axes`, `implement-tickets`, `design-it-twice`, `explore-codebase`, `research-tickets`, `mergeable-check` y `scan-siu-campus`. Las skills afectadas se editaron para decir «llamá al Workflow tool con name '<workflow>' y args {...}» donde decían «spawn sub-agents».

## Opciones consideradas

- **Subagentes como en las skills originales**: no requiere mantener scripts, pero el reparto de trabajo, el modelo y el esfuerzo quedan a criterio de cada sesión, y con varias personas trabajando en paralelo durante pocos días eso da resultados que no se pueden comparar. Rechazada.
- **Todo inline en la sesión principal**: lo más simple, pero las revisiones independientes dejan de serlo (el mismo contexto que escribió el código lo revisa) y explorar o implementar varios tickets en serie no entra en los días que quedan. Se mantiene solo para tareas chicas.

## Consecuencias

- El orquestado queda versionado y revisable por PR: quién lee qué, con qué modelo y esfuerzo, y qué devuelve. Todo el equipo corre lo mismo.
- Los agentes de un workflow trabajan sobre archivos disjuntos; cuando tienen que escribir sobre el mismo árbol, cada uno va en su worktree (`implement-tickets`).
- Las skills copiadas ya no son idénticas a las de `mattpocock/skills`: al actualizarlas hay que volver a aplicar el cambio. `.claude/skills/README.md` lista cuáles están modificadas.
- Hace falta un cliente con Workflow tool. Sin él, la skill se sigue a mano leyendo el script como guion.
- Un workflow nuevo se agrega con su script y su fila en `docs/agents/workflows.md`, en el mismo PR.
- Las tareas chicas (un archivo, una pregunta, un ticket) se hacen inline: un workflow cuesta más de lo que ahorra.
