/* La URL de vuelta de «Conectar con Discord». Tiene que ser la misma al ir y al canjear el código, y estar
   cargada en el Developer Portal (docs/discord.md). Sale de `DISCORD_REDIRECT_URI` o, si no está, del origen
   del pedido, que detrás del hosting se sabe por `x-forwarded-host` y `x-forwarded-proto`. */
import { system } from '@/lib/composition'

export const RETURN_PATH = '/discord/vuelta'

export function redirectUriFor(request: Request): string {
  const fixed = system().discordRedirectUri
  if (fixed) return fixed
  const url = new URL(request.url)
  const host = request.headers.get('x-forwarded-host')?.split(',')[0].trim() || url.host
  const proto = request.headers.get('x-forwarded-proto')?.split(',')[0].trim() || url.protocol.replace(':', '')
  return `${proto}://${host}${RETURN_PATH}`
}

/** El espacio de la materia con el aviso de cómo volvió de Discord. */
export function backToSpace(subjectId: string, notice: string): string {
  return `/materias/${encodeURIComponent(subjectId)}?discord=${encodeURIComponent(notice)}`
}
