/* Lo que pide cada carrera además de las obligatorias: los créditos de vida
   universitaria y las horas de optativas o seminarios. En producción lo carga
   un administrador por carrera; el SIU no lo expone. Por ahora es un valor
   fijo para la demo (hipótesis 23 de docs/product/preguntas-abiertas.md):
   10 créditos de vida universitaria y 64 horas por cada optativa que pide el
   plan. */

export type CareerRequirements = {
  /** Créditos de vida universitaria que pide la carrera. */
  universityLifeCredits: number
  /** Horas que cuenta cada optativa o seminario aprobado. */
  hoursPerElective: number
}

export const MOCK_REQUIREMENTS: CareerRequirements = { universityLifeCredits: 10, hoursPerElective: 64 }

/** Lo que pide la carrera. Todas piden lo mismo hasta que lo configure un administrador. */
export function requirementsOf(_programId: string | null): CareerRequirements {
  return MOCK_REQUIREMENTS
}
