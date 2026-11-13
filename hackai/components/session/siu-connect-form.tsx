'use client'
/* Formulario para entrar con la cuenta real del SIU: el paso a paso para copiar
   la sesión, qué hace HackAI con ella y el consentimiento. */
import { ShieldCheck } from 'lucide-react'
import { useActionState } from 'react'
import { connectSiuAction } from '@/app/actions/siu-connect'
import { INITIAL_CONNECT_STATE } from '@/components/session/siu-connect-state'
import { Button } from '@/components/ui/button'

const STEPS = [
  'Entrá al SIU (siu.austral.edu.ar) con tu cuenta de Microsoft de la Austral, como siempre.',
  'Abrí las herramientas del navegador: Cmd + Opt + I en Mac, F12 en Windows.',
  'En «Application» (o «Almacenamiento»), andá a Cookies › https://siu.austral.edu.ar.',
  'Copiá el valor de la cookie siu_sess__portal_ua_UA y pegalo acá abajo.'
]

export function SiuConnectForm({ writes }: { writes: boolean }) {
  const [state, submit, pending] = useActionState(connectSiuAction, INITIAL_CONNECT_STATE)

  return (
    <form action={submit} className='flex flex-col gap-5'>
      <ol className='flex list-decimal flex-col gap-2 rounded-2xl border border-border bg-card px-9 py-4 text-[0.875rem] text-ink'>
        {STEPS.map((step) => (
          <li key={step} className='text-pretty'>
            {step}
          </li>
        ))}
      </ol>

      <label className='flex flex-col gap-1.5 text-[0.8125rem] font-semibold text-ink'>
        Tu sesión del SIU
        <input
          name='session'
          required
          autoComplete='off'
          spellCheck={false}
          placeholder='Pegá el valor de siu_sess__portal_ua_UA'
          className='h-11 rounded-xl border border-border bg-card px-3 font-mono text-[0.875rem] font-normal focus-ring'
        />
      </label>

      <div className='flex flex-col gap-2 rounded-2xl bg-accent px-4 py-3 text-[0.8125rem] text-pretty text-ink'>
        <p className='flex items-center gap-2 font-semibold'>
          <ShieldCheck aria-hidden='true' className='size-4 text-blue' />
          Qué hacemos con tu sesión
        </p>
        <ul className='flex list-disc flex-col gap-1 pl-5'>
          <li>La usamos para leer tu SIU en vivo: materias, horarios, notas, carrera y trámites.</li>
          {writes && (
            <li>
              Si vos lo pedís desde HackAI, también para inscribirte, darte de baja o pedir una constancia: siempre con
              tu confirmación.
            </li>
          )}
          <li>Queda cifrada en una cookie de este navegador. No la guardamos en ningún otro lado ni la registramos.</li>
          <li>Vence cuando vence tu sesión del SIU, o cuando salís de HackAI.</li>
        </ul>
      </div>

      <label className='flex items-start gap-2.5 text-[0.875rem] text-ink'>
        <input type='checkbox' name='consent' value='si' required className='mt-1 size-4 accent-blue' />
        <span>Entiendo y quiero usar mi cuenta del SIU en HackAI.</span>
      </label>

      {state.kind === 'error' && (
        <p role='alert' className='rounded-xl bg-danger-background px-3 py-2.5 text-[0.875rem] text-ink'>
          {state.message}
        </p>
      )}

      <Button type='submit' size='lg' disabled={pending} className='min-h-11 self-start font-semibold'>
        {pending ? 'Leyendo tu SIU…' : 'Entrar con mi cuenta del SIU'}
      </Button>
    </form>
  )
}
