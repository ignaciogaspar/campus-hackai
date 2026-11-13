/* Recorre HackAI en un Chrome headless con la sesión de una persona, sin pasar
   por el ingreso. Lo usan los agentes del workflow recorrer-ux
   (docs/agents/workflows.md) y sirve para las capturas de los PRs.

   Cada comando se conecta por CDP al Chrome de su puerto, hace una sola cosa,
   imprime un JSON y sale. Así varios agentes recorren a la vez, cada uno con su
   puerto, su perfil de Chrome y su cookie.

     SESSION_SECRET=<la del servidor> npm run recorrer -- iniciar --puerto 9300 --base http://localhost:3014 \
       --persona p-taguirre --rol alumno
     npm run recorrer -- ir /inscripciones --puerto 9300 --vista mobile
     npm run recorrer -- captura /ruta/fuera/del/repo.png --puerto 9300 --completa
     npm run recorrer -- cerrar --puerto 9300

   Solo entra a localhost: es para el servidor local con los datos sintéticos. */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { isRole } from '@/lib/core/people'
import { createSessionToken, hasSessionSecret, SESSION_COOKIE } from '@/lib/session-token'

type Flags = { positional: string[]; values: Record<string, string>; switches: Set<string> }

type View = { width: number; height: number; scale: number; mobile: boolean; fontSize: number | null }

/* Las vistas que se emulan. `desktop-zoom` es el navegador al 125 %: el ancho CSS
   baja a 1152 y cada px CSS ocupa 1,25 px de pantalla. `mobile-texto-grande` es
   la fuente del sistema agrandada a 20 px. */
const VIEWS: Record<string, View> = {
  mobile: { width: 390, height: 844, scale: 1, mobile: true, fontSize: null },
  desktop: { width: 1440, height: 900, scale: 1, mobile: false, fontSize: null },
  'desktop-zoom': { width: 1152, height: 720, scale: 1.25, mobile: false, fontSize: null },
  'mobile-texto-grande': { width: 390, height: 844, scale: 1, mobile: true, fontSize: 20 }
}

const MOBILE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
const DESKTOP_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

const LOCAL = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/
const CHROME_MAC = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const MAX_FULL_HEIGHT = 16000

type State = { base: string; view: string; persona: string | null }

function parseFlags(argv: string[]): Flags {
  const flags: Flags = { positional: [], values: {}, switches: new Set() }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (!arg.startsWith('--')) {
      flags.positional.push(arg)
      continue
    }
    const next = argv[i + 1]
    if (next === undefined || next.startsWith('--')) flags.switches.add(arg.slice(2))
    else {
      flags.values[arg.slice(2)] = next
      i++
    }
  }
  return flags
}

function dirFor(port: number): string {
  return join(tmpdir(), `hackai-recorrer-${port}`)
}

function readState(port: number): State {
  const file = join(dirFor(port), 'estado.json')
  if (!existsSync(file)) throw new Error(`No hay un Chrome iniciado en el puerto ${port}. Corré «iniciar» primero.`)
  return JSON.parse(readFileSync(file, 'utf8')) as State
}

function writeState(port: number, state: State) {
  writeFileSync(join(dirFor(port), 'estado.json'), JSON.stringify(state))
}

function portFrom(flags: Flags): number {
  const port = Number(flags.values.puerto)
  if (!Number.isInteger(port) || port < 1024) throw new Error('Falta --puerto <n> (un puerto libre, por ejemplo 9300).')
  return port
}

// ---------- CDP ----------

type Listener = (params: Record<string, unknown>) => void

type Cdp = {
  send: (method: string, params?: Record<string, unknown>) => Promise<Record<string, unknown>>
  on: (method: string, listener: Listener) => void
  close: () => void
}

type Pending = { resolve: (value: Record<string, unknown>) => void; reject: (error: Error) => void }

type CdpMessage = {
  id?: number
  method?: string
  params?: Record<string, unknown>
  result?: Record<string, unknown>
  error?: { message: string }
}

