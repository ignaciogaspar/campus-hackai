import 'server-only'

/* Respuestas del instalador. PowerShell lee JSON; bash pide `Accept: text/plain`
   y recibe líneas clave=valor, así el script no depende de jq ni de un parser. */

export function setupReply(req: Request, body: Record<string, string | number>, status = 200): Response {
  const headers = { 'Cache-Control': 'no-store' }
  if ((req.headers.get('accept') ?? '').includes('text/plain')) {
    const text = Object.entries(body).map(([k, v]) => `${k}=${String(v).replace(/[\r\n]/g, ' ')}`).join('\n') + '\n'
    return new Response(text, { status, headers: { ...headers, 'Content-Type': 'text/plain; charset=utf-8' } })
  }
  return Response.json(body, { status, headers })
}

/** Body JSON o form-urlencoded (curl -d sin depender de armar JSON en bash). */
export async function readSetupBody(req: Request): Promise<Record<string, string>> {
  const type = req.headers.get('content-type') ?? ''
  try {
    if (type.includes('application/json')) {
      const raw = (await req.json()) as Record<string, unknown>
      return Object.fromEntries(Object.entries(raw ?? {}).map(([k, v]) => [k, typeof v === 'string' ? v : '']))
    }
    const form = new URLSearchParams(await req.text())
    return Object.fromEntries(form.entries())
  } catch {
    return {}
  }
}
