import { handleMcpGet, handleMcpOptions, handleMcpPost } from '@/lib/mcp/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: Request) {
  return handleMcpPost(req)
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
