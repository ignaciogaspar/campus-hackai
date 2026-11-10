// Carga el mapa de conceptos y los materiales v2 (content/aicm2/conceptos.json)
// en el curso principal: un concepto por fila de `concepts` (con las slides del
// deck aicm-jN donde se ve y sus links) y un material por fila de `content_items`
// (con fuente, tipo y por qué leerlo). Requiere la migración 0200_conceptos_v2.
//
// Uso:
//   npx tsx scripts/seed/conceptos-v2.ts          # las 8 jornadas
//   npx tsx scripts/seed/conceptos-v2.ts --dry    # valida y muestra qué haría
//
// Idempotente: upsert por id (conceptos: su id c-jN-…; materiales: m-jN-<n>).
// Lo que ya no está en el archivo para esa jornada se borra, pero solo filas v2
// (conceptos con class_session_id, materiales m-jN-…); el contenido v1 vive en el
// curso legacy y no se toca.
import './env'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { serviceDb, COURSE_ID } from '@/lib/db-node'

const db = serviceDb()
const DRY = process.argv.includes('--dry')
const FILE = resolve(__dirname, '../../content/aicm2/conceptos.json')
const KINDS = ['docs', 'articulo', 'herramienta', 'demo', 'posmortem', 'repo', 'video'] as const

interface Link { title: string; url: string; source: string }
interface ConceptIn { id: string; name: string; summary: string; slides: number[]; links: Link[] }
interface MaterialIn { title: string; url: string; source: string; kind: string; why: string; conceptIds: string[] }
interface JornadaIn { jornada: number; concepts: ConceptIn[]; materials: MaterialIn[] }

function check<T>(res: { data: T; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`)
  return res.data
}

function problems(j: JornadaIn, slideCount: number): string[] {
  const out: string[] = []
  const ids = new Set(j.concepts.map((c) => c.id))
  for (const c of j.concepts) {
    if (!c.id.startsWith(`c-j${j.jornada}-`)) out.push(`${c.id}: no empieza con c-j${j.jornada}-`)
    for (const s of c.slides) if (!Number.isInteger(s) || s < 1 || s > slideCount) out.push(`${c.id}: slide ${s} fuera del deck (1-${slideCount})`)
    for (const l of c.links) if (!/^https:\/\//.test(l.url)) out.push(`${c.id}: link sin https (${l.url})`)
  }
  for (const m of j.materials) {
    if (!(KINDS as readonly string[]).includes(m.kind)) out.push(`material "${m.title}": tipo ${m.kind} desconocido`)
    if (!/^https:\/\//.test(m.url)) out.push(`material "${m.title}": url sin https`)
    for (const id of m.conceptIds) if (!ids.has(id)) out.push(`material "${m.title}": concepto ${id} no existe en la jornada`)
  }
  return out
}

async function main() {
  const data = JSON.parse(readFileSync(FILE, 'utf8')) as JornadaIn[]
  for (const j of data) {
    const sessionId = `aicm-j${j.jornada}`
    const { count } = await db.from('deck_slides').select('slide_id', { count: 'exact', head: true }).eq('deck_id', sessionId)
    const errs = problems(j, count ?? 0)
    if (errs.length) {
      console.error(`J${j.jornada}: no se carga\n  ${errs.join('\n  ')}`)
      process.exitCode = 1
      continue
    }
    const concepts = j.concepts.map((c, i) => ({
      id: c.id, course_id: COURSE_ID, class_session_id: sessionId, name: c.name, summary: c.summary,
      block: null, prereqs: [], slides: c.slides, links: c.links, position: i,
    }))
    const items = j.materials.map((m, i) => ({
      id: `m-j${j.jornada}-${i + 1}`, course_id: COURSE_ID, class_session_id: sessionId, kind: m.kind,
      title: m.title, url: m.url, source: m.source, why: m.why, body_md: null, transcript: null,
      concept_ids: m.conceptIds, position: i,
    }))
    if (DRY) {
      console.log(`J${j.jornada}: ${concepts.length} conceptos · ${items.length} materiales (dry)`)
      continue
    }
    check(await db.from('concepts').upsert(concepts), `concepts J${j.jornada}`)
    check(await db.from('content_items').upsert(items), `content_items J${j.jornada}`)
    // Lo que se sacó del archivo (solo filas v2 de esta jornada)
    const keepC = concepts.map((c) => c.id)
    const keepI = items.map((m) => m.id)
    const goneC = check(await db.from('concepts').delete().eq('course_id', COURSE_ID).eq('class_session_id', sessionId).not('id', 'in', `(${keepC.join(',')})`).select('id'), `limpieza concepts J${j.jornada}`) as Array<{ id: string }>
    const goneI = check(await db.from('content_items').delete().eq('course_id', COURSE_ID).like('id', `m-j${j.jornada}-%`).not('id', 'in', `(${keepI.join(',')})`).select('id'), `limpieza content_items J${j.jornada}`) as Array<{ id: string }>
    console.log(`J${j.jornada}: ${concepts.length} conceptos · ${items.length} materiales${goneC.length + goneI.length ? ` · ${goneC.length + goneI.length} borrados` : ''}`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
