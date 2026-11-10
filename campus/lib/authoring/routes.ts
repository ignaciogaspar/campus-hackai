// Alias de la feature de autoría sobre lib/routes.ts (se mantiene para no tocar sus imports).
import { routes } from '@/lib/routes'

export const authoringRoutes = {
  decks: routes.profesorDecks,
  deck: routes.profesorDeck,
  biblioteca: routes.biblioteca,
  agent: '/api/authoring/agent',
} as const
