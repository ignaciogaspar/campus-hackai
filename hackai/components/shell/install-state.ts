/* Si la app se puede instalar, averiguado una vez por carga. Vive afuera del
   botón «Instalar» porque el encabezado se monta de nuevo en cada pantalla: si
   cada botón lo averiguara al montarse aparecería tarde en cada navegación, y
   en Android se perdería, porque el navegador avisa una sola vez
   (`beforeinstallprompt`).

   Del navegador pide solo lo que usa (`InstallBrowser`), así se prueba sin uno
   (tests/install-state.test.ts). */
import { isIosDevice } from '@/lib/device'

export type InstallPrompt = Event & { prompt: () => Promise<void> }

/** `prompt`: el aviso de Android, listo para abrir. `ios`: hay que mostrar los pasos a mano. */
export type Install = { prompt: InstallPrompt | null; ios: boolean }

export type InstallBrowser = {
  /** La app ya está instalada y se abrió desde su ícono. */
  standalone: boolean
  userAgent: string
  maxTouchPoints: number
  /** Avisa cuando el navegador ofrece instalar la app. */
  onInstallPrompt: (listener: (prompt: InstallPrompt) => void) => void
}

/** Sin botón: en el servidor, con la app instalada o en un navegador que no la instala. */
export const HIDDEN: Install = { prompt: null, ios: false }

/** El estado de «Instalar», con la forma que pide `useSyncExternalStore`. Lee el navegador recién con el primer
    `subscribe` (en el servidor no hay) y una sola vez. */
export function createInstallStore(browser: () => InstallBrowser) {
  let install = HIDDEN
  let watching = false
  const listeners = new Set<() => void>()

  const update = (next: Partial<Install>) => {
    install = { ...install, ...next }
    for (const listener of listeners) listener()
  }

  const watch = () => {
    if (watching) return
    watching = true
    const { standalone, userAgent, maxTouchPoints, onInstallPrompt } = browser()
    if (standalone) return
    // Sin avisar: quien se está suscribiendo lee el estado apenas termina, y todavía no hay nadie más.
    if (isIosDevice(userAgent, maxTouchPoints)) install = { ...install, ios: true }
    onInstallPrompt((prompt) => update({ prompt }))
  }

  return {
    subscribe(listener: () => void) {
      listeners.add(listener)
      watch()
      return () => {
        listeners.delete(listener)
      }
    },
    snapshot: () => install,
    /** El aviso de Android se abre una sola vez: usado, ya no sirve. */
    clearPrompt: () => update({ prompt: null })
  }
}