async function openSocket(url: string): Promise<Cdp> {
  const ws = new WebSocket(url)
  await new Promise<void>((resolve, reject) => {
    ws.onopen = () => resolve()
    ws.onerror = () => reject(new Error('No se pudo conectar con Chrome por CDP.'))
  })
  let lastId = 0
  const pending = new Map<number, Pending>()
  const listeners = new Map<string, Listener[]>()
  ws.onmessage = (event) => {
    const message = JSON.parse(String(event.data)) as CdpMessage
    if (message.id !== undefined) {
      const waiting = pending.get(message.id)
      pending.delete(message.id)
      if (message.error) waiting?.reject(new Error(message.error.message))
      else waiting?.resolve(message.result ?? {})
      return
    }
    for (const listener of listeners.get(message.method ?? '') ?? []) listener(message.params ?? {})
  }
  return {
    send: (method, params = {}) =>
      new Promise((resolve, reject) => {
        lastId++
        pending.set(lastId, { resolve, reject })
        ws.send(JSON.stringify({ id: lastId, method, params }))
      }),
    on: (method, listener) => listeners.set(method, [...(listeners.get(method) ?? []), listener]),
    close: () => ws.close()
  }
}

async function connectPage(port: number): Promise<Cdp> {
  const targets = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()) as {
    type: string
    webSocketDebuggerUrl: string
  }[]
  const page = targets.find((t) => t.type === 'page')
  if (!page) throw new Error('El Chrome de ese puerto no tiene ninguna pestaña abierta.')
  return openSocket(page.webSocketDebuggerUrl)
}

async function evaluate<T>(cdp: Cdp, expression: string): Promise<T> {
  const result = (await cdp.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true
  })) as { result?: { value?: T }; exceptionDetails?: { text?: string; exception?: { description?: string } } }
  if (result.exceptionDetails) {
    const detail = result.exceptionDetails.exception?.description ?? result.exceptionDetails.text
    throw new Error(`Falló el script en la página: ${detail}`)
  }
  return result.result?.value as T
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function applyView(cdp: Cdp, name: string) {
  const view = VIEWS[name]
  if (!view) throw new Error(`Vista desconocida: ${name}. Válidas: ${Object.keys(VIEWS).join(', ')}.`)
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: view.width,
    height: view.height,
    deviceScaleFactor: view.scale,
    mobile: view.mobile
  })
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: view.mobile })
  await cdp.send('Network.setUserAgentOverride', { userAgent: view.mobile ? MOBILE_UA : DESKTOP_UA })
  if (view.fontSize) await cdp.send('Page.setFontSizes', { fontSizes: { standard: view.fontSize, fixed: 16 } })
}

/** Lo que pasó en la página mientras corría una acción: errores de consola,
    excepciones y pedidos que fallaron o respondieron 4xx o 5xx. */
type Watch = { errors: string[]; http: string[]; inflight: () => number; idleMs: () => number }

async function watch(cdp: Cdp): Promise<Watch> {
  const errors: string[] = []
  const http: string[] = []
  const open = new Set<string>()
  await Promise.all(['Page.enable', 'Runtime.enable', 'Network.enable', 'Log.enable'].map((m) => cdp.send(m)))
  cdp.on('Runtime.consoleAPICalled', (p) => {
    if (p.type !== 'error') return
    const args = (p.args as { value?: unknown; description?: string }[]) ?? []
    errors.push(`consola: ${args.map((a) => String(a.value ?? a.description ?? '')).join(' ')}`.slice(0, 300))
  })
  cdp.on('Runtime.exceptionThrown', (p) => {
    const details = p.exceptionDetails as { exception?: { description?: string }; text?: string }
    errors.push(`excepción: ${details.exception?.description ?? details.text ?? ''}`.slice(0, 300))
  })
  cdp.on('Log.entryAdded', (p) => {
    const entry = p.entry as { level: string; text: string; url?: string }
    if (entry.level === 'error') errors.push(`log: ${entry.text} ${entry.url ?? ''}`.slice(0, 300))
  })
  let lastActivity = Date.now()
  const touch = () => {
    lastActivity = Date.now()
  }
  cdp.on('Network.requestWillBeSent', (p) => {
    touch()
    open.add(String(p.requestId))
  })
  cdp.on('Network.loadingFinished', (p) => {
    touch()
    open.delete(String(p.requestId))
  })
  cdp.on('Network.loadingFailed', (p) => {
    touch()
    open.delete(String(p.requestId))
    if (p.canceled !== true) http.push(`falló: ${p.errorText}`)
  })
  cdp.on('Network.responseReceived', (p) => {
    touch()
    const response = p.response as { status: number; url: string }
    if (response.status >= 400) http.push(`${response.status} ${response.url}`)
  })
  return { errors, http, inflight: () => open.size, idleMs: () => Date.now() - lastActivity }
}

