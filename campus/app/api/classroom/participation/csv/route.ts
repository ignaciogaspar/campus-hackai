import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getClassSessions } from '@/lib/course'
import { toCsv } from '@/lib/classroom/csv'
import { cohortParticipation } from '@/lib/classroom/participation'
import { PARTICIPATION_KINDS, PARTICIPATION_KIND_LABEL } from '@/lib/classroom/types'

export const dynamic = 'force-dynamic'

/** Export CSV de la tabla de participación de la cohorte (solo profesor). */
export async function GET() {
  const session = await getSession()
  if (session?.role !== 'profesor') return NextResponse.json({ error: 'Solo para profesores' }, { status: 403 })
  const [rows, sessions] = await Promise.all([cohortParticipation(), getClassSessions()])
  const header = [
    'Alumno', 'Empresa', 'Total', 'Puntos', 'Calidad promedio',
    ...PARTICIPATION_KINDS.map((k) => PARTICIPATION_KIND_LABEL[k]),
    ...sessions.map((s) => `J${s.ordinal}`),
    'Sorteos: participó', 'Sorteos: pasó', 'Sorteos: ausente', 'Última participación',
  ]
  const body = rows.map((r) => [
    r.name, r.company ?? '', r.total, r.points, r.avgQuality ?? '',
    ...PARTICIPATION_KINDS.map((k) => r.byKind[k]),
    ...sessions.map((s) => r.bySession[s.id] ?? 0),
    r.draws.participo, r.draws.paso, r.draws.ausente, r.lastAt ?? '',
  ])
  const fecha = new Date().toISOString().slice(0, 10)
  return new NextResponse(toCsv(header, body), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="participacion-aicm-${fecha}.csv"`,
      'cache-control': 'no-store',
    },
  })
}
