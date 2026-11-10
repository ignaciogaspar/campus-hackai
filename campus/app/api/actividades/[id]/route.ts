import { getActivityDef } from '@/lib/actividades/catalog'
import { buildView, runOp } from '@/lib/actividades/service'
import { apiSession, json, jsonError, readJson } from '@/lib/student/server'

export const dynamic = 'force-dynamic'

/** GET → ActivityView (lo mío como alumno; todo como profesor). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await apiSession()
  if (session instanceof Response) return session
  const def = getActivityDef((await params).id)
  if (!def) return jsonError('No existe esa actividad.', 404)
  return json(await buildView(def, session))
}

/**
 * POST {op, …} → {ok, message?, view}.
 * Alumno: entry.save {data} · item.add {data} · item.update {itemId, data} · item.delete {itemId} · vote {presenterId, vote, line}.
 * Profesor: pairs.generate {only?} · pairs.copy {from} · pairs.clear · timer.start {minutes, label?} · timer.stop ·
 *           board.setup · board.next/prev {minutes?} · board.goto {index} · board.move {personId, dir} · board.close · board.reset.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await apiSession()
  if (session instanceof Response) return session
  const def = getActivityDef((await params).id)
  if (!def) return jsonError('No existe esa actividad.', 404)
  const body = await readJson(req)
  if (!body) return jsonError('Pedido inválido.')
  const res = await runOp(def, session, body)
  if (!res.ok) return jsonError(res.error, res.status ?? 400)
  return json({ ok: true, message: res.message ?? null, view: await buildView(def, session) })
}
