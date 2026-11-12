/* Seed del SIU simulado: el SQL que carga el set sintético en las tablas
   siu_*. Sale de synthetic-data.ts, la misma fuente que el SIU en memoria, así
   los dos tienen los mismos datos. `npm run siu:seed` lo escribe en
   supabase/simulados/siu_seed.sql.

   Es idempotente: cada fila se inserta o se pisa por su clave. Las
   inscripciones que no están en el set (las que se hicieron durante la demo) y
   las notas que el set ya no tiene se borran, así correrlo de nuevo deja el SIU
   como en el set sintético. */
import { bool, json, num, type Sql, text, textArray, upsert } from '@/lib/adapters/supabase/sql'
import type { SyntheticData } from '@/lib/adapters/synthetic-data'

export function siuSeedSql(data: SyntheticData): string {
  const { siu } = data
  const schools = new Map(siu.persons.map((p) => [p.school.id, p.school]))
  const programs = new Map(siu.persons.flatMap((p) => p.programs.map((pr) => [pr.id, pr] as const)))

  const parts: Sql[] = [
    '-- Generado por npm run siu:seed desde lib/adapters/synthetic-data.ts. No lo edites a mano.\n',
    'begin;\n',
    `delete from siu_course_enrollments where id <> all (${textArray(siu.courseEnrollments.map((e) => e.id))});\n`,
    `delete from siu_exam_enrollments where id <> all (${textArray(siu.examEnrollments.map((e) => e.id))});\n`,
    `delete from siu_history where id <> all (${textArray(siu.history.map((h) => h.id))});\n`,
    `delete from siu_provisional_results where id <> all (${textArray(siu.provisionalResults.map((r) => r.id))});\n`,
    upsert(
      'siu_schools',
      ['id'],
      [...schools.values()].map((s) => ({ id: text(s.id), name: text(s.name) }))
    ),
    upsert(
      'siu_programs',
      ['id'],
      [...programs.values()].map((p) => ({ id: text(p.id), name: text(p.name) }))
    ),
    upsert(
      'siu_persons',
      ['id'],
      siu.persons.map((p) => ({
        id: text(p.id),
        surname: text(p.surname),
        names: text(p.names),
        email: text(p.email),
        role: text(p.role),
        school_id: text(p.school.id)
      }))
    ),
    upsert(
      'siu_person_programs',
      ['person_id', 'program_id'],
      siu.persons.flatMap((p) =>
        p.programs.map((pr, i) => ({
          person_id: text(p.id),
          program_id: text(pr.id),
          status: text(pr.status),
          position: num(i)
        }))
      )
    ),
    upsert(
      'siu_terms',
      ['id'],
      siu.terms.map((t) => ({
        id: text(t.id),
        name: text(t.name),
        start_at: text(t.start),
        end_at: text(t.end),
        enrollment_start: text(t.enrollmentStart),
        enrollment_end: text(t.enrollmentEnd)
      }))
    ),
    upsert(
      'siu_subjects',
      ['id'],
      siu.subjects.map((s) => ({ id: text(s.id), code: text(s.code), name: text(s.name), credits: num(s.credits) }))
    ),
    upsert(
      'siu_sections',
      ['id'],
      siu.sections.map((s) => ({
        id: text(s.id),
        name: text(s.name),
        subject_id: text(s.subjectId),
        school_id: text(s.schoolId),
        term_id: text(s.termId),
        teacher_ids: textArray(s.teacherIds),
        schedule: json(s.schedule),
        location: text(s.location),
        modality: text(s.modality),
        instance: text(s.instance),
        capacity: num(s.capacity),
        program_ids: textArray(s.programIds),
        notes: text(s.notes)
      }))
    ),
    `delete from siu_plan_subjects where (program_id || ':' || subject_id) <> all (${textArray(
      siu.studyPlans.flatMap((p) => p.subjects.map((x) => `${p.programId}:${x.subjectId}`))
    )});\n`,
    upsert(
      'siu_study_plans',
      ['program_id'],
      siu.studyPlans.map((p) => ({
        program_id: text(p.programId),
        name: text(p.name),
        years: num(p.years),
        electives_required: num(p.electivesRequired),
        university_life_required: num(p.universityLifeRequired)
      }))
    ),
    upsert(
      'siu_plan_subjects',
      ['program_id', 'subject_id'],
      siu.studyPlans.flatMap((p) =>
        p.subjects.map((x, i) => ({
          program_id: text(p.programId),
          subject_id: text(x.subjectId),
          year: num(x.year),
          kind: text(x.kind),
          position: num(i)
        }))
      )
    ),
    upsert(
      'siu_course_enrollments',
      ['id'],
      siu.courseEnrollments.map((e) => ({
        id: text(e.id),
        transaction_number: text(e.transactionNumber),
        person_id: text(e.personId),
        section_id: text(e.sectionId),
        enrolled_at: text(e.date),
        status: text(e.status)
      }))
    ),
    upsert(
      'siu_exam_boards',
      ['id'],
      siu.examBoards.map((m) => ({
        id: text(m.id),
        subject_id: text(m.subjectId),
        school_id: text(m.schoolId),
        exam_period: text(m.examPeriod),
        date: text(m.date),
        location: text(m.location),
        teacher_ids: textArray(m.teacherIds),
        capacity: num(m.capacity),
        enrollment_start: text(m.enrollmentStart),
        enrollment_end: text(m.enrollmentEnd),
        notes: text(m.notes)
      }))
    ),
    upsert(
      'siu_exam_enrollments',
      ['id'],
      siu.examEnrollments.map((e) => ({
        id: text(e.id),
        transaction_number: text(e.transactionNumber),
        person_id: text(e.personId),
        exam_board_id: text(e.examBoardId),
        enrolled_at: text(e.date),
        status: text(e.status)
      }))
    ),
    upsert(
      'siu_assessments',
      ['id'],
      siu.assessments.map((a) => ({
        id: text(a.id),
        section_id: text(a.sectionId),
        name: text(a.name),
        kind: text(a.kind),
        date: text(a.date)
      }))
    ),
    upsert(
      'siu_history',
      ['id'],
      siu.history.map((h) => ({
        id: text(h.id),
        person_id: text(h.personId),
        subject_id: text(h.subjectId),
        type: text(h.type),
        date: text(h.date),
        grade: num(h.grade),
        result: text(h.result),
        grade_record: text(h.gradeRecord),
        section_id: text(h.sectionId),
        assessment_id: text(h.assessmentId)
      }))
    ),
    upsert(
      'siu_provisional_results',
      ['id'],
      siu.provisionalResults.map((r) => ({
        id: text(r.id),
        person_id: text(r.personId),
        section_id: text(r.sectionId),
        assessment_id: text(r.assessmentId),
        grade: num(r.grade),
        date: text(r.date)
      }))
    ),
    upsert(
      'siu_absences',
      ['id'],
      siu.absences.map((a) => ({
        id: text(a.id),
        person_id: text(a.personId),
        section_id: text(a.sectionId),
        date: text(a.date),
        justified: bool(a.justified)
      }))
    ),
    upsert(
      'siu_absence_limits',
      ['section_id'],
      siu.absenceLimits.map((l) => ({ section_id: text(l.sectionId), max: num(l.max) }))
    ),
    upsert(
      'siu_certificates',
      ['person_id', 'type'],
      siu.certificates.map((c) => ({
        person_id: text(c.personId),
        type: text(c.type),
        meets_conditions: bool(c.meetsConditions)
      }))
    ),
    'commit;\n'
  ]
  return parts.join('\n')
}
