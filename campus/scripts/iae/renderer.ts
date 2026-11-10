/* ============================================================
   Render estático de slides 'iae' en Chrome headless, sin next dev.

   Usa EXACTAMENTE lo mismo que el campus: el CSS empaquetado
   (lib/iae/css.generated.ts), el markup (lib/iae/markup →
   iaeStageHtml) y el sanitizador, dentro de un Shadow DOM de
   1280×720. Las rutas /decks/... se sirven desde public/ por
   intercepción de requests (origen ficticio http://campus.local),
   así que varios procesos pueden correr en paralelo sin pisarse
   (cada uno con su Chrome y su perfil temporal).
   ============================================================ */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { extname, join, resolve } from 'node:path'
import puppeteer, { type Browser, type Page } from 'puppeteer-core'
import { parseSlide, slideTitle } from '@/lib/decks/parse'
import { IAE_CSS } from '@/lib/iae/css.generated'
import { iaeInteractiveParts } from '@/lib/iae/interactive'
import { IAE_FONTS_HREF, iaeStageHtml } from '@/lib/iae/markup'
import type { IaeParts } from '@/lib/iae/markup'
import { IAE_MEDIA_BASE, sanitizeIaeHtml } from '@/lib/iae/sanitize'
import { iaeStyleWarnings } from '@/lib/iae/check'

export const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const ORIGIN = 'http://campus.local'
const PUBLIC = resolve(__dirname, '../../public')

export interface RenderInput {
  /** Rótulo para el reporte (p. ej. «12»). */
  label: string
  /** Markdown de la slide (`:::iae …` o una interactiva del DSL). */
  markdown: string
}

export interface SlideReport {
  n: number
  label: string
  title: string
  kind: string
  png?: string
  skipped?: string
  /** Elementos que se salen del escenario o texto cortado. */
  overflow: string[]
  /** Imágenes y videos que no cargan. */
  broken: string[]
  /** Problemas duros del parser (HTML no permitido, vacía). */
  issues: string[]
  /** Avisos de estilo (lib/iae/check). */
  style: string[]
}

const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp', '.avif': 'image/avif',
  '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.webm': 'video/webm', '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.json': 'application/json', '.woff2': 'font/woff2', '.pdf': 'application/pdf',
}

