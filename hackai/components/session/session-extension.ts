/* Habla con la extensión de HackAI (ADR 0011). Al pedirle «iniciar», la extensión abre el login de la Austral si
   hace falta, espera a que la persona entre y devuelve las cookies de sesión del SIU y del Campus. La página
   pregunta por `window.postMessage` y el content script contesta con el mismo `id`. */

export type Site = 'siu' | 'campus'
/** Los valores de las sesiones, o `null` la que no se pudo iniciar. */
export type ExtensionSessions = { siu: string | null; campus: string | null }

/** Lo que tarda como mucho en entrar con Microsoft: la extensión espera cinco minutos, y acá un poco más. */
const SIGN_IN_TIMEOUT_MS = 5.5 * 60 * 1000

/** El atributo que el content script pone en `<html>` apenas carga la página. */
export const hasSessionExtension = (): boolean =>
  typeof document !== 'undefined' && document.documentElement.dataset.hackaiExtension === '1'

const text = (value: unknown): string | null => (typeof value === 'string' && value ? value : null)

/** La respuesta de la extensión al pedido `id`, `null` si no pudo, o `undefined` si el mensaje no es esa respuesta. */
export function readAnswer(data: unknown, id: string): ExtensionSessions | null | undefined {
  if (typeof data !== 'object' || data === null) return undefined
  const message = data as Record<string, unknown>
  if (message.source !== 'hackai-extension' || message.type !== 'iniciar' || message.id !== id) return undefined
  if (message.error) return null
  return { siu: text(message.siu), campus: text(message.campus) }
}

/** Inicia sesión en los sitios pedidos y devuelve sus cookies, o `null` sin extensión o si no respondió. */
export function signInWithExtension(sites: Site[]): Promise<ExtensionSessions | null> {
  if (typeof window === 'undefined' || !hasSessionExtension()) return Promise.resolve(null)
  const id = crypto.randomUUID()
  return new Promise((resolve) => {
    const done = (value: ExtensionSessions | null) => {
      window.removeEventListener('message', listen)
      clearTimeout(timer)
      resolve(value)
    }
    const listen = (event: MessageEvent) => {
      if (event.source !== window || event.origin !== window.location.origin) return
      const answer = readAnswer(event.data, id)
      if (answer !== undefined) done(answer)
    }
    const timer = setTimeout(() => done(null), SIGN_IN_TIMEOUT_MS)
    window.addEventListener('message', listen)
    window.postMessage({ source: 'hackai', type: 'iniciar', id, sites }, window.location.origin)
  })
}
