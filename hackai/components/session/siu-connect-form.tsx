'use client'
/* Formulario para entrar con la cuenta real del SIU. Con la extensión de HackAI (ADR 0011), «Iniciar con mi
   cuenta» abre el login de la Austral si hace falta, espera a que la persona entre y conecta el SIU y el Campus
   con sus sesiones, sin copiar nada. Sin extensión, el paso a paso para copiar la sesión. Siempre, qué hace
   HackAI con ella y el consentimiento. Si se le venció la sesión del SIU estando adentro (`expired`), lo avisa y,
   con la extensión, vuelve a entrar solo: ya había dado su consentimiento. */
import { ShieldCheck } from 'lucide-react'
import { startTransition, useActionState, useEffect, useRef, useState } from 'react'
import { connectSiuAction } from '@/app/actions/siu-connect'
import {
  ExtensionHint,
  ManualSteps,
  SignInNotice,
  SubmitButton,
  useHasExtension
} from '@/components/session/extension-sessions'
import { signInWithExtension } from '@/components/session/session-extension'
import { type ConnectState, INITIAL_CONNECT_STATE } from '@/components/session/siu-connect-state'

const STEPS = [
  'Entrá al SIU (siu.austral.edu.ar) con tu cuenta de Microsoft de la Austral, como siempre.',
  'Abrí las herramientas del navegador: Cmd + Opt + I en Mac, F12 en Windows.',
  'En «Application» (o «Almacenamiento»), andá a Cookies › https://siu.austral.edu.ar.',
  'Copiá el valor de la cookie siu_sess__portal_ua_UA y pegalo acá abajo.'
]

const NO_SIU: ConnectState = {
  kind: 'error',
  message:
    'No llegaste a iniciar sesión en el SIU. Volvé a tocar «Iniciar con mi cuenta» y entrá en la pestaña que se abre.'
}

type Props = {
  writes: boolean
  /** A dónde volver al entrar, si no es el inicio. */
  returnTo?: string | null
  /** Si estaba adentro y se le venció la sesión del SIU. */
  expired?: boolean
}

export function SiuConnectForm({ writes, returnTo, expired = false }: Props) {
  const extension = useHasExtension()
  const withExtension = extension === true
  const [state, submit] = useActionState(connectSiuAction, INITIAL_CONNECT_STATE)
  const [local, setLocal] = useState<ConnectState>(INITIAL_CONNECT_STATE)
  const [reentering, setReentering] = useState(false)
  const autoStarted = useRef(false)
  const error = local.kind === 'error' ? local : state

  // Si no pegó nada a mano, la extensión inicia sesión y trae las cookies recién ahora, con el consentimiento dado.
  async function enter(form: FormData) {
    setLocal(INITIAL_CONNECT_STATE)
    if (withExtension && !String(form.get('session') ?? '').trim()) {
      const sessions = await signInWithExtension(['siu', 'campus'])
      if (!sessions?.siu) return setLocal(NO_SIU)
      form.set('session', sessions.siu)
      if (sessions.campus) form.set('campusSession', sessions.campus)
    }
    startTransition(() => submit(form))
  }

  // Con la sesión vencida y la extensión, vuelve a entrar sin que toque nada. Si la sesión de Microsoft sigue abierta,
  // la pestaña del login se abre y se cierra sola.
  // biome-ignore lint/correctness/useExhaustiveDependencies: corre una sola vez, cuando se sabe si está la extensión.
  useEffect(() => {
    if (!expired || !withExtension || autoStarted.current) return
    autoStarted.current = true
    const form = new FormData()
    form.set('consent', 'si')
    if (returnTo) form.set('next', returnTo)
    setReentering(true)
    void enter(form)
  }, [expired, withExtension])

  return (
    <form action={enter} className='flex flex-col gap-5'>
      {returnTo && <input type='hidden' name='next' value={returnTo} />}
      {expired && (
        <p
          role='status'
          className='rounded-2xl border border-border bg-card px-4 py-3.5 text-[0.9375rem] text-pretty text-ink'
        >
          {reentering && error.kind !== 'error'
            ? 'Se venció tu sesión del SIU. Estamos volviendo a entrar con tu cuenta…'
            : 'Se venció tu sesión del SIU. Volvé a entrar y seguís donde estabas.'}
        </p>
      )}
      <ManualSteps folded={withExtension}>
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
            required={!withExtension}
            autoComplete='off'
            spellCheck={false}
            placeholder='Pegá el valor de siu_sess__portal_ua_UA'
            className='h-11 rounded-xl border border-border bg-card px-3 font-mono text-[0.875rem] font-normal focus-ring'
          />
        </label>
      </ManualSteps>
      {extension === false && <ExtensionHint />}

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
          {withExtension && (
            <li>
              Con tu sesión del Campus le pedimos, una sola vez, la clave de su app (la misma que usa la app de Moodle)
              para leer el material, los avisos y tus tareas. No escribimos nada en el Campus y la clave queda cifrada
              en este navegador.
            </li>
          )}
        </ul>
      </div>

      <label className='flex items-start gap-2.5 text-[0.875rem] text-ink'>
        <input type='checkbox' name='consent' value='si' required className='mt-1 size-4 accent-blue' />
        <span>
          {withExtension
            ? 'Entiendo y quiero usar mi cuenta del SIU y mi Campus Virtual en HackAI.'
            : 'Entiendo y quiero usar mi cuenta del SIU en HackAI.'}
        </span>
      </label>

      {error.kind === 'error' && (
        <p role='alert' className='rounded-xl bg-danger-background px-3 py-2.5 text-[0.875rem] text-ink'>
          {error.message}
        </p>
      )}

      <SignInNotice show={withExtension} />
      <SubmitButton
        idle={withExtension ? 'Iniciar con mi cuenta' : 'Entrar con mi cuenta del SIU'}
        busy={withExtension ? 'Esperando que inicies sesión…' : 'Leyendo tu SIU…'}
        disabled={extension === null}
      />
    </form>
  )
}
