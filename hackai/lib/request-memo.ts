/** Comparte lecturas exitosas mientras dure el pedido. Cada lector tiene sus propias claves. */
export type RequestScope = () => Map<string, Promise<unknown>> | undefined

export function memoRead<A extends unknown[], R extends { ok: boolean }>(
  scope: RequestScope | undefined,
  name: string,
  read: (...args: A) => Promise<R>
): (...args: A) => Promise<R> {
  return (...args) => {
    const entries = scope?.()
    if (!entries) return read(...args)
    const key = `${name}:${JSON.stringify(args)}`
    const found = entries.get(key)
    if (found) return found as Promise<R>

    const discard = () => {
      if (entries.get(key) === pending) entries.delete(key)
    }
    const pending = read(...args).then(
      (result) => {
        if (!result.ok) discard()
        return result
      },
      (error: unknown) => {
        discard()
        throw error
      }
    )
    entries.set(key, pending)
    return pending
  }
}
