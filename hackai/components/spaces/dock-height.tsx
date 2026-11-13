'use client'

/* El alto del campo para escribir pegado abajo (ComposerDock), en la variable
   CSS `--dock-height` de la página. Con eso la página deja lugar abajo y
   LatestMark deja el último mensaje por encima del campo, aunque el campo
   crezca con el texto, un adjunto o la confirmación de que se envió. Sin
   campo (Material, la lista de directos) la variable no está y vale 0. */
import { useEffect, useRef } from 'react'

const VARIABLE = '--dock-height'

export function DockHeight() {
  const probe = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const dock = probe.current?.parentElement
    if (!dock) return
    const root = document.documentElement
    const observer = new ResizeObserver(() => root.style.setProperty(VARIABLE, `${dock.offsetHeight}px`))
    observer.observe(dock)
    return () => {
      observer.disconnect()
      root.style.removeProperty(VARIABLE)
    }
  }, [])

  return <span ref={probe} hidden />
}
