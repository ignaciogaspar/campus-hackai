/* Caer y levantar el SIU o Moodle en la demo (README, «Mostrar una caída en
   la demo»). Solo existe con `HACKAI_CAIDAS=si`: sin el interruptor no hace
   nada. Pide sesión, como cualquier pantalla de la app. */
'use server'

import { redirect } from 'next/navigation'
import { requireSession } from '@/lib/auth'
import { isOutageSystem, type OutageSystem, system } from '@/lib/composition'

/** Deja `target` caído (`down`) o respondiendo, y vuelve a la página de caídas. */
export async function setOutage(target: OutageSystem, down: boolean): Promise<void> {
  await requireSession()
  const outages = system().outages
  // Lo que llega a una server action viene del navegador: el tipo no lo garantiza.
  if (outages && isOutageSystem(target) && typeof down === 'boolean') {
    outages.set(target, down)
    console.info('demo: caída', { system: target, down })
  }
  redirect('/caidas')
}
