/* Lo que se hace en el espacio de la materia: publicar, responder, marcar una
   consulta resuelta, crear un canal, vincularlo con Discord (o crear los canales
   allá en el servidor conectado), subir y organizar
   el material y abrir un canal directo con un docente. Quién
   puede hacer qué lo decide Espacios; estas acciones validan lo que llega del
   navegador, llaman al módulo y traducen cada error a un mensaje en voseo.
   Se usan con useActionState: devuelven el estado que muestra el formulario. */
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { discordChannelIdFrom } from '@/components/spaces/discord-format'
import { spaceHref } from '@/components/spaces/format'
import { requireSession } from '@/lib/auth'
import { system } from '@/lib/composition'
import type { MaterialLayout, NewChannel, Spaces } from '@/lib/core/spaces'
import type { ErrorOf } from '@/lib/result'

/** Lo que muestra el formulario después de mandar: nada, que salió bien o por qué no. */
export type SpaceActionState =
  | { status: 'idle' }
  | { status: 'ok'; message: string | null; at: number }
  | { status: 'error'; message: string; at: number }

type SpaceError =
  | ErrorOf<ReturnType<Spaces['post']>>
  | ErrorOf<ReturnType<Spaces['resolve']>>
  | ErrorOf<ReturnType<Spaces['createChannel']>>
  | ErrorOf<ReturnType<Spaces['addMaterial']>>
  | ErrorOf<ReturnType<Spaces['organizeMaterial']>>
  | ErrorOf<ReturnType<Spaces['link']>>
  | ErrorOf<ReturnType<Spaces['openDirect']>>
  | ErrorOf<ReturnType<Spaces['createExternalChannels']>>

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
  'nombre-invalido': 'Poné un nombre con al menos una letra o un número.',
  'nombre-repetido': 'Ya hay un canal con ese nombre. Elegí otro.',
  'canal-externo-inexistente':
    'No encontramos ese canal en Discord. Revisá el ID y que el bot de HackAI esté invitado al servidor.',
  'canal-externo-en-uso': 'Ese canal de Discord ya está vinculado con otro canal de HackAI.',
  'sin-servidor': 'Primero conectá la materia con Discord.',
  'no-soportado': 'El canal externo de esta instalación de HackAI no permite crear canales.',
  'servidor-inexistente':
    'El bot de HackAI ya no está en el servidor de Discord. Volvé a tocar «Conectar con Discord».',
  'sin-permisos':
    'Al bot de HackAI le faltan permisos en el servidor (Gestionar canales y Gestionar roles). Volvé a tocar «Conectar con Discord» sin desmarcarlos.',
  'solo-alumno-docente': 'Los mensajes directos son solo entre un alumno y un docente.',
  'sin-comision-en-comun': 'Solo podés escribirle en privado a los docentes de tu comisión.'
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
  if (!(value instanceof File)) return null
  // Al decodificar el formulario, Next.js nombra «undefined» al campo vacío.
  const unnamed = value.name === '' || value.name === 'undefined'
  return unnamed && value.size === 0 ? null : value
}

async function bytesOf(file: File): Promise<Uint8Array> {
  return new Uint8Array(await file.arrayBuffer())
}

/** La ruta del espacio, para que la pantalla se vuelva a leer con lo nuevo. */
function refresh(subjectId: string): void {
  revalidatePath(`/materias/${subjectId}`)
}

/** Publica un mensaje en un canal, o una respuesta en un hilo si llega `replyTo`. Con `resolve`, además marca
    resuelta la consulta que se responde. */
export async function postMessage(_prev: SpaceActionState, form: FormData): Promise<SpaceActionState> {
  const session = await requireSession()
  const subjectId = text(form, 'subjectId')
  const channelId = text(form, 'channelId')
  if (!subjectId || !channelId) return failed(UNEXPECTED)

  const file = chosenFile(form, 'attachment')
  const attachments = file
    ? [{ name: file.name, contentType: file.type || 'application/octet-stream', bytes: await bytesOf(file) }]
    : undefined
  const replyTo = text(form, 'replyTo') || undefined
  const result = await system().spaces.post(session.personId, channelId, {
    text: text(form, 'text') ?? '',
    replyTo,
    attachments
  })
  if (!result.ok) {
    return failed(
      result.error === 'solo-docentes'
        ? 'Solo los docentes de la comisión publican en este canal.'
        : ERRORS[result.error]
    )
  }
  if (replyTo && text(form, 'resolve') === '1') return resolveAfterReply(session.personId, subjectId, replyTo)
  refresh(subjectId)
  return done(replyTo ? 'Respuesta enviada.' : 'Mensaje enviado.')
}

