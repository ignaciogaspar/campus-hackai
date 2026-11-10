/* Aplica una propuesta del agente de autoría que el profesor aceptó.
   Revalida el DSL y ubica la slide por id (el deck pudo cambiar). */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Proposal } from './agent'
import { AuthoringError, checkDraft, deckOrder, forkInDeck, insertNewSlides, saveSlide } from './repo'

export type ApplyMode = 'all' | 'copy'

export interface ApplyResult {
  /** Posición (0-based) a seleccionar en el editor después de aplicar. */
  position: number
  slideIds: string[]
}

/** Ubica una slide en el orden actual: la ocurrencia más cercana a la posición de referencia. */
function locate(order: string[], slideId: string, near: number): number {
  let best = -1
  order.forEach((id, i) => {
    if (id === slideId && (best < 0 || Math.abs(i - near) < Math.abs(best - near))) best = i
  })
  return best
}

export async function applyProposal(sb: SupabaseClient, deckId: string, p: Proposal, opts: { personId: string; mode?: ApplyMode }): Promise<ApplyResult> {
  if (p.action === 'insert') {
    for (const s of p.slides) {
      const issues = checkDraft(s.markdown).issues
      if (issues.length) throw new AuthoringError(`La propuesta tiene avisos: ${issues.join('; ')}`)
    }
    const order = await deckOrder(sb, deckId)
    let after = -1
    if (p.afterSlideId) {
      after = locate(order, p.afterSlideId, p.afterPosition)
      if (after < 0) after = Math.min(order.length - 1, p.afterPosition)
    }
    const { ids, at } = await insertNewSlides(sb, {
      deckId,
      afterPosition: after,
      drafts: p.slides.map((s) => ({ markdown: s.markdown, teacherNotes: s.teacherNotes, tags: [...new Set(['agente', ...s.tags])] })),
      authorId: opts.personId,
      via: 'agent',
    })
    return { position: at, slideIds: ids }
  }

  const order = await deckOrder(sb, deckId)
  const position = locate(order, p.slideId, p.position)
  if (position < 0) throw new AuthoringError('La slide ya no está en este deck', 'not_found')

  if (p.action === 'edit') {
    const issues = checkDraft(p.markdown).issues
    if (issues.length) throw new AuthoringError(`La propuesta tiene avisos: ${issues.join('; ')}`)
    if (opts.mode === 'copy') {
      const id = await forkInDeck(sb, {
        deckId, position, slideId: p.slideId, markdown: p.markdown, teacherNotes: p.teacherNotes, editorId: opts.personId, via: 'agent',
      })
      return { position, slideIds: [id] }
    }
    await saveSlide(sb, {
      slideId: p.slideId, markdown: p.markdown, teacherNotes: p.teacherNotes, editorId: opts.personId, via: 'agent', expectedVersion: p.baseVersion,
    })
    return { position, slideIds: [p.slideId] }
  }

  // notes
  if (opts.mode === 'copy') {
    const { data } = await sb.from('slides').select('markdown').eq('id', p.slideId).single()
    const id = await forkInDeck(sb, {
      deckId, position, slideId: p.slideId, markdown: (data as { markdown: string }).markdown, teacherNotes: p.teacherNotes, editorId: opts.personId, via: 'agent',
    })
    return { position, slideIds: [id] }
  }
  await saveSlide(sb, { slideId: p.slideId, teacherNotes: p.teacherNotes, editorId: opts.personId, via: 'agent', expectedVersion: p.baseVersion })
  return { position, slideIds: [p.slideId] }
}
