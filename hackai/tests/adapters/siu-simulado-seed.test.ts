import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { siuSeedSql } from '@/lib/adapters/siu-simulado/seed'
import { syntheticData } from '@/lib/adapters/synthetic-data'

test('el seed versionado del SIU simulado sale del set sintético (npm run siu:seed)', () => {
  const committed = readFileSync(new URL('../../supabase/simulados/siu_seed.sql', import.meta.url), 'utf8')
  assert.equal(committed, siuSeedSql(syntheticData), 'siu_seed.sql quedó viejo: corré npm run siu:seed')
})

test('el seed es idempotente: cada insert pisa la fila si ya existe', () => {
  const sql = siuSeedSql(syntheticData)
  const inserts = sql.match(/insert into [^;]+;/g) ?? []

  assert.ok(inserts.length >= 14)
  for (const insert of inserts) assert.match(insert, /on conflict \([^)]+\) do update set/)
  assert.match(sql, /^begin;/m)
  assert.match(sql, /^commit;/m)
})

test('el seed escapa las comillas de los textos', () => {
  const data = structuredClone(syntheticData)
  data.siu.persons[0].surname = "D'Angelo"

  assert.match(siuSeedSql(data), /'D''Angelo'/)
})