/** «Responder y marcar resuelta»: la respuesta ya salió. Si marcarla falla se dice, pero como algo que salió: un
    error devolvería el texto al campo y se podría mandar dos veces. */
async function resolveAfterReply(personId: string, subjectId: string, messageId: string): Promise<SpaceActionState> {
  const resolved = await system().spaces.resolve(personId, messageId)
  refresh(subjectId)
  if (!resolved.ok) {
    return done('Tu respuesta se envió, pero no pudimos marcar la consulta resuelta: tocá «Marcar resuelta».')
  }
  return done('Respondiste y la consulta quedó resuelta.')
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

/** Vincula un canal del espacio con un canal de Discord y trae lo que ya tenía. */
export async function linkChannel(_prev: SpaceActionState, form: FormData): Promise<SpaceActionState> {
  const session = await requireSession()
  const subjectId = text(form, 'subjectId')
  const channelId = text(form, 'channelId')
  if (!subjectId || !channelId) return failed(UNEXPECTED)
  const externalId = discordChannelIdFrom(text(form, 'discordChannelId') ?? '')
  if (!externalId) {
    return failed(
      'Pegá el enlace del canal (clic derecho sobre el canal → «Copiar enlace») o su ID, un número de 18 o 19 dígitos.'
    )
  }

  const result = await system().spaces.link(session.personId, channelId, { system: 'discord', channelId: externalId })
  if (!result.ok) {
    return failed(
      result.error === 'solo-docentes'
        ? 'Solo los docentes de la materia o de la comisión vinculan este canal.'
        : ERRORS[result.error]
    )
  }
  refresh(subjectId)
  return done('Listo: este canal queda sincronizado con Discord.')
}

/** Crea en el servidor de Discord conectado los canales del espacio que gestiona la persona, ya vinculados. */
export async function createDiscordChannels(_prev: SpaceActionState, form: FormData): Promise<SpaceActionState> {
  const session = await requireSession()
  const subjectId = text(form, 'subjectId')
  const spaceId = text(form, 'spaceId')
  if (!subjectId || !spaceId) return failed(UNEXPECTED)

  const result = await system().spaces.createExternalChannels(session.personId, spaceId)
  refresh(subjectId)
  if (!result.ok) {
    // Lo que se creó antes de la falla ya quedó vinculado: volver a tocar crea lo que falta.
    if (result.error === 'falla-externa')
      return failed('Discord no respondió y puede que falten canales. Tocá de nuevo para crear los que faltan.')
    return failed(
      result.error === 'solo-docentes'
        ? 'Solo los docentes de la materia crean los canales en Discord.'
        : ERRORS[result.error]
    )
  }
  const { created, alreadyLinked } = result.value
  if (created.length === 0)
    return done(
      'Tus canales ya estaban vinculados con Discord. Los docentes con su cuenta vinculada pueden escribir en avisos y material.'
    )
  const names = created.map((c) => `#${c.name}${c.sectionName ? ` (${c.sectionName})` : ''}`).join(', ')
  const before = alreadyLinked ? ` Otros ${alreadyLinked} ya estaban vinculados.` : ''
  return done(`Listo: se crearon en Discord y quedaron sincronizados ${names}.${before}`)
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

/** Abre el canal directo con un docente (o, para el docente, con un alumno) y lleva a él. */
export async function openDirect(_prev: SpaceActionState, form: FormData): Promise<SpaceActionState> {
  const session = await requireSession()
  const subjectId = text(form, 'subjectId')
  const spaceId = text(form, 'spaceId')
  const otherPersonId = text(form, 'otherPersonId')
  if (!subjectId || !spaceId || !otherPersonId) return failed(UNEXPECTED)

  const result = await system().spaces.openDirect(session.personId, spaceId, otherPersonId)
  if (!result.ok) return failed(ERRORS[result.error])
  refresh(subjectId)
  redirect(spaceHref(subjectId, { canal: result.value.id }))
}
