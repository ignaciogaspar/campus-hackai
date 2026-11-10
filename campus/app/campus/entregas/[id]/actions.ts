'use server'

import { revalidatePath } from 'next/cache'
import type { ActionState } from '@/components/assignments/action-state'
import { requireSession } from '@/lib/auth'
import { AssignmentError, savePeerReview, saveSubmission } from '@/lib/assignments/store'
import { routes } from '@/lib/routes'

function fail(e: unknown): ActionState {
  if (e instanceof AssignmentError) return { error: e.message, at: Date.now() }
  console.error('[entregas]', e)
  return { error: 'No se pudo guardar. Probá de nuevo.', at: Date.now() }
}

function scoresFrom(form: FormData): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of form.entries()) if (k.startsWith('score:') && typeof v === 'string') out[k.slice(6)] = v
  return out
}

/** Entregar o editar la entrega propia. FormData: assignmentId, bodyMd, url. */
export async function submitWork(_prev: ActionState, form: FormData): Promise<ActionState> {
  const session = await requireSession('alumno')
  const assignmentId = String(form.get('assignmentId') ?? '')
  try {
    await saveSubmission({ assignmentId, personId: session.personId, bodyMd: String(form.get('bodyMd') ?? ''), url: String(form.get('url') ?? '') })
  } catch (e) {
    return fail(e)
  }
  revalidatePath(routes.campusEntrega(assignmentId))
  revalidatePath(routes.campus)
  return { ok: 'Listo, tu entrega quedó guardada.', at: Date.now() }
}

/** Enviar (o corregir) una revisión entre pares. FormData: assignmentId, reviewId, score:<criterio>, comment. */
export async function submitPeerReview(_prev: ActionState, form: FormData): Promise<ActionState> {
  const session = await requireSession('alumno')
  const assignmentId = String(form.get('assignmentId') ?? '')
  try {
    await savePeerReview({
      reviewId: String(form.get('reviewId') ?? ''),
      reviewerId: session.personId,
      scores: scoresFrom(form),
      comment: String(form.get('comment') ?? ''),
    })
  } catch (e) {
    return fail(e)
  }
  revalidatePath(routes.campusEntrega(assignmentId))
  revalidatePath(routes.campus)
  return { ok: 'Gracias: tu revisión quedó enviada. Podés corregirla mientras siga abierta la revisión.', at: Date.now() }
}
