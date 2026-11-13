/* Si un pedido viene de un celular o una tablet, por su User-Agent. Las cuentas
   reales del SIU se usan solo desde la compu (ADR 0009): en el celular, HackAI
   muestra las personas de la demo. */
const MOBILE = /Android|iPhone|iPad|iPod|Mobile|Windows Phone|webOS|BlackBerry/i

export function isMobileUserAgent(userAgent: string | null | undefined): boolean {
  return MOBILE.test(userAgent ?? '')
}

/** Si el navegador es el de un iPhone o un iPad, donde la app se instala a mano desde «Compartir». El iPad con
    iPadOS 13 o más se presenta como Mac: se lo reconoce por la pantalla táctil. */
export function isIosDevice(userAgent: string, maxTouchPoints: number): boolean {
  return /iphone|ipad|ipod/i.test(userAgent) || (/macintosh/i.test(userAgent) && maxTouchPoints > 1)
}
