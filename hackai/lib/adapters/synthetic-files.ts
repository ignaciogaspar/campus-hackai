/* Contenido de los archivos del set sintético. Un adjunto que dice ser PDF
   tiene que abrirse en el visor del navegador, así que es un PDF de verdad:
   una página con el título y una línea que avisa que es material de la demo.
   Se arma a mano, sin librerías, y todo en ASCII: así cada carácter es un
   byte y los offsets de la tabla `xref` se cuentan con `length`. */

/** El texto en ASCII y escapado para un string de PDF: sin tildes, y con `\`,
    `(` y `)` escapados. */
function pdfText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\x20-\x7e]/g, '?')
    .replace(/[\\()]/g, (c) => `\\${c}`)
}

/** Un PDF de una página con `title` arriba y el aviso de que es de la demo. */
export function syntheticPdf(title: string): string {
  const content = [
    'BT',
    `/F1 20 Tf 72 760 Td (${pdfText(title)}) Tj`,
    `/F1 12 Tf 0 -32 Td (${pdfText('Material sintético de la demo de Campus HackAI.')}) Tj`,
    'ET'
  ].join('\n')
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`
  ]

  let pdf = '%PDF-1.4\n'
  const offsets = objects.map((object, index) => {
    const offset = pdf.length
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`
    return offset
  })
  const xref = pdf.length
  const entries = offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${entries}`
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return pdf
}
