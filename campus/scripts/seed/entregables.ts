// Carga los 6 entregables oficiales por bloque (aicm-b1-entorno … aicm-b6-adopcion) y pasa
// las 8 entregas anteriores (caso ficticio) a 'borrador'. No borra nada.
//   npx tsx scripts/seed/entregables.ts            carga / actualiza
//   npx tsx scripts/seed/entregables.ts --dry      muestra qué haría
// Idempotente:
// - Un entregable nuevo se crea 'abierta', con vencimiento y revisores por entrega de la definición.
// - Uno que ya existe actualiza título, consigna y jornada. La rúbrica solo si todavía no hay
//   revisiones (para no invalidar puntajes). No pisa estado, vencimiento ni revisores (los edita el profesor).
// - Las entregas legacy pasan a 'borrador' (si ya lo están, no se tocan).
// - Los casos ficticios (pampa-sur-*) quedan inactivos (cases.is_active = false, migración 0160).
import './env'
import { COURSE_ID, serviceDb } from '../../lib/db-node'
import { ENTREGABLES, LEGACY_ASSIGNMENT_IDS } from '../../lib/organizacion/entregables'

const dry = process.argv.includes('--dry')

function check<T>(res: { data: T; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`)
  return res.data
}

async function main() {
  const db = serviceDb()

  for (const e of ENTREGABLES) {
    const existing = check(await db.from('assignments').select('id, status').eq('id', e.id).maybeSingle(), e.id) as { id: string; status: string } | null
    if (!existing) {
      console.log(`+ ${e.id} · ${e.title} · vence ${e.dueAt} · pares ${e.peerReviews}`)
      if (dry) continue
      check(await db.from('assignments').insert({
        id: e.id,
        course_id: COURSE_ID,
        class_session_id: e.classSessionId,
        title: e.title,
        brief_md: e.briefMd,
        rubric: e.rubric,
        due_at: e.dueAt,
        peer_reviews_per_submission: e.peerReviews,
        status: 'abierta',
      }), `crear ${e.id}`)
      check(await db.from('assignment_settings').upsert({ assignment_id: e.id, grade_mode: 'docente-o-pares' }, { onConflict: 'assignment_id' }), `settings ${e.id}`)
      continue
    }
    const subs = check(await db.from('submissions').select('id').eq('assignment_id', e.id), 'entregas') as { id: string }[]
    let reviewCount = 0
    if (subs.length) {
      const { count } = await db.from('peer_reviews').select('id', { count: 'exact', head: true }).in('submission_id', subs.map((s) => s.id))
      reviewCount = count ?? 0
    }
    const patch: Record<string, unknown> = { title: e.title, brief_md: e.briefMd, class_session_id: e.classSessionId }
    if (reviewCount === 0) patch.rubric = e.rubric
    console.log(`~ ${e.id} · actualiza título y consigna${reviewCount === 0 ? ' y rúbrica' : ` (rúbrica intacta: ${reviewCount} revisiones)`} · estado ${existing.status}`)
    if (!dry) check(await db.from('assignments').update(patch).eq('id', e.id), `actualizar ${e.id}`)
  }

  const legacy = check(await db.from('assignments').select('id, status').in('id', LEGACY_ASSIGNMENT_IDS), 'legacy') as { id: string; status: string }[]
  for (const a of legacy) {
    if (a.status === 'borrador') continue
    console.log(`- ${a.id}: ${a.status} → borrador (legacy)`)
    if (!dry) check(await db.from('assignments').update({ status: 'borrador' }).eq('id', a.id), `legacy ${a.id}`)
  }

  const fict = check(await db.from('cases').select('id, is_active').like('id', 'pampa-sur-%'), 'casos') as { id: string; is_active: boolean }[]
  const active = fict.filter((c) => c.is_active)
  if (active.length) {
    console.log(`- casos ficticios inactivos: ${active.map((c) => c.id).join(', ')}`)
    if (!dry) check(await db.from('cases').update({ is_active: false }).in('id', active.map((c) => c.id)), 'casos')
  }
  console.log(dry ? 'dry run: no se escribió nada.' : 'listo.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
