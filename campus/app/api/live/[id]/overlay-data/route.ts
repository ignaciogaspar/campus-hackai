import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { parseOverlay, resolveOverlayData } from '@/lib/live/overlay-data'
import type { LiveRouteParams } from '@/lib/live/route'
import { jsonError, LiveError, loadLive } from '@/lib/live/session'

export const dynamic = 'force-dynamic'

/**
 * GET: datos para dibujar el overlay actual de la clase (conteos de encuesta,
 * posturas, marcas, simulador, alumno).
 * - Profesor: puede pedir cualquier overlay con ?overlay=<json> (la consola
 *   dibuja slides interactivas que todavía no están proyectadas).
 * - Alumno logueado o invitado: SOLO el overlay que está proyectado ahora
 *   (se ignora ?overlay=), y solo mientras la clase está viva. Así no se
 *   pueden leer justificaciones de otro caso ni resultados de una encuesta
 *   antes de que el profesor los muestre.
 * - Encuesta sin resultados proyectados: sin conteos ni textos.
 * - Posturas: el invitado no ve las justificaciones con nombre.
 */
export async function GET(req: Request, ctx: LiveRouteParams) {
  const raw = new URL(req.url).searchParams.get('overlay')
  try {
    const session = await getSession()
    const { id } = await ctx.params
    const live = await loadLive(id)
    const isProf = session?.role === 'profesor'
    if (!isProf && live.status !== 'live') return NextResponse.json({ type: 'none' }, { headers: { 'cache-control': 'no-store' } })
    let overlay = live.overlay ?? null
    if (raw && isProf) {
      let parsed: unknown
      try { parsed = JSON.parse(raw) } catch { throw new LiveError('overlay no es JSON.') }
      const o = parseOverlay(parsed)
      if (o === undefined) throw new LiveError('Overlay inválido.')
      overlay = o
    }
    const data = await resolveOverlayData(live, overlay)
    if (!isProf) {
      if (data.type === 'postures' && !session) data.postures = { ...data.postures, quotes: [] }
      if (data.type === 'poll' && !(overlay?.type === 'poll' && overlay.showResults)) {
        const counts = Object.fromEntries(Object.keys(data.poll.counts).map((k) => [k, 0]))
        data.poll = { ...data.poll, counts: data.poll.kind === 'wordcloud' ? {} : counts, texts: undefined }
      }
    }
    return NextResponse.json(data, { headers: { 'cache-control': 'no-store' } })
  } catch (err) {
    return jsonError(err)
  }
}
