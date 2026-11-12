/* Lo que devuelven las server actions de inscripción y la pantalla muestra.
   Vive en components/ para que el componente de cliente no importe de app/. */

export type EnrollmentStep = 'inscripcion' | 'baja'

/** A qué se inscribe: una comisión (cursada) o una mesa (final). */
export type EnrollmentTargetKind = 'comision' | 'mesa'

export type EnrollmentState =
  | { kind: 'inicial' }
  /** `inClassroom`: también quedó en el aula del Campus Virtual (la comisión tiene curso). */
  | { kind: 'inscripto'; transactionNumber: string; inClassroom: boolean; target: EnrollmentTargetKind }
  | { kind: 'baja'; transactionNumber: string; target: EnrollmentTargetKind }
  | { kind: 'requiere-autogestion'; url: string; step: EnrollmentStep }
  | { kind: 'error'; message: string }

export type EnrollmentAction = (prev: EnrollmentState, formData: FormData) => Promise<EnrollmentState>
