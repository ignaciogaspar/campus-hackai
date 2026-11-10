import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getPostureDistribution } from '@/lib/classroom/cases'

export const dynamic = 'force-dynamic'

/**
 * Distribución anónima de posturas de un caso (para el overlay `postures`
 * del proyector y de los celulares). Requiere cualquier sesión.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Necesitás iniciar sesión' }, { status: 401 })
  const { id } = await ctx.params
  const dist = await getPostureDistribution(id)
  if (!dist) return NextResponse.json({ error: 'No existe el caso' }, { status: 404 })
  return NextResponse.json(dist, { headers: { 'cache-control': 'no-store' } })
}
