// Lógica de datos de la vista del alumno. Recibe el cliente supabase por
// parámetro (sin `server-only`) para poder probarla con scripts tsx usando
// serviceDb(). Desde la app usala con db() (ver lib/student/server.ts).

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Overlay } from '@/lib/db-types'
import { parseSlide, slideTitle } from '@/lib/decks/parse'
import type { PollKind, PollOption } from '@/lib/decks/types'
import {
  NOTE_MAX, QUOTE_MAX, computeResults, emptyTotals, markTotals, normalizeAnswer,
  type CohortNote, type MarkKind, type MarkTotals, type MyMark, type MyPollResponse, type NoteVisibility,
  type PollAnswerInput, type PollResults, type PublicPoll, type StudentLiveSnapshot, type StudentNote,
  type StudentSlide, type ToggleMarkResult,
} from './types'

type Db = SupabaseClient

function fail(what: string, error: { message: string } | null): void {
  if (error) throw new Error(`${what}: ${error.message}`)
}

/* ---------- slides y clase ---------- */

/** slides.id de la posición del deck, o null si la posición no existe. */
export async function slideIdAt(client: Db, deckId: string, position: number): Promise<string | null> {
  if (!Number.isInteger(position) || position < 0) return null
  const { data, error } = await client.from('deck_slides').select('slide_id').eq('deck_id', deckId).eq('position', position).maybeSingle()
  fail('deck_slides', error)
  return data?.slide_id ?? null
}

export interface LiveRow {
  id: string
  deck_id: string
  code: string
  status: 'live' | 'ended'
  current_position: number
  overlay: Overlay | null
  class_session_id: string | null
  seq?: number
}

const LIVE_COLUMNS = 'id, deck_id, code, status, current_position, overlay, class_session_id, seq'

