/* Cómo se dicen las clases y los pases al SIU en las pantallas del docente.
   Solo presentación: el estado lo decide Cursada. */
import type { StatusTone } from '@/components/ui/status-pill'
import type { Pase } from '@/lib/core/studies'

/** La pantalla de tomar lista de una clase de la comisión. */
export const attendanceHref = (subjectId: string, sectionId: string, classAt: string) =>
  `/materias/${encodeURIComponent(subjectId)}/alumnos/lista?comision=${encodeURIComponent(sectionId)}&clase=${encodeURIComponent(classAt)}`

export const PASE_TEXT: Record<Pase, string> = {
  pendiente: 'Pendiente de pasar al SIU',
  pasado: 'Pasada al SIU',
  'sin-pasar': 'Sin pasar al SIU'
}

export const PASE_TONE: Record<Pase, StatusTone> = {
  pendiente: 'warning',
  pasado: 'success',
  'sin-pasar': 'neutral'
}

/** Lo que se le dice al docente al guardar la lista, según cómo quedó el pase. */
export const SAVED_TEXT: Record<Pase, string> = {
  pasado: 'Guardamos la lista y la pasamos al SIU.',
  pendiente: 'Guardamos la lista. El SIU no respondió: la pasamos apenas conteste.',
  'sin-pasar':
    'Guardamos la lista, pero el SIU no deja cargar la asistencia desde HackAI: los alumnos ven su falta igual.'
}

/** «3 ausentes de 28», «Sin ausentes», «1 ausente de 28». */
export function absentCount(absent: number, total: number): string {
  if (absent === 0) return `Todos presentes (${total})`
  return `${absent} ${absent === 1 ? 'ausente' : 'ausentes'} de ${total}`
}
