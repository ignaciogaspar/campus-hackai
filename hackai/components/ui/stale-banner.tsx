import { StaleNotice } from '@/components/ui/states'
import { readTime } from '@/lib/format-dates'

/* Aviso de «desactualizado»: un sistema de origen no respondió y se muestra lo
   último que se leyó, con su hora. Lo usan las pantallas que leen de Cursada. */
export function StaleBanner({ since }: { since: string }) {
  return (
    <StaleNotice>
      <p>
        <b>El SIU o el Campus Virtual no responden.</b> Te mostramos lo que trajimos el{' '}
        <time dateTime={since}>{readTime(since)}</time>: puede haber cambios que todavía no vemos.
      </p>
    </StaleNotice>
  )
}
