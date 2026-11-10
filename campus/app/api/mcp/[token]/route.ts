import { handleMcpGet, handleMcpOptions, handleMcpPost } from '@/lib/mcp/server'

/* Variante con el token en la URL, para clientes que no dejan configurar
   headers (p. ej. conectores personalizados de claude.ai). Tratá la URL
   como un secreto. */

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return handleMcpPost(req, decodeURIComponent(token))
}

export async function GET() {
  return handleMcpGet()
}

export async function DELETE() {
  return handleMcpGet()
}

export async function OPTIONS() {
  return handleMcpOptions()
}