/** Espera a que la red quede quieta: medio segundo sin pedidos abiertos, o un
    segundo y medio sin ningún evento de red (un redirect puede dejar un pedido
    que Chrome nunca cierra). Como mucho, `max` ms. */
async function settle(w: Watch, max = 10000) {
  const started = Date.now()
  let quietSince = Date.now()
  while (Date.now() - started < max) {
    await sleep(100)
    if (w.inflight() > 0) quietSince = Date.now()
    if (Date.now() - quietSince >= 500 || w.idleMs() >= 1500) return
  }
}

type Location = { url: string; titulo: string }

async function where(cdp: Cdp): Promise<Location> {
  return evaluate<Location>(cdp, '({ url: location.pathname + location.search, titulo: document.title })')
}

// ---------- Comandos ----------

async function waitForChrome(port: number) {
  for (let i = 0; i < 100; i++) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`)
      if (response.ok) return
    } catch {
      // Todavía arrancando.
    }
    await sleep(100)
  }
  throw new Error(`Chrome no respondió en el puerto ${port}.`)
}

async function iniciar(flags: Flags) {
  const port = portFrom(flags)
  const base = (flags.values.base ?? '').replace(/\/$/, '')
  if (!LOCAL.test(base)) throw new Error('--base tiene que ser el servidor local, por ejemplo http://localhost:3014.')
  const persona = flags.values.persona ?? null
  const role = flags.values.rol
  if (persona && !isRole(role)) throw new Error('Con --persona va --rol alumno o --rol profesor.')
  if (persona && !hasSessionSecret()) throw new Error('Falta SESSION_SECRET: tiene que ser la misma del servidor.')

  const dir = dirFor(port)
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(join(dir, 'perfil'), { recursive: true })
  const chrome = spawn(
    process.env.CHROME_PATH ?? CHROME_MAC,
    [
      '--headless=new',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${join(dir, 'perfil')}`,
      '--window-size=1440,900',
      '--no-first-run',
      '--no-default-browser-check',
      '--hide-scrollbars',
      'about:blank'
    ],
    { detached: true, stdio: 'ignore' }
  )
  chrome.unref()
  await waitForChrome(port)

  if (persona && isRole(role)) {
    const cdp = await connectPage(port)
    await cdp.send('Network.enable')
    await cdp.send('Network.setCookie', {
      name: SESSION_COOKIE,
      value: createSessionToken({ personId: persona, role }),
      url: base,
      httpOnly: true,
      sameSite: 'Lax'
    })
    cdp.close()
  }
  writeState(port, { base, view: 'desktop', persona })
  return { ok: true, puerto: port, base, persona, rol: persona ? role : null, pid: chrome.pid }
}

/** Abre la página y corre `action` con la vista aplicada y los errores vigilados. */
async function withPage<T>(flags: Flags, action: (cdp: Cdp, w: Watch, state: State) => Promise<T>) {
  const port = portFrom(flags)
  const state = readState(port)
  const view = flags.values.vista ?? state.view
  const cdp = await connectPage(port)
  try {
    const w = await watch(cdp)
    // Volver a emular la vista mueve el scroll: se guarda y se repone.
    const scroll = await evaluate<number>(cdp, 'scrollY')
    await applyView(cdp, view)
    if (view === state.view) await evaluate(cdp, `scrollTo(0, ${scroll})`)
    else writeState(port, { ...state, view })
    return await action(cdp, w, { ...state, view })
  } finally {
    cdp.close()
  }
}

