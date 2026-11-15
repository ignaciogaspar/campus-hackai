/* Puente entre la página de HackAI y la extensión (ADR 0011). La página pide «iniciar» por `window.postMessage` y
   este script le contesta con lo que devuelve el service worker. Solo atiende mensajes de la misma ventana y del
   mismo origen. */
document.documentElement.dataset.hackaiExtension = '1'

window.addEventListener('message', (event) => {
  if (event.source !== window || event.origin !== window.location.origin) return
  const { source, type, id, sites } = event.data ?? {}
  if (source !== 'hackai' || type !== 'iniciar') return
  chrome.runtime.sendMessage({ type, sites }, (answer) => {
    const failed = chrome.runtime.lastError || !answer
    window.postMessage(
      { source: 'hackai-extension', type, id, ...(failed ? { error: 'sin-respuesta' } : answer) },
      window.location.origin
    )
  })
})
