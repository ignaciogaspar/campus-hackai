import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { aiPreEvaluate, AiPreviewError } from '@/lib/assignments/ai'
import { getAssignmentRow } from '@/lib/assignments/store'
import { claude } from '@/lib/claude'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 120

/**
 * POST /api/assignments/<id>/ai-preview {submissionId} → AiPreview.
 * Solo profesor. Es una sugerencia: no se guarda en ninguna tabla.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session || session.role !== 'profesor') return NextResponse.json({ error: 'Solo para profesores.' }, { status: 403 })
  const { id } = await params
  let submissionId = ''
  try {
    submissionId = String(((await req.json()) as { submissionId?: unknown }).submissionId ?? '')
  } catch {
    return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 })
  }
  const [assignment, subRes] = await Promise.all([
    getAssignmentRow(id),
    db().from('submissions').select('id, assignment_id, body_md, url').eq('id', submissionId).maybeSingle(),
  ])
  if (!assignment || !subRes.data || subRes.data.assignment_id !== id) return NextResponse.json({ error: 'La entrega no existe.' }, { status: 404 })
  try {
    const preview = await aiPreEvaluate(claude(), assignment, { body_md: subRes.data.body_md ?? '', url: subRes.data.url ?? null })
    return NextResponse.json(preview, { headers: { 'cache-control': 'no-store' } })
  } catch (e) {
    if (e instanceof AiPreviewError) return NextResponse.json({ error: e.message }, { status: 502 })
    console.error('[ai-preview]', e)
    return NextResponse.json({ error: 'No se pudo pre-evaluar.' }, { status: 500 })
  }
}
