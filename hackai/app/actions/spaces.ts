/* Lo que se hace en el espacio de la materia: publicar, responder, marcar una
   consulta resuelta, crear un canal y subir y organizar el material. Quién
   puede hacer qué lo decide Espacios; estas acciones validan lo que llega del
   navegador, llaman al módulo y traducen cada error a un mensaje en voseo.
   Se usan con useActionState: devuelven el estado que muestra el formulario. */
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { spaceHref } from '@/components/spaces/format'
import { requireSession } from '@/lib/auth'
import { system } from '@/lib/composition'
import type { MaterialLayout, NewChannel, Spaces } from '@/lib/core/spaces'
import type { Fail } from '@/lib/result'

/** Lo que muestra el formulario después de mandar: nada, que salió bien o por qué no. */
export type SpaceActionState =
  | { status: 'idle' }
  | { status: 'ok'; message: string | null; at: number }
  | { status: 'error'; message: string; at: number }

type ErrorOf<T extends (...args: never[]) => unknown> = Extract<Awaited<ReturnType<T>>, Fail<string>>['error']

type SpaceError =
  | ErrorOf<Spaces['post']>
  | ErrorOf<Spaces['resolve']>
  | ErrorOf<Spaces['createChannel']>
  | ErrorOf<Spaces['addMaterial']>
  | ErrorOf<Spaces['organizeMaterial']>

const ERRORS: Record<SpaceError, string> = {
  'persona-desconocida': 'No encontramos tus datos en el SIU. Salí y volvé a entrar.',
  'sin-acceso': 'No sos parte de esta materia o de esta comisión.',
  'falla-externa': 'No pudimos guardarlo porque un sistema no responde. Probá de nuevo en un rato.',
  'canal-desconocido': 'Ese canal ya no existe. Recargá la página.',
  'espacio-desconocido': 'Este espacio ya no existe. Recargá la página.',
  'mensaje-desconocido': 'Ese mensaje ya no existe. Recargá la página.',
  'solo-docentes': 'Solo los docentes pueden hacer esto.',
  'sin-mensajes': 'En Material no se escriben mensajes: subí el archivo con «Subir material».',
  'mensaje-vacio': 'Escribí algo o adjuntá un archivo antes de enviar.',
  'no-es-consulta': 'Solo se marcan resueltas las consultas de los alumnos.',
  'demasiado-grande': 'El archivo pasa los 10 MB. Subí uno más liviano o compartí un enlace.',
  'archivo-vacio': 'El archivo está vacío. Elegí otro.',
  'nombre-invalido': 'Usá letras, números y guiones, sin espacios: por ejemplo «parciales-viejos».',
  'nombre-repetido': 'Ya hay un canal con ese nombre. Elegí otro.'
}

const UNEXPECTED = 'Algo salió mal. Recargá la página y probá de nuevo.'
const LAYOUTS: readonly MaterialLayout[] = ['unidad', 'semana', 'todo']

function failed(message: string): SpaceActionState {
  return { status: 'error', message, at: Date.now() }
}

function done(message: string | null = null): SpaceActionState {
  return { status: 'ok', message, at: Date.now() }
}

// Lo que llega a una server action viene del navegador: el tipo no lo garantiza.

function text(form: FormData, key: string): string | null {
  const value = form.get(key)
  return typeof value === 'string' ? value : null
}

/** Un archivo elegido. Un campo de archivo sin elegir llega como un File sin nombre. */
function chosenFile(form: FormData, key: string): File | null {
  const value = form.get(key)
  return value instanceof File && value.name !== '' ? value : null
}

async function bytesOf(file: File): Promise<Uint8Array> {
  return new Uint8Array(await file.arrayBuffer())
}

/** La ruta del espacio, para que la pantalla se vuelva a leer con lo nuevo. */
function refresh(subjectId: string): void {
  revalidatePath(`/materias/${subjectId}`)
}

