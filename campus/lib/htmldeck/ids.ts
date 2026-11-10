import { uuidv5 } from '@/lib/ids'

/** id estable de la slide N (0-based) de un deck HTML en el repositorio único. */
export const htmlSlideId = (deckId: string, position: number) => uuidv5(`slide:html:${deckId}:${position}`)
