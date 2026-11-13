'use client'

/* Un riel con scroll de costado que, al dibujarse, deja a la vista la opción
   elegida (`aria-current`). Mueve solo el riel, nunca la página: así en el
   celular se ve la columna o la comisión que se está mirando aunque esté al
   final de la lista. */
import { type ComponentProps, useEffect, useRef } from 'react'

export function RailScroller(props: ComponentProps<'div'>) {
  const rail = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const track = rail.current
    const current = track?.querySelector<HTMLElement>('[aria-current]')
    if (!track || !current) return
    const left = current.offsetLeft - (track.clientWidth - current.offsetWidth) / 2
    track.scrollLeft = Math.max(0, left)
  })
  return <div ref={rail} {...props} />
}
