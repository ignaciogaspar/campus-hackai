import 'server-only'
import { db } from '@/lib/db'
import type { LiveSession } from '@/lib/db-types'
import { getDeck, type LoadedDeck } from '@/lib/decks/store'
import { activePollId, pollSnapshot } from '@/lib/live/polls'
import { classSessionOfLive, courseOfLive } from '@/lib/live/session'
import { roster, type RosterPerson } from '@/lib/live/students'
import { recentTranscript } from '@/lib/live/transcript'
import type { PollSnapshot } from '@/lib/live/types'

/* Contexto del agente en vivo (SPEC · Agente en vivo): deck con títulos
   por posición, slide actual completa con notas, encuesta activa, casos de
   la jornada, padrón, simuladores y los últimos 2 minutos de transcripción. */

export interface CaseInfo {
  id: string
  title: string
  question: string
  postures: { id: string; label: string }[]
  count: number
}

export interface AgentContext {
  live: LiveSession
  /** La orden del profesor de este turno (fuente confiable para URLs de show_qr). */
  utterance: string
  deck: LoadedDeck
  courseId: string
  classSessionId: string | null
  roster: RosterPerson[]
  cases: CaseInfo[]
  sims: { id: string; title: string }[]
  poll: PollSnapshot | null
}

export async function loadAgentContext(live: LiveSession, utterance = ''): Promise<AgentContext> {
  const [deck, courseId, classSessionId, pollId] = await Promise.all([
    getDeck(live.deck_id, 'profesor'),
    courseOfLive(live),
    classSessionOfLive(live),
    activePollId(live),
  ])
  if (!deck) throw new Error(`Deck ${live.deck_id} inexistente`)
  const [people, casesRes, simsRes, poll] = await Promise.all([
    roster(courseId),
    classSessionId
      ? db().from('cases').select('id, title, question, postures, case_postures(count)').eq('class_session_id', classSessionId).eq('is_active', true)
      : Promise.resolve({ data: [] as unknown[] }),
    db().from('sim_definitions').select('id, title').or(`course_id.eq.${courseId},course_id.is.null`),
    pollId ? pollSnapshot(pollId) : Promise.resolve(null),
  ])
  const cases = ((casesRes.data ?? []) as Array<{ id: string; title: string; question: string; postures: { id: string; label: string }[]; case_postures: { count: number }[] }>)
    .map((c) => ({ id: c.id, title: c.title, question: c.question, postures: (c.postures ?? []).map((p) => ({ id: p.id, label: p.label })), count: c.case_postures?.[0]?.count ?? 0 }))
  return {
    live, utterance, deck, courseId, classSessionId, roster: people, cases,
    sims: ((simsRes.data ?? []) as { id: string; title: string }[]),
    poll,
  }
}

function overlayLabel(ctx: AgentContext): string {
  const o = ctx.live.overlay
  if (!o) return 'nada (se ve la slide sola)'
  switch (o.type) {
    case 'poll': return `encuesta ${o.pollId}${o.showResults ? ' con resultados' : ' con QR, sin resultados'}`
    case 'student': return `alumno sorteado: ${o.name}`
    case 'postures': return `posturas del caso ${o.caseId}`
    case 'confusion': return `marcas de la slide ${o.position + 1}`
    case 'timer': return `temporizador hasta ${o.endsAt}${o.label ? ` (${o.label})` : ''}`
    case 'qr': return `QR a ${o.url}`
    case 'sim': return `simulador ${o.simId}`
    case 'message': return `mensaje «${o.text}»`
  }
}

/**
 * Texto escrito por alumnos o invitados (respuestas abiertas, perfil): se
 * neutralizan los delimitadores para que no pueda cerrar ni abrir etiquetas
 * del contexto. Va siempre dentro de <respuestas_de_alumnos> o <padron>, que
 * el system prompt declara como datos no confiables.
 */
export function untrusted(text: string, max = 300): string {
  const t = text.replace(/[<>]/g, (c) => (c === '<' ? '‹' : '›')).replace(/[«»]/g, '"').replace(/\s+/g, ' ').trim()
  return t.length > max ? `${t.slice(0, max - 1)}…` : t
}

