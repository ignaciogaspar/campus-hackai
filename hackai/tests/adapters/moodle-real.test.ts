/* Moodle real (ADR 0010), sin red: un `fetch` falso responde como los Web
   Services de Moodle 5.1, con datos inventados. Cubre el canje de la sesión
   por el token, la traducción de cada respuesta al puerto, el registro por
   cuenta y la cookie del Campus. Research:
   docs/research/2026-11-13-inventario-cursos-campus.md. */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { test } from 'node:test'
import { createMemoryClassroom } from '@/lib/adapters/memoria/classroom'
import { createRealMoodle } from '@/lib/adapters/moodle-real'
import { formOf, tokenFromSession } from '@/lib/adapters/moodle-real/client'
import { htmlToText, type MapContext, submissionOf, toContents, type WsSection } from '@/lib/adapters/moodle-real/map'
import { createRealMoodleRegistry } from '@/lib/adapters/moodle-real/registry'
import { syntheticData } from '@/lib/adapters/synthetic-data'
import { campusSessionOf, moodleSessionFromInput, sealCampusSession } from '@/lib/campus-session'
import { ok } from '@/lib/result'

const BASE = 'https://campus.example.edu.ar'
const TOKEN = 'a'.repeat(32)
const KEY = 'abcdef123456'
const PREFIX = `real-${KEY}-`
const SECTION = `${PREFIX}am1-a-2c-2026`

const ctx: MapContext = {
  baseUrl: BASE,
  prefix: PREFIX,
  fileUrl: (url) => url.replace(`${BASE}/webservice/pluginfile.php/`, '/aula/archivos/').split('?')[0]
}

const file = (filename: string, extra: Record<string, unknown> = {}) => ({
  type: 'file',
  filename,
  filepath: '/',
  filesize: 1000,
  fileurl: `${BASE}/webservice/pluginfile.php/11/mod_resource/content/1/${filename}?forcedownload=1`,
  mimetype: 'application/pdf',
  timemodified: 1_760_000_000,
  ...extra
})

const SECTIONS: WsSection[] = [
  {
    id: 1,
    name: '',
    section: 0,
    modules: [
      { id: 101, name: 'Avisos', modname: 'forum', url: `${BASE}/mod/forum/view.php?id=101` },
      { id: 102, name: 'Programa', modname: 'page', url: `${BASE}/mod/page/view.php?id=102`, contents: [] }
    ]
  },
  {
    id: 2,
    name: 'Unidad 1',
    section: 1,
    modules: [
      { id: 103, name: 'Traigan la guía', modname: 'label', description: '<p>Traigan la <b>guía</b> impresa.</p>' },
      { id: 104, name: 'Guía 1', modname: 'resource', contents: [file('guia-1.pdf')] },
      {
        id: 105,
        name: 'Parciales',
        modname: 'folder',
        url: `${BASE}/mod/folder/view.php?id=105`,
        contents: [file('2024.pdf', { filepath: '/viejos/' }), file('2025.pdf')]
      },
      {
        id: 106,
        name: 'Apunte',
        modname: 'url',
        contents: [{ type: 'url', filename: 'Apunte', fileurl: 'https://apuntes.example.org/am1' }]
      },
      { id: 107, name: 'Oculto', modname: 'resource', uservisible: false, contents: [file('oculto.pdf')] },
      { id: 108, name: 'Subtema', modname: 'subsection' },
      { id: 109, name: 'Autoevaluación', modname: 'quiz', url: `${BASE}/mod/quiz/view.php?id=109` }
    ]
  },
  { id: 3, name: 'Restringida', section: 2, uservisible: false, modules: [{ id: 110, name: 'X', modname: 'page' }] }
]

test('los parámetros van como los pide Moodle: listas y objetos con corchetes', () => {
  assert.equal(
    formOf({ courseids: [3, 4], options: [{ name: 'x', value: true }], userid: 7 }).toString(),
    'courseids%5B0%5D=3&courseids%5B1%5D=4&options%5B0%5D%5Bname%5D=x&options%5B0%5D%5Bvalue%5D=1&userid=7'
  )
})

test('el HTML de Moodle llega como texto: párrafos y renglones separados, sin etiquetas ni scripts', () => {
  assert.equal(
    htmlToText(
      '<p>Hola&nbsp;a&nbsp;todos</p><ul><li>Uno</li><li>Dos &amp; tres</li></ul><script>alert(1)</script><p>Fin&iacute;</p>'
    ),
    'Hola a todos\n\n• Uno\n\n• Dos & tres\n\nFiní'
  )
  assert.equal(htmlToText('Línea<br>otra<br/>&#8212; &#x41;'), 'Línea\notra\n— A')
})

