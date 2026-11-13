/* El aviso del ingreso cuando se llegó queriendo abrir algo sin sesión: a qué
   pantalla se va a seguir después de elegir a la persona. Solo texto. */

/** El nombre de cada pantalla, como en la navegación, por el primer tramo de su ruta. */
const SCREENS: Record<string, string> = {
  hoy: 'Hoy',
  materias: 'Materias',
  calendario: 'Calendario',
  inscripciones: 'Inscripciones',
  notas: 'Notas',
  academico: 'Notas',
  inasistencias: 'Inasistencias',
  novedades: 'Novedades',
  estado: 'Plan de estudios',
  tramites: 'Trámites y reportes'
}

/** «Entrá para seguir a Notas.», o qué se va a abrir si no es una pantalla de la navegación. */
export function returnNotice(path: string): string {
  const first = path.split(/[/?#]/)[1] ?? ''
  if (first === 'archivos') return 'Entrá para abrir el archivo.'
  const screen = Object.hasOwn(SCREENS, first) ? SCREENS[first] : null
  return screen ? `Entrá para seguir a ${screen}.` : 'Entrá para seguir donde ibas.'
}
