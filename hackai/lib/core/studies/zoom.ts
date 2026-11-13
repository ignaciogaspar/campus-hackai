/* El enlace de Zoom de cada comisión (A4 de Docentes, #109): lo carga una vez
   un docente de la comisión y lo ven los alumnos y el propio docente el día de
   una clase virtual o híbrida. Vive en su archivo para que Cursada sume cada
   operación en una línea.

   - Solo un docente de la comisión carga, cambia o borra el enlace: cualquier
     otro recibe `sin-acceso`, como en las demás operaciones del docente.
   - El enlace tiene que ser `https://`. Vacío lo borra.
   - Se guarda en el almacén de Cursada, no en el SIU. */
import type { People, PersonId } from '@/lib/core/people'
import { type SectionStudentsError, teacherOfSection } from '@/lib/core/studies/section-students'
import type { StudiesStore } from '@/lib/core/studies/store'
import type { SiuPort, SiuSection } from '@/lib/ports/siu'
import { fail, ok, type Result } from '@/lib/result'

export type ZoomError = SectionStudentsError | 'enlace-invalido'

/** Solo las clases virtuales o híbridas se dan por Zoom. */
export const hasZoom = (modality: SiuSection['modality']) => modality === 'virtual' || modality === 'hibrida'

/** El enlace normalizado, `null` si está vacío (se borra) o `undefined` si no es un enlace `https://` válido. */
function normalized(raw: string): string | null | undefined {
  const text = raw.trim()
  if (text === '') return null
  try {
    const url = new URL(text)
    return url.protocol === 'https:' && url.hostname.includes('.') ? url.toString() : undefined
  } catch {
    return undefined
  }
}

export function createZoom({ people, siu, store }: { people: People; siu: SiuPort; store: StudiesStore }) {
  /** Los enlaces cargados de esas comisiones, por id de comisión. Si el almacén no responde, ninguna tiene: las
      pantallas salen igual, sin el botón de Zoom. */
  async function linksOf(sectionIds: string[]): Promise<Record<string, string>> {
    const found = await store.zoomLinks(sectionIds)
    return found.ok ? found.value : {}
  }

  async function setZoomLink(
    personId: PersonId,
    sectionId: string,
    raw: string
  ): Promise<Result<string | null, ZoomError>> {
    const teacher = await teacherOfSection({ people, siu }, personId, sectionId)
    if (!teacher.ok) return teacher
    const url = normalized(raw)
    if (url === undefined) return fail('enlace-invalido')
    const saved = await store.setZoomLink(sectionId, url)
    return saved.ok ? ok(url) : fail('falla-externa')
  }

  return { linksOf, setZoomLink }
}
