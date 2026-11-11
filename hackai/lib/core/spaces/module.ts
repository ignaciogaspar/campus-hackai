/* Implementación de Espacios. Se importa solo desde ./index.ts: desde afuera
   del módulo se usa su interfaz. */
import { fail, notImplemented } from '@/lib/result'
import type { Spaces, SpacesDeps } from '.'

export function createSpacesModule(_deps: SpacesDeps): Spaces {
  const pending = async () => fail('falla-externa' as const)
  return {
    open: pending,
    channel: pending,
    post: pending,
    resolve: pending,
    createChannel: pending,
    addMaterial: pending,
    organizeMaterial: pending,
    openDirect: notImplemented,
    link: notImplemented,
    syncAll: notImplemented,
    unreadFor: pending
  }
}
