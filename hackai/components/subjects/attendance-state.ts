/* Lo que devuelve la server action de tomar lista y la pantalla muestra. Vive
   en components/ para que el componente de cliente no importe de app/. */
import type { Pase } from '@/lib/core/studies'

export type AttendanceState =
  | { kind: 'inicial' }
  | { kind: 'guardada'; pase: Pase; absent: number }
  | { kind: 'error'; message: string }

export type AttendanceAction = (prev: AttendanceState, formData: FormData) => Promise<AttendanceState>
