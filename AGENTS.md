# campus-hackai

Repo del equipo para HackAI 2026 (Universidad Austral): rediseñar SIU Guaraní y el Campus Virtual (Moodle). Demo y pitch el viernes 13/11/2026. Nuestra app vive en `hackai/` y tiene que poder copiarse a Campus Austral, el repo de Nacho, que está vendorizado en `campus/`.

## Dónde está cada cosa

- `GLOSSARY.md`: glosario del dominio (SIU, Campus, Campus Austral). Leerlo antes de nombrar cualquier entidad.
- `docs/product/hackathon.md`: reglas y criterios de evaluación. `problema.md`: problemas e hipótesis del research. `alcance.md`: qué construimos; donde difiera de otro doc, manda el alcance. `preguntas-abiertas.md`: lo no decidido; una pregunta «abierta» no es una decisión.
- `docs/adr/`: decisiones difíciles de revertir. Leer las que toquen el área antes de proponer cambios.
- `docs/research/`: notas con fuentes, incluido el relevamiento de SIU y Campus.
- `docs/campus-upstream.md`: de dónde salió `campus/`, cómo se actualiza y sus problemas conocidos. Leerlo antes de importar algo de campus o de correr un script de `scripts/`.
- `docs/agents/workflows.md`: índice de los workflows guardados y cuándo usar cada uno.
- `campus/docs/SPEC.md`, `CONTRACTS.md`, `POST-CLASS.md`: las reglas de Nacho. Si chocan con su código, la regla escrita es la que sigue el código nuevo.
- `hackai/`: nuestra app. `hackai/compat.txt` lista los archivos «compat»: imitan helpers compartidos de campus (`@/lib/db`, `@/lib/auth`, `@/lib/claude`) para que una feature compile con los mismos imports, y nunca viajan a campus.
- `scripts/`: `sync-campus.sh` y `port-to-campus.sh`.

## Reglas duras

- **`campus/` es de solo lectura.** Es un snapshot del zip de Nacho. Se reemplaza entero con `scripts/sync-campus.sh` (skill `sync-campus`), en un commit aparte. Un arreglo a campus se anota en `docs/campus-upstream.md` para avisarle a Nacho; el código va en `hackai/`.
- **Compatibilidad por rutas.** Una feature vive en `hackai/` en las mismas rutas que usaría en campus:
  - `hackai/lib/<feature>/`: `types.ts`, `core.ts` (puro, sin I/O), `store.ts` (server-only), `actions.ts` (`'use server'`)
  - `hackai/components/<feature>/` con `<feature>.css` y prefijo de clase propio
  - `hackai/app/campus/<feature>/` (alumno), `hackai/app/profesor/<feature>/` (docente), `hackai/app/api/<feature>/`
  - `hackai/supabase/migrations/02NN_<feature>.sql`: desde 0240, idempotente, RLS activado sin políticas, `revoke` a `anon` y `authenticated`, solo tablas nuevas
  - `hackai/tests/<feature>.test.ts` con `node:test`
  - `hackai/docs/<FEATURE>.md` con el formato de `campus/docs/POST-CLASS.md`
  
  El checklist completo está en la skill `campus-feature`.
- **Mismo stack que campus, sin dependencias nuevas** (ADR 0002): Next.js 15, React 19, TypeScript estricto, Supabase, CSS plano. Sumar un paquete requiere una ADR.
- **Datos sintéticos.** Padrón, materias, inscripciones y notas son inventados y verosímiles. Del relevamiento de SIU y Campus solo entran estructuras y textos de interfaz, con los datos personales reemplazados por marcadores como `<nota>`.
- **Secretos solo en `.env.local`**, que está ignorado por git. En logs, reportes y commits van los nombres de las variables, nunca sus valores.
- **SIU y Campus reales: solo lectura.** Al relevarlos en el navegador se mira y se navega; los botones que confirman, envían, inscriben o dan de baja quedan sin tocar.

## Convenciones

- Documentación en español. Nombres de entidades, código, columnas e identificadores en inglés; el glosario los lista entre paréntesis. Valores de dominio en español (`'borrador'`, `'abierta'`).
- Textos de UI, comentarios y mensajes de error en español rioplatense con voseo. Rutas de páginas en español (`/campus/inscripciones`).
- Código: dos espacios, comillas simples, sin punto y coma, imports con `@/`. Campus no tiene linter: se respeta a mano.
- El trabajo se trackea en GitHub Issues de `ignaciogaspar/campus-hackai`. Cambios por PR a `main`.
- Las hipótesis en los docs están marcadas como tales. Pasan a decisión solo con confirmación del equipo; mientras tanto van a `docs/product/preguntas-abiertas.md`.

## Skills

Todas están en `.claude/skills/` (procedencia y tabla completa: `.claude/skills/README.md`). `.claude/settings.json` desactiva los plugins `mattpocock-skills` y `superpowers` para que no se dupliquen con las del repo.

| Fase | Skills |
|---|---|
| Entender y decidir | `grill-with-docs`, `grilling`, `domain-modeling`, `research`, `wayfinder`, `to-questionnaire`, `relevar-siu-campus` |
| Validar una idea | `prototype` |
| Spec y tickets | `to-spec`, `to-tickets`, `triage` |
| Construir | `campus-feature` (siempre, para cualquier feature de `hackai/`), `implement`, `implement-spec`, `tdd`, `codebase-design`, `improve-codebase-architecture`, `diagnosing-bugs` |
| Revisar | `code-review`, workflow `mergeable-check`, `pr` |
| Llevar a campus | `port-to-campus`, `sync-campus` |
| Sesiones y docs para agentes | `handoff`, `writing-for-agents` |

## Workflows en vez de subagentes

Cuando una skill o una tarea necesite agentes en paralelo, llamá al Workflow tool con el `name` de un script de `.claude/workflows/`: `review-axes`, `implement-tickets`, `design-it-twice`, `explore-codebase`, `research-tickets`, `mergeable-check`, `scan-siu-campus`. Args, qué devuelve cada uno y cuándo conviene hacerlo inline: `docs/agents/workflows.md`. Por qué: ADR 0003.

## Agent skills

### Issue tracker

Los issues viven en GitHub Issues de `ignaciogaspar/campus-hackai` (CLI `gh`). See `docs/agents/issue-tracker.md`.

### Triage labels

Las cinco labels de triage por defecto: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` en la raíz y ADRs en `docs/adr/`. See `docs/agents/domain.md`.
