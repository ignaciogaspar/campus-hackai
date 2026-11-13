/* Pase de notas al SIU: pasa las notas publicadas de una evaluación del SIU, y la
   nota de cursada, por Cursada y guarda cómo quedó cada una. Se importa solo desde ./gradebook.ts y
   ./module.ts. Seguimiento no conoce el puerto del SIU: lo único que usa es
   `studies.passGrades`. Si el SIU falla, la nota queda `pendiente` y se
   reintenta; reintentar vuelve a escribir la misma nota por alumno y evaluación,
   así que no duplica. */
import type { CourseworkDeps, PassRetry, PassStatus, StoredGrade } from '@/lib/core/coursework'
import type { PersonId } from '@/lib/core/people'
import { fail, ok, type Result } from '@/lib/result'

/** Si la nota se pasa al SIU y todavía no pasó. */
export const isPending = (g: Pick<StoredGrade, 'pass'>) => g.pass?.status === 'pendiente'

/** En el orden en que se publicaron; a igual hora, el orden en que ya venían (el de carga). */
const inPublicationOrder = (grades: StoredGrade[]) =>
  grades
    .map((g, index) => ({ g, index }))
    .sort((a, b) => (a.g.publishedAt ?? '').localeCompare(b.g.publishedAt ?? '') || a.index - b.index)
    .map(({ g }) => g)

export function createPass({ studies, store }: Pick<CourseworkDeps, 'studies' | 'store'>) {
  /** Pasa las notas de una comisión en nombre de un docente y guarda el estado de cada una. Devuelve el estado en
      que quedó cada id. Si Cursada no puede (el SIU cae, o el docente ya no dicta la comisión), todas siguen
      `pendiente` y no se guarda nada. */
  async function passAs(
    by: PersonId,
    sectionId: string,
    grades: StoredGrade[]
  ): Promise<Result<Map<string, PassStatus>, 'falla-externa'>> {
    const passed = await passGroup(by, sectionId, grades)
    return passed.ok ? ok(passed.value.states) : passed
  }

  /** Como `passAs`, y además dice si el SIU no respondió: solo eso frena el reintento de las comisiones que siguen. */
  async function passGroup(
    by: PersonId,
    sectionId: string,
    grades: StoredGrade[]
  ): Promise<Result<{ states: Map<string, PassStatus>; siuDown: boolean }, 'falla-externa'>> {
    const states = new Map<string, PassStatus>(grades.map((g) => [g.id, 'pendiente']))
    if (grades.length === 0) return ok({ states, siuDown: false })
    const passed = await studies.passGrades(
      by,
      sectionId,
      grades.map((g) => ({
        studentId: g.personId,
        target: g.kind === 'cursada' ? { kind: 'cursada' } : { kind: 'evaluacion', assessmentId: g.refId },
        value: g.value
      }))
    )
    if (!passed.ok) return ok({ states, siuDown: passed.error === 'falla-externa' })
    const ids: Record<PassStatus, string[]> = { pendiente: [], pasado: [], 'no-permitido': [] }
    grades.forEach((g, i) => {
      // Cursada y Seguimiento nombran igual los tres estados.
      const status: PassStatus = passed.value[i] ?? 'pendiente'
      states.set(g.id, status)
      ids[status].push(g.id)
    })
    for (const status of ['pasado', 'no-permitido'] as const) {
      if (ids[status].length === 0) continue
      const saved = await store.setPassStatus(ids[status], status)
      if (!saved.ok) return saved
    }
    // Cursada marca `pendiente` la nota que el SIU no llegó a escribir.
    return ok({ states, siuDown: ids.pendiente.length > 0 })
  }

  /** Reintenta las notas pendientes de a una comisión y docente, en el orden en que se publicaron. Corta en la
      primera comisión en la que el SIU no responde: las que siguen esperan a la próxima. Una comisión que queda
      pendiente por otro motivo (el docente ya no la dicta) no frena a las demás. */
  async function retry(
    pending: StoredGrade[],
    actorOf: (g: StoredGrade) => PersonId | null
  ): Promise<Result<PassRetry, 'falla-externa'>> {
    const groups = new Map<string, { by: PersonId; sectionId: string; grades: StoredGrade[] }>()
    for (const g of inPublicationOrder(pending)) {
      const by = actorOf(g)
      if (!by) continue
      const key = `${g.sectionId}\u0000${by}`
      const group = groups.get(key) ?? { by, sectionId: g.sectionId, grades: [] }
      group.grades.push(g)
      groups.set(key, group)
    }
    let resolved = 0
    let passed = 0
    for (const { by, sectionId, grades } of groups.values()) {
      const group = await passGroup(by, sectionId, grades)
      if (!group.ok) return fail('falla-externa')
      const done = [...group.value.states.values()].filter((status) => status !== 'pendiente')
      resolved += done.length
      passed += done.filter((status) => status === 'pasado').length
      if (group.value.siuDown) break
    }
    return ok({ passed, pending: pending.length - resolved })
  }

  return { passAs, retry }
}
