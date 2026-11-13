/** Lo que no cambia con lo que hace el alumno. */
export const STATIC_TTL_MS = 5 * 60_000
/** Con más lecturas guardadas que esto, se borran las vencidas: así la memoria no crece sin tope en un
    proceso largo (Docker), aunque nadie vuelva a pedir una lectura vieja. */
export const MAX_ENTRIES = 2_000

type Entry = { at: number; value: Promise<unknown> }

export type Reader<A extends unknown[], R> = (...args: A) => Promise<R>

/** Las lecturas guardadas de un adaptador. `ttl` 0: solo se comparte la que está en vuelo. */
export function createStore(now: () => number) {
  const entries = new Map<string, Entry>()

  /** Borra lo que venció hasta para la lectura que más dura; si igual quedan demasiadas, todo lo que no
      está en vuelo. */
  function prune() {
    const at = now()
    for (const [key, entry] of entries) {
      if (entry.at !== Number.POSITIVE_INFINITY && at - entry.at >= STATIC_TTL_MS) entries.delete(key)
    }
    if (entries.size < MAX_ENTRIES) return
    for (const [key, entry] of entries) if (entry.at !== Number.POSITIVE_INFINITY) entries.delete(key)
  }

  function read<A extends unknown[], R>(name: string, ttl: number, reader: Reader<A, R>): Reader<A, R> {
    return (...args) => {
      const key = `${name}:${JSON.stringify(args)}`
      const found = entries.get(key)
      if (found && (found.at === Number.POSITIVE_INFINITY || now() - found.at < ttl)) return found.value as Promise<R>
      // Mientras está en vuelo vale para todos; al llegar, queda guardada `ttl` o se borra.
      const entry: Entry = { at: Number.POSITIVE_INFINITY, value: Promise.resolve() }
      const value = reader(...args).then(
        (result) => {
          const failed = typeof result === 'object' && result !== null && 'ok' in result && result.ok === false
          if (ttl > 0 && !failed && entries.get(key) === entry) entry.at = now()
          else if (entries.get(key) === entry) entries.delete(key)
          return result
        },
        (error: unknown) => {
          if (entries.get(key) === entry) entries.delete(key)
          throw error
        }
      )
      entry.value = value
      if (entries.size >= MAX_ENTRIES) prune()
      entries.set(key, entry)
      return value
    }
  }

  return { read, clear: () => entries.clear() }
}
