/* Lo que se hace con las tareas de una materia: crearlas, editarlas y, el
   alumno, entregarlas; y, el docente, calificar y publicar las notas. Quién puede hacer qué lo decide Seguimiento; estas acciones validan lo que llega
   del navegador, llaman al módulo y traducen cada error a un mensaje en voseo.
   Se usan con useActionState: devuelven el estado que muestra el formulario. */
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { SpaceActionState } from '@/app/actions/spaces'
import {
  COURSE_COLUMN,
  dueAtFromInput,
  durationLabel,
  evaluationHref,
  gradeFromInput,
  gradesHref,
  notesLabel,
  pastedText,
  sheetChange,
  taskHref,
  tasksHref
} from '@/components/coursework/format'
import { requireSession } from '@/lib/auth'
import { system } from '@/lib/composition'
import type { Coursework, GradeScale, PastePreview } from '@/lib/core/coursework'
import type { ErrorOf } from '@/lib/result'

type TaskError = ErrorOf<ReturnType<Coursework['createTask']>> | ErrorOf<ReturnType<Coursework['updateTask']>>

const ERRORS: Record<TaskError, string> = {
  'persona-desconocida': 'No encontramos tus datos en el SIU. Salí y volvé a entrar.',
  'sin-acceso': 'No dictás esa materia o alguna de esas comisiones.',
  'solo-docentes': 'Solo los docentes de la comisión crean y editan tareas.',
  'tarea-desconocida': 'Esa tarea ya no existe. Volvé a la lista de tareas.',
  'sin-comisiones': 'Elegí al menos una comisión.',
  'nombre-invalido': 'Ponele un nombre a la tarea, de hasta 120 caracteres.',
  'consigna-invalida': 'La consigna es demasiado larga: usá hasta 5.000 caracteres o subí un archivo.',
  'fecha-invalida': 'Elegí la fecha y la hora límite.',
  'demasiado-grande': 'El archivo pasa los 10 MB. Subí uno más liviano.',
  'archivo-vacio': 'El archivo está vacío. Elegí otro.',
  'falla-externa': 'No pudimos guardarlo porque un sistema no responde. Probá de nuevo en un rato.'
}

type SubmitError = ErrorOf<ReturnType<Coursework['submit']>>

const SUBMIT_ERRORS: Record<SubmitError, string> = {
  'persona-desconocida': ERRORS['persona-desconocida'],
  'sin-acceso': 'No sos parte de esta materia.',
  'tarea-desconocida': 'Esa tarea no existe o no es de tu comisión.',
  'solo-alumnos': 'Solo los alumnos de la comisión entregan tareas.',
  'sin-archivos': 'Elegí al menos un archivo para entregar.',
  'demasiados-archivos': 'Podés entregar hasta 10 archivos. Juntalos en un .zip.',
  'archivo-vacio': 'Alguno de los archivos está vacío. Elegí otro.',
  'demasiado-grande': 'Los archivos pasan los 10 MB en total. Subí unos más livianos.',
  'ya-calificada': 'Tu docente ya calificó esta entrega, así que no se puede reemplazar.',
  'falla-externa': 'No pudimos guardar tu entrega porque un sistema no responde. Probá de nuevo en un rato.'
}

type GradeActionError = ErrorOf<ReturnType<Coursework['grade']>> | ErrorOf<ReturnType<Coursework['publish']>>

const GRADE_ERRORS: Record<GradeActionError, string> = {
  'persona-desconocida': ERRORS['persona-desconocida'],
  'sin-acceso': 'No dictás esa comisión.',
  'solo-docentes': 'Solo los docentes de la comisión califican.',
  'columna-desconocida': 'Esa columna ya no existe en esta comisión. Volvé a Calificaciones.',
  'alumno-desconocido': 'Ese alumno no está en la comisión o todavía no entró a HackAI.',
  'nota-invalida': 'La nota va de 1 a 10, con coma o punto para los decimales. Si faltó, marcá «Ausente».',
  'comentario-invalido': 'El comentario es demasiado largo: usá hasta 2.000 caracteres.',
  'sin-notas': 'Todavía no cargaste ninguna nota en esta columna.',
  'falla-externa': ERRORS['falla-externa']
}

