import { getClassSessions } from '@/lib/course'
import { fechaCorta, diaSemana } from '@/lib/format'
import { getTeachersBySession, teacherNames, type SessionTeacher } from '@/lib/organizacion/store'

/** «Docentes: Ignacio Berdiñas y Sebastián Buffo Sempé». Para poner en la tarjeta de cada jornada. */
export function DocentesJornada({ teachers }: { teachers: SessionTeacher[] | undefined }) {
  if (!teachers?.length) return null
  return (
    <span className="org-docentes">
      {teachers.length > 1 ? 'Docentes' : 'Docente'}: <strong>{teacherNames(teachers)}</strong>
    </span>
  )
}

/** Lista de las jornadas con fecha, horario y docentes (server component: carga sus datos). */
export async function DocentesCalendario() {
  const [sessions, teachers] = await Promise.all([getClassSessions(), getTeachersBySession()])
  if (!sessions.length) return null
  return (
    <ul className="org-calendario">
      {sessions.map((s) => (
        <li key={s.id}>
          <span className="chico muted">{diaSemana(s.starts_at)} {fechaCorta(s.starts_at)} · J{s.ordinal}</span>
          <span className="chico">{s.title.split(/\s[—·]\s/)[0]} · <DocentesJornada teachers={teachers.get(s.id)} /></span>
        </li>
      ))}
    </ul>
  )
}

export { getTeachersBySession }
