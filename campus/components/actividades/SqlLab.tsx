'use client'

import { useEffect, useRef, useState } from 'react'
import type { ActivityView } from '@/lib/actividades/service'
import { buildSalesDatabaseSql, compareResults, SQL_EXERCISES, SQL_SCHEMA_DOC, type SqlResult } from '@/lib/actividades/sql-lab'
import { StatusText, type OpStatus } from './useActivity'

type Op = (body: Record<string, unknown>) => Promise<boolean>

/* sql.js (SQLite compilado a WebAssembly) servido desde public/actividades/sqljs. */
interface SqlJsDb { exec(sql: string): SqlResult[]; run(sql: string): void; close(): void }
interface SqlJsStatic { Database: new () => SqlJsDb }
declare global { interface Window { initSqlJs?: (cfg: { locateFile: (f: string) => string }) => Promise<SqlJsStatic> } }

const BASE = '/actividades/sqljs/'
let loader: Promise<SqlJsStatic> | null = null

function loadSqlJs(): Promise<SqlJsStatic> {
  if (loader) return loader
  loader = new Promise<SqlJsStatic>((resolve, reject) => {
    const done = () => window.initSqlJs ? window.initSqlJs({ locateFile: (f) => `${BASE}${f}` }).then(resolve, reject) : reject(new Error('sql.js no cargó'))
    if (window.initSqlJs) return done()
    const s = document.createElement('script')
    s.src = `${BASE}sql-wasm.js`
    s.async = true
    s.onload = done
    s.onerror = () => { loader = null; reject(new Error('No se pudo cargar el motor SQL.')) }
    document.head.appendChild(s)
  })
  return loader
}

interface Solved { sql: string; at: string }

function ResultTable({ result }: { result: SqlResult | null }) {
  if (!result) return <p className="chico muted" style={{ margin: 0 }}>La consulta no devolvió filas.</p>
  const rows = result.values.slice(0, 200)
  return (
    <div className="ac-resultado">
      <table className="ac-tabla">
        <thead><tr>{result.columns.map((c, i) => <th key={i}>{c}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{r.map((v, k) => <td key={k}>{v === null ? 'NULL' : String(v)}</td>)}</tr>)}</tbody>
      </table>
      {result.values.length > rows.length ? <p className="chico muted" style={{ padding: 6, margin: 0 }}>Mostrando 200 de {result.values.length} filas.</p> : null}
    </div>
  )
}

