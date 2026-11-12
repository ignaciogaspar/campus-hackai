'use client'

/* El canal abierto consulta su versión con la pestaña visible. Espacios
   limita la sincronización con Discord a una vez cada 5 s por espacio. */
import { useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { FIRST_POLL_MS, nextPollDelay } from '@/components/spaces/poll-delay'

async function channelVersion(channelId: string, signal: AbortSignal): Promise<string | undefined> {
  const response = await fetch(`/api/canales/${encodeURIComponent(channelId)}/version`, {
    cache: 'no-store',
    signal
  })
  if (!response.ok) return
  const { version } = (await response.json()) as { version?: string }
  return version
}

export function ChannelUpdates({ channelId, version }: { channelId: string; version: string }) {
  const router = useRouter()
  /** La última versión conocida: la que trajo la página o la del último chequeo. */
  const known = useRef(version)

  useEffect(() => {
    known.current = version
  }, [version])

  useEffect(() => {
    let delay = FIRST_POLL_MS
    let timer: ReturnType<typeof setTimeout> | undefined
    let pending: AbortController | undefined

    function schedule() {
      timer = setTimeout(check, delay)
    }

    function update(latest: string | undefined, signal: AbortSignal, resumed: boolean) {
      if (signal.aborted || !latest) return
      const changed = latest !== known.current
      delay = nextPollDelay(delay, changed || resumed)
      if (changed) {
        known.current = latest
        router.refresh()
      }
    }

    async function check(resumed = false) {
      if (pending || document.visibilityState !== 'visible') return
      const controller = new AbortController()
      pending = controller
      try {
        update(await channelVersion(channelId, controller.signal), controller.signal, resumed)
      } catch {
        // Sin red: se reintenta cuando toque el próximo chequeo.
      } finally {
        if (pending === controller) {
          pending = undefined
          if (document.visibilityState === 'visible') schedule()
        }
      }
    }

    const reset = () => {
      clearTimeout(timer)
      pending?.abort()
      pending = undefined
      delay = FIRST_POLL_MS
    }
    const onVisibility = () => {
      reset()
      if (document.visibilityState === 'visible') void check(true)
    }
    if (document.visibilityState === 'visible') schedule()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      reset()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [channelId, router])

  return null
}
