/* El Moodle simulado sin base: cómo se porta cuando la base no responde y qué
   pide a PostgREST. Lo que lee y escribe con la base andando lo prueba la
   batería de contrato (tests/contracts/classroom.test.ts), que necesita una
   base de prueba. */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createClient } from '@supabase/supabase-js'
import { createSimulatedMoodle } from '@/lib/adapters/moodle-simulado'
import { syntheticData } from '@/lib/adapters/synthetic-data'

function moodleWith(fetch: typeof globalThis.fetch, timeoutMs = 1000) {
  const logs: string[] = []
  const client = createClient('http://moodle-simulado.test', 'clave-de-prueba', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch }
  })
  const classroom = createSimulatedMoodle({
    client,
    baseUrl: syntheticData.moodle.baseUrl,
    timeoutMs,
    log: (message) => logs.push(message)
  })
  return { classroom, logs }
}

/** Una base que responde lo mínimo y anota cada pedido: una fila para quien se busca por id (existe), ninguna para el resto. */
function recordingBase() {
  const requests: { method: string; url: URL; headers: Headers }[] = []
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const request = new Request(input, init)
    requests.push({ method: request.method, url: new URL(request.url), headers: request.headers })
    if (request.method !== 'GET') return new Response(null, { status: 204 })
    const byId = new URL(request.url).searchParams.has('id')
    return new Response(JSON.stringify(byId ? [{ id: 'x' }] : []), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    })
  }
  return { fetch, requests }
}

test('declara que matricula y que tiene tareas con fecha', () => {
  const { classroom } = moodleWith(async () => new Response('[]'))
  assert.deepEqual(classroom.capabilities, { canEnrol: true, hasAssignments: true })
})

test('arma el enlace al aula sin consultar la base', () => {
  const { classroom } = moodleWith(async () => {
    throw new Error('no debería pedir nada')
  })
  assert.equal(classroom.courseUrl('c-am1-fi-a'), 'https://moodle.example.edu.ar/course/view.php?id=c-am1-fi-a')
})

test('si la base no responde a tiempo devuelve «falla externa» en vez de quedarse esperando', async () => {
  const { classroom, logs } = moodleWith(() => new Promise<Response>(() => {}), 50)

  const started = Date.now()
  assert.deepEqual(await classroom.coursesOf('401'), { ok: false, error: 'falla-externa' })
  assert.deepEqual(await classroom.coursesForSection('sec-am1-fi-a'), { ok: false, error: 'falla-externa' })
  assert.ok(Date.now() - started < 1000)
  assert.equal(logs.length, 2)
})

test('si la red falla, cada operación devuelve «falla externa» sin tirar', async () => {
  const { classroom, logs } = moodleWith(async () => {
    throw new TypeError('fetch failed')
  })

  assert.deepEqual(await classroom.coursesOf('401'), { ok: false, error: 'falla-externa' })
  assert.deepEqual(await classroom.enrol('404', 'c-pr1-fi-a', 'student'), { ok: false, error: 'falla-externa' })
  assert.deepEqual(await classroom.assignments('c-am1-fi-a'), { ok: false, error: 'falla-externa' })
  assert.ok(
    logs.every((line) => !line.includes('401') && !line.includes('404')),
    'los logs no llevan ids de usuarios'
  )
})

test('si la base responde con error devuelve «falla externa»', async () => {
  const { classroom } = moodleWith(
    async () => new Response(JSON.stringify({ code: '42P01', message: 'relation does not exist' }), { status: 404 })
  )

  assert.deepEqual(await classroom.coursesForSection('sec-am1-fi-a'), { ok: false, error: 'falla-externa' })
})

test('un curso o un usuario que la base no encuentra son «curso inexistente» y «usuario inexistente»', async () => {
  const { classroom } = moodleWith(
    async () => new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } })
  )

  assert.deepEqual(await classroom.contents('nada'), { ok: false, error: 'curso-inexistente' })
  assert.deepEqual(await classroom.assignments('nada'), { ok: false, error: 'curso-inexistente' })
  assert.deepEqual(await classroom.enrol('404', 'nada', 'student'), { ok: false, error: 'curso-inexistente' })
})