export function SqlLab({ view, op, status }: { view: ActivityView; op: Op; status: OpStatus }) {
  const dbRef = useRef<SqlJsDb | null>(null)
  const [ready, setReady] = useState<'cargando' | 'listo' | 'error'>('cargando')
  const [solved, setSolved] = useState<Record<string, Solved>>(() => (view.entry?.solved as Record<string, Solved>) ?? {})
  const [attempts, setAttempts] = useState<Record<string, number>>(() => (view.entry?.attempts as Record<string, number>) ?? {})
  const [propia, setPropia] = useState(() => (typeof view.entry?.propia === 'string' ? view.entry.propia : ''))
  const [current, setCurrent] = useState(() => SQL_EXERCISES.find((e) => !((view.entry?.solved as Record<string, Solved> | undefined)?.[e.id]))?.id ?? SQL_EXERCISES[0].id)
  const [drafts, setDrafts] = useState<Record<string, string>>(() => Object.fromEntries(SQL_EXERCISES.map((e) => [e.id, (view.entry?.solved as Record<string, Solved> | undefined)?.[e.id]?.sql ?? 'SELECT * FROM ventas LIMIT 10'])))
  const [result, setResult] = useState<SqlResult | null | undefined>(undefined)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [hint, setHint] = useState(false)

  useEffect(() => {
    let cancelled = false
    loadSqlJs().then((SQL) => {
      if (cancelled) return
      const db = new SQL.Database()
      db.run(buildSalesDatabaseSql())
      dbRef.current = db
      setReady('listo')
    }).catch(() => { if (!cancelled) setReady('error') })
    return () => { cancelled = true; dbRef.current?.close(); dbRef.current = null }
  }, [])

  const ex = SQL_EXERCISES.find((e) => e.id === current) ?? SQL_EXERCISES[0]
  const sql = drafts[ex.id] ?? ''

  function exec(q: string): SqlResult | null {
    const out = dbRef.current!.exec(q)
    return out.length ? out[out.length - 1] : null
  }

  function run() {
    if (!dbRef.current) return
    setMsg(null)
    try {
      setResult(exec(sql))
    } catch (e) {
      setResult(undefined)
      setMsg({ ok: false, text: `Error de SQL: ${e instanceof Error ? e.message : String(e)}` })
    }
  }

  async function verify() {
    if (!dbRef.current) return
    let got: SqlResult | null
    try {
      got = exec(sql)
      setResult(got)
    } catch (e) {
      setMsg({ ok: false, text: `Error de SQL: ${e instanceof Error ? e.message : String(e)}` })
      return
    }
    const expected = exec(ex.solution)!
    const cmp = compareResults(got, expected, ex.ordered)
    const nextAttempts = { ...attempts, [ex.id]: (attempts[ex.id] ?? 0) + 1 }
    setAttempts(nextAttempts)
    if (!cmp.ok) {
      setMsg({ ok: false, text: cmp.reason ?? 'No coincide.' })
      void op({ op: 'entry.save', data: { solved, attempts: nextAttempts, propia } })
      return
    }
    const nextSolved = { ...solved, [ex.id]: { sql, at: new Date().toISOString() } }
    setSolved(nextSolved)
    setMsg({ ok: true, text: '¡Correcto! Quedó guardado.' })
    void op({ op: 'entry.save', data: { solved: nextSolved, attempts: nextAttempts, propia } })
  }

  const count = Object.keys(solved).length

  return (
    <div className="ac-sql">
      <div className="fila" style={{ justifyContent: 'space-between' }}>
        <div className="ac-ejercicios" role="group" aria-label="Ejercicios">
          {SQL_EXERCISES.map((e, i) => (
            <button key={e.id} type="button" className={`ac-ej${solved[e.id] ? ' ac-ej-ok' : ''}`} aria-pressed={e.id === current}
              onClick={() => { setCurrent(e.id); setResult(undefined); setMsg(null); setHint(false) }}>
              {solved[e.id] ? '✓ ' : ''}{i + 1}. {e.title}
            </button>
          ))}
        </div>
        <span className="badge badge-ok">{count} de {SQL_EXERCISES.length}</span>
      </div>

      <section className="card stack" style={{ gap: 10 }}>
        <div>
          <div className="kicker">Ejercicio {SQL_EXERCISES.indexOf(ex) + 1}</div>
          <p style={{ margin: '4px 0 0' }}>{ex.prompt}</p>
        </div>
        <textarea className="textarea" value={sql} spellCheck={false} aria-label="Consulta SQL"
          onChange={(e) => setDrafts((d) => ({ ...d, [ex.id]: e.target.value }))}
          onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); run() } }} />
        <div className="fila">
          <button type="button" className="btn" onClick={run} disabled={ready !== 'listo'}>Correr <span className="chico muted">(Ctrl+Enter)</span></button>
          <button type="button" className="btn btn-primario" onClick={verify} disabled={ready !== 'listo'}>Verificar</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setHint((h) => !h)}>{hint ? 'Ocultar pista' : 'Pista'}</button>
          {ready === 'cargando' ? <span className="chico muted">Cargando la base…</span> : null}
          {ready === 'error' ? <span className="ac-estado ac-estado-error">No se pudo cargar el motor SQL. Recargá la página.</span> : null}
          <StatusText status={status} />
        </div>
        {hint ? <pre>{ex.hint}</pre> : null}
        {msg ? <div className={`alerta ${msg.ok ? 'alerta-ok' : 'alerta-error'}`} role="status">{msg.text}</div> : null}
        {result !== undefined ? <ResultTable result={result} /> : null}
      </section>

      <details className="card">
        <summary><strong>Esquema de la base</strong></summary>
        <pre style={{ marginTop: 8 }}>{SQL_SCHEMA_DOC}</pre>
        <p className="chico muted">Si le pedís ayuda a Claude, pegale este esquema y el enunciado. Leé la consulta antes de correrla.</p>
      </details>

      <section className="card stack" style={{ gap: 8 }}>
        <h3 style={{ margin: 0 }}>Tu pregunta</h3>
        <label className="field">
          <span>Una pregunta de tu negocio que se respondería con SQL sobre tus datos</span>
          <textarea className="textarea" rows={3} value={propia} onChange={(e) => setPropia(e.target.value)} placeholder="¿Qué clientes compraron menos este trimestre que el anterior, y quién los atiende?" />
        </label>
        <div><button type="button" className="btn" onClick={() => op({ op: 'entry.save', data: { solved, attempts, propia } })}>Guardar pregunta</button></div>
      </section>
    </div>
  )
}
