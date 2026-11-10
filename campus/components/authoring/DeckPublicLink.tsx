'use client'

import { useState } from 'react'
import { setDeckPublicAction } from '@/app/profesor/decks/actions'
import { routes } from '@/lib/routes'

/** Link público del deck: cualquiera con el link lo ve sin login (sin notas del docente). */
export function DeckPublicLink({ deckId, initialToken }: { deckId: string; initialToken: string | null }) {
  const [token, setToken] = useState(initialToken)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const url = token && typeof window !== 'undefined' ? `${window.location.origin}${routes.publicDeck(token)}` : null

  async function toggle(next: boolean) {
    setBusy(true); setError(null)
    const res = await setDeckPublicAction({ deckId, public: next })
    setBusy(false)
    if (res.ok) { setToken(res.token); setCopied(false) } else setError(res.error)
  }

  async function copy() {
    if (!url) return
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!token) {
    return (
      <>
        <button className="btn btn-sm" type="button" disabled={busy} onClick={() => toggle(true)}
          title="Cualquiera con el link ve el deck sin entrar al campus. Las notas del docente no se muestran.">
          Compartir link público
        </button>
        {error ? <span className="chico alerta-error">{error}</span> : null}
      </>
    )
  }
  return (
    <>
      <button className="btn btn-sm" type="button" onClick={copy} title={url ?? undefined}>{copied ? 'Link copiado' : 'Copiar link público'}</button>
      <a className="btn btn-ghost btn-sm" href={routes.publicDeck(token)} target="_blank" rel="noreferrer">Abrir</a>
      <button className="btn btn-ghost btn-sm" type="button" disabled={busy} onClick={() => toggle(false)}
        title="El link deja de funcionar. Si lo volvés a activar, sale uno nuevo.">
        Dejar de compartir
      </button>
      {error ? <span className="chico alerta-error">{error}</span> : null}
    </>
  )
}
