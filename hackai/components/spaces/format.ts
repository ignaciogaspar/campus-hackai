/* Cómo se escriben en las pantallas del espacio las horas, los tamaños, los
   nombres de los canales y los enlaces entre pestañas. Sin reglas de negocio:
   solo formato. Las horas van en la hora de Buenos Aires, con día y hora y sin
   «hoy» ni «hace un rato»: un mensaje se lee igual aunque la pantalla quede
   abierta un rato. */
import type { Channel, ChannelKind, Thread } from '@/lib/core/spaces'

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

/** Avisos, Consultas y Material para los canales por defecto; los que crea un docente, con `#`. */
export function channelTitle(kind: ChannelKind, name: string): string {
  return DEFAULT_NAMES[kind] ?? `#${name}`
}

/** Como `channelTitle`, y un directo con el nombre de la otra persona. Si la
    persona ve canales de más de una comisión, cada uno lleva su comisión:
    «Avisos · A». */
export function channelLabel(channel: Channel, severalSections: boolean): string {
  if (channel.kind === 'directo') return channel.counterpart?.name ?? 'Mensaje directo'
  const base = channelTitle(channel.kind, channel.name)
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

/** Si el canal va en la pestaña Directos y no suelto en el riel. */
export const isDirect = (channel: Channel) => channel.kind === 'directo'

/** El espacio de una materia, como lo necesitan los formularios: la ruta va por materia y el módulo, por espacio. */
export type SpaceRef = { subjectId: string; spaceId: string }

/** Una pieza del riel de canales: un canal, o la pestaña Directos, que junta los canales directos. */
export type RailTab = {
  id: string
  href: string
  label: string
  kind: ChannelKind
  /** A quién llega: «Toda la materia», «Comisión A». */
  audience: string
  unread: number
  selected: boolean
}

/** `?vista=directos` es la lista de mensajes directos; un canal, directo o no, va en `?canal=` con su id. */
export type SpaceQuery = {
  canal?: string
  hilo?: string
  filtro?: string
  nuevo?: 'canal'
  vista?: 'directos'
  /** Lo buscado en el material. */
  buscar?: string
}

/** Donde viven los espacios: `/materias/<id de la materia>`. */
const SPACES_PATH = '/materias'

/** Si `pathname` es el espacio de una materia, sin query: ni la lista de materias ni otra pantalla. */
export function isSpacePath(pathname: string): boolean {
  return pathname.startsWith(`${SPACES_PATH}/`) && /^[^/]+$/.test(pathname.slice(SPACES_PATH.length + 1))
}

/** El enlace a una pestaña, un hilo o un filtro del espacio. */
export function spaceHref(subjectId: string, query: SpaceQuery = {}): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value) params.set(key, value)
  }
  const search = params.toString()
  return `${SPACES_PATH}/${encodeURIComponent(subjectId)}${search ? `?${search}` : ''}`
}

/** En qué está una consulta, con las mismas palabras en el hilo y en el Hoy del docente. */
export type QuestionState = 'sin-responder' | 'respondida' | 'resuelta'

/** «Sin responder» hasta que la última respuesta es de un docente; después, «respondida» hasta que la marcan
    resuelta. Si un alumno repregunta, vuelve a estar sin responder. `null` si el mensaje no es una consulta. */
export function questionState(thread: Thread): QuestionState | null {
  const { question } = thread.message
  if (!question) return null
  if (question.resolved) return 'resuelta'
  return thread.replies.at(-1)?.author.role === 'profesor' ? 'respondida' : 'sin-responder'
}

/** El último mensaje de una lista, y si lo escribió quien mira. */
export type Latest = { id: string; mine: boolean }

/** Lo que queda al pie de una lista de mensajes: el último, o su última
    respuesta, y si lo escribió quien mira. Una respuesta en una consulta vieja
    no cuenta: se ve arriba, en su tarjeta. `null` si no hay mensajes. */
export function latestOf(threads: Thread[], viewerId: string): Latest | null {
  const last = threads.at(-1)
  if (!last) return null
  const message = last.replies.at(-1) ?? last.message
  return { id: message.id, mine: message.author.personId === viewerId }
}
