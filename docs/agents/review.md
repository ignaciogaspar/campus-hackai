# Review de PRs

Cómo revisa Claude un PR de este repo. La siguen la review automática, una por PR, que al terminar deja la label `revisado-por-claude` (`.github/workflows/claude-review.yml`), y las que se piden con `@claude` (`.github/workflows/claude.yml`).

Esta guía es lo que aprende la review: cuando Claude marca algo que no correspondía o se le escapa algo, se suma una línea en «Qué mirar» o en «Qué queda afuera», con el PR de ejemplo entre paréntesis. A mano, o pidiéndolo en el PR: «@claude sumá a docs/agents/review.md que…».

## 1. Juntar el contexto

- El PR: `gh pr view <n> --json title,body,closingIssuesReferences,files,commits` y `gh pr diff <n>`. El diff sale de `gh pr diff`, que es el mismo que ve GitHub y no depende de la historia del checkout. Para leer un archivo entero, abrilo en el checkout.
- La issue que cierra (`Closes #N`): `gh issue view <N>`. Sus criterios de aceptación son la spec del PR. Si no cierra ninguna, lo decís en el resumen y la revisás contra la descripción del PR.
- Los checks: `gh pr checks <n>`. CI ya corre Biome, typecheck, tests, build y las reglas de `AGENTS.md`, así que leés su resultado en vez de correrlos.
- Las reglas del repo: `AGENTS.md`, `GLOSSARY.md`, las ADR de `docs/adr/` que toque el diff y `hackai/docs/ARQUITECTURA.md` si el diff toca `hackai/lib/`.

## 2. Qué mirar, en orden

Cada archivo del diff pasa por los seis puntos. La review está terminada cuando cada criterio de la issue tiene un veredicto y cada archivo fue mirado.

1. **Spec.** Cada criterio de aceptación de la issue: hecho, a medias o falta. Lo que falta o cambia sin explicación en el PR es bloqueante.
2. **Arquitectura y reglas duras** (`AGENTS.md`, ADR 0004). `core/` habla con los sistemas de origen solo a través de los puertos, `composition` es el único que arma los módulos, los datos se leen y escriben en el servidor, y los datos de alumnos son sintéticos.
3. **Bugs.** Resultados incorrectos, errores sin manejar, promesas sin `catch`, carreras, y los casos borde de este dominio: listas vacías, la persona sin cuenta en un sistema, y la `falla-externa` del SIU, Moodle o Discord.
4. **Pantallas.** Cada pantalla nueva o cambiada funciona en el celular y en el escritorio (se diseña primero para el celular). Foco visible, controles con nombre accesible, y áreas táctiles de 44 px o más.
5. **Tests.** El comportamiento nuevo tiene su test en `hackai/tests/`, como pide `ARQUITECTURA.md`: por módulo con los adaptadores en memoria, y la batería de contrato si cambia un puerto o un adaptador.
6. **Nombres y textos.** Las entidades se llaman como en `GLOSSARY.md`. Los textos de UI, los comentarios y los mensajes de error van en español rioplatense con voseo.

## 3. Qué queda afuera

Esto ya lo cubre otra cosa o ya está decidido:

- Formato, orden de imports, comillas y punto y coma: lo resuelve Biome.
- Errores de tipos, tests que fallan y build roto: lo marca CI en sus checks.
- Las reglas que chequea `scripts/checks/reglas.sh` (`campus/` en un commit aparte, lo simulado fuera de `migrations/`, RLS, ADR por paquete nuevo, secretos): lo marca CI.
- Las funciones que ya llevan un `biome-ignore` de complejidad: están anotadas en la issue #30.
- El `!` de TypeScript: decisión de la ADR 0007.
- Lo que el PR deja escrito como pendiente o «a confirmar con el equipo»: entra solo si es un riesgo para la demo.

## 4. Cómo comentar

- **Un comentario en línea por hallazgo**, en la línea exacta, con `mcp__github_inline_comment__create_inline_comment`. Si el arreglo es chico y lo resuelve entero, va como bloque `suggestion` para aplicarlo con un clic.
- **Formato [Conventional Comments](https://conventionalcomments.org/)**: la etiqueta en inglés y el texto en español con voseo. Las etiquetas son `issue (blocking):`, `issue:`, `suggestion:`, `question:`, `nitpick (non-blocking):` y `praise:`.
- **Cada comentario dice tres cosas:** qué pasa, por qué importa acá (citando el criterio de la issue, la regla de `AGENTS.md` o la ADR) y cómo se arregla.
- **Hasta cinco `nitpick`**: si hay más, elegí los que más valen.
- **Al final, un resumen** con `gh pr comment`, de diez líneas como máximo:
  - el veredicto: se puede mergear, se puede mergear después de algo puntual, o todavía no;
  - cuántos bloqueantes hay;
  - los criterios de la issue que faltan;
  - el estado de los checks de CI.
