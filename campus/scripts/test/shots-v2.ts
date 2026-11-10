// Capturas de los decks v2 en el campus real (next start) para docs/shots/v2/.
// Abre una clase en vivo por jornada (server action real), navega a 4 slides,
// abre la encuesta de la slide (QR), y saca el proyector, el celular del alumno,
// Mi organización, una actividad y un caso HBS. Usa la DB real: después corré
// cleanup.ts con el archivo de estado.
//
//   npx next build && npx next start -p 3210
//   set -a; source .env.local; set +a
//   SMOKE_OUT=/tmp/shots-state.json npx tsx scripts/test/shots-v2.ts
//   npx tsx scripts/test/cleanup.ts /tmp/shots-state.json
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import puppeteer, { type Browser, type Page } from 'puppeteer-core'
import { SESSION_COOKIE, signSession, type Role } from '@/lib/session-token'
import { personId } from '@/lib/ids'
import { serviceDb } from '@/lib/db-node'
import { CHROME } from '../iae/renderer'

const BASE = process.env.SMOKE_BASE ?? 'http://localhost:3210'
const OUT = process.env.SMOKE_OUT ?? join(tmpdir(), 'campus-shots-state.json')
const DIR = resolve(__dirname, '../../docs/shots/v2')
const sb = serviceDb()

/** Por jornada: [posición 0-based, nombre]. La encuesta se abre con su QR. */
const PLAN: Record<number, { mech: number; code: number; poll: number; reuse: number; reuseNote: string }> = {
  1: { mech: 35, code: 31, poll: 3, reuse: 48, reuseNote: 'EF #43 (Generalist, video)' },
  2: { mech: 30, code: 8, poll: 11, reuse: 4, reuseNote: 'sin slide de EF: separador blue pause-center de Ignacio' },
  3: { mech: 4, code: 10, poll: 16, reuse: 40, reuseNote: 'sin slide de EF: pausa blue pause-center de Ignacio' },
  4: { mech: 33, code: 26, poll: 23, reuse: 2, reuseNote: 'EF #15 (viñeta)' },
  5: { mech: 17, code: 37, poll: 24, reuse: 18, reuseNote: 'Zillow con la captura de The Guardian de EF #26' },
  6: { mech: 4, code: 6, poll: 12, reuse: 29, reuseNote: 'sin slide de EF: pausa blue pause-center de Ignacio' },
  7: { mech: 10, code: 6, poll: 18, reuse: 30, reuseNote: 'sin slide de EF: pausa blue pause-center de Ignacio' },
  8: { mech: 25, code: 24, poll: 33, reuse: 41, reuseNote: 'EF #70 (Wall-E, deskilling)' },
}

async function forge(slug: string, role: Role): Promise<string> {
  const id = personId(slug)
  const { data } = await sb.from('people').select('session_version').eq('id', id).single()
  return signSession({ personId: id, role, v: Number(data?.session_version ?? 0) })
}

function actionId(name: string, file: string): string {
  const m = JSON.parse(readFileSync(join(process.cwd(), '.next/server/server-reference-manifest.json'), 'utf8'))
  for (const [id, v] of Object.entries<any>(m.node)) {
    if (v.exportedName === name && Object.keys(v.workers ?? {}).length && JSON.stringify(v).includes(file)) return id
  }
  throw new Error(`action ${name} no encontrada`)
}

