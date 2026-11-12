/* Cómo se muestran las novedades sin leer que da Espacios: agrupadas por
   materia y, dentro de cada una, una fila por canal con quién publicó lo
   último, el texto, cuándo y a dónde lleva. También los totales de la campana
   (con las notas nuevas) y de cada materia. Sin reglas de negocio: qué está sin leer, de quién es un
   directo y si todo es de un mismo hilo lo dice Espacios. */
import { channelTitle, messageTime, spaceHref } from '@/components/spaces/format'
import type { Author, ChannelKind, Origin, UnreadItem } from '@/lib/core/spaces'

/** Un canal con novedades. */
export type NewsRow = {
  channelId: string
  kind: ChannelKind
  /** «Avisos», «#parciales-viejos» o «Mensaje directo de Mariana Ledesma». */
  title: string
  /** Quién publicó o subió lo último; `null` en un directo, porque lo dice el título, o si no se sabe. */
  author: Author | null
  /** El texto del mensaje, o el nombre del archivo si solo trae un adjunto o es material. */
  text: string
  /** «lun 9/11 13:00». */
  when: string
  createdAt: string
  origin: Origin
  count: number
  /** El canal, o el hilo si todo lo sin leer es de uno. */
  href: string
}

export type SubjectNews = { subjectId: string; subjectName: string; count: number; rows: NewsRow[] }

function rowOf(item: UnreadItem): NewsRow {
  const direct = item.kind === 'directo'
  const thread = direct ? undefined : (item.thread ?? undefined)
  return {
    channelId: item.channelId,
    kind: item.kind,
    title: direct
      ? `Mensaje directo de ${item.counterpart?.name ?? 'Persona sin datos'}`
      : channelTitle(item.kind, item.channelName),
    author: direct ? null : item.latest.author,
    text: item.latest.text,
    when: messageTime(item.latest.createdAt),
    createdAt: item.latest.createdAt,
    origin: item.latest.origin,
    count: item.count,
    href: spaceHref(item.subjectId, { canal: item.channelId, hilo: thread })
  }
}

/** Los tipos de novedad del filtro: los canales libres van juntos como «otros canales». */
export type NewsKind = 'avisos' | 'consultas' | 'material' | 'directos' | 'canales'

export const NEWS_KINDS: { kind: NewsKind; label: string }[] = [
  { kind: 'avisos', label: 'Avisos' },
  { kind: 'consultas', label: 'Consultas' },
  { kind: 'material', label: 'Material' },
  { kind: 'directos', label: 'Directos' },
  { kind: 'canales', label: 'Otros canales' }
]

const KIND_OF: Record<ChannelKind, NewsKind> = {
  avisos: 'avisos',
  consultas: 'consultas',
  material: 'material',
  directo: 'directos',
  libre: 'canales'
}

export const newsKindOf = (kind: ChannelKind): NewsKind => KIND_OF[kind]

/** Por materia, en el orden en que llegan (Espacios las da con lo más nuevo primero). */
export function newsBySubject(items: UnreadItem[]): SubjectNews[] {
  const groups = new Map<string, SubjectNews>()
  for (const item of items) {
    const group = groups.get(item.subjectId) ?? {
      subjectId: item.subjectId,
      subjectName: item.subjectName,
      count: 0,
      rows: []
    }
    group.count += item.count
    group.rows.push(rowOf(item))
    groups.set(item.subjectId, group)
  }
  return [...groups.values()]
}

/** Todo lo sin leer, para la campana. */
export function unreadTotal(items: { count: number }[]): number {
  return items.reduce((n, item) => n + item.count, 0)
}

/** El número de la campana: lo sin leer de los espacios más las notas nuevas del alumno. */
export function newsTotal(items: { count: number }[], newGrades: number): number {
  return unreadTotal(items) + newGrades
}

/** Lo sin leer de cada materia, para la barra lateral y Mis materias. */
export function unreadBySubject(items: { subjectId: string; count: number }[]): Map<string, number> {
  const bySubject = new Map<string, number>()
  for (const item of items) bySubject.set(item.subjectId, (bySubject.get(item.subjectId) ?? 0) + item.count)
  return bySubject
}
