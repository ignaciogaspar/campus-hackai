// Interfaz de reconocimiento de voz con proveedor intercambiable. Hoy:
// Web Speech API del navegador (web-speech.ts). Mañana: un STT de servidor
// que implemente la misma interfaz (por ejemplo, audio por WebSocket).

export type SpeechStatus = 'idle' | 'starting' | 'listening' | 'error' | 'unsupported'

export interface SpeechResult {
  text: string
  /** true = segmento cerrado (va a la transcripción); false = parcial. */
  isFinal: boolean
}

export interface SpeechProviderEvents {
  onResult: (result: SpeechResult) => void
  onStatus: (status: SpeechStatus, detail?: string) => void
  /** El reconocedor se detuvo del todo (después de stop() o de un error fatal). */
  onStopped?: () => void
}

export interface SpeechProvider {
  readonly name: string
  readonly supported: boolean
  /** Arranca a escuchar en continuo. Si se corta solo, se reinicia hasta stop(). */
  start(): void
  /** Deja de escuchar. Los parciales pendientes se cierran como finales antes de onStopped. */
  stop(): void
  /** Cierra la frase en curso sin dejar de escuchar (se reinicia solo). */
  flush(): void
  readonly running: boolean
  dispose(): void
}

export type SpeechProviderFactory = (lang: string, events: SpeechProviderEvents) => SpeechProvider
