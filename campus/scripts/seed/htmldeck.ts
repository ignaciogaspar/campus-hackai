// Seed del deck HTML estático de Empresas Familiares (idempotente):
//   - curso 'empresas-familiares' (si no existe; no pisa su meta si ya está)
//   - deck 'empresas-familiares' kind 'html' con html_url y html_slide_count
//   - una fila de `slides` por slide del HTML (kind 'html', markdown :::default con el texto
//     extraído, teacher_notes = aside.notes, origin {deck, position}) y su `deck_slides`.
// Una slide editada (version > 1) no se pisa. El orden de deck_slides es siempre el del HTML
// (la posición N es el #N+1 del sitio), así que no admite inserciones.
// Uso: npx tsx scripts/seed/htmldeck.ts [--remove]
import './env'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { serviceDb } from '@/lib/db-node'
import { htmlSlideId } from '@/lib/htmldeck/ids'
import { extractOutline, outlineChapters, outlineTitle, outlineToMarkdown } from '@/lib/htmldeck/extract'
import { EMPRESAS_FAMILIARES as DEF } from '@/lib/htmldeck/types'

const db = serviceDb()

function check<T>(res: { data: T; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`)
  return res.data
}

async function seedCourse() {
  const existing = check(await db.from('courses').select('id').eq('id', DEF.courseId).maybeSingle(), 'courses')
  if (existing) return 'ya existía'
  check(await db.from('courses').insert({
    id: DEF.courseId,
    title: 'IA y Patrimonio Inmobiliario · Empresas Familiares',
    edition: 'IAE Business School',
    meta: {
      institution: 'IAE Business School · Universidad Austral',
      program: 'Empresas Familiares',
      professor: 'Ignacio Berdiñas',
      deckKind: 'html',
    },
  }), 'insert course')
  return 'creado'
}

async function seed() {
  const html = readFileSync(resolve(__dirname, '../..', DEF.publicDir, 'index.html'), 'utf8')
  const outline = extractOutline(html)
  if (!outline.length) throw new Error('No encontré slides en el HTML')
  if (!html.includes('campus-bridge.js')) console.warn('ojo: index.html no incluye campus-bridge.js')

  const course = await seedCourse()

  check(await db.from('decks').upsert({
    id: DEF.id,
    course_id: DEF.courseId,
    title: DEF.title,
    question: '¿Cómo puede la IA iluminar las decisiones sobre el patrimonio inmobiliario de una familia empresaria?',
    thesis: 'La IA acelera la obsolescencia de las ventajas y de las decisiones: la diferencia la hace cómo la dirigimos, empezando por los datos.',
    chapters: outlineChapters(outline),
    sources: [],
    kind: 'html',
    html_url: DEF.htmlUrl,
    html_slide_count: outline.length,
  }), 'decks')

  const ids = outline.map((s) => htmlSlideId(DEF.id, s.n))
  const existing = check(await db.from('slides').select('id, version, markdown, teacher_notes').in('id', ids), 'slides') as Array<{ id: string; version: number; markdown: string; teacher_notes: string | null }>
  const byId = new Map(existing.map((s) => [s.id, s]))
  const toInsert: Record<string, unknown>[] = []
  let updated = 0
  for (const s of outline) {
    const id = ids[s.n]
    const row = {
      id,
      course_id: DEF.courseId,
      kind: 'html',
      title: outlineTitle(s),
      markdown: outlineToMarkdown(s),
      teacher_notes: s.notes || null,
      tags: ['empresas-familiares', 'html', ...(s.kicker ? [s.kicker.split('·')[0].trim().toLowerCase()] : [])],
      origin: { deck: DEF.id, position: s.n, html: `${DEF.htmlUrl}#${s.n + 1}` },
    }
    const prev = byId.get(id)
    if (!prev) toInsert.push(row)
    else if (prev.version === 1 && (prev.markdown !== row.markdown || prev.teacher_notes !== row.teacher_notes)) {
      check(await db.from('slides').update({ ...row, updated_at: new Date().toISOString() }).eq('id', id), `slide ${id}`)
      updated++
    }
  }
  if (toInsert.length) {
    check(await db.from('slides').insert(toInsert), 'insert slides')
    check(await db.from('slide_revisions').insert(toInsert.map((r) => ({ slide_id: r.id, markdown: r.markdown, teacher_notes: r.teacher_notes, via: 'import' }))), 'revisions')
  }

  const current = check(await db.from('deck_slides').select('position, slide_id').eq('deck_id', DEF.id).order('position'), 'deck_slides') as Array<{ position: number; slide_id: string }>
  const inOrder = current.length === ids.length && current.every((r, i) => r.slide_id === ids[i] && r.position === i)
  let order = 'sin cambios'
  if (!inOrder) {
    const foreign = current.filter((r) => !ids.includes(r.slide_id))
    if (foreign.length) console.warn(`ojo: deck_slides tenía ${foreign.length} slides ajenas al HTML; se descartan del orden (las filas de slides quedan)`)
    if (current.length) check(await db.from('deck_slides').delete().eq('deck_id', DEF.id), 'delete deck_slides')
    check(await db.from('deck_slides').insert(ids.map((slide_id, position) => ({ deck_id: DEF.id, position, slide_id }))), 'insert deck_slides')
    order = current.length ? 'rearmado' : 'creado'
  }
  if (toInsert.length || updated || order !== 'sin cambios') {
    check(await db.from('decks').update({ updated_at: new Date().toISOString() }).eq('id', DEF.id), 'touch deck')
  }
  console.log(`curso ${DEF.courseId}: ${course}`)
  console.log(`${DEF.id}: ${outline.length} slides · ${toInsert.length} nuevas · ${updated} actualizadas · orden ${order} · html ${DEF.htmlUrl}`)
}

async function remove() {
  const live = check(await db.from('live_sessions').select('id', { count: 'exact', head: false }).eq('deck_id', DEF.id), 'live_sessions') as unknown[]
  if (live.length) throw new Error(`El deck tiene ${live.length} clases en vivo registradas: no lo borro.`)
  check(await db.from('deck_slides').delete().eq('deck_id', DEF.id), 'delete deck_slides')
  check(await db.from('decks').delete().eq('id', DEF.id), 'delete deck')
  const { data: rows } = await db.from('slides').select('id').contains('origin', { deck: DEF.id })
  const slideIds = (rows ?? []).map((r: { id: string }) => r.id)
  if (slideIds.length) {
    const used = check(await db.from('deck_slides').select('slide_id').in('slide_id', slideIds), 'used') as Array<{ slide_id: string }>
    const usedSet = new Set(used.map((u) => u.slide_id))
    const free = slideIds.filter((id) => !usedSet.has(id))
    if (free.length) check(await db.from('slides').delete().in('id', free), 'delete slides')
    console.log(`slides borradas: ${free.length} (en uso por otros decks: ${usedSet.size})`)
  }
  console.log('deck borrado (el curso queda)')
}

;(process.argv.includes('--remove') ? remove() : seed()).catch((err) => {
  console.error(err)
  process.exit(1)
})
