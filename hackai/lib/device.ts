/* Si un pedido viene de un celular o una tablet, por su User-Agent. Las cuentas
   reales del SIU se usan solo desde la compu (ADR 0009): en el celular, HackAI
   muestra las personas de la demo. */
const MOBILE = /Android|iPhone|iPad|iPod|Mobile|Windows Phone|webOS|BlackBerry/i

export function isMobileUserAgent(userAgent: string | null | undefined): boolean {
  return MOBILE.test(userAgent ?? '')
}
