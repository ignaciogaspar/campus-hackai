/* Errores como valores. Los módulos del núcleo y los puertos devuelven un
   Result en vez de tirar: un error esperable (sin cupo, sistema caído) es
   parte de la respuesta. Las excepciones quedan para lo que no debería pasar. */

export type Ok<T> = { ok: true; value: T }
export type Fail<E extends string> = { ok: false; error: E }
export type Result<T, E extends string> = Ok<T> | Fail<E>

/** Operación del núcleo que todavía no se construyó. */
export type NotImplemented = 'no-implementado'

/** Un sistema de origen o canal externo no respondió o respondió mal. */
export type ExternalFailure = 'falla-externa'

export function ok<T>(value: T): Ok<T> {
  return { ok: true, value }
}

export function fail<E extends string>(error: E): Fail<E> {
  return { ok: false, error }
}

export async function notImplemented(): Promise<Fail<NotImplemented>> {
  return fail('no-implementado')
}

/** El error esperable de una operación que devuelve un Result (o una promesa de uno). */
export type ErrorOf<T> = Extract<Awaited<T>, Fail<string>>['error']

/** El mensaje de una excepción, para un log o un reporte. */
export const messageOf = (error: unknown) => (error instanceof Error ? error.message : 'error desconocido')

/** Junta varios Result en uno: los valores en orden, o el primer error. */
export function all<T, E extends string>(results: Result<T, E>[]): Result<T[], E> {
  const values: T[] = []
  for (const result of results) {
    if (!result.ok) return result
    values.push(result.value)
  }
  return ok(values)
}
