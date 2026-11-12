/* El vínculo del canal con Discord. Si está vinculado, lo dice: lo de este
   canal también está en el Discord de la cátedra. El docente que puede
   vincularlo (`canLink`) elige un canal de la lista del servidor conectado, o
   pega el enlace del canal («Copiar enlace», sin modo desarrollador) o su ID;
   HackAI trae lo que ya tenía y desde ahí lo sincroniza en los dos sentidos.
   Es un <details>: se pliega sin JavaScript. Cómo se conecta el servidor y cómo
   sacar el enlace: hackai/docs/discord.md. */
import { ChevronDown, Link2 } from 'lucide-react'
import { linkChannel } from '@/app/actions/spaces'
import { ActionForm, SubmitButton } from '@/components/spaces/action-form'
import { buttonVariants } from '@/components/ui/button'
import type { Channel, ServerChannel } from '@/lib/core/spaces'
import { cn } from '@/lib/utils'

const LINKED = 'Sincronizado con Discord: lo que se publica acá o allá aparece en los dos lados.'

/** Los canales del servidor conectado para elegir, o por qué no se pueden listar. `null` sin servidor. */
export type ServerChoices = { ok: true; channels: ServerChannel[] } | { ok: false; message: string }

const button = cn(buttonVariants({ size: 'sm' }), 'min-h-11 self-start rounded-[10px] px-4 font-bold')
const field = 'min-h-11 rounded-[10px] border border-border bg-card px-3 text-[0.9375rem] font-normal focus-ring'

function Hidden({ subjectId, channelId }: { subjectId: string; channelId: string }) {
  return (
    <>
      <input type='hidden' name='subjectId' value={subjectId} />
      <input type='hidden' name='channelId' value={channelId} />
    </>
  )
}

/** Elegir un canal de texto del servidor conectado. Los vinculados con otro canal de HackAI no se eligen. */
function ChooseChannel({
  subjectId,
  channel,
  choices
}: {
  subjectId: string
  channel: Channel
  choices: ServerChannel[]
}) {
  const categories = [...new Set(choices.map((c) => c.category ?? ''))]
  const current = channel.externalLink?.channelId
  return (
    <ActionForm action={linkChannel} className='flex flex-col gap-2'>
      <Hidden subjectId={subjectId} channelId={channel.id} />
      <label className='flex flex-col gap-1 font-semibold'>
        Elegí un canal de tu servidor
        <select name='discordChannelId' required defaultValue={current ?? ''} className={field}>
          <option value='' disabled>
            Elegí un canal
          </option>
          {categories.map((category) => (
            <optgroup key={category} label={category || 'Sin categoría'}>
              {choices
                .filter((c) => (c.category ?? '') === category)
                .map((c) => {
                  const taken = c.linkedTo !== null && c.linkedTo !== channel.id
                  return (
                    <option key={c.id} value={c.id} disabled={taken}>
                      #{c.name}
                      {taken ? ' (ya vinculado con otro canal)' : ''}
                    </option>
                  )
                })}
            </optgroup>
          ))}
        </select>
      </label>
      <SubmitButton className={button}>{current ? 'Cambiar el canal' : 'Vincular'}</SubmitButton>
    </ActionForm>
  )
}

function PasteChannel({ subjectId, channel }: { subjectId: string; channel: Channel }) {
  const helpId = `discord-ayuda-${channel.id}`
  const linked = channel.externalLink !== null
  return (
    <ActionForm action={linkChannel} className='flex flex-col gap-2'>
      <Hidden subjectId={subjectId} channelId={channel.id} />
      <label className='flex flex-col gap-1 font-semibold'>
        Enlace o ID del canal de Discord
        <input
          name='discordChannelId'
          required
          autoComplete='off'
          spellCheck={false}
          defaultValue={channel.externalLink?.channelId ?? ''}
          aria-describedby={helpId}
          className={field}
        />
        <span id={helpId} className='font-normal text-muted-foreground'>
          En Discord: clic derecho sobre el canal y «Copiar enlace». También sirve el ID del canal. El bot de HackAI
          tiene que estar en el servidor.
        </span>
      </label>
      <SubmitButton className={button}>{linked ? 'Cambiar el canal' : 'Vincular'}</SubmitButton>
    </ActionForm>
  )
}

export function DiscordLink({
  subjectId,
  channel,
  choices = null
}: {
  subjectId: string
  channel: Channel
  choices?: ServerChoices | null
}) {
  const linked = channel.externalLink !== null
  if (!channel.canLink) {
    return linked ? <p className='text-[0.8125rem] text-muted-foreground'>{LINKED}</p> : null
  }

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
      <div className='flex flex-col gap-3 pb-3'>
        {choices?.ok && <ChooseChannel subjectId={subjectId} channel={channel} choices={choices.channels} />}
        {choices && !choices.ok && <p className='text-muted-foreground'>{choices.message}</p>}
        {choices?.ok && <p className='font-semibold text-muted-foreground'>O pegá el canal:</p>}
        <PasteChannel subjectId={subjectId} channel={channel} />
      </div>
    </details>
  )
}
