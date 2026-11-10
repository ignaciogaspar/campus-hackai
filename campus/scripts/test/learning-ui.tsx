// Browser regression against an isolated PostgREST fixture and the production build.
// Run: node --import tsx scripts/test/learning-ui.tsx (after npm run build).
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import puppeteer, { type Page } from 'puppeteer-core'
import { learningFixture, STUDENT_A, STUDENT_B, TEACHER } from '../../tests/learning-fixture'
import { signSession, SESSION_COOKIE } from '../../lib/session-token'

async function main() {
  const fixture = learningFixture()
  const secret = 'isolated-learning-browser-test-secret'
  const out = process.env.LEARNING_SCREENSHOTS ?? '/private/tmp/campus-learning-shots'
  await mkdir(out, { recursive: true })
  const server = createServer(async (req, res) => {
    try {
      const chunks: Buffer[] = []
      for await (const chunk of req) chunks.push(Buffer.from(chunk))
      const result = await fixture.fetch(`http://fixture.invalid${req.url}`, {
        method: req.method, headers: req.headers as Record<string, string>,
        ...(chunks.length ? { body: Buffer.concat(chunks) } : {}),
      })
      res.writeHead(result.status, Object.fromEntries(result.headers))
      res.end(await result.text())
    } catch (error) { res.writeHead(500); res.end(String(error)) }
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address() as { port: number }
  const port = process.env.LEARNING_UI_PORT ?? '3197'
  const origin = `http://127.0.0.1:${port}`
  const app = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-H', '127.0.0.1', '-p', port], {
    env: { ...process.env, SESSION_SECRET: secret, NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${address.port}`, SUPABASE_SERVICE_ROLE_KEY: 'fixture-service' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let logs = ''
  app.stdout.on('data', (d) => { logs += d })
  app.stderr.on('data', (d) => { logs += d })
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | undefined
  const errors: string[] = []
  try {
    for (let i = 0; i < 100; i++) {
      if (app.exitCode != null) throw new Error(logs)
      if (await fetch(`${origin}/icon.svg`).then((r) => r.ok).catch(() => false)) break
      await new Promise((r) => setTimeout(r, 200))
    }
    browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] })
    const pageFor = async (id: string, role: 'profesor' | 'alumno') => {
      const context = await browser!.createBrowserContext()
      await context.setCookie({ name: SESSION_COOKIE, value: signSession({ personId: id, role }, { secret }), url: origin })
      const page = await context.newPage()
      page.on('pageerror', (error) => errors.push(String(error)))
      await page.setViewport({ width: 1440, height: 1050 })
      return page
    }
    const waitText = (page: Page, text: string) => page.waitForFunction((t) => document.body.innerText.includes(t), { timeout: 15000 }, text)
    const click = async (page: Page, text: string) => {
      await page.waitForFunction((t) => Array.from(document.querySelectorAll('button')).some((b) => b.textContent?.trim() === t && !b.disabled), {}, text)
      await page.evaluate((t) => (Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.trim() === t) as HTMLButtonElement).click(), text)
    }
    const screenshot = async (page: Page, name: string, width: number) => {
      await page.setViewport({ width, height: width < 500 ? 844 : 1050 })
      await page.evaluate(() => document.fonts.ready)
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `sin overflow horizontal: ${name}`)
      await page.screenshot({ path: `${out}/${name}.png`, fullPage: true })
    }
    const student = await pageFor(STUDENT_A, 'alumno')
    await student.goto(`${origin}/campus/aprendizaje`, { waitUntil: 'networkidle0' })
    await student.type('textarea[name="takeaway"]', 'Distinguir automatización de una decisión con criterio.')
    await student.type('textarea[name="unclear"]', 'Cómo definir un costo de error aceptable.')
    await student.type('textarea[name="application"]', 'Revisar las aprobaciones de compras de mi organización.')
    await click(student, 'Guardar mi reflexión')
    await waitText(student, 'Reflexión guardada')
    assert.equal(fixture.tables.session_reflections.length, 1)

    // A failed write keeps the controlled fields intact.
    fixture.fail('session_reflections')
    await click(student, 'Guardar mi reflexión')
    await waitText(student, 'No pudimos guardar')
    assert.ok(await student.$eval('textarea[name="takeaway"]', (el) => (el as HTMLTextAreaElement).value.includes('criterio')))
    fixture.fail('')

    const teacher = await pageFor(TEACHER, 'profesor')
    await teacher.goto(`${origin}/profesor/devoluciones?jornada=aicm-j1&alumno=${STUDENT_A}`, { waitUntil: 'networkidle0' })
    await waitText(teacher, 'Distinguir automatización')
    await click(teacher, 'Preparar borrador')
    await click(teacher, 'Guardar borrador')
    await waitText(teacher, 'Borrador guardado')
    await student.reload({ waitUntil: 'networkidle0' })
    assert.ok(!(await student.content()).includes('gracias por compartir tu recorrido'))
    await click(teacher, 'Publicar ahora')
    await waitText(teacher, 'Devolución publicada')
    await screenshot(teacher, 'docente-desktop', 1440)
    await screenshot(teacher, 'docente-mobile', 390)

    await student.reload({ waitUntil: 'networkidle0' })
    await waitText(student, 'gracias por compartir tu recorrido')
    await screenshot(student, 'aprendizaje-desktop', 1440)
    await screenshot(student, 'aprendizaje-mobile', 390)
    await click(student, 'Marcar como leída')
    await waitText(student, 'Leída ·')
    assert.equal(fixture.tables.session_feedback[0].applied_at, null)
    await click(student, 'Ya apliqué el próximo paso')
    await waitText(student, 'Aplicación registrada')
    await student.reload({ waitUntil: 'networkidle0' })
    await waitText(student, 'gracias por compartir tu recorrido')

    const other = await pageFor(STUDENT_B, 'alumno')
    await other.goto(`${origin}/campus/aprendizaje`, { waitUntil: 'networkidle0' })
    assert.ok(!(await other.content()).includes('gracias por compartir tu recorrido'))
    await teacher.goto(`${origin}/profesor/devoluciones?jornada=aicm-j1&alumno=${STUDENT_B}`, { waitUntil: 'networkidle0' })
    await click(teacher, 'Preparar borrador')
    await teacher.$eval('.learning-schedule', (el) => { (el as HTMLDetailsElement).open = true })
    const tomorrowBA = new Date(Date.now() + 86400_000 - 3 * 3600_000).toISOString().slice(0, 16)
    await teacher.locator('input[name="publishAt"]').fill(tomorrowBA)
    await click(teacher, 'Programar devolución')
    await waitText(teacher, 'Devolución programada')
    await other.reload({ waitUntil: 'networkidle0' })
    assert.ok(!(await other.content()).includes('gracias por compartir tu recorrido'))
    await other.goto(`${origin}/profesor/devoluciones`, { waitUntil: 'networkidle0' })
    assert.equal(new URL(other.url()).pathname, '/campus')

    await student.goto(`${origin}/campus`, { waitUntil: 'networkidle0' })
    await waitText(student, 'Preparar mi jornada')
    await screenshot(student, 'home-desktop', 1440)
    await screenshot(student, 'home-mobile', 390)
    assert.deepEqual(errors, [])
    console.log(`Browser flow passed: reflection, error recovery, draft privacy, publish, read/application, history, scheduling, role boundary and 6 responsive screenshots. ${out}`)
  } catch (error) {
    if (browser) for (const page of await browser.pages()) {
      console.error('Failed page:', page.url(), (await page.evaluate(() => document.body.innerText)).slice(-2500))
      await page.screenshot({ path: `${out}/failure-${Date.now()}.png`, fullPage: true }).catch(() => {})
    }
    console.error('Client errors:', errors)
    console.error(logs.slice(-4000))
    throw error
  } finally {
    await browser?.close()
    app.kill('SIGTERM')
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1 })
