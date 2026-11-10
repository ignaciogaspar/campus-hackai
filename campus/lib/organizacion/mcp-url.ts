import 'server-only'
import { headers } from 'next/headers'
import { routes } from '@/lib/routes'
import { siteOrigin } from '@/lib/site'

/** URL pública del servidor MCP (misma regla que lib/mcp/ui/TokensPage). */
export async function mcpUrl(): Promise<string> {
  const site = siteOrigin()
  if (site) return `${site}${routes.mcp}`
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https')
  return `${proto}://${host}${routes.mcp}`
}
