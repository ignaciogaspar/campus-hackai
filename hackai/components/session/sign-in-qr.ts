/* QR del ingreso: la dirección del deploy de HackAI, para abrirla en el
   celular desde la compu donde se proyecta la demo. Apunta siempre al deploy,
   también corriendo en local, porque el celular no abre `localhost`. Se arma en el servidor,
   sin pedirle nada a un servicio externo (ADR 0008). */
import 'server-only'
import QRCode from 'qrcode'

/** Donde está deployada la demo (hackai/README.md, «Deploy en Vercel»). */
const DEPLOY_URL = 'https://campus-hackai.vercel.app/'

/** El QR del deploy como `data:` de un SVG, listo para un `<img>`, con la dirección que lleva. */
export async function signInQr(): Promise<{ image: string; url: string }> {
  const svg = await QRCode.toString(DEPLOY_URL, { type: 'svg', errorCorrectionLevel: 'M', margin: 2 })
  return { image: `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`, url: DEPLOY_URL }
}
