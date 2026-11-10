export const meta = {
  name: 'implement-tickets',
  description: 'Implementa los tickets de una spec por frontera de dependencias, cada uno en su worktree, y los mergea al branch de integración',
  whenToUse: 'Lo llama la skill implement-spec después de crear el branch de integración. Args: {spec, integrationBranch, tickets:[{id, title, blockedBy:[ids]}], notesDir, explore?:boolean}. El branch de integración tiene que existir y estar checkouteado en la raíz del repo, con el árbol limpio.',
  phases: [
    { title: 'Exploración', detail: 'opcional: un agente deja notas en notesDir para los implementadores' },
    { title: 'Implementación', detail: 'por olas: un agente por ticket desbloqueado, en worktree, con la skill tdd' },
    { title: 'Merge', detail: 'un agente merger integra cada branch al de integración, de a uno' },
  ],
}

const a = args || {}
if (typeof a.spec !== 'string' || !a.spec) {
  throw new Error('implement-tickets: falta args.spec (ruta o referencia al issue de la spec)')
}
if (typeof a.integrationBranch !== 'string' || !a.integrationBranch) {
  throw new Error('implement-tickets: falta args.integrationBranch (el branch donde se integra toda la spec)')
}
if (typeof a.notesDir !== 'string' || !a.notesDir) {
  throw new Error('implement-tickets: falta args.notesDir (carpeta absoluta fuera del repo para las notas de exploración)')
}
if (!Array.isArray(a.tickets) || !a.tickets.length) {
  throw new Error('implement-tickets: falta args.tickets (array de {id, title, blockedBy:[ids]})')
}
const tickets = a.tickets.map(t => {
  if (!t || (typeof t.id !== 'string' && typeof t.id !== 'number') || typeof t.title !== 'string' || !t.title) {
    throw new Error('implement-tickets: cada ticket necesita id y title. Recibido: ' + JSON.stringify(t))
  }
  if (t.blockedBy !== undefined && !Array.isArray(t.blockedBy)) {
    throw new Error('implement-tickets: blockedBy del ticket ' + t.id + ' tiene que ser un array de ids')
  }
  return { id: String(t.id), title: t.title, blockedBy: (t.blockedBy || []).map(String) }
})
const ids = new Set(tickets.map(t => t.id))
if (ids.size !== tickets.length) throw new Error('implement-tickets: hay ids de ticket repetidos')
for (const t of tickets) {
  const unknown = t.blockedBy.filter(b => !ids.has(b))
  if (unknown.length) {
    throw new Error('implement-tickets: el ticket ' + t.id + ' está bloqueado por ids que no están en args.tickets (' + unknown.join(', ') + '). Sacá de blockedBy los tickets ya cerrados o agregá los que faltan.')
  }
}

const branchOf = t => 'ticket/' + t.id

if (a.explore !== false) {
  phase('Exploración')
  const notes = await agent(`Explorá lo que los tickets de una spec van a necesitar, para que los implementadores no tengan que hacerlo.

Spec: ${a.spec}
Tickets:
${tickets.map(t => '- ' + t.id + ': ' + t.title).join('\n')}

Leé la spec y los tickets (el tracker está descrito en docs/agents/issue-tracker.md), después los archivos de hackai/ que tocan y la documentación externa que haga falta. De campus/ leé solo campus/README.md y campus/docs/.
Escribí notas Markdown en ${a.notesDir} (creá la carpeta; está fuera del repo a propósito): un archivo por tema, con rutas, firmas y decisiones ya tomadas que apliquen. No edites nada dentro del repo.
Devolvé la lista de archivos de notas que escribiste, una ruta por línea.`,
    { label: 'exploración', phase: 'Exploración' })
  if (!notes) log('La exploración no devolvió resultado; los implementadores exploran por su cuenta')
} else {
  log('Exploración salteada (args.explore = false)')
}

const IMPL = {
  type: 'object',
  properties: {
    done: { type: 'boolean', description: 'true solo si el ticket quedó implementado, con tests y typecheck en verde, y commiteado' },
    branch: { type: 'string' },
    commits: { type: 'array', items: { type: 'string' }, description: 'SHAs cortos de los commits del ticket' },
    summary: { type: 'string' },
    blockedReason: { type: 'string', description: 'Si done es false: qué lo impidió' },
  },
  required: ['done', 'branch', 'summary'],
}
const MERGE = {
  type: 'object',
  properties: {
    merged: { type: 'boolean' },
    mergeCommit: { type: 'string' },
    conflicts: { type: 'array', items: { type: 'string' }, description: 'Archivos con conflicto y cómo se resolvieron' },
    reason: { type: 'string', description: 'Si merged es false: por qué' },
  },
  required: ['merged'],
}

