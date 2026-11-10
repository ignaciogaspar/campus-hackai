/* Biblioteca única de slides: búsqueda (función SQL authoring_search_slides)
   y opciones de filtro. Recibe el cliente supabase (db() o serviceDb()). */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { DeckUse } from './repo'

export interface LibraryFilters {
  q?: string | null
  kind?: string | null
  tag?: string | null
  authorId?: string | null
  deckId?: string | null
  limit?: number
  offset?: number
}

export interface LibrarySlide {
  id: string
  kind: string
  title: string | null
  markdown: string
  teacherNotes: string | null
  tags: string[]
  authorId: string | null
  authorName: string | null
  origin: Record<string, unknown>
  version: number
  updatedAt: string
  decks: DeckUse[]
  rank: number
}

export interface LibraryPage {
  slides: LibrarySlide[]
  total: number
}

interface SearchRow {
  id: string
  kind: string
  title: string | null
  markdown: string
  teacher_notes: string | null
  tags: string[] | null
  author_id: string | null
  author_name: string | null
  origin: Record<string, unknown> | null
  version: number
  updated_at: string
  decks: DeckUse[] | null
  rank: number
  total: number
}

const clean = (v?: string | null) => (v && v.trim() ? v.trim() : null)

export async function searchLibrary(sb: SupabaseClient, f: LibraryFilters = {}): Promise<LibraryPage> {
  const { data, error } = await sb.rpc('authoring_search_slides', {
    p_q: clean(f.q),
    p_kind: clean(f.kind),
    p_tag: clean(f.tag),
    p_author: clean(f.authorId),
    p_deck: clean(f.deckId),
    p_limit: f.limit ?? 60,
    p_offset: f.offset ?? 0,
  })
  if (error) throw new Error(`buscar en la biblioteca: ${error.message}`)
  const rows = (data ?? []) as SearchRow[]
  return {
    total: rows[0] ? Number(rows[0].total) : 0,
    slides: rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      title: r.title,
      markdown: r.markdown,
      teacherNotes: r.teacher_notes,
      tags: r.tags ?? [],
      authorId: r.author_id,
      authorName: r.author_name,
      origin: r.origin ?? {},
      version: r.version,
      updatedAt: r.updated_at,
      decks: r.decks ?? [],
      rank: r.rank,
    })),
  }
}

export interface LibraryFacets {
  kinds: { kind: string; count: number }[]
  tags: { tag: string; count: number }[]
  authors: { id: string; name: string }[]
  decks: { id: string; title: string }[]
}

/** Valores para los filtros de la biblioteca. */
export async function libraryFacets(sb: SupabaseClient): Promise<LibraryFacets> {
  const [slides, people, decks] = await Promise.all([
    sb.from('slides').select('kind, tags, author_id'),
    sb.from('people').select('id, full_name').eq('role', 'profesor').order('full_name'),
    sb.from('decks').select('id, title').order('id'),
  ])
  if (slides.error) throw new Error(`facetas: ${slides.error.message}`)
  const kinds = new Map<string, number>()
  const tags = new Map<string, number>()
  const authorIds = new Set<string>()
  for (const s of (slides.data ?? []) as { kind: string; tags: string[] | null; author_id: string | null }[]) {
    kinds.set(s.kind, (kinds.get(s.kind) ?? 0) + 1)
    for (const t of s.tags ?? []) tags.set(t, (tags.get(t) ?? 0) + 1)
    if (s.author_id) authorIds.add(s.author_id)
  }
  const authors = ((people.data ?? []) as { id: string; full_name: string }[]).map((p) => ({ id: p.id, name: p.full_name }))
  return {
    kinds: [...kinds].map(([kind, count]) => ({ kind, count })).sort((a, b) => b.count - a.count),
    tags: [...tags].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag)),
    authors,
    decks: ((decks.data ?? []) as { id: string; title: string }[]),
  }
}
