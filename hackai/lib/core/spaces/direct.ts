/* Canales directos: entre un alumno y un docente que comparten una comisión
   del espacio. Hay uno por par y por espacio: se crea la primera vez que
   alguno de los dos lo abre y se archiva con el espacio. Lo ven solo sus dos
   personas (`sees`, en ./access.ts), escriben los dos y no lleva consultas.
   Entre dos alumnos, o entre dos docentes, no hay. Sin acceso al almacén salvo
   `directChannel`. */
import type { PersonId } from '@/lib/core/people'
import type { Author, SpacesStore, SpacesStoreError, StoredChannel, StoredSpace } from '@/lib/core/spaces'
import type { Membership } from '@/lib/core/spaces/access'
import type { Authors } from '@/lib/core/spaces/authors'
import { fail, ok, type Result } from '@/lib/result'

/** El nombre con que se guarda. No se muestra: el canal se ve con el nombre de la otra persona. */
const DIRECT_NAME = 'directo'

/** Por qué no puede haber un canal directo entre las dos membresías, o `null` si puede. Primero los
    roles, así dos alumnos de la misma comisión no tienen canal aunque compartan comisión. */
export function directRefusal(
  member: Membership,
  other: Membership
): 'solo-alumno-docente' | 'sin-comision-en-comun' | null {
  if (member.personId === other.personId || member.role === other.role) return 'solo-alumno-docente'
  const shared = member.sections.some((s) => other.sections.some((o) => o.sectionId === s.sectionId))
  return shared ? null : 'sin-comision-en-comun'
}

const pairOf = (a: PersonId, b: PersonId): [PersonId, PersonId] => (a < b ? [a, b] : [b, a])

function isPair(channel: StoredChannel, [a, b]: [PersonId, PersonId]): boolean {
  if (channel.scope.kind !== 'directo') return false
  const [x, y] = pairOf(...channel.scope.personIds)
  return x === a && y === b
}

/** El canal directo del par en el espacio; lo crea si no existe. Si otro lo creó a la vez, el almacén
    responde `duplicado` y se devuelve ese. */
export async function directChannel(
  store: SpacesStore,
  space: StoredSpace,
  personId: PersonId,
  otherPersonId: PersonId
): Promise<Result<StoredChannel, SpacesStoreError>> {
  const pair = pairOf(personId, otherPersonId)
  const existing = await store.channels([space.id])
  if (!existing.ok) return existing
  const found = existing.value.find((c) => isPair(c, pair))
  if (found) return ok(found)
  const created = await store.createChannel({
    spaceId: space.id,
    name: DIRECT_NAME,
    kind: 'directo',
    scope: { kind: 'directo', personIds: pair },
    externalLink: null
  })
  if (created.ok) return created
  if (created.error !== 'duplicado') return fail(created.error)
  const again = await store.channels([space.id])
  if (!again.ok) return again
  const raced = again.value.find((c) => isPair(c, pair))
  return raced ? ok(raced) : fail('falla-externa')
}

/** En un canal directo, la otra persona; en el resto, `null`. */
export async function counterpartOf(
  authors: Authors,
  member: Membership,
  channel: StoredChannel
): Promise<Author | null> {
  if (channel.scope.kind !== 'directo') return null
  const other = channel.scope.personIds.find((id) => id !== member.personId) ?? member.personId
  return authors.ofPerson(other)
}
