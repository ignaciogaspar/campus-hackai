'use client'

import { useState } from 'react'
import type { ActivityView } from '@/lib/actividades/service'
import { StatusText, type OpStatus } from './useActivity'

type Op = (body: Record<string, unknown>) => Promise<boolean>
type Fields = Record<string, string>

function useFields(entry: Record<string, unknown> | null, keys: string[]): [Fields, (k: string, v: string) => void] {
  const [f, setF] = useState<Fields>(() => Object.fromEntries(keys.map((k) => [k, typeof entry?.[k] === 'string' ? (entry[k] as string) : ''])))
  return [f, (k, v) => setF((prev) => ({ ...prev, [k]: v }))]
}

function Area({ label, value, onChange, placeholder, rows = 3, help }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number; help?: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      <textarea className="textarea" rows={rows} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={{ minHeight: rows * 22 }} />
      {help ? <span className="ayuda">{help}</span> : null}
    </label>
  )
}

function Input({ label, value, onChange, placeholder, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input className="input" type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </label>
  )
}

function SaveBar({ onSave, status, label = 'Guardar' }: { onSave: () => void; status: OpStatus; label?: string }) {
  return (
    <div className="ac-guardar">
      <button type="button" className="btn btn-primario" onClick={onSave} disabled={status.kind === 'busy'}>{label}</button>
      <StatusText status={status} />
    </div>
  )
}

// ---------------------------------------------------------------- autopsia

