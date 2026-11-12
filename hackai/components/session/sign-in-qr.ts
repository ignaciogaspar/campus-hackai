/* QR del ingreso: la dirección de la propia HackAI, para abrirla en el
   celular desde la compu donde se proyecta la demo. Se arma en el servidor,
   sin pedirle nada a un servicio externo (ADR 0008). */
import 'server-only'
import QRCode from 'qrcode'

/** El QR como `data:` de un SVG, listo para un `<img>`. */
export async function qrImage(url: string): Promise<string> {
  const svg = await QRCode.toString(url, { type: 'svg', errorCorrectionLevel: 'M', margin: 2 })
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
}
