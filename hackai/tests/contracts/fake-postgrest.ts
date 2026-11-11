/* PostgREST de mentira para los tests: un `fetch` que responde como la API
   REST de Supabase sobre tablas en memoria, sin red, para correr un almacén de
   Supabase contra su batería de contrato.

   Entiende lo que usan los almacenes y nada más: lecturas con `select`, filtros
   `eq` e `in` y `order`; inserts con `return=representation`; PATCH con
   filtros; y funciones por `rpc`. Asigna los uuid y los contadores `identity`,
   aplica las claves únicas (409 con el código 23505 de Postgres) y rechaza un
   id con forma de uuid inválida (400 con 22P02), como la base. Cualquier otra
   forma de consulta es un 400, así un almacén que pide algo distinto hace
   fallar su batería en vez de pasar de casualidad. */
import { randomUUID } from 'node:crypto'

export type FakeRow = Record<string, unknown>

export type FakeTable = {
  columns: string[]
  /** Columnas de tipo uuid: un valor con otra forma es un error, como en Postgres. */
  uuid?: string[]
  /** Columnas que asigna la base y no se pueden escribir: un uuid nuevo o un contador que crece. */
  generated?: Record<string, 'uuid' | 'identity'>
  /** Valores por defecto de las columnas que no vienen en el insert. */
  defaults?: Record<string, unknown>
  /** Claves únicas. Como en Postgres, una clave con algún `null` no choca con ninguna. */
  unique?: string[][]
}

/** Una función de la base, llamada por `rpc`: recibe los argumentos y las tablas. Devuelve un `PostgrestError` o el resultado. */
export type FakeFunction = (args: Record<string, unknown>, tables: Record<string, FakeRow[]>) => unknown

export type FakePostgrestOptions = {
  tables: Record<string, FakeTable>
  functions?: Record<string, FakeFunction>
}

/** Un error con la forma de los de PostgREST. */
export class PostgrestError {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly message: string
  ) {}
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const isUuid = (value: unknown) => typeof value === 'string' && UUID.test(value)

/** El error de Postgres ante un uuid mal formado. */
export const invalidUuid = (value: unknown) =>
  new PostgrestError(400, '22P02', `invalid input syntax for type uuid: "${String(value)}"`)

const bad = (message: string) => new PostgrestError(400, 'PGRST100', message)

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

/** Los valores de un filtro `in.(a,b,"c,d")`, con las comillas que pone supabase-js si hay comas o paréntesis. */
function parseList(raw: string): string[] | null {
  if (!raw.startsWith('(') || !raw.endsWith(')')) return null
  const values: string[] = []
  const body = raw.slice(1, -1)
  const token = /"([^"]*)"|([^,]*)/y
  let at = 0
  while (at <= body.length) {
    token.lastIndex = at
    const match = token.exec(body)
    if (!match) return null
    values.push(match[1] ?? match[2])
    at = token.lastIndex
    if (at < body.length && body[at] !== ',') return null
    at += 1
  }
  return body === '' ? [] : values
}

type Filter = (row: FakeRow) => boolean
type Order = { column: string; ascending: boolean }
type Query = { filters: Filter[]; select: string[] | null; order: Order[] }

const asText = (value: unknown) => (value === null || value === undefined ? null : String(value))

function checkValue(table: FakeTable, column: string, value: string) {
  if (!table.columns.includes(column)) throw bad(`columna desconocida: ${column}`)
  if (table.uuid?.includes(column) && !isUuid(value)) throw invalidUuid(value)
}

function parseFilter(table: FakeTable, column: string, raw: string): Filter {
  if (raw.startsWith('eq.')) {
    const value = raw.slice(3)
    checkValue(table, column, value)
    return (row) => asText(row[column]) === value
  }
  if (raw.startsWith('in.')) {
    const values = parseList(raw.slice(3))
    if (!values) throw bad(`lista inválida: ${raw}`)
    for (const value of values) checkValue(table, column, value)
    return (row) => values.includes(asText(row[column]) ?? '\u0000')
  }
  throw bad(`filtro desconocido: ${column}=${raw}`)
}

