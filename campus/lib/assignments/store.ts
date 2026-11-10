import 'server-only'
import { db } from '@/lib/db'
import * as core from './core'
import type { AssignmentStatus, GradeMode } from './types'

// Envoltorio server-only de lib/assignments/core.ts con el cliente service role.

export const getAssignmentRow = (id: string) => core.getAssignmentRow(db(), id)
export const loadBundle = (id: string) => core.loadBundle(db(), id)
export const loadStudentView = (id: string, personId: string) => core.loadStudentView(db(), id, personId)
export const listAssignmentsWithStats = (courseId: string) => core.listAssignmentsWithStats(db(), courseId)
export const saveSubmission = (input: Parameters<typeof core.saveSubmission>[1]) => core.saveSubmission(db(), input)
export const savePeerReview = (input: Parameters<typeof core.savePeerReview>[1]) => core.savePeerReview(db(), input)
export const saveTeacherReview = (input: Parameters<typeof core.saveTeacherReview>[1]) => core.saveTeacherReview(db(), input)
export const setAssignmentStatus = (id: string, status: AssignmentStatus) => core.setAssignmentStatus(db(), id, status)
export const saveSettings = (id: string, input: { gradeMode?: GradeMode; teacherWeight?: number; discordThreshold?: number; perSubmission?: number; dueAt?: string | null }) => core.saveSettings(db(), id, input)
export const runPeerAssignment = (id: string, opts: Parameters<typeof core.runPeerAssignment>[2]) => core.runPeerAssignment(db(), id, opts)
export { buildGradebook, submissionWindow, AssignmentError } from './core'
