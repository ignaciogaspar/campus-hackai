'use client'

/* El plan como árbol de correlativas, de izquierda a derecha: cada materia
   con el color de su estado y una línea desde cada correlativa que pide
   (llena si la pide aprobada, punteada si alcanza con la regular). Al pasar
   por una materia, o al tocarla en el celular, se ilumina su cadena: lo que
   tiene que tener antes y lo que habilita. Abajo, lo que puede cursar ya o el
   detalle de la elegida. Las cuentas son de Cursada; esto solo las dibuja. */
import { Check, ChevronRight, GitFork, X } from 'lucide-react'
import Link from 'next/link'
import { type CSSProperties, useMemo, useState } from 'react'
import {
  chainOf,
  layoutTree,
  NODE_HEIGHT,
  NODE_WIDTH,
  type TreeEdge,
  type TreeNode
} from '@/components/career/prerequisite-layout'
import { notesHref } from '@/components/grades/format'
import { gradeText, STATUS, yearName } from '@/components/grades/status'
import { EmptyState } from '@/components/ui/states'
import type { SubjectStanding } from '@/lib/core/studies'
import { cn } from '@/lib/utils'

const NODE: Record<SubjectStanding['status'], string> = {
  promocionada: 'border-success/20 bg-success-background',
  aprobada: 'border-success/20 bg-success-background',
  'en-curso': 'border-blue/20 bg-accent',
  regular: 'border-kind-recuperatorio-border bg-kind-recuperatorio-background',
  pendiente: 'border-transparent bg-ice'
}

/** El color de una línea: verde si ya la cumple, gris si no. Iluminada, azul. */
function edgeClass(edge: TreeEdge, lit: boolean, dimmed: boolean): string {
  if (lit) return 'stroke-blue'
  return cn(edge.met ? 'stroke-success/45' : 'stroke-steel/35', dimmed && 'opacity-15')
}

const CONDITION: Record<TreeEdge['condition'], string> = {
  aprobada: 'aprobada',
  regular: 'regular'
}

/** Lo que dice el nodo debajo del nombre: el estado y, si la aprobó, la nota. */
function metaOf(subject: SubjectStanding): string {
  if (subject.canTake) return 'Podés cursarla'
  if (subject.finalGrade !== null) return `${STATUS[subject.status].label} · ${gradeText(subject.finalGrade)}`
  return subject.status === 'regular' ? 'Falta el final' : STATUS[subject.status].label
}

function Node({
  node,
  selected,
  lit,
  dimmed,
  onHover,
  onSelect
}: {
  node: TreeNode
  selected: boolean
  lit: boolean
  dimmed: boolean
  onHover: (id: string | null) => void
  onSelect: (id: string) => void
}) {
  const { subject } = node
  const pending = subject.status === 'pendiente'
  return (
    <button
      type='button'
      aria-pressed={selected}
      onClick={() => onSelect(subject.subjectId)}
      onPointerEnter={(e) => e.pointerType === 'mouse' && onHover(subject.subjectId)}
      onPointerLeave={() => onHover(null)}
      onFocus={(e) => e.currentTarget.matches(':focus-visible') && onHover(subject.subjectId)}
      onBlur={() => onHover(null)}
      style={
        {
          left: node.x,
          top: node.y,
          width: NODE_WIDTH,
          height: NODE_HEIGHT,
          animationDelay: `${node.column * 70 + Math.min(node.row, 8) * 20}ms`
        } as CSSProperties
      }
      className={cn(
        'absolute flex animate-rise flex-col justify-center gap-0.5 rounded-xl border px-3 text-left transition-[opacity,border-color,box-shadow] duration-200 ease-out focus-ring motion-reduce:animate-none motion-reduce:transition-none',
        NODE[subject.status],
        subject.canTake && 'border-blue/45 bg-card',
        (lit || selected) && 'border-blue/60 shadow-card',
        selected && 'ring-2 ring-blue/25',
        dimmed && 'opacity-35'
      )}
    >
      <span className='flex min-w-0 items-start gap-2'>
        <span
          aria-hidden='true'
          className={cn(
            'mt-[0.4375rem] size-2 flex-none rounded-full',
            subject.canTake ? 'bg-blue' : STATUS[subject.status].dot
          )}
        />
        <span
          className={cn(
            'line-clamp-2 min-w-0 text-[0.8125rem] leading-snug',
            pending && !subject.canTake ? 'text-muted-foreground' : 'font-semibold text-ink'
          )}
        >
          {subject.name}
        </span>
      </span>
      <span
        className={cn(
          'truncate pl-4 text-[0.6875rem] tabular-nums',
          subject.canTake ? 'font-semibold text-blue' : 'text-muted-foreground'
        )}
      >
        {metaOf(subject)}
      </span>
    </button>
  )
}

