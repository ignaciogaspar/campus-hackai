/* Reloj fijo: siempre devuelve la misma fecha. Es el reloj de los tests y el
   que se usa sin configurar; la demo usa el del sistema (HACKAI_CLOCK). */
import type { ClockPort } from '@/lib/ports/clock'

export function createFixedClock(now: string): ClockPort {
  const fixed = new Date(now)
  return {
    capabilities: { fixed: true },
    now: () => new Date(fixed)
  }
}
