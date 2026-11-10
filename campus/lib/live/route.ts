import 'server-only'
import { NextResponse } from 'next/server'
import type { Session } from '@/lib/auth'
import type { LiveSession } from '@/lib/db-types'
import { apiSession, jsonError, loadLive, loadLiveOpen } from './session'

/* Envoltorio de los route handlers de /api/live/[id]/*: sesión, rol, carga
   de la clase y errores en JSON. */

export type LiveRouteParams = { params: Promise<{ id: string }> }

export async function withLive(
  ctx: LiveRouteParams,
  opts: { role?: 'profesor'; open?: boolean },
  fn: (live: LiveSession, session: Session) => Promise<unknown>,
): Promise<NextResponse> {
  const session = await apiSession(opts.role)
  if (session instanceof NextResponse) return session
  try {
    const { id } = await ctx.params
    const live = opts.open ? await loadLiveOpen(id) : await loadLive(id)
    const out = await fn(live, session)
    if (out instanceof NextResponse) return out
    return NextResponse.json(out ?? { ok: true }, { headers: { 'cache-control': 'no-store' } })
  } catch (err) {
    return jsonError(err)
  }
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json()
    return body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}