type PasteActionError = ErrorOf<ReturnType<Coursework['previewPaste']>> | ErrorOf<ReturnType<Coursework['applyPaste']>>

const PASTE_ERRORS: Record<PasteActionError, string> = {
  ...GRADE_ERRORS,
  'sin-notas': 'No hay ninguna nota para guardar: ningún alumno de la lista quedó con una nota o un ausente.',
  'texto-vacio': 'Pegá primero las notas copiadas de la planilla.',
  'texto-demasiado-largo': 'Pegaste demasiado texto. Copiá solo las columnas del legajo (o el mail) y la nota.'
}

/** Lo que muestra la pantalla de pegar notas: nada, un error, o la vista previa de lo que se pegó. */
export type PasteState =
  | { status: 'idle' }
  | { status: 'error'; message: string; at: number }
  | { status: 'preview'; preview: PastePreview; text: string; scale: GradeScale; at: number }

const SCALES: GradeScale[] = ['1-10', '0-100']

const UNEXPECTED = 'Algo salió mal. Recargá la página y probá de nuevo.'

function failed(message: string): { status: 'error'; message: string; at: number } {
  return { status: 'error', message, at: Date.now() }
}

// Lo que llega a una server action viene del navegador: el tipo no lo garantiza.

function text(form: FormData, key: string): string | null {
  const value = form.get(key)
  return typeof value === 'string' ? value : null
}

/** Un archivo elegido. Un campo de archivo sin elegir llega como un File sin nombre. */
function chosenFile(form: FormData, key: string): File | null {
  const value = form.get(key)
  if (!(value instanceof File)) return null
  // Al decodificar el formulario, Next.js nombra «undefined» al campo vacío.
  const unnamed = value.name === '' || value.name === 'undefined'
  return unnamed && value.size === 0 ? null : value
}

/** Los archivos elegidos en un campo `multiple`, sin los campos vacíos. */
function chosenFiles(form: FormData, key: string): File[] {
  return form.getAll(key).filter((value): value is File => {
    // Al decodificar el formulario, Next.js nombra «undefined» al campo vacío.
    return value instanceof File && !((value.name === '' || value.name === 'undefined') && value.size === 0)
  })
}

/** Crea una tarea para las comisiones marcadas. Si sale bien, lleva a la lista de tareas de la primera. */
export async function createTask(_prev: SpaceActionState, form: FormData): Promise<SpaceActionState> {
  const session = await requireSession()
  const subjectId = text(form, 'subjectId')
  if (!subjectId) return failed(UNEXPECTED)
  const dueAt = dueAtFromInput(text(form, 'dueAt') ?? '')
  if (!dueAt) return failed(ERRORS['fecha-invalida'])
  const sectionIds = form.getAll('sectionIds').filter((id): id is string => typeof id === 'string' && id !== '')
  const file = chosenFile(form, 'file')

  const result = await system().coursework.createTask(session.personId, {
    subjectId,
    sectionIds,
    name: text(form, 'name') ?? '',
    instructions: text(form, 'instructions') ?? '',
    dueAt,
    graded: text(form, 'graded') === 'si',
    file: file
      ? {
          name: file.name,
          contentType: file.type || 'application/octet-stream',
          bytes: new Uint8Array(await file.arrayBuffer())
        }
      : undefined
  })
  if (!result.ok) return failed(ERRORS[result.error])
  revalidatePath(tasksHref(subjectId))
  redirect(tasksHref(subjectId, sectionIds[0]))
}

/** Cambia el nombre, la consigna y la fecha límite de una tarea. */
export async function updateTask(_prev: SpaceActionState, form: FormData): Promise<SpaceActionState> {
  const session = await requireSession()
  const taskId = text(form, 'taskId')
  if (!taskId) return failed(UNEXPECTED)
  const dueAt = dueAtFromInput(text(form, 'dueAt') ?? '')
  if (!dueAt) return failed(ERRORS['fecha-invalida'])

  const result = await system().coursework.updateTask(session.personId, taskId, {
    name: text(form, 'name') ?? '',
    instructions: text(form, 'instructions') ?? '',
    dueAt
  })
  if (!result.ok) return failed(ERRORS[result.error])
  revalidatePath(tasksHref(result.value.subjectId))
  revalidatePath(taskHref(result.value.subjectId, taskId))
  return { status: 'ok', message: 'Guardamos los cambios.', at: Date.now() }
}

