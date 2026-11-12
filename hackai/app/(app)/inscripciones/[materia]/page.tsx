/* La oferta de una materia ahora es el detalle de Inscripciones: esta ruta
   queda para los enlaces viejos y lleva a `/inscripciones?materia=…`. */
import { permanentRedirect } from 'next/navigation'

export default async function OfertaPage({ params }: { params: Promise<{ materia: string }> }) {
  const { materia } = await params
  permanentRedirect(`/inscripciones?materia=${encodeURIComponent(decodeURIComponentSafe(materia))}`)
}

/** Un `%` mal formado no es una materia: va a la lista. */
function decodeURIComponentSafe(segment: string): string {
  try {
    return decodeURIComponent(segment)
  } catch {
    return ''
  }
}
