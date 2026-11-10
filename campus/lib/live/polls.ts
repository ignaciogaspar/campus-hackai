import 'server-only'
import { db } from '@/lib/db'
import type { LiveSession } from '@/lib/db-types'
import { parseSlide, pollOptionId } from '@/lib/decks'
import { POLL_KINDS, type PollKind, type PollOption } from '@/lib/decks/types'
import { slidePollId } from '@/lib/ids'
import { broadcast, LIVE_EVENTS } from '@/lib/realtime'
import { LiveError, logEvent, setOverlay, slideAt } from './session'
import { cloudTerms, type PollSnapshot } from './types'

/* Encuestas en vivo: crear, abrir la de una slide :::encuesta, cerrar,
   mostrar resultados y calcular conteos. `emitPollUpdated` es el hook que
   tiene que llamar quien guarda respuestas (feature /p/[pollId] y /s/[code]). */

interface PollRow {
  id: string
  live_session_id: string | null
  deck_id: string | null
  slide_id: string | null
  kind: PollKind
  question: string
  options: PollOption[]
  status: 'draft' | 'open' | 'closed'
}

export async function getPoll(pollId: string): Promise<PollRow | null> {
  const { data } = await db().from('polls').select('id, live_session_id, deck_id, slide_id, kind, question, options, status').eq('id', pollId).maybeSingle()
  return (data as PollRow | null) ?? null
}

/** Encuesta con conteos. null si no existe. */
export async function pollSnapshot(pollId: string): Promise<PollSnapshot | null> {
  const [poll, res] = await Promise.all([
    getPoll(pollId),
    db().from('poll_responses').select('choice, text, created_at').eq('poll_id', pollId).order('created_at', { ascending: false }).limit(2000),
  ])
  if (!poll) return null
  const rows = (res.data ?? []) as { choice: unknown; text: string | null }[]
  const counts: Record<string, number> = {}
  for (const o of poll.options ?? []) counts[o.id] = 0
  if (poll.kind === 'scale' && (poll.options ?? []).length === 0) for (let i = 1; i <= 5; i++) counts[String(i)] = 0
  const texts: string[] = []
  for (const r of rows) {
    if (poll.kind === 'open') {
      if (r.text?.trim()) texts.push(r.text.trim())
      continue
    }
    if (poll.kind === 'wordcloud') {
      for (const t of cloudTerms(r.text ?? (Array.isArray(r.choice) ? r.choice.join(',') : ''))) counts[t] = (counts[t] ?? 0) + 1
      if (r.text?.trim()) texts.push(r.text.trim())
      continue
    }
    const list = Array.isArray(r.choice) ? r.choice : r.choice == null ? [] : [r.choice]
    for (const c of list) {
      const k = String(c)
      counts[k] = (counts[k] ?? 0) + 1
    }
  }
  return {
    pollId: poll.id,
    kind: poll.kind,
    question: poll.question,
    options: poll.options ?? [],
    status: poll.status,
    slideId: poll.slide_id,
    total: rows.length,
    counts,
    texts: texts.length ? texts.slice(0, 30) : undefined,
  }
}

/**
 * Recalcula los conteos y emite `poll.updated` {pollId, kind, total, counts, texts?}
 * en el canal de la clase. Llamalo después de guardar una respuesta.
 */
export async function emitPollUpdated(liveSessionId: string, pollId: string): Promise<PollSnapshot | null> {
  const snap = await pollSnapshot(pollId)
  if (!snap) return null
  await broadcast(liveSessionId, LIVE_EVENTS.pollUpdated, {
    pollId: snap.pollId, kind: snap.kind, total: snap.total, counts: snap.counts, texts: snap.texts,
  })
  return snap
}

/** La encuesta activa: la del overlay o la última abierta de la clase. */
export async function activePollId(live: LiveSession): Promise<string | null> {
  if (live.overlay?.type === 'poll') return live.overlay.pollId
  const { data } = await db()
    .from('polls')
    .select('id')
    .eq('live_session_id', live.id)
    .in('status', ['open', 'closed'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data?.id as string | undefined) ?? null
}

export function normalizeOptions(labels: string[]): PollOption[] {
  return labels
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 8)
    .map((label, i) => ({ id: pollOptionId(i), label }))
}

/** Crea una encuesta abierta para la clase y la muestra (overlay poll con QR). */
export async function createLivePoll(live: LiveSession, input: { question: string; kind: PollKind; options: string[]; slideId?: string | null }, actor = 'profesor'): Promise<PollSnapshot> {
  const question = input.question.trim()
  if (!question) throw new LiveError('La encuesta necesita una pregunta.')
  if (!(POLL_KINDS as readonly string[]).includes(input.kind)) throw new LiveError(`Tipo de encuesta inválido: ${input.kind}`)
  const options = normalizeOptions(input.options ?? [])
  if ((input.kind === 'single' || input.kind === 'multiple') && options.length < 2) throw new LiveError('Una encuesta de opciones necesita al menos dos opciones.')
  const { data, error } = await db()
    .from('polls')
    .insert({
      live_session_id: live.id,
      deck_id: live.deck_id,
      slide_id: input.slideId ?? null,
      kind: input.kind,
      question,
      options: input.kind === 'open' || input.kind === 'wordcloud' ? [] : options,
      status: 'open',
      created_by: actor === 'agent' ? 'agent' : 'profesor',
    })
    .select('id')
    .single()
  if (error || !data) throw new Error(`No se pudo crear la encuesta: ${error?.message}`)
  await closeOtherPolls(live, data.id)
  await logEvent(live.id, 'poll.created', { pollId: data.id, question, kind: input.kind }, actor)
  await setOverlay(live, { type: 'poll', pollId: data.id, showResults: false }, actor)
  return (await pollSnapshot(data.id))!
}

