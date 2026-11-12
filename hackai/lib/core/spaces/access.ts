/* Quién está en un espacio y qué puede hacer en cada canal. La membresía no se
   guarda: sale de las comisiones que da Cursada, así que quien se inscribe ya
   está adentro. Todo acá es puro salvo `membershipOf`, que lee Cursada. */
import type { PersonId, Role } from '@/lib/core/people'
import type { AccessError, SpaceSection, SpaceViewer, StoredChannel, StoredSpace } from '@/lib/core/spaces'
import type { MySection, Studies } from '@/lib/core/studies'
import { fail, ok, type Result } from '@/lib/result'

/** Las comisiones de una persona en una materia y facultad, y con qué lectura de Cursada salieron. */
export type Membership = {
  personId: PersonId
  role: Role
  subjectId: string
  subjectCode: string
  subjectName: string
  schoolId: string
  /** Actuales primero, en el orden de Cursada. Nunca vacío. */
  sections: MySection[]
  staleSince: string | null
}

/** Sus comisiones, como las da Cursada. Cualquier error que no sea una persona desconocida es una falla externa. */
export async function sectionsOf(
  studies: Studies,
  personId: PersonId
): Promise<Result<{ sections: MySection[]; staleSince: string | null }, 'persona-desconocida' | 'falla-externa'>> {
  const read = await studies.sectionsOf(personId)
  if (!read.ok) return fail(read.error === 'persona-desconocida' ? 'persona-desconocida' : 'falla-externa')
  return ok({ sections: read.value.data, staleSince: read.value.stale ? read.value.readAt : null })
}

/** La membresía de la persona en una materia. Sin `schoolId`, la facultad es la
    de su primera comisión de la materia (las actuales vienen primero).

    Alcanza para las rutas `/materias/[subjectId]`, que no llevan la facultad:
    - Un alumno solo tiene comisiones de su facultad, porque Cursada ya las
      filtra, así que su primera comisión es siempre la de su facultad.
    - En el set sintético ningún docente dicta la misma materia en dos facultades.
    - Con datos reales, un docente que la dicta en dos facultades necesitaría la
      facultad en la ruta (`/materias/[subjectId]`) para elegir el espacio. */
export async function membershipOf(
  studies: Studies,
  personId: PersonId,
  subjectId: string,
  schoolId?: string
): Promise<Result<Membership, AccessError>> {
  const read = await sectionsOf(studies, personId)
  if (!read.ok) return read
  const ofSubject = read.value.sections.filter((s) => s.subjectId === subjectId)
  const school = schoolId ?? ofSubject[0]?.schoolId
  const sections = ofSubject.filter((s) => s.schoolId === school)
  if (sections.length === 0) return fail('sin-acceso')
  return ok(membershipFrom(personId, sections, read.value.staleSince))
}

/** Arma la membresía con comisiones que ya se sabe que son de una misma materia y facultad. */
export function membershipFrom(personId: PersonId, sections: MySection[], staleSince: string | null): Membership {
  const [first] = sections
  return {
    personId,
    role: first.role,
    subjectId: first.subjectId,
    subjectCode: first.subjectCode,
    subjectName: first.subjectName,
    schoolId: first.schoolId,
    sections,
    staleSince
  }
}

export function membershipInSpace(
  studies: Studies,
  personId: PersonId,
  space: StoredSpace
): Promise<Result<Membership, AccessError>> {
  return membershipOf(studies, personId, space.subjectId, space.schoolId)
}

export function hasSection(member: Membership, sectionId: string): boolean {
  return member.sections.some((s) => s.sectionId === sectionId)
}

/** Docente de una comisión actual del espacio: crea canales de la materia y
    sube y organiza el material. Quien la dictó en un cuatrimestre que ya
    terminó sigue viendo el espacio, pero no lo gestiona. */
export function canManage(member: Membership): boolean {
  return member.role === 'profesor' && member.sections.some((s) => s.current)
}

/** Docente de esa comisión, actual o archivada: escribe en sus `#avisos` y resuelve sus consultas. */
export function teachesSection(member: Membership, sectionId: string): boolean {
  return member.role === 'profesor' && hasSection(member, sectionId)
}

/** Los de la materia los ven todos; los de una comisión, quienes la tienen; los directos, sus dos personas. */
export function sees(member: Membership, channel: StoredChannel): boolean {
  const { scope } = channel
  if (scope.kind === 'materia') return true
  if (scope.kind === 'comision') return hasSection(member, scope.sectionId)
  return scope.personIds.includes(member.personId)
}

/** En `#avisos`, solo los docentes de la comisión; en el material, nadie; en el resto, quien lo ve. */
export function postRefusal(member: Membership, channel: StoredChannel): 'solo-docentes' | 'sin-mensajes' | null {
  if (channel.kind === 'material') return 'sin-mensajes'
  if (channel.kind !== 'avisos') return null
  return channel.scope.kind === 'comision' && teachesSection(member, channel.scope.sectionId) ? null : 'solo-docentes'
}

/** Resuelven consultas los docentes de la comisión del canal, o de cualquier comisión si el canal es de la materia. */
export function canResolve(member: Membership, channel: StoredChannel): boolean {
  if (channel.kind === 'material') return false
  if (channel.scope.kind === 'materia') return canManage(member)
  if (channel.scope.kind === 'comision') return teachesSection(member, channel.scope.sectionId)
  return false
}

/** Vinculan un canal con el canal externo los docentes que lo gestionan: los de la
    materia si es de la materia, los de la comisión si es de una comisión. Los directos no se vinculan. */
export function canLink(member: Membership, channel: StoredChannel): boolean {
  if (channel.scope.kind === 'materia') return canManage(member)
  if (channel.scope.kind === 'comision') return teachesSection(member, channel.scope.sectionId)
  return false
}

export function viewerOf(member: Membership): SpaceViewer {
  return {
    personId: member.personId,
    role: member.role,
    sections: member.sections.map(
      (s): SpaceSection => ({
        sectionId: s.sectionId,
        name: s.name,
        termName: s.termName,
        current: s.current,
        teachers: s.teachers.map((t) => ({ personId: t.personId, name: t.name }))
      })
    ),
    canManage: canManage(member)
  }
}
