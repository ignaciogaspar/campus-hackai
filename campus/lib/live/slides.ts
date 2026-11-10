import 'server-only'
import { db } from '@/lib/db'
import type { LiveSession } from '@/lib/db-types'
import { parseSlide, slideIssues, slideTitle } from '@/lib/decks'
import { SLIDE_TYPES } from '@/lib/decks/types'
import { touchDeck } from '@/lib/decks/store'
import { slidePollId } from '@/lib/ids'
import { broadcast, LIVE_EVENTS } from '@/lib/realtime'
import { LiveError, logEvent, publishDeckSessions, refreshLive, setPosition, slideAt } from './session'

/* Insertar y editar slides desde la clase en vivo (agente o consola).
   Insertar crea una fila nueva en el repositorio único (origin {agent:true})
   y la ubica en el deck; editar crea una revisión y sube la versión. */

/** Valida el DSL de una slide. Devuelve los problemas (vacío = ok). */
export function validateSlideMarkdown(markdown: string): string[] {
  const md = markdown.trim()
  if (!md) return ['La slide está vacía.']
  if (/\n---\n/.test(`\n${md}\n`)) return ['Una sola slide: no uses el separador ---.']
  const problems: string[] = []
  const directive = md.match(/^:::([a-z-]+)/)?.[1]
  if (!directive) problems.push('La slide tiene que empezar con :::tipo (por ejemplo :::default, :::tabla, :::pasos).')
  else if (!(SLIDE_TYPES as readonly string[]).includes(directive)) problems.push(`Tipo desconocido :::${directive}. Tipos válidos: ${SLIDE_TYPES.join(', ')}.`)
  const parsed = parseSlide(md)
  problems.push(...slideIssues(parsed))
  return problems
}

/** Crea la poll draft de una slide :::encuesta (convención de la seed). */
async function ensureDraftPoll(slideId: string, deckId: string, markdown: string): Promise<void> {
  const it = parseSlide(markdown).interactive
  if (!it || it.kind !== 'encuesta' || !it.question) return
  await db().from('polls').upsert({
    id: slidePollId(slideId), deck_id: deckId, slide_id: slideId, kind: it.pollKind,
    question: it.question, options: it.options, status: 'draft', created_by: 'slide',
  }, { onConflict: 'id', ignoreDuplicates: true })
}

export interface InsertedSlide {
  slideId: string
  position: number
  title: string
  deckVersion: number
}

/**
 * Inserta una slide después de `afterPosition` (0-based; -1 = al principio).
 * Si queda antes de la slide actual, corre la posición actual para no moverle
 * la pantalla al profesor. Emite deck.changed y state.
 */
export async function insertSlide(live: LiveSession, input: { markdown: string; afterPosition: number; teacherNotes?: string | null; tags?: string[]; authorId?: string | null; goTo?: boolean }, actor = 'agent'): Promise<InsertedSlide> {
  const markdown = input.markdown.trim()
  const problems = validateSlideMarkdown(markdown)
  if (problems.length) throw new LiveError(`La slide no es válida: ${problems.join(' · ')}`)
  const parsed = parseSlide(markdown)
  const { data: course } = await db().from('decks').select('course_id').eq('id', live.deck_id).maybeSingle()
  const { data: slide, error } = await db().from('slides').insert({
    course_id: course?.course_id ?? null,
    kind: parsed.type,
    title: slideTitle(parsed),
    markdown,
    teacher_notes: input.teacherNotes?.trim() || null,
    tags: ['en-vivo', ...(input.tags ?? [])],
    author_id: input.authorId ?? live.started_by,
    origin: { agent: actor === 'agent', liveSessionId: live.id, deck: live.deck_id, afterPosition: input.afterPosition },
  }).select('id, title').single()
  if (error || !slide) throw new Error(`No se pudo crear la slide: ${error?.message}`)
  await db().from('slide_revisions').insert({ slide_id: slide.id, markdown, teacher_notes: input.teacherNotes?.trim() || null, edited_by: input.authorId ?? live.started_by, via: actor === 'agent' ? 'agent' : 'editor' })
  const { data: pos, error: e2 } = await db().rpc('live_insert_deck_slide', { p_deck: live.deck_id, p_after: input.afterPosition, p_slide: slide.id })
  if (e2) {
    await db().from('slides').delete().eq('id', slide.id)
    throw new Error(`No se pudo ubicar la slide en el deck: ${e2.message}`)
  }
  const position = Number(pos)
  await ensureDraftPoll(slide.id as string, live.deck_id, markdown)
  const deckVersion = await touchDeck(live.deck_id)
  // live_insert_deck_slide ya corrió current_position de las clases vivas del
  // deck (sigue a la slide que estaban dando): releemos, no la calculamos acá.
  await refreshLive(live)
  await Promise.all([
    logEvent(live.id, 'slide.inserted', { slideId: slide.id, position, title: slide.title }, actor),
    broadcast(live.id, LIVE_EVENTS.deckChanged, { deckVersion }),
  ])
  if (input.goTo && live.status === 'live') await setPosition(live, position, actor)
  await publishDeckSessions(live.deck_id, deckVersion)
  return { slideId: slide.id as string, position, title: (slide.title as string) ?? '', deckVersion }
}

