'use client'

/* Si quien mira pidió «reducir movimiento» en su sistema. Del lado del servidor no se sabe: se toma que sí, así lo
   que se dibuja en el servidor ya está quieto en su valor final. */
import { useSyncExternalStore } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

function subscribe(onChange: () => void) {
  const media = window.matchMedia(QUERY)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => true
  )
}