export function TreeLegend() {
  return (
    <p className='flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.75rem] text-muted-foreground'>
      <span className='inline-flex items-center gap-1.5'>
        <span aria-hidden='true' className='size-2 rounded-full bg-blue' />
        Podés cursarla
      </span>
      <span className='inline-flex items-center gap-1.5'>
        <svg aria-hidden='true' width='20' height='4' className='text-steel'>
          <line x1='0' y1='2' x2='20' y2='2' stroke='currentColor' strokeWidth='1.75' />
        </svg>
        La pide aprobada
      </span>
      <span className='inline-flex items-center gap-1.5'>
        <svg aria-hidden='true' width='20' height='4' className='text-steel'>
          <line x1='0' y1='2' x2='20' y2='2' stroke='currentColor' strokeWidth='1.75' strokeDasharray='3 3' />
        </svg>
        Alcanza con la regular
      </span>
    </p>
  )
}

/** Una materia que se puede elegir desde el panel de abajo. */
function SubjectLink({ subject, onSelect }: { subject: SubjectStanding; onSelect: (id: string) => void }) {
  return (
    <button
      type='button'
      onClick={() => onSelect(subject.subjectId)}
      className='inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-card px-2.5 text-[0.8125rem] font-semibold text-ink shadow-[0_1px_2px_rgb(11_17_80/0.06)] ring-1 ring-border transition-[box-shadow] hover:ring-blue/30 focus-ring'
    >
      <span
        aria-hidden='true'
        className={cn('size-2 rounded-full', subject.canTake ? 'bg-blue' : STATUS[subject.status].dot)}
      />
      {subject.name}
    </button>
  )
}

/** Sin materia elegida: lo que puede cursar ya, que es lo que el SIU no responde. */
function Available({ subjects, onSelect }: { subjects: SubjectStanding[]; onSelect: (id: string) => void }) {
  const available = subjects.filter((s) => s.canTake)
  return (
    <div className='flex flex-col gap-2'>
      <p className='text-[0.9375rem] font-bold text-ink'>
        {available.length === 0
          ? 'Ahora no tenés materias pendientes con las correlativas cumplidas'
          : available.length === 1
            ? 'Ya podés cursar 1 materia'
            : `Ya podés cursar ${available.length} materias`}
      </p>
      {available.length > 0 && (
        <div className='flex flex-wrap gap-1.5'>
          {available.map((s) => (
            <SubjectLink key={s.subjectId} subject={s} onSelect={onSelect} />
          ))}
        </div>
      )}
      <p className='text-[0.75rem] text-muted-foreground'>Tocá una materia para ver qué te pide y qué te habilita</p>
    </div>
  )
}

