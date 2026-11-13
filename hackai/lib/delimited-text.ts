/* Leer texto con filas y celdas: lo que se copia de Excel o Google Sheets (con
   tabulaciones) o un .csv (con coma o punto y coma). Sin dependencias y sin
   saber qué significa cada columna: eso lo decide quien lo usa. */

/** Separa el texto pegado en filas y celdas. Lo copiado de Excel viene con tabulaciones; un .csv, con coma o punto
    y coma, y las comillas protegen un separador adentro de una celda. */
export function rowsFromText(text: string): string[][] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const sample = lines.slice(0, 5).join('\n')
  const separator = sample.includes('\t')
    ? '\t'
    : (sample.match(/;/g)?.length ?? 0) > (sample.match(/,/g)?.length ?? 0)
      ? ';'
      : ','
  return lines.map((line) => splitLine(line, separator))
}

function splitLine(line: string, separator: string): string[] {
  const cells: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"' && quoted && line[i + 1] === '"') {
      cell += '"'
      i++
    } else if (char === '"' && (quoted || cell === '')) {
      quoted = !quoted
    } else if (char === separator && !quoted) {
      cells.push(cell)
      cell = ''
    } else {
      cell += char
    }
  }
  cells.push(cell)
  return cells
}
