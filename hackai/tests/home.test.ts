/* A dónde entra cada rol después del ingreso y cuando pide una pantalla que no
   es la suya, y a dónde lleva «Volver» según de dónde se llegó (`?desde=`). */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { backFor, homeFor } from '@/lib/home'

test('el alumno entra a sus materias y el docente a Hoy', () => {
  assert.equal(homeFor('alumno'), '/materias')
  assert.equal(homeFor('profesor'), '/hoy')
})

test('Volver lleva a la sección de la que se llegó, con su nombre', () => {
  assert.deepEqual(backFor('profesor', 'hoy'), { href: '/hoy', label: 'Volver a Hoy', short: 'Hoy' })
  assert.deepEqual(backFor('alumno', 'novedades'), {
    href: '/novedades',
    label: 'Volver a Novedades',
    short: 'Novedades'
  })
  assert.deepEqual(backFor('alumno', 'calendario'), {
    href: '/calendario',
    label: 'Volver a Calendario',
    short: 'Calendario'
  })
  assert.deepEqual(backFor('profesor', 'materias'), {
    href: '/materias',
    label: 'Volver a Mis materias',
    short: 'Mis materias'
  })
})

test('desde el espacio de una materia, Volver vuelve a la materia', () => {
  assert.deepEqual(backFor('alumno', 'materias/am1'), {
    href: '/materias/am1',
    label: 'Volver a la materia',
    short: 'Materia'
  })
})

test('sin `desde`, Volver lleva al inicio del rol', () => {
  assert.deepEqual(backFor('profesor', undefined), { href: '/hoy', label: 'Volver a Hoy', short: 'Hoy' })
  assert.deepEqual(backFor('alumno', undefined), {
    href: '/materias',
    label: 'Volver a Mis materias',
    short: 'Mis materias'
  })
})

test('un `desde` que no es una sección de la app se ignora', () => {
  const ignored = [
    'https://otro.example',
    '//otro.example',
    '/otro.example',
    'no-existe',
    'materiasx',
    'javascript:alert(1)',
    '',
    ['hoy', 'novedades'],
    42
  ]
  for (const desde of ignored) {
    assert.deepEqual(backFor('profesor', desde), backFor('profesor', undefined), JSON.stringify(desde))
  }
})