test('los elementos del curso salen en el orden del aula, cada uno con lo suyo, sin lo que el alumno no ve', () => {
  const contents = toContents(
    `${PREFIX}aula-9`,
    SECTIONS,
    [{ coursemodule: 102, content: '<p>Se aprueba con 4.</p>' }],
    1_754_000_000,
    ctx
  )

  assert.deepEqual(
    contents.map((c) => [c.position, c.topic, c.name, c.type, c.activity]),
    [
      [0, 'General', 'Avisos', 'activity', 'forum'],
      [1, 'General', 'Programa', 'page', null],
      [2, 'Unidad 1', 'Traigan la guía', 'label', null],
      [3, 'Unidad 1', 'Guía 1', 'file', null],
      [4, 'Unidad 1', 'Parciales', 'folder', null],
      [5, 'Unidad 1', 'Apunte', 'url', null],
      [6, 'Unidad 1', 'Autoevaluación', 'activity', 'quiz']
    ]
  )
  const byName = (name: string) => contents.find((c) => c.name === name)!
  assert.equal(byName('Guía 1').id, `${PREFIX}cm-104`)
  assert.equal(
    byName('Guía 1').url,
    '/aula/archivos/11/mod_resource/content/1/guia-1.pdf',
    'el archivo pasa por HackAI'
  )
  assert.deepEqual(byName('Guía 1').files, [
    {
      name: 'guia-1.pdf',
      url: '/aula/archivos/11/mod_resource/content/1/guia-1.pdf',
      contentType: 'application/pdf',
      size: 1000
    }
  ])
  assert.deepEqual(
    byName('Parciales').files.map((f) => f.name),
    ['viejos/2024.pdf', '2025.pdf']
  )
  assert.equal(byName('Parciales').url, `${BASE}/mod/folder/view.php?id=105`)
  assert.equal(byName('Programa').text, 'Se aprueba con 4.')
  assert.equal(byName('Traigan la guía').text, 'Traigan la guía impresa.')
  assert.equal(byName('Traigan la guía').url, '')
  assert.equal(byName('Apunte').url, 'https://apuntes.example.org/am1')
  // Lo que Moodle no fecha va con el inicio del curso; un archivo, con su última modificación.
  assert.equal(byName('Autoevaluación').modifiedAt, new Date(1_754_000_000_000).toISOString())
  assert.equal(byName('Guía 1').modifiedAt, new Date(1_760_000_000_000).toISOString())
})

test('la entrega: enviada es «entregada», un borrador es «borrador» y lo demás está sin entregar', () => {
  assert.equal(submissionOf({ lastattempt: { submission: { status: 'submitted' } } }), 'entregada')
  assert.equal(submissionOf({ lastattempt: { submission: { status: 'draft' } } }), 'borrador')
  assert.equal(submissionOf({ lastattempt: { submission: { status: 'new' } } }), 'sin-entregar')
  assert.equal(submissionOf({ lastattempt: { teamsubmission: { status: 'submitted' } } }), 'entregada')
  assert.equal(submissionOf({}), 'sin-entregar')
})

// El canje de la sesión por el token.

/** El enlace que arma launch.php: `<esquema>://token=base64(md5(wwwroot + passport):::token)`. */
function launchLink(url: string, site = BASE, token = TOKEN) {
  const passport = new URL(url).searchParams.get('passport') ?? ''
  const signature = createHash('md5').update(`${site}${passport}`).digest('hex')
  return `moodlemobile://token=${Buffer.from(`${signature}:::${token}:::privado`).toString('base64')}`
}

test('canjea la sesión del Campus por el token de la app, con la cookie y sin seguir la redirección', async () => {
  const seen: { url: string; cookie: string | null; redirect: string | undefined }[] = []
  const result = await tokenFromSession({
    baseUrl: BASE,
    session: 'sesion-del-campus',
    fetch: async (input, init) => {
      const url = String(input)
      seen.push({ url, cookie: new Headers(init?.headers).get('cookie'), redirect: init?.redirect })
      return new Response(null, { status: 303, headers: { location: launchLink(url) } })
    }
  })

  assert.deepEqual(result, ok(TOKEN))
  assert.match(
    seen[0].url,
    /^https:\/\/campus\.example\.edu\.ar\/admin\/tool\/mobile\/launch\.php\?service=moodle_mobile_app&passport=[a-f0-9]{16}&urlscheme=moodlemobile$/
  )
  assert.equal(seen[0].cookie, 'MoodleSession=sesion-del-campus')
  assert.equal(seen[0].redirect, 'manual')
})

