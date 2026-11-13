/* Recorrer una lista con un tope de tareas a la vez. Lo usan la sincronización
   con el canal externo y su adaptador de Discord: en paralelo es más rápido,
   pero sin tope una primera lectura con muchos canales e hilos dispara todos
   los pedidos juntos y Discord responde con 429. */

/** Aplica `fn` a cada elemento, con a lo sumo `limit` tareas corriendo a la vez. Devuelve los
    resultados en el orden de `items`. Si una tarea falla, falla todo, como `Promise.all`. */
export async function mapLimited<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  async function worker(): Promise<void> {
    while (next < items.length) {
      const index = next++
      results[index] = await fn(items[index], index)
    }
  }
  const workers = Math.max(1, Math.min(limit, items.length))
  await Promise.all(Array.from({ length: workers }, worker))
  return results
}
