/* Almacén propio de Cursada: lo que HackAI guarda y los sistemas de origen no
   tienen: las clases con la lista tomada (tomar lista, #108) y el enlace de Zoom de cada comisión (#109). Es un seam
   interno, no un puerto: se inyecta al armar el módulo (`StudiesDeps.store`) y
   tiene un adaptador en memoria y uno de Supabase, con la misma batería de
   contrato (tests/contracts/studies-store.test.ts). */
import type { PersonId } from '@/lib/core/people'
import type { ExternalFailure, Result } from '@/lib/result'

/** Si la lista de una clase llegó al SIU: `pendiente` (todavía no, se reintenta), `pasado`, o `no-permitido` (el SIU no
    deja cargar la asistencia por API: la lista queda solo en HackAI). */
export type AttendancePass = 'pendiente' | 'pasado' | 'no-permitido'

/** Cómo se ve la comisión y su materia cuando se tomó la lista, para mostrar las faltas aunque el SIU no responda. */
export type SectionSnapshot = {
  subjectId: string
  subjectCode: string
  subjectName: string
  sectionName: string
}

/** Una clase con la lista tomada. */
export type StoredClass = {
  sectionId: string
  /** Instante ISO de la clase: el inicio de su horario en Buenos Aires. Con la comisión, la identifica. */
  classAt: string
  /** Cuándo se tomó o se corrigió por última vez. */
  takenAt: string
  /** El docente que la tomó, por su id de HackAI. */
  takenBy: PersonId
  /** Los ausentes, por su id del SIU (legajo): así también está el que no tiene cuenta vinculada. */
  absent: string[]
  pass: AttendancePass
  /** Cuándo se pasó al SIU. `null` si no se pasó. */
  passedAt: string | null
  snapshot: SectionSnapshot
}

export type StoredClassInput = Omit<StoredClass, 'pass' | 'passedAt'>

export type StudiesStoreError = ExternalFailure

export type StudiesStore = {
  /** La clase tomada de esa comisión en ese instante, o `null`. */
  classAt(sectionId: string, classAt: string): Promise<Result<StoredClass | null, StudiesStoreError>>
  /** Las clases tomadas de esas comisiones, por instante. */
  classesOf(sectionIds: string[]): Promise<Result<StoredClass[], StudiesStoreError>>
  /** Las clases tomadas en que ese alumno (por su id del SIU) figura ausente, de cualquier comisión. */
  classesAbsent(siuId: string): Promise<Result<StoredClass[], StudiesStoreError>>
  /** Las clases que todavía no se pasaron al SIU (`pendiente`), de la más vieja a la más nueva. */
  pending(): Promise<Result<StoredClass[], StudiesStoreError>>
  /** Guarda la clase, o REEMPLAZA la de esa comisión e instante (la lista, quién la tomó y cuándo). Queda
      `pendiente`: una lista corregida se pasa de nuevo. */
  saveClass(input: StoredClassInput): Promise<Result<StoredClass, StudiesStoreError>>
  /** Marca cómo quedó el pase de una clase, solo si la lista guardada sigue siendo la que se tomó en `takenAt` (la
      que se mandó al SIU). Devuelve `true` si la marcó, y `false` si la clase ya no existe o se corrigió mientras
      tanto: así una lista vieja que llegó tarde al SIU no deja como pasada a la corregida. */
  setPass(
    sectionId: string,
    classAt: string,
    takenAt: string,
    pass: AttendancePass,
    passedAt: string | null
  ): Promise<Result<boolean, StudiesStoreError>>
  /** Los enlaces de Zoom cargados de esas comisiones, por id de comisión. Las que no tienen no figuran. */
  zoomLinks(sectionIds: string[]): Promise<Result<Record<string, string>, StudiesStoreError>>
  /** Guarda el enlace de Zoom de la comisión, o lo borra con `null`. Reemplaza el anterior. */
  setZoomLink(sectionId: string, url: string | null): Promise<Result<null, StudiesStoreError>>
}
