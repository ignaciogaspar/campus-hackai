/* Espacio de la materia: los canales como pestañas arriba (Avisos, Consultas,
   Material, los que crea un docente y Directos), cada una con sus no leídos, y
   lo de la pestaña elegida. El canal va en `?canal=` (también uno directo,
   con su id), la lista de mensajes directos en `?vista=directos`, el hilo de
   una consulta en `?hilo=`, el filtro de Consultas en `?filtro=`, lo buscado
   en el material en `?buscar=` y el
   formulario de canal nuevo en `?nuevo=canal`: todo se navega con enlaces, sin
   JavaScript. Escribirle a un docente por primera vez es un formulario. De
   dónde se llegó va en `?desde=` (Novedades, Hoy, Mis materias): ahí lleva
   «Volver» y, si falta, al inicio del rol (lib/home.ts).

   En el celular es una columna y el campo para escribir queda pegado abajo.
   Con un hilo abierto, el celular lo muestra en modo foco: sin las pestañas
   de la materia, el selector de comisión ni el riel de canales, con una sola
   fila para volver. En compu, tres columnas: canales, conversación y un panel
   de contexto.

   Mientras un canal está abierto se actualiza solo (ChannelUpdates): lo nuevo
   del canal externo o de otros aparece sin recargar. Al leer un canal, la
   barra lateral baja sus no leídos (UnreadRefresh, en el layout).

   Arriba de todo, la barra de pestañas de la materia (Espacio, Tareas y, para el
   docente, Alumnos) que conserva `?comision=`. Si el docente dicta más de una
   comisión, también el selector, que gobierna el espacio (section-focus.ts): el
   riel muestra solo los canales de la comisión elegida, sin `?canal=` se abren
   sus Avisos y abrir un canal de otra comisión pone el selector en esa. Los
   enlaces del riel, Directos y el canal nuevo llevan `?comision=`.

   Sin `?canal=` se abre el primer canal del riel con algo sin leer (si no hay,
   lo que elige la comisión). Lo que no se había
   leído sigue marcado mientras se mira, con el separador «Nuevos»
   (UnreadMemory), aunque UnreadRefresh vuelva a leer la página.

   Sin reglas de negocio: qué canales ve cada uno, qué puede hacer y qué no
   leyó lo decide Espacios. Abrir el canal lo marca leído.

   Esta ruta no lleva loading.tsx: con él, en la build de producción, cambiar
   de canal (misma ruta, otro `?canal=`) a veces no se aplicaba. El router
   recibía la página y no la mostraba hasta el clic siguiente. */
import { ChevronRight } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { cache } from 'react'
import { PageHeader } from '@/components/shell/page-header'
import {
  AnnouncementsPanel,
  FreeChannelPanel,
  QuestionsPanel,
  questionFilter,
  ThreadPanel
} from '@/components/spaces/channel-panels'
import { ChannelTabs } from '@/components/spaces/channel-tabs'
import { ChannelUpdates } from '@/components/spaces/channel-updates'
import { ContextPanel, shownSections } from '@/components/spaces/context-panel'
import { DirectPanel, DirectsPanel } from '@/components/spaces/direct-panels'
import { type DiscordNotice, isDiscordNotice } from '@/components/spaces/discord-format'
import { DiscordLink, type ServerChoices } from '@/components/spaces/discord-link'
import { DiscordServer, type DiscordServerProps } from '@/components/spaces/discord-server'
import {
  channelLabel,
  firstUnreadChannel,
  hasSeveralSections,
  isDirect,
  messageTime,
  type SpaceQuery,
  spaceHref
} from '@/components/spaces/format'
import { MaterialPanel } from '@/components/spaces/material-panel'
import type { MaterialSearchResult } from '@/components/spaces/material-search'
import { NewChannelForm } from '@/components/spaces/new-channel-form'
import { focusSection, type SectionFocus } from '@/components/spaces/section-focus'
import { UnreadMemory } from '@/components/spaces/unread-memory'
import { SubjectIcon, subjectTheme } from '@/components/subjects/subject-icon'
import { noAccessText, SUBJECT_TABS, subjectTabHref } from '@/components/subjects/subject-nav'
import { SUBJECT_WIDTH, SubjectToolbar } from '@/components/subjects/subject-toolbar'
import { ErrorNotice, StaleNotice } from '@/components/ui/states'
import { getSession, requireSession } from '@/lib/auth'
import { system } from '@/lib/composition'
import type { Role } from '@/lib/core/people'
import type { AccessError, Channel, ChannelView, SpaceSection, Spaces, SpaceView } from '@/lib/core/spaces'
import { type Back, backFor } from '@/lib/home'
import type { Fail } from '@/lib/result'
import { cn } from '@/lib/utils'

