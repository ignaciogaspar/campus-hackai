// Tipos y validación de Mi organización. Puro (sin I/O): sirve en server, client y tests.

export type OrgKind = 'empresa' | 'empresa-familiar' | 'donde-trabajo' | 'proyecto'
export const ORG_KINDS: OrgKind[] = ['empresa', 'empresa-familiar', 'donde-trabajo', 'proyecto']
export const ORG_KIND_LABEL: Record<OrgKind, string> = {
  empresa: 'Mi empresa',
  'empresa-familiar': 'Empresa familiar',
  'donde-trabajo': 'Donde trabajo',
  proyecto: 'Proyecto en marcha',
}

export type OrgSize = '1-10' | '11-50' | '51-200' | '201-1000' | '1000+'
export const ORG_SIZES: OrgSize[] = ['1-10', '11-50', '51-200', '201-1000', '1000+']
export const ORG_SIZE_LABEL: Record<OrgSize, string> = {
  '1-10': '1 a 10 personas',
  '11-50': '11 a 50',
  '51-200': '51 a 200',
  '201-1000': '201 a 1.000',
  '1000+': 'Más de 1.000',
}

export interface OrgProcess {
  id: string
  name: string
  /** Qué duele: tiempo, errores, plata perdida. */
  pain: string
  /** Cuántas veces pasa (por día, semana, mes). */
  volume: string
  /** Quién lo hace hoy. */
  owner: string
}

export interface OrgDataAsset {
  id: string
  name: string
  /** Dónde está (ERP, Excel, mails, papel…). */
  where: string
  notes: string
}

export interface OrgSystem {
  id: string
  name: string
  use: string
}

export interface OrgLinks {
  repo?: string
  app?: string
  web?: string
}

export interface Organization {
  id: string
  course_id: string
  person_id: string
  name: string
  kind: OrgKind
  industry: string | null
  size: OrgSize | null
  my_role: string | null
  description: string
  processes: OrgProcess[]
  data_assets: OrgDataAsset[]
  systems: OrgSystem[]
  links: OrgLinks
  created_at: string
  updated_at: string
}

/** Lo que el alumno edita (sin ids de fila ni fechas). */
export interface OrganizationInput {
  name: string
  kind: OrgKind
  industry: string
  size: OrgSize | ''
  myRole: string
  description: string
  processes: Array<Omit<OrgProcess, 'id'> & { id?: string }>
  dataAssets: Array<Omit<OrgDataAsset, 'id'> & { id?: string }>
  systems: Array<Omit<OrgSystem, 'id'> & { id?: string }>
  links: OrgLinks
}

export const MIN_PROCESSES = 3
export const MAX_PROCESSES = 5
export const MAX_ROWS = 12

export class OrganizationError extends Error {}

const txt = (v: unknown, max: number): string => (typeof v === 'string' ? v.replace(/\r\n/g, '\n').trim().slice(0, max) : '')

function rowId(prefix: string, i: number, raw: unknown): string {
  const v = typeof raw === 'string' ? raw.trim() : ''
  return /^[a-z0-9-]{1,40}$/i.test(v) ? v : `${prefix}-${i + 1}`
}

function cleanUrl(raw: unknown, label: string): string | undefined {
  const v = txt(raw, 500)
  if (!v) return undefined
  const withProto = /^https?:\/\//i.test(v) ? v : `https://${v}`
  try {
    const u = new URL(withProto)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error('protocolo')
    return u.toString()
  } catch {
    throw new OrganizationError(`El link de ${label} no es una URL válida.`)
  }
}

/**
 * Normaliza y valida lo que manda el formulario o la API. Devuelve la fila lista para guardar
 * (columnas de la tabla organizations). `strict` exige de 3 a 5 procesos; sin strict se puede
 * guardar un borrador con menos (el alta es progresiva).
 */
