/* Los archivos del set sintético se abren de verdad: un adjunto que dice ser
   PDF es un PDF que el visor del navegador puede leer, no un texto suelto. */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { syntheticData } from '@/lib/adapters/synthetic-data'

/** Chequea la estructura que un visor necesita para abrir el PDF: la tabla
    `xref` que dice `startxref`, y cada entrada de la tabla apuntando al
    comienzo de su objeto. Devuelve cuántos objetos tiene. */
function assertReadablePdf(text: string, label: string): number {
  assert.ok(text.startsWith('%PDF-1.'), `${label}: no empieza como un PDF`)
  assert.ok(text.trimEnd().endsWith('%%EOF'), `${label}: no termina como un PDF`)
  // Los offsets de un PDF son en bytes, no en caracteres.
  const bytes = new TextEncoder().encode(text)
  const at = (offset: number, length: number) => new TextDecoder().decode(bytes.subarray(offset, offset + length))

  const startxref = Number(/startxref\s+(\d+)\s+%%EOF\s*$/.exec(text)?.[1])
  assert.equal(at(startxref, 4), 'xref', `${label}: startxref no apunta a la tabla`)
  const table = /^xref\n0 (\d+)\n([\s\S]*?)trailer/.exec(at(startxref, bytes.length - startxref))
  assert.ok(table, `${label}: la tabla xref no tiene forma`)
  const size = Number(table[1])
  const entries = table[2].match(/^\d{10} \d{5} [nf] ?\n/gm) ?? []
  assert.equal(entries.length, size, `${label}: la tabla no tiene ${size} entradas`)
  entries.slice(1).forEach((entry, index) => {
    const offset = Number(entry.slice(0, 10))
    assert.equal(at(offset, `${index + 1} 0 obj`.length), `${index + 1} 0 obj`, `${label}: el objeto ${index + 1}`)
  })
  assert.match(text, new RegExp(`trailer\\s*<<[^>]*/Size ${size}\\b`), `${label}: /Size del trailer`)
  return size
}

test('los adjuntos PDF del canal externo son PDF que el visor del navegador puede abrir', () => {
  const pdfs = syntheticData.discord.channels.flatMap((c) =>
    c.messages.flatMap((m) => m.attachments.filter((a) => a.contentType === 'application/pdf'))
  )
  assert.ok(pdfs.length > 0)

  for (const attachment of pdfs) {
    const content = syntheticData.discord.files[attachment.url]
    assert.ok(content, attachment.filename)
    assert.ok(assertReadablePdf(content, attachment.filename) >= 4, attachment.filename)
  }
})
