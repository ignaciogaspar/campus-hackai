/* Batería de contrato del puerto de canal externo: corre igual contra el
   adaptador en memoria y contra el de Discord. Al de Discord se le inyecta un
   `fetch` falso con la forma de su API, sin red. Los dos arrancan con los
   canales del set sintético, que traen un mensaje con adjunto, uno publicado
   por webhook y una respuesta en un hilo. */
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { createDiscordExternalChannel } from '@/lib/adapters/discord/external-channel'
import { createFixedClock } from '@/lib/adapters/memoria/clock'
import { createMemoryExternalChannel } from '@/lib/adapters/memoria/external-channel'
import { syntheticData } from '@/lib/adapters/synthetic-data'
import type { ExternalAttachment, ExternalChannelPort } from '@/lib/ports/external-channel'
import { createFakeDiscord, seedFromSynthetic } from '@/tests/contracts/fake-discord'

type Harness = {
  port: ExternalChannelPort
  /** La próxima request responde 429. El adaptador en memoria no tiene límites: no hace nada. */
  throttleNext(): void
}

const [avisos, consultas, material] = syntheticData.discord.channels
const UNKNOWN_CHANNEL = '1309999999999999999'

/** Un adjunto cuya URL ya venció. */
const expired = (a: ExternalAttachment): ExternalAttachment => ({ ...a, url: `${a.url}&vencido=1` })

function contract(name: string, setup: () => Harness) {
  describe(`contrato del canal externo: ${name}`, () => {
    test('se lee desde un cursor y declara que soporta hilos', () => {
      assert.deepEqual(setup().port.capabilities, { delivery: 'cursor', threads: true })
    })

    test('leer desde el principio devuelve cada mensaje con su autor, texto, adjuntos e hilo, del más viejo al más nuevo', async () => {
      const { port } = setup()
      for (const channel of [avisos, consultas, material]) {
        const page = await port.read(channel.id, null)
        assert.ok(page.ok, channel.name)
        assert.deepEqual(page.value.messages, channel.messages)
        assert.equal(page.value.cursor, channel.messages.at(-1)!.id)
      }
    })

    test('un mensaje publicado por webhook se marca como tal', async () => {
      const page = await setup().port.read(avisos.id, null)
      assert.ok(page.ok)
      const viaWebhook = page.value.messages.filter((m) => m.viaWebhook)
      assert.equal(viaWebhook.length, 1)
      assert.equal(viaWebhook[0].author.isBot, true)
    })

    test('un adjunto se baja mientras su enlace está vigente', async () => {
      const { port } = setup()
      const page = await port.read(material.id, null)
      assert.ok(page.ok)
      const attachment = page.value.messages[0].attachments[0]

      const downloaded = await port.download(attachment)
      assert.ok(downloaded.ok)
      assert.equal(downloaded.value.filename, 'resumen-derivadas.pdf')
      assert.equal(downloaded.value.contentType, 'application/pdf')
      assert.equal(new TextDecoder().decode(downloaded.value.bytes), syntheticData.discord.files[attachment.url])

      assert.deepEqual(await port.download(expired(attachment)), { ok: false, error: 'adjunto-vencido' })
    })

    test('lo publicado aparece una sola vez al leer desde el cursor', async () => {
      const { port } = setup()
      const first = await port.read(avisos.id, null)
      assert.ok(first.ok)

      const posted = await port.post(avisos.id, 'Aviso desde HackAI')
      assert.ok(posted.ok)
      assert.equal(posted.value.channelId, avisos.id)
      assert.equal(posted.value.threadId, null)
      assert.equal(posted.value.author.isBot, true)

      const second = await port.read(avisos.id, first.value.cursor)
      assert.ok(second.ok)
      assert.deepEqual(second.value.messages.map((m) => [m.id, m.text]), [[posted.value.id, 'Aviso desde HackAI']])
      assert.equal(second.value.cursor, posted.value.id)

      const third = await port.read(avisos.id, second.value.cursor)
      assert.deepEqual(third, { ok: true, value: { messages: [], cursor: posted.value.id } })
    })

    test('responder en un hilo existente o en uno nuevo devuelve el mensaje con su hilo', async () => {
      const { port } = setup()
      const first = await port.read(consultas.id, null)
      assert.ok(first.ok)
      const question = consultas.messages[0]

      const inExisting = await port.reply(consultas.id, question.id, 'Gracias, profe')
      assert.ok(inExisting.ok)
      assert.equal(inExisting.value.threadId, question.id)
      assert.equal(inExisting.value.channelId, consultas.id)

      const posted = await port.post(consultas.id, '¿Hay clase de consulta el viernes?')
      assert.ok(posted.ok)
      const inNew = await port.reply(consultas.id, posted.value.id, 'Sí, a las 18')
      assert.ok(inNew.ok)
      assert.equal(inNew.value.threadId, posted.value.id)

      const next = await port.read(consultas.id, first.value.cursor)
      assert.ok(next.ok)
      assert.deepEqual(next.value.messages.map((m) => [m.text, m.threadId, m.channelId]), [
        ['Gracias, profe', question.id, consultas.id],
        ['¿Hay clase de consulta el viernes?', null, consultas.id],
        ['Sí, a las 18', posted.value.id, consultas.id],
      ])
    })

    test('un canal o un mensaje que no existe vuelve como error', async () => {
      const { port } = setup()
      assert.deepEqual(await port.read(UNKNOWN_CHANNEL, null), { ok: false, error: 'canal-inexistente' })
      assert.deepEqual(await port.post(UNKNOWN_CHANNEL, 'hola'), { ok: false, error: 'canal-inexistente' })
      assert.deepEqual(await port.reply(UNKNOWN_CHANNEL, '1310000000000000001', 'hola'), { ok: false, error: 'canal-inexistente' })
      assert.deepEqual(await port.reply(avisos.id, '1319999999999999999', 'hola'), { ok: false, error: 'mensaje-inexistente' })
    })

    test('un 429 no corta la lectura', async () => {
      const harness = setup()
      harness.throttleNext()
      const page = await harness.port.read(avisos.id, null)
      assert.ok(page.ok)
      assert.deepEqual(page.value.messages, avisos.messages)
    })
  })
}

contract('memoria', () => ({
  port: createMemoryExternalChannel(syntheticData, createFixedClock(syntheticData.now)),
  throttleNext() {},
}))

contract('Discord', () => {
  const fake = createFakeDiscord()
  seedFromSynthetic(fake, syntheticData.discord.channels, syntheticData.discord.files)
  return {
    port: createDiscordExternalChannel({ token: 'token-de-prueba', fetch: fake.fetch, sleep: async () => {} }),
    throttleNext: () => fake.throttle(1, 0.5),
  }
})
