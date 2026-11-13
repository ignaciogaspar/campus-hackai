/* Las pestañas de una materia: Espacio y Tareas (Calificaciones se suma con su
   pantalla). Sin reglas de negocio: solo los enlaces. */
import { tasksHref } from '@/components/coursework/format'
import { spaceHref } from '@/components/spaces/format'

export type SubjectTabKey = 'espacio' | 'tareas'

export type SubjectTab = { key: SubjectTabKey; label: string; href: string; current: boolean }

/** Las pestañas de la materia con la actual marcada. La comisión elegida va solo a Tareas: el Espacio no la usa. */
export function subjectTabs(subjectId: string, current: SubjectTabKey, comision?: string): SubjectTab[] {
  return [
    { key: 'espacio', label: 'Espacio', href: spaceHref(subjectId), current: current === 'espacio' },
    { key: 'tareas', label: 'Tareas', href: tasksHref(subjectId, comision), current: current === 'tareas' }
  ]
}
