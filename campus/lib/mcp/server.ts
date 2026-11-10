import 'server-only'
import { db } from '@/lib/db'
import { bearerFrom, resolveToken, type McpCaller } from './tokens'
import { ALUMNO_TOOLS } from './tools/alumno'
import { PROFESOR_TOOLS } from './tools/profesor'
import { ToolError, type ToolDef } from './types'

/* Servidor MCP sobre HTTP streamable, stateless, implementado a mano:
   cada POST trae un mensaje JSON-RPC 2.0 (o un lote) y se responde con
   application/json. No hay SSE (GET devuelve 405) ni Mcp-Session-Id. */

export const SUPPORTED_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05']
const LATEST = SUPPORTED_VERSIONS[0]
const SERVER_INFO = { name: 'campus-austral', title: 'Campus Austral · AI-Centric Management', version: '0.1.0' }

interface JsonRpcRequest {
  jsonrpc: '2.0'
  id?: string | number | null
  method: string
  params?: Record<string, unknown>
}

type JsonRpcResponse =
  | { jsonrpc: '2.0'; id: string | number | null; result: unknown }
  | { jsonrpc: '2.0'; id: string | number | null; error: { code: number; message: string; data?: unknown } }

const err = (id: JsonRpcRequest['id'], code: number, message: string): JsonRpcResponse => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } })

export function toolsFor(caller: McpCaller): ToolDef[] {
  return caller.role === 'profesor' ? PROFESOR_TOOLS : ALUMNO_TOOLS
}

function instructions(caller: McpCaller): string {
  const p = caller.person
  return caller.role === 'profesor'
    ? `Estás conectado al campus de AI-Centric Management (IAE, Universidad Austral) como ${p.full_name} (profesor). Podés leer y editar decks (DSL de slides), ver qué entendió la cohorte por slide, posturas de casos, participación y entregas, armar un plan de cold call y publicar avisos. Los alumnos de la cohorte demo y los casos (Pampa Sur, etc.) son ficticios. Respondé en español rioplatense.`
    : `Estás conectado al campus de AI-Centric Management (IAE, Universidad Austral) como ${p.full_name} (alumno). Podés ver tus pendientes, leer las clases con tus notas, leer casos y tomar postura, entregar trabajos y pedir el contexto de una slide para pensarla. Solo ves tus propios datos. Actuá como tutor socrático: ayudá a pensar, no hagas el trabajo por el alumno. Respondé en español rioplatense.`
}

function toolListing(t: ToolDef) {
  return {
    name: t.name,
    title: t.title,
    description: t.description,
    inputSchema: t.inputSchema,
    annotations: { title: t.title, readOnlyHint: Boolean(t.readOnly), destructiveHint: false, openWorldHint: false },
  }
}

async function logTurn(caller: McpCaller, name: string, args: unknown, reply: string | null, error: string | null, startedAt: number) {
  const input = JSON.stringify(args ?? {})
  await db().from('agent_turns').insert({
    person_id: caller.person.id,
    surface: 'mcp',
    utterance: `${name} ${input.length > 2000 ? `${input.slice(0, 2000)}…` : input}`,
    tool_calls: [{ name, input: args ?? {}, ok: !error, role: caller.role, tokenId: caller.tokenId }],
    reply: reply && reply.length > 4000 ? `${reply.slice(0, 4000)}…` : reply,
    error,
    latency_ms: Date.now() - startedAt,
  }).then(({ error: e }) => { if (e) console.error('[mcp] agent_turns:', e.message) })
}

async function callTool(caller: McpCaller, origin: string, params: Record<string, unknown> | undefined) {
  const name = typeof params?.name === 'string' ? params.name : ''
  const args = (params?.arguments && typeof params.arguments === 'object' ? params.arguments : {}) as Record<string, unknown>
  const tool = toolsFor(caller).find((t) => t.name === name)
  if (!tool) return null
  const startedAt = Date.now()
  try {
    const result = await tool.run(args, { caller, origin })
    const text = JSON.stringify(result, null, 2)
    await logTurn(caller, name, args, text, null, startedAt)
    return { content: [{ type: 'text', text }], structuredContent: result as Record<string, unknown>, isError: false }
  } catch (e) {
    const known = e instanceof ToolError
    const message = known ? e.message : 'Error interno del campus. Probá de nuevo o avisale al profesor.'
    if (!known) console.error(`[mcp] ${name}:`, e)
    await logTurn(caller, name, args, null, known ? message : String((e as Error)?.message ?? e), startedAt)
    return { content: [{ type: 'text', text: message }], isError: true }
  }
}

