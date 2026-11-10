// Asignación de revisiones entre pares. Puro y determinístico (misma semilla → mismo resultado).
//
// Reglas:
// 1. Cada entrega recibe N revisores distintos (o todos los posibles si no alcanzan).
// 2. Nadie revisa su propia entrega.
// 3. Carga balanceada: la diferencia entre el que más revisa y el que menos es como mucho 1
//    (salvo que las restricciones lo impidan, y entonces avisa).
// 4. Se evitan los pares recíprocos (A revisa a B y B revisa a A) cuando se puede.
//    Con M autores que revisan N entregas cada uno, es posible sin recíprocos si 2N < M.
//
// Caso típico (los revisores son los mismos autores y no hay asignaciones previas): orden circular
// barajado con la semilla; el autor en la posición i revisa a los que están en i+1 … i+N.
// Cumple las cuatro reglas de forma exacta. Caso general (asignación incremental para entregas
// tardías, o un padrón de revisores distinto): voraz por carga mínima + intercambios que deshacen
// recíprocos sin mover la carga.

export interface AssignSubmission {
  id: string
  authorId: string
}

export interface AssignPair {
  submissionId: string
  reviewerId: string
}

export interface AssignInput {
  submissions: AssignSubmission[]
  /** Quiénes revisan. Por defecto, los autores de las entregas. */
  reviewers?: string[]
  /** Revisores por entrega (N). */
  perSubmission: number
  /** Semilla de la aleatorización (por defecto conviene el id de la entrega). */
  seed: string
  /** Asignaciones que ya existen y se conservan (asignación incremental). */
  existing?: AssignPair[]
}

export interface AssignStats {
  /** Revisiones por revisor, contando las existentes. */
  loads: Record<string, number>
  minLoad: number
  maxLoad: number
  /** Pares recíprocos no ordenados en el total (existentes + nuevas). */
  reciprocalPairs: number
  /** Cota inferior de pares recíprocos inevitables en el caso circular. */
  unavoidableReciprocal: number
}

export interface AssignResult {
  /** Solo las asignaciones nuevas (las que hay que insertar). */
  pairs: AssignPair[]
  /** Existentes + nuevas. */
  all: AssignPair[]
  /** N efectivo (puede ser menor que el pedido si no hay revisores suficientes). */
  perSubmission: number
  warnings: string[]
  stats: AssignStats
}

// ---------- azar con semilla ----------

