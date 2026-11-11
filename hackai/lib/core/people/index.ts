/* Personas (people): quién es quién. Interfaz en hackai/docs/ARQUITECTURA.md.
   Usa el puerto de identidad para el ingreso, el del SIU para los datos de la
   persona y su almacén para los vínculos con cada sistema. Los adaptadores
   nunca adivinan a quién corresponde un id: se lo preguntan a Personas. */
import type { IdentityCredential, IdentityPort } from '@/lib/ports/identity'
import type { SiuPort } from '@/lib/ports/siu'
import { all, fail, ok, type ExternalFailure, type Result } from '@/lib/result'

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

export type PeopleError = 'persona-desconocida' | ExternalFailure

export type People = {
  /** La persona que entra, según el puerto de identidad. Una credencial que la
      identidad no reconoce o no sabe validar es `credencial-invalida`; un sujeto
      válido sin persona vinculada, `persona-desconocida`. */
  signIn(credential: IdentityCredential): Promise<Result<Person, 'credencial-invalida' | PeopleError>>
  /** Personas sintéticas para el ingreso de demo, en el orden de la identidad.
      Con una identidad sin lista de demo devuelve `no-soportado`. */
  demoPeople(): Promise<Result<Person[], 'no-soportado' | PeopleError>>
  get(personId: PersonId): Promise<Result<Person, PeopleError>>
  /** Su id en un sistema de origen o canal externo. */
  accountIn(personId: PersonId, system: ExternalSystem): Promise<Result<string, 'sin-cuenta' | PeopleError>>
  /** La persona dueña de ese id externo, o `null`. Se vincula por id, nunca por nombre o mail. */
  byExternalAccount(system: ExternalSystem, externalId: string): Promise<Result<PersonId | null, ExternalFailure>>
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

export function createPeople({ identity, siu, store }: PeopleDeps): People {
  async function accountIn(personId: PersonId, system: ExternalSystem): Promise<Result<string, 'sin-cuenta' | PeopleError>> {
    const accounts = await store.accountsOf(personId)
    if (!accounts.ok) return accounts
    if (!accounts.value) return fail('persona-desconocida')
    const id = accounts.value[system]
    return id ? ok(id) : fail('sin-cuenta')
  }

  async function get(personId: PersonId): Promise<Result<Person, PeopleError>> {
    const siuId = await accountIn(personId, 'siu')
    if (!siuId.ok) return fail(siuId.error === 'sin-cuenta' ? 'persona-desconocida' : siuId.error)
    const found = await siu.person(siuId.value)
    if (!found.ok) return found.error === 'no-encontrado' ? fail('persona-desconocida') : fail(found.error)
    const { names, surname, role, school, programs } = found.value
    return ok({ id: personId, name: `${names} ${surname}`, role, school, programs })
  }

  /** La persona vinculada a un sujeto de la identidad, o `null` si no hay. */
  async function personOf(subject: string): Promise<Result<Person | null, ExternalFailure>> {
    const owner = await store.ownerOf('identity', subject)
    if (!owner.ok) return owner
    if (!owner.value) return ok(null)
    const person = await get(owner.value)
    if (person.ok) return person
    return person.error === 'persona-desconocida' ? ok(null) : fail(person.error)
  }

  return {
    async signIn(credential) {
      const subject = await identity.verify(credential)
      if (!subject.ok) return fail(subject.error === 'no-soportado' ? 'credencial-invalida' : subject.error)
      const person = await personOf(subject.value.subject)
      if (!person.ok) return person
      return person.value ? ok(person.value) : fail('persona-desconocida')
    },

    async demoPeople() {
      const subjects = await identity.demoSubjects()
      if (!subjects.ok) return subjects
      const people = all(await Promise.all(subjects.value.map((s) => personOf(s.subject))))
      return people.ok ? ok(people.value.filter((p) => p !== null)) : people
    },

    get,

    accountIn,

    async byExternalAccount(system, externalId) {
      return store.ownerOf(system, externalId)
    },
  }
}
