/* Qué resultado muestran las acciones de inscripción: el de la última acción,
   nunca el de una anterior mientras la nueva está en camino. */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { INITIAL_ENROLLMENT_STATE, visibleOutcome } from '@/components/enrollment/outcome'
import type { EnrollmentState } from '@/components/enrollment/state'

const firstReceipt: EnrollmentState = { kind: 'inscripto', transactionNumber: 'T-1', inClassroom: true }
const secondReceipt: EnrollmentState = { kind: 'inscripto', transactionNumber: 'T-2', inClassroom: true }
const dropped: EnrollmentState = { kind: 'baja', transactionNumber: 'T-B' }

test('sin ninguna acción no muestra nada', () => {
  assert.deepEqual(
    visibleOutcome({
      lastAction: null,
      enrollState: INITIAL_ENROLLMENT_STATE,
      dropState: INITIAL_ENROLLMENT_STATE,
      superseded: null,
      pending: false
    }),
    { kind: 'inicial' }
  )
})

test('muestra el resultado de la última acción: la inscripción o la baja', () => {
  assert.equal(
    visibleOutcome({
      lastAction: 'inscripcion',
      enrollState: firstReceipt,
      dropState: INITIAL_ENROLLMENT_STATE,
      superseded: INITIAL_ENROLLMENT_STATE,
      pending: false
    }),
    firstReceipt
  )
  assert.equal(
    visibleOutcome({
      lastAction: 'baja',
      enrollState: firstReceipt,
      dropState: dropped,
      superseded: INITIAL_ENROLLMENT_STATE,
      pending: false
    }),
    dropped
  )
})

test('al volver a inscribirse después de una baja, el comprobante anterior no se ve mientras llega el nuevo', () => {
  // Se inscribió (T-1), se dio de baja y ahora se inscribe otra vez: el estado
  // de la inscripción sigue siendo el de T-1 hasta que responda el SIU.
  const whileSending = {
    lastAction: 'inscripcion' as const,
    enrollState: firstReceipt,
    dropState: dropped,
    superseded: firstReceipt
  }

  assert.deepEqual(visibleOutcome({ ...whileSending, pending: true }), { kind: 'inicial' })
  assert.deepEqual(visibleOutcome({ ...whileSending, pending: false }), { kind: 'inicial' })
  assert.equal(visibleOutcome({ ...whileSending, enrollState: secondReceipt, pending: false }), secondReceipt)
})

test('mientras se da de baja no se ve el resultado de la inscripción', () => {
  assert.deepEqual(
    visibleOutcome({
      lastAction: 'baja',
      enrollState: firstReceipt,
      dropState: INITIAL_ENROLLMENT_STATE,
      superseded: INITIAL_ENROLLMENT_STATE,
      pending: true
    }),
    { kind: 'inicial' }
  )
})
