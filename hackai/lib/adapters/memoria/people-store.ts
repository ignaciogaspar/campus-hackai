/* Almacén de Personas en memoria: los vínculos de cada persona del set
   sintético con su sujeto de identidad y sus ids del SIU, de Moodle y de
   Discord. */
import type { SyntheticData } from '@/lib/adapters/synthetic-data'
import type { PeopleStore, PersonAccounts } from '@/lib/core/people'
import { fail, ok } from '@/lib/result'

export function createMemoryPeopleStore(data: SyntheticData): PeopleStore {
  const links = new Map<string, PersonAccounts>(
    data.people.map((p) => {
      const accounts: PersonAccounts = { identity: p.identitySubject, siu: p.siuId, moodle: p.moodleId }
      if (p.discordId) accounts.discord = p.discordId
      return [p.id, accounts]
    })
  )

  return {
    async accountsOf(personId) {
      const accounts = links.get(personId)
      return ok(accounts ? { ...accounts } : null)
    },

    async ownerOf(system, externalId) {
      for (const [personId, accounts] of links) {
        if (accounts[system] === externalId) return ok(personId)
      }
      return ok(null)
    },

    async setAccount(personId, system, externalId) {
      for (const [other, accounts] of links) {
        if (other !== personId && accounts[system] === externalId) return fail('duplicado')
      }
      links.set(personId, { ...links.get(personId), [system]: externalId })
      return ok(null)
    }
  }
}
