/* Lo que tiene la inscripción abierta y suma a un bloque que falta: las
   optativas para las horas, las actividades con créditos para la vida
   universitaria. Cada una lleva a su oferta en Inscripciones en un paso. Solo
   cruza las listas que dan Cursada: el plan y las inscripciones abiertas. */
import { ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { closingText } from '@/components/enrollment/format'
import { href, type Kind } from '@/components/enrollment/list-filters'
import { offerHref } from '@/components/enrollment/offer-href'
import type { OpenEnrollment } from '@/lib/core/studies'

const MAX = 3

/** Las inscripciones abiertas a cursar, por materia: las únicas que suman al plan. */
export function openCourses(open: OpenEnrollment[]): Map<string, OpenEnrollment> {
  return new Map(open.filter((o) => o.kind !== 'examen').map((o) => [o.subjectId, o]))
}

function detailOf(item: OpenEnrollment, unit: 'créditos' | 'horas' | null): string {
  return [
    unit && item.credits !== null ? `da ${item.credits} ${unit}` : null,
    item.closesInDays !== null ? closingText(item.closesInDays) : null
  ]
    .filter(Boolean)
    .join(' · ')
}

export function OpenNow({
  items,
  unit,
  label,
  kind
}: {
  items: OpenEnrollment[]
  /** En qué cuenta lo que da cada una, si el SIU lo dice. */
  unit: 'créditos' | 'horas' | null
  label: string
  /** El filtro de Inscripciones que las muestra todas. */
  kind: Kind
}) {
  if (!items.length) return null
  const shown = items.slice(0, MAX)
  return (
    <div className='flex flex-col gap-1'>
      <p className='text-[0.75rem] font-semibold text-ink'>{label}</p>
      <ul className='flex flex-col gap-1'>
        {shown.map((item) => {
          const detail = detailOf(item, unit)
          return (
            <li key={item.subjectId}>
              <Link
                href={offerHref(item.subjectId, item.kind)}
                className='group flex items-center gap-2 rounded-lg border border-blue/20 bg-accent/50 px-2.5 py-1.5 text-[0.8125rem] transition-colors hover:border-blue/40 focus-ring'
              >
                <span className='flex min-w-0 flex-1 flex-col'>
                  <span className='leading-snug font-semibold text-ink'>{item.subjectName}</span>
                  {detail && <span className='text-[0.75rem] text-muted-foreground'>{detail}</span>}
                </span>
                <ChevronRight aria-hidden='true' className='size-4 flex-none text-blue' />
              </Link>
            </li>
          )
        })}
      </ul>
      {items.length > MAX && (
        <Link
          href={href('materias', undefined, kind)}
          className='text-[0.75rem] font-semibold text-blue hover:underline focus-ring'
        >
          Ver las {items.length} en Inscripciones
        </Link>
      )}
    </div>
  )
}
