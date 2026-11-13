/* «Tu clase de ahora» en el Hoy del docente: la clase que está en curso o, si
   no hay, la próxima, con su materia, comisión, horario, aula y modalidad. Si
   es de hoy, lleva Tomar lista (a la lista de la clase) y, si es virtual o
   híbrida, «Entrar a Zoom» arriba de todo, o el aviso de que falta cargar el
   enlace con el camino para cargarlo. Solo muestra lo que arma Hoy: cuál es la
   clase y si lleva enlace lo deciden Hoy y Cursada.

   En el celular es una columna de botones de ancho completo, con el alto
   mínimo de un toque. */
import { CalendarClock, ClipboardCheck, MapPin } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { longDay, timeOf } from '@/components/dates'
import { modalityName } from '@/components/enrollment/format'
import { attendanceHref } from '@/components/subjects/attendance-format'
import { ALUMNOS_TAB, subjectTabHref } from '@/components/subjects/subject-nav'
import { ZoomLink } from '@/components/subjects/zoom-link'
import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { StatusPill } from '@/components/ui/status-pill'
import { hasZoom } from '@/lib/core/studies'
import type { NowClass } from '@/lib/core/today'
import { dayKey } from '@/lib/dates'
import { cn } from '@/lib/utils'

const action = (variant: 'default' | 'outline') =>
  cn(buttonVariants({ variant, size: 'lg' }), 'h-11 w-full justify-center gap-2 text-sm font-semibold sm:w-auto')

function Detail({ icon: Icon, children }: { icon: typeof MapPin; children: ReactNode }) {
  return (
    <p className='flex items-start gap-2 text-[0.8125rem] text-ink/80'>
      <Icon aria-hidden='true' className='mt-0.5 size-4 flex-none text-muted-foreground' strokeWidth={1.8} />
      <span className='min-w-0'>{children}</span>
    </p>
  )
}

export function NowClassCard({ nowClass: c, now }: { nowClass: NowClass; now: string }) {
  const isToday = dayKey(c.classAt) === dayKey(now)
  const virtual = hasZoom(c.modality)
  const modality = modalityName(c.modality)
  const place = [modality, c.location].filter((part, i, all) => part && all.indexOf(part) === i).join(' · ')
  const when = isToday
    ? `${timeOf(c.classAt)} a ${timeOf(c.endAt)}`
    : `${longDay(c.classAt)}, ${timeOf(c.classAt)} a ${timeOf(c.endAt)}`
  const title = c.state === 'ahora' ? 'Tu clase de ahora' : 'Tu próxima clase'

  return (
    <section aria-labelledby='clase-de-ahora' className='flex min-w-0 flex-col gap-3'>
      <h2 id='clase-de-ahora' className='text-lg font-extrabold'>
        {title}
      </h2>
      <Card className='flex flex-col gap-3 p-4'>
        {isToday && c.zoomUrl && (
          <ZoomLink url={c.zoomUrl} subjectName={c.subjectName} className={action('default')} iconClassName='' />
        )}
        <div className='flex items-start justify-between gap-3'>
          <div className='min-w-0'>
            <h3 className='text-[0.9375rem] leading-snug font-bold text-ink'>{c.subjectName}</h3>
            <p className='mt-0.5 text-[0.75rem] text-muted-foreground'>
              {c.subjectCode} · Comisión {c.sectionName}
            </p>
          </div>
          {c.state === 'ahora' && <StatusPill tone='info'>En curso</StatusPill>}
        </div>
        <div className='flex flex-col gap-1.5'>
          <Detail icon={CalendarClock}>{when}</Detail>
          <Detail icon={MapPin}>{place || 'Aula a confirmar'}</Detail>
        </div>
        {isToday && virtual && !c.zoomUrl && (
          <p className='rounded-xl bg-muted px-3 py-2 text-[0.8125rem] text-ink'>
            Todavía no cargaste el enlace de Zoom de esta comisión.{' '}
            <Link
              href={subjectTabHref(c.subjectId, ALUMNOS_TAB, c.sectionId)}
              className='inline-flex min-h-11 items-center font-semibold text-blue underline-offset-2 hover:underline focus-ring'
            >
              Cargalo en Alumnos y clases
            </Link>
          </p>
        )}
        {isToday && (
          <Link
            href={attendanceHref(c.subjectId, c.sectionId, c.classAt)}
            className={action(c.zoomUrl ? 'outline' : 'default')}
          >
            <ClipboardCheck aria-hidden='true' />
            Tomar lista
          </Link>
        )}
      </Card>
    </section>
  )
}
