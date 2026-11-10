import 'server-only'
import { db } from '@/lib/db'
import { getDeck } from '@/lib/decks/store'
import { MARK_KINDS, type MarkKind } from './types'

/* Analítica por slide de un deck: marcas, notas, encuestas, transcripción y
   preguntas al tutor, agrupadas por la posición actual de cada slide. Si un
   registro trae slide_id se ubica por slide (sobrevive a inserciones); si
   no, por su posición guardada. */

const PAGE = 1000

/** Trae todas las filas paginando (PostgREST corta en 1000). */
async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    const rows = (data ?? []) as T[]
    out.push(...rows)
    if (rows.length < PAGE) break
  }
  return out
}

export interface PollAnalytics {
  pollId: string
  question: string
  kind: string
  status: string
  liveSessionId: string | null
  total: number
  /** single/multiple: conteo por opción. scale: conteo por valor. */
  options: Array<{ id: string; label: string; count: number; pct: number }>
  /** scale: promedio. */
  average: number | null
  /** open/wordcloud: textos (hasta 12). */
  texts: string[]
}

export interface SlideAnalytics {
  position: number
  slideId: string
  title: string
  kind: string
  markdown: string
  marks: Record<MarkKind, number>
  notes: { total: number; public: number; publicSamples: Array<{ body: string; quote: string | null; author: string }> }
  polls: PollAnalytics[]
  transcript: Array<{ id: number; text: string; isCommand: boolean; at: string }>
  tutor: Array<{ threadId: string; person: string; questions: string[]; messages: number; at: string }>
}

export interface DeckAnalytics {
  deck: { id: string; title: string; question: string | null }
  lives: Array<{ id: string; code: string; status: string; startedAt: string; endedAt: string | null }>
  liveSessionId: string | null
  slides: SlideAnalytics[]
  /** Slides con más "no entendí" (solo las que tienen al menos uno). */
  ranking: Array<{ position: number; title: string; noEntendi: number; preguntas: number; tutor: number }>
  /** Encuestas del deck que no se pudieron ubicar en una slide. */
  orphanPolls: PollAnalytics[]
  totals: { marks: number; notes: number; responses: number; transcript: number; tutor: number; people: number }
}

function emptyMarks(): Record<MarkKind, number> {
  return { 'no-entendi': 0, clave: 0, pregunta: 0, idea: 0 }
}

