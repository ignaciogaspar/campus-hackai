// Lógica pura del agente de rediseño del local 3D (portada de
// ../iae/inmobiliario-empresas-familiares/deck/api/redesign.js): sanea el local,
// arma el prompt y el JSON schema, y acomoda el layout propuesto sin superposiciones.
/* eslint-disable @typescript-eslint/no-explicit-any */

export type FixtureType = 'gondola' | 'isla' | 'puntera' | 'heladera' | 'freezer' | 'mostrador' | 'kiosco' | 'equipo'

interface TypeSpec { w: [number, number]; d: [number, number]; h: number; shelves: number | undefined; desc: string }

export interface Fixture {
  id: string
  type: FixtureType
  x: number
  y: number
  w: number
  d: number
  rot: number
  label: string
  category: string
  h?: number
  shelves?: number
  sales?: number
  walk?: number
}

export interface Viewer { id: string; x: number; y: number; facing: number; label: string }

export interface Store {
  name: string
  width: number
  depth: number
  entrance: { x: number; w: number }
  categories: Record<string, string>
  viewers: Viewer[]
  fixtures: Fixture[]
  awning?: boolean
  sidewalk?: number
}

export const TIMEOUT_MS = 55_000
export const MAX_INSTRUCTION = 500
const MAX_FIXTURES = 24
const WALL = 0.12 // clearance between a fixture and the walls (m)
const GAP = 0.08 // minimum gap between fixtures (m)
const DOOR_DEPTH = 0.8 // the doorway strip (y < this, inside the entrance span) stays free

export const TYPES: Record<FixtureType, TypeSpec> = {
  gondola: { w: [0.8, 4], d: [0.4, 1.2], h: 1.6, shelves: 5, desc: 'góndola de estantes (doble faz si d ≥ 0.8)' },
  isla: { w: [0.8, 3], d: [0.6, 1.4], h: 1.15, shelves: 3, desc: 'isla/mesa baja de exhibición, accesible desde todos lados (ideal para promociones)' },
  puntera: { w: [0.5, 2.5], d: [0.4, 0.8], h: 1.4, shelves: 4, desc: 'puntera o estante bajo/alto contra cabecera o pared' },
  heladera: { w: [0.7, 3], d: [0.6, 1], h: 2.02, shelves: 5, desc: 'heladera vertical de puertas de vidrio (va contra una pared)' },
  freezer: { w: [0.8, 2.5], d: [0.6, 1], h: 0.9, shelves: undefined, desc: 'freezer horizontal (helados, congelados)' },
  mostrador: { w: [0.8, 3], d: [0.5, 1], h: 1.06, shelves: undefined, desc: 'mostrador / caja de cobro' },
  kiosco: { w: [1, 3.5], d: [0.5, 1.2], h: 0.94, shelves: 3, desc: 'kiosco / exhibidor bajo de golosinas con vidrio' },
  equipo: { w: [0.3, 1.2], d: [0.3, 1], h: 1.4, shelves: undefined, desc: 'equipo suelto (máquina de café, tótem)' },
}

const num = (v: unknown, lo: number, hi: number, dflt: number): number => {
  const n = Number(v)
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt
}
export const str = (v: unknown, max: number, dflt = ''): string => (typeof v === 'string' ? v.trim().slice(0, max) : dflt)
const round = (n: number) => Math.round(n * 100) / 100

/** Axis-aligned footprint of a (possibly rotated) fixture. */
function bounds(f: Fixture) {
  const a = ((f.rot || 0) * Math.PI) / 180
  const c = Math.abs(Math.cos(a)),
    s = Math.abs(Math.sin(a))
  const w = f.w * c + f.d * s,
    d = f.d * c + f.w * s
  return { l: f.x - w / 2, r: f.x + w / 2, f: f.y - d / 2, b: f.y + d / 2, w, d }
}

