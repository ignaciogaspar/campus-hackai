/* Almacén de Espacios en memoria. Arranca vacío: los espacios se crean la
   primera vez que alguien los abre. Se porta como el de Supabase y pasa la
   misma batería de contrato (tests/contracts/spaces-store.test.ts). */
import type {
  ChannelScope,
  SpacesStore,
  StoredChannel,
  StoredMaterial,
  StoredMessage,
  StoredSpace
} from '@/lib/core/spaces'
import { fail, ok } from '@/lib/result'

/** La clave del alcance de un canal: los nombres no se repiten dentro de un mismo alcance. */
function scopeKey(scope: ChannelScope): string {
  if (scope.kind === 'comision') return `comision:${scope.sectionId}`
  if (scope.kind === 'directo') return `directo:${[...scope.personIds].sort().join(':')}`
  return 'materia'
}

export function createMemorySpacesStore(): SpacesStore {
  const spaces: StoredSpace[] = []
  const channels: StoredChannel[] = []
  const messages: StoredMessage[] = []
  const material: StoredMaterial[] = []
  /** Por persona y canal, hasta qué `seq` leyó. */
  const reads = new Map<string, number>()
  const counters = { space: 0, channel: 0, message: 0, material: 0 }

  const copy = <T>(value: T): T => structuredClone(value)
  const readKey = (personId: string, channelId: string) => `${personId}\u0000${channelId}`

  return {
    async spacesFor(keys) {
      return ok(copy(spaces.filter((s) => keys.some((k) => k.subjectId === s.subjectId && k.schoolId === s.schoolId))))
    },

    async space(spaceId) {
      const found = spaces.find((s) => s.id === spaceId)
      return ok(found ? copy(found) : null)
    },

    async createSpace(space) {
      const existing = spaces.find((s) => s.subjectId === space.subjectId && s.schoolId === space.schoolId)
      if (existing) return ok(copy(existing))
      counters.space += 1
      const created: StoredSpace = { ...copy(space), id: `sp-${counters.space}` }
      spaces.push(created)
      return ok(copy(created))
    },

    async setMaterialLayout(spaceId, layout) {
      const found = spaces.find((s) => s.id === spaceId)
      if (!found) return ok(null)
      found.materialLayout = layout
      return ok(copy(found))
    },

    async channels(spaceIds) {
      return ok(copy(channels.filter((c) => spaceIds.includes(c.spaceId))))
    },

    async channel(channelId) {
      const found = channels.find((c) => c.id === channelId)
      return ok(found ? copy(found) : null)
    },

    async createChannel(channel) {
      const key = scopeKey(channel.scope)
      const taken = channels.some(
        (c) => c.spaceId === channel.spaceId && scopeKey(c.scope) === key && c.name === channel.name
      )
      if (taken) return fail('duplicado')
      counters.channel += 1
      const created: StoredChannel = { ...copy(channel), id: `ch-${counters.channel}` }
      channels.push(created)
      return ok(copy(created))
    },

    async messages(channelIds) {
      return ok(copy(messages.filter((m) => channelIds.includes(m.channelId))))
    },

    async message(messageId) {
      const found = messages.find((m) => m.id === messageId)
      return ok(found ? copy(found) : null)
    },

    async addMessage(message) {
      if (
        message.externalId !== null &&
        messages.some((m) => m.channelId === message.channelId && m.externalId === message.externalId)
      ) {
        return fail('duplicado')
      }
      counters.message += 1
      const created: StoredMessage = { ...copy(message), id: `m-${counters.message}`, seq: counters.message }
      messages.push(created)
      return ok(copy(created))
    },

    async setResolved(messageId, resolved) {
      const found = messages.find((m) => m.id === messageId)
      if (!found) return ok(null)
      found.resolved = resolved
      return ok(copy(found))
    },

    async material(spaceIds) {
      return ok(copy(material.filter((m) => spaceIds.includes(m.spaceId))))
    },

    async addMaterial(item) {
      if (
        item.externalId !== null &&
        material.some((m) => m.spaceId === item.spaceId && m.origin === item.origin && m.externalId === item.externalId)
      ) {
        return fail('duplicado')
      }
      counters.material += 1
      const created: StoredMaterial = { ...copy(item), id: `mat-${counters.material}`, seq: counters.material }
      material.push(created)
      return ok(copy(created))
    },

    async fileOwner(fileId) {
      const item = material.find((m) => m.fileId === fileId)
      if (item) return ok({ kind: 'material', spaceId: item.spaceId })
      const message = messages.find((m) => m.attachments.some((a) => a.fileId === fileId))
      return ok(message ? { kind: 'adjunto', channelId: message.channelId } : null)
    },

    async readMarks(personId, channelIds) {
      const marks: Record<string, number> = {}
      for (const channelId of channelIds) {
        const seq = reads.get(readKey(personId, channelId))
        if (seq !== undefined) marks[channelId] = seq
      }
      return ok(marks)
    },

    async markRead(personId, channelId, seq) {
      // De un canal que no existe no queda marca; de uno abierto vacío, sí (hasta 0).
      if (!channels.some((c) => c.id === channelId)) return ok(null)
      const key = readKey(personId, channelId)
      const current = reads.get(key)
      if (current === undefined || seq > current) reads.set(key, seq)
      return ok(null)
    }
  }
}