/** Con una materia elegida: sus correlativas, cumplidas o no, y lo que habilita. */
function Detail({
  subject,
  byId,
  unlocks,
  onSelect,
  onClose
}: {
  subject: SubjectStanding
  byId: Map<string, SubjectStanding>
  unlocks: SubjectStanding[]
  onSelect: (id: string) => void
  onClose: () => void
}) {
  const prerequisites = subject.prerequisites.filter((p) => byId.has(p.subjectId))
  return (
    <div className='flex flex-col gap-3'>
      <div className='flex items-start justify-between gap-3'>
        <div className='flex min-w-0 flex-col gap-0.5'>
          <p className='text-[0.9375rem] font-bold text-ink'>{subject.name}</p>
          <p className='text-[0.75rem] text-muted-foreground'>
            {[subject.year !== null ? yearName(subject.year) : null, metaOf(subject)].filter(Boolean).join(' · ')}
          </p>
        </div>
        <button
          type='button'
          onClick={onClose}
          aria-label='Cerrar el detalle'
          className='grid size-9 flex-none place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-ice hover:text-ink focus-ring'
        >
          <X aria-hidden='true' className='size-4.5' />
        </button>
      </div>
      <div className='grid gap-3 sm:grid-cols-2'>
        <div className='flex flex-col gap-1.5'>
          <p className='text-[0.75rem] font-semibold text-muted-foreground'>Para cursarla</p>
          {prerequisites.length === 0 ? (
            <p className='text-[0.8125rem] text-ink'>No pide correlativas</p>
          ) : (
            <ul className='flex flex-col gap-1'>
              {prerequisites.map((p) => {
                const other = byId.get(p.subjectId) as SubjectStanding
                return (
                  <li key={p.subjectId} className='flex items-center gap-2 text-[0.8125rem]'>
                    <span
                      aria-hidden='true'
                      className={cn(
                        'grid size-5 flex-none place-items-center rounded-full',
                        p.met ? 'bg-success-background text-success' : 'bg-ice text-gray-light'
                      )}
                    >
                      {p.met ? <Check className='size-3' strokeWidth={3} /> : <X className='size-3' strokeWidth={3} />}
                    </span>
                    <span className={cn('min-w-0', p.met ? 'text-ink' : 'text-muted-foreground')}>
                      {other.name} <span className='text-muted-foreground'>· {CONDITION[p.condition]}</span>
                      <span className='sr-only'>{p.met ? ': la cumplís' : ': todavía no la cumplís'}</span>
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
        <div className='flex flex-col gap-1.5'>
          <p className='text-[0.75rem] font-semibold text-muted-foreground'>Te habilita</p>
          {unlocks.length === 0 ? (
            <p className='text-[0.8125rem] text-ink'>No es correlativa de otra materia</p>
          ) : (
            <div className='flex flex-wrap gap-1.5'>
              {unlocks.map((s) => (
                <SubjectLink key={s.subjectId} subject={s} onSelect={onSelect} />
              ))}
            </div>
          )}
        </div>
      </div>
      {subject.status !== 'pendiente' && (
        <Link
          href={notesHref(subject.subjectId)}
          className='inline-flex min-h-11 items-center gap-1 self-start rounded-lg text-[0.8125rem] font-semibold text-blue hover:underline focus-ring'
        >
          Ver sus notas
          <ChevronRight aria-hidden='true' className='size-4' />
        </Link>
      )}
    </div>
  )
}

export function PrerequisiteTree({ subjects }: { subjects: SubjectStanding[] }) {
  const layout = useMemo(() => layoutTree(subjects), [subjects])
  const byId = useMemo(() => new Map(layout.nodes.map((n) => [n.subject.subjectId, n.subject])), [layout])
  const [selected, setSelected] = useState<string | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)
  const focus = hovered ?? selected
  const chain = useMemo(() => (focus ? chainOf(focus, layout.edges) : null), [focus, layout])

  if (!layout.hasPrerequisites) {
    return (
      <EmptyState icon={GitFork} title='No tenemos las correlativas de tu plan'>
        El SIU no nos pasó las correlativas de tu carrera. Las ves en el SIU, en Reportes &gt; Plan de estudios.
      </EmptyState>
    )
  }

  const current = selected ? byId.get(selected) : undefined
  const unlocks = current
    ? layout.edges.filter((e) => e.from === current.subjectId).map((e) => byId.get(e.to) as SubjectStanding)
    : []
  const select = (id: string) => setSelected((was) => (was === id ? null : id))

  return (
    <div className='flex flex-col gap-3'>
      <div className='overflow-hidden rounded-2xl border border-border bg-card'>
        <section
          aria-label='Árbol de correlativas, de las materias sin correlativas a las últimas'
          className='overflow-x-auto overscroll-x-contain [scrollbar-color:var(--borde)_transparent] [scrollbar-width:thin]'
        >
          <div className='relative m-5' style={{ width: layout.width, height: layout.height }}>
            <svg
              aria-hidden='true'
              width={layout.width}
              height={layout.height}
              // Las líneas aparecen de izquierda a derecha, al ritmo de las columnas que suben.
              style={{ animationDuration: `${400 + layout.columns * 120}ms` }}
              className='absolute inset-0 animate-reveal-x overflow-visible motion-reduce:animate-none'
              fill='none'
            >
              {/* Las de la cadena van al final, para que se dibujen encima de las apagadas. */}
              {layout.edges
                .map((edge) => ({ edge, lit: Boolean(chain?.has(edge.from) && chain.has(edge.to)) }))
                .sort((a, b) => Number(a.lit) - Number(b.lit))
                .map(({ edge, lit }) => {
                  return (
                    <path
                      key={`${edge.from}-${edge.to}`}
                      d={edge.path}
                      strokeWidth={lit ? 2 : 1.5}
                      strokeLinecap='round'
                      strokeDasharray={edge.condition === 'regular' ? '4 4' : undefined}
                      className={cn(
                        'transition-[stroke,opacity,stroke-width] duration-200 ease-out motion-reduce:transition-none',
                        edgeClass(edge, lit, chain !== null && !lit)
                      )}
                    />
                  )
                })}
            </svg>
            {layout.nodes.map((node) => {
              const id = node.subject.subjectId
              return (
                <Node
                  key={id}
                  node={node}
                  selected={selected === id}
                  lit={chain?.has(id) ?? false}
                  dimmed={chain !== null && !chain.has(id)}
                  onHover={setHovered}
                  onSelect={select}
                />
              )
            })}
          </div>
        </section>
      </div>
      <section
        aria-live='polite'
        aria-label={current ? `Correlativas de ${current.name}` : 'Lo que podés cursar ya'}
        className='rounded-2xl bg-ice/60 p-4'
      >
        {current ? (
          <Detail subject={current} byId={byId} unlocks={unlocks} onSelect={select} onClose={() => setSelected(null)} />
        ) : (
          <Available subjects={layout.nodes.map((n) => n.subject)} onSelect={select} />
        )}
      </section>
    </div>
  )
}
