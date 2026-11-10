# Skills del equipo

Selección de 21 de las 27 skills del plugin **mattpocock-skills** (Matt Pocock), versión 1.3.1, tomadas del repositorio https://github.com/mattpocock/skills en el commit `49dd158d1076134a641b33efb035946536778336` el 2026-11-01. Licencia MIT (ver `LICENSE-mattpocock-skills`).

Llegaron copiadas del repo `platform`, que las había tomado del plugin. A esas 21 se suman 4 skills propias de este repo (`campus-feature`, `port-to-campus`, `sync-campus`, `relevar-siu-campus`), y 6 de las de Matt Pocock están modificadas para usar workflows en vez de subagentes (ver "Modificaciones a las skills de Matt Pocock").

Están acá, y no instaladas como plugin, para que todo el equipo use exactamente las mismas versiones sin instalar nada: Claude Code carga `.claude/skills/<nombre>/SKILL.md` de cualquier clon del repo. Se invocan sin prefijo: `/grilling`, `/to-tickets`. `.claude/settings.json` desactiva los plugins `mattpocock-skills` y `superpowers` para que no haya dos copias de la misma skill.

## Qué hay y para qué sirve

**Definir producto y dominio**

| Skill | Para qué | Cuándo |
|---|---|---|
| `grill-with-docs` | Entrevista por rondas para cerrar decisiones; actualiza `GLOSSARY.md` y escribe ADRs en el camino. Llama a `grilling` y `domain-modeling`. | Al definir alcance, una feature o una decisión difícil. |
| `grilling` | La entrevista sola, sin tocar docs. | Para estresar una idea rápido. |
| `domain-modeling` | Mantener el glosario y los ADRs: desafía términos, propone escenarios límite. | Cada vez que aparece un término nuevo o una decisión difícil de revertir. |
| `research` | Investigar una pregunta en fuentes primarias y dejar una nota con fuentes en `docs/research/`. | Antes de decidir sobre algo que no sabemos (APIs, regulación, cómo hace X otro producto). |
| `to-questionnaire` | Convertir una decisión que no podés cerrar solo en un cuestionario para otra persona. | Para pasarle preguntas a otro integrante del equipo o a Nacho de forma asincrónica. |
| `prototype` | Prototipo descartable para contestar una pregunta de diseño (un modelo de estados, una pantalla). | Para validar un flujo o una pantalla antes de codear. |
| `relevar-siu-campus` (propia) | Volver a relevar un área puntual de SIU Guaraní o del Campus Virtual en el Chrome del usuario, solo lectura. | Cuando el relevamiento del Google Doc del equipo no alcanza para decidir. |

**Pasar de alcance a trabajo**

| Skill | Para qué | Cuándo |
|---|---|---|
| `to-spec` | Sintetizar la conversación en una spec y publicarla como issue de GitHub. | Cuando una discusión ya cerró y hay que dejarla escrita. |
| `to-tickets` | Partir una spec o plan en tickets con sus dependencias, publicados en GitHub Issues. | Para bajar a tickets lo que quedó en `docs/product/alcance.md`. |
| `triage` | Mover issues por los estados de triage (`needs-triage`, `ready-for-agent`, etc.) y dejarlos listos para implementar. | Cuando entren issues o PRs externos. |
| `wayfinder` | Planificar un trabajo grande como un mapa de tickets de decisión en GitHub Issues, y resolverlos uno por uno hasta que el camino esté claro. | Para una feature con muchas incógnitas, antes de `to-tickets`. |
| `setup-matt-pocock-skills` | Reconfigurar tracker, labels y domain docs (`docs/agents/*`). Ya se corrió. | Solo si cambia el tracker. |

**Construir**

| Skill | Para qué | Cuándo |
|---|---|---|
| `implement` | Implementar una pieza de trabajo desde una spec o un ticket, usando `tdd`. | Un ticket a la vez. |
| `implement-spec` | Implementar una spec completa recorriendo sus tickets en un branch de integración. | Una feature entera con varios tickets. |
| `tdd` | Desarrollo guiado por tests, red-green-refactor. | Siempre que se escriba código. |
| `codebase-design` | Vocabulario y criterios para módulos profundos: dónde va una costura, qué se expone. | Al diseñar un módulo o interfaz. |
| `improve-codebase-architecture` | Escanear el código buscando módulos para profundizar, mostrarlo como reporte y entrevistar sobre el elegido. | Cuando haya código y se quiera ordenar antes de seguir. |
| `diagnosing-bugs` | Bucle de diagnóstico para bugs difíciles y regresiones de performance. | Cuando algo falla y no es obvio por qué. |
| `code-review` | Revisar cambios contra los estándares del repo y contra la spec del ticket. | Antes de pedir review o mergear. |
| `pr` | Escribir el cuerpo de un PR. | Al abrir un PR. |
| `campus-feature` (propia) | Construir una feature en `hackai/` siguiendo el checklist de compatibilidad con campus (mismas rutas, stack y convenciones). | Cada feature nueva de `hackai/`, desde el primer archivo. |
| `port-to-campus` (propia) | Llevar una feature de `hackai/` a una copia de campus con `scripts/port-to-campus.sh` y armar el parche para Nacho. | Cuando una feature está terminada y pasó `mergeable-check`. |

**Trabajo en equipo y agentes**

| Skill | Para qué | Cuándo |
|---|---|---|
| `handoff` | Compactar la conversación en un documento para que otra persona o agente la retome. | Al cortar una sesión a mitad de algo. |
| `writing-for-agents` | Cómo escribir `AGENTS.md`, `CLAUDE.md` y skills para que un agente las siga bien. | Al editar esos archivos o adaptar una skill. |
| `sync-campus` (propia) | Reemplazar `campus/` entero por una versión nueva de Nacho con `scripts/sync-campus.sh`, en un commit aparte. | Cuando Nacho manda un zip o una versión nueva de su repo. |

