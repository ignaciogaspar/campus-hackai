/* Cuánto sube el campo para escribir cuando el teclado del teléfono tapa el pie de la pantalla. */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { keyboardInset } from '@/components/spaces/keyboard-inset-size'

test('sin estar escribiendo, el campo queda donde está', () => {
  assert.equal(keyboardInset({ layoutHeight: 800, viewportHeight: 480, viewportTop: 0, typing: false }), 0)
})

test('escribiendo sin teclado en pantalla, como en la compu, el campo queda donde está', () => {
  assert.equal(keyboardInset({ layoutHeight: 800, viewportHeight: 800, viewportTop: 0, typing: true }), 0)
})

test('con el teclado abierto, el campo sube lo que tapa el teclado', () => {
  assert.equal(keyboardInset({ layoutHeight: 800, viewportHeight: 480, viewportTop: 0, typing: true }), 320)
})

test('si el navegador corrió la pantalla para mostrar el campo, sube solo lo que falta', () => {
  assert.equal(keyboardInset({ layoutHeight: 800, viewportHeight: 480, viewportTop: 120, typing: true }), 200)
})

test('una diferencia chica, como la barra del navegador que se esconde, no es el teclado', () => {
  assert.equal(keyboardInset({ layoutHeight: 800, viewportHeight: 744, viewportTop: 0, typing: true }), 0)
})
