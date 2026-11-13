/* Un valor cifrado para una cookie solo del servidor: AES-256-GCM con una
   clave derivada de SESSION_SECRET y del uso (`purpose`), así una cookie de un
   uso no abre como la de otro. Lo usan la sesión del SIU (lib/siu-session.ts)
   y la del Campus (lib/campus-session.ts). Una cookie tocada, de otro uso o
   con otro secreto no abre: `null`. */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

export function sessionSecret(): string {
  const value = process.env.SESSION_SECRET
  if (!value) throw new Error('Falta SESSION_SECRET')
  return value
}

const cipherKey = (purpose: string) => createHash('sha256').update(`${purpose}|${sessionSecret()}`).digest()

export function seal(purpose: string, value: unknown): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', cipherKey(purpose), iv)
  const body = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()])
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64url')
}

export function unseal(purpose: string, sealed: string | undefined): unknown {
  if (!sealed) return null
  try {
    const raw = Buffer.from(sealed, 'base64url')
    const decipher = createDecipheriv('aes-256-gcm', cipherKey(purpose), raw.subarray(0, 12))
    decipher.setAuthTag(raw.subarray(12, 28))
    return JSON.parse(Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8'))
  } catch {
    return null
  }
}
