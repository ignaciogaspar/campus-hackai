import assert from 'node:assert/strict'
import { test } from 'node:test'
import { discordChannelIdFrom, isDiscordNotice } from '@/components/spaces/discord-format'

const SERVER = '1300000000000000001'
const CHANNEL = '1301000000000000001'

test('acepta el ID del canal, con espacios alrededor', () => {
  assert.equal(discordChannelIdFrom(CHANNEL), CHANNEL)
  assert.equal(discordChannelIdFrom(`  ${CHANNEL}\n`), CHANNEL)
})

test('acepta el enlace del canal de «Copiar enlace», también de las versiones de prueba de Discord', () => {
  assert.equal(discordChannelIdFrom(`https://discord.com/channels/${SERVER}/${CHANNEL}`), CHANNEL)
  assert.equal(discordChannelIdFrom(`https://ptb.discord.com/channels/${SERVER}/${CHANNEL}`), CHANNEL)
  assert.equal(discordChannelIdFrom(`https://discordapp.com/channels/${SERVER}/${CHANNEL}/`), CHANNEL)
  // El enlace de un mensaje lleva el canal antes del mensaje.
  assert.equal(discordChannelIdFrom(`https://discord.com/channels/${SERVER}/${CHANNEL}/1310000000000000001`), CHANNEL)
})

test('no acepta otra cosa: otro sitio, http, un mensaje directo o un número corto', () => {
  for (const input of [
    '',
    '12345',
    'avisos',
    `https://evil.example/channels/${SERVER}/${CHANNEL}`,
    `http://discord.com/channels/${SERVER}/${CHANNEL}`,
    `https://discord.com/channels/@me/${CHANNEL}`,
    `https://discord.com/channels/${SERVER}`,
    `https://discord.com/invite/${CHANNEL}`
  ]) {
    assert.equal(discordChannelIdFrom(input), null, input)
  }
})

test('solo los avisos conocidos de la vuelta de Discord se muestran', () => {
  assert.ok(isDiscordNotice('conectado'))
  assert.ok(isDiscordNotice('cuenta-en-uso'))
  assert.equal(isDiscordNotice('toString'), false)
  assert.equal(isDiscordNotice('<script>'), false)
  assert.equal(isDiscordNotice(undefined), false)
})