/** Publica un mensaje en un canal, o una respuesta en un hilo si llega `replyTo`. */
export async function postMessage(_prev: SpaceActionState, form: FormData): Promise<SpaceActionState> {
  const session = await requireSession()
  const subjectId = text(form, 'subjectId')
  const channelId = text(form, 'channelId')
  if (!subjectId || !channelId) return failed(UNEXPECTED)

  const file = chosenFile(form, 'attachment')
  const attachments = file
    ? [{ name: file.name, contentType: file.type || 'application/octet-stream', bytes: await bytesOf(file) }]
    : undefined
  const result = await system().spaces.post(session.personId, channelId, {
    text: text(form, 'text') ?? '',
    replyTo: text(form, 'replyTo') || undefined,
    attachments
  })
  if (!result.ok) {
    return failed(
      result.error === 'solo-docentes'
        ? 'Solo los docentes de la comisión publican en este canal.'
        : ERRORS[result.error]
    )
  }
  refresh(subjectId)
  return done()
}

/** Marca una consulta como resuelta. */
export async function resolveQuestion(_prev: SpaceActionState, form: FormData): Promise<SpaceActionState> {
  const session = await requireSession()
  const subjectId = text(form, 'subjectId')
  const messageId = text(form, 'messageId')
  if (!subjectId || !messageId) return failed(UNEXPECTED)

  const result = await system().spaces.resolve(session.personId, messageId)
  if (!result.ok) {
    return failed(
      result.error === 'solo-docentes'
        ? 'Solo los docentes de la comisión marcan las consultas resueltas.'
        : ERRORS[result.error]
    )
  }
  refresh(subjectId)
  return done()
}

/** `materia` o `comision:<id>`, como lo manda el formulario de canal nuevo. */
function scopeOf(value: string | null): NewChannel['scope'] | null {
  if (value === 'materia') return { kind: 'materia' }
  if (value?.startsWith('comision:') && value.length > 'comision:'.length) {
    return { kind: 'comision', sectionId: value.slice('comision:'.length) }
  }
  return null
}

/** Crea un canal de la materia o de una comisión y lleva a él. */
export async function createChannel(_prev: SpaceActionState, form: FormData): Promise<SpaceActionState> {
  const session = await requireSession()
  const subjectId = text(form, 'subjectId')
  const spaceId = text(form, 'spaceId')
  const name = text(form, 'name')
  const scope = scopeOf(text(form, 'scope'))
  if (!subjectId || !spaceId || name === null) return failed(UNEXPECTED)
  if (!scope) return failed('Elegí quién ve el canal: toda la materia o una comisión.')

  const result = await system().spaces.createChannel(session.personId, spaceId, { name, scope })
  if (!result.ok) {
    return failed(
      result.error === 'solo-docentes'
        ? 'Solo los docentes crean canales, y solo en las comisiones que dictan.'
        : ERRORS[result.error]
    )
  }
  refresh(subjectId)
  redirect(spaceHref(subjectId, { canal: result.value.id }))
}

/** Sube un archivo al material de la materia, en una unidad o tema si se eligió. */
export async function addMaterial(_prev: SpaceActionState, form: FormData): Promise<SpaceActionState> {
  const session = await requireSession()
  const subjectId = text(form, 'subjectId')
  const spaceId = text(form, 'spaceId')
  if (!subjectId || !spaceId) return failed(UNEXPECTED)
  const file = chosenFile(form, 'file')
  if (!file) return failed('Elegí un archivo para subir.')

  const result = await system().spaces.addMaterial(session.personId, spaceId, {
    name: file.name,
    contentType: file.type || 'application/octet-stream',
    bytes: await bytesOf(file),
    section: text(form, 'section')?.trim() || null
  })
  if (!result.ok) {
    return failed(
      result.error === 'solo-docentes' ? 'Solo los docentes de la materia suben material.' : ERRORS[result.error]
    )
  }
  refresh(subjectId)
  return done(`Listo: subiste ${result.value.name}.`)
}

/** Cambia cómo se agrupa el material: por unidad, por semana o sin secciones. */
export async function organizeMaterial(_prev: SpaceActionState, form: FormData): Promise<SpaceActionState> {
  const session = await requireSession()
  const subjectId = text(form, 'subjectId')
  const spaceId = text(form, 'spaceId')
  const layout = LAYOUTS.find((l) => l === text(form, 'layout'))
  if (!subjectId || !spaceId || !layout) return failed(UNEXPECTED)

  const result = await system().spaces.organizeMaterial(session.personId, spaceId, layout)
  if (!result.ok) {
    return failed(
      result.error === 'solo-docentes' ? 'Solo los docentes de la materia organizan el material.' : ERRORS[result.error]
    )
  }
  refresh(subjectId)
  return done()
}