type Params = Promise<{ subjectId: string }>
type SearchParams = Promise<Record<string, string | string[] | undefined>>

type ChannelError = Extract<Awaited<ReturnType<Spaces['channel']>>, Fail<string>>['error']

/* Lo comparten generateMetadata y la página en el mismo pedido, así el espacio se abre una sola vez. */
const openSpace = cache((personId: string, subjectId: string) => system().spaces.open(personId, subjectId))

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const session = await getSession()
  const { subjectId } = await params
  const opened = session ? await openSpace(session.personId, subjectId) : null
  return { title: `${opened?.ok ? opened.value.space.name : 'Materia'} · Campus HackAI` }
}

/** `sin-acceso` depende del rol: lo dice `noAccessText`. */
const OPEN_ERRORS: Record<Exclude<AccessError, 'sin-acceso'>, string> = {
  'persona-desconocida': 'No encontramos tus datos en el SIU. Salí y volvé a entrar.',
  'falla-externa': 'No pudimos abrir el espacio porque el SIU no responde. Probá de nuevo en un rato.'
}

type ServerChannelsError = Extract<Awaited<ReturnType<Spaces['serverChannels']>>, Fail<string>>['error']

/** Por qué no se listan los canales del servidor conectado: queda pegar el enlace. */
const SERVER_CHANNELS_ERRORS: Record<ServerChannelsError, string> = {
  'no-es-miembro':
    'Para elegir de la lista, conectá la materia con una cuenta de Discord que sea miembro del servidor. Mientras, pegá el enlace del canal.',
  'sin-servidor': 'Conectá la materia con Discord para elegir el canal de una lista.',
  'no-soportado': 'El canal externo de esta instalación no lista canales: pegá el enlace del canal.',
  'servidor-inexistente': 'El bot de HackAI ya no está en el servidor conectado. Volvé a conectar con Discord.',
  'sin-permisos': 'El bot de HackAI no puede ver los canales del servidor. Volvé a conectar con Discord.',
  'solo-docentes': 'Solo los docentes de la materia eligen canales del servidor.',
  'espacio-desconocido': 'Este espacio ya no existe. Recargá la página.',
  'sin-acceso': 'No sos parte de esta materia.',
  'persona-desconocida': 'No encontramos tus datos en el SIU. Salí y volvé a entrar.',
  'falla-externa': 'Discord no respondió y no pudimos traer los canales del servidor. Pegá el enlace del canal.'
}

/** Lo de Discord que ve quien gestiona el espacio: la tarjeta del servidor y la lista de sus canales. */
type DiscordContext = { server: DiscordServerProps | null; choices: ServerChoices | null }

const NO_DISCORD: DiscordContext = { server: null, choices: null }

const CHANNEL_ERRORS: Record<ChannelError, string> = {
  'canal-desconocido': 'Ese canal no existe o ya no está.',
  'sin-acceso': 'No podés ver ese canal: es de otra comisión o es un mensaje directo entre otras personas.',
  'persona-desconocida': OPEN_ERRORS['persona-desconocida'],
  'falla-externa': 'No pudimos traer los mensajes de este canal. Probá de nuevo en un rato.'
}

function singleParam(value: string | string[] | undefined): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined
}

function readQuery(raw: Record<string, string | string[] | undefined>): SpaceQuery {
  return {
    canal: singleParam(raw.canal),
    hilo: singleParam(raw.hilo),
    filtro: singleParam(raw.filtro),
    nuevo: singleParam(raw.nuevo) === 'canal' ? 'canal' : undefined,
    vista: singleParam(raw.vista) === 'directos' ? 'directos' : undefined,
    buscar: singleParam(raw.buscar)?.trim() || undefined,
    comision: singleParam(raw.comision),
    desde: singleParam(raw.desde)
  }
}

