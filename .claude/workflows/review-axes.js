export const meta = {
  name: 'review-axes',
  description: 'Revisa el diff desde un punto fijo en dos ejes independientes, Standards y Spec, en paralelo',
  whenToUse: 'Lo llama la skill code-review después de fijar el punto de comparación, las fuentes de estándares y la spec. Args: {fixedPoint, standardsSources:[rutas], smellBaseline, spec|null}.',
  phases: [
    { title: 'Revisión', detail: 'un agente por eje (Standards y Spec), sin compartir contexto' },
  ],
}

const a = args || {}
if (typeof a.fixedPoint !== 'string' || !a.fixedPoint) {
  throw new Error('review-axes: falta args.fixedPoint (commit, branch o tag contra el que se compara HEAD)')
}
if (!Array.isArray(a.standardsSources)) {
  throw new Error('review-axes: falta args.standardsSources (array de rutas de archivos de estándares; puede ser [])')
}
if (typeof a.smellBaseline !== 'string' || !a.smellBaseline) {
  throw new Error('review-axes: falta args.smellBaseline (el texto completo de la lista de smells de la skill code-review)')
}
const spec = a.spec === undefined ? null : a.spec
if (spec !== null && typeof spec !== 'string') {
  throw new Error('review-axes: args.spec tiene que ser un string (ruta o contenido de la spec) o null')
}

const DIFF = `
Diff a revisar: \`git diff ${a.fixedPoint}...HEAD\` (tres puntos: contra el merge-base).
Commits: \`git log ${a.fixedPoint}..HEAD --oneline\`.
Corré los dos comandos vos mismo. Es una revisión de solo lectura: no edites archivos ni hagas commits.
No leas campus/ salvo los archivos de campus/docs/ que figuren entre las fuentes.
`

const FINDINGS = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          file: { type: 'string', description: 'Ruta relativa al repo' },
          line: { type: 'integer', description: 'Línea del archivo nuevo; 0 si no aplica' },
          kind: { type: 'string', description: 'Standards: "violacion" o "smell". Spec: "faltante", "parcial", "fuera-de-alcance" o "mal-implementado"' },
          severity: { type: 'string', enum: ['hard', 'judgement'], description: 'hard solo para incumplimientos de un estándar documentado o de la spec; los smells siempre son judgement' },
          rule: { type: 'string', description: 'Standards: archivo y regla citada, o nombre del smell. Spec: la línea de la spec citada textual' },
          evidence: { type: 'string', description: 'El hunk o fragmento que lo muestra' },
          suggestion: { type: 'string' },
        },
        required: ['file', 'kind', 'severity', 'rule', 'evidence'],
      },
    },
    summary: { type: 'string', description: 'Una o dos líneas: cantidad de hallazgos y el peor' },
  },
  required: ['findings', 'summary'],
}

const standardsPrompt = `Sos el revisor del eje Standards de una code review.
${DIFF}
Fuentes de estándares de este repo (leelas enteras antes de mirar el diff):
${a.standardsSources.length ? a.standardsSources.map(s => '- ' + s).join('\n') : '- (el repo no documenta estándares: aplicá solo la lista de smells)'}

Lista base de smells (aplica siempre, además de lo documentado):
${a.smellBaseline}

Reportá, por archivo y hunk: (a) cada lugar donde el diff incumple un estándar documentado, citando archivo y regla; (b) cada smell de la lista base que encuentres, con su nombre y el hunk.
Un estándar documentado del repo le gana a la lista base: si el repo avala algo que la lista marcaría, no lo reportes. Los smells son siempre "judgement"; solo un incumplimiento de estándar documentado puede ser "hard". Salteá lo que ya controla una herramienta (typecheck, tests).`

const specPrompt = `Sos el revisor del eje Spec de una code review.
${DIFF}
Spec de origen (ruta dentro del repo, referencia a un issue o el contenido mismo):
${spec}

Si es una ruta, leela; si es una referencia a un issue, traelo como indica docs/agents/issue-tracker.md.
Reportá: (a) requisitos de la spec que faltan o están a medias; (b) comportamiento del diff que nadie pidió; (c) requisitos que parecen implementados pero están mal. Citá textual la línea de la spec en cada hallazgo.`

phase('Revisión')
if (spec === null) log('Sin spec: se salta el eje Spec')

const [standards, specReview] = await parallel([
  () => agent(standardsPrompt, { label: 'standards', phase: 'Revisión', schema: FINDINGS }),
  () => spec === null
    ? Promise.resolve({ skipped: true, findings: [], summary: 'No hay spec disponible: el eje Spec no se revisó.' })
    : agent(specPrompt, { label: 'spec', phase: 'Revisión', schema: FINDINGS }),
])

if (!standards) log('El revisor de Standards no devolvió resultado')
if (!specReview) log('El revisor de Spec no devolvió resultado')

return { standards: standards || null, spec: specReview || null }
