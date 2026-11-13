/* La entrega de un archivo guardado: lo que responde `/archivos/<id>/<nombre>`
   según quién lo pide. Usa el sistema armado con los adaptadores en memoria,
   así quién ve cada archivo lo deciden las reglas reales de Espacios. */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import { compose } from '@/lib/composition'
import { deliverFile, fileFrom } from '@/lib/file-delivery'

/** Un PDF chico: alcanza con que empiece como uno. */
const PDF = new TextEncoder().encode('%PDF-1.4\n%%EOF\n')

/** El sistema con todo en memoria y la materia AM1 abierta por su docente. */
async function am1() {
  const { spaces } = compose({})
  const opened = await spaces.open('p-mledesma', 'am1')
  assert.ok(opened.ok)
  return { spaces, spaceId: opened.value.space.id }
}

/** Sube material a AM1 como su docente y devuelve el id y el nombre de su URL. */
async function upload(name: string, contentType: string, bytes: Uint8Array = PDF) {
  const { spaces, spaceId } = await am1()
  const added = await spaces.addMaterial('p-mledesma', spaceId, { name, contentType, bytes })
  assert.ok(added.ok)
  const [, , id] = added.value.url.split('/')
  return { spaces, id, name }
}

function get(id: string, name: string, headers: Record<string, string> = {}) {
  return new Request(`http://localhost/archivos/${id}/${encodeURIComponent(name)}`, { headers })
}

test('un alumno de la materia abre un PDF del material en el navegador', async () => {
  const { spaces, id, name } = await upload('Guía 1.pdf', 'application/pdf')

  const response = await deliverFile(get(id, name), { id, name }, { personId: 'p-taguirre', file: spaces.file })

  assert.equal(response.status, 200)
  assert.equal(response.headers.get('content-type'), 'application/pdf')
  assert.match(response.headers.get('content-disposition') ?? '', /^inline;/)
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff')
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), PDF)
})

test('sin sesión, el enlace a un archivo lleva al ingreso y le dice a dónde volver', async () => {
  const { id, name } = await upload('Guía 1.pdf', 'application/pdf')
  let asked = 0
  const file = async () => {
    asked++
    return { ok: false as const, error: 'sin-acceso' as const }
  }

  const response = await deliverFile(get(id, name), { id, name }, { personId: null, file })

  assert.equal(response.status, 307)
  const location = new URL(response.headers.get('location') ?? '', 'http://localhost')
  assert.equal(location.pathname, '/')
  assert.equal(location.searchParams.get('next'), `/archivos/${id}/Gu%C3%ADa%201.pdf`)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.equal(asked, 0)
})

