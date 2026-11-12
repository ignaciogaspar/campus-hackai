/* Novedades: lo que no leíste en los espacios de tus materias, adonde lleva la
   campana del encabezado. Una tarjeta por materia y, adentro, una fila por
   canal con cuántos mensajes nuevos hay y el último, que lleva directo a ese
   canal. Sin reglas de negocio: qué canales ve cada uno y qué no leyó lo
   decide Espacios. Abrir el canal lo marca leído, no esta pantalla.

   Una columna de lectura de 760 px como máximo, también en compu
   (docs/design/direccion-de-diseno.md). */
import { BellRing, ChevronRight } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { PageHeader } from '@/components/shell/page-header'
import { ChannelIcon } from '@/components/spaces/channel-icon'
import { channelName, messageTime, spaceHref } from '@/components/spaces/format'
import { SubjectIcon } from '@/components/subjects/subject-icon'
import { Card } from '@/components/ui/card'
import { EmptyState, ErrorNotice } from '@/components/ui/states'
import { UnreadCount } from '@/components/ui/unread-count'
import { requireSession } from '@/lib/auth'
import { system } from '@/lib/composition'
import type { UnreadItem } from '@/lib/core/spaces'

export const metadata: Metadata = { title: 'Novedades · Campus HackAI' }

const ERRORS: Record<'persona-desconocida' | 'falla-externa', string> = {
  'persona-desconocida': 'No encontramos tus datos en el SIU. Salí y volvé a entrar.',
  'falla-externa': 'No pudimos traer tus novedades porque el SIU no responde. Probá de nuevo en un rato.'
}

type SubjectGroup = { subjectId: string; subjectName: string; total: number; items: UnreadItem[] }

/** Agrupa por materia, en el orden en que vienen: la de la novedad más reciente primero. */
function bySubject(items: UnreadItem[]): SubjectGroup[] {
  const groups = new Map<string, SubjectGroup>()
  for (const item of items) {
    const group = groups.get(item.subjectId) ?? {
      subjectId: item.subjectId,
      subjectName: item.subjectName,
      total: 0,
      items: []
    }
    group.total += item.count
    group.items.push(item)
    groups.set(item.subjectId, group)
  }
  return [...groups.values()]
}

function ChannelRow({ item }: { item: UnreadItem }) {
  const name = channelName(item.kind, item.channelName)
  return (
    <li>
      <Link
        href={spaceHref(item.subjectId, { canal: item.channelId })}
        className='group flex items-start gap-3 px-4 py-3.5 text-foreground transition-colors duration-150 hover:bg-blue/[0.04] focus-ring-inset'
      >
        <span className='grid size-9 flex-none place-items-center rounded-full bg-background text-muted-foreground [&_svg]:size-4.5'>
          <ChannelIcon kind={item.kind} />
        </span>
        <span className='flex min-w-0 flex-1 flex-col gap-0.5'>
          <span className='flex items-center gap-2'>
            <span className='font-semibold'>{name}</span>
            <UnreadCount count={item.count} />
          </span>
          <span className='line-clamp-2 text-[0.8125rem] text-pretty text-foreground/80'>{item.latest.text}</span>
          <time dateTime={item.latest.createdAt} className='text-xs text-muted-foreground'>
            {messageTime(item.latest.createdAt)}
          </time>
        </span>
        <ChevronRight
          aria-hidden='true'
          className='mt-2 size-5 flex-none text-gray-light transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-blue motion-reduce:transition-none'
          strokeWidth={1.8}
        />
      </Link>
    </li>
  )
}

function SubjectNews({ group }: { group: SubjectGroup }) {
  const id = `materia-${group.subjectId}`
  return (
    <section aria-labelledby={id}>
      <Card>
        <div className='flex items-center gap-3 border-b border-border px-4 py-3'>
          <SubjectIcon name={group.subjectName} />
          <h2 id={id} className='min-w-0 flex-1 leading-snug font-bold text-balance'>
            {group.subjectName}
          </h2>
          <Link
            href={spaceHref(group.subjectId)}
            className='inline-flex min-h-9 flex-none items-center gap-0.5 rounded-full px-3 text-[0.8125rem] font-semibold text-blue hover:bg-accent focus-ring'
          >
            Abrir espacio
            <span className='sr-only'> de {group.subjectName}</span>
            <ChevronRight aria-hidden='true' className='size-4' />
          </Link>
        </div>
        <ul className='divide-y divide-border'>
          {group.items.map((item) => (
            <ChannelRow key={item.channelId} item={item} />
          ))}
        </ul>
      </Card>
    </section>
  )
}

export default async function NovedadesPage() {
  const session = await requireSession()
  const result = await system().spaces.unreadFor(session.personId)
  const groups = result.ok ? bySubject(result.value) : []
  const total = groups.reduce((n, g) => n + g.total, 0)

  let subtitle = 'Avisos, consultas y material nuevo de tus materias.'
  if (result.ok && total > 0)
    subtitle = `${total} ${total === 1 ? 'mensaje sin leer' : 'mensajes sin leer'} en tus materias.`

  return (
    <>
      <PageHeader title='Novedades' subtitle={subtitle} backHref='/hoy' hideBackOnDesktop art='novedades' />

      <main className='flex w-full max-w-[47.5rem] flex-col gap-4 px-4 pt-5 pb-16 lg:px-6 lg:pt-8'>
        {!result.ok ? (
          <ErrorNotice>{ERRORS[result.error]}</ErrorNotice>
        ) : groups.length === 0 ? (
          <EmptyState icon={BellRing} title='Estás al día'>
            Cuando un docente publique un aviso o material, o alguien responda una consulta, lo vas a ver acá.
          </EmptyState>
        ) : (
          groups.map((group) => <SubjectNews key={group.subjectId} group={group} />)
        )}
      </main>
    </>
  )
}
