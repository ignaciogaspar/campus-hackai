import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { feedbackTemplate, nextStep, publicationTime, sessionEnded, validActionHref, validateFeedback, validateReflection, visibleFeedback } from '../lib/learning/core'
import type { Feedback, LearningSession, Reflection } from '../lib/learning/types'

const now = Date.parse('2026-11-13T12:00:00Z')
const session: LearningSession = { id: 'aicm-j1', ordinal: 1, title: 'Awareness', starts_at: '2026-11-12T21:30:00Z', deck_id: 'aicm-j1' }
const reflection: Reflection = { id: 'r', person_id: 'a', session_id: session.id, takeaway: 'Comparar costo del error', unclear: 'Cómo medirlo', application: 'Revisar aprobaciones', revision: 1, updated_at: new Date(now).toISOString() }
const feedback: Feedback = { id: 'f', person_id: 'a', session_id: session.id, body: 'Revisá tu caso', action_label: 'Ver organización', action_href: '/campus/organizacion', visible_at: new Date(now - 1).toISOString(), publication_id: 'pub', read_at: null, applied_at: null }
const base = { now, live: null, overdue: null, sessions: [session], reflections: [] as Reflection[], feedback: [] as Feedback[] }

describe('cierre y publicación', () => {
  it('abre la reflexión exactamente al terminar y no para fechas desconocidas', () => {
    const end = Date.parse(session.starts_at!) + 210 * 60_000
    assert.equal(sessionEnded(session, end - 1), false)
    assert.equal(sessionEnded(session, end), true)
    assert.equal(sessionEnded({ ...session, starts_at: null }, now), false)
  })
  it('no muestra un borrador, texto vacío ni publicación futura', () => {
    assert.equal(visibleFeedback(null, now), false)
    assert.equal(visibleFeedback({ ...feedback, body: ' ' }, now), false)
    assert.equal(visibleFeedback({ ...feedback, visible_at: new Date(now + 1).toISOString() }, now), false)
    assert.equal(visibleFeedback({ ...feedback, visible_at: new Date(now).toISOString() }, now), true)
  })
  it('interpreta el horario de Buenos Aires independientemente de la zona del navegador', () => {
    assert.equal(publicationTime('2026-11-14T08:30', now), '2026-11-14T11:30:00.000Z')
    assert.equal(publicationTime('', now), new Date(now).toISOString())
  })
  it('rechaza fechas pasadas, imposibles y cadenas con zona horaria inyectada', () => {
    for (const date of ['2026-11-12T08:30', '2027-02-30T08:30', '2026-13-01T08:30', '2026-11-14T25:00', '2026-11-14T08:30Z', 'not-a-date']) assert.equal(publicationTime(date, now), null, date)
  })
})

describe('prioridad de la home', () => {
  it('prioriza la clase en vivo sobre entregas y devoluciones', () => {
    assert.equal(nextStep({ ...base, live: { code: 'ABC123' }, overdue: { id: 'b1', title: 'B1' }, feedback: [feedback] }).kind, 'live')
  })
  it('hace visible una entrega vencida antes del cierre de jornada', () => {
    assert.equal(nextStep({ ...base, overdue: { id: 'b1', title: 'B1' }, feedback: [feedback] }).kind, 'overdue')
  })
  it('elige la devolución visible más reciente, sin sugerir una ya leída', () => {
    assert.equal(nextStep({ ...base, feedback: [feedback] }).kind, 'feedback')
    assert.equal(nextStep({ ...base, feedback: [{ ...feedback, read_at: new Date(now).toISOString() }] }).kind, 'reflection')
    assert.equal(nextStep({ ...base, feedback: [{ ...feedback, visible_at: new Date(now + 1).toISOString() }] }).kind, 'reflection')
  })
  it('propone cerrar la última jornada y prepara la siguiente tras guardar', () => {
    const future = { ...session, id: 'aicm-j2', ordinal: 2, starts_at: '2026-11-17T21:30:00Z' }
    assert.equal(nextStep({ ...base, sessions: [session, future] }).kind, 'reflection')
    assert.equal(nextStep({ ...base, sessions: [session, future], reflections: [reflection] }).href, '/campus/jornadas/2')
    assert.equal(nextStep({ ...base, reflections: [reflection] }).kind, 'history')
  })
})

describe('entradas y borradores', () => {
  it('exige una reflexión significativa y limita el tamaño de cada campo', () => {
    assert.ok(validateReflection({ ...reflection, takeaway: ' ' }))
    assert.ok(validateReflection({ ...reflection, unclear: 'x'.repeat(1201) }))
    assert.equal(validateReflection(reflection), null)
  })
  it('solo admite enlaces internos del alumno', () => {
    for (const href of ['/campus/organizacion', '/campus/jornadas/1#conceptos', '/campus/aprendizaje?jornada=1']) assert.equal(validActionHref(href), true, href)
    for (const href of ['https://evil.test', '//evil.test', '/profesor/alumnos', '/salir', 'javascript:alert(1)', '/campus/../salir', '/campus/%2e%2e/salir', '/campus/\\evil', '/campus/%5cevil', '/campus/%255cevil', '/campus/\nfoo']) assert.equal(validActionHref(href), false, href)
  })
  it('requiere texto y destino juntos y rechaza mensajes vacíos', () => {
    assert.ok(validateFeedback({ body: '', label: '', href: '' }))
    assert.ok(validateFeedback({ body: 'Hola', label: 'Ver', href: '' }))
    assert.equal(validateFeedback({ body: 'Hola', label: '', href: '' }), null)
  })
  it('el borrador cita lo compartido y no inventa evidencia cuando falta', () => {
    const text = feedbackTemplate('María Pérez', reflection)
    assert.ok(text.includes('«Comparar costo del error»'))
    assert.ok(text.includes('«Cómo medirlo»'))
    const empty = feedbackTemplate('María Pérez', null)
    assert.ok(!empty.includes('En tu reflexión'))
    assert.ok(!empty.includes('participaste'))
  })
})
