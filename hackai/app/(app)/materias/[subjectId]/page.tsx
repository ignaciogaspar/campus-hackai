/* Espacio de la materia: los canales como pestañas arriba (Avisos, Consultas,
   Material y los que crea un docente), cada una con sus no leídos, y lo de la
   pestaña elegida. La pestaña va en `?canal=`, el hilo de una consulta en
   `?hilo=`, el filtro de Consultas en `?filtro=` y el formulario de canal
   nuevo en `?nuevo=canal`: todo se navega con enlaces, sin JavaScript.

   En el celular es una columna y el campo para escribir queda pegado abajo.
   En compu, tres columnas: canales, conversación y un panel de contexto.

   Sin reglas de negocio: qué canales ve cada uno, qué puede hacer y qué no
   leyó lo decide Espacios. Abrir el canal lo marca leído. */
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
import { ContextPanel, shownSections } from '@/components/spaces/context-panel'
import { channelLabel, hasSeveralSections, messageTime, type SpaceQuery, spaceHref } from '@/components/spaces/format'
import { MaterialPanel } from '@/components/spaces/material-panel'
import { NewChannelForm } from '@/components/spaces/new-channel-form'
import { SubjectIcon, subjectTheme } from '@/components/subjects/subject-icon'
import { ErrorNotice, StaleNotice } from '@/components/ui/states'
import { getSession, requireSession } from '@/lib/auth'
import { system } from '@/lib/composition'
import type { AccessError, ChannelView, Spaces, SpaceView } from '@/lib/core/spaces'
import type { Fail } from '@/lib/result'

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

const OPEN_ERRORS: Record<AccessError, string> = {
  'sin-acceso': 'No sos parte de esta materia. Si recién te inscribiste, puede tardar un rato en aparecer.',
  'persona-desconocida': 'No encontramos tus datos en el SIU. Salí y volvé a entrar.',
  'falla-externa': 'No pudimos abrir el espacio porque el SIU no responde. Probá de nuevo en un rato.'
}

const CHANNEL_ERRORS: Record<ChannelError, string> = {
  'canal-desconocido': 'Ese canal no existe o ya no está.',
  'sin-acceso': 'Ese canal es de otra comisión: no lo podés ver.',
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
    nuevo: singleParam(raw.nuevo) === 'canal' ? 'canal' : undefined
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

function SpaceError({ error }: { error: AccessError }) {
  return (
    <>
      <PageHeader title='Espacio de la materia' backHref='/materias' hideBackOnDesktop art='general' />
      <main className='flex w-full flex-col gap-4 px-4 pt-5 pb-16 lg:px-6 lg:pt-8'>
        <ErrorNotice>
          <p>{OPEN_ERRORS[error]}</p>
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

/** Lo de la pestaña elegida: el hilo si hay `?hilo=`, o el panel según el tipo de canal. */
function ChannelArea({
  subjectId,
  view,
  opened,
  query
}: {
  subjectId: string
  view: SpaceView
  opened: ChannelResult
  query: SpaceQuery
}) {
  if (!opened.ok) {
    return (
      <ErrorNotice>
        <p>{CHANNEL_ERRORS[opened.error]}</p>
        <Link href={spaceHref(subjectId)} className='inline-flex min-h-10 items-center gap-1 font-bold underline'>
          Volver al espacio
          <ChevronRight aria-hidden='true' className='size-4' />
        </Link>
      </ErrorNotice>
    )
  }
  const { channel, threads, material } = opened.value
  const props = { subjectId, channel, threads }
  if (query.hilo) {
    const backLabel = channelLabel(channel, hasSeveralSections(view.channels))
    return <ThreadPanel {...props} threadId={query.hilo} backLabel={backLabel} />
  }
  switch (channel.kind) {
    case 'material':
      return (
        <MaterialPanel
          subjectId={subjectId}
          spaceId={view.space.id}
          material={material ?? view.material}
          canManage={view.viewer.canManage}
        />
      )
    case 'avisos':
      return <AnnouncementsPanel {...props} />
    case 'consultas':
      return <QuestionsPanel {...props} filter={questionFilter(query.filtro)} role={view.viewer.role} />
    default:
      return <FreeChannelPanel {...props} />
  }
}

/** Abre el canal elegido, o el primero. Un canal de otro espacio es un canal desconocido acá. */
async function openChannel(
  personId: string,
  view: SpaceView,
  canal: string | undefined
): Promise<ChannelResult | null> {
  const channelId = canal ?? view.channels[0]?.id
  if (!channelId) return null
  const opened = await system().spaces.channel(personId, channelId)
  if (opened.ok && opened.value.space.id !== view.space.id) return { ok: false, error: 'canal-desconocido' }
  return opened
}

export default async function SpacePage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const session = await requireSession()
  const { subjectId } = await params
  const query = readQuery(await searchParams)

  const opened = await openSpace(session.personId, subjectId)
  if (!opened.ok) return <SpaceError error={opened.error} />
  const view = opened.value
  const creating = query.nuevo === 'canal' && view.viewer.canManage
  // Con el formulario de canal nuevo a la vista no se abre ningún canal, así no se marca leído lo que no se vio.
  const channel = creating ? null : await openChannel(session.personId, view, query.canal)

  // El canal elegido ya quedó leído: su contador sale de lo que devolvió `channel`.
  const selected = channel?.ok ? channel.value.channel : null
  const channels = view.channels.map((c) => (c.id === selected?.id ? selected : c))
  const label = selected ? channelLabel(selected, hasSeveralSections(channels)) : 'Canal'

  return (
    <>
      <PageHeader
        title={view.space.name}
        subtitle={[view.space.subjectCode, shownSections(view.viewer.sections)[0]?.termName]
          .filter(Boolean)
          .join(' · ')}
        icon={<SubjectIcon name={view.space.name} size='lg' tone='glass' className='max-sm:hidden' />}
        art={subjectTheme(view.space.name).art}
        backHref='/materias'
        hideBackOnDesktop
      >
        <SectionChips view={view} />
      </PageHeader>

      <main className='flex w-full flex-col gap-4 px-4 pt-5 pb-24 lg:px-6 lg:pt-8 lg:pb-8'>
        {view.staleSince && (
          <StaleNotice>
            El SIU no responde. Las comisiones salen de lo que trajimos el {messageTime(view.staleSince)}: puede estar
            desactualizado.
          </StaleNotice>
        )}

        <div className='grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[15.5rem_minmax(0,1fr)_17.5rem] lg:items-start lg:gap-6'>
          <ChannelTabs
            subjectId={subjectId}
            channels={channels}
            selectedId={query.canal ?? selected?.id ?? channels[0]?.id ?? null}
            canManage={view.viewer.canManage}
            creating={creating}
          />

          <section
            aria-label={creating ? 'Canal nuevo' : label}
            className='flex min-w-0 flex-col gap-4 lg:min-h-[calc(100dvh-11rem)]'
          >
            {creating ? (
              <NewChannelForm
                subjectId={subjectId}
                spaceId={view.space.id}
                sections={shownSections(view.viewer.sections)}
                cancelHref={spaceHref(subjectId, { canal: query.canal })}
              />
            ) : channel ? (
              <ChannelArea subjectId={subjectId} view={view} opened={channel} query={query} />
            ) : (
              <ErrorNotice>Este espacio todavía no tiene canales.</ErrorNotice>
            )}
          </section>

          <ContextPanel recent={view.material.recent} sections={view.viewer.sections} />
        </div>
      </main>
    </>
  )
}