/** Pone la nota (o el ausente) y el comentario de un alumno en una columna y pasa al siguiente de la lista; del
    último vuelve a la lista avisando que terminó. */
export async function gradeStudent(_prev: SpaceActionState, form: FormData): Promise<SpaceActionState> {
  const session = await requireSession()
  const subjectId = text(form, 'subjectId')
  const sectionId = text(form, 'sectionId')
  const columnId = text(form, 'columnId')
  const studentId = text(form, 'studentId')
  if (!subjectId || !sectionId || !columnId || !studentId) return failed(UNEXPECTED)

  const result = await system().coursework.grade(session.personId, {
    sectionId,
    columnId,
    studentId,
    value: gradeFromInput(text(form, 'value') ?? ''),
    absent: text(form, 'absent') === 'si',
    comment: text(form, 'comment') ?? ''
  })
  if (!result.ok) return failed(GRADE_ERRORS[result.error])
  revalidatePath(gradesHref(subjectId))
  const next = text(form, 'next')
  redirect(
    gradesHref(
      subjectId,
      next
        ? { comision: sectionId, columna: columnId, alumno: next }
        : { comision: sectionId, columna: columnId, listo: true }
    )
  )
}

/** Publica las notas cargadas de una columna: desde ahí las ven los alumnos y les llega el aviso. */
export async function publishColumn(_prev: SpaceActionState, form: FormData): Promise<SpaceActionState> {
  const session = await requireSession()
  const subjectId = text(form, 'subjectId')
  const sectionId = text(form, 'sectionId')
  const columnId = text(form, 'columnId')
  if (!subjectId || !sectionId || !columnId) return failed(UNEXPECTED)

  const result = await system().coursework.publish(session.personId, sectionId, columnId)
  if (!result.ok) return failed(GRADE_ERRORS[result.error])
  revalidatePath(gradesHref(subjectId))
  const { published } = result.value
  return {
    status: 'ok',
    message:
      published === 0
        ? 'No había notas nuevas para publicar: los alumnos ya ven todas.'
        : published === 1
          ? 'Publicamos 1 nota. El alumno ya la ve y le llegó el aviso.'
          : `Publicamos ${published} notas. Los alumnos ya las ven y les llegó el aviso.`,
    at: Date.now()
  }
}

type PassActionError = ErrorOf<ReturnType<Coursework['retryPassOf']>>

const PASS_ERRORS: Record<PassActionError, string> = {
  'persona-desconocida': ERRORS['persona-desconocida'],
  'sin-acceso': 'No dictás esa comisión.',
  'solo-docentes': 'Solo los docentes de la comisión pasan las notas al SIU.',
  'falla-externa': 'El SIU no responde. Las notas siguen pendientes y las reintentamos solas.'
}

/** Reintenta el pase al SIU de las notas pendientes de la comisión. */
export async function retryGradePass(_prev: SpaceActionState, form: FormData): Promise<SpaceActionState> {
  const session = await requireSession()
  const subjectId = text(form, 'subjectId')
  const sectionId = text(form, 'sectionId')
  if (!subjectId || !sectionId) return failed(UNEXPECTED)

  const result = await system().coursework.retryPassOf(session.personId, sectionId)
  if (!result.ok) return failed(PASS_ERRORS[result.error])
  revalidatePath(gradesHref(subjectId))
  const { passed, pending } = result.value
  if (pending > 0) return failed('El SIU todavía no responde. Las notas siguen pendientes y las reintentamos solas.')
  return {
    status: 'ok',
    message:
      passed === 0
        ? 'No había notas pendientes de pasar.'
        : `Pasamos ${passed === 1 ? '1 nota' : `${passed} notas`} al SIU.`,
    at: Date.now()
  }
}

