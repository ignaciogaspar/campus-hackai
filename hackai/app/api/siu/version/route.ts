/* La huella de lo que el SIU real muestra de la persona que entró, para que su
   pantalla abierta se redibuje sola cuando algo cambia
   (components/siu/siu-live.tsx). Responde `{ version }`: solo dice si cambió,
   nunca qué. Con otra persona, o sin `HACKAI_SIU_REAL=si`, `{ version: null }`:
   lo simulado no cambia por fuera de HackAI. */
import { getSession } from '@/lib/auth'
import { system } from '@/lib/composition'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getSession()
  if (!session) return Response.json({ error: 'sin-sesion' }, { status: 401 })

  const version = await system().siuLive?.version(session.personId)
  if (!version) return Response.json({ version: null })
  if (!version.ok) return Response.json({ error: version.error }, { status: 502 })
  return Response.json({ version: version.value }, { headers: { 'Cache-Control': 'no-store' } })
}
