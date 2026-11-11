/* Personas (people): quién es quién. Interfaz en hackai/docs/ARQUITECTURA.md.
   Usa el puerto de identidad para el ingreso, el del SIU para los datos de la
   persona y su almacén para los vínculos con cada sistema. Los adaptadores
   nunca adivinan a quién corresponde un id: se lo preguntan a Personas. */
import type { IdentityCredential, IdentityPort } from '@/lib/ports/identity'
import type { SiuPort } from '@/lib/ports/siu'
import { notImplemented, type ExternalFailure, type NotImplemented, type Result } from '@/lib/result'

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
  byExternalAccount(system: ExternalSystem, externalId: string): Promise<Result<PersonId | null, NotImplemented>>
}

export type PeopleDeps = {
  identity: IdentityPort
  siu: SiuPort
}

export function createPeople(_deps: PeopleDeps): People {
  return {
    signIn: notImplemented,
    demoPeople: notImplemented,
    get: notImplemented,
    accountIn: notImplemented,
    byExternalAccount: notImplemented,
  }
}
