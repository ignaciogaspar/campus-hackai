/* Las secciones de la materia del docente y qué comisión se ve en cada una.
   La comisión va en `?comision=` y se conserva al cambiar de sección. Lógica
   sin pantalla: la usan la barra de pestañas, el selector de comisión y las
   rutas de la materia. Seguimiento suma sus pestañas (Tareas, Calificaciones)
   en SUBJECT_TABS. */

import type { Role } from '@/lib/core/people'

export type SubjectTab = { id: string; label: string; path: string; teachersOnly?: boolean }

/** Por qué no se abre una materia que no es suya: el alumno se inscribe y al docente lo asignan. */
export function noAccessText(role: Role): string {
  return role === 'profesor'
    ? 'No figurás como docente de esta materia. Si te asignaron hace poco, puede tardar un rato en aparecer.'
    : 'No sos parte de esta materia. Si recién te inscribiste, puede tardar un rato en aparecer.'
}

/** Las pestañas de la materia, en orden. `path` cuelga de `/materias/<materia>`. El alumno no ve las de
    `teachersOnly`. */
export const SUBJECT_TABS: SubjectTab[] = [
  { id: 'espacio', label: 'Espacio', path: '' },
  { id: 'alumnos', label: 'Alumnos y clases', path: '/alumnos', teachersOnly: true },
  { id: 'tareas', label: 'Tareas', path: '/tareas' },
  { id: 'calificaciones', label: 'Calificaciones', path: '/calificaciones', teachersOnly: true }
]

/** La pestaña «Alumnos y clases»: ahí se toma lista y se carga el Zoom. */
export const ALUMNOS_TAB: SubjectTab = SUBJECT_TABS.find((t) => t.id === 'alumnos') ?? SUBJECT_TABS[0]

/** Las pestañas que ve cada uno: el docente todas y el alumno, el espacio y las tareas. */
export const tabsFor = (role: Role): SubjectTab[] =>
  SUBJECT_TABS.filter((tab) => role === 'profesor' || !tab.teachersOnly)

/** El enlace a una pestaña de la materia, con la comisión elegida si la hay. */
export function subjectTabHref(subjectId: string, tab: SubjectTab, comision?: string): string {
  const base = `/materias/${encodeURIComponent(subjectId)}${tab.path}`
  return comision ? `${base}?comision=${encodeURIComponent(comision)}` : base
}

type TeachingSection = { sectionId: string; subjectId: string; current: boolean; role: string }

/** Las comisiones vigentes que el docente dicta de la materia, en el orden en que vienen. */
export function teachingSections<T extends TeachingSection>(sections: T[], subjectId: string): T[] {
  return sections.filter((s) => s.subjectId === subjectId && s.current && s.role === 'profesor')
}

/** La comisión pedida en `?comision=` si es una de las del docente; si falta o no es suya, la primera. */
export function chooseSection<T extends { sectionId: string }>(sections: T[], requested?: string): T | null {
  return sections.find((s) => s.sectionId === requested) ?? sections[0] ?? null
}
