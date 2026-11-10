import 'server-only'
import { BOARD_ROLES, type ActivityDef } from './catalog'
import { sanitizeEntry, sanitizeItem, sanitizeVote } from './entries'
import {
  addItem, deleteItem, getActivityState, getEntry, getItem, getRoster, listEntries, listItems,
  patchActivityState, saveEntry, updateItemData, upsertVote,
} from './store'
import {
  boardRoleIndex, cleanText, makeGroups, rng, shuffle, targetOf, workedBy,
  type ActivityEntry, type ActivityItem, type ActivityState, type BoardState, type RosterPerson,
} from './types'

/* Lógica de las actividades: arma la vista para cada rol y ejecuta operaciones. */

export interface PersonRef { id: string; name: string; company: string | null }
export interface GalleryCard extends PersonRef { url: string; line: string; nombre: string; repo: string; updatedAt: string }
export interface BoardView {
  order: PersonRef[]
  current: number
  votingFor: string | null
  /** Rol de cada persona en la presentación actual (solo para el profesor: todos; para el alumno: el suyo). */
  roles: Record<string, string>
  tallies: Record<string, { aprobar: number; cambios: number; rechazar: number; total: number }>
}

export interface ActivityView {
  activityId: string
  kind: ActivityDef['kind']
  role: 'alumno' | 'profesor'
  me: string
  now: string
  timer: ActivityState['timer'] | null
  entry: Record<string, unknown> | null
  /** Sobre quién trabajo yo / quién trabaja sobre mí. */
  target: (PersonRef & { appUrl: string | null; appLine: string | null }) | null
  workedBy: PersonRef | null
  items: ActivityItem[]
  /** Ficha de quien trabajó sobre mí (el clon). */
  peerEntry?: Record<string, unknown> | null
  gallery: GalleryCard[]
  board: BoardView | null
  /** Solo profesor. */
  groups?: PersonRef[][]
  entries?: Array<ActivityEntry & { person: PersonRef }>
  roster?: PersonRef[]
  /** Comentarios recibidos en el directorio (anónimos para el alumno). */
  received?: Array<{ vote: string; line: string; by?: string }>
}

function ref(p: RosterPerson | undefined, id: string): PersonRef {
  return { id, name: p?.full_name ?? 'Alguien', company: p?.company ?? null }
}

const GALLERY_ID = 'j3-galeria'

async function galleryCards(byId: Map<string, RosterPerson>): Promise<GalleryCard[]> {
  const entries = await listEntries(GALLERY_ID)
  return entries.filter((e) => byId.has(e.person_id) && typeof e.data.url === 'string' && e.data.url).map((e) => ({
    ...ref(byId.get(e.person_id), e.person_id),
    url: String(e.data.url),
    line: String(e.data.line ?? ''),
    nombre: String(e.data.nombre ?? ''),
    repo: String(e.data.repo ?? ''),
    updatedAt: e.updated_at,
  }))
}

function boardView(board: BoardState, byId: Map<string, RosterPerson>, votes: ActivityItem[], me: string, isProf: boolean): BoardView {
  const idx = Math.max(0, Math.min(board.current, board.order.length - 1))
  const roles: Record<string, string> = {}
  for (const id of board.order) {
    if (!isProf && id !== me) continue
    const r = boardRoleIndex(board, id, idx)
    if (r >= 0) roles[id] = BOARD_ROLES[r]
  }
  const tallies: BoardView['tallies'] = {}
  for (const v of votes) {
    const t = v.target_person_id
    if (!t) continue
    const row = tallies[t] ?? (tallies[t] = { aprobar: 0, cambios: 0, rechazar: 0, total: 0 })
    const vote = String(v.data.vote) as 'aprobar' | 'cambios' | 'rechazar'
    if (vote in row) row[vote]++
    row.total++
  }
  return {
    order: board.order.map((id) => ref(byId.get(id), id)),
    current: board.current,
    votingFor: board.votingFor,
    roles,
    // El alumno ve el resultado de cada presentación recién cuando cerró su votación.
    tallies: isProf ? tallies : Object.fromEntries(Object.entries(tallies).filter(([id]) => id !== board.votingFor)),
  }
}

