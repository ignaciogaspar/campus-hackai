/* Cómo se evalúa una comisión: las instancias de examen (las del SIU, con el
   nombre, el tipo y la fecha que les corrige el docente, y las que suma en
   HackAI), los pesos de las columnas y si la materia se promociona. Se importa
   solo desde ./gradebook.ts, que le pasa cómo leer la comisión y sus columnas. */
import type {
  AccessError,
  Coursework,
  CourseworkDeps,
  ExamError,
  ExamInput,
  ExamInstance,
  ExamKind,
  StoredExam,
  StoredGrade
} from '@/lib/core/coursework'
import { chooseTeaching, oldest, sectionOf, sectionsOf, subjectOf } from '@/lib/core/coursework/access'
import { isPromotionMinimum, promotionOr, weightOf, weightsById } from '@/lib/core/coursework/course-grade'
import { type ColumnDef, columnId, columnWith, inColumn, isGraded, parseColumnId } from '@/lib/core/coursework/grades'
import { MAX_NAME } from '@/lib/core/coursework/tasks'
import type { PersonId } from '@/lib/core/people'
import type { MySection } from '@/lib/core/studies'
import { fail, ok, type Result } from '@/lib/result'

const EXAM_KINDS: ExamKind[] = ['parcial', 'recuperatorio', 'integrador']

type Teaching = { section: MySection; staleSince: string | null }

/** Lo que gradebook.ts ya sabe leer: la comisión que dicta el docente y sus columnas. */
export type EvaluationReads = {
  teachingSection(personId: PersonId, sectionId: string): Promise<Result<Teaching, AccessError | 'solo-docentes'>>
  columnsOf(
    personId: PersonId,
    section: MySection
  ): Promise<Result<{ defs: ColumnDef[]; staleSince: string | null }, AccessError>>
}

/** El nombre, el tipo y la fecha que manda el docente, ya limpios, o por qué no sirven. */
function checkedExam(input: ExamInput): Result<Pick<StoredExam, 'kind' | 'name' | 'date'>, ExamError> {
  const name = input.name.trim()
  if (name === '' || name.length > MAX_NAME) return fail('nombre-invalido')
  if (!EXAM_KINDS.includes(input.kind)) return fail('tipo-invalido')
  const date = new Date(input.date)
  if (Number.isNaN(date.getTime())) return fail('fecha-invalida')
  return ok({ name, kind: input.kind, date: date.toISOString() })
}

/** Cómo ve el docente una columna de evaluación o de instancia propia. */
function instanceOf(def: ColumnDef, grades: StoredGrade[], fixed: Set<string>): ExamInstance {
  const graded = grades.filter((g) => inColumn(g, def) && isGraded(g)).length
  const own = def.kind === 'examen'
  return {
    columnId: columnId(def.kind, def.refId),
    source: own ? 'hackai' : 'siu',
    kind: def.assessmentKind ?? 'parcial',
    name: def.name,
    date: def.date,
    edited: !own && fixed.has(def.refId),
    graded,
    canDelete: own && !grades.some((g) => inColumn(g, def))
  }
}

const isExamColumn = (def: ColumnDef) => def.kind === 'evaluacion' || def.kind === 'examen'

