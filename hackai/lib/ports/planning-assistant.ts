/* Puerto del asistente del Planning: traduce lo que escribe secretaría
   («suspendé Termodinámica del viernes 13») a cambios del Planning, con un
   modelo de lenguaje. No guarda nada ni decide nada: lo que devuelve lo revisa
   Planning con los mismos chequeos de la planilla y lo confirma secretaría.
   Adaptadores: Claude (lib/adapters/claude/planning-assistant.ts, ADR 0010) y
   en memoria para los tests. */
import type { Result } from '@/lib/result'

/** Una fila del Planning como la escribe el asistente: las columnas de la planilla de ejemplo, todas como texto; lo
    que no aplica, vacío. `fecha` en `AAAA-MM-DD`, `dia` de lunes a sábado sin tilde, horas en `HH:MM`. */
export type AssistantRow = {
  materia: string
  comision: string
  facultad: string
  sede: string
  edificio: string
  modulo: string
  aula: string
  dia: string
  fecha: string
  inicio: string
  fin: string
  estado: string
}

export type AssistantRequest = {
  /** Lo que escribió secretaría. */
  message: string
  /** Hoy, para resolver «el viernes» o «mañana»: «viernes 2026-11-13». */
  today: string
  /** Las clases cargadas, una por línea, con un número corto al principio (`12|Física I|A|…`). */
  catalog: string
}

export type AssistantAnswer = {
  /** Clases para sumar: semanales, cambios de un día, suspensiones o clases extra. */
  altas: AssistantRow[]
  /** Los números del listado de las clases para sacar del Planning. */
  bajas: number[]
  /** Si falta un dato o el pedido es ambiguo, qué preguntarle a secretaría; si no, vacío. */
  pregunta: string
}

/** `rechazado`: el modelo se negó a responder. `respuesta-invalida`: la respuesta no se pudo leer o quedó cortada. */
export type AssistantError = 'falla-externa' | 'rechazado' | 'respuesta-invalida'

export type PlanningAssistantPort = {
  interpret(request: AssistantRequest): Promise<Result<AssistantAnswer, AssistantError>>
}
