/* Padrón académico en memoria: el padrón sintético de grado
   (lib/adapters/synthetic-population.ts). Se arma la primera vez que alguien lo
   pide, porque generar unos miles de alumnos con su historia lleva unos cientos
   de milisegundos y la mayoría de las pantallas no lo usa. Lo que devuelve es de
   solo lectura: el núcleo no lo modifica. */
import { type SyntheticPopulation, syntheticPopulation } from '@/lib/adapters/synthetic-population'
import type { AcademicRecordsPort } from '@/lib/ports/academic-records'
import { ok } from '@/lib/result'

export function createMemoryAcademicRecords(
  make: () => SyntheticPopulation = () => syntheticPopulation()
): AcademicRecordsPort {
  let population: SyntheticPopulation | undefined
  const data = () => {
    population ??= make()
    return population
  }
  return {
    async catalog() {
      return ok(data().catalog)
    },
    async students() {
      return ok(data().students)
    }
  }
}
