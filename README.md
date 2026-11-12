# campus-hackai

Repo del equipo para **HackAI 2026** (Universidad Austral): rediseñar SIU Guaraní y el Campus Virtual (Moodle). Demo y pitch el viernes 13/11/2026.

Construimos **HackAI**, un sistema propio en `hackai/`: un solo lugar que le dice al alumno qué le toca y le avisa a tiempo. El SIU, Moodle y **Campus Austral** (el campus de Nacho, con su snapshot en `campus/`) son sistemas de origen que entran por adaptadores. Lo que resuelven bien, se delega en ellos; lo que no resuelve ninguno, lo resuelve HackAI.

**Estado (10/11/2026):** problema, estrategia y qué resuelve cada sistema, decididos ([alcance](docs/product/alcance.md), [ADR 0004](docs/adr/0004-sistema-propio-con-puertos-y-adaptadores.md)). Falta el recorte de la demo ([preguntas abiertas](docs/product/preguntas-abiertas.md)). `hackai/` tiene la base del stack y todavía ninguna pantalla.

## Estructura

```
campus-hackai/
├── AGENTS.md / CLAUDE.md     instrucciones para agentes (CLAUDE.md solo importa AGENTS.md)
├── GLOSSARY.md               vocabulario del dominio: SIU, Campus Virtual, Campus Austral, HackAI
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
├── campus/                   snapshot intacto del repo de Nacho, como referencia de su lógica. No se edita
├── hackai/                   nuestro sistema
└── scripts/                  sync-campus.sh
```

## Cómo trabajamos

Spec driven development, con las skills de `.claude/skills/` (tabla completa en su [README](.claude/skills/README.md)):

1. **Entender y decidir.** `/grill-with-docs` cierra decisiones y mantiene el glosario y las ADRs; `/wayfinder` para algo con muchas incógnitas; `/research` para lo que no sabemos; `/relevar-siu-campus` si el relevamiento no alcanza.
2. **Spec.** `/to-spec` deja la discusión cerrada como issue de GitHub.
3. **Tickets.** `/to-tickets` parte la spec en tickets con dependencias.
4. **Implementación.** `/implement` para un ticket, `/implement-spec` para la spec entera, siempre con `/tdd`.
5. **Revisión.** `/code-review` (estándares y spec). PR a `main` con `/pr`.

Reglas del equipo:

- `campus/` no se edita a mano. Una versión nueva de Nacho entra con `/sync-campus`, en un commit aparte. De Campus Austral se reimplementa la lógica que sirva; no se copia código.
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

Base de la demo: `npm run demo:preparar` aplica las migraciones, las tablas simuladas y los seeds y vacía lo de los ensayos, y `npm run demo:verificar` dice si está lista. Todo en `hackai/README.md`, «Base de la demo».

## Documentación

- [Hackathon](docs/product/hackathon.md): reglas, calendario y cómo se evalúa.
- [Problema](docs/product/problema.md): qué molesta hoy de SIU y Campus, con la línea base de pasos y clicks.
- [Alcance](docs/product/alcance.md): qué construimos. Es el documento vigente.
- [Preguntas abiertas](docs/product/preguntas-abiertas.md): lo no decidido.
- [Glosario](GLOSSARY.md): vocabulario del dominio.
- [Decisiones (ADR)](docs/adr/): repo envoltorio, stack, workflows en vez de subagentes, sistema propio con puertos y adaptadores.
- [Investigación](docs/research/): relevamiento de SIU y Campus, análisis del repo de Nacho.
- [Campus upstream](docs/campus-upstream.md): procedencia de `campus/` y sus problemas conocidos.
- [Instrucciones para agentes](AGENTS.md) y [workflows](docs/agents/workflows.md).
- [Google Doc del equipo](https://docs.google.com/document/d/1vzCAqms9f6OHlAU2imse0ZOsw-SNLW2Ol5P_9auUWtk/edit): origen del research y resultados de la encuesta.