function hashString(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** mulberry32: PRNG chico y determinístico. */
export function seededRandom(seed: string): () => number {
  let a = hashString(seed) || 1
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Fisher-Yates con semilla. No muta la entrada. */
export function seededShuffle<T>(items: T[], seed: string): T[] {
  const out = [...items]
  const rnd = seededRandom(seed)
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

// ---------- utilidades ----------

const key = (submissionId: string, reviewerId: string) => `${submissionId}\u0000${reviewerId}`

/** Cuenta pares recíprocos (no ordenados) dados los pares y el autor de cada entrega. */
export function countReciprocal(pairs: AssignPair[], authorOf: Map<string, string>): number {
  const edges = new Set<string>()
  for (const p of pairs) {
    const author = authorOf.get(p.submissionId)
    if (author) edges.add(`${p.reviewerId}>${author}`)
  }
  let n = 0
  for (const e of edges) {
    const [a, b] = e.split('>')
    if (a < b && edges.has(`${b}>${a}`)) n++
  }
  return n
}

function computeStats(all: AssignPair[], reviewers: string[], authorOf: Map<string, string>, n: number): AssignStats {
  const loads: Record<string, number> = {}
  for (const r of reviewers) loads[r] = 0
  for (const p of all) loads[p.reviewerId] = (loads[p.reviewerId] ?? 0) + 1
  const values = reviewers.map((r) => loads[r] ?? 0)
  const m = reviewers.length
  const edges = m * n
  const maxFree = (m * (m - 1)) / 2
  return {
    loads,
    minLoad: values.length ? Math.min(...values) : 0,
    maxLoad: values.length ? Math.max(...values) : 0,
    reciprocalPairs: countReciprocal(all, authorOf),
    unavoidableReciprocal: Math.max(0, edges - maxFree),
  }
}

// ---------- algoritmo ----------

export function assignPeerReviews(input: AssignInput): AssignResult {
  const warnings: string[] = []
  const seed = input.seed || 'semilla'
  const requested = Math.max(0, Math.floor(input.perSubmission))

  // Orden canónico (independiente del orden de entrada) antes de barajar.
  const submissions = [...new Map(input.submissions.map((s) => [s.id, s])).values()].sort((a, b) => a.id.localeCompare(b.id))
  const authorOf = new Map(submissions.map((s) => [s.id, s.authorId]))
  const reviewers = [...new Set(input.reviewers ?? submissions.map((s) => s.authorId))].sort()
  const reviewerSet = new Set(reviewers)

  const existing = (input.existing ?? []).filter((p) => authorOf.has(p.submissionId))
  const assigned = new Set(existing.map((p) => key(p.submissionId, p.reviewerId)))

  if (submissions.length === 0 || reviewers.length === 0 || requested === 0) {
    return { pairs: [], all: existing, perSubmission: 0, warnings, stats: computeStats(existing, reviewers, authorOf, 0) }
  }

  // N efectivo: no puede superar a los revisores elegibles (todos menos el autor).
  let n = requested
  const maxEligible = Math.min(...submissions.map((s) => reviewers.filter((r) => r !== s.authorId).length))
  if (n > maxEligible) {
    warnings.push(`Se pidieron ${requested} revisores por entrega pero solo hay ${maxEligible} disponibles: se asignan ${maxEligible}.`)
    n = maxEligible
  }
  if (n === 0) {
    return { pairs: [], all: existing, perSubmission: 0, warnings, stats: computeStats(existing, reviewers, authorOf, 0) }
  }

  const authors = submissions.map((s) => s.authorId)
  const sameSet = authors.length === reviewers.length && new Set(authors).size === authors.length && authors.every((a) => reviewerSet.has(a))

  let pairs: AssignPair[]
  if (existing.length === 0 && sameSet) {
    // Circular: cumple las reglas de forma exacta.
    const order = seededShuffle(submissions, seed)
    const m = order.length
    pairs = []
    for (let j = 0; j < m; j++) {
      for (let k = 1; k <= n; k++) {
        pairs.push({ submissionId: order[j].id, reviewerId: order[(j - k + m) % m].authorId })
      }
    }
    if (2 * n >= m) warnings.push(`Con ${m} entregas y ${n} revisores por entrega no se pueden evitar todos los pares recíprocos.`)
  } else {
    pairs = general(submissions, reviewers, n, seed, existing, assigned, authorOf)
  }

  const all = [...existing, ...pairs]
  const stats = computeStats(all, reviewers, authorOf, n)
  if (stats.maxLoad - stats.minLoad > 1) {
    warnings.push(`La carga quedó despareja (de ${stats.minLoad} a ${stats.maxLoad} revisiones por persona) por las asignaciones previas o el padrón de revisores.`)
  }
  return { pairs, all, perSubmission: n, warnings, stats }
}

/**
 * Caso general: (1) reparte la carga nueva llenando primero a los que menos tienen (cupos),
 * (2) resuelve la asignación como un flujo máximo entregas → revisores con esos cupos,
 * (3) deshace recíprocos con intercambios. Prueba varias semillas derivadas y se queda con la
 * de menos recíprocos (empate: la primera), así sigue siendo determinístico.
 */
function general(
  submissions: AssignSubmission[],
  reviewers: string[],
  n: number,
  seed: string,
  existing: AssignPair[],
  assigned: Set<string>,
  authorOf: Map<string, string>,
): AssignPair[] {
  const need = new Map(submissions.map((s) => [s.id, n]))
  for (const p of existing) need.set(p.submissionId, (need.get(p.submissionId) ?? 0) - 1)
  for (const [k, v] of need) if (v < 0) need.set(k, 0)
  const total = [...need.values()].reduce((a, b) => a + b, 0)
  if (total === 0) return []

  const baseLoad = new Map(reviewers.map((r) => [r, 0]))
  for (const p of existing) if (baseLoad.has(p.reviewerId)) baseLoad.set(p.reviewerId, (baseLoad.get(p.reviewerId) ?? 0) + 1)

  let best: AssignPair[] | null = null
  let bestScore = Infinity
  for (let attempt = 0; attempt < 12; attempt++) {
    const sub = `${seed}:${attempt}`
    const pairs = flowAttempt(submissions, reviewers, need, total, baseLoad, sub, assigned, authorOf, existing)
    if (!pairs) continue
    repairReciprocal(pairs, existing, authorOf, sub)
    const score = countReciprocal([...existing, ...pairs], authorOf)
    if (score < bestScore) {
      best = pairs
      bestScore = score
      if (score === 0) break
    }
  }
  return best ?? []
}

function flowAttempt(
  submissions: AssignSubmission[],
  reviewers: string[],
  need: Map<string, number>,
  total: number,
  baseLoad: Map<string, number>,
  seed: string,
  assigned: Set<string>,
  authorOf: Map<string, string>,
  existing: AssignPair[],
): AssignPair[] | null {
  const order = seededShuffle(reviewers, `${seed}:revisores`)
  const subs = seededShuffle(submissions.filter((s) => (need.get(s.id) ?? 0) > 0), `${seed}:entregas`)
  // relación autor-revisor ya existente, para preferir aristas que no generan recíprocos
  const existingEdges = new Set(existing.map((p) => `${p.reviewerId}>${authorOf.get(p.submissionId)}`))
  const eligible = new Map<string, string[]>()
  for (const s of subs) {
    const list = order.filter((r) => r !== s.authorId && !assigned.has(key(s.id, r)))
    // primero los que no forman recíproco con lo existente
    list.sort((a, b) => Number(existingEdges.has(`${s.authorId}>${a}`)) - Number(existingEdges.has(`${s.authorId}>${b}`)))
    eligible.set(s.id, list)
  }

  // Cupos: llenado por agua sobre la carga existente; si el flujo no alcanza, se agranda el cupo de a uno.
  const cap = new Map(reviewers.map((r) => [r, 0]))
  const level = (r: string) => (baseLoad.get(r) ?? 0) + (cap.get(r) ?? 0)
  const give = (count: number) => {
    for (let i = 0; i < count; i++) {
      let pick = order[0]
      for (const r of order) if (level(r) < level(pick)) pick = r
      cap.set(pick, (cap.get(pick) ?? 0) + 1)
    }
  }
  give(total)

  for (let widen = 0; widen <= reviewers.length * 2; widen++) {
    const { flow, bySub } = maxFlow(subs, need, eligible, cap)
    if (flow === total) {
      const out: AssignPair[] = []
      for (const s of subs) for (const r of bySub.get(s.id) ?? []) out.push({ submissionId: s.id, reviewerId: r })
      return out.length === total ? out : null
    }
    give(1) // no hubo forma con estos cupos: sumamos uno al que menos tiene
  }
  return null
}

/** Flujo máximo con caminos de aumento (DFS). Devuelve entrega → revisores asignados. */
function maxFlow(
  subs: AssignSubmission[],
  need: Map<string, number>,
  eligible: Map<string, string[]>,
  cap: Map<string, number>,
): { flow: number; bySub: Map<string, string[]> } {
  const assignedTo = new Map<string, Set<string>>() // sub → revisores
  const reviewerSubs = new Map<string, Set<string>>() // revisor → subs
  for (const s of subs) assignedTo.set(s.id, new Set())
  let flow = 0

  const tryAugment = (subId: string, visitedSubs: Set<string>, visitedRev: Set<string>): boolean => {
    for (const r of eligible.get(subId) ?? []) {
      if (visitedRev.has(r) || assignedTo.get(subId)!.has(r)) continue
      visitedRev.add(r)
      const current = reviewerSubs.get(r) ?? new Set<string>()
      if (current.size < (cap.get(r) ?? 0)) {
        current.add(subId)
        reviewerSubs.set(r, current)
        assignedTo.get(subId)!.add(r)
        return true
      }
      // r está lleno: intentar mover una de sus entregas a otro revisor
      for (const other of current) {
        if (visitedSubs.has(other)) continue
        visitedSubs.add(other)
        if (tryAugment(other, visitedSubs, visitedRev)) {
          current.delete(other)
          assignedTo.get(other)!.delete(r)
          current.add(subId)
          assignedTo.get(subId)!.add(r)
          return true
        }
      }
    }
    return false
  }

  for (let round = 0; round < Math.max(0, ...subs.map((s) => need.get(s.id) ?? 0)); round++) {
    for (const s of subs) {
      if (assignedTo.get(s.id)!.size >= (need.get(s.id) ?? 0)) continue
      if (tryAugment(s.id, new Set([s.id]), new Set())) flow++
    }
  }
  return { flow, bySub: new Map([...assignedTo].map(([k, v]) => [k, [...v]])) }
}

/**
 * Intercambia revisores entre dos asignaciones nuevas para deshacer recíprocos.
 * No cambia la carga de nadie ni la cantidad de revisores por entrega. Muta `pairs`.
 */
function repairReciprocal(pairs: AssignPair[], existing: AssignPair[], authorOf: Map<string, string>, seed: string) {
  const all = () => [...existing, ...pairs]
  const edgeSet = () => {
    const set = new Set<string>()
    for (const p of all()) set.add(`${p.reviewerId}>${authorOf.get(p.submissionId)}`)
    return set
  }
  const taken = () => new Set(all().map((p) => key(p.submissionId, p.reviewerId)))
  const indices = seededShuffle(pairs.map((_, i) => i), `${seed}:reparar`)

  for (let pass = 0; pass < 4; pass++) {
    let changed = false
    for (const i of indices) {
      const edges = edgeSet()
      const p = pairs[i]
      const a = p.reviewerId
      const b = authorOf.get(p.submissionId)!
      if (!edges.has(`${b}>${a}`)) continue // no es recíproco
      const used = taken()
      for (const j of indices) {
        if (j === i) continue
        const q = pairs[j]
        const c = q.reviewerId
        const d = authorOf.get(q.submissionId)!
        if (c === a) continue
        // a pasa a revisar la entrega de d; c pasa a revisar la de b
        if (a === d || c === b) continue
        if (used.has(key(q.submissionId, a)) || used.has(key(p.submissionId, c))) continue
        if (edges.has(`${d}>${a}`) || edges.has(`${b}>${c}`)) continue // crearía otro recíproco
        if (edges.has(`${a}>${d}`) || edges.has(`${c}>${b}`)) continue // duplicaría la relación autor-revisor
        const before = countReciprocal(all(), authorOf)
        pairs[i] = { submissionId: p.submissionId, reviewerId: c }
        pairs[j] = { submissionId: q.submissionId, reviewerId: a }
        if (countReciprocal(all(), authorOf) < before) {
          changed = true
          break
        }
        pairs[i] = p
        pairs[j] = q
      }
    }
    if (!changed) break
  }
}
