/* Personas (people): quién es quién. Interfaz en hackai/docs/ARQUITECTURA.md.
   Usa el puerto de identidad para el ingreso, el del SIU para los datos de la
   persona y su almacén para los vínculos con cada sistema. Los adaptadores
   nunca adivinan a quién corresponde un id: se lo preguntan a Personas.
   Si el SIU no responde, `get` devuelve la persona como la leyó la última vez:
   nombre, rol, facultad y propuestas casi no cambian, y así una caída del SIU
   no se lleva el nombre de cada pantalla. */
import type { IdentityCredential, IdentityPort } from '@/lib/ports/identity'
import type { SiuPort } from '@/lib/ports/siu'
import { all, type ExternalFailure, fail, ok, type Result } from '@/lib/result'

/** Id de una persona en HackAI. No es el id de ningún sistema de origen. */
export type PersonId = string

/** Los roles de una persona, definidos solo acá. El valor del rol docente en
    código es 'profesor' (ver GLOSSARY.md). */
const ROLES = ['alumno', 'profesor'] as const

export type Role = (typeof ROLES)[number]

/** Si un valor que vino de afuera, por ejemplo de la cookie de sesión, es un rol. */
export function isRole(value: unknown): value is Role {
  return ROLES.some((role) => role === value)
}

/** Sistemas en los que una persona tiene una cuenta propia. */
export type ExternalSystem = 'identity' | 'siu' | 'moodle' | 'discord'

/** Los canales externos: la persona vincula su cuenta ella misma (`linkAccount`). */
const CHANNEL_SYSTEMS: readonly ExternalSystem[] = ['discord']

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
      Un sujeto de la lista que no está vinculado a ninguna persona no aparece:
      no puede entrar. Con una identidad sin lista de demo devuelve
      `no-soportado`. */
  demoPeople(): Promise<Result<Person[], 'no-soportado' | ExternalFailure>>
  /** Rol, facultad y propuestas, del SIU. Si el SIU no responde, la última que se leyó de esa persona; si nunca
      se leyó, `falla-externa`. */
  get(personId: PersonId): Promise<Result<Person, PeopleError>>
  /** Su id en un sistema de origen o canal externo. */
  accountIn(personId: PersonId, system: ExternalSystem): Promise<Result<string, 'sin-cuenta' | PeopleError>>
  /** La persona dueña de ese id externo, o `null`. Se vincula por id, nunca por nombre o mail. */
  byExternalAccount(system: ExternalSystem, externalId: string): Promise<Result<PersonId | null, ExternalFailure>>
  /** Vincula su cuenta de un canal externo, por ejemplo la de Discord con que autorizó a HackAI. Reemplaza la
      que tenía en ese sistema. Una cuenta que ya es de otra persona es `cuenta-en-uso`. La identidad, el SIU y
      Moodle no se vinculan así: vienen de los sistemas de origen (`solo-canales-externos`). */
  linkAccount(
    personId: PersonId,
    system: ExternalSystem,
    externalId: string
  ): Promise<Result<null, 'cuenta-en-uso' | 'solo-canales-externos' | PeopleError>>
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
  /** Guarda su id en ese sistema, en lugar del que tenía. `duplicado` si ese id ya es de otra persona. */
  setAccount(
    personId: PersonId,
    system: ExternalSystem,
    externalId: string
  ): Promise<Result<null, 'duplicado' | ExternalFailure>>
}

export type PeopleDeps = {
  identity: IdentityPort
  siu: SiuPort
  store: PeopleStore
}

export function createPeople({ identity, siu, store }: PeopleDeps): People {
  /** La última versión leída de cada persona, para cuando el SIU no responde. */
  const lastRead = new Map<PersonId, Person>()

  async function accountIn(
    personId: PersonId,
    system: ExternalSystem
  ): Promise<Result<string, 'sin-cuenta' | PeopleError>> {
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
    if (!found.ok) {
      if (found.error === 'no-encontrado') return fail('persona-desconocida')
      const last = lastRead.get(personId)
      return last ? ok(last) : fail(found.error)
    }
    const { names, surname, role, school, programs } = found.value
    const person: Person = { id: personId, name: `${names} ${surname}`, role, school, programs }
    lastRead.set(personId, person)
    return ok(person)
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

    async linkAccount(personId, system, externalId) {
      if (!CHANNEL_SYSTEMS.includes(system)) return fail('solo-canales-externos')
      const accounts = await store.accountsOf(personId)
      if (!accounts.ok) return accounts
      if (!accounts.value) return fail('persona-desconocida')
      if (accounts.value[system] === externalId) return ok(null)
      const saved = await store.setAccount(personId, system, externalId)
      if (!saved.ok) return fail(saved.error === 'duplicado' ? 'cuenta-en-uso' : saved.error)
      return ok(null)
    }
  }
}
