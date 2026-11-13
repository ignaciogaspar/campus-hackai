/* Las inasistencias de un alumno con las dos fuentes (#108): lo que dice el SIU
   y las listas que tomó el docente en HackAI (`unionAbsences`). Vive en su
   archivo para que Cursada la sume en una línea; qué materias son actuales y
   cuál es el máximo de cada comisión lo lee el índice (`readSiu`), que conoce
   las comisiones de la persona.

   - Anda aunque el SIU no responda: con lo último que se leyó de él o, si nunca
     se leyó, solo con las listas de HackAI, marcado como desactualizado.
   - Si falla el almacén de HackAI se ve lo del SIU, también desactualizado.
   - Solo falla si no responde ninguna de las dos fuentes. */
import type { PersonId } from '@/lib/core/people'
import { unionAbsences } from '@/lib/core/studies/absence-sources'
import {
  type AbsenceRecord,
  absencesFrom,
  type MyAbsencesDetail,
  type SubjectAbsences
} from '@/lib/core/studies/absences'
import type { SectionSnapshot, StoredClass, StudiesStore } from '@/lib/core/studies/store'
import type { Fresh } from '@/lib/fresh'
import type { ClockPort } from '@/lib/ports/clock'
import { fail, ok, type Result } from '@/lib/result'

/** Una comisión actual del alumno para contar sus faltas: cómo se llama, su máximo y, si el máximo salió de la
    asistencia requerida, con cuántas clases se calculó. */
export type AbsenceSection = SectionSnapshot & { sectionId: string; max: number | null; classes: number | null }

/** Lo que se lee del SIU para las faltas de un alumno, y lo último que se leyó si después no responde. */
export type SiuAbsencesBasis = { readAt: string; sections: AbsenceSection[]; records: AbsenceRecord[] }

export type AbsencesOfDeps<E extends string> = {
  clock: ClockPort
  store: StudiesStore
  /** El id del SIU de la persona. */
  siuIdOf: (personId: PersonId) => Promise<Result<string, E>>
  /** Lo que el SIU dice de las faltas del alumno, o `docente` si la persona no es alumno. */
  readSiu: (personId: PersonId) => Promise<Result<SiuAbsencesBasis | 'docente', E | 'falla-externa'>>
}

/** El detalle de cada materia de la base con alguna falta, de las dos fuentes, contado contra el máximo. Las materias
    sin faltas no salen. */
function subjectAbsences(basis: SiuAbsencesBasis, classes: StoredClass[], siuId: string): SubjectAbsences[] {
  return basis.sections.flatMap((s) => {
    const mineHere = unionAbsences(
      basis.records.filter((a) => a.sectionId === s.sectionId),
      classes.filter((c) => c.sectionId === s.sectionId),
      siuId
    )
    if (mineHere.length === 0) return []
    return [
      {
        ...absencesFrom(mineHere, s.max, s.classes),
        subjectId: s.subjectId,
        subjectCode: s.subjectCode,
        subjectName: s.subjectName,
        sectionId: s.sectionId,
        sectionName: s.sectionName,
        absences: mineHere
      }
    ]
  })
}

export function createAbsencesOf<E extends string>({ clock, store, siuIdOf, readSiu }: AbsencesOfDeps<E>) {
  /** Lo último que el SIU dijo de las faltas de cada alumno. */
  const lastRead = new Map<PersonId, SiuAbsencesBasis>()

  /** Las materias con falta que se arman solo con lo que guardó HackAI: sin el SIU no se sabe cuáles son las
      materias actuales ni el máximo, pero cada lista tomada guarda cómo se llamaban la materia y la comisión. */
  function basisFromClasses(classes: StoredClass[]): SiuAbsencesBasis {
    const sections = new Map<string, AbsenceSection>()
    for (const { sectionId, snapshot } of classes) {
      if (!sections.has(sectionId)) sections.set(sectionId, { sectionId, ...snapshot, max: null, classes: null })
    }
    return { readAt: clock.now().toISOString(), sections: [...sections.values()], records: [] }
  }

  /** Lo que se lee del SIU ahora o, si no responde, lo último que se leyó (`stale`), que puede no haber. */
  async function siuBasisOf(
    personId: PersonId
  ): Promise<Result<{ basis: SiuAbsencesBasis | null; stale: boolean } | 'docente', E | 'falla-externa'>> {
    const read = await readSiu(personId)
    if (read.ok) {
      if (read.value === 'docente') return ok('docente')
      lastRead.set(personId, read.value)
      return ok({ basis: read.value, stale: false })
    }
    if (read.error !== 'falla-externa') return read
    return ok({ basis: lastRead.get(personId) ?? null, stale: true })
  }

  return async function absencesOf(personId: PersonId): Promise<Result<Fresh<MyAbsencesDetail>, E | 'falla-externa'>> {
    const siuId = await siuIdOf(personId)
    if (!siuId.ok) return siuId
    const fromSiu = await siuBasisOf(personId)
    if (!fromSiu.ok) return fromSiu
    if (fromSiu.value === 'docente')
      return ok({ data: { subjects: [] }, readAt: clock.now().toISOString(), stale: false })

    let { basis } = fromSiu.value
    const stored = basis
      ? await store.classesOf(basis.sections.map((s) => s.sectionId))
      : await store.classesAbsent(siuId.value)
    if (!stored.ok && !basis) return fail(stored.error)
    const classes = stored.ok ? stored.value : []
    basis ??= basisFromClasses(classes)
    return ok({
      data: { subjects: subjectAbsences(basis, classes, siuId.value) },
      readAt: basis.readAt,
      stale: fromSiu.value.stale || !stored.ok
    })
  }
}
