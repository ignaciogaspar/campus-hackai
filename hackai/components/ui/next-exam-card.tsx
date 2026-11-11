import { OriginBadge } from '@/components/ui/origin-badge'

type Props = {
  title: string
  subject: string
  /** Día, hora y lugar, por ejemplo «Lunes 16 de noviembre · 08:00 · Aula 20». */
  when: string
  daysLeft: number
}

/* El próximo parcial o final, protagonista en Hoy. La fecha viene del SIU. */
export function NextExamCard({ title, subject, when, daysLeft }: Props) {
  return (
    <section aria-label='Próximo parcial' className='flex flex-col gap-3 rounded-[22px] bg-linear-135 from-azul to-azul-hondo p-5 text-white shadow-card'>
      <div className='flex items-center justify-between gap-2'>
        <span className='text-xs font-bold tracking-widest text-white/80 uppercase'>Próximo parcial</span>
        <OriginBadge origin='siu' className='bg-white/15 text-white' />
      </div>
      <div>
        <h2 className='text-[1.375rem] leading-tight font-extrabold'>{title}</h2>
        <p className='text-[0.8125rem] text-white/85'>{subject}</p>
      </div>
      <p className='flex items-baseline gap-1.5 text-[0.8125rem] text-white/85'>
        <b className='text-4xl leading-none font-extrabold text-white'>{daysLeft}</b>
        {daysLeft === 1 ? 'día' : 'días'} · {when}
      </p>
    </section>
  )
}