export async function getDeckAnalytics(deckId: string, liveSessionId?: string | null): Promise<DeckAnalytics | null> {
  const loaded = await getDeck(deckId, 'profesor')
  if (!loaded) return null
  const client = db()

  const { data: livesData } = await client.from('live_sessions').select('id, code, status, started_at, ended_at').eq('deck_id', deckId).order('started_at', { ascending: false })
  const lives = ((livesData ?? []) as Array<{ id: string; code: string; status: string; started_at: string; ended_at: string | null }>).map((l) => ({ id: l.id, code: l.code, status: l.status, startedAt: l.started_at, endedAt: l.ended_at }))
  const live = liveSessionId ? lives.find((l) => l.id === liveSessionId) ?? null : null
  const liveIds = live ? [live.id] : lives.map((l) => l.id)

  const slides: SlideAnalytics[] = loaded.slides.map((s) => ({
    position: s.position,
    slideId: s.id,
    title: s.title ?? `Slide ${s.position + 1}`,
    kind: s.kind,
    markdown: s.markdown,
    marks: emptyMarks(),
    notes: { total: 0, public: 0, publicSamples: [] },
    polls: [],
    transcript: [],
    tutor: [],
  }))
  const byPos = new Map(slides.map((s) => [s.position, s]))
  const posBySlide = new Map(slides.map((s) => [s.slideId, s.position]))
  const locate = (slideId: string | null | undefined, position: number | null | undefined): SlideAnalytics | undefined => {
    const p = (slideId ? posBySlide.get(slideId) : undefined) ?? (typeof position === 'number' ? position : undefined)
    return p === undefined ? undefined : byPos.get(p)
  }
  const slideIds = slides.map((s) => s.slideId)
  const people = new Set<string>()

  // Marcas
  const marks = await fetchAll<{ person_id: string; slide_id: string | null; position: number; kind: string }>((a, b) => {
    let q = client.from('slide_marks').select('person_id, slide_id, position, kind').eq('deck_id', deckId)
    if (live) q = q.eq('live_session_id', live.id)
    return q.range(a, b)
  })
  for (const m of marks) {
    const s = locate(m.slide_id, m.position)
    if (s && (MARK_KINDS as readonly string[]).includes(m.kind)) s.marks[m.kind as MarkKind]++
    people.add(m.person_id)
  }

  // Notas (de las privadas solo se cuentan; las públicas a la cohorte se muestran)
  const notes = await fetchAll<{ person_id: string; slide_id: string | null; position: number; body: string; quote: string | null; visibility: string; people: { full_name: string } | null }>((a, b) => {
    let q = client.from('slide_notes').select('person_id, slide_id, position, body, quote, visibility, people(full_name)').eq('deck_id', deckId).order('updated_at', { ascending: false })
    if (live) q = q.eq('live_session_id', live.id)
    return q.range(a, b)
  })
  for (const n of notes) {
    const s = locate(n.slide_id, n.position)
    people.add(n.person_id)
    if (!s) continue
    s.notes.total++
    if (n.visibility === 'cohorte') {
      s.notes.public++
      if (s.notes.publicSamples.length < 5 && (n.body.trim() || n.quote)) s.notes.publicSamples.push({ body: n.body, quote: n.quote, author: n.people?.full_name ?? 'Alumno' })
    }
  }

  // Encuestas: del deck o de sus slides; con filtro, solo las de esa clase
  let pollQuery = client.from('polls').select('id, live_session_id, deck_id, slide_id, kind, question, options, status, created_at')
  pollQuery = slideIds.length ? pollQuery.or(`deck_id.eq.${deckId},slide_id.in.(${slideIds.join(',')})`) : pollQuery.eq('deck_id', deckId)
  if (live) pollQuery = pollQuery.eq('live_session_id', live.id)
  const { data: pollsData } = await pollQuery.order('created_at')
  const polls = (pollsData ?? []) as Array<{ id: string; live_session_id: string | null; slide_id: string | null; kind: string; question: string; options: Array<{ id: string; label: string }> | null; status: string }>
  const pollIds = polls.map((p) => p.id)
  const responses: Array<{ poll_id: string; choice: unknown; text: string | null; person_id: string | null; guest_key: string | null }> = []
  for (let i = 0; i < pollIds.length; i += 100) {
    const chunk = pollIds.slice(i, i + 100)
    responses.push(...await fetchAll<{ poll_id: string; choice: unknown; text: string | null; person_id: string | null; guest_key: string | null }>((a, b) => client.from('poll_responses').select('poll_id, choice, text, person_id, guest_key').in('poll_id', chunk).range(a, b)))
  }
  // quien respondió una encuesta (alumno o invitado) también cuenta como activo
  for (const r of responses) {
    const who = r.person_id ?? (r.guest_key ? `invitado:${r.guest_key}` : null)
    if (who) people.add(who)
  }
  const respByPoll = new Map<string, typeof responses>()
  for (const r of responses) respByPoll.set(r.poll_id, [...(respByPoll.get(r.poll_id) ?? []), r])
  const orphanPolls: PollAnalytics[] = []
  for (const p of polls) {
    const pa = pollAnalytics(p, respByPoll.get(p.id) ?? [])
    const s = p.slide_id ? byPos.get(posBySlide.get(p.slide_id) ?? -1) : undefined
    if (s) s.polls.push(pa)
    else orphanPolls.push(pa)
  }

  // Transcripción
  let transcriptCount = 0
  if (liveIds.length) {
    const segs = await fetchAll<{ id: number; slide_id: string | null; slide_position: number | null; text: string; is_command: boolean; created_at: string }>((a, b) =>
      client.from('transcript_segments').select('id, slide_id, slide_position, text, is_command, created_at').in('live_session_id', liveIds).order('id').range(a, b))
    for (const t of segs) {
      const s = locate(t.slide_id, t.slide_position)
      if (!s) continue
      s.transcript.push({ id: t.id, text: t.text, isCommand: t.is_command, at: t.created_at })
      transcriptCount++
    }
  }

  // Tutor (con filtro de clase: hilos abiertos durante la clase)
  let tq = client.from('tutor_threads').select('id, person_id, slide_id, position, created_at, people(full_name)').eq('deck_id', deckId)
  if (live) {
    tq = tq.gte('created_at', live.startedAt)
    if (live.endedAt) tq = tq.lte('created_at', live.endedAt)
  }
  const { data: threadsData } = await tq.order('created_at', { ascending: false }).limit(500)
  const threads = (threadsData ?? []) as unknown as Array<{ id: string; person_id: string; slide_id: string | null; position: number | null; created_at: string; people: { full_name: string } | null }>
  const msgsByThread = new Map<string, Array<{ role: string; content: string }>>()
  const threadIds = threads.map((t) => t.id)
  for (let i = 0; i < threadIds.length; i += 100) {
    const chunk = threadIds.slice(i, i + 100)
    const msgs = await fetchAll<{ thread_id: string; role: string; content: string }>((a, b) => client.from('tutor_messages').select('thread_id, role, content').in('thread_id', chunk).order('id').range(a, b))
    for (const m of msgs) msgsByThread.set(m.thread_id, [...(msgsByThread.get(m.thread_id) ?? []), m])
  }
  let tutorCount = 0
  for (const t of threads) {
    const s = locate(t.slide_id, t.position)
    people.add(t.person_id)
    if (!s) continue
    const msgs = msgsByThread.get(t.id) ?? []
    const questions = msgs.filter((m) => m.role === 'user').map((m) => m.content)
    if (!questions.length) continue
    s.tutor.push({ threadId: t.id, person: t.people?.full_name ?? 'Alumno', questions: questions.slice(0, 4), messages: msgs.length, at: t.created_at })
    tutorCount++
  }

  const ranking = slides
    .filter((s) => s.marks['no-entendi'] > 0)
    .sort((a, b) => b.marks['no-entendi'] - a.marks['no-entendi'] || b.marks.pregunta - a.marks.pregunta || b.tutor.length - a.tutor.length || a.position - b.position)
    .slice(0, 8)
    .map((s) => ({ position: s.position, title: s.title, noEntendi: s.marks['no-entendi'], preguntas: s.marks.pregunta, tutor: s.tutor.length }))

  return {
    deck: { id: loaded.deck.id, title: loaded.deck.title, question: loaded.deck.question },
    lives,
    liveSessionId: live?.id ?? null,
    slides,
    ranking,
    orphanPolls,
    totals: { marks: marks.length, notes: notes.length, responses: responses.length, transcript: transcriptCount, tutor: tutorCount, people: people.size },
  }
}

