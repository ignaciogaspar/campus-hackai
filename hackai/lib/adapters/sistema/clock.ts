/* Reloj del sistema: la hora real del servidor. */
import type { ClockPort } from '@/lib/ports/clock'

export function createSystemClock(): ClockPort {
  return {
    capabilities: { fixed: false },
    now: () => new Date()
  }
}
