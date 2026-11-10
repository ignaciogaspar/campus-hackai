export const meta = {
  name: 'design-it-twice',
  description: 'Genera 3 o más diseños de interfaz radicalmente distintos para un módulo y los compara',
  whenToUse: 'Lo llama la skill codebase-design (DESIGN-IT-TWICE.md) cuando hay que elegir la interfaz de un módulo. Args: {brief, constraints?:[texto]} (por defecto 3 restricciones: interfaz mínima, máxima flexibilidad, optimizar el caso común).',
  phases: [
    { title: 'Diseños', detail: 'un agente por restricción, sin ver los otros diseños' },
    { title: 'Comparación', detail: 'un agente compara profundidad, localidad y ubicación de la costura' },
  ],
}

const a = args || {}
if (typeof a.brief !== 'string' || !a.brief) {
  throw new Error('design-it-twice: falta args.brief (qué módulo se diseña, qué problema resuelve, quién lo llama y con qué dependencias)')
}
const DEFAULTS = [
  'Minimizá la interfaz: de 1 a 3 puntos de entrada como máximo, con el máximo de comportamiento detrás de cada uno.',
  'Maximizá la flexibilidad: que soporte muchos casos de uso y extensiones sin cambiar la interfaz.',
  'Optimizá el caso más común: que quien llama resuelva el caso típico con una sola llamada trivial, aunque los casos raros cuesten más.',
]
const constraints = a.constraints === undefined ? DEFAULTS : a.constraints
if (!Array.isArray(constraints) || constraints.length < 2 || constraints.some(c => typeof c !== 'string' || !c)) {
  throw new Error('design-it-twice: args.constraints tiene que ser un array de 2 o más textos (una restricción de diseño por agente)')
}

const DESIGN = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'Nombre corto del diseño' },
    interface: { type: 'string', description: 'La interfaz completa: tipos, métodos, parámetros, invariantes, orden de llamadas y modos de error' },
    usageExample: { type: 'string', description: 'Código de cómo la usa quien llama, en el caso típico' },
    hides: { type: 'string', description: 'Qué complejidad queda escondida detrás de la costura' },
    dependencyStrategy: { type: 'string', description: 'Cómo se manejan las dependencias y qué adapters hacen falta (producción y test)' },
    tradeoffs: { type: 'string', description: 'Dónde el apalancamiento es alto y dónde es bajo' },
  },
  required: ['name', 'interface', 'usageExample', 'hides', 'tradeoffs'],
}

const designPrompt = (constraint, i) => `Diseñá la interfaz de un módulo. Usá el vocabulario de .claude/skills/codebase-design/SKILL.md (module, interface, depth, seam, adapter, leverage, locality) y los términos de GLOSSARY.md.

Brief:
${a.brief}

Tu restricción de diseño (seguila hasta el fondo, aunque el resultado quede extremo; otros agentes exploran restricciones distintas y lo que sirve es el contraste):
${constraint}

Solo diseño: no edites archivos. Podés leer el código de hackai/ que el brief mencione; no leas campus/ salvo lo que el brief pida.
Devolvé la interfaz, un ejemplo de uso, qué esconde, la estrategia de dependencias y los tradeoffs. (Diseño ${i + 1} de ${constraints.length}.)`

phase('Diseños')
const raw = await parallel(constraints.map((c, i) => () =>
  agent(designPrompt(c, i), { label: 'diseño ' + (i + 1), phase: 'Diseños', schema: DESIGN })
    .then(d => d ? { constraint: c, ...d } : null)
))
const designs = raw.filter(Boolean)
if (designs.length < raw.length) log((raw.length - designs.length) + ' diseño(s) sin resultado; se compara con los que hay')
if (designs.length < 2) {
  log('Menos de 2 diseños: no hay nada que comparar')
  return { designs, comparison: null }
}

const COMPARISON = {
  type: 'object',
  properties: {
    depth: { type: 'string', description: 'Profundidad de cada diseño: cuánto comportamiento hay detrás de cuánta interfaz' },
    locality: { type: 'string', description: 'Dónde se concentra el cambio en cada diseño' },
    seamPlacement: { type: 'string', description: 'Dónde queda la costura en cada diseño y qué implica para testear' },
    recommendation: { type: 'string', description: 'Cuál es el más fuerte y por qué, con opinión' },
    hybrid: { type: 'string', description: 'Híbrido propuesto si combinar elementos mejora el resultado; vacío si no' },
  },
  required: ['depth', 'locality', 'seamPlacement', 'recommendation'],
}

phase('Comparación')
const comparison = await agent(`Compará estos diseños de interfaz para el mismo módulo. Usá el vocabulario de .claude/skills/codebase-design/SKILL.md.

Brief:
${a.brief}

Diseños:
${JSON.stringify(designs, null, 2)}

Contrastalos en prosa por profundidad (apalancamiento en la interfaz), localidad (dónde se concentra el cambio) y ubicación de la costura. Después recomendá uno con opinión; si un híbrido es mejor, proponelo. No presentes un menú: quien lee quiere una lectura fuerte.`,
  { label: 'comparación', phase: 'Comparación', schema: COMPARISON })

if (!comparison) log('El agente de comparación no devolvió resultado')
return { designs, comparison: comparison || null }
