/* De las respuestas de los Web Services de Moodle al puerto del aula virtual,
   sin red: funciones puras que prueban los tests con JSON de la forma real
   (Moodle 5.1). Los campos que se leen y por qué:
   docs/research/2026-11-13-inventario-cursos-campus.md.

   - Todo texto de Moodle viene en HTML: al puerto va en texto, sin etiquetas.
     HackAI no muestra HTML de terceros.
   - Lo que el alumno no puede ver en el aula (`uservisible: false`) no entra.
   - Las URLs de archivos pasan por `fileUrl`, que las lleva a la ruta de
     HackAI que los pide con el token: el token nunca llega al navegador. */
import type {
  ClassroomAnnouncement,
  ClassroomAssignment,
  ClassroomContent,
  ClassroomFile,
  ClassroomSubmission
} from '@/lib/ports/classroom'

// Las respuestas de Moodle, solo con los campos que se leen.

export type WsFile = {
  type?: string
  filename: string
  filepath?: string
  filesize?: number
  fileurl: string
  mimetype?: string
  timemodified?: number
}

export type WsModule = {
  id: number
  url?: string
  name: string
  modname: string
  description?: string
  uservisible?: boolean
  contents?: WsFile[]
}

export type WsSection = { id: number; name: string; section?: number; uservisible?: boolean; modules: WsModule[] }

export type WsPage = { coursemodule: number; content: string }

export type WsCourse = { id: number; shortname: string; fullname: string; startdate?: number }

export type WsForum = { id: number; course: number; type: string }

export type WsDiscussion = {
  discussion: number
  subject: string
  message: string
  created: number
  userid: number
  userfullname?: string
  attachments?: WsFile[]
}

export type WsAssignment = { id: number; cmid: number; course: number; name: string; duedate: number; intro?: string }

export type WsSubmissionStatus = {
  lastattempt?: { submission?: { status: string }; teamsubmission?: { status: string } }
}

/** Cómo arma cada adaptador sus ids y sus enlaces. */
export type MapContext = {
  baseUrl: string
  /** El prefijo de los ids de la cuenta (`real-<clave>-`). */
  prefix: string
  /** La URL con que HackAI muestra un archivo del Campus. */
  fileUrl: (moodleUrl: string) => string
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  aacute: 'á',
  eacute: 'é',
  iacute: 'í',
  oacute: 'ó',
  uacute: 'ú',
  Aacute: 'Á',
  Eacute: 'É',
  Iacute: 'Í',
  Oacute: 'Ó',
  Uacute: 'Ú',
  ntilde: 'ñ',
  Ntilde: 'Ñ',
  uuml: 'ü',
  iexcl: '¡',
  iquest: '¿',
  laquo: '«',
  raquo: '»',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  ordm: 'º',
  ordf: 'ª',
  deg: '°'
}

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] === '#') {
      const point = code[1] === 'x' || code[1] === 'X' ? Number.parseInt(code.slice(2), 16) : Number(code.slice(1))
      return Number.isFinite(point) && point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : whole
    }
    return ENTITIES[code] ?? whole
  })
}

/** El texto de un HTML de Moodle: los párrafos, títulos y renglones de una lista separados, sin etiquetas, sin
    scripts ni estilos y con los espacios juntados. */
