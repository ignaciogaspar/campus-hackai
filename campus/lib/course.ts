import 'server-only'
import { db, COURSE_ID } from './db'
import type { ClassSession } from './db-types'

/** Lecturas comunes del curso. Toleran tablas vacías (devuelven []). */

export async function getClassSessions(courseId = COURSE_ID): Promise<ClassSession[]> {
  const { data } = await db().from('class_sessions').select('*').eq('course_id', courseId).order('ordinal')
  return (data ?? []) as ClassSession[]
}

export interface CaseSummary { id: string; class_session_id: string | null; title: string; summary: string | null; is_fictional: boolean; closes_at: string | null }
export async function getCases(courseId = COURSE_ID): Promise<CaseSummary[]> {
  const { data } = await db().from('cases').select('id, class_session_id, title, summary, is_fictional, closes_at').eq('course_id', courseId).eq('is_active', true).order('id')
  return (data ?? []) as CaseSummary[]
}

export interface AssignmentSummary { id: string; class_session_id: string | null; title: string; due_at: string | null; status: string }
export async function getAssignments(courseId = COURSE_ID): Promise<AssignmentSummary[]> {
  const { data } = await db().from('assignments').select('id, class_session_id, title, due_at, status').eq('course_id', courseId).order('due_at', { ascending: true, nullsFirst: false })
  return (data ?? []) as AssignmentSummary[]
}

export interface SimSummary { id: string; title: string; description: string | null; url: string }
export async function getSims(courseId = COURSE_ID): Promise<SimSummary[]> {
  const { data } = await db().from('sim_definitions').select('id, title, description, url, course_id').or(`course_id.eq.${courseId},course_id.is.null`).order('title')
  return (data ?? []) as SimSummary[]
}

/** Agrupa por class_session_id. */
export function bySession<T extends { class_session_id: string | null }>(rows: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const r of rows) {
    if (!r.class_session_id) continue
    const list = map.get(r.class_session_id) ?? []
    list.push(r)
    map.set(r.class_session_id, list)
  }
  return map
}