async function ir(flags: Flags) {
  const path = flags.positional[1]
  if (!path?.startsWith('/')) throw new Error('Uso: ir /ruta')
  return withPage(flags, async (cdp, w, state) => {
    const started = Date.now()
    const loaded = new Promise<void>((resolve) => cdp.on('Page.loadEventFired', () => resolve()))
    await cdp.send('Page.navigate', { url: state.base + path })
    await Promise.race([loaded, sleep(20000)])
    await settle(w)
    const location = await where(cdp)
    const sinSesion = state.persona !== null && location.url.split('?')[0] === '/' && path !== '/'
    return { ...location, vista: state.view, ms: Date.now() - started, sinSesion, errores: w.errors, http: w.http }
  })
}

async function captura(flags: Flags) {
  const file = flags.positional[1]
  if (!file?.endsWith('.png')) throw new Error('Uso: captura <archivo.png> [--completa]')
  return withPage(flags, async (cdp, _w, state) => {
    const view = VIEWS[state.view]
    let height = view.height
    if (flags.switches.has('completa')) {
      height = Math.min(MAX_FULL_HEIGHT, await evaluate<number>(cdp, 'document.documentElement.scrollHeight'))
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: view.width,
        height,
        deviceScaleFactor: view.scale * Number(flags.values.escala ?? 1),
        mobile: view.mobile
      })
      await sleep(300)
    }
    const shot = (await cdp.send('Page.captureScreenshot', { format: 'png' })) as { data: string }
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, Buffer.from(shot.data, 'base64'))
    return { archivo: file, vista: state.view, ancho: view.width, alto: height, ...(await where(cdp)) }
  })
}

async function texto(flags: Flags) {
  return withPage(flags, async (cdp) => ({
    ...(await where(cdp)),
    texto: await evaluate<string>(cdp, 'document.body.innerText.slice(0, 20000)')
  }))
}

async function interactivos(flags: Flags) {
  return withPage(flags, async (cdp) => ({
    ...(await where(cdp)),
    elementos: await evaluate<unknown[]>(cdp, `(${PAGE_HELPERS})().list()`)
  }))
}

/** Corre una acción en la página y espera lo que dispare: navegación, pedidos, render. */
async function act(flags: Flags, script: (cdp: Cdp) => Promise<unknown>) {
  return withPage(flags, async (cdp, w) => {
    const before = await where(cdp)
    const result = await script(cdp)
    await sleep(300)
    await settle(w)
    const after = await where(cdp)
    return {
      resultado: result,
      antes: before.url,
      despues: after.url,
      titulo: after.titulo,
      errores: w.errors,
      http: w.http
    }
  })
}

function target(flags: Flags, usage: string): string {
  const value = flags.positional[1]
  if (value === undefined) throw new Error(usage)
  return JSON.stringify(value)
}

async function clic(flags: Flags) {
  const which = target(flags, 'Uso: clic <índice de «interactivos» | texto visible | selector CSS>')
  return act(flags, (cdp) => evaluate(cdp, `(${PAGE_HELPERS})().click(${which})`))
}

async function llenar(flags: Flags) {
  const which = target(flags, 'Uso: llenar <índice | selector> <valor>')
  const value = flags.positional[2] ?? ''
  return act(flags, async (cdp) => {
    const found = await evaluate<{ ok: boolean; nombre?: string; error?: string }>(
      cdp,
      `(${PAGE_HELPERS})().focusForTyping(${which})`
    )
    if (!found.ok) return found
    await cdp.send('Input.insertText', { text: value })
    return { ...found, escrito: value }
  })
}

