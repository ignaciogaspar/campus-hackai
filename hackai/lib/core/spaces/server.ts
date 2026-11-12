/* El servidor del canal externo de la cátedra (en Discord, su servidor): conectar el espacio con él, listar sus
   canales para vincular uno y crear los canales del espacio allá, ya vinculados y con permisos. Lo usa solo el
   módulo (module.ts), que antes chequea que la persona gestione el espacio.

   - Conectar vincula también la cuenta externa del docente con su persona, en Personas: así lo que publica en el
     servidor entra a HackAI con su nombre. Primero se comprueba que el bot esté en el servidor, y la cuenta se
     vincula antes de guardar el servidor: si algo falla, el espacio no queda conectado.
   - Crear canales hace un canal por cada canal del espacio que la persona puede vincular y no está vinculado,
     en una categoría con el nombre de la materia. En `#avisos` y en el material escriben solo los docentes (los
     del rol de docentes de la materia); en el resto, todos. Cada canal se vincula apenas se crea: si el canal
     externo falla a mitad de camino, lo creado ya quedó vinculado y volver a intentar crea solo lo que falta. */
import type { People, PersonId } from '@/lib/core/people'
import type {
  ChannelId,
  ExternalServer,
  ServerChannel,
  SpacesStore,
  SpacesStoreError,
  StoredChannel,
  StoredSpace
} from '@/lib/core/spaces'
import { canLink, type Membership } from '@/lib/core/spaces/access'
import type {
  ExternalChannelPort,
  ExternalGroup,
  ExternalServerError,
  ExternalWriters
} from '@/lib/ports/external-channel'
import { fail, ok, type Result } from '@/lib/result'

export type ServerDeps = { people: People; externalChannel: ExternalChannelPort; store: SpacesStore }

/** El espacio que gestiona la persona, con su membresía. */
export type Managed = { space: StoredSpace; member: Membership }

/** El nombre del canal en el servidor: con la comisión si es de una (`avisos-a`), porque ahí conviven las de
    todas las comisiones. */
export function externalName(channel: StoredChannel, sectionName: string | null): string {
  const name = sectionName ? `${channel.name}-${sectionName}` : channel.name
  return name
    .toLocaleLowerCase('es')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100)
}

/** En `#avisos` y en el material escriben solo los docentes; en `#consultas` y los libres, todos. */
export function writersOf(channel: StoredChannel): ExternalWriters {
  return channel.kind === 'avisos' || channel.kind === 'material' ? 'docentes' : 'todos'
}

const sectionNameOf = (member: Membership, channel: StoredChannel): string | null =>
  channel.scope.kind === 'comision'
    ? (member.sections.find((s) => channel.scope.kind === 'comision' && s.sectionId === channel.scope.sectionId)
        ?.name ?? null)
    : null

export function createServerLink({ people, externalChannel, store }: ServerDeps) {
  /** Sus cuentas externas y las de los docentes de sus comisiones actuales que las tienen vinculadas. */
  async function teacherAccounts(member: Membership): Promise<string[]> {
    const teachers = new Set<PersonId>([member.personId])
    for (const s of member.sections.filter((s) => s.current)) {
      for (const t of s.teachers) if (t.personId) teachers.add(t.personId)
    }
    const accounts = await Promise.all([...teachers].map((id) => people.accountIn(id, 'discord')))
    return accounts.flatMap((a) => (a.ok ? [a.value] : []))
  }

  async function connect(
    { space }: Managed,
    personId: PersonId,
    server: ExternalServer,
    accountId: string
  ): Promise<Result<ExternalServer, 'cuenta-en-uso' | 'persona-desconocida' | ExternalServerError | SpacesStoreError>> {
    // Listar sus canales comprueba que el bot está en el servidor y puede verlo.
    const reachable = await externalChannel.serverChannels(server.serverId)
    if (!reachable.ok) return reachable
    const linked = await people.linkAccount(personId, server.system, accountId)
    if (!linked.ok) return fail(linked.error === 'solo-canales-externos' ? 'falla-externa' : linked.error)
    const saved = await store.setExternalServer(space.id, server)
    if (!saved.ok) return saved
    return ok(server)
  }

  async function serverChannels({ space }: Managed, personId: PersonId) {
    const server = space.externalServer
    if (!server) return fail('sin-servidor' as const)
    const account = await people.accountIn(personId, server.system)
    if (!account.ok) return fail(account.error === 'sin-cuenta' ? ('no-es-miembro' as const) : account.error)
    const member = await externalChannel.isMember(server.serverId, account.value)
    if (!member.ok) return member
    if (!member.value) return fail('no-es-miembro' as const)
    const [listed, linked] = await Promise.all([
      externalChannel.serverChannels(server.serverId),
      store.linkedChannels()
    ])
    if (!listed.ok) return listed
    if (!linked.ok) return linked
    const linkedTo = new Map<string, ChannelId>(
      linked.value.flatMap((c) =>
        c.externalLink?.system === server.system ? [[c.externalLink.channelId, c.id] as const] : []
      )
    )
    return ok(listed.value.map((c): ServerChannel => ({ ...c, linkedTo: linkedTo.get(c.id) ?? null })))
  }

  /** Crea el canal en el servidor y lo vincula enseguida. Un canal nuevo está vacío: no hay nada que traer. */
  async function createOne(
    server: ExternalServer,
    group: ExternalGroup,
    member: Membership,
    channel: StoredChannel
  ): Promise<Result<StoredChannel | null, ExternalServerError | SpacesStoreError>> {
    const made = await externalChannel.createChannel(server.serverId, group, {
      name: externalName(channel, sectionNameOf(member, channel)),
      writers: writersOf(channel)
    })
    if (!made.ok) return made
    return store.linkChannel(channel.id, { system: server.system, channelId: made.value.id })
  }

  async function createChannels({ space, member }: Managed, channels: StoredChannel[]) {
    const server = space.externalServer
    if (!server) return fail('sin-servidor' as const)
    const linkable = channels.filter((c) => c.scope.kind !== 'directo' && canLink(member, c))
    const missing = linkable.filter((c) => !c.externalLink)
    const alreadyLinked = linkable.length - missing.length
    if (missing.length === 0) return ok({ created: [] as StoredChannel[], alreadyLinked })

    const group = await externalChannel.prepareGroup(server.serverId, {
      name: space.name,
      teacherIds: await teacherAccounts(member)
    })
    if (!group.ok) return group
    const created: StoredChannel[] = []
    for (const channel of missing) {
      // Si uno falla, los anteriores ya quedaron vinculados: reintentar crea solo lo que falta.
      const linked = await createOne(server, group.value, member, channel)
      if (!linked.ok) return linked
      if (linked.value) created.push(linked.value)
    }
    return ok({ created, alreadyLinked })
  }

  return { connect, serverChannels, createChannels }
}
