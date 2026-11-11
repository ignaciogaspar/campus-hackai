/* Personas (people): quién es quién. Interfaz en hackai/docs/ARQUITECTURA.md.
   Usa el puerto de identidad para el ingreso, el del SIU para los datos de la
   persona y su almacén para los vínculos con cada sistema. Los adaptadores
   nunca adivinan a quién corresponde un id: se lo preguntan a Personas.

   `signIn` y `demoPeople` son del ticket del ingreso de demo (#9). */
import type { IdentityCredential, IdentityPort } from '@/lib/ports/identity'
import type { SiuPort } from '@/lib/ports/siu'
import { fail, notImplemented, ok, type ExternalFailure, type NotImplemented, type Result } from '@/lib/result'

/** Id de una persona en HackAI. No es el id de ningún sistema de origen. */
export type PersonId = string

/** El valor del rol docente en código es 'profesor' (ver GLOSSARY.md). */
export type Role = 'alumno' | 'profesor'

/** Sistemas en los que una persona tiene una cuenta propia. */
export type ExternalSystem = 'identity' | 'siu' | 'moodle' | 'discord'

export type Person = {
  id: PersonId
  name: string
  role: Role
  school: { id: string; name: string }
  programs: { id: string; name: string; status: 'activa' | 'pasiva' }[]
}

export type PeopleError = 'persona-desconocida' | ExternalFailure | NotImplemented

export type People = {
  /** La persona que entra, según el puerto de identidad. */
  signIn(credential: IdentityCredential): Promise<Result<Person, 'credencial-invalida' | PeopleError>>
  /** Personas sintéticas para el ingreso de demo. */
  demoPeople(): Promise<Result<Person[], 'no-soportado' | PeopleError>>
  get(personId: PersonId): Promise<Result<Person, PeopleError>>
  /** Su id en un sistema de origen o canal externo. */
  accountIn(personId: PersonId, system: ExternalSystem): Promise<Result<string, 'sin-cuenta' | PeopleError>>
  /** La persona dueña de ese id externo, o `null`. Se vincula por id, nunca por nombre o mail. */
  byExternalAccount(system: ExternalSystem, externalId: string): Promise<Result<PersonId | null, ExternalFailure | NotImplemented>>
}

/** Sus ids en cada sistema. Un sistema sin entrada es que no tiene cuenta. */
export type PersonAccounts = Partial<Record<ExternalSystem, string>>

/** Almacén de Personas: los vínculos de cada persona con cada sistema. Es un
    seam interno: se inyecta al armar el módulo y no es parte de su interfaz. */
export type PeopleStore = {
  /** Las cuentas de la persona, o `null` si no existe. */
  accountsOf(personId: PersonId): Promise<Result<PersonAccounts | null, ExternalFailure>>
  /** La persona dueña de ese id externo, o `null`. */
  ownerOf(system: ExternalSystem, externalId: string): Promise<Result<PersonId | null, ExternalFailure>>
}

export type PeopleDeps = {
  identity: IdentityPort
  siu: SiuPort
  store: PeopleStore
}

export function createPeople({ siu, store }: PeopleDeps): People {
  async function accountIn(personId: PersonId, system: ExternalSystem): Promise<Result<string, 'sin-cuenta' | PeopleError>> {
    const accounts = await store.accountsOf(personId)
    if (!accounts.ok) return accounts
    if (!accounts.value) return fail('persona-desconocida')
    const id = accounts.value[system]
    return id ? ok(id) : fail('sin-cuenta')
  }

  return {
    signIn: notImplemented,
    demoPeople: notImplemented,

    async get(personId) {
      const siuId = await accountIn(personId, 'siu')
      if (!siuId.ok) return fail(siuId.error === 'sin-cuenta' ? 'persona-desconocida' : siuId.error)
      const found = await siu.person(siuId.value)
      if (!found.ok) return found.error === 'no-encontrado' ? fail('persona-desconocida') : fail(found.error)
      const { names, surname, role, school, programs } = found.value
      return ok({ id: personId, name: `${names} ${surname}`, role, school, programs })
    },

    accountIn,

    async byExternalAccount(system, externalId) {
      return store.ownerOf(system, externalId)
    },
  }
}
