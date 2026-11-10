# campus-hackai

Repo del equipo para **HackAI 2026** (Universidad Austral): rediseñar SIU Guaraní y el Campus Virtual (Moodle). Demo y pitch el viernes 13/11/2026.

Lo que construimos vive en `hackai/` y está hecho para poder llevarse a **Campus Austral**, el campus de Nacho (Next.js 15, React 19, Supabase, CSS plano, API de Claude), que está copiado tal cual en `campus/`.

**Estado (10/11/2026):** estructura del repo, docs de producto y flujo de trabajo armados. `hackai/` tiene la base (mismo stack y versiones que campus, más los archivos «compat») y todavía ninguna feature. El alcance está por decidir: ver [alcance](docs/product/alcance.md) y [preguntas abiertas](docs/product/preguntas-abiertas.md).

## Estructura

```
campus-hackai/
├── AGENTS.md / CLAUDE.md     instrucciones para agentes (CLAUDE.md solo importa AGENTS.md)
├── GLOSSARY.md               vocabulario del dominio: SIU, Campus Virtual, Campus Austral
├── .claude/
│   ├── settings.json         desactiva los plugins que duplicarían las skills del repo
│   ├── skills/               skills del equipo (las de Matt Pocock + las propias)
│   └── workflows/            scripts de Workflow: reemplazan a los subagentes
├── docs/
│   ├── product/              hackathon, problema, alcance, preguntas abiertas
│   ├── research/             notas con fuentes (relevamiento de SIU y Campus, repo de Nacho)
│   ├── adr/                  decisiones difíciles de revertir
│   ├── agents/               issue tracker, labels, domain docs, workflows
│   └── campus-upstream.md    de dónde salió campus/, cómo se actualiza, problemas conocidos
├── campus/                   snapshot intacto del repo de Nacho. No se edita: se reemplaza entero
├── hackai/                   nuestra app: mismas rutas de carpetas que campus
└── scripts/                  sync-campus.sh, port-to-campus.sh
```

### ¿Por qué `campus/` adentro y no el repo directo desde campus?

Campus llegó como un zip sin git e incompleto: no compila (falta `lib/content/server`) y sus seeds no corren. Armar el repo encima nos obligaba a heredar y resolver esos problemas, y a mezclar nuestros archivos con los suyos. Con el envoltorio, `hackai/` corre sola y propone lo que queramos, y la compatibilidad se sostiene con tres cosas: mismas rutas de carpetas, `scripts/port-to-campus.sh` y el workflow `mergeable-check`. Si Nacho da acceso a git, `campus/` pasa a `git subtree` sin cambiar el resto. Detalle: [ADR 0001](docs/adr/0001-repo-envoltorio-con-campus-vendorizado.md).

## Cómo trabajamos

Spec driven development, con las skills de `.claude/skills/` (tabla completa en su [README](.claude/skills/README.md)):

1. **Entender y decidir.** `/grill-with-docs` cierra decisiones y mantiene el glosario y las ADRs; `/wayfinder` para algo con muchas incógnitas; `/research` para lo que no sabemos; `/relevar-siu-campus` si el relevamiento no alcanza.
2. **Spec.** `/to-spec` deja la discusión cerrada como issue de GitHub.
3. **Tickets.** `/to-tickets` parte la spec en tickets con dependencias.
4. **Implementación.** `/implement` para un ticket, `/implement-spec` para la spec entera, siempre con `/tdd` y siguiendo `/campus-feature` (el checklist de compatibilidad con campus).
5. **Revisión.** `/code-review` (estándares y spec) y el workflow `mergeable-check`. PR a `main` con `/pr`.
6. **Port a campus.** `/port-to-campus` copia la feature a una copia de campus y arma el parche que se le manda a Nacho.

Reglas del equipo:

- `campus/` no se edita a mano. Una versión nueva de Nacho entra con `/sync-campus`, en un commit aparte.
- Una feature ocupa en `hackai/` las mismas rutas que ocuparía en campus: `lib/<feature>/`, `components/<feature>/`, `app/campus/<feature>/`, `app/profesor/<feature>/`, `app/api/<feature>/`, `supabase/migrations/02NN_<feature>.sql`, `tests/<feature>.test.ts`, `docs/<FEATURE>.md`.
- Datos sintéticos siempre. Nada de datos reales de alumnos; los secretos, solo en `.env.local`.
- Documentación en español; código e identificadores en inglés; UI en voseo.
- El trabajo se trackea en GitHub Issues de `ignaciogaspar/campus-hackai`. Las decisiones difíciles de revertir van a `docs/adr/`.
- Los agentes en paralelo se lanzan con workflows guardados, no con subagentes: [docs/agents/workflows.md](docs/agents/workflows.md).

## Cómo correr `hackai/`

Hace falta Node 22 y un proyecto de Supabase propio del equipo (no el de Campus Austral).

```bash
cd hackai
nvm use 22
npm install
cp .env.example .env.local      # completar los valores; .env.local no se commitea
npm run dev                     # http://localhost:3000
```

Chequeos, también desde `hackai/`:

```bash
npm run typecheck
npm test
npm run build
```

Migraciones: los archivos de `hackai/supabase/migrations/` se aplican en orden con `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f <archivo>`.

Llevar una feature a campus y ver el diff:

```bash
scripts/port-to-campus.sh <feature> [clon-del-repo-de-nacho]
```

## Documentación

- [Hackathon](docs/product/hackathon.md): reglas, calendario y cómo se evalúa.
- [Problema](docs/product/problema.md): qué molesta hoy de SIU y Campus, con la línea base de pasos y clicks.
- [Alcance](docs/product/alcance.md): qué construimos. Es el documento vigente; hoy lista ideas candidatas.
- [Preguntas abiertas](docs/product/preguntas-abiertas.md): lo no decidido, incluidas las preguntas para Nacho.
- [Glosario](GLOSSARY.md): vocabulario del dominio.
- [Decisiones (ADR)](docs/adr/): repo envoltorio, mismo stack que campus, workflows en vez de subagentes.
- [Investigación](docs/research/): relevamiento de SIU y Campus, análisis del repo de Nacho.
- [Campus upstream](docs/campus-upstream.md): procedencia de `campus/` y sus problemas conocidos.
- [Instrucciones para agentes](AGENTS.md) y [workflows](docs/agents/workflows.md).
- [Google Doc del equipo](https://docs.google.com/document/d/1vzCAqms9f6OHlAU2imse0ZOsw-SNLW2Ol5P_9auUWtk/edit): origen del research. Pestañas: [relevamiento de SIU y Campus](https://docs.google.com/document/d/1vzCAqms9f6OHlAU2imse0ZOsw-SNLW2Ol5P_9auUWtk/edit?tab=t.9cmmezz46i8q) y [repo de Nacho](https://docs.google.com/document/d/1vzCAqms9f6OHlAU2imse0ZOsw-SNLW2Ol5P_9auUWtk/edit?tab=t.jsz8o639788i).
