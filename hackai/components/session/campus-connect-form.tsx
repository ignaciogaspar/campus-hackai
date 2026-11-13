'use client'
/* Formulario para conectar el Campus Virtual con la cuenta real (ADR 0010): el
   paso a paso para copiar la sesión del Campus, qué hace HackAI con ella y el
   consentimiento. Es el segundo paso de entrar con la cuenta real, y se puede
   dejar para después. */
import { ShieldCheck } from 'lucide-react'
import { useActionState } from 'react'
import { connectCampusAction } from '@/app/actions/campus-connect'
import { INITIAL_CONNECT_STATE } from '@/components/session/siu-connect-state'
import { Button } from '@/components/ui/button'

const STEPS = [
  'Entrá al Campus Virtual (campusvirtual.austral.edu.ar) con tu cuenta de Microsoft de la Austral, como siempre.',
  'Abrí las herramientas del navegador: Cmd + Opt + I en Mac, F12 en Windows.',
  'En «Application» (o «Almacenamiento»), andá a Cookies › https://campusvirtual.austral.edu.ar.',
  'Copiá el valor de la cookie MoodleSession y pegalo acá abajo.'
]

export function CampusConnectForm({ next }: { next: string | null }) {
  const [state, submit, pending] = useActionState(connectCampusAction, INITIAL_CONNECT_STATE)

  return (
    <form action={submit} className='flex flex-col gap-5'>
      {next && <input type='hidden' name='next' value={next} />}
      <ol className='flex list-decimal flex-col gap-2 rounded-2xl border border-border bg-card px-9 py-4 text-[0.875rem] text-ink'>
        {STEPS.map((step) => (
          <li key={step} className='text-pretty'>
            {step}
          </li>
        ))}
      </ol>

      <label className='flex flex-col gap-1.5 text-[0.8125rem] font-semibold text-ink'>
        Tu sesión del Campus
        <input
          name='session'
          required
          autoComplete='off'
          spellCheck={false}
          placeholder='Pegá el valor de MoodleSession'
          className='h-11 rounded-xl border border-border bg-card px-3 font-mono text-[0.875rem] font-normal focus-ring'
        />
      </label>

      <div className='flex flex-col gap-2 rounded-2xl bg-accent px-4 py-3 text-[0.8125rem] text-pretty text-ink'>
        <p className='flex items-center gap-2 font-semibold'>
          <ShieldCheck aria-hidden='true' className='size-4 text-blue' />
          Qué hacemos con tu sesión del Campus
        </p>
        <ul className='flex list-disc flex-col gap-1 pl-5'>
          <li>
            La usamos una sola vez, para pedirle al Campus la clave de su app: la misma que usa la app de Moodle en el
            celular. Si ya usás la app, el Campus te da la que tenés.
          </li>
          <li>
            Con esa clave leemos tus cursos: el material, los avisos y tus tareas con su entrega. No entregamos ni
            escribimos nada en el Campus, y abrir algo desde HackAI no lo marca como visto.
          </li>
          <li>
            La clave queda cifrada en una cookie de este navegador: no la guardamos en ningún otro lado ni la
            registramos, y lo que leemos tampoco se guarda.
          </li>
          <li>Se borra cuando salís de HackAI. En el Campus la das de baja en Preferencias › Claves de seguridad.</li>
        </ul>
      </div>

      <label className='flex items-start gap-2.5 text-[0.875rem] text-ink'>
        <input type='checkbox' name='consent' value='si' required className='mt-1 size-4 accent-blue' />
        <span>Entiendo y quiero ver mi Campus Virtual en HackAI.</span>
      </label>

      {state.kind === 'error' && (
        <p role='alert' className='rounded-xl bg-danger-background px-3 py-2.5 text-[0.875rem] text-ink'>
          {state.message}
        </p>
      )}

      <Button type='submit' size='lg' disabled={pending} className='min-h-11 self-start font-semibold'>
        {pending ? 'Conectando tu Campus…' : 'Conectar mi Campus'}
      </Button>
    </form>
  )
}
