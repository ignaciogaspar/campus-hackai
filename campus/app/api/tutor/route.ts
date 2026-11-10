import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { Anthropic, MODEL_LIVE, claude } from '@/lib/claude'
import { isTutorMode, tutorContextBlock, tutorSystemBase, type TutorMode } from '@/lib/tutor/prompt'
import {
  addMessage, buildTutorContext, createThread, findThread, getThread, threadMessages, tutorQuota,
} from '@/lib/tutor/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

/* Tutor por slide.
   GET  ?deckId&position&mode           → {thread, messages, quota}
   POST {deckId, position, slideId?, mode?, message, threadId?}
        → text/plain en streaming (la respuesta del tutor), con headers
          x-tutor-thread y x-tutor-remaining. 429 si se agotó el cupo diario. */

const MAX_MESSAGE = 2000
const HISTORY = 20

function bad(status: number, error: string) {
  return NextResponse.json({ error }, { status })
}

function parsePosition(v: unknown): number | null {
  const n = typeof v === 'string' ? Number(v) : v
  return typeof n === 'number' && Number.isInteger(n) && n >= 0 && n < 10000 ? n : null
}

function validDeckId(v: unknown): v is string {
  return typeof v === 'string' && /^[a-z0-9-]{1,80}$/i.test(v)
}

export async function GET(req: Request) {
  const session = await getSession()
  if (!session) return bad(401, 'Necesitás ingresar al campus')
  const url = new URL(req.url)
  const deckId = url.searchParams.get('deckId')
  const position = parsePosition(url.searchParams.get('position'))
  const modeParam = url.searchParams.get('mode') ?? 'socratico'
  if (!validDeckId(deckId) || position === null || !isTutorMode(modeParam)) return bad(400, 'Parámetros inválidos')
  const [thread, quota] = await Promise.all([findThread(session.personId, deckId, position, modeParam), tutorQuota(session.personId)])
  const messages = thread ? await threadMessages(thread.id) : []
  return NextResponse.json({ thread, messages, quota })
}

export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return bad(401, 'Necesitás ingresar al campus')

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return bad(400, 'JSON inválido')
  }
  const deckId = body.deckId
  const position = parsePosition(body.position)
  const mode: TutorMode = isTutorMode(body.mode) ? body.mode : 'socratico'
  const slideId = typeof body.slideId === 'string' && /^[0-9a-f-]{36}$/i.test(body.slideId) ? body.slideId : null
  const message = typeof body.message === 'string' ? body.message.trim() : ''
  if (!validDeckId(deckId) || position === null) return bad(400, 'Faltan deckId o position')
  if (!message) return bad(400, 'El mensaje está vacío')
  if (message.length > MAX_MESSAGE) return bad(400, `El mensaje es muy largo (máximo ${MAX_MESSAGE} caracteres)`)

  const quota = await tutorQuota(session.personId)
  if (quota.remaining <= 0) {
    return NextResponse.json({ error: `Llegaste al límite de ${quota.limit} mensajes por hoy. Mañana seguimos.`, quota }, { status: 429 })
  }

  const ctx = await buildTutorContext(session.personId, deckId, position, slideId)
  if (!ctx) return bad(404, 'No encontramos ese deck')

  // Hilo: el indicado (si es tuyo y coincide), o el último de esta slide y modo, o uno nuevo.
  let thread = typeof body.threadId === 'string' ? await getThread(body.threadId, session.personId) : null
  if (thread && (thread.deckId !== deckId || thread.position !== ctx.position || thread.mode !== mode)) thread = null
  thread = thread ?? await findThread(session.personId, deckId, ctx.position, mode)
    ?? await createThread(session.personId, deckId, ctx.position, slideId, mode)

  const history = await threadMessages(thread.id, HISTORY)
  await addMessage(thread.id, 'user', message)

  const messages: Anthropic.Beta.BetaMessageParam[] = [
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: message },
  ]

  const threadId = thread.id
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let text = ''
      try {
        const s = claude().beta.messages.stream({
          model: MODEL_LIVE,
          max_tokens: 4000,
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
          output_config: { effort: 'low' },
          system: [
            { type: 'text', text: tutorSystemBase(mode), cache_control: { type: 'ephemeral' } },
            { type: 'text', text: tutorContextBlock(ctx) },
          ],
          messages,
        }, { signal: req.signal })
        for await (const event of s) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            text += event.delta.text
            controller.enqueue(encoder.encode(event.delta.text))
          }
        }
        const final = await s.finalMessage()
        if (final.stop_reason === 'refusal' && !text.trim()) {
          text = 'Prefiero no seguir por ese lado. Volvamos a la slide: ¿qué parte te genera más dudas?'
          controller.enqueue(encoder.encode(text))
        } else if (final.stop_reason === 'max_tokens') {
          controller.enqueue(encoder.encode(' …'))
        }
      } catch (err) {
        if (!req.signal.aborted) {
          console.error('[api/tutor]', err)
          const msg = err instanceof Anthropic.RateLimitError
            ? 'El tutor está con mucha demanda. Probá de nuevo en un minuto.'
            : 'No pude responder ahora. Probá de nuevo en un rato.'
          if (!text) controller.enqueue(encoder.encode(msg))
        }
      } finally {
        if (text.trim()) {
          try { await addMessage(threadId, 'assistant', text) } catch (e) { console.error('[api/tutor] guardar respuesta', e) }
        }
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
      'x-tutor-thread': threadId,
      'x-tutor-remaining': String(Math.max(0, quota.remaining - 1)),
      'x-tutor-limit': String(quota.limit),
    },
  })
}