/** Cierra las otras encuestas abiertas de la clase (una activa por vez). */
async function closeOtherPolls(live: LiveSession, keepId: string): Promise<void> {
  await db().from('polls').update({ status: 'closed', closed_at: new Date().toISOString() })
    .eq('live_session_id', live.id).eq('status', 'open').neq('id', keepId)
}

/**
 * Abre la encuesta de una slide :::encuesta (por defecto la actual). Usa la
 * poll draft de la slide (slidePollId) si existe; si ya se usó en otra clase,
 * crea una copia para esta.
 */
export async function openSlidePoll(live: LiveSession, position: number | null | undefined, actor = 'profesor'): Promise<PollSnapshot> {
  const pos = position ?? live.current_position
  const slide = await slideAt(live.deck_id, pos)
  if (!slide) throw new LiveError('No hay slide en esa posición.')
  const parsed = parseSlide(slide.markdown)
  const it = parsed.interactive
  if (!it || it.kind !== 'encuesta') throw new LiveError('Esa slide no es una encuesta.')
  if (!it.question) throw new LiveError('La slide de encuesta no tiene pregunta.')

  const draftId = slidePollId(slide.id)
  const draft = await getPoll(draftId)
  let pollId: string | null = null
  if (draft && (draft.status === 'draft' || draft.live_session_id === live.id)) {
    const { error } = await db().from('polls').update({
      status: 'open', live_session_id: live.id, deck_id: live.deck_id, slide_id: slide.id, closed_at: null,
    }).eq('id', draftId)
    if (error) throw new Error(`No se pudo abrir la encuesta: ${error.message}`)
    pollId = draftId
  } else {
    // ¿ya hay una abierta en esta clase para esta slide?
    const { data: existing } = await db().from('polls').select('id').eq('live_session_id', live.id).eq('slide_id', slide.id)
      .order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (existing) {
      await db().from('polls').update({ status: 'open', closed_at: null }).eq('id', existing.id)
      pollId = existing.id as string
    } else {
      const { data, error } = await db().from('polls').insert({
        live_session_id: live.id,
        deck_id: live.deck_id,
        slide_id: slide.id,
        kind: it.pollKind,
        question: it.question,
        options: it.options,
        status: 'open',
        created_by: 'slide',
      }).select('id').single()
      if (error || !data) throw new Error(`No se pudo abrir la encuesta: ${error?.message}`)
      pollId = data.id as string
    }
  }
  await closeOtherPolls(live, pollId)
  await logEvent(live.id, 'poll.opened', { pollId, slideId: slide.id, position: pos }, actor)
  await setOverlay(live, { type: 'poll', pollId, showResults: false }, actor)
  return (await pollSnapshot(pollId))!
}

/** Muestra (o esconde) los resultados de una encuesta en el proyector. */
export async function showPollResults(live: LiveSession, pollId: string | null | undefined, show = true, actor = 'profesor'): Promise<PollSnapshot> {
  const id = pollId ?? (await activePollId(live))
  if (!id) throw new LiveError('No hay ninguna encuesta en esta clase.')
  const snap = await pollSnapshot(id)
  if (!snap) throw new LiveError('No encontré esa encuesta.')
  await setOverlay(live, { type: 'poll', pollId: id, showResults: show }, actor)
  return snap
}

/** Cierra una encuesta (deja de aceptar respuestas). Si estaba en pantalla, pasa a mostrar resultados. */
export async function closePoll(live: LiveSession, pollId: string | null | undefined, actor = 'profesor'): Promise<PollSnapshot> {
  const id = pollId ?? (await activePollId(live))
  if (!id) throw new LiveError('No hay ninguna encuesta abierta.')
  const { error } = await db().from('polls').update({ status: 'closed', closed_at: new Date().toISOString() }).eq('id', id)
  if (error) throw new Error(`close poll: ${error.message}`)
  await logEvent(live.id, 'poll.closed', { pollId: id }, actor)
  // si sigue en pantalla (según la DB, no una copia vieja), pasa a mostrar resultados
  if (live.status === 'live') await setOverlay(live, { type: 'poll', pollId: id, showResults: true }, actor, { type: 'poll', pollId: id })
  const snap = (await pollSnapshot(id))!
  await broadcast(live.id, LIVE_EVENTS.pollUpdated, { pollId: id, kind: snap.kind, total: snap.total, counts: snap.counts, texts: snap.texts, status: 'closed' })
  return snap
}
