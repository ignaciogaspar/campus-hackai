/* «Escribirle» a una persona: abre el canal directo con ella, o el que ya
   hay, y lleva a él. Solo se muestra para los contactos que da Espacios
   (`viewer.directContacts`); si igual no se puede (el SIU no responde), el
   motivo aparece debajo. Lo usan la pestaña Directos y el panel de contexto. */
import { MessageSquarePlus } from 'lucide-react'
import { openDirect } from '@/app/actions/spaces'
import { ActionForm, SubmitButton } from '@/components/spaces/action-form'
import type { SpaceRef } from '@/components/spaces/format'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function StartDirect({
  space,
  personId,
  name,
  compact = false
}: {
  space: SpaceRef
  personId: string
  name: string
  /** Solo el ícono, como en el panel de contexto. */
  compact?: boolean
}) {
  return (
    <ActionForm action={openDirect} className='flex flex-col items-end gap-1'>
      <input type='hidden' name='subjectId' value={space.subjectId} />
      <input type='hidden' name='spaceId' value={space.spaceId} />
      <input type='hidden' name='otherPersonId' value={personId} />
      <SubmitButton
        aria-label={compact ? `Escribirle a ${name}` : undefined}
        title={compact ? `Escribirle a ${name}` : undefined}
        className={cn(
          buttonVariants({ variant: compact ? 'ghost' : 'outline', size: 'sm' }),
          compact ? 'size-11 rounded-full p-0 text-blue' : 'h-11 rounded-[10px] px-3'
        )}
      >
        <MessageSquarePlus aria-hidden='true' strokeWidth={1.8} className={compact ? 'size-5' : undefined} />
        {!compact && 'Escribirle'}
      </SubmitButton>
    </ActionForm>
  )
}
