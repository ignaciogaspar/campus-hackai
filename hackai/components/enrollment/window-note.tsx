/* La ventana de inscripción de una comisión o una mesa de la oferta: hasta
   cuándo está abierta, o cuándo fue si ya cerró. Si está abierta lo dice
   Cursada. */
import { shortDate } from '@/components/dates'
import type { OfferItem } from '@/lib/core/studies'

type EnrollmentWindow = Pick<OfferItem, 'enrollmentOpen' | 'enrollmentStart' | 'enrollmentEnd'>

export function WindowNote({ item }: { item: EnrollmentWindow }) {
  if (item.enrollmentOpen) {
    return (
      <>
        Inscripción abierta hasta el <time dateTime={item.enrollmentEnd}>{shortDate(item.enrollmentEnd)}</time>
      </>
    )
  }
  return (
    <>
      Inscripción cerrada · fue del {shortDate(item.enrollmentStart)} al {shortDate(item.enrollmentEnd)}
    </>
  )
}