## Workflows

Este repo no usa subagentes lanzados a mano con el Agent tool: todo trabajo en paralelo pasa por un workflow guardado en `.claude/workflows/<nombre>.js`, que se ejecuta con el Workflow tool (`name: "<nombre>"` y `args`). Qué hace cada uno, sus `args` y lo que devuelve está en [`docs/agents/workflows.md`](../../docs/agents/workflows.md); la razón, en `docs/adr/0003-workflows-en-vez-de-subagentes.md`.

| Workflow | Qué hace | Quién lo llama |
|---|---|---|
| `review-axes` | Las dos revisiones de `code-review` (estándares y spec) en paralelo. | `code-review` |
| `implement-tickets` | Implementa los tickets de una spec por frontera de dependencias, cada uno en un worktree, y los mergea al branch de integración. | `implement-spec` |
| `design-it-twice` | 3 o más diseños de interfaz radicalmente distintos y su comparación. | `codebase-design` (`DESIGN-IT-TWICE.md`), `improve-codebase-architecture` |
| `explore-codebase` | Lectores en paralelo por área que devuelven un mapa del código. | `grilling` (y por lo tanto `grill-with-docs`), `improve-codebase-architecture` |
| `research-tickets` | Resuelve en paralelo los tickets de research de un mapa, cada uno con la skill `research`. | `wayfinder` |
| `mergeable-check` | Revisa una feature de `hackai/` contra el checklist de compatibilidad con campus, con verificación adversarial. | `code-review`, `implement`, `implement-spec`, `campus-feature`, `port-to-campus`, `sync-campus` |
| `scan-siu-campus` | Releva SIU y Campus en Chrome por áreas, solo lectura. | `relevar-siu-campus` |

## Modificaciones a las skills de Matt Pocock

Estas skills ya no son idénticas a las del plugin. El resto de su texto quedó igual y en inglés.

Subagentes → workflows (cada una indica los `args` del workflow y que no hay que lanzar además subagentes con el Agent tool):

| Archivo | Qué cambió |
|---|---|
| `code-review/SKILL.md` | Los subagentes Standards y Spec pasan a ser el workflow `review-axes` (descripción del frontmatter, introducción y pasos 1, 2 y 4). |
| `implement-spec/SKILL.md` | Los subagentes de exploración, implementación y merge pasan a ser fases del workflow `implement-tickets` (pasos 2 a 6 y 9); los arreglos del review se hacen en la sesión principal (paso 7). |
| `codebase-design/DESIGN-IT-TWICE.md` y la última línea de `codebase-design/SKILL.md` | Los subagentes en paralelo pasan al workflow `design-it-twice`. |
| `improve-codebase-architecture/SKILL.md` | El subagente que recorre el código pasa a `explore-codebase` (paso 1); la mención final a design-it-twice nombra el workflow. |
| `wayfinder/SKILL.md` | Los subagentes de research pasan a `research-tickets` (definición del ticket Research y paso 5 de "Chart the map"). |
| `grilling/SKILL.md` | La búsqueda de hechos con subagente pasa a `explore-codebase` cuando hay que recorrer varias áreas; una búsqueda puntual se hace inline. |

Paso agregado de compatibilidad con campus (cuando el cambio es una feature de `hackai/`, correr `mergeable-check` o el checklist de `campus-feature` antes de dar el trabajo por terminado):

| Archivo | Dónde |
|---|---|
| `code-review/SKILL.md` | Paso 6 nuevo, "Mergeable check". |
| `implement/SKILL.md` | Párrafo después de la llamada a `code-review`. |
| `implement-spec/SKILL.md` | Paso 7. |

Al actualizar desde upstream estos cambios se pisan: hay que volver a aplicarlos (ver "Cómo actualizar").

## Qué se dejó afuera y por qué

Del plugin original se excluyeron `ask-matt` (un índice de skills; esta tabla lo reemplaza), `grill-me` (duplica a `grill-with-docs`), `retro`, `teach`, `wait-what` y `wizard` (para aprovisionar infraestructura y credenciales; vuelve si hace falta al desplegar). Ninguna de las que quedan depende de ellas.

Para sumar una: copiar su carpeta desde `~/.claude/plugins/cache/claude-plugins-official/mattpocock-skills/<versión>/skills/` y agregarla a esta tabla por PR. Si la skill lanza subagentes, adaptarla a un workflow antes de sumarla.

## Cómo actualizar

1. Instalar o actualizar el plugin en tu máquina (`/plugin`, marketplace `claude-plugins-official`) para tener la versión nueva en `~/.claude/plugins/cache/claude-plugins-official/mattpocock-skills/<versión>/`.
2. Copiar sobre `.claude/skills/` solo las 21 carpetas de Matt Pocock; las 4 propias no existen upstream y no se tocan.
3. Volver a aplicar las modificaciones de la sección anterior. `git diff` muestra qué pisó la copia: en los archivos listados, conservar lo nuevo de upstream y reponer las llamadas a workflows y el paso de `mergeable-check`. Terminó cuando `grep -rniE "sub-?agent" .claude/skills` solo devuelve las frases "Do not spawn sub-agents with the Agent tool" y la mención de `writing-for-agents`.
4. Actualizar la versión y el commit en este archivo, y abrir un PR.
5. Volver a desactivar el plugin si quedó habilitado, para no tener las skills duplicadas.