/** Debajo del título: la comisión y su docente para el alumno; «Docente · Comisión A» para el docente. */
function SectionChips({ view }: { view: SpaceView }) {
  const sections = shownSections(view.viewer.sections)
  return sections.map((s) => (
    <span
      key={s.sectionId}
      className='rounded-full bg-white/12 px-3 py-1 text-xs font-semibold text-white ring-1 ring-white/15 ring-inset'
    >
      {view.viewer.role === 'profesor'
        ? `Docente · Comisión ${s.name}`
        : [`Comisión ${s.name}`, s.teachers[0]?.name].filter(Boolean).join(' · ')}
    </span>
  ))
}

function RetryLink({ href }: { href: string }) {
  return (
    <Link href={href} className='inline-flex min-h-11 items-center gap-1 font-bold underline'>
      Reintentar
      <ChevronRight aria-hidden='true' className='size-4' />
    </Link>
  )
}

function SpaceError({
  error,
  retryHref,
  role,
  back
}: {
  error: AccessError
  retryHref: string
  role: Role
  back: Back
}) {
  return (
    <>
      <PageHeader title='Espacio de la materia' back={back} hideBackOnDesktop art='general' desktopBell={false} />
      <main className='flex w-full flex-col gap-4 px-4 pt-5 pb-16 lg:px-6 lg:pt-8'>
        <ErrorNotice>
          <p>{error === 'sin-acceso' ? noAccessText(role) : OPEN_ERRORS[error]}</p>
          {error === 'falla-externa' && <RetryLink href={retryHref} />}
          {error === 'sin-acceso' && (
            <Link href='/materias' className='inline-flex min-h-10 items-center gap-1 font-bold underline'>
              Ir a Mis materias
              <ChevronRight aria-hidden='true' className='size-4' />
            </Link>
          )}
        </ErrorNotice>
      </main>
    </>
  )
}

type ChannelResult = { ok: true; value: ChannelView } | { ok: false; error: ChannelError }

/** Lo de la pestaña elegida: el hilo si hay `?hilo=`, o el panel según el tipo de canal. `channels` son los del
    riel y `comision`, la elegida en el selector si hay varias. */
function ChannelArea({
  subjectId,
  view,
  channels,
  comision,
  opened,
  query,
  search,
  discord
}: {
  subjectId: string
  view: SpaceView
  channels: Channel[]
  comision: string | undefined
  opened: ChannelResult
  query: SpaceQuery
  search: MaterialSearchResult | null
  discord: DiscordContext
}) {
  if (!opened.ok) {
    return (
      <ErrorNotice>
        <p>{CHANNEL_ERRORS[opened.error]}</p>
        {opened.error === 'falla-externa' && <RetryLink href={spaceHref(subjectId, query)} />}
        <Link
          href={spaceHref(subjectId, { comision })}
          className='inline-flex min-h-10 items-center gap-1 font-bold underline'
        >
          Volver al espacio
          <ChevronRight aria-hidden='true' className='size-4' />
        </Link>
      </ErrorNotice>
    )
  }
  const { channel, threads, version } = opened.value
  const props = { subjectId, channel, threads, viewerId: view.viewer.personId }
  // Trae lo nuevo del canal sin recargar, también con un hilo abierto.
  const updates = <ChannelUpdates channelId={channel.id} version={version} />
  // Lo que no se había leído sigue marcado aunque UnreadRefresh vuelva a leer la página ya leída.
  const unread = [
    ...threads.flatMap((t) => [t.message, ...t.replies]),
    ...(opened.value.material?.sections.flatMap((s) => s.items) ?? [])
  ].flatMap((m) => (m.unread ? [m.id] : []))
  if (query.hilo && channel.kind !== 'directo') {
    const backLabel = channelLabel(channel, hasSeveralSections(channels))
    return (
      <UnreadMemory scope={channel.id} unread={unread}>
        {updates}
        <ThreadPanel {...props} threadId={query.hilo} backLabel={backLabel} />
      </UnreadMemory>
    )
  }
  return (
    <UnreadMemory scope={channel.id} unread={unread}>
      {updates}
      <DiscordLink subjectId={subjectId} channel={channel} choices={discord.choices} />
      <ChannelPanel
        subjectId={subjectId}
        view={view}
        comision={comision}
        opened={opened.value}
        query={query}
        search={search}
      />
    </UnreadMemory>
  )
}

