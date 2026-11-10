import 'server-only'
import { db } from '@/lib/db'
import type { DeckChapter, DeckSource } from './types'

/* Carga de decks desde la DB (server). `slides` es el repositorio único;
   `deck_slides` ordena. Las notas del docente nunca salen con audience 'alumno'. */

export type Audience = 'profesor' | 'alumno'

export interface DeckMeta {
  id: string
  courseId: string | null
  title: string
  question: string | null
  thesis: string | null
  /** Solo con audience 'profesor'. */
  teacherGuide?: string | null
  chapters: DeckChapter[]
  sources: DeckSource[]
  kind: 'native' | 'html'
  htmlUrl: string | null
  htmlSlideCount: number | null
  updatedAt: string
  /** epoch ms de updated_at: el `deckVersion` de los eventos en vivo. */
  version: number
}

export interface DeckSlideEntry {
  /** 0-based */
  position: number
  /** slides.id */
  id: string
  kind: string
  title: string | null
  markdown: string
  /** Solo con audience 'profesor'. */
  teacherNotes?: string | null
  version: number
  tags: string[]
}

export interface LoadedDeck {
  deck: DeckMeta
  slides: DeckSlideEntry[]
}

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
    tags: string[]
  } | null
}

/** Deck por su link público (`decks.public_token`), sin notas del docente. null si no existe o se revocó. */
export async function getPublicDeck(token: string): Promise<LoadedDeck | null> {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return null
  const { data, error } = await db().from('decks').select('id').eq('public_token', token).maybeSingle()
  if (error) throw new Error(`getPublicDeck: ${error.message}`)
  return data ? getDeck(data.id, 'alumno') : null
}

/** Deck con sus slides en orden. null si no existe. */
export async function getDeck(deckId: string, audience: Audience = 'alumno'): Promise<LoadedDeck | null> {
  const client = db()
  const { data: row, error } = await client.from('decks').select('*').eq('id', deckId).maybeSingle()
  if (error) throw new Error(`getDeck ${deckId}: ${error.message}`)
  if (!row) return null
  const teacher = audience === 'profesor'
  const columns = teacher ? 'id, kind, title, markdown, teacher_notes, version, tags' : 'id, kind, title, markdown, version, tags'
  const { data: joined, error: e2 } = await client
    .from('deck_slides')
    .select(`position, slide_id, slides (${columns})`)
    .eq('deck_id', deckId)
    .order('position', { ascending: true })
  if (e2) throw new Error(`getDeck ${deckId} slides: ${e2.message}`)
  const slides: DeckSlideEntry[] = ((joined ?? []) as unknown as JoinedRow[])
    .filter((r) => r.slides)
    .map((r) => {
      const s = r.slides!
      const entry: DeckSlideEntry = {
        position: r.position,
        id: s.id,
        kind: s.kind,
        title: s.title,
        markdown: s.markdown,
        version: s.version,
        tags: s.tags ?? [],
      }
      if (teacher) entry.teacherNotes = s.teacher_notes
      return entry
    })
  const deck: DeckMeta = {
    id: row.id,
    courseId: row.course_id,
    title: row.title,
    question: row.question,
    thesis: row.thesis,
    chapters: (row.chapters ?? []) as DeckChapter[],
    sources: (row.sources ?? []) as DeckSource[],
    kind: row.kind,
    htmlUrl: row.html_url,
    htmlSlideCount: row.html_slide_count,
    updatedAt: row.updated_at,
    version: Date.parse(row.updated_at),
  }
  if (teacher) deck.teacherGuide = row.teacher_guide
  return { deck, slides }
}

export interface DeckSummary {
  id: string
  title: string
  question: string | null
  kind: 'native' | 'html'
  slideCount: number
  updatedAt: string
}

/** Decks de un curso (o todos) con su cantidad de slides. */
export async function listDecks(courseId?: string): Promise<DeckSummary[]> {
  let q = db().from('decks').select('id, title, question, kind, html_slide_count, updated_at, deck_slides(count)').order('id')
  if (courseId) q = q.eq('course_id', courseId)
  const { data, error } = await q
  if (error) throw new Error(`listDecks: ${error.message}`)
  return (data ?? []).map((d) => ({
    id: d.id,
    title: d.title,
    question: d.question,
    kind: d.kind,
    slideCount: d.kind === 'html' ? (d.html_slide_count ?? 0) : ((d.deck_slides as unknown as { count: number }[])?.[0]?.count ?? 0),
    updatedAt: d.updated_at,
  }))
}

/** Versión del deck (epoch ms de decks.updated_at); 0 si no existe. */
export async function getDeckVersion(deckId: string): Promise<number> {
  const { data } = await db().from('decks').select('updated_at').eq('id', deckId).maybeSingle()
  return data ? Date.parse(data.updated_at) : 0
}

/**
 * Marca el deck como cambiado (updated_at = now) y devuelve la nueva versión.
 * Llamalo después de insertar/editar/reordenar slides y antes de emitir `deck.changed`.
 */
export async function touchDeck(deckId: string): Promise<number> {
  const now = new Date().toISOString()
  const { error } = await db().from('decks').update({ updated_at: now }).eq('id', deckId)
  if (error) throw new Error(`touchDeck ${deckId}: ${error.message}`)
  return Date.parse(now)
}