async function handleOne(msg: unknown, caller: McpCaller, origin: string): Promise<JsonRpcResponse | null> {
  if (!msg || typeof msg !== 'object' || (msg as JsonRpcRequest).jsonrpc !== '2.0' || typeof (msg as JsonRpcRequest).method !== 'string') {
    // Respuestas del cliente (sin method) no esperan nada.
    if (msg && typeof msg === 'object' && 'id' in msg && ('result' in msg || 'error' in msg)) return null
    return err((msg as JsonRpcRequest)?.id ?? null, -32600, 'Invalid Request')
  }
  const req = msg as JsonRpcRequest
  const isNotification = req.id === undefined
  if (isNotification) return null

  switch (req.method) {
    case 'initialize': {
      const asked = typeof req.params?.protocolVersion === 'string' ? req.params.protocolVersion : LATEST
      return {
        jsonrpc: '2.0', id: req.id ?? null, result: {
          protocolVersion: SUPPORTED_VERSIONS.includes(asked) ? asked : LATEST,
          capabilities: { tools: { listChanged: false } },
          serverInfo: SERVER_INFO,
          instructions: instructions(caller),
        },
      }
    }
    case 'ping':
      return { jsonrpc: '2.0', id: req.id ?? null, result: {} }
    case 'tools/list':
      return { jsonrpc: '2.0', id: req.id ?? null, result: { tools: toolsFor(caller).map(toolListing) } }
    case 'tools/call': {
      const result = await callTool(caller, origin, req.params)
      if (!result) return err(req.id, -32602, `Herramienta desconocida: ${String(req.params?.name)}`)
      return { jsonrpc: '2.0', id: req.id ?? null, result }
    }
    case 'resources/list':
      return { jsonrpc: '2.0', id: req.id ?? null, result: { resources: [] } }
    case 'prompts/list':
      return { jsonrpc: '2.0', id: req.id ?? null, result: { prompts: [] } }
    default:
      return err(req.id, -32601, `Method not found: ${req.method}`)
  }
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-ID',
  'Access-Control-Expose-Headers': 'Mcp-Session-Id, WWW-Authenticate',
}

function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...CORS, ...extra } })
}

export function publicOrigin(req: Request): string {
  const h = req.headers
  const host = h.get('x-forwarded-host') ?? h.get('host')
  const proto = h.get('x-forwarded-proto') ?? (host?.startsWith('localhost') || host?.startsWith('127.') ? 'http' : 'https')
  return host ? `${proto}://${host}` : new URL(req.url).origin
}

/** POST /api/mcp (token en Authorization) o /api/mcp/<token> (token en la URL). */
export async function handleMcpPost(req: Request, urlToken?: string): Promise<Response> {
  const token = urlToken ?? bearerFrom(req.headers.get('authorization'))
  const caller = await resolveToken(token)
  if (!caller) {
    return json(err(null, -32001, 'Token inválido o revocado. Creá uno en /profesor/tokens o /campus/tokens.'), 401, {
      'WWW-Authenticate': 'Bearer realm="campus-austral", error="invalid_token"',
    })
  }
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return json(err(null, -32700, 'Parse error'), 400)
  }
  const origin = publicOrigin(req)
  if (Array.isArray(body)) {
    if (!body.length) return json(err(null, -32600, 'Invalid Request'), 400)
    const out = (await Promise.all(body.map((m) => handleOne(m, caller, origin)))).filter((r): r is JsonRpcResponse => r !== null)
    return out.length ? json(out) : new Response(null, { status: 202, headers: CORS })
  }
  const res = await handleOne(body, caller, origin)
  return res ? json(res) : new Response(null, { status: 202, headers: CORS })
}

export function handleMcpOptions(): Response {
  return new Response(null, { status: 204, headers: CORS })
}

/** Sin SSE: el servidor es stateless. */
export function handleMcpGet(): Response {
  return new Response('Este servidor MCP no ofrece stream SSE: usá POST.', { status: 405, headers: { ...CORS, Allow: 'POST, OPTIONS' } })
}
