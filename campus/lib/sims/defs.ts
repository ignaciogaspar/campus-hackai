import 'server-only'
import { db } from '@/lib/db'
import { SIMS, getSimDef, type SimDef } from './registry'

/** Definición de un sim: catálogo local o, si otra feature cargó uno, la fila de sim_definitions. */
export async function loadSimDef(id: string): Promise<SimDef | null> {
  const local = getSimDef(id)
  if (local) return local
  const { data } = await db().from('sim_definitions').select('id, title, description, url, meta').eq('id', id).maybeSingle()
  if (!data) return null
  return {
    id: data.id as string,
    title: data.title as string,
    description: (data.description as string | null) ?? '',
    kind: 'html',
    url: data.url as string,
    bloque: '',
    scoreLabel: null,
    ficticio: false,
    minutos: 30,
  }
}

/** Todos los sims publicados (catálogo + DB), en el orden del catálogo. */
export async function listSimDefs(): Promise<SimDef[]> {
  const { data } = await db().from('sim_definitions').select('id, title, description, url')
  const extra = ((data ?? []) as Array<{ id: string; title: string; description: string | null; url: string }>)
    .filter((r) => !getSimDef(r.id))
    .map((r): SimDef => ({ id: r.id, title: r.title, description: r.description ?? '', kind: 'html', url: r.url, bloque: '', scoreLabel: null, ficticio: false, minutos: 30 }))
  const published = new Set((data ?? []).map((r) => r.id as string))
  return [...SIMS.filter((s) => published.has(s.id)), ...extra]
}
