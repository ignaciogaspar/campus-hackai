'use server'
/* Guardar la lista de una clase. Acá se traduce lo que devuelve Cursada a un
   estado que la pantalla sabe mostrar; quién puede tomar lista, que sea la
   clase de hoy y el pase al SIU son de Cursada. */
import { revalidatePath } from 'next/cache'
import type { AttendanceState } from '@/components/subjects/attendance-state'
import { requireSession } from '@/lib/auth'
import { system } from '@/lib/composition'
import type { AttendanceError, StudiesReadError } from '@/lib/core/studies'

const ERRORS: Record<AttendanceError | StudiesReadError, string> = {
  'falla-externa': 'El SIU no respondió y no pudimos guardar la lista. Probá de nuevo en un rato.',
  'persona-desconocida': 'No encontramos tus datos en el SIU. Salí y volvé a entrar.',
  'sin-acceso': 'Solo los docentes de la comisión toman lista.',
  'clase-inexistente': 'Esa clase no está en el horario de la comisión.',
  'clase-fuera-de-fecha': 'Solo se toma o se corrige la lista de la clase de hoy.',
  'ausente-no-inscripto': 'Marcaste a alguien que no está inscripto a la comisión. Volvé a cargar la página.',
  'no-implementado': 'Esta función todavía no está disponible.'
}

const text = (formData: FormData, name: string) => {
  const value = formData.get(name)
  return typeof value === 'string' ? value : ''
}

export async function saveAttendanceAction(_prev: AttendanceState, formData: FormData): Promise<AttendanceState> {
  const session = await requireSession('profesor')
  const sectionId = text(formData, 'comision')
  const classAt = text(formData, 'clase')
  const absent = formData.getAll('ausente').filter((v): v is string => typeof v === 'string')

  const result = await system().studies.takeAttendance(session.personId, sectionId, classAt, absent)
  if (!result.ok) return { kind: 'error', message: ERRORS[result.error] }

  // Las inasistencias del alumno y las clases de la comisión cambiaron.
  revalidatePath('/materias', 'layout')
  revalidatePath('/inasistencias')
  return { kind: 'guardada', pase: result.value.pase, absent: result.value.absent.length }
}
