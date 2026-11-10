// ids determinísticos (UUID v5, SHA-1) para seeds idempotentes, y códigos cortos.
import { createHash, randomInt } from 'node:crypto'

/** Namespace propio del campus (uuid fijo). */
export const CAMPUS_NAMESPACE = '6f1c9a52-3d7e-4b8a-9c21-5e0d4f7a8b13'

function uuidToBytes(uuid: string): Buffer {
  return Buffer.from(uuid.replace(/-/g, ''), 'hex')
}

/** UUID v5 de `name` dentro de `namespace` (por defecto el del campus). */
export function uuidv5(name: string, namespace = CAMPUS_NAMESPACE): string {
  const hash = createHash('sha1').update(uuidToBytes(namespace)).update(name, 'utf8').digest()
  const b = Buffer.from(hash.subarray(0, 16))
  b[6] = (b[6] & 0x0f) | 0x50
  b[8] = (b[8] & 0x3f) | 0x80
  const h = b.toString('hex')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

/** id de la slide base importada de mbt: posición 0-based del deck base. */
export const baseSlideId = (deckId: string, position: number) => uuidv5(`slide:${deckId}:${position}`)
/** id de una slide insertada por content/aicm/j<N>.ts (índice en `insertions`). */
export const insertedSlideId = (sessionId: string, index: number) => uuidv5(`slide:${sessionId}:insert:${index}`)
/** id de la persona sembrada (slug estable). */
export const personId = (slug: string) => uuidv5(`person:${slug}`)
/** id de la poll draft de una slide :::encuesta. */
export const slidePollId = (slideId: string) => uuidv5(`poll:${slideId}`)

/** Alfabeto sin ambigüedades (sin 0/O, 1/I/L). */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

/** Código de 6 caracteres para el QR de una clase en vivo. */
export function liveCode(length = 6): string {
  let s = ''
  for (let i = 0; i < length; i++) s += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]
  return s
}
