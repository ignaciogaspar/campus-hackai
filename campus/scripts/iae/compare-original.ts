// Compara el render del campus (render-check) contra el deck original de
// Ignacio abierto en Chrome headless (index.html#N), píxel a píxel.
//
//   npx tsx scripts/iae/compare-original.ts --orig <index.html> --mine <carpeta de render-check> --out <carpeta> [--prefix slide-] [--only 1-10]
//
// Deja orig-NNN.png y diff-NNN.png (en rojo lo que cambia) y un compare.json
// con el % de píxeles distintos por slide. Los videos se comparan en su poster.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { launch } from './renderer'

const arg = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : undefined }

async function main() {
  const orig = resolve(arg('orig') ?? '')
  const mine = resolve(arg('mine') ?? '')
  const out = resolve(arg('out') ?? '')
  const prefix = arg('prefix') ?? 'slide-'
  const only = arg('only')
  mkdirSync(out, { recursive: true })
  const total = (readFileSync(orig, 'utf8').match(/<section class="slide/g) ?? []).length
  const wanted: number[] = []
  if (only) for (const part of only.split(',')) { const [a, b] = part.split('-').map(Number); for (let n = a; n <= (b || a); n++) wanted.push(n) }
  else for (let n = 1; n <= total; n++) wanted.push(n)

  const { browser, done } = await launch()
  const results: { n: number; diffPct: number }[] = []
  try {
    const page = await browser.newPage()
    await page.evaluateOnNewDocument('globalThis.__name = (f) => f')
    // nav.js escala con min(w/1280, (h-24)/720): a 1280×744 la escala es 1
    await page.setViewport({ width: 1280, height: 744, deviceScaleFactor: 1 })
    const diffPage = await browser.newPage()
    await diffPage.evaluate('globalThis.__name = (f) => f')
    for (const n of wanted) {
      await page.goto(`${pathToFileURL(orig).href}?n=${n}#${n}`, { waitUntil: 'load' }) // query: fuerza recarga (nav.js lee el hash al cargar)
      await page.evaluate(async () => {
        const st = document.createElement('style')
        st.textContent = '#bar,#ctr,#nav,.hint{display:none!important}'
        document.head.appendChild(st)
        // el video vuelve a su poster (un clon sin reproducir)
        document.querySelectorAll('video').forEach((v) => { const c = v.cloneNode(true) as HTMLVideoElement; c.removeAttribute('autoplay'); v.replaceWith(c) })
        await document.fonts.ready
        const imgs = Array.from(document.querySelectorAll('.slide.active img')) as HTMLImageElement[]
        await Promise.all(imgs.map((i) => (i.complete ? null : new Promise((r) => { i.onload = r; i.onerror = r }))))
        await new Promise((r) => setTimeout(r, 120))
      })
      const box = await page.evaluate(() => { const r = document.querySelector('.stage')!.getBoundingClientRect(); return { x: r.left, y: r.top } })
      const o = join(out, `orig-${String(n).padStart(3, '0')}.png`)
      await page.screenshot({ path: o as `${string}.png`, clip: { x: box.x, y: box.y, width: 1280, height: 720 } })
      const m = join(mine, `${prefix}${String(n).padStart(3, '0')}.png`)
      const a = `data:image/png;base64,${readFileSync(o).toString('base64')}`
      let b: string
      try { b = `data:image/png;base64,${readFileSync(m).toString('base64')}` } catch { continue }
      const { pct, diff } = await diffPage.evaluate(async (a1: string, b1: string) => {
        const load = (src: string) => new Promise<HTMLImageElement>((r) => { const i = new Image(); i.onload = () => r(i); i.src = src })
        const [ia, ib] = await Promise.all([load(a1), load(b1)])
        const c = document.createElement('canvas')
        c.width = 1280; c.height = 720
        const ctx = c.getContext('2d')!
        ctx.drawImage(ia, 0, 0); const da = ctx.getImageData(0, 0, 1280, 720)
        ctx.clearRect(0, 0, 1280, 720)
        ctx.drawImage(ib, 0, 0); const db = ctx.getImageData(0, 0, 1280, 720)
        const outImg = ctx.createImageData(1280, 720)
        let bad = 0
        for (let i = 0; i < da.data.length; i += 4) {
          const d = Math.abs(da.data[i] - db.data[i]) + Math.abs(da.data[i + 1] - db.data[i + 1]) + Math.abs(da.data[i + 2] - db.data[i + 2])
          const g = (db.data[i] + db.data[i + 1] + db.data[i + 2]) / 3
          if (d > 60) { bad++; outImg.data[i] = 230; outImg.data[i + 1] = 30; outImg.data[i + 2] = 30 } else { outImg.data[i] = outImg.data[i + 1] = outImg.data[i + 2] = 200 + g / 5 }
          outImg.data[i + 3] = 255
        }
        ctx.putImageData(outImg, 0, 0)
        return { pct: (bad / (1280 * 720)) * 100, diff: c.toDataURL('image/png') }
      }, a, b)
      writeFileSync(join(out, `diff-${String(n).padStart(3, '0')}.png`), Buffer.from(diff.split(',')[1], 'base64'))
      results.push({ n, diffPct: Math.round(pct * 100) / 100 })
      console.log(`${String(n).padStart(3)}  ${pct.toFixed(2)}% distinto`)
    }
  } finally {
    await done()
  }
  writeFileSync(join(out, 'compare.json'), JSON.stringify(results, null, 2))
  const worst = [...results].sort((x, y) => y.diffPct - x.diffPct).slice(0, 5)
  console.log(`\n${results.length} slides · promedio ${(results.reduce((s, r) => s + r.diffPct, 0) / Math.max(1, results.length)).toFixed(2)}% · peores: ${worst.map((w) => `#${w.n} ${w.diffPct}%`).join(', ')}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
