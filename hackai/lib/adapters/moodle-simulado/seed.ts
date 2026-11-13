/* Seed del Moodle simulado: el SQL que carga el set sintético en las tablas
   moodle_*. Sale de synthetic-data.ts, la misma fuente que el aula en memoria,
   así los dos tienen los mismos datos. `npm run moodle:seed` lo escribe en
   supabase/simulados/moodle_seed.sql.

   Es idempotente: cada fila se inserta o se pisa por su clave. Las matrículas
   que no están en el set (las que se hicieron durante la demo) se borran, así
   correrlo de nuevo deja el Moodle como en el set sintético. Va después de
   siu_seed.sql solo por prolijidad: no hay claves entre los dos. */
import { json, num, type Sql, text, textArray, upsert } from '@/lib/adapters/supabase/sql'
import type { SyntheticData } from '@/lib/adapters/synthetic-data'

/** Borra las matrículas que no están en `pairs`: de (usuario, curso) hay una sola por par. */
function deleteEnrolmentsOutside(pairs: { userId: string; courseId: string }[]): Sql {
  if (!pairs.length) return 'delete from moodle_enrolments;\n'
  const values = pairs.map((p) => `(${text(p.userId)}, ${text(p.courseId)})`).join(', ')
  return `delete from moodle_enrolments e where not exists (
  select 1 from (values ${values}) as keep (user_id, course_id)
  where keep.user_id = e.user_id and keep.course_id = e.course_id
);\n`
}

export function moodleSeedSql(data: SyntheticData): string {
  const { moodle, people, siu } = data
  const persons = new Map(siu.persons.map((p) => [p.id, p]))

  const parts: Sql[] = [
    '-- Generado por npm run moodle:seed desde lib/adapters/synthetic-data.ts. No lo edites a mano.\n',
    'begin;\n',
    deleteEnrolmentsOutside(moodle.enrolments),
    upsert(
      'moodle_users',
      ['id'],
      people.map((p) => {
        const person = persons.get(p.siuId)!
        return {
          id: text(p.moodleId),
          username: text(person.email.split('@')[0]),
          first_name: text(person.names),
          last_name: text(person.surname),
          email: text(person.email)
        }
      })
    ),
    upsert(
      'moodle_courses',
      ['id'],
      moodle.courses.map((c) => ({
        id: text(c.id),
        short_name: text(c.shortName),
        full_name: text(c.fullName),
        siu_section_ids: textArray(c.siuSectionIds)
      }))
    ),
    upsert(
      'moodle_enrolments',
      ['user_id', 'course_id'],
      moodle.enrolments.map((e) => ({
        user_id: text(e.userId),
        course_id: text(e.courseId),
        role: text(e.role)
      }))
    ),
    upsert(
      'moodle_announcements',
      ['id'],
      moodle.announcements.map((a) => ({
        id: text(a.id),
        course_id: text(a.courseId),
        author_id: text(a.authorId),
        subject: text(a.subject),
        message: text(a.message),
        created_at: text(a.createdAt),
        attachments: json(a.attachments)
      }))
    ),
    upsert(
      'moodle_contents',
      ['id'],
      moodle.contents.map((c) => ({
        id: text(c.id),
        course_id: text(c.courseId),
        topic: text(c.topic),
        name: text(c.name),
        type: text(c.type),
        url: text(c.url),
        modified_at: text(c.modifiedAt),
        position: num(c.position),
        files: json(c.files),
        text: text(c.text),
        activity: text(c.activity)
      }))
    ),
    upsert(
      'moodle_assignments',
      ['id'],
      moodle.assignments.map((a) => ({
        id: text(a.id),
        course_id: text(a.courseId),
        name: text(a.name),
        due_date: text(a.dueDate),
        description: text(a.description),
        url: text(a.url)
      }))
    ),
    'commit;\n'
  ]
  return parts.join('\n')
}
