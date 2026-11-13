import assert from 'node:assert/strict'
import { test } from 'node:test'
import { changeKey, seenChangesFrom, unseenChanges, withSeenChanges } from '@/lib/class-changes-seen'

const change = (id: string, room = 'Aula A10') => ({ id, change: 'cambio' as const, room, start: 480, end: 600 })

test('un cambio visto deja de contarse, solo para la persona que lo vio', () => {
  const a = change('e1:2026-11-11')
  const b = change('e2:2026-11-13')
  const cookie = withSeenChanges(undefined, 'p-taguirre', [changeKey(a)])
  assert.deepEqual(unseenChanges([a, b], seenChangesFrom(cookie, 'p-taguirre')), [b])
  assert.deepEqual(unseenChanges([a, b], seenChangesFrom(cookie, 'p-lbenitez')), [a, b], 'la cookie es de otra persona')
})

test('si la misma clase vuelve a cambiar de aula, se avisa de nuevo', () => {
  const first = change('e1:2026-11-11', 'Aula A10')
  const again = change('e1:2026-11-11', 'Aula B2')
  const cookie = withSeenChanges(undefined, 'p-taguirre', [changeKey(first)])
  assert.deepEqual(unseenChanges([again], seenChangesFrom(cookie, 'p-taguirre')), [again])
})

test('la cookie guarda los últimos 40 cambios vistos', () => {
  const keys = Array.from({ length: 45 }, (_, i) => changeKey(change(`e${i}:2026-11-11`)))
  const seen = seenChangesFrom(withSeenChanges(undefined, 'p-taguirre', keys), 'p-taguirre')
  assert.equal(seen.length, 40)
  assert.deepEqual(seen, keys.slice(-40))
})
