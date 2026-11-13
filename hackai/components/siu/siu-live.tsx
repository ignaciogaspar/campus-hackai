'use client'

/* Mantiene al día la pantalla de la cuenta real del SIU sin que haya que
   recargar, y avisa en el momento cuando suben una nota. Cada 10 segundos, con
   la pestaña a la vista, pregunta la huella de lo que muestra el SIU
   (app/api/siu/version), que es liviana; si cambió (una nota, un cupo, una
   inscripción), vuelve a pedir la página y revisa las notas
   (app/api/siu/notas). Una nota que no conocía se avisa con una notificación del
   sistema, si el alumno la permitió; para pedir el permiso hace falta un clic,
   así que ofrece un botón. Si un chequeo falla, no hace nada y reintenta en el
   próximo. */
import { BellRing, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

/** El adaptador del SIU real vuelve a leer el SIU cada 20 segundos (HACKAI_SIU_REAL_SEGUNDOS): preguntando cada
    10, lo nuevo se ve en medio minuto como mucho. */
const EVERY_MS = 10_000
/** Las notas que ya se conocen en este navegador, para avisar solo las nuevas. */
const KNOWN_KEY = 'hackai_notas_conocidas'
/** Si el alumno cerró el pedido de permiso. */
const DISMISSED_KEY = 'hackai_avisos_descartados'

type Grade = { key: string; subject: string; assessment: string; grade: number | null }

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url, { cache: 'no-store' })
    return response.ok ? ((await response.json()) as T) : null
  } catch {
    // Sin red o con el servidor caído: se reintenta en el próximo chequeo.
    return null
  }
}

function readKnown(): Set<string> | null {
  try {
    const raw = localStorage.getItem(KNOWN_KEY)
    return raw ? new Set(JSON.parse(raw) as string[]) : null
  } catch {
    return null
  }
}

function saveKnown(keys: Iterable<string>) {
  try {
    localStorage.setItem(KNOWN_KEY, JSON.stringify([...keys]))
  } catch {
    // Sin almacenamiento (ventana privada): se avisa de nuevo en la próxima visita, nada más.
  }
}

/** Avisa las notas que no conocía. La primera vez en este navegador solo las anota: no son nuevas. */
async function notifyNewGrades() {
  const found = await getJson<{ grades?: Grade[] }>('/api/siu/notas')
  if (!found?.grades) return
  const known = readKnown()
  if (known && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    for (const g of found.grades.filter((x) => !known.has(x.key))) {
      new Notification(`Nota nueva en ${g.subject}`, {
        body: `${g.assessment}: ${g.grade ?? 'sin nota'}`,
        tag: g.key
      })
    }
  }
  saveKnown(found.grades.map((g) => g.key))
}

export function SiuLive() {
  const router = useRouter()
  const [askPermission, setAskPermission] = useState(false)

  useEffect(() => {
    let dismissed = false
    try {
      dismissed = localStorage.getItem(DISMISSED_KEY) === 'si'
    } catch {
      // Sin almacenamiento: se ofrece igual.
    }
    setAskPermission(typeof Notification !== 'undefined' && Notification.permission === 'default' && !dismissed)
  }, [])

  useEffect(() => {
    let known: string | null = null
    let checking = false

    async function check() {
      if (checking || document.visibilityState !== 'visible') return
      checking = true
      const found = await getJson<{ version?: string | null }>('/api/siu/version')
      checking = false
      const version = found?.version
      if (!version) return
      if (known === null) void notifyNewGrades()
      else if (version !== known) {
        router.refresh()
        void notifyNewGrades()
      }
      known = version
    }

    void check()
    const timer = setInterval(check, EVERY_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') void check()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [router])

  if (!askPermission) return null

  async function allow() {
    await Notification.requestPermission()
    setAskPermission(false)
  }

  function dismiss() {
    try {
      localStorage.setItem(DISMISSED_KEY, 'si')
    } catch {
      // Sin almacenamiento: se vuelve a ofrecer en la próxima visita.
    }
    setAskPermission(false)
  }

  return (
    <div
      role='status'
      className='fixed inset-x-4 bottom-4 z-50 flex items-center gap-3 rounded-xl border bg-card p-3 text-card-foreground shadow-lg sm:inset-x-auto sm:right-6 sm:bottom-6 sm:max-w-sm'
    >
      <BellRing aria-hidden className='size-5 shrink-0 text-primary' />
      <p className='flex-1 text-sm'>¿Te avisamos en el momento cuando suban una nota?</p>
      <Button size='sm' onClick={allow}>
        Avisarme
      </Button>
      <Button size='icon-sm' variant='ghost' onClick={dismiss} aria-label='Ahora no'>
        <X />
      </Button>
    </div>
  )
}
