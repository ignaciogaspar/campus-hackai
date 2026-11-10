'use server'

import { randomBytes } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { routes } from '@/lib/routes'
import { authoringRoutes } from '@/lib/authoring/routes'
import type { Proposal } from '@/lib/authoring/agent'
import { searchLibrary } from '@/lib/authoring/library'
import type { LibraryFilters, LibraryPage } from '@/lib/authoring/library'
import { applyProposal } from '@/lib/authoring/proposals'
import type { ApplyMode } from '@/lib/authoring/proposals'
import {
  AuthoringError, createDeck, createSlides, deckOrder, duplicateAt, forkInDeck, insertExisting, insertNewSlides, listRevisions,
  loadEditorSlides, moveSlide, removeFromDeck, saveSlide, setDeckOrder, setSessionDeck,
} from '@/lib/authoring/repo'
import type { EditorSlide, RevisionRow } from '@/lib/authoring/repo'
import { notifyDeckChanged } from '@/lib/authoring/server'

export type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string; code?: string }

export interface DeckState {
  slides: EditorSlide[]
  /** Posición a seleccionar después de la operación. */
  position: number
}

async function guard<T extends object>(fn: (personId: string) => Promise<T>): Promise<ActionResult<T>> {
  const session = await requireSession('profesor')
  try {
    return { ok: true, ...(await fn(session.personId)) }
  } catch (err) {
    if (err instanceof AuthoringError) return { ok: false, error: err.message, code: err.code }
    console.error('[autoria]', err)
    return { ok: false, error: (err as Error).message || 'Algo falló' }
  }
}

async function stateOf(deckId: string, position: number): Promise<DeckState> {
  const slides = await loadEditorSlides(db(), deckId)
  return { slides, position: Math.max(0, Math.min(slides.length - 1, position)) }
}

/* ---------- lectura ---------- */

export async function loadDeckState(deckId: string, position = 0): Promise<ActionResult<DeckState>> {
  return guard(() => stateOf(deckId, position))
}

export async function listRevisionsAction(slideId: string): Promise<ActionResult<{ revisions: RevisionRow[] }>> {
  return guard(async () => ({ revisions: await listRevisions(db(), slideId) }))
}

export async function searchLibraryAction(filters: LibraryFilters): Promise<ActionResult<LibraryPage>> {
  return guard(() => searchLibrary(db(), { ...filters, limit: Math.min(filters.limit ?? 40, 100) }))
}

/* ---------- edición de una slide ---------- */

export async function saveSlideAction(input: {
  deckId: string
  position: number
  slideId: string
  markdown: string
  teacherNotes: string | null
  expectedVersion: number
  /** 'all' edita la slide compartida; 'copy' crea una copia solo para este deck. */
  mode: ApplyMode
}): Promise<ActionResult<DeckState>> {
  return guard(async (personId) => {
    if (input.mode === 'copy') {
      await forkInDeck(db(), {
        deckId: input.deckId, position: input.position, slideId: input.slideId, markdown: input.markdown, teacherNotes: input.teacherNotes,
        editorId: personId, via: 'editor',
      })
      await notifyDeckChanged([input.deckId])
    } else {
      await saveSlide(db(), {
        slideId: input.slideId, markdown: input.markdown, teacherNotes: input.teacherNotes, editorId: personId, via: 'editor',
        expectedVersion: input.expectedVersion,
      })
      await notifyDeckChanged([input.deckId], [input.slideId])
    }
    return stateOf(input.deckId, input.position)
  })
}

/* ---------- estructura ---------- */

export async function moveSlideAction(input: { deckId: string; from: number; to: number; slideId: string }): Promise<ActionResult<DeckState>> {
  return guard(async () => {
    await moveSlide(db(), input.deckId, input.from, input.to, input.slideId)
    await notifyDeckChanged([input.deckId])
    return stateOf(input.deckId, input.to)
  })
}

export async function removeSlideAction(input: { deckId: string; position: number; slideId: string }): Promise<ActionResult<DeckState>> {
  return guard(async () => {
    await removeFromDeck(db(), input.deckId, input.position, input.slideId)
    await notifyDeckChanged([input.deckId])
    return stateOf(input.deckId, input.position)
  })
}

export async function duplicateSlideAction(input: { deckId: string; position: number; slideId: string }): Promise<ActionResult<DeckState>> {
  return guard(async (personId) => {
    await duplicateAt(db(), input.deckId, input.position, personId, input.slideId)
    await notifyDeckChanged([input.deckId])
    return stateOf(input.deckId, input.position + 1)
  })
}

const BLANK = '# Título de la slide\n\nTexto de la slide.'

export async function insertBlankAction(input: { deckId: string; afterPosition: number; markdown?: string }): Promise<ActionResult<DeckState>> {
  return guard(async (personId) => {
    const { at } = await insertNewSlides(db(), {
      deckId: input.deckId, afterPosition: input.afterPosition, drafts: [{ markdown: input.markdown?.trim() || BLANK }], authorId: personId, via: 'editor',
    })
    await notifyDeckChanged([input.deckId])
    return stateOf(input.deckId, at)
  })
}

/**
 * Inserta slides de la biblioteca. 'link' usa la MISMA slide (editarla la
 * cambia en todos los decks); 'copy' crea copias propias para este deck.
 */
