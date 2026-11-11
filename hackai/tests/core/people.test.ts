import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createMemoryPeopleStore } from '@/lib/adapters/memoria/people-store'
import { createFixedClock } from '@/lib/adapters/memoria/clock'
import { createMemoryIdentity } from '@/lib/adapters/memoria/identity'
import { createMemorySiu } from '@/lib/adapters/memoria/siu'
import { syntheticData } from '@/lib/adapters/synthetic-data'
import { createPeople } from '@/lib/core/people'
import type { SiuPort } from '@/lib/ports/siu'
import { fail } from '@/lib/result'

function build(overrides: { siu?: Partial<SiuPort> } = {}) {
  const clock = createFixedClock(syntheticData.now)
  const siu = { ...createMemorySiu(syntheticData, clock), ...overrides.siu }
  return createPeople({
    identity: createMemoryIdentity(syntheticData),
    siu,
    store: createMemoryPeopleStore(syntheticData),
  })
}

test('get devuelve rol, facultad y propuestas de la persona según el SIU', async () => {
  const people = build()

  assert.deepEqual(await people.get('p-taguirre'), {
    ok: true,
    value: {
      id: 'p-taguirre',
      name: 'Tomás Aguirre',
      role: 'alumno',
      school: { id: 'fi', name: 'Facultad de Ingeniería' },
      programs: [
        { id: 'iinf', name: 'Ingeniería en Informática', status: 'activa' },
        { id: 'asp-fi', name: 'Aspirantes - fi', status: 'pasiva' },
      ],
    },
  })

  const docente = await people.get('p-cbustos')
  assert.ok(docente.ok)
  assert.equal(docente.value.role, 'profesor')
  assert.equal(docente.value.school.id, 'fce')
  assert.deepEqual(docente.value.programs, [])
})

test('get de una persona que no existe devuelve «persona desconocida»', async () => {
  assert.deepEqual(await build().get('p-nadie'), { ok: false, error: 'persona-desconocida' })
})

test('get con el SIU caído devuelve «falla externa» como valor', async () => {
  const people = build({ siu: { person: async () => fail('falla-externa') } })
  assert.deepEqual(await people.get('p-taguirre'), { ok: false, error: 'falla-externa' })
})

test('accountIn traduce una persona a su id en cada sistema', async () => {
  const people = build()

  assert.deepEqual(await people.accountIn('p-taguirre', 'siu'), { ok: true, value: '30101' })
  assert.deepEqual(await people.accountIn('p-taguirre', 'moodle'), { ok: true, value: '401' })
  assert.deepEqual(await people.accountIn('p-taguirre', 'discord'), { ok: true, value: '1290000000000000011' })
  assert.deepEqual(await people.accountIn('p-taguirre', 'identity'), { ok: true, value: 'demo:p-taguirre' })
})

test('accountIn sin cuenta en ese sistema devuelve «sin cuenta», y de una persona que no existe, «persona desconocida»', async () => {
  const people = build()

  assert.deepEqual(await people.accountIn('p-mcabrera', 'discord'), { ok: false, error: 'sin-cuenta' })
  assert.deepEqual(await people.accountIn('p-nadie', 'siu'), { ok: false, error: 'persona-desconocida' })
})

test('byExternalAccount encuentra a la dueña de un id externo, o nada', async () => {
  const people = build()

  assert.deepEqual(await people.byExternalAccount('siu', '20101'), { ok: true, value: 'p-mledesma' })
  assert.deepEqual(await people.byExternalAccount('discord', '1290000000000000012'), { ok: true, value: 'p-lbenitez' })
  assert.deepEqual(await people.byExternalAccount('moodle', '20101'), { ok: true, value: null })
})
