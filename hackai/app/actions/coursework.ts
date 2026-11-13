/* Lo que se hace con las tareas de una materia: crearlas, editarlas y, el
   alumno, entregarlas. Quién puede hacer qué lo decide Seguimiento; estas acciones validan lo que llega
   del navegador, llaman al módulo y traducen cada error a un mensaje en voseo.
   Se usan con useActionState: devuelven el estado que muestra el formulario. */
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { SpaceActionState } from '@/app/actions/spaces'
import { dueAtFromInput, durationLabel, taskHref, tasksHref } from '@/components/coursework/format'
import { requireSession } from '@/lib/auth'
import { system } from '@/lib/composition'
import type { Coursework } from '@/lib/core/coursework'
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

const UNEXPECTED = 'Algo salió mal. Recargá la página y probá de nuevo.'

function failed(message: string): SpaceActionState {
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