const implPrompt = t => `Implementá un ticket de una spec.

Spec: ${a.spec}
Ticket ${t.id}: ${t.title}
Branch de integración: ${a.integrationBranch}
Notas de exploración (si existen): ${a.notesDir}

Pasos:
1. Estás en un worktree propio. Creá el branch \`${branchOf(t)}\` parado en la punta de \`${a.integrationBranch}\` (\`git checkout -B ${branchOf(t)} ${a.integrationBranch}\`); si ya existía, reseteá sobre el branch de integración.
2. Leé el ticket completo en el tracker (docs/agents/issue-tracker.md) y las notas que apliquen.
3. Implementalo llamando a la Skill tool con "tdd". El código va en hackai/ siguiendo las convenciones de AGENTS.md. No edites campus/.
4. Corré typecheck y tests de hackai/ hasta que pasen.
5. Commiteá en \`${branchOf(t)}\` con el id del ticket en el mensaje. Antes de terminar, mergeá la punta de \`${a.integrationBranch}\` en tu branch y volvé a correr los tests.
6. No hagas push, no abras PR y no cierres el ticket.

Implementá solo este ticket. Si no se puede terminar (falta una decisión, depende de algo que no está), devolvé done=false con el motivo en vez de inventar.`

const mergePrompt = (t, impl) => `Integrá el branch de un ticket al branch de integración.

Ticket ${t.id}: ${t.title}
Branch del ticket: ${impl.branch || branchOf(t)}
Branch de integración: ${a.integrationBranch}
Resumen del implementador: ${impl.summary}

Pasos:
1. Trabajá en la raíz del repo. Verificá que \`${a.integrationBranch}\` esté checkouteado ahí y que el árbol esté limpio; si no, devolvé merged=false con el motivo, sin tocar nada.
2. \`git merge --no-ff ${impl.branch || branchOf(t)}\`. Si hay conflictos, resolvelos conservando el comportamiento de los dos lados y anotalos.
3. Corré typecheck y tests de hackai/. Si fallan por el merge, arreglalo en un commit aparte; si no lo podés arreglar, \`git merge --abort\` o revertí y devolvé merged=false.
4. No hagas push ni borres el branch del ticket.`

const status = {}
for (const t of tickets) status[t.id] = { id: t.id, title: t.title, state: 'pending' }
const merged = new Set()
const attempted = new Set()
let mergeQueue = Promise.resolve()
let wave = 0

while (true) {
  const ready = tickets.filter(t => !attempted.has(t.id) && t.blockedBy.every(b => merged.has(b)))
  if (!ready.length) break
  wave++
  log('Ola ' + wave + ': ' + ready.map(t => t.id).join(', '))
  ready.forEach(t => attempted.add(t.id))

  await pipeline(
    ready,
    t => agent(implPrompt(t), { label: 'ticket ' + t.id, phase: 'Implementación', schema: IMPL, isolation: 'worktree' }),
    (impl, t) => {
      if (!impl) {
        status[t.id] = { ...status[t.id], state: 'failed', reason: 'el implementador no devolvió resultado' }
        return null
      }
      if (!impl.done) {
        status[t.id] = { ...status[t.id], state: 'not-implemented', branch: impl.branch, reason: impl.blockedReason || impl.summary }
        return null
      }
      // Los merges van de a uno: todos escriben el mismo branch de integración.
      const run = mergeQueue.then(() =>
        agent(mergePrompt(t, impl), { label: 'merge ' + t.id, phase: 'Merge', schema: MERGE }))
      mergeQueue = run.catch(() => null)
      return run.then(m => {
        if (m && m.merged) {
          merged.add(t.id)
          status[t.id] = { ...status[t.id], state: 'merged', branch: impl.branch, commits: impl.commits || [], mergeCommit: m.mergeCommit, conflicts: m.conflicts || [], summary: impl.summary }
        } else {
          status[t.id] = { ...status[t.id], state: 'merge-failed', branch: impl.branch, summary: impl.summary, reason: m ? (m.reason || 'merge rechazado') : 'el merger no devolvió resultado' }
        }
        return m
      })
    }
  )
  // Un ticket cuyo stage tiró una excepción queda sin estado final: marcarlo.
  for (const t of ready) {
    if (status[t.id].state === 'pending') status[t.id] = { ...status[t.id], state: 'failed', reason: 'error durante la implementación o el merge' }
  }
}

for (const t of tickets) {
  if (!attempted.has(t.id)) {
    const waiting = t.blockedBy.filter(b => !merged.has(b))
    status[t.id] = { ...status[t.id], state: 'blocked', reason: 'bloqueado por ' + waiting.join(', ') }
  }
}
const notMerged = tickets.filter(t => status[t.id].state !== 'merged')
if (notMerged.length) {
  log('Sin integrar (' + notMerged.length + '): ' + notMerged.map(t => t.id + ' [' + status[t.id].state + ']').join(', '))
}

return {
  integrationBranch: a.integrationBranch,
  waves: wave,
  allMerged: notMerged.length === 0,
  tickets: tickets.map(t => status[t.id]),
}
