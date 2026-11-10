import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { livesWithTranscript, transcriptLines } from '@/lib/live/transcript-archive'

export const dynamic = 'force-dynamic'

/** GET ?live=<id>: la transcripción completa de una clase como .txt (solo profesor). */
export async function GET(req: Request) {
  const session = await getSession()
  if (session?.role !== 'profesor') return NextResponse.json({ error: 'Solo para el profesor.' }, { status: 403 })
  const id = new URL(req.url).searchParams.get('live') ?? ''
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Falta live.' }, { status: 400 })
  const live = (await livesWithTranscript(500)).find((l) => l.id === id)
  if (!live) return NextResponse.json({ error: 'Clase inexistente.' }, { status: 404 })
  const lines = await transcriptLines(id, { includeCommands: true })
  const hora = (iso: string) => new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' })
  const body = [
    `${live.deckTitle} · clase ${live.code} · ${new Date(live.startedAt).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}`,
    '',
    ...lines.map((l) => `[${hora(l.createdAt)}] [slide ${l.position !== null ? l.position + 1 : '-'}]${l.isCommand ? ' (orden al agente)' : ''} ${l.text}`),
  ].join('\n')
  return new Response(body, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'content-disposition': `attachment; filename="transcripcion-${live.deckId}-${live.code}.txt"`,
      'cache-control': 'no-store',
    },
  })
}
