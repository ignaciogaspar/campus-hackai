/* A dónde lleva un enlace al SIU o a Moodle simulados: la página de la demo
   dice que el sistema está simulado y qué abriría en producción. */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { simulatedDestination } from '@/components/simulated/destination'
import { createMemoryClassroom } from '@/lib/adapters/memoria/classroom'
import { createFixedClock } from '@/lib/adapters/memoria/clock'
import { createMemorySiu } from '@/lib/adapters/memoria/siu'
import { syntheticData } from '@/lib/adapters/synthetic-data'

const pick = (href: string) => {
  const d = simulatedDestination(href)
  return d && { system: d.system, kind: d.kind, title: d.title, realPath: d.realPath }
}

test('«Ir al aula» es el aula de la materia en el Campus Virtual', () => {
  assert.deepEqual(pick('/simulado/moodle/course/view.php?id=c-am1-fi-a'), {
    system: 'moodle',
    kind: 'aula',
    title: 'Aula de la materia',
    realPath: '/course/view.php?id=c-am1-fi-a'
  })
  assert.match(simulatedDestination('/simulado/moodle/course/view.php?id=c-am1-fi-a')!.production, /Campus Virtual/)
})

test('el material y los adjuntos de Moodle son archivos del aula, con su nombre', () => {
  assert.deepEqual(pick('/simulado/moodle/pluginfile.php/am1-fi-a/guia-1.pdf'), {
    system: 'moodle',
    kind: 'archivo',
    title: 'guia-1.pdf',
    realPath: '/pluginfile.php/am1-fi-a/guia-1.pdf'
  })
  assert.deepEqual(pick('/simulado/moodle/mod/url/view.php?id=r-3'), {
    system: 'moodle',
    kind: 'enlace',
    title: 'Enlace del aula',
    realPath: '/mod/url/view.php?id=r-3'
  })
})

test('las inscripciones y las constancias son pasos de la Autogestión del SIU', () => {
  assert.deepEqual(pick('/simulado/siu/cursada/inscripcion?comision=sec-fi1-fi-v'), {
    system: 'siu',
    kind: 'cursada',
    title: 'Inscripción a cursada',
    realPath: '/cursada/inscripcion?comision=sec-fi1-fi-v'
  })
  assert.deepEqual(pick('/simulado/siu/examenes/inscripcion?mesa=mesa-aga-fi-dic'), {
    system: 'siu',
    kind: 'examen',
    title: 'Inscripción a examen',
    realPath: '/examenes/inscripcion?mesa=mesa-aga-fi-dic'
  })
  assert.deepEqual(pick('/simulado/siu/constancias/solicitar?tipo=alumno-regular'), {
    system: 'siu',
    kind: 'constancia',
    title: 'Constancia de alumno regular',
    realPath: '/constancias/solicitar?tipo=alumno-regular'
  })
  assert.equal(
    simulatedDestination('/simulado/siu/constancias/solicitar?tipo=examen-final')?.title,
    'Constancia de examen final'
  )
  assert.match(simulatedDestination('/simulado/siu/cursada/inscripcion?comision=x')!.production, /Autogestión/)
})

test('otra página de un sistema simulado se explica igual, sin decir qué es; fuera de lo simulado no hay destino', () => {
  assert.deepEqual(pick('/simulado/moodle/my/'), {
    system: 'moodle',
    kind: 'otro',
    title: 'Campus Virtual',
    realPath: '/my/'
  })
  assert.equal(pick('/simulado/siu')?.realPath, '/')
  assert.equal(simulatedDestination('/simulado/guarani/algo'), null)
  assert.equal(simulatedDestination('/hoy'), null)
  assert.equal(simulatedDestination('https://moodle.example.edu.ar/course/view.php?id=1'), null)
})

test('ningún enlace de la demo sale de HackAI: «Ir al aula», el material, los adjuntos y la Autogestión llevan a la página de lo simulado', () => {
  const { moodle, siu } = syntheticData
  const classroom = createMemoryClassroom(syntheticData)
  const selfService = createMemorySiu(syntheticData, createFixedClock(syntheticData.now))
  const links: [string, string][] = [
    ...moodle.courses.map((c): [string, string] => ['aula', classroom.courseUrl(c.id)]),
    ...moodle.contents.map((c): [string, string] => [c.type === 'url' ? 'enlace' : 'archivo', c.url]),
    ...moodle.announcements.flatMap((a) => a.attachments.map((f): [string, string] => ['archivo', f.url])),
    ...siu.sections.map((s): [string, string] => [
      'cursada',
      selfService.selfServiceUrl({ kind: 'comision', sectionId: s.id })
    ]),
    ...siu.examBoards.map((b): [string, string] => [
      'examen',
      selfService.selfServiceUrl({ kind: 'mesa', examBoardId: b.id })
    ]),
    ...(['alumno-regular', 'examen-final'] as const).map((type): [string, string] => [
      'constancia',
      selfService.selfServiceUrl({ kind: 'constancia', type })
    ])
  ]

  for (const [kind, href] of links) {
    assert.equal(simulatedDestination(href)?.kind, kind, href)
  }
})
