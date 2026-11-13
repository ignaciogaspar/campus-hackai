/* Tocar un cambio de clase en Novedades pasa por acá: con `?cambio=` (su id
   corto, lib/class-changes-seen.ts) lo marca visto y abre el Planning en ese
   día y esa materia (`?dia=` y `?materia=`), así la campana deja de contarlo.
   Se enlaza con un <a> y no con <Link>, para que precargar la página no lo
   marque visto sin que lo toque. */
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { NextRequest } from 'next/server'
import { requireSession, setServerCookie } from '@/lib/auth'
import { CLASS_CHANGES_SEEN_COOKIE, CLASS_CHANGES_SEEN_MAX_AGE, withSeenChanges } from '@/lib/class-changes-seen'

const DAY = /^\d{4}-\d{2}-\d{2}$/

export async function GET(request: NextRequest) {
  const session = await requireSession()
  const params = request.nextUrl.searchParams
  const key = params.get('cambio')
  if (key && /^[0-9a-z]{1,8}$/.test(key)) {
    const current = (await cookies()).get(CLASS_CHANGES_SEEN_COOKIE)?.value
    await setServerCookie(
      CLASS_CHANGES_SEEN_COOKIE,
      withSeenChanges(current, session.personId, [key]),
      CLASS_CHANGES_SEEN_MAX_AGE
    )
  }
  const target = new URLSearchParams()
  const day = params.get('dia')
  const subject = params.get('materia')
  if (day && DAY.test(day)) target.set('dia', day)
  if (subject) target.set('materia', subject.slice(0, 120))
  redirect(target.size > 0 ? `/planning?${target}` : '/planning')
}
