import 'server-only'
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import type { Session } from '@/lib/session-token'
import { SimError } from './server'

/* Helpers de las rutas /api/sims/*: sesión obligatoria y errores en JSON. */

export async function withSession(fn: (session: Session) => Promise<unknown>): Promise<NextResponse> {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Necesitás ingresar al campus' }, { status: 401 })
  try {
    const out = await fn(session)
    return NextResponse.json(out ?? { ok: true })
  } catch (err) {
    if (err instanceof SimError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error('[api/sims]', err)
    return NextResponse.json({ error: 'Error inesperado' }, { status: 500 })
  }
}

/** Body JSON (también acepta text/plain de navigator.sendBeacon). */
export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const text = await req.text()
    if (!text) return {}
    const v = JSON.parse(text)
    return v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {}
  } catch {
    throw new SimError('JSON inválido')
  }
}
