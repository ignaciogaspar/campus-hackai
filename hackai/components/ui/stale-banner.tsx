import { readTime, timeAgo } from '@/components/dates'
import { StaleNotice } from '@/components/ui/states'

/* Aviso de «desactualizado»: un sistema de origen no respondió y se muestra lo
   último que se leyó, con cuánto hace y a qué hora. Lo usan las pantallas que
   leen de Cursada. `now` es la hora con que se armó la pantalla; sin ella, la
   del servidor. */
export function StaleBanner({ since, now = new Date().toISOString() }: { since: string; now?: string }) {
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
