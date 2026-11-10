export const meta = {
  name: 'mergeable-check',
  description: 'Revisa una feature de hackai/ contra el checklist de compatibilidad con campus, con verificación adversarial de cada hallazgo',
  whenToUse: 'Antes de portar una feature a campus (skills campus-feature y port-to-campus) o cuando se quiere saber si algo de hackai/ se puede copiar a campus tal cual. Args: {feature} (nombre de la carpeta de la feature, por ejemplo "inscripciones").',
  phases: [
    { title: 'Revisión', detail: 'un revisor por dimensión del checklist, solo lectura' },
    { title: 'Verificación', detail: 'un escéptico por hallazgo intenta refutarlo' },
  ],
}

const a = args || {}
if (typeof a.feature !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(a.feature)) {
  throw new Error('mergeable-check: falta args.feature (nombre de la feature en minúsculas, como figura en hackai/lib/<feature>/)')
}
const f = a.feature
const F = f.toUpperCase()

const FILES = `Archivos de la feature (los que existan; que falte alguno puede ser un hallazgo):
- hackai/lib/${f}/ (types.ts, core.ts, store.ts, actions.ts)
- hackai/components/${f}/ (y su ${f}.css)
- hackai/app/campus/${f}/ (alumno) y hackai/app/profesor/${f}/ (docente)
- hackai/app/api/${f}/
- hackai/supabase/migrations/02NN_${f}.sql
- hackai/tests/${f}.test.ts
- hackai/docs/${F}.md
Además, cualquier otro archivo de hackai/ que la feature haya tocado: buscá "${f}" en hackai/ (sin node_modules ni .next).`

const SOURCES = `Fuentes de la regla (leé lo que aplique a tu dimensión antes de mirar el código):
- .claude/skills/campus-feature/CHECKLIST.md: el checklist de compatibilidad vigente (si difiere de la nota de research, manda este).
- docs/research/2026-11-10-repo-campus-nacho.md: de dónde sale el checklist, archivos compartidos con conflictos y límites del repo de campus.
- hackai/compat.txt: archivos «compat» que imitan helpers de campus; no son parte de la feature y no se portan.
- campus/docs/SPEC.md y campus/docs/CONTRACTS.md.
De campus/ no leas nada más: lo que haga falta saber del código de campus está en esas fuentes. Si una regla no se puede comprobar sin leer más de campus/, decilo en el hallazgo en vez de ir a leer.`

const DIMENSIONS = [
  { key: 'estilo-idioma', title: 'Estilo e idioma', brief: 'Dos espacios, comillas simples, sin punto y coma, imports con @/ desde la raíz. Textos de UI, comentarios y mensajes de error en español rioplatense con voseo; rutas de páginas en español; identificadores y columnas en inglés; valores de dominio en español. Ninguna dependencia nueva respecto de campus/package.json (compará con hackai/package.json): nada de Tailwind, librerías de UI, zod, ORM ni otro framework de tests.' },
  { key: 'estructura', title: 'Estructura de carpetas', brief: 'La feature vive en las mismas rutas que usaría en campus: lib/<feature>/ con types.ts, core.ts (lógica pura, sin I/O), store.ts (server-only) y actions.ts (\'use server\'); components/<feature>/ con su CSS y un prefijo de clase propio; \'use client\' solo en la hoja interactiva y nunca dentro de app/; páginas en app/campus/<feature> y app/profesor/<feature>; APIs en app/api/<feature>; tests de la lógica pura con node:test en tests/<feature>.test.ts y su script en package.json; docs/<FEATURE>.md con el formato de campus/docs/POST-CLASS.md (podés leer ese archivo).' },
  { key: 'base-de-datos', title: 'Base de datos y migración', brief: 'Una sola migración nueva numerada desde 0240, idempotente (if not exists, create or replace), con RLS activado sin políticas y revoke a anon y authenticated en cada tabla y función. No modifica tablas existentes de campus: los datos extra van en tablas propias que referencian people(id) o courses(id). Operaciones con cupo o concurrencia en una función SQL con lock.' },
  { key: 'auth-datos', title: 'Auth, datos y seguridad', brief: 'Cada página y cada action empieza con requireSession(\'alumno\' | \'profesor\'); en las APIs, getSession() y respuesta JSON con la forma { error }. El id de la persona sale de la sesión, nunca del formulario. Todo acceso a datos es en el servidor con el service role y la clave nunca llega al cliente. Se filtra siempre por curso y se listan columnas explícitas en lo que lee el alumno. dynamic = \'force-dynamic\' en lo que lee sesión. Datos personales, notas e inscripciones no viajan por Realtime. No se agrega un rol al núcleo.' },
  { key: 'ia', title: 'IA', brief: 'Las llamadas al modelo usan claude() y las constantes de modelo de lib/claude.ts, con maxDuration explícito en la ruta. Todo texto escrito por alumnos entra al prompt marcado como datos (helper untrusted()). Lo que escribe un agente es una propuesta que aprueba una persona; en actas y notas es obligatorio. Una herramienta MCP nueva va en su propio archivo en lib/mcp/tools/ más una línea en el array del rol. Si la feature no usa IA, devolvé cero hallazgos.' },
  { key: 'archivos-compartidos', title: 'Archivos compartidos', brief: 'La feature toca lo mínimo de los archivos donde va a haber conflicto al portar: lib/routes.ts (rutas en lib/<feature>/routes.ts y una sola línea en el menú), middleware.ts, app/campus/page.tsx, app/profesor/page.tsx, lib/inicio.ts, lib/jornadas.ts, package.json, README, docs/CONTRACTS.md, número de migración. Listá cada archivo compartido que la feature modifica, cuántas líneas y si se puede reducir. También marcá cualquier import de la feature hacia código de hackai/ que no exista en campus (eso rompe al copiar).' },
]