async function elegir(flags: Flags) {
  const which = target(flags, 'Uso: elegir <índice | selector de un <select>> <valor o texto de la opción>')
  const value = JSON.stringify(flags.positional[2] ?? '')
  return act(flags, (cdp) => evaluate(cdp, `(${PAGE_HELPERS})().choose(${which}, ${value})`))
}

const KEYS: Record<string, { key: string; code: string; keyCode: number }> = {
  Tab: { key: 'Tab', code: 'Tab', keyCode: 9 },
  Enter: { key: 'Enter', code: 'Enter', keyCode: 13 },
  Escape: { key: 'Escape', code: 'Escape', keyCode: 27 },
  ArrowDown: { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40 },
  ArrowUp: { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38 },
  Space: { key: ' ', code: 'Space', keyCode: 32 }
}

/** Aprieta una tecla y cuenta dónde quedó el foco y si se ve. */
async function tecla(flags: Flags) {
  const name = flags.positional[1] ?? ''
  const key = KEYS[name]
  if (!key) throw new Error(`Uso: tecla <${Object.keys(KEYS).join('|')}>`)
  const shift = flags.switches.has('shift') ? 8 : 0
  return act(flags, async (cdp) => {
    const event = { ...key, windowsVirtualKeyCode: key.keyCode, modifiers: shift }
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', ...event, text: name === 'Enter' ? '\r' : undefined })
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', ...event })
    return evaluate(cdp, `(${PAGE_HELPERS})().focus()`)
  })
}

async function atras(flags: Flags) {
  return act(flags, (cdp) => evaluate(cdp, 'history.back()'))
}

async function auditar(flags: Flags) {
  return withPage(flags, async (cdp, _w, state) => ({
    ...(await where(cdp)),
    vista: state.view,
    hallazgos: await evaluate<unknown>(cdp, `(${PAGE_HELPERS})().audit(${VIEWS[state.view].mobile})`)
  }))
}

async function cerrar(flags: Flags) {
  const port = portFrom(flags)
  try {
    const version = (await (await fetch(`http://127.0.0.1:${port}/json/version`)).json()) as {
      webSocketDebuggerUrl: string
    }
    const browser = await openSocket(version.webSocketDebuggerUrl)
    await browser.send('Browser.close').catch(() => undefined)
    browser.close()
  } catch {
    // Ya estaba cerrado.
  }
  await sleep(300)
  rmSync(dirFor(port), { recursive: true, force: true })
  return { ok: true, puerto: port }
}

const COMMANDS: Record<string, (flags: Flags) => Promise<unknown>> = {
  iniciar,
  ir,
  captura,
  texto,
  interactivos,
  clic,
  llenar,
  elegir,
  tecla,
  atras,
  auditar,
  cerrar
}

async function main() {
  const flags = parseFlags(process.argv.slice(2))
  const command = COMMANDS[flags.positional[0] ?? '']
  if (!command) {
    console.log(
      JSON.stringify({ error: `Comandos: ${Object.keys(COMMANDS).join(', ')}. Ver el encabezado del script.` })
    )
    process.exitCode = 1
    return
  }
  try {
    console.log(JSON.stringify(await command(flags), null, 1))
  } catch (error) {
    console.log(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }))
    process.exitCode = 1
  }
}

/* Lo que corre adentro de la página. Va como texto porque se evalúa en Chrome,
   no en Node: no puede usar nada de este archivo. Marca cada elemento
   interactivo con data-recorrer-i para que «clic 3» encuentre el mismo elemento
   que listó «interactivos» en otro proceso. */
