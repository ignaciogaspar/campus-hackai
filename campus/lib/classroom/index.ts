import 'server-only'

// API server del aula para otras features (agente en vivo, MCP, tablero).
// Los server actions están en ./actions y los tipos puros en ./types.

export { drawStudent, logParticipation, currentRound, resetRound, setDrawOutcome, showStudentOnLive, ensureRound, cohortParticipation, recentParticipation, deleteParticipation, cleanNote } from './participation'
export type { DrawStudentInput, DrawStudentResult, DrawnStudent, CurrentRound, RoundInfo, LogParticipationInput, ParticipationRow, CohortParticipation } from './participation'
export { getCase, listCases, getMyPosture, getPostureDistribution, getCaseTeacherView, savePosture, projectCasePostures } from './cases'
export { activeLiveSession, setLiveOverlay } from './live'
export { getDeckAnalytics } from './analytics'
export type { DeckAnalytics, SlideAnalytics, PollAnalytics } from './analytics'
export { summarizeUnderstanding, analyticsContext } from './summary'
export { listCohort, updateProfile } from './profiles'
export * from './types'
