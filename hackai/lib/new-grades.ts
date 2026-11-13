/* Las notas nuevas de quien entró, para la campana, la barra lateral, Mis
   materias y Novedades: las del SIU y las publicadas en HackAI que Hoy da como
   nuevas después de la última vez que las vio, según la cookie
   (lib/grades-seen.ts). Como Notas, son solo del alumno: el docente no tiene.
   Si el SIU no responde, no se cuentan las del SIU, y la campana sigue con lo
   de HackAI y lo de los espacios. Solo de servidor. */
import 'server-only'
import { cookies } from 'next/headers'
import { system } from '@/lib/composition'
import type { AssessmentGrade } from '@/lib/core/studies'
import { GRADES_SEEN_COOKIE, seenAtFrom } from '@/lib/grades-seen'
import type { Session } from '@/lib/session-token'

export async function newGradesFor(session: Session): Promise<AssessmentGrade[]> {
  if (session.role !== 'alumno') return []
  const jar = await cookies()
  const seenAt = seenAtFrom(jar.get(GRADES_SEEN_COOKIE)?.value, session.personId)
  const grades = await system().today.newGrades(session.personId, seenAt)
  return grades.ok ? grades.value : []
}
