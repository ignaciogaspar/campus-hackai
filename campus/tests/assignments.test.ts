// Tests del algoritmo de asignación entre pares y del cálculo de notas.
// Correr: npx tsx --test tests/assignments.test.ts
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { assignPeerReviews, countReciprocal, seededShuffle, type AssignPair, type AssignSubmission } from '../lib/assignments/assign'
import { gradeSubmission, validateScores, weightedPct } from '../lib/assignments/scoring'
import type { ReviewRow, Rubric } from '../lib/assignments/types'

function subs(m: number, prefix = 's'): AssignSubmission[] {
  return Array.from({ length: m }, (_, i) => ({ id: `${prefix}${String(i).padStart(2, '0')}`, authorId: `p${String(i).padStart(2, '0')}` }))
}

function checkInvariants(submissions: AssignSubmission[], all: AssignPair[], n: number) {
  const authorOf = new Map(submissions.map((s) => [s.id, s.authorId]))
  const seen = new Set<string>()
  const per = new Map<string, number>()
  for (const p of all) {
    const k = `${p.submissionId}|${p.reviewerId}`
    assert.ok(!seen.has(k), `duplicado ${k}`)
    seen.add(k)
    assert.notEqual(authorOf.get(p.submissionId), p.reviewerId, 'alguien se revisa a sí mismo')
    per.set(p.submissionId, (per.get(p.submissionId) ?? 0) + 1)
  }
  for (const s of submissions) assert.equal(per.get(s.id) ?? 0, n, `la entrega ${s.id} tiene ${per.get(s.id) ?? 0} revisores, se esperaban ${n}`)
}

describe('assignPeerReviews: caso circular', () => {
  it('20 alumnos, 2 revisores: N distintos, sin autorrevisión, carga pareja y sin recíprocos', () => {
    const s = subs(20)
    const r = assignPeerReviews({ submissions: s, perSubmission: 2, seed: 'aicm-j3-entrega' })
    assert.equal(r.pairs.length, 40)
    checkInvariants(s, r.all, 2)
    assert.equal(r.stats.minLoad, 2)
    assert.equal(r.stats.maxLoad, 2)
    assert.equal(r.stats.reciprocalPairs, 0)
    assert.deepEqual(r.warnings, [])
  })

  it('es determinístico con la misma semilla e independiente del orden de entrada', () => {
    const s = subs(15)
    const a = assignPeerReviews({ submissions: s, perSubmission: 3, seed: 'x' })
    const b = assignPeerReviews({ submissions: [...s].reverse(), perSubmission: 3, seed: 'x' })
    const sort = (ps: AssignPair[]) => ps.map((p) => `${p.submissionId}|${p.reviewerId}`).sort()
    assert.deepEqual(sort(a.pairs), sort(b.pairs))
  })

  it('otra semilla da otra asignación', () => {
    const s = subs(15)
    const sort = (ps: AssignPair[]) => ps.map((p) => `${p.submissionId}|${p.reviewerId}`).sort().join(',')
    const a = assignPeerReviews({ submissions: s, perSubmission: 2, seed: 'uno' })
    const b = assignPeerReviews({ submissions: s, perSubmission: 2, seed: 'dos' })
    assert.notEqual(sort(a.pairs), sort(b.pairs))
  })

  it('para todo M de 2 a 30 y N de 1 a 4: invariantes, carga exacta y recíprocos mínimos', () => {
    for (let m = 2; m <= 30; m++) {
      for (let n = 1; n <= 4; n++) {
        const s = subs(m)
        const r = assignPeerReviews({ submissions: s, perSubmission: n, seed: `m${m}n${n}` })
        const eff = Math.min(n, m - 1)
        assert.equal(r.perSubmission, eff)
        checkInvariants(s, r.all, eff)
        assert.equal(r.stats.minLoad, eff, `m=${m} n=${n}`)
        assert.equal(r.stats.maxLoad, eff, `m=${m} n=${n}`)
        if (2 * eff < m) assert.equal(r.stats.reciprocalPairs, 0, `m=${m} n=${n} tiene recíprocos evitables`)
        else assert.equal(r.stats.reciprocalPairs, r.stats.unavoidableReciprocal, `m=${m} n=${n} tiene más recíprocos que los inevitables`)
      }
    }
  })

  it('si piden más revisores que los posibles, recorta y avisa', () => {
    const s = subs(3)
    const r = assignPeerReviews({ submissions: s, perSubmission: 5, seed: 'x' })
    assert.equal(r.perSubmission, 2)
    checkInvariants(s, r.all, 2)
    assert.ok(r.warnings.some((w) => w.includes('solo hay 2')))
  })

  it('casos vacíos no rompen', () => {
    assert.equal(assignPeerReviews({ submissions: [], perSubmission: 2, seed: 'x' }).pairs.length, 0)
    assert.equal(assignPeerReviews({ submissions: subs(1), perSubmission: 2, seed: 'x' }).pairs.length, 0)
    assert.equal(assignPeerReviews({ submissions: subs(4), perSubmission: 0, seed: 'x' }).pairs.length, 0)
  })
})

