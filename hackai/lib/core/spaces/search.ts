/* Buscar en el espacio: el material por nombre del archivo y por unidad o tema,
   y las consultas de los `#consultas` que la persona ve por su texto o el de
   sus respuestas. Sin distinguir mayúsculas ni tildes, y con lo buscado como
   frase: «unidad 2» encuentra «Unidad 2: Derivadas» y no «Unidad 1 · Guía 2».

   Quién ve qué es la misma regla que al abrir un canal (`sees`): el material es
   de toda la materia y lo ve cualquiera del espacio, y las consultas son de una
   comisión, así que nunca entran las de otra. Buscar no marca nada leído. */
import type { People } from '@/lib/core/people'
import type {
  ChannelId,
  MaterialItem,
  MessageId,
  QuestionMatch,
  SpaceSearch,
  SpacesStore,
  SpacesStoreError,
  StoredChannel,
  StoredMessage,
  StoredSpace
} from '@/lib/core/spaces'
import type { Membership } from '@/lib/core/spaces/access'
import { authorsFrom } from '@/lib/core/spaces/authors'
import { sectionNameOf, visibleChannels } from '@/lib/core/spaces/channels'
import { materialItems } from '@/lib/core/spaces/material'
import { ok, type Result } from '@/lib/result'

/** En minúsculas, sin tildes y con un solo espacio entre palabras. */
export function searchable(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

const has = (text: string | null, needle: string) => text !== null && searchable(text).includes(needle)

function matchingMaterial(items: MaterialItem[], needle: string): MaterialItem[] {
  return items.filter((i) => has(i.name, needle) || has(i.section, needle))
}

/** Las consultas de esos canales con sus respuestas, en una sola pasada. */
function questionsWithReplies(messages: StoredMessage[]) {
  const questions: StoredMessage[] = []
  const replies = new Map<MessageId, StoredMessage[]>()
  for (const m of messages) {
    if (m.replyTo !== null) replies.set(m.replyTo, [...(replies.get(m.replyTo) ?? []), m])
    else if (m.resolved !== null) questions.push(m)
  }
  return { questions, replies }
}

const resolvedFirst = (a: QuestionMatch, b: QuestionMatch) =>
  Number(b.resolved) - Number(a.resolved) || b.createdAt.localeCompare(a.createdAt)

async function matchingQuestions(
  people: People,
  member: Membership,
  channels: StoredChannel[],
  messages: StoredMessage[],
  needle: string
): Promise<QuestionMatch[]> {
  const byId = new Map<ChannelId, StoredChannel>(channels.map((c) => [c.id, c]))
  const { questions, replies } = questionsWithReplies(messages)
  const authors = authorsFrom(people)
  const found = questions.filter(
    (q) => has(q.text, needle) || (replies.get(q.id) ?? []).some((r) => has(r.text, needle))
  )
  const matches = await Promise.all(
    found.map(async (q): Promise<QuestionMatch> => {
      const channel = byId.get(q.channelId)
      return {
        messageId: q.id,
        channelId: q.channelId,
        sectionName: channel ? sectionNameOf(member, channel) : null,
        text: q.text,
        author: await authors.ofMessage(q),
        resolved: q.resolved === true,
        replies: replies.get(q.id)?.length ?? 0,
        createdAt: q.createdAt
      }
    })
  )
  return matches.sort(resolvedFirst)
}

export async function searchSpace(
  deps: { people: People; store: SpacesStore },
  member: Membership,
  space: StoredSpace,
  query: string
): Promise<Result<SpaceSearch, SpacesStoreError>> {
  const { people, store } = deps
  const shown = query.replace(/\s+/g, ' ').trim()
  const needle = searchable(shown)
  if (needle === '') return ok({ query: shown, material: [], questions: [] })

  const channels = await store.channels([space.id])
  if (!channels.ok) return channels
  const visible = visibleChannels(member, channels.value)
  const materialChannel = visible.find((c) => c.kind === 'material')
  const questionChannels = visible.filter((c) => c.kind === 'consultas')

  const [marks, stored, messages] = await Promise.all([
    store.readMarks(member.personId, materialChannel ? [materialChannel.id] : []),
    store.material([space.id]),
    questionChannels.length ? store.messages(questionChannels.map((c) => c.id)) : ok([])
  ])
  if (!marks.ok) return marks
  if (!stored.ok) return stored
  if (!messages.ok) return messages

  const mark = materialChannel ? (marks.value[materialChannel.id] ?? 0) : 0
  const items = await materialItems(stored.value, authorsFrom(people), member.personId, mark)
  return ok({
    query: shown,
    material: matchingMaterial(items, needle),
    questions: await matchingQuestions(people, member, questionChannels, messages.value, needle)
  })
}
