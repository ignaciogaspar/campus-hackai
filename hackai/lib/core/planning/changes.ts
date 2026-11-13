/* Qué clase del Planning le importa a quien cursa o dicta una comisión: las
   que ese día cambiaron de aula u horario o se suspendieron. Una clase extra no
   se avisa: no cambia nada de lo que ya tenía. La comisión se reconoce por la
   materia, el nombre de la comisión y la facultad escritos igual, sin importar
   tildes ni mayúsculas, porque el Planning lo escribe secretaría a mano y no
   trae los ids del SIU. */
import type { PlanningClass, PlanningSection } from '@/lib/core/planning'
import { plainText } from '@/lib/plain-text'

const same = (a: string, b: string) => plainText(a) === plainText(b)

/** La misma comisión. Una clase sin facultad vale para la comisión de cualquier facultad. */
const sameSection = (c: PlanningClass, s: PlanningSection) =>
  same(c.subject, s.subject) && same(c.section ?? '', s.section ?? '') && (!c.school || same(c.school, s.school))

export const isChangeOf = (c: PlanningClass, sections: PlanningSection[]) =>
  (c.change === 'cambio' || c.change === 'suspendida') && sections.some((s) => sameSection(c, s))
