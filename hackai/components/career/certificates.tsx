/* El avance oficial de cada certificado de la carrera (el título, un título
   intermedio, cada orientación), tal como lo da el SIU, para ver cuál tenés
   más cerca. La orientación elegida va marcada. HackAI no calcula ninguno. */
import type { CertificateProgress } from '@/lib/core/studies'
import { cn } from '@/lib/utils'

function CertificateRow({ certificate }: { certificate: CertificateProgress }) {
  const label = certificate.orientation ?? certificate.name
  const percent = certificate.percent
  return (
    <li
      className={cn(
        'flex flex-col gap-2 rounded-xl border p-3',
        certificate.chosen ? 'border-blue/30 bg-accent/60' : 'border-border bg-card'
      )}
    >
      <div className='flex items-start justify-between gap-3'>
        <div className='flex min-w-0 flex-col'>
          <span className='text-[0.875rem] leading-snug font-semibold text-ink'>{label}</span>
          {certificate.orientation && <span className='text-[0.75rem] text-muted-foreground'>{certificate.name}</span>}
        </div>
        <div className='flex flex-none items-center gap-2'>
          {certificate.chosen && (
            <span className='rounded-full bg-blue px-2 py-0.5 text-[0.6875rem] font-semibold text-white'>
              Tu orientación
            </span>
          )}
          <span className='text-[1.125rem] font-extrabold text-ink tabular-nums'>
            {percent === null ? '—' : `${percent}%`}
          </span>
        </div>
      </div>
      <div
        role='progressbar'
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent ?? undefined}
        className='h-2 overflow-hidden rounded-full bg-accent'
      >
        <div
          className='h-full rounded-full bg-blue'
          style={{ width: `${Math.min(Math.max(percent ?? 0, 0), 100)}%` }}
        />
      </div>
    </li>
  )
}

export function Certificates({ certificates }: { certificates: CertificateProgress[] }) {
  return (
    <section aria-labelledby='certificados' className='flex flex-col gap-3'>
      <div className='flex flex-col gap-1 px-1'>
        <h2 id='certificados' className='text-lg font-extrabold text-ink'>
          Títulos y orientaciones
        </h2>
        <p className='text-[0.8125rem] text-muted-foreground'>
          El avance de cada uno según el SIU, para ver cuál tenés más cerca.
        </p>
      </div>
      <ul className='grid gap-3 md:grid-cols-2 2xl:grid-cols-3'>
        {certificates.map((c) => (
          <CertificateRow key={`${c.name}·${c.orientation ?? ''}`} certificate={c} />
        ))}
      </ul>
    </section>
  )
}
