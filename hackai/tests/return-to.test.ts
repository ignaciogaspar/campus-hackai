/* A dónde se vuelve después de entrar: solo a una ruta de la propia app, para
   que `?next=` no sirva para mandar a alguien a otro sitio después del ingreso. */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { returnNotice } from '@/components/session/return-notice'
import { requestedPath, safeReturnTo, signInFor, signInUrl } from '@/lib/return-to'

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

test('la ruta pedida lleva su consulta, sin la marca interna de los pedidos de Next.js', () => {
  assert.equal(requestedPath(new URL('http://localhost/notas')), '/notas')
  assert.equal(requestedPath(new URL('http://localhost/materias/am1?canal=c-1&_rsc=x1y2')), '/materias/am1?canal=c-1')
  assert.equal(requestedPath(new URL('http://localhost/notas?_rsc=x1y2')), '/notas')
})

test('sin sesión, una pantalla lleva al ingreso con la ruta en `next`, y el inicio o algo ajeno van al ingreso solo', () => {
  assert.equal(signInFor('/notas'), '/?next=%2Fnotas')
  assert.equal(signInFor('/materias/am1?canal=c-1'), signInUrl('/materias/am1?canal=c-1'))
  for (const path of ['/', null, '//otro.example', 'https://otro.example/notas']) {
    assert.equal(signInFor(path), '/', JSON.stringify(path))
  }
})

test('el ingreso avisa a qué pantalla se va a seguir', () => {
  assert.equal(returnNotice('/notas'), 'Entrá para seguir a Notas.')
  assert.equal(returnNotice('/materias/am1/tareas?comision=a'), 'Entrá para seguir a Materias.')
  assert.equal(returnNotice('/estado'), 'Entrá para seguir a Plan de estudios.')
  assert.equal(returnNotice(FILE), 'Entrá para abrir el archivo.')
  assert.equal(returnNotice('/discord/conectar?espacio=e-1'), 'Entrá para seguir donde ibas.')
})
