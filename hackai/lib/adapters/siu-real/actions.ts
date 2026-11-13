/* Inscribirse y darse de baja en el SIU real, como lo hace la pantalla de
   Inscripción a Materias: abre la materia (`elegir_materia`), toma el
   formulario de la comisión con su `__csrf` fresco y lo manda por POST, igual
   que el botón «Inscribirse» o «Dar de baja». El SIU responde JSON con `cod`:
   mayor que 0 es éxito (con `mensaje_inscripcion`), -1 es un error con el
   mensaje en `cont`, -2 manda a otra página (por ejemplo, la sesión venció).
   Research: docs/research/2026-11-12-datos-reales-siu-campus.md. */
import { attrOf, pagelets, textOf } from '@/lib/adapters/siu-real/html'
import { splitSectionHeading } from '@/lib/adapters/siu-real/parse'
import type { SiuDropError, SiuEnrollError } from '@/lib/ports/siu'
import { fail, ok, type Result } from '@/lib/result'

export type SiuClient = {
  /** Un GET a la Autogestión con la sesión del alumno, como pedido AJAX; el JSON que responde, o `null`. */
  getJson(url: string): Promise<Record<string, unknown> | null>
  /** Un POST de formulario con la sesión del alumno, como pedido AJAX; el JSON que responde, o `null`. */
  postForm(url: string, fields: [string, string][]): Promise<Record<string, unknown> | null>
}

export type SiuForm = { action: string; fields: [string, string][] }

/** Los campos de un formulario: sus `input` con nombre (los ocultos llevan materia, comisión e inscripción). */
export function formOf(html: string): SiuForm | null {
  const action = attrOf(html.match(/<form\b[^>]*>/)?.[0] ?? '', 'action')
  if (!action) return null
  const fields = [...html.matchAll(/<input\b[^>]*>/g)].flatMap((m): [string, string][] => {
    const name = attrOf(m[0], 'name')
    const type = attrOf(m[0], 'type')
    return name && type !== 'submit' ? [[name, attrOf(m[0], 'value') ?? '']] : []
  })
  return { action, fields }
}

/** El HTML de la pantalla de una materia en Inscripción a Materias. */
async function subjectPage(client: SiuClient, url: string): Promise<string | null> {
  const found = await client.getJson(url)
  if (!found || typeof found.cont !== 'string') return null
  return [...pagelets(found.cont).values()].join('') || found.cont
}

/** El formulario para inscribirse en la comisión, buscada por nombre y período en la pantalla de su materia. Con
    subcomisiones (hay que elegir una de cada tipo) no se puede inscribir sin preguntarle al alumno: `null`. */
