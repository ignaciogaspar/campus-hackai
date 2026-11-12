'use client'

/* Cuánto tapa el teclado del teléfono, en la variable CSS `--keyboard-inset` de la
   página, para que ComposerDock suba el campo para escribir justo encima del
   teclado en vez de quedar detrás. Se mide con `visualViewport`, que cambia al
   abrir y cerrar el teclado y cuando el navegador corre la pantalla. Sin
   teclado (la compu, o sin estar escribiendo) vale 0. Al salir del campo no se
   baja enseguida: se espera a que el teclado se cierre, así el botón de
   enviar no se corre mientras se lo toca. */
import { useEffect } from 'react'
import { keyboardInset } from '@/components/spaces/keyboard-inset-size'

const VARIABLE = '--keyboard-inset'

/** Los campos que abren el teclado. Una casilla, una opción o elegir un archivo, no. */
const TEXT_INPUTS = new Set(['text', 'search', 'email', 'url', 'tel', 'password', 'number'])

function typing(): boolean {
  const el = document.activeElement
  return el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && TEXT_INPUTS.has(el.type))
}

export function KeyboardInset() {
  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return
    const root = document.documentElement

    const update = () => {
      const inset = keyboardInset({
        layoutHeight: window.innerHeight,
        viewportHeight: viewport.height,
        viewportTop: viewport.offsetTop,
        typing: typing()
      })
      root.style.setProperty(VARIABLE, `${inset}px`)
    }

    update()
    viewport.addEventListener('resize', update)
    viewport.addEventListener('scroll', update)
    document.addEventListener('focusin', update)
    return () => {
      viewport.removeEventListener('resize', update)
      viewport.removeEventListener('scroll', update)
      document.removeEventListener('focusin', update)
      root.style.removeProperty(VARIABLE)
    }
  }, [])

  return null
}
