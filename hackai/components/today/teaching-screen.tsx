/* Hoy del docente: dónde dicta, qué consultas de sus comisiones siguen sin
   respuesta, qué no leyó (los mensajes directos de sus alumnos incluidos) y
   sus próximos parciales y mesas, armado con lo que da Hoy en una sola llamada.
   Cada cosa lleva a su canal o a su hilo. Qué consultas le tocan y qué no leyó
   (sin repetir las consultas) lo deciden Hoy y Espacios; acá solo se muestra,
   con los íconos, títulos y horas de Novedades. Si una parte no se pudo
   leer, esa parte dice por qué y el resto se ve igual. Arriba de todo va su
   clase de ahora (o la próxima), con Tomar lista y, si es virtual o híbrida,
   Entrar a Zoom.

   En el celular es una columna: consultas, no leídos, comisiones y fechas. En
   compu, a la izquierda lo que espera una respuesta y a la derecha sus
   comisiones y sus fechas. */
import { CircleCheck, Users } from 'lucide-react'
import type { ReactNode } from 'react'
import { newsRow } from '@/components/news/format'
import { ChannelIcon } from '@/components/spaces/channel-icon'
import { messageTime, spaceHref } from '@/components/spaces/format'
import { NowClassCard } from '@/components/today/now-class'
import { UpcomingRow } from '@/components/today/upcoming'
import { Card } from '@/components/ui/card'
import { List, ListItem } from '@/components/ui/list'
import { OriginBadge } from '@/components/ui/origin-badge'
import { StaleBanner } from '@/components/ui/stale-banner'
import { EmptyState, ErrorNotice } from '@/components/ui/states'
import { UnreadCount } from '@/components/ui/unread-count'
import type { OpenQuestion, UnreadItem } from '@/lib/core/spaces'
import type { TaughtSection, TeachingPart, TeachingView } from '@/lib/core/today'
import { cn } from '@/lib/utils'

const DOWN: Record<TeachingPart, string> = {
  sections: 'No pudimos traer tus comisiones porque el SIU no responde. Probá de nuevo en un rato.',
  questions: 'No pudimos traer las consultas de tus comisiones. Probá de nuevo en un rato.',
  dates: 'No pudimos traer tus parciales y mesas porque el SIU no responde. Probá de nuevo en un rato.',
  unread: 'No pudimos traer lo que no leíste. Probá de nuevo en un rato.',
  class: 'No pudimos traer tu clase de ahora porque el SIU no responde. Probá de nuevo en un rato.'
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className='flex min-w-0 flex-col gap-3'>
      <h2 id={id} className='text-lg font-extrabold'>
        {title}
      </h2>
      {children}
    </section>
  )
}

function Icon({ children }: { children: ReactNode }) {
  return (
    <span className='grid size-10 flex-none place-items-center rounded-full bg-accent text-blue-light'>{children}</span>
  )
}

function replies(n: number): string {
  if (n === 0) return 'Sin respuesta'
  return n === 1 ? '1 respuesta' : `${n} respuestas`
}

function QuestionRow({ question: q }: { question: OpenQuestion }) {
  const where = q.sectionName ? `${q.subjectName} · Comisión ${q.sectionName}` : q.subjectName
  return (
    <ListItem
      href={spaceHref(q.subjectId, { canal: q.channelId, hilo: q.messageId })}
      start={
        <Icon>
          <ChannelIcon kind='consultas' className='size-5' />
        </Icon>
      }
      title={<span className='line-clamp-2'>{q.text}</span>}
      description={`${q.author.name} · ${where}`}
      meta={
        <>
          <time dateTime={q.createdAt}>{messageTime(q.createdAt)}</time>
          <span aria-hidden='true'>·</span>
          <span className={cn(q.replies === 0 && 'font-semibold text-warning-foreground')}>{replies(q.replies)}</span>
          {q.origin !== 'hackai' && <OriginBadge origin={q.origin} />}
        </>
      }
    />
  )
}

function Questions({ view }: { view: TeachingView }) {
  if (view.unavailable.includes('questions')) return <ErrorNotice>{DOWN.questions}</ErrorNotice>
  if (view.questions.length === 0) {
    return (
      <EmptyState icon={CircleCheck} title='No hay consultas sin resolver'>
        Cuando un alumno pregunte en Consultas de tus comisiones, la vas a ver acá hasta que la marques resuelta.
      </EmptyState>
    )
  }
  return (
    <Card>
      <List>
        {view.questions.map((q) => (
          <QuestionRow key={q.messageId} question={q} />
        ))}
      </List>
    </Card>
  )
}

