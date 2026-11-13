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
    // Con las cajas en pantalla y no con offsetLeft: ese se mide desde el primer ancestro posicionado, que no es el
    // riel, y la opción elegida quedaba cortada. Tampoco scrollIntoView, que puede mover la página.
    const box = current.getBoundingClientRect()
    const frame = track.getBoundingClientRect()
    const left = track.scrollLeft + box.left - frame.left - (track.clientWidth - box.width) / 2
    track.scrollLeft = Math.max(0, left)
  })
  return <div ref={rail} {...props} />
}
