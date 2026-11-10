'use server'

import { revalidatePath } from 'next/cache'
import type { ActionState } from '@/components/assignments/action-state'
import { requireSession } from '@/lib/auth'
import { AssignmentError, saveTeacherReview } from '@/lib/assignments/store'
import { ENTREGABLE_IDS } from '@/lib/organizacion/entregables'
import { routes } from '@/lib/routes'

/** Devolución docente de un entregable desde el portfolio. FormData: personId, assignmentId, submissionId, score:<criterio>, comment. */
export async function submitDevolucion(_prev: ActionState, form: FormData): Promise<ActionState> {
  const session = await requireSession('profesor')
  const personId = String(form.get('personId') ?? '')
  const assignmentId = String(form.get('assignmentId') ?? '')
  if (!ENTREGABLE_IDS.includes(assignmentId)) return { error: 'Entregable desconocido.', at: Date.now() }
  const scores: Record<string, string> = {}
  for (const [k, v] of form.entries()) if (k.startsWith('score:') && typeof v === 'string') scores[k.slice(6)] = v
  try {
    await saveTeacherReview({ submissionId: String(form.get('submissionId') ?? ''), teacherId: session.personId, scores, comment: String(form.get('comment') ?? '') })
  } catch (e) {
    if (e instanceof AssignmentError) return { error: e.message, at: Date.now() }
    console.error('[profesor/organizaciones]', e)
    return { error: 'No se pudo guardar la devolución.', at: Date.now() }
  }
  revalidatePath(`/profesor/organizaciones/${personId}`)
  revalidatePath('/profesor/organizaciones')
  revalidatePath(routes.profesorEntrega(assignmentId))
  revalidatePath('/campus/organizacion')
  return { ok: 'Devolución guardada. El alumno ya la ve en su portfolio.', at: Date.now() }
}
