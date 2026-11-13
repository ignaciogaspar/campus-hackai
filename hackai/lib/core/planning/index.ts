/* Planning (planning): en qué aula y a qué hora se dicta cada clase, de todas
   las materias. Lo carga secretaría, que es quien asigna las aulas al empezar
   la cursada y las cambia cuando hace falta: pega su planilla de Excel o sube
   el archivo, o carga una clase a mano. El SIU tiene el horario de cada
   comisión pero no el aula al día, y el Planning de Aulas del Campus muestra
   todas las sedes juntas: este módulo es la fuente propia para la vista
   /planning, con filtros. Interfaz en hackai/docs/ARQUITECTURA.md.

   Usa Personas para saber si quien carga es de secretaría, y su almacén. */
import type { People, PeopleError, PersonId } from '@/lib/core/people'
import { checkRows } from '@/lib/core/planning/checks'
import { classesBetween } from '@/lib/core/planning/schedule'
import { COLUMNS, type PlanningColumn, parseRows } from '@/lib/core/planning/sheet'
import type { PlanningStore } from '@/lib/core/planning/store'
import { type ExternalFailure, fail, ok, type Result } from '@/lib/result'

export type Weekday = 'lunes' | 'martes' | 'miercoles' | 'jueves' | 'viernes' | 'sabado'

/** Una celda de la planilla: texto, número (Excel guarda horas y fechas como números) o vacía. */
export type PlanningCell = string | number | null

/** Una clase cargada. Con `weekday` se repite cada semana; con `date` es de ese día y manda sobre las semanales de
    la misma materia y comisión. */
export type PlanningEntryInput = {
  subject: string
  /** La comisión, como la escribe secretaría («A», «Com B»), o `null`. */
  section: string | null
  /** La sigla de la facultad (FI, FCE…), o vacía. */
  school: string
  /** Dónde está el aula: la sede (Pilar, Buenos Aires…), el edificio (Olivo, Cerrito…) y el módulo del edificio
      (Módulo A…). Cada uno puede ir vacío. */
  campus: string
  building: string
  wing: string
  room: string
  weekday: Weekday | null
  /** `AAAA-MM-DD`. */
  date: string | null
  /** Minutos desde la medianoche. */
  start: number
  end: number
  /** Solo en una fila con fecha: la clase de ese día no se dicta. */
  cancelled: boolean
}

export type PlanningEntry = PlanningEntryInput & { id: string }

/** Una clase de un día concreto, con el cambio de ese día si lo hubo. */
export type PlanningClass = {
  id: string
  entryId: string
  day: string
  start: number
  end: number
  subject: string
  section: string | null
  school: string
  campus: string
  building: string
  wing: string
  room: string
  /** `cambio`: ese día va en otra aula u otro horario. `suspendida`: ese día no hay clase. `extra`: clase de ese
      día solo. */
  change: 'cambio' | 'suspendida' | 'extra' | null
}

/** Cómo quedó cada fila: `ok` se guarda (con un aviso si es una clase extra); `repetida` es igual a otra fila o a
    una clase ya cargada y se guarda una sola vez; `error` no se entendió o choca con otra clase, y mientras haya
    alguna no se guarda nada. */
export type PlanningPreviewRow =
  | { line: number; status: 'ok'; entry: PlanningEntryInput; note: string | null }
  | { line: number; status: 'repetida'; entry: PlanningEntryInput; note: string }
  | { line: number; status: 'error'; error: string }

export type PlanningPreview = {
  rows: PlanningPreviewRow[]
  counts: { ok: number; duplicates: number; errors: number }
  /** Si la primera fila se leyó como encabezado. */
  header: boolean
}

/** `reemplazar` cambia todo el planning por la planilla; `agregar` la suma a lo cargado. */
export type PlanningMode = 'reemplazar' | 'agregar'

export type PlanningLoadError = 'solo-secretaria' | 'con-errores' | 'sin-clases' | PeopleError

export type { PlanningColumn }

