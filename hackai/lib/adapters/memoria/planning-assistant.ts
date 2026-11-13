/* Asistente del Planning en memoria, para los tests: devuelve la respuesta que
   se le cargue para cada mensaje y anota cada pedido, así un test puede ver qué
   llegó al modelo y cuántas veces se lo llamó. Sin respuesta cargada para un
   mensaje, devuelve `falla-externa`. */
import type {
  AssistantAnswer,
  AssistantError,
  AssistantRequest,
  PlanningAssistantPort
} from '@/lib/ports/planning-assistant'
import { fail, ok, type Result } from '@/lib/result'

export type MemoryPlanningAssistant = PlanningAssistantPort & {
  /** Los pedidos que recibió, en orden. */
  requests: AssistantRequest[]
}

export function createMemoryPlanningAssistant(
  answers: Record<string, AssistantAnswer | AssistantError>
): MemoryPlanningAssistant {
  const requests: AssistantRequest[] = []
  return {
    requests,
    async interpret(request): Promise<Result<AssistantAnswer, AssistantError>> {
      requests.push(request)
      const answer = answers[request.message]
      if (answer === undefined) return fail('falla-externa')
      return typeof answer === 'string' ? fail(answer) : ok(structuredClone(answer))
    }
  }
}