const BASE_PAGE = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="${IAE_FONTS_HREF}">
<style>html,body{margin:0;padding:0;background:#fff;overflow:hidden}#host{width:1280px;height:720px}</style>
</head><body><div id="host"></div></body></html>`

export function slidePartsFor(markdown: string): { parts: IaeParts | null; kind: string; title: string; issues: string[] } {
  const parsed = parseSlide(markdown)
  const title = slideTitle(parsed)
  if (parsed.type === 'iae' && parsed.iae) return { parts: parsed.iae, kind: 'iae', title, issues: parsed.issues ?? [] }
  if (parsed.interactive) return { parts: iaeInteractiveParts(parsed), kind: parsed.type, title, issues: parsed.issues ?? [] }
  return { parts: null, kind: parsed.type, title, issues: parsed.issues ?? [] }
}

export async function launch(): Promise<{ browser: Browser; done: () => Promise<void> }> {
  if (!existsSync(CHROME)) throw new Error(`No encuentro Chrome en ${CHROME} (CHROME_PATH para cambiarlo)`)
  const profile = mkdtempSync(join(tmpdir(), 'iae-render-'))
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    userDataDir: profile,
    args: ['--hide-scrollbars', '--mute-audio', '--disable-gpu', '--force-color-profile=srgb', '--font-render-hinting=none'],
  })
  return {
    browser,
    done: async () => {
      await browser.close().catch(() => {})
      rmSync(profile, { recursive: true, force: true })
    },
  }
}

/** Página con el origen ficticio: /decks/... sale de public/, el resto pasa. */
export async function campusPage(browser: Browser): Promise<Page> {
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 })
  // tsx (esbuild keepNames) envuelve funciones con __name(): en el navegador no existe
  await page.evaluateOnNewDocument('globalThis.__name = (f) => f')
  await page.setRequestInterception(true)
  page.on('request', (req) => {
    const url = req.url()
    if (!url.startsWith(ORIGIN)) { void req.continue(); return }
    const path = decodeURIComponent(new URL(url).pathname)
    if (path === '/__render') { void req.respond({ status: 200, contentType: 'text/html', body: BASE_PAGE }); return }
    const file = resolve(PUBLIC, `.${path}`)
    if (!file.startsWith(PUBLIC) || !existsSync(file)) { void req.respond({ status: 404, contentType: 'text/plain', body: 'not found' }); return }
    void req.respond({ status: 200, contentType: MIME[extname(file).toLowerCase()] ?? 'application/octet-stream', body: readFileSync(file) })
  })
  await page.goto(`${ORIGIN}/__render`, { waitUntil: 'load' })
  await page.evaluate((css) => {
    const host = document.getElementById('host')!
    const root = host.attachShadow({ mode: 'open' })
    const sheet = new CSSStyleSheet()
    sheet.replaceSync(css)
    root.adoptedStyleSheets = [sheet]
  }, IAE_CSS)
  return page
}

/** Dibuja una slide en la página y mide desbordes e imágenes rotas. */
export async function renderOne(page: Page, markup: string): Promise<{ overflow: string[]; broken: string[] }> {
  return page.evaluate(async (html) => {
    const root = document.getElementById('host')!.shadowRoot!
    root.innerHTML = html
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
    const imgs = Array.from(root.querySelectorAll('img'))
    const videos = Array.from(root.querySelectorAll('video'))
    await Promise.race([
      Promise.all([
        document.fonts.ready,
        ...imgs.map((img) => (img.complete ? Promise.resolve() : new Promise((r) => { img.addEventListener('load', r, { once: true }); img.addEventListener('error', r, { once: true }) }))),
        ...videos.map((v) => new Promise((r) => {
          if (v.readyState >= 1 || v.error) { r(null); return }
          v.preload = 'metadata'
          v.addEventListener('loadedmetadata', r, { once: true })
          v.addEventListener('error', r, { once: true })
          v.querySelectorAll('source').forEach((s) => s.addEventListener('error', r, { once: true }))
          v.load()
        })),
      ]),
      wait(8000),
    ])
    await document.fonts.ready
    await wait(60)

    const describe = (el: Element) => {
      const cls = (el.getAttribute('class') ?? '').trim().split(/\s+/).filter(Boolean).slice(0, 2).join('.')
      const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40)
      return `<${el.tagName.toLowerCase()}${cls ? `.${cls}` : ''}>${text ? ` «${text}»` : ''}`
    }
    const section = root.querySelector('section.slide')!
    const overflow: string[] = []
    const W = 1280
    const H = 720
    const T = 2
    const ignored = (el: Element) => Boolean(el.closest('.rule, .logo, .counter, .notes, .sr-only')) || Boolean(el.closest('svg') && el.tagName.toLowerCase() !== 'svg')
    const hasOwnText = (el: Element) => Array.from(el.childNodes).some((n) => n.nodeType === 3 && (n.textContent ?? '').trim().length > 0)
    /** Lo que se ve: texto propio, imagen/video/svg/iframe, o caja con fondo o borde. */
    const isVisual = (el: Element, st: CSSStyleDeclaration) => {
      const tag = el.tagName.toLowerCase()
      if (['img', 'video', 'svg', 'iframe', 'canvas', 'pre', 'table'].includes(tag)) return true
      if (hasOwnText(el)) return true
      const bg = st.backgroundColor !== 'rgba(0, 0, 0, 0)' && st.backgroundColor !== 'transparent'
      const border = ['Top', 'Right', 'Bottom', 'Left'].some((s) => parseFloat(st.getPropertyValue(`border-${s.toLowerCase()}-width`)) > 0 && st.getPropertyValue(`border-${s.toLowerCase()}-style`) !== 'none')
      return bg || border || st.backgroundImage !== 'none'
    }
    const outOf = (r: DOMRect, b: { left: number; top: number; right: number; bottom: number }) => r.right > b.right + T || r.bottom > b.bottom + T || r.left < b.left - T || r.top < b.top - T
    const stage = { left: 0, top: 0, right: W, bottom: H }
    const reportedStage = new Set<Element>()
    const reportedClip = new Set<Element>()
    let bodyBottom = 0
    const body = section.querySelector(':scope > .body')
    for (const el of Array.from(section.querySelectorAll('*'))) {
      if (ignored(el)) continue
      const st = getComputedStyle(el)
      if (st.display === 'none' || st.visibility === 'hidden' || st.opacity === '0') continue
      if (!isVisual(el, st)) continue
      const r = el.getBoundingClientRect()
      if (r.width < 2 || r.height < 2) continue
      if (r.right < -500 || r.bottom < -500) continue // fuera de pantalla a propósito (left:-9999px)
      if (body && body.contains(el)) bodyBottom = Math.max(bodyBottom, r.bottom)
      if (outOf(r, stage)) {
        let a = el.parentElement
        let ancestorReported = false
        while (a && a !== section) { if (reportedStage.has(a)) { ancestorReported = true; break } a = a.parentElement }
        reportedStage.add(el)
        if (!ancestorReported) overflow.push(`se sale del escenario: ${describe(el)} (${Math.round(r.left)},${Math.round(r.top)} → ${Math.round(r.right)},${Math.round(r.bottom)})`)
      }
      // recortado por un contenedor con overflow != visible
      let a = el.parentElement
      while (a && a !== section) {
        const ast = getComputedStyle(a)
        if ((ast.overflowX !== 'visible' || ast.overflowY !== 'visible') && !reportedClip.has(a)) {
          const ar = a.getBoundingClientRect()
          if (outOf(r, ar)) {
            reportedClip.add(a)
            overflow.push(`contenido cortado dentro de ${describe(a)}: ${describe(el)}`)
          }
        }
        a = a.parentElement
      }
    }
    if (bodyBottom > 690) overflow.push(`el contenido baja hasta y=${Math.round(bodyBottom)} (dejá libre de 690 para abajo: fuente y contador)`)
    const broken: string[] = []
    for (const img of imgs) if (!img.naturalWidth) broken.push(`imagen rota: ${img.getAttribute('src')}`)
    for (const v of videos) {
      const src = v.getAttribute('src') ?? v.querySelector('source')?.getAttribute('src')
      if (v.error || v.networkState === 3 || v.readyState === 0) broken.push(`video que no carga: ${src}`)
      const poster = v.getAttribute('poster')
      if (poster) {
        const ok = await new Promise<boolean>((r) => { const i = new Image(); i.onload = () => r(true); i.onerror = () => r(false); i.src = poster })
        if (!ok) broken.push(`poster roto: ${poster}`)
      }
    }
    return { overflow: [...new Set(overflow)], broken }
  }, markup)
}

export interface RenderOptions {
  outDir: string
  /** Carpeta para rutas relativas (default /decks/empresas-familiares/). */
  base?: string
  /** Prefijo de los PNG (default «slide-»). */
  prefix?: string
  /** Índices 0-based a renderizar (default todos). */
  only?: Set<number>
  /** Mostrar el contador de la slide como en el deck original (default true). */
  counter?: boolean
  /** Nombre de archivo propio por slide (sin .png). */
  fileName?: (input: RenderInput, i: number) => string
}

export async function renderSlides(inputs: RenderInput[], opts: RenderOptions): Promise<SlideReport[]> {
  mkdirSync(opts.outDir, { recursive: true })
  const { browser, done } = await launch()
  const reports: SlideReport[] = []
  try {
    const page = await campusPage(browser)
    for (let i = 0; i < inputs.length; i++) {
      if (opts.only && !opts.only.has(i)) continue
      const input = inputs[i]
      const { parts, kind, title, issues } = slidePartsFor(input.markdown)
      const rep: SlideReport = { n: i + 1, label: input.label, title, kind, overflow: [], broken: [], issues, style: [] }
      if (!parts) {
        rep.skipped = `slide :::${kind} del DSL del campus: no es 'iae' ni interactiva (se dibuja con SlideCanvas)`
        reports.push(rep)
        continue
      }
      if (kind === 'iae') rep.style = iaeStyleWarnings(parts)
      const { html } = sanitizeIaeHtml(parts.html, { base: opts.base ?? IAE_MEDIA_BASE })
      const markup = iaeStageHtml({ classes: parts.classes, html }, { index: opts.counter === false ? undefined : i, trusted: true })
      const res = await renderOne(page, markup)
      rep.overflow = res.overflow
      rep.broken = res.broken
      const name = opts.fileName ? opts.fileName(input, i) : `${opts.prefix ?? 'slide-'}${String(i + 1).padStart(3, '0')}`
      const png = join(opts.outDir, `${name}.png`)
      await page.screenshot({ path: png as `${string}.png`, clip: { x: 0, y: 0, width: 1280, height: 720 } })
      rep.png = png
      reports.push(rep)
    }
  } finally {
    await done()
  }
  return reports
}

export function writeReport(outDir: string, reports: SlideReport[], meta: Record<string, unknown>): string {
  const file = join(outDir, 'report.json')
  writeFileSync(file, JSON.stringify({ ...meta, generatedAt: new Date().toISOString(), slides: reports }, null, 2))
  return file
}
