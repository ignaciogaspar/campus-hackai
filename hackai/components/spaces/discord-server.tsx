/* El Discord de la cátedra, para el docente que gestiona el espacio: «Conectar con Discord» lleva a la
   autorización de Discord (app/discord/conectar), donde elige su servidor y agrega el bot; con el servidor
   conectado, «Crear canales en Discord» crea allá los canales que gestiona y los deja sincronizados. Arriba,
   cómo volvió de Discord (`?discord=`). Quién puede hacer qué lo decide Espacios; acá solo se muestra. */
import { MessageSquareShare } from 'lucide-react'
import { createDiscordChannels } from '@/app/actions/spaces'
import { ActionForm, SubmitButton } from '@/components/spaces/action-form'
import { DISCORD_NOTICES, type DiscordNotice } from '@/components/spaces/discord-format'
import { buttonVariants } from '@/components/ui/button'
import type { ExternalServer } from '@/lib/core/spaces'
import { cn } from '@/lib/utils'

export type DiscordServerProps = {
  subjectId: string
  spaceId: string
  /** Si esta instalación puede conectar con Discord (la aplicación de Discord está configurada). */
  canConnect: boolean
  server: ExternalServer | null
  /** Canales del espacio que la persona puede vincular y todavía no están vinculados. */
  unlinked: number
  notice: DiscordNotice | null
}

const button = cn(buttonVariants({ size: 'sm' }), 'min-h-11 self-start rounded-[10px] px-4 font-bold')

function Notice({ notice }: { notice: DiscordNotice }) {
  const good = notice === 'conectado'
  return (
    <p role={good ? 'status' : 'alert'} className={cn('font-semibold', good ? 'text-success' : 'text-destructive')}>
      {DISCORD_NOTICES[notice]}
    </p>
  )
}

function ConnectLink({ subjectId, spaceId, again }: { subjectId: string; spaceId: string; again: boolean }) {
  const href = `/discord/conectar?${new URLSearchParams({ espacio: spaceId, materia: subjectId })}`
  // Un <a> y no un <Link>: es una ruta que redirige a Discord, y precargarla abriría una autorización.
  return (
    <a href={href} className={again ? 'self-start font-bold text-blue underline focus-ring' : button}>
      {again ? 'Conectar otro servidor' : 'Conectar con Discord'}
    </a>
  )
}

export function DiscordServer({ subjectId, spaceId, canConnect, server, unlinked, notice }: DiscordServerProps) {
  if (!server && !canConnect && !notice) return null

  return (
    <section
      aria-label='Discord de la cátedra'
      className='flex flex-col gap-2 rounded-[14px] bg-card p-3 text-[0.8125rem] shadow-card'
    >
      <div className='flex items-center gap-2 font-bold'>
        <MessageSquareShare aria-hidden='true' className='size-4 flex-none text-blue' strokeWidth={2} />
        Discord de la cátedra
      </div>
      {notice && <Notice notice={notice} />}
      {!server && canConnect && (
        <>
          <p className='text-muted-foreground'>
            Conectá la materia con el servidor de Discord de tu cátedra: elegís el servidor, HackAI agrega su bot y
            después crea los canales con un toque.
          </p>
          <ConnectLink subjectId={subjectId} spaceId={spaceId} again={false} />
        </>
      )}
      {server && unlinked > 0 && (
        <ActionForm action={createDiscordChannels} className='flex flex-col gap-2'>
          <input type='hidden' name='subjectId' value={subjectId} />
          <input type='hidden' name='spaceId' value={spaceId} />
          <p className='text-muted-foreground'>
            Conectada con tu servidor. HackAI crea una categoría con el nombre de la materia y adentro tus canales
            (#material, #avisos y #consultas de tus comisiones), ya sincronizados. En avisos y material escriben solo
            los docentes; en consultas, todos.
          </p>
          <SubmitButton className={button}>Crear canales en Discord</SubmitButton>
        </ActionForm>
      )}
      {server && unlinked === 0 && (
        <p className='text-muted-foreground'>Conectada con tu servidor: tus canales ya están sincronizados.</p>
      )}
      {server && canConnect && <ConnectLink subjectId={subjectId} spaceId={spaceId} again />}
    </section>
  )
}
