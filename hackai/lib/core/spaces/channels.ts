/* Los canales de un espacio: los que se crean por defecto, en qué orden los ve
   cada persona y cómo se muestran. Sin acceso al almacén salvo `ensureChannels`. */

import type {
  Author,
  Channel,
  NewChannel,
  SpacesStore,
  SpacesStoreError,
  StoredChannel,
  StoredSpace
} from '@/lib/core/spaces'
import { canLink, canResolve, type Membership, postRefusal, sees } from '@/lib/core/spaces/access'
import { fail, type Result } from '@/lib/result'

type NewStoredChannel = Omit<StoredChannel, 'id'>

/** El material de la materia, y `#avisos` y `#consultas` de cada comisión de la persona. */
function defaultsFor(space: StoredSpace, member: Membership): NewStoredChannel[] {
  const channel = (name: string, kind: StoredChannel['kind'], scope: StoredChannel['scope']): NewStoredChannel => ({
    spaceId: space.id,
    name,
    kind,
    scope,
    externalLink: null
  })
  return [
    channel('material', 'material', { kind: 'materia' }),
    ...member.sections.flatMap((s) => [
      channel('avisos', 'avisos', { kind: 'comision', sectionId: s.sectionId }),
      channel('consultas', 'consultas', { kind: 'comision', sectionId: s.sectionId })
    ])
  ]
}

function sameScope(a: StoredChannel['scope'], b: StoredChannel['scope']): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

/** Crea los canales por defecto que falten y devuelve todos los del espacio, en el
    orden en que se crearon. Crear es idempotente: si otro lo creó antes, el
    almacén responde `duplicado` y no es un error. */
export async function ensureChannels(
  store: SpacesStore,
  space: StoredSpace,
  member: Membership
): Promise<Result<StoredChannel[], SpacesStoreError>> {
  const existing = await store.channels([space.id])
  if (!existing.ok) return existing
  const missing = defaultsFor(space, member).filter(
    (wanted) => !existing.value.some((c) => c.name === wanted.name && sameScope(c.scope, wanted.scope))
  )
  if (missing.length === 0) return existing
  for (const channel of missing) {
    const created = await store.createChannel(channel)
    if (!created.ok && created.error !== 'duplicado') return fail(created.error)
  }
  return store.channels([space.id])
}

/** Dónde va un canal en la lista: por cada comisión de la persona, avisos y
    consultas; después el material, los libres y al final los directos. */
function rank(member: Membership, channel: StoredChannel): number {
  const { scope, kind } = channel
  const sections = member.sections.length
  if (scope.kind === 'comision' && (kind === 'avisos' || kind === 'consultas')) {
    const index = member.sections.findIndex((s) => s.sectionId === scope.sectionId)
    return index * 2 + (kind === 'consultas' ? 1 : 0)
  }
  if (kind === 'material') return sections * 2
  if (kind === 'directo') return sections * 2 + 2
  return sections * 2 + 1
}

/** Los canales que la persona ve, en el orden en que se muestran. Los de igual
    lugar quedan en el orden en que se crearon. */
export function visibleChannels(member: Membership, channels: StoredChannel[]): StoredChannel[] {
  return channels.filter((c) => sees(member, c)).sort((a, b) => rank(member, a) - rank(member, b))
}

const MAX_NAME = 40

/** El nombre como se guarda: sin `#`, en minúsculas, con guiones en vez de
    espacios y solo letras, dígitos, `-` y `_`. `null` si no queda nada. Las
    tildes se juntan con su letra antes (NFC): pegada de un PDF o escrita en
    una Mac, «á» puede llegar como «a» más la tilde suelta, que no es letra. */
export function channelName(raw: string): string | null {
  const name = raw
    .normalize('NFC')
    .trim()
    .replace(/^#+/, '')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}_-]/gu, '')
    .replace(/-+/g, '-')
    .slice(0, MAX_NAME)
    .replace(/^-+|-+$/g, '')
  return name === '' ? null : name
}

/** Si el nombre choca con un canal que ven los mismos miembros: uno de la
    materia, con cualquiera del espacio; uno de comisión, con los de la materia
    y los de esa comisión. Los directos no cuentan: se muestran con el nombre
    de la otra persona. */
export function nameTaken(channels: StoredChannel[], name: string, scope: NewChannel['scope']): boolean {
  return channels.some((c) => {
    if (c.name !== name || c.scope.kind === 'directo') return false
    if (scope.kind === 'materia' || c.scope.kind === 'materia') return true
    return c.scope.kind === 'comision' && c.scope.sectionId === scope.sectionId
  })
}

export function sectionNameOf(member: Membership, channel: StoredChannel): string | null {
  const { scope } = channel
  if (scope.kind !== 'comision') return null
  return member.sections.find((s) => s.sectionId === scope.sectionId)?.name ?? null
}

/** El canal como lo ve la persona. `counterpart` es la otra persona si es un canal directo (ver ./direct.ts). */
export function toChannel(
  member: Membership,
  channel: StoredChannel,
  unread: number,
  counterpart: Author | null = null
): Channel {
  return {
    id: channel.id,
    spaceId: channel.spaceId,
    name: channel.name,
    kind: channel.kind,
    scope: channel.scope,
    sectionName: sectionNameOf(member, channel),
    unread,
    canPost: postRefusal(member, channel) === null,
    canResolve: canResolve(member, channel),
    canLink: canLink(member, channel),
    externalLink: channel.externalLink,
    counterpart
  }
}
