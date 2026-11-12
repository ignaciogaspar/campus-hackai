/* QR del ingreso: la dirección del deploy de HackAI, para abrirla en el
   celular desde la compu donde se proyecta la demo. Apunta siempre al deploy,
   también corriendo en local, porque el celular no abre `localhost`. Se arma en el servidor,
   sin pedirle nada a un servicio externo (ADR 0008). */
import 'server-only'
import QRCode from 'qrcode'

/** Donde está deployada la demo (hackai/README.md, «Deploy en Vercel»). */
export const DEPLOY_URL = 'https://campus-hackai.vercel.app/'

/** El QR como `data:` de un SVG, listo para un `<img>`. */
export async function qrImage(url: string): Promise<string> {
  const svg = await QRCode.toString(url, { type: 'svg', errorCorrectionLevel: 'M', margin: 2 })
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
}
