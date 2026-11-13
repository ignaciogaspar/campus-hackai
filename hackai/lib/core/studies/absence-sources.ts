/* Las faltas de un alumno en una comisión, juntando las dos fuentes: el SIU y
   las listas que tomó el docente en HackAI (#108).

   - Una clase tomada en HackAI vale como la guardó HackAI, también si no tuvo
     ausentes, y reemplaza las faltas del SIU de esa comisión ese día.
   - Se compara por día calendario en Buenos Aires, no por instante: el SIU y
     HackAI no siempre dicen la misma hora. Con una clase doble el mismo día,
     una lista de HackAI reemplaza las dos del SIU.
   - Las faltas que solo están en el SIU (de días en que HackAI no tomó lista)
     se siguen viendo.
   - HackAI no justifica faltas: las suyas van sin justificar. */
import type { AbsenceRecord } from '@/lib/core/studies/absences'
import type { StoredClass } from '@/lib/core/studies/store'
import { dayKey } from '@/lib/dates'

/** Las faltas de `siuId` en una comisión, por fecha. `taken` son las clases tomadas de esa comisión. */
export function unionAbsences(siuRecords: AbsenceRecord[], taken: StoredClass[], siuId: string): AbsenceRecord[] {
  const takenDays = new Set(taken.map((c) => dayKey(c.classAt)))
  const fromHackai = taken
    .filter((c) => c.absent.includes(siuId))
    .map(
      (c): AbsenceRecord => ({
        id: `clase:${c.sectionId}:${c.classAt}`,
        sectionId: c.sectionId,
        date: c.classAt,
        justified: false,
        amount: 1,
        source: 'hackai'
      })
    )
  return [...siuRecords.filter((a) => !takenDays.has(dayKey(a.date))), ...fromHackai].sort(
    (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)
  )
}
