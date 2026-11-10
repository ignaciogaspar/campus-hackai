'use client'

import { useActionState, useEffect, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import { INITIAL_ACTION_STATE, type ActionState } from '@/components/assignments/action-state'
import {
  MAX_PROCESSES, MAX_ROWS, MIN_PROCESSES, ORG_KINDS, ORG_KIND_LABEL, ORG_SIZES, ORG_SIZE_LABEL,
  type OrganizationInput, type OrgKind, type OrgSize,
} from '@/lib/organizacion/types'

type Proc = OrganizationInput['processes'][number]
type Dato = OrganizationInput['dataAssets'][number]
type Sis = OrganizationInput['systems'][number]

const emptyProc = (): Proc => ({ name: '', pain: '', volume: '', owner: '' })
const emptyDato = (): Dato => ({ name: '', where: '', notes: '' })
const emptySis = (): Sis => ({ name: '', use: '' })

/** Ejemplos por fila (coherentes entre sí) para que los placeholders no parezcan datos cargados. */
const EJ_PROC = [
  { name: 'Cotizar pedidos mayoristas por WhatsApp', pain: 'Tarda 6 h en promedio; se pierden pedidos de noche', volume: '40 por día', owner: '2 vendedores' },
  { name: 'Conciliar cobranzas con el banco', pain: 'Se hace a mano en Excel; errores de imputación', volume: '1.500 por mes', owner: 'Tesorería' },
  { name: 'Responder reclamos de entregas', pain: 'Sin seguimiento; el cliente llama 3 veces', volume: '120 por semana', owner: 'Logística' },
  { name: 'Armar el reporte semanal de ventas', pain: 'Un día entero juntando planillas', volume: '1 por semana', owner: 'Jefe comercial' },
  { name: 'Cargar facturas de proveedores', pain: 'Tipeo manual, demoras en pagos', volume: '600 por mes', owner: 'Administración' },
]
const ej = (v: string) => `Ej.: ${v}`

/** Lo que se compara para saber si hay cambios sin guardar (sin filas vacías). */
function snapshot(p: OrganizationInput): string {
  return JSON.stringify({
    ...p,
    processes: p.processes.filter((x) => x.name.trim() || x.pain.trim() || x.volume.trim() || x.owner.trim()),
    dataAssets: p.dataAssets.filter((x) => x.name.trim() || x.where.trim() || x.notes.trim()),
    systems: p.systems.filter((x) => x.name.trim() || x.use.trim()),
    links: Object.fromEntries(Object.entries(p.links).filter(([, v]) => v)),
  })
}

const SECCIONES = ['Organización', 'Procesos', 'Datos', 'Sistemas']

const hora = (d: Date) => d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })

function Seccion({ n, title, why, done, optional, children }: {
  n: number
  title: string
  why: string
  done: boolean
  optional?: boolean
  children: ReactNode
}) {
  return (
    <section className="org-seccion card" aria-labelledby={`org-s${n}`} data-done={done || undefined}>
      <header className="org-seccion-head">
        <span className="org-seccion-num" aria-hidden="true">{done ? '✓' : n}</span>
        <div>
          <h2 id={`org-s${n}`}>{title}{optional ? <span className="org-opcional"> · opcional</span> : null}</h2>
          <p>{why}</p>
        </div>
      </header>
      {children}
    </section>
  )
}

function Quitar({ onClick, label }: { onClick: () => void; label: string }) {
  return <button type="button" className="org-quitar" onClick={onClick} aria-label={label} title={label}>×</button>
}

