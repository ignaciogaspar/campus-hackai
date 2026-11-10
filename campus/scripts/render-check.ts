// render-check: dibuja cada slide 'iae' (y las interactivas con la piel de
// Ignacio) en Chrome headless a 1280×720, guarda un PNG por slide y reporta
// desbordes, texto cortado, imágenes/videos rotos y avisos de estilo.
//
// No necesita next dev: usa el mismo CSS empaquetado y el mismo markup que el
// campus, y sirve /decks/... desde public/. Se puede correr en paralelo.
//
// Uso:
//   npx tsx scripts/render-check.ts --file content/aicm2/j3.ts --out /tmp/j3
//   npx tsx scripts/render-check.ts --deck aicm-j3 --out /tmp/j3          (lee la DB, solo lectura)
//   npx tsx scripts/render-check.ts --file deck/index.html --out /tmp/ef  (un deck HTML de Ignacio)
//   npx tsx scripts/render-check.ts --file slides.json --out /tmp/x       ([{markdown}] o JornadaDeckV2)
// Opciones:
//   --only 3,5-7       solo esas slides (1-based)
//   --base /decks/x/   carpeta para rutas de media relativas (default /decks/empresas-familiares/)
//   --prefix ef-       prefijo de los PNG (default slide-)
//   --strict           sale con código 1 si hay desbordes, roturas o HTML no permitido
//   --quiet            no lista los avisos de estilo
// Salida: <out>/slide-NNN.png y <out>/report.json. Código de salida 0 salvo error o --strict con problemas.
import './seed/env'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { extractIaeSlides, extractedToMarkdown } from '@/lib/iae/extract'
import { slideV2Markdown, deckV2Problems } from '@/lib/iae/v2'
import type { JornadaDeckV2 } from '@/content/aicm2/types'
import { renderSlides, writeReport, type RenderInput } from './iae/renderer'

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}
const flag = (name: string) => process.argv.includes(`--${name}`)

function parseOnly(spec?: string): Set<number> | undefined {
  if (!spec) return undefined
  const out = new Set<number>()
  for (const part of spec.split(',')) {
    const [a, b] = part.split('-').map((x) => Number(x.trim()))
    for (let n = a; n <= (b || a); n++) out.add(n - 1)
  }
  return out
}

async function fromDeck(deckId: string): Promise<RenderInput[]> {
  await import('./seed/env')
  const { serviceDb } = await import('@/lib/db-node')
  const { data, error } = await serviceDb()
    .from('deck_slides')
    .select('position, slides (markdown)')
    .eq('deck_id', deckId)
    .order('position')
  if (error) throw new Error(error.message)
  const rows = (data ?? []) as unknown as { position: number; slides: { markdown: string } | null }[]
  if (!rows.length) throw new Error(`El deck ${deckId} no tiene slides (o no existe)`)
  return rows.map((r) => ({ label: String(r.position + 1), markdown: r.slides?.markdown ?? '' }))
}

async function fromFile(path: string): Promise<{ inputs: RenderInput[]; problems: string[] }> {
  const abs = resolve(path)
  if (/\.html?$/i.test(abs)) {
    const slides = extractIaeSlides(readFileSync(abs, 'utf8'))
    return { inputs: slides.map((s) => ({ label: String(s.n + 1), markdown: extractedToMarkdown(s) })), problems: [] }
  }
  let data: unknown
  if (/\.json$/i.test(abs)) data = JSON.parse(readFileSync(abs, 'utf8'))
  else {
    const mod = await import(pathToFileURL(abs).href) as { default?: unknown }
    data = (mod.default as { default?: unknown } | undefined)?.default ?? mod.default
  }
  if (Array.isArray(data)) {
    return { inputs: data.map((s, i) => ({ label: String(i + 1), markdown: typeof s === 'string' ? s : (s as { markdown: string }).markdown })), problems: [] }
  }
  const deck = data as JornadaDeckV2
  if (!deck || !Array.isArray(deck.slides)) throw new Error(`${path}: no exporta un JornadaDeckV2 ni un array de slides`)
  return { inputs: deck.slides.map((s, i) => ({ label: String(i + 1), markdown: slideV2Markdown(s) })), problems: deckV2Problems(deck) }
}

async function main() {
  const out = arg('out')
  const deck = arg('deck')
  const file = arg('file')
  if (!out || (!deck && !file)) {
    console.error('Uso: npx tsx scripts/render-check.ts (--deck <id> | --file <archivo>) --out <carpeta> [--only 3,5-7] [--base /decks/x/] [--prefix p-] [--strict] [--quiet]')
    process.exit(2)
  }
  const { inputs, problems } = deck ? { inputs: await fromDeck(deck), problems: [] as string[] } : await fromFile(file!)
  const t0 = Date.now()
  const reports = await renderSlides(inputs, { outDir: resolve(out), base: arg('base'), prefix: arg('prefix'), only: parseOnly(arg('only')) })
  const reportFile = writeReport(resolve(out), reports, { source: deck ? `deck:${deck}` : file, problems })

  let hard = 0
  for (const p of problems) console.log(`✗ archivo: ${p}`)
  for (const r of reports) {
    const bad = [...r.issues.map((x) => `HTML: ${x}`), ...r.overflow.map((x) => `desborde: ${x}`), ...r.broken.map((x) => `roto: ${x}`)]
    hard += bad.length
    const style = flag('quiet') ? [] : r.style.map((x) => `estilo: ${x}`)
    const head = `${String(r.n).padStart(3)} ${r.kind.padEnd(9)} ${r.title.slice(0, 70)}`
    if (r.skipped) { console.log(`${head}\n      – salteada: ${r.skipped}`); continue }
    if (!bad.length && !style.length) { console.log(`${head}  ✓`); continue }
    console.log(head)
    for (const b of bad) console.log(`      ✗ ${b}`)
    for (const s of style) console.log(`      · ${s}`)
  }
  const rendered = reports.filter((r) => !r.skipped).length
  console.log(`\n${rendered} slides en ${((Date.now() - t0) / 1000).toFixed(1)} s · ${hard} problemas (desborde/roto/HTML) · ${reports.reduce((a, r) => a + r.style.length, 0)} avisos de estilo`)
  console.log(`PNG y reporte: ${reportFile}`)
  if (flag('strict') && (hard > 0 || problems.length > 0)) process.exit(1)
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