/** Como en Novedades: el ícono y el título del canal (un directo, con el nombre del alumno) y la misma hora. */
function UnreadRow({ item }: { item: UnreadItem }) {
  const row = newsRow(item)
  return (
    <ListItem
      href={row.href}
      start={
        <Icon>
          <ChannelIcon kind={item.kind} className='size-5' />
        </Icon>
      }
      title={`${row.title} · ${item.subjectName}`}
      description={row.text}
      meta={<time dateTime={row.createdAt}>{row.when}</time>}
      end={<UnreadCount count={item.count} />}
    />
  )
}

function Unread({ view }: { view: TeachingView }) {
  const down = view.unavailable.includes('unread')
  if (!down && view.unread.length === 0) return null
  return (
    <Section id='sin-leer' title='Sin leer'>
      {down ? <ErrorNotice>{DOWN.unread}</ErrorNotice> : <UnreadList view={view} />}
    </Section>
  )
}

function UnreadList({ view }: { view: TeachingView }) {
  return (
    <Card>
      <List>
        {view.unread.map((u) => (
          <UnreadRow key={u.channelId} item={u} />
        ))}
      </List>
    </Card>
  )
}

function SectionRow({ section: s }: { section: TaughtSection }) {
  return (
    <ListItem
      href={spaceHref(s.subjectId)}
      className='items-center'
      start={
        <span
          aria-hidden='true'
          className='grid size-10 flex-none place-items-center rounded-[10px] bg-blue text-[11px] font-extrabold text-white'
        >
          {s.subjectCode}
        </span>
      }
      title={s.subjectName}
      description={`Comisión ${s.name} · ${s.termName}`}
      end={<UnreadCount count={s.unread} />}
    />
  )
}

function Sections({ view }: { view: TeachingView }) {
  if (view.unavailable.includes('sections')) return <ErrorNotice>{DOWN.sections}</ErrorNotice>
  if (view.sections.length === 0) {
    return (
      <EmptyState icon={Users} title='No dictás comisiones este cuatrimestre'>
        Las que dictaste antes siguen en Materias, archivadas.
      </EmptyState>
    )
  }
  return (
    <Card>
      <List>
        {view.sections.map((s) => (
          <SectionRow key={s.sectionId} section={s} />
        ))}
      </List>
    </Card>
  )
}

function Dates({ view }: { view: TeachingView }) {
  if (view.unavailable.includes('dates')) return <ErrorNotice>{DOWN.dates}</ErrorNotice>
  if (view.dates.length === 0) {
    return (
      <EmptyState icon={CircleCheck} title='No tenés parciales ni mesas por delante'>
        Cuando el SIU tenga fechas de tus comisiones o de mesas que integrás, las vas a ver acá.
      </EmptyState>
    )
  }
  return (
    <Card>
      <List>
        {view.dates.map((d) => (
          <UpcomingRow key={d.id} item={d} viewer='profesor' />
        ))}
      </List>
    </Card>
  )
}

/** Nada que responder ni que leer, y las dos lecturas respondieron: se dice una vez, en vez de dos vacíos. */
function allClear(view: TeachingView): boolean {
  const read = !view.unavailable.includes('questions') && !view.unavailable.includes('unread')
  return read && view.questions.length === 0 && view.unread.length === 0
}

export function TeachingScreen({ view }: { view: TeachingView }) {
  return (
    <div className='flex flex-col gap-6'>
      {view.staleSince && <StaleBanner since={view.staleSince} now={view.now} />}

      {view.unavailable.includes('class') ? (
        <ErrorNotice>{DOWN.class}</ErrorNotice>
      ) : (
        view.nowClass && <NowClassCard nowClass={view.nowClass} now={view.now} />
      )}

      <div className='grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(18.75rem,1fr)] lg:items-start'>
        <div className='flex min-w-0 flex-col gap-6'>
          {allClear(view) ? (
            <EmptyState icon={CircleCheck} title='Estás al día'>
              No hay consultas sin resolver ni mensajes sin leer en tus comisiones.
            </EmptyState>
          ) : (
            <>
              <Section id='consultas' title='Consultas sin resolver'>
                <Questions view={view} />
              </Section>
              <Unread view={view} />
            </>
          )}
        </div>

        <div className='flex min-w-0 flex-col gap-6'>
          <Section id='comisiones' title='Tus comisiones'>
            <Sections view={view} />
          </Section>
          <Section id='fechas' title='Parciales y mesas'>
            <Dates view={view} />
          </Section>
        </div>
      </div>
    </div>
  )
}
