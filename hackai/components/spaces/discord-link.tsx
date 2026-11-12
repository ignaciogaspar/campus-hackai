/* El vínculo del canal con Discord. Si está vinculado, lo dice: lo de este
   canal también está en el Discord de la cátedra. El docente que puede
   vincularlo (`canLink`) pega el ID de un canal de Discord; HackAI trae lo que
   ya tenía y desde ahí lo sincroniza en los dos sentidos. Es un <details>: se
   pliega sin JavaScript. Cómo sacar el ID: hackai/docs/discord.md. */
import { ChevronDown, Link2 } from 'lucide-react'
import { linkChannel } from '@/app/actions/spaces'
import { ActionForm, SubmitButton } from '@/components/spaces/action-form'
import { buttonVariants } from '@/components/ui/button'
import type { Channel } from '@/lib/core/spaces'
import { cn } from '@/lib/utils'

const LINKED = 'Sincronizado con Discord: lo que se publica acá o allá aparece en los dos lados.'

export function DiscordLink({ subjectId, channel }: { subjectId: string; channel: Channel }) {
  const linked = channel.externalLink !== null
  if (!channel.canLink) {
    return linked ? <p className='text-[0.8125rem] text-muted-foreground'>{LINKED}</p> : null
  }
  const helpId = `discord-ayuda-${channel.id}`

  return (
    <details className='group rounded-[14px] bg-card px-3 text-[0.8125rem] shadow-card'>
      <summary className='flex min-h-11 cursor-pointer list-none items-center gap-2 py-2 focus-ring [&::-webkit-details-marker]:hidden'>
        <Link2 aria-hidden='true' className='size-4 flex-none text-blue' strokeWidth={2} />
        <span className='min-w-0 flex-1'>
          {linked ? (
            <>
              <span className='text-muted-foreground'>{LINKED} </span>
              <span className='font-bold text-blue'>Cambiar el canal</span>
            </>
          ) : (
            <span className='font-bold text-blue'>Vincular con un canal de Discord</span>
          )}
        </span>
        <ChevronDown
          aria-hidden='true'
          className='size-4 flex-none text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none'
        />
      </summary>
      <ActionForm action={linkChannel} className='flex flex-col gap-2 pb-3'>
        <input type='hidden' name='subjectId' value={subjectId} />
        <input type='hidden' name='channelId' value={channel.id} />
        <label className='flex flex-col gap-1 font-semibold'>
          ID del canal de Discord
          <input
            name='discordChannelId'
            required
            inputMode='numeric'
            autoComplete='off'
            pattern='[0-9]{17,20}'
            defaultValue={channel.externalLink?.channelId ?? ''}
            aria-describedby={helpId}
            className='min-h-11 rounded-[10px] border border-border bg-card px-3 text-[0.9375rem] font-normal focus-ring'
          />
          <span id={helpId} className='font-normal text-muted-foreground'>
            En Discord, con el modo desarrollador activo: clic derecho sobre el canal y «Copiar ID del canal». El bot de
            HackAI tiene que estar en el servidor.
          </span>
        </label>
        <SubmitButton
          className={cn(buttonVariants({ size: 'sm' }), 'min-h-11 self-start rounded-[10px] px-4 font-bold')}
        >
          {linked ? 'Cambiar el canal' : 'Vincular'}
        </SubmitButton>
      </ActionForm>
    </details>
  )
}
