/* Académico pasó a llamarse Notas (las constancias están en Trámites y el
   promedio, en Plan de estudios). La ruta vieja sigue andando. */
import { permanentRedirect } from 'next/navigation'

export default function AcademicoPage() {
  permanentRedirect('/notas')
}