type CourseActionError =
  | ErrorOf<ReturnType<Coursework['setWeights']>>
  | ErrorOf<ReturnType<Coursework['overrideCourseGrade']>>
  | ErrorOf<ReturnType<Coursework['publishCourseGrade']>>

const COURSE_ERRORS: Record<CourseActionError, string> = {
  'persona-desconocida': ERRORS['persona-desconocida'],
  'sin-acceso': 'No dictás esa comisión.',
  'solo-docentes': 'Solo los docentes de la comisión ponen pesos y notas de cursada.',
  'columna-desconocida': 'Esa columna ya no existe en esta comisión. Volvé a Calificaciones.',
  'alumno-desconocido': 'Ese alumno no está en la comisión o todavía no entró a HackAI.',
  'peso-invalido':
    'Cada peso va de 0 a 100, con coma o punto para los decimales. Dejalo vacío si la columna no cuenta.',
  'nota-invalida': 'La nota de cursada va de 1 a 10, con coma o punto para los decimales.',
  'sin-nota-calculada': 'Todavía no hay nada para calcular: cargá notas en columnas con peso o escribí la nota a mano.',
  'sin-notas': 'Todavía no hay ninguna nota de cursada: poné pesos a las columnas con notas o escribí una a mano.',
  'falla-externa': ERRORS['falla-externa']
}

/** Guarda el peso de cada columna de la comisión. Un campo vacío quita el peso de esa columna. */
export async function saveWeights(_prev: SpaceActionState, form: FormData): Promise<SpaceActionState> {
  const session = await requireSession()
  const subjectId = text(form, 'subjectId')
  const sectionId = text(form, 'sectionId')
  const ids = form.getAll('columnId')
  const raw = form.getAll('weight')
  if (!subjectId || !sectionId || ids.length !== raw.length) return failed(UNEXPECTED)
  const weights = ids.map((id, i) => ({
    columnId: typeof id === 'string' ? id : '',
    weight: gradeFromInput(typeof raw[i] === 'string' ? raw[i] : '')
  }))

  const result = await system().coursework.setWeights(session.personId, sectionId, weights)
  if (!result.ok) return failed(COURSE_ERRORS[result.error])
  revalidatePath(gradesHref(subjectId))
  revalidatePath(evaluationHref(subjectId))
  return { status: 'ok', message: 'Guardamos los pesos. La nota de cursada ya se recalculó.', at: Date.now() }
}

/** Pisa la nota de cursada de un alumno, o con `reset` vuelve al cálculo, y pasa al siguiente de la lista. */
export async function saveCourseGrade(_prev: SpaceActionState, form: FormData): Promise<SpaceActionState> {
  const session = await requireSession()
  const subjectId = text(form, 'subjectId')
  const sectionId = text(form, 'sectionId')
  const studentId = text(form, 'studentId')
  if (!subjectId || !sectionId || !studentId) return failed(UNEXPECTED)
  const reset = text(form, 'reset') === 'si'

  const result = await system().coursework.overrideCourseGrade(
    session.personId,
    sectionId,
    studentId,
    reset ? null : gradeFromInput(text(form, 'value') ?? '')
  )
  if (!result.ok) return failed(COURSE_ERRORS[result.error])
  revalidatePath(gradesHref(subjectId))
  const next = text(form, 'next')
  redirect(
    gradesHref(
      subjectId,
      next && !reset
        ? { comision: sectionId, columna: COURSE_COLUMN, alumno: next }
        : { comision: sectionId, columna: COURSE_COLUMN, alumno: reset ? studentId : undefined, listo: !reset }
    )
  )
}

/** Publica la nota de cursada: la ven los alumnos, les llega el aviso y pasa al SIU. */
export async function publishCourse(_prev: SpaceActionState, form: FormData): Promise<SpaceActionState> {
  const session = await requireSession()
  const subjectId = text(form, 'subjectId')
  const sectionId = text(form, 'sectionId')
  if (!subjectId || !sectionId) return failed(UNEXPECTED)

  const result = await system().coursework.publishCourseGrade(session.personId, sectionId)
  if (!result.ok) return failed(COURSE_ERRORS[result.error])
  revalidatePath(gradesHref(subjectId))
  const { published } = result.value
  return {
    status: 'ok',
    message:
      published === 0
        ? 'No había notas de cursada nuevas para publicar: los alumnos ya ven todas.'
        : `Publicamos ${published === 1 ? 'la nota de cursada de 1 alumno' : `las notas de cursada de ${published} alumnos`}. Ya las ven y les llegó el aviso.`,
    at: Date.now()
  }
}