/** El panel según el tipo de canal. */
function ChannelPanel({
  subjectId,
  view,
  comision,
  opened,
  query,
  search
}: {
  subjectId: string
  view: SpaceView
  comision: string | undefined
  opened: ChannelView
  query: SpaceQuery
  search: MaterialSearchResult | null
}) {
  const { channel, threads, material } = opened
  const props = { subjectId, channel, threads, viewerId: view.viewer.personId, comision }
  switch (channel.kind) {
    case 'material':
      return (
        <MaterialPanel
          subjectId={subjectId}
          spaceId={view.space.id}
          channelId={channel.id}
          material={material ?? view.material}
          canManage={view.viewer.canManage}
          search={search}
          comision={comision}
        />
      )
    case 'avisos':
      return <AnnouncementsPanel {...props} />
    case 'consultas':
      return <QuestionsPanel {...props} filter={questionFilter(query.filtro)} role={view.viewer.role} />
    case 'directo':
      return <DirectPanel {...props} />
    default:
      return <FreeChannelPanel {...props} />
  }
}

/** Abre el canal elegido: el de `?canal=` o el que corresponde a la comisión elegida (`SectionFocus`). Un canal
    de otro espacio es un canal desconocido acá. */
async function openChannel(personId: string, view: SpaceView, channelId: string | null): Promise<ChannelResult | null> {
  if (!channelId) return null
  const opened = await system().spaces.channel(personId, channelId)
  if (opened.ok && opened.value.space.id !== view.space.id) return { ok: false, error: 'canal-desconocido' }
  return opened
}

/** Lo que va en la columna del medio: el formulario de canal nuevo, la lista de directos o un canal
    (`null` si el espacio no tiene ninguno). */
type Pane =
  | { kind: 'nuevo' }
  | { kind: 'directos' }
  | { kind: 'canal'; opened: ChannelResult | null; search: MaterialSearchResult | null }

/** Si el canal abierto es el de material y hay algo en `?buscar=`, lo que encontró Espacios. */
async function searchIn(
  personId: string,
  view: SpaceView,
  opened: ChannelResult | null,
  buscar: string | undefined
): Promise<MaterialSearchResult | null> {
  if (!buscar || !opened?.ok || opened.value.channel.kind !== 'material') return null
  return { query: buscar, result: await system().spaces.search(personId, view.space.id, buscar) }
}

/** Con el formulario de canal nuevo o la lista de directos a la vista no se abre ningún canal, así no se
    marca leído lo que no se vio. */
async function paneFor(personId: string, view: SpaceView, query: SpaceQuery, channelId: string | null): Promise<Pane> {
  if (query.nuevo === 'canal' && view.viewer.canManage) return { kind: 'nuevo' }
  if (query.vista === 'directos') return { kind: 'directos' }
  const opened = await openChannel(personId, view, channelId)
  return { kind: 'canal', opened, search: await searchIn(personId, view, opened, query.buscar) }
}

function paneLabel(pane: Pane, selected: Channel | null, channels: Channel[]): string {
  if (pane.kind === 'nuevo') return 'Canal nuevo'
  if (pane.kind === 'directos') return 'Directos'
  return selected ? channelLabel(selected, hasSeveralSections(channels)) : 'Canal'
}

/** Para el docente que gestiona el espacio: la tarjeta del Discord de la cátedra y, si el canal abierto se
    puede vincular y la materia está conectada, los canales del servidor para elegir uno. */
