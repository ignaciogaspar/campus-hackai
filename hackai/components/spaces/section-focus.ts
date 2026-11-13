/* El espacio del docente que dicta más de una comisión de la materia: la
   comisión elegida en el selector gobierna el riel de canales y el canal que se
   abre, así no publica en una comisión creyendo que está en otra.
   - La comisión elegida es la del canal abierto, si es de una del selector;
     si no, la de `?comision=`; si no, la primera.
   - El riel deja afuera los canales de las otras comisiones del selector. Los
     de la materia, los directos y los de comisiones que no están en el
     selector (las archivadas) quedan.
   - Sin `?canal=`, se abren los Avisos de la comisión elegida.
   Con una sola comisión, o para el alumno, el riel queda entero. Sin reglas de
   negocio: qué canales ve cada uno lo decide Espacios. */
import type { Channel } from '@/lib/core/spaces'

export type SectionFocus = {
  /** La comisión elegida, o `null` si no hay selector de comisiones (el alumno). */
  sectionId: string | null
  /** Los canales del riel, en el orden en que vienen. */
  channels: Channel[]
  /** El canal a abrir, o `null` si el espacio no tiene ninguno. */
  channelId: string | null
}

const sectionOf = (channel: Channel | undefined): string | null =>
  channel?.scope.kind === 'comision' ? channel.scope.sectionId : null

/** `sections`: las comisiones del selector, en orden (las vigentes que dicta el docente). */
export function focusSection(
  channels: Channel[],
  sections: string[],
  query: { canal?: string; comision?: string }
): SectionFocus {
  const fromChannel = sectionOf(channels.find((c) => c.id === query.canal))
  const sectionId =
    [fromChannel, query.comision].find((id): id is string => !!id && sections.includes(id)) ?? sections[0] ?? null
  const shown =
    sections.length > 1
      ? channels.filter((c) => {
          const own = sectionOf(c)
          return own === null || own === sectionId || !sections.includes(own)
        })
      : channels
  const announcements = shown.find((c) => c.kind === 'avisos' && sectionOf(c) === sectionId)
  return { sectionId, channels: shown, channelId: query.canal ?? announcements?.id ?? shown[0]?.id ?? null }
}