function pollLabel(p: PollSnapshot): string {
  const head = `«${p.question}» (${p.kind}, ${p.status}, ${p.total} respuestas, id ${p.pollId})`
  if (p.kind === 'open') {
    if (!p.texts?.length) return head
    return `${head}\n<respuestas_de_alumnos>\n${p.texts.slice(0, 5).map((t) => `- ${untrusted(t)}`).join('\n')}\n</respuestas_de_alumnos>\n`
  }
  const labels = new Map(p.options.map((o) => [o.id, o.label]))
  if (p.kind === 'wordcloud') {
    const top = Object.entries(p.counts).sort((a, b) => b[1] - a[1]).slice(0, 15)
    return `${head}\n<respuestas_de_alumnos>\n${top.map(([k, n]) => `- ${untrusted(k, 40)}: ${n}`).join('\n')}\n</respuestas_de_alumnos>\n`
  }
  const parts = Object.entries(p.counts).map(([k, n]) => `${labels.get(k) ?? k}: ${n}`)
  return `${head} → ${parts.join(' · ')}`
}

/** Texto del estado de la clase para el mensaje del usuario. */
export async function renderContext(ctx: AgentContext): Promise<string> {
  const { live, deck } = ctx
  const pos = live.current_position
  const total = deck.deck.kind === 'html' ? (deck.deck.htmlSlideCount ?? 0) : deck.slides.length
  const current = deck.slides.find((s) => s.position === pos)
  const transcript = await recentTranscript(live.id, { sinceMinutes: 2, includeCommands: false, limit: 40 })
  const lines: string[] = []
  lines.push(`<clase>`)
  lines.push(`Deck: ${deck.deck.title} (${total} slides). Slide actual: ${pos + 1}.`)
  lines.push(`En pantalla además de la slide: ${overlayLabel(ctx)}.`)
  lines.push(`</clase>`)
  lines.push('')
  lines.push('<slides>')
  if (deck.deck.kind === 'html') lines.push(`(deck HTML estático: ${total} slides numeradas del 1 al ${total}; se puede navegar y superponer cosas, pero NO insertar ni editar slides)`)
  for (const s of deck.slides) lines.push(`${s.position + 1}. [${s.kind}] ${s.title ?? '(sin título)'}${s.position === pos ? '  ← ACTUAL' : ''}`)
  lines.push('</slides>')
  lines.push('')
  if (current) {
    lines.push(`<slide_actual numero="${pos + 1}">`)
    lines.push(current.markdown)
    if (current.teacherNotes) lines.push(`\n[Notas del docente] ${current.teacherNotes}`)
    lines.push('</slide_actual>')
    lines.push('')
  }
  lines.push(`<encuesta_activa>${ctx.poll ? pollLabel(ctx.poll) : 'ninguna'}</encuesta_activa>`)
  lines.push('')
  lines.push('<casos_de_la_jornada>')
  if (!ctx.cases.length) lines.push('ninguno cargado')
  for (const c of ctx.cases) lines.push(`- ${c.id}: ${c.title} · «${c.question}» · posturas: ${c.postures.map((p) => `${p.label} [${p.id}]`).join(' / ')} · ${c.count} respuestas`)
  lines.push('</casos_de_la_jornada>')
  lines.push('')
  lines.push(`<simuladores>${ctx.sims.length ? ctx.sims.map((s) => `${s.id} (${s.title})`).join(', ') : 'ninguno'}</simuladores>`)
  lines.push('')
  lines.push(`<padron alumnos="${ctx.roster.length}">`)
  lines.push(ctx.roster.map((p) => `${untrusted(p.full_name, 80)}${p.company ? ` (${untrusted(p.company, 80)})` : ''}`).join('; '))
  lines.push('</padron>')
  lines.push('')
  lines.push('<transcripcion_ultimos_2_minutos>')
  if (!transcript.length) lines.push(live.transcript_enabled ? '(silencio)' : '(transcripción apagada)')
  for (const t of transcript) lines.push(`[slide ${(t.position ?? 0) + 1}] ${t.text}`)
  lines.push('</transcripcion_ultimos_2_minutos>')
  return lines.join('\n')
}
