/* Chequeo de salud: lo que responde `/api/health` a Docker, al hosting y a la
   prueba de humo de CI. Responde ok solo si el sistema se puede armar con los
   adaptadores que piden las variables de entorno. No toca la base ni los
   sistemas de origen: armar el sistema no hace pedidos, así que una base caída
   no lo baja. Lo que sí detecta es una configuración rota, por ejemplo un
   adaptador desconocido o una variable que falta. */

export type HealthDeps = {
  log?: (message: string) => void
}

/** Arma el sistema con `build` y responde 200 si se pudo o 503 si no. El
    motivo va al log y no a la respuesta: los errores de `compose` nombran la
    variable que falta, nunca su valor. */
export function healthResponse(build: () => unknown, { log = console.error }: HealthDeps = {}): Response {
  try {
    build()
    return Response.json({ status: 'ok' })
  } catch (error) {
    log(`[salud] el sistema no se puede armar: ${error instanceof Error ? error.message : 'error desconocido'}`)
    return Response.json({ status: 'error', reason: 'configuracion' }, { status: 503 })
  }
}
