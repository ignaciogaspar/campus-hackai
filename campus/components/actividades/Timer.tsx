'use client'

import { useEffect, useState } from 'react'
import { mmss, remainingSeconds, type ActivityTimer } from '@/lib/actividades/types'

/** Cronómetro que maneja el profesor. Corrige el desfase de reloj con `serverNow`. */
export function Timer({ timer, serverNow }: { timer: ActivityTimer | null | undefined; serverNow: string }) {
  const [skew] = useState(() => new Date(serverNow).getTime() - Date.now())
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!timer) return
    const t = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(t)
  }, [timer])
  if (!timer) return null
  const left = remainingSeconds(timer, now + skew)
  return (
    <div className={`ac-timer${left === 0 ? ' ac-timer-fin' : ''}`} role="timer" aria-live="off">
      <span className="ac-timer-num">{mmss(left)}</span>
      <span>
        <strong>{timer.label}</strong>
        <br />
        <small>{left === 0 ? 'Tiempo cumplido' : `de ${timer.minutes} min`}</small>
      </span>
    </div>
  )
}
