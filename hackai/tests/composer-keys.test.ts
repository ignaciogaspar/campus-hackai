/* Qué teclas mandan el mensaje desde el campo para escribir del espacio. */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { sendsOnKey } from '@/components/spaces/composer-keys'

const enter = { key: 'Enter', shiftKey: false, ctrlKey: false, metaKey: false, isComposing: false }
const compu = { finePointer: true, canSend: true }
const celular = { finePointer: false, canSend: true }

test('en la compu, Enter envía y Shift+Enter salta de línea', () => {
  assert.equal(sendsOnKey({ ...enter }, compu), true)
  assert.equal(sendsOnKey({ ...enter, shiftKey: true }, compu), false)
})

test('en el celular, Enter salta de línea como siempre', () => {
  assert.equal(sendsOnKey({ ...enter }, celular), false)
  assert.equal(sendsOnKey({ ...enter, shiftKey: true }, celular), false)
})

test('Ctrl o ⌘ + Enter envía en cualquier dispositivo', () => {
  assert.equal(sendsOnKey({ ...enter, ctrlKey: true }, celular), true)
  assert.equal(sendsOnKey({ ...enter, metaKey: true }, compu), true)
})

test('mientras se compone una letra con tilde o en otro alfabeto, Enter no envía', () => {
  assert.equal(sendsOnKey({ ...enter, isComposing: true }, compu), false)
  assert.equal(sendsOnKey({ ...enter, isComposing: true, metaKey: true }, compu), false)
})

test('vacío o mientras se manda, ninguna tecla envía', () => {
  assert.equal(sendsOnKey({ ...enter }, { finePointer: true, canSend: false }), false)
  assert.equal(sendsOnKey({ ...enter, ctrlKey: true }, { finePointer: true, canSend: false }), false)
})

test('otras teclas no envían', () => {
  assert.equal(sendsOnKey({ ...enter, key: 'a' }, compu), false)
  assert.equal(sendsOnKey({ ...enter, key: 'a', ctrlKey: true }, compu), false)
})

test('en Avisos, Enter salta de línea también en la compu y el aviso se publica con Ctrl o ⌘ + Enter', () => {
  const avisos = { ...compu, announcement: true }
  assert.equal(sendsOnKey({ ...enter }, avisos), false)
  assert.equal(sendsOnKey({ ...enter, ctrlKey: true }, avisos), true)
  assert.equal(sendsOnKey({ ...enter, metaKey: true }, avisos), true)
})
