/* Entrega un archivo del Campus Virtual a quien lo abre, pedido a Moodle con
   el token de su propia cuenta (ADR 0010): el token nunca llega al navegador
   y el archivo no se guarda. Es la URL que arma el Moodle real para cada
   archivo del aula (`/aula/archivos/<ruta en pluginfile.php>`), así un PDF se
   ve dentro de HackAI. Pedirlo no cuenta como una vista en el aula.

   Sin sesión lleva al ingreso, que después vuelve acá. Una persona sin su
   Campus conectado, o un archivo que su cuenta no ve, dan la misma página de
   «no disponible». Los headers de seguridad y de caché son los de los archivos
   guardados: lib/file-delivery.ts. */
import { getSession } from '@/lib/auth'
import { system } from '@/lib/composition'
import { deliverFile } from '@/lib/file-delivery'
import { fail } from '@/lib/result'

export const dynamic = 'force-dynamic'

export async function GET(request: Request, { params }: { params: Promise<{ ruta: string[] }> }) {
  const [session, { ruta }] = await Promise.all([getSession(), params])
  // Next da cada tramo ya decodificado: se vuelve a codificar para pedírselo a Moodle tal como lo dio.
  const path = ruta.map(encodeURIComponent).join('/')
  return deliverFile(
    request,
    { id: path, name: ruta.at(-1) ?? 'archivo' },
    {
      personId: session?.personId ?? null,
      file: async (personId, id) => (await system().campusLive?.file(personId, id)) ?? fail('sin-acceso')
    }
  )
}
