/* Las mesas de una materia ahora son la pestaña de exámenes de Inscripciones:
   esta ruta queda para los enlaces que ya existen (Hoy, Mis materias) y lleva a
   `/inscripciones?tab=examenes&materia=…`. */
import { permanentRedirect } from 'next/navigation'
import { subjectIdFrom } from '@/app/(app)/inscripciones/subject-param'

export default async function MesasPage({ params }: { params: Promise<{ materia: string }> }) {
  const { materia } = await params
  permanentRedirect(`/inscripciones?tab=examenes&materia=${encodeURIComponent(subjectIdFrom(materia))}`)
}
