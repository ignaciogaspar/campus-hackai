/* Lectura del HTML de la Autogestión del SIU (3W), sin dependencias. Cada
   página trae su contenido en pagelets: un `kernel.renderer.on_arrival({...})`
   por pagelet, con el HTML en `content`. Estas funciones sacan ese HTML y leen
   lo poco que hace falta de él: texto, celdas y atributos. Research:
   docs/research/2026-11-12-datos-reales-siu-campus.md. */

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }

function decodeEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (whole, code: string) => {
    if (code.startsWith('#x') || code.startsWith('#X')) return String.fromCodePoint(Number.parseInt(code.slice(2), 16))
    if (code.startsWith('#')) return String.fromCodePoint(Number.parseInt(code.slice(1), 10))
    return ENTITIES[code.toLowerCase()] ?? whole
  })
}

/** El texto de un pedazo de HTML, sin etiquetas y con los espacios juntados. */
export function textOf(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim()
}

/** El HTML de cada pagelet de una página, por su id. */
export function pagelets(page: string): Map<string, string> {
  const found = new Map<string, string>()
  for (const match of page.matchAll(/kernel\.renderer\.on_arrival\((\{.*?\})\);<\/script>/gs)) {
    try {
      const arrival = JSON.parse(match[1]) as { info?: { id?: string }; content?: string }
      if (arrival.info?.id) found.set(arrival.info.id, arrival.content ?? '')
    } catch {
      // Un pagelet que no es JSON válido no trae nada que leer.
    }
  }
  return found
}

/** El `info` de un pagelet: trae las URLs de sus pedidos AJAX (`url_optativas`, `url_detalle_encurso`…). */
export function pageletInfo(page: string, id: string): Record<string, unknown> {
  for (const match of page.matchAll(/kernel\.renderer\.on_arrival\((\{.*?\})\);<\/script>/gs)) {
    try {
      const arrival = JSON.parse(match[1]) as { info?: Record<string, unknown> }
      if (arrival.info?.id === id) return arrival.info
    } catch {
      // Un pagelet que no es JSON válido no trae nada que leer.
    }
  }
  return {}
}

/** Una URL de un `info`, o `null` si no está. */
export function urlIn(info: Record<string, unknown>, key: string): string | null {
  const value = info[key]
  return typeof value === 'string' && value.startsWith('http') ? value : null
}

/** Las filas de datos de una tabla: el texto de cada `<td>`. Las filas de encabezado (solo `<th>`) no van. */
export function rowsOf(tableHtml: string): string[][] {
  return [...tableHtml.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)]
    .map((row) => [...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)].map((cell) => cell[1]))
    .filter((cells) => cells.length > 0)
}

/** Las tablas de un pedazo de HTML, enteras. */
export function tablesOf(html: string): string[] {
  return [...html.matchAll(/<table\b[\s\S]*?<\/table>/g)].map((m) => m[0])
}

/** El valor de un atributo de la primera etiqueta que lo tiene, o `null`. Sin distinguir mayúsculas
    ni el tipo de comillas, que el SIU mezcla. */
export function attrOf(html: string, name: string): string | null {
  const match = html.match(new RegExp(`\\b${name}=(?:"([^"]*)"|'([^']*)')`, 'i'))
  return match ? decodeEntities(match[1] ?? match[2]) : null
}

/** El código entre paréntesis al final de «Nombre (CÓDIGO)», y el nombre sin él. */
export function nameAndCode(text: string): { name: string; code: string | null } {
  const match = text.match(/^(.*?)\s*\(([^()]+)\)\s*$/)
  return match ? { name: match[1].trim(), code: match[2].trim() } : { name: text.trim(), code: null }
}

/** Una fecha de Argentina en ISO UTC, como las del resto del sistema: así se comparan como texto. */
export function argentinaIso(date: string, time = '00:00'): string {
  return new Date(`${date}T${time}:00-03:00`).toISOString()
}

/** «dd/mm/aaaa» o «dd/mm/aaaa hh:mm» en ISO, en hora de Argentina; `null` si no hay fecha. */
export function isoDate(text: string): string | null {
  const match = text.match(/(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/)
  if (!match) return null
  const [, day, month, year, hour = '00', minute = '00'] = match
  return argentinaIso(`${year}-${month}-${day}`, `${hour}:${minute}`)
}

/** Una nota como número, o `null` si es un texto como «Aprobado». */
export function gradeOf(text: string): number | null {
  const match = text.trim().match(/^(\d+(?:[.,]\d+)?)/)
  return match ? Number(match[1].replace(',', '.')) : null
}

/** Un pedazo de id estable: minúsculas, sin acentos ni espacios. */
export function slug(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}
