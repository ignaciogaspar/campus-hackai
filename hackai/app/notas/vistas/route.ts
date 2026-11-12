/* Tocar una nota nueva en Novedades pasa por acá: guarda que quien entró vio
   sus notas hasta ahora (lib/grades-seen.ts) y lo lleva a Notas. Así la campana
   deja de contarlas. Va en `/notas/vistas` porque `/notas` es la pantalla.
   Se enlaza con un <a> y no con <Link>, para que precargar la página no las
   marque como vistas sin que las toque. */
import { redirect } from 'next/navigation'
import { getSession, setServerCookie } from '@/lib/auth'
import { system } from '@/lib/composition'
import { GRADES_SEEN_COOKIE, GRADES_SEEN_MAX_AGE, seenValue } from '@/lib/grades-seen'

export async function GET() {
  const session = await getSession()
  if (!session) redirect('/')
  await setServerCookie(GRADES_SEEN_COOKIE, seenValue(session.personId, system().now()), GRADES_SEEN_MAX_AGE)
  redirect('/notas')
}
