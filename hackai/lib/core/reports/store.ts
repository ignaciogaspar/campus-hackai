/* El almacén de Reportes: los alumnos que la Dirección de Estudios marcó «en
   seguimiento», con una nota corta. Es el seam interno del módulo
   (hackai/docs/ARQUITECTURA.md): un adaptador de Supabase y otro en memoria,
   que pasan la misma batería de contrato (tests/contracts/reports-store.test.ts). */
import type { FollowUp } from '@/lib/core/reports'
import type { Result } from '@/lib/result'

export type ReportsStore = {
  /** Todos los alumnos en seguimiento, sin orden fijo. */
  followUps(): Promise<Result<FollowUp[], 'falla-externa'>>
  /** Marca al alumno en seguimiento o cambia su nota: uno solo por legajo. */
  saveFollowUp(followUp: FollowUp): Promise<Result<void, 'falla-externa'>>
  /** Lo saca del seguimiento. `false` si no estaba. */
  removeFollowUp(studentId: string): Promise<Result<boolean, 'falla-externa'>>
}