export function AutopsiaTool({ view, op, status }: { view: ActivityView; op: Op; status: OpStatus }) {
  const [f, set] = useFields(view.entry, ['app', 'url', 'pantalla', 'servidor', 'base', 'apis', 'click', 'dudas'])
  const capas: Array<[string, string, string]> = [
    ['pantalla', 'Pantalla (front)', 'Lo que ves y tocás: formularios, botones, listas.'],
    ['servidor', 'Servidor (back)', 'Lo que decide: quién sos, qué podés ver, cuánto cuesta.'],
    ['base', 'Base de datos', 'Lo que queda guardado: tablas o listas (clientes, pedidos…).'],
    ['apis', 'APIs de afuera', 'Servicios de terceros: pagos, mapas, mails, IA, login con Google.'],
  ]
  return (
    <div className="stack">
      <div className="ac-campos">
        <Input label="App" value={f.app} onChange={(v) => set('app', v)} placeholder="Mercado Libre, el home banking…" />
        <Input label="URL" value={f.url} onChange={(v) => set('url', v)} placeholder="https://…" />
      </div>
      <div className="ac-campos">
        {capas.map(([k, label, help]) => <Area key={k} label={label} value={f[k]} onChange={(v) => set(k, v)} placeholder={help} rows={4} />)}
      </div>
      <Area label="Seguí un click de punta a punta" value={f.click} onChange={(v) => set('click', v)} rows={4}
        placeholder="Aprieto «Pagar» → la pantalla manda… → el servidor revisa… → guarda en… → llama a… → vuelve…" />
      <Area label="Lo que no sé cómo funciona" value={f.dudas} onChange={(v) => set('dudas', v)} rows={2} />
      <SaveBar onSave={() => op({ op: 'entry.save', data: f })} status={status} />
      <div>
        <div className="kicker" style={{ marginBottom: 8 }}>Tu diagrama{f.app ? ` · ${f.app}` : ''}</div>
        <div className="ac-diagrama" aria-label="Diagrama de cuatro capas">
          {capas.map(([k, label], i) => (
            <div key={k} className={`ac-capa${f[k].trim() ? '' : ' ac-capa-vacia'}${i === 3 ? ' ac-capa-cian' : ''}`}>
              <h4>{label}</h4>
              <p>{f[k].trim() || 'Sin completar'}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- seguí el request

export function RequestTool({ view, op, status }: { view: ActivityView; op: Op; status: OpStatus }) {
  const [f, set] = useFields(view.entry, ['app', 'accion', 'metodo', 'endpoint', 'status', 'ms', 'tamano', 'payload', 'respuesta', 'sorpresa'])
  const [texto, setTexto] = useState('hola servidor')
  const [eco, setEco] = useState<{ status: number; ms: number; body: string } | null>(null)

  async function probar() {
    const t0 = performance.now()
    const res = await fetch('/api/actividades/eco?espera=300', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mensaje: texto, enviadoA: new Date().toISOString() }),
    })
    const body = await res.text()
    const ms = Math.round(performance.now() - t0)
    setEco({ status: res.status, ms, body })
  }

  return (
    <div className="stack">
      <section className="card stack" style={{ gap: 10 }}>
        <h3 style={{ margin: 0 }}>1 · Pedido de prueba</h3>
        <p className="chico muted" style={{ margin: 0 }}>Abrí DevTools en la pestaña Network antes de apretar. Vas a ver una fila llamada <code>eco</code>.</p>
        <div className="fila">
          <input className="input" style={{ flex: '1 1 220px' }} value={texto} onChange={(e) => setTexto(e.target.value)} aria-label="Mensaje" />
          <button type="button" className="btn btn-accion" onClick={probar}>Mandar pedido</button>
        </div>
        {eco ? (
          <div className="stack" style={{ gap: 6 }}>
            <span className="chico">Status <strong>{eco.status}</strong> · tardó <strong>{eco.ms} ms</strong> medido desde tu navegador</span>
            <pre style={{ margin: 0, fontSize: 12, background: 'var(--hielo)', padding: 10, overflowX: 'auto' }}>{eco.body}</pre>
            <span className="chico muted">Compará estos números con los de la pestaña Timing en DevTools. ¿Coinciden? ¿Por qué no del todo?</span>
          </div>
        ) : null}
      </section>
      <section className="card stack" style={{ gap: 10 }}>
        <h3 style={{ margin: 0 }}>2 · Tu ficha con una app real</h3>
        <div className="ac-campos">
          <Input label="App" value={f.app} onChange={(v) => set('app', v)} />
          <Input label="Qué apretaste" value={f.accion} onChange={(v) => set('accion', v)} placeholder="Buscar, agregar al carrito…" />
          <Input label="Método" value={f.metodo} onChange={(v) => set('metodo', v)} placeholder="GET, POST…" />
          <Input label="Adónde fue (dominio y ruta)" value={f.endpoint} onChange={(v) => set('endpoint', v)} placeholder="api.ejemplo.com/search" />
          <Input label="Status" value={f.status} onChange={(v) => set('status', v)} placeholder="200" />
          <Input label="Tiempo (ms)" value={f.ms} onChange={(v) => set('ms', v)} />
          <Input label="Tamaño" value={f.tamano} onChange={(v) => set('tamano', v)} placeholder="12 kB" />
        </div>
        <div className="ac-campos">
          <Area label="Qué mandó (payload)" value={f.payload} onChange={(v) => set('payload', v)} />
          <Area label="Qué volvió (response)" value={f.respuesta} onChange={(v) => set('respuesta', v)} />
        </div>
        <Area label="Qué te sorprendió" value={f.sorpresa} onChange={(v) => set('sorpresa', v)} rows={2} />
        <SaveBar onSave={() => op({ op: 'entry.save', data: { ...f, probe: eco ? { at: new Date().toISOString(), ms: eco.ms, status: eco.status } : null } })} status={status} />
      </section>
    </div>
  )
}

// ---------------------------------------------------------------- galería

export function GaleriaTool({ view, op, status }: { view: ActivityView; op: Op; status: OpStatus }) {
  const [f, set] = useFields(view.entry, ['url', 'nombre', 'line', 'repo'])
  return (
    <div className="stack">
      <section className="card stack" style={{ gap: 10 }}>
        <h3 style={{ margin: 0 }}>Tu app</h3>
        <div className="ac-campos">
          <Input label="URL pública" value={f.url} onChange={(v) => set('url', v)} placeholder="https://mi-app.vercel.app" type="url" />
          <Input label="Nombre" value={f.nombre} onChange={(v) => set('nombre', v)} />
          <Input label="Repositorio (opcional)" value={f.repo} onChange={(v) => set('repo', v)} placeholder="https://github.com/…" />
        </div>
        <Input label="Para quién es y qué resuelve" value={f.line} onChange={(v) => set('line', v)} placeholder="Para [quién], que hoy [problema], esta app [qué hace]." />
        <SaveBar onSave={() => op({ op: 'entry.save', data: f })} status={status} label={view.entry ? 'Actualizar' : 'Publicar'} />
      </section>
      <Gallery cards={view.gallery} me={view.me} />
    </div>
  )
}

export function Gallery({ cards, me }: { cards: ActivityView['gallery']; me?: string }) {
  if (!cards.length) return <div className="vacio">Todavía nadie publicó su app.</div>
  return (
    <div className="ac-galeria">
      {cards.map((c) => (
        <article key={c.id} className={`card ac-app${c.id === me ? ' ac-app-mia' : ''}`}>
          <div className="kicker">{c.name}{c.company ? ` · ${c.company}` : ''}</div>
          {c.nombre ? <strong>{c.nombre}</strong> : null}
          <a className="ac-url" href={c.url} target="_blank" rel="noopener noreferrer">{c.url.replace(/^https?:\/\//, '').replace(/\/$/, '')}</a>
          {c.line ? <p className="chico" style={{ margin: 0 }}>{c.line}</p> : null}
          {c.repo ? <a className="chico" href={c.repo} target="_blank" rel="noopener noreferrer">Repositorio</a> : null}
        </article>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------- inventario

interface Row { dato: string; sistema: string; dueno: string; frecuencia: string; acceso: string; calidad: number; sensible: boolean }
const EMPTY_ROW: Row = { dato: '', sistema: '', dueno: '', frecuencia: '', acceso: 'si', calidad: 3, sensible: false }

export function InventarioTool({ view, op, status }: { view: ActivityView; op: Op; status: OpStatus }) {
  const [f, set] = useFields(view.entry, ['decision', 'hueco', 'conclusion'])
  const [rows, setRows] = useState<Row[]>(() => {
    const r = Array.isArray(view.entry?.rows) ? (view.entry.rows as Row[]) : []
    return r.length ? r : [{ ...EMPTY_ROW }, { ...EMPTY_ROW }, { ...EMPTY_ROW }]
  })
  const upd = (i: number, patch: Partial<Row>) => setRows((prev) => prev.map((r, k) => (k === i ? { ...r, ...patch } : r)))
  return (
    <div className="stack">
      <Area label="La decisión" value={f.decision} onChange={(v) => set('decision', v)} rows={2} placeholder="Qué decisión, quién la toma y cada cuánto." />
      <div className="tabla-scroll">
        <table className="ac-tabla">
          <thead>
            <tr><th>Dato</th><th>Dónde vive</th><th>Dueño</th><th>Se actualiza</th><th>Acceso</th><th>Calidad</th><th>Sensible</th><th /></tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td><input value={r.dato} onChange={(e) => upd(i, { dato: e.target.value })} placeholder="Ventas por cliente" aria-label="Dato" /></td>
                <td><input value={r.sistema} onChange={(e) => upd(i, { sistema: e.target.value })} placeholder="ERP, planilla, CRM…" aria-label="Dónde vive" /></td>
                <td><input value={r.dueno} onChange={(e) => upd(i, { dueno: e.target.value })} placeholder="Área o persona" aria-label="Dueño" /></td>
                <td><input value={r.frecuencia} onChange={(e) => upd(i, { frecuencia: e.target.value })} placeholder="Diaria, mensual…" aria-label="Frecuencia" /></td>
                <td>
                  <select value={r.acceso} onChange={(e) => upd(i, { acceso: e.target.value })} aria-label="Acceso">
                    <option value="si">Lo tengo</option><option value="pedido">Hay que pedirlo</option><option value="no">No existe</option>
                  </select>
                </td>
                <td>
                  <select value={r.calidad} onChange={(e) => upd(i, { calidad: Number(e.target.value) })} aria-label="Calidad">
                    {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </td>
                <td style={{ textAlign: 'center' }}><input type="checkbox" checked={r.sensible} onChange={(e) => upd(i, { sensible: e.target.checked })} aria-label="Sensible" style={{ width: 'auto', minWidth: 0 }} /></td>
                <td><button type="button" className="btn btn-ghost btn-sm" onClick={() => setRows((p) => p.filter((_, k) => k !== i))} aria-label="Quitar fila">×</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div><button type="button" className="btn btn-sm" onClick={() => setRows((p) => [...p, { ...EMPTY_ROW }])}>+ Agregar dato</button></div>
      <p className="chico muted" style={{ margin: 0 }}>Calidad: 1 = cargado a mano y con errores · 5 = automático y confiable.</p>
      <div className="ac-campos">
        <Area label="El hueco" value={f.hueco} onChange={(v) => set('hueco', v)} placeholder="Qué falta y cuánto cuesta conseguirlo." />
        <Area label="En una línea" value={f.conclusion} onChange={(v) => set('conclusion', v)} placeholder="Con estos datos, ¿la decisión mejora o no?" />
      </div>
      <SaveBar onSave={() => op({ op: 'entry.save', data: { ...f, rows } })} status={status} />
    </div>
  )
}

// ---------------------------------------------------------------- clon

export function ClonTool({ view, op, status }: { view: ActivityView; op: Op; status: OpStatus }) {
  const [f, set] = useFields(view.entry, ['copie', 'noCopie', 'herramientas', 'aprendizaje'])
  return (
    <div className="stack">
      <div className="ac-campos">
        <Area label="Qué copiaste" value={f.copie} onChange={(v) => set('copie', v)} rows={5} placeholder="Pantallas, funciones, flujo…" />
        <Area label="Qué NO pudiste copiar" value={f.noCopie} onChange={(v) => set('noCopie', v)} rows={5} placeholder="Datos, clientes, integraciones, confianza, conocimiento del negocio…" help="Esto es lo que ve tu pareja como su defensa." />
      </div>
      <div className="ac-campos">
        <Input label="Con qué lo hiciste" value={f.herramientas} onChange={(v) => set('herramientas', v)} placeholder="Claude Code, Vercel…" />
        <Input label="Qué aprendiste de tu propio producto" value={f.aprendizaje} onChange={(v) => set('aprendizaje', v)} />
      </div>
      <SaveBar onSave={() => op({ op: 'entry.save', data: f })} status={status} />
    </div>
  )
}
