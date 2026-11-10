import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getOrganization, loadPortfolio, OrganizationError, saveOrganization } from '@/lib/organizacion/store'
import { organizationGaps } from '@/lib/organizacion/types'

export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * GET /api/organizacion            → la organización propia (alumno) con lo que falta.
 * GET /api/organizacion?personId=… → el portfolio de un alumno (solo profesor).
 * GET …&portfolio=1                → incluye los entregables.
 */
export async function GET(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Sin sesión.' }, { status: 401 })
  const url = new URL(req.url)
  const asked = url.searchParams.get('personId')
  let personId = session.personId
  if (asked && asked !== session.personId) {
    if (session.role !== 'profesor') return NextResponse.json({ error: 'Solo los docentes ven otras organizaciones.' }, { status: 403 })
    if (!UUID.test(asked)) return NextResponse.json({ error: 'personId inválido.' }, { status: 400 })
    personId = asked
  }
  if (url.searchParams.get('portfolio') === '1') {
    const data = await loadPortfolio(personId, session.role === 'profesor' ? 'profesor' : 'alumno')
    return NextResponse.json({
      organization: data.organization,
      missing: organizationGaps(data.organization),
      revisions: data.revisions,
      envChecks: data.envChecks,
      deliverables: data.items.map((i) => ({
        id: i.def.id, block: i.def.block, title: i.def.title, status: i.assignment?.status ?? null, dueAt: i.assignment?.due_at ?? null,
        submittedAt: i.submission?.updated_at ?? null, url: i.submission?.url ?? null,
        feedback: i.teacher ? { comment: i.teacher.comment, scores: i.teacher.scores, at: i.teacher.submitted_at } : null,
      })),
    })
  }
  const org = await getOrganization(personId)
  return NextResponse.json({ organization: org, missing: organizationGaps(org) })
}

/** PUT /api/organizacion (alumno): guarda la organización propia. Body: OrganizationInput. */
export async function PUT(req: Request) {
  const session = await getSession()
  if (!session || session.role !== 'alumno') return NextResponse.json({ error: 'Solo alumnos.' }, { status: 403 })
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 })
  }
  try {
    const org = await saveOrganization(session.personId, (body ?? {}) as Record<string, unknown>)
    return NextResponse.json({ organization: org, missing: organizationGaps(org) })
  } catch (e) {
    if (e instanceof OrganizationError) return NextResponse.json({ error: e.message }, { status: 400 })
    console.error('[api/organizacion]', e)
    return NextResponse.json({ error: 'No se pudo guardar.' }, { status: 500 })
  }
}
