/* La pantalla de inicio de cada rol, y a dónde lleva «Volver». Va aparte de
   lib/auth.ts, que es solo de servidor, para poder testearla. */
import type { Role } from '@/lib/core/people'
import { safeReturnTo } from '@/lib/return-to'

/** El alumno entra a sus materias (lo de la semana está en Calendario); el docente, a Hoy, con sus consultas
    sin resolver; secretaría, al Planning que carga. */
export function homeFor(role: Role): string {
  if (role === 'secretaria') return '/planning'
  return role === 'alumno' ? '/materias' : '/hoy'
}

/** A dónde lleva «Volver»: la ruta, lo que lee el lector de pantalla («Volver a Novedades») y lo que se ve al
    lado de la flecha («Novedades»). */
export type Back = { href: string; label: string; short: string }

/** Las secciones a las que se puede volver, por el primer tramo de su ruta, con su nombre en la barra. */
const SECTIONS: Record<string, string> = {
  hoy: 'Hoy',
  novedades: 'Novedades',
  calendario: 'Calendario',
  materias: 'Mis materias',
  notas: 'Notas',
  inscripciones: 'Inscripciones',
  inasistencias: 'Inasistencias',
  estado: 'Plan de estudios',
  tramites: 'Trámites y reportes'
}

function backTo(path: string): Back | null {
  const safe = safeReturnTo(path)
  if (!safe) return null
  const [first, ...rest] = safe.slice(1).split(/[?#]/)[0].split('/')
  if (!Object.hasOwn(SECTIONS, first)) return null
  // Más abajo de /materias/ está el espacio de una materia o una de sus pestañas.
  if (first === 'materias' && rest.some(Boolean)) return { href: safe, label: 'Volver a la materia', short: 'Materia' }
  return { href: safe, label: `Volver a ${SECTIONS[first]}`, short: SECTIONS[first] }
}

/** «Volver» de las pantallas a las que se llega desde varios lados (Novedades, la materia y sus pestañas). El
    origen viaja en `?desde=` como una ruta de la app sin la primera barra: `novedades`, `hoy`, `materias/am1`.
    Lo escribe quien arma el enlace, así que solo vale si es una sección de la app; si falta o no vale, el inicio
    del rol. No se usa el atrás del navegador: en la app instalada no hay, y quien entra por un enlace no tiene
    historial. */
export function backFor(role: Role, desde: unknown): Back {
  const from = typeof desde === 'string' && desde !== '' ? backTo(`/${desde}`) : null
  return from ?? (backTo(homeFor(role)) as Back)
}
