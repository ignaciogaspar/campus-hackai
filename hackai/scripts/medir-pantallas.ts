/* Servidor local sin otro tráfico. El log del servidor debe incluir medir-consultas.mjs. */
import { readFileSync } from 'node:fs'
import { probeScreens } from '@/lib/demo-base/screens'
import { forgeSessionCookie, hasSessionSecret } from '@/lib/session-token'

const screens = [
  {
    personId: 'p-taguirre',
    role: 'alumno',
    paths: ['/materias', '/calendario', '/inscripciones', '/notas', '/estado', '/novedades']
  },
  { personId: 'p-mledesma', role: 'profesor', paths: ['/hoy'] }
] as const

async function main() {
  const [log, baseUrl = 'http://localhost:3000', onlyPath] = process.argv.slice(2)
  if (!log || !hasSessionSecret() || !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/.test(baseUrl)) {
    throw new Error('Indicá el log del servidor local, su URL y el SESSION_SECRET en .env.local.')
  }

  for (const { personId, role, paths } of screens) {
    for (const path of paths) {
      if (onlyPath && path !== onlyPath) continue
      const offset = readFileSync(log).length
      const started = performance.now()
      const [screen] = await probeScreens({
        baseUrl,
        cookieFor: forgeSessionCookie,
        screens: [{ personId, role, paths: [path] }]
      })
      const elapsed = Math.round(performance.now() - started)
      const queries = [
        ...readFileSync(log)
          .subarray(offset)
          .toString()
          .matchAll(/^consulta-supabase ([a-z_]+) \d+$/gm)
      ]
      const count = (table: string) => queries.filter((query) => query[1] === table).length
      console.log(
        `${path} | ${queries.length} | ${count('siu_persons')} | ${count('space_reads')} | ${elapsed} ms | ${screen.detail}`
      )
      if (!screen.ok) process.exitCode = 1
    }
  }
}

main()
