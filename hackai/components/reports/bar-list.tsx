'use client'

/* Barras horizontales con el valor en la punta: por facultad, una barra por
   facultad, con un riel para elegir qué se cuenta (activos, ingresantes,
   graduados o bajas). Cada barra lleva al listado filtrado por esa facultad y
   ese estado. Una sola serie, un solo color; las barras crecen desde la base al
   aparecer y al cambiar lo que se cuenta. */
import Link from 'next/link'
import { useState } from 'react'
import { railItem, railTrack } from '@/components/ui/rail'
import { cn } from '@/lib/utils'

export type BarMetric = 'active' | 'entrants' | 'graduates' | 'dropouts'

export const METRIC_LABEL: Record<BarMetric, string> = {
  active: 'Activos',
  entrants: 'Ingresantes',
  graduates: 'Graduados',
  dropouts: 'Bajas'
}

export type BarRow = {
  key: string
  label: string
  /** El nombre completo, para el lector de pantalla y el título. */
  title: string
  values: Record<BarMetric, number>
  href: Record<BarMetric, string>
}

const METRICS: BarMetric[] = ['active', 'entrants', 'graduates', 'dropouts']

export function BarList({ rows, label }: { rows: BarRow[]; label: string }) {
  const [metric, setMetric] = useState<BarMetric>('active')
  const max = Math.max(1, ...rows.map((r) => r.values[metric]))
  const sorted = [...rows].sort((a, b) => b.values[metric] - a.values[metric])
  return (
    <div className='flex flex-col gap-4'>
      <fieldset className={cn(railTrack({ size: 'sm' }), 'w-full overflow-x-auto [scrollbar-width:none]')}>
        <legend className='sr-only'>Qué contar</legend>
        {METRICS.map((m) => (
          <button
            key={m}
            type='button'
            aria-pressed={m === metric}
            onClick={() => setMetric(m)}
            className={cn(railItem({ size: 'sm' }), 'flex-none')}
          >
            {METRIC_LABEL[m]}
          </button>
        ))}
      </fieldset>
      <ul aria-label={`${label}: ${METRIC_LABEL[metric].toLowerCase()}`} className='flex flex-col gap-1'>
        {sorted.map((row, i) => {
          const value = row.values[metric]
          return (
            <li key={row.key}>
              <Link
                href={row.href[metric]}
                title={`${row.title}: ${value.toLocaleString('es-AR')} ${METRIC_LABEL[metric].toLowerCase()}`}
                className='group grid grid-cols-[4.5rem_minmax(0,1fr)] min-h-11 items-center gap-3 rounded-lg px-1 hover:bg-ice focus-ring sm:grid-cols-[5.5rem_minmax(0,1fr)]'
              >
                <span className='truncate text-[0.8125rem] font-semibold text-ink'>
                  {row.label}
                  <span className='sr-only'> ({row.title})</span>
                </span>
                <span className='flex min-w-0 items-center gap-2'>
                  <span className='relative h-3 min-w-0 flex-1'>
                    <span
                      key={metric}
                      aria-hidden='true'
                      className='absolute inset-y-0 left-0 origin-left animate-grow-x rounded-r-[4px] bg-viz-1 transition-opacity group-hover:opacity-80 motion-reduce:animate-none'
                      style={{ width: `${(value / max) * 100}%`, animationDelay: `${i * 60}ms` }}
                    />
                  </span>
                  <span className='w-12 flex-none text-right text-[0.8125rem] font-bold text-ink tabular-nums'>
                    {value.toLocaleString('es-AR')}
                  </span>
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
