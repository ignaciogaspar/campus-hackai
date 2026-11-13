/* Lo que hace secretaría desde la ficha de un alumno en Reportes: marcarlo en
   seguimiento con una nota corta, cambiarle la nota o sacarlo. Quién puede lo
   decide Reportes; estas acciones leen el formulario, llaman al módulo y
   traducen cada error a un mensaje en voseo. Se usan con useActionState. */
'use server'

import { revalidatePath } from 'next/cache'
import type { SpaceActionState } from '@/app/actions/spaces'
import { requireSession } from '@/lib/auth'
import { system } from '@/lib/composition'
import { FOLLOW_UP_NOTE_MAX, type Reports } from '@/lib/core/reports'
import { formText } from '@/lib/form-data'
import type { ErrorOf } from '@/lib/result'

type FollowError = ErrorOf<ReturnType<Reports['follow']>> | ErrorOf<ReturnType<Reports['unfollow']>>

const ERRORS: Record<FollowError, string> = {
  'solo-secretaria': 'Solo secretaría marca alumnos en seguimiento.',
  'alumno-desconocido': 'No encontramos a ese alumno en el padrón.',
  'nota-invalida': `La nota puede tener hasta ${FOLLOW_UP_NOTE_MAX} caracteres.`,
  'persona-desconocida': 'No encontramos tus datos. Salí y volvé a entrar.',
  'falla-externa': 'No pudimos guardarlo porque la base no responde. Probá de nuevo en un rato.'
}

const failed = (message: string, field?: string): SpaceActionState => ({
  status: 'error',
  message,
  at: Date.now(),
  field
})

function refresh(studentId: string) {
  revalidatePath(`/reportes/alumnos/${studentId}`)
  revalidatePath('/reportes/alumnos')
  revalidatePath('/reportes/seguimiento')
}

/** Marca al alumno en seguimiento, o le cambia la nota. */
export async function followStudent(_prev: SpaceActionState, form: FormData): Promise<SpaceActionState> {
  const session = await requireSession('secretaria')
  const studentId = formText(form, 'studentId')
  const result = await system().reports.follow(session.personId, studentId, formText(form, 'note'))
  if (!result.ok) return failed(ERRORS[result.error], result.error === 'nota-invalida' ? 'note' : undefined)
  refresh(studentId)
  return { status: 'ok', message: 'Listo, está en seguimiento.', at: Date.now() }
}

/** Lo saca del seguimiento. */
export async function unfollowStudent(_prev: SpaceActionState, form: FormData): Promise<SpaceActionState> {
  const session = await requireSession('secretaria')
  const studentId = formText(form, 'studentId')
  const result = await system().reports.unfollow(session.personId, studentId)
  if (!result.ok) return failed(ERRORS[result.error])
  refresh(studentId)
  return { status: 'ok', message: 'Listo, ya no está en seguimiento.', at: Date.now() }
}
