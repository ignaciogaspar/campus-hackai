import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readAnswer } from '@/components/session/session-extension'

describe('readAnswer', () => {
  const answer = (extra: Record<string, unknown>) => ({
    source: 'hackai-extension',
    type: 'iniciar',
    id: 'a1',
    ...extra
  })

  it('lee las sesiones, y null la que no se pudo iniciar', () => {
    assert.deepEqual(readAnswer(answer({ siu: 'abc123', campus: '' }), 'a1'), { siu: 'abc123', campus: null })
  })

  it('ignora mensajes que no son la respuesta a ese pedido', () => {
    assert.equal(readAnswer(answer({ siu: 'x' }), 'otro'), undefined)
    assert.equal(readAnswer(answer({ type: 'estado' }), 'a1'), undefined)
    assert.equal(readAnswer({ source: 'hackai', type: 'iniciar', id: 'a1' }, 'a1'), undefined)
    assert.equal(readAnswer('hola', 'a1'), undefined)
  })

  it('devuelve null si la extensión no pudo responder', () => {
    assert.equal(readAnswer(answer({ error: 'sin-respuesta' }), 'a1'), null)
  })
})
