/* La persona real en el ingreso de la demo. Suma un sujeto a la identidad de
   demo y sus vínculos al almacén de Personas, sin tocar los de las personas
   sintéticas: así se entra con la cuenta real desde la misma lista. Los
   vínculos que la persona agrega después (por ejemplo, Discord) quedan en
   memoria mientras corre el proceso. */
import type { PeopleStore, PersonAccounts, PersonId } from '@/lib/core/people'
import type { IdentityPort, IdentitySubject } from '@/lib/ports/identity'
import { fail, ok } from '@/lib/result'

export type RealPerson = {
  personId: PersonId
  subject: IdentitySubject
  accounts: PersonAccounts
}

/** La identidad de demo con la persona real primera en la lista. */
export function withRealSubject(identity: IdentityPort, real: RealPerson): IdentityPort {
  return {
    capabilities: identity.capabilities,
    async verify(credential) {
      if (credential.kind === 'demo' && credential.subject === real.subject.subject) return ok({ ...real.subject })
      return identity.verify(credential)
    },
    async demoSubjects() {
      const others = await identity.demoSubjects()
      return others.ok ? ok([{ ...real.subject }, ...others.value]) : others
    }
  }
}

/** El almacén de Personas con los vínculos de la persona real. */
export function withRealPerson(store: PeopleStore, real: RealPerson): PeopleStore {
  const accounts: PersonAccounts = { ...real.accounts, identity: real.subject.subject }
  return {
    async accountsOf(personId) {
      return personId === real.personId ? ok({ ...accounts }) : store.accountsOf(personId)
    },
    async ownerOf(system, externalId) {
      if (accounts[system] === externalId) return ok(real.personId)
      return store.ownerOf(system, externalId)
    },
    async setAccount(personId, system, externalId) {
      if (personId !== real.personId) {
        if (accounts[system] === externalId) return fail('duplicado')
        return store.setAccount(personId, system, externalId)
      }
      const owner = await store.ownerOf(system, externalId)
      if (!owner.ok) return owner
      if (owner.value) return fail('duplicado')
      accounts[system] = externalId
      return ok(null)
    }
  }
}

/** La persona de HackAI de una cuenta real del SIU, por su clave. */
export const realPersonId = (key: string): PersonId => `p-siu-${key}`
const REAL_PERSON_ID = /^p-siu-([a-f0-9]{12})$/
const REAL_SIU_ID = /^real-([a-f0-9]{12})$/
const REAL_SUBJECT = /^siu-([a-f0-9]{12})$/

/** El almacén de Personas con las personas de las cuentas reales del SIU: cada una con su id del SIU
    (`real-<clave>`) y su sujeto de identidad (`siu-<clave>`). Los vínculos que agrega (Discord) quedan en memoria. */
export function withRealPeople(store: PeopleStore): PeopleStore {
  const extra = new Map<string, PersonAccounts>()
  const accountsFor = (key: string): PersonAccounts => ({
    ...extra.get(key),
    siu: `real-${key}`,
    identity: `siu-${key}`
  })
  const keyOfExternal = (system: string, id: string) =>
    (system === 'siu' ? id.match(REAL_SIU_ID) : system === 'identity' ? id.match(REAL_SUBJECT) : null)?.[1] ?? null

  return {
    async accountsOf(personId) {
      const key = personId.match(REAL_PERSON_ID)?.[1]
      return key ? ok(accountsFor(key)) : store.accountsOf(personId)
    },
    async ownerOf(system, externalId) {
      const key = keyOfExternal(system, externalId)
      if (key) return ok(realPersonId(key))
      for (const [k, accounts] of extra) if (accounts[system] === externalId) return ok(realPersonId(k))
      return store.ownerOf(system, externalId)
    },
    async setAccount(personId, system, externalId) {
      const key = personId.match(REAL_PERSON_ID)?.[1]
      if (!key) return store.setAccount(personId, system, externalId)
      const owner = await store.ownerOf(system, externalId)
      if (!owner.ok) return owner
      if (owner.value) return fail('duplicado')
      extra.set(key, { ...extra.get(key), [system]: externalId })
      return ok(null)
    }
  }
}
