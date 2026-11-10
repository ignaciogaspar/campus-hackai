'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { SpeechProvider, SpeechProviderFactory, SpeechStatus } from './types'
import { createWebSpeechProvider } from './web-speech'

/* Un único reconocedor para toda la clase:
   - con la transcripción encendida escucha siempre y cada frase final va a
     onSegment(text, false);
   - mientras el botón del agente está apretado, las frases finales se marcan
     como orden (onSegment(text, true)) y al soltar se juntan y van a onCommand. */

export type CommandPhase = 'idle' | 'listening' | 'closing'

export interface UseVoiceOptions {
  transcribing: boolean
  onSegment: (text: string, isCommand: boolean) => void
  onCommand: (text: string) => void
  lang?: string
  provider?: SpeechProviderFactory
}

export interface VoiceState {
  supported: boolean
  status: SpeechStatus
  error: string | null
  /** Texto parcial de la frase en curso. */
  partial: string
  /** Lo que va de la orden actual (finales ya cerrados). */
  commandText: string
  phase: CommandPhase
  startCommand: () => void
  endCommand: () => void
  toggleCommand: () => void
  cancelCommand: () => void
}

const SETTLE_MS = 450
const MAX_WAIT_MS = 1800

export function useVoice({ transcribing, onSegment, onCommand, lang = 'es-AR', provider = createWebSpeechProvider }: UseVoiceOptions): VoiceState {
  const [status, setStatus] = useState<SpeechStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [partial, setPartial] = useState('')
  const [commandText, setCommandText] = useState('')
  const [phase, setPhase] = useState<CommandPhase>('idle')
  const [supported, setSupported] = useState(true)

  const phaseRef = useRef<CommandPhase>('idle')
  const bufferRef = useRef<string[]>([])
  const partialRef = useRef('')
  const transcribingRef = useRef(transcribing)
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const capTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** Corte al apretar M: el próximo final es la frase que venía de antes (clase, no orden). */
  const preCutRef = useRef(false)
  const preCutTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cbs = useRef({ onSegment, onCommand })
  cbs.current = { onSegment, onCommand }
  const providerRef = useRef<SpeechProvider | null>(null)

  const setPhaseBoth = (p: CommandPhase) => {
    phaseRef.current = p
    setPhase(p)
  }

  const clearTimers = () => {
    if (settleTimer.current) clearTimeout(settleTimer.current)
    if (capTimer.current) clearTimeout(capTimer.current)
    settleTimer.current = null
    capTimer.current = null
  }

  const finishCommand = useCallback(() => {
    clearTimers()
    if (phaseRef.current !== 'closing') return
    const parts = [...bufferRef.current]
    // si no llegó el final, usá el parcial
    if (!parts.length && partialRef.current.trim()) {
      parts.push(partialRef.current.trim())
      cbs.current.onSegment(partialRef.current.trim(), true)
    }
    bufferRef.current = []
    partialRef.current = ''
    setPartial('')
    setCommandText('')
    setPhaseBoth('idle')
    if (!transcribingRef.current) providerRef.current?.stop()
    const text = parts.join(' ').replace(/\s+/g, ' ').trim()
    if (text) cbs.current.onCommand(text)
  }, [])

  useEffect(() => {
    const p = provider(lang, {
      onResult: ({ text, isFinal }) => {
        if (!isFinal) {
          partialRef.current = text
          setPartial(text)
          return
        }
        partialRef.current = ''
        setPartial('')
        // la frase que estaba en curso al apretar M se cerró: es transcripción, no orden
        const preCut = preCutRef.current
        if (preCut) {
          preCutRef.current = false
          if (preCutTimer.current) clearTimeout(preCutTimer.current)
          preCutTimer.current = null
        }
        const isCommand = phaseRef.current !== 'idle' && !preCut
        if (isCommand) {
          bufferRef.current.push(text)
          setCommandText(bufferRef.current.join(' '))
        }
        if (isCommand || transcribingRef.current) cbs.current.onSegment(text, isCommand)
        if (phaseRef.current === 'closing') {
          if (settleTimer.current) clearTimeout(settleTimer.current)
          settleTimer.current = setTimeout(finishCommand, SETTLE_MS)
        }
      },
      onStatus: (s, detail) => {
        setStatus(s)
        if (s === 'error' || s === 'unsupported') {
          setError(detail ?? 'No se pudo usar el micrófono.')
          if (phaseRef.current !== 'idle') {
            setPhaseBoth('closing')
            finishCommand()
          }
        } else if (s === 'listening') setError(null)
      },
      onStopped: () => {
        if (phaseRef.current === 'closing') {
          if (settleTimer.current) clearTimeout(settleTimer.current)
          settleTimer.current = setTimeout(finishCommand, 80)
        }
      },
    })
    providerRef.current = p
    setSupported(p.supported)
    if (!p.supported) setStatus('unsupported')
    return () => {
      clearTimers()
      p.dispose()
      providerRef.current = null
    }
  }, [provider, lang, finishCommand])

  // transcripción continua
  useEffect(() => {
    transcribingRef.current = transcribing
    const p = providerRef.current
    if (!p || !p.supported) return
    if (transcribing && !p.running) p.start()
    if (!transcribing && p.running && phaseRef.current === 'idle') p.stop()
  }, [transcribing])

  const startCommand = useCallback(() => {
    const p = providerRef.current
    if (!p || !p.supported) {
      setError('Este navegador no reconoce voz: usá Chrome o Edge, o escribí la orden.')
      return
    }
    if (phaseRef.current === 'listening') return
    clearTimers()
    bufferRef.current = []
    setCommandText('')
    // Si había una frase de la clase a medio reconocer, cerrala ahora: así no
    // se pega a la orden (Chrome junta lo de antes y después si no hubo pausa).
    if (p.running && partialRef.current.trim()) {
      preCutRef.current = true
      if (preCutTimer.current) clearTimeout(preCutTimer.current)
      preCutTimer.current = setTimeout(() => { preCutRef.current = false; preCutTimer.current = null }, 1500)
      p.flush()
      partialRef.current = ''
      setPartial('')
    }
    setPhaseBoth('listening')
    if (!p.running) p.start()
  }, [])

  const endCommand = useCallback(() => {
    if (phaseRef.current !== 'listening') return
    setPhaseBoth('closing')
    const p = providerRef.current
    if (!p) return finishCommand()
    // cerrá la frase en curso; si no hay transcripción, apagá el micrófono
    if (transcribingRef.current) p.flush()
    else p.stop()
    capTimer.current = setTimeout(finishCommand, MAX_WAIT_MS)
    if (!partialRef.current && bufferRef.current.length) settleTimer.current = setTimeout(finishCommand, SETTLE_MS)
  }, [finishCommand])

  const toggleCommand = useCallback(() => {
    if (phaseRef.current === 'listening') endCommand()
    else if (phaseRef.current === 'idle') startCommand()
  }, [startCommand, endCommand])

  const cancelCommand = useCallback(() => {
    clearTimers()
    bufferRef.current = []
    partialRef.current = ''
    setPartial('')
    setCommandText('')
    setPhaseBoth('idle')
    if (!transcribingRef.current) providerRef.current?.stop()
  }, [])

  return { supported, status, error, partial, commandText, phase, startCommand, endCommand, toggleCommand, cancelCommand }
}
