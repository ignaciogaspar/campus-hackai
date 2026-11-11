/* Lo que el docente todavía publica en Moodle, traído al espacio para que la
   adopción sea gradual:
   - Los avisos del foro de Avisos llegan a `#avisos` de cada comisión, desde
     los cursos de esa comisión, con el autor que vincula Personas y los
     adjuntos como enlaces a Moodle.
   - Los recursos de los cursos de todas las comisiones del espacio van al
     material de la materia, como enlaces y en la sección de su tema.
   Cada cosa guarda origen `moodle` y su id de Moodle, y no entra dos veces.
   Entra en el orden en que se publicó en Moodle.

   Traer de Moodle nunca corta la apertura del espacio: si Moodle, Personas o
   el almacén no responden, se saltea lo que no se pudo traer y entra en la
   próxima. Se registran solo ids, nunca textos ni nombres. Lo llama `open`;
   la corrida periódica de #15 lo puede llamar igual. */
import type { People } from '@/lib/core/people'
import type { SpacesStore, StoredChannel, StoredMaterial, StoredMessage, StoredSpace } from '@/lib/core/spaces'
import type { ClassroomAnnouncement, ClassroomContent, ClassroomPort } from '@/lib/ports/classroom'

export type ClassroomImportDeps = { classroom: ClassroomPort; people: People; store: SpacesStore }

type CourseIds = Map<string, string[]>

function warn(what: string, ids: Record<string, string>) {
  console.warn(`moodle: ${what}`, ids)
}

const sectionOf = (channel: StoredChannel) => (channel.scope.kind === 'comision' ? channel.scope.sectionId : null)

/** Del más viejo al más nuevo: lo que entra al almacén se ordena por llegada, así lo más nuevo queda primero. */
const byDate =
  <T>(dateOf: (item: T) => string) =>
  (a: T, b: T) =>
    Date.parse(dateOf(a)) - Date.parse(dateOf(b))

/** Los cursos de Moodle de cada comisión. Una comisión cuyo curso no se pudo leer queda sin cursos. */
async function coursesBySection(classroom: ClassroomPort, sectionIds: string[]): Promise<CourseIds> {
  const found = await Promise.all(sectionIds.map((id) => classroom.coursesForSection(id)))
  return new Map(
    sectionIds.map((sectionId, i) => {
      const courses = found[i]
      if (courses.ok) return [sectionId, courses.value.map((c) => c.id)]
      warn('no se pudieron leer los cursos de la comisión', { sectionId, error: courses.error })
      return [sectionId, []]
    })
  )
}

async function announcementsOf(classroom: ClassroomPort, courseId: string): Promise<ClassroomAnnouncement[]> {
  const read = await classroom.announcements(courseId)
  if (read.ok) return read.value
  warn('no se pudieron leer los avisos del curso', { courseId, error: read.error })
  return []
}

/** El aviso como mensaje del canal, con su autor de HackAI si Personas lo vincula. */
async function toStored(
  people: People,
  channel: StoredChannel,
  aviso: ClassroomAnnouncement
): Promise<Omit<StoredMessage, 'id' | 'seq'> | null> {
  const author = await people.byExternalAccount('moodle', aviso.authorId)
  if (!author.ok) {
    warn('no se pudo vincular al autor del aviso', { announcementId: aviso.id, error: author.error })
    return null
  }
  return {
    channelId: channel.id,
    authorId: author.value,
    authorName: null,
    text: `${aviso.subject}\n\n${aviso.message}`,
    // Las URLs de Moodle no vencen, a diferencia de las de Discord: el adjunto queda como enlace.
    attachments: aviso.attachments.map(({ name, contentType, size, url }) => ({
      name,
      contentType,
      size,
      url,
      fileId: null
    })),
    origin: 'moodle',
    externalId: aviso.id,
    status: 'publicado',
    replyTo: null,
    resolved: null,
    createdAt: aviso.createdAt
  }
}

/** Lo de cada curso, leído una sola vez aunque el curso sea de dos comisiones. */
async function perCourse<T>(courseIds: string[], read: (courseId: string) => Promise<T[]>): Promise<Map<string, T[]>> {
  const unique = [...new Set(courseIds)]
  const found = await Promise.all(unique.map(read))
  return new Map(unique.map((id, i) => [id, found[i]]))
}

/** Un id de Moodle dentro de un canal o de un espacio. */
const keyOf = (scope: string, externalId: string) => `${scope} ${externalId}`

/** Lo que ya se trajo de Moodle, para no pedir de nuevo el autor ni intentar guardarlo dos veces. */
function knownIds<T extends { origin: string; externalId: string | null }>(
  items: T[],
  scopeOf: (item: T) => string
): Set<string> {
  return new Set(
    items.flatMap((item) =>
      item.origin === 'moodle' && item.externalId ? [keyOf(scopeOf(item), item.externalId)] : []
    )
  )
}

