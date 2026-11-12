import { readTime, timeAgo } from '@/components/dates'
import { StaleNotice } from '@/components/ui/states'

/* Aviso de «desactualizado»: un sistema de origen no respondió y se muestra lo
   último que se leyó, con cuánto hace y a qué hora. Lo usan las pantallas que
   leen de Cursada. `now` es la hora del reloj de la app (`system().now()` o la
   de Hoy), el mismo que marcó la lectura: con el reloj fijo de la demo, la del
   servidor diría «hace 2 días». */
export function StaleBanner({ since, now }: { since: string; now: string }) {
  return (
    <StaleNotice>
      <p>
        <b>El SIU o el Campus Virtual no responden.</b> Te mostramos lo último que trajimos, actualizado{' '}
        {timeAgo(since, now)} (<time dateTime={since}>{readTime(since)}</time>): puede haber cambios que todavía no
        vemos.
      </p>
    </StaleNotice>
  )
}