test('matricular con un usuario que la base no encuentra devuelve «usuario inexistente»', async () => {
  const courseOnly: typeof globalThis.fetch = async (input) => {
    const table = new URL(new Request(input).url).pathname.split('/').pop()
    return new Response(table === 'moodle_courses' ? '[{"id":"c-pr1-fi-a"}]' : '[]', {
      status: 200,
      headers: { 'content-type': 'application/json' }
    })
  }
  const { classroom } = moodleWith(courseOnly)

  assert.deepEqual(await classroom.enrol('999999', 'c-pr1-fi-a', 'student'), {
    ok: false,
    error: 'usuario-inexistente'
  })
  assert.deepEqual(await classroom.unenrol('999999', 'c-pr1-fi-a'), { ok: false, error: 'usuario-inexistente' })
})

test('pide a PostgREST los cursos de un usuario y los de una comisión', async () => {
  const { fetch, requests } = recordingBase()
  const { classroom } = moodleWith(fetch)

  assert.deepEqual(await classroom.coursesOf('401'), { ok: true, value: [] })
  assert.deepEqual(await classroom.coursesForSection('sec-am1-fi-a'), { ok: true, value: [] })

  const [enrolments, courses] = requests
  assert.equal(enrolments.url.pathname, '/rest/v1/moodle_enrolments')
  assert.equal(enrolments.url.searchParams.get('select'), '*,course:moodle_courses(*)')
  assert.equal(enrolments.url.searchParams.get('user_id'), 'eq.401')
  assert.equal(courses.url.pathname, '/rest/v1/moodle_courses')
  assert.equal(courses.url.searchParams.get('siu_section_ids'), 'cs.{sec-am1-fi-a}')
})

test('matricula con un upsert por usuario y curso, y desmatricula con un delete de esa fila', async () => {
  const { fetch, requests } = recordingBase()
  const { classroom } = moodleWith(fetch)

  assert.deepEqual(await classroom.enrol('404', 'c-pr1-fi-a', 'student'), {
    ok: true,
    value: { userId: '404', courseId: 'c-pr1-fi-a', role: 'student' }
  })
  assert.deepEqual(await classroom.unenrol('404', 'c-pr1-fi-a'), { ok: true, value: null })

  const upsert = requests.find((r) => r.method === 'POST')!
  assert.equal(upsert.url.pathname, '/rest/v1/moodle_enrolments')
  assert.equal(upsert.url.searchParams.get('on_conflict'), 'user_id,course_id')
  assert.match(upsert.headers.get('prefer') ?? '', /resolution=merge-duplicates/)
  const remove = requests.find((r) => r.method === 'DELETE')!
  assert.equal(remove.url.searchParams.get('user_id'), 'eq.404')
  assert.equal(remove.url.searchParams.get('course_id'), 'eq.c-pr1-fi-a')
})

test('los avisos posteriores a `since` se piden con una comparación estricta', async () => {
  const { fetch, requests } = recordingBase()
  const { classroom } = moodleWith(fetch)

  await classroom.announcements('c-am1-fi-a', '2026-11-01T00:00:00.000Z')

  const announcements = requests.find((r) => r.url.pathname === '/rest/v1/moodle_announcements')!
  assert.equal(announcements.url.searchParams.get('course_id'), 'eq.c-am1-fi-a')
  assert.equal(announcements.url.searchParams.get('created_at'), 'gt.2026-11-01T00:00:00.000Z')
})

test('las fechas que devuelve Postgres salen en ISO 8601 de toISOString', async () => {
  const rows: Record<string, unknown> = {
    moodle_courses: { id: 'c-am1-fi-a' },
    moodle_announcements: [
      {
        id: 'av-1',
        course_id: 'c-am1-fi-a',
        author_id: '301',
        subject: 's',
        message: 'm',
        created_at: '2026-11-06T20:12:00+00:00',
        attachments: []
      }
    ],
    moodle_assignments: [
      { id: 't-3', course_id: 'c-am1-fi-a', name: 'Guía 3', due_date: '2026-11-14T02:59:00+00:00' },
      { id: 't-5', course_id: 'c-am1-fi-a', name: 'Sin fecha', due_date: null }
    ]
  }
  const { classroom } = moodleWith(async (input) => {
    const table = new URL(new Request(input).url).pathname.split('/').pop()!
    return new Response(JSON.stringify(rows[table]), { status: 200, headers: { 'content-type': 'application/json' } })
  })

  const announcements = await classroom.announcements('c-am1-fi-a')
  assert.ok(announcements.ok)
  assert.equal(announcements.value[0].createdAt, '2026-11-06T20:12:00.000Z')
  const assignments = await classroom.assignments('c-am1-fi-a')
  assert.ok(assignments.ok)
  assert.deepEqual(
    assignments.value.map((a) => a.dueDate),
    ['2026-11-14T02:59:00.000Z', null]
  )
})
