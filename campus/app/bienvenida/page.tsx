import { redirect } from 'next/navigation'
import { requireSession } from '@/lib/auth'
import { routes } from '@/lib/routes'

/* Atajo: la bienvenida vive adentro del marco de cada rol. */
export default async function BienvenidaAtajo() {
  const session = await requireSession()
  redirect(session.role === 'profesor' ? routes.profesorBienvenida : routes.campusBienvenida)
}
