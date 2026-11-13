/* Corrida periódica: lo que hace la ruta `/api/cron/sync` cuando la llama el
   cron del hosting. Solo deja pasar al que trae el secreto de `CRON_SECRET`
   y entonces sincroniza todos los espacios y reintenta el pase al SIU de las
   notas que quedaron pendientes. */
import { createHash, timingSafeEqual } from 'node:crypto'
import type { Coursework } from '@/lib/core/coursework'
import type { Spaces } from '@/lib/core/spaces'

export type PeriodicSyncDeps = {
  /** El valor de `CRON_SECRET`, o nada si falta en el entorno. */
  secret: string | undefined
  syncAll: Spaces['syncAll']
  /** Reintenta el pase al SIU de las notas pendientes de Seguimiento. Sin esto, la corrida solo sincroniza espacios. */
  retryPass?: Coursework['retryPass']
  log?: (message: string) => void
}

/** Los errores que puede devolver la sincronización de Espacios. */
type SyncError = Extract<Awaited<ReturnType<Spaces['syncAll']>>, { ok: false }>['error']

/** Cómo vuelve cada error de la sincronización. Es exhaustivo a propósito: si
    Espacios suma un error, el typecheck pide decidir su código acá. */
const ERROR_STATUS: Record<SyncError, number> = { 'falla-externa': 502 }

const digest = (text: string) => createHash('sha256').update(text).digest()

/** Si el pedido trae `Authorization: Bearer <secreto>`. Compara en tiempo
    constante: los dos lados se resumen con SHA-256 para que tengan el mismo
    largo y el tiempo no diga cuántos caracteres coinciden. */
function authorized(request: Request, secret: string): boolean {
  const token = /^Bearer\s+(.+)$/i.exec(request.headers.get('authorization') ?? '')?.[1]?.trim()
  return token !== undefined && timingSafeEqual(digest(token), digest(secret))
}

/** Reintenta el pase de notas y lo cuenta en el log. Un pase que falla no impide la sincronización de los espacios:
    las notas siguen pendientes y se reintentan en la próxima corrida. */
async function retryGrades(retryPass: Coursework['retryPass'], log: (message: string) => void) {
  const retried = await retryPass()
  if (!retried.ok) {
    log(`[corrida-periodica] pase de notas: ${retried.error}`)
    return null
  }
  log(`[corrida-periodica] pase de notas: ${retried.value.passed} pasadas, ${retried.value.pending} pendientes`)
  return retried.value
}

/** Valida el secreto y sincroniza. Responde 200 con el resumen (más `grades`, cuántas notas pasaron al SIU y cuántas
    siguen pendientes, si la corrida reintenta el pase), 401 sin el secreto, 503 si falta `CRON_SECRET` y el error de
    Espacios si no pudo. */
export async function handlePeriodicSync(
  request: Request,
  { secret, syncAll, retryPass, log = console.log }: PeriodicSyncDeps
): Promise<Response> {
  const configured = secret?.trim()
  if (!configured) {
    // Sin secreto la ruta no se abre: se cierra para todos y se avisa en el log.
    log('[corrida-periodica] falta CRON_SECRET en el entorno: la ruta queda cerrada')
    return Response.json({ error: 'sin-configurar' }, { status: 503 })
  }
  if (!authorized(request, configured)) return Response.json({ error: 'no-autorizado' }, { status: 401 })

  const result = await syncAll()
  const grades = retryPass ? await retryGrades(retryPass, log) : null
  if (!result.ok) {
    log(`[corrida-periodica] ${result.error}`)
    return Response.json({ error: result.error }, { status: ERROR_STATUS[result.error] })
  }
  const { channels, imported, sent, pending } = result.value
  log(`[corrida-periodica] ok: ${channels} canales, ${imported} importados, ${sent} enviados, ${pending} pendientes`)
  return Response.json(retryPass ? { ...result.value, grades } : result.value)
}
