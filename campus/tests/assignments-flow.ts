// Flujo completo de entregas contra la DB real, con datos de prueba que se borran al final.
// Correr: npx tsx tests/assignments-flow.ts [--ai]
//   --ai  además llama a la pre-evaluación con IA (gasta tokens).
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const envFile = resolve(process.cwd(), '.env.local')
if (existsSync(envFile) && !process.env.SUPABASE_SERVICE_ROLE_KEY) process.loadEnvFile(envFile)

async function main() {
  const { serviceDb, COURSE_ID } = await import('../lib/db-node')
  const core = await import('../lib/assignments/core')
  const { gradebookCsv } = await import('../lib/assignments/csv')
  const { countReciprocal } = await import('../lib/assignments/assign')
  const sb = serviceDb()

  const id = `test-entregas-flow-${Date.now().toString(36)}`
  const level = (score: number, label: string) => ({ score, label, description: `${label} (prueba)` })
  const levels = [level(1, 'Inicial'), level(2, 'En desarrollo'), level(3, 'Logrado'), level(4, 'Destacado')]
  const rubric = [
    { id: 'diagnostico', criterion: 'Diagnóstico', weight: 40, levels },
    { id: 'propuesta', criterion: 'Propuesta', weight: 40, levels },
    { id: 'riesgos', criterion: 'Riesgos', weight: 20, levels },
  ]
  const comment = 'Muy claro el diagnóstico de la operación. Mejoraría la propuesta con métricas concretas y un piloto acotado.'
  const step = (s: string) => console.log(`✓ ${s}`)

  const { data: alumnos } = await sb.from('people').select('id, full_name').eq('course_id', COURSE_ID).eq('role', 'alumno').order('full_name').limit(8)
  const { data: profe } = await sb.from('people').select('id').eq('course_id', COURSE_ID).eq('role', 'profesor').limit(1).single()
  assert.ok(alumnos && alumnos.length === 8, 'hacen falta 8 alumnos sembrados')
  assert.ok(profe)
  const [late, ...firsts] = alumnos!

  try {
    // 1. Crear la entrega de prueba
    const due = new Date(Date.now() + 3 * 864e5).toISOString()
    const ins = await sb.from('assignments').insert({
      id, course_id: COURSE_ID, title: 'Entrega de prueba (flujo)', brief_md: '## Consigna\nDiagnosticá el caso ficticio.', rubric, due_at: due, peer_reviews_per_submission: 2, status: 'borrador',
    })
    assert.equal(ins.error, null, ins.error?.message)
    step('entrega de prueba creada en borrador')

    // 2. En borrador no se puede entregar
    await assert.rejects(core.saveSubmission(sb, { assignmentId: id, personId: firsts[0].id, bodyMd: 'hola', url: '' }), /todavía no está abierta/)
    await core.setAssignmentStatus(sb, id, 'abierta')
    step('borrador bloquea; pasa a abierta')

    // 3. Entregas (y validaciones)
    await assert.rejects(core.saveSubmission(sb, { assignmentId: id, personId: firsts[0].id, bodyMd: '  ', url: '' }), /Escribí tu entrega/)
    await assert.rejects(core.saveSubmission(sb, { assignmentId: id, personId: firsts[0].id, bodyMd: 'x', url: 'javascript:alert(1)' }), /URL válida/)
    for (const [i, a] of firsts.entries()) {
      await core.saveSubmission(sb, { assignmentId: id, personId: a.id, bodyMd: `# Entrega ${i}\nDiagnóstico de **Distribuidora Pampa Sur** (ficticio).`, url: i % 2 ? 'docs.google.com/document/d/abc' : '' })
    }
    const edited = await core.saveSubmission(sb, { assignmentId: id, personId: firsts[0].id, bodyMd: '# Entrega 0 editada', url: '' })
    assert.equal(edited.body_md, '# Entrega 0 editada')
    const { data: subs1 } = await sb.from('submissions').select('id, url').eq('assignment_id', id)
    assert.equal(subs1!.length, 7)
    assert.ok(subs1!.some((s) => s.url === 'https://docs.google.com/document/d/abc'))
    // pasado el vencimiento no se puede editar
    await assert.rejects(core.saveSubmission(sb, { assignmentId: id, personId: firsts[1].id, bodyMd: 'tarde', url: '' }, new Date(Date.now() + 5 * 864e5)), /Venció/)
    step('7 entregas guardadas, edición antes del vencimiento, bloqueo después')

    // 4. Asignación entre pares
    const r1 = await core.runPeerAssignment(sb, id, {})
    assert.equal(r1.pairs.length, 14)
    assert.equal(r1.stats.minLoad, 2)
    assert.equal(r1.stats.maxLoad, 2)
    assert.equal(r1.stats.reciprocalPairs, 0)
    let bundle = (await core.loadBundle(sb, id))!
    assert.equal(bundle.assignment.status, 'revision-pares')
    assert.equal(bundle.settings.assignmentSeed, id)
    const authorOf = new Map(bundle.submissions.map((s) => [s.id, s.person_id]))
    for (const r of bundle.reviews) assert.notEqual(authorOf.get(r.submission_id), r.reviewer_id)
    // mismo resultado con la misma semilla: rehacer reproduce lo mismo
    const before = bundle.reviews.map((r) => `${r.submission_id}|${r.reviewer_id}`).sort().join(',')
    const again = await core.runPeerAssignment(sb, id, { mode: 'rehacer' })
    assert.equal(again.removed, 14)
    bundle = (await core.loadBundle(sb, id))!
    assert.equal(bundle.reviews.map((r) => `${r.submission_id}|${r.reviewer_id}`).sort().join(','), before)
    await assert.rejects(core.saveSubmission(sb, { assignmentId: id, personId: firsts[0].id, bodyMd: 'cambio', url: '' }), /ya cerró/)
    step('asignación: 14 revisiones, 2 por alumno, sin recíprocos, determinística; la entrega se congela')

    // 5. Revisiones de pares
    const r0 = bundle.reviews[0]
    await assert.rejects(core.savePeerReview(sb, { reviewId: r0.id, reviewerId: late.id, scores: {}, comment }), /no está asignada a vos/)
    await assert.rejects(core.savePeerReview(sb, { reviewId: r0.id, reviewerId: r0.reviewer_id, scores: { diagnostico: 3 }, comment }), /Falta elegir/)
    await assert.rejects(core.savePeerReview(sb, { reviewId: r0.id, reviewerId: r0.reviewer_id, scores: { diagnostico: 3, propuesta: 3, riesgos: 3 }, comment: 'Bien.' }), /al menos 60/)
    await assert.rejects(core.savePeerReview(sb, { reviewId: r0.id, reviewerId: r0.reviewer_id, scores: { diagnostico: 9, propuesta: 3, riesgos: 3 }, comment }), /no existe/)
    // la entrega de firsts[0] recibe una revisión muy baja (discordante si hay docente)
    const target = bundle.submissions.find((s) => s.person_id === firsts[0].id)!
    for (const r of bundle.reviews) {
      const harsh = r.submission_id === target.id && r === bundle.reviews.find((x) => x.submission_id === target.id)
      const sc = harsh ? { diagnostico: 1, propuesta: 1, riesgos: 1 } : { diagnostico: 4, propuesta: 3, riesgos: 3 }
      await core.savePeerReview(sb, { reviewId: r.id, reviewerId: r.reviewer_id, scores: sc, comment })
    }
    step('validaciones de revisión (ajena, incompleta, comentario corto, nivel inexistente) y 14 revisiones enviadas')

    // 6. Vista del alumno: ve sus revisiones recibidas porque terminó las suyas
    const v = (await core.loadStudentView(sb, id, firsts[0].id))!
    assert.equal(v.toReview.length, 2)
    assert.ok(v.toReview.every((t) => t.label.startsWith('Entrega ')))
    assert.ok(v.allMyReviewsSent)
    assert.equal(v.received.length, 2)
    assert.ok(v.received.every((x) => x.label.startsWith('Par ')))
    assert.equal(v.grade?.finalSource, 'pares')
    step(`vista alumno: 2 por revisar (anónimas), 2 recibidas, nota ${v.grade?.final}%`)

    // 7. Entrega tardía + asignación incremental
    await sb.from('submissions').insert({ assignment_id: id, person_id: late.id, body_md: 'Entrega tardía aceptada por el profesor.' })
    const r2 = await core.runPeerAssignment(sb, id, { mode: 'incremental' })
    assert.equal(r2.pairs.length, 2)
    const lateSub = (await sb.from('submissions').select('id').eq('assignment_id', id).eq('person_id', late.id).single()).data!
    assert.ok(r2.pairs.every((p) => p.submissionId === lateSub.id && p.reviewerId !== late.id))
    // el tardío no tiene a quién revisar (todas completas): queda con 0 y el profe lo ve en la tabla
    bundle = (await core.loadBundle(sb, id))!
    const vLate = (await core.loadStudentView(sb, id, late.id))!
    assert.equal(vLate.received.length, 0)
    assert.equal(vLate.receivedHiddenReason, null) // las dos asignadas están pendientes, no hay nada que ocultar
    step('entrega tardía: asignación incremental suma 2 revisores sin tocar lo anterior')

    // 8. Revisión docente + nota final + discordancia
    await core.saveTeacherReview(sb, { submissionId: target.id, teacherId: profe!.id, scores: { diagnostico: 4, propuesta: 4, riesgos: 3 }, comment: 'Buen trabajo, revisá el plan de riesgos.' })
    bundle = (await core.loadBundle(sb, id))!
    let book = core.buildGradebook(bundle)
    const rowT = book.find((r) => r.student.id === firsts[0].id)!
    assert.equal(rowT.grade?.finalSource, 'docente')
    assert.equal(rowT.grade?.final, 95)
    assert.ok(rowT.grade?.discordant, 'la revisión 1/1/1 contra un docente 4/4/3 tiene que ser discordante')
    assert.equal(rowT.grade?.peerScores.filter((s) => s.discordant).length, 1)
    const reciprocal = countReciprocal(bundle.reviews.filter((r) => !r.is_teacher).map((r) => ({ submissionId: r.submission_id, reviewerId: r.reviewer_id })), new Map(bundle.submissions.map((s) => [s.id, s.person_id])))
    assert.equal(reciprocal, 0)
    step(`revisión docente: nota final ${rowT.grade?.final}% (docente), discordancia detectada`)

    // 9. Criterio configurable
    await core.saveSettings(sb, id, { gradeMode: 'mixta', teacherWeight: 0.5, discordThreshold: 30 })
    bundle = (await core.loadBundle(sb, id))!
    book = core.buildGradebook(bundle)
    const rowM = book.find((r) => r.student.id === firsts[0].id)!
    assert.equal(rowM.grade?.finalSource, 'mixta')
    assert.ok(rowM.grade!.final! < 95)
    await assert.rejects(core.saveSettings(sb, id, { discordThreshold: 0 }), /umbral/)
    step(`criterio mixto: ${rowM.grade?.final}%`)

    // 10. CSV
    const csv = gradebookCsv(bundle, book)
    assert.ok(csv.startsWith('\uFEFF'), 'el CSV lleva BOM para Excel')
    const lines = csv.slice(1).trim().split('\r\n')
    assert.ok(lines[0].startsWith('alumno;empresa;entregó'))
    assert.equal(lines.length, 1 + book.length)
    assert.ok(lines.some((l) => l.startsWith(firsts[0].full_name) && l.includes(';sí;')))
    step(`CSV: ${lines.length - 1} filas`)

    // 11. Cierre: todos ven todo y no se puede revisar más
    await core.setAssignmentStatus(sb, id, 'cerrada')
    await assert.rejects(core.savePeerReview(sb, { reviewId: r0.id, reviewerId: r0.reviewer_id, scores: { diagnostico: 3, propuesta: 3, riesgos: 3 }, comment }), /ya cerró/)
    await assert.rejects(core.runPeerAssignment(sb, id, {}), /cerrada/)
    const vClosed = (await core.loadStudentView(sb, id, late.id))!
    assert.equal(vClosed.received.length, 0) // las del tardío nunca se enviaron
    step('cerrada: bloquea revisiones y reasignación')

    // 12. Pre-evaluación con IA (opcional)
    if (process.argv.includes('--ai')) {
      const Anthropic = (await import('@anthropic-ai/sdk')).default
      const { aiPreEvaluate } = await import('../lib/assignments/ai')
      const t0 = Date.now()
      const preview = await aiPreEvaluate(new Anthropic(), bundle.assignment, {
        body_md: [
          '## Diagnóstico',
          'Distribuidora Pampa Sur (ficticia) pierde 4 puntos de margen por quiebres de stock en el canal mayorista.',
          'El cuello de botella es la reposición manual: 3 analistas arman pedidos con planillas.',
          '## Propuesta',
          'Un agente que propone pedidos diarios y un humano aprueba. Piloto en 2 depósitos por 8 semanas; métrica: quiebres y días de stock.',
          '## Riesgos',
          'Datos sucios del ERP.',
        ].join('\n'),
        url: null,
      })
      assert.equal(preview.suggestions.length, 3)
      for (const s of preview.suggestions) assert.ok([1, 2, 3, 4].includes(s.score))
      const { count } = await sb.from('peer_reviews').select('*', { count: 'exact', head: true }).in('submission_id', bundle.submissions.map((s) => s.id)).eq('is_teacher', true)
      assert.equal(count, 1, 'la IA no tiene que guardar nada')
      step(`IA (${preview.model}, ${((Date.now() - t0) / 1000).toFixed(1)} s): ${preview.suggestions.map((s) => `${s.criterionId}=${s.score}`).join(', ')}`)
      console.log(`  «${preview.suggestions[2].justification}»`)
    }
  } finally {
    // Limpieza: borrar la entrega arrastra submissions, peer_reviews y assignment_settings (on delete cascade).
    await sb.from('assignments').delete().eq('id', id)
    const left = await Promise.all([
      sb.from('assignments').select('*', { count: 'exact', head: true }).like('id', 'test-entregas-flow-%'),
      sb.from('submissions').select('*', { count: 'exact', head: true }).eq('assignment_id', id),
      sb.from('assignment_settings').select('*', { count: 'exact', head: true }).eq('assignment_id', id),
    ])
    console.log(`limpieza: assignments de prueba ${left[0].count}, submissions ${left[1].count}, settings ${left[2].count}`)
  }
}

main().then(() => console.log('flujo OK'), (e) => {
  console.error(e)
  process.exit(1)
})
