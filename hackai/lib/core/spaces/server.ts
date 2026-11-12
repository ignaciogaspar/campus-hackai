/* El servidor del canal externo de la cátedra (en Discord, su servidor): conectar el espacio con él, listar sus
   canales para vincular uno y crear los canales del espacio allá, ya vinculados y con permisos. Lo usa solo el
   módulo (module.ts), que antes chequea que la persona gestione el espacio. Si el canal externo no declara la
   capacidad `servers`, las tres operaciones devuelven `no-soportado`.

   - Conectar vincula también la cuenta externa del docente con su persona, en Personas: así lo que publica en el
     servidor entra a HackAI con su nombre. Primero se comprueba que el bot esté en el servidor, y la cuenta se
     vincula antes de guardar el servidor: si algo falla, el espacio no queda conectado. La cuenta tiene que ser
     miembro del servidor (`no-es-miembro`). Un espacio conectado no
     cambia de servidor (`otro-servidor`), así los canales ya vinculados no quedan apuntando a otro; otro docente
     sí puede volver a conectar el mismo servidor, para vincular su cuenta.
   - Crear canales hace un canal por cada canal del espacio que la persona gestiona hoy (el material, y los de
     sus comisiones vigentes) y no está vinculado, en una categoría con el nombre de la materia. En `#avisos` y
     en el material escriben solo los docentes (los del rol de docentes de la materia); en el resto, todos. Cada
     canal se vincula apenas se crea: si el canal externo falla a mitad de camino, lo creado ya quedó vinculado y
     volver a intentar crea solo lo que falta. Si un canal se creó allá pero no llegó a vincularse, el reintento
     lo reconoce por su nombre en la categoría y lo vincula, en vez de crear otro. Cada vez se les da el rol de
     docentes a los docentes que vincularon su cuenta después. */
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
  ExternalServerChannel,
  ExternalServerError,
  ExternalWriters
} from '@/lib/ports/external-channel'
import { fail, ok, type Result } from '@/lib/result'

export type ServerDeps = { people: People; externalChannel: ExternalChannelPort; store: SpacesStore }

/** El espacio que gestiona la persona, con su membresía. */
export type Managed = { space: StoredSpace; member: Membership }

type CreateError = ExternalServerError | SpacesStoreError

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

/** La comisión vigente del canal entre las de la persona, si el canal es de una comisión. */
function currentSectionOf(member: Membership, channel: StoredChannel) {
  const { scope } = channel
  return scope.kind === 'comision' ? member.sections.find((s) => s.current && s.sectionId === scope.sectionId) : null
}

/** Los canales que la persona gestiona hoy: los de la materia y los de sus comisiones vigentes. Una comisión de un
    cuatrimestre que terminó no lleva canales nuevos al servidor. */
export function managedNow(member: Membership, channels: StoredChannel[]): StoredChannel[] {
  return channels.filter((c) => {
    if (c.scope.kind === 'directo' || !canLink(member, c)) return false
    return c.scope.kind === 'materia' || currentSectionOf(member, c) !== undefined
  })
}

const sameName = (a: string | null, b: string) =>
  (a ?? '').trim().toLocaleLowerCase('es') === b.trim().toLocaleLowerCase('es')

