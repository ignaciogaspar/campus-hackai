/* Horario, modalidad y cupo de la oferta, en palabras. Solo presentación: las
   fechas están en components/dates.ts. */
import type { OfferItem } from '@/lib/core/studies'

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
    de 40», «Sin cupo» o «Sin límite de cupo». */
export function capacityText(item: Pick<OfferItem, 'capacity' | 'spotsLeft'>): { text: string; full: boolean } {
  const { capacity, spotsLeft } = item
  if (capacity === null || spotsLeft === null) return { text: 'Sin límite de cupo', full: false }
  if (spotsLeft === 0) return { text: `Sin cupo · ${capacity} de ${capacity} lugares ocupados`, full: true }
  return { text: `Quedan ${spotsLeft} ${spotsLeft === 1 ? 'lugar' : 'lugares'} de ${capacity}`, full: false }
}