test('el token también sale de la página que simula el click en la app', async () => {
  const result = await tokenFromSession({
    baseUrl: BASE,
    session: 's',
    fetch: async (input) =>
      new Response(`<a id="launchapp" href="${launchLink(String(input))}">Abrir la app</a>`, { status: 200 })
  })
  assert.deepEqual(result, ok(TOKEN))
})

test('sin sesión el Campus manda al ingreso: «sesión inválida»; una respuesta de otro sitio no se acepta', async () => {
  const toLogin = await tokenFromSession({
    baseUrl: BASE,
    session: 's',
    fetch: async () => new Response(null, { status: 303, headers: { location: `${BASE}/login/index.php` } })
  })
  assert.deepEqual(toLogin, { ok: false, error: 'sesion-invalida' })

  const otherSite = await tokenFromSession({
    baseUrl: BASE,
    session: 's',
    fetch: async (input) =>
      new Response(null, { status: 303, headers: { location: launchLink(String(input), 'https://otro.example') } })
  })
  assert.deepEqual(otherSite, { ok: false, error: 'falla-externa' })

  const down = await tokenFromSession({
    baseUrl: BASE,
    session: 's',
    fetch: async () => {
      throw new Error('sin red')
    }
  })
  assert.deepEqual(down, { ok: false, error: 'falla-externa' })
})

// La cuenta: los Web Services con un `fetch` falso.

type Responses = Record<string, (params: URLSearchParams) => unknown>

const COURSE = { id: 9, shortname: 'AM1-A', fullname: 'Análisis Matemático I - A', startdate: 1_754_000_000 }

const RESPONSES: Responses = {
  core_webservice_get_site_info: () => ({ userid: 77, sitename: 'Campus' }),
  core_enrol_get_users_courses: (p) => {
    assert.equal(p.get('userid'), '77')
    return [COURSE, { id: 10, shortname: 'OTRO', fullname: 'Otro curso', startdate: 0 }]
  },
  core_course_get_contents: (p) => {
    assert.equal(p.get('courseid'), '9')
    return SECTIONS
  },
  mod_page_get_pages_by_courses: () => ({ pages: [{ coursemodule: 102, content: '<p>Se aprueba con 4.</p>' }] }),
  mod_forum_get_forums_by_courses: () => [
    { id: 5, course: 9, type: 'general' },
    { id: 6, course: 9, type: 'news' }
  ],
  mod_forum_get_forum_discussions: (p) => {
    assert.equal(p.get('forumid'), '6')
    return {
      discussions: [
        {
          discussion: 31,
          subject: 'Cambio de aula',
          message: '<p>El parcial es en el aula 20.</p>',
          created: 1_762_000_000,
          userid: 4,
          userfullname: '<docente>',
          attachments: [file('temas.pdf')]
        },
        { discussion: 30, subject: 'Bienvenida', message: '<p>Hola.</p>', created: 1_755_000_000, userid: 4 }
      ]
    }
  },
  mod_assign_get_assignments: () => ({
    courses: [
      {
        id: 9,
        assignments: [
          { id: 41, cmid: 141, course: 9, name: 'Guía 3', duedate: 1_763_000_000, intro: '<p>Subí la guía.</p>' },
          { id: 42, cmid: 142, course: 9, name: 'Sin fecha', duedate: 0 }
        ]
      }
    ]
  }),
  mod_assign_get_submission_status: (p) =>
    p.get('assignid') === '41' ? { lastattempt: { submission: { status: 'submitted' } } } : { lastattempt: {} }
}

function fakeMoodle(responses: Responses = RESPONSES) {
  const calls: string[] = []
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = new URL(String(input))
    if (url.pathname.includes('pluginfile.php')) {
      calls.push(`archivo ${url.searchParams.get('token') === TOKEN ? 'con token' : 'sin token'}`)
      return new Response('%PDF', { status: 200, headers: { 'content-type': 'application/pdf' } })
    }
    const params = new URLSearchParams(String(init?.body ?? ''))
    const fn = params.get('wsfunction') ?? ''
    assert.equal(params.get('wstoken'), TOKEN)
    calls.push(fn)
    const respond = responses[fn]
    const body = respond ? respond(params) : { exception: 'webservice_access_exception', errorcode: 'accessexception' }
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  return { fetch, calls }
}

