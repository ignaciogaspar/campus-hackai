import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { currentRound } from '@/lib/classroom/participation'

export const dynamic = 'force-dynamic'

/** Ronda vigente del randomizador (solo profesor). */
export async function GET() {
  const session = await getSession()
  if (session?.role !== 'profesor') return NextResponse.json({ error: 'Solo para profesores' }, { status: 403 })
  return NextResponse.json(await currentRound(), { headers: { 'cache-control': 'no-store' } })
}
