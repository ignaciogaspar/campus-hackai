'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js'

/* Suscripción a los broadcasts de una clase en vivo con la anon key.
   Los canales son PRIVADOS (config.private): la política RLS de
   realtime.messages deja leer pero no emitir, así que un cliente no puede
   inyectar eventos. Solo el servidor emite (lib/realtime.ts).
   - `live:<liveSessionId>`: state, deck.changed, poll.updated (sin textos)…
   - el canal del profesor (nombre firmado que manda el servidor a /live/[id]):
     transcript, agent.turn, draw, settings, poll.updated completo. */

let browserClient: SupabaseClient | null = null

/** Cliente supabase del navegador (anon key). Solo para Realtime: no tiene acceso a tablas (RLS sin políticas). */
export function browserSupabase(): SupabaseClient {
  if (!browserClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !key) throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY')
    browserClient = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  }
  return browserClient
}

export type LiveChannelStatus = 'connecting' | 'subscribed' | 'error' | 'closed'

export type LiveHandler = (event: string, payload: Record<string, unknown>) => void

/**
 * Escucha todos los eventos del canal `live:<liveSessionId>`.
 * `handler(event, payload)` se puede redefinir en cada render (se guarda en un ref).
 * Al reconectar ('subscribed' de nuevo) conviene pedir GET /api/live/<id>/state.
 */
export function useLiveChannel(liveSessionId: string | null | undefined, handler: LiveHandler): { status: LiveChannelStatus } {
  return useBroadcastChannel(liveSessionId ? `live:${liveSessionId}` : null, handler)
}

/** Escucha un topic privado cualquiera (por ejemplo el canal del profesor que manda el servidor). */
export function useBroadcastChannel(topic: string | null | undefined, handler: LiveHandler): { status: LiveChannelStatus } {
  const ref = useRef(handler)
  ref.current = handler
  const [status, setStatus] = useState<LiveChannelStatus>('connecting')

  useEffect(() => {
    if (!topic) return
    const supabase = browserSupabase()
    let channel: RealtimeChannel | null = supabase.channel(topic, { config: { private: true, broadcast: { self: false } } })
    channel
      .on('broadcast', { event: '*' }, (msg) => {
        ref.current(String(msg.event), (msg.payload ?? {}) as Record<string, unknown>)
      })
      .subscribe((s) => {
        if (s === 'SUBSCRIBED') setStatus('subscribed')
        else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') setStatus('error')
        else if (s === 'CLOSED') setStatus('closed')
      })
    return () => {
      if (channel) void supabase.removeChannel(channel)
      channel = null
    }
  }, [topic])

  return { status }
}
