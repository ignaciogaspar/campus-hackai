// Motor puro de slides: se puede importar desde server, client y scripts.
export * from './types'
export {
  SLIDE_LIMITS, slideIssues, splitDeck, joinDeck, parseSlide, parseDeck, pollOptionId, slideTitle, slideKind,
  deckContext, slideContext, deckSkin,
} from './parse'
