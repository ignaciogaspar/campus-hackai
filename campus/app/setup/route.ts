import { scriptResponse } from '@/lib/setup/scripts'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** GET /setup → instalador para macOS y Linux: `curl -fsSL <campus>/setup | bash`. */
export function GET(req: Request) {
  return scriptResponse('sh', req)
}
