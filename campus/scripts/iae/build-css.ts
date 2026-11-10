// Arma el CSS empaquetado de las slides 'iae' (lib/iae/css.generated.ts).
//
// Orden (el mismo que el <head> del deck de Empresas Familiares):
//   1. lib/iae/styles/deck.css        deck.css de Ignacio (Building Products / EF)
//   2. lib/iae/styles/ref-inline.css  el <style> inline de ref_index.html (igual al de EF)
//   3. lib/iae/styles/extra.css       build/extra.css de EF
//   4. lib/iae/styles/campus.css      ajustes de Shadow DOM + layouts nuevos + piel interactiva
//
// Transformaciones para Shadow DOM: `:root` → `:host`, y las reglas de `html, body` / `body`
// pasan a `:host` (las variables y la tipografía base viven en el host de la sombra).
//
// Uso:
//   npx tsx scripts/iae/build-css.ts          regenera lib/iae/css.generated.ts
//   npx tsx scripts/iae/build-css.ts --sync   antes copia 1-3 desde el repo de Ignacio
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(__dirname, '../..')
const STYLES = resolve(ROOT, 'lib/iae/styles')
const EF = '/Users/ignacio/workspace/austral/iae/inmobiliario-empresas-familiares'

if (process.argv.includes('--sync')) {
  copyFileSync(`${EF}/deck/deck.css`, `${STYLES}/deck.css`)
  copyFileSync(`${EF}/build/extra.css`, `${STYLES}/extra.css`)
  const ref = readFileSync(`${EF}/build/src/ref_index.html`, 'utf8')
  const m = ref.match(/<style>\n?([\s\S]*?)<\/style>/)
  if (!m) throw new Error('ref_index.html sin <style>')
  writeFileSync(`${STYLES}/ref-inline.css`, m[1])
  console.log('sincronizado desde', EF)
}

function forShadow(css: string): string {
  return css
    .replace(/:root/g, ':host')
    .replace(/(^|\n)\s*html,\s*body\s*\{/g, '$1:host {')
    .replace(/(^|\n)body\s*\{/g, '$1:host {')
}

const parts = ['deck.css', 'ref-inline.css', 'extra.css', 'campus.css'].map((f) => {
  const css = readFileSync(`${STYLES}/${f}`, 'utf8')
  return `/* ===== ${f} ===== */\n${forShadow(css)}`
})
const bundle = parts.join('\n\n')
const out = `// GENERADO por scripts/iae/build-css.ts: no lo edites a mano (editá lib/iae/styles/*.css).
/* eslint-disable */
export const IAE_CSS: string = ${JSON.stringify(bundle)}
`
writeFileSync(resolve(ROOT, 'lib/iae/css.generated.ts'), out)
console.log(`lib/iae/css.generated.ts · ${(bundle.length / 1024).toFixed(0)} KB`)