export async function buildView(def: ActivityDef, session: { personId: string; role: 'alumno' | 'profesor' }): Promise<ActivityView> {
  const isProf = session.role === 'profesor'
  const me = session.personId
  const [roster, state] = await Promise.all([getRoster(), getActivityState(def.id)])
  const byId = new Map(roster.map((p) => [p.id, p]))

  const view: ActivityView = {
    activityId: def.id,
    kind: def.kind,
    role: session.role,
    me,
    now: new Date().toISOString(),
    timer: state.timer ?? null,
    entry: null,
    target: null,
    workedBy: null,
    items: [],
    gallery: [],
    board: null,
  }

  if (!isProf) view.entry = (await getEntry(def.id, me))?.data ?? null

  const needsGallery = def.kind === 'galeria' || def.kind === 'rompe' || def.kind === 'clon'
  const gallery = needsGallery ? await galleryCards(byId) : []
  if (def.kind === 'galeria') view.gallery = gallery

  if (def.pairs && !isProf) {
    const t = targetOf(state, me)
    const w = workedBy(state, me)
    if (t) {
      const card = gallery.find((g) => g.id === t)
      view.target = { ...ref(byId.get(t), t), appUrl: card?.url ?? null, appLine: card?.line ?? null }
    }
    if (w) view.workedBy = ref(byId.get(w), w)
    // El clon: lo que mi pareja no pudo copiar de mi app es mi defensa.
    if (def.kind === 'clon' && w) view.peerEntry = (await getEntry(def.id, w))?.data ?? null
  }

  if (def.kind === 'rompe' || def.kind === 'redteam') {
    view.items = await listItems(def.id, isProf ? {} : { involving: me })
  }

  if (def.kind === 'directorio' && state.board) {
    const votes = await listItems(def.id, { kind: 'voto' })
    view.board = boardView(state.board, byId, votes, me, isProf)
    if (isProf) view.items = votes
    else {
      view.items = votes.filter((v) => v.person_id === me)
      view.received = votes.filter((v) => v.target_person_id === me && state.board?.votingFor !== me)
        .map((v) => ({ vote: String(v.data.vote), line: String(v.data.line ?? '') }))
    }
  }

  if (isProf) {
    view.roster = roster.map((p) => ref(p, p.id))
    view.groups = (state.groups ?? []).map((g) => g.map((id) => ref(byId.get(id), id)))
    const entries = await listEntries(def.id)
    view.entries = entries.map((e) => ({ ...e, person: ref(byId.get(e.person_id), e.person_id) }))
    if (def.kind === 'galeria') view.gallery = gallery
  }
  return view
}

// ---------------------------------------------------------------- operaciones

export type OpResult = { ok: true; message?: string } | { ok: false; error: string; status?: number }

const PAIR_AVOID: Record<string, string> = { 'j6-clon': 'j3-rompe', 'j7-redteam': 'j6-clon' }

