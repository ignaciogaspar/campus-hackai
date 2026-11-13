/* Las consultas que le tocan responder a un docente, de todos sus espacios,
   para su Hoy. Le tocan las consultas sin resolver de los canales en los que
   puede marcarlas resueltas (`canResolve`): las de `#consultas` de las
   comisiones actuales que dicta. Las de comisiones archivadas no cuentan, y a
   un alumno no le toca ninguna. Como las novedades, no crea espacios. */
import type { People, PersonId } from '@/lib/core/people'
import type { ChannelId, MessageId, OpenQuestion, SpacesStore, StoredChannel, StoredMessage } from '@/lib/core/spaces'
import { canResolve, type Membership } from '@/lib/core/spaces/access'
import { type Authors, authorsFrom } from '@/lib/core/spaces/authors'
import { currentSpaces } from '@/lib/core/spaces/current-spaces'
import type { Studies } from '@/lib/core/studies'
import { type ExternalFailure, ok, type Result } from '@/lib/result'

/** Un canal donde la persona resuelve consultas, con su membresía en el espacio. */
type Answerable = { channel: StoredChannel; member: Membership; subjectName: string }

function sectionName(member: Membership, channel: StoredChannel): string | null {
  const { scope } = channel
  if (scope.kind !== 'comision') return null
  return member.sections.find((s) => s.sectionId === scope.sectionId)?.name ?? null
}

/** Una sola pasada por los mensajes: las consultas sin resolver de cada canal, y cuántas respuestas tiene
    cada mensaje y cuál es la última (vienen por `seq`, así que la última que pasa es la más nueva). */
function tally(messages: StoredMessage[]) {
  const openByChannel = new Map<ChannelId, StoredMessage[]>()
  const replyCount = new Map<MessageId, number>()
  const lastReply = new Map<MessageId, StoredMessage>()
  for (const m of messages) {
    if (m.replyTo !== null) {
      replyCount.set(m.replyTo, (replyCount.get(m.replyTo) ?? 0) + 1)
      lastReply.set(m.replyTo, m)
      continue
    }
    if (m.resolved !== false) continue
    const open = openByChannel.get(m.channelId)
    if (open) open.push(m)
    else openByChannel.set(m.channelId, [m])
  }
  return { openByChannel, replyCount, lastReply }
}

/** Si la última respuesta es de un docente: la consulta ya tiene respuesta y falta marcarla resuelta. */
async function answeredByTeacher(authors: Authors, last: StoredMessage | undefined): Promise<boolean> {
  if (!last) return false
  return (await authors.ofMessage(last)).role === 'profesor'
}

const oldestFirst = (a: OpenQuestion, b: OpenQuestion) =>
  a.createdAt.localeCompare(b.createdAt) || a.subjectName.localeCompare(b.subjectName, 'es')

export async function openQuestions(
  studies: Studies,
  people: People,
  store: SpacesStore,
  personId: PersonId
): Promise<Result<OpenQuestion[], 'persona-desconocida' | ExternalFailure>> {
  const found = await currentSpaces(studies, store, personId, (m) => m.role === 'profesor')
  if (!found.ok) return found
  const answerable = found.value.flatMap(({ space, member, channels }): Answerable[] =>
    channels.filter((c) => canResolve(member, c)).map((channel) => ({ channel, member, subjectName: space.name }))
  )
  if (answerable.length === 0) return ok([])
  const messages = await store.messages(answerable.map((a) => a.channel.id))
  if (!messages.ok) return messages

  const { openByChannel, replyCount, lastReply } = tally(messages.value)

  const authors = authorsFrom(people)
  const questions = await Promise.all(
    answerable.flatMap(({ channel, member, subjectName }) =>
      (openByChannel.get(channel.id) ?? []).map(
        async (m): Promise<OpenQuestion> => ({
          messageId: m.id,
          channelId: channel.id,
          spaceId: channel.spaceId,
          subjectId: member.subjectId,
          subjectName,
          sectionId: channel.scope.kind === 'comision' ? channel.scope.sectionId : null,
          sectionName: sectionName(member, channel),
          text: m.text,
          author: await authors.ofMessage(m),
          origin: m.origin,
          createdAt: m.createdAt,
          replies: replyCount.get(m.id) ?? 0,
          answeredByTeacher: await answeredByTeacher(authors, lastReply.get(m.id))
        })
      )
    )
  )
  return ok(questions.sort(oldestFirst))
}
