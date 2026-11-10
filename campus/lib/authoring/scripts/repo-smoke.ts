/* Prueba del repositorio sin LLM: guardar (version+1 y revisiones), conflicto
   de versión, copia para un deck (fork) y restaurar. Trabaja sobre slides y
   decks temporales que borra al final.
   Uso: npx tsx lib/authoring/scripts/repo-smoke.ts */

import '../../../scripts/seed/env'
import { serviceDb } from '@/lib/db-node'
import { personId } from '@/lib/ids'
import { searchLibrary } from '../library'
import { AuthoringError, createDeck, createSlides, deckOrder, forkInDeck, listRevisions, loadEditorSlides, saveSlide, setDeckOrder } from '../repo'

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`FALLÓ: ${msg}`)
  console.log(`  ok · ${msg}`)
}

async function main() {
  const sb = serviceDb()
  const prof = personId('ignacio-berdinas')
  const tag = `tmp-${Date.now().toString(36)}`
  const [a, b] = await createSlides(sb, {
    drafts: [
      { markdown: `:::big\n# Slide compartida ${tag}\nTexto original.`, teacherNotes: 'nota 1', tags: [tag] },
      { markdown: `# Otra ${tag}\nTexto.`, tags: [tag] },
    ],
    authorId: prof, via: 'editor', origin: { test: true },
  })
  const d1 = await createDeck(sb, { id: `${tag}-a`, title: 'tmp A', slideIds: [a, b] })
  const d2 = await createDeck(sb, { id: `${tag}-b`, title: 'tmp B', slideIds: [b, a] })
  const created = [a, b]
  try {
    let ed = await loadEditorSlides(sb, d1)
    assert(ed[0].usedIn.length === 2, 'la slide compartida figura en 2 decks')

    const s1 = await saveSlide(sb, { slideId: a, markdown: `:::big\n# Slide compartida ${tag}\nTexto editado.`, teacherNotes: 'nota 2', editorId: prof, via: 'editor', expectedVersion: 1 })
    assert(s1.version === 2 && s1.kind === 'big', 'guardar sube la versión a 2')
    let revs = await listRevisions(sb, a)
    assert(revs.length === 2 && revs[0].markdown.includes('editado') && revs[1].markdown.includes('original'), 'hay 2 revisiones (creación + edición)')

    try {
      await saveSlide(sb, { slideId: a, markdown: 'x', editorId: prof, via: 'editor', expectedVersion: 1 })
      assert(false, 'debió fallar por conflicto')
    } catch (e) {
      assert(e instanceof AuthoringError && e.code === 'conflict', 'guardar con versión vieja da conflicto')
    }

    const fork = await forkInDeck(sb, { deckId: d2, position: 1, slideId: a, markdown: `:::big\n# Solo en B ${tag}\nTexto.`, editorId: prof, via: 'editor' })
    created.push(fork)
    const o1 = await deckOrder(sb, d1)
    const o2 = await deckOrder(sb, d2)
    assert(o1[0] === a && o2[1] === fork, 'la copia reemplaza solo en el deck B')
    ed = await loadEditorSlides(sb, d1)
    assert(ed[0].usedIn.length === 1, 'la original ya no se comparte')

    const old = revs[1]
    const s2 = await saveSlide(sb, { slideId: a, markdown: old.markdown, teacherNotes: old.teacherNotes, editorId: prof, via: 'editor', expectedVersion: 2 })
    assert(s2.version === 3 && s2.markdown.includes('original'), 'restaurar una revisión crea la versión 3')
    revs = await listRevisions(sb, a)
    assert(revs.length === 3, '3 revisiones')

    const page = await searchLibrary(sb, { q: tag })
    assert(page.total === 3, `la búsqueda por tag encuentra las 3 slides de prueba (${page.total})`)
    const byDeck = await searchLibrary(sb, { deckId: d2, q: tag })
    assert(byDeck.total >= 2, 'filtro por deck')
    const byKind = await searchLibrary(sb, { kind: 'big', tag })
    assert(byKind.total === 2, 'filtro por tipo + tag')
  } finally {
    for (const d of [d1, d2]) { await setDeckOrder(sb, d, []); await sb.from('decks').delete().eq('id', d) }
    await sb.from('slides').delete().in('id', created)
    console.log('Limpieza hecha.')
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