async function api(path: string, cookie: string, body?: unknown, method?: string) {
  const res = await fetch(BASE + path, {
    method: method ?? (body ? 'POST' : 'GET'),
    headers: { cookie: `${SESSION_COOKIE}=${cookie}`, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  try { return { status: res.status, json: JSON.parse(text) } } catch { return { status: res.status, json: null as any } }
}

async function startLive(prof: string, deckId: string): Promise<{ id: string; code: string }> {
  const fd = new FormData()
  fd.append('_1_deckId', deckId)
  fd.append('_1_classSessionId', deckId)
  fd.append('_1_force', '1')
  fd.append('0', JSON.stringify(['$K1']))
  const res = await fetch(`${BASE}/profesor`, { method: 'POST', headers: { cookie: `${SESSION_COOKIE}=${prof}`, 'Next-Action': actionId('startLiveSession', 'start-live'), accept: 'text/x-component' }, body: fd, redirect: 'manual' })
  const loc = res.headers.get('x-action-redirect') ?? res.headers.get('location') ?? ''
  const id = loc.match(/\/live\/([0-9a-f-]{36})/)?.[1]
  if (!id) throw new Error(`startLiveSession ${deckId}: ${res.status} ${loc}`)
  const st = await api(`/api/live/${id}/state`, prof)
  return { id, code: st.json.code }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function pageFor(browser: Browser, cookie: string, viewport: { width: number; height: number; mobile?: boolean }, panel?: boolean): Promise<Page> {
  const page = await browser.newPage()
  // panel lateral de la consola: preferencia guardada (tecla T); sin clics, que en la slide navegan
  if (panel !== undefined) await page.evaluateOnNewDocument((v: string) => { try { localStorage.setItem('live.panel', v) } catch { /* nada */ } }, panel ? '1' : '0')
  await page.setViewport({ width: viewport.width, height: viewport.height, deviceScaleFactor: viewport.mobile ? 2 : 1, isMobile: Boolean(viewport.mobile), hasTouch: Boolean(viewport.mobile) })
  const host = new URL(BASE).hostname
  await page.setCookie({ name: SESSION_COOKIE, value: cookie, domain: host, path: '/' })
  return page
}

async function shot(page: Page, url: string, file: string, opts: { wait?: number; keys?: string[]; full?: boolean } = {}) {
  await page.goto(BASE + url, { waitUntil: 'networkidle2', timeout: 60_000 })
  await page.evaluate(() => document.fonts?.ready)
  for (const k of opts.keys ?? []) {
    await page.keyboard.press(k as any)
    await sleep(250)
  }
  await sleep(opts.wait ?? 1800)
  await page.screenshot({ path: join(DIR, file), fullPage: Boolean(opts.full) })
  console.log(`  ${file}`)
}

async function main() {
  mkdirSync(DIR, { recursive: true })
  const state: Record<string, unknown> = { startedAt: new Date().toISOString(), lives: [] as string[] }
  writeFileSync(OUT, JSON.stringify(state))
  const prof = await forge('ignacio-berdinas', 'profesor')
  const alu = await forge('mariana-etcheverry', 'alumno')
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--hide-scrollbars', '--mute-audio', '--force-color-profile=srgb'] })
  const notes: string[] = []
  try {
    for (let n = 1; n <= 8; n++) {
      const deckId = `aicm-j${n}`
      const p = PLAN[n]
      const live = await startLive(prof, deckId)
      ;(state.lives as string[]).push(live.id)
      writeFileSync(OUT, JSON.stringify(state))
      console.log(`${deckId}: clase ${live.code}`)
      const proj = await pageFor(browser, prof, { width: 1920, height: 1080 }, false)
      // sin panel lateral y H oculta la barra: lo que ve la sala
      const capture = async (pos: number, name: string) => {
        await api(`/api/live/${live.id}/goto`, prof, { position: pos })
        await shot(proj, `/live/${live.id}`, `j${n}-${name}.png`, { keys: ['h'] })
      }
      await capture(p.mech, 'mecanismo')
      await capture(p.code, 'codigo')
      await capture(p.reuse, 'ignacio')
      await api(`/api/live/${live.id}/goto`, prof, { position: p.poll })
      const op = await api(`/api/live/${live.id}/poll`, prof, { action: 'open', position: p.poll })
      if (op.status !== 200) console.warn(`  ! abrir encuesta ${deckId}#${p.poll}: ${op.status}`)
      await shot(proj, `/live/${live.id}`, `j${n}-encuesta-qr.png`, { keys: ['h'], wait: 2500 })
      notes.push(`j${n}: mecanismo #${p.mech + 1}, código #${p.code + 1}, encuesta #${p.poll + 1}, Ignacio #${p.reuse + 1} (${p.reuseNote})`)
      if (n === 7) {
        // la consola completa (panel del profesor) y el celular del alumno en una slide 'iae'
        await api(`/api/live/${live.id}/poll`, prof, { action: 'close' })
        await api(`/api/live/${live.id}/overlay`, prof, { overlay: null })
        await api(`/api/live/${live.id}/goto`, prof, { position: 5 })
        const consola = await pageFor(browser, prof, { width: 1920, height: 1080 }, true)
        await shot(consola, `/live/${live.id}`, 'j7-consola-profesor.png', { wait: 2500 })
        await consola.close()
        const phone = await pageFor(browser, alu, { width: 390, height: 844, mobile: true })
        await shot(phone, `/s/${live.code}`, 'alumno-celular-iae.png', { wait: 3000 })
        await phone.close()
      }
      await proj.close()
      await api(`/api/live/${live.id}/end`, prof, {})
    }

    // Mi organización (alumno ficticio del padrón, con una organización de ejemplo) y portfolio
    await api('/api/organizacion', alu, {
      name: 'Banco Ribera',
      kind: 'donde-trabajo',
      industry: 'Servicios financieros',
      size: '1000+',
      myRole: 'Jefa de operaciones de sucursales',
      description: 'Banco regional con 40 sucursales. Trabajo en operaciones: reclamos, conciliaciones y reportes al directorio.',
      processes: [
        { name: 'Clasificar reclamos de clientes', pain: 'Se leen a mano y se derivan por mail; tarda 2 días', volume: '1.200 por mes', owner: 'Atención al cliente' },
        { name: 'Conciliar transferencias rechazadas', pain: 'Planilla manual contra el core bancario', volume: '300 por semana', owner: 'Operaciones' },
        { name: 'Reporte mensual de mora por sucursal', pain: 'Se arma copiando de 3 sistemas', volume: '1 por mes, 2 días de trabajo', owner: 'Riesgo' },
      ],
      dataAssets: [{ name: 'Reclamos', where: 'CRM', notes: 'Texto libre + categoría manual' }],
      systems: [{ name: 'Core bancario', use: 'Cuentas y movimientos' }, { name: 'CRM', use: 'Reclamos' }],
    }, 'PUT')
    const desk = await pageFor(browser, alu, { width: 1440, height: 1000 })
    await shot(desk, '/campus/organizacion', 'mi-organizacion.png', { full: true })
    await shot(desk, '/campus', 'campus-home.png', { full: true })
    await shot(desk, '/campus/actividades/j4-sql', 'actividad-sql.png', { full: true, wait: 3000 })
    await shot(desk, '/campus/casos/hbs-harvey', 'caso-hbs-harvey.png', { full: true })
    await desk.close()
    const profDesk = await pageFor(browser, prof, { width: 1440, height: 1000 })
    await shot(profDesk, '/profesor', 'profesor-tablero.png', { full: true })
    await shot(profDesk, '/profesor/organizaciones', 'profesor-organizaciones.png', { full: true })
    await profDesk.close()
  } finally {
    await browser.close()
    writeFileSync(OUT, JSON.stringify(state))
  }
  console.log(notes.join('\n'))
}

main().catch((e) => { console.error(e); process.exitCode = 1 })
