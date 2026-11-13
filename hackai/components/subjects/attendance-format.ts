/* Cómo se dicen las clases y los pases al SIU en las pantallas del docente.
   Solo presentación: el estado lo decide Cursada. */
import { longDay, timeOf } from '@/components/dates'
import type { StatusTone } from '@/components/ui/status-pill'
import type { AttendanceError, AttendancePass, NextClass, StudiesReadError } from '@/lib/core/studies'
import { dayKey } from '@/lib/dates'

/** La pantalla de tomar lista de una clase de la comisión. */
export const attendanceHref = (subjectId: string, sectionId: string, classAt: string) =>
  `/materias/${encodeURIComponent(subjectId)}/alumnos/lista?comision=${encodeURIComponent(sectionId)}&clase=${encodeURIComponent(classAt)}`

export const PASS_TEXT: Record<AttendancePass, string> = {
  pendiente: 'Pendiente de pasar al SIU',
  pasado: 'Pasada al SIU',
  'no-permitido': 'Sin pasar al SIU'
}

export const PASS_TONE: Record<AttendancePass, StatusTone> = {
  pendiente: 'warning',
  pasado: 'success',
  'no-permitido': 'neutral'
}

/** Lo que se le dice al docente al guardar la lista, según cómo quedó el pase. */
export const SAVED_TEXT: Record<AttendancePass, string> = {
  pasado: 'Guardamos la lista y la pasamos al SIU.',
  pendiente: 'Guardamos la lista. El SIU no respondió: la pasamos apenas conteste.',
  'no-permitido':
    'Guardamos la lista, pero el SIU no deja cargar la asistencia desde HackAI: los alumnos ven su falta igual.'
}

/** Los errores de tomar lista que se dicen igual en todas las pantallas. Cada pantalla suma cómo dice
    `falla-externa` y `sin-acceso`, que dependen de qué se estaba haciendo. */
export const ATTENDANCE_ERRORS: Record<
  Exclude<AttendanceError | StudiesReadError, 'falla-externa' | 'sin-acceso'>,
  string
> = {
  'persona-desconocida': 'No encontramos tus datos en el SIU. Salí y volvé a entrar.',
  'no-implementado': 'Esta función todavía no está disponible.',
  'clase-inexistente': 'Esa clase no está en el horario de la comisión.',
  'clase-fuera-de-fecha': 'Solo se toma o se corrige la lista de la clase de hoy.',
  'ausente-no-inscripto': 'Hay un alumno que no está inscripto a la comisión.'
}

/** «3 ausentes de 28», «Sin ausentes», «1 ausente de 28». */
export function absentCount(absent: number, total: number): string {
  if (absent === 0) return `Todos presentes (${total})`
  return `${absent} ${absent === 1 ? 'ausente' : 'ausentes'} de ${total}`
}

/** «miércoles 11 de noviembre», para ir en medio de una frase. */
const dayInText = (iso: string) => longDay(iso).toLowerCase()

/** Cuándo es la próxima clase, para el vacío de «Hoy no hay clase»: «La próxima es el miércoles 11 de noviembre, de
    08:00 a 10:00.». Con el período sin empezar, cuándo empieza la cursada. */
export function nextClassText(next: NextClass | null, sectionName: string): string {
  if (!next) return `La comisión ${sectionName} no tiene más clases en este período.`
  const hours = `de ${timeOf(next.classAt)} a ${timeOf(next.endAt)}`
  if (!next.termStartsOn) return `La próxima es el ${dayInText(next.classAt)}, ${hours}.`
  const starts = `La cursada empieza el ${dayInText(`${next.termStartsOn}T12:00:00-03:00`)}`
  if (dayKey(next.classAt) === next.termStartsOn) return `${starts}, con la primera clase ${hours}.`
  return `${starts}. La primera clase es el ${dayInText(next.classAt)}, ${hours}.`
}
