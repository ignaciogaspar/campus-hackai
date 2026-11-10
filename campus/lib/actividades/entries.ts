/* Validación de lo que manda el alumno, por tipo de actividad. Puro. */
import { ATTACK_RESULTS, ATTACK_TYPES, BOARD_VOTES, BUG_STATUS, SEVERITIES, type ActivityKind } from './catalog'
import { cleanText, cleanUrl } from './types'
import { SQL_EXERCISES } from './sql-lab'

type Data = Record<string, unknown>
type Result = { ok: true; data: Data } | { ok: false; error: string }

const ids = <T extends ReadonlyArray<{ id: string }>>(list: T) => new Set(list.map((x) => x.id))
const SEV = ids(SEVERITIES)
const STATUS = ids(BUG_STATUS)
const ATK = ids(ATTACK_TYPES)
const RES = ids(ATTACK_RESULTS)
const VOTES = ids(BOARD_VOTES)
const EX = new Set(SQL_EXERCISES.map((e) => e.id))

function obj(v: unknown): Data {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Data) : {}
}

function pickText(src: Data, keys: string[], max = 1500): Data {
  const out: Data = {}
  for (const k of keys) out[k] = cleanText(src[k], max)
  return out
}

/** Entrada por persona (plantillas, URL, progreso). */
export function sanitizeEntry(kind: ActivityKind, raw: unknown): Result {
  const src = obj(raw)
  switch (kind) {
    case 'autopsia':
      return { ok: true, data: { ...pickText(src, ['app', 'pantalla', 'servidor', 'base', 'apis', 'click', 'dudas']), url: cleanUrl(src.url) } }
    case 'request': {
      const probe = obj(src.probe)
      return {
        ok: true,
        data: {
          ...pickText(src, ['app', 'accion', 'metodo', 'endpoint', 'status', 'ms', 'tamano', 'payload', 'respuesta', 'sorpresa'], 800),
          probe: probe.at ? { at: cleanText(probe.at, 40), ms: Number(probe.ms) || 0, status: Number(probe.status) || 0 } : null,
        },
      }
    }
    case 'galeria': {
      const url = cleanUrl(src.url)
      if (!url) return { ok: false, error: 'Poné la URL pública de tu app (https://…).' }
      if (/localhost|127\.0\.0\.1/.test(url)) return { ok: false, error: 'Esa URL es de tu compu: publicá la de producción.' }
      return { ok: true, data: { url, line: cleanText(src.line, 240), nombre: cleanText(src.nombre, 80), repo: cleanUrl(src.repo) } }
    }
    case 'inventario': {
      const rows = Array.isArray(src.rows) ? src.rows.slice(0, 40).map((r) => {
        const o = obj(r)
        const calidad = Math.round(Number(o.calidad))
        return {
          dato: cleanText(o.dato, 200),
          sistema: cleanText(o.sistema, 200),
          dueno: cleanText(o.dueno, 200),
          frecuencia: cleanText(o.frecuencia, 200),
          acceso: ['si', 'pedido', 'no'].includes(String(o.acceso)) ? String(o.acceso) : 'no',
          calidad: calidad >= 1 && calidad <= 5 ? calidad : 3,
          sensible: o.sensible === true,
        }
      }).filter((r) => r.dato || r.sistema) : []
      return { ok: true, data: { ...pickText(src, ['decision', 'hueco', 'conclusion'], 800), rows } }
    }
    case 'sql': {
      const solvedIn = obj(src.solved)
      const solved: Data = {}
      for (const [k, v] of Object.entries(solvedIn)) {
        if (!EX.has(k)) continue
        const o = obj(v)
        solved[k] = { sql: cleanText(o.sql, 4000), at: cleanText(o.at, 40) }
      }
      const attemptsIn = obj(src.attempts)
      const attempts: Data = {}
      for (const [k, v] of Object.entries(attemptsIn)) if (EX.has(k)) attempts[k] = Math.min(999, Math.max(0, Math.round(Number(v) || 0)))
      return { ok: true, data: { solved, attempts, propia: cleanText(src.propia, 1200) } }
    }
    case 'clon':
      return { ok: true, data: pickText(src, ['copie', 'noCopie', 'herramientas', 'aprendizaje'], 1500) }
    case 'directorio':
      return { ok: true, data: pickText(src, ['plan', 'pedido'], 400) }
    default:
      return { ok: false, error: 'Esta actividad no guarda una ficha por persona.' }
  }
}

/** Registros (bug, ataque). `role` dice qué campos puede tocar quien edita. */
export function sanitizeItem(kind: string, raw: unknown, role: 'autor' | 'destino', prev: Data = {}): Result {
  const src = obj(raw)
  if (kind === 'bug') {
    if (role === 'autor') {
      const titulo = cleanText(src.titulo, 160)
      if (!titulo) return { ok: false, error: 'Poné un título corto para el bug.' }
      const severidad = SEV.has(String(src.severidad)) ? String(src.severidad) : 'molesta'
      return { ok: true, data: { ...prev, titulo, severidad, ...pickText(src, ['pasos', 'esperado', 'obtenido'], 1500), status: prev.status ?? 'abierto' } }
    }
    const status = STATUS.has(String(src.status)) ? String(src.status) : String(prev.status ?? 'abierto')
    return { ok: true, data: { ...prev, status, respuesta: cleanText(src.respuesta, 800) } }
  }
  if (kind === 'ataque') {
    if (role === 'autor') {
      const intento = cleanText(src.intento, 2000)
      if (!intento) return { ok: false, error: 'Contá qué intentaste.' }
      return {
        ok: true,
        data: {
          ...prev,
          tipo: ATK.has(String(src.tipo)) ? String(src.tipo) : 'otro',
          intento,
          resultado: RES.has(String(src.resultado)) ? String(src.resultado) : 'resistio',
          evidencia: cleanText(src.evidencia, 1500),
          reintento: RES.has(String(src.reintento)) ? String(src.reintento) : (prev.reintento ?? ''),
        },
      }
    }
    return { ok: true, data: { ...prev, defensa: cleanText(src.defensa, 1500) } }
  }
  return { ok: false, error: 'Tipo de registro desconocido.' }
}

export function sanitizeVote(raw: unknown): Result {
  const src = obj(raw)
  const vote = String(src.vote)
  if (!VOTES.has(vote)) return { ok: false, error: 'Elegí aprobar, aprobar con cambios o rechazar.' }
  const line = cleanText(src.line, 280)
  if (line.length < 5) return { ok: false, error: 'Dejá una línea que justifique tu voto.' }
  return { ok: true, data: { vote, line } }
}
