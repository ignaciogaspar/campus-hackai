'use client'

/* Pestañas hechas con enlaces que se recorren con las flechas del teclado,
   como pide el sistema visual: izquierda y derecha (o arriba y abajo en la
   lista vertical de compu) pasan al enlace de al lado, Inicio y Fin van a los
   extremos. Tab sigue entrando y saliendo de la lista como siempre. Es lo
   único de las pestañas que corre en el navegador.

   La página no se mueve sola hacia las pestañas: cada vez que se publica algo
   o el espacio se actualiza la lista se vuelve a dibujar, y llevarla a la
   vista ahí hacía saltar la página hacia arriba mientras se leía o escribía. */
import type { ComponentProps, KeyboardEvent } from 'react'

const STEP: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }

function onKeyDown(event: KeyboardEvent<HTMLUListElement>) {
  const links = [...event.currentTarget.querySelectorAll<HTMLAnchorElement>('a[href]')]
  const at = links.indexOf(document.activeElement as HTMLAnchorElement)
  if (at === -1) return
  let next: number
  if (event.key === 'Home') next = 0
  else if (event.key === 'End') next = links.length - 1
  else if (event.key in STEP) next = (at + STEP[event.key] + links.length) % links.length
  else return
  event.preventDefault()
  links[next].focus()
  links[next].scrollIntoView({ block: 'nearest', inline: 'nearest' })
}

export function ArrowKeysList(props: ComponentProps<'ul'>) {
  return <ul onKeyDown={onKeyDown} {...props} />
}
