// Borra los datos que dejó scripts/test/smoke.ts sin tocar el contenido sembrado.
//   npx tsx scripts/test/cleanup.ts <smoke-state.json>
// Borra lo creado desde `startedAt` del archivo de estado: corrélo apenas termina
// el smoke y sin otros usuarios cargando datos en ese rato.
import { readFileSync } from 'node:fs'
import { serviceDb } from '@/lib/db-node'

const sb = serviceDb()
const file = process.argv[2]
if (!file) {
  console.error('Uso: npx tsx scripts/test/cleanup.ts <smoke-state.json>')
  process.exit(1)
}
const st = JSON.parse(readFileSync(file, 'utf8')) as { startedAt: string; liveId?: string; tokenIds?: string[] }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Q = any

async function del(table: string, q: (x: Q) => Q) {
  const { error, count } = await q(sb.from(table).delete({ count: 'exact' }))
  console.log(`${table}: ${error ? `ERROR ${error.message}` : `${count ?? 0} borradas`}`)
}

async function main() {
  const since = st.startedAt
  if (!since) throw new Error('El archivo de estado no tiene startedAt')
  // clases en vivo de la prueba (todas las creadas desde el inicio)
  const { data: lives } = await sb.from('live_sessions').select('id, deck_id').gte('started_at', since)
  const liveIds = (lives ?? []).map((l) => l.id as string)
  console.log('clases de prueba:', liveIds.length)

  // Cerrar las clases antes de reordenar: el reorden no toca el orden de un deck en vivo.
  if (liveIds.length) await sb.from('live_sessions').update({ status: 'ended', ended_at: new Date().toISOString() }).in('id', liveIds)

  // slides insertadas por las clases de prueba: sacarlas del deck (compactando posiciones) y borrarlas
  for (const live of lives ?? []) {
    const { data: ins } = await sb.from('slides').select('id').contains('origin', { liveSessionId: live.id })
    for (const s of ins ?? []) {
      const { data: rows } = await sb.from('deck_slides').select('deck_id').eq('slide_id', s.id)
      const decks = [...new Set((rows ?? []).map((r) => r.deck_id as string))]
      for (const d of decks) {
        const { data: order } = await sb.from('deck_slides').select('slide_id').eq('deck_id', d).order('position')
        const current = (order ?? []).map((r) => r.slide_id as string)
        const next = current.filter((id) => id !== s.id)
        const { error } = await sb.rpc('authoring_set_deck_order', { p_deck: d, p_slides: next, p_expected: current })
        console.log(`deck ${d}: ${current.length} → ${next.length}${error ? ` ERROR ${error.message}` : ''}`)
      }
      await sb.from('slide_marks').delete().eq('slide_id', s.id)
      await sb.from('slide_notes').delete().eq('slide_id', s.id)
      await sb.from('polls').delete().eq('slide_id', s.id)
      await sb.from('slide_revisions').delete().eq('slide_id', s.id)
      const { error } = await sb.from('slides').delete().eq('id', s.id)
      console.log(`slide insertada ${s.id}: ${error ? `ERROR ${error.message}` : 'borrada'}`)
    }
  }

  await del('poll_responses', (q) => q.gte('created_at', since))
  // polls creadas durante la prueba (por el agente, o de slide cuando el draft
  // sembrado ya estaba usado por otra clase): se borran
  if (liveIds.length) await del('polls', (q) => q.in('live_session_id', liveIds).gte('created_at', since))
  // las polls sembradas (draft de cada :::encuesta) abiertas en la prueba vuelven a draft
  if (liveIds.length) {
    const { error, count } = await sb.from('polls').update({ status: 'draft', live_session_id: null, closed_at: null }, { count: 'exact' }).in('live_session_id', liveIds)
    console.log(`polls de slide restauradas a draft: ${count ?? 0}${error ? ` ERROR ${error.message}` : ''}`)
  }
  await del('case_postures', (q) => q.gte('created_at', since))
  await del('slide_marks', (q) => q.gte('created_at', since))
  await del('slide_notes', (q) => q.gte('created_at', since))
  await del('participation', (q) => q.gte('created_at', since))
  await del('cold_call_draws', (q) => q.gte('created_at', since))
  await del('cold_call_rounds', (q) => q.gte('started_at', since))
  await del('tutor_messages', (q) => q.gte('created_at', since))
  await del('tutor_threads', (q) => q.gte('created_at', since))
  await del('sim_events', (q) => q.gte('created_at', since))
  await del('sim_runs', (q) => q.gte('started_at', since))
  await del('agent_turns', (q) => q.gte('created_at', since))
  await del('rate_hits', (q) => q.gte('window_start', since))
  // entorno (hola_campus), entregas, organización y actividades creadas en la prueba
  await del('environment_checks', (q) => q.gte('created_at', since))
  await del('peer_reviews', (q) => q.gte('created_at', since))
  await del('submissions', (q) => q.gte('created_at', since))
  await del('organization_revisions', (q) => q.gte('created_at', since))
  await del('organizations', (q) => q.gte('created_at', since))
  await del('activity_items', (q) => q.gte('created_at', since))
  await del('activity_entries', (q) => q.gte('created_at', since))
  await del('radar_votes', (q) => q.gte('created_at', since))
  await del('office_hour_bookings', (q) => q.gte('created_at', since))
  if (st.tokenIds?.length) await del('api_tokens', (q) => q.in('id', st.tokenIds))
  if (liveIds.length) {
    await del('transcript_segments', (q) => q.in('live_session_id', liveIds))
    await del('live_events', (q) => q.in('live_session_id', liveIds))
    await del('live_sessions', (q) => q.in('id', liveIds))
  }
}
main().catch((e) => { console.error(e); process.exitCode = 1 })
