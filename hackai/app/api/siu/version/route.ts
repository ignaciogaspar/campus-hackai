/* La huella de lo que el SIU real muestra de la persona que entró, para que su
   pantalla abierta se redibuje sola cuando algo cambia
   (components/siu/siu-live.tsx). Responde `{ version }`: solo dice si cambió,
   nunca qué. Con otra persona, o sin `HACKAI_SIU_REAL=si`, `{ version: null }`:
   lo simulado no cambia por fuera de HackAI. Sin sesión, `401`; si la sesión
   del SIU venció, `401` con `sesion-vencida`, y la pantalla manda a volver a
   entrar. */
import { apiSession } from '@/lib/auth'
import { system } from '@/lib/composition'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await apiSession()
  if (session instanceof Response) return session

  const version = await system().siuLive?.version(session.personId)
  if (!version) return Response.json({ version: null })
  if (!version.ok) return Response.json({ error: version.error }, { status: 502 })
  return Response.json({ version: version.value }, { headers: { 'Cache-Control': 'no-store' } })
}
