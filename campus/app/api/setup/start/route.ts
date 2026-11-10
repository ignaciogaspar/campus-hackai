import { clientIp, rateHit } from '@/lib/security'
import { cleanLabel, POLL_INTERVAL_SECONDS, startPairing } from '@/lib/setup/pairing'
import { readSetupBody, setupReply } from '@/lib/setup/respond'
import { setupOrigin } from '@/lib/setup/scripts'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** POST /api/setup/start · body: hostname, os → deviceCode (secreto del script), userCode y verifyUrl. */
export async function POST(req: Request) {
  const ip = await clientIp()
  // una cohorte entera en la misma red del DOT: cupo generoso por IP
  if (!(await rateHit(`setup-start:${ip}`, 600, 60))) {
    return setupReply(req, { error: 'Demasiados intentos desde esta red. Esperá unos minutos y probá de nuevo.' }, 429)
  }
  const body = await readSetupBody(req)
  try {
    const p = await startPairing({ hostname: cleanLabel(body.hostname, 60), os: cleanLabel(body.os, 120), ip })
    return setupReply(req, {
      deviceCode: p.deviceCode,
      userCode: p.userCode,
      verifyUrl: `${setupOrigin(req)}/conectar?c=${p.userCode}`,
      interval: POLL_INTERVAL_SECONDS,
      expiresIn: p.expiresIn,
    })
  } catch (e) {
    console.error('[setup] start', (e as Error).message)
    return setupReply(req, { error: 'No se pudo iniciar la conexión. Probá de nuevo en un rato.' }, 500)
  }
}