/** El alumno entrega uno o más archivos, o reemplaza su entrega anterior. */
export async function submitTask(_prev: SpaceActionState, form: FormData): Promise<SpaceActionState> {
  const session = await requireSession()
  const taskId = text(form, 'taskId')
  if (!taskId) return failed(UNEXPECTED)
  const files = await Promise.all(
    chosenFiles(form, 'files').map(async (file) => ({
      name: file.name,
      contentType: file.type || 'application/octet-stream',
      bytes: new Uint8Array(await file.arrayBuffer())
    }))
  )

  const result = await system().coursework.submit(session.personId, taskId, files)
  if (!result.ok) return failed(SUBMIT_ERRORS[result.error])
  const task = await system().coursework.task(session.personId, taskId)
  if (task.ok) {
    revalidatePath(tasksHref(task.value.subjectId))
    revalidatePath(taskHref(task.value.subjectId, taskId))
  }
  const late = result.value.late
  return {
    status: 'ok',
    message: late
      ? `Listo, quedó entregada, pero atrasada (${durationLabel(late.minutes)}).`
      : 'Listo, entregaste a tiempo.',
    at: Date.now()
  }
}

/** Lee las notas pegadas desde una planilla y devuelve la vista previa. No guarda nada. */
export async function previewPastedGrades(_prev: PasteState, form: FormData): Promise<PasteState> {
  const session = await requireSession()
  const sectionId = text(form, 'sectionId')
  const columnId = text(form, 'columnId')
  const pasted = text(form, 'text')
  const scale = SCALES.find((s) => s === text(form, 'scale'))
  if (!sectionId || !columnId || pasted === null || !scale) return failed(UNEXPECTED)

  const result = await system().coursework.previewPaste(session.personId, sectionId, columnId, pasted, scale)
  if (!result.ok) return failed(PASTE_ERRORS[result.error])
  return { status: 'preview', preview: result.value, text: pastedText(pasted), scale, at: Date.now() }
}

/** Guarda las notas pegadas, ya vistas en la vista previa, y vuelve a Calificaciones. */
export async function savePastedGrades(_prev: SpaceActionState, form: FormData): Promise<SpaceActionState> {
  const session = await requireSession()
  const subjectId = text(form, 'subjectId')
  const sectionId = text(form, 'sectionId')
  const columnId = text(form, 'columnId')
  const pasted = text(form, 'text')
  const scale = SCALES.find((s) => s === text(form, 'scale'))
  if (!subjectId || !sectionId || !columnId || pasted === null || !scale) return failed(UNEXPECTED)

  const result = await system().coursework.applyPaste(session.personId, sectionId, columnId, pasted, scale)
  if (!result.ok) return failed(PASTE_ERRORS[result.error])
  revalidatePath(gradesHref(subjectId))
  redirect(gradesHref(subjectId, { comision: sectionId, columna: columnId, pegadas: result.value.saved }))
}

type RemoveActionError = ErrorOf<ReturnType<Coursework['removeGrade']>>

const REMOVE_ERRORS: Record<RemoveActionError, string> = {
  'persona-desconocida': GRADE_ERRORS['persona-desconocida'],
  'sin-acceso': GRADE_ERRORS['sin-acceso'],
  'solo-docentes': 'Solo los docentes de la comisión quitan notas.',
  'columna-desconocida': GRADE_ERRORS['columna-desconocida'],
  'alumno-desconocido': GRADE_ERRORS['alumno-desconocido'],
  'nota-publicada': 'Esa nota ya la ven los alumnos, así que no se puede quitar. Escribí la nota corregida.',
  'falla-externa': GRADE_ERRORS['falla-externa']
}