const FINDINGS = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          file: { type: 'string', description: 'Ruta relativa al repo' },
          line: { type: 'integer', description: '0 si no aplica' },
          rule: { type: 'string', description: 'La regla incumplida y en qué fuente está' },
          evidence: { type: 'string', description: 'El fragmento que lo muestra, o qué archivo falta' },
          severity: { type: 'string', enum: ['bloquea-merge', 'genera-conflicto', 'menor'] },
          fix: { type: 'string', description: 'Cambio concreto en hackai/ que lo resuelve' },
        },
        required: ['file', 'rule', 'evidence', 'severity', 'fix'],
      },
    },
    checked: { type: 'array', items: { type: 'string' }, description: 'Archivos que efectivamente leíste' },
    notApplicable: { type: 'string', description: 'Si la dimensión no aplica a esta feature, por qué' },
  },
  required: ['findings', 'checked'],
}
const VERDICT = {
  type: 'object',
  properties: {
    refuted: { type: 'boolean' },
    reasoning: { type: 'string', description: 'Qué leíste y por qué el hallazgo se sostiene o no' },
    correctedSeverity: { type: 'string', enum: ['bloquea-merge', 'genera-conflicto', 'menor'] },
  },
  required: ['refuted', 'reasoning'],
}

const reviewPrompt = d => `Revisá una feature de hackai/ contra una dimensión del checklist de compatibilidad con campus. La pregunta de fondo: si se copian estos archivos a las mismas rutas de campus, ¿entran sin romper nada y sin que haya que reescribirlos?

Feature: ${f}
Dimensión: ${d.title}
Qué se exige: ${d.brief}

${FILES}

${SOURCES}

Solo lectura: no edites archivos ni hagas commits. Reportá cada incumplimiento con archivo, línea, la regla, la evidencia y el arreglo concreto. Reportá solo lo que viste en el código; no reportes gustos ni reglas que no estén en las fuentes. Si no hay incumplimientos, devolvé la lista vacía.`

const verifyPrompt = (d, finding) => `Otro revisor reportó que una feature de hackai/ incumple el checklist de compatibilidad con campus. Tu trabajo es intentar refutarlo.

Feature: ${f}
Dimensión: ${d.title}
Hallazgo:
${JSON.stringify(finding, null, 2)}

${SOURCES}

Abrí el archivo y la fuente de la regla. El hallazgo queda refutado si: la evidencia no está en el archivo, la regla no figura en las fuentes o dice otra cosa, el código ya cumple por otro camino, o el supuesto problema no afecta que la feature se pueda copiar a campus. Si después de leer no podés confirmarlo con el código y la fuente a la vista, devolvé refuted=true. Si se sostiene pero la severidad está mal, corregila. Solo lectura.`

const perDimension = await pipeline(
  DIMENSIONS,
  d => agent(reviewPrompt(d), { label: d.key, phase: 'Revisión', schema: FINDINGS }),
  async (review, d) => {
    if (!review) return null
    const verdicts = await parallel(review.findings.map((finding, i) => () =>
      agent(verifyPrompt(d, finding), { label: d.key + ' #' + (i + 1), phase: 'Verificación', schema: VERDICT })
    ))
    const confirmed = []
    const refuted = []
    const unverified = []
    review.findings.forEach((finding, i) => {
      const v = verdicts[i]
      const item = { dimension: d.key, ...finding }
      if (!v) unverified.push(item)
      else if (v.refuted) refuted.push({ ...item, refutation: v.reasoning })
      else confirmed.push({ ...item, severity: v.correctedSeverity || finding.severity, verification: v.reasoning })
    })
    return { dimension: d.key, confirmed, refuted, unverified, checked: review.checked, notApplicable: review.notApplicable || '' }
  }
)

const done = perDimension.filter(Boolean)
const notReviewed = DIMENSIONS.map(d => d.key).filter(k => !done.find(r => r.dimension === k))
if (notReviewed.length) log('Dimensiones sin revisar: ' + notReviewed.join(', '))

const confirmed = done.flatMap(r => r.confirmed)
const refuted = done.flatMap(r => r.refuted)
const unverified = done.flatMap(r => r.unverified)
if (refuted.length) log('Hallazgos descartados por el escéptico: ' + refuted.length + ' (' + refuted.map(r => r.dimension + ': ' + r.file).join('; ') + ')')
if (unverified.length) log('Hallazgos sin verificar (el escéptico no respondió): ' + unverified.length)

const order = { 'bloquea-merge': 0, 'genera-conflicto': 1, 'menor': 2 }
confirmed.sort((x, y) => order[x.severity] - order[y.severity])

return {
  feature: f,
  mergeable: notReviewed.length === 0 && unverified.length === 0 && !confirmed.some(c => c.severity === 'bloquea-merge'),
  confirmed,
  unverified,
  refuted,
  notReviewed,
  coverage: done.map(r => ({ dimension: r.dimension, checked: r.checked, notApplicable: r.notApplicable })),
}
