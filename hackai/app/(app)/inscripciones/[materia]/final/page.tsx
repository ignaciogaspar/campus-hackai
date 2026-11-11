/* Oferta de mesas de examen final de una materia: cada una con su fecha, lugar,
   tribunal y cupo, y el botón para inscribirse en un paso o darse de baja, por
   el mismo flujo que una comisión. Qué mesas se ofrecen (las de su facultad que
   todavía no se tomaron), si la inscripción está abierta y si ya está inscripto
   lo decide Cursada. */
import { CalendarX, MapPin, UserRound } from 'lucide-react'
import type { Metadata } from 'next'
import { dropAction, enrollAction } from '@/app/(app)/inscripciones/actions'
import { subjectIdFrom } from '@/app/(app)/inscripciones/subject-param'
import { longDay, shortDate, timeOf } from '@/components/dates'
import { InfoRow, OfferCard } from '@/components/enrollment/offer-card'
import { readErrorText } from '@/components/enrollment/read-error'
import { PageHeader } from '@/components/shell/page-header'
import { EmptyState, ErrorNotice } from '@/components/ui/states'
import { requireSession } from '@/lib/auth'
import { system } from '@/lib/composition'
import type { OfferItem } from '@/lib/core/studies'

export const metadata: Metadata = { title: 'Mesas de examen · Campus HackAI' }

/** Una mesa sin fecha igual está ofrecida: se ve, con «Fecha a confirmar», como el lugar y el tribunal. */
function BoardCard({ item }: { item: OfferItem }) {
  if (item.target.kind !== 'mesa') return null
  return (
    <OfferCard
      item={item}
      title={
        item.date ? (
          <time dateTime={item.date}>
            {longDay(item.date)} · {timeOf(item.date)}
          </time>
        ) : (
          'Fecha a confirmar'
        )
      }
      label={`Final de ${item.subjectName}, ${item.date ? shortDate(item.date) : item.period}`}
      enrollAction={enrollAction}
      dropAction={dropAction}
    >
      <InfoRow icon={MapPin} label='Lugar'>
        {item.location || 'Lugar a confirmar'}
      </InfoRow>
      <InfoRow icon={UserRound} label='Tribunal'>
        {item.teachers.map((t) => t.name).join(', ') || 'Tribunal a confirmar'}
      </InfoRow>
    </OfferCard>
  )
}

export default async function ExamBoardsPage({ params }: { params: Promise<{ materia: string }> }) {
  const session = await requireSession('alumno')
  const { materia } = await params
  const result = await system().studies.offer(session.personId, { kind: 'examen', subjectId: subjectIdFrom(materia) })
  const subjectName = result.ok ? result.value[0]?.subjectName : undefined

  return (
    <>
      <PageHeader title={subjectName ?? 'Mesas de examen'} kicker='Elegí tu mesa de final' backHref='/inscripciones' />

      <main className='flex w-full flex-col gap-6 px-4 pt-5 pb-16 lg:px-6 lg:pt-8'>
        {!result.ok ? (
          <ErrorNotice>{readErrorText(result.error, 'las mesas')}</ErrorNotice>
        ) : result.value.length === 0 ? (
          <EmptyState icon={CalendarX} title='Sin mesas'>
            Esta materia no tiene mesas por tomar en tu facultad.
          </EmptyState>
        ) : (
          <ul className='grid gap-3 lg:grid-cols-2 lg:items-start'>
            {result.value.map((item) => (
              <BoardCard key={item.target.kind === 'mesa' ? item.target.examBoardId : item.name} item={item} />
            ))}
          </ul>
        )}
      </main>
    </>
  )
}
