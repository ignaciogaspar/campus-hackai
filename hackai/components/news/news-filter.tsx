'use client'

import { CheckCheck, SearchX, Undo2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { markAllNewsRead } from '@/app/actions/spaces'
import { NEWS_KINDS, type NewsKind, newsBySubject, newsKindOf, unreadTotal } from '@/components/news/format'
import { NewsList } from '@/components/news/news-list'
import { Button } from '@/components/ui/button'
import { railItem, railTrack } from '@/components/ui/rail'
import { EmptyState, ErrorNotice } from '@/components/ui/states'
import type { UnreadItem } from '@/lib/core/spaces'
import { cn } from '@/lib/utils'

/** Lo que se filtra: los tipos de novedad de los espacios y, aparte, las notas nuevas. */
type Shown = NewsKind | 'notas' | 'todas'

const asShown = (value: string | undefined): Shown =>
  value === 'notas' ? 'notas' : (NEWS_KINDS.find((k) => k.kind === value)?.kind ?? 'todas')

/** Cuánto espera «Marcar todo como leído» antes de guardarlo, para que se pueda deshacer. */
const UNDO_MS = 5000

/* Los tipos, en el riel de una fila como los demás filtros: solo los que tienen algo sin leer, con cuánto. Las
   notas nuevas tienen su chip, así «Todas» es la suma de los demás. Con un solo tipo no hay nada que filtrar y
   el riel no va. En el celular, si no entran, el riel se desliza de costado. */
function KindFilter({ items, grades, current }: { items: UnreadItem[]; grades: number; current: Shown }) {
  const kinds = [
    { kind: 'notas' as const, label: 'Notas', count: grades },
    ...NEWS_KINDS.map((k) => ({
      ...k,
      count: unreadTotal(items.filter((i) => newsKindOf(i.kind) === k.kind))
    }))
  ].filter((o) => o.count > 0 || o.kind === current)
  if (kinds.length <= 1 && current === 'todas') return null
  const options = [{ kind: 'todas' as const, label: 'Todas', count: kinds.reduce((n, k) => n + k.count, 0) }, ...kinds]
  return (
    <nav
      aria-label='Tipo de novedad'
      className={cn(railTrack({ size: 'sm' }), 'mx-auto w-full max-w-xl overflow-x-auto [scrollbar-width:none]')}
    >
      {options.map(({ kind, label, count }) => (
        <Link
          key={kind}
          href={kind === 'todas' ? '/novedades' : `/novedades?tipo=${kind}`}
          prefetch={false}
          onNavigate={(event) => {
            event.preventDefault()
            window.history.replaceState(null, '', kind === 'todas' ? '/novedades' : `/novedades?tipo=${kind}`)
          }}
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

/* Sin nada sin leer: lo dice y ofrece a dónde seguir. «Estás al día» queda para Hoy. */
function NothingUnread() {
  return (
    <EmptyState icon={CheckCheck} title='No tenés nada sin leer'>
      Cuando haya avisos, consultas, material o mensajes nuevos de tus materias, van a aparecer acá. Mientras tanto,
      mirá lo que viene en el{' '}
      <Link href='/calendario' className='font-semibold text-blue hover:underline focus-ring'>
        Calendario
      </Link>{' '}
      o entrá a{' '}
      <Link href='/materias' className='font-semibold text-blue hover:underline focus-ring'>
        tus materias
      </Link>
      .
    </EmptyState>
  )
}

/* «Marcar todo como leído»: deja Novedades vacía al instante y lo guarda a los
   5 segundos, mientras se puede deshacer. Si se va de la página antes, lo
   guarda igual. Después la página se vuelve a armar y la campana queda en 0. */
function useMarkAll() {
  const router = useRouter()
  const [phase, setPhase] = useState<'idle' | 'pending' | 'saving'>('idle')
  const [error, setError] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const commit = useRef<(() => void) | null>(null)

  useEffect(
    () => () => {
      // Al irse con el «Deshacer» a la vista, se guarda igual: es lo que pidió.
      if (timer.current) clearTimeout(timer.current)
      commit.current?.()
    },
    []
  )

  const save = async () => {
    timer.current = null
    commit.current = null
    setPhase('saving')
    const failed = await markAllNewsRead()
    setPhase('idle')
    setError(failed)
    if (!failed) router.refresh()
  }
  const start = () => {
    setError(null)
    setPhase('pending')
    commit.current = () => void markAllNewsRead()
    timer.current = setTimeout(save, UNDO_MS)
  }
  const undo = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    commit.current = null
    setPhase('idle')
  }
  return { phase, error, start, undo }
}

export function NewsFilter({
  items,
  grades,
  gradeNews,
  teacher = false
}: {
  items: UnreadItem[]
  grades: number
  gradeNews: ReactNode
  /** Si quien mira dicta: sus filas marcan las consultas sin respuesta. */
  teacher?: boolean
}) {
  const shown = asShown(useSearchParams().get('tipo') ?? undefined)
  const { phase, error, start, undo } = useMarkAll()
  const any = items.length > 0 || grades > 0
  const marking = phase !== 'idle'
  return (
    <>
      {any && (
        <div className='flex min-h-11 items-center justify-end gap-2'>
          {marking ? (
            <p role='status' className='flex flex-wrap items-center gap-x-2 text-[0.8125rem] text-muted-foreground'>
              Marcaste todo como leído.
              {phase === 'pending' && (
                <Button variant='ghost' onClick={undo} className='min-h-11 text-blue'>
                  <Undo2 aria-hidden='true' data-icon='inline-start' />
                  Deshacer
                </Button>
              )}
            </p>
          ) : (
            <Button variant='outline' onClick={start} className='min-h-11'>
              <CheckCheck aria-hidden='true' data-icon='inline-start' />
              Marcar todo como leído
            </Button>
          )}
        </div>
      )}
      {error && <ErrorNotice>{error}</ErrorNotice>}
      {marking ? (
        <NothingUnread />
      ) : (
        <News items={items} shown={shown} grades={grades} gradeNews={gradeNews} teacher={teacher} />
      )}
    </>
  )
}

/* Primero el filtro, después las notas nuevas (en «Todas» y en «Notas») y al final lo sin leer de cada materia. */
function News({
  items,
  shown,
  grades,
  gradeNews,
  teacher
}: {
  items: UnreadItem[]
  shown: Shown
  grades: number
  gradeNews: ReactNode
  teacher: boolean
}) {
  if (items.length === 0 && grades === 0) return <NothingUnread />
  const kindItems = shown === 'todas' ? items : items.filter((i) => newsKindOf(i.kind) === shown)
  const withGrades = (shown === 'todas' || shown === 'notas') && grades > 0
  const nothing = !withGrades && (shown === 'notas' || kindItems.length === 0)
  return (
    <>
      <KindFilter items={items} grades={grades} current={shown} />
      {withGrades && gradeNews}
      {nothing ? (
        <EmptyState icon={SearchX} title='Nada de este tipo'>
          No tenés novedades sin leer de este tipo. Probá con otro filtro.
        </EmptyState>
      ) : (
        shown !== 'notas' && kindItems.length > 0 && <NewsList groups={newsBySubject(kindItems)} teacher={teacher} />
      )}
    </>
  )
}
