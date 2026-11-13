/* Las cuentas del calendario, sin pantalla: qué días tiene una semana o un
   mes, a qué hora cae cada cosa, qué va en la fila de todo el día, qué clases
   hay cada semana y cómo se agrupa lo que se pisa. Todo en la hora de Buenos
   Aires y con semanas de lunes a domingo. Qué es un parcial, qué pasó y cuál
   es el próximo lo decide Hoy: acá solo se ubica. */
import type { Origin } from '@/components/ui/origin-badge'
import type { MySubject, OpenEnrollment, UpcomingItem } from '@/lib/core/studies'
import { addDays, dayKey, TIME_ZONE, weekdayIndex } from '@/lib/dates'

export type CalendarTone = UpcomingItem['kind'] | 'inscripcion' | 'clase'

export type CalendarEvent = {
  id: string
  /** El día `AAAA-MM-DD` en Buenos Aires. */
  day: string
  /** Minutos desde la medianoche en Buenos Aires; `null` va en la fila de todo el día. */
  minutes: number | null
  /** Hasta qué minuto dura, si se sabe (las clases). Sin fin, ocupa una hora. */
  end: number | null
  /** «14:00», o «14:00 – 16:00» si se sabe el fin; `null` si no tiene hora. */
  time: string | null
  code: string | null
  title: string
  subject: string
  /** Dónde: el aula de una clase o el lugar de un final, si el SIU lo da. */
  place: string | null
  tone: CalendarTone
  origin: Origin
  past: boolean
  next: boolean
}

/** Los días y horarios de clase de una comisión, entre el inicio y el fin de su período. */
export type ClassSlot = {
  id: string
  code: string
  subject: string
  section: string
  /** 0 es lunes. */
  weekday: number
  start: number
  end: number
  /** Primer y último día de clases, `AAAA-MM-DD`. */
  from: string
  to: string
  location: string
}

/** El lunes de la semana de un día `AAAA-MM-DD`. */
export const mondayOf = (day: string) => addDays(day, -weekdayIndex(day))

/** Los 7 días de la semana que empieza en `monday`. */
export const weekOf = (monday: string) => Array.from({ length: 7 }, (_, i) => addDays(monday, i))

/** Las semanas completas, de lunes a domingo, que cubren el mes de un día `AAAA-MM-DD`. */
export function monthOf(day: string): string[] {
  const first = `${day.slice(0, 7)}-01`
  const start = mondayOf(first)
  const days: string[] = []
  for (let d = start; d.slice(0, 7) <= first.slice(0, 7) || weekdayIndex(d) !== 0; d = addDays(d, 1)) days.push(d)
  return days
}

/** El mismo día del mes anterior o siguiente, el 1 para no pasarse (31 de enero → 1 de febrero). */
export function shiftMonth(day: string, months: number): string {
  const [y, m] = day.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1 + months, 1))
  return date.toISOString().slice(0, 10)
}

/** Minutos desde la medianoche de Buenos Aires. */
export function minutesOf(iso: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE,
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23'
  }).formatToParts(new Date(iso))
  const part = (type: 'hour' | 'minute') => Number(parts.find((p) => p.type === type)?.value ?? 0)
  return part('hour') * 60 + part('minute')
}

