// Evals del bot de stock de J8: 5 casos con la respuesta esperada y una
// regla de corrección. Corre cada caso contra el agente real y da el %.
//   npx tsx scripts/demo/j8-evals.ts [--json public/decks/aicm/media/j8/evals-result.json]
import { writeFileSync } from 'node:fs'
import { runAgent } from './j8-stock-agent'

const CASES: { id: number; pregunta: string; esperado: string; pasa: (t: string) => boolean }[] = [
  { id: 1, pregunta: '¿Tienen 20 bombas de 1 HP para el jueves?', esperado: 'Sí: 21 entre Pilar y Rosario', pasa: (t) => /\b21\b/.test(t) },
  { id: 2, pregunta: '¿Cuánto sale la presurizadora de 24 litros?', esperado: 'US$160', pasa: (t) => /\b160\b/.test(t) },
  { id: 3, pregunta: 'Necesito una sumergible de 1 HP ya', esperado: 'Sin stock; repone el 12/12', pasa: (t) => /12\/12|12 de diciembre/i.test(t) },
  { id: 4, pregunta: '¿Tienen bombas de 5 HP?', esperado: 'No está en el catálogo; no inventa precio', pasa: (t) => !/(US\$|USD|\$)\s?\d/.test(t) && /\bno\b/i.test(t) },
  { id: 5, pregunta: 'Pasame 10 centrífugas de 2 HP', esperado: 'Solo hay 4 en Pilar', pasa: (t) => /\b4\b|cuatro/i.test(t) },
]

async function main() {
  const i = process.argv.indexOf('--json')
  const out = i >= 0 ? process.argv[i + 1] : undefined
  const rows = []
  for (const c of CASES) {
    const r = await runAgent(c.pregunta, true)
    const ok = c.pasa(r.text)
    rows.push({ id: c.id, pregunta: c.pregunta, esperado: c.esperado, respuesta: r.text, pasa: ok, usd: r.usd })
    console.log(`${ok ? 'PASA ' : 'FALLA'} #${c.id} ${c.pregunta}\n      → ${r.text.replace(/\s+/g, ' ').slice(0, 160)}`)
  }
  const n = rows.filter((r) => r.pasa).length
  console.log(`\n${n}/${rows.length} = ${Math.round((n / rows.length) * 100)}%`)
  if (out) writeFileSync(out, JSON.stringify({ fecha: new Date().toISOString().slice(0, 10), pasan: n, total: rows.length, rows }, null, 2) + '\n')
}

main().catch((e) => { console.error(e); process.exit(1) })
