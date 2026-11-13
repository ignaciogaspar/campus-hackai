'use client'

/* Columnas para categorías con orden: activos por año de ingreso, por tramo de
   avance o por créditos. Una sola serie en el azul de la app. Arriba, una
   lectura que dice el valor de la columna que está bajo el mouse o con el foco
   (también con el teclado); sin ninguna, el total. La columna más alta lleva su
   valor arriba. Cada columna puede llevar al listado filtrado. Debajo, la tabla
   con todos los valores, plegada. */
import Link from 'next/link'
import { useState } from 'react'
import { cn } from '@/lib/utils'

export type Column = {
  key: string
  /** Debajo de la columna. */
  label: string
  /** Debajo de la columna en el celular, si `label` no entra («'14»). */
  short?: string
  /** En la lectura y la tabla: «Ingreso 2014». */
  title: string
  value: number
  href?: string
}

/** El tope del eje: el próximo número redondo (1; 1,5; 2; 2,5; 3; 4; 5; 6 u 8 por una potencia de 10), así la
    columna más alta llena casi todo el alto. */
export function niceMax(value: number): number {
  if (value <= 0) return 1
  const power = 10 ** Math.floor(Math.log10(value))
  const step = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((s) => s * power >= value) ?? 10
  return step * power
}

export function ColumnChart({
  columns,
  unit,
  label,
  totalText
}: {
  columns: Column[]
  /** «activos». */
  unit: string
  label: string
  /** Lo que dice la lectura sin ninguna columna elegida. */
  totalText: string
}) {
  const [active, setActive] = useState<number | null>(null)
  const top = niceMax(Math.max(...columns.map((c) => c.value)))
  const peak = columns.reduce((best, c, i) => (c.value > columns[best].value ? i : best), 0)
  const current = active === null ? null : columns[active]
  const dense = columns.length > 10
  return (
    <figure className='flex flex-col gap-2'>
      <p aria-live='polite' className='min-h-5 text-[0.8125rem] text-muted-foreground'>
        {current ? (
          <>
            <strong className='text-[0.9375rem] text-ink tabular-nums'>{current.value.toLocaleString('es-AR')}</strong>{' '}
            {unit} · {current.title}
          </>
        ) : (
          totalText
        )}
      </p>
      <div className='relative mt-2 h-44'>
        {[1, 0.5, 0].map((f) => (
          <div
            key={f}
            aria-hidden='true'
            className='absolute inset-x-0 flex translate-y-1/2 items-center gap-2'
            style={{ bottom: `${f * 100}%` }}
          >
            <span className='w-8 flex-none text-right text-[0.6875rem] text-muted-foreground tabular-nums'>
              {(top * f).toLocaleString('es-AR')}
            </span>
            <span className='h-px flex-1 bg-border' />
          </div>
        ))}
        <ul
          aria-label={label}
          className='absolute inset-y-0 right-0 left-10 flex items-end gap-[2px] sm:gap-1'
          onPointerLeave={() => setActive(null)}
        >
          {columns.map((c, i) => {
            const height = `${(c.value / top) * 100}%`
            const bar = (
              <>
                {i === peak && c.value > 0 && (
                  <span
                    aria-hidden='true'
                    className='absolute inset-x-[-1rem] text-center text-[0.6875rem] font-bold text-ink tabular-nums'
                    style={{ bottom: `calc(${height} + 2px)` }}
                  >
                    {c.value.toLocaleString('es-AR')}
                  </span>
                )}
                <span
                  aria-hidden='true'
                  className={cn(
                    'absolute bottom-0 left-1/2 w-full max-w-6 -translate-x-1/2 origin-bottom animate-grow-y rounded-t-[4px] bg-viz-1 transition-opacity motion-reduce:animate-none',
                    active !== null && active !== i && 'opacity-45'
                  )}
                  style={{ height, animationDelay: `${i * 35}ms` }}
                />
                <span className='sr-only'>
                  {c.title}: {c.value.toLocaleString('es-AR')} {unit}
                </span>
              </>
            )
            const props = {
              className: 'relative block h-full w-full rounded-sm focus-ring',
              onPointerEnter: () => setActive(i),
              onFocus: () => setActive(i),
              onBlur: () => setActive(null)
            }
            return (
              <li key={c.key} className='h-full min-w-0 flex-1'>
                {c.href ? (
                  <Link href={c.href} {...props}>
                    {bar}
                  </Link>
                ) : (
                  // biome-ignore lint/a11y/noNoninteractiveTabindex: la columna sin enlace se recorre con Tab para leer su valor.
                  <span tabIndex={0} {...props}>
                    {bar}
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      </div>
      <div aria-hidden='true' className='ml-10 flex gap-[2px] sm:gap-1'>
        {columns.map((c, i) => (
          <span
            key={c.key}
            className={cn(
              'min-w-0 flex-1 text-center text-[0.6875rem] text-muted-foreground tabular-nums',
              dense && i % 2 === 1 && 'max-sm:invisible'
            )}
          >
            {dense ? (
              <>
                <span className='sm:hidden'>{c.short ?? c.label}</span>
                <span className='max-sm:hidden'>{c.label}</span>
              </>
            ) : (
              c.label
            )}
          </span>
        ))}
      </div>
      <DataTable label={label} unit={unit} rows={columns.map((c) => [c.title, c.value])} />
    </figure>
  )
}

/** La tabla con los mismos valores que el gráfico, plegada: para leerlos sin mouse y para imprimir. */
export function DataTable({
  label,
  unit,
  rows,
  headers
}: {
  label: string
  unit?: string
  rows: (string | number)[][]
  headers?: string[]
}) {
  return (
    <details className='group/table mt-1 text-[0.8125rem]'>
      <summary className='w-fit cursor-pointer rounded py-3 text-[0.75rem] leading-5 font-semibold text-blue focus-ring'>
        Ver los datos en tabla
      </summary>
      <table className='mt-2 w-full border-collapse'>
        <caption className='sr-only'>{label}</caption>
        <thead>
          <tr className='border-b border-border text-left text-[0.75rem] text-muted-foreground'>
            {(headers ?? ['', unit ?? '']).map((h, i) => (
              <th key={h || i} scope='col' className={cn('py-1.5 font-semibold', i > 0 && 'text-right')}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={String(row[0])} className='border-b border-border/60'>
              {row.map((cell, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: las celdas son fijas por columna.
                <td key={i} className={cn('py-1.5', i > 0 && 'text-right tabular-nums')}>
                  {typeof cell === 'number' ? cell.toLocaleString('es-AR') : cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  )
}