export function enrollFormIn(page: string, section: string, period: string): SiuForm | null {
  for (const chunk of page.split(/<li\b(?=[^>]*class=["']comision no-inscripto)/).slice(1)) {
    const heading = textOf(chunk.match(/<h4\b[^>]*>([\s\S]*?)<\/h4>/)?.[1] ?? '').replace(/^Comisi[oó]n:\s*/, '')
    const found = splitSectionHeading(heading, [period])
    if (found.name !== section || found.period !== period) continue
    const form = chunk.match(/<form\b[^>]*class=["']form_inscribir(?!_subcomisiones)[^"']*["'][\s\S]*?<\/form>/)
    return form && !/form_inscribir_subcomisiones/.test(chunk) ? formOf(form[0]) : null
  }
  return null
}

/** El formulario para darse de baja: el de la comisión donde el alumno está inscripto. */
export function dropFormIn(page: string): SiuForm | null {
  const form = page.match(/<form\b[^>]*class=["']form_baja["'][\s\S]*?<\/form>/)
  return form ? formOf(form[0]) : null
}

/** Lo que dijo el SIU, en el vocabulario del puerto. El mensaje de un error va en `message` para mostrarlo. */
type Outcome = { ok: true; message: string } | { ok: false; error: 'rechazo' | 'falla-externa'; message: string }

function outcomeOf(response: Record<string, unknown> | null): Outcome {
  if (!response) return { ok: false, error: 'falla-externa', message: '' }
  const cod = Number(response.cod)
  const message = textOf(String(response.mensaje_inscripcion ?? response.mensaje ?? response.cont ?? ''))
  if (cod > 0) return { ok: true, message }
  return { ok: false, error: cod === -1 || cod === -4 ? 'rechazo' : 'falla-externa', message }
}

/** El número de transacción del mensaje del SIU, o «sin número» si no lo trae. */
function transactionOf(message: string): string {
  return message.match(/(?:transacci[oó]n|comprobante)[^\d]{0,20}(\d+)/i)?.[1] ?? 'sin número'
}

/** Un rechazo del SIU como error del puerto, por lo que dice el mensaje. */
function rejectionOf(message: string): 'sin-cupo' | 'fuera-de-periodo' | 'ya-inscripto' | 'falla-externa' {
  if (/cupo/i.test(message)) return 'sin-cupo'
  if (/per[ií]odo|fuera de (t[eé]rmino|fecha)|cerrad/i.test(message)) return 'fuera-de-periodo'
  if (/ya (est[aá]s? |se encuentra )?inscript/i.test(message)) return 'ya-inscripto'
  return 'falla-externa'
}

export type ActionResult<E extends string> = Result<{ transactionNumber: string; message: string }, E>

export async function enrollIn(
  client: SiuClient,
  subjectUrl: string,
  section: string,
  period: string
): Promise<ActionResult<SiuEnrollError>> {
  const page = await subjectPage(client, subjectUrl)
  if (page === null) return fail('falla-externa')
  const form = enrollFormIn(page, section, period)
  if (!form) return fail(page.includes('comision inscripto') ? 'ya-inscripto' : 'no-soportado')
  const outcome = outcomeOf(await client.postForm(form.action, form.fields))
  if (outcome.ok) return ok({ transactionNumber: transactionOf(outcome.message), message: outcome.message })
  return fail(outcome.error === 'rechazo' ? rejectionOf(outcome.message) : 'falla-externa')
}

export async function dropFrom(client: SiuClient, subjectUrl: string): Promise<ActionResult<SiuDropError>> {
  const page = await subjectPage(client, subjectUrl)
  if (page === null) return fail('falla-externa')
  const form = dropFormIn(page)
  if (!form) return fail('no-inscripto')
  const outcome = outcomeOf(await client.postForm(form.action, form.fields))
  if (outcome.ok) return ok({ transactionNumber: transactionOf(outcome.message), message: outcome.message })
  const reason = rejectionOf(outcome.message)
  return fail(outcome.error === 'rechazo' && reason === 'fuera-de-periodo' ? reason : 'falla-externa')
}

/** La constancia de la lista de Nueva solicitud que corresponde a un tipo del puerto, por su nombre. */
export function requestOptionFor<T extends { label: string }>(options: T[], type: 'alumno-regular' | 'examen-final') {
  const name = type === 'alumno-regular' ? /alumno regular/i : /examen final/i
  return options.find((o) => name.test(o.label)) ?? null
}

/** Pide una constancia como el botón «Guardar» de Nueva solicitud. Antes pregunta cuántas copias deja pedir el SIU.
    Las que piden elegir algo más (la de examen final pide la mesa) no se mandan: `null`, van a la Autogestión. */
export async function requestCertificateIn(
  client: SiuClient,
  form: { action: string; copiesUrl: string | null },
  option: { value: string; form: string | null },
  request: { copies: number; presentTo: string; notes: string }
): Promise<{ accepted: boolean; message: string } | 'falla-externa'> {
  if (form.copiesUrl) {
    const allowed = await client.getJson(`${form.copiesUrl}?constancia=${encodeURIComponent(option.value)}`)
    const max = Number(allowed?.copias)
    if (Number.isFinite(max) && max > 0 && request.copies > max)
      return { accepted: false, message: `El SIU deja pedir hasta ${max} copias.` }
  }
  const response = await client.postForm(form.action, [
    ['constancia', option.value],
    ['copias', String(request.copies)],
    ['presentar', request.presentTo],
    ['observaciones', request.notes],
    ['formulario', option.form ?? ''],
    ['formulario_campo', ''],
    ['formulario_valor', '']
  ])
  if (!response) return 'falla-externa'
  const message = textOf(String(response.mensaje ?? response.mensaje_usuario ?? ''))
  return { accepted: Boolean(response.ok) && Number(response.cod ?? 1) > 0, message }
}