describe('assignPeerReviews: caso general', () => {
  it('incremental: conserva lo asignado y suma a los que entregaron tarde', () => {
    const first = subs(12)
    const r1 = assignPeerReviews({ submissions: first, perSubmission: 2, seed: 'tarde' })
    const late = [...first, { id: 's90', authorId: 'p90' }, { id: 's91', authorId: 'p91' }, { id: 's92', authorId: 'p92' }]
    const r2 = assignPeerReviews({ submissions: late, perSubmission: 2, seed: 'tarde', existing: r1.all })
    // no toca lo existente
    for (const p of r1.all) assert.ok(r2.all.some((q) => q.submissionId === p.submissionId && q.reviewerId === p.reviewerId))
    assert.equal(r2.pairs.length, 6)
    checkInvariants(late, r2.all, 2)
    // los tardíos (carga 0) absorben primero: nadie queda con más de 1 de diferencia
    assert.ok(r2.stats.maxLoad - r2.stats.minLoad <= 1, `carga ${r2.stats.minLoad}..${r2.stats.maxLoad}`)
    // Con carga pareja, los 3 tardíos solo pueden revisarse entre ellos (2 cada uno): los 3 recíprocos
    // son inevitables. Ninguno puede involucrar a los que ya estaban.
    const authorOf = new Map(late.map((x) => [x.id, x.authorId]))
    const lateAuthors = new Set(['p90', 'p91', 'p92'])
    assert.ok(r2.pairs.every((p) => lateAuthors.has(p.reviewerId) && lateAuthors.has(authorOf.get(p.submissionId)!)))
    assert.ok(r2.stats.reciprocalPairs <= 3)
  })

  it('incremental con N=1: los tardíos se revisan en ciclo, sin recíprocos', () => {
    const first = subs(12)
    const r1 = assignPeerReviews({ submissions: first, perSubmission: 1, seed: 'tarde1' })
    const late = [...first, ...['90', '91', '92', '93'].map((k) => ({ id: `s${k}`, authorId: `p${k}` }))]
    const r2 = assignPeerReviews({ submissions: late, perSubmission: 1, seed: 'tarde1', existing: r1.all })
    checkInvariants(late, r2.all, 1)
    assert.equal(r2.stats.maxLoad - r2.stats.minLoad, 0)
    assert.equal(r2.stats.reciprocalPairs, 0)
  })

  it('incremental sin cambios no agrega nada', () => {
    const s = subs(8)
    const r1 = assignPeerReviews({ submissions: s, perSubmission: 2, seed: 'z' })
    const r2 = assignPeerReviews({ submissions: s, perSubmission: 2, seed: 'z', existing: r1.all })
    assert.equal(r2.pairs.length, 0)
  })

  it('subir N de 2 a 3 completa sin duplicar', () => {
    const s = subs(10)
    const r1 = assignPeerReviews({ submissions: s, perSubmission: 2, seed: 'n' })
    const r2 = assignPeerReviews({ submissions: s, perSubmission: 3, seed: 'n', existing: r1.all })
    assert.equal(r2.pairs.length, 10)
    checkInvariants(s, r2.all, 3)
    assert.equal(r2.stats.maxLoad - r2.stats.minLoad, 0)
    assert.equal(r2.stats.reciprocalPairs, 0)
  })

  it('padrón de revisores distinto de los autores (un revisor extra que no entregó)', () => {
    const s = subs(9)
    const reviewers = [...s.map((x) => x.authorId), 'ayudante']
    const r = assignPeerReviews({ submissions: s, reviewers, perSubmission: 2, seed: 'extra' })
    checkInvariants(s, r.all, 2)
    assert.ok(r.stats.maxLoad - r.stats.minLoad <= 1)
    assert.ok((r.stats.loads.ayudante ?? 0) >= 1)
    assert.equal(r.stats.reciprocalPairs, 0)
  })

  it('el caso general también es determinístico', () => {
    const s = subs(11)
    const base = assignPeerReviews({ submissions: s.slice(0, 8), perSubmission: 2, seed: 'g' })
    const a = assignPeerReviews({ submissions: s, perSubmission: 2, seed: 'g', existing: base.all })
    const b = assignPeerReviews({ submissions: [...s].reverse(), perSubmission: 2, seed: 'g', existing: [...base.all].reverse() })
    const sort = (ps: AssignPair[]) => ps.map((p) => `${p.submissionId}|${p.reviewerId}`).sort()
    assert.deepEqual(sort(a.pairs), sort(b.pairs))
  })

  it('stress: entregas tardías para M de 4 a 25, N de 1 a 3: invariantes siempre', () => {
    for (let m = 4; m <= 25; m++) {
      for (let n = 1; n <= 3; n++) {
        const all = subs(m)
        const k = Math.max(2, Math.floor(m * 0.6))
        const r1 = assignPeerReviews({ submissions: all.slice(0, k), perSubmission: n, seed: `st${m}${n}` })
        const r2 = assignPeerReviews({ submissions: all, perSubmission: n, seed: `st${m}${n}`, existing: r1.all })
        checkInvariants(all, r2.all, r2.perSubmission)
        assert.ok(r2.stats.maxLoad - r2.stats.minLoad <= n, `m=${m} n=${n} carga ${r2.stats.minLoad}..${r2.stats.maxLoad}`)
      }
    }
  })

  it('countReciprocal cuenta pares no ordenados', () => {
    const authorOf = new Map([['sa', 'a'], ['sb', 'b'], ['sc', 'c']])
    assert.equal(countReciprocal([{ submissionId: 'sa', reviewerId: 'b' }, { submissionId: 'sb', reviewerId: 'a' }, { submissionId: 'sc', reviewerId: 'a' }], authorOf), 1)
  })

  it('seededShuffle no pierde elementos', () => {
    const xs = Array.from({ length: 50 }, (_, i) => i)
    assert.deepEqual([...seededShuffle(xs, 'q')].sort((a, b) => a - b), xs)
  })
})

