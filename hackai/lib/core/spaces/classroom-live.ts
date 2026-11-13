/* Lo del aula de Moodle que se muestra leído en vivo, sin guardarlo:
   - De un curso `liveOnly` (el Campus real de una persona, ADR 0010), todo:
     los elementos del curso van al material y los avisos a `#avisos` de su
     comisión. Son datos de la cuenta de la persona y de terceros (docentes):
     no van a la base.
   - De los demás cursos, lo que no tiene lugar en el material guardado:
     carpetas, páginas, textos sueltos y actividades. Los archivos y los enlaces
     se traen y se guardan como siempre (classroom-import).
   Además da el lugar en el aula de cada elemento, así el material sale en el
   orden de Moodle, con lo guardado en su lugar.

   Sale de los cursos de las comisiones de quien mira. Si Moodle no responde,
   no hay nada en vivo: se muestra lo guardado, y queda registrado con ids,
   nunca con textos. */
import type { MaterialItem, MaterialKind, Message, StoredChannel } from '@/lib/core/spaces'
import type { Membership } from '@/lib/core/spaces/access'
import { contentTypeOf, isStored } from '@/lib/core/spaces/classroom-import'
import type { ClassroomAnnouncement, ClassroomContent, ClassroomCourse, ClassroomPort } from '@/lib/ports/classroom'

const KINDS: Record<ClassroomContent['type'], MaterialKind> = {
  file: 'archivo',
  url: 'enlace',
  folder: 'carpeta',
  page: 'pagina',
  label: 'texto',
  activity: 'actividad'
}

/** Cuántos lugares deja cada curso para los suyos, así dos cursos de la materia no se mezclan. */
const COURSE_SPAN = 100_000

export type LiveMaterial = {
  /** Lo que se muestra en vivo, del más nuevo al más viejo. */
  items: MaterialItem[]
  /** El lugar en el aula de cada elemento de Moodle, por su id, también de los que se guardan. */
  positions: Map<string, number>
}

function warn(what: string, ids: Record<string, string>) {
  console.warn(`moodle: ${what}`, ids)
}

/** Los cursos de las comisiones, sin repetir. Una comisión cuyo curso no se pudo leer no suma nada. */
async function coursesOf(classroom: ClassroomPort, sectionIds: string[]): Promise<ClassroomCourse[]> {
  const found = await Promise.all([...new Set(sectionIds)].map((id) => classroom.coursesForSection(id)))
  const courses = new Map<string, ClassroomCourse>()
  for (const read of found) {
    if (!read.ok) warn('no se pudieron leer los cursos de la comisión', { error: read.error })
    else for (const course of read.value) courses.set(course.id, course)
  }
  return [...courses.values()]
}

function toItem(content: ClassroomContent, position: number): MaterialItem {
  const [file] = content.files
  return {
    id: `moodle:${content.id}`,
    kind: KINDS[content.type],
    name: content.name,
    url: content.url,
    contentType: content.type === 'file' && file ? file.contentType : contentTypeOf(content),
    size: content.type === 'file' && file ? file.size : 0,
    origin: 'moodle',
    section: content.topic,
    addedBy: null,
    addedAt: content.modifiedAt,
    // Lo que no se guarda no tiene marca de leído: no se cuenta como nuevo.
    unread: false,
    files: content.type === 'folder' ? content.files : [],
    text: content.text,
    activity: content.activity,
    position
  }
}

/** Lo del aula que va en vivo al material, y el lugar en el aula de todo lo de Moodle. */
export async function liveMaterial(classroom: ClassroomPort, member: Membership): Promise<LiveMaterial> {
  const courses = await coursesOf(
    classroom,
    member.sections.map((s) => s.sectionId)
  )
  const reads = await Promise.all(courses.map((c) => classroom.contents(c.id)))
  const items: MaterialItem[] = []
  const positions = new Map<string, number>()
  for (const [i, course] of courses.entries()) {
    const read = reads[i]
    if (!read.ok) {
      warn('no se pudieron leer los elementos del curso', { courseId: course.id, error: read.error })
      continue
    }
    for (const content of read.value) {
      const position = i * COURSE_SPAN + content.position
      positions.set(content.id, position)
      if (!isStored(course, content)) items.push(toItem(content, position))
    }
  }
  return { items: items.sort((a, b) => b.addedAt.localeCompare(a.addedAt)), positions }
}

function toMessage(channel: StoredChannel, a: ClassroomAnnouncement): Message {
  return {
    id: `moodle:${a.id}`,
    channelId: channel.id,
    author: { personId: null, name: a.authorName ?? 'Aula de Moodle', role: null },
    text: `${a.subject}\n\n${a.message}`,
    attachments: a.attachments,
    origin: 'moodle',
    externalId: a.id,
    status: 'publicado',
    replyTo: null,
    question: null,
    unread: false,
    createdAt: a.createdAt
  }
}

/** Los avisos que van en vivo a un `#avisos`: los de los cursos `liveOnly` de su comisión, del más viejo al más
    nuevo. Los de los demás cursos ya se guardaron en el canal. */
export async function liveAnnouncements(classroom: ClassroomPort, channel: StoredChannel): Promise<Message[]> {
  if (channel.kind !== 'avisos' || channel.scope.kind !== 'comision') return []
  const courses = (await coursesOf(classroom, [channel.scope.sectionId])).filter((c) => c.liveOnly)
  const reads = await Promise.all(courses.map((c) => classroom.announcements(c.id)))
  return reads
    .flatMap((read, i) => {
      if (read.ok) return read.value
      warn('no se pudieron leer los avisos del curso', { courseId: courses[i].id, error: read.error })
      return []
    })
    .map((a) => toMessage(channel, a))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}
