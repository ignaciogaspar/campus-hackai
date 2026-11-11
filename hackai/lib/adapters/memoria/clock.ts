/* Reloj fijo: siempre devuelve la misma fecha. Es el reloj de los tests y de
   la demo con datos sintéticos. */
import type { ClockPort } from '@/lib/ports/clock'

export function createFixedClock(now: string): ClockPort {
  const fixed = new Date(now)
  return {
    capabilities: { fixed: true },
    now: () => new Date(fixed),
  }
}
