'use client'

/* Envuelve los mensajes de una conversación y pone una marca junto al más
   nuevo: al pie en Consultas, los canales libres, los directos y un hilo;
   arriba en Avisos, que va de lo más nuevo a lo más viejo. Deja ese mensaje a
   la vista:
   - al abrir el canal, el hilo o un filtro (`scope`), sin animación;
   - cuando llega uno propio (recién enviado), siempre;
   - cuando llega uno de otro, solo si ya se estaba mirando el final: si la
     persona subió a leer algo, no se la mueve.
   El margen de la marca deja el mensaje por encima del campo para escribir,
   fijo abajo en el celular (y de la navegación inferior) y pegado al pie de
   la columna en compu. En el celular cuenta también la línea de «Mensaje
   enviado.», que agranda el campo un rato: 67 px de navegación, unos 90 del
   campo con esa línea y un respiro. */
import { type ReactNode, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

/** Cuánto puede quedar la marca fuera de la pantalla y contar igual como «mirando el final». */
const NEAR_PX = 200

type Props = {
  /** Qué se está mirando: el canal, el hilo o el filtro. Al cambiar, se vuelve a dejar a la vista lo último. */
  scope: string
  latest: { id: string; mine: boolean } | null
  /** Arriba de la lista (Avisos) o al pie. */
  at: 'top' | 'bottom'
  children: ReactNode
}

function inView(el: HTMLElement): boolean {
  const { top, bottom } = el.getBoundingClientRect()
  return bottom >= -NEAR_PX && top <= window.innerHeight + NEAR_PX
}

function reveal(el: HTMLElement, animate: boolean) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  el.scrollIntoView({ block: 'nearest', behavior: animate && !reduce ? 'smooth' : 'auto' })
}

export function LatestMark({ scope, latest, at, children }: Props) {
  const mark = useRef<HTMLDivElement>(null)
  const near = useRef(true)
  const shown = useRef<{ scope: string; id: string | null } | null>(null)

  // Si se estaba mirando el final, medido antes de que llegue lo nuevo.
  useEffect(() => {
    const update = () => {
      if (mark.current) near.current = inView(mark.current)
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [])

  const id = latest?.id ?? null
  const mine = latest?.mine ?? false
  useEffect(() => {
    const el = mark.current
    const before = shown.current
    shown.current = { scope, id }
    if (!el) return
    if (before?.scope !== scope) reveal(el, false)
    else if (before.id !== id && (mine || near.current)) reveal(el, true)
  }, [scope, id, mine])

  const marker = (
    <div
      ref={mark}
      aria-hidden='true'
      className={cn(
        'h-0',
        at === 'bottom' ? 'scroll-mb-[calc(180px+env(safe-area-inset-bottom))] lg:scroll-mb-24' : 'scroll-mt-4'
      )}
    />
  )
  return (
    <div>
      {at === 'top' && marker}
      {children}
      {at === 'bottom' && marker}
    </div>
  )
}
