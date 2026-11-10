/* Prueba real del agente de autoría (claude-opus-5-5) y del repositorio.
   Uso: npx tsx lib/authoring/scripts/agent-smoke.ts [deckId] [slideNumber]

   1. Copia el deck (default aicm-j1) a un deck temporal con las MISMAS slides.
   2. Corre dos instrucciones contra el agente y valida el DSL de cada propuesta.
   3. Aplica las propuestas en el deck temporal (insert -> slides nuevas;
      edit/notes -> modo 'copy' para no tocar las slides originales).
   4. Prueba mover, duplicar, quitar y la búsqueda.
   5. Borra el deck temporal y las slides que creó. */

import '../../../scripts/seed/env'
import Anthropic from '@anthropic-ai/sdk'
import { serviceDb } from '@/lib/db-node'
import { personId } from '@/lib/ids'
import { runAuthoringAgent } from '../agent'
import type { AgentTurn } from '../agent'
import { searchLibrary } from '../library'
import { applyProposal } from '../proposals'
import { checkDraft, createDeck, deckOrder, duplicateAt, loadEditorSlides, moveSlide, removeFromDeck, setDeckOrder } from '../repo'

const SRC = process.argv[2] ?? 'aicm-j1'
const SLIDE_NUMBER = Number(process.argv[3] ?? 6)

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`FALLÓ: ${msg}`)
  console.log(`  ok · ${msg}`)
}

async function main() {
  const sb = serviceDb()
  const anthropic = new Anthropic()
  const profesor = personId('ignacio-berdinas')
  const original = await deckOrder(sb, SRC)
  assert(original.length > 0, `deck ${SRC} tiene ${original.length} slides`)

  const tmp = await createDeck(sb, { id: `tmp-autoria-${Date.now().toString(36)}`, title: `Prueba autoría (${SRC})`, slideIds: original })
  const created: string[] = []
  try {
    console.log(`\nDeck temporal: ${tmp}`)

    // --- búsqueda ---
    const page = await searchLibrary(sb, { q: 'costo del error', limit: 5 })
    assert(page.total > 0, `búsqueda «costo del error» devuelve ${page.total} slides`)

    // --- agente: dos instrucciones ---
    const history: AgentTurn[] = []
    const instructions = [
      'Tomá esta slide de ejemplo y dale continuación con dos slides más.',
      'Hacé una encuesta sobre esto para abrir la discusión, justo antes de esta slide.',
    ]
    for (const instruction of instructions) {
      console.log(`\n» ${instruction}`)
      const t0 = Date.now()
      const res = await runAuthoringAgent({
        sb, anthropic, deckId: tmp, instruction, selectedPosition: SLIDE_NUMBER - 1, history,
        onStep: (s) => console.log(`   · ${s.ok ? '' : '[x] '}${s.label}`),
      })
      console.log(`   respuesta (${((Date.now() - t0) / 1000).toFixed(1)}s, ${res.usage.iterations} vueltas, in ${res.usage.inputTokens} / cache ${res.usage.cacheReadTokens} / out ${res.usage.outputTokens}): ${res.reply}`)
      history.push({ role: 'user', text: instruction }, { role: 'assistant', text: res.reply })
      assert(res.proposals.length > 0, `hay ${res.proposals.length} propuesta(s)`)
      for (const p of res.proposals) {
        const mds = p.action === 'insert' ? p.slides.map((s) => s.markdown) : p.action === 'edit' ? [p.markdown] : []
        for (const md of mds) {
          const c = checkDraft(md)
          console.log(`\n   --- ${p.action} · ${c.kind} · ${c.title}\n${md.split('\n').map((l) => `   | ${l}`).join('\n')}`)
          assert(c.issues.length === 0, `DSL válido (${c.kind}) ${c.issues.join('; ')}`)
        }
        if (p.action === 'insert') {
          for (const s of p.slides) assert(Boolean(s.teacherNotes), `la slide «${s.title}» trae notas del docente`)
        }
        const r = await applyProposal(sb, tmp, p, { personId: profesor, mode: 'copy' })
        created.push(...r.slideIds.filter((id) => !original.includes(id)))
        console.log(`   aplicada ${p.id} en posición ${r.position + 1}`)
      }
      if (instruction.includes('encuesta')) {
        const ins = res.proposals.filter((p) => p.action === 'insert')
        assert(ins.some((p) => p.action === 'insert' && p.slides.some((s) => s.kind === 'encuesta')), 'propuso una :::encuesta')
      }
    }

    // --- operaciones de estructura ---
    const before = await deckOrder(sb, tmp)
    assert(before.length > original.length, `el deck temporal creció de ${original.length} a ${before.length}`)
    await moveSlide(sb, tmp, 0, 2, before[0])
    let now = await deckOrder(sb, tmp)
    assert(now[2] === before[0] && now.length === before.length, 'mover slide 1 → 3')
    const dup = await duplicateAt(sb, tmp, 2, profesor, now[2])
    created.push(dup)
    now = await deckOrder(sb, tmp)
    assert(now[3] === dup && now.length === before.length + 1, 'duplicar crea una copia nueva después')
    await removeFromDeck(sb, tmp, 3, dup)
    now = await deckOrder(sb, tmp)
    assert(!now.includes(dup), 'quitar del deck')
    const { data: still } = await sb.from('slides').select('id').eq('id', dup).maybeSingle()
    assert(Boolean(still), 'la slide quitada sigue en el repositorio')
    const editor = await loadEditorSlides(sb, tmp)
    assert(editor.every((s, i) => s.position === i), 'posiciones contiguas 0..n-1')
    const orig = await deckOrder(sb, SRC)
    assert(JSON.stringify(orig) === JSON.stringify(original), `el deck original ${SRC} quedó intacto`)
  } finally {
    await setDeckOrder(sb, tmp, [])
    await sb.from('decks').delete().eq('id', tmp)
    if (created.length) {
      const { count } = await sb.from('deck_slides').select('slide_id', { count: 'exact', head: true }).in('slide_id', created)
      if (!count) await sb.from('slides').delete().in('id', created)
    }
    console.log(`\nLimpieza: deck ${tmp} y ${created.length} slide(s) de prueba borrados.`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
