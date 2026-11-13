/* Las secciones de la materia del docente y qué comisión se ve en cada una.
   La comisión va en `?comision=` y se conserva al cambiar de sección. Lógica
   sin pantalla: la usan la barra de pestañas, el selector de comisión y las
   rutas de la materia. Seguimiento suma sus pestañas (Tareas, Calificaciones)
   en SUBJECT_TABS. */

export type SubjectTab = { id: string; label: string; path: string }

/** Las pestañas de la materia del docente, en orden. `path` cuelga de `/materias/<materia>`. */
export const SUBJECT_TABS: SubjectTab[] = [
  { id: 'espacio', label: 'Espacio', path: '' },
  { id: 'alumnos', label: 'Alumnos y clases', path: '/alumnos' }
]

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
