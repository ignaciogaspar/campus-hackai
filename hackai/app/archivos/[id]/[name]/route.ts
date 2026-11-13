/* Entrega un archivo guardado (material de un espacio, adjunto de un mensaje)
   a quien lo puede ver. Es la URL que devuelve el puerto de Archivos: el bucket
   es privado y el navegador nunca va directo a Supabase.

   Sin sesión lleva al ingreso, que después vuelve acá. Con sesión le pide el
   archivo a Espacios, que chequea que la persona vea el espacio del material
   o el canal del adjunto; si no es de Espacios, a Seguimiento, que chequea que
   vea la tarea de la consigna. Qué responde en cada caso y con qué headers de
   seguridad y de caché: lib/file-delivery.ts. */
import { getSession } from '@/lib/auth'
import { system } from '@/lib/composition'
import { deliverFile, fileFrom } from '@/lib/file-delivery'

export const dynamic = 'force-dynamic'

export async function GET(request: Request, { params }: { params: Promise<{ id: string; name: string }> }) {
  const [session, target] = await Promise.all([getSession(), params])
  // El sistema se arma recién con sesión: un pedido sin sesión no toca nada.
  return deliverFile(request, target, {
    personId: session?.personId ?? null,
    file: (personId, fileId) => fileFrom(system())(personId, fileId)
  })
}
