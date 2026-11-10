'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { bumpSessionVersion, requireSession } from '@/lib/auth'
import { db, COURSE_ID } from '@/lib/db'
import { throttleClear } from '@/lib/security'

/**
 * Resetea el PIN de un alumno: borra pin_hash, revoca sus sesiones abiertas
 * (sube session_version, lo que además genera un código inicial nuevo) y
 * levanta el bloqueo por intentos fallidos. FormData: personId.
 */
export async function resetPinAction(form: FormData): Promise<void> {
  await requireSession('profesor')
  const personId = String(form.get('personId') ?? '')
  if (!/^[0-9a-f-]{36}$/i.test(personId)) redirect('/profesor/alumnos?error=Alumno%20inv%C3%A1lido')
  const { data } = await db().from('people').select('id, full_name').eq('id', personId).eq('course_id', COURSE_ID).eq('role', 'alumno').maybeSingle()
  if (!data) redirect('/profesor/alumnos?error=No%20encontr%C3%A9%20a%20ese%20alumno')
  await db().from('people').update({ pin_hash: null }).eq('id', personId)
  await bumpSessionVersion(personId)
  await throttleClear(`pin:${personId}`)
  revalidatePath('/profesor/alumnos')
  redirect(`/profesor/alumnos?aviso=${encodeURIComponent(`PIN de ${data.full_name} reseteado: dale su código inicial nuevo.`)}`)
}
