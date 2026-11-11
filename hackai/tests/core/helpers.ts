/* Ayudas compartidas por los tests de los módulos: un reloj que se adelanta y
   puertos en memoria que se pueden «caer». */
import type { ClockPort } from '@/lib/ports/clock'
import { fail } from '@/lib/result'

/** Reloj que se puede adelantar, para ver la hora de cada lectura. */
export function movableClock(start: string) {
  let current = new Date(start)
  const clock: ClockPort = { capabilities: { fixed: true }, now: () => new Date(current) }
  return {
    clock,
    advance: (minutes: number) => {
      current = new Date(current.getTime() + minutes * 60_000)
    }
  }
}

/** Puerto en memoria que se puede «caer»: con `down`, toda llamada que devuelve una promesa devuelve `falla-externa`. */
export function fallible<P extends object>(port: P) {
  const state = { down: false }
  const wrapped = new Proxy(port, {
    get(target, key) {
      const value = target[key as keyof P]
      if (typeof value !== 'function') return value
      return (...args: unknown[]) => {
        if (key === 'courseUrl' || key === 'selfServiceUrl')
          return (value as (...a: unknown[]) => unknown).apply(target, args)
        return state.down
          ? Promise.resolve(fail('falla-externa'))
          : (value as (...a: unknown[]) => unknown).apply(target, args)
      }
    }
  })
  return { port: wrapped, state }
}