function pollAnalytics(
  p: { id: string; live_session_id: string | null; kind: string; question: string; options: Array<{ id: string; label: string }> | null; status: string },
  rows: Array<{ choice: unknown; text: string | null }>,
): PollAnalytics {
  const total = rows.length
  const texts = rows.map((r) => r.text?.trim()).filter((t): t is string => !!t).slice(0, 12)
  let options: PollAnalytics['options'] = []
  let average: number | null = null
  if (p.kind === 'scale') {
    const values = rows.map((r) => Number(Array.isArray(r.choice) ? r.choice[0] : r.choice)).filter((n) => Number.isFinite(n))
    average = values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10 : null
    const labels = p.options && p.options.length ? p.options : [1, 2, 3, 4, 5].map((n) => ({ id: String(n), label: String(n) }))
    options = labels.map((o, i) => {
      const count = values.filter((v) => String(v) === o.id || v === i + 1).length
      return { id: o.id, label: o.label, count, pct: total ? Math.round((count / total) * 100) : 0 }
    })
  } else if (p.kind === 'single' || p.kind === 'multiple') {
    const counts = new Map<string, number>()
    for (const r of rows) {
      const ids = Array.isArray(r.choice) ? r.choice.map(String) : r.choice != null ? [String(r.choice)] : []
      for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1)
    }
    options = (p.options ?? []).map((o) => {
      const count = counts.get(o.id) ?? 0
      return { id: o.id, label: o.label, count, pct: total ? Math.round((count / total) * 100) : 0 }
    })
  }
  return { pollId: p.id, question: p.question, kind: p.kind, status: p.status, liveSessionId: p.live_session_id, total, options, average, texts }
}
