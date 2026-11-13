'use client'

/* Envuelve los mensajes de una conversación y pone una marca junto al más
   nuevo: al pie en Consultas, los canales libres, los directos y un hilo;
   arriba en Avisos, que va de lo más nuevo a lo más viejo. Deja ese mensaje a
   la vista:
   - al abrir el canal, el hilo o un filtro (`scope`), sin animación; si había
     algo sin leer, el primero (con el separador «Nuevos», unread-memory.tsx).
     Se hace en el cuadro siguiente: si no, el scroll al tope con que Next.js
     abre la página lo deshacía;
   - cuando llega uno propio (recién enviado), siempre;
   - cuando llega uno de otro, solo si ya se estaba mirando el final: si la
     persona subió a leer algo, no se la mueve.
   El margen de la marca deja el mensaje por encima del campo para escribir,
   fijo abajo en el celular (y de la navegación inferior) y pegado al pie de
   la columna en compu. En el celular es `--dock-space`, que sigue el alto real
   del campo (con el adjunto o la confirmación de que se envió): por eso lo
   propio se deja a la vista en el cuadro siguiente, ya medido. */
import { type ReactNode, useEffect, useRef } from 'react'
import type { Latest } from '@/components/spaces/format'
import { cn } from '@/lib/utils'

/** Cuánto puede quedar la marca fuera de la pantalla y contar igual como «mirando el final». */
const NEAR_PX = 200

type Props = {
  /** Qué se está mirando: el canal, el hilo o el filtro. Al cambiar, se vuelve a dejar a la vista lo último. */
  scope: string
  latest: Latest | null
  /** Arriba de la lista (Avisos) o al pie. */
  at: 'top' | 'bottom'
  children: ReactNode
}

function inView(el: HTMLElement): boolean {
  const { top, bottom } = el.getBoundingClientRect()
  return bottom >= -NEAR_PX && top <= window.innerHeight + NEAR_PX
}

/* Sin scroll suave: la dirección de diseño admite un solo movimiento, el pulso
   del contador de no leídos. */
function reveal(el: HTMLElement) {
  el.scrollIntoView({ block: 'nearest', behavior: 'auto' })
}

/** El primer renglón con algo sin leer de la lista, si hay. */
function firstNew(list: HTMLElement | null): HTMLElement | null {
  return list?.querySelector<HTMLElement>('[data-new]') ?? null
}

export function LatestMark({ scope, latest, at, children }: Props) {
  const list = useRef<HTMLDivElement>(null)
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
    if (before?.scope !== scope) requestAnimationFrame(() => reveal(firstNew(list.current) ?? el))
    else if (before.id !== id && (mine || near.current)) requestAnimationFrame(() => reveal(el))
  }, [scope, id, mine])

  const marker = (
    <div
      ref={mark}
      aria-hidden='true'
      className={cn('h-0', at === 'bottom' ? 'scroll-mb-(--dock-space) lg:scroll-mb-24' : 'scroll-mt-4')}
    />
  )
  return (
    <div ref={list}>
      {at === 'top' && marker}
      {children}
      {at === 'bottom' && marker}
    </div>
  )
}
