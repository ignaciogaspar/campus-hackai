/* Lo que se hace con las tareas de una materia: crearlas, editarlas y, el
   alumno, entregarlas; y, el docente, calificar y publicar las notas. Quién puede hacer qué lo decide Seguimiento; estas acciones validan lo que llega
   del navegador, llaman al módulo y traducen cada error a un mensaje en voseo.
   Se usan con useActionState: devuelven el estado que muestra el formulario. */
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { SpaceActionState } from '@/app/actions/spaces'
import {
  dueAtFromInput,
  durationLabel,
  gradeFromInput,
  gradesHref,
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
        : `Publicamos ${published === 1 ? '1 nota' : `${published} notas`}. Los alumnos ya las ven y les llegó el aviso.`,
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
  return { status: 'preview', preview: result.value, text: pasted, scale, at: Date.now() }
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
