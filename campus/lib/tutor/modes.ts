// Modos del tutor (puro, apto para client).

export type TutorMode = 'socratico' | 'sparring' | 'examinador' | 'coach'

export const TUTOR_MODES: Array<{ id: TutorMode; label: string; hint: string }> = [
  { id: 'socratico', label: 'Socrático', hint: 'No te da la respuesta: te pregunta hasta que llegás' },
  { id: 'sparring', label: 'Sparring', hint: 'Te lleva la contra para que defiendas tu postura' },
  { id: 'examinador', label: 'Examinador', hint: 'Te toma un oral sobre esta slide' },
  { id: 'coach', label: 'Coach', hint: 'Te ayuda a preparar una intervención en clase' },
]

export function isTutorMode(v: unknown): v is TutorMode {
  return v === 'socratico' || v === 'sparring' || v === 'examinador' || v === 'coach'
}
