import { ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { OriginBadge } from '@/components/ui/origin-badge'

type Props = {
  title: string
  subject: string
  /** Día, hora y lugar, por ejemplo «Lunes 16 de noviembre · 08:00 · Aula 20». */
  when: string
  /** Días de calendario que faltan; 0 es hoy. */
  daysLeft: number
  /** «Próximo parcial» o «Próximo final». */
  label?: string
  /** El turno de examen de un final, por ejemplo «Turno Diciembre 2026». */
  detail?: string
  /** A dónde lleva: el espacio de la materia. */
  href?: string
}

function Body({ title, subject, when, daysLeft, label, detail, href }: Props & { label: string }) {
  return (
    <>
      <div className='flex items-center justify-between gap-2'>
        <span className='text-xs font-bold tracking-widest text-white/80 uppercase'>{label}</span>
        <OriginBadge origin='siu' className='bg-white/15 text-white' />
      </div>
      <div>
        <h2 className='text-[1.375rem] leading-tight font-extrabold'>{title}</h2>
        <p className='text-[0.8125rem] text-white/85'>{detail ? `${subject} · ${detail}` : subject}</p>
      </div>
      <p className='flex items-baseline gap-1.5 text-[0.8125rem] text-white/85'>
        {daysLeft === 0 ? (
          <b className='text-4xl leading-none font-extrabold text-white'>Hoy</b>
        ) : (
          <>
            <b className='text-4xl leading-none font-extrabold text-white'>{daysLeft}</b>
            {daysLeft === 1 ? 'día' : 'días'}
          </>
        )}{' '}
        · {when}
      </p>
      {href && (
        <span className='flex items-center gap-1 text-[0.8125rem] font-semibold text-white'>
          Ir al espacio de la materia
          <ChevronRight
            aria-hidden='true'
            className='size-4 transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none'
          />
        </span>
      )}
    </>
  )
}

const CARD = 'flex flex-col gap-3 rounded-[22px] bg-linear-135 from-blue to-blue-deep p-5 text-white shadow-card'

/* El próximo parcial o final, protagonista en Hoy. La fecha viene del SIU. Con `href`, toda la tarjeta lleva al espacio de la materia. */
export function NextExamCard({ label = 'Próximo parcial', href, ...props }: Props) {
  if (!href) {
    return (
      <section aria-label={label} className={CARD}>
        <Body label={label} {...props} />
      </section>
    )
  }
  return (
    <section aria-label={label}>
      <Link href={href} className={`group ${CARD} focus-ring`}>
        <Body label={label} href={href} {...props} />
      </Link>
    </section>
  )
}