export function htmlToText(html: string): string {
  const marked = html
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n• ')
    .replace(/<\/(p|div|h[1-6]|li|ul|ol|table|tr|blockquote)>/gi, '\n\n')
    .replace(/<[^>]*>/g, '')
  return decodeEntities(marked)
    .split('\n')
    .map((line) => line.replace(/[ \t ]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Una fecha de Moodle (segundos desde 1970) en ISO. */
export const isoOf = (seconds: number) => new Date(seconds * 1000).toISOString()

const TYPES: Record<string, ClassroomContent['type']> = {
  resource: 'file',
  url: 'url',
  folder: 'folder',
  page: 'page',
  label: 'label'
}

/** Módulos que no son elementos del curso: la subsección es un tema, y su contenido llega como un tema más. */
const NOT_CONTENT = new Set(['subsection'])

function filesOf(module: WsModule, ctx: MapContext): ClassroomFile[] {
  return (module.contents ?? [])
    .filter((f) => (f.type ?? 'file') === 'file')
    .map((f) => {
      // En una carpeta, el archivo lleva la subcarpeta adelante («Parciales/2024.pdf»).
      const folder = (f.filepath ?? '/').replace(/^\/+|\/+$/g, '')
      return {
        name: folder ? `${folder}/${f.filename}` : f.filename,
        url: ctx.fileUrl(f.fileurl),
        contentType: f.mimetype ?? 'application/octet-stream',
        size: f.filesize ?? 0
      }
    })
}

/** La última modificación de un módulo: la de su archivo más nuevo, o la del curso si no tiene archivos. */
function modifiedOf(module: WsModule, fallback: number): string {
  const times = (module.contents ?? []).map((f) => f.timemodified ?? 0).filter((t) => t > 0)
  return isoOf(times.length ? Math.max(...times) : fallback)
}

function urlOf(module: WsModule, ctx: MapContext, type: ClassroomContent['type'], files: ClassroomFile[]): string {
  const viewUrl = module.url ?? `${ctx.baseUrl}/mod/${module.modname}/view.php?id=${module.id}`
  if (type === 'label') return ''
  if (type === 'file') return files[0]?.url ?? viewUrl
  if (type === 'url') return module.contents?.find((c) => c.type === 'url')?.fileurl ?? viewUrl
  return viewUrl
}

function textOfModule(module: WsModule, type: ClassroomContent['type'], pages: Map<number, string>): string | null {
  if (type === 'label') return htmlToText(module.description ?? '')
  if (type === 'page') return htmlToText(pages.get(module.id) ?? module.description ?? '')
  return null
}

/** Los elementos del curso, en el orden del aula: core_course_get_contents, con el texto de las páginas de
    mod_page_get_pages_by_courses. `startdate` (segundos) es la fecha de lo que Moodle no fecha. */
export function toContents(
  courseId: string,
  sections: WsSection[],
  pages: WsPage[],
  startdate: number,
  ctx: MapContext
): ClassroomContent[] {
  const pageText = new Map(pages.map((p) => [p.coursemodule, p.content]))
  let position = 0
  return sections
    .filter((s) => s.uservisible !== false)
    .flatMap((section) => {
      const topic = section.name.trim() || (section.section === 0 ? 'General' : `Tema ${section.section ?? ''}`.trim())
      return section.modules
        .filter((m) => m.uservisible !== false && !NOT_CONTENT.has(m.modname))
        .map((module): ClassroomContent => {
          const type = TYPES[module.modname] ?? 'activity'
          const files = type === 'file' || type === 'folder' ? filesOf(module, ctx) : []
          return {
            id: `${ctx.prefix}cm-${module.id}`,
            courseId,
            topic,
            name: module.name,
            type,
            url: urlOf(module, ctx, type, files),
            modifiedAt: modifiedOf(module, startdate),
            position: position++,
            files,
            text: textOfModule(module, type, pageText),
            activity: type === 'activity' ? module.modname : null
          }
        })
    })
}

/** Un aviso del foro de Avisos (mod_forum_get_forum_discussions). */
export function toAnnouncement(courseId: string, d: WsDiscussion, ctx: MapContext): ClassroomAnnouncement {
  return {
    id: `${ctx.prefix}aviso-${d.discussion}`,
    courseId,
    authorId: `${ctx.prefix}u-${d.userid}`,
    ...(d.userfullname ? { authorName: d.userfullname } : {}),
    subject: d.subject,
    message: htmlToText(d.message),
    createdAt: isoOf(d.created),
    attachments: (d.attachments ?? []).map((f) => ({
      name: f.filename,
      url: ctx.fileUrl(f.fileurl),
      contentType: f.mimetype ?? 'application/octet-stream',
      size: f.filesize ?? 0
    }))
  }
}

/** Cómo está la entrega según mod_assign_get_submission_status: `new` y `reopened` todavía no se entregaron. */
export function submissionOf(status: WsSubmissionStatus): ClassroomSubmission {
  const attempt = status.lastattempt
  const value = attempt?.teamsubmission?.status ?? attempt?.submission?.status
  if (value === 'submitted') return 'entregada'
  if (value === 'draft') return 'borrador'
  return 'sin-entregar'
}

/** Una tarea (mod_assign_get_assignments) con su entrega, si se pudo leer. */
export function toAssignment(
  courseId: string,
  a: WsAssignment,
  submission: ClassroomSubmission | null,
  ctx: MapContext
): ClassroomAssignment {
  const description = a.intro ? htmlToText(a.intro) : ''
  return {
    id: `${ctx.prefix}tarea-${a.id}`,
    courseId,
    name: a.name,
    dueDate: a.duedate > 0 ? isoOf(a.duedate) : null,
    description: description || null,
    url: `${ctx.baseUrl}/mod/assign/view.php?id=${a.cmid}`,
    submission
  }
}
