/* Lo que devuelven las server actions de inscripción y la pantalla muestra.
   Vive en components/ para que el componente de cliente no importe de app/. */

export type EnrollmentStep = 'inscripcion' | 'baja'

export type EnrollmentState =
  | { kind: 'inicial' }
  | { kind: 'inscripto'; transactionNumber: string }
  | { kind: 'baja'; transactionNumber: string }
  | { kind: 'requiere-autogestion'; url: string; step: EnrollmentStep }
  | { kind: 'error'; message: string }

export type EnrollmentAction = (prev: EnrollmentState, formData: FormData) => Promise<EnrollmentState>