async function discordFor(
  personId: string,
  subjectId: string,
  view: SpaceView,
  pane: Pane,
  notice: DiscordNotice | null
): Promise<DiscordContext> {
  if (!view.viewer.canManage) return NO_DISCORD
  const server: DiscordServerProps = {
    subjectId,
    spaceId: view.space.id,
    canConnect: system().discordOAuth !== null,
    server: view.externalServer,
    // Lo que crearía «Crear canales en Discord»: el material y los de sus comisiones vigentes.
    unlinked: view.channels.filter(
      (c) =>
        c.canLink &&
        !c.externalLink &&
        (c.scope.kind === 'materia' ||
          view.viewer.sections.some(
            (s) => s.current && c.scope.kind === 'comision' && s.sectionId === c.scope.sectionId
          ))
    ).length,
    notice
  }
  const channel = pane.kind === 'canal' && pane.opened?.ok ? pane.opened.value.channel : null
  if (!view.externalServer || !channel?.canLink) return { server, choices: null }
  const listed = await system().spaces.serverChannels(personId, view.space.id)
  const choices: ServerChoices = listed.ok
    ? { ok: true, channels: listed.value }
    : { ok: false, message: SERVER_CHANNELS_ERRORS[listed.error] }
  return { server, choices }
}

function CenterContent({
  subjectId,
  view,
  channels,
  comision,
  pane,
  query,
  discord
}: {
  subjectId: string
  view: SpaceView
  /** Los del riel: con varias comisiones, los de la elegida. */
  channels: Channel[]
  /** La comisión elegida en el selector, si el docente dicta varias: la llevan los enlaces. */
  comision: string | undefined
  pane: Pane
  query: SpaceQuery
  discord: DiscordContext
}) {
  if (pane.kind === 'nuevo') {
    return (
      <NewChannelForm
        subjectId={subjectId}
        spaceId={view.space.id}
        sections={shownSections(view.viewer.sections)}
        cancelHref={spaceHref(subjectId, { canal: query.canal, comision })}
      />
    )
  }
  if (pane.kind === 'directos') {
    return (
      <DirectsPanel
        space={{ subjectId, spaceId: view.space.id }}
        role={view.viewer.role}
        directs={channels.filter(isDirect)}
        contacts={view.viewer.directContacts}
        comision={comision}
      />
    )
  }
  if (!pane.opened) return <ErrorNotice>Este espacio todavía no tiene canales.</ErrorNotice>
  return (
    <ChannelArea
      subjectId={subjectId}
      view={view}
      channels={channels}
      comision={comision}
      opened={pane.opened}
      query={query}
      search={pane.search}
      discord={discord}
    />
  )
}

/** La columna del medio con la tarjeta del Discord de la cátedra arriba, en cualquier estado del espacio: así el
    aviso de la vuelta de Discord se ve aunque no haya un canal abierto. */
function CenterPane(props: Parameters<typeof CenterContent>[0]) {
  const { server } = props.discord
  // En el modo foco del hilo, en el celular, la tarjeta de Discord tampoco va.
  const focused = props.query.hilo !== undefined && props.pane.kind === 'canal'
  return (
    <>
      {server && (
        <div className={cn(focused && 'max-lg:hidden')}>
          <DiscordServer {...server} />
        </div>
      )}
      <CenterContent {...props} />
    </>
  )
}

/** Las comisiones del selector: las vigentes que dicta el docente. El alumno no tiene selector. */
function taughtSections(view: SpaceView): SpaceSection[] {
  return view.viewer.role === 'profesor' ? view.viewer.sections.filter((s) => s.current) : []
}

/** Sin `?canal=`, el primer canal del riel con algo sin leer; si no hay, el de la comisión elegida. */
function channelToOpen(query: SpaceQuery, focus: SectionFocus): string | null {
  if (query.canal) return focus.channelId
  return firstUnreadChannel(focus.channels)?.id ?? focus.channelId
}

/** Con un hilo abierto, en el celular van solo el encabezado y el hilo: sin pestañas, comisión ni riel de canales. */
function threadFocus(query: SpaceQuery, selected: Channel | null): boolean {
  return query.hilo !== undefined && selected !== null && selected.kind !== 'directo'
}

