/* La ventana de inscripción de una comisión o una mesa de la oferta: cuándo
   abre si todavía no abrió, hasta cuándo está abierta, o cuándo fue si ya
   cerró (y, si está inscripto, que ya no se puede dar de baja). En qué
   momento de la ventana está lo dice Cursada. */
import { shortDate, timeOf } from '@/components/dates'
import type { OfferItem } from '@/lib/core/studies'

type EnrollmentWindow = Pick<OfferItem, 'enrollmentWindow' | 'enrollmentStart' | 'enrollmentEnd' | 'alreadyEnrolled'>

export function WindowNote({ item }: { item: EnrollmentWindow }) {
  const { enrollmentStart: start, enrollmentEnd: end } = item
  if (item.enrollmentWindow === 'abierta') {
    if (end === null) return <>Inscripción abierta · el SIU no informa hasta cuándo</>
    return (
      <>
        Inscripción abierta hasta el <time dateTime={end}>{shortDate(end)}</time>
      </>
    )
  }
  if (item.enrollmentWindow === 'no-abrio' && start !== null && end !== null) {
    return (
      <>
        La inscripción abre el <time dateTime={start}>{`${shortDate(start)} a las ${timeOf(start)}`}</time> y cierra el{' '}
        <time dateTime={end}>{shortDate(end)}</time>
      </>
    )
  }
  if (item.alreadyEnrolled) {
    if (end === null) return <>La inscripción cerró: ya no te podés dar de baja.</>
    return (
      <>
        La inscripción cerró el <time dateTime={end}>{shortDate(end)}</time>: ya no te podés dar de baja.
      </>
    )
  }
  if (start === null || end === null) return <>Inscripción cerrada</>
  return (
    <>
      Inscripción cerrada · fue del {shortDate(start)} al {shortDate(end)}
    </>
  )
}
