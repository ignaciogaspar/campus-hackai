// Isolated PostgREST fixture. No production connections or credentials.
import { randomUUID } from 'node:crypto'
export const STUDENT_A = '00000000-0000-4000-8000-000000000001'
export const STUDENT_B = '00000000-0000-4000-8000-000000000002'
export const TEACHER = '00000000-0000-4000-8000-000000000003'
export const OUTSIDER = '00000000-0000-4000-8000-000000000004'
export const COURSE = 'ai-centric-management'
type Row = Record<string, any>

export function learningFixture() {
  const tables: Record<string, Row[]> = {
    people: [
      { id: STUDENT_A, full_name: 'Mariana Ejemplo', role: 'alumno', course_id: COURSE, session_version: 0 },
      { id: STUDENT_B, full_name: 'Tomás Prueba', role: 'alumno', course_id: COURSE, session_version: 0 },
      { id: TEACHER, full_name: 'Docente de prueba', role: 'profesor', course_id: COURSE, session_version: 0 },
      { id: OUTSIDER, full_name: 'Otro curso', role: 'alumno', course_id: 'other', session_version: 0 },
    ],
    class_sessions: [
      { id: 'aicm-j1', course_id: COURSE, ordinal: 1, title: 'Awareness', block: 'Awareness', starts_at: new Date(Date.now() - 2 * 86400_000).toISOString(), deck_id: 'aicm-j1' },
      { id: 'aicm-j2', course_id: COURSE, ordinal: 2, title: 'Anatomía de un producto digital', block: 'Build', starts_at: new Date(Date.now() + 2 * 86400_000).toISOString(), deck_id: 'aicm-j2' },
      { id: 'other-j1', course_id: 'other', ordinal: 1, title: 'Otro curso', starts_at: new Date(0).toISOString() },
    ],
    session_reflections: [], session_feedback: [], slide_marks: [],
    decks: [{ id: 'aicm-j1', course_id: COURSE, title: 'Awareness', kind: 'native', deck_slides: [], question: '¿Qué cambia en tu organización?', sources: [], chapters: [] }, { id: 'aicm-j2', course_id: COURSE, title: 'Anatomía de un producto digital', kind: 'native', deck_slides: [], sources: [], chapters: [] }],
  }
  let failTable = ''
  function matches(row: Row, params: URLSearchParams) {
    for (const [key, raw] of params) {
      if (['select', 'order', 'limit', 'offset', 'on_conflict'].includes(key)) continue
      const [op, ...rest] = raw.split('.')
      const value = rest.join('.')
      if (op === 'eq' && String(row[key]) !== value) return false
      if (op === 'neq' && String(row[key]) === value) return false
      if (op === 'lte' && (row[key] == null || String(row[key]) > value)) return false
      if (op === 'gte' && (row[key] == null || String(row[key]) < value)) return false
      if (op === 'not' && value === 'is.null' && row[key] == null) return false
      if (op === 'in' && !value.slice(1, -1).replaceAll('"', '').split(',').includes(String(row[key]))) return false
    }
    return true
  }
  const fetcher: typeof fetch = async (input, init) => {
    const request = new Request(input, init)
    const url = new URL(request.url)
    const table = url.pathname.split('/').pop()!
    const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
    if (table === failTable) return response({ code: '42P01', message: 'Fixture: relation unavailable' }, 500)
    if (url.pathname.includes('/rpc/')) return response(true)
    const rows = tables[table] ?? (tables[table] = [])
    let found = rows.filter((row) => matches(row, url.searchParams))
    if (request.method === 'POST') {
      const incoming = await request.json() as Row
      if (rows.some((r) => r.person_id === incoming.person_id && r.session_id === incoming.session_id)) return response({ code: '23505', message: 'duplicate' }, 409)
      const row = { id: randomUUID(), body: null, visible_at: null, publication_id: null, read_at: null, applied_at: null, action_label: '', action_href: '', ...incoming }
      rows.push(row); found = [row]
    } else if (request.method === 'PATCH') {
      const patch = await request.json() as Row
      for (const row of found) Object.assign(row, patch)
    }
    const order = url.searchParams.get('order')
    if (order) {
      const [key, dir] = order.split('.')
      found = [...found].sort((a, b) => String(a[key]).localeCompare(String(b[key]), undefined, { numeric: true }) * (dir === 'desc' ? -1 : 1))
    }
    const select = url.searchParams.get('select')
    if (select && select !== '*' && !select.includes('(')) found = found.map((r) => Object.fromEntries(select.split(',').map((k) => [k.trim(), r[k.trim()] ?? null])))
    if (request.method === 'HEAD') return new Response(null, { headers: { 'content-range': `0-${found.length}/${found.length}` } })
    if (request.headers.get('accept')?.includes('vnd.pgrst.object')) {
      return found.length === 1 ? response(found[0]) : response({ code: 'PGRST116', details: `The result contains ${found.length} rows`, message: 'Expected one row' }, 406)
    }
    return response(found)
  }
  return { tables, fetch: fetcher, fail: (table: string) => { failTable = table } }
}
