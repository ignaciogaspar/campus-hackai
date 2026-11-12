/* Novedades: adonde lleva la campana del encabezado. Lo que no leíste en todos
   tus espacios, agrupado por materia y canal, con quién publicó lo último, el
   texto y cuándo; cada fila lleva al canal o al hilo, que al abrirse queda
   leído. Arriba, el filtro por tipo (avisos, consultas, material, directos,
   otros canales), con cuántos hay de cada uno, en `?tipo=`. Sirve al alumno y
   al docente. En compu, una columna de lectura centrada. Se llega desde la
   campana o desde la barra lateral.

   Sin reglas de negocio: qué no leíste, de quién es un directo y si todo es de
   un mismo hilo lo dice Espacios. */
import { CheckCheck, SearchX } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { NEWS_KINDS, type NewsKind, newsBySubject, newsKindOf, unreadTotal } from '@/components/news/format'
import { NewsList } from '@/components/news/news-list'
import { PageHeader } from '@/components/shell/page-header'
import { railItem, railTrack } from '@/components/ui/rail'
import { EmptyState, ErrorNotice } from '@/components/ui/states'
import { requireSession } from '@/lib/auth'
import { system } from '@/lib/composition'
import type { Spaces, UnreadItem } from '@/lib/core/spaces'
import type { ErrorOf } from '@/lib/result'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Novedades · Campus HackAI' }

type UnreadRead = Awaited<ReturnType<Spaces['unreadFor']>>
type UnreadError = ErrorOf<UnreadRead>

const ERRORS: Record<UnreadError, string> = {
  'persona-desconocida': 'No encontramos tus datos en el SIU. Salí y volvé a entrar.',
  'falla-externa': 'No pudimos traer tus novedades porque el SIU no responde. Probá de nuevo en un rato.'
}

const asKind = (value: string | undefined): NewsKind | 'todas' =>
  NEWS_KINDS.find((k) => k.kind === value)?.kind ?? 'todas'

/* Los tipos, en el riel de una fila como los demás filtros: solo los que tienen algo sin leer, con cuánto.
   En el celular, si no entran, el riel se desliza de costado. */
function KindFilter({ items, current }: { items: UnreadItem[]; current: NewsKind | 'todas' }) {
  const options = [
    { kind: 'todas' as const, label: 'Todas', count: unreadTotal(items) },
    ...NEWS_KINDS.map((k) => ({
      ...k,
      count: unreadTotal(items.filter((i) => newsKindOf(i.kind) === k.kind))
    }))
  ].filter((o) => o.count > 0 || o.kind === current)
  return (
    <nav
      aria-label='Tipo de novedad'
      className={cn(railTrack({ size: 'sm' }), 'mx-auto w-full max-w-xl overflow-x-auto [scrollbar-width:none]')}
    >
      {options.map(({ kind, label, count }) => (
        <Link
          key={kind}
          href={kind === 'todas' ? '/novedades' : `/novedades?tipo=${kind}`}
          aria-current={kind === current ? 'page' : undefined}
          className={railItem({ size: 'sm', className: 'group/kind shrink-0 gap-1.5' })}
        >
          {label}
          <span className='text-[0.6875rem] text-muted-foreground tabular-nums group-aria-[current=page]/kind:text-blue'>
            {count}
          </span>
        </Link>
      ))}
    </nav>
  )
}

function News({ read, kind }: { read: UnreadRead; kind: NewsKind | 'todas' }) {
  if (!read.ok) return <ErrorNotice>{ERRORS[read.error]}</ErrorNotice>
  if (read.value.length === 0) {
    return (
      <EmptyState icon={CheckCheck} title='Estás al día'>
        Acá van a aparecer los avisos, las consultas y sus respuestas, el material nuevo y los mensajes directos de tus
        materias que todavía no leíste.
      </EmptyState>
    )
  }
  const shown = kind === 'todas' ? read.value : read.value.filter((i) => newsKindOf(i.kind) === kind)
  return (
    <>
      <KindFilter items={read.value} current={kind} />
      {shown.length === 0 ? (
        <EmptyState icon={SearchX} title='Nada de este tipo'>
          No tenés novedades sin leer de este tipo. Probá con otro filtro.
        </EmptyState>
      ) : (
        <NewsList groups={newsBySubject(shown)} />
      )}
    </>
  )
}

export default async function NovedadesPage({ searchParams }: { searchParams: Promise<{ tipo?: string }> }) {
  const session = await requireSession()
  const [read, params] = await Promise.all([system().spaces.unreadFor(session.personId), searchParams])
  const kind = asKind(params.tipo)

  return (
    <>
      <PageHeader
        title='Novedades'
        subtitle={
          read.ok && read.value.length > 0
            ? `${unreadTotal(read.value)} sin leer de todas tus materias`
            : 'De todas tus materias'
        }
        art='novedades'
        backHref='/materias'
        hideBackOnDesktop
        unread={read.ok ? unreadTotal(read.value) : undefined}
      />

      <main className='flex w-full flex-col px-4 pt-5 pb-16 lg:px-8 lg:pt-8'>
        <div className='mx-auto flex w-full max-w-3xl flex-col gap-6'>
          <News read={read} kind={kind} />
        </div>
      </main>
    </>
  )
}
