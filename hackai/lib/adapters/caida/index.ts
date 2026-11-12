/* Caídas para la demo: envuelven al adaptador del SIU o del aula virtual y,
   mientras su sistema está «caído», cada consulta devuelve `falla-externa`,
   como un SIU o un Moodle que no responden. Sirven para mostrar en vivo que
   HackAI sigue andando con lo último leído (README, «Mostrar una caída en la
   demo»).

   No tocan el núcleo: Cursada y Espacios ven un puerto que falla, igual que
   con un sistema real caído. Lo que no consulta nada (las capacidades, el
   enlace a la Autogestión o al aula) sigue respondiendo. El interruptor vive
   en la memoria del proceso y lo arma `composition` solo si `HACKAI_CAIDAS`
   lo pide: en producción no existe. */
import type { ClassroomPort } from '@/lib/ports/classroom'
import type { SiuPort } from '@/lib/ports/siu'
import { type Fail, fail } from '@/lib/result'

/** Los sistemas de origen que se pueden «caer». */
export type OutageSystem = 'siu' | 'moodle'

export type OutageState = Record<OutageSystem, boolean>

export type OutageSwitch = {
  /** Qué sistema está caído. */
  state(): OutageState
  /** Cae o levanta un sistema. */
  set(system: OutageSystem, down: boolean): void
}

export function createOutageSwitch(initial: Partial<OutageState> = {}): OutageSwitch {
  const current: OutageState = { siu: false, moodle: false, ...initial }
  return {
    state: () => ({ ...current }),
    set(system, down) {
      current[system] = down
    }
  }
}

type Down = Fail<'falla-externa'>

/** Una operación que, con el sistema caído, devuelve `falla-externa` sin llamar al adaptador. */
function guarded<A extends unknown[], R>(
  isDown: () => boolean,
  operation: (...args: A) => Promise<R>
): (...args: A) => Promise<R | Down> {
  return (...args) => (isDown() ? Promise.resolve(fail('falla-externa')) : operation(...args))
}

/** El SIU, que se cae cuando el interruptor lo dice. */
export function withSiuOutage(siu: SiuPort, outages: OutageSwitch): SiuPort {
  const down = () => outages.state().siu
  return {
    capabilities: siu.capabilities,
    person: guarded(down, siu.person),
    terms: guarded(down, siu.terms),
    subject: guarded(down, siu.subject),
    section: guarded(down, siu.section),
    sections: guarded(down, siu.sections),
    teacherSections: guarded(down, siu.teacherSections),
    courseEnrollments: guarded(down, siu.courseEnrollments),
    examBoards: guarded(down, siu.examBoards),
    examEnrollments: guarded(down, siu.examEnrollments),
    assessments: guarded(down, siu.assessments),
    history: guarded(down, siu.history),
    studyPlan: guarded(down, siu.studyPlan),
    provisionalResults: guarded(down, siu.provisionalResults),
    meetsCertificateConditions: guarded(down, siu.meetsCertificateConditions),
    enroll: guarded(down, siu.enroll),
    drop: guarded(down, siu.drop),
    selfServiceUrl: siu.selfServiceUrl
  }
}

/** El aula virtual (Moodle), que se cae cuando el interruptor lo dice. */
export function withClassroomOutage(classroom: ClassroomPort, outages: OutageSwitch): ClassroomPort {
  const down = () => outages.state().moodle
  return {
    capabilities: classroom.capabilities,
    coursesOf: guarded(down, classroom.coursesOf),
    coursesForSection: guarded(down, classroom.coursesForSection),
    enrol: guarded(down, classroom.enrol),
    unenrol: guarded(down, classroom.unenrol),
    announcements: guarded(down, classroom.announcements),
    contents: guarded(down, classroom.contents),
    assignments: guarded(down, classroom.assignments),
    courseUrl: classroom.courseUrl
  }
}
