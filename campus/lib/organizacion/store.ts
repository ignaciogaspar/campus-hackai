import 'server-only'
import { db, COURSE_ID } from '@/lib/db'
import * as core from './core'
import type { OrganizationInput } from './types'

/* Wrappers server-side de lib/organizacion/core.ts con el cliente de service role. */

export const getOrganization = (personId: string, courseId = COURSE_ID) => core.getOrganization(db(), personId, courseId)
export const saveOrganization = (personId: string, data: Partial<OrganizationInput>, opts: { strict?: boolean; courseId?: string } = {}) =>
  core.saveOrganization(db(), { personId, courseId: opts.courseId ?? COURSE_ID, data, strict: opts.strict })
export const loadPortfolio = (personId: string, audience: 'alumno' | 'profesor', courseId = COURSE_ID) => core.loadPortfolio(db(), personId, courseId, audience)
export const listOrganizations = (courseId = COURSE_ID) => core.listOrganizations(db(), courseId)
export const listEnvChecks = (personId: string, limit?: number) => core.listEnvChecks(db(), personId, limit)
export const recordEnvironmentCheck = (input: Omit<core.EnvCheckInput, 'courseId'> & { courseId?: string }) =>
  core.recordEnvironmentCheck(db(), { ...input, courseId: input.courseId ?? COURSE_ID })
export const getTeachersBySession = (courseId = COURSE_ID) => core.getTeachersBySession(db(), courseId)
export { teacherNames, envPieces, ENV_PIECES, OrganizationError } from './core'
export type { Portfolio, PortfolioItem, OrgListRow, DeliverableState, EnvCheckRow, SessionTeacher } from './core'
