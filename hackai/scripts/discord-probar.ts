/* Prueba manual del adaptador de Discord contra el servidor del equipo.
   Lee el canal, baja el último adjunto que encuentre, publica un mensaje,
   le responde en un hilo y relee desde el cursor. Arma el adaptador con
   composition, igual que la app con HACKAI_EXTERNAL_CHANNEL=discord.
   Guía: docs/discord.md.

     npm run discord:probar -- <id-del-canal>
     npm run discord:probar -- <id-del-canal> --solo-leer

   Toma DISCORD_BOT_TOKEN de .env.local. Imprime ids y resultados, nunca el
   texto de los mensajes ni el token. */
import { compose } from '@/lib/composition'

async function main() {
  const [channelId, flag] = process.argv.slice(2)
  if (!channelId || !/^\d+$/.test(channelId)) {
    console.error('Uso: npm run discord:probar -- <id-del-canal> [--solo-leer]')
    process.exit(1)
  }
  if (!process.env.DISCORD_BOT_TOKEN?.trim()) {
    console.error('Falta DISCORD_BOT_TOKEN en hackai/.env.local (guía: docs/discord.md)')
    process.exit(1)
  }

  const discord = compose({ ...process.env, HACKAI_EXTERNAL_CHANNEL: 'discord' }).ports.externalChannel

  const page = await discord.read(channelId, null)
  if (!page.ok) return stop('leer', page.error)
  console.log(`Leídos ${page.value.messages.length} mensajes; cursor ${page.value.cursor}`)
  for (const m of page.value.messages.slice(-10)) {
    console.log(`  ${m.id}  autor ${m.author.id}${m.author.isBot ? ' (bot)' : ''}${m.viaWebhook ? ' (webhook)' : ''}  ${m.text.length} caracteres  ${m.attachments.length} adjuntos  hilo ${m.threadId ?? '-'}`)
  }
  if (page.value.messages.length > 0 && page.value.messages.every((m) => m.text === '' && m.attachments.length === 0)) {
    console.warn('Todos los mensajes llegaron vacíos: falta activar el intent Message Content del bot.')
  }

  const attachment = page.value.messages.flatMap((m) => m.attachments).at(-1)
  if (attachment) {
    const file = await discord.download(attachment)
    console.log(file.ok ? `Adjunto ${attachment.id} bajado: ${file.value.bytes.byteLength} bytes` : `Adjunto ${attachment.id}: ${file.error}`)
  }

  if (flag === '--solo-leer') return

  const stamp = new Date().toISOString()
  const posted = await discord.post(channelId, `Prueba de HackAI (${stamp})`)
  if (!posted.ok) return stop('publicar', posted.error)
  console.log(`Publicado ${posted.value.id}`)

  const reply = await discord.reply(channelId, posted.value.id, 'Respuesta en hilo desde HackAI')
  if (!reply.ok) return stop('responder', reply.error)
  console.log(`Respondido ${reply.value.id} en el hilo ${reply.value.threadId}`)

  const next = await discord.read(channelId, page.value.cursor)
  if (!next.ok) return stop('releer', next.error)
  const ids = next.value.messages.map((m) => m.id)
  const both = ids.includes(posted.value.id) && ids.includes(reply.value.id)
  console.log(both
    ? `Releer desde el cursor trae el mensaje y la respuesta: OK (${ids.length} mensajes nuevos en total)`
    : `Releer desde el cursor trajo ${ids.join(', ') || 'nada'}`)
  if (!both) process.exitCode = 1
}

function stop(step: string, error: string) {
  console.error(`No se pudo ${step}: ${error}`)
  process.exitCode = 1
}

main()
