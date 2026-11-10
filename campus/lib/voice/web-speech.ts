// Proveedor de voz con la Web Speech API (Chrome/Edge: webkitSpeechRecognition).
// Continuo, con parciales y reinicio automático: Chrome corta la sesión cada
// tanto (silencio, red, ~60 s) y acá se vuelve a arrancar hasta stop().
import type { SpeechProvider, SpeechProviderEvents } from './types'

/* Tipos mínimos: lib.dom no trae SpeechRecognition. */
interface RecognitionAlternative { transcript: string }
interface RecognitionResult { isFinal: boolean; length: number; [i: number]: RecognitionAlternative }
interface RecognitionEvent { resultIndex: number; results: { length: number; [i: number]: RecognitionResult } }
interface RecognitionErrorEvent { error: string; message?: string }
interface Recognition {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  onresult: ((e: RecognitionEvent) => void) | null
  onerror: ((e: RecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  onstart: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}
type RecognitionCtor = new () => Recognition

function ctor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export function webSpeechSupported(): boolean {
  return ctor() !== null
}

const FATAL = new Set(['not-allowed', 'service-not-allowed', 'audio-capture', 'language-not-supported'])

export function createWebSpeechProvider(lang: string, events: SpeechProviderEvents): SpeechProvider {
  const Ctor = ctor()
  let rec: Recognition | null = null
  let want = false
  let active = false
  let interim = ''
  let restarts: number[] = []
  let restartTimer: ReturnType<typeof setTimeout> | null = null

  const emitPendingAsFinal = () => {
    const text = interim.trim()
    interim = ''
    if (text) events.onResult({ text, isFinal: true })
  }

  const build = (): Recognition | null => {
    if (!Ctor) return null
    const r = new Ctor()
    r.lang = lang
    r.continuous = true
    r.interimResults = true
    r.maxAlternatives = 1
    r.onstart = () => {
      active = true
      events.onStatus('listening')
    }
    r.onresult = (e) => {
      let partial = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]
        const text = res[0]?.transcript ?? ''
        if (res.isFinal) {
          interim = ''
          if (text.trim()) events.onResult({ text: text.trim(), isFinal: true })
        } else {
          partial += text
        }
      }
      if (partial) {
        interim = partial
        events.onResult({ text: partial.trim(), isFinal: false })
      }
    }
    r.onerror = (e) => {
      if (FATAL.has(e.error)) {
        want = false
        events.onStatus('error', e.error === 'not-allowed' ? 'El navegador no dio permiso para usar el micrófono.' : `Micrófono: ${e.error}`)
      }
      // no-speech, aborted, network: onend reinicia
    }
    r.onend = () => {
      active = false
      emitPendingAsFinal()
      if (want) scheduleRestart()
      else {
        events.onStatus('idle')
        events.onStopped?.()
      }
    }
    return r
  }

  const scheduleRestart = () => {
    const now = Date.now()
    restarts = restarts.filter((t) => now - t < 10_000)
    restarts.push(now)
    // si se corta muchas veces seguidas, esperá un poco más
    const delay = restarts.length > 5 ? 1500 : 120
    if (restartTimer) clearTimeout(restartTimer)
    restartTimer = setTimeout(() => {
      restartTimer = null
      if (!want) return
      try {
        rec = rec ?? build()
        rec?.start()
      } catch {
        // InvalidStateError: ya estaba arrancado
      }
    }, delay)
  }

  return {
    name: 'web-speech',
    supported: Boolean(Ctor),
    get running() {
      return want
    },
    start() {
      if (!Ctor) {
        events.onStatus('unsupported', 'Este navegador no reconoce voz (usá Chrome o Edge).')
        return
      }
      if (want && active) return
      want = true
      events.onStatus('starting')
      rec = rec ?? build()
      try {
        rec?.start()
      } catch {
        // ya estaba escuchando
      }
    },
    stop() {
      want = false
      if (restartTimer) clearTimeout(restartTimer)
      if (rec && active) rec.stop()
      else {
        emitPendingAsFinal()
        events.onStatus('idle')
        events.onStopped?.()
      }
    },
    flush() {
      // stop() cierra la frase en curso como final; onend reinicia porque want sigue en true
      if (rec && active) rec.stop()
      else emitPendingAsFinal()
    },
    dispose() {
      want = false
      if (restartTimer) clearTimeout(restartTimer)
      if (rec) {
        rec.onend = null
        rec.onresult = null
        rec.onerror = null
        try {
          rec.abort()
        } catch {
          // nada
        }
      }
      rec = null
    },
  }
}
