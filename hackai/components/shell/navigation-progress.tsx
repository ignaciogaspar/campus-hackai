'use client'
/* Una barra fina arriba de todo mientras llega la pantalla siguiente. Elegir
   una materia en Inscripciones, cambiar de canal o de filtro es una
   navegación al servidor: sin esto, entre el toque y la respuesta no pasa
   nada en pantalla y parece que no anduvo. Aparece al tocar un enlace interno
   y se va cuando cambian la ruta o la query. No mide nada: avanza sola y
   frena antes del final hasta que llega la respuesta. Para lectores de
   pantalla, una región viva siempre montada dice «Cargando…» mientras tanto
   (la ruedita de LinkPending es solo visual). */
import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

/** Si nada cambió en este tiempo (un enlace a la misma pantalla, un error), la barra se va igual. */
const GIVE_UP_MS = 12_000

/** El enlace interno que lleva a otra pantalla, si el clic es uno que navega en esta pestaña. */
function navigatingLink(event: MouseEvent): HTMLAnchorElement | null {
  if (event.defaultPrevented || event.button !== 0) return null
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null
  const link = (event.target as Element | null)?.closest?.('a[href]')
  if (!(link instanceof HTMLAnchorElement)) return null
  if (link.target && link.target !== '_self') return null
  if (link.hasAttribute('download')) return null
  const to = new URL(link.href, location.href)
  if (to.origin !== location.origin) return null
  // Solo un ancla de la misma pantalla no navega.
  if (to.pathname === location.pathname && to.search === location.search) return null
  return link
}

type Phase = 'quieta' | 'cargando' | 'lista'

const STYLES: Record<Phase, { transform: string; opacity: number; transitionDuration: string }> = {
  quieta: { transform: 'scaleX(0)', opacity: 0, transitionDuration: '0ms' },
  cargando: { transform: 'scaleX(0.85)', opacity: 1, transitionDuration: '2500ms' },
  lista: { transform: 'scaleX(1)', opacity: 0, transitionDuration: '350ms' }
}

export function NavigationProgress() {
  const pathname = usePathname()
  const search = useSearchParams()
  const [phase, setPhase] = useState<Phase>('quieta')

  // Llegó la pantalla nueva: la barra se completa y se desvanece.
  // biome-ignore lint/correctness/useExhaustiveDependencies: se completa cada vez que cambian la ruta o la query.
  useEffect(() => {
    setPhase((current) => (current === 'cargando' ? 'lista' : current))
  }, [pathname, search])

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (navigatingLink(event)) setPhase('cargando')
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [])

  useEffect(() => {
    if (phase === 'quieta') return
    const timer = setTimeout(
      () => setPhase(phase === 'lista' ? 'quieta' : 'lista'),
      phase === 'lista' ? 400 : GIVE_UP_MS
    )
    return () => clearTimeout(timer)
  }, [phase])

  return (
    <>
      <div aria-hidden='true' className='pointer-events-none fixed inset-x-0 top-0 z-50 h-[3px] overflow-hidden'>
        <div
          className='h-full w-full origin-left bg-blue-light transition-[transform,opacity] ease-out motion-reduce:transition-none'
          style={STYLES[phase]}
        />
      </div>
      <p role='status' className='sr-only'>
        {phase === 'cargando' ? 'Cargando…' : ''}
      </p>
    </>
  )
}
