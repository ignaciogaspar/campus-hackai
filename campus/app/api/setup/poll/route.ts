import { siteOrigin } from '@/lib/site'
import { rateHit } from '@/lib/security'
import { hashDeviceCode, pollPairing } from '@/lib/setup/pairing'
import { readSetupBody, setupReply } from '@/lib/setup/respond'
import { setupOrigin } from '@/lib/setup/scripts'
import { routes } from '@/lib/routes'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * POST /api/setup/poll · body: deviceCode (en el body, nunca en la URL).
 * status = pendiente | rechazado | vencido | desconocido | ok. Con ok viene el
 * token MCP, una sola vez.
 */
export async function POST(req: Request) {
  const body = await readSetupBody(req)
  const deviceCode = String(body.deviceCode ?? '')
  if (!/^dev_[A-Za-z0-9_-]{30,60}$/.test(deviceCode)) return setupReply(req, { status: 'desconocido' }, 400)
  // cada 3 s durante 10 min son 200 consultas
  if (!(await rateHit(`setup-poll:${hashDeviceCode(deviceCode).slice(0, 32)}`, 600, 300))) {
    return setupReply(req, { status: 'pendiente', error: 'Más despacio.' }, 429)
  }
  const r = await pollPairing(deviceCode)
  if (r.status !== 'ok') return setupReply(req, { status: r.status })
  return setupReply(req, {
    status: 'ok',
    token: r.token,
    role: r.role,
    name: r.name,
    mcpUrl: `${siteOrigin(setupOrigin(req))}${routes.mcp}`,
  })
}
