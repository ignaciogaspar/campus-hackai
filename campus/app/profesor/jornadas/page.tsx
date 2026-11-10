import { redirect } from 'next/navigation'
import { routes } from '@/lib/routes'

// Las jornadas viven en el inicio.
export default function JornadasProfesor() {
  redirect(`${routes.profesor}#jornadas`)
}