/** Lo que se guardó, en una frase: «Guardamos 2 notas.», «Quitamos 1 nota.», «Guardamos 2 notas y quitamos 1.». */
function sheetSaved(saved: number, removed: number): string {
  if (removed === 0) return `Guardamos ${notesLabel(saved)}.`
  if (saved === 0) return `Quitamos ${notesLabel(removed)}.`
  return `Guardamos ${notesLabel(saved)} y quitamos ${removed}.`
}

/** Lo que pide guardar la planilla, ya revisado, o el mensaje de por qué no se guarda nada. */
function sheetPlan(rows: SheetRow[]): { write: SheetRow[]; remove: SheetRow[] } | { error: string } {
  const change = (r: SheetRow) => sheetChange({ before: r.before, value: r.value })
  const wrong = rows.find((r) => change(r) === 'invalida')
  if (wrong) {
    return {
      error: `No guardamos ninguna nota: la de ${wrong.name} tiene que ir de 1 a 10, con coma o punto, o ser «A» si faltó.`
    }
  }
  const remove = rows.filter((r) => change(r) === 'quitar')
  const seen = remove.find((r) => r.published)
  if (seen) {
    return {
      error: `No guardamos ninguna nota: la de ${seen.name} ya la ven los alumnos, así que no se puede quitar. Escribí la nota corregida.`
    }
  }
  return { write: rows.filter((r) => change(r) === 'nota'), remove }
}

/** Guarda de una vez lo que el docente cambió en la planilla de una columna: un número de 1 a 10 o «A» de ausente, y
    conserva el comentario de cada alumno. Un campo que se vació quita la nota, si los alumnos todavía no la ven. Si
    algo no sirve, no guarda nada. */
export async function saveGradeSheet(_prev: SpaceActionState, form: FormData): Promise<SpaceActionState> {
  const session = await requireSession()
  const subjectId = text(form, 'subjectId')
  const sectionId = text(form, 'sectionId')
  const columnId = text(form, 'columnId')
  const rows = sheetRows(form)
  if (!subjectId || !sectionId || !columnId || !rows) return failed(UNEXPECTED)
  const plan = sheetPlan(rows)
  if ('error' in plan) return failed(plan.error)
  if (plan.write.length + plan.remove.length === 0) {
    return { status: 'ok', message: 'No había cambios para guardar.', at: Date.now() }
  }

  for (const row of plan.write) {
    const absent = row.value.trim().toUpperCase() === 'A'
    const result = await system().coursework.grade(session.personId, {
      sectionId,
      columnId,
      studentId: row.studentId,
      value: absent ? null : gradeFromInput(row.value),
      absent,
      comment: row.comment
    })
    if (!result.ok) return failed(`${row.name}: ${GRADE_ERRORS[result.error]}`)
  }
  for (const row of plan.remove) {
    const result = await system().coursework.removeGrade(session.personId, {
      sectionId,
      columnId,
      studentId: row.studentId
    })
    if (!result.ok) return failed(`${row.name}: ${REMOVE_ERRORS[result.error]}`)
  }
  revalidatePath(gradesHref(subjectId))
  return { status: 'ok', message: sheetSaved(plan.write.length, plan.remove.length), at: Date.now() }
}

type SheetRow = {
  studentId: string
  name: string
  value: string
  before: string
  comment: string
  /** Si los alumnos ya ven la nota que tenía. */
  published: boolean
}

/** Las filas de la planilla, en orden. `null` si llegaron desparejas. */
function sheetRows(form: FormData): SheetRow[] | null {
  const field = (key: string) => form.getAll(key).map((v) => (typeof v === 'string' ? v : ''))
  const [ids, names, values, before, comments, published] = [
    'alumno',
    'nombre',
    'nota',
    'antes',
    'comentario',
    'publicada'
  ].map(field)
  if ([names, values, before, comments, published].some((list) => list.length !== ids.length)) return null
  return ids.map((studentId, i) => ({
    studentId,
    name: names[i],
    value: values[i],
    before: before[i],
    comment: comments[i],
    published: published[i] === 'si'
  }))
}

