'use server'

import { revalidatePath } from 'next/cache'
import { requireSession } from '@/lib/auth'
import { learningStore, LearningError } from './store'
import { publicationTime } from './core'
import type { LearningActionState } from './types'

const value = (form: FormData, key: string) => String(form.get(key) ?? '').trim()
function revision(form: FormData) {
  const n = Number(value(form, 'revision'))
  if (!Number.isSafeInteger(n) || n < 0) throw new LearningError('La versión del formulario no es válida. Recargá la página.')
  return n
}
function refresh() {
  revalidatePath('/campus')
  revalidatePath('/campus/aprendizaje')
  revalidatePath('/campus/jornadas/[n]', 'page')
  revalidatePath('/profesor/devoluciones')
}
function failure(error: unknown): LearningActionState {
  if (error instanceof LearningError) return { error: error.message }
  console.error('[learning]', error instanceof Error ? error.message : 'Error de persistencia')
  return { error: 'No pudimos guardar los cambios. Tu texto sigue en el formulario; probá de nuevo.' }
}

export async function saveReflectionAction(_: LearningActionState, form: FormData): Promise<LearningActionState> {
  const session = await requireSession('alumno')
  try {
    const next = await learningStore().saveReflection(session.personId, value(form, 'sessionId'), revision(form), {
      takeaway: value(form, 'takeaway'), unclear: value(form, 'unclear'), application: value(form, 'application'),
    })
    refresh()
    return { ok: 'Reflexión guardada. Podés volver a editarla.', revision: next }
  } catch (error) { return failure(error) }
}

export async function saveFeedbackAction(_: LearningActionState, form: FormData): Promise<LearningActionState> {
  const session = await requireSession('profesor')
  try {
    const intent = value(form, 'intent')
    if (!['draft', 'publish', 'schedule'].includes(intent)) throw new LearningError('Elegí guardar, publicar o programar.')
    const scheduled = value(form, 'publishAt')
    const publishAt = intent === 'draft' ? null : publicationTime(intent === 'schedule' ? scheduled : '')
    if (intent === 'schedule' && !scheduled) throw new LearningError('Elegí una fecha y hora de Buenos Aires para programar.')
    if (intent !== 'draft' && !publishAt) throw new LearningError('Elegí una fecha y hora futura válida.')
    const next = await learningStore().saveFeedback(session.personId, value(form, 'personId'), value(form, 'sessionId'), revision(form), {
      body: value(form, 'body'), label: value(form, 'label'), href: value(form, 'href'),
    }, publishAt)
    refresh()
    return { ok: intent === 'draft' ? 'Borrador guardado. La versión publicada no cambió.' : intent === 'schedule' ? 'Devolución programada.' : 'Devolución publicada.', revision: next }
  } catch (error) { return failure(error) }
}

export async function acknowledgeAction(_: LearningActionState, form: FormData): Promise<LearningActionState> {
  const session = await requireSession('alumno')
  try {
    const kind = value(form, 'kind')
    if (kind !== 'read' && kind !== 'applied') throw new LearningError('La acción no es válida.')
    await learningStore().acknowledge(session.personId, value(form, 'sessionId'), value(form, 'publicationId'), kind)
    refresh()
    return { ok: kind === 'read' ? 'Marcada como leída. El mensaje queda en tu historial.' : 'Registramos que aplicaste el próximo paso.' }
  } catch (error) { return failure(error) }
}
