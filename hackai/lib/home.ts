/* La pantalla de inicio de cada rol. Va aparte de lib/auth.ts, que es solo de
   servidor, para poder testearla. */
import type { Role } from '@/lib/core/people'

/** El alumno entra a sus materias (lo de la semana está en Calendario); el docente, a Hoy, con sus consultas
    sin resolver. */
export function homeFor(role: Role): string {
  return role === 'alumno' ? '/materias' : '/hoy'
}
