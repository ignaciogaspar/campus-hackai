/* Batería de contrato del puerto del aula virtual. La misma corre contra el
   aula en memoria siempre, y contra el Moodle simulado solo si hay una base de
   prueba: HACKAI_TEST_SUPABASE_URL y HACKAI_TEST_SUPABASE_SERVICE_ROLE_KEY,
   con supabase/simulados/0002_moodle.sql y moodle_seed.sql aplicados. Cada
   caso que matricula deja las matrículas como las encontró, porque contra la
   base las corridas se repiten. */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createClient } from '@supabase/supabase-js'
import { createMemoryClassroom } from '@/lib/adapters/memoria/classroom'
import { createSimulatedMoodle } from '@/lib/adapters/moodle-simulado'
import { syntheticData } from '@/lib/adapters/synthetic-data'
import type { ClassroomPort } from '@/lib/ports/classroom'

const moodle = syntheticData.moodle
const moodleId = (personId: string) => syntheticData.people.find((p) => p.id === personId)!.moodleId
const byId = <T extends { id: string }>(items: T[]) => [...items].sort((a, b) => a.id.localeCompare(b.id))
const course = (id: string) => moodle.courses.find((c) => c.id === id)!

function classroomContract(name: string, make: () => ClassroomPort, skip: string | false = false) {
  const it = (title: string, fn: (classroom: ClassroomPort) => Promise<void> | void) =>
    test(`${name}: ${title}`, { skip }, () => fn(make()))

  it('declara que matricula y que tiene tareas con fecha', (classroom) => {
    assert.deepEqual(classroom.capabilities, { canEnrol: true, hasAssignments: true })
  })

  it('devuelve los cursos de un usuario con su rol, y ninguno si no tiene', async (classroom) => {
    const tomas = await classroom.coursesOf(moodleId('p-taguirre'))
    assert.ok(tomas.ok)
    assert.deepEqual(
      byId(tomas.value),
      byId(
        moodle.enrolments
          .filter((e) => e.userId === moodleId('p-taguirre'))
          .map((e) => ({ ...course(e.courseId), role: e.role }))
      )
    )
    assert.deepEqual(tomas.value.map((c) => [c.id, c.role]).sort(), [
      ['c-aga-fi-a', 'student'],
      ['c-am1-fi-a', 'student'],
      ['c-fi1-fi-1c', 'student'],
      ['c-pr1-fi-a', 'student'],
      ['c-sre-fi-a', 'student']
    ])

    const mariana = await classroom.coursesOf(moodleId('p-mledesma'))
    assert.ok(mariana.ok)
    assert.deepEqual(mariana.value.map((c) => [c.id, c.role]).sort(), [
      ['c-aga-fi-a', 'editingteacher'],
      ['c-am1-fi-a', 'editingteacher']
    ])

    assert.deepEqual(await classroom.coursesOf('999999'), { ok: true, value: [] })
  })

  it('devuelve los cursos vinculados a una comisión del SIU', async (classroom) => {
    assert.deepEqual(await classroom.coursesForSection('sec-am1-fi-a'), { ok: true, value: [course('c-am1-fi-a')] })
    assert.deepEqual(await classroom.coursesForSection('nada'), { ok: true, value: [] })
  })

  it('matricula con un rol, cambia el rol y no duplica la matrícula', async (classroom) => {
    const sofia = moodleId('p-sdominguez')
    const courseId = 'c-pr1-fi-a'
    await classroom.unenrol(sofia, courseId)
    const rolesIn = async () => {
      const mine = await classroom.coursesOf(sofia)
      assert.ok(mine.ok)
      return mine.value.filter((c) => c.id === courseId).map((c) => c.role)
    }

    assert.deepEqual(await rolesIn(), [])
    try {
      assert.deepEqual(await classroom.enrol(sofia, courseId, 'student'), {
        ok: true,
        value: { userId: sofia, courseId, role: 'student' }
      })
      assert.deepEqual(await rolesIn(), ['student'])

      assert.deepEqual(await classroom.enrol(sofia, courseId, 'student'), {
        ok: true,
        value: { userId: sofia, courseId, role: 'student' }
      })
      assert.deepEqual(await rolesIn(), ['student'])

      assert.deepEqual(await classroom.enrol(sofia, courseId, 'editingteacher'), {
        ok: true,
        value: { userId: sofia, courseId, role: 'editingteacher' }
      })
      assert.deepEqual(await rolesIn(), ['editingteacher'])
    } finally {
      await classroom.unenrol(sofia, courseId)
    }
    assert.deepEqual(await rolesIn(), [])
  })

  it('desmatricula, y desmatricular a quien no está matriculado no es un error', async (classroom) => {
    const sofia = moodleId('p-sdominguez')
    const courseId = 'c-pr1-fi-a'
    await classroom.unenrol(sofia, courseId)
    try {
      assert.ok((await classroom.enrol(sofia, courseId, 'student')).ok)
      assert.deepEqual(await classroom.unenrol(sofia, courseId), { ok: true, value: null })
      assert.deepEqual(await classroom.unenrol(sofia, courseId), { ok: true, value: null })
    } finally {
      await classroom.unenrol(sofia, courseId)
    }
    const mine = await classroom.coursesOf(sofia)
    assert.ok(mine.ok)
    assert.equal(
      mine.value.some((c) => c.id === courseId),
      false
    )
  })

  it('desmatricular de un curso no toca las matrículas de otros', async (classroom) => {
    const sofia = moodleId('p-sdominguez')
    const before = await classroom.coursesOf(sofia)
    assert.ok(before.ok)

    assert.deepEqual(await classroom.unenrol(sofia, 'c-pr1-fi-a'), { ok: true, value: null })

    assert.deepEqual(await classroom.coursesOf(sofia), before)
  })

  it('rechaza matricular o desmatricular en un curso o con un usuario que no existen', async (classroom) => {
    const sofia = moodleId('p-sdominguez')
    assert.deepEqual(await classroom.enrol(sofia, 'nada', 'student'), { ok: false, error: 'curso-inexistente' })
    assert.deepEqual(await classroom.enrol('999999', 'c-pr1-fi-a', 'student'), {
      ok: false,
      error: 'usuario-inexistente'
    })
    assert.deepEqual(await classroom.unenrol(sofia, 'nada'), { ok: false, error: 'curso-inexistente' })
    assert.deepEqual(await classroom.unenrol('999999', 'c-pr1-fi-a'), { ok: false, error: 'usuario-inexistente' })
    const none = await classroom.coursesOf('999999')
    assert.deepEqual(none, { ok: true, value: [] })
  })

  it('devuelve los avisos del curso, solo los posteriores a `since` si se lo pasa', async (classroom) => {
    const aviso = moodle.announcements.find((a) => a.id === 'av-1')!
    assert.deepEqual(await classroom.announcements('c-am1-fi-a'), { ok: true, value: [aviso] })
    assert.deepEqual(await classroom.announcements('c-am1-fi-a', '2026-11-01T00:00:00.000Z'), {
      ok: true,
      value: [aviso]
    })
    assert.deepEqual(await classroom.announcements('c-am1-fi-a', aviso.createdAt), { ok: true, value: [] })
    assert.deepEqual(await classroom.announcements('c-am1-fi-a', '2026-12-01T00:00:00.000Z'), { ok: true, value: [] })
    assert.deepEqual(await classroom.announcements('c-am1-fi-b'), { ok: true, value: [] })
    assert.deepEqual(await classroom.announcements('nada'), { ok: false, error: 'curso-inexistente' })
  })

  it('devuelve los avisos con sus adjuntos', async (classroom) => {
    const aviso = moodle.announcements.find((a) => a.id === 'av-2')!
    assert.equal(aviso.attachments.length, 1)
    assert.deepEqual(await classroom.announcements('c-co1-fce-a'), { ok: true, value: [aviso] })
  })

  it('devuelve los contenidos del curso', async (classroom) => {
    const found = await classroom.contents('c-am1-fi-a')
    assert.ok(found.ok)
    assert.deepEqual(byId(found.value), byId(moodle.contents.filter((c) => c.courseId === 'c-am1-fi-a')))
    assert.deepEqual(found.value.map((c) => c.id).sort(), ['r-1', 'r-2'])
    assert.deepEqual(await classroom.contents('c-co1-fce-a'), { ok: true, value: [] })
    assert.deepEqual(await classroom.contents('nada'), { ok: false, error: 'curso-inexistente' })
  })

  it('devuelve las tareas del curso, con fecha o sin ella', async (classroom) => {
    const found = await classroom.assignments('c-pr1-fi-a')
    assert.ok(found.ok)
    assert.deepEqual(byId(found.value), byId(moodle.assignments.filter((a) => a.courseId === 'c-pr1-fi-a')))
    assert.deepEqual(found.value.map((a) => a.id).sort(), ['t-1', 't-2'])

    const undated = await classroom.assignments('c-co1-fce-a')
    assert.deepEqual(undated, {
      ok: true,
      value: [{ id: 't-4', courseId: 'c-co1-fce-a', name: 'Práctico de asientos', dueDate: null }]
    })

    assert.deepEqual(await classroom.assignments('c-am1-fi-b'), { ok: true, value: [] })
    assert.deepEqual(await classroom.assignments('nada'), { ok: false, error: 'curso-inexistente' })
  })

  it('arma el enlace al aula del curso', (classroom) => {
    assert.equal(classroom.courseUrl('c-am1-fi-a'), `${moodle.baseUrl}/course/view.php?id=c-am1-fi-a`)
    assert.equal(classroom.courseUrl('a b'), `${moodle.baseUrl}/course/view.php?id=a%20b`)
  })
}

classroomContract('Aula en memoria', () => createMemoryClassroom(syntheticData))

const url = process.env.HACKAI_TEST_SUPABASE_URL
const key = process.env.HACKAI_TEST_SUPABASE_SERVICE_ROLE_KEY
classroomContract(
  'Moodle simulado',
  () =>
    createSimulatedMoodle({
      client: createClient(url!, key!, { auth: { persistSession: false, autoRefreshToken: false } }),
      baseUrl: moodle.baseUrl
    }),
  url && key ? false : 'sin base de prueba: definí HACKAI_TEST_SUPABASE_URL y HACKAI_TEST_SUPABASE_SERVICE_ROLE_KEY'
)