/** Guarda el aviso; `duplicado` es que otro lo guardó antes, y no es un error. */
async function addAnnouncement(
  { people, store }: ClassroomImportDeps,
  channel: StoredChannel,
  aviso: ClassroomAnnouncement
): Promise<void> {
  const message = await toStored(people, channel, aviso)
  if (!message) return
  const added = await store.addMessage(message)
  if (!added.ok && added.error !== 'duplicado') warn('no se pudo guardar el aviso', { announcementId: aviso.id })
}

/** Cada `#avisos` recibe los avisos de los cursos de su comisión. */
async function importAnnouncements(
  deps: ClassroomImportDeps,
  space: StoredSpace,
  channels: StoredChannel[],
  courses: CourseIds
): Promise<void> {
  const avisos = channels.filter((c) => c.kind === 'avisos')
  if (avisos.length === 0) return
  const stored = await deps.store.messages(avisos.map((c) => c.id))
  if (!stored.ok) return warn('no se pudieron leer los avisos ya guardados', { spaceId: space.id })
  const known = knownIds(stored.value, (m) => m.channelId)
  const coursesOf = (channel: StoredChannel) => courses.get(sectionOf(channel) ?? '') ?? []
  const byCourse = await perCourse(avisos.flatMap(coursesOf), (id) => announcementsOf(deps.classroom, id))
  for (const channel of avisos) {
    const fresh = coursesOf(channel)
      .flatMap((id) => byCourse.get(id) ?? [])
      .filter((a) => !known.has(keyOf(channel.id, a.id)))
    for (const aviso of fresh.sort(byDate((a) => a.createdAt))) await addAnnouncement(deps, channel, aviso)
  }
}

const TYPES_BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  zip: 'application/zip',
  txt: 'text/plain',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg'
}

/** Moodle no da el tipo de un recurso: un enlace es `text/uri-list` y un archivo sale de la extensión de su URL. */
function contentTypeOf(content: ClassroomContent): string {
  if (content.type === 'url') return 'text/uri-list'
  const path = content.url.split(/[?#]/)[0]
  const extension = path.includes('.') ? (path.split('.').pop() ?? '').toLowerCase() : ''
  return TYPES_BY_EXTENSION[extension] ?? 'application/octet-stream'
}

async function contentsOf(classroom: ClassroomPort, courseId: string): Promise<ClassroomContent[]> {
  const read = await classroom.contents(courseId)
  if (read.ok) return read.value
  warn('no se pudieron leer los recursos del curso', { courseId, error: read.error })
  return []
}

/** El recurso como material de la materia: un enlace al recurso en Moodle, sin copiarlo a Archivos. */
function toMaterial(space: StoredSpace, content: ClassroomContent): Omit<StoredMaterial, 'id' | 'seq'> {
  return {
    spaceId: space.id,
    name: content.name,
    url: content.url,
    fileId: null,
    contentType: contentTypeOf(content),
    // Moodle no da el tamaño: 0 es «sin dato».
    size: 0,
    section: content.topic,
    origin: 'moodle',
    externalId: content.id,
    addedBy: null,
    addedAt: content.modifiedAt
  }
}

/** El material es de toda la materia: trae los recursos de los cursos de todas las comisiones. */
async function importContents(
  { classroom, store }: ClassroomImportDeps,
  space: StoredSpace,
  courses: CourseIds
): Promise<void> {
  const stored = await store.material([space.id])
  if (!stored.ok) return warn('no se pudo leer el material ya guardado', { spaceId: space.id })
  const known = knownIds(stored.value, (m) => m.spaceId)
  const byCourse = await perCourse([...courses.values()].flat(), (id) => contentsOf(classroom, id))
  const fresh = [...byCourse.values()].flat().filter((c) => !known.has(keyOf(space.id, c.id)))
  for (const content of fresh.sort(byDate((c) => c.modifiedAt))) {
    const added = await store.addMaterial(toMaterial(space, content))
    if (!added.ok && added.error !== 'duplicado') warn('no se pudo guardar el recurso', { contentId: content.id })
  }
}

/** Trae lo nuevo de Moodle al espacio y a sus canales. */
export async function importFromClassroom(
  deps: ClassroomImportDeps,
  space: StoredSpace,
  channels: StoredChannel[]
): Promise<void> {
  const sectionIds = [...new Set(channels.flatMap((c) => sectionOf(c) ?? []))]
  const courses = await coursesBySection(deps.classroom, sectionIds)
  await importAnnouncements(deps, space, channels, courses)
  await importContents(deps, space, courses)
}
