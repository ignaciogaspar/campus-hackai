'use client'

/* Trae lo nuevo del canal abierto sin que haya que recargar. Cada 15 segundos
   pregunta la versión del canal (app/api/canales/[canal]/version), que es
   liviana, y solo si cambió vuelve a pedir la página. Pregunta únicamente con
   la pestaña a la vista; al volver a ella, pregunta enseguida. Si el chequeo
   falla, no hace nada: la página se ve igual y el próximo chequeo reintenta.
   No dibuja nada. */
import { useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'

const EVERY_MS = 15_000

export function ChannelUpdates({ channelId, version }: { channelId: string; version: string }) {
  const router = useRouter()
  /** La última versión conocida: la que trajo la página o la del último chequeo. */
  const known = useRef(version)

  useEffect(() => {
    known.current = version
  }, [version])

  useEffect(() => {
    let checking = false

    async function check() {
      if (checking || document.visibilityState !== 'visible') return
      checking = true
      try {
        const response = await fetch(`/api/canales/${encodeURIComponent(channelId)}/version`, { cache: 'no-store' })
        if (!response.ok) return
        const { version: latest } = (await response.json()) as { version?: string }
        if (latest && latest !== known.current) {
          known.current = latest
          router.refresh()
        }
      } catch {
        // Sin red o con el servidor caído: se reintenta en el próximo chequeo.
      } finally {
        checking = false
      }
    }

    const timer = setInterval(check, EVERY_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') void check()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [channelId, router])

  return null
}