// ---------- notas ----------

const rubric: Rubric = [
  { id: 'diag', criterion: 'Diagnóstico', weight: 50, levels: [1, 2, 3, 4].map((score) => ({ score, label: `N${score}`, description: '' })) },
  { id: 'plan', criterion: 'Plan', weight: 30, levels: [1, 2, 3, 4].map((score) => ({ score, label: `N${score}`, description: '' })) },
  { id: 'riesgo', criterion: 'Riesgos', weight: 20, levels: [1, 2, 3, 4].map((score) => ({ score, label: `N${score}`, description: '' })) },
]

function review(id: string, scores: Record<string, number>, isTeacher = false, status: 'asignada' | 'enviada' = 'enviada'): ReviewRow {
  return { id, submission_id: 'sub', reviewer_id: `r-${id}`, scores, comment: 'x', status, is_teacher: isTeacher, created_at: '', submitted_at: '' }
}

describe('notas', () => {
  it('weightedPct pondera por peso y normaliza por el máximo del criterio', () => {
    assert.equal(weightedPct(rubric, { diag: 4, plan: 4, riesgo: 4 }), 100)
    assert.equal(weightedPct(rubric, { diag: 2, plan: 4, riesgo: 4 }), 75) // 50×0,5 + 30 + 20
    assert.equal(weightedPct(rubric, {}), null)
  })

  it('validateScores exige un nivel válido por criterio', () => {
    assert.equal(validateScores(rubric, { diag: 4, plan: 3, riesgo: 2 }).length, 0)
    assert.equal(validateScores(rubric, { diag: 4, plan: 7 }).length, 2)
  })

  it('docente-o-pares: usa la del docente si existe; si no, media de pares', () => {
    const peers = [review('a', { diag: 4, plan: 4, riesgo: 4 }), review('b', { diag: 2, plan: 4, riesgo: 4 })]
    const settings = { gradeMode: 'docente-o-pares' as const, teacherWeight: 0.5, discordThreshold: 20 }
    const g1 = gradeSubmission('sub', rubric, peers, settings)
    assert.equal(g1.final, 87.5)
    assert.equal(g1.finalSource, 'pares')
    const g2 = gradeSubmission('sub', rubric, [...peers, review('t', { diag: 3, plan: 3, riesgo: 3 }, true)], settings)
    assert.equal(g2.final, 75)
    assert.equal(g2.finalSource, 'docente')
  })

  it('mixta pondera docente y pares; las asignadas sin enviar no cuentan', () => {
    const rs = [review('a', { diag: 4, plan: 4, riesgo: 4 }), review('t', { diag: 2, plan: 2, riesgo: 2 }, true), review('c', {}, false, 'asignada')]
    const g = gradeSubmission('sub', rubric, rs, { gradeMode: 'mixta', teacherWeight: 0.25, discordThreshold: 20 })
    assert.equal(g.final, 87.5) // 0,25×50 + 0,75×100
    assert.equal(g.peerScores.length, 1)
  })

  it('detecta revisiones discordantes contra los demás pares y contra el docente', () => {
    const settings = { gradeMode: 'media-pares' as const, teacherWeight: 0.5, discordThreshold: 20 }
    const ok = gradeSubmission('sub', rubric, [review('a', { diag: 3, plan: 3, riesgo: 3 }), review('b', { diag: 3, plan: 4, riesgo: 3 })], settings)
    assert.equal(ok.discordant, false)
    const two = gradeSubmission('sub', rubric, [review('a', { diag: 4, plan: 4, riesgo: 4 }), review('b', { diag: 1, plan: 1, riesgo: 1 })], settings)
    assert.equal(two.discordant, true) // con dos pares, marca por rango
    assert.equal(two.peerScores.some((s) => s.discordant), false)
    const bad = gradeSubmission('sub', rubric, [review('a', { diag: 4, plan: 4, riesgo: 4 }), review('b', { diag: 4, plan: 4, riesgo: 4 }), review('c', { diag: 1, plan: 1, riesgo: 1 })], settings)
    assert.equal(bad.discordant, true)
    assert.deepEqual(bad.peerScores.filter((s) => s.discordant).map((s) => s.reviewId), ['c'])
    const vsTeacher = gradeSubmission('sub', rubric, [review('a', { diag: 4, plan: 4, riesgo: 4 }), review('t', { diag: 2, plan: 2, riesgo: 2 }, true)], settings)
    assert.equal(vsTeacher.peerScores[0].discordant, true)
    assert.equal(vsTeacher.peerScores[0].deviation, 50)
  })
})
