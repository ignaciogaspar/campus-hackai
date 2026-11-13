/* Tocar una nota nueva en Novedades pasa por acá: con `?nota=` (su id corto,
   lib/grades-seen.ts) marca vista solo esa y abre su materia en Notas, con la
   evaluación resaltada (`?materia=` y `?evaluacion=`); sin `?nota=` («Ver
   todas»), guarda que vio todas hasta ahora y lleva a Notas. Así la campana
   deja de contarlas. Va en `/notas/vistas` porque `/notas` es la pantalla.
   Se enlaza con un <a> y no con <Link>, para que precargar la página no las
   marque como vistas sin que las toque. */
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { NextRequest } from 'next/server'
import { requireSession, setServerCookie } from '@/lib/auth'
import { system } from '@/lib/composition'
import { GRADES_SEEN_COOKIE, GRADES_SEEN_MAX_AGE, seenValue, withSeen } from '@/lib/grades-seen'

export async function GET(request: NextRequest) {
  const session = await requireSession()
  const params = request.nextUrl.searchParams
  const key = params.get('nota')
  if (!key) {
    await setServerCookie(GRADES_SEEN_COOKIE, seenValue(session.personId, system().now()), GRADES_SEEN_MAX_AGE)
    redirect('/notas')
  }
  const current = (await cookies()).get(GRADES_SEEN_COOKIE)?.value
  await setServerCookie(GRADES_SEEN_COOKIE, withSeen(current, session.personId, [key]), GRADES_SEEN_MAX_AGE)
  const target = new URLSearchParams()
  for (const name of ['materia', 'evaluacion']) {
    const value = params.get(name)
    if (value) target.set(name, value)
  }
  redirect(target.size > 0 ? `/notas?${target}` : '/notas')
}
