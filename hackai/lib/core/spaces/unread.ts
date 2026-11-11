/* Las novedades sin leer de una persona en todos sus espacios, para Hoy y la
   navegación. Solo cuentan las comisiones actuales y los espacios que ya
   existen: pedir novedades no crea espacios. */
import type { PersonId } from '@/lib/core/people'
import type { MySection, Studies } from '@/lib/core/studies'
import { type ExternalFailure, ok, type Result } from '@/lib/result'
import type { SpacesStore, StoredChannel, StoredSpace, UnreadItem } from '.'
import { type Membership, membershipFrom, sectionsOf } from './access'
import { visibleChannels } from './channels'
import { loadSnapshot, type Snapshot, unreadIn } from './reading'

/** Una membresía por materia, con la facultad de su primera comisión actual. */
function membershipsOf(personId: PersonId, sections: MySection[]): Membership[] {
  const current = sections.filter((s) => s.current)
  const subjectIds = [...new Set(current.map((s) => s.subjectId))]
  return subjectIds.map((subjectId) => {
    const ofSubject = current.filter((s) => s.subjectId === subjectId)
    const school = ofSubject[0].schoolId
    return membershipFrom(
      personId,
      ofSubject.filter((s) => s.schoolId === school),
      null
    )
  })
}

/** Los canales que la persona ve en un espacio. */
type Visible = { space: StoredSpace; channels: StoredChannel[] }

function itemsIn({ space, channels }: Visible, snapshot: Snapshot): UnreadItem[] {
  return channels.flatMap((channel): UnreadItem[] => {
    const { count, latest } = unreadIn(snapshot, channel)
    if (count === 0 || latest === null) return []
    return [
      {
        spaceId: space.id,
        subjectId: space.subjectId,
        subjectName: space.name,
        channelId: channel.id,
        channelName: channel.name,
        kind: channel.kind,
        count,
        latest
      }
    ]
  })
}

const newestFirst = (a: UnreadItem, b: UnreadItem) =>
  b.latest.createdAt.localeCompare(a.latest.createdAt) || a.subjectName.localeCompare(b.subjectName, 'es')

export async function unreadFor(
  studies: Studies,
  store: SpacesStore,
  personId: PersonId
): Promise<Result<UnreadItem[], 'persona-desconocida' | ExternalFailure>> {
  const read = await sectionsOf(studies, personId)
  if (!read.ok) return read
  const members = membershipsOf(personId, read.value.sections)
  if (members.length === 0) return ok([])
  const spaces = await store.spacesFor(members.map((m) => ({ subjectId: m.subjectId, schoolId: m.schoolId })))
  if (!spaces.ok) return spaces
  if (spaces.value.length === 0) return ok([])
  const spaceIds = spaces.value.map((s) => s.id)
  const channels = await store.channels(spaceIds)
  if (!channels.ok) return channels

  const visible = spaces.value.map((space): Visible => {
    const member = members.find((m) => m.subjectId === space.subjectId && m.schoolId === space.schoolId)
    const ofSpace = channels.value.filter((c) => c.spaceId === space.id)
    return { space, channels: member ? visibleChannels(member, ofSpace) : [] }
  })
  const snapshot = await loadSnapshot(
    store,
    personId,
    visible.flatMap((v) => v.channels),
    spaceIds
  )
  if (!snapshot.ok) return snapshot
  return ok(visible.flatMap((v) => itemsIn(v, snapshot.value)).sort(newestFirst))
}
