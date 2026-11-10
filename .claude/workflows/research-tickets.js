export const meta = {
  name: 'research-tickets',
  description: 'Resuelve en paralelo los tickets de research de wayfinder, uno por agente, con la skill research',
  whenToUse: 'Lo llama la skill wayfinder después de crear los tickets de tipo research. Args: {tickets:[{number, question}], push?:boolean}. Cada agente deja su nota en un branch research/<number> y no abre PR.',
  phases: [
    { title: 'Research', detail: 'un agente por ticket, cada uno en su worktree, invoca la skill research' },
  ],
}

const a = args || {}
if (!Array.isArray(a.tickets) || !a.tickets.length) {
  throw new Error('research-tickets: falta args.tickets (array de {number, question})')
}
for (const t of a.tickets) {
  if (!t || (typeof t.number !== 'number' && typeof t.number !== 'string') || typeof t.question !== 'string' || !t.question) {
    throw new Error('research-tickets: cada ticket necesita number y question. Recibido: ' + JSON.stringify(t))
  }
}
const push = a.push === true

const RESULT = {
  type: 'object',
  properties: {
    number: { type: 'string', description: 'Número del ticket, tal cual se recibió' },
    answer: { type: 'string', description: 'La respuesta a la pregunta, corta y con lo no confirmado marcado como tal' },
    sources: { type: 'array', items: { type: 'string' }, description: 'Fuentes primarias usadas (URL o ruta)' },
    notePath: { type: 'string', description: 'Ruta relativa al repo de la nota Markdown escrita' },
    branch: { type: 'string', description: 'Branch donde quedó commiteada la nota' },
    unresolved: { type: 'string', description: 'Lo que no se pudo responder y por qué; vacío si se respondió todo' },
  },
  required: ['number', 'answer', 'sources', 'notePath'],
}

const prompt = t => `Resolvé un ticket de research.

Ticket #${t.number}
Pregunta: ${t.question}

Cómo:
1. Estás en un worktree propio. Creá y pasate al branch \`research/${t.number}\`.
2. Llamá a la Skill tool con "research" y seguila para responder la pregunta contra fuentes primarias. La nota va donde la skill indica (en este repo, docs/research/).
3. Commiteá la nota en ese branch. ${push ? 'Hacé push del branch.' : 'No hagas push.'} No abras PR: el branch nunca se mergea, queda como puntero de contexto del ticket.
4. No comentes ni cierres el ticket: de eso se encarga quien te llamó.

El relevamiento de SIU y del Campus ya existe en docs/research/; no navegues esos sitios. No leas campus/ más allá de campus/README.md y campus/docs/. No incluyas datos personales de alumnos reales.
Devolvé el número del ticket, la respuesta, las fuentes, la ruta de la nota y el branch.`

phase('Research')
const raw = await parallel(a.tickets.map(t => () =>
  agent(prompt(t), { label: 'research #' + t.number, phase: 'Research', schema: RESULT, isolation: 'worktree' })
    .then(r => r ? { ...r, number: String(t.number) } : null)
))
const results = raw.filter(Boolean)
const missing = a.tickets.map(t => String(t.number)).filter(n => !results.find(r => r.number === n))
if (missing.length) log('Tickets sin resultado: ' + missing.join(', '))

return { results, missing }