/** slide_id → posición actual en el deck (si una slide se repite, la primera). */
export async function deckPositionMap(client: Db, deckId: string): Promise<Map<string, number>> {
  const { data, error } = await client.from('deck_slides').select('slide_id, position').eq('deck_id', deckId).order('position')
  fail('deck_slides', error)
  const map = new Map<string, number>()
  for (const r of (data ?? []) as { slide_id: string; position: number }[]) if (!map.has(r.slide_id)) map.set(r.slide_id, r.position)
  return map
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * La slide sobre la que se marca o anota. Si el cliente manda el slideId que
 * estaba viendo, manda ese (aunque mientras tanto se haya insertado o movido
 * una slide y la posición ya no coincida); si no, la de la posición.
 * null si la slide ya no está en el deck.
 */
export async function resolveSlide(client: Db, deckId: string, position: number, slideId?: unknown): Promise<{ slideId: string; position: number } | null> {
  if (typeof slideId === 'string' && UUID_RE.test(slideId)) {
    const { data } = await client.from('deck_slides').select('position').eq('deck_id', deckId).eq('slide_id', slideId).order('position').limit(1).maybeSingle()
    return data ? { slideId, position: data.position as number } : null
  }
  const id = await slideIdAt(client, deckId, position)
  return id ? { slideId: id, position } : null
}

/** Clase por código (sin distinguir mayúsculas). La más reciente si hubiera varias. */
export async function liveByCode(client: Db, code: string): Promise<LiveRow | null> {
  const clean = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (!clean) return null
  const { data, error } = await client.from('live_sessions').select(LIVE_COLUMNS).eq('code', clean).maybeSingle()
  fail('live_sessions', error)
  return (data as LiveRow | null) ?? null
}

/**
 * id de clase válido para asociar una marca o nota: existe, está en vivo y es
 * del mismo deck. Si no, null (la marca se guarda igual, sin clase).
 */
export async function validLiveSessionId(client: Db, liveSessionId: unknown, deckId: string): Promise<string | null> {
  if (typeof liveSessionId !== 'string' || !/^[0-9a-f-]{36}$/i.test(liveSessionId)) return null
  const { data } = await client.from('live_sessions').select('id, deck_id, status').eq('id', liveSessionId).maybeSingle()
  return data && data.deck_id === deckId && data.status === 'live' ? data.id : null
}

interface JoinedSlide {
  position: number
  slides: { id: string; title: string | null; markdown: string } | null
}

/** Slides del deck para el alumno (nunca trae teacher_notes). */
export async function studentSlides(client: Db, deckId: string): Promise<StudentSlide[]> {
  const { data, error } = await client
    .from('deck_slides')
    .select('position, slides (id, title, markdown)')
    .eq('deck_id', deckId)
    .order('position', { ascending: true })
  fail('deck_slides', error)
  return ((data ?? []) as unknown as JoinedSlide[])
    .filter((r) => r.slides)
    .map((r) => ({
      id: r.slides!.id,
      position: r.position,
      markdown: r.slides!.markdown,
      title: r.slides!.title ?? slideTitle(parseSlide(r.slides!.markdown)),
    }))
}

export async function deckVersion(client: Db, deckId: string): Promise<number> {
  const { data } = await client.from('decks').select('updated_at').eq('id', deckId).maybeSingle()
  return data ? Date.parse(data.updated_at) : 0
}

/* ---------- marcas ---------- */

/** Marcas propias del deck, con la posición ACTUAL de cada slide (la clave es slide_id). */
export async function listMyMarks(client: Db, personId: string, deckId: string): Promise<MyMark[]> {
  const [{ data, error }, positions] = await Promise.all([
    client.from('slide_marks').select('slide_id, position, kind').eq('person_id', personId).eq('deck_id', deckId),
    deckPositionMap(client, deckId),
  ])
  fail('slide_marks', error)
  const out: MyMark[] = []
  for (const r of (data ?? []) as { slide_id: string | null; position: number; kind: MarkKind }[]) {
    const position = r.slide_id ? positions.get(r.slide_id) : r.position
    if (position === undefined) continue // la slide ya no está en el deck
    out.push({ position, kind: r.kind })
  }
  return out.sort((a, b) => a.position - b.position)
}

/** Prende o apaga una marca propia. `liveSessionId` ya validado (o null). */
export async function toggleMark(client: Db, input: {
  personId: string
  deckId: string
  position: number
  /** La slide que el alumno estaba viendo (gana sobre la posición). */
  slideId?: string | null
  kind: MarkKind
  liveSessionId: string | null
  /** Forzar estado en vez de alternar. */
  active?: boolean
}): Promise<ToggleMarkResult | null> {
  const slide = await resolveSlide(client, input.deckId, input.position, input.slideId)
  if (!slide) return null
  const key = { person_id: input.personId, deck_id: input.deckId, slide_id: slide.slideId, kind: input.kind }
  const { data: existing } = await client.from('slide_marks').select('id').match(key).limit(1).maybeSingle()
  const want = input.active ?? !existing
  if (want && !existing) {
    const { error } = await client.from('slide_marks').insert({ ...key, position: slide.position, live_session_id: input.liveSessionId })
    // 23505: otro request la creó en paralelo; el estado deseado ya está.
    if (error && !String(error.code).includes('23505')) fail('insert slide_marks', error)
  } else if (!want && existing) {
    fail('delete slide_marks', (await client.from('slide_marks').delete().match(key)).error)
  }
  const mine = await listMyMarks(client, input.personId, input.deckId)
  return {
    active: want,
    position: slide.position,
    slide: mine.filter((m) => m.position === slide.position).map((m) => m.kind),
    totals: markTotals(mine),
  }
}

/** Marcas de toda la cohorte en una slide (de la clase si se pasa liveSessionId). */
export async function slideMarkCounts(client: Db, deckId: string, position: number, liveSessionId?: string | null): Promise<MarkTotals> {
  const t = emptyTotals()
  const slideId = await slideIdAt(client, deckId, position)
  if (!slideId) return t
  let q = client.from('slide_marks').select('kind').eq('deck_id', deckId).eq('slide_id', slideId)
  if (liveSessionId) q = q.eq('live_session_id', liveSessionId)
  const { data, error } = await q
  fail('slide_marks', error)
  for (const r of (data ?? []) as { kind: MarkKind }[]) if (r.kind in t) t[r.kind]++
  return t
}

/* ---------- notas ---------- */

interface NoteRow {
  id: string
  deck_id: string
  position: number
  slide_id: string | null
  body: string
  quote: string | null
  visibility: NoteVisibility
  updated_at: string
}

const NOTE_COLUMNS = 'id, deck_id, position, slide_id, body, quote, visibility, updated_at'

function toNote(r: NoteRow): StudentNote {
  return { id: r.id, deckId: r.deck_id, position: r.position, slideId: r.slide_id, body: r.body, quote: r.quote, visibility: r.visibility, updatedAt: r.updated_at }
}

/** Notas propias del deck (una por slide; si hubiera duplicadas, la más reciente), con la posición actual de la slide. */
export async function listMyNotes(client: Db, personId: string, deckId: string): Promise<StudentNote[]> {
  const [{ data, error }, positions] = await Promise.all([
    client.from('slide_notes').select(NOTE_COLUMNS).eq('person_id', personId).eq('deck_id', deckId).order('updated_at', { ascending: false }),
    deckPositionMap(client, deckId),
  ])
  fail('slide_notes', error)
  const seen = new Set<string>()
  const out: StudentNote[] = []
  for (const r of (data ?? []) as NoteRow[]) {
    const position = r.slide_id ? positions.get(r.slide_id) : r.position
    if (position === undefined) continue // la slide ya no está en el deck
    const key = r.slide_id ?? `pos:${r.position}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(toNote({ ...r, position }))
  }
  return out.sort((a, b) => a.position - b.position)
}

/**
 * Guarda la nota propia de una slide (upsert lógico por persona+deck+posición).
 * Si cuerpo y cita quedan vacíos, la borra y devuelve null.
 */
export async function saveNote(client: Db, input: {
  personId: string
  deckId: string
  position: number
  /** La slide que el alumno estaba viendo al escribir (gana sobre la posición). */
  slideId?: string | null
  body: string
  quote: string | null
  visibility: NoteVisibility
  liveSessionId: string | null
}): Promise<StudentNote | null | 'no-slide'> {
  const slide = await resolveSlide(client, input.deckId, input.position, input.slideId)
  if (!slide) return 'no-slide'
  const { slideId, position } = slide
  const body = input.body.slice(0, NOTE_MAX)
  const quote = input.quote?.trim() ? input.quote.trim().slice(0, QUOTE_MAX) : null
  // clave real: (persona, deck, slide); la posición es solo informativa
  const { data: rows, error } = await client.from('slide_notes').select('id, live_session_id')
    .eq('person_id', input.personId).eq('deck_id', input.deckId).eq('slide_id', slideId)
    .order('updated_at', { ascending: false })
  fail('slide_notes', error)
  const existing = (rows ?? []) as { id: string; live_session_id: string | null }[]
  if (!body.trim() && !quote) {
    if (existing.length) fail('delete slide_notes', (await client.from('slide_notes').delete().in('id', existing.map((r) => r.id))).error)
    return null
  }
  const now = new Date().toISOString()
  if (existing.length) {
    const [keep, ...dupes] = existing
    if (dupes.length) await client.from('slide_notes').delete().in('id', dupes.map((r) => r.id))
    const patch: Record<string, unknown> = { body, quote, visibility: input.visibility, position, updated_at: now }
    if (input.liveSessionId && !keep.live_session_id) patch.live_session_id = input.liveSessionId
    const { data, error: e2 } = await client.from('slide_notes').update(patch).eq('id', keep.id).select(NOTE_COLUMNS).single()
    fail('update slide_notes', e2)
    return toNote(data as NoteRow)
  }
  const { data, error: e3 } = await client.from('slide_notes').insert({
    person_id: input.personId, deck_id: input.deckId, position, slide_id: slideId,
    body, quote, visibility: input.visibility, live_session_id: input.liveSessionId, updated_at: now,
  }).select(NOTE_COLUMNS).single()
  // 23505: otro request la creó en paralelo (índice único por slide): actualizamos esa
  if (e3 && String(e3.code) === '23505') return saveNote(client, input)
  fail('insert slide_notes', e3)
  return toNote(data as NoteRow)
}

/** Notas compartidas con la cohorte en una slide (sin las propias). */
export async function listCohortNotes(client: Db, deckId: string, position: number, excludePersonId: string): Promise<CohortNote[]> {
  const slideId = await slideIdAt(client, deckId, position)
  if (!slideId) return []
  const { data, error } = await client.from('slide_notes')
    .select('id, body, quote, updated_at, person_id, people (full_name)')
    .eq('deck_id', deckId).eq('slide_id', slideId).eq('visibility', 'cohorte').neq('person_id', excludePersonId)
    .order('updated_at', { ascending: false }).limit(30)
  fail('slide_notes cohorte', error)
  return ((data ?? []) as unknown as { id: string; body: string; quote: string | null; updated_at: string; people: { full_name: string } | null }[])
    .map((r) => ({ id: r.id, author: r.people?.full_name ?? 'Alguien de la cohorte', body: r.body, quote: r.quote, updatedAt: r.updated_at }))
}

/* ---------- encuestas ---------- */

interface PollRow {
  id: string
  kind: PollKind
  question: string
  options: PollOption[] | null
  status: 'draft' | 'open' | 'closed'
  anonymous: boolean
  live_session_id: string | null
  deck_id: string | null
  slide_id: string | null
}

const POLL_COLUMNS = 'id, kind, question, options, status, anonymous, live_session_id, deck_id, slide_id'

function toPoll(r: PollRow): PublicPoll {
  return {
    id: r.id, kind: r.kind, question: r.question, options: Array.isArray(r.options) ? r.options : [], status: r.status,
    anonymous: r.anonymous, liveSessionId: r.live_session_id, deckId: r.deck_id, slideId: r.slide_id,
  }
}

export async function getPublicPoll(client: Db, pollId: string): Promise<PublicPoll | null> {
  if (!/^[0-9a-f-]{36}$/i.test(pollId)) return null
  const { data, error } = await client.from('polls').select(POLL_COLUMNS).eq('id', pollId).maybeSingle()
  fail('polls', error)
  return data ? toPoll(data as PollRow) : null
}

export type Respondent = { personId: string } | { guestKey: string; guestName?: string | null }

function whoFilter(who: Respondent): [string, string] {
  return 'personId' in who ? ['person_id', who.personId] : ['guest_key', who.guestKey]
}

export async function getMyResponse(client: Db, pollId: string, who: Respondent): Promise<MyPollResponse | null> {
  const [col, val] = whoFilter(who)
  const { data } = await client.from('poll_responses').select('choice, text, guest_name, created_at').eq('poll_id', pollId).eq(col, val).maybeSingle()
  if (!data) return null
  return { choice: data.choice as MyPollResponse['choice'], text: data.text, guestName: data.guest_name, updatedAt: data.created_at }
}

/** Último nombre que usó un invitado (para precargar el formulario). */
export async function lastGuestName(client: Db, guestKey: string): Promise<string | null> {
  const { data } = await client.from('poll_responses').select('guest_name').eq('guest_key', guestKey)
    .not('guest_name', 'is', null).order('created_at', { ascending: false }).limit(1).maybeSingle()
  return data?.guest_name ?? null
}

export async function pollResults(client: Db, poll: Pick<PublicPoll, 'id' | 'kind' | 'options'>): Promise<PollResults> {
  const { data, error } = await client.from('poll_responses').select('choice, text').eq('poll_id', poll.id).order('created_at')
  fail('poll_responses', error)
  return computeResults(poll, (data ?? []) as { choice: unknown; text: string | null }[])
}

/**
 * ¿Puede verse el resultado de esta encuesta? Solo si está cerrada o el
 * profesor la está proyectando con resultados (overlay poll con showResults).
 */
export async function resultsVisible(client: Db, poll: Pick<PublicPoll, 'id' | 'status' | 'liveSessionId'>): Promise<boolean> {
  if (poll.status === 'closed') return true
  if (!poll.liveSessionId) return false
  const { data } = await client.from('live_sessions').select('overlay').eq('id', poll.liveSessionId).maybeSingle()
  const o = data?.overlay as { type?: string; pollId?: string; showResults?: boolean } | null
  return o?.type === 'poll' && o.pollId === poll.id && Boolean(o.showResults)
}

export type AnswerOutcome =
  | { ok: true; poll: PublicPoll; response: MyPollResponse; results: PollResults }
  | { ok: false; status: number; error: string }

/**
 * Registra (o cambia) la respuesta de una persona o invitado. Una por persona;
 * se puede cambiar mientras la encuesta esté abierta.
 */
export async function answerPoll(client: Db, pollId: string, who: Respondent, input: PollAnswerInput): Promise<AnswerOutcome> {
  const poll = await getPublicPoll(client, pollId)
  if (!poll) return { ok: false, status: 404, error: 'No encontramos esa encuesta.' }
  if (poll.status !== 'open') return { ok: false, status: 409, error: poll.status === 'closed' ? 'La encuesta ya está cerrada.' : 'La encuesta todavía no está abierta.' }
  const answer = normalizeAnswer(poll, input)
  if ('error' in answer) return { ok: false, status: 400, error: answer.error }
  let guestName: string | null = null
  if (!('personId' in who)) {
    guestName = (who.guestName ?? '').replace(/\s+/g, ' ').trim().slice(0, 80) || null
    if (!guestName && !poll.anonymous) return { ok: false, status: 400, error: 'Contanos tu nombre para responder.' }
  }
  const [col, val] = whoFilter(who)
  const row: Record<string, unknown> = { choice: answer.choice, text: answer.text, created_at: new Date().toISOString() }
  if (guestName) row.guest_name = guestName
  const write = async () => {
    const { data: existing } = await client.from('poll_responses').select('id').eq('poll_id', pollId).eq(col, val).maybeSingle()
    if (existing) return client.from('poll_responses').update(row).eq('id', existing.id)
    return client.from('poll_responses').insert({ ...row, poll_id: pollId, [col]: val })
  }
  let { error } = await write()
  if (error && String(error.code) === '23505') ({ error } = await write())
  if (error) return { ok: false, status: 500, error: `No pudimos guardar tu respuesta (${error.message}).` }
  const response = await getMyResponse(client, pollId, who)
  const results = await pollResults(client, poll)
  return { ok: true, poll, response: response!, results }
}

/**
 * Encuesta activa de una clase: la del overlay si hay; si no, la abierta más
 * reciente de la clase; si no, una abierta de la slide actual.
 */
export async function activePollFor(client: Db, live: LiveRow, currentSlideId: string | null): Promise<PublicPoll | null> {
  const overlay = live.overlay
  if (overlay?.type === 'poll' && overlay.pollId) {
    const p = await getPublicPoll(client, overlay.pollId)
    if (p && p.status !== 'draft') return p
  }
  const { data: own } = await client.from('polls').select(POLL_COLUMNS).eq('live_session_id', live.id).eq('status', 'open')
    .order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (own) return toPoll(own as PollRow)
  if (currentSlideId) {
    const { data: bySlide } = await client.from('polls').select(POLL_COLUMNS).eq('slide_id', currentSlideId).eq('status', 'open')
      .order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (bySlide) return toPoll(bySlide as PollRow)
  }
  return null
}

/** Estado de la clase para el celular del alumno. */
export async function liveSnapshot(client: Db, live: LiveRow, withSlides: boolean): Promise<StudentLiveSnapshot> {
  const [version, slides, currentSlideId] = await Promise.all([
    deckVersion(client, live.deck_id),
    withSlides ? studentSlides(client, live.deck_id) : Promise.resolve(undefined),
    slideIdAt(client, live.deck_id, live.current_position),
  ])
  const snap: StudentLiveSnapshot = {
    liveSessionId: live.id,
    code: live.code,
    deckId: live.deck_id,
    status: live.status,
    position: live.current_position,
    overlay: live.overlay ?? null,
    deckVersion: version,
    seq: Number(live.seq ?? 0),
    activePoll: await activePollFor(client, live, currentSlideId),
  }
  if (slides) snap.slides = slides
  return snap
}