export async function insertFromLibraryAction(input: {
  deckId: string
  afterPosition: number
  slideIds: string[]
  mode: 'link' | 'copy'
}): Promise<ActionResult<DeckState>> {
  return guard(async (personId) => {
    let ids = input.slideIds
    if (input.mode === 'copy') {
      const { data } = await db().from('slides').select('id, markdown, teacher_notes, tags').in('id', ids)
      const byId = new Map(((data ?? []) as { id: string; markdown: string; teacher_notes: string | null; tags: string[] }[]).map((s) => [s.id, s]))
      const drafts = ids.map((id) => byId.get(id)).filter((s): s is NonNullable<typeof s> => Boolean(s))
      ids = []
      for (const s of drafts) {
        const [id] = await createSlides(db(), {
          drafts: [{ markdown: s.markdown, teacherNotes: s.teacher_notes, tags: s.tags }],
          authorId: personId, via: 'editor', origin: { copiedFrom: s.id, deck: input.deckId },
        })
        ids.push(id)
      }
    }
    const at = await insertExisting(db(), input.deckId, input.afterPosition, ids)
    await notifyDeckChanged([input.deckId])
    return stateOf(input.deckId, at)
  })
}

/* ---------- agente ---------- */

export async function applyProposalAction(input: { deckId: string; proposal: Proposal; mode?: ApplyMode }): Promise<ActionResult<DeckState>> {
  return guard(async (personId) => {
    const r = await applyProposal(db(), input.deckId, input.proposal, { personId, mode: input.mode ?? 'all' })
    const shared = input.proposal.action !== 'insert' && input.mode !== 'copy' ? [input.proposal.slideId] : []
    await notifyDeckChanged([input.deckId], shared)
    return stateOf(input.deckId, r.position)
  })
}

/* ---------- decks ---------- */

/** FormData: title, question?, id?, classSessionId?, slideIds? (coma), copy? ('1' = copias). Redirige al editor. */
export async function createDeckAction(formData: FormData): Promise<void> {
  const session = await requireSession('profesor')
  const title = String(formData.get('title') ?? '').trim()
  if (!title) redirect(`${authoringRoutes.decks}?error=${encodeURIComponent('El deck necesita un título')}`)
  let slideIds = String(formData.get('slideIds') ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  if (slideIds.length && formData.get('copy') === '1') {
    const { data } = await db().from('slides').select('id, markdown, teacher_notes, tags').in('id', slideIds)
    const byId = new Map(((data ?? []) as { id: string; markdown: string; teacher_notes: string | null; tags: string[] }[]).map((s) => [s.id, s]))
    const ordered = slideIds.map((id) => byId.get(id)).filter((s): s is NonNullable<typeof s> => Boolean(s))
    slideIds = await createSlides(db(), {
      drafts: ordered.map((s) => ({ markdown: s.markdown, teacherNotes: s.teacher_notes, tags: s.tags })),
      authorId: session.personId, via: 'editor', origin: { copiedFromLibrary: true },
    })
  }
  const id = await createDeck(db(), {
    id: String(formData.get('id') ?? '') || undefined,
    title,
    question: String(formData.get('question') ?? ''),
    slideIds,
    classSessionId: String(formData.get('classSessionId') ?? '') || null,
  })
  revalidatePath(authoringRoutes.decks)
  redirect(routes.profesorDeck(id))
}

/** FormData: classSessionId, deckId ('' = sin deck). */
export async function setSessionDeckAction(formData: FormData): Promise<void> {
  await requireSession('profesor')
  const classSessionId = String(formData.get('classSessionId') ?? '')
  const deckId = String(formData.get('deckId') ?? '') || null
  if (classSessionId) await setSessionDeck(db(), classSessionId, deckId)
  revalidatePath(authoringRoutes.decks)
  revalidatePath(routes.profesor)
}

/** Título y pregunta del deck. */
export async function updateDeckMetaAction(input: { deckId: string; title: string; question: string | null }): Promise<ActionResult> {
  return guard(async () => {
    const title = input.title.trim()
    if (!title) throw new AuthoringError('El deck necesita un título')
    const { error } = await db().from('decks').update({ title, question: input.question?.trim() || null }).eq('id', input.deckId)
    if (error) throw new Error(error.message)
    await notifyDeckChanged([input.deckId])
    return {}
  })
}

/** Activa (o revoca) el link público del deck. Devuelve el token, o null si quedó privado. */
export async function setDeckPublicAction(input: { deckId: string; public: boolean }): Promise<ActionResult<{ token: string | null }>> {
  return guard(async () => {
    const sb = db()
    if (!input.public) {
      const { error } = await sb.from('decks').update({ public_token: null }).eq('id', input.deckId)
      if (error) throw new Error(error.message)
      return { token: null }
    }
    const { data: row, error: e1 } = await sb.from('decks').select('public_token').eq('id', input.deckId).maybeSingle()
    if (e1) throw new Error(e1.message)
    if (!row) throw new AuthoringError('No existe el deck')
    if (row.public_token) return { token: row.public_token as string }
    const token = randomBytes(12).toString('base64url')
    const { error } = await sb.from('decks').update({ public_token: token }).eq('id', input.deckId)
    if (error) throw new Error(error.message)
    return { token }
  })
}

/** Reemplaza el orden completo (lo usa el reordenamiento por arrastre con varias slides). */
export async function setOrderAction(input: { deckId: string; slideIds: string[]; position: number }): Promise<ActionResult<DeckState>> {
  return guard(async () => {
    const current = await deckOrder(db(), input.deckId)
    const sorted = (a: string[]) => [...a].sort().join(',')
    if (sorted(current) !== sorted(input.slideIds)) throw new AuthoringError('El deck cambió mientras lo editabas: recargá', 'stale')
    await setDeckOrder(db(), input.deckId, input.slideIds, current)
    await notifyDeckChanged([input.deckId])
    return stateOf(input.deckId, input.position)
  })
}