const PAGE_HELPERS = String.raw`function () {
  const SELECTOR = 'a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [role=link], [role=tab], [role=menuitem], [role=checkbox], [role=switch], [role=combobox], [tabindex]:not([tabindex="-1"])'
  const visible = (el) => {
    const r = el.getBoundingClientRect()
    const s = getComputedStyle(el)
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && s.opacity !== '0'
  }
  const clean = (t) => (t || '').replace(/\s+/g, ' ').trim()
  const labelOf = (el) => {
    if (el.getAttribute('aria-label')) return clean(el.getAttribute('aria-label'))
    const by = el.getAttribute('aria-labelledby')
    if (by) return clean(by.split(' ').map((id) => document.getElementById(id)?.innerText || '').join(' '))
    if (el.labels && el.labels.length) return clean(el.labels[0].innerText)
    const text = clean(el.innerText)
    if (text) return text.slice(0, 80)
    const img = el.querySelector && el.querySelector('img[alt], svg[aria-label]')
    if (img) return clean(img.getAttribute('alt') || img.getAttribute('aria-label'))
    return clean(el.getAttribute('title'))
  }
  const all = () => [...document.querySelectorAll(SELECTOR)].filter(visible)
  const describe = (el, i) => {
    const r = el.getBoundingClientRect()
    return {
      i, tag: el.tagName.toLowerCase(), rol: el.getAttribute('role') || undefined, nombre: labelOf(el),
      placeholder: el.getAttribute('placeholder') || undefined, tipo: el.getAttribute('type') || undefined,
      href: el.getAttribute('href') || undefined, valor: 'value' in el && el.tagName !== 'BUTTON' ? String(el.value).slice(0, 60) : undefined,
      deshabilitado: el.disabled || el.getAttribute('aria-disabled') === 'true' || undefined,
      caja: [Math.round(r.x), Math.round(r.y + scrollY), Math.round(r.width), Math.round(r.height)]
    }
  }
  const list = () => all().map((el, i) => { el.setAttribute('data-recorrer-i', String(i)); return describe(el, i) })
  const find = (which) => {
    if (/^\d+$/.test(String(which))) return document.querySelector('[data-recorrer-i="' + which + '"]')
    try { const bySelector = document.querySelector(which); if (bySelector) return bySelector } catch {}
    const wanted = clean(which).toLowerCase()
    const items = all()
    return items.find((el) => labelOf(el).toLowerCase() === wanted) || items.find((el) => labelOf(el).toLowerCase().includes(wanted))
  }
  const click = (which) => {
    const el = find(which)
    if (!el) return { ok: false, error: 'No encontré ' + which + '. Corré «interactivos» de nuevo: la página puede haber cambiado.' }
    el.scrollIntoView({ block: 'center' })
    const r = el.getBoundingClientRect()
    const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
    const covered = top && top !== el && !el.contains(top) ? labelOf(top) || top.tagName.toLowerCase() : undefined
    el.click()
    return { ok: true, nombre: labelOf(el), tapadoPor: covered }
  }
  const focusForTyping = (which) => {
    const el = find(which)
    if (!el) return { ok: false, error: 'No encontré ' + which }
    el.scrollIntoView({ block: 'center' })
    el.focus()
    if (el.select) el.select()
    return { ok: true, nombre: labelOf(el) }
  }
  const choose = (which, value) => {
    const el = find(which)
    if (!el || el.tagName !== 'SELECT') return { ok: false, error: 'No es un <select>: usá clic para los desplegables propios.' }
    const option = [...el.options].find((o) => o.value === value || clean(o.text) === clean(value))
    if (!option) return { ok: false, error: 'Opciones: ' + [...el.options].map((o) => clean(o.text)).join(' | ') }
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set
    setter.call(el, option.value)
    el.dispatchEvent(new Event('change', { bubbles: true }))
    return { ok: true, elegido: clean(option.text) }
  }
  const focus = () => {
    const el = document.activeElement
    if (!el || el === document.body) return { foco: 'body' }
    const s = getComputedStyle(el)
    const shows = s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0 || s.boxShadow !== 'none'
    return { foco: labelOf(el) || el.tagName.toLowerCase(), tag: el.tagName.toLowerCase(), focoVisible: shows }
  }
  // Los colores vienen en oklch() y color-mix(): el canvas los pasa a sRGB.
  const paint = document.createElement('canvas').getContext('2d', { willReadFrequently: true })
  const rgb = (c) => {
    if (!c) return null
    paint.clearRect(0, 0, 1, 1)
    paint.fillStyle = '#000'
    paint.fillStyle = c
    paint.fillRect(0, 0, 1, 1)
    const [r, g, b, a] = paint.getImageData(0, 0, 1, 1).data
    return [r, g, b, a / 255]
  }
  const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b) }
  const bgOf = (el) => {
    for (let n = el; n; n = n.parentElement) {
      const c = rgb(getComputedStyle(n).backgroundColor)
      if (c && (c[3] === undefined || c[3] > 0.9)) return c
      if (getComputedStyle(n).backgroundImage !== 'none') return null
    }
    return [255, 255, 255]
  }
  const ownText = (el) => clean([...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(' '))
  const textEls = () => [...document.querySelectorAll('body *')].filter((el) => visible(el) && ownText(el))
  const audit = (mobile) => {
    const W = innerWidth
    const out = {}
    out.scrollHorizontal = document.documentElement.scrollWidth > W + 1
    out.desbordan = [...document.querySelectorAll('body *')].filter((el) => visible(el) && el.getBoundingClientRect().right > W + 1).slice(0, 5).map((el) => el.tagName.toLowerCase() + ' «' + (ownText(el) || labelOf(el)).slice(0, 40) + '»')
    const items = all()
    out.sinNombre = items.filter((el) => !labelOf(el)).slice(0, 10).map((el) => el.outerHTML.slice(0, 120))
    out.camposSinEtiqueta = [...document.querySelectorAll('input:not([type=hidden]), select, textarea')].filter((el) => visible(el) && !(el.labels && el.labels.length) && !el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby')).map((el) => el.outerHTML.slice(0, 120))
    if (mobile) {
      const small = items.filter((el) => { const r = el.getBoundingClientRect(); return r.width < 44 || r.height < 44 })
      out.objetivosMenoresA44 = small.length
      out.objetivosMenoresA24 = small.filter((el) => { const r = el.getBoundingClientRect(); return r.width < 24 || r.height < 24 }).slice(0, 10).map((el) => labelOf(el) + ' ' + Math.round(el.getBoundingClientRect().width) + '×' + Math.round(el.getBoundingClientRect().height))
    }
    out.imagenesSinAlt = [...document.images].filter((img) => visible(img) && !img.hasAttribute('alt')).map((img) => img.src.slice(-60))
    const texts = textEls()
    out.truncados = texts.concat([...document.querySelectorAll('[class*=line-clamp], [class*=truncate]')]).filter((el) => { const s = getComputedStyle(el); return (s.textOverflow === 'ellipsis' || s.webkitLineClamp !== 'none') && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1) }).slice(0, 10).map((el) => clean(el.innerText).slice(0, 60))
    out.textoMenorA12px = texts.filter((el) => parseFloat(getComputedStyle(el).fontSize) < 12).slice(0, 10).map((el) => ownText(el).slice(0, 40) + ' (' + getComputedStyle(el).fontSize + ')')
    out.contrasteBajo = texts.map((el) => {
      const s = getComputedStyle(el); const fg = rgb(s.color); const bg = bgOf(el)
      if (!fg || !bg) return null
      const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x)
      const ratio = (a + 0.05) / (b + 0.05)
      const large = parseFloat(s.fontSize) >= 24 || (parseFloat(s.fontSize) >= 18.66 && Number(s.fontWeight) >= 700)
      return ratio < (large ? 3 : 4.5) ? ownText(el).slice(0, 40) + ' ' + ratio.toFixed(2) + ':1' : null
    }).filter(Boolean).slice(0, 12)
    const headings = [...document.querySelectorAll('h1, h2, h3, h4, h5, h6')].filter(visible).map((h) => Number(h.tagName[1]))
    out.h1 = headings.filter((h) => h === 1).length
    out.saltosDeEncabezado = headings.some((h, i) => i > 0 && h - headings[i - 1] > 1)
    out.idioma = document.documentElement.lang || null
    return out
  }
  return { list, click, focusForTyping, choose, focus, audit }
}`

main()