export function normalizeOrganization(input: Partial<OrganizationInput>, opts: { strict?: boolean } = {}) {
  const name = txt(input.name, 160)
  if (!name) throw new OrganizationError('Poné el nombre de tu organización (o un nombre de fantasía si es confidencial).')
  const kind: OrgKind = ORG_KINDS.includes(input.kind as OrgKind) ? (input.kind as OrgKind) : 'empresa'
  const size = ORG_SIZES.includes(input.size as OrgSize) ? (input.size as OrgSize) : null

  const processes = (Array.isArray(input.processes) ? input.processes : [])
    .map((p, i) => ({ id: rowId('p', i, p?.id), name: txt(p?.name, 160), pain: txt(p?.pain, 600), volume: txt(p?.volume, 120), owner: txt(p?.owner, 120) }))
    .filter((p) => p.name)
  if (processes.length > MAX_PROCESSES) throw new OrganizationError(`Elegí como máximo ${MAX_PROCESSES} procesos candidatos: los más importantes.`)
  if (opts.strict && processes.length < MIN_PROCESSES) throw new OrganizationError(`Cargá al menos ${MIN_PROCESSES} procesos candidatos.`)
  // ids únicos aunque el cliente repita
  const seen = new Set<string>()
  for (const [i, p] of processes.entries()) {
    if (seen.has(p.id)) p.id = `p-${i + 1}-${Math.random().toString(36).slice(2, 6)}`
    seen.add(p.id)
  }

  const dataAssets = (Array.isArray(input.dataAssets) ? input.dataAssets : [])
    .map((d, i) => ({ id: rowId('d', i, d?.id), name: txt(d?.name, 160), where: txt(d?.where, 160), notes: txt(d?.notes, 600) }))
    .filter((d) => d.name)
    .slice(0, MAX_ROWS)
  const systems = (Array.isArray(input.systems) ? input.systems : [])
    .map((s, i) => ({ id: rowId('s', i, s?.id), name: txt(s?.name, 120), use: txt(s?.use, 300) }))
    .filter((s) => s.name)
    .slice(0, MAX_ROWS)

  const linksIn = input.links ?? {}
  const links: OrgLinks = {}
  const repo = cleanUrl(linksIn.repo, 'repo')
  const app = cleanUrl(linksIn.app, 'la app')
  const web = cleanUrl(linksIn.web, 'la web')
  if (repo) links.repo = repo
  if (app) links.app = app
  if (web) links.web = web

  return {
    name,
    kind,
    industry: txt(input.industry, 120) || null,
    size,
    my_role: txt(input.myRole, 160) || null,
    description: txt(input.description, 3000),
    processes,
    data_assets: dataAssets,
    systems,
    links,
  }
}

export type OrganizationRowInput = ReturnType<typeof normalizeOrganization>

/** Qué le falta a la organización para estar completa (para el checklist). */
export function organizationGaps(org: Pick<Organization, 'industry' | 'size' | 'my_role' | 'description' | 'processes' | 'data_assets' | 'systems'> | null): string[] {
  if (!org) return ['Dar de alta tu organización']
  const gaps: string[] = []
  if (!org.industry) gaps.push('Industria')
  if (!org.size) gaps.push('Tamaño')
  if (!org.my_role) gaps.push('Tu rol')
  if (!org.description) gaps.push('Qué hace la organización')
  if (org.processes.length < MIN_PROCESSES) gaps.push(`Procesos candidatos (${org.processes.length} de ${MIN_PROCESSES} a ${MAX_PROCESSES})`)
  if (!org.data_assets.length) gaps.push('Datos que tienen')
  if (!org.systems.length) gaps.push('Sistemas que usan')
  return gaps
}

/** Convierte una fila cruda de la DB (jsonb sin tipar) en Organization. */
export function parseOrganizationRow(raw: Record<string, unknown>): Organization {
  const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : [])
  return {
    id: String(raw.id),
    course_id: String(raw.course_id),
    person_id: String(raw.person_id),
    name: String(raw.name ?? ''),
    kind: (ORG_KINDS.includes(raw.kind as OrgKind) ? raw.kind : 'empresa') as OrgKind,
    industry: (raw.industry as string | null) ?? null,
    size: (ORG_SIZES.includes(raw.size as OrgSize) ? raw.size : null) as OrgSize | null,
    my_role: (raw.my_role as string | null) ?? null,
    description: String(raw.description ?? ''),
    processes: arr<OrgProcess>(raw.processes),
    data_assets: arr<OrgDataAsset>(raw.data_assets),
    systems: arr<OrgSystem>(raw.systems),
    links: (raw.links && typeof raw.links === 'object' ? raw.links : {}) as OrgLinks,
    created_at: String(raw.created_at ?? ''),
    updated_at: String(raw.updated_at ?? ''),
  }
}
