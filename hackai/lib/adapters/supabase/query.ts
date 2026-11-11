/* Consultas a Supabase que se portan bien con una base lenta o caída: cada una
   tiene tiempo máximo y nunca tira. Una caída, un tiempo agotado o un error de
   la base vuelven como `falla-externa`; una clave repetida, como `duplicado`.
   Los logs llevan el adaptador, la operación y el código de error, nunca datos
   de personas. */
import { type ExternalFailure, fail, ok, type Result } from '@/lib/result'

export type DbError = { message: string; code?: string }
export type DbResponse<T> = { data: T | null; error: DbError | null }
export type QueryError = ExternalFailure | 'duplicado'
export type Query<T> = (signal: AbortSignal) => PromiseLike<DbResponse<T>>
export type QueryRunner = <T>(op: string, query: Query<T>) => Promise<Result<T | null, QueryError>>

export type QueryRunnerOptions = {
  /** Nombre del adaptador, para los logs. */
  name: string
  /** Tiempo máximo de cada consulta. */
  timeoutMs: number
  log: (message: string) => void
}

/** Clave única repetida, según Postgres. */
const UNIQUE_VIOLATION = '23505'

export function createQueryRunner({ name, timeoutMs, log }: QueryRunnerOptions): QueryRunner {
  return async function run<T>(op: string, query: Query<T>): Promise<Result<T | null, QueryError>> {
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort()
        reject(new Error('tiempo agotado'))
      }, timeoutMs)
    })
    try {
      const { data, error } = await Promise.race([Promise.resolve(query(controller.signal)), timeout])
      if (error) {
        if (error.code === UNIQUE_VIOLATION) return fail('duplicado')
        log(`[${name}] ${op}: error ${error.code ?? 'sin código'}`)
        return fail('falla-externa')
      }
      return ok(data)
    } catch (cause) {
      log(`[${name}] ${op}: ${cause instanceof Error ? cause.name : 'falla'}`)
      return fail('falla-externa')
    } finally {
      clearTimeout(timer)
    }
  }
}
