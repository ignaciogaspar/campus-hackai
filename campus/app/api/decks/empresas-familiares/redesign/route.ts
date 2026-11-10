// POST /api/decks/empresas-familiares/redesign  {instruction, store} -> {store, explanation, nudged, residual, ms}
// Agente de rediseño del local 3D (tools/local3d.html del deck de Empresas Familiares).
// Portado de la función de Vercel api/redesign.js del deck original. Pide a Claude el layout
// nuevo con structured outputs y lo valida, acota y separa del lado del servidor.
// Requiere sesión del campus (profesor o alumno) para no exponer la API key.
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { Anthropic, claude, MODEL_LIVE } from '@/lib/claude'
import { MAX_INSTRUCTION, TIMEOUT_MS, TYPES, outputSchema, sanitizeStore, settle, str, systemPrompt } from '@/lib/htmldeck/redesign'
import type { Fixture, Store } from '@/lib/htmldeck/redesign'
import { rateHit } from '@/lib/security'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { 'cache-control': 'no-store' } })

class Refusal extends Error {}

async function callClaude(store: Store, instruction: string) {
  const plan = {
    width: store.width,
    depth: store.depth,
    entrance: store.entrance,
    categories: Object.keys(store.categories),
    fixtures: store.fixtures.map(({ id, type, x, y, w, d, rot, label, category }) => ({ id, type, x, y, w, d, rot, label, category })),
  }
  const res = await claude().beta.messages.create(
    {
      model: MODEL_LIVE,
      max_tokens: 8000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: [{ type: 'text', text: systemPrompt(), cache_control: { type: 'ephemeral' } }],
      messages: [
        {
          role: 'user',
          content: `Plano actual del local:\n${JSON.stringify(plan)}\n\nPedido del directivo:\n<pedido>${instruction}</pedido>`,
        },
      ],
      output_config: { effort: 'low', format: { type: 'json_schema', schema: outputSchema(plan.categories) } },
    },
    { timeout: TIMEOUT_MS, maxRetries: 0 },
  )
  if (res.stop_reason === 'refusal') throw new Refusal('refusal')
  const text = res.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')?.text
  if (!text) throw new Error('Respuesta vacía del modelo.')
  return { out: JSON.parse(text) as { explanation?: unknown; fixtures?: unknown }, usage: res.usage }
}

export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return json({ error: 'Entrá al campus para usar el agente.' }, 401)
  // Cuota por persona: cada pedido es una llamada a Claude (costo de API).
  const daily = session.role === 'profesor' ? 200 : 20
  if (!(await rateHit(`redesign:min:${session.personId}`, 60, 4)) || !(await rateHit(`redesign:day:${session.personId}`, 86400, daily))) {
    return json({ error: 'Llegaste al límite de pedidos al agente por ahora. Probá más tarde.' }, 429)
  }
  if (!process.env.ANTHROPIC_API_KEY) return json({ error: 'El servidor no tiene configurada la clave de la API.' }, 500)

  let body: { instruction?: unknown; store?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'JSON inválido.' }, 400)
  }
  const instruction = typeof body?.instruction === 'string' ? body.instruction.trim() : ''
  if (!instruction) return json({ error: 'Falta el pedido.' }, 400)
  if (instruction.length > MAX_INSTRUCTION) return json({ error: `El pedido supera los ${MAX_INSTRUCTION} caracteres.` }, 400)
  let store: Store
  try {
    store = sanitizeStore(body.store)
  } catch (e) {
    return json({ error: (e as Error).message }, 400)
  }

  const t0 = Date.now()
  let result: Awaited<ReturnType<typeof callClaude>>
  try {
    result = await callClaude(store, instruction.replace(/<\/?pedido>/gi, ''))
  } catch (e) {
    if (e instanceof Refusal) return json({ error: 'El agente no quiso procesar ese pedido. Probá con otro cambio sobre el layout.' }, 422)
    if (e instanceof Anthropic.APIConnectionTimeoutError) return json({ error: 'El agente tardó demasiado. Probá de nuevo.' }, 504)
    console.error('redesign failed', e instanceof Anthropic.APIError ? e.status : '', (e as Error).message)
    return json({ error: 'No pude hablar con el agente. Probá de nuevo en unos segundos.' }, 502)
  }

  // Valida y acota la propuesta; conserva lo que el modelo no puede cambiar (local, vistas, colores).
  const proposal = sanitizeStore({ ...store, fixtures: Array.isArray(result.out.fixtures) ? result.out.fixtures : [] })
  const before = new Map<string, Fixture>(store.fixtures.map((f) => [f.id, f]))
  let nextWalk = Math.max(0, ...store.fixtures.map((f) => f.walk || 0)) + 1
  const changed = new Set<string>()
  for (const f of proposal.fixtures) {
    const o = before.get(f.id)
    const t = TYPES[f.type]
    if (o && o.type === f.type) {
      if (o.h !== undefined) f.h = o.h
      if (o.shelves !== undefined) f.shelves = o.shelves
    } else if (t.shelves) f.shelves = t.shelves
    f.sales = o?.sales ?? 0.5
    if (f.type !== 'equipo') f.walk = o?.walk ?? nextWalk++
    if (!o || Math.abs(o.x - f.x) > 0.01 || Math.abs(o.y - f.y) > 0.01 || o.rot !== f.rot || o.w !== f.w || o.d !== f.d || o.type !== f.type) changed.add(f.id)
  }
  if (!proposal.fixtures.length) return json({ error: 'El agente devolvió un local vacío. Probá de nuevo.' }, 502)
  const asked = new Map(proposal.fixtures.map((f) => [f.id, [f.x, f.y] as const]))
  const residual = settle(proposal, changed)
  const nudged = proposal.fixtures.filter((f) => {
    const a = asked.get(f.id)
    return a ? Math.hypot(f.x - a[0], f.y - a[1]) > 0.1 : false
  }).length

  const explanation = str(result.out.explanation, 300, 'Listo.')
  console.log(JSON.stringify({ route: 'redesign', ms: Date.now() - t0, fixtures: proposal.fixtures.length, changed: changed.size, nudged, residual, usage: result.usage }))
  return json({ store: proposal, explanation, nudged, residual, ms: Date.now() - t0 })
}
