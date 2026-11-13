/* Qué rutas son el espacio de una materia: ahí la barra lateral baja los no leídos al leer un canal. */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isSpacePath, spaceHref } from '@/components/spaces/format'

test('es el espacio de una materia, no la lista de materias ni otras pantallas', () => {
  assert.equal(isSpacePath('/materias/am1'), true)
  assert.equal(isSpacePath('/materias/f%C3%ADsica-1'), true)
  assert.equal(isSpacePath('/materias'), false)
  assert.equal(isSpacePath('/materias/'), false)
  assert.equal(isSpacePath('/hoy'), false)
  assert.equal(isSpacePath('/inscripciones/am1'), false)
})

test('el enlace al espacio, sin query, es una ruta de espacio', () => {
  assert.equal(isSpacePath(spaceHref('am1')), true)
  assert.equal(isSpacePath(spaceHref('física 1')), true)
})

test('el enlace al espacio lleva la comisión elegida, sola o con el canal', () => {
  assert.equal(spaceHref('pr1', { comision: 'sec-pr1-fi-v' }), '/materias/pr1?comision=sec-pr1-fi-v')
  assert.equal(
    spaceHref('pr1', { canal: 'ch-7', comision: 'sec-pr1-fi-v' }),
    '/materias/pr1?canal=ch-7&comision=sec-pr1-fi-v'
  )
  assert.equal(spaceHref('pr1', { canal: 'ch-7', comision: undefined }), '/materias/pr1?canal=ch-7')
})
