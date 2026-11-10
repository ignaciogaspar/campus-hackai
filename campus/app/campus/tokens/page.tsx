import { requireSession } from '@/lib/auth'
import { TokensPage } from '@/lib/mcp/ui/TokensPage'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Conectá Claude' }

export default async function CampusTokens() {
  const session = await requireSession('alumno')
  return <TokensPage personId={session.personId} role="alumno" />
}
