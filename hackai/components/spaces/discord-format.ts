/* Lo que la pantalla del espacio necesita saber de Discord sin hablar con Discord: leer el canal que pega el
   docente (el enlace de «Copiar enlace» o el ID) y el aviso que muestra al volver de «Conectar con Discord». */

/** Un id de Discord (snowflake): un número de 17 a 20 dígitos. */
const SNOWFLAKE = /^\d{17,20}$/

/** Los hosts de Discord que sirven enlaces de canal: el normal y los de las versiones de prueba. */
const HOSTS = ['discord.com', 'ptb.discord.com', 'canary.discord.com', 'discordapp.com', 'www.discord.com']

/** El id del canal que pegó el docente: el ID solo, o el enlace del canal (`https://discord.com/channels/
    <servidor>/<canal>`, que da «Copiar enlace» sin modo desarrollador). Un enlace a un mensaje
    (`.../<canal>/<mensaje>`) también sirve: se toma el canal. Si no es ninguno de los dos, `null`. */
export function discordChannelIdFrom(input: string): string | null {
  const text = input.trim()
  if (SNOWFLAKE.test(text)) return text
  let url: URL
  try {
    url = new URL(text)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' || !HOSTS.includes(url.hostname)) return null
  const [first, server, channel] = url.pathname.split('/').filter(Boolean)
  if (first !== 'channels' || !server || !channel) return null
  return SNOWFLAKE.test(server) && SNOWFLAKE.test(channel) ? channel : null
}

/** Cómo volvió el docente de «Conectar con Discord», como va en `?discord=` del espacio. */
export const DISCORD_NOTICES = {
  conectado: 'Listo: la materia quedó conectada con tu servidor de Discord y tu cuenta, vinculada con HackAI.',
  cancelado: 'No se conectó: cancelaste la autorización en Discord. Podés volver a intentarlo cuando quieras.',
  'sin-servidor': 'No se conectó: en Discord no elegiste un servidor. Probá de nuevo y elegí el de tu cátedra.',
  'codigo-invalido': 'No se conectó: la autorización de Discord venció o ya se usó. Probá de nuevo.',
  'servidor-inexistente':
    'No se conectó: el bot de HackAI no quedó en ese servidor. Probá de nuevo y dejá marcados sus permisos.',
  'sin-permisos':
    'No se conectó: al bot de HackAI le faltan permisos en ese servidor. Probá de nuevo sin desmarcarlos.',
  'cuenta-en-uso': 'No se conectó: esa cuenta de Discord ya está vinculada con otra persona de HackAI.',
  'no-es-miembro':
    'No se conectó: tu cuenta de Discord no es miembro de ese servidor. Elegí el servidor de tu cátedra.',
  'otro-servidor':
    'No se conectó: la materia ya está conectada con otro servidor de Discord. Al autorizar, elegí ese mismo servidor.',
  'solo-docentes': 'No se conectó: solo los docentes de la materia conectan su Discord.',
  'espacio-desconocido': 'No se conectó: el espacio de la materia ya no existe. Abrilo de nuevo desde Mis materias.',
  'persona-desconocida': 'No se conectó: no encontramos tus datos en el SIU. Salí, volvé a entrar y probá de nuevo.',
  'no-soportado': 'Conectar con Discord no está disponible en esta instalación de HackAI.',
  'falla-externa': 'No se conectó porque Discord o HackAI no respondieron. Probá de nuevo en un rato.',
  'no-configurado': 'Conectar con Discord no está disponible en esta instalación de HackAI.'
} as const

export type DiscordNotice = keyof typeof DISCORD_NOTICES

export function isDiscordNotice(value: string | undefined): value is DiscordNotice {
  return value !== undefined && Object.hasOwn(DISCORD_NOTICES, value)
}
