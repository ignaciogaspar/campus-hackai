'use client'
/* Formulario para conectar el Campus Virtual con la cuenta real (ADR 0010): el
   paso a paso para copiar la sesión del Campus, qué hace HackAI con ella y el
   consentimiento. Es el segundo paso de entrar con la cuenta real, y se puede
   dejar para después. Con la extensión de HackAI (ADR 0011) la sesión no se
   copia: al tocar «Conectar», la extensión abre el login del Campus si hace
   falta, espera a que la persona entre y trae la sesión. */
import { ShieldCheck } from 'lucide-react'
import { startTransition, useActionState, useState } from 'react'
import { connectCampusAction } from '@/app/actions/campus-connect'
import {
  ExtensionHint,
  ManualSteps,
  SignInNotice,
  SubmitButton,
  useHasExtension
} from '@/components/session/extension-sessions'
import { signInWithExtension } from '@/components/session/session-extension'
import { type ConnectState, INITIAL_CONNECT_STATE } from '@/components/session/siu-connect-state'

const NO_CAMPUS: ConnectState = {
  kind: 'error',
  message: 'No llegaste a iniciar sesión en el Campus. Volvé a tocar «Conectar» y entrá en la pestaña que se abre.'
}

const STEPS = [
  'Entrá al Campus Virtual (campusvirtual.austral.edu.ar) con tu cuenta de Microsoft de la Austral, como siempre.',
  'Abrí las herramientas del navegador: Cmd + Opt + I en Mac, F12 en Windows.',
  'En «Application» (o «Almacenamiento»), andá a Cookies › https://campusvirtual.austral.edu.ar.',
  'Copiá el valor de la cookie MoodleSession y pegalo acá abajo.'
]

export function CampusConnectForm({ next }: { next: string | null }) {
  const extension = useHasExtension()
  const withExtension = extension === true
  const [state, submit] = useActionState(connectCampusAction, INITIAL_CONNECT_STATE)
  const [local, setLocal] = useState<ConnectState>(INITIAL_CONNECT_STATE)
  const error = local.kind === 'error' ? local : state

  // Si no pegó nada a mano, la sesión la trae la extensión recién ahora, con el consentimiento ya dado.
  async function connect(form: FormData) {
    setLocal(INITIAL_CONNECT_STATE)
    if (withExtension && !String(form.get('session') ?? '').trim()) {
      const sessions = await signInWithExtension(['campus'])
      if (!sessions?.campus) return setLocal(NO_CAMPUS)
      form.set('session', sessions.campus)
    }
    startTransition(() => submit(form))
  }

  return (
    <form action={connect} className='flex flex-col gap-5'>
      {next && <input type='hidden' name='next' value={next} />}
      <ManualSteps folded={withExtension}>
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
            required={!withExtension}
            autoComplete='off'
            spellCheck={false}
            placeholder='Pegá el valor de MoodleSession'
            className='h-11 rounded-xl border border-border bg-card px-3 font-mono text-[0.875rem] font-normal focus-ring'
          />
        </label>
      </ManualSteps>
      {extension === false && <ExtensionHint />}

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

      {error.kind === 'error' && (
        <p role='alert' className='rounded-xl bg-danger-background px-3 py-2.5 text-[0.875rem] text-ink'>
          {error.message}
        </p>
      )}

      <SignInNotice show={withExtension} />
      <SubmitButton
        idle={withExtension ? 'Conectar con mi cuenta' : 'Conectar mi Campus'}
        busy={withExtension ? 'Esperando que inicies sesión…' : 'Conectando tu Campus…'}
        disabled={extension === null}
      />
    </form>
  )
}
