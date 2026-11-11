/* Puerto de identidad: valida una credencial y devuelve quién es.
   En la demo, una persona elegida de una lista; en producción, la cuenta de
   Microsoft de la Austral (Entra ID por OpenID Connect). El sujeto que
   devuelve se mapea a una persona con Personas, sistema 'identity'. */
import type { ExternalFailure, Result } from '@/lib/result'

export type IdentityCapabilities = {
  /** Ofrece una lista de sujetos para elegir sin clave (solo la demo). */
  demoList: boolean
}

export type IdentityCredential =
  | { kind: 'demo'; subject: string }
  | { kind: 'oidc'; code: string; redirectUri: string }

export type IdentitySubject = {
  /** Id estable del sujeto en el proveedor de identidad. */
  subject: string
  name: string
}

export type IdentityError = 'credencial-invalida' | 'no-soportado' | ExternalFailure

export type IdentityPort = {
  capabilities: IdentityCapabilities
  verify(credential: IdentityCredential): Promise<Result<IdentitySubject, IdentityError>>
  /** Sujetos de demo. Con `demoList` en false devuelve `no-soportado`. */
  demoSubjects(): Promise<Result<IdentitySubject[], 'no-soportado' | ExternalFailure>>
}
