'use client'

/* Dictado simple con Web Speech API (es-AR). Si más adelante existe
   lib/voice con un proveedor intercambiable, este hook puede delegar ahí. */

import { useCallback, useEffect, useRef, useState } from 'react'

interface RecognitionResult {
  isFinal: boolean
  0: { transcript: string }
}
interface RecognitionEvent {
  resultIndex: number
  results: ArrayLike<RecognitionResult>
}
interface Recognition {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((e: RecognitionEvent) => void) | null
  onend: (() => void) | null
  onerror: ((e: { error: string }) => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

type RecognitionCtor = new () => Recognition

function getCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export function useDictation(onFinal: (text: string) => void) {
  const [supported, setSupported] = useState(false)
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [error, setError] = useState<string | null>(null)
  const rec = useRef<Recognition | null>(null)
  const cb = useRef(onFinal)
  cb.current = onFinal

  useEffect(() => {
    setSupported(Boolean(getCtor()))
    return () => rec.current?.abort()
  }, [])

  const start = useCallback(() => {
    const Ctor = getCtor()
    if (!Ctor || rec.current) return
    const r = new Ctor()
    r.lang = 'es-AR'
    r.continuous = true
    r.interimResults = true
    r.onresult = (e) => {
      let partial = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]
        if (res.isFinal) cb.current(res[0].transcript.trim())
        else partial += res[0].transcript
      }
      setInterim(partial)
    }
    r.onerror = (e) => {
      if (e.error !== 'aborted' && e.error !== 'no-speech') setError(e.error === 'not-allowed' ? 'El navegador no dio permiso para el micrófono' : `Dictado: ${e.error}`)
    }
    r.onend = () => {
      rec.current = null
      setListening(false)
      setInterim('')
    }
    setError(null)
    rec.current = r
    r.start()
    setListening(true)
  }, [])

  const stop = useCallback(() => {
    rec.current?.stop()
  }, [])

  return { supported, listening, interim, error, start, stop, toggle: listening ? stop : start }
}