function account(responses?: Responses, now = () => 0) {
  const fake = fakeMoodle(responses)
  const moodle = createRealMoodle({
    baseUrl: BASE,
    token: TOKEN,
    prefix: PREFIX,
    links: async () => ok([{ sectionId: SECTION, courseId: '9' }]),
    fileUrl: ctx.fileUrl,
    fetch: fake.fetch,
    warn: () => {},
    now
  })
  return { moodle, calls: fake.calls }
}

test('el curso de una comisión sale del enlace del SIU, si está matriculada, y se lee en vivo', async () => {
  const { moodle } = account()

  assert.deepEqual(await moodle.coursesForSection(SECTION), {
    ok: true,
    value: [
      {
        id: `${PREFIX}aula-9`,
        shortName: 'AM1-A',
        fullName: 'Análisis Matemático I - A',
        siuSectionIds: [SECTION],
        liveOnly: true
      }
    ]
  })
  assert.deepEqual(await moodle.coursesForSection(`${PREFIX}otra`), { ok: true, value: [] })
  assert.equal(moodle.courseUrl(`${PREFIX}aula-9`), `${BASE}/course/view.php?id=9`)
  assert.deepEqual(moodle.capabilities, { canEnrol: false, hasAssignments: true })
  assert.deepEqual(await moodle.enrol(`${PREFIX}u-77`, `${PREFIX}aula-9`, 'student'), {
    ok: false,
    error: 'no-soportado'
  })
})

test('los elementos, los avisos y las tareas del curso, con su entrega', async () => {
  const { moodle } = account()
  const courseId = `${PREFIX}aula-9`

  const contents = await moodle.contents(courseId)
  assert.ok(contents.ok)
  assert.equal(contents.value.length, 7)
  assert.equal(contents.value.find((c) => c.type === 'page')?.text, 'Se aprueba con 4.')

  const announcements = await moodle.announcements(courseId)
  assert.ok(announcements.ok)
  assert.deepEqual(
    announcements.value.map((a) => [a.id, a.subject, a.message, a.authorId, a.authorName ?? null]),
    [
      [`${PREFIX}aviso-30`, 'Bienvenida', 'Hola.', `${PREFIX}u-4`, null],
      [`${PREFIX}aviso-31`, 'Cambio de aula', 'El parcial es en el aula 20.', `${PREFIX}u-4`, '<docente>']
    ],
    'del más viejo al más nuevo, en texto'
  )
  assert.equal(announcements.value[1].attachments[0].url, '/aula/archivos/11/mod_resource/content/1/temas.pdf')
  const since = await moodle.announcements(courseId, new Date(1_760_000_000_000).toISOString())
  assert.ok(since.ok)
  assert.deepEqual(
    since.value.map((a) => a.id),
    [`${PREFIX}aviso-31`]
  )

  assert.deepEqual(await moodle.assignments(courseId), {
    ok: true,
    value: [
      {
        id: `${PREFIX}tarea-41`,
        courseId,
        name: 'Guía 3',
        dueDate: new Date(1_763_000_000_000).toISOString(),
        description: 'Subí la guía.',
        url: `${BASE}/mod/assign/view.php?id=141`,
        submission: 'entregada'
      },
      {
        id: `${PREFIX}tarea-42`,
        courseId,
        name: 'Sin fecha',
        dueDate: null,
        description: null,
        url: `${BASE}/mod/assign/view.php?id=142`,
        submission: 'sin-entregar'
      }
    ]
  })
})

test('un curso que no es de la cuenta no existe, y nunca se pide a Moodle', async () => {
  const { moodle, calls } = account()
  assert.deepEqual(await moodle.contents('c-am1-fi-a'), { ok: false, error: 'curso-inexistente' })
  assert.deepEqual(await moodle.contents(`${PREFIX}aula-999`), { ok: false, error: 'curso-inexistente' })
  assert.equal(calls.includes('core_course_get_contents'), false)
})

test('cada lectura se guarda un minuto: la segunda vez no vuelve a Moodle, después del minuto sí', async () => {
  let now = 0
  const { moodle, calls } = account(undefined, () => now)
  const count = () => calls.filter((c) => c === 'core_course_get_contents').length

  await moodle.contents(`${PREFIX}aula-9`)
  await moodle.contents(`${PREFIX}aula-9`)
  assert.equal(count(), 1)
  now = 60_000
  await moodle.contents(`${PREFIX}aula-9`)
  assert.equal(count(), 2)
})