export function createServerLink({ people, externalChannel, store }: ServerDeps) {
  const supported = () => externalChannel.capabilities.servers

  /** Sus cuentas en el sistema del servidor y las de los docentes de sus comisiones vigentes que las tienen vinculadas. */
  async function teacherAccounts(member: Membership, server: ExternalServer): Promise<string[]> {
    const teachers = new Set<PersonId>([member.personId])
    for (const s of member.sections.filter((s) => s.current)) {
      for (const t of s.teachers) if (t.personId) teachers.add(t.personId)
    }
    const accounts = await Promise.all([...teachers].map((id) => people.accountIn(id, server.system)))
    return accounts.flatMap((a) => (a.ok ? [a.value] : []))
  }

  /** Que el bot esté en el servidor y pueda verlo (listar sus canales lo comprueba), y que quien autorizó sea
      miembro: así nadie conecta su espacio con un servidor ajeno donde está el bot. */
  async function checkServer(
    server: ExternalServer,
    accountId: string
  ): Promise<Result<null, 'no-es-miembro' | ExternalServerError>> {
    const reachable = await externalChannel.serverChannels(server.serverId)
    if (!reachable.ok) return reachable
    const member = await externalChannel.isMember(server.serverId, accountId)
    if (!member.ok) return member
    return member.value ? ok(null) : fail('no-es-miembro')
  }

  async function connect(
    { space }: Managed,
    personId: PersonId,
    server: ExternalServer,
    accountId: string
  ): Promise<
    Result<
      ExternalServer,
      | 'no-soportado'
      | 'otro-servidor'
      | 'no-es-miembro'
      | 'cuenta-en-uso'
      | 'persona-desconocida'
      | ExternalServerError
      | SpacesStoreError
    >
  > {
    if (!supported()) return fail('no-soportado')
    const current = space.externalServer
    if (current && (current.system !== server.system || current.serverId !== server.serverId))
      return fail('otro-servidor')
    const checked = await checkServer(server, accountId)
    if (!checked.ok) return checked
    const linked = await people.linkAccount(personId, server.system, accountId)
    if (!linked.ok) return fail(linked.error === 'solo-canales-externos' ? 'falla-externa' : linked.error)
    const saved = await store.setExternalServer(space.id, server)
    if (!saved.ok) return saved
    return ok(server)
  }

  /** Los canales del servidor con el canal de HackAI vinculado a cada uno, o `null`. */
  async function withLinks(
    server: ExternalServer
  ): Promise<Result<(ExternalServerChannel & { linkedTo: ChannelId | null })[], CreateError>> {
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
    return ok(listed.value.map((c) => ({ ...c, linkedTo: linkedTo.get(c.id) ?? null })))
  }

  async function serverChannels({ space }: Managed, personId: PersonId) {
    if (!supported()) return fail('no-soportado' as const)
    const server = space.externalServer
    if (!server) return fail('sin-servidor' as const)
    const account = await people.accountIn(personId, server.system)
    if (!account.ok) return fail(account.error === 'sin-cuenta' ? ('no-es-miembro' as const) : account.error)
    const member = await externalChannel.isMember(server.serverId, account.value)
    if (!member.ok) return member
    if (!member.value) return fail('no-es-miembro' as const)
    const listed = await withLinks(server)
    return listed.ok ? ok(listed.value.map((c): ServerChannel => c)) : listed
  }

  /** Los canales de la categoría de la materia que no están vinculados con ningún canal de HackAI, por nombre: los
      que se crearon allá pero no llegaron a vincularse. */
  async function orphansIn(
    space: StoredSpace,
    server: ExternalServer
  ): Promise<Result<Map<string, string>, CreateError>> {
    const listed = await withLinks(server)
    if (!listed.ok) return listed
    const orphans = listed.value.filter((c) => c.linkedTo === null && sameName(c.category, space.name))
    return ok(new Map(orphans.map((c) => [c.name, c.id])))
  }

  /** Vincula el canal con el huérfano de su mismo nombre o, si no hay, con uno nuevo. Un canal nuevo está vacío:
      no hay nada que traer. `null` si el canal de HackAI ya no existe. */
  async function createOne(
    server: ExternalServer,
    group: ExternalGroup,
    channel: StoredChannel,
    name: string,
    orphans: Map<string, string>
  ): Promise<Result<StoredChannel | null, CreateError>> {
    let externalId = orphans.get(name)
    if (!externalId) {
      const made = await externalChannel.createChannel(server.serverId, group, { name, writers: writersOf(channel) })
      if (!made.ok) return made
      externalId = made.value.id
    }
    return store.linkChannel(channel.id, { system: server.system, channelId: externalId })
  }

  /** Crea y vincula, uno por uno, los canales que faltan. Si uno falla, los anteriores ya quedaron vinculados:
      reintentar crea solo lo que falta. */
  async function createMissing(
    { space, member }: Managed,
    server: ExternalServer,
    group: ExternalGroup,
    missing: StoredChannel[]
  ): Promise<Result<StoredChannel[], CreateError>> {
    const orphans = await orphansIn(space, server)
    if (!orphans.ok) return orphans
    const created: StoredChannel[] = []
    for (const channel of missing) {
      const name = externalName(channel, currentSectionOf(member, channel)?.name ?? null)
      const linked = await createOne(server, group, channel, name, orphans.value)
      if (!linked.ok) return linked
      if (linked.value) created.push(linked.value)
    }
    return ok(created)
  }

  async function createChannels(managed: Managed, channels: StoredChannel[]) {
    if (!supported()) return fail('no-soportado' as const)
    const { space, member } = managed
    const server = space.externalServer
    if (!server) return fail('sin-servidor' as const)
    const now = managedNow(member, channels)
    const missing = now.filter((c) => !c.externalLink)
    const alreadyLinked = now.length - missing.length
    if (now.length === 0) return ok({ created: [] as StoredChannel[], alreadyLinked })

    // Aunque no falte ningún canal, así los docentes que vincularon su cuenta después reciben el rol.
    const group = await externalChannel.prepareGroup(server.serverId, {
      name: space.name,
      teacherIds: await teacherAccounts(member, server)
    })
    if (!group.ok) return group
    if (missing.length === 0) return ok({ created: [] as StoredChannel[], alreadyLinked })
    const created = await createMissing(managed, server, group.value, missing)
    return created.ok ? ok({ created: created.value, alreadyLinked }) : created
  }

  return { connect, serverChannels, createChannels }
}
