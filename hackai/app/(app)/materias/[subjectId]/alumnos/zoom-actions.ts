'use server'
/* Cargar el enlace de Zoom de una comisión. Acá se traduce lo que devuelve
   Cursada a un estado que la pantalla sabe mostrar; quién puede cargarlo y que
   sea `https://` son de Cursada. */
import { revalidatePath } from 'next/cache'
import type { ZoomState } from '@/components/subjects/zoom-form'
import { requireSession } from '@/lib/auth'
import { system } from '@/lib/composition'
import type { StudiesReadError, ZoomError } from '@/lib/core/studies'
import { formText } from '@/lib/form-data'

const ERRORS: Record<ZoomError | StudiesReadError, string> = {
  'falla-externa': 'No pudimos guardar el enlace. Probá de nuevo en un rato.',
  'persona-desconocida': 'No encontramos tus datos en el SIU. Salí y volvé a entrar.',
  'sin-acceso': 'Solo los docentes de la comisión cargan el enlace de Zoom.',
  'enlace-invalido': 'El enlace tiene que empezar con https://, como el que te da Zoom.',
  'no-implementado': 'Esta función todavía no está disponible.'
}

export async function saveZoomLinkAction(_prev: ZoomState, formData: FormData): Promise<ZoomState> {
  const session = await requireSession('profesor')
  const result = await system().studies.setZoomLink(
    session.personId,
    formText(formData, 'comision'),
    formText(formData, 'enlace')
  )
  if (!result.ok) return { kind: 'error', message: ERRORS[result.error] }

  // La tarjeta de la materia y el calendario del alumno cambiaron, y Hoy del docente.
  revalidatePath('/materias', 'layout')
  revalidatePath('/calendario')
  revalidatePath('/hoy')
  return { kind: 'guardado', url: result.value }
}
