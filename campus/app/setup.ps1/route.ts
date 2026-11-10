import { scriptResponse } from '@/lib/setup/scripts'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** GET /setup.ps1 → instalador para Windows: `irm <campus>/setup.ps1 | iex`. */
export function GET(req: Request) {
  return scriptResponse('ps1', req)
}