type ExamActionError = ErrorOf<ReturnType<Coursework['saveExam']>> | ErrorOf<ReturnType<Coursework['setPromotion']>>

const EXAM_ERRORS: Record<ExamActionError, string> = {
  'persona-desconocida': ERRORS['persona-desconocida'],
  'sin-acceso': 'No dictás esa comisión.',
  'solo-docentes': 'Solo los docentes de la comisión configuran la evaluación.',
  'columna-desconocida': 'Esa instancia ya no existe en esta comisión. Recargá la página.',
  'nombre-invalido': 'Ponele un nombre a la instancia, de hasta 120 caracteres.',
  'fecha-invalida': 'Elegí la fecha y la hora del examen.',
  'tipo-invalido': 'Elegí si es parcial, recuperatorio o integrador.',
  'examen-con-notas': 'Esa instancia ya tiene notas cargadas: no se puede borrar.',
  'nota-invalida': 'La nota mínima para promocionar va de 4 a 10.',
  'falla-externa': ERRORS['falla-externa']
}

const EXAM_KINDS = new Set(['parcial', 'recuperatorio', 'integrador'])

/** Suma una instancia de examen o corrige el nombre, el tipo y la fecha de una que ya existe. */
export async function saveExam(_prev: SpaceActionState, form: FormData): Promise<SpaceActionState> {
  const session = await requireSession()
  const subjectId = text(form, 'subjectId')
  const sectionId = text(form, 'sectionId')
  const kind = text(form, 'kind') ?? ''
  if (!subjectId || !sectionId) return failed(UNEXPECTED)
  if (!EXAM_KINDS.has(kind)) return failed(EXAM_ERRORS['tipo-invalido'])
  const date = dueAtFromInput(text(form, 'date') ?? '')
  if (!date) return failed(EXAM_ERRORS['fecha-invalida'])
  const columnId = text(form, 'columnId') || undefined

  const result = await system().coursework.saveExam(session.personId, {
    sectionId,
    columnId,
    kind: kind as 'parcial' | 'recuperatorio' | 'integrador',
    name: text(form, 'name') ?? '',
    date
  })
  if (!result.ok) return failed(EXAM_ERRORS[result.error])
  revalidatePath(evaluationHref(subjectId))
  revalidatePath(gradesHref(subjectId))
  return { status: 'ok', message: columnId ? 'Guardamos los cambios.' : 'Sumamos la instancia.', at: Date.now() }
}

/** Borra una instancia de examen propia que todavía no tiene notas. */
export async function deleteExam(_prev: SpaceActionState, form: FormData): Promise<SpaceActionState> {
  const session = await requireSession()
  const subjectId = text(form, 'subjectId')
  const sectionId = text(form, 'sectionId')
  const columnId = text(form, 'columnId')
  if (!subjectId || !sectionId || !columnId) return failed(UNEXPECTED)
  const result = await system().coursework.deleteExam(session.personId, sectionId, columnId)
  if (!result.ok) return failed(EXAM_ERRORS[result.error])
  revalidatePath(evaluationHref(subjectId))
  revalidatePath(gradesHref(subjectId))
  return { status: 'ok', message: 'Borramos la instancia.', at: Date.now() }
}

/** Marca si la materia se promociona en la comisión y con qué nota mínima. */
export async function savePromotion(_prev: SpaceActionState, form: FormData): Promise<SpaceActionState> {
  const session = await requireSession()
  const subjectId = text(form, 'subjectId')
  const sectionId = text(form, 'sectionId')
  if (!subjectId || !sectionId) return failed(UNEXPECTED)
  const promotable = text(form, 'promotable') === 'si'
  const minimum = gradeFromInput(text(form, 'minimum') ?? '') ?? 7
  const result = await system().coursework.setPromotion(session.personId, sectionId, { promotable, minimum })
  if (!result.ok) return failed(EXAM_ERRORS[result.error])
  revalidatePath(evaluationHref(subjectId))
  revalidatePath(gradesHref(subjectId))
  return {
    status: 'ok',
    message: promotable ? 'Listo: la materia se promociona en esta comisión.' : 'Listo: la materia va a final.',
    at: Date.now()
  }
}
