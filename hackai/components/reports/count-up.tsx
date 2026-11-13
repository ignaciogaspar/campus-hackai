'use client'

/* Un número que cuenta hasta su valor al aparecer, y desde el anterior cuando cambia (al cambiar los filtros). Dura
   menos de un segundo y frena al llegar. Con «reducir movimiento» se ve el valor directo. El lector de pantalla lee
   siempre el valor final, no los intermedios. Arranca en un efecto de layout para que el primer cuadro ya muestre el
   número de partida y no el final (si no, se ve el valor, salta a 0 y vuelve a subir). Al hidratar la página no
   cuenta: el número ya llegó pintado del servidor. */
import { useLayoutEffect, useRef, useState } from 'react'
import { useReducedMotion } from '@/components/reports/motion'

const DURATION_MS = 800

const easeOut = (t: number) => 1 - (1 - t) ** 3

export function CountUp({ value, decimals = 0, suffix = '' }: { value: number; decimals?: number; suffix?: string }) {
  const reduced = useReducedMotion()
  const [shown, setShown] = useState(value)
  const from = useRef(0)

  useLayoutEffect(() => {
    if (reduced) {
      setShown(value)
      from.current = value
      return
    }
    const start = performance.now()
    const origin = from.current
    if (origin === value) return
    setShown(origin)
    let frame = requestAnimationFrame(function step(now) {
      const t = Math.min(1, (now - start) / DURATION_MS)
      setShown(origin + (value - origin) * easeOut(t))
      if (t < 1) frame = requestAnimationFrame(step)
      else from.current = value
    })
    return () => {
      cancelAnimationFrame(frame)
      from.current = value
    }
  }, [value, reduced])

  const text = (n: number) =>
    `${n.toLocaleString('es-AR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`
  return (
    <>
      <span aria-hidden='true'>{text(shown)}</span>
      <span className='sr-only'>{text(value)}</span>
    </>
  )
}
