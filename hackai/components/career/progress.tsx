/* Las piezas del avance de la carrera: el anillo con el porcentaje y las
   barras de obligatorias, optativas y vida universitaria. Solo dibujan los
   números que da Cursada. */
import type { CareerProgress } from '@/lib/core/studies'

const RADIUS = 52
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

/* El anillo: el carril celeste y, encima, lo aprobado en el azul de la app. */
export function ProgressRing({ percent }: { percent: number }) {
  const done = Math.min(Math.max(percent, 0), 100)
  return (
    <div className='relative grid size-32 flex-none place-items-center'>
      <svg viewBox='0 0 120 120' aria-hidden='true' className='absolute inset-0 -rotate-90'>
        <circle cx='60' cy='60' r={RADIUS} fill='none' strokeWidth='10' className='stroke-accent' />
        <circle
          cx='60'
          cy='60'
          r={RADIUS}
          fill='none'
          strokeWidth='10'
          strokeLinecap='round'
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - done / 100)}
          className='stroke-blue'
        />
      </svg>
      <span className='flex flex-col items-center'>
        <span className='text-[1.75rem] leading-none font-extrabold text-ink tabular-nums'>{done}%</span>
        <span className='mt-1 text-[0.75rem] text-muted-foreground'>aprobado</span>
      </span>
    </div>
  )
}

/* Una barra: el nombre, cuántas de cuántas y la proporción. */
export function ProgressBar({ label, progress }: { label: string; progress: CareerProgress }) {
  const ratio = progress.total ? progress.approved / progress.total : 0
  return (
    <div className='flex flex-col gap-1.5'>
      <div className='flex items-baseline justify-between gap-3 text-[0.8125rem]'>
        <span className='font-semibold text-ink'>{label}</span>
        <span className='text-muted-foreground tabular-nums'>
          <b className='font-semibold text-ink'>{progress.approved}</b> de {progress.total}
        </span>
      </div>
      <div
        role='progressbar'
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={progress.total}
        aria-valuenow={progress.approved}
        className='h-2 overflow-hidden rounded-full bg-accent'
      >
        <div className='h-full rounded-full bg-blue' style={{ width: `${Math.round(ratio * 100)}%` }} />
      </div>
    </div>
  )
}
