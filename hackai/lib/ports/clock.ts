/* Puerto del reloj: la fecha y hora actuales. El de memoria es fijo, para que
   los tests vean siempre el mismo «hoy»; la demo usa el del sistema. */

export type ClockCapabilities = {
  /** La hora no avanza sola. */
  fixed: boolean
}

export type ClockPort = {
  capabilities: ClockCapabilities
  now(): Date
}
