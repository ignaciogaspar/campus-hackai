import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { moodleSeedSql } from '@/lib/adapters/moodle-simulado/seed'
import { syntheticData } from '@/lib/adapters/synthetic-data'

test('el seed versionado del Moodle simulado sale del set sintético (npm run moodle:seed)', () => {
  const committed = readFileSync(new URL('../../supabase/simulados/moodle_seed.sql', import.meta.url), 'utf8')
  assert.equal(committed, moodleSeedSql(syntheticData), 'moodle_seed.sql quedó viejo: corré npm run moodle:seed')
})

test('el seed es idempotente: cada insert pisa la fila si ya existe, y borra las matrículas de la demo', () => {
  const sql = moodleSeedSql(syntheticData)
  const inserts = sql.match(/insert into [^;]+;/g) ?? []

  assert.equal(inserts.length, 6)
  for (const insert of inserts) assert.match(insert, /on conflict \([^)]+\) do update set/)
  assert.match(sql, /^begin;/m)
  assert.match(sql, /^commit;/m)
  assert.match(sql, /^delete from moodle_enrolments e where not exists/m)
})

test('el seed carga cursos, matrículas, avisos, contenidos y tareas del set', () => {
  const sql = moodleSeedSql(syntheticData)
  const { moodle } = syntheticData

  for (const course of moodle.courses) assert.ok(sql.includes(`('${course.id}', '${course.shortName}'`), course.id)
  for (const assignment of moodle.assignments) assert.ok(sql.includes(`('${assignment.id}', '${assignment.courseId}'`), assignment.id)
  for (const content of moodle.contents) assert.ok(sql.includes(`('${content.id}', '${content.courseId}'`), content.id)
  for (const announcement of moodle.announcements) assert.ok(sql.includes(`('${announcement.id}', '${announcement.courseId}'`), announcement.id)
  assert.equal(sql.match(/, '(student|editingteacher)'\)/g)?.length, moodle.enrolments.length)
})

test('una tarea sin fecha se carga como null', () => {
  assert.match(moodleSeedSql(syntheticData), /\('t-4', 'c-co1-fce-a', 'Práctico de asientos', null\)/)
})

test('si no hay matrículas, el seed borra todas las de la base', () => {
  const data = structuredClone(syntheticData)
  data.moodle.enrolments = []

  const sql = moodleSeedSql(data)
  assert.match(sql, /^delete from moodle_enrolments;/m)
  assert.match(sql, /-- moodle_enrolments: sin filas/)
})

test('el seed escapa las comillas de los textos', () => {
  const data = structuredClone(syntheticData)
  data.moodle.courses[0].fullName = "Física d'Alembert"
  data.moodle.announcements[0].message = "It's a trap"

  const sql = moodleSeedSql(data)
  assert.match(sql, /'Física d''Alembert'/)
  assert.match(sql, /'It''s a trap'/)
})
