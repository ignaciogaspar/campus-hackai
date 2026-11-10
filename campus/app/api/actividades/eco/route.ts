import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/*
 * Endpoint de prueba de «Seguí el request» (J2): devuelve lo que le mandaste,
 * la hora del servidor y cuánto tardó. Pensado para mirarlo en DevTools.
 * Sin datos sensibles; solo con sesión del campus.
 */
async function answer(req: Request, received: unknown) {
  const t0 = performance.now()
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Tenés que ingresar al campus.' }, { status: 401 })
  const url = new URL(req.url)
  const espera = Math.min(1500, Math.max(0, Number(url.searchParams.get('espera')) || 0))
  if (espera) await new Promise((r) => setTimeout(r, espera))
  return NextResponse.json({
    recibido: received,
    metodo: req.method,
    servidor: 'Next.js en Vercel (route handler /api/actividades/eco)',
    horaServidor: new Date().toISOString(),
    rol: session.role,
    tardoMs: Math.round(performance.now() - t0),
  }, { headers: { 'x-campus-actividad': 'segui-el-request', 'cache-control': 'no-store' } })
}

export async function GET(req: Request) {
  return answer(req, Object.fromEntries(new URL(req.url).searchParams))
}

export async function POST(req: Request) {
  let body: unknown = null
  try { body = await req.json() } catch { body = null }
  return answer(req, body)
}