/** Reemplaza el markdown (y opcionalmente las notas) de la slide en una posición. */
export async function editSlide(live: LiveSession, input: { position: number; markdown: string; teacherNotes?: string | null; editorId?: string | null }, actor = 'agent'): Promise<{ slideId: string; version: number; deckVersion: number }> {
  const markdown = input.markdown.trim()
  const problems = validateSlideMarkdown(markdown)
  if (problems.length) throw new LiveError(`La slide no es válida: ${problems.join(' · ')}`)
  const current = await slideAt(live.deck_id, input.position)
  if (!current) throw new LiveError('No hay slide en esa posición.')
  const { data: row } = await db().from('slides').select('version, teacher_notes').eq('id', current.id).single()
  const parsed = parseSlide(markdown)
  const version = ((row?.version as number) ?? 1) + 1
  const teacherNotes = input.teacherNotes === undefined || input.teacherNotes === null ? (row?.teacher_notes as string | null) : input.teacherNotes.trim() || null
  const { error } = await db().from('slides').update({
    markdown, kind: parsed.type, title: slideTitle(parsed), teacher_notes: teacherNotes, version, updated_at: new Date().toISOString(),
  }).eq('id', current.id)
  if (error) throw new Error(`No se pudo editar la slide: ${error.message}`)
  await db().from('slide_revisions').insert({ slide_id: current.id, markdown, teacher_notes: teacherNotes, edited_by: input.editorId ?? live.started_by, via: actor === 'agent' ? 'agent' : 'editor' })
  await ensureDraftPoll(current.id, live.deck_id, markdown)
  const deckVersion = await touchDeck(live.deck_id)
  await Promise.all([
    logEvent(live.id, 'slide.edited', { slideId: current.id, position: input.position, version }, actor),
    broadcast(live.id, LIVE_EVENTS.deckChanged, { deckVersion }),
  ])
  await refreshLive(live)
  await publishDeckSessions(live.deck_id, deckVersion)
  return { slideId: current.id, version, deckVersion }
}

/** Busca la slide que mejor coincide con una descripción (títulos y texto). */
export function findSlideByQuery(slides: { position: number; title: string | null; markdown: string }[], query: string): number | null {
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const stop = new Set(['la', 'el', 'de', 'del', 'los', 'las', 'que', 'con', 'una', 'un', 'y', 'a', 'en', 'slide', 'diapositiva', 'volve', 'anda', 'ir', 'por', 'se', 'lo'])
  const terms = norm(query).split(/[^a-z0-9ñ]+/).filter((t) => t.length > 1 && !stop.has(t))
  if (!terms.length) return null
  let best: { position: number; score: number } | null = null
  for (const s of slides) {
    const title = norm(s.title ?? '')
    const body = norm(s.markdown)
    let score = 0
    for (const t of terms) {
      const stem = t.length > 5 ? t.slice(0, -1) : t
      if (title.includes(stem)) score += 3
      else if (body.includes(stem)) score += 1
    }
    if (!best || score > best.score) best = { position: s.position, score }
  }
  return best && best.score > 0 ? best.position : null
}
