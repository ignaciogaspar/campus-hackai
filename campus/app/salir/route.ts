import { NextResponse } from 'next/server'
import { bumpSessionVersion, getSession } from '@/lib/auth'
import { SESSION_COOKIE } from '@/lib/session-token'

export const dynamic = 'force-dynamic'

/** GET /salir: revoca la sesión (en todos los dispositivos), borra la cookie y vuelve al ingreso. */
export async function GET(request: Request) {
  const session = await getSession()
  if (session) await bumpSessionVersion(session.personId)
  const res = NextResponse.redirect(new URL('/', request.url))
  res.cookies.delete(SESSION_COOKIE)
  return res
}