/** The client's store, made safe: known shape, finite numbers, bounded sizes. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function sanitizeStore(s: any): Store {
  if (!s || typeof s !== 'object') throw new Error('Falta el local.')
  const width = num(s.width, 3, 30, NaN),
    depth = num(s.depth, 3, 30, NaN)
  if (!Number.isFinite(width) || !Number.isFinite(depth)) throw new Error('Medidas del local inválidas.')
  const entrance = { x: num(s.entrance?.x, 0, width, width / 2), w: num(s.entrance?.w, 0.8, width, Math.min(3, width)) }
  const categories: Record<string, string> = {}
  for (const [k, v] of Object.entries(s.categories || {}).slice(0, 20)) {
    const name = str(k, 40)
    if (name && /^#[0-9a-fA-F]{6}$/.test(String(v))) categories[name] = String(v)
  }
  if (!Object.keys(categories).length) throw new Error('El local no tiene categorías.')
  const fixtures: Fixture[] = []
  const ids = new Set<string>()
  for (const f of (Array.isArray(s.fixtures) ? s.fixtures : []).slice(0, MAX_FIXTURES) as any[]) {
    const type = (f?.type in TYPES ? f.type : null) as FixtureType | null
    const id = str(f?.id, 40).replace(/[^\w-]/g, '')
    if (!type || !id || ids.has(id)) continue
    ids.add(id)
    const t = TYPES[type]
    fixtures.push({
      id,
      type,
      x: num(f.x, 0, width, width / 2),
      y: num(f.y, 0, depth, depth / 2),
      w: num(f.w, t.w[0], t.w[1], t.w[0]),
      d: num(f.d, t.d[0], t.d[1], t.d[0]),
      rot: ((Math.round(num(f.rot, -720, 720, 0)) % 360) + 360) % 360,
      label: str(f.label, 60, id),
      category: categories[f.category] ? f.category : Object.keys(categories)[0],
      ...(f.h !== undefined && { h: num(f.h, 0.5, 2.6, t.h) }),
      ...(f.shelves !== undefined && { shelves: Math.round(num(f.shelves, 1, 7, 4)) }),
      ...(f.sales !== undefined && { sales: num(f.sales, 0, 1, 0.5) }),
      ...(f.walk !== undefined && { walk: Math.round(num(f.walk, 0, 99, 1)) }),
    })
  }
  const viewers = (Array.isArray(s.viewers) ? s.viewers : []).slice(0, 6).flatMap((v: any): Viewer[] => {
    const id = str(v?.id, 40)
    const x = Number(v?.x),
      y = Number(v?.y),
      facing = Number(v?.facing)
    return id && [x, y, facing].every(Number.isFinite) ? [{ id, x, y, facing, label: str(v.label, 60) }] : []
  })
  return { name: str(s.name, 60, 'Local comercial · caso'), width, depth, entrance, categories, viewers, fixtures, ...(s.awning && { awning: true }), ...(s.sidewalk && { sidewalk: num(s.sidewalk, 0, 4, 0) }) }
}

/** Keep every fixture inside the walls, out of the doorway and apart from the others (simple relaxation). */
export function settle(store: Store, movedIds: Set<string>): number {
  const fx = store.fixtures
  const left = store.entrance.x - store.entrance.w / 2,
    right = store.entrance.x + store.entrance.w / 2
  const clampIn = (f: Fixture) => {
    const b = bounds(f)
    f.x = Math.min(store.width - WALL - b.w / 2, Math.max(WALL + b.w / 2, f.x))
    f.y = Math.min(store.depth - WALL - b.d / 2, Math.max(WALL + b.d / 2, f.y))
    const c = bounds(f)
    if (c.f < DOOR_DEPTH && c.r > left && c.l < right) f.y = DOOR_DEPTH + c.d / 2
    f.y = Math.min(store.depth - WALL - c.d / 2, f.y)
  }
  // fixtures the agent did not touch keep their place; the changed ones yield
  const weight = (f: Fixture) => (movedIds.has(f.id) ? 1 : 0.25)
  for (let iter = 0; iter < 80; iter++) {
    let overlaps = 0
    fx.forEach(clampIn)
    for (let i = 0; i < fx.length; i++)
      for (let j = i + 1; j < fx.length; j++) {
        const a = bounds(fx[i]),
          b = bounds(fx[j])
        const ox = Math.min(a.r, b.r) - Math.max(a.l, b.l) + GAP,
          oy = Math.min(a.b, b.b) - Math.max(a.f, b.f) + GAP
        if (ox <= 0 || oy <= 0) continue
        overlaps++
        const wi = weight(fx[i]),
          wj = weight(fx[j]),
          sum = wi + wj
        if (ox < oy) {
          const dir = fx[i].x < fx[j].x ? -1 : 1
          fx[i].x += (dir * ox * wi) / sum
          fx[j].x -= (dir * ox * wj) / sum
        } else {
          const dir = fx[i].y < fx[j].y ? -1 : 1
          fx[i].y += (dir * oy * wi) / sum
          fx[j].y -= (dir * oy * wj) / sum
        }
      }
    if (!overlaps) break
  }
  fx.forEach(clampIn)
  let residual = 0
  for (let i = 0; i < fx.length; i++)
    for (let j = i + 1; j < fx.length; j++) {
      const a = bounds(fx[i]),
        b = bounds(fx[j])
      if (Math.min(a.r, b.r) - Math.max(a.l, b.l) > 0.02 && Math.min(a.b, b.b) - Math.max(a.f, b.f) > 0.02) residual++
    }
  for (const f of fx) {
    f.x = round(f.x)
    f.y = round(f.y)
    f.w = round(f.w)
    f.d = round(f.d)
  }
  return residual
}