export type Planning = {
  /** Las columnas que se reconocen, en el orden de la planilla de ejemplo: la clave (`materia`, `aula`…) y el
      encabezado como lo escribe secretaría. */
  columns: readonly { column: PlanningColumn; header: string }[]
  /** Las clases entre dos días `AAAA-MM-DD` (los dos incluidos), con los cambios de cada día, por día y hora. Las
      ve cualquiera que entró: es lo que muestra el Planning de Aulas. */
  classes(from: string, to: string): Promise<Result<PlanningClass[], ExternalFailure>>
  /** Lo cargado, para la pantalla de secretaría: primero las semanales por día y hora, después las de fecha. */
  entries(): Promise<Result<PlanningEntry[], ExternalFailure>>
  /** Qué se entendió de cada fila y si choca con otra, sin guardar nada. Con `agregar` también se compara con lo
      cargado; con `reemplazar`, solo entre las filas (lib/core/planning/checks.ts). */
  preview(rows: PlanningCell[][], mode: PlanningMode): Promise<Result<PlanningPreview, ExternalFailure>>
  /** Guarda la planilla si no tiene errores: `reemplazar` cambia todo el planning, `agregar` suma las clases (un
      cambio de último momento o una clase cargada a mano). Las repetidas se guardan una sola vez. Con alguna fila
      con error no guarda nada (`con-errores`); sin clases nuevas, `sin-clases`. Solo secretaría. */
  load(
    personId: PersonId,
    rows: PlanningCell[][],
    mode: PlanningMode
  ): Promise<Result<{ saved: number; duplicates: number }, PlanningLoadError>>
  /** Borra una clase cargada. Solo secretaría. */
  remove(
    personId: PersonId,
    entryId: string
  ): Promise<Result<void, 'solo-secretaria' | 'clase-desconocida' | PeopleError>>
}

const DAY_ORDER = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']

const byWhen = (a: PlanningEntry, b: PlanningEntry) =>
  (a.date ?? '').localeCompare(b.date ?? '') ||
  DAY_ORDER.indexOf(a.weekday ?? '') - DAY_ORDER.indexOf(b.weekday ?? '') ||
  a.start - b.start ||
  a.subject.localeCompare(b.subject, 'es')

export function createPlanning({ people, store }: { people: People; store: PlanningStore }): Planning {
  async function secretary(personId: PersonId): Promise<Result<true, 'solo-secretaria' | PeopleError>> {
    const person = await people.get(personId)
    if (!person.ok) return person
    return person.value.role === 'secretaria' ? ok(true) : fail('solo-secretaria')
  }

  async function preview(
    rows: PlanningCell[][],
    mode: PlanningMode
  ): Promise<Result<PlanningPreview, ExternalFailure>> {
    const parsed = parseRows(rows)
    const existing = mode === 'agregar' ? await store.entries() : ok([])
    if (!existing.ok) return existing
    const checked = checkRows(parsed.rows, existing.value)
    const count = (status: PlanningPreviewRow['status']) => checked.filter((r) => r.status === status).length
    return ok({
      rows: checked,
      counts: { ok: count('ok'), duplicates: count('repetida'), errors: count('error') },
      header: parsed.header
    })
  }

  return {
    async classes(from, to) {
      const entries = await store.entries()
      return entries.ok ? ok(classesBetween(entries.value, from, to)) : entries
    },

    async entries() {
      const entries = await store.entries()
      return entries.ok ? ok(entries.value.sort(byWhen)) : entries
    },

    columns: COLUMNS,

    preview,

    async load(personId, rows, mode) {
      const allowed = await secretary(personId)
      if (!allowed.ok) return allowed
      const checked = await preview(rows, mode)
      if (!checked.ok) return checked
      if (checked.value.counts.errors > 0) return fail('con-errores')
      const entries = checked.value.rows.flatMap((r) => (r.status === 'ok' ? [r.entry] : []))
      if (entries.length === 0) return fail('sin-clases')
      const saved = mode === 'reemplazar' ? await store.replace(entries) : await store.add(entries)
      return saved.ok ? ok({ saved: saved.value, duplicates: checked.value.counts.duplicates }) : saved
    },

    async remove(personId, entryId) {
      const allowed = await secretary(personId)
      if (!allowed.ok) return allowed
      const removed = await store.remove(entryId)
      if (!removed.ok) return removed
      return removed.value ? ok(undefined) : fail('clase-desconocida')
    }
  }
}
