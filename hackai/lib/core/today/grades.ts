/* Las notas del alumno juntando lo del SIU (Cursada) con lo publicado en HackAI
   (Seguimiento). Cuentas sin lecturas: Hoy lee las dos fuentes y las junta acá.

   - Para una evaluación del SIU que se calificó en HackAI y se publicó, se ve lo
     de HackAI (nota y comentario entero); para una tarea con nota publicada,
     una fila más. Lo del SIU que no pasó por HackAI queda como estaba.
   - La nota de cursada publicada en HackAI es la nota de cursada de la materia
     (`courseGrade`), no una evaluación más.
   - Se empareja por comisión y por el id de la evaluación del SIU.
   - Una nota nueva del SIU que también se publicó en HackAI se cuenta una sola
     vez: la de HackAI. */
import type { PublishedGrade } from '@/lib/core/coursework'
import type { AssessmentGrade, Career, SubjectAssessment, SubjectStanding } from '@/lib/core/studies'

/** La nota publicada como una evaluación de la materia. */
function assessmentOf(g: PublishedGrade, now: string, listed?: SubjectAssessment): SubjectAssessment {
  const date = listed?.date ?? g.date ?? g.publishedAt
  return {
    id: g.refId,
    name: listed?.name ?? g.name,
    kind: listed?.kind ?? null,
    date,
    grade: g.value,
    graded: true,
    past: listed?.past ?? date < now,
    source: 'hackai',
    comment: g.comment === '' ? null : g.comment
  }
}

function withPublishedIn(subject: SubjectStanding, published: PublishedGrade[], now: string): SubjectStanding {
  const inSection = published.filter((g) => g.sectionId === subject.sectionId)
  if (inSection.length === 0) return subject
  const course = inSection.find((g) => g.kind === 'cursada')
  const mine = inSection.filter((g) => g.kind !== 'cursada')
  const withCourse = course?.value != null ? { ...subject, courseGrade: course.value } : subject
  const replaced = withCourse.assessments.map((a) => {
    const found = mine.find((g) => g.kind === 'evaluacion' && g.refId === a.id)
    return found ? assessmentOf(found, now, a) : a
  })
  const listed = (g: PublishedGrade) => replaced.some((a) => a.id === g.refId)
  const extra = mine.filter((g) => !listed(g)).map((g) => assessmentOf(g, now))
  return { ...withCourse, assessments: [...replaced, ...extra].sort((a, b) => a.date.localeCompare(b.date)) }
}

/** La carrera con lo publicado en HackAI puesto en las materias que cursa. Sin nada publicado, la misma carrera. */
export function withPublished(career: Career, published: PublishedGrade[], now: string): Career {
  if (published.length === 0) return career
  return { ...career, subjects: career.subjects.map((s) => withPublishedIn(s, published, now)) }
}

/** Una nota publicada con número como una nota nueva de la campana y de Novedades. */
export const asNewGrade = (g: PublishedGrade): AssessmentGrade => ({
  subjectId: g.subjectId,
  subjectName: g.subjectName,
  assessmentName: g.name,
  grade: g.value,
  date: g.date ?? g.publishedAt,
  loadedAt: g.publishedAt,
  source: 'hackai'
})

/** Las notas nuevas del SIU sin las que ya se publicaron en HackAI (misma materia y misma evaluación). */
export function withoutPublished(siu: AssessmentGrade[], published: PublishedGrade[]): AssessmentGrade[] {
  return siu.filter(
    (g) => !published.some((p) => p.kind === 'evaluacion' && p.subjectId === g.subjectId && p.name === g.assessmentName)
  )
}

/** Las más nuevas primero, por la fecha de carga (o la de la evaluación, si el SIU no dice cuándo se cargó). */
export function newestFirst(grades: AssessmentGrade[]): AssessmentGrade[] {
  const loaded = (g: AssessmentGrade) => g.loadedAt ?? g.date
  return [...grades].sort((a, b) => loaded(b).localeCompare(loaded(a)))
}
