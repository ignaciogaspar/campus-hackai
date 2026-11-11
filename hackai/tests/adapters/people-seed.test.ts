import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { peopleAccountRows, peopleSeedSql } from '@/lib/adapters/supabase/people-seed'
import { syntheticData } from '@/lib/adapters/synthetic-data'

test('el seed versionado de los vínculos sale del set sintético (npm run people:seed)', () => {
  const committed = readFileSync(new URL('../../supabase/simulados/people_seed.sql', import.meta.url), 'utf8')
  assert.equal(committed, peopleSeedSql(syntheticData), 'people_seed.sql quedó viejo: corré npm run people:seed')
})

test('cada persona del set queda vinculada con la identidad, el SIU y Moodle, y con Discord solo si tiene cuenta', () => {
  const rows = peopleAccountRows(syntheticData)
  const conDiscord = syntheticData.people.filter((p) => p.discordId).length

  assert.equal(rows.length, syntheticData.people.length * 3 + conDiscord)
  assert.deepEqual(rows.filter((r) => r.person_id === 'p-cbustos'), [
    { person_id: 'p-cbustos', system: 'identity', external_id: 'demo:p-cbustos' },
    { person_id: 'p-cbustos', system: 'siu', external_id: '20103' },
    { person_id: 'p-cbustos', system: 'moodle', external_id: '303' },
  ])
})

test('el seed es idempotente: borra los vínculos de las personas del set y los carga de nuevo en una transacción', () => {
  const sql = peopleSeedSql(syntheticData)

  assert.match(sql, /^begin;/m)
  assert.match(sql, /^commit;/m)
  assert.match(sql, /delete from people_accounts where person_id = any \(array\['p-mledesma'/)
  assert.ok(sql.indexOf('delete from people_accounts') < sql.indexOf('insert into people_accounts'))
  assert.match(sql, /on conflict \(person_id, system\) do update set external_id = excluded\.external_id;/)
})

test('el seed escapa las comillas de los ids', () => {
  const data = structuredClone(syntheticData)
  data.people[0].identitySubject = "demo:d'angelo"

  assert.match(peopleSeedSql(data), /'demo:d''angelo'/)
})
