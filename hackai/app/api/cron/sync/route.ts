// Corrida periódica: el cron del hosting la llama para sincronizar todos los
// espacios con sus canales externos, aunque nadie los abra. Pide el secreto de
// CRON_SECRET en `Authorization: Bearer …`; cómo programarla: hackai/README.md,
// «Corrida periódica». Qué responde: lib/periodic-sync.ts.
import { system } from '@/lib/composition'
import { handlePeriodicSync } from '@/lib/periodic-sync'

export const dynamic = 'force-dynamic'

/** El sistema se arma recién con el secreto validado: un pedido sin permiso no toca nada. */
function run(request: Request) {
  return handlePeriodicSync(request, {
    secret: process.env.CRON_SECRET,
    syncAll: () => system().spaces.syncAll(),
    retryAttendancePass: () => system().studies.retryAttendancePass(),
    retryPass: () => system().coursework.retryPass()
  })
}

// Vercel Cron llama con GET; otros crons pueden usar POST.
export const GET = run
export const POST = run