/** Alta y edición de Mi organización, en cuatro secciones más links. Manda todo como JSON en `payload`. */
export function OrganizacionForm({ initial, savedAt, action }: {
  initial: OrganizationInput | null
  /** updated_at de la organización guardada (ISO), si existe. */
  savedAt?: string | null
  action: (prev: ActionState, form: FormData) => Promise<ActionState>
}) {
  const [state, formAction, pending] = useActionState(action, INITIAL_ACTION_STATE)
  const [name, setName] = useState(initial?.name ?? '')
  const [kind, setKind] = useState<OrgKind>(initial?.kind ?? 'empresa')
  const [industry, setIndustry] = useState(initial?.industry ?? '')
  const [size, setSize] = useState<OrgSize | ''>(initial?.size ?? '')
  const [myRole, setMyRole] = useState(initial?.myRole ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [processes, setProcesses] = useState<Proc[]>(() => {
    const p = initial?.processes ?? []
    return p.length >= MIN_PROCESSES ? p : [...p, ...Array.from({ length: MIN_PROCESSES - p.length }, emptyProc)]
  })
  const [dataAssets, setDataAssets] = useState<Dato[]>(initial?.dataAssets?.length ? initial.dataAssets : [emptyDato()])
  const [systems, setSystems] = useState<Sis[]>(initial?.systems?.length ? initial.systems : [emptySis()])
  const [links, setLinks] = useState(initial?.links ?? {})

  const payload: OrganizationInput = { name, kind, industry, size, myRole, description, processes, dataAssets, systems, links }
  const current = snapshot(payload)
  const [saved, setSaved] = useState(() => (initial ? current : snapshot({ ...payload, name: '' })))
  const [savedTime, setSavedTime] = useState<Date | null>(savedAt ? new Date(savedAt) : null)
  const submitted = useRef<string | null>(null)
  const dirty = current !== saved

  // Al volver la action con éxito, lo enviado pasa a ser lo guardado.
  useEffect(() => {
    if (state.ok && submitted.current) {
      setSaved(submitted.current)
      setSavedTime(new Date())
    }
  }, [state])

  // Aviso del navegador si se va con cambios sin guardar.
  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  function edit<T>(set: Dispatch<SetStateAction<T[]>>, i: number, patch: Partial<T>) {
    set((rows) => rows.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  }
  const [undo, setUndo] = useState<{ label: string; restore: () => void } | null>(null)
  function remove<T>(set: Dispatch<SetStateAction<T[]>>, rows: T[], i: number, label: string) {
    const removed = rows[i]
    set(rows.filter((_, j) => j !== i))
    setUndo({ label, restore: () => set((now) => [...now.slice(0, i), removed, ...now.slice(i)]) })
  }
  useEffect(() => {
    if (!undo) return
    const t = setTimeout(() => setUndo(null), 8000)
    return () => clearTimeout(t)
  }, [undo])

  // ⌘S / Ctrl+S guarda.
  const formRef = useRef<HTMLFormElement>(null)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        formRef.current?.requestSubmit()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const filledProcesses = processes.filter((p) => p.name.trim()).length
  const secs = [
    Boolean(name.trim() && industry.trim() && size && myRole.trim() && description.trim()),
    filledProcesses >= MIN_PROCESSES,
    dataAssets.some((d) => d.name.trim()),
    systems.some((s) => s.name.trim()),
  ]
  const doneCount = secs.filter(Boolean).length

  return (
    <form ref={formRef} action={formAction} className="org-form" onSubmit={(e) => { if (!name.trim() || !dirty) { e.preventDefault(); return } submitted.current = current }}>
      <input type="hidden" name="payload" value={JSON.stringify(payload)} />

      <nav className="org-progreso" aria-label="Secciones">
        <span className="org-progreso-total" aria-live="polite"><strong>{doneCount} de {secs.length}</strong> completas</span>
        {SECCIONES.map((t, i) => (
          <a key={t} href={`#org-s${i + 1}`} className="org-chip" data-done={secs[i] || undefined}>
            {secs[i] ? '✓ ' : ''}{t}{i === 1 && !secs[1] ? ` ${filledProcesses}/${MIN_PROCESSES}` : ''}
          </a>
        ))}
      </nav>

      <Seccion n={1} title="La organización" why="Dónde vas a aplicar todo el programa. Si es confidencial, usá un nombre de fantasía." done={secs[0]}>
        <div className="org-campos">
          <label className="field org-ancho">
            <span>Nombre</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={160} required placeholder="Ej.: Distribuidora Litoral" />
          </label>
          <label className="field">
            <span>Qué es para vos</span>
            <select className="select" value={kind} onChange={(e) => setKind(e.target.value as OrgKind)}>
              {ORG_KINDS.map((k) => <option key={k} value={k}>{ORG_KIND_LABEL[k]}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Tu rol</span>
            <input className="input" value={myRole} onChange={(e) => setMyRole(e.target.value)} maxLength={160} placeholder="Ej.: Gerente comercial" />
          </label>
          <label className="field">
            <span>Industria</span>
            <input className="input" value={industry} onChange={(e) => setIndustry(e.target.value)} maxLength={120} placeholder="Ej.: Distribución mayorista" />
          </label>
          <label className="field">
            <span>Tamaño</span>
            <select className="select" value={size} onChange={(e) => setSize(e.target.value as OrgSize | '')}>
              <option value="">Elegí</option>
              {ORG_SIZES.map((s) => <option key={s} value={s}>{ORG_SIZE_LABEL[s]}</option>)}
            </select>
          </label>
          <label className="field org-ancho">
            <span>Qué hace</span>
            <textarea className="textarea" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={3000}
              placeholder="Ej.: Distribuye bebidas a 1.200 almacenes del Litoral. Toma pedidos por WhatsApp y con vendedores en calle; entrega en 48 h con flota propia." />
            <span className="ayuda">Dos o tres líneas: qué vende, a quién, cómo llega.</span>
          </label>
        </div>
      </Seccion>

      <Seccion n={2} title="Procesos candidatos" why={`Entre ${MIN_PROCESSES} y ${MAX_PROCESSES} tareas que se repiten y duelen. De acá sale el proceso que vas a atacar en Build, Data y Agents.`} done={secs[1]}>
        <ol className="org-procesos-form">
          {processes.map((p, i) => (
            <li key={i} className="org-proceso">
              <div className="org-proceso-head">
                <label className="field">
                  <span>Proceso {i + 1}</span>
                  <textarea className="textarea org-auto org-proceso-nombre" rows={1} value={p.name} onChange={(e) => edit(setProcesses, i, { name: e.target.value.replace(/\n/g, ' ') })} maxLength={160}
                    placeholder={ej(EJ_PROC[i % EJ_PROC.length].name)} />
                </label>
                {processes.length > 1 ? <Quitar onClick={() => remove(setProcesses, processes, i, p.name.trim() ? `Quitaste «${p.name.trim().slice(0, 40)}»` : 'Quitaste un proceso')} label={`Quitar proceso ${i + 1}`} /> : null}
              </div>
              <div className="org-proceso-detalle">
                <label className="field">
                  <span>Qué duele</span>
                  <textarea className="textarea org-auto" rows={1} value={p.pain} onChange={(e) => edit(setProcesses, i, { pain: e.target.value })} maxLength={600} placeholder={ej(EJ_PROC[i % EJ_PROC.length].pain)} />
                </label>
                <label className="field">
                  <span>Cuántas veces</span>
                  <input className="input" value={p.volume} onChange={(e) => edit(setProcesses, i, { volume: e.target.value })} maxLength={120} placeholder={ej(EJ_PROC[i % EJ_PROC.length].volume)} />
                </label>
                <label className="field">
                  <span>Quién lo hace hoy</span>
                  <input className="input" value={p.owner} onChange={(e) => edit(setProcesses, i, { owner: e.target.value })} maxLength={120} placeholder={ej(EJ_PROC[i % EJ_PROC.length].owner)} />
                </label>
              </div>
            </li>
          ))}
        </ol>
        <div className="org-agregar">
          {processes.length < MAX_PROCESSES
            ? <button type="button" className="btn btn-sm" onClick={() => setProcesses((r) => [...r, emptyProc()])}>+ Agregar proceso</button>
            : null}
          <span className="ayuda">{filledProcesses} de {MAX_PROCESSES} · concretos: «cotizar pedidos por WhatsApp», no «mejorar ventas».</span>
        </div>
      </Seccion>

      <Seccion n={3} title="Datos que tienen" why="Qué información guardan y dónde. Con esto armamos el laboratorio de datos y elegimos qué modelo tiene sentido." done={secs[2]}>
        <div className="org-filas">
          {dataAssets.map((d, i) => (
            <div key={i} className="org-fila3">
              <label className="field">
                <span>Qué datos</span>
                <textarea className="textarea org-auto" rows={1} value={d.name} onChange={(e) => edit(setDataAssets, i, { name: e.target.value.replace(/\n/g, ' ') })} maxLength={160} placeholder="Ej.: Pedidos 2021-2026" />
              </label>
              <label className="field">
                <span>Dónde están</span>
                <textarea className="textarea org-auto" rows={1} value={d.where} onChange={(e) => edit(setDataAssets, i, { where: e.target.value.replace(/\n/g, ' ') })} maxLength={160} placeholder="Ej.: ERP, Excel, mails, papel" />
              </label>
              <label className="field">
                <span>Calidad y volumen</span>
                <textarea className="textarea org-auto" rows={1} value={d.notes} onChange={(e) => edit(setDataAssets, i, { notes: e.target.value })} maxLength={600} placeholder="Ej.: ~80.000 filas, con huecos en 2022" />
              </label>
              {dataAssets.length > 1 ? <Quitar onClick={() => remove(setDataAssets, dataAssets, i, 'Quitaste una fila de datos')} label={`Quitar datos ${i + 1}`} /> : <span />}
            </div>
          ))}
        </div>
        {dataAssets.length < MAX_ROWS ? <div className="org-agregar"><button type="button" className="btn btn-sm" onClick={() => setDataAssets((r) => [...r, emptyDato()])}>+ Agregar datos</button></div> : null}
      </Seccion>

      <Seccion n={4} title="Sistemas que usan" why="Con qué trabajan hoy. Define a qué se puede conectar lo que construyas." done={secs[3]}>
        <div className="org-filas">
          {systems.map((s, i) => (
            <div key={i} className="org-fila2">
              <label className="field">
                <span>Sistema</span>
                <input className="input" value={s.name} onChange={(e) => edit(setSystems, i, { name: e.target.value })} maxLength={120} placeholder="Ej.: Tango Gestión" />
              </label>
              <label className="field">
                <span>Para qué</span>
                <textarea className="textarea org-auto" rows={1} value={s.use} onChange={(e) => edit(setSystems, i, { use: e.target.value.replace(/\n/g, ' ') })} maxLength={300} placeholder="Ej.: Facturación y stock" />
              </label>
              {systems.length > 1 ? <Quitar onClick={() => remove(setSystems, systems, i, 'Quitaste un sistema')} label={`Quitar sistema ${i + 1}`} /> : <span />}
            </div>
          ))}
        </div>
        {systems.length < MAX_ROWS ? <div className="org-agregar"><button type="button" className="btn btn-sm" onClick={() => setSystems((r) => [...r, emptySis()])}>+ Agregar sistema</button></div> : null}
      </Seccion>

      <Seccion n={5} title="Links" why="Se completan a medida que avanzás: el repo y la app aparecen en Build." done={Boolean(links.repo || links.app || links.web)} optional>
        <div className="org-campos">
          <label className="field">
            <span>Web de la organización</span>
            <input className="input" inputMode="url" autoCapitalize="off" spellCheck={false} value={links.web ?? ''} onChange={(e) => setLinks((l) => ({ ...l, web: e.target.value }))} placeholder="https://…" />
          </label>
          <label className="field">
            <span>Repo en GitHub</span>
            <input className="input" inputMode="url" autoCapitalize="off" spellCheck={false} value={links.repo ?? ''} onChange={(e) => setLinks((l) => ({ ...l, repo: e.target.value }))} placeholder="https://github.com/…" />
          </label>
          <label className="field">
            <span>App desplegada</span>
            <input className="input" inputMode="url" autoCapitalize="off" spellCheck={false} value={links.app ?? ''} onChange={(e) => setLinks((l) => ({ ...l, app: e.target.value }))} placeholder="https://….vercel.app" />
          </label>
        </div>
      </Seccion>

      <div className="org-guardar" role="region" aria-label="Guardar">
        <div className="org-guardar-estado" aria-live="polite">
          {undo ? (
            <span className="org-deshacer">{undo.label} · <button type="button" className="btn-link" onClick={() => { undo.restore(); setUndo(null) }}>Deshacer</button></span>
          ) : null}
          {state.error && !dirty ? <span className="org-estado-error">{state.error}</span>
            : pending ? <span>Guardando…</span>
            : dirty ? <span className="org-estado-sucio">Cambios sin guardar</span>
            : !name.trim() ? <span className="muted">Poné el nombre de la organización para poder guardar. Lo demás se completa cuando quieras.</span>
            : savedTime ? <span className="org-estado-ok">✓ Guardado a las {hora(savedTime)}</span>
            : <span className="muted">Podés guardar a medias y volver.</span>}
          {state.error && dirty ? <span className="org-estado-error">{state.error}</span> : null}
        </div>
        <button className="btn btn-primario" type="submit" disabled={pending || !name.trim() || !dirty} title="⌘S / Ctrl+S">
          {pending ? 'Guardando…' : !dirty && savedTime ? 'Guardado' : savedTime ? 'Guardar cambios' : 'Guardar'}
        </button>
      </div>
    </form>
  )
}
