/* La oferta de comisiones de una materia ahora es el detalle de Inscripciones:
   esta ruta queda para los enlaces que ya existen y lleva a
   `/inscripciones?materia=…`. */
import { permanentRedirect } from 'next/navigation'
import { subjectIdFrom } from '@/app/(app)/inscripciones/subject-param'

export default async function OfertaPage({ params }: { params: Promise<{ materia: string }> }) {
  const { materia } = await params
  permanentRedirect(`/inscripciones?materia=${encodeURIComponent(subjectIdFrom(materia))}`)
}
