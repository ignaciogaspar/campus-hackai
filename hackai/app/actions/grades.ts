/* Abrir una materia en Notas marca sus notas nuevas como vistas, así la
   campana baja sin pasar por Novedades. Va en la misma cookie que tocar una
   nota en Novedades (lib/grades-seen.ts): por navegador, sin la base. */
'use server'

import { cookies } from 'next/headers'
import { getSession, setServerCookie } from '@/lib/auth'
import { GRADES_SEEN_COOKIE, GRADES_SEEN_MAX_AGE, gradeKey, withSeen } from '@/lib/grades-seen'
import { newGradesFor } from '@/lib/new-grades'

export async function markSubjectGradesSeen(subjectId: string): Promise<void> {
  // Lo que llega a una server action viene del navegador: el tipo no lo garantiza.
  if (typeof subjectId !== 'string') return
  const session = await getSession()
  if (!session) return
  const keys = (await newGradesFor(session)).filter((g) => g.subjectId === subjectId).map(gradeKey)
  if (keys.length === 0) return
  const current = (await cookies()).get(GRADES_SEEN_COOKIE)?.value
  await setServerCookie(GRADES_SEEN_COOKIE, withSeen(current, session.personId, keys), GRADES_SEEN_MAX_AGE)
}