test('un archivo inexistente y uno sin acceso muestran la misma página corta, así no se sabe si existe', async () => {
  const { spaces, id, name } = await upload('Guía 1.pdf', 'application/pdf')
  const other = randomUUID()

  // p-agimenez es de otra facultad: no ve el espacio de AM1.
  const responses = [
    await deliverFile(get(id, name), { id, name }, { personId: 'p-agimenez', file: spaces.file }),
    await deliverFile(get(other, name), { id: other, name }, { personId: 'p-taguirre', file: spaces.file }),
    await deliverFile(
      get('no-es-un-id', name),
      { id: 'no-es-un-id', name },
      { personId: 'p-taguirre', file: spaces.file }
    )
  ]

  const [first, ...rest] = await Promise.all(
    responses.map(async (r) => ({ status: r.status, headers: [...r.headers], body: await r.text() }))
  )
  assert.equal(first.status, 404)
  assert.match(first.body, /<html lang="es/)
  assert.match(first.body, /Este archivo no está disponible/)
  assert.ok(first.headers.some(([key, value]) => key === 'content-type' && value === 'text/html; charset=utf-8'))
  assert.ok(first.headers.some(([key, value]) => key === 'cache-control' && value === 'no-store'))
  for (const response of rest) assert.deepEqual(response, first)
})

test('si el almacenamiento no responde, la página lo dice y propone probar de nuevo', async () => {
  const { id, name } = await upload('Guía 1.pdf', 'application/pdf')
  const file = async () => ({ ok: false as const, error: 'falla-externa' as const })

  const response = await deliverFile(get(id, name), { id, name }, { personId: 'p-taguirre', file })

  assert.equal(response.status, 502)
  assert.equal(response.headers.get('content-type'), 'text/html; charset=utf-8')
  assert.equal(response.headers.get('cache-control'), 'no-store')
  const body = await response.text()
  assert.match(body, /No pudimos abrir el archivo/)
  assert.match(body, /Probá de nuevo/)
})

test('volver a abrir un archivo ya visto no lo baja de nuevo: el navegador pregunta y recibe un 304 sin cuerpo', async () => {
  const { spaces, id, name } = await upload('Guía 1.pdf', 'application/pdf')
  const deps = { personId: 'p-taguirre', file: spaces.file }

  const first = await deliverFile(get(id, name), { id, name }, deps)
  const etag = first.headers.get('etag')
  assert.ok(etag)
  assert.equal(first.headers.get('cache-control'), 'private, no-cache')

  for (const ifNoneMatch of [etag, `W/${etag}`, `"otro", ${etag}`, '*']) {
    const again = await deliverFile(get(id, name, { 'if-none-match': ifNoneMatch }), { id, name }, deps)

    assert.equal(again.status, 304, ifNoneMatch)
    assert.equal(again.headers.get('etag'), etag)
    assert.equal(again.headers.get('cache-control'), 'private, no-cache')
    assert.equal(await again.text(), '')
  }

  const changed = await deliverFile(get(id, name, { 'if-none-match': '"otro"' }), { id, name }, deps)
  assert.equal(changed.status, 200)
})

test('quien no ve el archivo no recibe un 304 aunque mande la etiqueta', async () => {
  const { spaces, id, name } = await upload('Guía 1.pdf', 'application/pdf')
  const first = await deliverFile(get(id, name), { id, name }, { personId: 'p-taguirre', file: spaces.file })
  const etag = first.headers.get('etag') ?? ''

  const outsider = await deliverFile(
    get(id, name, { 'if-none-match': etag }),
    { id, name },
    { personId: 'p-agimenez', file: spaces.file }
  )

  assert.equal(outsider.status, 404)
  assert.match(await outsider.text(), /Este archivo no está disponible/)
})

test('un PDF y una imagen se abren con el visor del navegador, sin una CSP que se lo arruine', async () => {
  for (const [name, contentType] of [
    ['Guía 1.pdf', 'application/pdf'],
    ['pizarrón.png', 'image/png'],
    ['foto.jpg', 'image/jpeg'],
    ['Apunte.PDF', 'Application/PDF; charset=binary']
  ]) {
    const { spaces, id } = await upload(name, contentType)

    const response = await deliverFile(get(id, name), { id, name }, { personId: 'p-taguirre', file: spaces.file })

    assert.match(response.headers.get('content-disposition') ?? '', /^inline;/, name)
    assert.equal(response.headers.get('content-security-policy'), null, name)
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff', name)
  }
})

test('HTML, SVG o un tipo sin forma se bajan, con una CSP que no deja correr nada', async () => {
  for (const [name, contentType, served] of [
    ['trampa.html', 'text/html', 'text/html'],
    ['logo.svg', 'image/svg+xml', 'image/svg+xml'],
    ['datos.bin', 'application/octet-stream', 'application/octet-stream'],
    ['raro', 'x', 'application/octet-stream'],
    ['partido', 'text/html\r\nSet-Cookie: a=b', 'application/octet-stream']
  ]) {
    const { spaces, id } = await upload(name, contentType)

    const response = await deliverFile(get(id, name), { id, name }, { personId: 'p-taguirre', file: spaces.file })

    assert.equal(response.headers.get('content-type'), served, name)
    assert.match(response.headers.get('content-disposition') ?? '', /^attachment;/, name)
    assert.equal(response.headers.get('content-security-policy'), "default-src 'none'; sandbox", name)
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff', name)
  }
})

test('el nombre con tildes llega entero al bajarlo, y en ASCII para los navegadores viejos', async () => {
  const cases = [
    [
      'Guía de ejercicios ñ.pdf',
      `inline; filename="Gu_a de ejercicios _.pdf"; filename*=UTF-8''Gu%C3%ADa%20de%20ejercicios%20%C3%B1.pdf`
    ],
    [
      "Parcial (2) de O'Brien.pdf",
      `inline; filename="Parcial (2) de O'Brien.pdf"; filename*=UTF-8''Parcial%20%282%29%20de%20O%27Brien.pdf`
    ],
    ['a"b\\c\r\nX: y.pdf', `inline; filename="a_b_c__X: y.pdf"; filename*=UTF-8''a%22b%5Cc%0D%0AX%3A%20y.pdf`]
  ]
  for (const [name, expected] of cases) {
    const { spaces, id } = await upload(name, 'application/pdf')

    const response = await deliverFile(get(id, name), { id, name }, { personId: 'p-taguirre', file: spaces.file })

    assert.equal(response.headers.get('content-disposition'), expected)
  }
})

test('el texto plano se muestra, pero con la CSP que no deja correr nada', async () => {
  const name = 'notas.txt'
  const { spaces, id } = await upload(name, 'text/plain; charset=utf-8', new TextEncoder().encode('hola'))

  const response = await deliverFile(get(id, name), { id, name }, { personId: 'p-taguirre', file: spaces.file })

  assert.match(response.headers.get('content-disposition') ?? '', /^inline;/)
  assert.equal(response.headers.get('content-security-policy'), "default-src 'none'; sandbox")
})

test('la consigna de una tarea la abren los de su comisión y no otros alumnos ni docentes', async () => {
  const system = compose({})
  const created = await system.coursework.createTask('p-mledesma', {
    subjectId: 'am1',
    sectionIds: ['sec-am1-fi-a'],
    name: 'Práctica 3',
    instructions: 'Resolvé los ejercicios.',
    dueAt: '2026-11-13T23:59:00-03:00',
    graded: true,
    file: { name: 'guia.pdf', contentType: 'application/pdf', bytes: PDF }
  })
  assert.ok(created.ok && created.value.file)
  const [, , id] = created.value.file.url.split('/')
  const name = 'guia.pdf'
  const file = fileFrom(system)
  const open = (personId: string) => deliverFile(get(id, name), { id, name }, { personId, file })

  assert.equal((await open('p-taguirre')).status, 200)
  assert.equal((await open('p-mledesma')).status, 200)
  // Un alumno de la B, el docente de la B y alguien de otra facultad ven la misma página que un archivo inexistente.
  for (const personId of ['p-mcabrera', 'p-gferreyra', 'p-agimenez']) {
    assert.equal((await open(personId)).status, 404, personId)
  }
})

test('el material de un espacio se sigue abriendo por la misma ruta con la consigna de las tareas', async () => {
  const { spaces, id, name } = await upload('Guía 2.pdf', 'application/pdf')
  const system = compose({})

  const response = await deliverFile(
    get(id, name),
    { id, name },
    {
      personId: 'p-taguirre',
      file: fileFrom({ spaces, coursework: system.coursework })
    }
  )

  assert.equal(response.status, 200)
})
