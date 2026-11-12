/* Los espacios de las comisiones actuales de una persona, con los canales que
   ve en cada uno. Lo usan las lecturas que juntan todos sus espacios (las
   novedades sin leer y las consultas que le tocan). Solo los espacios que ya
   existen: mirar no crea espacios. */
import type { PersonId } from '@/lib/core/people'
import type { SpacesStore, StoredChannel, StoredSpace } from '@/lib/core/spaces'
import { currentMemberships, type Membership, sectionsOf } from '@/lib/core/spaces/access'
import { visibleChannels } from '@/lib/core/spaces/channels'
import type { Studies } from '@/lib/core/studies'
import { type ExternalFailure, ok, type Result } from '@/lib/result'

/** Un espacio, la membresía de la persona en él y los canales que ve, en el orden en que se muestran. */
export type CurrentSpace = { space: StoredSpace; member: Membership; channels: StoredChannel[] }

/** Con `only`, solo las membresías que la cumplen, por ejemplo las de docente. */
export async function currentSpaces(
  studies: Studies,
  store: SpacesStore,
  personId: PersonId,
  only: (member: Membership) => boolean = () => true
): Promise<Result<CurrentSpace[], 'persona-desconocida' | ExternalFailure>> {
  const read = await sectionsOf(studies, personId)
  if (!read.ok) return read
  const members = currentMemberships(personId, read.value.sections).filter(only)
  if (members.length === 0) return ok([])
  const spaces = await store.spacesFor(members.map((m) => ({ subjectId: m.subjectId, schoolId: m.schoolId })))
  if (!spaces.ok) return spaces
  if (spaces.value.length === 0) return ok([])
  const channels = await store.channels(spaces.value.map((s) => s.id))
  if (!channels.ok) return channels
  return ok(
    spaces.value.flatMap((space): CurrentSpace[] => {
      const member = members.find((m) => m.subjectId === space.subjectId && m.schoolId === space.schoolId)
      if (!member) return []
      const ofSpace = channels.value.filter((c) => c.spaceId === space.id)
      return [{ space, member, channels: visibleChannels(member, ofSpace) }]
    })
  )
}
