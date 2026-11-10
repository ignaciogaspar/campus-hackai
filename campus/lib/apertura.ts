/* Hasta la primera jornada el campus del alumno muestra solo la bienvenida
   (/bienvenida): todo /campus/... redirige ahí (middleware.ts). Se abre solo a
   la hora de inicio de la jornada 1; CAMPUS_ABRE (ISO) lo adelanta o atrasa
   sin tocar código. Las pantallas del profesor no se bloquean. */

export const CAMPUS_ABRE_DEFAULT = '2026-11-12T18:30:00-03:00'

export function campusAbre(): Date {
  const env = process.env.CAMPUS_ABRE
  const d = new Date(env && !Number.isNaN(Date.parse(env)) ? env : CAMPUS_ABRE_DEFAULT)
  return d
}

export function campusAbierto(now = new Date()): boolean {
  return now.getTime() >= campusAbre().getTime()
}
