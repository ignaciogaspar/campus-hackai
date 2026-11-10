/* Servidor HTTP mínimo para probar el MCP sin levantar Next (no toca .next).
   set -a; source .env.local; set +a
   npx tsx --conditions=react-server lib/mcp/dev/serve.ts 3199
   Rutas: POST /api/mcp (Bearer) y POST /api/mcp/<token>. */
import { createServer } from 'node:http'
import { handleMcpGet, handleMcpOptions, handleMcpPost } from '@/lib/mcp/server'

const port = Number(process.argv[2] ?? 3199)

createServer(async (req, res) => {
  const chunks: Buffer[] = []
  for await (const c of req) chunks.push(c as Buffer)
  const url = new URL(req.url ?? '/', `http://localhost:${port}`)
  const headers = new Headers()
  for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v)
  const request = new Request(url, { method: req.method, headers, body: req.method === 'POST' ? Buffer.concat(chunks) : undefined })
  const m = /^\/api\/mcp(?:\/([^/]+))?\/?$/.exec(url.pathname)
  let response: Response
  if (!m) response = new Response('not found', { status: 404 })
  else if (req.method === 'POST') response = await handleMcpPost(request, m[1] ? decodeURIComponent(m[1]) : undefined)
  else if (req.method === 'OPTIONS') response = handleMcpOptions()
  else response = handleMcpGet()
  res.writeHead(response.status, Object.fromEntries(response.headers.entries()))
  res.end(Buffer.from(await response.arrayBuffer()))
}).listen(port, () => console.log(`MCP dev en http://localhost:${port}/api/mcp`))
