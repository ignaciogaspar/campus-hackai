/* Las consultas que le tocan responder a un docente, de todos sus espacios,
   para su Hoy. Le tocan las consultas sin resolver de los canales en los que
   puede marcarlas resueltas (`canResolve`): las de `#consultas` de las
   comisiones actuales que dicta. Las de comisiones archivadas no cuentan, y a
   un alumno no le toca ninguna. Como las novedades, no crea espacios. */
import type { People, PersonId } from '@/lib/core/people'
import type { OpenQuestion, SpacesStore, StoredChannel } from '@/lib/core/spaces'
import { canResolve, currentMemberships, type Membership, sectionsOf } from '@/lib/core/spaces/access'
import { authorsFrom } from '@/lib/core/spaces/authors'
import { visibleChannels } from '@/lib/core/spaces/channels'
import type { Studies } from '@/lib/core/studies'
import { type ExternalFailure, ok, type Result } from '@/lib/result'

/** Un canal donde la persona resuelve consultas, con su membresía en el espacio. */
type Answerable = { channel: StoredChannel; member: Membership; subjectName: string }

function sectionName(member: Membership, channel: StoredChannel): string | null {
  const { scope } = channel
  if (scope.kind !== 'comision') return null
  return member.sections.find((s) => s.sectionId === scope.sectionId)?.name ?? null
}

const oldestFirst = (a: OpenQuestion, b: OpenQuestion) =>
  a.createdAt.localeCompare(b.createdAt) || a.subjectName.localeCompare(b.subjectName, 'es')

export async function openQuestions(
  studies: Studies,
  people: People,
  store: SpacesStore,
  personId: PersonId
): Promise<Result<OpenQuestion[], 'persona-desconocida' | ExternalFailure>> {
  const read = await sectionsOf(studies, personId)
  if (!read.ok) return read
  const members = currentMemberships(personId, read.value.sections).filter((m) => m.role === 'profesor')
  if (members.length === 0) return ok([])
  const spaces = await store.spacesFor(members.map((m) => ({ subjectId: m.subjectId, schoolId: m.schoolId })))
  if (!spaces.ok) return spaces
  if (spaces.value.length === 0) return ok([])
  const channels = await store.channels(spaces.value.map((s) => s.id))
  if (!channels.ok) return channels

  const answerable = spaces.value.flatMap((space): Answerable[] => {
    const member = members.find((m) => m.subjectId === space.subjectId && m.schoolId === space.schoolId)
    if (!member) return []
    const ofSpace = channels.value.filter((c) => c.spaceId === space.id)
    return visibleChannels(member, ofSpace)
      .filter((c) => canResolve(member, c))
      .map((channel) => ({ channel, member, subjectName: space.name }))
  })
  if (answerable.length === 0) return ok([])
  const messages = await store.messages(answerable.map((a) => a.channel.id))
  if (!messages.ok) return messages

  const authors = authorsFrom(people)
  const questions = await Promise.all(
    answerable.flatMap(({ channel, member, subjectName }) =>
      messages.value
        .filter((m) => m.channelId === channel.id && m.replyTo === null && m.resolved === false)
        .map(
          async (m): Promise<OpenQuestion> => ({
            messageId: m.id,
            channelId: channel.id,
            spaceId: channel.spaceId,
            subjectId: member.subjectId,
            subjectName,
            sectionName: sectionName(member, channel),
            text: m.text,
            author: await authors.ofMessage(m),
            origin: m.origin,
            createdAt: m.createdAt,
            replies: messages.value.filter((r) => r.replyTo === m.id).length
          })
        )
    )
  )
  return ok(questions.sort(oldestFirst))
}
