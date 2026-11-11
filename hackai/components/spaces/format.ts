/* Cómo se escriben en las pantallas del espacio las horas, los tamaños, los
   nombres de los canales y los enlaces entre pestañas. Sin reglas de negocio:
   solo formato. Las horas van en la hora de Buenos Aires, sin «hoy» ni «hace
   un rato», porque la demo corre con el reloj fijo de Espacios. */
import type { Channel, ChannelKind } from '@/lib/core/spaces'

const TIME_ZONE = 'America/Argentina/Buenos_Aires'

/** «lun 9/11 18:05». */
export function messageTime(iso: string): string {
  const date = new Date(iso)
  const day = date.toLocaleDateString('es-AR', { timeZone: TIME_ZONE, weekday: 'short' }).replace('.', '')
  const dayMonth = date.toLocaleDateString('es-AR', { timeZone: TIME_ZONE, day: 'numeric', month: 'numeric' })
  const time = date.toLocaleTimeString('es-AR', {
    timeZone: TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  })
  return `${day} ${dayMonth} ${time}`
}

/** «9/11», para el material. */
export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', { timeZone: TIME_ZONE, day: 'numeric', month: 'numeric' })
}

/** «52 KB», «1,2 MB». */
export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toLocaleString('es-AR', { maximumFractionDigits: 1 })} MB`
}

/** La sigla del tipo de archivo, para el cuadradito de la izquierda: PDF, DOCX, LINK. */
export function fileKind(name: string, contentType: string): string {
  const ext = name.includes('.') ? name.split('.').pop() : ''
  if (ext && ext.length <= 4) return ext.toUpperCase()
  if (contentType === 'text/uri-list') return 'LINK'
  const subtype = contentType.split('/').pop()?.split(/[.+-]/).pop() ?? ''
  return subtype && subtype.length <= 4 ? subtype.toUpperCase() : 'ARCH'
}

/** Dos letras para el avatar: la del nombre y la del apellido. Un usuario de Discord da una sola. */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  const letters = words.length > 1 ? [words[0], words[words.length - 1]] : words
  return (
    letters
      .map((w) => w.charAt(0))
      .join('')
      .toUpperCase() || '?'
  )
}

const DEFAULT_NAMES: Partial<Record<ChannelKind, string>> = {
  avisos: 'Avisos',
  consultas: 'Consultas',
  material: 'Material'
}

/** Avisos, Consultas y Material para los canales por defecto; los que crea un
    docente, con `#`; un directo, con el nombre de la otra persona. Si la
    persona ve canales de más de una comisión, cada uno lleva su comisión:
    «Avisos · A». */
export function channelLabel(channel: Channel, severalSections: boolean): string {
  if (channel.kind === 'directo') return channel.counterpart?.name ?? 'Mensaje directo'
  const base = DEFAULT_NAMES[channel.kind] ?? `#${channel.name}`
  return severalSections && channel.sectionName ? `${base} · ${channel.sectionName}` : base
}

/** A quién le llega lo que se publica en el canal: «Toda la materia», «Comisión A». */
export function channelAudience(channel: Channel): string {
  if (channel.scope.kind === 'materia') return 'Toda la materia'
  if (channel.scope.kind === 'directo') return 'Mensaje directo'
  return `Comisión ${channel.sectionName ?? ''}`.trim()
}

/** Si los canales que ve la persona son de más de una comisión. */
export function hasSeveralSections(channels: Channel[]): boolean {
  const sections = new Set(channels.flatMap((c) => (c.scope.kind === 'comision' ? [c.scope.sectionId] : [])))
  return sections.size > 1
}

/** El valor de `?canal=` de la pestaña Directos, que junta los canales directos. Ningún canal tiene este id. */
export const DIRECTS_TAB = 'directos'

/** Si el canal va en la pestaña Directos y no suelto en el riel. */
export const isDirect = (channel: Channel) => channel.kind === 'directo'

export type SpaceQuery = { canal?: string; hilo?: string; filtro?: string; nuevo?: 'canal' }

/** El enlace a una pestaña, un hilo o un filtro del espacio. */
export function spaceHref(subjectId: string, query: SpaceQuery = {}): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value) params.set(key, value)
  }
  const search = params.toString()
  return `/materias/${encodeURIComponent(subjectId)}${search ? `?${search}` : ''}`
}
