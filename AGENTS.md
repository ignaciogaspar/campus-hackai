# campus-hackai

Repo del equipo para HackAI 2026 (Universidad Austral): rediseñar SIU Guaraní y el Campus Virtual (Moodle). Demo y pitch el viernes 13/11/2026. Construimos HackAI, un sistema propio en `hackai/` que unifica la vida académica del alumno. SIU, Moodle y Campus Austral (el repo de Nacho, con su snapshot en `campus/`) son sistemas de origen.

## Dónde está cada cosa

- `GLOSSARY.md`: glosario del dominio (SIU, Campus Virtual, Campus Austral, HackAI). Leerlo antes de nombrar cualquier entidad.
- `docs/product/hackathon.md`: reglas y criterios de evaluación. `problema.md`: problemas y línea base de clicks. `alcance.md`: qué construimos; donde difiera de otro doc, manda el alcance. `preguntas-abiertas.md`: lo no decidido; una pregunta «abierta» no es una decisión.
- `docs/adr/`: decisiones difíciles de revertir. Leer las que toquen el área antes de proponer cambios.
- `docs/research/`: notas con fuentes, incluido el relevamiento de SIU y Campus.
- `docs/campus-upstream.md`: de dónde salió `campus/`, cómo se actualiza y sus problemas conocidos.
- `docs/agents/workflows.md`: índice de los workflows guardados y cuándo usar cada uno.
- `hackai/`: nuestro sistema. Cómo correrlo: `hackai/README.md`. Módulos, puertos, carpetas y tests: `hackai/docs/ARQUITECTURA.md`.
- `scripts/sync-campus.sh`: reemplaza el snapshot de `campus/`.

## Reglas duras

- **Puertos y adaptadores en los bordes, módulos profundos adentro** (ADR 0004). Los sistemas de origen (SIU, Moodle, canales externos) entran por un puerto con un adaptador real y uno en memoria. El núcleo son cuatro módulos (`people`, `studies`, `spaces`, `today`) que se llaman por su interfaz. `core/` nunca importa `adapters/` ni `app/`, y solo `composition` arma los módulos con sus adaptadores. Leer `hackai/docs/ARQUITECTURA.md` antes de crear o mover un archivo de `hackai/lib/`.
- **`campus/` es de solo lectura.** Es la referencia de la lógica de Campus Austral: se lee y se reimplementa en `hackai/`, sin copiar código. Se reemplaza entero con la skill `sync-campus`, en un commit aparte.
- **Stack fijo, sin dependencias nuevas** (ADR 0002): Node 22, Next.js 15, React 19, TypeScript estricto, Supabase, CSS plano, tests con `node:test`. Sumar un paquete requiere una ADR.
- **Datos en el servidor.** Todo acceso a la base pasa por el servidor con el service role. Las migraciones son idempotentes y activan RLS sin políticas.
- **Datos sintéticos.** Alumnos, materias, inscripciones y notas son inventados y verosímiles. Del relevamiento de SIU y Campus solo entran estructuras y textos de interfaz, con los datos personales reemplazados por marcadores como `<nota>`.
- **Secretos solo en `.env.local`**, que está ignorado por git. En logs, reportes y commits van los nombres de las variables, nunca sus valores.
- **SIU y Campus reales: solo lectura.** Al relevarlos o cronometrarlos en el navegador se mira y se navega; los botones que confirman, envían, inscriben o dan de baja quedan sin tocar.

## Convenciones

- Documentación en español. Nombres de entidades, código, columnas e identificadores en inglés; el glosario los lista entre paréntesis. Valores de dominio en español (`'borrador'`, `'abierta'`).
- Textos de UI, comentarios y mensajes de error en español rioplatense con voseo. Rutas de páginas en español (`/inscripciones`).
- Código: dos espacios, comillas simples, sin punto y coma, imports con `@/`. No hay linter: se respeta a mano.
- El trabajo se trackea en GitHub Issues de `ignaciogaspar/campus-hackai`. Cambios por PR a `main`.
- Las hipótesis en los docs están marcadas como tales. Pasan a decisión solo con confirmación del equipo; mientras tanto van a `docs/product/preguntas-abiertas.md`.

## Skills

Todas están en `.claude/skills/` (procedencia y tabla completa: `.claude/skills/README.md`). `.claude/settings.json` desactiva los plugins `mattpocock-skills` y `superpowers` para que no se dupliquen con las del repo.

| Fase | Skills |
|---|---|
| Entender y decidir | `grill-with-docs`, `grilling`, `domain-modeling`, `research`, `wayfinder`, `to-questionnaire`, `relevar-siu-campus` |
| Validar una idea | `prototype`, `ui-collage` (mocks de pantallas antes de codear) |
| Spec y tickets | `to-spec`, `to-tickets`, `triage` |
| Construir | `implement`, `implement-spec`, `tdd`, `codebase-design`, `improve-codebase-architecture`, `diagnosing-bugs` |
| Revisar | `code-review`, `pr` |
| Actualizar `campus/` | `sync-campus` |
| Sesiones y docs para agentes | `handoff`, `writing-for-agents` |

## Workflows en vez de subagentes

Cuando una skill o una tarea necesite agentes en paralelo, llamá al Workflow tool con el `name` de un script de `.claude/workflows/`: `review-axes`, `implement-tickets`, `design-it-twice`, `explore-codebase`, `research-tickets`, `scan-siu-campus`. Args, qué devuelve cada uno y cuándo conviene hacerlo inline: `docs/agents/workflows.md`. Por qué: ADR 0003.

## Agent skills

### Issue tracker

Los issues viven en GitHub Issues de `ignaciogaspar/campus-hackai` (CLI `gh`). See `docs/agents/issue-tracker.md`.

### Triage labels

Las cinco labels de triage por defecto: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` en la raíz y ADRs en `docs/adr/`. See `docs/agents/domain.md`.
