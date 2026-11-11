/* Lo que el docente todavía publica en Moodle, traído al espacio para que la
   adopción sea gradual:
   - Los avisos del foro de Avisos llegan a `#avisos` de cada comisión, desde
     los cursos de esa comisión, con el autor que vincula Personas y los
     adjuntos como enlaces a Moodle.
   - Los recursos de los cursos de todas las comisiones vigentes de la materia
     van al material, como enlaces y en la sección de su tema. Las comisiones
     salen de la oferta de Cursada, así el material no depende de quién abrió
     antes el espacio.
   Cada cosa guarda origen `moodle` y su id de Moodle, y no entra dos veces.
   Entra en el orden en que se publicó en Moodle.

   Traer de Moodle nunca corta la apertura del espacio: si Moodle, Cursada,
   Personas o el almacén no responden, se saltea lo que no se pudo traer y
   entra en la próxima. Se registran solo ids, nunca textos ni nombres. Lo
   llama `open`; la corrida periódica de #15 lo puede llamar igual. */
import type { People } from '@/lib/core/people'
import type {
  SpacesStore,
  SpacesStoreError,
  StoredChannel,
  StoredMaterial,
  StoredMessage,
  StoredSpace
} from '@/lib/core/spaces'
import type { Membership } from '@/lib/core/spaces/access'
import type { Studies } from '@/lib/core/studies'
import type { ClassroomAnnouncement, ClassroomContent, ClassroomPort } from '@/lib/ports/classroom'
import type { Result } from '@/lib/result'

export type ClassroomImportDeps = { classroom: ClassroomPort; studies: Studies; people: People; store: SpacesStore }

type CourseIds = Map<string, string[]>

function warn(what: string, ids: Record<string, string>) {
  console.warn(`moodle: ${what}`, ids)
}

/** Lo leído, o nada si no se pudo leer: queda registrado y entra en la próxima apertura. */
function orEmpty<T>(read: Result<T[], string>, what: string, ids: Record<string, string>): T[] {
  if (read.ok) return read.value
  warn(what, { ...ids, error: read.error })
  return []
}

/** `duplicado` es que otro lo guardó antes, y no es un error. */
function warnUnlessDuplicate(
  added: Result<unknown, SpacesStoreError | 'duplicado'>,
  what: string,
  ids: Record<string, string>
) {
  if (!added.ok && added.error !== 'duplicado') warn(what, ids)
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
    sectionIds.map((sectionId, i) => [
      sectionId,
      orEmpty(found[i], 'no se pudieron leer los cursos de la comisión', { sectionId }).map((c) => c.id)
    ])
  )
}

/** Las comisiones vigentes de la materia en la facultad, de la oferta de Cursada. Si Cursada no
    responde, el material sale solo de las comisiones que ya tienen canales. */
async function offeredSections(studies: Studies, member: Membership, space: StoredSpace): Promise<string[]> {
  const offer = await studies.offer(member.personId, { kind: 'cursada', subjectId: space.subjectId })
  const items = orEmpty(offer, 'no se pudo leer la oferta de la materia', { subjectId: space.subjectId })
  return items.flatMap((item) => (item.target.kind === 'comision' ? [item.target.sectionId] : []))
}

/** El aviso como mensaje del canal, con su autor de HackAI si Personas lo vincula. */
async function announcementMessage(
  people: People,
  channel: StoredChannel,
  announcement: ClassroomAnnouncement
): Promise<Omit<StoredMessage, 'id' | 'seq'> | null> {
  const author = await people.byExternalAccount('moodle', announcement.authorId)
  if (!author.ok) {
    warn('no se pudo vincular al autor del aviso', { announcementId: announcement.id, error: author.error })
    return null
  }
  return {
    channelId: channel.id,
    authorId: author.value,
    authorName: null,
    text: `${announcement.subject}\n\n${announcement.message}`,
    // Las URLs de Moodle no vencen, a diferencia de las de Discord: el adjunto queda como enlace.
    attachments: announcement.attachments.map(({ name, contentType, size, url }) => ({
      name,
      contentType,
      size,
      url,
      fileId: null
    })),
    origin: 'moodle',
    externalId: announcement.id,
    status: 'publicado',
    replyTo: null,
    resolved: null,
    createdAt: announcement.createdAt
  }
}

