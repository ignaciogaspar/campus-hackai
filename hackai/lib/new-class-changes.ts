/* Los cambios de clase que quien entró todavía no vio, para la campana, la
   barra lateral y Novedades: los de las comisiones que cursa o dicta que Hoy da
   para los próximos días (`classChanges`), sin los que ya vio según la cookie
   (lib/class-changes-seen.ts). Secretaría no cursa ni dicta: no tiene. Si el
   SIU o el Planning no responden, no hay. Solo de servidor. */
import 'server-only'
import { cookies } from 'next/headers'
import { CLASS_CHANGES_SEEN_COOKIE, seenChangesFrom, unseenChanges } from '@/lib/class-changes-seen'
import { system } from '@/lib/composition'
import type { PlanningClass } from '@/lib/core/planning'
import type { Session } from '@/lib/session-token'

export async function classChangesFor(session: Session): Promise<PlanningClass[]> {
  if (session.role === 'secretaria') return []
  const [jar, changes] = await Promise.all([cookies(), system().today.classChanges(session.personId)])
  if (!changes.ok) return []
  return unseenChanges(changes.value, seenChangesFrom(jar.get(CLASS_CHANGES_SEEN_COOKIE)?.value, session.personId))
}