export default async function SpacePage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const session = await requireSession()
  const { subjectId } = await params
  const raw = await searchParams
  const query = readQuery(raw)
  const notice = singleParam(raw.discord)

  const back = backFor(session.role, query.desde)

  const opened = await openSpace(session.personId, subjectId)
  if (!opened.ok) {
    return <SpaceError error={opened.error} retryHref={spaceHref(subjectId, query)} role={session.role} back={back} />
  }
  const view = opened.value
  const taught = taughtSections(view)
  const focus = focusSection(
    view.channels,
    taught.map((s) => s.sectionId),
    query
  )
  // Solo con el selector a la vista los enlaces llevan la comisión.
  const comision = taught.length > 1 ? (focus.sectionId ?? undefined) : undefined
  const channelId = channelToOpen(query, focus)
  const pane = await paneFor(session.personId, view, query, channelId)
  const discord = await discordFor(session.personId, subjectId, view, pane, isDiscordNotice(notice) ? notice : null)

  // El canal elegido ya quedó leído: su contador sale de lo que devolvió `channel`.
  const selected = pane.kind === 'canal' && pane.opened?.ok ? pane.opened.value.channel : null
  const channels = focus.channels.map((c) => (c.id === selected?.id ? selected : c))
  // Si tenía no leídos, los de la barra lateral quedaron viejos: con `data-just-read` en <main>,
  // UnreadRefresh la vuelve a leer.
  const hadUnread = (view.channels.find((c) => c.id === selected?.id)?.unread ?? 0) > 0
  const focused = threadFocus(query, selected)

  return (
    <>
      <PageHeader
        title={view.space.name}
        // El período de la comisión elegida: con Verano, «Curso de Verano 2027», no el de la A.
        subtitle={[
          view.space.subjectCode,
          (taught.find((s) => s.sectionId === focus.sectionId) ?? shownSections(view.viewer.sections)[0])?.termName
        ]
          .filter(Boolean)
          .join(' · ')}
        icon={<SubjectIcon name={view.space.name} size='lg' tone='glass' className='max-sm:hidden' />}
        art={subjectTheme(view.space.name).art}
        back={back}
        hideBackOnDesktop
        desktopBell={false}
      >
        <SectionChips view={view} />
      </PageHeader>

      <main
        data-just-read={hadUnread ? '' : undefined}
        className={cn(
          SUBJECT_WIDTH,
          'flex flex-col gap-4 px-4 pt-5 pb-[calc(var(--dock-extra)+1rem)] lg:px-8 lg:pt-8 lg:pb-8'
        )}
      >
        {view.staleSince && (
          <StaleNotice>
            El SIU no responde. Las comisiones salen de lo que trajimos el {messageTime(view.staleSince)}: puede estar
            desactualizado.
          </StaleNotice>
        )}

        <div className={cn(focused && 'max-lg:hidden')}>
          <SubjectToolbar
            subjectId={subjectId}
            current='espacio'
            viewer={view.viewer.role}
            sections={taught}
            selectedId={focus.sectionId ?? ''}
            hrefFor={(sectionId) => subjectTabHref(subjectId, SUBJECT_TABS[0], sectionId)}
          />
        </div>

        <div className='grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start lg:gap-7 2xl:grid-cols-[16rem_minmax(0,1fr)_21rem]'>
          <ChannelTabs
            subjectId={subjectId}
            channels={channels}
            comision={comision}
            selectedId={pane.kind === 'canal' ? channelId : null}
            canManage={view.viewer.canManage}
            creating={pane.kind === 'nuevo'}
            showingDirects={pane.kind === 'directos'}
            focused={focused}
          />

          <section
            aria-label={paneLabel(pane, selected, channels)}
            className='flex min-w-0 flex-col gap-4 lg:min-h-[calc(100dvh-11rem)]'
          >
            <CenterPane
              subjectId={subjectId}
              view={view}
              channels={channels}
              comision={comision}
              pane={pane}
              query={query}
              discord={discord}
            />
          </section>

          <ContextPanel
            recent={view.material.recent}
            sections={view.viewer.sections}
            space={{ subjectId, spaceId: view.space.id }}
            contacts={view.viewer.directContacts}
          />
        </div>
      </main>
    </>
  )
}