function parseOrder(table: FakeTable, raw: string): Order[] {
  return raw.split(',').map((part) => {
    const [column, direction = 'asc', ...rest] = part.split('.')
    if (!table.columns.includes(column) || rest.length || !['asc', 'desc'].includes(direction))
      throw bad(`orden desconocido: ${part}`)
    return { column, ascending: direction === 'asc' }
  })
}

function parseSelect(table: FakeTable, raw: string): string[] {
  if (raw === '*') return table.columns
  const columns = raw.split(',')
  for (const column of columns) if (!table.columns.includes(column)) throw bad(`columna desconocida: ${column}`)
  return columns
}

function parseQuery(table: FakeTable, params: URLSearchParams): Query {
  const query: Query = { filters: [], select: null, order: [] }
  for (const [name, raw] of params) {
    if (name === 'select') query.select = parseSelect(table, raw)
    else if (name === 'order') query.order = parseOrder(table, raw)
    else query.filters.push(parseFilter(table, name, raw))
  }
  return query
}

function compare(a: unknown, b: unknown): number {
  if (a === b) return 0
  if (a === null || a === undefined) return 1
  if (b === null || b === undefined) return -1
  return (a as number | string) < (b as number | string) ? -1 : 1
}

function sorted(rows: FakeRow[], order: Order[]): FakeRow[] {
  return [...rows].sort((x, y) => {
    for (const { column, ascending } of order) {
      const c = compare(x[column], y[column])
      if (c) return ascending ? c : -c
    }
    return 0
  })
}

const project = (rows: FakeRow[], columns: string[]) =>
  rows.map((row) => structuredClone(Object.fromEntries(columns.map((c) => [c, row[c] ?? null]))))

/** Las filas que se devuelven, como array o, con `single()`, como un objeto. */
function respond(status: number, rows: FakeRow[], headers: Headers): Response {
  if (!headers.get('prefer')?.includes('return=representation')) return new Response(null, { status: 204 })
  if (headers.get('accept')?.startsWith('application/vnd.pgrst.object+json')) {
    if (rows.length !== 1)
      throw new PostgrestError(406, 'PGRST116', 'JSON object requested, multiple (or no) rows returned')
    return json(status, rows[0])
  }
  return json(status, rows)
}

function duplicateOf(table: FakeTable, rows: FakeRow[], row: FakeRow): string[] | undefined {
  return table.unique?.find((key) =>
    rows.some((other) => other !== row && key.every((c) => row[c] !== null && asText(other[c]) === asText(row[c])))
  )
}

function checkUnique(name: string, table: FakeTable, rows: FakeRow[], candidates: FakeRow[]) {
  for (const row of candidates) {
    const key = duplicateOf(table, rows, row)
    if (key)
      throw new PostgrestError(409, '23505', `duplicate key value violates unique constraint on ${name} (${key})`)
  }
}

function checkWritable(table: FakeTable, values: FakeRow) {
  for (const [column, value] of Object.entries(values)) {
    if (!table.columns.includes(column)) throw bad(`columna desconocida: ${column}`)
    if (table.generated?.[column])
      throw new PostgrestError(400, '428C9', `cannot insert a non-DEFAULT value into column "${column}"`)
    if (table.uuid?.includes(column) && value !== null && !isUuid(value)) throw invalidUuid(value)
  }
}

