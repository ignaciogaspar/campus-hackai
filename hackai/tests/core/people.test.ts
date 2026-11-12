import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createFixedClock } from '@/lib/adapters/memoria/clock'
import { createMemoryIdentity } from '@/lib/adapters/memoria/identity'
import { createMemoryPeopleStore } from '@/lib/adapters/memoria/people-store'
import { createMemorySiu } from '@/lib/adapters/memoria/siu'
import { syntheticData } from '@/lib/adapters/synthetic-data'
import { createPeople } from '@/lib/core/people'
import type { IdentityPort } from '@/lib/ports/identity'
import type { SiuPort } from '@/lib/ports/siu'
import { fail, ok } from '@/lib/result'

function build(overrides: { siu?: Partial<SiuPort>; identity?: Partial<IdentityPort> } = {}) {
  const clock = createFixedClock(syntheticData.now)
  const siu = { ...createMemorySiu(syntheticData, clock), ...overrides.siu }
  const identity = { ...createMemoryIdentity(syntheticData), ...overrides.identity }
  return createPeople({
    identity,
    siu,
    store: createMemoryPeopleStore(syntheticData)
  })
}

const fantasma = { subject: 'demo:p-fantasma', name: 'Sujeto sin persona' }

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
        { id: 'asp-fi', name: 'Aspirantes - fi', status: 'pasiva' }
      ]
    }
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

test('get con el SIU caído devuelve la persona como la leyó la última vez, y una que nunca leyó, «falla externa»', async () => {
  let down = false
  const real = createMemorySiu(syntheticData, createFixedClock(syntheticData.now))
  const people = build({ siu: { person: (id) => (down ? Promise.resolve(fail('falla-externa')) : real.person(id)) } })
  const first = await people.get('p-taguirre')
  assert.ok(first.ok)

  down = true

  assert.deepEqual(await people.get('p-taguirre'), first)
  assert.deepEqual(await people.get('p-vfunes'), { ok: false, error: 'falla-externa' })
  // Una persona que no existe sigue siendo desconocida, no lo último leído.
  assert.deepEqual(await people.get('p-nadie'), { ok: false, error: 'persona-desconocida' })
})

test('get con el SIU caído y nada leído antes devuelve «falla externa» como valor', async () => {
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

test('signIn con una persona elegida de la lista de demo devuelve quién entra', async () => {
  const people = build()

  const alumno = await people.signIn({ kind: 'demo', subject: 'demo:p-taguirre' })
  assert.ok(alumno.ok)
  assert.equal(alumno.value.id, 'p-taguirre')
  assert.equal(alumno.value.name, 'Tomás Aguirre')
  assert.equal(alumno.value.role, 'alumno')
  assert.deepEqual(alumno.value.school, { id: 'fi', name: 'Facultad de Ingeniería' })

  const docente = await people.signIn({ kind: 'demo', subject: 'demo:p-cbustos' })
  assert.ok(docente.ok)
  assert.equal(docente.value.id, 'p-cbustos')
  assert.equal(docente.value.role, 'profesor')
})

test('signIn con una credencial que la identidad no reconoce devuelve «credencial inválida»', async () => {
  const people = build()

  assert.deepEqual(await people.signIn({ kind: 'demo', subject: 'demo:p-nadie' }), {
    ok: false,
    error: 'credencial-invalida'
  })
  // El selector de demo no sabe validar una cuenta de Microsoft.
  assert.deepEqual(
    await people.signIn({ kind: 'oidc', code: 'codigo', redirectUri: 'https://hackai.example/callback' }),
    { ok: false, error: 'credencial-invalida' }
  )
})

test('signIn de un sujeto válido que no está vinculado a ninguna persona devuelve «persona desconocida»', async () => {
  const people = build({ identity: { verify: async () => ok(fantasma) } })

  assert.deepEqual(await people.signIn({ kind: 'demo', subject: fantasma.subject }), {
    ok: false,
    error: 'persona-desconocida'
  })
})

test('signIn con la identidad o el SIU caídos devuelve «falla externa» como valor', async () => {
  const sinIdentidad = build({ identity: { verify: async () => fail('falla-externa') } })
  assert.deepEqual(await sinIdentidad.signIn({ kind: 'demo', subject: 'demo:p-taguirre' }), {
    ok: false,
    error: 'falla-externa'
  })

  const sinSiu = build({ siu: { person: async () => fail('falla-externa') } })
  assert.deepEqual(await sinSiu.signIn({ kind: 'demo', subject: 'demo:p-taguirre' }), {
    ok: false,
    error: 'falla-externa'
  })
})

test('demoPeople lista las personas sintéticas con su rol, facultad y propuestas', async () => {
  const listed = await build().demoPeople()
  assert.ok(listed.ok)

  assert.deepEqual(
    listed.value.map((p) => p.id),
    syntheticData.people.map((p) => p.id)
  )
  assert.equal(listed.value.filter((p) => p.role === 'alumno').length, 10)
  assert.equal(listed.value.filter((p) => p.role === 'profesor').length, 7)
  assert.deepEqual(
    listed.value.find((p) => p.id === 'p-agimenez'),
    {
      id: 'p-agimenez',
      name: 'Agustina Giménez',
      role: 'alumno',
      school: { id: 'fce', name: 'Facultad de Ciencias Empresariales' },
      programs: [{ id: 'ladm', name: 'Licenciatura en Administración de Empresas', status: 'activa' }]
    }
  )
})

test('demoPeople deja afuera a los sujetos que no están vinculados a ninguna persona', async () => {
  const identity = createMemoryIdentity(syntheticData)
  const people = build({
    identity: {
      async demoSubjects() {
        const subjects = await identity.demoSubjects()
        return subjects.ok ? ok([fantasma, ...subjects.value]) : subjects
      }
    }
  })

  const listed = await people.demoPeople()
  assert.ok(listed.ok)
  assert.deepEqual(
    listed.value.map((p) => p.id),
    syntheticData.people.map((p) => p.id)
  )
})

test('demoPeople con una identidad sin lista de demo devuelve «no soportado»', async () => {
  const people = build({
    identity: { capabilities: { demoList: false }, demoSubjects: async () => fail('no-soportado') }
  })

  assert.deepEqual(await people.demoPeople(), { ok: false, error: 'no-soportado' })
})

test('demoPeople con el SIU caído devuelve «falla externa» como valor', async () => {
  const people = build({ siu: { person: async () => fail('falla-externa') } })

  assert.deepEqual(await people.demoPeople(), { ok: false, error: 'falla-externa' })
})
