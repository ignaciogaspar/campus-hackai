/* Archivo de calendario (iCalendar, RFC 5545) con los próximos parciales,
   finales y entregas. Las horas van en UTC: cada calendario las muestra en su
   zona, así que en Buenos Aires salen como en el SIU y en Moodle. */
import type { UpcomingItem } from '@/lib/core/studies'

const KIND: Record<UpcomingItem['kind'], string> = {
  parcial: 'Parcial',
  recuperatorio: 'Recuperatorio',
  tp: 'TP',
  final: 'Final',
  entrega: 'Entrega'
}

/** `20261116T110000Z`. */
const utc = (iso: string) =>
  new Date(iso)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '')

const escapeText = (text: string) => text.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\r?\n/g, '\\n')

/** Corta las líneas de más de 75 octetos, como pide el formato. */
function fold(line: string): string {
  const parts: string[] = []
  let current = ''
  for (const char of line) {
    if (Buffer.byteLength(current + char) > (parts.length ? 74 : 75)) {
      parts.push(current)
      current = ''
    }
    current += char
  }
  return [...parts, current].join('\r\n ')
}

function summary(item: UpcomingItem): string {
  const kind = KIND[item.kind]
  return item.name === kind ? `${kind} · ${item.subjectName}` : `${kind}: ${item.name} · ${item.subjectName}`
}

/** Lo que va al archivo: los próximos que no pasaron o, con `mesa`, solo ese final. */
export function calendarItems(upcoming: UpcomingItem[], mesa: string | null): UpcomingItem[] {
  return upcoming.filter((i) => !i.past && (!mesa || i.id === `mesa:${mesa}`))
}

export function calendarFile(items: UpcomingItem[], now: string): string {
  const events = items.flatMap((item) => [
    'BEGIN:VEVENT',
    `UID:${item.id}@hackai`,
    `DTSTAMP:${utc(now)}`,
    `DTSTART:${utc(item.date)}`,
    `SUMMARY:${escapeText(summary(item))}`,
    `CATEGORIES:${KIND[item.kind]}`,
    'END:VEVENT'
  ])
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//HackAI//Campus HackAI//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...events,
    'END:VCALENDAR'
  ]
  return `${lines.map(fold).join('\r\n')}\r\n`
}
