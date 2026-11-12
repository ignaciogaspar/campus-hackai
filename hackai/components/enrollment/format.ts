/* Horario, modalidad y cupo de la oferta, en palabras. Solo presentación: las
   fechas están en components/dates.ts. */
import type { OfferItem } from '@/lib/core/studies'

/** El aviso de una mesa que pide regularizar la cursada antes de rendir. */
export const REGULARITY_NOTE = 'Para rendir este final, antes tenés que regularizar la cursada.'

const DAYS: Record<OfferItem['schedule'][number]['day'], string> = {
  lunes: 'Lunes',
  martes: 'Martes',
  miercoles: 'Miércoles',
  jueves: 'Jueves',
  viernes: 'Viernes',
  sabado: 'Sábado'
}

const MODALITIES: Record<NonNullable<OfferItem['modality']>, string> = {
  presencial: 'Presencial',
  virtual: 'Virtual',
  hibrida: 'Híbrida'
}

/** «Martes 09:00 a 13:00» */
export function scheduleLine(slot: OfferItem['schedule'][number]): string {
  return `${DAYS[slot.day]} ${slot.start} a ${slot.end}`
}

export function modalityName(modality: OfferItem['modality']): string | null {
  return modality ? MODALITIES[modality] : null
}

/** Cupo para mostrar, con los lugares que calcula Cursada: «Quedan 12 lugares
    de 40», «Queda 1 lugar de 2», «Sin cupo» o «Sin límite de cupo». */
export function capacityText(item: Pick<OfferItem, 'capacity' | 'spotsLeft'>): { text: string; full: boolean } {
  const { capacity, spotsLeft } = item
  if (capacity === null || spotsLeft === null) return { text: 'Sin límite de cupo', full: false }
  if (spotsLeft === 0) return { text: `Sin cupo · ${capacity} de ${capacity} lugares ocupados`, full: true }
  return { text: `${leftText(spotsLeft)} de ${capacity}`, full: false }
}

const leftText = (spotsLeft: number) => (spotsLeft === 1 ? 'Queda 1 lugar' : `Quedan ${spotsLeft} lugares`)

/** Los lugares que quedan en una inscripción abierta de la lista, entre todas
    sus comisiones o mesas: «Quedan 12 lugares», «Sin cupo» o «Sin límite de cupo». */
export function spotsLeftText(spotsLeft: number | null): { text: string; full: boolean } {
  if (spotsLeft === null) return { text: 'Sin límite de cupo', full: false }
  if (spotsLeft === 0) return { text: 'Sin cupo', full: true }
  return { text: leftText(spotsLeft), full: false }
}

/** «1 crédito», «3 créditos»: lo que da una actividad. */
export function creditsText(credits: number): string {
  return credits === 1 ? '1 crédito' : `${credits} créditos`
}

/** Cuándo cierra una inscripción, con los días que cuenta Cursada: «cierra hoy»,
    «cierra mañana», «cierra en 24 días». Una lectura vieja puede traer una que ya cerró. */
export function closingText(closesInDays: number): string {
  if (closesInDays < 0) return 'ya cerró'
  if (closesInDays === 0) return 'cierra hoy'
  if (closesInDays === 1) return 'cierra mañana'
  return `cierra en ${closesInDays} días`
}

/** «16 semanas»: cuánto dura una cursada, de su primer a su último día. */
export function durationText(start: string, end: string): string {
  const weeks = Math.max(1, Math.round((new Date(end).getTime() - new Date(start).getTime()) / (7 * 24 * 3600 * 1000)))
  return `${weeks} ${weeks === 1 ? 'semana' : 'semanas'}`
}

/** «Se puede promocionar» o «Con final»: cómo se aprueba la cursada de una comisión. */
export function instanceText(instance: OfferItem['instance']): string | null {
  if (instance === 'promocion') return 'Sí, se puede promocionar'
  if (instance === 'regularidad') return 'No, se aprueba con final'
  return null
}
