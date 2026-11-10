import { requireSession } from '@/lib/auth'
import { TokensPage } from '@/lib/mcp/ui/TokensPage'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Tokens MCP' }

export default async function ProfesorTokens() {
  const session = await requireSession('profesor')
  return <TokensPage personId={session.personId} role="profesor" />
}
