/* ============================================================
   Repositorio único de slides: operaciones de autoría sobre la DB.
   Sin 'server-only' para poder usarlo desde scripts con tsx: cada
   función recibe el cliente supabase (db() en Next, serviceDb() en
   scripts). En Next se llama SOLO desde server actions / route handlers.
   ============================================================ */

import type { SupabaseClient } from '@supabase/supabase-js'
import { parseSlide, slideIssues, slideTitle } from '@/lib/decks/parse'
import { SLIDE_TYPES } from '@/lib/decks/types'
import { DIAGRAM_IDS } from './dsl-guide'

export type RevisionVia = 'editor' | 'agent' | 'import' | 'mcp'

export interface DeckUse {
  deckId: string
  position: number
}

export interface EditorSlide {
  /** 0-based */
  position: number
  id: string
  kind: string
  title: string | null
  markdown: string
  teacherNotes: string | null
  version: number
  tags: string[]
  authorId: string | null
  /** Todos los lugares donde se usa la slide (incluido este deck). */
  usedIn: DeckUse[]
}

export interface SlideDraft {
  markdown: string
  teacherNotes?: string | null
  tags?: string[]
}

export interface DraftCheck {
  kind: string
  title: string
  issues: string[]
}

export class AuthoringError extends Error {
  constructor(message: string, readonly code: 'conflict' | 'not_found' | 'invalid' | 'stale' = 'invalid') {
    super(message)
  }
}

