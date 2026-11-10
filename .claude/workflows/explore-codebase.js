export const meta = {
  name: 'explore-codebase',
  description: 'Lectores en paralelo, uno por área del repo, que devuelven un mapa para responder una pregunta',
  whenToUse: 'Lo llaman las skills grilling e improve-codebase-architecture (y cualquier exploración amplia) en vez de leer todo en el contexto principal. Args: {question, areas:[{name, paths:[rutas]}], synthesize?:boolean}.',
  phases: [
    { title: 'Lectura', detail: 'un lector de solo lectura por área, esfuerzo medio' },
    { title: 'Síntesis', detail: 'opcional (args.synthesize): un agente cruza los mapas' },
  ],
}

const a = args || {}
if (typeof a.question !== 'string' || !a.question) {
  throw new Error('explore-codebase: falta args.question (la pregunta que la exploración tiene que responder)')
}
if (!Array.isArray(a.areas) || !a.areas.length) {
  throw new Error('explore-codebase: falta args.areas (array de {name, paths:[rutas relativas al repo]})')
}
for (const area of a.areas) {
  if (!area || typeof area.name !== 'string' || !area.name || !Array.isArray(area.paths) || !area.paths.length) {
    throw new Error('explore-codebase: cada área necesita name y paths (array no vacío). Recibido: ' + JSON.stringify(area))
  }
}

const touchesCampus = p => p === 'campus' || p.startsWith('campus/') || p.startsWith('./campus')

const MAP = {
  type: 'object',
  properties: {
    area: { type: 'string' },
    summary: { type: 'string', description: 'Qué hace el área y cómo está organizada, en 3 a 6 líneas' },
    files: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Ruta relativa al repo' },
          role: { type: 'string', description: 'Qué papel cumple el archivo' },
        },
        required: ['path', 'role'],
      },
    },
    frictions: { type: 'array', items: { type: 'string' }, description: 'Lo que costó entender o resulta frágil: módulos superficiales, acoplamientos, duplicación, nombres que no coinciden con GLOSSARY.md' },
    answersToQuestion: { type: 'string', description: 'Lo que esta área aporta a la pregunta, con rutas y líneas; decí explícitamente si no aporta nada' },
  },
  required: ['area', 'summary', 'files', 'frictions', 'answersToQuestion'],
}

const readerPrompt = area => {
  const campusOk = area.paths.some(touchesCampus)
  return `Explorá un área del repo para responder una pregunta. Solo lectura: no edites, no crees archivos, no hagas commits.

Pregunta:
${a.question}

Área: ${area.name}
Rutas (leé solo dentro de estas, más GLOSSARY.md y docs/adr/ si necesitás contexto):
${area.paths.map(p => '- ' + p).join('\n')}

${campusOk
    ? 'Esta área incluye rutas de campus/: podés leer exactamente esas rutas de campus/, nada más de esa carpeta.'
    : 'No leas nada dentro de campus/: es el snapshot del repo upstream y lo releva otra persona. Si la respuesta depende de campus/, anotalo en answersToQuestion en vez de ir a leerlo.'}

Devolvé el mapa del área: resumen, archivos con su papel, fricciones y qué aporta a la pregunta. Citá rutas relativas al repo. Lo que no pudiste confirmar leyendo, marcalo como no confirmado.`
}

phase('Lectura')
const raw = await parallel(a.areas.map(area => () =>
  agent(readerPrompt(area), { label: area.name, phase: 'Lectura', schema: MAP, effort: 'medium' })
))
const maps = raw.filter(Boolean)
const missing = a.areas.map(x => x.name).filter(n => !maps.find(m => m.area === n))
if (maps.length < raw.length) log('Áreas sin resultado: ' + (raw.length - maps.length) + ' (' + missing.join(', ') + ')')

if (!a.synthesize || maps.length < 2) {
  return { maps, synthesis: null }
}

phase('Síntesis')
const synthesis = await agent(`Cruzá estos mapas de áreas del repo y respondé la pregunta. No leas más código: trabajá con los mapas.

Pregunta:
${a.question}

Mapas:
${JSON.stringify(maps, null, 2)}

Devolvé: la respuesta a la pregunta con las rutas que la sostienen, las fricciones que se repiten entre áreas, y lo que quedó sin confirmar.`,
  { label: 'síntesis', phase: 'Síntesis', effort: 'medium' })

if (!synthesis) log('El agente de síntesis no devolvió resultado')
return { maps, synthesis: synthesis || null }