export function createFakePostgrest({ tables, functions = {} }: FakePostgrestOptions) {
  const data: Record<string, FakeRow[]> = Object.fromEntries(Object.keys(tables).map((name) => [name, []]))
  const counters: Record<string, number> = {}

  function newRow(name: string, table: FakeTable, values: FakeRow): FakeRow {
    checkWritable(table, values)
    const row: FakeRow = {}
    for (const column of table.columns) {
      const kind = table.generated?.[column]
      if (kind === 'uuid') row[column] = randomUUID()
      else if (kind === 'identity') {
        const key = `${name}.${column}`
        counters[key] = (counters[key] ?? 0) + 1
        row[column] = counters[key]
      } else if (column in values) row[column] = structuredClone(values[column])
      else row[column] = structuredClone(table.defaults?.[column] ?? null)
    }
    return row
  }

  function select(table: FakeTable, rows: FakeRow[], params: URLSearchParams, headers: Headers) {
    const query = parseQuery(table, params)
    const found = sorted(
      rows.filter((row) => query.filters.every((f) => f(row))),
      query.order
    )
    // Una lectura siempre devuelve sus filas, aunque no pida `return=representation`.
    headers.set('prefer', 'return=representation')
    return respond(200, project(found, query.select ?? table.columns), headers)
  }

  function insert(name: string, table: FakeTable, params: URLSearchParams, headers: Headers, body: unknown) {
    const { select: columns, filters, order } = parseQuery(table, params)
    if (filters.length || order.length) throw bad('un insert solo acepta select')
    if (body === null || typeof body !== 'object' || Array.isArray(body)) throw bad('se inserta una fila por vez')
    const row = newRow(name, table, body as FakeRow)
    checkUnique(name, table, data[name], [row])
    data[name].push(row)
    return respond(201, project([row], columns ?? table.columns), headers)
  }

  function update(name: string, table: FakeTable, params: URLSearchParams, headers: Headers, body: unknown) {
    const query = parseQuery(table, params)
    if (!query.filters.length) throw bad('un update sin filtros')
    if (body === null || typeof body !== 'object' || Array.isArray(body)) throw bad('cuerpo inválido')
    checkWritable(table, body as FakeRow)
    const matched = data[name].filter((row) => query.filters.every((f) => f(row)))
    const updated = matched.map((row) => ({ before: row, after: { ...row, ...structuredClone(body as FakeRow) } }))
    const others = data[name].filter((row) => !matched.includes(row))
    checkUnique(
      name,
      table,
      [...others, ...updated.map((u) => u.after)],
      updated.map((u) => u.after)
    )
    for (const { before, after } of updated) Object.assign(before, after)
    return respond(200, project(matched, query.select ?? table.columns), headers)
  }

  function call(fn: string, body: unknown): Response {
    const handler = functions[fn]
    if (!handler) throw new PostgrestError(404, 'PGRST202', `función desconocida: ${fn}`)
    const result = handler((body ?? {}) as Record<string, unknown>, data)
    if (result instanceof PostgrestError) throw result
    return result === undefined ? new Response(null, { status: 204 }) : json(200, result)
  }

  function handle(method: string, url: URL, headers: Headers, body: unknown): Response {
    const path = url.pathname.replace(/^\/rest\/v1\//, '')
    if (path.startsWith('rpc/')) {
      if (method !== 'POST') throw bad('rpc solo por POST')
      return call(path.slice(4), body)
    }
    const table = tables[path]
    if (!table) throw new PostgrestError(404, '42P01', `tabla desconocida: ${path}`)
    if (method === 'GET') return select(table, data[path], url.searchParams, headers)
    if (method === 'POST') return insert(path, table, url.searchParams, headers, body)
    if (method === 'PATCH') return update(path, table, url.searchParams, headers, body)
    throw bad(`método no soportado: ${method}`)
  }

  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input)
    const headers = new Headers(init?.headers)
    const raw = typeof init?.body === 'string' ? init.body : null
    try {
      return handle(init?.method ?? 'GET', url, headers, raw ? JSON.parse(raw) : null)
    } catch (error) {
      if (!(error instanceof PostgrestError)) throw error
      return json(error.status, { code: error.code, message: error.message, details: null, hint: null })
    }
  }

  return { fetch, tables: data }
}
