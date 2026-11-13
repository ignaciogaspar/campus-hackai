/* Lo que hace secretaría con el Planning: ver qué se entendió de la planilla
   (pegada o subida como .xlsx o .csv), guardarla, cargar una clase a mano y
   borrar una. Quién puede cargar lo decide Planning; estas acciones leen lo que
   llega del navegador, llaman al módulo y traducen cada error a un mensaje en
   voseo. Se usan con useActionState. */
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { SpaceActionState } from '@/app/actions/spaces'
import { requireSession } from '@/lib/auth'
import { system } from '@/lib/composition'
import type { Planning, PlanningCell, PlanningPreview } from '@/lib/core/planning'
import { rowsFromText } from '@/lib/delimited-text'
import { formText } from '@/lib/form-data'
import type { ErrorOf } from '@/lib/result'
import { readXlsx } from '@/lib/xlsx-read'

type LoadError = ErrorOf<ReturnType<Planning['load']>> | ErrorOf<ReturnType<Planning['remove']>>

const ERRORS: Record<LoadError, string> = {
  'solo-secretaria': 'Solo secretaría carga el planning.',
  'sin-clases': 'No entendimos ninguna fila. Revisá la vista previa: cada fila dice qué le falta.',
  'clase-desconocida': 'Esa clase ya no está en el planning.',
  'persona-desconocida': 'No encontramos tus datos. Salí y volvé a entrar.',
  'falla-externa': 'No pudimos guardarlo porque la base no responde. Probá de nuevo en un rato.'
}

const UNEXPECTED = 'Algo salió mal. Volvé a cargar la página y probá de nuevo.'

/** Lo más grande que se lee de un archivo de planilla. */
const MAX_FILE_BYTES = 5 * 1024 * 1024

export type PlanningPreviewState =
  | { status: 'idle' }
  | { status: 'error'; message: string; at: number }
  | { status: 'preview'; preview: PlanningPreview; rows: string; source: string; at: number }

const failed = (message: string) => ({ status: 'error' as const, message, at: Date.now() })

const isSheet = (name: string) => /\.xlsx$/i.test(name)
const isText = (name: string) => /\.(csv|tsv|txt)$/i.test(name)

/** Las filas del archivo subido o, si no hay archivo, del texto pegado. */
async function rowsOf(form: FormData): Promise<{ rows: PlanningCell[][]; source: string } | string> {
  const file = form.get('file')
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_FILE_BYTES) return 'El archivo pasa los 5 MB. Dejá solo la hoja de clases.'
    const bytes = Buffer.from(await file.arrayBuffer())
    if (isSheet(file.name)) {
      const rows = readXlsx(bytes)
      return rows
        ? { rows, source: file.name }
        : 'No pudimos leer ese .xlsx. Guardalo de nuevo desde Excel y volvé a subirlo.'
    }
    if (isText(file.name)) return { rows: rowsFromText(bytes.toString('utf8')), source: file.name }
    return 'Subí la planilla como .xlsx o .csv.'
  }
  const text = formText(form, 'text')
  if (!text.trim()) return 'Pegá las filas de tu planilla o elegí el archivo.'
  return { rows: rowsFromText(text), source: 'lo que pegaste' }
}

/** Lee la planilla y devuelve la vista previa. No guarda nada. */
export async function previewPlanning(_prev: PlanningPreviewState, form: FormData): Promise<PlanningPreviewState> {
  await requireSession('secretaria')
  const read = await rowsOf(form)
  if (typeof read === 'string') return failed(read)
  const preview = system().planning.preview(read.rows)
  if (preview.rows.length === 0) return failed('La planilla está vacía.')
  return { status: 'preview', preview, rows: JSON.stringify(read.rows), source: read.source, at: Date.now() }
}

/** Las filas que volvieron de la vista previa, si tienen la forma de una planilla. */
function parsedRows(raw: string): PlanningCell[][] | null {
  try {
    const rows: unknown = JSON.parse(raw)
    const isCell = (c: unknown) => c === null || typeof c === 'string' || typeof c === 'number'
    return Array.isArray(rows) && rows.every((r) => Array.isArray(r) && r.every(isCell))
      ? (rows as PlanningCell[][])
      : null
  } catch {
    return null
  }
}

/** Guarda la planilla ya vista: reemplaza el planning o le suma las clases. */
export async function savePlanning(_prev: SpaceActionState, form: FormData): Promise<SpaceActionState> {
  const session = await requireSession('secretaria')
  const rows = parsedRows(formText(form, 'rows'))
  const mode = formText(form, 'mode') === 'reemplazar' ? 'reemplazar' : 'agregar'
  if (!rows) return failed(UNEXPECTED)
  const result = await system().planning.load(session.personId, rows, mode)
  if (!result.ok) return failed(ERRORS[result.error])
  revalidatePath('/planning')
  redirect(`/cargar-clases?guardadas=${result.value.saved}`)
}

/** Carga una clase a mano: semanal con el día o, con fecha, un cambio de ese día. */
export async function addPlanningClass(_prev: SpaceActionState, form: FormData): Promise<SpaceActionState> {
  const session = await requireSession('secretaria')
  // El campo de fecha manda AAAA-MM-DD y los de hora, HH:MM: la planilla los entiende así.
  const { planning } = system()
  const row: PlanningCell[] = planning.columns.map(({ column }) => formText(form, column))
  const header = planning.columns.map((c) => c.header)
  const preview = planning.preview([header, row])
  const first = preview.rows[0]
  if (first && 'error' in first) return failed(first.error)
  const result = await planning.load(session.personId, [header, row], 'agregar')
  if (!result.ok) return failed(ERRORS[result.error])
  revalidatePath('/planning')
  revalidatePath('/cargar-clases')
  return { status: 'ok', message: 'Listo, la clase ya está en el planning.', at: Date.now() }
}

/** Borra una clase cargada. */
export async function removePlanningClass(_prev: SpaceActionState, form: FormData): Promise<SpaceActionState> {
  const session = await requireSession('secretaria')
  const id = formText(form, 'id')
  if (!id) return failed(UNEXPECTED)
  const result = await system().planning.remove(session.personId, id)
  if (!result.ok) return failed(ERRORS[result.error])
  revalidatePath('/planning')
  revalidatePath('/cargar-clases')
  return { status: 'ok', message: 'Listo, la borramos del planning.', at: Date.now() }
}
