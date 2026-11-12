/* La versión de un canal, para que la pantalla abierta sepa si hay algo nuevo
   sin volver a armarse entera (components/spaces/channel-updates.tsx). Trae lo
   nuevo del canal externo, con el mismo espaciado que abrir el espacio, y
   responde `{ version }`.

   Pide sesión, pero no chequea que la persona vea el canal: eso obliga a
   preguntarle a Cursada (y al SIU) en cada chequeo, que es justo lo que se
   evita. La versión solo dice si el canal cambió, nunca qué tiene, y los ids
   de canal no se pueden adivinar. Lo que hay adentro se lee con la página,
   que sí chequea. */
import { getSession } from '@/lib/auth'
import { system } from '@/lib/composition'

export const dynamic = 'force-dynamic'

export async function GET(_request: Request, { params }: { params: Promise<{ canal: string }> }) {
  const session = await getSession()
  if (!session) return Response.json({ error: 'sin-sesion' }, { status: 401 })

  const { canal } = await params
  const version = await system().spaces.version(canal)
  if (!version.ok) {
    return Response.json({ error: version.error }, { status: version.error === 'canal-desconocido' ? 404 : 502 })
  }
  return Response.json({ version: version.value }, { headers: { 'Cache-Control': 'no-store' } })
}
