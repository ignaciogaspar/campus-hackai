// Voz de la clase en vivo: interfaz de proveedor + Web Speech + hook.
export type { SpeechProvider, SpeechProviderEvents, SpeechProviderFactory, SpeechResult, SpeechStatus } from './types'
export { createWebSpeechProvider, webSpeechSupported } from './web-speech'
export { useVoice } from './useVoice'
export type { CommandPhase, UseVoiceOptions, VoiceState } from './useVoice'