export function createEvaluation({ studies, store }: CourseworkDeps, reads: EvaluationReads) {
  const evaluation: Coursework['evaluation'] = async (personId, subjectId, sectionId) => {
    const read = await sectionsOf(studies, personId)
    if (!read.ok) return read
    const chosen = chooseTeaching(read.value.sections, subjectId, sectionId)
    if (!chosen.ok) return chosen
    const { shown, selected } = chosen.value
    const [columns, grades, weights, exams, promotion] = await Promise.all([
      reads.columnsOf(personId, selected),
      store.gradesOfSection(selected.sectionId),
      store.weightsOfSection(selected.sectionId),
      store.examsOfSection(selected.sectionId),
      store.promotionOf(selected.sectionId)
    ])
    if (!columns.ok) return columns
    if (!grades.ok) return grades
    if (!weights.ok) return weights
    if (!exams.ok) return exams
    if (!promotion.ok) return promotion
    const byId = weightsById(weights.value)
    const validIds = new Set(columns.value.defs.map((d) => columnId(d.kind, d.refId)))
    const fixed = new Set(exams.value.flatMap((e) => (e.siuAssessmentId ? [e.siuAssessmentId] : [])))
    return ok({
      subject: subjectOf(selected),
      sections: shown.map(sectionOf),
      sectionId: selected.sectionId,
      exams: columns.value.defs.filter(isExamColumn).map((d) => instanceOf(d, grades.value, fixed)),
      columns: columns.value.defs.map((d) => columnWith(d, grades.value, weightOf(byId, d.kind, d.refId))),
      weightTotal: [...byId].filter(([id]) => validIds.has(id)).reduce((sum, [, w]) => sum + w, 0),
      promotion: promotionOr(promotion.value, selected),
      staleSince: oldest([read.value.staleSince, columns.value.staleSince])
    })
  }

  /** La columna de evaluación o de instancia propia que pide el docente, en una comisión que dicta. */
  async function examColumn(
    personId: PersonId,
    sectionId: string,
    id: string
  ): Promise<Result<{ def: ColumnDef; grades: StoredGrade[] }, AccessError | ExamError>> {
    const teaching = await reads.teachingSection(personId, sectionId)
    if (!teaching.ok) return teaching
    const wanted = parseColumnId(id)
    const columns = await reads.columnsOf(personId, teaching.value.section)
    if (!columns.ok) return columns
    const def = wanted && columns.value.defs.find((d) => d.kind === wanted.kind && d.refId === wanted.refId)
    if (!def || !isExamColumn(def)) return fail('columna-desconocida')
    const grades = await store.gradesOfSection(sectionId)
    if (!grades.ok) return grades
    return ok({ def, grades: grades.value })
  }

  type Checked = Pick<StoredExam, 'kind' | 'name' | 'date'>

  /** Una instancia propia nueva, en una comisión que dicta el docente. */
  async function createOwn(
    personId: PersonId,
    sectionId: string,
    exam: Checked
  ): Promise<Result<ExamInstance, AccessError | ExamError>> {
    const teaching = await reads.teachingSection(personId, sectionId)
    if (!teaching.ok) return teaching
    const saved = await store.saveExam({ ...exam, sectionId, siuAssessmentId: null })
    if (!saved.ok) return saved
    const def: ColumnDef = {
      kind: 'examen',
      refId: saved.value.id,
      name: exam.name,
      date: exam.date,
      assessmentKind: exam.kind
    }
    return ok(instanceOf(def, [], new Set()))
  }

  /** Corrige una instancia que ya es columna: la propia se reemplaza; a la del SIU se le guarda la corrección. */
  async function fixExisting(
    personId: PersonId,
    sectionId: string,
    columnId: string,
    exam: Checked
  ): Promise<Result<ExamInstance, AccessError | ExamError>> {
    const found = await examColumn(personId, sectionId, columnId)
    if (!found.ok) return found
    const { def, grades } = found.value
    const own = def.kind === 'examen'
    const saved = await store.saveExam(
      own
        ? { ...exam, id: def.refId, sectionId, siuAssessmentId: null }
        : { ...exam, sectionId, siuAssessmentId: def.refId }
    )
    if (!saved.ok) return saved
    const changed: ColumnDef = { ...def, name: exam.name, date: exam.date, assessmentKind: exam.kind }
    return ok(instanceOf(changed, grades, own ? new Set() : new Set([def.refId])))
  }

  const saveExam: Coursework['saveExam'] = async (personId, input) => {
    const checked = checkedExam(input)
    if (!checked.ok) return checked
    return input.columnId === undefined
      ? createOwn(personId, input.sectionId, checked.value)
      : fixExisting(personId, input.sectionId, input.columnId, checked.value)
  }

  const deleteExam: Coursework['deleteExam'] = async (personId, sectionId, id) => {
    const found = await examColumn(personId, sectionId, id)
    if (!found.ok) return found
    const { def, grades } = found.value
    if (def.kind !== 'examen') return fail('columna-desconocida')
    if (grades.some((g) => inColumn(g, def))) return fail('examen-con-notas')
    const weight = await store.saveWeight({ sectionId, kind: def.kind, refId: def.refId }, null)
    if (!weight.ok) return weight
    return store.deleteExam(def.refId)
  }

  const setPromotion: Coursework['setPromotion'] = async (personId, sectionId, promotion) => {
    const teaching = await reads.teachingSection(personId, sectionId)
    if (!teaching.ok) return teaching
    if (!isPromotionMinimum(promotion.minimum)) return fail('nota-invalida')
    return store.savePromotion(sectionId, {
      promotable: promotion.promotable,
      minimum: Math.round(promotion.minimum * 100) / 100
    })
  }

  return { evaluation, saveExam, deleteExam, setPromotion }
}
