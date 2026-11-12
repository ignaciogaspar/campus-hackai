/* A dónde se vuelve después de entrar: solo a una ruta de la propia app, para
   que `?next=` no sirva para mandar a alguien a otro sitio después del ingreso. */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { safeReturnTo, signInUrl } from '@/lib/return-to'

const FILE = '/archivos/0b3c8f0e-5d7a-4c1e-9f3a-2a7d1c9e4b6f/Gu%C3%ADa%201.pdf'

test('el ingreso vuelve al archivo que se quiso abrir', () => {
  const next = new URL(signInUrl(FILE), 'http://localhost').searchParams.get('next')

  assert.equal(safeReturnTo(next), FILE)
})

test('vuelve a cualquier ruta de la app, con su consulta', () => {
  for (const path of ['/hoy', '/materias/am1?canal=c-1&hilo=m-2', FILE]) {
    assert.equal(safeReturnTo(path), path)
  }
})

test('no vuelve a otro sitio ni a algo que no es una ruta de la app', () => {
  const outside = [
    'https://otro.example/archivos/x',
    '//otro.example/archivos/x',
    '/\\otro.example',
    '\\\\otro.example',
    'javascript:alert(1)',
    'archivos/x',
    '',
    '/con espacio',
    '/con\nsalto',
    '/con\\barra',
    `/${'a'.repeat(2048)}`
  ]
  for (const value of outside) {
    assert.equal(safeReturnTo(value), null, JSON.stringify(value))
  }
})

test('sin `next`, o con algo que no es un texto, no hay a dónde volver', () => {
  for (const value of [null, undefined, ['/hoy', '/inscripciones'], 42]) {
    assert.equal(safeReturnTo(value), null, JSON.stringify(value))
  }
})
