/* A dónde entra cada rol después del ingreso y cuando pide una pantalla que no es la suya. */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { homeFor } from '@/lib/home'

test('el alumno entra a sus materias y el docente a Hoy', () => {
  assert.equal(homeFor('alumno'), '/materias')
  assert.equal(homeFor('profesor'), '/hoy')
})
