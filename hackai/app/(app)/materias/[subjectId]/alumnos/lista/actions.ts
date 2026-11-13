'use server'
/* Guardar la lista de una clase. Acá se traduce lo que devuelve Cursada a un
   estado que la pantalla sabe mostrar; quién puede tomar lista, que sea la
   clase de hoy y el pase al SIU son de Cursada. */
import { revalidatePath } from 'next/cache'
import { ATTENDANCE_ERRORS } from '@/components/subjects/attendance-format'
import type { AttendanceState } from '@/components/subjects/attendance-state'
import { requireSession } from '@/lib/auth'
import { system } from '@/lib/composition'
import type { AttendanceError, StudiesReadError } from '@/lib/core/studies'
import { formText } from '@/lib/form-data'

const ERRORS: Record<AttendanceError | StudiesReadError, string> = {
  ...ATTENDANCE_ERRORS,
  'falla-externa': 'El SIU no respondió y no pudimos guardar la lista. Probá de nuevo en un rato.',
  'sin-acceso': 'Solo los docentes de la comisión toman lista.',
  'ausente-no-inscripto': 'Marcaste a alguien que no está inscripto a la comisión. Volvé a cargar la página.'
}

export async function saveAttendanceAction(_prev: AttendanceState, formData: FormData): Promise<AttendanceState> {
  const session = await requireSession('profesor')
  const sectionId = formText(formData, 'comision')
  const classAt = formText(formData, 'clase')
  const absent = formData.getAll('ausente').filter((v): v is string => typeof v === 'string')

  const result = await system().studies.takeAttendance(session.personId, sectionId, classAt, absent)
  if (!result.ok) return { kind: 'error', message: ERRORS[result.error] }

  // Las inasistencias del alumno y las clases de la comisión cambiaron.
  revalidatePath('/materias', 'layout')
  revalidatePath('/inasistencias')
  return { kind: 'guardada', pass: result.value.pass, absent: result.value.absent.length }
}
