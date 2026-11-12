/* Las novedades sin leer de una persona en todos sus espacios, para Hoy y la
   navegación. Solo cuentan las comisiones actuales y los espacios que ya
   existen: pedir novedades no crea espacios. */
import type { PersonId } from '@/lib/core/people'
import type { SpacesStore, UnreadItem } from '@/lib/core/spaces'
import { type CurrentSpace, currentSpaces } from '@/lib/core/spaces/current-spaces'
import { loadSnapshot, type Snapshot, unreadIn } from '@/lib/core/spaces/reading'
import type { Studies } from '@/lib/core/studies'
import { type ExternalFailure, ok, type Result } from '@/lib/result'

function itemsIn({ space, channels }: CurrentSpace, snapshot: Snapshot): UnreadItem[] {
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
        sectionId: channel.scope.kind === 'comision' ? channel.scope.sectionId : null,
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
  const found = await currentSpaces(studies, store, personId)
  if (!found.ok) return found
  const visible = found.value
  if (visible.length === 0) return ok([])
  const snapshot = await loadSnapshot(
    store,
    personId,
    visible.flatMap((v) => v.channels),
    visible.map((v) => v.space.id)
  )
  if (!snapshot.ok) return snapshot
  return ok(visible.flatMap((v) => itemsIn(v, snapshot.value)).sort(newestFirst))
}