export const hhmm = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`

/** «08:00» → 480. */
const toMinutes = (time: string) => {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

const CLOSING: Record<OpenEnrollment['kind'], string> = {
  cursada: 'a la cursada',
  actividad: 'a la actividad',
  examen: 'al final'
}

/** Las fechas de Hoy como eventos. Los parciales y finales van en su hora; las
    entregas de Moodle y de HackAI y los cierres de inscripción, en la fila de todo el día. */
export function eventsOf(
  upcoming: UpcomingItem[],
  enrollments: OpenEnrollment[],
  nextId: string | null,
  now: string
): CalendarEvent[] {
  const dates = upcoming.map((item): CalendarEvent => {
    const minutes = minutesOf(item.date)
    return {
      id: item.id,
      day: dayKey(item.date),
      minutes: item.kind === 'entrega' ? null : minutes,
      end: null,
      time: hhmm(minutes),
      code: item.subjectCode,
      title: item.name,
      subject: item.examPeriod ? `${item.subjectName} · ${item.examPeriod}` : item.subjectName,
      place: item.location,
      tone: item.kind,
      origin: item.source,
      past: item.past,
      next: item.id === nextId
    }
  })
  const closings = enrollments.map(
    (e): CalendarEvent => ({
      id: `inscripcion:${e.kind}:${e.subjectId}`,
      day: dayKey(e.closesAt),
      minutes: null,
      end: null,
      time: null,
      code: null,
      title: `Cierra la inscripción ${CLOSING[e.kind]}`,
      subject: e.subjectName,
      place: null,
      tone: 'inscripcion',
      origin: 'siu',
      past: e.closesAt < now,
      next: false
    })
  )
  return [...dates, ...closings]
}

const WEEKDAYS: Record<MySubject['schedule'][number]['day'], number> = {
  lunes: 0,
  martes: 1,
  miercoles: 2,
  jueves: 3,
  viernes: 4,
  sabado: 5
}

/** Los horarios de clase de las materias, para repetirlos cada semana de su período. */
export function classSlotsOf(subjects: MySubject[]): ClassSlot[] {
  return subjects.flatMap((s) =>
    s.schedule.map(
      (slot, i): ClassSlot => ({
        id: `clase:${s.sectionId}:${i}`,
        code: s.code,
        subject: s.name,
        section: s.sectionName,
        weekday: WEEKDAYS[slot.day],
        start: toMinutes(slot.start),
        end: toMinutes(slot.end),
        from: dayKey(s.termStart),
        to: dayKey(s.termEnd),
        location: s.location
      })
    )
  )
}

/** Las clases de esos días: las de cada horario que cae dentro de su período. */
export function classesIn(days: string[], slots: ClassSlot[], today: string): CalendarEvent[] {
  return days.flatMap((day) =>
    slots
      .filter((slot) => weekdayIndex(day) === slot.weekday && slot.from <= day && day <= slot.to)
      .map(
        (slot): CalendarEvent => ({
          id: `${slot.id}:${day}`,
          day,
          minutes: slot.start,
          end: slot.end,
          time: `${hhmm(slot.start)} – ${hhmm(slot.end)}`,
          code: slot.code,
          title: slot.subject,
          subject: `Comisión ${slot.section}`,
          place: slot.location,
          tone: 'clase',
          origin: 'siu',
          past: day < today,
          next: false
        })
      )
  )
}

const durationEnd = (e: CalendarEvent) => e.end ?? (e.minutes ?? 0) + 60

/** Si un parcial o un final de la materia cae durante su clase, la clase de
    ese día no va: el examen ocupa su lugar y dura lo que la clase. */
export function withClasses(events: CalendarEvent[], classes: CalendarEvent[]): CalendarEvent[] {
  const exams = events.filter((e) => e.minutes !== null && e.tone !== 'clase')
  const replaced = new Map<string, number>()
  const kept = classes.filter((c) => {
    const exam = exams.find(
      (e) => e.day === c.day && e.code === c.code && c.minutes! <= e.minutes! && e.minutes! < durationEnd(c)
    )
    if (exam) replaced.set(exam.id, durationEnd(c))
    return !exam
  })
  const placed = events.map((e) => {
    const end = replaced.get(e.id)
    return end && e.minutes !== null ? { ...e, end, time: `${hhmm(e.minutes)} – ${hhmm(end)}` } : e
  })
  return [...placed, ...kept]
}

/** Lo que se pisa en un día: un rango de horas con sus eventos, uno debajo del otro. */
export type Cluster = { day: string; start: number; end: number; events: CalendarEvent[] }

/** Los eventos con hora de cada día, agrupados cuando se pisan. Cada grupo
    ocupa sus horas en la grilla y adentro van uno debajo del otro: así nada
    tapa a nada y cada uno se lee entero. */
export function clustersOf(events: CalendarEvent[]): Cluster[] {
  const timed = events
    .filter((e) => e.minutes !== null)
    .sort((a, b) => a.day.localeCompare(b.day) || a.minutes! - b.minutes! || durationEnd(b) - durationEnd(a))
  const clusters: Cluster[] = []
  for (const e of timed) {
    const last = clusters.at(-1)
    if (last && last.day === e.day && e.minutes! < last.end) {
      last.events.push(e)
      last.end = Math.max(last.end, durationEnd(e))
    } else {
      clusters.push({ day: e.day, start: e.minutes!, end: durationEnd(e), events: [e] })
    }
  }
  return clusters
}
