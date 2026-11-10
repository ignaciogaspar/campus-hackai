import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { gradebookCsv } from '@/lib/assignments/csv'
import { buildGradebook, loadBundle } from '@/lib/assignments/store'

export const dynamic = 'force-dynamic'

/** GET /api/assignments/<id>/csv — libro de notas de la entrega (solo profesor). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session || session.role !== 'profesor') return NextResponse.json({ error: 'Solo para profesores.' }, { status: 403 })
  const { id } = await params
  const bundle = await loadBundle(id)
  if (!bundle) return NextResponse.json({ error: 'La entrega no existe.' }, { status: 404 })
  const csv = gradebookCsv(bundle, buildGradebook(bundle))
  const name = `notas-${id.replace(/[^a-z0-9-]/gi, '')}.csv`
  return new NextResponse(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${name}"`,
      'cache-control': 'no-store',
    },
  })
}