function check<T>(res: { data: T; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`)
  return res.data
}

/** Valida un bloque DSL: tipo efectivo, título y avisos de slideIssues. */
export function checkDraft(markdown: string): DraftCheck {
  const parsed = parseSlide(markdown)
  const issues = [...slideIssues(parsed)]
  const trimmed = markdown.trim()
  if (!trimmed) issues.push('la slide está vacía')
  if (/\n---\n/.test(`\n${trimmed}\n`)) issues.push('contiene un separador `---`: es más de una slide')
  const directive = trimmed.match(/^:::([a-z][a-z-]*)/)?.[1]
  if (directive && !(SLIDE_TYPES as readonly string[]).includes(directive)) {
    issues.push(`tipo desconocido :::${directive}: se renderiza como default`)
  }
  if (parsed.type === 'diagram' && !parsed.arg) issues.push(':::diagram sin id de diagrama')
  if (parsed.type === 'diagram' && parsed.arg && !(DIAGRAM_IDS as readonly string[]).includes(parsed.arg)) {
    issues.push(`:::diagram ${parsed.arg}: no existe ese diagrama (válidos: ${DIAGRAM_IDS.join(', ')})`)
  }
  return { kind: parsed.type, title: slideTitle(parsed), issues }
}

/* ---------- lectura ---------- */

interface JoinedRow {
  position: number
  slide_id: string
  slides: {
    id: string
    kind: string
    title: string | null
    markdown: string
    teacher_notes: string | null
    version: number
    tags: string[] | null
    author_id: string | null
  } | null
}

/** Usos de un conjunto de slides en todos los decks. */
export async function usageOf(sb: SupabaseClient, slideIds: string[]): Promise<Map<string, DeckUse[]>> {
  const out = new Map<string, DeckUse[]>()
  if (slideIds.length === 0) return out
  const unique = [...new Set(slideIds)]
  for (let i = 0; i < unique.length; i += 200) {
    const rows = check(await sb.from('deck_slides').select('deck_id, position, slide_id').in('slide_id', unique.slice(i, i + 200)), 'usos de slides') as
      { deck_id: string; position: number; slide_id: string }[]
    for (const r of rows ?? []) {
      const list = out.get(r.slide_id) ?? []
      list.push({ deckId: r.deck_id, position: r.position })
      out.set(r.slide_id, list)
    }
  }
  for (const list of out.values()) list.sort((a, b) => a.deckId.localeCompare(b.deckId) || a.position - b.position)
  return out
}

/** Slides de un deck en orden, con notas del docente y usos. */
export async function loadEditorSlides(sb: SupabaseClient, deckId: string): Promise<EditorSlide[]> {
  const rows = check(await sb
    .from('deck_slides')
    .select('position, slide_id, slides (id, kind, title, markdown, teacher_notes, version, tags, author_id)')
    .eq('deck_id', deckId)
    .order('position', { ascending: true }), `slides de ${deckId}`) as unknown as JoinedRow[]
  const valid = (rows ?? []).filter((r) => r.slides)
  const usage = await usageOf(sb, valid.map((r) => r.slide_id))
  return valid.map((r) => {
    const s = r.slides!
    return {
      position: r.position,
      id: s.id,
      kind: s.kind,
      title: s.title,
      markdown: s.markdown,
      teacherNotes: s.teacher_notes,
      version: s.version,
      tags: s.tags ?? [],
      authorId: s.author_id,
      usedIn: usage.get(s.id) ?? [],
    }
  })
}

/** Ids de slides del deck en orden. */
export async function deckOrder(sb: SupabaseClient, deckId: string): Promise<string[]> {
  const rows = check(await sb.from('deck_slides').select('position, slide_id').eq('deck_id', deckId).order('position'), `orden de ${deckId}`) as
    { position: number; slide_id: string }[]
  return (rows ?? []).map((r) => r.slide_id)
}

/**
 * Reescribe el orden completo (atómico, vía authoring_set_deck_order, con lock
 * del deck). También toca decks.updated_at, corre las posiciones de marcas y
 * notas y recalcula current_position de las clases vivas del deck.
 * `expected`: el orden leído antes de modificarlo. Si otro (el agente en vivo,
 * otro profesor) lo cambió en el medio, falla con AuthoringError 'stale'.
 */
export async function setDeckOrder(sb: SupabaseClient, deckId: string, slideIds: string[], expected?: string[]): Promise<void> {
  const res = await sb.rpc('authoring_set_deck_order', { p_deck: deckId, p_slides: slideIds, p_expected: expected ?? null })
  if (res.error && /deck_order_conflict/.test(res.error.message)) throw new AuthoringError('El deck cambió mientras editabas: recargá', 'stale')
  check(res, `reordenar ${deckId}`)
}

/** Versión del deck (epoch ms de decks.updated_at). */
export async function deckVersion(sb: SupabaseClient, deckId: string): Promise<number> {
  const row = check(await sb.from('decks').select('updated_at').eq('id', deckId).maybeSingle(), 'versión del deck') as { updated_at: string } | null
  return row ? Date.parse(row.updated_at) : 0
}

export async function touchDeckWith(sb: SupabaseClient, deckId: string): Promise<number> {
  const now = new Date().toISOString()
  check(await sb.from('decks').update({ updated_at: now }).eq('id', deckId), 'tocar deck')
  return Date.parse(now)
}

/** Verifica que en `position` siga estando `slideId` (evita operar sobre un estado viejo). */
function expectAt(order: string[], position: number, slideId?: string) {
  if (position < 0 || position >= order.length) throw new AuthoringError(`No hay slide en la posición ${position + 1}`, 'not_found')
  if (slideId && order[position] !== slideId) throw new AuthoringError('El deck cambió mientras editabas: recargá', 'stale')
}

/* ---------- estructura del deck ---------- */

export async function moveSlide(sb: SupabaseClient, deckId: string, from: number, to: number, slideId?: string): Promise<void> {
  const order = await deckOrder(sb, deckId)
  const read = [...order]
  expectAt(order, from, slideId)
  const target = Math.max(0, Math.min(order.length - 1, to))
  if (target === from) return
  const [id] = order.splice(from, 1)
  order.splice(target, 0, id)
  await setDeckOrder(sb, deckId, order, read)
}

/** Quita la slide del deck. La slide sigue en el repositorio. */
export async function removeFromDeck(sb: SupabaseClient, deckId: string, position: number, slideId?: string): Promise<void> {
  const order = await deckOrder(sb, deckId)
  const read = [...order]
  expectAt(order, position, slideId)
  order.splice(position, 1)
  await setDeckOrder(sb, deckId, order, read)
}

/** Inserta slides existentes del repositorio después de `afterPosition` (-1 = al principio). */
export async function insertExisting(sb: SupabaseClient, deckId: string, afterPosition: number, slideIds: string[]): Promise<number> {
  if (slideIds.length === 0) return afterPosition + 1
  const found = check(await sb.from('slides').select('id').in('id', slideIds), 'slides a insertar') as { id: string }[]
  const known = new Set((found ?? []).map((r) => r.id))
  const missing = slideIds.filter((id) => !known.has(id))
  if (missing.length) throw new AuthoringError(`No existen en la biblioteca: ${missing.join(', ')}`, 'not_found')
  const order = await deckOrder(sb, deckId)
  const read = [...order]
  const at = Math.max(0, Math.min(order.length, afterPosition + 1))
  order.splice(at, 0, ...slideIds)
  await setDeckOrder(sb, deckId, order, read)
  return at
}

interface NewSlideRow {
  id: string
}

/** Crea slides nuevas en el repositorio (con su primera revisión) y devuelve sus ids. */
export async function createSlides(sb: SupabaseClient, opts: {
  drafts: SlideDraft[]
  authorId: string | null
  via: RevisionVia
  origin?: Record<string, unknown>
  courseId?: string | null
}): Promise<string[]> {
  const rows = opts.drafts.map((d) => {
    const c = checkDraft(d.markdown)
    return {
      course_id: opts.courseId ?? 'ai-centric-management',
      kind: c.kind,
      title: c.title,
      markdown: d.markdown.trim(),
      teacher_notes: d.teacherNotes?.trim() || null,
      tags: d.tags ?? [],
      author_id: opts.authorId,
      origin: opts.origin ?? {},
    }
  })
  if (rows.length === 0) return []
  const created = check(await sb.from('slides').insert(rows).select('id'), 'crear slides') as NewSlideRow[]
  const ids = created.map((r) => r.id)
  check(await sb.from('slide_revisions').insert(ids.map((id, i) => ({
    slide_id: id,
    markdown: rows[i].markdown,
    teacher_notes: rows[i].teacher_notes,
    edited_by: opts.authorId,
    via: opts.via,
  }))), 'revisiones iniciales')
  return ids
}

/** Crea slides nuevas y las inserta en el deck después de `afterPosition`. Devuelve ids y posición de la primera. */
export async function insertNewSlides(sb: SupabaseClient, opts: {
  deckId: string
  afterPosition: number
  drafts: SlideDraft[]
  authorId: string | null
  via: RevisionVia
}): Promise<{ ids: string[]; at: number }> {
  const origin = opts.via === 'agent' ? { agent: true, deck: opts.deckId } : { deck: opts.deckId, editor: true }
  const ids = await createSlides(sb, { drafts: opts.drafts, authorId: opts.authorId, via: opts.via, origin })
  const at = await insertExisting(sb, opts.deckId, opts.afterPosition, ids)
  return { ids, at }
}

/** Duplica la slide de `position` como slide nueva (copia en el repositorio) justo después. */
export async function duplicateAt(sb: SupabaseClient, deckId: string, position: number, authorId: string | null, slideId?: string): Promise<string> {
  const order = await deckOrder(sb, deckId)
  const read = [...order]
  expectAt(order, position, slideId)
  const src = check(await sb.from('slides').select('markdown, teacher_notes, tags, course_id').eq('id', order[position]).single(), 'slide a duplicar') as
    { markdown: string; teacher_notes: string | null; tags: string[]; course_id: string | null }
  const [id] = await createSlides(sb, {
    drafts: [{ markdown: src.markdown, teacherNotes: src.teacher_notes, tags: src.tags }],
    authorId,
    via: 'editor',
    origin: { copiedFrom: order[position], deck: deckId },
    courseId: src.course_id,
  })
  order.splice(position + 1, 0, id)
  await setDeckOrder(sb, deckId, order, read)
  return id
}

/* ---------- edición de una slide ---------- */

export interface SlideRecord {
  id: string
  kind: string
  title: string | null
  markdown: string
  teacher_notes: string | null
  tags: string[]
  version: number
  author_id: string | null
  origin: Record<string, unknown>
  course_id: string | null
}

export async function getSlide(sb: SupabaseClient, slideId: string): Promise<SlideRecord | null> {
  return check(await sb.from('slides')
    .select('id, kind, title, markdown, teacher_notes, tags, version, author_id, origin, course_id')
    .eq('id', slideId).maybeSingle(), 'slide') as SlideRecord | null
}

/**
 * Guarda una edición: version+1 y una fila en slide_revisions. Si la slide no
 * tenía revisiones, guarda antes la versión vigente como base ('import').
 * `expectedVersion` evita pisar una edición ajena (AuthoringError 'conflict').
 */
export async function saveSlide(sb: SupabaseClient, opts: {
  slideId: string
  markdown?: string
  teacherNotes?: string | null
  tags?: string[]
  editorId: string | null
  via: RevisionVia
  expectedVersion?: number
}): Promise<SlideRecord> {
  const cur = await getSlide(sb, opts.slideId)
  if (!cur) throw new AuthoringError('La slide no existe', 'not_found')
  if (opts.expectedVersion !== undefined && cur.version !== opts.expectedVersion) {
    throw new AuthoringError(`La slide cambió (versión ${cur.version}, editabas la ${opts.expectedVersion}). Recargá antes de guardar.`, 'conflict')
  }
  const markdown = opts.markdown !== undefined ? opts.markdown.trim() : cur.markdown
  const teacherNotes = opts.teacherNotes !== undefined ? (opts.teacherNotes?.trim() || null) : cur.teacher_notes
  if (!markdown) throw new AuthoringError('La slide no puede quedar vacía')
  const c = checkDraft(markdown)

  const { count } = await sb.from('slide_revisions').select('id', { count: 'exact', head: true }).eq('slide_id', cur.id)
  if (!count) {
    check(await sb.from('slide_revisions').insert({
      slide_id: cur.id, markdown: cur.markdown, teacher_notes: cur.teacher_notes, edited_by: cur.author_id, via: 'import',
      created_at: new Date(Date.now() - 1000).toISOString(),
    }), 'revisión base')
  }

  const updated = check(await sb.from('slides').update({
    markdown,
    teacher_notes: teacherNotes,
    tags: opts.tags ?? cur.tags,
    kind: c.kind,
    title: c.title,
    version: cur.version + 1,
    updated_at: new Date().toISOString(),
  }).eq('id', cur.id).eq('version', cur.version)
    .select('id, kind, title, markdown, teacher_notes, tags, version, author_id, origin, course_id'), 'guardar slide') as SlideRecord[]
  if (!updated?.length) throw new AuthoringError('Otra persona guardó esta slide recién. Recargá antes de guardar.', 'conflict')

  check(await sb.from('slide_revisions').insert({
    slide_id: cur.id, markdown, teacher_notes: teacherNotes, edited_by: opts.editorId, via: opts.via,
  }), 'revisión')
  return updated[0]
}

/**
 * "Crear copia para este deck": crea una slide nueva con el contenido editado
 * y la pone en lugar de la original SOLO en este deck.
 */
export async function forkInDeck(sb: SupabaseClient, opts: {
  deckId: string
  position: number
  slideId: string
  markdown: string
  teacherNotes?: string | null
  editorId: string | null
  via: RevisionVia
}): Promise<string> {
  const order = await deckOrder(sb, opts.deckId)
  const read = [...order]
  expectAt(order, opts.position, opts.slideId)
  const src = await getSlide(sb, opts.slideId)
  if (!src) throw new AuthoringError('La slide no existe', 'not_found')
  const [id] = await createSlides(sb, {
    drafts: [{ markdown: opts.markdown, teacherNotes: opts.teacherNotes === undefined ? src.teacher_notes : opts.teacherNotes, tags: src.tags }],
    authorId: opts.editorId,
    via: opts.via,
    origin: { forkedFrom: src.id, forkedVersion: src.version, deck: opts.deckId },
    courseId: src.course_id,
  })
  order[opts.position] = id
  await setDeckOrder(sb, opts.deckId, order, read)
  return id
}

export interface RevisionRow {
  id: number
  markdown: string
  teacherNotes: string | null
  via: RevisionVia
  createdAt: string
  editedBy: string | null
  editorName: string | null
}

export async function listRevisions(sb: SupabaseClient, slideId: string, limit = 50): Promise<RevisionRow[]> {
  const rows = check(await sb.from('slide_revisions')
    .select('id, markdown, teacher_notes, via, created_at, edited_by, people:edited_by (full_name)')
    .eq('slide_id', slideId).order('id', { ascending: false }).limit(limit), 'revisiones') as unknown as {
      id: number; markdown: string; teacher_notes: string | null; via: RevisionVia; created_at: string; edited_by: string | null
      people: { full_name: string } | null
    }[]
  return (rows ?? []).map((r) => ({
    id: r.id,
    markdown: r.markdown,
    teacherNotes: r.teacher_notes,
    via: r.via,
    createdAt: r.created_at,
    editedBy: r.edited_by,
    editorName: r.people?.full_name ?? null,
  }))
}

/* ---------- decks ---------- */

export function slugify(text: string): string {
  return text
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'deck'
}

export async function createDeck(sb: SupabaseClient, opts: {
  id?: string
  title: string
  question?: string | null
  courseId?: string | null
  slideIds?: string[]
  classSessionId?: string | null
}): Promise<string> {
  const title = opts.title.trim()
  if (!title) throw new AuthoringError('El deck necesita un título')
  let id = slugify(opts.id?.trim() || title)
  const { data: taken } = await sb.from('decks').select('id').like('id', `${id}%`)
  const used = new Set((taken ?? []).map((r: { id: string }) => r.id))
  if (used.has(id)) {
    let n = 2
    while (used.has(`${id}-${n}`)) n++
    id = `${id}-${n}`
  }
  check(await sb.from('decks').insert({
    id,
    course_id: opts.courseId ?? 'ai-centric-management',
    title,
    question: opts.question?.trim() || null,
    kind: 'native',
  }), 'crear deck')
  if (opts.slideIds?.length) await setDeckOrder(sb, id, opts.slideIds)
  if (opts.classSessionId) await setSessionDeck(sb, opts.classSessionId, id)
  return id
}

/** Asocia un deck a una jornada (class_sessions.deck_id). null lo desasocia. */
export async function setSessionDeck(sb: SupabaseClient, classSessionId: string, deckId: string | null): Promise<void> {
  check(await sb.from('class_sessions').update({ deck_id: deckId }).eq('id', classSessionId), 'asociar jornada')
}
