/* Entra con una sesión de alumno y otra de docente y pide las pantallas
   principales. Sirve contra el servidor local y contra el deploy. Qué pantallas
   y qué cuenta como falla: lib/demo-base/screens.ts. Guía: README, «Base de la
   demo».

     npm run demo:probar                                  # http://localhost:3000
     npm run demo:probar -- https://<dominio-del-deploy>

   Firma las sesiones con el SESSION_SECRET de .env.local, que tiene que ser el
   mismo del servidor. Nunca lo imprime. Sale con 1 si alguna pantalla falla. */
import { probeScreens } from '@/lib/demo-base/screens'
import { forgeSessionCookie, hasSessionSecret } from '@/lib/session-token'

async function main() {
  const baseUrl = process.argv[2] ?? 'http://localhost:3000'
  if (!/^https?:\/\//.test(baseUrl)) {
    console.error('Uso: npm run demo:probar -- [http://localhost:3000 | https://<dominio>]')
    process.exitCode = 1
    return
  }
  if (!hasSessionSecret()) {
    console.error('Falta SESSION_SECRET en hackai/.env.local: sin ella no se pueden firmar las sesiones.')
    process.exitCode = 1
    return
  }
  console.log(`Probando ${baseUrl}`)
  const results = await probeScreens({ baseUrl, cookieFor: forgeSessionCookie })
  for (const { personId, path, ok, detail } of results) console.log(`${ok ? '✓' : '✗'} ${personId} ${path}: ${detail}`)
  const failed = results.filter((r) => !r.ok).length
  console.log(failed ? `\nFallan ${failed} pantallas.` : '\nTodas las pantallas responden bien.')
  if (failed) process.exitCode = 1
}

main()
