/* Formatos de fecha y horario de las pantallas de inscripción, en la hora de
   Buenos Aires. Solo presentación. */
import type { OfferItem } from '@/lib/core/studies'

const TIME_ZONE = 'America/Argentina/Buenos_Aires'

const DAYS: Record<OfferItem['schedule'][number]['day'], string> = {
  lunes: 'Lunes',
  martes: 'Martes',
  miercoles: 'Miércoles',
  jueves: 'Jueves',
  viernes: 'Viernes',
  sabado: 'Sábado',
}

const MODALITIES: Record<NonNullable<OfferItem['modality']>, string> = {
  presencial: 'Presencial',
  virtual: 'Virtual',
  hibrida: 'Híbrida',
}

/** «18 de dic.» */
export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', { timeZone: TIME_ZONE, day: 'numeric', month: 'short' })
}

/** «10 nov., 11:40» */
export function readTime(iso: string): string {
  return new Date(iso).toLocaleString('es-AR', { timeZone: TIME_ZONE, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

/** «Martes 09:00 a 13:00» */
export function scheduleLine(slot: OfferItem['schedule'][number]): string {
  return `${DAYS[slot.day]} ${slot.start} a ${slot.end}`
}

export function modalityName(modality: OfferItem['modality']): string | null {
  return modality ? MODALITIES[modality] : null
}

/** Cupo para mostrar: «Quedan 12 lugares de 40», «Sin cupo» o «Sin límite de cupo». */
export function capacityText(item: Pick<OfferItem, 'capacity' | 'enrolled'>): { text: string; full: boolean } {
  if (item.capacity === null) return { text: 'Sin límite de cupo', full: false }
  const left = Math.max(item.capacity - item.enrolled, 0)
  if (left === 0) return { text: `Sin cupo · ${item.capacity} de ${item.capacity} lugares ocupados`, full: true }
  return { text: `Quedan ${left} ${left === 1 ? 'lugar' : 'lugares'} de ${item.capacity}`, full: false }
}