export function systemPrompt(): string {
  const types = Object.entries(TYPES)
    .map(([k, t]) => `- ${k}: ${t.desc}. Ancho w ${t.w[0]}–${t.w[1]} m, profundidad d ${t.d[0]}–${t.d[1]} m.`)
    .join('\n')
  return `Sos un agente de diseño de layout para locales comerciales (retail de proximidad). Recibís el plano actual de un local en JSON y un pedido en castellano rioplatense de un directivo, y devolvés el layout nuevo completo.

Sistema de coordenadas (metros):
- El local es un rectángulo de "width" (eje x, de izquierda a derecha mirando desde la calle) por "depth" (eje y). y = 0 es la fachada con la puerta; y = depth es la pared del fondo.
- "entrance": la puerta, centrada en x = entrance.x, con ancho entrance.w, sobre y = 0.
- Cada mueble tiene centro (x, y), ancho w (a lo largo de su frente), profundidad d, y rotación rot en grados: 0 = su frente mira hacia la entrada, 90 = mira hacia la derecha (+x), 180 = mira al fondo, 270 = mira hacia la izquierda. Con rot 90 o 270, el mueble ocupa d en x y w en y.
- La huella real en planta: con rot 0/180 ocupa x ± w/2, y ± d/2; con rot 90/270 ocupa x ± d/2, y ± w/2.

Tipos de mueble:
${types}

Reglas:
1. Ningún mueble puede superponerse con otro: dejá al menos 0.9 m de pasillo entre muebles que se enfrentan y nunca menos de 0.1 m entre huellas.
2. Todo mueble queda dentro de las paredes (0.12 m de margen).
3. La puerta queda libre: nada en la franja y < 0.8 m dentro del ancho de la entrada, y un paso cómodo desde la puerta hacia el interior.
4. Heladeras y góndolas de pared van pegadas a una pared, con el frente hacia el interior (p. ej. contra la pared del fondo con rot 0; contra la pared izquierda con rot 90; contra la derecha con rot 270).
5. Conservá el "id" de los muebles que siguen existiendo (aunque los muevas). Para un mueble nuevo usá un id nuevo en minúsculas con guiones (p. ej. "isla-promo"). Podés quitar muebles si el pedido lo implica.
6. "category" tiene que ser una de las categorías del local. "label" es un nombre corto en castellano.
7. Cambiá solo lo necesario para cumplir el pedido; el resto queda donde estaba. Si el pedido no tiene sentido para un local o no es sobre el layout, devolvé el layout sin cambios y explicalo.
8. "explanation": 1 o 2 oraciones cortas en castellano rioplatense (vos), para mostrar en pantalla: qué cambiaste y por qué conviene comercialmente. Máximo 180 caracteres. Sin markdown.

Devolvé la lista COMPLETA de muebles del layout resultante.`
}

export function outputSchema(categories: string[]) {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['explanation', 'fixtures'],
    properties: {
      explanation: { type: 'string' },
      fixtures: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['id', 'type', 'x', 'y', 'w', 'd', 'rot', 'label', 'category'],
          properties: {
            id: { type: 'string' },
            type: { type: 'string', enum: Object.keys(TYPES) },
            x: { type: 'number' },
            y: { type: 'number' },
            w: { type: 'number' },
            d: { type: 'number' },
            rot: { type: 'number' },
            label: { type: 'string' },
            category: { type: 'string', enum: categories },
          },
        },
      },
    },
  }
}