/** Lo de cada curso, leído una sola vez aunque el curso sea de dos comisiones. */
async function perCourse<T>(courseIds: string[], read: (courseId: string) => Promise<T[]>): Promise<Map<string, T[]>> {
  const unique = [...new Set(courseIds)]
  const found = await Promise.all(unique.map(read))
  return new Map(unique.map((id, i) => [id, found[i]]))
}

/** Un id de Moodle dentro del canal o del espacio que lo tiene. */
const keyOf = (ownerId: string, externalId: string) => `${ownerId} ${externalId}`

/** Lo que ya se trajo de Moodle, para no pedir de nuevo el autor ni intentar guardarlo dos veces. */
function knownIds<T extends { origin: string; externalId: string | null }>(
  items: T[],
  ownerOf: (item: T) => string
): Set<string> {
  return new Set(
    items.flatMap((item) =>
      item.origin === 'moodle' && item.externalId ? [keyOf(ownerOf(item), item.externalId)] : []
    )
  )
}

async function addAnnouncement(
  { people, store }: ClassroomImportDeps,
  channel: StoredChannel,
  announcement: ClassroomAnnouncement
): Promise<void> {
  const message = await announcementMessage(people, channel, announcement)
  if (!message) return
  const added = await store.addMessage(message)
  warnUnlessDuplicate(added, 'no se pudo guardar el aviso', { announcementId: announcement.id })
}

/** Cada `#avisos` recibe los avisos de los cursos de su comisión. */
async function importAnnouncements(
  deps: ClassroomImportDeps,
  space: StoredSpace,
  channels: StoredChannel[],
  courses: CourseIds
): Promise<void> {
  const announcementChannels = channels.filter((c) => c.kind === 'avisos')
  if (announcementChannels.length === 0) return
  const stored = await deps.store.messages(announcementChannels.map((c) => c.id))
  if (!stored.ok) return warn('no se pudieron leer los avisos ya guardados', { spaceId: space.id })
  const known = knownIds(stored.value, (m) => m.channelId)
  const coursesOf = (channel: StoredChannel) => courses.get(sectionOf(channel) ?? '') ?? []
  const byCourse = await perCourse(announcementChannels.flatMap(coursesOf), async (courseId) =>
    orEmpty(await deps.classroom.announcements(courseId), 'no se pudieron leer los avisos del curso', { courseId })
  )
  for (const channel of announcementChannels) {
    const fresh = coursesOf(channel)
      .flatMap((id) => byCourse.get(id) ?? [])
      .filter((a) => !known.has(keyOf(channel.id, a.id)))
    for (const announcement of fresh.sort(byDate((a) => a.createdAt))) {
      await addAnnouncement(deps, channel, announcement)
    }
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
  const byCourse = await perCourse([...courses.values()].flat(), async (courseId) =>
    orEmpty(await classroom.contents(courseId), 'no se pudieron leer los recursos del curso', { courseId })
  )
  const fresh = [...byCourse.values()].flat().filter((c) => !known.has(keyOf(space.id, c.id)))
  for (const content of fresh.sort(byDate((c) => c.modifiedAt))) {
    const added = await store.addMaterial(toMaterial(space, content))
    warnUnlessDuplicate(added, 'no se pudo guardar el recurso', { contentId: content.id })
  }
}

/** Trae lo nuevo de Moodle al espacio y a sus canales. `member` es quien lo abre: con él se lee la
    oferta de la materia. */
export async function importFromClassroom(
  deps: ClassroomImportDeps,
  member: Membership,
  space: StoredSpace,
  channels: StoredChannel[]
): Promise<void> {
  const withChannels = channels.flatMap((c) => sectionOf(c) ?? [])
  const offered = await offeredSections(deps.studies, member, space)
  const courses = await coursesBySection(deps.classroom, [...new Set([...withChannels, ...offered])])
  await importAnnouncements(deps, space, channels, courses)
  await importContents(deps, space, courses)
}