export async function runOp(def: ActivityDef, session: { personId: string; role: 'alumno' | 'profesor' }, body: Record<string, unknown>): Promise<OpResult> {
  const op = String(body.op ?? '')
  const me = session.personId
  const isProf = session.role === 'profesor'

  // ---------- alumno ----------
  if (op === 'entry.save') {
    if (isProf) return { ok: false, error: 'Las fichas son de los alumnos.', status: 403 }
    const res = sanitizeEntry(def.kind, body.data)
    if (!res.ok) return res
    await saveEntry(def.id, me, res.data)
    return { ok: true, message: 'Guardado.' }
  }

  if (op === 'item.add') {
    if (isProf) return { ok: false, error: 'Los registros los cargan los alumnos.', status: 403 }
    const kind = def.kind === 'rompe' ? 'bug' : def.kind === 'redteam' ? 'ataque' : null
    if (!kind) return { ok: false, error: 'Esta actividad no tiene registros.' }
    const state = await getActivityState(def.id)
    const target = targetOf(state, me)
    if (!target) return { ok: false, error: 'Todavía no tenés pareja asignada.' }
    const res = sanitizeItem(kind, body.data, 'autor')
    if (!res.ok) return res
    await addItem({ activityId: def.id, kind, personId: me, targetPersonId: target, data: res.data })
    return { ok: true, message: 'Registrado.' }
  }

  if (op === 'item.update' || op === 'item.delete') {
    const item = await getItem(String(body.itemId ?? ''))
    if (!item || item.activity_id !== def.id) return { ok: false, error: 'No existe ese registro.', status: 404 }
    const asAuthor = item.person_id === me
    const asTarget = item.target_person_id === me
    if (op === 'item.delete') {
      if (!asAuthor && !isProf) return { ok: false, error: 'Solo quien lo cargó lo puede borrar.', status: 403 }
      await deleteItem(item.id)
      return { ok: true, message: 'Borrado.' }
    }
    if (!asAuthor && !asTarget) return { ok: false, error: 'Ese registro no es tuyo.', status: 403 }
    const res = sanitizeItem(item.kind, body.data, asAuthor ? 'autor' : 'destino', item.data)
    if (!res.ok) return res
    await updateItemData(item.id, res.data)
    return { ok: true, message: 'Actualizado.' }
  }

  if (op === 'vote') {
    if (def.kind !== 'directorio') return { ok: false, error: 'Esta actividad no tiene votación.' }
    const state = await getActivityState(def.id)
    const presenter = String(body.presenterId ?? '')
    if (!state.board?.votingFor || state.board.votingFor !== presenter) return { ok: false, error: 'La votación de esa presentación no está abierta.', status: 409 }
    if (presenter === me) return { ok: false, error: 'No podés votar tu propia presentación.' }
    if (isProf) return { ok: false, error: 'Votan los alumnos.', status: 403 }
    const res = sanitizeVote(body)
    if (!res.ok) return res
    await upsertVote(def.id, me, presenter, res.data)
    return { ok: true, message: 'Voto registrado.' }
  }

  // ---------- profesor ----------
  if (!isProf) return { ok: false, error: 'Operación del profesor.', status: 403 }

  if (op === 'pairs.generate') {
    const roster = await getRoster()
    const only = Array.isArray(body.only) ? new Set((body.only as unknown[]).map(String)) : null
    const ids = roster.map((p) => p.id).filter((id) => !only || only.has(id))
    const avoidFrom = PAIR_AVOID[def.id]
    const current = await getActivityState(def.id)
    const avoid = [...(current.groups ?? []), ...(avoidFrom ? (await getActivityState(avoidFrom)).groups ?? [] : [])]
    await patchActivityState(def.id, { groups: makeGroups(ids, avoid) }, me)
    return { ok: true, message: 'Parejas armadas.' }
  }

  if (op === 'pairs.copy') {
    const from = String(body.from ?? '')
    const groups = (await getActivityState(from)).groups ?? []
    if (!groups.length) return { ok: false, error: 'Esa actividad no tiene parejas.' }
    await patchActivityState(def.id, { groups }, me)
    return { ok: true, message: 'Parejas copiadas.' }
  }

  if (op === 'pairs.clear') {
    await patchActivityState(def.id, { groups: [] }, me)
    return { ok: true, message: 'Parejas borradas.' }
  }

  if (op === 'timer.start') {
    const minutes = Math.min(180, Math.max(0.5, Number(body.minutes) || 0))
    if (!minutes) return { ok: false, error: 'Minutos inválidos.' }
    const endsAt = new Date(Date.now() + minutes * 60_000).toISOString()
    await patchActivityState(def.id, { timer: { endsAt, minutes, label: cleanText(body.label, 80) || def.title } }, me)
    return { ok: true, message: `Cronómetro de ${minutes} minutos.` }
  }

  if (op === 'timer.stop') {
    await patchActivityState(def.id, { timer: null }, me)
    return { ok: true, message: 'Cronómetro detenido.' }
  }

  if (def.kind === 'directorio') {
    const state = await getActivityState(def.id)
    if (op === 'board.setup') {
      const roster = await getRoster()
      const shuffled = shuffle(roster.map((p) => p.id), rng(Date.now()))
      await patchActivityState(def.id, { board: { order: shuffled, roleSeed: Math.floor(Math.random() * 5), current: -1, votingFor: null } }, me)
      return { ok: true, message: 'Directorio armado: orden sorteado y roles repartidos.' }
    }
    const board = state.board
    if (!board) return { ok: false, error: 'Primero armá el directorio.' }
    if (op === 'board.move') {
      const id = String(body.personId ?? '')
      const dir = Number(body.dir) < 0 ? -1 : 1
      const i = board.order.indexOf(id)
      const j = i + dir
      if (i < 0 || j < 0 || j >= board.order.length) return { ok: false, error: 'No se puede mover.' }
      const order = [...board.order]
      ;[order[i], order[j]] = [order[j], order[i]]
      await patchActivityState(def.id, { board: { ...board, order } }, me)
      return { ok: true }
    }
    if (op === 'board.next' || op === 'board.prev' || op === 'board.goto') {
      const target = op === 'board.goto' ? Number(body.index) : board.current + (op === 'board.next' ? 1 : -1)
      const current = Math.max(-1, Math.min(board.order.length, Math.round(target)))
      const presenter = current >= 0 && current < board.order.length ? board.order[current] : null
      const minutes = Math.min(30, Math.max(1, Number(body.minutes) || 4))
      await patchActivityState(def.id, {
        board: { ...board, current, votingFor: presenter },
        timer: presenter ? { endsAt: new Date(Date.now() + minutes * 60_000).toISOString(), minutes, label: 'Presentación' } : null,
      }, me)
      return { ok: true, message: presenter ? 'Siguiente presentación: votación abierta.' : 'Directorio terminado.' }
    }
    if (op === 'board.close') {
      await patchActivityState(def.id, { board: { ...board, votingFor: null }, timer: null }, me)
      return { ok: true, message: 'Votación cerrada.' }
    }
    if (op === 'board.reset') {
      await patchActivityState(def.id, { board: null, timer: null }, me)
      return { ok: true, message: 'Directorio borrado (los votos quedan guardados).' }
    }
  }

  return { ok: false, error: `Operación desconocida: ${op}` }
}
