/* Corrida periódica: lo que hace la ruta `/api/cron/sync` cuando la llama el
   cron del hosting. Solo deja pasar al que trae el secreto de `CRON_SECRET`
   y entonces sincroniza todos los espacios. */
import { createHash, timingSafeEqual } from 'node:crypto'
import type { Spaces } from '@/lib/core/spaces'
import type { Studies } from '@/lib/core/studies'

export type PeriodicSyncDeps = {
  /** El valor de `CRON_SECRET`, o nada si falta en el entorno. */
  secret: string | undefined
  syncAll: Spaces['syncAll']
  /** Reintenta pasar al SIU las listas de asistencia pendientes (Cursada). Si falla, no corta la corrida. */
  retryPases?: Studies['retryPases']
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

/** Valida el secreto y sincroniza. Responde 200 con el resumen, 401 sin el
    secreto, 503 si falta `CRON_SECRET` y el error de Espacios si no pudo. */
export async function handlePeriodicSync(
  request: Request,
  { secret, syncAll, retryPases, log = console.log }: PeriodicSyncDeps
): Promise<Response> {
  const configured = secret?.trim()
  if (!configured) {
    // Sin secreto la ruta no se abre: se cierra para todos y se avisa en el log.
    log('[corrida-periodica] falta CRON_SECRET en el entorno: la ruta queda cerrada')
    return Response.json({ error: 'sin-configurar' }, { status: 503 })
  }
  if (!authorized(request, configured)) return Response.json({ error: 'no-autorizado' }, { status: 401 })

  // Las listas de asistencia que no llegaron al SIU se reintentan en la misma corrida; lo que pase acá no corta la de Espacios.
  const pases = retryPases ? await retryPases() : null
  if (pases && !pases.ok) log(`[corrida-periodica] pases al SIU: ${pases.error}`)
  if (pases?.ok)
    log(`[corrida-periodica] pases al SIU: ${pases.value.passed} pasados, ${pases.value.pending} pendientes`)

  const result = await syncAll()
  if (!result.ok) {
    log(`[corrida-periodica] ${result.error}`)
    return Response.json({ error: result.error }, { status: ERROR_STATUS[result.error] })
  }
  const { channels, imported, sent, pending } = result.value
  log(`[corrida-periodica] ok: ${channels} canales, ${imported} importados, ${sent} enviados, ${pending} pendientes`)
  return Response.json(result.value)
}
