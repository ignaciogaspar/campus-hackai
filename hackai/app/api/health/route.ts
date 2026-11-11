// Chequeo de vida para Docker y el hosting. No toca Supabase ni los sistemas de
// origen: responde aunque falten variables de entorno.
export const dynamic = 'force-dynamic'

export function GET() {
  return Response.json({ status: 'ok' })
}
