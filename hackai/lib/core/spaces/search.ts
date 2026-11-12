/* Buscar en el espacio: el material por nombre del archivo y por unidad o tema,
   y las consultas de los `#consultas` que la persona ve por su texto o el de
   sus respuestas. Sin distinguir mayúsculas ni tildes, y por palabras: alcanza
   con que estén todas, en cualquier orden, así «guia limites» encuentra «Guía
   de límites.pdf». En el material, lo que tiene lo buscado tal cual va primero:
   con «unidad 2», «Unidad 2: Derivadas» antes que la «Guía 2» de la Unidad 1.

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

/** En minúsculas y sin tildes. */
function folded(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

/** Lo buscado, listo para comparar: entero y palabra por palabra. */
type Needle = { phrase: string; words: string[] }

function needleOf(shown: string): Needle {
  const phrase = folded(shown)
  return { phrase, words: phrase.split(' ').filter(Boolean) }
}

const haystack = (texts: Array<string | null>) => folded(texts.filter((t) => t !== null).join(' '))

/** Si todas las palabras de lo buscado están en alguno de los textos. */
const hasWords = (texts: Array<string | null>, needle: Needle) => {
  const hay = haystack(texts)
  return needle.words.every((w) => hay.includes(w))
}

/** Si alguno de los textos tiene lo buscado tal cual. */
const hasPhrase = (texts: Array<string | null>, needle: Needle) =>
  texts.some((t) => t !== null && folded(t).replace(/\s+/g, ' ').includes(needle.phrase))

/** Los archivos que coinciden: los que tienen lo buscado tal cual primero y, adentro, el más nuevo primero. */
function matchingMaterial(items: MaterialItem[], needle: Needle): MaterialItem[] {
  const found = items.filter((i) => hasWords([i.name, i.section], needle))
  const exact = (i: MaterialItem) => Number(hasPhrase([i.name, i.section], needle))
  // El orden de `items` ya es el más nuevo primero, y `sort` lo respeta entre iguales.
  return found.sort((a, b) => exact(b) - exact(a))
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
  needle: Needle
): Promise<QuestionMatch[]> {
  const byId = new Map<ChannelId, StoredChannel>(channels.map((c) => [c.id, c]))
  const { questions, replies } = questionsWithReplies(messages)
  const authors = authorsFrom(people)
  const found = questions.filter((q) => hasWords([q.text, ...(replies.get(q.id) ?? []).map((r) => r.text)], needle))
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
  const needle = needleOf(shown)
  if (needle.words.length === 0) return ok({ query: shown, material: [], questions: [] })

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