test('con un token que Moodle ya no reconoce, las lecturas son falla externa y la cuenta queda vencida', async () => {
  const { moodle } = account({
    core_webservice_get_site_info: () => ({ exception: 'moodle_exception', errorcode: 'invalidtoken' })
  })
  assert.equal(moodle.expired(), false)
  assert.deepEqual(await moodle.coursesForSection(SECTION), { ok: false, error: 'falla-externa' })
  assert.equal(moodle.expired(), true)
})

test('un archivo del Campus se pide con el token y nunca a otro sitio', async () => {
  const { moodle, calls } = account()
  const found = await moodle.download(`${BASE}/webservice/pluginfile.php/11/mod_resource/content/1/guia-1.pdf`)
  assert.ok(found.ok)
  assert.equal(found.value.contentType, 'application/pdf')
  assert.deepEqual(calls, ['archivo con token'])
  assert.deepEqual(await moodle.download('https://otro.example/pluginfile.php/1/a.pdf'), {
    ok: false,
    error: 'no-encontrado'
  })
  // Una ruta que con `..` sale de pluginfile.php no lleva el token a otra pantalla del Campus.
  for (const outside of [
    '/webservice/pluginfile.php/../../login/index.php',
    '/webservice/pluginfile.php/%2e%2e/x',
    '/user/profile.php'
  ])
    assert.deepEqual(await moodle.download(`${BASE}${outside}`), { ok: false, error: 'no-encontrado' }, outside)
  assert.deepEqual(calls, ['archivo con token'], 'ningún pedido más')
})

// El registro: cada id a su cuenta, lo demás al aula de la demo.

function registry() {
  const fake = fakeMoodle()
  const campus = createRealMoodleRegistry({
    baseUrl: BASE,
    fallback: createMemoryClassroom(syntheticData),
    linksOf: async (key) => ok(key === KEY ? [{ sectionId: SECTION, courseId: '9' }] : []),
    fileUrl: ctx.fileUrl,
    fetch: fake.fetch,
    warn: () => {}
  })
  return { campus, calls: fake.calls }
}

test('el registro manda lo de cada cuenta a su Campus y lo de la demo al aula de la demo', async () => {
  const { campus, calls } = registry()

  // Sin conectar: la comisión real no tiene cursos y no se le pregunta a nadie.
  assert.deepEqual(await campus.coursesForSection(SECTION), { ok: true, value: [] })
  assert.deepEqual(await campus.contents(`${PREFIX}aula-9`), { ok: false, error: 'curso-inexistente' })
  assert.deepEqual(calls, [])

  campus.register(KEY, TOKEN)
  const real = await campus.coursesForSection(SECTION)
  assert.ok(real.ok)
  assert.deepEqual(
    real.value.map((c) => c.id),
    [`${PREFIX}aula-9`]
  )
  assert.ok(campus.accountOf(KEY))

  const demo = await campus.coursesForSection('sec-am1-fi-a')
  assert.ok(demo.ok)
  assert.deepEqual(
    demo.value.map((c) => c.id),
    ['c-am1-fi-a']
  )
  assert.equal(campus.courseUrl(`${PREFIX}aula-9`), `${BASE}/course/view.php?id=9`)
  assert.equal(campus.courseUrl('c-am1-fi-a'), '/simulado/moodle/course/view.php?id=c-am1-fi-a')
  assert.deepEqual(await campus.enrol(`${PREFIX}u-77`, `${PREFIX}aula-9`, 'student'), {
    ok: false,
    error: 'no-soportado'
  })
})

// La cookie del Campus.

test('la cookie del Campus abre solo para la persona de su clave, y la sesión pegada se reconoce con o sin su nombre', () => {
  process.env.SESSION_SECRET ??= 'secreto-de-prueba-de-al-menos-32-caracteres'
  const sealed = sealCampusSession({ key: KEY, token: TOKEN })
  assert.deepEqual(campusSessionOf(KEY, sealed), { key: KEY, token: TOKEN })
  assert.equal(campusSessionOf('bbbbbbbbbbbb', sealed), null, 'de otra persona no abre')
  assert.equal(campusSessionOf(KEY, `${sealed.slice(0, -2)}xx`), null, 'una cookie tocada no abre')
  assert.equal(campusSessionOf(KEY, undefined), null)
  assert.equal(moodleSessionFromInput(' MoodleSession=abcdefghij0123456789xyz; path=/'), 'abcdefghij0123456789xyz')
  assert.equal(moodleSessionFromInput('abcdefghij0123456789xyz'), 'abcdefghij0123456789xyz')
  assert.equal(moodleSessionFromInput('corta'), null)
  assert.equal(moodleSessionFromInput('<script>alert(1)</script>xxxxxxxxxxxx'), null)
})
