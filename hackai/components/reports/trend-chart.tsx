'use client'

/* Líneas año por año: ingresantes, graduados y bajas. Un solo eje (las tres
   cuentas son de la misma escala; los activos, que son muchos más, van en su
   propio número arriba). Una línea vertical sigue al mouse o a las flechas del
   teclado y la lectura de arriba da los tres valores de ese año. Las líneas se
   dibujan al aparecer. Leyenda con trazos del color de cada serie y la tabla
   plegada debajo: el verde agua no alcanza contraste solo. */
import { type KeyboardEvent, type PointerEvent, useState } from 'react'
import { DataTable, niceMax } from '@/components/reports/column-chart'
import { cn } from '@/lib/utils'

export type TrendSeries = { key: string; label: string; color: string; values: number[] }

const W = 600
const H = 200

function pathOf(values: number[], top: number): string {
  const step = values.length > 1 ? W / (values.length - 1) : 0
  return values
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)},${(H - (v / top) * H).toFixed(1)}`)
    .join(' ')
}

const percentX = (i: number, n: number) => (n > 1 ? (i / (n - 1)) * 100 : 50)

export function TrendChart({ years, series, label }: { years: number[]; series: TrendSeries[]; label: string }) {
  const n = years.length
  const [active, setActive] = useState<number | null>(null)
  const top = niceMax(Math.max(1, ...series.flatMap((s) => s.values)))
  const shown = active ?? n - 1

  const onMove = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width))
    setActive(Math.round(ratio * (n - 1)))
  }
  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, Home: -n, End: n }
    if (!(event.key in moves)) return
    event.preventDefault()
    setActive(Math.min(n - 1, Math.max(0, shown + moves[event.key])))
  }

  return (
    <figure className='flex flex-col gap-2'>
      <ul aria-label='Series' className='flex flex-wrap gap-x-4 gap-y-1 text-[0.75rem] text-muted-foreground'>
        {series.map((s) => (
          <li key={s.key} className='inline-flex items-center gap-1.5'>
            <span aria-hidden='true' className='h-0.5 w-4 rounded-full' style={{ background: s.color }} />
            {s.label}
          </li>
        ))}
      </ul>
      <p aria-live='polite' className='flex min-h-5 flex-wrap gap-x-3 text-[0.8125rem] text-muted-foreground'>
        <span className='font-semibold text-ink'>{years[shown]}</span>
        {series.map((s) => (
          <span key={s.key} className='inline-flex items-center gap-1'>
            <span aria-hidden='true' className='h-0.5 w-3 rounded-full' style={{ background: s.color }} />
            <strong className='text-ink tabular-nums'>{s.values[shown].toLocaleString('es-AR')}</strong>{' '}
            {s.label.toLowerCase()}
          </span>
        ))}
      </p>
      <div className='relative ml-9 h-48'>
        {[1, 0.5, 0].map((f) => (
          <div
            key={f}
            aria-hidden='true'
            className='absolute inset-x-0 flex items-center'
            style={{ bottom: `${f * 100}%` }}
          >
            <span className='absolute -left-9 w-7 text-right text-[0.6875rem] text-muted-foreground tabular-nums'>
              {(top * f).toLocaleString('es-AR')}
            </span>
            <span className='h-px flex-1 bg-border' />
          </div>
        ))}
        <svg
          aria-hidden='true'
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio='none'
          className='absolute inset-0 size-full overflow-visible'
        >
          {series.map((s, i) => (
            <path
              key={s.key}
              d={pathOf(s.values, top)}
              pathLength={1}
              fill='none'
              stroke={s.color}
              strokeWidth={2}
              strokeLinejoin='round'
              strokeLinecap='round'
              vectorEffect='non-scaling-stroke'
              className='animate-draw [stroke-dasharray:1] motion-reduce:animate-none'
              style={{ animationDelay: `${i * 120}ms` }}
            />
          ))}
        </svg>
        <div
          role='slider'
          tabIndex={0}
          aria-label={`${label}: año`}
          aria-valuemin={years[0]}
          aria-valuemax={years[n - 1]}
          aria-valuenow={years[shown]}
          aria-valuetext={`${years[shown]}: ${series.map((s) => `${s.values[shown]} ${s.label.toLowerCase()}`).join(', ')}`}
          className='absolute inset-0 cursor-crosshair touch-pan-y rounded focus-ring'
          onPointerMove={onMove}
          onPointerDown={onMove}
          onPointerLeave={() => setActive(null)}
          onKeyDown={onKey}
        >
          <span
            aria-hidden='true'
            className={cn('absolute inset-y-0 w-px bg-ink/25', active === null && 'opacity-0')}
            style={{ left: `${percentX(shown, n)}%` }}
          />
          {series.map((s) => (
            <span
              key={s.key}
              aria-hidden='true'
              className='absolute size-2.5 -translate-x-1/2 translate-y-1/2 rounded-full ring-2 ring-card'
              style={{
                left: `${percentX(shown, n)}%`,
                bottom: `${(s.values[shown] / top) * 100}%`,
                background: s.color
              }}
            />
          ))}
        </div>
      </div>
      <div aria-hidden='true' className='relative ml-9 h-4 text-[0.6875rem] text-muted-foreground tabular-nums'>
        {years.map((y, i) => (
          <span
            key={y}
            className={cn(
              'absolute -translate-x-1/2',
              (n - 1 - i) % 2 === 1 && 'max-sm:hidden',
              (n - 1 - i) % 3 !== 0 && 'sm:max-lg:hidden'
            )}
            style={{ left: `${percentX(i, n)}%` }}
          >
            {y}
          </span>
        ))}
      </div>
      <DataTable
        label={label}
        headers={['Año', ...series.map((s) => s.label)]}
        rows={years.map((y, i) => [String(y), ...series.map((s) => s.values[i])])}
      />
    </figure>
  )
}
