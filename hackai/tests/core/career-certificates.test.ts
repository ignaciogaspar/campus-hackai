/* El avance oficial por certificado: Cursada lo pasa tal como lo da el SIU,
   redondeado, y no calcula ninguno propio. */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildCareer, type CareerInput } from '@/lib/core/studies/career'

const input = (program: CareerInput['program']): CareerInput => ({
  now: '2026-11-13T12:00:00.000Z',
  program,
  plan: null,
  subjects: new Map(),
  sections: [],
  history: [],
  approved: new Map(),
  grades: [],
  schedules: new Map(),
  exams: new Map(),
  genericName: 'Evaluación'
})

test('la carrera trae el avance de cada certificado del SIU, con la orientación elegida marcada', () => {
  const career = buildCareer(
    input({
      id: 'iinf',
      name: 'Ingeniería en Informática',
      progressPercent: 52.5,
      certificates: [
        { name: 'Ingeniero en Informática', orientation: null, chosen: false, percent: 40.25, approved: 20 },
        {
          name: 'Ingeniero en Informática',
          orientation: 'Ciencia de Datos',
          chosen: true,
          percent: 52.5,
          approved: 22
        },
        {
          name: 'Ingeniero en Informática',
          orientation: 'Sistemas Embebidos',
          chosen: false,
          percent: null,
          approved: null
        }
      ]
    })
  )
  assert.deepEqual(
    career.certificates.map((c) => [c.orientation, c.chosen, c.percent]),
    [
      [null, false, 40],
      ['Ciencia de Datos', true, 53],
      ['Sistemas Embebidos', false, null]
    ]
  )
  assert.deepEqual([career.percent, career.percentFromSiu], [53, true])
})

test('sin el reporte del SIU no hay certificados: HackAI no inventa ninguno', () => {
  const career = buildCareer(input({ id: 'iinf', name: 'Ingeniería en Informática' }))
  assert.deepEqual(career.certificates, [])
  assert.equal(career.percentFromSiu, false)
})
