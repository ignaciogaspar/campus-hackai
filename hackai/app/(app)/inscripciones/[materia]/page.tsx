/* Oferta de comisiones de una materia: cada una con su cupo, horario y
   docentes, y el botón para inscribirse en un paso o darse de baja. Qué
   comisiones se ofrecen, si la inscripción está abierta y si ya está
   inscripto lo decide Cursada. Las mesas de examen de la materia están en
   `final/`. */
import { CalendarClock, CalendarX, MapPin, UserRound } from 'lucide-react'
import type { Metadata } from 'next'
import { dropAction, enrollAction } from '@/app/(app)/inscripciones/actions'
import { subjectIdFrom } from '@/app/(app)/inscripciones/subject-param'
import { modalityName, scheduleLine } from '@/components/enrollment/format'
import { InfoRow, OfferCard } from '@/components/enrollment/offer-card'
import { readErrorText } from '@/components/enrollment/read-error'
import { PageHeader } from '@/components/shell/page-header'
import { EmptyState, ErrorNotice } from '@/components/ui/states'
import { requireSession } from '@/lib/auth'
import { system } from '@/lib/composition'
import type { OfferItem } from '@/lib/core/studies'

export const metadata: Metadata = { title: 'Comisiones · Campus HackAI' }

function SectionCard({ item }: { item: OfferItem }) {
  if (item.target.kind !== 'comision') return null
  const modality = modalityName(item.modality)
  const place = modality === item.location ? [item.location] : [modality, item.location]
  return (
    <OfferCard
      item={item}
      title={`Comisión ${item.name}`}
      label={`${item.subjectName}, comisión ${item.name}`}
      enrollAction={enrollAction}
      dropAction={dropAction}
    >
      <InfoRow icon={CalendarClock} label='Horario'>
        {item.schedule.map(scheduleLine).join(' · ') || 'Horario a confirmar'}
      </InfoRow>
      <InfoRow icon={MapPin} label='Lugar'>
        {place.filter(Boolean).join(' · ')}
      </InfoRow>
      <InfoRow icon={UserRound} label='Docentes'>
        {item.teachers.map((t) => t.name).join(', ') || 'Docentes a confirmar'}
      </InfoRow>
    </OfferCard>
  )
}

export default async function OfertaPage({ params }: { params: Promise<{ materia: string }> }) {
  const session = await requireSession('alumno')
  const { materia } = await params
  const result = await system().studies.offer(session.personId, { kind: 'cursada', subjectId: subjectIdFrom(materia) })
  const subjectName = result.ok ? result.value[0]?.subjectName : undefined

  return (
    <>
      <PageHeader title={subjectName ?? 'Comisiones'} kicker='Elegí tu comisión' backHref='/inscripciones' />

      <main className='flex w-full flex-col gap-6 px-4 pt-5 pb-16 lg:px-6 lg:pt-8'>
        {!result.ok ? (
          <ErrorNotice>{readErrorText(result.error, 'las comisiones')}</ErrorNotice>
        ) : result.value.length === 0 ? (
          <EmptyState icon={CalendarX} title='Sin comisiones'>
            Esta materia no tiene comisiones abiertas en tu facultad.
          </EmptyState>
        ) : (
          <ul className='grid gap-3 lg:grid-cols-2 lg:items-start'>
            {result.value.map((item) => (
              <SectionCard key={item.target.kind === 'comision' ? item.target.sectionId : item.name} item={item} />
            ))}
          </ul>
        )}
      </main>
    </>
  )
}
